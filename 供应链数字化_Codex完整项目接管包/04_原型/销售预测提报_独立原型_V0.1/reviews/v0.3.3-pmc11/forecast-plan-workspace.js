/* Forecast-plan workspace: batch-first backend operations. */
(() => {
  const h = React.createElement;
  const { useEffect, useMemo, useRef, useState } = React;
  const { Alert, App, Button, Checkbox, DatePicker, Descriptions, Divider, Drawer, Dropdown, Empty, Form, Input, InputNumber, Menu, Pagination, Popover, Progress, Select, Space, Steps, Table, Tabs, Tag, Tooltip, Upload } = antd;
  const icon = window.icons || {};
  const model = window.ForecastBatchModel.createStore({}, null);
  const contract = model.contract;
  window.ForecastBatchContract = contract;
  let pendingRoute = { view: 'plans', detailId: null, step: 'maintenance' };
  const clone = value => JSON.parse(JSON.stringify(value));
  const dateText = value => String(value || '').slice(0, 16).replace('T', ' ').replaceAll('-', '/');
  const dayText = value => String(value || '').slice(0, 10).replaceAll('-', '/');
  const scopeText = (value, allLabel) => {
    const text = String(value || '').trim();
    return !text || text === '全部' || text === allLabel ? allLabel : text;
  };
  const batchText = value => `${dayText(value?.batchDate || value)} 批次`;
  const number = value => Number(value || 0).toLocaleString('zh-CN');
  const percent = value => `${(Number(value || 0) / 100).toFixed(2).replace(/\.00$/, '')}%`;
  const allocateForecast = (total, weights) => {
    const sum = weights.reduce((value, weight) => value + Number(weight || 0), 0);
    if (!sum) return weights.map(() => 0);
    const raw = weights.map(weight => Math.round(Number(total || 0)) * Number(weight || 0) / sum);
    const result = raw.map(Math.floor);
    let remainder = Math.round(Number(total || 0)) - result.reduce((value, item) => value + item, 0);
    raw.map((value, index) => ({ index, fraction: value - result[index] }))
      .sort((left, right) => right.fraction - left.fraction || left.index - right.index)
      .forEach(item => { if (remainder > 0) { result[item.index] += 1; remainder -= 1; } });
    return result;
  };
  const signedPercent = value => `${value > 0 ? '+' : ''}${Number(value || 0).toFixed(1)}%`;
  const relationKey = row => [row.country, row.store, row.parentASIN].join('|');
  const childForecastKey = row => [row.country, row.store, row.childASIN].join('|');
  const parentForecastKey = row => [row.country, row.store, row.parentASIN].join('|');
  const contractChild = (index, row) => index?.children?.[childForecastKey(row)] || null;
  const contractParent = (index, row) => index?.parents?.[parentForecastKey(row)] || null;
  const statusColor = { 草稿: 'default', 评估中: 'processing', 参数调整中: 'processing', 参数已确认: 'success', 关系确认中: 'warning', 关系已确认: 'success', 拆解规则确认中: 'warning', 拆解已确认: 'success', 预测计算中: 'processing', 规则预测待确认: 'warning', 规则预测已确认: 'success', 规则预测已生成: 'success', 待发布: 'default', 销售填报中: 'processing', PMC审核中: 'warning', 待复盘: 'warning', 已冻结: 'default', 已完成: 'success' };
  const statusTag = value => h(Tag, { color: statusColor[value] || 'default' }, value);
  const pmcStatusLabel = batch => {
    if (batch.status === '已完成') return '已冻结';
    if (batch.submissionState === '已冻结') return '已冻结';
    if (batch.submissionState === '填报中') return '销售填报中';
    if (batch.resultConfirmed) return '待发起填报';
    if (batch.resultState === '已生成') return '待PMC确认';
    if (batch.resultState === '需重新生成') return 'PMC调整中';
    if (batch.resultState === '计算中') return '计算中';
    return '待计算';
  };
  const pmcStatusTag = batch => {
    const label = pmcStatusLabel(batch);
    const color = { 待计算: 'default', 计算中: 'processing', 待PMC确认: 'warning', PMC调整中: 'processing', 待发起填报: 'success', 销售填报中: 'processing', 已冻结: 'default' }[label] || 'default';
    return h(Tag, { color }, label);
  };
  const resultStateLabel = batch => batch.resultState === '已生成' ? '已生成' : batch.resultState === '需重新生成' ? '待重新生成' : batch.resultState === '计算中' ? '计算中' : '待计算';
  const seasonBusinessText = row => {
    const raw = row.sourceFields?.['季节属性_实际使用'] || row.seasonRuntime?.label || row.sourceFields?.['季节运行模式'];
    if (Object.values(row.dailyForecastStatus || {}).some(Boolean)) return '人工启动（待实际销量）';
    if (raw && !/^F\d+/i.test(String(raw))) return raw;
    if (row.typeCode === 'F10') return '季节重启动';
    if (row.typeCode === 'F03') return '秋冬季';
    return '正常销售季';
  };
  function useStoreRevision() {
    const [, bump] = useState(0);
    useEffect(() => model.subscribe(() => bump(value => value + 1)), []);
    return model.getState();
  }
  function PageHead({ title, subtitle, actions }) {
    return h('div', { className: 'fp-page-head' }, h('div', null, h('h1', null, title), subtitle && h('div', { className: 'fp-subtitle' }, subtitle)), actions && h('div', { className: 'fp-head-actions' }, actions));
  }
  const sumColumnWidths = columns => (columns || []).reduce((total, column) => {
    if (column.children) return total + sumColumnWidths(column.children);
    const width = Number.parseInt(column.width, 10);
    return total + (Number.isFinite(width) ? width : 120);
  }, 0);
  const normalizePlanColumns = columns => (columns || []).map(column => {
    const next = { ...column, align: column.align || 'left' };
    if (column.children) next.children = normalizePlanColumns(column.children);
    return next;
  });
  const paginationLocale = { items_per_page: '条/页', jump_to: '跳至', jump_to_confirm: '确定', page: '页', prev_page: '上一页', next_page: '下一页', prev_5: '向前5页', next_5: '向后5页', page_size: '每页条数' };
  const planPagination = pagination => {
    const base = { size: 'small', defaultPageSize: 20, pageSizeOptions: [5, 20, 50], showSizeChanger: true, showQuickJumper: false, hideOnSinglePage: false };
    if (pagination === false || pagination == null) return base;
    return { ...base, ...pagination };
  };
  const planScroll = (columns, scroll) => ({ x: Math.max(960, sumColumnWidths(columns)), y: 420, ...(scroll || {}) });
  function PlanTable({ columns = [], className, dataSource = [], hostRef, pagination, scroll, ...props }) {
    const paginationConfig = pagination === false ? null : planPagination(pagination);
    const initialPageSize = Number(paginationConfig?.defaultPageSize ?? paginationConfig?.pageSize ?? 20);
    const [current, setCurrent] = useState(Number(paginationConfig?.defaultCurrent || 1));
    const [pageSize, setPageSize] = useState(initialPageSize);
    const [destination, setDestination] = useState(null);
    const total = Number(paginationConfig?.total ?? dataSource.length);
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const safeCurrent = Math.min(current, maxPage);
    useEffect(() => {
      if (current > maxPage) setCurrent(maxPage);
    }, [current, maxPage]);
    useEffect(() => setDestination(null), [safeCurrent, pageSize, total]);
    const changePage = (nextPage, nextSize = pageSize) => {
      const normalizedSize = Number(nextSize || pageSize);
      const normalizedPage = normalizedSize !== pageSize ? 1 : nextPage;
      setCurrent(normalizedPage);
      setPageSize(normalizedSize);
      paginationConfig?.onChange?.(normalizedPage, normalizedSize);
    };
    const jump = () => {
      if (destination == null) return;
      changePage(Math.max(1, Math.min(maxPage, Math.trunc(destination))));
      setDestination(null);
    };
    const tablePagination = paginationConfig ? { current: safeCurrent, pageSize, total, position: ['none'] } : false;
    return h('div', { ref: hostRef, className: 'fp-plan-table-shell' },
      h(Table, { size: 'small', sticky: true, ...props, dataSource, className: ['fp-plan-table', className].filter(Boolean).join(' '), columns: normalizePlanColumns(columns), scroll: planScroll(columns, scroll), pagination: tablePagination }),
      paginationConfig && h('div', { className: 'fp-plan-pagination' },
        h('div', { className: 'forecast-pagination-bar' },
          h(Pagination, {
            current: safeCurrent,
            pageSize,
            total,
            size: 'small',
            locale: paginationLocale,
            showSizeChanger: paginationConfig.showSizeChanger,
            showQuickJumper: false,
            hideOnSinglePage: false,
            pageSizeOptions: paginationConfig.pageSizeOptions,
            showTotal: paginationConfig.showTotal || (count => h('span', { className: 'forecast-page-total' }, '共 ', h('b', null, number(count)), ' 条')),
            onChange: changePage
          }),
          h('label', { className: 'forecast-page-jump' }, '跳至', h(InputNumber, { 'aria-label': '跳转页码', min: 1, max: maxPage, precision: 0, controls: false, disabled: !total, value: destination, onChange: setDestination, onPressEnter: jump, onBlur: jump, style: { width: 44 }, size: 'small' }), '页')
        )
      )
    );
  }
  function PlanListPanel({ title, meta, search, toolbar, children }) {
    return h('div', { className: 'fp-list-layout' },
      search && h('section', { className: 'fp-panel fp-list-search-panel' }, search),
      toolbar && h('section', { className: 'fp-panel fp-list-toolbar-panel' }, toolbar),
      h('section', { className: 'fp-panel fp-list-table-panel' },
        (title || meta) && h('div', { className: 'fp-panel-head' }, h('h2', null, title), meta),
        h('div', { className: 'fp-table-wrap fp-list-table' }, children)
      )
    );
  }
  const addDays = (value, days) => { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
  const salesCounts = batch => {
    const state = window.pmcWorkflow?.getBatchState?.(batch.id);
    return state ? { submitted: state.submitted, pending: state.pending, confirmed: state.confirmed } : { submitted: 0, pending: 0, confirmed: 0 };
  };
  const batchProgress = batch => batch.status === '已完成' ? 100 : batch.submissionState === '已冻结' ? 82 + Math.round(salesCounts(batch).confirmed / Math.max(1, batch.childForecastResults.length) * 13) : batch.submissionState === '填报中' ? 55 + Math.round(salesCounts(batch).submitted / Math.max(1, batch.childForecastResults.length) * 25) : batch.resultState === '已生成' ? 55 : batch.splitConfirmed ? 43 : batch.relationConfirmed ? 32 : ['参数已确认', '关系确认中'].includes(batch.status) ? 23 : batch.currentStep === 'parameters' ? 15 : 8;
  const batchTodo = batch => {
    const counts = salesCounts(batch);
    if (batch.status === '已完成') return '查看最终预测';
    if (batch.submissionState === '已冻结') return counts.confirmed === batch.childForecastResults.length ? '最终确认批次' : `${batch.childForecastResults.length - counts.confirmed} 条待PMC审核`;
    if (batch.submissionState === '填报中') return counts.pending ? `${counts.pending} 条待PMC审核` : `${Math.max(0, batch.childForecastResults.length - counts.submitted)} 个子ASIN待填报`;
    return batch.resultState === '需重新生成' ? '重新生成规则预测' : batch.resultState === '已生成' ? batch.resultConfirmed ? '发起销售填报' : '确认规则预测' : batch.splitConfirmed ? '生成规则预测' : batch.relationConfirmed ? '确认子体与组合拆解' : batch.currentStep === 'relations' ? '确认父子关系' : batch.currentStep === 'parameters' ? '确认预测参数' : '评估上一批次';
  };
  const batchStage = batch => {
    if (batch.status === '已完成') return { key: 'completed', label: '已完成', index: 5 };
    if (batch.submissionState === '已冻结') {
      const counts = salesCounts(batch);
      return counts.pending || counts.confirmed ? { key: 'review', label: 'PMC审核', index: 4 } : { key: 'freeze', label: '填报冻结', index: 3 };
    }
    if (batch.submissionState === '填报中') return { key: 'submission', label: '销售填报', index: 2 };
    if (batch.resultState === '已生成') return { key: 'forecast', label: '规则预测生成', index: 1 };
    return { key: 'config', label: '配置准备', index: 0 };
  };
  const batchStageColor = batch => batchStage(batch).index >= 5 ? 'success' : batchStage(batch).index > 0 ? 'processing' : 'warning';
  const configChangeCount = batch => batch.relationChanges.length + batch.adjustmentLog.length + (batch.resultState === '需重新生成' ? 1 : 0);
  const salesStateLabel = batch => ({ 待发布: '未开始', 填报中: '进行中', 已冻结: '已冻结' }[batch.submissionState] || batch.submissionState);
  function BatchList({ onOpen }) {
    const { message } = App.useApp();
    const [query, setQuery] = useState('');
    const [queryDraft, setQueryDraft] = useState('');
    const [filters, setFilters] = useState({ month: undefined, status: undefined, country: undefined, creator: undefined });
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [detailBatch, setDetailBatch] = useState(null);
    const [wizardStep, setWizardStep] = useState(0);
    const [draft, setDraft] = useState(null);
    const [wizardError, setWizardError] = useState('');
    const allBatches = model.list();
    const batches = allBatches.filter(batch => {
      const stage = batchStage(batch).label;
      return (!query || [batch.name, batchText(batch), batch.id, batch.batchVersion, stage].some(value => String(value).includes(query.trim())))
        && (!filters.month || batch.forecastStartDate.startsWith(filters.month))
        && (!filters.status || batch.status === filters.status)
        && (!filters.country || batch.scope?.country === filters.country)
        && (!filters.creator || batch.createdBy === filters.creator);
    });
    const openCreate = () => {
      const current = model.getCurrent();
      const base = model.list().find(batch => batch.status === '已完成') || current;
      const batchDate = addDays(current.batchDate, 7);
      const end = addDays(batchDate, 181);
      setDraft({ name: `${batchDate.slice(0, 7)} 预测批次`, batchDate, country: current.scope?.country === '全部' ? 'US' : current.scope?.country || 'US', platform: current.scope?.platform === '全部' ? 'Amazon' : current.scope?.platform || 'Amazon', dataCutoffDate: addDays(batchDate, -1), forecastStartDate: batchDate, forecastEndDate: end, start: `${batchDate}T09:00`, deadline: `${addDays(batchDate, 4)}T18:00`, freeze: `${addDays(batchDate, 4)}T18:00`, autoFreeze: true, inheritFromBatchId: base.id, inheritEnabled: true, inherit: { parameters: true, relations: true, split: true, combo: true, season: true, tags: true } });
      setWizardStep(0); setWizardError(''); setDrawerOpen(true);
    };
    const update = (key, value) => { setDraft(current => ({ ...current, [key]: value })); setWizardError(''); };
    const updateMonth = value => {
      if (!value) return;
      const day = Math.min(Number(draft.batchDate.slice(8, 10)) || 1, new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)), 0).getDate());
      const batchDate = `${value}-${String(day).padStart(2, '0')}`;
      const end = addDays(batchDate, 181);
      setDraft(current => ({ ...current, batchDate, name: `${value} 预测批次`, dataCutoffDate: addDays(batchDate, -1), forecastStartDate: batchDate, forecastEndDate: end, start: `${batchDate}T09:00`, deadline: `${addDays(batchDate, 4)}T18:00`, freeze: `${addDays(batchDate, 4)}T18:00` }));
      setWizardError('');
    };
    const validateDraft = step => {
      if (step === 0) {
        if (!draft.name?.trim() || !draft.batchDate || !draft.dataCutoffDate || !draft.forecastStartDate || !draft.forecastEndDate) return '请填写预测月份、数据截点和预测周期';
        if (draft.forecastStartDate > draft.forecastEndDate) return '预测开始日期不能晚于结束日期';
        if (draft.dataCutoffDate >= draft.forecastStartDate) return '数据截点必须早于预测开始日期';
        if (model.list().some(batch => batch.batchDate === draft.batchDate)) return '该批次日期已存在，请选择其他预测月份';
      }
      if (step === 2) {
        if (!draft.start || !draft.deadline || !draft.freeze) return '请填写销售填报开放、截止和冻结时间';
        if (draft.start >= draft.deadline || draft.deadline > draft.freeze) return '填报开放、截止和冻结时间顺序不正确';
        const overlap = model.list().some(batch => batch.submissionState !== '待发布' && draft.start < String(batch.submissionWindow.submissionFreezeTime).slice(0, 16) && draft.deadline > String(batch.submissionWindow.submissionStartTime).slice(0, 16));
        if (overlap) return '销售填报窗口与已有批次重叠';
      }
      return null;
    };
    const create = () => { const error = validateDraft(2); if (error) return setWizardError(error); try {
      const time = value => `${value}:00+08:00`;
      const inheritance = draft.inheritEnabled ? draft.inherit : Object.fromEntries(Object.keys(draft.inherit).map(key => [key, false]));
      const next = model.createNextBatch({ ...draft, inherit: inheritance, name: draft.name.trim(), submissionWindow: { submissionStartTime: time(draft.start), submissionDeadlineTime: time(draft.deadline), submissionFreezeTime: time(draft.freeze), autoFreeze: Boolean(draft.autoFreeze), status: '待发布' } });
      setDrawerOpen(false); onOpen(next.id); message.success(`已创建 ${next.name} 草稿`);
    } catch (failure) { message.error(failure.message); } };
    const base = model.getBatch(draft?.inheritFromBatchId);
    const fields = [['name', '预测批次名称', 'text'], ['dataCutoffDate', '预测数据截点', 'date'], ['forecastStartDate', '预测窗口开始', 'date'], ['forecastEndDate', '预测窗口结束', 'date']];
    const inheritItems = [['parameters', '预测参数', base?.parameterSnapshot?.version], ['relations', '父子ASIN关系', base?.relationVersion], ['split', '子体拆解规则', base?.splitRuleSnapshot?.version], ['combo', '销售组合映射与比例', `${base?.childForecastResults?.filter(row => row.businessObjectType === 'COMBO').length || 0} 个组合`], ['season', '季节参数', `季节指数 ${base?.parameterSnapshot?.seasonIndex ?? 1}`], ['tags', 'PMC人工标签', '系统标签重新计算']];
    const columns = [
      { title: '批次名称', dataIndex: 'name', width: 170, fixed: 'left', render: (_, row) => h(Button, { type: 'link', className: 'fp-link', onClick: () => onOpen(row.id) }, row.name) },
      { title: '预测窗口', width: 150, render: (_, row) => `${dayText(row.forecastStartDate)} ~ ${dayText(row.forecastEndDate)}` },
      { title: '销售填报窗口', width: 172, render: (_, row) => `${dateText(row.submissionWindow.submissionStartTime)} ~ ${dateText(row.submissionWindow.submissionDeadlineTime)}` },
      { title: '当前阶段', width: 112, render: (_, row) => h('div', { className: 'fp-stage-cell' }, statusTag(batchStage(row).label), h('span', null, `填报${salesStateLabel(row)}`), row.submissionState === '填报中' && salesCounts(row).pending ? h(Tag, { color: 'warning' }, '待审核') : null) },
      { title: '规则预测', width: 92, render: (_, row) => h(Tag, { color: row.resultState === '已生成' ? 'success' : 'default' }, row.resultState === '已生成' ? '已生成' : '待生成') },
      { title: '配置变更', width: 78, render: (_, row) => configChangeCount(row) ? h('span', { className: 'fp-highlight' }, `${configChangeCount(row)} 项`) : h('span', { className: 'fp-muted' }, '—') },
      { title: '当前进度', width: 104, render: (_, row) => h(Progress, { percent: batchProgress(row), size: 'small' }) },
      { title: '待处理事项', width: 142, render: (_, row) => row.status === '已完成' ? batchTodo(row) : h(Tooltip, { title: batchTodo(row) }, h('span', { className: 'fp-cell-ellipsis' }, batchTodo(row))) },
      { title: '操作', width: 112, fixed: 'right', render: (_, row) => h(Space, { size: 0 }, h(Button, { type: 'link', onClick: () => setDetailBatch(row) }, '详情'), h(Button, { type: 'link', onClick: () => onOpen(row.id) }, '进入')) }
    ];
    const filterOptions = {
      month: [...new Set(allBatches.map(row => row.forecastStartDate.slice(0, 7)))].map(value => ({ value, label: value.replace('-', '年') + '月' })),
      status: [...new Set(allBatches.map(row => row.status))].map(value => ({ value, label: value })),
      country: [...new Set(allBatches.map(row => row.scope?.country).filter(Boolean))].map(value => ({ value, label: value })),
      creator: [...new Set(allBatches.map(row => row.createdBy).filter(Boolean))].map(value => ({ value, label: value }))
    };
    const clearFilters = () => { setQuery(''); setQueryDraft(''); setFilters({ month: undefined, status: undefined, country: undefined, creator: undefined }); };
    return h(React.Fragment, null,
      h(PageHead, { title: '预测批次', actions: h(Button, { type: 'primary', icon: h(icon.PlusOutlined), onClick: openCreate }, '发起预测填报') }),
      h(PlanListPanel, {
        search: h(Form, { layout: 'inline', size: 'small', className: 'fp-batch-filters' },
          h(Form.Item, { label: '预测月份' }, h(Select, { allowClear: true, placeholder: '全部', value: filters.month, options: filterOptions.month, onChange: value => setFilters(current => ({ ...current, month: value })) })),
          h(Form.Item, { label: '批次状态' }, h(Select, { allowClear: true, placeholder: '全部', value: filters.status, options: filterOptions.status, onChange: value => setFilters(current => ({ ...current, status: value })) })),
          h(Form.Item, { label: '国家' }, h(Select, { allowClear: true, placeholder: '全部', value: filters.country, options: filterOptions.country, onChange: value => setFilters(current => ({ ...current, country: value })) })),
          h(Form.Item, { label: '创建人' }, h(Select, { allowClear: true, placeholder: '全部', value: filters.creator, options: filterOptions.creator, onChange: value => setFilters(current => ({ ...current, creator: value })) })),
          h(Form.Item, null, h(Input.Search, { allowClear: true, placeholder: '批次名称 / 版本', value: queryDraft, onChange: event => setQueryDraft(event.target.value), onSearch: setQuery, style: { width: 220 } })),
          h(Form.Item, null, h(Button, { onClick: clearFilters }, '重置'))
        ),
        toolbar: h('div', { className: 'fp-batch-list-toolbar' }, h('span', { className: 'fp-muted' }, `共 ${batches.length} 个预测批次`))
      }, h(PlanTable, { rowKey: 'id', dataSource: batches, columns, pagination: false, scroll: { y: 'max(120px, calc(100vh - 340px))' }, onRow: row => ({ className: 'fp-batch-row', onDoubleClick: () => onOpen(row.id) }) })),
      h(Drawer, { open: drawerOpen, width: 576, title: '发起预测填报', onClose: () => setDrawerOpen(false), footer: h('div', { className: 'fp-drawer-footer' }, h(Button, { onClick: () => wizardStep ? setWizardStep(wizardStep - 1) : setDrawerOpen(false) }, wizardStep ? '上一步' : '取消'), h(Button, { type: 'primary', onClick: () => { const error = validateDraft(wizardStep); if (error) setWizardError(error); else if (wizardStep === 2) create(); else { setWizardError(''); setWizardStep(wizardStep + 1); } } }, wizardStep === 2 ? '创建批次' : '下一步')) },
        h(Steps, { size: 'small', current: wizardStep, items: [{ title: '预测周期' }, { title: '参数继承' }, { title: '填报窗口' }], style: { marginBottom: 20 } }),
        wizardError && h(Alert, { type: 'error', showIcon: true, message: wizardError, style: { marginBottom: 12 } }),
        draft && (wizardStep === 0 ? h(React.Fragment, null,
          h(Alert, { type: 'info', showIcon: true, message: '系统根据预测月份生成预测窗口；PMC只需确认数据截点和范围。', style: { marginBottom: 14 } }),
          h('label', { className: 'fp-create-month' }, h('span', { className: 'fp-kicker' }, '预测月份'), h(Input, { type: 'month', value: draft.forecastStartDate.slice(0, 7), onChange: event => updateMonth(event.target.value) })),
          h('div', { className: 'fp-form-grid fp-create-grid' }, fields.map(([key, label, type]) => h('label', { key }, h('span', { className: 'fp-kicker' }, label), h(Input, { type, value: draft[key], onChange: event => update(key, event.target.value), readOnly: key !== 'dataCutoffDate' })))),
          h('div', { className: 'fp-form-grid fp-create-grid' }, [['country', '国家', ['US', 'UK']], ['platform', '平台', ['Amazon']]].map(([key, label, options]) => h('label', { key }, h('span', { className: 'fp-kicker' }, label), h(Select, { value: draft[key], options: options.map(value => ({ value, label: value })), onChange: value => update(key, value), style: { width: '100%' } }))))
        ) : wizardStep === 1 ? h(React.Fragment, null,
          h(Checkbox, { checked: draft.inheritEnabled, onChange: event => update('inheritEnabled', event.target.checked) }, '继承上一预测批次'),
          draft.inheritEnabled && h(React.Fragment, null,
            h('div', { className: 'fp-kicker fp-inherit-source-label' }, '上一已完成批次'), h(Select, { value: draft.inheritFromBatchId, options: model.list().filter(row => row.status === '已完成').map(row => ({ value: row.id, label: `${row.name} · ${row.status}` })), onChange: value => update('inheritFromBatchId', value), style: { width: '100%', marginBottom: 16 } }),
            h('div', { className: 'fp-panel' }, h('div', { className: 'fp-panel-head' }, h('h2', null, '选择继承内容')), h('div', { className: 'fp-panel-body' }, h(Checkbox.Group, { value: Object.keys(draft.inherit).filter(key => draft.inherit[key]), onChange: values => update('inherit', Object.fromEntries(Object.keys(draft.inherit).map(key => [key, values.includes(key)]))) }, inheritItems.map(([key, label, version]) => h('div', { className: 'fp-inherit-row', key }, h(Checkbox, { value: key }, label), h('span', { className: 'fp-muted' }, version || '默认规则'))))))
          ),
          !draft.inheritEnabled && h(Alert, { type: 'warning', showIcon: true, message: '本批次将使用系统默认参数和当前有效主数据。' }),
          h(Alert, { type: 'info', showIcon: true, style: { marginTop: 12 }, message: '只继承配置与人工判断；实际销量、库存和每日预测按新批次重新计算，历史批次不变。' })
        ) : h(React.Fragment, null,
          h(Alert, { type: 'info', showIcon: true, message: '规则预测生成完成后，才可正式发起销售填报。截止与冻结时间允许独立设置。', style: { marginBottom: 14 } }),
          h('div', { className: 'fp-window-grid' }, [['start', '填报开始时间'], ['deadline', '填报截止时间'], ['freeze', '填报冻结时间']].map(([key, label]) => h('label', { key }, h('span', { className: 'fp-kicker' }, label), h(Input, { type: 'datetime-local', value: draft[key], onChange: event => update(key, event.target.value) })))),
          h(Checkbox, { checked: draft.autoFreeze, onChange: event => update('autoFreeze', event.target.checked) }, '填报截止后自动冻结')
        ))
    ),
      h(Drawer, { open: Boolean(detailBatch), width: 520, title: detailBatch ? `批次详情 · ${detailBatch.name}` : '批次详情', onClose: () => setDetailBatch(null), footer: detailBatch && h('div', { className: 'fp-drawer-footer' }, h(Button, { onClick: () => setDetailBatch(null) }, '返回列表'), h(Button, { type: 'primary', onClick: () => { const id = detailBatch.id; setDetailBatch(null); onOpen(id); } }, '进入批次工作区')) }, detailBatch && h(React.Fragment, null,
        h(Descriptions, { size: 'small', column: 1, items: [
          { key: 'state', label: '当前阶段', children: statusTag(batchStage(detailBatch).label) },
          { key: 'scope', label: '预测范围', children: `${detailBatch.scope?.platform || 'Amazon'} / ${detailBatch.scope?.country || '全部'}` },
          { key: 'forecast', label: '预测窗口', children: `${dayText(detailBatch.forecastStartDate)} ~ ${dayText(detailBatch.forecastEndDate)}` },
          { key: 'cutoff', label: '数据截点', children: dayText(detailBatch.dataCutoffDate) },
          { key: 'submission', label: '销售填报窗口', children: `${dateText(detailBatch.submissionWindow.submissionStartTime)} ~ ${dateText(detailBatch.submissionWindow.submissionDeadlineTime)}` },
          { key: 'result', label: '规则预测', children: detailBatch.activeResultVersion || detailBatch.resultState },
          { key: 'todo', label: '待处理事项', children: batchTodo(detailBatch) },
          { key: 'versions', label: '配置版本', children: `${detailBatch.relationVersion} · ${detailBatch.forecastRuleSnapshot.version} · ${detailBatch.splitRuleSnapshot.version}` },
          { key: 'updated', label: '更新时间', children: dateText(detailBatch.updatedAt) }
        ] }),
        h('div', { className: 'fp-drawer-summary' }, h('span', null, '父ASIN ', h('strong', null, number(detailBatch.parentForecastResults.length))), h('span', null, '子ASIN ', h('strong', null, number(detailBatch.childForecastResults.length))), h('span', null, '配置变更 ', h('strong', null, `${configChangeCount(detailBatch)} 项`)))
      ))
    );
  }
  function RelationAddForm({ batch, parentOptions, childOptions, onSubmit, onCancel }) {
    const [form] = Form.useForm();
    const childIds = Form.useWatch('childIds', form) || [];
    const parentASIN = Form.useWatch('parentASIN', form);
    const checks = childIds.map(id => batch.relationSnapshot.find(row => row.childId === id)).filter(Boolean);
    const conflicts = checks.filter(row => parentASIN && row.parentASIN !== parentASIN);
    return h(Form, { form, layout: 'vertical', initialValues: { country: 'US', childIds: [], reason: '本批次新增或调整父子关系' }, onFinish: onSubmit },
      h(Form.Item, { name: 'country', label: '国家', rules: [{ required: true }] }, h(Select, { options: [{ value: 'US', label: 'US' }, { value: 'UK', label: 'UK' }] })),
      h(Form.Item, { name: 'parentASIN', label: '父ASIN', rules: [{ required: true, message: '请选择父ASIN' }] }, h(Select, { showSearch: true, options: parentOptions, placeholder: '搜索父ASIN' })),
      h(Form.Item, { name: 'childIds', label: '子ASIN', rules: [{ required: true, message: '请选择至少一个子ASIN' }] }, h(Select, { mode: 'multiple', showSearch: true, optionFilterProp: 'label', options: childOptions, placeholder: '搜索或批量选择子ASIN' })),
      checks.length > 0 && h('div', { className: 'fp-relation-check' }, h('strong', null, '当前关系检查'), checks.map(row => h('div', { key: row.childId }, `${row.childASIN} · 当前父ASIN：${row.parentASIN}`, parentASIN && row.parentASIN !== parentASIN && h('span', { className: 'fp-danger' }, `，调整后将变更为 ${parentASIN}`)))),
      conflicts.length > 0 && h(Form.Item, { name: 'confirmed', valuePropName: 'checked', rules: [{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('请确认父体变更影响')) }] }, h(Checkbox, null, '我已确认关系变更将重新归集历史销量并影响父ASIN预测池')),
      h(Form.Item, { name: 'reason', label: '调整原因', rules: [{ required: true, whitespace: true, message: '请填写调整原因' }] }, h(Input.TextArea, { rows: 3, maxLength: 200, showCount: true })),
      h('div', { className: 'fp-sticky-actions' }, h(Button, { onClick: onCancel }, '取消'), h(Button, { type: 'primary', htmlType: 'submit' }, '保存本批次关系'))
    );
  }
  function BaselineCalibration({ batch, target, onClose, locked }) {
    const { message, modal } = App.useApp();
    const [form] = Form.useForm();
    const mode = Form.useWatch('mode', form) || 'adu';
    const amount = Form.useWatch('value', form);
    const chosenDate = Form.useWatch('date', form);
    const values = Object.values(target.daily || {}).filter(window.ForecastLedgerValues.numeric);
    const dates = Object.keys(target.daily || {}).filter(date => window.ForecastLedgerValues.numeric(target.daily[date]));
    const adu = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const history = batch.adjustmentLog.filter(item => item.type === 'PMC基准' && item.level === target.level && item.key === target.key);
    const submit = (data, restore = false) => {
      try { model.calibrateBaseline(batch.id, target.level, target.key, restore ? null : { mode: data.mode, value: data.value, date: data.date, note: data.note }, data.reason); message.success(restore ? '人工校准已撤销，请重新生成本批次快照' : 'PMC校准已保存，请重新生成本批次快照'); onClose(); } catch (error) { message.error(error.message); }
    };
    const close = () => form.isFieldsTouched() ? modal.confirm({ title: '放弃未保存的校准？', okText: '放弃', cancelText: '继续编辑', onOk: onClose }) : onClose();
    return h(antd.Modal, { open: true, title: `${target.label} · PMC校准`, width: 600, onCancel: close, footer: null, destroyOnClose: true },
      h(Descriptions, { size: 'small', column: 2, items: [{ key: 'adu', label: '系统基础ADU', children: adu == null ? '待实际销量' : adu.toFixed(2) }, { key: 'days', label: '数值预测日数', children: values.length }] }),
      h(Alert, { type: 'info', showIcon: true, message: target.level === 'parent' ? '按系统日曲线校准，再按当前子体份额拆分。' : '此校准调整子体基准，并更新父体PMC合计；系统预测及其他子体不变。', description: '仅作用于本批次PMC校准。待实际销量日期不参与校准；重新计算保留校准记录。' }),
      h(Form, { form, layout: 'vertical', initialValues: { mode: target.adjustment?.mode || 'adu', value: target.adjustment?.value ?? (adu == null ? null : Number(adu.toFixed(2))), date: target.adjustment?.date || dates[0], reason: '' }, onFinish: submit, style: { marginTop: 12 } },
        h(Form.Item, { name: 'mode', label: '校准方式' }, h(antd.Radio.Group, { options: [{ value: 'adu', label: 'ADU调整' }, { value: 'ratio', label: '比例调整' }, { value: 'daily', label: '日级调整' }], disabled: locked })),
        mode === 'daily' && h(Form.Item, { name: 'date', label: '调整日期', rules: [{ required: true, message: '请选择调整日期' }] }, h(Select, { options: dates.map(date => ({ value: date, label: dayText(date) })), disabled: locked, style: { width: 200 } })),
        h(Form.Item, { name: 'value', label: mode === 'ratio' ? '调整比例' : mode === 'daily' ? '调整后销量' : '目标ADU', rules: [{ required: true, message: '请输入校准值' }] }, h(InputNumber, { min: mode === 'ratio' ? -100 : 0, precision: 2, addonAfter: mode === 'ratio' ? '%' : '件/天', disabled: locked, style: { width: 200 } })),
        h('p', null, `校准后ADU预览：${adu == null || amount == null ? '待实际销量' : (mode === 'ratio' ? adu * (1 + Number(amount) / 100) : mode === 'daily' ? ((values.reduce((sum, value) => sum + value, 0) - (target.daily?.[chosenDate || dates[0]] || 0) + Number(amount)) / values.length) : Number(amount)).toFixed(2)}（待实际销量日期不参与）`),
        h(Form.Item, { name: 'reason', label: '校准原因', rules: [{ required: true, whitespace: true, message: '请填写校准原因' }] }, h(Input.TextArea, { rows: 2, disabled: locked })),
        h(Form.Item, { name: 'note', label: '备注' }, h(Input.TextArea, { rows: 1, maxLength: 200, disabled: locked })),
        target.children?.length > 0 && h('p', { className: 'fp-help' }, '影响 ' + target.children.length + ' 个子体：父体校准后按最终子体份额重新分配。只调整尺码结构时请使用子体份额。'),
        h(Space, null, h(Button, { disabled: locked || !target.adjustment, onClick: async () => { try { await form.validateFields(['reason']); submit(form.getFieldsValue(), true); } catch (_) {} } }, '恢复系统预测'), h(Button, { onClick: close }, '取消'), h(Button, { type: 'primary', htmlType: 'submit', disabled: locked || adu == null }, '保存校准'))),
      history.length > 0 && h(React.Fragment, null, h(Divider, null, '变更记录'), history.map(item => h('p', { key: item.at }, `${dateText(item.at)} ${item.actor} 丨 ADU ${Number(item.beforeAdu).toFixed(2)} → ${Number(item.afterAdu).toFixed(2)} 丨 ${item.after ? `${item.after.mode === 'adu' ? 'ADU校准' : '比例校准'} ${item.after.value}${item.after.mode === 'ratio' ? '%' : ''}` : '人工调整已撤销'} 丨 ${item.reason}`))));
  }
  function ParentChildMaintenance({ batch, onBack, onOpenBatch }) {
    const { message, modal } = App.useApp();
    const ratioLabel = value => `${(Number(value || 0) / 100).toFixed(2).replace(/\.00$/, '')}%`;
    const [queryDraft, setQueryDraft] = useState('');
    const [query, setQuery] = useState('');
    const [country, setCountry] = useState();
    const [platform, setPlatform] = useState();
    const [store, setStore] = useState();
    const [tagFilter, setTagFilter] = useState();
    const [maintenanceStatus, setMaintenanceStatus] = useState();
    const [trendFilter, setTrendFilter] = useState();
    const [valueFilter, setValueFilter] = useState();
    const [inventoryFilter, setInventoryFilter] = useState();
    const [owner, setOwner] = useState();
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [addRelationOpen, setAddRelationOpen] = useState(false);
    const [drawer, setDrawer] = useState(null);
    const [selected, setSelected] = useState(null);
    const [targetParent, setTargetParent] = useState();
    const [reason, setReason] = useState('');
    const [shareDraft, setShareDraft] = useState({});
    const [shareEdited, setShareEdited] = useState(null);
    const [tagDraft, setTagDraft] = useState({});
    const [tagReason, setTagReason] = useState('');
    const [comboDraft, setComboDraft] = useState({});
    const [comboReason, setComboReason] = useState();
    const [comboNote, setComboNote] = useState('');
    const [windowDraft, setWindowDraft] = useState(null);
    const [autoFreeze, setAutoFreeze] = useState(true);
    const [parameterDraft, setParameterDraft] = useState(null);
    const [parameterReason, setParameterReason] = useState('');
    const [parameterEditing, setParameterEditing] = useState(false);
    const [allParametersOpen, setAllParametersOpen] = useState(false);
    const [sourceImport, setSourceImport] = useState(null);
    const [sourceImportError, setSourceImportError] = useState('');
    const [sourceSheets, setSourceSheets] = useState([]);
    const [sourceBrowseRows, setSourceBrowseRows] = useState({});
    const [inlineParentDetail, setInlineParentDetail] = useState(null);
    const [inlineChildDetail, setInlineChildDetail] = useState(null);
    const [showCalculation, setShowCalculation] = useState(false);
    const [comboRatioDraft, setComboRatioDraft] = useState({});
    const [dateWindowStart, setDateWindowStart] = useState(0);
    const [dateWindowSize, setDateWindowSize] = useState(14);
    const [ledgerView, setLedgerView] = useState('variant');
    const [collapsedWeeks, setCollapsedWeeks] = useState(() => new Set());
    const [expandedParents, setExpandedParents] = useState(() => new Set(batch.parentForecastResults.map(row => row.key)));
    const [forecastLinesExpanded, setForecastLinesExpanded] = useState(true);
    const [expandedCombos, setExpandedCombos] = useState(() => new Set());
    const [columnWidths, setColumnWidths] = useState(() => ({ identity: 334, size: 60, context: 190, line: 130 }));
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [focusCell, setFocusCell] = useState(null);
    const [issueFocus, setIssueFocus] = useState(null);
    const [calibrationTarget, setCalibrationTarget] = useState(null);
    const [scrollbarState, setScrollbarState] = useState({ left: 0, width: 100, max: 0 });
    const workbenchRef = useRef(null);
    const scrollTrackRef = useRef(null);
    const scrollThumbRef = useRef(null);
    const sourceFileInputRef = useRef(null);
    const locked = batch.status === '已冻结' || batch.status === '已完成' || batch.submissionState === '填报中';
    const forecastReady = batch.resultState === '已生成' || batch.resultSnapshots.length > 0;
    const editableAll = !locked && ['待生成', '需重新生成'].includes(batch.resultState);
    const dailyDates = Object.keys(batch.parentForecastResults[0]?.daily || {}).sort();
    const windowStart = Math.min(dateWindowStart, Math.max(0, dailyDates.length - dateWindowSize));
    const visibleDates = dailyDates.slice(windowStart, windowStart + dateWindowSize);
    const salesGroups = typeof groups !== 'undefined' ? groups : [];
    const salesIdentity = new Map(salesGroups.flatMap(group => group.children.map(child => [`${group.market}|${child.asin}`, { group, child }])));
    const identityFor = row => salesIdentity.get(`${row.country}|${row.childASIN}`);
    const ownerFor = row => row.salesOwner || row.owner || identityFor(row)?.group?.owner || '未分配';
    const platformFor = row => row.platform || identityFor(row)?.group?.platform || 'Amazon';
    const storeFor = row => row.store || identityFor(row)?.group?.account || '全部店铺';
    const sourceTemplate = type => window.ForecastSourceImport?.templates?.[type];
    const sourceKeyFor = (type, row) => type === 'parent' ? `${row.country || row['国家'] || ''}|${row.parentASIN || row['父体ASIN'] || ''}` : type === 'child' ? `${row.country || row['国家'] || ''}|${row.childASIN || row['子体ASIN'] || ''}` : type === 'season' ? `${row.country || row.site || row['站点'] || ''}|${row.typeCode || row['类型编码'] || ''}` : String(row.typeCode || row['类型编码'] || '');
    const fallbackSource = (type, row) => type === 'parent' ? { '国家+父体ASIN': `${row.country}|${row.parentASIN}`, '国家': row.country, '父体ASIN': row.parentASIN, '类型编码': row.typeCode, '商品类型': row.productName, '渠道级-趋势标签': row.tags?.find(tag => ['增长', '平稳', '衰退'].includes(tag)), '渠道级-价值分级': row.tags?.find(tag => ['A', 'B', 'C', 'D'].includes(tag)), '预测开始日': batch.forecastStartDate, '预测日数': Math.round((Date.parse(batch.forecastEndDate) - Date.parse(batch.forecastStartDate)) / 86400000) + 1 } : { '国家': row.country, '父体ASIN': row.parentASIN, '子体ASIN': row.childASIN, '国家+子体ASIN': `${row.country}|${row.childASIN}`, '标准SKU': row.sku || row.sellerSku, '原标签': row.tags?.[0], '时间阶段': row.tags?.[0], '类型编码': row.typeCode, '商品类型': row.productName, '渠道级-价值分级': row.tags?.find(tag => ['A', 'B', 'C', 'D'].includes(tag)), '渠道级-趋势标签': row.tags?.find(tag => ['增长', '平稳', '衰退'].includes(tag)), '渠道级-运营标签': row.tags?.[2], '未来90天预测销量': Object.entries(row.dailyFinalForecast || {}).sort(([a], [b]) => a.localeCompare(b)).slice(0, 90).reduce((sum, [, value]) => sum + Number(value || 0), 0) };
    const sourceFor = (type, row) => {
      const key = sourceKeyFor(type, row);
      const sourceRow = batch.sourceReferences?.[type]?.rows?.find(value => sourceKeyFor(type, value) === key) || fallbackSource(type, row);
      return { ...(sourceRow || {}), ...(batch.sourceOverrides?.[type]?.[key] || {}) };
    };
    const copyCode = value => { if (!value) return; if (!navigator.clipboard?.writeText) return message.info(`当前浏览器无法复制；编码：${value}`); navigator.clipboard.writeText(String(value)).then(() => message.success(`已复制 ${value}`)).catch(() => message.info(`当前浏览器无法复制；编码：${value}`)); };
    const copyButton = (value, label) => h('button', { type: 'button', className: 'copy-code', onClick: event => { event.stopPropagation(); copyCode(value); }, 'aria-label': `复制${label} ${value || ''}` }, h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinejoin: 'round', 'aria-hidden': true }, h('rect', { x: 8, y: 8, width: 12, height: 13, rx: 1 }), h('path', { d: 'M16 8V3H3v13h5' })));
    const codeValue = (value, label, className = '') => h('span', { className: `code-value ${className}`.trim(), 'data-code-tip': `复制${label}` }, h('span', { className: 'code-text', tabIndex: 0, 'aria-label': `${label}：${value || '—'}` }, value || '—'), copyButton(value, label));
    const separator = key => h('span', { className: 'inline-separator fp-inline-separator', 'aria-hidden': true, key }, '丨');
    const joined = items => items.filter(item => item != null && item !== '').flatMap((item, index) => index ? [separator(`sep-${index}`), item] : [item]);
    const tagTone = value => ['增长', 'A', '正常运营', '健康'].includes(value) ? 'success' : ['衰退', '低销不稳定', '促销清货/退市评估', '呆滞'].includes(value) ? 'error' : ['份额待调整', '关系待确认', '组合待拆解', '预警'].includes(value) ? 'warning' : value === '本次有调整' ? 'processing' : undefined;
    const businessTag = value => {
      const tone = tagTone(value);
      return h(Tooltip, { key: value, title: '预测标签', mouseEnterDelay: .25 }, h(Tag, { color: tone || 'default', style: { fontSize: 12, lineHeight: '18px', fontWeight: 400, paddingInline: 3, marginInlineEnd: 0, borderRadius: 3 } }, value));
    };
    const salesTag = value => {
      const definition = typeof tagDefinitions !== 'undefined' ? tagDefinitions[value] : null;
      const color = { green: 'success', blue: 'processing', amber: 'warning', purple: 'default' }[definition?.tone] || 'default';
      return h(Tooltip, { key: value, title: definition?.category || '商品标签', mouseEnterDelay: .25 }, h(Tag, { color, 'data-tag-category': definition?.category || '商品标签', style: { fontSize: 12, lineHeight: '18px', fontWeight: 400, paddingInline: 3, marginInlineEnd: 0, borderRadius: 3 } }, definition?.value || value));
    };
    const parentRows = batch.parentForecastResults.map(parent => {
      const siblings = batch.childForecastResults.filter(row => relationKey(row) === parent.key);
      const children = siblings.map(row => {
        const sourceFields = sourceFor('child', row);
        const total = window.ForecastLedgerValues.sum(Object.values(row.dailyFinalForecast || {}));
        const systemTotal = window.ForecastLedgerValues.sum(Object.values(row.dailyRuleForecast || {}));
        const comboLines = row.businessObjectType === 'COMBO' ? (row.comboSnapshot?.lines || []).map(line => {
          const persisted = row.comboLines?.find(item => item.sku === line.sku);
          return { key: `${row.childId}-${line.sku}`, _kind: 'sku', parentKey: parent.key, childId: row.childId, childASIN: row.childASIN, parentASIN: row.parentASIN, businessObjectCode: row.businessObjectCode, businessObjectVersion: row.businessObjectVersion, sku: line.sku, quantity: line.quantity, ratio: ratioLabel((Number(line.quantity) / Math.max(1, row.comboSnapshot.lines.reduce((sum, item) => sum + Number(item.quantity || 0), 0))) * 10000), pmcRatio: persisted?.pmcRatio, suggested: Number(persisted?.systemSuggested ?? 0), adjustment: Number(persisted?.pmcAdjustment ?? 0), finalForecast: Number(persisted?.finalForecast ?? persisted?.systemSuggested ?? 0) };
        }) : [];
        return { ...row, sourceFields, total90: window.ForecastLedgerValues.sum(dailyDates.slice(0, 90).map(date => row.dailyFinalForecast?.[date])), numeric90Days: dailyDates.slice(0, 90).filter(date => window.ForecastLedgerValues.numeric(row.dailyFinalForecast?.[date])).length, key: row.childId, _kind: 'child', total, systemTotal, manualValue: total - systemTotal, parentSpu: parent.spu, parentSkc: parent.skc, ...(comboLines.length ? { children: comboLines } : {}) };
      });
      return { ...parent, sourceFields: sourceFor('parent', parent), key: `parent-${parent.key}`, _kind: 'parent', relationKey: parent.key, country: parent.country, store: parent.store, parentASIN: parent.parentASIN, parentTotal: parent.total, childCount: children.length, shareTotal: children.reduce((sum, row) => sum + row.finalShare, 0), childTotal: window.ForecastLedgerValues.sum(children.map(row => row.total)), seasonIndexOverride: parent.seasonIndexOverride, seasonIndexReason: parent.seasonIndexReason, tagOverrides: batch.parentTagOverrides?.[parent.key] || {}, children };
    });
    const allChildren = parentRows.flatMap(row => row.children);
    const previousBatch = batch.previousBatchId ? model.getBatch(batch.previousBatchId) : null;
    const relationIssue = row => !row.parentASIN || (!batch.relationConfirmed && (batch.relationChanges.some(change => change.childASIN === row.childASIN && change.to === row.parentASIN) || row.relationState === '新增待确认' || row.previousParentASIN && row.previousParentASIN !== row.parentASIN));
    const shareIssue = row => {
      const siblings = allChildren.filter(item => relationKey(item) === relationKey(row));
      const total = siblings.reduce((sum, item) => sum + Number(item.finalShare || 0), 0);
      return total !== 10000 || !batch.splitConfirmed && row.splitJudgement === '低销量/不稳定' && !row.manualReason;
    };
    const comboIssue = row => row.businessObjectType === 'COMBO' && (!row.comboSnapshot?.lines?.length || !row.comboLines?.length || (row.comboLines || []).reduce((sum, line) => sum + Number(line.finalForecast || 0), 0) !== row.total || !batch.splitConfirmed);
    const adjusted = row => Boolean(row.pmcCalibration || row.manualAdjustment || row.manualReason || Object.values(row.tagOverrides || {}).some(Boolean) || (row.comboLines || []).some(line => Number(line.pmcAdjustment)));
    const issueFor = row => relationIssue(row) ? 'relation' : shareIssue(row) ? 'share' : comboIssue(row) ? 'combo' : Object.values(row.dailyForecastStatus || {}).some(Boolean) ? 'season' : null;
    const counts = { all: allChildren.length, pending: allChildren.filter(issueFor).length, relation: allChildren.filter(relationIssue).length, share: allChildren.filter(shareIssue).length, combo: allChildren.filter(comboIssue).length };
    const matchesBucket = (value, row) => value === 'all' || value === 'pending' && Boolean(issueFor(row)) || value === 'relation' && relationIssue(row) || value === 'share' && shareIssue(row) || value === 'combo' && comboIssue(row);
    const countryOptions = [...new Set(allChildren.map(row => row.country))].map(value => ({ value, label: value }));
    const platformOptions = [...new Set(allChildren.map(platformFor).filter(Boolean))].map(value => ({ value, label: value }));
    const storeOptions = [...new Set(allChildren.map(storeFor).filter(Boolean))].map(value => ({ value, label: value }));
    const ownerOptions = [...new Set(allChildren.map(ownerFor).filter(Boolean))].map(value => ({ value, label: value }));
    const tagOptions = [...new Set(allChildren.flatMap(row => [...(row.tags || []), row.sourceFields?.['原标签'], row.sourceFields?.['渠道级-趋势标签'], row.sourceFields?.['渠道级-价值分级'], row.sourceFields?.['渠道级-运营标签'], ...Object.values(row.tagOverrides || {})]).filter(Boolean))].map(value => ({ value, label: value }));
    const trendFor = row => row.tagOverrides?.trendLabel || row.sourceFields?.['渠道级-趋势标签'] || row.tags?.find(value => ['增长', '平稳', '衰退'].includes(value));
    const valueFor = row => row.tagOverrides?.valueGrade || row.sourceFields?.['渠道级-价值分级'] || row.tags?.find(value => ['A', 'B', 'C', 'D'].includes(value));
    const inventoryFor = row => row.tagOverrides?.stockTag || row.sourceFields?.['FBA仓-库存标签'];
    const trendOptions = [...new Set(allChildren.map(trendFor).filter(Boolean))].map(value => ({ value, label: value }));
    const valueOptions = [...new Set(allChildren.map(valueFor).filter(Boolean))].map(value => ({ value, label: value }));
    const inventoryOptions = [...new Set(allChildren.map(inventoryFor).filter(Boolean))].map(value => ({ value, label: value }));
    const filtered = parentRows.map(parent => ({ ...parent, children: parent.children.filter(row => {
      const text = [row.parentASIN, row.childASIN, row.sellerSku, row.businessObjectCode, row.sourceFields?.['标准SKU'], row.sourceFields?.['商品类型'], ...(row.tags || [])].join(' ').toUpperCase();
      const tags = [...(row.tags || []), row.sourceFields?.['原标签'], row.sourceFields?.['渠道级-趋势标签'], row.sourceFields?.['渠道级-价值分级'], row.sourceFields?.['渠道级-运营标签'], ...Object.values(row.tagOverrides || {})].filter(Boolean);
      const statusMatch = !maintenanceStatus || maintenanceStatus === 'complete' && !issueFor(row) || maintenanceStatus === 'adjusted' && adjusted(row) || matchesBucket(maintenanceStatus, row);
      return statusMatch && (!country || country === row.country) && (!platform || platform === platformFor(row)) && (!store || store === storeFor(row)) && (!owner || owner === ownerFor(row)) && (!query || text.includes(query.trim().toUpperCase())) && (!tagFilter || tags.includes(tagFilter)) && (!trendFilter || trendFor(row) === trendFilter) && (!valueFilter || valueFor(row) === valueFilter) && (!inventoryFilter || inventoryFor(row) === inventoryFilter);
    }) })).filter(parent => parent.children.length);
    const filteredChildCount = filtered.reduce((sum, row) => sum + row.children.length, 0);
    const projectedTotal = ledgerView === 'parent' ? filtered.length : filteredChildCount;
    const safePage = Math.min(page, Math.max(1, Math.ceil(projectedTotal / pageSize)));
    const projectedParents = ledgerView === 'parent'
      ? filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
      : (() => {
          const pageChildIds = new Set(filtered.flatMap(row => row.children).slice((safePage - 1) * pageSize, safePage * pageSize).map(row => row.childId));
          return filtered.map(parent => ({ ...parent, children: parent.children.filter(child => pageChildIds.has(child.childId)) })).filter(parent => parent.children.length);
        })();
    const pagedParents = projectedParents;
    useEffect(() => setPage(1), [query, country, platform, store, owner, tagFilter, maintenanceStatus, trendFilter, valueFilter, inventoryFilter]);
    const toggleParentDetail = (row, kind) => {
      setInlineParentDetail(current => current?.key === row.relationKey && current.kind === kind ? null : { key: row.relationKey, kind });
      setShowCalculation(false);
    };
    const setShare = (childASIN, value) => { setShareDraft(current => ({ ...current, [childASIN]: Math.max(0, Math.min(100, Number(value) || 0)) })); setShareEdited(childASIN); };
    const shareTotal = Object.values(shareDraft).reduce((sum, value) => sum + Number(value || 0), 0);
    const rebalanceShares = () => {
      if (!shareEdited) return message.info('先修改一个子ASIN份额，再重新归一化');
      const siblings = allChildren.filter(row => relationKey(row) === selected?.relationKey);
      const rest = Math.max(0, 100 - Number(shareDraft[shareEdited] || 0));
      const others = siblings.filter(row => row.childASIN !== shareEdited);
      const basis = others.reduce((sum, row) => sum + row.finalShare, 0);
      const next = { ...shareDraft };
      others.forEach(row => { next[row.childASIN] = Number((basis ? rest * row.finalShare / basis : rest / Math.max(1, others.length)).toFixed(2)); });
      const drift = Number((100 - Object.values(next).reduce((sum, value) => sum + Number(value || 0), 0)).toFixed(2));
      if (others.length) next[others.at(-1).childASIN] = Number((next[others.at(-1).childASIN] + drift).toFixed(2));
      setShareDraft(next);
    };
    const previousChildFor = row => previousBatch?.childForecastResults?.find(item => item.country === row.country && item.store === row.store && item.childASIN === row.childASIN);
    const startShare = row => { setSelected({ ...row, relationKey: relationKey(row) }); setReason(''); setShareEdited(null); setShareDraft(Object.fromEntries(allChildren.filter(item => relationKey(item) === relationKey(row)).map(item => [item.childASIN, Number((item.finalShare / 100).toFixed(2))]))); setDrawer('share'); };
    const startTags = row => { setSelected(row); setTagDraft({ ...(row.tagOverrides || {}) }); setTagReason(''); setDrawer('tags'); };
    const startCombo = row => { setSelected(row); setComboDraft(Object.fromEntries((row.comboLines || []).map(line => [line.sku, Number(line.pmcAdjustment) || 0]))); setComboRatioDraft(Object.fromEntries((row.comboLines || []).map(line => [line.sku, Number((Number(line.pmcRatio ?? line.defaultRatio) / 100).toFixed(2))]))); setComboReason(undefined); setComboNote(''); setDrawer('combo'); };
    const openSourceDetail = row => { setSelected(row || null); setDrawer('source-detail'); };
    const parentOptions = [...new Set(batch.relationSnapshot.map(row => row.parentASIN).filter(Boolean))].map(value => ({ value, label: value }));
    const startSeason = row => { setSelected(row); setReason(''); setDrawer('season'); };
    const childActions = row => h(Dropdown, { trigger: ['click'], menu: { items: [
      { key: 'history', label: '查看历史批次' },
      { key: 'source', label: '查看附件字段' },
      { key: 'mapping', label: 'SKU映射' },
      { key: 'tags', label: '维护预测标签', disabled: locked },
      { key: 'audit', label: '查看变更记录' }
    ], onClick: ({ key }) => {
      setSelected(row);
      if (key === 'source') return openSourceDetail(row);
      if (key === 'mapping') return openSalesInsight(row, 'mapping');
      if (key === 'tags') return startTags(row);
      if (key === 'history') return setDrawer('history-batches');
      if (key === 'audit') return setDrawer('audit');
    } } }, h('button', { type: 'button', className: 'product-action product', 'aria-label': `${row.childASIN} 更多操作` }, h(icon.EllipsisOutlined), '更多'));
    const openParentBasis = row => { setSelected(row); setParameterDraft(clone(batch.pendingParameterSnapshot || batch.parameterSnapshot)); setParameterEditing(false); setParameterReason(''); setDrawer('parent-basis'); };
    const parentActions = row => h(Dropdown, { trigger: ['click'], menu: { items: [{ key: 'source', label: '查看附件字段' }, { key: 'season', label: '季节运行' }, { key: 'tags', label: '维护父ASIN标签', disabled: locked }, { key: 'audit', label: '查看变更记录' }], onClick: ({ key }) => { setSelected(row); if (key === 'source') openSourceDetail(row); else if (key === 'season') startSeason(row); else if (key === 'tags') startTags(row); else setDrawer('audit'); } } }, h('button', { type: 'button', className: 'product-action product', 'aria-label': `${row.parentASIN} 更多操作` }, h(icon.EllipsisOutlined), '更多'));
    const metric = (label, value, className = '') => h('div', { className: 'metric', key: label }, h('label', null, label), h('strong', { className }, value));
    const forecastLines = values => h('div', { className: 'fp-sales-forecast-lines' }, values.map(([label, value, type]) => h('div', { key: label, className: `fp-sales-forecast-line ${type}` }, h('span', null, label), h('strong', null, value))));
    const sourceNumber = (row, field, fallback = null) => { const value = row.sourceFields?.[field]; return value === '' || value == null ? fallback : Number.isFinite(Number(value)) ? Number(value) : value; };
    const inventorySummary = row => {
      const identity = identityFor(row)?.child;
      const fba = sourceNumber(row, 'FBA仓在库', row.fbaAvailableInventory ?? identity?.fba);
      const inbound = sourceNumber(row, 'FBA仓在途', row.fbaInTransitInventory ?? identity?.fbaInbound);
      const available = sourceNumber(row, 'FBA可用库存', fba);
      const daily = Object.keys(row.dailyFinalForecast || {}).sort().slice(0, 90).map(date => row.dailyFinalForecast[date]).filter(window.ForecastLedgerValues.numeric);
      const adu = daily.length ? window.ForecastLedgerValues.sum(daily) / daily.length : null;
      const fbaDos = forecastReady && adu > 0 && available != null && inbound != null ? (Number(available) + Number(inbound)) / adu : null;
      const tag = row.sourceFields?.['FBA仓-库存标签'] || row.tagOverrides?.stockTag;
      return { fba, inbound, available, fbaDos, doi: fbaDos, tag };
    };
    const inlineParentContent = row => {
      const parent = row.parentRow;
      const source = sourceFor('parent', parent);
      const fields = [['历史数据截点', source['历史数据截点'] || batch.dataCutoffDate], ['ADU窗口天数', source['ADU窗口天数'] || batch.parameterSnapshot.historyShareWindow], ['近期窗口天数', source['近期窗口天数'] || batch.parameterSnapshot.recentShareWindow], ['全窗有效Clean天数', source['全窗有效Clean天数']], ['近期有效Clean天数', source['近期有效Clean天数']], ['全窗Clean ADU', source['全窗Clean ADU']], ['近期Clean ADU', source['近期Clean ADU']], ['初始化ADU0', source['初始化ADU0']], ['当前Clean ADU0', source['当前Clean ADU0']], ['去季节化日均销量', source['去季节化日均销量']], ['当前EWMA基准ADU', source['当前EWMA基准ADU']], ['动态α', source['动态α']], ['当前月季节指数', source['当前月季节指数'] ?? parent.seasonIndexOverride], ['Listing适配系数', source['Listing适配系数'] ?? batch.parameterSnapshot.listingFactor], ['趋势标签', source['渠道级-趋势标签']], ['价值等级', source['渠道级-价值分级']]];
      const coreFields = ['初始化ADU0', '当前EWMA基准ADU', '动态α', '当前月季节指数', 'Listing适配系数'];
      const seasonStatus = ['季节属性_实际使用', '季节运行模式', '预测状态'].filter(key => source[key] != null && source[key] !== '').map(key => [key, source[key]]);
      const formula = source['初始ADU0计算式'] || '数仓未提供计算式；本页面不推导或修改模型公式。';
      return h('div', { className: 'fp-inline-parent-detail' },
        h('div', { className: 'fp-inline-detail-title' }, h('strong', null, `${parent.parentASIN} · 预测依据`), h(Tag, { color: batch.sourceReferences?.parent?.rows?.some(item => sourceKeyFor('parent', item) === sourceKeyFor('parent', parent)) ? 'success' : 'warning' }, batch.sourceReferences?.parent ? '查看来源匹配状态' : '未导入父体附件')),
        h('div', { className: 'fp-inline-basis-grid' }, [...fields.filter(([label]) => showCalculation || coreFields.includes(label)), ...seasonStatus].map(([label, value]) => h('div', { key: label }, h('span', null, label), h('strong', null, value == null || value === '' ? '—' : String(value))))),
        h(Button, { type: 'link', size: 'small', onClick: () => setShowCalculation(value => !value) }, showCalculation ? '收起诊断信息' : '查看诊断信息'),
        showCalculation && h('div', { className: 'fp-formula' }, formula),
        h(Button, { type: 'link', size: 'small', onClick: () => openParentBasis(parent) }, '调整本批次预测参数')
      );
    };
    const isoWeekNumber = value => {
      const date = new Date(`${value}T12:00:00Z`);
      const target = new Date(date);
      target.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
      return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
    };
    const weekGroups = visibleDates.reduce((items, date) => {
      const week = isoWeekNumber(date);
      const key = `${date.slice(0, 4)}-W${week}`;
      const current = items.at(-1);
      if (current?.key === key) current.dates.push(date);
      else items.push({ key, week, dates: [date] });
      return items;
    }, []);
    const detailRow = row => row._kind === 'basis' || row._kind === 'child-detail';
    const toggleParent = key => setExpandedParents(current => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next; });
    const toggleCombo = childId => setExpandedCombos(current => { const next = new Set(current); next.has(childId) ? next.delete(childId) : next.add(childId); return next; });
    const toggleChildDetail = (row, kind) => setInlineChildDetail(current => current?.key === row.childId && current.kind === kind ? null : { key: row.childId, kind });
    const setAllParents = expand => setExpandedParents(new Set(expand ? filtered.map(row => row.relationKey) : []));
    const lineLabels = { ...window.ForecastLedgerValues.labels, pmc: '人工校准', final: '最终预测' };
    const openCalibration = row => {
      const parent = row._kind === 'parent' ? row : parentRows.find(item => item.relationKey === relationKey(row));
      if (!parent) return message.warning('当前子体未归属父体，请先确认关系');
      setCalibrationTarget({ level: 'parent', key: parent.relationKey, label: parent.parentASIN + ' · 父体预测池', daily: parent.daily, children: parent.children, adjustment: batch.calibrations?.parent?.[parent.relationKey] || null });
    };
    const lineValue = (row, date) => {
      if (!forecastReady) return null;
      if (row._kind === 'parent') return (row.lineType === 'system' ? row.daily : row.baselineDaily || row.daily)?.[date] ?? null;
      if (row._kind === 'sku') return row.dailyForecast?.[date] ?? null;
      if (row._kind !== 'child-line') return null;
      return (row.lineType === 'system' ? row.child.dailyRuleForecast : row.child.dailyFinalForecast)?.[date] ?? null;
    };
    const sumDates = (row, dates) => {
      const values = dates.map(date => lineValue(row, date)).filter(value => value != null);
      return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) : null;
    };
    const shareImpact = selected?.relationKey && drawer === 'share' ? model.previewShares(batch.id, selected.relationKey, Object.fromEntries(Object.entries(shareDraft).map(([key, value]) => [key, Math.round(value * 100)]))) : null;
    const renderShareEditor = () => h('div', { className: 'fp-inline-parent-detail fp-inline-share-editor', role: 'region', 'aria-label': '子体份额调整' }, selected && h(React.Fragment, null,
        h(Alert, { type: Math.abs(shareTotal - 100) < 0.005 ? 'success' : 'warning', showIcon: true, message: `最终份额合计 ${shareTotal.toFixed(2)}%` }),
        h(PlanTable, { rowKey: 'childId', dataSource: allChildren.filter(row => relationKey(row) === selected.relationKey), pagination: false, sticky: false, scroll: { x: 900, y: undefined }, expandable: { childrenColumnName: '__shareChildren' }, columns: [{ title: '子ASIN', dataIndex: 'childASIN', width: 160 }, { title: '84天历史份额', dataIndex: 'history84Share', width: 110, render: percent }, { title: '近14天Clean份额', width: 125, render: (_, row) => row.recentSellingDays <= 10 ? '—' : percent(row.recent14Share) }, { title: '份额来源', width: 120, render: (_, row) => row.splitJudgement === '低销量/不稳定' ? '低销量调和' : '系统计算' }, { title: '系统份额', dataIndex: 'systemShare', width: 100, render: percent }, { title: 'PMC调整', width: 100, render: (_, row) => `${Number((shareDraft[row.childASIN] - row.systemShare / 100 || 0).toFixed(2)) > 0 ? '+' : ''}${Number((shareDraft[row.childASIN] - row.systemShare / 100 || 0).toFixed(2))}%` }, { title: '最终份额', width: 170, render: (_, row) => h(InputNumber, { min: 0, max: 100, precision: 2, addonAfter: '%', value: shareDraft[row.childASIN], onChange: value => setShare(row.childASIN, value), disabled: locked, style: { width: 130 } }) }] }),
        h('div', { className: 'fp-share-impact' },
          h('strong', null, '本次调整影响 · ' + selected.parentASIN),
          h('p', null, '拆解版本 ' + batch.splitRuleSnapshot.version + ' → 新版本；未来90天预测变化'),
          shareImpact ? shareImpact.map(row => h('span', { key: row.childId }, row.childASIN + '：' + (row.delta == null ? '待实际销量' : (row.delta > 0 ? '+' : '') + number(row.delta)) + ' 件　')) : h('p', { className: 'fp-danger' }, '当前合计 ' + shareTotal.toFixed(2) + '%，差额 ' + (100 - shareTotal).toFixed(2) + '%，不能保存'),
          h('p', null, '父体总预测不变；子体份额合计必须100%。')),
        h('div', { className: 'fp-kicker' }, '调整原因'), h(Input.TextArea, { value: reason, rows: 2, onChange: event => setReason(event.target.value), placeholder: '必填，写明人工调配依据' }),
        h('div', { className: 'fp-sticky-actions' }, h(Button, { disabled: locked, onClick: () => { setShareDraft(Object.fromEntries(allChildren.filter(row => relationKey(row) === selected.relationKey).map(row => [row.childASIN, row.systemShare / 100]))); setShareEdited(null); } }, '恢复系统占比'), h(Button, { onClick: rebalanceShares, disabled: locked || !shareEdited }, '重新归一化'), h(Button, { onClick: () => setDrawer(null) }, '取消'), h(Button, { type: 'primary', onClick: saveShares, disabled: locked || Math.abs(shareTotal - 100) > 0.005 }, '保存份额并重新计算'))
      ));
    const childBasisContent = child => {
      const source = child.sourceFields || {};
      const fields = [['Clean ADU', source['全窗Clean ADU'] || source['当前Clean ADU0']], ['趋势状态', source['渠道级-趋势标签'] || '上游未提供'], ['动态α', source['动态α'] || '上游未提供'], ['季节系数', source['当前月季节指数'] || '上游未提供'], ['Listing适配系数', source['Listing适配系数'] || '上游未提供'], ['初始化ADU0', source['初始化ADU0'] || '上游未提供']];
      return h('div', { className: 'fp-inline-parent-detail fp-inline-child-detail fp-child-basis-detail' },
        h('div', { className: 'fp-inline-detail-title' }, h('strong', null, `${child.childASIN} · 预测依据`), h(Tag, { color: 'default' }, child.sourceFields?.['预测规则版本'] || 'FORECAST快照')),
        h('div', { className: 'fp-inline-basis-grid' }, fields.map(([label, value]) => h('div', { key: label }, h('span', null, label), h('strong', null, value == null || value === '' ? '—' : String(value))))),
        h('div', { className: 'fp-formula' }, `规则版本：${child.sourceFields?.['预测规则版本'] || '本批次规则快照'}；预测结果仅展示上游提供的计算依据，不在前端重算模型。`)
      );
    };
    const childDetailContent = row => {
      const child = row.child;
      if (row.detailKind === 'basis') return childBasisContent(child);
      return h('div', { className: 'fp-inline-parent-detail fp-inline-child-detail' },
        h('div', { className: 'fp-inline-detail-title' }, h('strong', null, `${child.childASIN} · 份额拆解依据`), child.manualReason && h(Tag, { color: 'processing' }, '本批次人工调整')),
        h('div', { className: 'fp-inline-basis-grid' }, [
          ['84天历史份额', percent(child.history84Share)], ['近14天Clean份额', child.recentSellingDays <= 10 ? '—' : percent(child.recent14Share)], ['近14天有效销量天数', `${child.recentSellingDays ?? '—'} 天`], ['低销量调和', child.splitJudgement === '低销量/不稳定' ? '是（70%历史 / 30%近期）' : '否'], ['归一化前调和权重', child.sourceFields?.['归一化前调和权重'] ?? '上游未提供'], ['份额来源', child.splitJudgement === '低销量/不稳定' ? '低销量调和' : '系统计算'], ['系统计算份额', percent(child.systemShare)], ['PMC调整', child.finalShare === child.systemShare ? '0%' : `${((child.finalShare - child.systemShare) / 100).toFixed(2)}pp`], ['最终子体份额', percent(child.finalShare)], ['预测ADU', child.numeric90Days ? Number(child.total90 / child.numeric90Days).toFixed(2) : '待实际销量'], ['90天预测', child.total90 == null ? window.ForecastLedgerValues.waiting : `${number(child.total90)} 件`]
        ].map(([label, value]) => h('div', { key: label }, h('span', null, label), h('strong', null, value)))),
        child.manualReason && h('div', { className: 'fp-adjustment-reason' }, `调整原因：${child.manualReason}`),
        h(Button, { type: 'link', size: 'small', disabled: locked, onClick: () => startShare(child) }, '调整本组子体份额'));
    };
    const salesActionPaths = {
      sales: 'M3 3v18h18M6 15l4-5 4 3 6-8',
      analysis: 'M3 21h18M6 17v-4m6 4V5m6 12V9',
      mapping: 'M8 7H3v5m0-5 6 6m7 4h5v-5m0 5-6-6M8 17l8-10'
    };
    const salesActionIcon = key => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: salesActionPaths[key] }));
    const productAction = (label, onClick, options = {}) => h('button', { type: 'button', className: `product-action ${options.className || ''}`.trim(), onClick, disabled: options.disabled, 'aria-label': options.ariaLabel || label }, options.iconNode || (options.icon ? h(options.icon) : null), label);
    const openSalesInsight = (child, view, trigger) => {
      const salesChildId = identityFor(child)?.child?.id;
      if (!salesChildId || typeof window.openInsight !== 'function') return message.info('当前子ASIN暂无销售预测详情映射');
      window.openInsight(salesChildId, view, trigger);
    };
    const salesInsightAction = (child, view, label) => productAction(label, event => openSalesInsight(child, view, event.currentTarget), { className: view, iconNode: salesActionIcon(view) });
    const renderProduct = row => {
      if (row._kind === 'basis') return inlineParentContent(row);
      if (row._kind === 'child-detail') return childDetailContent(row);
      if (row._kind === 'parent') {
        const expanded = expandedParents.has(row.relationKey);
        return h(React.Fragment, null,
          h('div', { className: 'parent-label' },
            ledgerView === 'variant' && h('button', { type: 'button', className: 'collapse', onClick: () => toggleParent(row.relationKey), 'aria-expanded': expanded, 'aria-label': `${expanded ? '收起' : '展开'} ${row.parentASIN}` }, h('svg', { viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, 'aria-hidden': true }, h('path', { d: `M2 6h8${expanded ? '' : 'M6 2v8'}` }))),
            ...joined([h('span', { className: 'fp-parent-code-with-count', key: 'parent' }, codeValue(row.parentASIN, '父ASIN', 'parent-code'), h('span', { className: 'parent-child-count' }, `(${row.childCount})`)), codeValue(row.spu, 'SPU', 'parent-code spu'), h('span', { className: 'parent-name', key: 'name' }, row.productName || row.sourceFields?.['商品类型'] || '商品')])),
          h('div', { className: 'parent-shared' },
            ...joined([h('span', { key: 'site' }, `${row.platform || row.children.map(platformFor).find(Boolean) || 'Amazon'} / ${row.country}`), h('span', { key: 'store' }, row.store || row.children.map(storeFor).find(Boolean) || '全部店铺'), h('span', { className: 'parent-owner', key: 'owner' }, `销售：${row.owner || row.children.map(ownerFor).find(Boolean) || '未分配'}`)])),
          h('div', { className: 'product-meta fp-business-status-line' }, joined([
            h('span', { key: 'forecast' }, `预测结果：${resultStateLabel(batch)}`),
            row.children.some(relationIssue) && h('span', { key: 'relation', className: 'fp-inline-warning' }, '关系待确认')
          ])),
        h('div', { className: 'parent-actions product-actions' }, h(Tooltip, { title: '季节', mouseEnterDelay: .2 }, h(Tag, { className: 'season-state', color: seasonBusinessText(row) === '正常销售季' ? 'default' : 'processing' }, seasonBusinessText(row))), parentActions(row)));
      }
      if (row._kind === 'sku') return h('div', { className: 'fp-pmc-sku-identity' }, codeValue(row.sku, 'SKU'), h('span', null, `销售组合 ${row.businessObjectCode} 丨 ×${number(row.quantity)}`));
      if (row._kind !== 'child-line' || !['system', 'summary'].includes(row.lineType)) return null;
      const child = row.child;
      const identity = identityFor(child);
      const image = identity?.group?.image || child.image;
      const standardSku = child.sku || child.sourceFields?.['标准SKU'] || identity?.child?.sku;
      const businessCode = child.businessCode || identity?.child?.businessCode || child.sellerSku;
      const listedAt = child.listedAt || identity?.group?.listedAt;
      const listingDays = child.listingDays ?? identity?.group?.listingDays;
      const salesTags = identity?.group?.tags || child.tags || [];
      const maintenanceTags = [issueFor(child) && { relation: '关系已调整', share: '份额待调整', combo: '组合待拆解', season: '待实际销量' }[issueFor(child)]].filter(Boolean);
      return h('div', { className: 'fp-pmc-child-product' },
        h('div', { className: `product-box ${image ? '' : 'no-image'} ${issueFocus === child.childId ? 'fp-issue-focus' : ''}`.trim() }, image ? h('button', { className: 'thumb', type: 'button', 'data-preview': image, 'aria-label': `放大${child.productName || '商品'}主图` }, h('img', { src: image, alt: child.productName || '商品' })) : null, h('div', { className: 'product-info' }, h('div', { className: 'product-title', title: child.productName }, child.productName || '商品'), h('div', { className: 'child-asin-line' }, codeValue(child.childASIN, '子ASIN')), h('div', { className: 'product-identifiers' }, joined([codeValue(standardSku, 'SKU'), codeValue(businessCode, '业务识别码')])), h('div', { className: 'product-meta' }, joined([h('span', { key: 'owner', className: 'owner' }, `销售：${ownerFor(child)}`), h('span', { key: 'site' }, `${platformFor(child)} / ${child.country}`), h('span', { key: 'store', className: 'store' }, storeFor(child))])), h('div', { className: 'product-meta sales-listing' }, joined([h('span', { key: 'listed' }, `上架 ${dayText(listedAt)}`), h('span', { key: 'age', className: 'listing-age' }, `${listingDays ?? ''} 天`)])))),
        ledgerView === 'child' && h('div', { className: 'product-meta fp-child-parent-context' }, joined([codeValue(child.parentASIN, '父ASIN'), codeValue(child.parentSpu, 'SPU')])),
        h('div', { className: 'product-tags product-status-tags sales-tags' }, [...new Set(salesTags)].map(salesTag)),
        maintenanceTags.length ? h('div', { className: 'fp-maintenance-tags' }, maintenanceTags.map(businessTag)) : null,
        h('div', { className: 'product-actions' },
          salesInsightAction(child, 'sales', '销售趋势'),
          productAction('预测依据', () => toggleChildDetail(child, 'basis'), { className: 'analysis', iconNode: salesActionIcon('analysis') }),
          productAction(`子体份额 ${percent(child.finalShare)}${child.manualReason ? ' · 已调整' : ''}`, () => toggleChildDetail(child, 'share')),
          childActions(child)));
    };
    const contextCell = row => {
      if (row._kind === 'parent') {
        const inventory = row.children.reduce((sum, child) => sum + Number(inventorySummary(child).available || 0), 0);
        const inbound = row.children.reduce((sum, child) => sum + Number(inventorySummary(child).inbound || 0), 0);
        const numbers = Object.keys(row.baselineDaily || {}).sort().slice(0, 90).map(date => row.baselineDaily[date]).filter(window.ForecastLedgerValues.numeric);
        const poolAdu = numbers.length ? window.ForecastLedgerValues.sum(numbers) / numbers.length : null;
        const doiValues = forecastReady && poolAdu > 0 ? [(inventory + inbound) / poolAdu] : [];
        const forecastTotal = forecastReady ? row.baselineTotal ?? row.parentTotal : null;
        const childTotal = forecastReady ? row.childTotal : null;
        const balanced = forecastTotal != null && childTotal != null && forecastTotal === childTotal;
        return h('div', { className: 'fp-pmc-context' },
          h('section', { className: 'context-section fp-context-section', 'data-section': 'sales' }, h('div', { className: 'context-section-title fp-context-section-title' }, '父体预测池'), h('div', { className: 'metric-grid fp-pmc-context-section' }, metric('当前ADU', forecastReady && poolAdu != null ? poolAdu.toFixed(2) : '—'), metric('子体数', row.children.length))),
          h('section', { className: 'context-section fp-context-section', 'data-section': 'stock' }, h('div', { className: 'context-section-title fp-context-section-title' }, '库存'), h('div', { className: 'metric-grid fp-pmc-context-section' }, metric('可售库存', number(inventory), 'stock'), metric('FBA在途', number(inbound), 'stock'), metric('FBA DOS', doiValues.length ? `${Math.round(Math.min(...doiValues))} 天` : '—', doiValues.length && Math.min(...doiValues) < 20 ? 'warn' : 'stock'), doiValues.length && Math.min(...doiValues) < 20 ? metric('库存风险', '缺货风险', 'warn') : null)));
      }
      if (row._kind === 'sku') return h('div', { className: 'metric-grid' }, metric('默认比例', row.ratio), metric('最终比例', row.pmcRatio == null ? row.ratio : percent(row.pmcRatio)));
      if (row._kind !== 'child-line' || !['system', 'summary'].includes(row.lineType)) return null;
      const child = row.child;
      const inventory = inventorySummary(child);
      const identity = identityFor(child)?.child;
      const risk = inventory.fbaDos != null && Number(inventory.fbaDos) < 20;
      const previous = previousChildFor(child);
      const actualDaily = batch.actualSales?.[child.childId] || {};
      const comparableDates = Object.keys(actualDaily).filter(date => actualDaily[date] != null && previous?.dailyFinalForecast?.[date] != null);
      const actual = comparableDates.length ? comparableDates.reduce((sum, date) => sum + Number(actualDaily[date]), 0) : null;
      const previousTotal = comparableDates.length ? comparableDates.reduce((sum, date) => sum + Number(previous.dailyFinalForecast[date]), 0) : null;
      const variance = actual == null || previousTotal == null || previousTotal === 0 ? null : (actual - previousTotal) / previousTotal * 100;
      return h('div', { className: 'fp-pmc-context' },
        h('section', { className: 'context-section fp-context-section', 'data-section': 'sales' }, h('div', { className: 'context-section-title fp-context-section-title' }, '销量'), h('div', { className: 'metric-grid fp-pmc-context-section' }, metric('7日ADU', identity?.base ?? child.recentCleanAdu ?? '—'), metric('14日ADU', child.recentCleanAdu ?? (identity ? identity.base - 1 : '—')))),
        h('section', { className: 'context-section fp-context-section', 'data-section': 'stock' }, h('div', { className: 'context-section-title fp-context-section-title' }, '库存'), h('div', { className: 'metric-grid fp-pmc-context-section' }, metric('可售库存', inventory.available == null ? '—' : number(inventory.available), 'stock'), metric('FBA在途', inventory.inbound == null ? '—' : number(inventory.inbound), 'stock'), metric('FBA DOS', inventory.fbaDos == null ? '—' : `${Number(inventory.fbaDos).toFixed(0)} 天`, risk ? 'warn' : 'stock'), null)),
        comparableDates.length ? h(Popover, { title: '同周期历史对比', trigger: 'click', content: h('div', { className: 'fp-history-popover' }, h('div', null, `上批预测：${number(previousTotal)}`), h('div', null, `实际销量：${number(actual)}`), h('div', null, `偏差：${signedPercent(variance)}`)) }, h(Button, { type: 'link', size: 'small', className: 'fp-history-link' }, '历史对比')) : null,
        risk ? h('div', { className: 'coverage-note risk' }, '到货前存在缺货风险') : null);
    };
    const basisPopover = row => {
      const parent = row._kind === 'parent' ? row : parentRows.find(item => item.relationKey === relationKey(row.child));
      const source = parent?.sourceFields || {};
      const fields = [['Clean ADU', source['全窗Clean ADU'] || source['当前Clean ADU0']], ['趋势状态', source['渠道级-趋势标签'] || '上游未提供'], ['动态α', source['动态α'] || '上游未提供'], ['季节系数', source['当前月季节指数'] || '上游未提供'], ['Listing适配系数', source['Listing适配系数'] || '上游未提供'], ['初始化ADU0', source['初始化ADU0'] || '上游未提供']];
      return h('div', { className: 'fp-basis-popover' }, fields.map(([label, value]) => h('div', { key: label }, h('span', null, label), h('strong', null, value == null || value === '' ? '—' : String(value)))), h('div', { className: 'fp-formula' }, `规则版本：${source['预测规则版本'] || batch.forecastRuleSnapshot.version}`),
        h('details', null, h('summary', null, '查看完整计算链路'), h('p', null, 'Clean ADU → 趋势调整 → 季节修正 → Listing适配 → 动态EWMA → 父体预测池 → PMC校准 → 子体份额 → 子体最终预测'), h('p', null, source['初始ADU0计算式'] || '当前来源未提供模型中间值和计算式。')));
    };
    const basisTrigger = (row, label) => h(Popover, { title: '预测依据', trigger: 'click', getPopupContainer: trigger => trigger.closest('.fp-pmc-workbench') || document.body, content: basisPopover(row) }, h(Button, { type: 'link', size: 'small', className: 'fp-line-basis-trigger', 'aria-label': label }, label));
    const renderLine = row => {
      if (row._kind === 'parent') {
        const numbers = forecastReady ? Object.values(row.lineType === 'system' ? row.daily : row.baselineDaily || row.daily).filter(window.ForecastLedgerValues.numeric) : [];
        return h('div', { className: 'fp-parent-pool-line' },
          row.lineType === 'system' ? basisTrigger(row, '父体预测池') : h('strong', null, row.lineType === 'pmc' ? '人工校准' : '最终预测'),
          h('span', { className: 'line-kicker' }, numbers.length ? number(window.ForecastLedgerValues.sum(numbers)) + ' 件' : '—'),
          row.lineType === 'pmc' && forecastReady && h(Button, { type: 'link', size: 'small', icon: h(icon.EditOutlined), disabled: locked, onClick: () => openCalibration(row), 'aria-label': '校准父体 ' + row.parentASIN }, '校准'));
      }
      if (row._kind === 'sku') return h('div', { className: 'fp-line-label' }, h('strong', null, '销售组合拆解'), h('span', { className: 'line-kicker' }, `${number(row.finalForecast)} 件`), h(Button, { type: 'link', size: 'small', disabled: locked, onClick: () => startCombo(row.child) }, '调整拆解'));
      if (row._kind !== 'child-line') return null;
      const child = row.child;
      if (row.lineType === 'summary') return h('div', { className: 'summary-forecast' }, h('span', null, '最终预测'), h('strong', null, forecastReady && child.total != null ? number(child.total) : '—', forecastReady && child.total != null && h('small', null, ' 件')));
      const total = forecastReady ? (row.lineType === 'system' ? child.systemTotal : child.total) : null;
      if (row.lineType === 'pmc') return h('div', { className: 'fp-parent-pool-line' }, h('strong', null, '人工校准'), h('span', { className: total == null ? 'forecast-state' : 'line-kicker' }, total == null ? '待生成' : number(total) + ' 件'), forecastReady && h('div', { className: 'pmc-baseline-actions' }, h(Button, { type: 'link', size: 'small', icon: h(icon.EditOutlined), disabled: locked, onClick: () => openCalibration(child), 'aria-label': '调整人工校准 ' + child.childASIN }, '校准'), child.pmcCalibration && h(Tag, { color: 'processing' }, '已调整'), child.pmcCalibration && h(Popover, { title: '人工校准记录', trigger: 'click', content: h('div', null, batch.adjustmentLog.filter(item => item.type === 'PMC基准' && (item.key === child.childId || item.key === relationKey(child))).map((item, index) => h('p', { key: index }, dateText(item.at) + ' ' + item.actor + ' 丨 ' + item.reason))) }, h(Button, { type: 'link', size: 'small' }, '查看'))));
      return h('div', { className: `fp-line-label fp-line-${row.lineType}` }, row.lineType === 'system' ? basisTrigger(row, lineLabels[row.lineType]) : h('strong', null, lineLabels[row.lineType]), h('span', { className: 'line-kicker' }, total == null ? '' : `${number(total)} 件`));
    };
    const renderTimeValue = (row, dates) => {
      const value = dates.length === 1 ? lineValue(row, dates[0]) : sumDates(row, dates);
      if (detailRow(row)) return null;
      if (!forecastReady) return h('span', { className: 'fp-ledger-empty' }, '—');
      const statuses = dates.map(date => (row.child || row).dailyForecastStatus?.[date]).filter(Boolean);
      if (statuses.length) return h(Popover, { trigger: 'click', getPopupContainer: trigger => trigger.closest('.fp-pmc-workbench') || document.body, title: 'F10 季节运行', content: h('div', null, h('p', null, window.ForecastLedgerValues.stateText(statuses)), h('p', null, '待实际Clean销量满足启动条件后进入数值预测。'), h('p', null, '当前日期不参与合计、90天ADU、FBA DOS或父子数值对平。')) }, h('button', { type: 'button', className: 'fp-value-detail forecast-state', 'aria-label': window.ForecastLedgerValues.stateText(statuses) }, value == null ? '— · 启动' : number(value) + ' · 启动'));
      if (row.lineType === 'system' && value != null) return h(Popover, { trigger: 'click', title: '预测依据', getPopupContainer: trigger => trigger.closest('.fp-pmc-workbench') || document.body, content: basisPopover(row) }, h('button', { type: 'button', className: 'fp-value-detail', 'aria-label': '系统预测 ' + number(value) + ' 查看计算依据' }, number(value)));
      if (row._kind === 'child-line' && ['final', 'summary'].includes(row.lineType)) {
        const adjustment = row.child.pmcCalibration;
        const changedDay = adjustment && (adjustment.mode !== 'daily' || dates.includes(adjustment.date));
        const sourceLabel = changedDay ? '调' : row.child.manualAdjustment ? '拆' : null;
        const sourceName = sourceLabel === '调' ? 'PMC校准' : sourceLabel === '拆' ? '子体份额拆分' : '系统规则预测';
        const audit = batch.adjustmentLog.find(item => item.key === row.child.childId || item.key === relationKey(row.child));
        return h(Popover, { trigger: 'click', getPopupContainer: trigger => trigger.closest('.fp-pmc-workbench') || document.body, title: '预测来源 · ' + sourceName, content: h('div', null, h('p', null, '系统预测：' + number(sumDates({ ...row, lineType: 'system' }, dates))), h('p', null, '最终预测：' + number(value)), h('p', null, adjustment?.reason || row.child.manualReason || '父体预测池按最终子体份额拆分'), adjustment?.note && h('p', null, adjustment.note), audit && h('p', null, dateText(audit.at) + ' 丨 ' + audit.actor)) }, h('button', { type: 'button', className: 'fp-value-detail final-value', 'aria-label': '最终预测 ' + number(value) + ' 来源 ' + sourceName }, number(value), dates.length === 1 && sourceLabel ? ' · ' + sourceLabel : ''));
      }
      return h('span', { className: row._kind === 'parent' ? 'fp-daily-parent' : 'fp-ledger-number' }, value == null ? '' : number(value));
    };
    const timeSegments = weekGroups.flatMap(week => {
      const collapsed = collapsedWeeks.has(week.key);
      const ranges = collapsed ? [{ key: week.key, dates: week.dates, label: '周合计' }] : week.dates.map(date => ({ key: date, dates: [date], label: `${Number(date.slice(5, 7))}/${date.slice(8, 10)}` }));
      return ranges.map((item, weekIndex) => {
        const weekday = item.dates.length === 1 ? new Date(`${item.dates[0]}T00:00:00Z`).getUTCDay() : null;
        return { ...item, week, collapsed, boundary: weekIndex === 0, weekend: weekday === 0 || weekday === 6, weekday, width: columnWidths[item.key] || (collapsed ? 112 : 72) };
      });
    });
    const columnWidth = key => columnWidths[key] || ({ identity: 334, size: 60, context: 190, line: 130 }[key] || (String(key).includes('W') ? 112 : 72));
    const clampColumnWidth = (key, width) => {
      const limits = key === 'size' ? [52, 120] : key === 'identity' ? [260, 640] : ['context', 'line'].includes(key) ? [100, 360] : String(key).includes('W') ? [100, 240] : [72, 240];
      return Math.round(Math.max(limits[0], Math.min(limits[1], Number(width) || limits[0])));
    };
    const setColumnWidth = (key, width) => {
      const value = clampColumnWidth(key, width);
      setColumnWidths(current => ({ ...current, [key]: value }));
    };
    const startColumnResize = (event, key) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startWidth = columnWidth(key);
      const handle = event.currentTarget;
      const table = handle.closest('table');
      const startTableWidth = Number.parseFloat(table?.style.width) || table?.getBoundingClientRect().width || 0;
      let latestWidth = startWidth;
      document.body.classList.add('is-resizing');
      const move = pointer => {
        latestWidth = clampColumnWidth(key, startWidth + pointer.clientX - startX);
        if (!table) return;
        table.style.setProperty(`--${key}-width`, `${latestWidth}px`);
        const column = [...table.querySelectorAll('col[data-column]')].find(item => item.dataset.column === key);
        if (column) column.style.width = `${latestWidth}px`;
        table.style.width = `${startTableWidth + latestWidth - startWidth}px`;
        table.style.minWidth = table.style.width;
        handle.setAttribute('aria-valuenow', String(latestWidth));
      };
      const stop = () => {
        document.body.classList.remove('is-resizing');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', stop);
        setColumnWidths(current => ({ ...current, [key]: latestWidth }));
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', stop, { once: true });
    };
    const resizeHandle = (key, label) => h('span', { className: 'column-resizer', role: 'separator', tabIndex: 0, 'data-pmc-resize-column': key, 'aria-orientation': 'vertical', 'aria-label': `调整${label}列宽`, 'aria-valuenow': columnWidth(key), onPointerDown: event => startColumnResize(event, key), onKeyDown: event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); setColumnWidth(key, columnWidth(key) + (event.key === 'ArrowLeft' ? -8 : 8)); } });
    const nativeTableWidth = 40 + columnWidth('identity') + columnWidth('size') + columnWidth('context') + columnWidth('line') + timeSegments.reduce((sum, item) => sum + item.width, 0);
    const clearLedgerFocus = () => {
      setFocusCell(null);
      workbenchRef.current?.querySelectorAll('.focus-cross-row,.focus-cross-column,.focus-cross-cell').forEach(node => node.classList.remove('focus-cross-row', 'focus-cross-column', 'focus-cross-cell'));
    };
    const focusTimeCell = (rowKey, segment, index) => setFocusCell({ rowKey, columnKey: segment.key, index });
    const dateCell = (row, segment, index) => {
      const lineClass = row._kind === 'child-line' ? row.lineType === 'activity' ? 'line-event' : row.lineType === 'summary' ? 'line-final' : `line-${row.lineType}` : '';
      const classes = ['date-col', 'num', lineClass, segment.boundary ? 'week-boundary' : '', segment.weekend ? 'weekend' : '', focusCell?.columnKey === segment.key ? 'focus-cross-column' : '', focusCell?.rowKey === row.key && focusCell?.columnKey === segment.key ? 'focus-cross-cell' : ''].filter(Boolean).join(' ');
      return h('td', { key: segment.key, className: classes, 'data-focus-index': index, 'data-time-column': segment.key, onMouseEnter: () => focusTimeCell(row.key, segment, index), onMouseLeave: clearLedgerFocus }, renderTimeValue(row, segment.dates));
    };
    const childSelected = childId => selectedKeys.includes(childId);
    const setChildSelected = (childId, checked) => setSelectedKeys(current => checked ? [...new Set([...current, childId])] : current.filter(key => key !== childId));
    const parentSelection = parent => {
      const keys = parent.children.map(child => child.childId);
      const checked = keys.length > 0 && keys.every(childSelected);
      const partial = keys.some(childSelected) && !checked;
      return h('input', { type: 'checkbox', checked, disabled: locked, ref: node => { if (node) node.indeterminate = partial; }, onChange: event => setSelectedKeys(current => event.target.checked ? [...new Set([...current, ...keys])] : current.filter(key => !keys.includes(key))), 'aria-label': `选择 ${parent.country} ${parent.parentASIN} 下的子ASIN` });
    };
    const detailLedgerRow = (key, className, content) => h('tr', { key, className: `inline-history-row ${className}` }, h('td', { className: 'select-cell' }), h('td', { className: 'inline-full-cell', colSpan: 4 + timeSegments.length }, content));
    const childLineRows = child => {
      const lines = forecastLinesExpanded ? window.ForecastLedgerValues.lines.pmc : ['summary'];
      const rows = lines.map((lineType, lineIndex) => {
        const row = { key: `${child.key}-${lineType}`, _kind: 'child-line', child, lineType };
        const rowClass = [lineIndex === 0 ? 'child-start' : '', forecastLinesExpanded ? '' : 'forecast-collapsed', focusCell?.rowKey === row.key ? 'focus-cross-row' : ''].filter(Boolean).join(' ');
        const lineClass = lineType === 'activity' ? 'line-event' : lineType === 'summary' ? 'line-final' : `line-${lineType}`;
        return h('tr', { key: row.key, className: rowClass, 'data-child-row': child.childId, 'data-forecast-line': lineType },
          lineIndex === 0 ? h('td', { className: 'select-cell', rowSpan: lines.length }, h('input', { type: 'checkbox', checked: childSelected(child.childId), disabled: locked, onChange: event => setChildSelected(child.childId, event.target.checked), 'aria-label': `选择 ${child.country} ${child.childASIN}` })) : null,
          lineIndex === 0 ? h('td', { className: 'identity-cell', rowSpan: lines.length, 'data-record-id': child.childId }, renderProduct(row)) : null,
          lineIndex === 0 ? h('td', { className: 'size-cell', rowSpan: lines.length }, h('span', { className: 'size-value', tabIndex: 0, 'data-hint': `尺码：${child.size || child.sourceFields?.['标准SKU']?.split('-').at(-1) || identityFor(child)?.child?.size || '—'}` }, child.size || child.sourceFields?.['标准SKU']?.split('-').at(-1) || identityFor(child)?.child?.size || '—')) : null,
          lineIndex === 0 ? h('td', { className: 'context-cell', rowSpan: lines.length }, contextCell(row)) : null,
          h('td', { className: `line-cell ${lineClass}`, tabIndex: 0, 'data-hint': { system: '数据/模型层输出，只读', pmc: '按ADU或比例校准；不是销售人工填报', final: 'PMC校准后的最终预测，确认后进入销售填报' }[lineType] }, renderLine(row)),
          ...timeSegments.map((segment, index) => dateCell(row, segment, index)));
      });
      if (drawer === 'share' && selected?.childId === child.childId) rows.push(detailLedgerRow('share-editor-' + child.childId, 'fp-pmc-share-edit-row', renderShareEditor()));
      if (drawer !== 'share' && inlineChildDetail?.key === child.childId) rows.push(detailLedgerRow(`child-detail-${child.childId}`, 'fp-pmc-child-detail-row', childDetailContent({ child, detailKind: inlineChildDetail.kind })));
      if (child.businessObjectType === 'COMBO' && expandedCombos.has(child.childId)) {
        const items = child.children || [];
        const weights = items.map(item => item.pmcRatio == null ? Number(item.quantity || 0) : Number(item.pmcRatio));
        const dailyAllocations = Object.fromEntries(visibleDates.map(date => [date, child.dailyFinalForecast?.[date] == null ? items.map(() => null) : allocateForecast(child.dailyFinalForecast[date], weights)]));
        items.forEach((item, index) => {
          const row = { ...item, child, dailyForecast: Object.fromEntries(visibleDates.map(date => [date, dailyAllocations[date][index]])) };
          rows.push(h('tr', { key: item.key, className: `fp-pmc-combo-row${focusCell?.rowKey === item.key ? ' focus-cross-row' : ''}` }, h('td', { className: 'select-cell' }), h('td', { className: 'identity-cell' }, renderProduct(row)), h('td', { className: 'size-cell' }, `×${item.quantity}`), h('td', { className: 'context-cell' }, contextCell(row)), h('td', { className: 'line-cell line-final' }, renderLine(row)), ...timeSegments.map((segment, index) => dateCell(row, segment, index))));
        });
      }
      return rows;
    };
    const parentLedgerRows = parent => {
      const parentRow = { ...parent, key: parent.key };
      const rows = ['system', 'pmc', 'final'].map((lineType, lineIndex) => {
        const row = { ...parentRow, lineType };
        return h('tr', { key: parent.key + lineType, className: `${lineIndex === 0 ? 'parent-row' : 'fp-parent-line'}${focusCell?.rowKey === parent.key ? ' focus-cross-row' : ''}`, 'data-parent-id': parent.relationKey, 'data-parent-line': lineType },
          ...(lineIndex === 0 ? [h('td', { className: 'select-cell', rowSpan: 3 }, parentSelection(parent)), h('td', { className: 'identity-cell', rowSpan: 3 }, renderProduct(parent)), h('td', { className: 'size-cell', rowSpan: 3 }, h('span', { className: 'parent-meta' }, '父体')), h('td', { className: 'context-cell', rowSpan: 3 }, contextCell(parent))] : []),
          h('td', { className: 'line-cell line-' + lineType }, renderLine(row)), ...timeSegments.map((segment, index) => dateCell(row, segment, index)));
      });
      if (inlineParentDetail?.key === parent.relationKey) rows.push(detailLedgerRow(`inline-${parent.relationKey}`, 'fp-pmc-parent-detail-row', inlineParentContent({ parentRow: parent, detailKind: inlineParentDetail.kind })));
      if (ledgerView !== 'variant' || !expandedParents.has(parent.relationKey)) return rows;
      parent.children.forEach(child => rows.push(...childLineRows(child)));
      const balanced = forecastReady && parent.baselineTotal === parent.childTotal;
      rows.push(h('tr', { key: `summary-${parent.relationKey}`, className: 'summary-row' }, h('td', { className: 'select-cell' }), h('td', { className: 'identity-cell' }, h('b', null, 'Parent 合计')), h('td', { className: 'size-cell' }), h('td', { className: 'context-cell' }, h('span', { className: 'parent-meta' }, `${parent.children.length} 个子体`), h('span', { className: balanced ? 'fp-balance-ok' : 'fp-balance-pending' }, forecastReady ? (balanced ? '✓ 父子预测已平衡' : '⚠ 子体合计待确认') : '待生成')), h('td', { className: 'line-cell' }, '最终预测合计'), ...timeSegments.map((segment, index) => dateCell(parentRow, segment, index))));
      return rows;
    };
    const allVisibleChildIds = pagedParents.flatMap(parent => parent.children.map(child => child.childId));
    const allVisibleSelected = allVisibleChildIds.length > 0 && allVisibleChildIds.every(childSelected);
    const partialVisibleSelected = allVisibleChildIds.some(childSelected) && !allVisibleSelected;
    const renderNativeLedger = () => {
      const ledgerRows = ledgerView === 'parent'
        ? pagedParents.flatMap(parentLedgerRows)
        : ledgerView === 'child'
          ? pagedParents.flatMap(parent => parent.children.flatMap(childLineRows))
          : pagedParents.flatMap(parentLedgerRows);
      return h('table', { className: 'forecast-table fp-pmc-forecast-table', style: { width: nativeTableWidth, minWidth: nativeTableWidth, '--identity-width': `${columnWidth('identity')}px`, '--size-width': `${columnWidth('size')}px`, '--context-width': `${columnWidth('context')}px`, '--line-width': `${columnWidth('line')}px` }, 'aria-label': 'PMC日级预测台账', onMouseLeave: clearLedgerFocus },
        h('colgroup', null,
          h('col', { style: { width: 40 } }),
          h('col', { 'data-column': 'identity', style: { width: columnWidth('identity') } }),
          h('col', { 'data-column': 'size', style: { width: columnWidth('size') } }),
          h('col', { 'data-column': 'context', style: { width: columnWidth('context') } }),
          h('col', { 'data-column': 'line', style: { width: columnWidth('line') } }),
          ...timeSegments.map(segment => h('col', { key: segment.key, 'data-column': segment.key, style: { width: segment.width } }))),
        h('thead', null,
          h('tr', null,
            h('th', { className: 'select-head', rowSpan: 2 }, h('input', { type: 'checkbox', checked: allVisibleSelected, ref: node => { if (node) node.indeterminate = partialVisibleSelected; }, onChange: event => setSelectedKeys(current => event.target.checked ? [...new Set([...current, ...allVisibleChildIds])] : current.filter(key => !allVisibleChildIds.includes(key))), 'aria-label': '选择当前页全部子ASIN' })),
            h('th', { className: 'identity-head', rowSpan: 2 },
              h('div', { className: 'head-goods' }, '商品详情',
                ledgerView === 'variant' && h(React.Fragment, null,
                  h('button', { type: 'button', className: 'tree-tool', onClick: () => setAllParents(true), 'aria-label': '一键展开全部父子ASIN', 'data-hint': '展开全部父子ASIN' }, h('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true }, h('path', { d: 'm4 6 4-4 4 4M4 10l4 4 4-4' }))),
                  h('button', { type: 'button', className: 'tree-tool', onClick: () => setAllParents(false), 'aria-label': '一键收起全部父子ASIN', 'data-hint': '收起全部父子ASIN' }, h('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true }, h('path', { d: 'm4 2 4 4 4-4M4 14l4-4 4 4' }))))),
              resizeHandle('identity', '商品 / ASIN')),
            h('th', { className: 'size-head', rowSpan: 2 }, '尺码', resizeHandle('size', '尺码')),
            h('th', { className: 'context-head', rowSpan: 2 }, '销量 / 库存', resizeHandle('context', '销量 / 库存')),
            h('th', { className: 'line-head', rowSpan: 2 }, h('div', { className: 'forecast-line-heading' }, h('span', null, '预测线'), h('span', { className: 'forecast-toggle-host' }, h(Tooltip, { title: `${forecastLinesExpanded ? '收起' : '展开'}当前页填报明细` }, h(Button, { type: 'text', size: 'small', className: 'forecast-toggle-action', icon: h(forecastLinesExpanded ? icon.UpOutlined : icon.DownOutlined), 'aria-label': `${forecastLinesExpanded ? '收起' : '展开'}当前页填报明细`, 'aria-expanded': forecastLinesExpanded, onClick: () => setForecastLinesExpanded(value => !value) })))), resizeHandle('line', '预测线')),
            ...weekGroups.map(week => {
              const collapsed = collapsedWeeks.has(week.key);
              return h('th', { key: week.key, className: `week-head week-boundary${collapsed ? ' week-collapsed' : ''}`, colSpan: collapsed ? 1 : week.dates.length }, h('div', { className: 'week-heading' }, h('button', { type: 'button', className: 'week-toggle', onClick: () => setCollapsedWeeks(current => { const next = new Set(current); next.has(week.key) ? next.delete(week.key) : next.add(week.key); return next; }), 'aria-expanded': !collapsed, 'aria-label': `${collapsed ? '展开' : '收起'} W${week.week}` }, h('svg', { viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, 'aria-hidden': true }, h('path', { d: `M2 6h8${collapsed ? 'M6 2v8' : ''}` }))), h('span', null, `W${week.week}`)));
            })),
          h('tr', null, ...timeSegments.map((segment, index) => h('th', { key: segment.key, className: ['date-head', 'date-col', segment.boundary ? 'week-boundary' : '', segment.collapsed ? 'week-collapsed' : '', segment.weekend ? 'weekend' : '', focusCell?.columnKey === segment.key ? 'focus-cross-column' : ''].filter(Boolean).join(' '), 'data-focus-index': index, 'data-time-column': segment.key }, h('div', null, segment.label), segment.weekday != null && h('small', null, '周' + '日一二三四五六'[segment.weekday]), resizeHandle(segment.key, segment.collapsed ? `W${segment.week.week}合计` : segment.label))))),
        h('tbody', null, ledgerRows.length ? ledgerRows : h('tr', null, h('td', { className: 'empty-cell', colSpan: 5 + timeSegments.length, style: { height: 180 } }, '没有匹配的父子ASIN记录，请调整筛选条件。'))));
    };
    const syncNativeScrollbar = () => {
      const workbench = workbenchRef.current;
      const track = scrollTrackRef.current;
      if (!workbench || !track) return;
      const max = Math.max(0, workbench.scrollWidth - workbench.clientWidth);
      const trackWidth = track.clientWidth;
      const width = max ? Math.max(42, trackWidth * workbench.clientWidth / workbench.scrollWidth) : trackWidth;
      const travel = Math.max(0, trackWidth - width);
      const left = max ? travel * workbench.scrollLeft / max : 0;
      setScrollbarState(current => current.left === left && current.width === width && current.max === max ? current : { left, width, max });
    };
    useEffect(() => {
      const workbench = workbenchRef.current;
      if (!workbench) return undefined;
      const frame = requestAnimationFrame(syncNativeScrollbar);
      const observer = new ResizeObserver(syncNativeScrollbar);
      observer.observe(workbench);
      const table = workbench.querySelector('.fp-pmc-forecast-table');
      if (table) observer.observe(table);
      workbench.addEventListener('scroll', syncNativeScrollbar, { passive: true });
      return () => { cancelAnimationFrame(frame); observer.disconnect(); workbench.removeEventListener('scroll', syncNativeScrollbar); };
    }, [nativeTableWidth, pagedParents.length, inlineParentDetail?.key, inlineChildDetail?.key, expandedParents, expandedCombos, ledgerView, forecastLinesExpanded]);
    const moveNativeScrollbar = clientX => {
      const workbench = workbenchRef.current;
      const track = scrollTrackRef.current;
      if (!workbench || !track || !scrollbarState.max) return;
      const rect = track.getBoundingClientRect();
      const travel = Math.max(1, rect.width - scrollbarState.width);
      workbench.scrollLeft = Math.max(0, Math.min(scrollbarState.max, (clientX - rect.left - scrollbarState.width / 2) / travel * scrollbarState.max));
    };
    const startNativeScrollDrag = event => {
      event.preventDefault();
      const startX = event.clientX;
      const startScroll = workbenchRef.current?.scrollLeft || 0;
      const trackWidth = scrollTrackRef.current?.clientWidth || 1;
      const travel = Math.max(1, trackWidth - scrollbarState.width);
      const move = pointer => { if (workbenchRef.current) workbenchRef.current.scrollLeft = Math.max(0, Math.min(scrollbarState.max, startScroll + (pointer.clientX - startX) / travel * scrollbarState.max)); };
      const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', stop, { once: true });
    };
    const saveShares = () => {
      if (Math.abs(shareTotal - 100) > 0.005) return message.warning(`当前父ASIN份额合计 ${shareTotal.toFixed(2)}%，需先重新归一化`);
      if (!reason.trim()) return message.warning('请填写份额调整原因');
      try { model.adjustShares(batch.id, selected.relationKey, Object.fromEntries(Object.entries(shareDraft).map(([key, value]) => [key, Math.round(value * 100)])), reason.trim()); setDrawer(null); recomputeSavedConfiguration(); } catch (error) { message.error(error.message); }
    };
    const saveTags = () => {
      if (!tagReason.trim()) return message.warning('请填写标签调整原因');
      try { selected._kind === 'parent' ? model.updateParentTags(batch.id, selected.relationKey, tagDraft, tagReason.trim()) : model.updateChildTags(batch.id, selected.childId, tagDraft, tagReason.trim()); setDrawer(null); message.success('预测标签已保存，系统标签保留'); } catch (error) { message.error(error.message); }
    };
    const saveCombo = () => {
      const total = Object.values(comboRatioDraft).reduce((sum, value) => sum + Number(value || 0), 0);
      if (Math.abs(total - 100) > 0.005) return message.warning(`组合比例合计 ${total.toFixed(2)}%，需为100%`);
      if (!comboReason) return message.warning('请填写组合比例调整原因');
      if (comboReason === '其他' && !comboNote.trim()) return message.warning('选择“其他”时请填写调整说明');
      try { model.adjustComboRatios(batch.id, selected.childId, Object.fromEntries(Object.entries(comboRatioDraft).map(([sku, value]) => [sku, Math.round(value * 100)])), [comboReason, comboNote.trim()].filter(Boolean).join('：')); setDrawer(null); recomputeSavedConfiguration(); } catch (error) { message.error(error.message); }
    };
    const confirmRelations = () => { try { model.confirmRelations(batch.id); message.success('本批次父子关系已确认'); } catch (error) { message.error(error.message); } };
    const confirmSplit = () => { try { model.confirmSplit(batch.id); message.success('父ASIN、子ASIN和销售组合预测已完成平衡校验'); } catch (error) { message.error(error.message); } };
    const recomputeSavedConfiguration = () => {
      try {
        const current = model.getBatch(batch.id);
        if (!current.relationConfirmed) { message.info('配置已保存；请先确认本批次父子关系再重新计算'); return; }
        if (!current.splitConfirmed) model.confirmSplit(batch.id);
        model.recalculate(batch.id, '配置影响已确认，保存并重新计算');
        message.success('配置版本与新预测快照已保存，PMC校准保留');
      } catch (error) { message.warning('配置已保存，重算待处理：' + error.message); }
    };
    const saveRelationWithImpact = () => {
      if (!targetParent || !reason.trim()) return message.warning('请选择目标父ASIN并填写调整原因');
      const moving = allChildren.filter(row => selectedKeys.includes(row.childId));
      const keys = new Set(moving.flatMap(row => [relationKey(row), [row.country, row.store, targetParent].join('|')]));
      const affected = allChildren.filter(row => keys.has(relationKey(row)));
      modal.confirm({ title: '父子关系变更影响', content: h('div', null,
        h('p', null, '当前批次关系快照 ' + batch.relationVersion + ' → 新版本'),
        h('p', null, keys.size + ' 个父ASIN · ' + affected.length + ' 个子ASIN'),
        h('p', null, '子体份额将重新计算，父子预测将重新拆分。历史批次及商品主数据不变。')),
        okText: '保存关系并重新计算', cancelText: '取消',
        onOk: () => { try { model.batchAdjustRelations(batch.id, selectedKeys, targetParent, reason.trim()); model.confirmRelations(batch.id); setSelectedKeys([]); setDrawer(null); recomputeSavedConfiguration(); } catch (error) { message.error(error.message); } }
      });
    };
    const validation = model.validateForecast(batch.id);
    const locateIssue = row => {
      resetFilters(); setLedgerView('variant'); setQuery(row.childASIN); setQueryDraft(row.childASIN);
      setExpandedParents(new Set([relationKey(row)])); setIssueFocus(row.childId);
      const kind = issueFor(row);
      if (kind === 'share') startShare(row);
      else if (kind === 'combo') { setExpandedCombos(new Set([row.childId])); setDrawer(null); }
      else if (kind === 'relation') { setSelectedKeys([row.childId]); setTargetParent(undefined); setReason(''); setDrawer('batch-relation'); }
      else if (kind === 'season') startSeason(parentRows.find(parent => parent.relationKey === relationKey(row)));
      else { setInlineChildDetail({ key: row.childId, kind: kind === 'season' ? 'basis' : 'share' }); setDrawer(null); }
    };
    useEffect(() => {
      if (!issueFocus) return;
      const node = [...(workbenchRef.current?.querySelectorAll('[data-child-row]') || [])].find(item => item.dataset.childRow === issueFocus);
      node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [issueFocus, query, drawer]);
    const openPublish = () => {
      if (batch.resultState !== '已生成' || !batch.activeResultVersion || !validation.passed) { setDrawer('validation'); return; }
      setWindowDraft({ start: String(batch.submissionWindow.submissionStartTime).slice(0, 16), deadline: String(batch.submissionWindow.submissionDeadlineTime).slice(0, 16), freeze: String(batch.submissionWindow.submissionFreezeTime).slice(0, 16) });
      setAutoFreeze(Boolean(batch.submissionWindow.autoFreeze));
      setDrawer('publish');
    };
    const generate = (options = {}) => {
      if (!validation.passed) { setDrawer('validation'); return; }
      try { model.recalculate(batch.id, batch.resultSnapshots.length ? '本批次维护调整后重新生成' : '本批次维护确认后生成', options); message.success('规则预测已生成，历史版本保留'); } catch (error) { message.error(error.message); }
    };
    const confirmForecast = () => {
      try { model.confirmForecast(batch.id); message.success('规则预测已确认，可以发起销售填报'); } catch (error) { message.error(error.message); }
    };
    const publishReady = batch.resultState === '已生成' && batch.resultConfirmed && validation.passed && batch.submissionState === '待发布';
    const publishChecks = () => h('div', { className: 'fp-publish-checks' },
      h('p', null, '计算快照：' + batch.activeResultVersion),
      ...validation.items.map(item => h('div', { key: item.label }, (item.passed ? '✓ ' : '⚠ ') + item.label + (item.passed ? '' : ' · ' + item.count + ' 项'))),
      h('p', null, '人工启动待实际销量：' + allChildren.filter(row => Object.values(row.dailyForecastStatus || {}).some(Boolean)).length + ' 个子体（不参与数值平衡）'),
      h('p', null, 'PMC校准：' + batch.adjustmentLog.filter(item => item.type === 'PMC基准' && item.after).length + ' 项'),
      h('p', null, '确认后冻结本次计算版本，销售填报沿用此快照。'));
    const publish = () => {
      if (!windowDraft?.start || !windowDraft.deadline || !windowDraft.freeze) return message.warning('请填写完整的填报窗口');
      const normalize = value => `${value}:00+08:00`;
      try { model.confirmForecast(batch.id); model.publishWindow(batch.id, { submissionStartTime: normalize(windowDraft.start), submissionDeadlineTime: normalize(windowDraft.deadline), submissionFreezeTime: normalize(windowDraft.freeze), autoFreeze }); setDrawer(null); message.success('已发起销售填报，同一批次规则预测已发布'); } catch (error) { message.error(error.message); }
    };
    const freeze = () => modal.confirm({ title: '提前冻结销售填报？', content: '冻结后销售将不能继续修改本批次预测。', okText: '确认冻结', cancelText: '取消', onOk: () => { try { model.freeze(batch.id, 'PMC提前冻结'); message.success('销售填报已冻结'); } catch (error) { message.error(error.message); } } });
    const saveParameters = () => {
      if (Number(parameterDraft?.historyShareWeight) + Number(parameterDraft?.recentShareWeight) !== 100) return message.warning('历史与近期权重合计必须为100%');
      if (!parameterReason.trim()) return message.warning('请填写本批次参数调整原因');
      try {
        const saved = model.updateParameters(batch.id, parameterDraft, parameterReason.trim());
        setParameterDraft(clone(saved.pendingParameterSnapshot));
        setParameterEditing(false);
        setParameterReason('');
        message.success(`参数已提交，将于 ${dateText(saved.parameterEffectiveAt)} 生效；当前批次继续使用现行参数`);
      } catch (error) { message.error(error.message); }
    };
    const previousParameters = previousBatch?.parameterSnapshot;
    const resetParameterDraft = source => { setParameterDraft({ ...clone(source), version: batch.parameterSnapshot.version }); setParameterEditing(true); setParameterReason(''); };
    const defaultParameterDraft = { historyShareWindow: 84, recentShareWindow: 14, historyShareWeight: 70, recentShareWeight: 30, lowSalesAduThreshold: 2, recentSellingDaysThreshold: 10, trendWindow: 30, seasonIndex: 1, listingFactor: 1 };
    const primaryAction = () => {
      if (batch.status === '已完成') return setDrawer('result');
      if (batch.submissionState === '已冻结') return setDrawer('review');
      if (batch.submissionState === '填报中') return window.pmcWorkflow?.selectView('sales');
      if (batch.resultState === '已生成') return openPublish();
      return confirmRecompute();
    };
    useEffect(() => {
      if (batch.submissionState !== '填报中' || !batch.submissionWindow.autoFreeze) return undefined;
      const check = () => { if (Date.now() >= Date.parse(batch.submissionWindow.submissionFreezeTime)) { try { model.freeze(batch.id); } catch (error) { message.error(error.message); } } };
      check();
      const timer = setInterval(check, 60000);
      return () => clearInterval(timer);
    }, [batch.id, batch.submissionState, batch.submissionWindow.autoFreeze, batch.submissionWindow.submissionFreezeTime]);
    const allAuditRows = [...batch.adjustmentLog, ...batch.relationChanges.map(item => ({ ...item, type: '父子关系' })), ...batch.auditTimeline.map(item => ({ ...item, type: item.action }))].sort((a, b) => b.at.localeCompare(a.at));
    const auditRows = selected ? allAuditRows.filter(item => item.childASIN && item.childASIN === selected.childASIN || item.parentASIN && item.parentASIN === selected.parentASIN || item.key === selected.childId || item.key === selected.relationKey || Array.isArray(item.after) && item.after.some(row => row.childASIN === selected.childASIN)).slice(0, 30) : allAuditRows;
    // Configuration objects save independently. Historical changes are not unsaved drafts.
    const hasPendingChanges = false;
    const pendingChangeCount = batch.resultState === '需重新生成' ? Math.max(1, configChangeCount(batch)) : configChangeCount(batch);
    const primaryLabel = batch.status === '已完成' ? '查看最终预测' : batch.submissionState === '已冻结' ? 'PMC审核' : batch.submissionState === '填报中' ? '查看销售填报' : batch.resultState === '已生成' ? '确认发布' : '重新计算';
    const resetFilters = () => { setQuery(''); setQueryDraft(''); setCountry(undefined); setPlatform(undefined); setStore(undefined); setOwner(undefined); setTagFilter(undefined); setMaintenanceStatus(undefined); setTrendFilter(undefined); setValueFilter(undefined); setInventoryFilter(undefined); setSelectedKeys([]); setPage(1); };
    const readSourceFile = async file => {
      setSourceImportError('');
      setSourceImport(null);
      setSourceSheets([]);
      try {
        const sheets = await window.ForecastSourceImport.read(file);
        const classified = sheets.map(sheet => ({ ...sheet, type: window.ForecastSourceImport.classify(sheet) })).filter(sheet => sheet.type);
        if (!classified.length) throw Error('未识别出父体、子体或季节规则表头');
        setSourceImport({ fileName: file.name });
        setSourceSheets(classified);
        setDrawer('source-import');
      } catch (error) { setSourceImportError(error.message || '文件解析失败'); setDrawer('source-import'); }
      return false;
    };
    const applySourceImport = apply => {
      try {
        const saved = model.importReferenceSheets(batch.id, sourceSheets, sourceImport.fileName, { apply });
        const details = saved.importSummary?.sheets || [];
        const matched = details.reduce((sum, item) => sum + item.matched, 0);
        const unmatched = details.reduce((sum, item) => sum + item.unmatched, 0);
        const applied = details.reduce((sum, item) => sum + item.appliedRows, 0);
        const stale = details.reduce((sum, item) => sum + item.staleRows, 0);
        setDrawer(null);
        message.success(`${apply ? '导入覆盖完成' : '已保存来源快照'}：匹配 ${matched} 行，实际覆盖 ${applied} 行，未匹配 ${unmatched} 行${stale ? `，历史截点跳过 ${stale} 行` : ''}`);
      } catch (error) { message.error(error.message); }
    };
    const sourceReference = type => batch.sourceReferences?.[type];
    const sourcePreviewStats = sheet => {
      const keys = new Set((sheet.type === 'parent' ? batch.parentForecastResults : sheet.type === 'child' ? batch.childForecastResults : sheet.type === 'season' ? batch.parentForecastResults : batch.childForecastResults).map(row => sourceKeyFor(sheet.type, row)));
      const matchedRows = sheet.rows.filter(row => keys.has(sourceKeyFor(sheet.type, row)));
      const stale = sheet.type === 'parent' ? matchedRows.filter(row => String(row['历史数据截点'] || '').slice(0, 10) !== batch.dataCutoffDate).length : 0;
      const review = sheet.type === 'rules' ? matchedRows.length : 0;
      return { matched: matchedRows.length, unmatched: sheet.rows.length - matchedRows.length, stale, review, applicable: matchedRows.length - stale - review };
    };
    const sourceFieldRows = (type, row, keys) => keys.map(key => ({ key, field: key, value: row?.[key] ?? '未匹配' }));
    const sourceDetailSection = type => {
      const ref = sourceReference(type);
      const template = sourceTemplate(type);
      const key = selected ? sourceKeyFor(type, selected) : null;
      const browseIndex = Math.min(sourceBrowseRows[type] || 0, Math.max(0, (ref?.rows?.length || 1) - 1));
      const sourceRow = key ? ref?.rows?.find(row => sourceKeyFor(type, row) === key) : ref?.rows?.[browseIndex];
      const override = key ? batch.sourceOverrides?.[type]?.[key] : null;
      const relevant = !selected || type === selected._kind || ['season', 'rules'].includes(type);
      if (!relevant) return null;
      return h('section', { className: 'fp-source-section', key: type },
        h('div', { className: 'fp-sales-drawer-heading' }, h('strong', null, template?.label || type), h(Space, { size: 6 }, h(Tag, { color: ref ? 'success' : 'default' }, ref ? `${ref.rows.length} 行 · ${dateText(ref.importedAt)}` : '未导入'), selected && h(Tag, { color: sourceRow ? 'success' : 'warning' }, sourceRow ? `已匹配 ${key}` : `当前记录未匹配 ${key}`), !selected && ref && h(Tag, { color: ref.unmatchedRows ? 'warning' : 'success' }, ref.unmatchedRows ? `未匹配 ${ref.unmatchedRows}` : '全部匹配'))),
        !selected && ref?.rows?.length > 1 && h(Select, { showSearch: true, optionFilterProp: 'label', 'aria-label': `${template?.label || type}来源记录`, value: browseIndex, onChange: value => setSourceBrowseRows(current => ({ ...current, [type]: value })), options: ref.rows.map((row, index) => ({ value: index, label: `${index + 1}. ${sourceKeyFor(type, row)}` })), style: { width: '100%', marginBottom: 8 } }),
        h(PlanTable, { rowKey: 'field', className: 'fp-source-values', pagination: false, dataSource: (template?.fields || []).map(field => ({ field, source: sourceRow?.[field], override: override?.[field] })), columns: [{ title: '附件字段', dataIndex: 'field', width: 205 }, { title: selected ? '当前记录附件值' : '附件首行示例', dataIndex: 'source', render: value => value == null || value === '' ? h('span', { className: 'fp-muted' }, '—') : String(value) }, { title: '本批次人工覆盖', dataIndex: 'override', width: 160, render: value => value == null || value === '' ? h('span', { className: 'fp-muted' }, '未覆盖') : String(value) }] }),
        ref && h('div', { className: 'fp-help' }, `来源：${ref.fileName} / ${ref.sheetName} · 已匹配 ${ref.matchedRows || 0} 行，实际覆盖 ${ref.appliedRows || 0} 行，未匹配 ${ref.unmatchedRows || 0} 行${ref.staleRows ? `，截点跳过 ${ref.staleRows} 行` : ''}`),
        ref?.unmatched?.length ? h(Alert, { type: 'warning', showIcon: true, message: `有 ${ref.unmatched.length} 行未匹配`, description: ref.unmatched.slice(0, 3).map(row => sourceKeyFor(type, row)).join('、') }) : null
      );
    };
    const changeCounts = {
      relation: batch.relationChanges.length,
      share: batch.adjustmentLog.filter(item => item.type === '子ASIN份额').length,
      combo: batch.adjustmentLog.filter(item => ['销售组合明细', '销售组合比例'].includes(item.type)).length
    };
    const parameterEffectiveAt = batch.parameterEffectiveAt || null;
    const pendingParameters = batch.pendingParameterSnapshot || null;
    const setWindowDays = size => { setDateWindowSize(size); setDateWindowStart(Math.min(windowStart, Math.max(0, dailyDates.length - size))); setCollapsedWeeks(new Set()); };
    const shiftWindow = direction => setDateWindowStart(Math.max(0, Math.min(dailyDates.length - dateWindowSize, windowStart + direction * dateWindowSize)));
    const applyDateRange = values => {
      if (!values?.[0] || !values?.[1]) return;
      const start = dailyDates.indexOf(values[0].format('YYYY-MM-DD'));
      const end = dailyDates.indexOf(values[1].format('YYYY-MM-DD'));
      if (start < 0 || end < start) return message.warning('请选择本批次预测范围内的日期');
      setDateWindowStart(start);
      setDateWindowSize(end - start + 1);
      setCollapsedWeeks(new Set());
    };
    const openParameterEditor = () => { setSelected(null); setParameterDraft(clone(batch.pendingParameterSnapshot || batch.parameterSnapshot)); setParameterEditing(false); setDrawer('parent-basis'); };
    const moreMenu = { items: [
      { key: 'parameters', label: '预测参数', disabled: locked },
      { key: 'relations', label: '父子关系', disabled: locked },
      { key: 'split', label: '子体拆分', disabled: locked },
      { key: 'combo', label: '销售组合拆解', disabled: locked },
      { type: 'divider' },
      { key: 'source', label: '导入参考数据', disabled: locked },
      { key: 'source-detail', label: '字段来源' },
      { key: 'audit', label: '查看变更记录' },
      { key: 'version', label: '查看版本信息' },
      { key: 'export', label: '导出台账' },
      { key: 'copy', label: '复制批次' },
      { key: 'sales', label: '查看销售填报' },
      { type: 'divider' },
      { key: 'void', label: '作废批次', danger: true, disabled: locked }
    ], onClick: ({ key }) => {
      if (key === 'sales') window.pmcWorkflow?.selectView('sales');
      else if (key === 'parameters') openParameterEditor();
      else if (key === 'relations') setDrawer('relations');
      else if (key === 'split') setDrawer('split-picker');
      else if (key === 'combo') setDrawer('combo-picker');
      else if (key === 'source') sourceFileInputRef.current?.click();
      else if (key === 'source-detail') openSourceDetail(null);
      else if (key === 'export') message.success('导出任务已创建，将按当前筛选范围生成台账文件');
      else if (key === 'audit') { setSelected(null); setDrawer('audit'); }
      else if (key === 'version') message.info(`本批次计算快照：${batch.activeResultVersion || '待计算'}；版本详情已保留在批次审计记录中`);
      else if (key === 'copy') message.info('复制批次将继承配置并基于最新销量、库存重新计算');
      else if (key === 'void') message.warning('当前原型保留作废入口，不执行不可恢复的数据删除');
    } };
    const confirmRecompute = () => {
      let clearCalibration = false;
      return modal.confirm({
      title: '重新计算预测',
      content: h('div', { className: 'fp-recompute-confirm' },
        h('p', null, `计算范围：${parentRows.length} 个父ASIN · ${allChildren.length} 个子ASIN · ${dailyDates.length} 个预测日`),
        h('p', null, '将重新应用当前预测参数、父子关系、子体拆分和销售组合拆解，并重新生成系统预测快照。'),
        h('p', null, '父子关系、已确认份额和销售组合配置保留；历史结果版本不被覆盖。'),
        h('p', null, 'PMC已保存校准'),
        h(antd.Radio.Group, { defaultValue: false, options: [{ value: false, label: '保留' }, { value: true, label: '清除' }], onChange: event => { clearCalibration = event.target.value; } }),
        batch.relationChanges.length > 0 && h('p', null, '本批次关系已调整，重算将按当前关系重新拆分子体预测。')
      ),
      okText: '开始计算', cancelText: '取消', onOk: () => generate({ clearCalibration })
    }); };
    const pageCount = Math.max(1, Math.ceil(projectedTotal / pageSize));
    const pageNumbers = Array.from({ length: Math.min(5, pageCount) }, (_, index) => {
      const start = pageCount <= 5 ? 1 : Math.min(Math.max(1, safePage - 2), pageCount - 4);
      return start + index;
    });
    return h(React.Fragment, null,
      calibrationTarget && h(BaselineCalibration, { key: calibrationTarget.key, batch, target: calibrationTarget, locked, onClose: () => setCalibrationTarget(null) }),
      h('header', { className: 'fp-sales-header' },
        h('div', { className: 'fp-sales-title' }, h(Button, { type: 'text', icon: h(icon.ArrowLeftOutlined), onClick: () => onBack(), 'aria-label': '返回预测批次列表' }), h('div', { className: 'fp-pmc-title-block' }, h('div', null, h('strong', null, batch.name), pmcStatusTag(batch))))
      ),
      h('div', { className: 'fp-pmc-batch-context' },
        h('span', null, `预测周期：${dayText(batch.forecastStartDate)} ～ ${dayText(batch.forecastEndDate)}`),
        h('span', null, `销售填报：${dateText(batch.submissionWindow.submissionStartTime)} ～ ${dateText(batch.submissionWindow.submissionDeadlineTime)}`)
      ),
      parameterEffectiveAt && pendingParameters && h(Alert, { className: 'fp-parameter-effective-alert', type: 'info', showIcon: true, message: `参数设置已提交，次日生效 · ${dateText(parameterEffectiveAt)}`, description: `当前批次仍使用 ${batch.parameterSnapshot.version}；待生效版本 ${pendingParameters.version} 不会立即覆盖当前预测快照。`, closable: true }),
      h(PlanListPanel, {
        search: h('div', { className: 'fp-pmc-search-layout' },
          h('div', { className: 'fp-pmc-filter-grid' },
            h('div', { className: 'fp-pmc-filter-row' },
              h(Select, { allowClear: true, placeholder: '平台：全部', value: platform, options: platformOptions, onChange: setPlatform, style: { width: 118 } }),
              h(Select, { allowClear: true, placeholder: '国家 / 站点：全部', value: country, options: countryOptions, onChange: setCountry, style: { width: 142 } }),
              h(Select, { allowClear: true, placeholder: '销售负责人：全部', value: owner, options: ownerOptions, onChange: setOwner, style: { width: 144 } }),
              h(Select, { value: ledgerView, 'aria-label': '层级', options: [{ value: 'variant', label: '父体 / 子体' }, { value: 'parent', label: '仅父ASIN' }, { value: 'child', label: '仅子ASIN' }], onChange: value => { setLedgerView(value); setPage(1); }, style: { width: 132 } })),
            h('div', { className: 'fp-pmc-filter-row' },
              h(Input, { allowClear: true, prefix: h(icon.SearchOutlined), placeholder: '输入父ASIN、子ASIN或SKU', value: queryDraft, onChange: event => setQueryDraft(event.target.value), onPressEnter: () => setQuery(queryDraft), style: { width: 250 } }),
              h(Select, { allowClear: true, placeholder: '配置状态：全部', value: maintenanceStatus, options: [{ value: 'complete', label: '已完成' }, { value: 'pending', label: '待处理 / 存在异常' }, { value: 'adjusted', label: '已调整' }, { value: 'relation', label: '关系异常' }, { value: 'share', label: '份额待调整' }, { value: 'combo', label: '组合待拆解' }], onChange: setMaintenanceStatus, style: { width: 142 } }),
              h(Button, { type: 'primary', onClick: () => setQuery(queryDraft) }, '查询'),
              h(Button, { onClick: resetFilters }, '重置'))),
          h('div', { className: 'fp-pmc-search-action' }, h(Button, { type: 'primary', disabled: batch.resultState !== '已生成' || batch.resultConfirmed || !validation.passed, onClick: confirmForecast }, batch.resultConfirmed ? '已确认' : '确认预测'))),
        toolbar: h('div', { className: 'fp-pmc-ledger-tools' },
          h('div', { className: 'fp-pmc-function-row' }, h(Space, { size: 8, wrap: true, className: 'fp-pmc-primary-actions' },
            h('input', { ref: sourceFileInputRef, type: 'file', accept: '.xlsx,.csv', hidden: true, onChange: event => { const file = event.target.files?.[0]; if (file) readSourceFile(file); event.target.value = ''; } }),
            h(Button, { type: 'primary', disabled: !publishReady, icon: icon.SendOutlined ? h(icon.SendOutlined) : h(icon.RightOutlined), onClick: openPublish, 'aria-label': '发起销售预测填报' }, '发起销售预测填报'),
            h(Button, { icon: h(icon.ReloadOutlined), onClick: confirmRecompute, 'aria-label': '重新生成预测' }, '重新生成预测'),
            counts.pending > 0 && h(Button, { type: 'link', className: 'fp-pmc-exception-button', onClick: () => setDrawer('validation') }, `待处理 ${counts.pending}`)),
          h('div', { className: 'fp-pmc-function-meta' }, h(Dropdown, { menu: moreMenu, trigger: ['click'] }, h(Button, { 'aria-label': '更多', icon: h(icon.MoreOutlined) }, '更多')))),
          h('div', { className: 'range-bar fp-pmc-range-bar', 'aria-label': '预测时间轴导航' },
            h('div', { className: 'range-left' }, h('div', { className: 'range-title' }, h('span', null, '预测周期'), h('strong', null, `${dayText(batch.forecastStartDate)} ～ ${dayText(batch.forecastEndDate)}`)), h('span', { className: 'range-section-separator', 'aria-hidden': true }, '丨'), h('div', { className: 'range-current' }, h('span', null, '查看窗口'), h(DatePicker.RangePicker, { className: 'fp-range-picker', size: 'small', allowClear: false, inputReadOnly: true, format: 'YYYY/MM/DD', value: visibleDates.length ? [dayjs(visibleDates[0]), dayjs(visibleDates.at(-1))] : null, disabledDate: current => current && (current.isBefore(dayjs(dailyDates[0]), 'day') || current.isAfter(dayjs(dailyDates.at(-1)), 'day')), presets: [{ label: '14天', value: [dayjs(visibleDates[0]), dayjs(dailyDates[Math.min(dailyDates.length - 1, windowStart + 13)])] }, { label: '30天', value: [dayjs(visibleDates[0]), dayjs(dailyDates[Math.min(dailyDates.length - 1, windowStart + 29)])] }, { label: '全部范围', value: [dayjs(dailyDates[0]), dayjs(dailyDates.at(-1))] }], onChange: applyDateRange, 'aria-label': '选择当前查看窗口' })), h('div', { className: 'range-nav' }, h(Tooltip, { title: '向前切换窗口' }, h(Button, { className: 'fp-range-nav-button', size: 'small', icon: h(icon.LeftOutlined), disabled: windowStart === 0, onClick: () => shiftWindow(-1), 'aria-label': '向前切换窗口' })), h(Tooltip, { title: '向后切换窗口' }, h(Button, { className: 'fp-range-nav-button', size: 'small', icon: h(icon.RightOutlined), disabled: windowStart + dateWindowSize >= dailyDates.length, onClick: () => shiftWindow(1), 'aria-label': '向后切换窗口' }))), h('div', { className: 'range-tabs', role: 'group', 'aria-label': '窗口天数' }, [14, 30, dailyDates.length].map(size => h(Button, { key: size, type: 'text', size: 'small', className: dateWindowSize === size ? 'active' : '', 'aria-pressed': dateWindowSize === size, onClick: () => setWindowDays(size) }, size === dailyDates.length ? '全部' : `${size}天`)))),
            )
        )
      }, h('div', { className: 'workbench-shell fp-pmc-workbench-shell' },
        h('div', { ref: workbenchRef, className: 'workbench fp-pmc-workbench', 'aria-label': 'PMC日级预测台账', onScroll: syncNativeScrollbar }, renderNativeLedger()),
        h('div', {
          className: 'horizontal-scrollbar fp-pmc-horizontal-scrollbar',
          role: 'scrollbar', tabIndex: 0, 'aria-label': '列表横向滚动', 'aria-orientation': 'horizontal', 'aria-valuemin': 0, 'aria-valuemax': 100,
          'aria-valuenow': scrollbarState.max ? Math.round((workbenchRef.current?.scrollLeft || 0) / scrollbarState.max * 100) : 0,
          onPointerDown: event => { if (event.button !== 0) return; if (event.target.closest('.horizontal-scroll-thumb')) startNativeScrollDrag(event); else if (event.target.closest('.horizontal-scroll-track')) moveNativeScrollbar(event.clientX); },
          onKeyDown: event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key) || !workbenchRef.current) return; event.preventDefault(); const max = scrollbarState.max; const step = workbenchRef.current.clientWidth; workbenchRef.current.scrollLeft = event.key === 'Home' ? 0 : event.key === 'End' ? max : Math.max(0, Math.min(max, workbenchRef.current.scrollLeft + ({ ArrowLeft: -80, ArrowRight: 80, PageUp: -step, PageDown: step }[event.key] || 0))); }
        }, h('div', { ref: scrollTrackRef, className: 'horizontal-scroll-track' }, h('div', { ref: scrollThumbRef, className: 'horizontal-scroll-thumb', style: { width: scrollbarState.width, left: scrollbarState.left } })))
      )),
      h('div', { className: 'list-footer fp-pmc-list-footer' },
        h('div', { className: 'pagination', 'aria-label': '列表分页' }, h('span', { className: 'page-total' }, `${filtered.length} 个父ASIN · ${filteredChildCount} 个子ASIN`), h('button', { type: 'button', disabled: safePage <= 1, onClick: () => setPage(Math.max(1, safePage - 1)), 'aria-label': '上一页' }, '‹'), ...pageNumbers.map(pageNumber => h('button', { key: pageNumber, type: 'button', className: pageNumber === safePage ? 'active' : '', 'aria-current': pageNumber === safePage ? 'page' : undefined, onClick: () => setPage(pageNumber) }, pageNumber)), h('button', { type: 'button', disabled: safePage >= pageCount, onClick: () => setPage(Math.min(pageCount, safePage + 1)), 'aria-label': '下一页' }, '›'), h('select', { className: 'control', value: pageSize, 'aria-label': '每页条数', onChange: event => { setPageSize(Number(event.target.value)); setPage(1); } }, h('option', { value: 20 }, '20 / 页'), h('option', { value: 50 }, '50 / 页')))),
      h(antd.Modal, { open: drawer === 'parent-basis', width: 680, footer: null, title: '预测参数 · 批次快照', onCancel: () => parameterEditing ? modal.confirm({ title: '放弃未提交的参数调整？', okText: '放弃', cancelText: '继续编辑', onOk: () => setDrawer(null) }) : setDrawer(null), destroyOnClose: true }, h(React.Fragment, null,
        h('p', { className: 'fp-help' }, '后续批次生效：复制为新版本后，当前批次仍使用原执行版本；应用当前批次必须明确重新计算。'), h(Divider, null, '基础参数'),
        h(Descriptions, { size: 'small', column: 2, items: [
          { key: 'cutoff', label: '历史截止日', children: batch.dataCutoffDate },
          { key: 'start', label: '预测开始日', children: batch.forecastStartDate },
          { key: 'end', label: '预测结束日', children: batch.forecastEndDate },
          { key: 'source', label: '参数来源', children: batch.parameterSnapshot.inheritedFrom || '系统默认规则' },
          { key: 'version', label: '参数版本', children: batch.parameterSnapshot.version },
          { key: 'model', label: '父体预测规则', children: batch.forecastRuleSnapshot.name || '本批次规则预测' },
          { key: 'history', label: '历史 Clean 销量', children: `${batch.parameterSnapshot.historyShareWindow} 天` },
          { key: 'recent', label: '近期 Clean 销量', children: `${batch.parameterSnapshot.recentShareWindow} 天` },
          { key: 'season', label: '季节指数', children: batch.parameterSnapshot.seasonIndex },
          { key: 'total', label: selected?._kind === 'parent' ? '当前父体预测' : '本批次父体预测合计', children: `${number(selected?._kind === 'parent' ? selected.parentTotal : batch.parentForecastResults.reduce((sum, row) => sum + row.total, 0))} 件` }
        ] }),
        pendingParameters && h(Alert, { type: 'info', showIcon: true, className: 'fp-parameter-pending-alert', message: `待生效参数 ${pendingParameters.version}`, description: `提交时间 ${dateText(batch.parameterSubmittedAt)} · 生效时间 ${dateText(parameterEffectiveAt)}。当前批次及已生成快照仍使用 ${batch.parameterSnapshot.version}。` }),
        pendingParameters && !locked && h(Button, { onClick: () => modal.confirm({ title: '应用参数并重新计算当前批次？', content: '执行参数 ' + batch.parameterSnapshot.version + ' → ' + pendingParameters.version + '。本批次父子预测重新生成，已保存的PMC校准、份额和组合分配保留，旧结果快照保留。', okText: '应用到当前批次并重新计算', cancelText: '取消', onOk: () => { try { model.recalculate(batch.id, 'PMC确认应用新参数版本', { applyPendingParameters: true }); setDrawer(null); message.success('新参数已绑定当前批次并生成新计算快照'); } catch (error) { message.error(error.message); } } }) }, '应用到当前批次并重新计算'),
        h(Divider, null),
        h(Divider, null, '子体拆分参数'), h('div', { className: 'fp-sales-drawer-heading' }, h('strong', null, '当前生效参数'), !locked && h(Button, { type: 'link', onClick: () => setParameterEditing(!parameterEditing) }, parameterEditing ? '取消调整' : '复制为新版本')),
        [['historyShareWindow', '历史观察周期', '天'], ['recentShareWindow', '近期观察周期', '天'], ['historyShareWeight', '历史权重', '%'], ['recentShareWeight', '近期权重', '%'], ['seasonIndex', '季节指数', ''], ['listingFactor', 'Listing适配系数', '']].map(([key, label, suffix]) => h('div', { className: 'fp-sales-parameter-row', key }, h('span', null, label), parameterEditing ? h(InputNumber, { min: 0, max: suffix === '%' ? 100 : 365, precision: ['seasonIndex', 'listingFactor'].includes(key) ? 2 : 0, value: parameterDraft?.[key], addonAfter: suffix || undefined, onChange: value => setParameterDraft(current => ({ ...current, [key]: value })), style: { width: 140 } }) : h('div', { className: 'fp-parameter-values' }, h('strong', null, `${batch.parameterSnapshot[key]}${suffix}`), pendingParameters && pendingParameters[key] !== batch.parameterSnapshot[key] && h('span', null, `待生效 ${pendingParameters[key]}${suffix}`)))),
        h(Divider, null, '趋势参数'), h('div', { className: 'fp-sales-parameter-row' }, h('span', null, '动态α'), h('strong', null, batch.forecastRuleSnapshot.dynamicAlpha || '按旧规则计算')),
        h(Button, { type: 'link', size: 'small', onClick: () => setAllParametersOpen(value => !value) }, allParametersOpen ? '收起计算参数' : '展开全部计算参数'),
        allParametersOpen && h(React.Fragment, null,
          [['lowSalesAduThreshold', '低销量 ADU 阈值', ''], ['recentSellingDaysThreshold', '有销量天数阈值', '天'], ['trendWindow', '趋势观察周期', '天']].map(([key, label, suffix]) => h('div', { className: 'fp-sales-parameter-row', key }, h('span', null, label), parameterEditing ? h(InputNumber, { min: 0, max: 365, value: parameterDraft?.[key], addonAfter: suffix || undefined, onChange: value => setParameterDraft(current => ({ ...current, [key]: value })), style: { width: 140 } }) : h('div', { className: 'fp-parameter-values' }, h('strong', null, `${batch.parameterSnapshot[key]}${suffix}`), pendingParameters && pendingParameters[key] !== batch.parameterSnapshot[key] && h('span', null, `待生效 ${pendingParameters[key]}${suffix}`)))),
          selected?._kind === 'parent' && h('div', { className: 'fp-inline-basis-grid' }, [['全窗Clean ADU', selected.sourceFields?.['全窗Clean ADU']], ['近期Clean ADU', selected.sourceFields?.['近期Clean ADU']], ['去季节化日均销量', selected.sourceFields?.['去季节化日均销量']], ['当前EWMA基准ADU', selected.sourceFields?.['当前EWMA基准ADU']], ['市场变化率', selected.sourceFields?.['市场变化率']], ['相对市场表现', selected.sourceFields?.['相对市场表现']], ['季节指数匹配状态', selected.sourceFields?.['季节指数匹配状态']], ['初始ADU0计算式', selected.sourceFields?.['初始ADU0计算式']]].map(([label, value]) => h('div', { key: label }, h('span', null, label), h('strong', null, value ?? '未匹配'))))
        ),
        h(Divider, null, '季节参数'), h('p', null, '季节规则 ' + batch.seasonRuleVersion + '；商品季节运行只读引用。参数提交次日00:00起用于后续批次，当前批次不变。'),
        !locked && h(Space, { size: 8, wrap: true, style: { marginTop: 8 } }, h(Button, { size: 'small', disabled: !previousParameters, onClick: () => resetParameterDraft(previousParameters) }, '继承上一批次'), h(Button, { size: 'small', onClick: () => resetParameterDraft(defaultParameterDraft) }, '恢复系统默认')),
        parameterEditing && h(React.Fragment, null, h(Form.Item, { label: '调整原因', style: { marginTop: 12 } }, h(Input.TextArea, { rows: 2, value: parameterReason, onChange: event => setParameterReason(event.target.value), placeholder: '说明参数变化原因；提交后次日0点生效' })), h('div', { className: 'fp-sticky-actions' }, h(Button, { type: 'primary', onClick: saveParameters }, '提交参数调整')))
      )),
      h(Drawer, { open: drawer === 'history-batches', width: 560, title: '历史预测批次', onClose: () => setDrawer(null), destroyOnClose: true }, h(PlanTable, { rowKey: 'id', pagination: false, dataSource: model.list(), columns: [{ title: '预测批次', dataIndex: 'name' }, { title: '状态', dataIndex: 'status', width: 90 }, { title: '操作', width: 82, render: (_, row) => h(Button, { type: 'link', onClick: () => { setDrawer(null); onOpenBatch(row.id); } }, '查看') }] })),
      h(Drawer, { open: drawer === 'relations', width: 820, title: '父子ASIN关系维护', onClose: () => setDrawer(null), destroyOnClose: true },
        h('p', null, `当前关系版本 ${batch.relationVersion} 丨 生效批次 ${batch.batchDate}`),
        h('p', { className: 'fp-help' }, '当前批次父子关系快照；保存生成新关系版本，不修改商品主数据和历史批次。'),
        h(Button, { disabled: locked, icon: h(icon.PlusOutlined), onClick: () => { setDrawer(null); setAddRelationOpen(true); } }, '添加子ASIN'),
        h(PlanTable, { rowKey: 'childId', scroll: { x: 720, y: 420 }, dataSource: allChildren, columns: [
          { title: '国家 / 子ASIN', width: 180, render: (_, row) => row.country + ' 丨 ' + row.childASIN },
          { title: 'SKU', dataIndex: 'sku', width: 160 }, { title: '当前父体', dataIndex: 'parentASIN', width: 150 },
          { title: '状态', width: 100, render: (_, row) => relationIssue(row) ? '关系已调整' : '正常' },
          { title: '操作', width: 100, render: (_, row) => h(Button, { type: 'link', disabled: locked, onClick: () => { setSelectedKeys([row.childId]); setTargetParent(undefined); setReason(''); setDrawer('batch-relation'); } }, '调整') }
        ] }), h('div', { className: 'fp-sticky-actions' }, h(Button, { disabled: locked || batch.relationConfirmed, onClick: () => { confirmRelations(); setDrawer(null); } }, batch.relationConfirmed ? '父子关系已确认' : '确认父子关系'))),
      h(Drawer, { open: ['split-picker', 'combo-picker'].includes(drawer), width: 680, title: drawer === 'combo-picker' ? '销售组合拆解' : '子体拆分', onClose: () => setDrawer(null), destroyOnClose: true },
        h(PlanTable, { rowKey: 'childId', scroll: { x: 570, y: 420 }, dataSource: drawer === 'combo-picker' ? allChildren.filter(row => row.businessObjectType === 'COMBO') : allChildren, columns: [
          { title: '子ASIN', dataIndex: 'childASIN' }, { title: '父ASIN', dataIndex: 'parentASIN' },
          { title: '子体份额', render: (_, row) => percent(row.finalShare) },
          { title: '操作', render: (_, row) => h(Button, { type: 'link', disabled: locked, onClick: () => {
            if (drawer === 'combo-picker') return startCombo(row);
            resetFilters(); setLedgerView('variant'); setQuery(row.childASIN); setQueryDraft(row.childASIN); setExpandedParents(new Set([relationKey(row)])); startShare(row);
          } }, drawer === 'combo-picker' ? '调整拆解' : '行内调整') }
        ] }), drawer === 'split-picker' && h('div', { className: 'fp-sticky-actions' }, h(Button, { disabled: locked || !batch.relationConfirmed || batch.splitConfirmed, onClick: () => { confirmSplit(); setDrawer(null); } }, batch.splitConfirmed ? '预测拆解已确认' : '确认预测拆解'))),
      h(Drawer, { open: drawer === 'validation', width: 680, title: '本批次异常与发布检查', onClose: () => setDrawer(null), destroyOnClose: true }, h(React.Fragment, null,
        h(Alert, { type: validation.passed ? 'success' : 'warning', showIcon: true, message: validation.passed ? '配置检查已通过' : '当前配置尚未完成，请处理阻断项' }),
        h(PlanTable, { rowKey: 'label', pagination: false, scroll: { x: 550, y: 300 }, dataSource: [...validation.items, { label: '系统预测已生成', passed: batch.resultState === '已生成', count: 1 }, { label: 'PMC结果已确认', passed: batch.resultConfirmed, count: 1 }], columns: [{ title: '校验项', dataIndex: 'label' }, { title: '状态', width: 90, render: (_, item) => h(Tag, { color: item.passed ? 'success' : 'warning' }, item.passed ? '通过' : `${item.count} 项`) }] }),
        h('div', null, allChildren.filter(issueFor).map(row => h('p', { key: row.childId }, row.childASIN + ' 丨 ' + ({ relation: '父子关系变化', share: '份额需确认', combo: '组合拆解需确认', season: '人工启动（待实际销量），不纳入数值合计' }[issueFor(row)]), h(Button, { type: 'link', onClick: () => locateIssue(row) }, '定位处理')))),
        h('div', { className: 'fp-sticky-actions' }, h(Button, { onClick: () => setDrawer(null) }, '返回列表'), !batch.relationConfirmed ? h(Button, { type: 'primary', onClick: () => { confirmRelations(); setDrawer(null); } }, '确认父子关系') : !batch.splitConfirmed ? h(Button, { type: 'primary', onClick: () => { confirmSplit(); setDrawer(null); } }, '确认预测拆解') : validation.passed ? h(Button, { type: 'primary', onClick: () => { setDrawer(null); confirmRecompute(); } }, '重新计算') : null)
      )),
      h(Drawer, { open: drawer === 'publish', width: 480, title: '发起销售预测填报', onClose: () => setDrawer(null), destroyOnClose: true }, windowDraft && h(React.Fragment, null,
        h(Descriptions, { size: 'small', column: 1, items: [{ key: 'batch', label: '预测批次', children: batch.name }, { key: 'range', label: '预测周期', children: `${dayText(batch.forecastStartDate)} ~ ${dayText(batch.forecastEndDate)}` }, { key: 'result', label: '规则预测版本', children: batch.activeResultVersion }, { key: 'count', label: '子ASIN记录', children: `${batch.childForecastResults.length} 条` }] }),
        [['start', '销售填报开始'], ['deadline', '销售填报截止'], ['freeze', '冻结时间']].map(([key, label]) => h(Form.Item, { key, label }, h(Input, { type: 'datetime-local', value: windowDraft[key], onChange: event => setWindowDraft(current => ({ ...current, [key]: event.target.value })) }))),
        h(Checkbox, { checked: autoFreeze, onChange: event => setAutoFreeze(event.target.checked) }, '到达冻结时间自动冻结销售修改'),
        h('div', { className: 'fp-sticky-actions' }, h(Button, { onClick: () => setDrawer(null) }, '取消'), h(Button, { type: 'primary', onClick: () => modal.confirm({ title: '发布检查', content: publishChecks(), okButtonProps: { disabled: !validation.passed }, okText: '确认发起', cancelText: '取消', onOk: publish }) }, '确认发起'))
      )),
      h(Drawer, { open: drawer === 'batch-relation', width: 480, title: `批量调整父ASIN · ${selectedKeys.length} 项`, onClose: () => setDrawer(null), destroyOnClose: true }, h(React.Fragment, null,
        h('p', null, '原父体：' + [...new Set(allChildren.filter(row => selectedKeys.includes(row.childId)).map(row => row.parentASIN))].join('、') + ' 丨 生效批次：' + batch.batchDate),
        h('div', { className: 'fp-kicker' }, '调整为'), h(Select, { showSearch: true, optionFilterProp: 'label', value: targetParent, options: parentOptions, onChange: setTargetParent, style: { width: '100%', marginBottom: 12 } }),
        h('div', { className: 'fp-kicker' }, '调整原因'), h(Input.TextArea, { value: reason, rows: 3, onChange: event => setReason(event.target.value) }),
        h('div', { className: 'fp-sticky-actions' }, h(Button, { onClick: () => setDrawer(null) }, '取消'), h(Button, { type: 'primary', onClick: saveRelationWithImpact }, '保存关系并重新计算'))
      )),
      h(Drawer, { open: addRelationOpen, width: 520, title: '新增或恢复本批次关系', onClose: () => setAddRelationOpen(false), destroyOnClose: true }, h(RelationAddForm, { batch, parentOptions, childOptions: [...new Map([...batch.relationSnapshot, ...(batch.removedRelations || [])].map(row => [row.childId, { value: row.childId, label: `${row.childASIN} · ${row.country}` }])).values()], onCancel: () => setAddRelationOpen(false), onSubmit: values => { try { model.upsertRelations(batch.id, values); setAddRelationOpen(false); message.success('本批次父子关系已更新'); } catch (error) { message.error(error.message); } } })),
      h(Drawer, { open: drawer === 'review', width: 480, title: 'PMC审核', onClose: () => setDrawer(null), destroyOnClose: true }, h(React.Fragment, null,
        h(Descriptions, { size: 'small', column: 1, items: [{ key: 'state', label: '填报状态', children: batch.submissionState }, { key: 'result', label: '规则预测版本', children: batch.activeResultVersion }, { key: 'submitted', label: '销售已提交', children: `${salesCounts(batch).submitted} / ${allChildren.length}` }, { key: 'confirmed', label: 'PMC已确认', children: `${salesCounts(batch).confirmed} / ${allChildren.length}` }, { key: 'pending', label: '待PMC审核', children: salesCounts(batch).pending }] }),
        h('div', { className: 'fp-sticky-actions' }, h(Button, { onClick: () => window.pmcWorkflow?.selectView('sales') }, '查看销售填报'), h(Button, { type: 'primary', onClick: () => { try { model.completeBatch(batch.id, salesCounts(batch).confirmed); setDrawer(null); message.success('本批次最终预测已确认'); } catch (error) { message.error(error.message); } } }, '完成PMC审核'))
      )),
      h(Drawer, { open: drawer === 'result', width: 480, title: '最终预测版本', onClose: () => setDrawer(null), destroyOnClose: true }, h(Descriptions, { size: 'small', column: 1, items: [{ key: 'batch', label: '预测批次', children: batch.name }, { key: 'version', label: '结果版本', children: batch.activeResultVersion }, { key: 'relation', label: '关系版本', children: batch.relationVersion }, { key: 'split', label: '拆解版本', children: batch.splitRuleSnapshot.version }, { key: 'status', label: '状态', children: batch.status }] })),
      h(Drawer, { open: drawer === 'tags', width: 480, title: `${selected?.childASIN || selected?.parentASIN || ''} · 预测标签维护`, onClose: () => setDrawer(null), destroyOnClose: true }, selected && h(React.Fragment, null,
        h(Descriptions, { size: 'small', column: 1, items: [['原标签', selected.sourceFields?.['原标签'] || (selected.tags || []).join('、')], ['系统趋势', selected.sourceFields?.['渠道级-趋势标签']], ['系统价值等级', selected.sourceFields?.['渠道级-价值分级']], ['系统运营标签', selected.sourceFields?.['渠道级-运营标签']], ['系统季节属性', selected.sourceFields?.['季节属性_实际使用']]].filter(([, value]) => value).map(([label, value]) => ({ key: label, label, children: value })) }),
        [['productStage', '商品阶段', ['新品', '成长', '成熟', '衰退']], ['salesTag', '过货标签', ['正常过货', '限制过货', '停止过货']], ['stockTag', '备货标签', ['爆款-备货', '畅款-备货', '平款-备货', '低销-备货', '清货']], ['trendLabel', '趋势标签', ['增长', '平稳', '衰退']], ['valueGrade', '价值分级', ['A', 'B', 'C', 'D']], ['operationTag', '运营标签', ['正常运营', '运营助推', '运营诊断', '促销清货/退市评估']], ['seasonality', '季节属性', ['四季品（默认）', '季节品']]].map(([key, label, options]) => h(Form.Item, { key, label }, h(Select, { allowClear: true, value: tagDraft[key], options: options.map(value => ({ value, label: value })), onChange: value => setTagDraft(current => ({ ...current, [key]: value })), disabled: locked }))),
        h('div', { className: 'fp-help' }, '清空某项表示删除本批次人工标签；系统原始标签仍保留在“系统标签”中。'),
        h(Form.Item, { label: '调整原因' }, h(Input.TextArea, { value: tagReason, rows: 2, onChange: event => setTagReason(event.target.value), placeholder: '说明标签调整依据' })),
        h('div', { className: 'fp-sticky-actions' }, h(Button, { onClick: () => setDrawer(null) }, '取消'), h(Button, { type: 'primary', onClick: saveTags, disabled: locked }, '保存标签'))
      )),
      h(Drawer, { open: drawer === 'combo', width: 720, title: `${selected?.businessObjectCode || ''} · 销售组合拆解`, onClose: () => setDrawer(null), destroyOnClose: true }, selected && h(React.Fragment, null,
        h(Alert, { type: 'info', showIcon: true, message: `当前批次预测拆解 · ${selected.businessObjectCode || '销售组合'}`, description: `商品主数据组合定义（版本 ${selected.businessObjectVersion || '—'}）只读；本次调整仅影响本批次预测分配，不修改主数据。默认按组件数量比例拆解，子ASIN预测 ${forecastReady ? number(selected.total) + ' 件' : '待生成'}。` }),
        h(PlanTable, { rowKey: 'sku', dataSource: (selected.comboLines || []).map((line, index, lines) => ({ ...line, previewForecast: allocateForecast(selected.total, lines.map(item => comboRatioDraft[item.sku] || 0))[index] })), pagination: false, columns: [{ title: 'SKU', dataIndex: 'sku' }, { title: '数量', dataIndex: 'quantity', width: 68, render: value => `×${number(value)}` }, { title: '默认比例', dataIndex: 'defaultRatio', width: 90, render: percent }, { title: '系统预测', dataIndex: 'systemSuggested', width: 90, render: number }, { title: 'PMC最终比例', width: 150, render: (_, line) => h(InputNumber, { min: 0, max: 100, precision: 2, addonAfter: '%', value: comboRatioDraft[line.sku], onChange: value => setComboRatioDraft(current => ({ ...current, [line.sku]: Number(value) || 0 })), disabled: locked, style: { width: 132 } }) }, { title: '最终预测', dataIndex: 'previewForecast', width: 90, render: number }] }),
        h(Alert, { type: Math.abs(Object.values(comboRatioDraft).reduce((sum, value) => sum + Number(value || 0), 0) - 100) < 0.005 ? 'success' : 'warning', showIcon: true, message: `最终比例合计 ${Object.values(comboRatioDraft).reduce((sum, value) => sum + Number(value || 0), 0).toFixed(2)}%` }),
        h(Button, { type: 'link', size: 'small', onClick: () => setComboRatioDraft(Object.fromEntries((selected.comboLines || []).map(line => [line.sku, Number((line.defaultRatio / 100).toFixed(2))]))) }, '恢复默认比例'),
        h(Form.Item, { label: '调整原因' }, h(Select, { value: comboReason, placeholder: '保存人工比例时必选', options: ['库存消化', '新旧版本切换', '供应能力', '供应商交期', '销售趋势', '特殊业务安排', '恢复默认比例', '其他'].map(value => ({ value, label: value })), onChange: setComboReason, style: { width: '100%' } })),
        comboReason === '其他' && h(Form.Item, { label: '调整说明' }, h(Input, { value: comboNote, onChange: event => setComboNote(event.target.value) })),
        h('p', { className: 'fp-help' }, '影响预览：' + (selected.comboLines || []).length + ' 个组成SKU；父体和子体预测总量不变。拆解版本 ' + batch.splitRuleSnapshot.version + ' → 新版本。'), h('div', { className: 'fp-sticky-actions' }, h(Button, { onClick: () => setDrawer(null) }, '取消'), h(Button, { type: 'primary', onClick: saveCombo, disabled: locked }, '保存组合拆解并重新计算'))
      )),
      h(Drawer, { open: drawer === 'season', width: 500, title: (selected?.parentASIN || '') + ' · 季节运行', onClose: () => setDrawer(null), destroyOnClose: true }, selected && h(React.Fragment, null,
        h(Alert, { type: 'info', showIcon: true, message: '季节规则只读引用', description: '人工启动状态不是零预测，不参与ADU及数值汇总，不允许人工或活动覆盖。' }),
        h(Descriptions, { size: 'small', column: 1, items: [
          { key: 'type', label: '类型编码', children: selected.typeCode || '上游未提供' },
          { key: 'version', label: '季节规则版本', children: batch.seasonRuleVersion },
          { key: 'mode', label: '运行模式', children: selected.sourceFields?.['季节运行模式'] || selected.seasonRuntime?.typeCode || '上游未提供' },
          { key: 'restart', label: '重启月份', children: sourceReference('rules')?.rows?.find(row => row['类型编码'] === selected.typeCode)?.['重启动月'] || (selected.typeCode === 'F10' ? '8月' : '上游未提供') },
          { key: 'season', label: '销售季', children: selected.typeCode === 'F10' ? '8月～次年2月；3月～7月非销售季' : '按所引用规则' },
          { key: 'state', label: '当前窗口状态', children: window.ForecastLedgerValues.stateText(visibleDates.map(date => selected.dailyForecastStatus?.[date])) || '数值预测' }
        ] }))),
      h(Drawer, { open: drawer === 'source-import', width: 620, title: '导入预测参考表', onClose: () => setDrawer(null), destroyOnClose: true }, h(React.Fragment, null,
        h(Alert, { type: sourceImportError ? 'error' : 'info', showIcon: true, message: sourceImportError || (sourceImport ? `${sourceImport.fileName} 已解析，可确认写入当前批次` : '支持父体、子体、季节指数和季节运行规则表'), description: sourceImportError ? '请使用包含标准表头的 .xlsx 或 .csv 文件重试。' : '导入内容作为本批次参考快照保存，不会覆盖系统规则预测。' }),
        sourceSheets.length ? h(PlanTable, { rowKey: 'type', pagination: false, dataSource: sourceSheets, columns: [{ title: '识别内容', dataIndex: 'type', render: value => ({ parent: '父体标签字段', child: '子体预测字段', season: '月度季节指数', rules: '季节运行规则' }[value]) }, { title: '工作表', dataIndex: 'name' }, { title: '记录数', render: (_, row) => `${row.rows.length} 行` }, { title: '字段数', render: (_, row) => `${Object.keys(row.rows[0] || {}).length} 列` }, { title: '本批次匹配 / 处理', render: (_, row) => { const stats = sourcePreviewStats(row); return h('span', null, `${stats.matched} 匹配 · ${stats.applicable} 可覆盖 · ${stats.unmatched} 未匹配${stats.stale ? ` · ${stats.stale} 截点跳过` : ''}${stats.review ? ` · ${stats.review} 待复核` : ''}`); } }] }) : null,
        sourceSheets.some(sheet => sheet.type === 'parent' && sheet.rows.some(row => String(row['历史数据截点'] || '').slice(0, 10) !== batch.dataCutoffDate)) && h(Alert, { type: 'warning', showIcon: true, message: '附件数据截点与当前批次不同', description: `本批次截点 ${dayText(batch.dataCutoffDate)}。导入覆盖只作用于国家+ASIN精确匹配的记录；附件中的历史预测结果不会冒充本批次重新计算值。` }),
        sourceImport && h('div', { className: 'fp-help' }, `确认后可在“查看字段来源”中按需查看原始字段。待生成状态可以将精确匹配字段覆盖到当前批次；当前批次没有匹配的ASIN会标记为“未匹配”，不会被静默丢弃。${!editableAll ? '当前批次已生成结果，仅允许保存快照，不能直接覆盖。' : ''}`),
        h('div', { className: 'fp-sticky-actions' }, h(Button, { onClick: () => setDrawer(null) }, '取消'), h(Button, { onClick: () => applySourceImport(false), disabled: !sourceSheets.length || Boolean(sourceImportError) }, '仅保存来源快照'), h(Button, { type: 'primary', onClick: () => applySourceImport(true), disabled: !sourceSheets.length || Boolean(sourceImportError) || !editableAll }, '导入并覆盖本批次'))
      )),
      h(Drawer, { open: drawer === 'source-detail', width: 760, title: selected ? `${selected.childASIN || selected.parentASIN} · 附件字段与来源` : '参考字段与来源', onClose: () => setDrawer(null), destroyOnClose: true }, h(React.Fragment, null,
        h(Alert, { type: 'info', showIcon: true, message: selected ? '按当前记录匹配附件字段' : '批次附件字段目录', description: '主表展示高频判断信息；附件原值、人工覆盖及未匹配项分别保留。来源字段覆写不等于重算预测，关系、份额和季节指数请使用对应维护操作。' }),
        ['parent', 'child', 'season', 'rules'].map(sourceDetailSection)
      )),
      h(Drawer, { open: drawer === 'audit', width: 720, title: selected ? `${selected.childASIN || selected.parentASIN} · 变更记录` : '本批次变更记录', onClose: () => setDrawer(null), destroyOnClose: true }, h(PlanTable, { rowKey: (_, index) => index, dataSource: auditRows, pagination: false, columns: [{ title: '时间', dataIndex: 'at', width: 150, render: dateText }, { title: '类型', dataIndex: 'type', width: 132, render: value => String(value || '').replaceAll('PMC基准', 'PMC校准') }, { title: '对象', render: (_, row) => row.childASIN || row.parentASIN || row.businessObjectCode || '本批次' }, { title: '变更内容', render: (_, row) => row.from || row.to ? (row.from || '未归属') + ' → ' + (row.to || '移除') : row.beforeAdu != null ? row.beforeAdu + ' → ' + row.afterAdu : row.before?.version ? row.before.version + ' → ' + row.after.version : Array.isArray(row.after) ? row.after.map(item => item.childASIN ? item.childASIN + ' ' + percent(row.before?.find(old => old.childASIN === item.childASIN)?.finalShare) + ' → ' + percent(item.finalShare) : item.sku + ' → ' + percent(item.pmcRatio ?? item.defaultRatio)).join('；') : '—' }, { title: '调整原因', dataIndex: 'reason' }, { title: '操作人', dataIndex: 'actor', width: 105 }] }))
    );
  }
  function PlanDetail({ batchId, onBack, onOpenBatch }) {
    useStoreRevision();
    const batch = model.getBatch(batchId, { materialize: true });
    if (!batch) return h(Empty, { description: '预测批次不存在' });
    return h(ParentChildMaintenance, { key: batch.id, batch, onBack, onOpenBatch: onOpenBatch || onBack });
  }
  function ForecastPlanWorkspace() {
    useStoreRevision();
    const initialView = pendingRoute.view || 'plans';
    const [view, setView] = useState(initialView);
    const [detailId, setDetailId] = useState(pendingRoute.detailId);
    useEffect(() => { const fn = event => { const route = event.detail || {}; setView(route.view || 'plans'); setDetailId(route.detailId || null); }; window.addEventListener('forecast-plan-route', fn); return () => window.removeEventListener('forecast-plan-route', fn); }, []);
    const open = id => window.pmcWorkflow?.openForecastResultBatch?.(id, model.getBatch(id)?.name || batchText(model.getBatch(id)));
    if (view === 'system-detail' && detailId) return h('div', { className: 'forecast-plan-root fp-pmc-detail-root' }, h(PlanDetail, { batchId: detailId, onBack: () => window.pmcWorkflow?.showPlanningBaseTab?.(), onOpenBatch: open }));
    const body = detailId ? h(PlanDetail, { batchId: detailId, onBack: nextId => { if (nextId) setDetailId(nextId); else setDetailId(null); } }) : h(BatchList, { onOpen: open });
    return h('div', { className: `forecast-plan-root ${detailId ? 'fp-pmc-detail-root' : 'fp-list-page'}` }, body);
  }
  function navigate(route) {
    pendingRoute = { view: 'plans', detailId: model.getCurrent().id, step: 'maintenance' };
    window.dispatchEvent(new CustomEvent('forecast-plan-route', { detail: pendingRoute }));
  }
  window.ParentAsinModule = {
    ParentAsinWorkspace: ForecastPlanWorkspace,
    navigate,
    openResultsList() {
      pendingRoute = { view: 'plans', detailId: null, step: 'overview' };
      window.dispatchEvent(new CustomEvent('forecast-plan-route', { detail: pendingRoute }));
    },
    openSystemBatchDetail(batchId, step = 'forecast') {
      pendingRoute = { view: 'system-detail', detailId: batchId || model.getCurrent().id, step };
      window.dispatchEvent(new CustomEvent('forecast-plan-route', { detail: pendingRoute }));
    },
    getBatchLabel(batchId) {
      const batch = model.getBatch(batchId);
      return batch?.name || batchText(batch);
    },
    getCurrentBasis() {
      const batch = contract.getCurrentMeta ? contract.getCurrentMeta() : contract.getCurrent();
      return { batch: batch.batchDate, forecast: batch.forecastRuleVersion || batch.forecastRuleSnapshot?.version, season: batch.seasonRuleVersion || batch.seasonRuleMode, split: batch.splitRuleVersion || batch.splitRuleSnapshot?.version, relation: batch.relationVersion, params: batch.parameterVersion || batch.parameterSnapshot?.version, status: batch.status };
    }
  };
})();
