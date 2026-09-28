/* Forecast-plan workspace: batch-first backend operations. */
(() => {
  const h = React.createElement;
  const { useEffect, useMemo, useRef, useState } = React;
  const { Alert, App, Button, Checkbox, Descriptions, Divider, Drawer, Empty, Form, Input, InputNumber, Pagination, Popover, Progress, Segmented, Select, Space, Steps, Table, Tabs, Tag, Tooltip, Upload } = antd;
  const icon = window.icons || {};
  const model = window.ForecastBatchModel.createStore({}, null);
  const contract = model.contract;
  window.ForecastBatchContract = contract;
  let pendingRoute = { view: 'plans', detailId: null, step: 'assessment' };
  const clone = value => JSON.parse(JSON.stringify(value));
  const dateText = value => String(value || '').slice(0, 16).replace('T', ' ').replaceAll('-', '/');
  const dayText = value => String(value || '').slice(0, 10).replaceAll('-', '/');
  const batchText = value => `${dayText(value?.batchDate || value)} 批次`;
  const number = value => Number(value || 0).toLocaleString('zh-CN');
  const percent = value => `${(Number(value || 0) / 100).toFixed(2).replace(/\.00$/, '')}%`;
  const signedPercent = value => `${value > 0 ? '+' : ''}${Number(value || 0).toFixed(1)}%`;
  const relationKey = row => [row.country, row.store, row.parentASIN].join('|');
  const childForecastKey = row => [row.country, row.store, row.childASIN].join('|');
  const parentForecastKey = row => [row.country, row.store, row.parentASIN].join('|');
  const contractChild = (index, row) => index?.children?.[childForecastKey(row)] || null;
  const contractParent = (index, row) => index?.parents?.[parentForecastKey(row)] || null;
  const statusColor = { 草稿: 'default', 评估中: 'processing', 参数调整中: 'processing', 参数已确认: 'success', 关系确认中: 'warning', 关系已确认: 'success', 拆解规则确认中: 'warning', 拆解已确认: 'success', 预测计算中: 'processing', 规则预测已生成: 'success', 待发布: 'default', 销售填报中: 'processing', 待复盘: 'warning', 已冻结: 'default', 已完成: 'success' };
  const steps = [
    { key: 'assessment', title: '预测评估', description: '上一批次表现' },
    { key: 'parameters', title: '预测参数', description: '本批次执行值' },
    { key: 'relations', title: '父子关系', description: '本批次关系与调整' },
    { key: 'split', title: '子体拆解', description: '份额规则与人工调配' },
    { key: 'forecast', title: '规则预测', description: '生成与校验' },
    { key: 'submission', title: '销售提报窗口', description: '发布与冻结' },
    { key: 'review', title: '预测复盘', description: '实际与偏差' }
  ];
  const stepIndex = key => Math.max(0, steps.findIndex(step => step.key === key));
  const statusTag = value => h(Tag, { color: statusColor[value] || 'default' }, value);
  function useStoreRevision() {
    const [, bump] = useState(0);
    useEffect(() => model.subscribe(() => bump(value => value + 1)), []);
    return model.getState();
  }
  function MetricStrip({ items }) {
    return h('div', { className: 'fp-metrics' }, items.map(item => h('div', { className: 'fp-metric', key: item.label }, h('span', null, item.label), h('strong', { className: item.tone || '' }, item.value))));
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
    const next = { ...column, align: 'left' };
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
  function BatchList({ onOpen }) {
    const { message } = App.useApp();
    const [query, setQuery] = useState('');
    const batches = model.list().filter(batch => !query || [batchText(batch), batch.id, batch.batchVersion].some(value => String(value).includes(query.trim())));
    const create = () => { try { const next = model.createNextBatch(); onOpen(next.id); message.success(`已创建 ${next.batchVersion} 草稿`); } catch (error) { message.error(error.message); } };
    const columns = [
      { title: '预测批次', dataIndex: 'name', width: 196, render: (_, row) => h(Button, { type: 'link', className: 'fp-link', onClick: () => onOpen(row.id) }, batchText(row)) },
      { title: '数据截点', dataIndex: 'dataCutoffDate', width: 112, render: dayText },
      { title: '预测周期', width: 190, render: (_, row) => `${dayText(row.forecastStartDate)} ~ ${dayText(row.forecastEndDate)}` },
      { title: '父ASIN', width: 78, align: 'right', render: (_, row) => new Set(row.relationSnapshot.map(item => `${item.country}|${item.store}|${item.parentASIN}`)).size },
      { title: '子ASIN', width: 78, align: 'right', render: (_, row) => row.childForecastResults.length },
      { title: '规则版本', width: 162, render: (_, row) => h('div', null, row.forecastRuleSnapshot.version, h('div', { className: 'fp-muted' }, `${row.splitRuleSnapshot.version} · ${row.parameterSnapshot.version}`)) },
      { title: '父子关系版本', dataIndex: 'relationVersion', width: 150 },
      { title: '销售填报窗口', width: 184, render: (_, row) => `${dateText(row.submissionWindow.submissionStartTime)} ~ ${dateText(row.submissionWindow.submissionFreezeTime)}` },
      { title: '状态', dataIndex: 'status', width: 112, render: statusTag }
    ];
    return h(React.Fragment, null,
      h(PlanListPanel, {
        search: h(Input.Search, { allowClear: true, placeholder: '批次名称 / 版本', onSearch: setQuery, style: { width: 260 } }),
        toolbar: h(Button, { type: 'primary', icon: h(icon.PlusOutlined), onClick: create }, '创建下一批次')
      }, h(PlanTable, { rowKey: 'id', dataSource: batches, columns, scroll: { y: 'max(120px, calc(100vh - 300px))' }, onRow: row => ({ className: 'fp-batch-row', onDoubleClick: () => onOpen(row.id) }) }))
    );
  }
  function PlanHeader({ batch, onBack }) {
    const status = batch.status;
    return h(React.Fragment, null,
      h(PageHead, { title: h('div', { className: 'fp-detail-title' }, h(Button, { type: 'text', icon: h(icon.ArrowLeftOutlined), onClick: onBack, 'aria-label': '返回预测计划列表' }), h('strong', null, batchText(batch)), statusTag(status)), subtitle: `${batch.batchVersion} · 数据截点 ${dayText(batch.dataCutoffDate)} · 预测周期 ${dayText(batch.forecastStartDate)} ~ ${dayText(batch.forecastEndDate)}` }),
      h(MetricStrip, { items: [
        { label: '父ASIN预测池', value: `${new Set(batch.relationSnapshot.map(item => `${item.country}|${item.store}|${item.parentASIN}`)).size} 个` },
        { label: '子ASIN清单', value: `${batch.childForecastResults.length} 个` },
        { label: '关系版本', value: batch.relationVersion },
        { label: '预测参数版本', value: batch.forecastRuleSnapshot.version },
        { label: '拆解规则版本', value: batch.splitRuleSnapshot.version },
        { label: '规则预测结果', value: batch.activeResultVersion || batch.resultState, tone: batch.resultState === '已生成' ? 'success' : batch.resultState === '需重新生成' ? 'warning' : '' },
        { label: '销售填报', value: batch.submissionState, tone: batch.submissionState === '已冻结' ? 'success' : '' },
        { label: '当前负责人', value: batch.createdBy }
      ] })
    );
  }
  function WorkflowSteps({ active, batch, onChange }) {
    const current = stepIndex(active);
    const completed = {
      assessment: Boolean(batch.assessment),
      parameters: !['草稿', '评估中'].includes(batch.workflowState),
      relations: batch.relationConfirmed,
      split: batch.splitConfirmed,
      forecast: batch.resultState === '已生成',
      submission: ['填报中', '已冻结'].includes(batch.submissionState),
      review: ['已完成', '已复盘'].includes(batch.workflowState)
    };
    const items = steps.map((step, index) => ({ ...step, status: index === current ? 'process' : completed[step.key] ? 'finish' : 'wait' }));
    return h('div', { className: 'fp-stepbar' }, h(Steps, { current, size: 'small', responsive: true, items, onChange: index => onChange(steps[index].key) }));
  }
  function AssessmentStep({ batch, onStep }) {
    const { message } = App.useApp();
    const variance = batch.assessment.varianceRate;
    const comparisonPeriod = batch.assessment.comparable ? `${dayText(batch.assessment.comparisonStartDate)} ~ ${dayText(batch.assessment.comparisonEndDate)}（${batch.assessment.comparisonDays}天）` : '等待下一批次实际销量回流';
    const columns = [
      { title: '父ASIN预测池', dataIndex: 'parentASIN', width: 150 },
      { title: '对比期规则预测', dataIndex: 'total', align: 'right', render: number },
      { title: '对比期实际销量', dataIndex: 'actualSales', align: 'right', render: number },
      { title: '偏差', dataIndex: 'variance', align: 'right', render: value => h('span', { className: value < 0 ? 'fp-danger' : 'fp-success' }, `${value > 0 ? '+' : ''}${number(value)}`) },
      { title: '偏差率', dataIndex: 'varianceRate', align: 'right', render: value => h(Tag, { color: Math.abs(value) > 15 ? 'warning' : 'default' }, signedPercent(value)) },
      { title: '本批次判断', width: 200, render: (_, row) => row.varianceRate < -15 ? '近期销售走弱，建议提高近期权重' : row.varianceRate > 15 ? '近期销售走强，建议复核趋势参数' : '表现稳定，沿用默认观察窗口' }
    ];
    return h(React.Fragment, null,
      h(Alert, { type: !batch.assessment.comparable ? 'info' : Math.abs(variance) > 15 ? 'warning' : 'success', showIcon: true, message: `上一批次复盘：${batch.assessment.trend}`, description: `对比期 ${comparisonPeriod}。预测与实际使用完全一致的日期范围；系统只提供建议，不会自动修改执行参数。` }),
      h(MetricStrip, { items: [{ label: '对比期规则预测', value: number(batch.assessment.ruleForecastTotal) }, { label: '对比期实际销量', value: number(batch.assessment.actualSalesTotal) }, { label: '同周期偏差', value: batch.assessment.comparable ? signedPercent(variance) : '待回流', tone: batch.assessment.comparable && Math.abs(variance) > 15 ? 'warning' : 'success' }, { label: '异常子ASIN', value: `${batch.assessment.anomalyCount} 个`, tone: batch.assessment.anomalyCount ? 'warning' : 'success' }, { label: '关系变更', value: `${batch.assessment.relationChanges} 条` }, { label: '评估来源批次', value: batch.assessment.previousBatchVersion || '无' }] }),
      h(PlanListPanel, {
        title: '父ASIN预测与实际同周期对比',
        meta: h('span', { className: 'fp-muted' }, comparisonPeriod),
        toolbar: h(Button, { type: 'primary', onClick: () => { try { model.confirmAssessment(batch.id); message.success('预测评估已确认，进入参数调整'); } catch (error) { message.error(error.message); } } }, '确认评估并进入参数调整')
      }, h(PlanTable, { rowKey: 'key', dataSource: batch.forecastVsActual, columns, locale: { emptyText: '暂无可比批次数据' } })),
      h('div', { className: 'fp-panel' }, h('div', { className: 'fp-panel-head' }, h('h2', null, '评估结论'), h('span', { className: 'fp-muted' }, '作为本批次调整依据留存')), h('div', { className: 'fp-panel-body' }, h('div', { className: 'fp-logic-line' }, h('span', { className: 'fp-logic-index' }, '01'), h('strong', null, '读取来源'), h('span', null, '上一批次规则预测 + 销售提报 + 实际销量 + 当前父子关系')), h('div', { className: 'fp-logic-line' }, h('span', { className: 'fp-logic-index' }, '02'), h('strong', null, '系统建议'), h('span', null, Math.abs(variance) > 15 ? '优先复核近期趋势、低销量子体和关系变更影响' : '整体偏差在可接受范围内，可优先确认关系并沿用参数')), h('div', { className: 'fp-logic-line' }, h('span', { className: 'fp-logic-index' }, '03'), h('strong', null, 'PMC动作'), h('span', null, '确认后进入本批次参数、关系和拆解调配；每次调整需填写原因'))))
    );
  }
  function ParameterStep({ batch }) {
    const { message } = App.useApp();
    const [values, setValues] = useState(clone(batch.parameterSnapshot));
    const [reason, setReason] = useState('');
    useEffect(() => { setValues(clone(batch.parameterSnapshot)); setReason(''); }, [batch.id, batch.parameterSnapshot.version]);
    const fields = [['historyShareWindow', '历史份额观察周期', '天'], ['recentShareWindow', '近期份额观察周期', '天'], ['historyShareWeight', '历史份额权重', '%'], ['recentShareWeight', '近期份额权重', '%'], ['lowSalesAduThreshold', '低销量 ADU 阈值', ''], ['recentSellingDaysThreshold', '近期有销量天数阈值', '天'], ['trendWindow', '趋势观察周期', '天'], ['seasonIndex', '季节指数', ''], ['listingFactor', 'Listing适配系数', '']];
    const save = () => { if (!reason.trim()) return message.warning('请填写本批次参数调整原因'); try { model.updateParameters(batch.id, values, reason.trim()); setReason(''); message.success('已生成本批次参数快照'); } catch (error) { message.error(error.message); } };
    const fieldNodes = fields.map(([key, label, suffix]) => h('div', { key, className: 'fp-readonly' }, h('div', { className: 'fp-kicker' }, label), h(InputNumber, { value: values[key], min: 0, precision: ['seasonIndex', 'listingFactor', 'lowSalesAduThreshold'].includes(key) ? 2 : 0, addonAfter: suffix || undefined, onChange: value => setValues({ ...values, [key]: value }), style: { width: '100%' }, disabled: batch.status === '已冻结' || batch.status === '已完成' })));
    return h(React.Fragment, null,
      h(Alert, { type: 'info', showIcon: true, message: '系统默认参数只读；本批次执行参数从默认值继承，保存后仅影响当前预测批次，不覆盖历史批次。' }),
      h('div', { className: 'fp-panel' },
        h('div', { className: 'fp-panel-head' }, h('h2', null, '本批次执行参数'), h(Tag, { color: 'blue' }, values.version)),
        h('div', { className: 'fp-panel-body' },
          h('div', { className: 'fp-form-grid' }, fieldNodes),
          h(Divider, { style: { margin: '12px 0' } }),
          h('div', { className: 'fp-kicker' }, '调整原因（必填）'),
          h(Input.TextArea, { value: reason, onChange: event => setReason(event.target.value), rows: 3, maxLength: 200, showCount: true, placeholder: '例如：上一批次低销量子体偏差较大，本批次提高近期份额权重。', disabled: batch.status === '已冻结' || batch.status === '已完成' }),
          h('div', { className: 'fp-sticky-actions' }, h(Button, { type: 'primary', onClick: save, disabled: batch.status === '已冻结' || batch.status === '已完成' }, '保存本批次参数'))
        )
      ),
      h('div', { className: 'fp-panel' },
        h('div', { className: 'fp-panel-head' }, h('h2', null, '变更记录'), h('span', { className: 'fp-muted' }, `${batch.adjustmentLog.filter(item => item.type === '预测参数').length} 条参数调整`)),
        h('div', { className: 'fp-panel-body' }, batch.adjustmentLog.filter(item => item.type === '预测参数').length ? batch.adjustmentLog.filter(item => item.type === '预测参数').map(item => h('div', { key: item.at, className: 'fp-audit-item' }, h('strong', null, `${dateText(item.at)} · ${item.actor}`), h('span', null, item.reason))) : h('div', { className: 'fp-empty' }, '本批次尚未调整参数'))
      )
    );
  }
  function RelationStep({ batch }) {
    const { message, modal } = App.useApp();
    const [query, setQuery] = useState('');
    const [anomaly, setAnomaly] = useState();
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [selected, setSelected] = useState(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyDetail, setHistoryDetail] = useState(null);
    const [addOpen, setAddOpen] = useState(false);
    const [batchOpen, setBatchOpen] = useState(false);
    const previous = model.getBatch(batch.previousBatchId);
    const previousMap = Object.fromEntries((previous?.relationSnapshot || []).map(row => [[row.country, row.store, row.childASIN].join('|'), row]));
    const activeRows = batch.relationSnapshot.map(row => ({ ...row, removed: false }));
    const removedRows = (batch.removedRelations || []).map(row => ({ ...row, parentASIN: null, removed: true }));
    const duplicateKeys = activeRows.reduce((map, row) => { const key = [row.country, row.store, row.childASIN].join('|'); map[key] = (map[key] || 0) + 1; return map; }, {});
    const relationMeta = row => {
      const key = [row.country, row.store, row.childASIN].join('|');
      const old = previousMap[key];
      if (row.removed) return { state: '移除', change: '移除', previousParent: row.previousParentASIN || row.parentASIN || old?.parentASIN };
      if (!row.parentASIN || duplicateKeys[key] > 1) return { state: '异常待处理', change: old ? '父体变更' : '新增', previousParent: old?.parentASIN };
      if (!old) return { state: '新增', change: '新增', previousParent: null };
      if (old.parentASIN !== row.parentASIN) return { state: '父体变更', change: '父体变更', previousParent: old.parentASIN };
      return { state: '正常', change: '无变化', previousParent: old.parentASIN };
    };
    const allRows = [...activeRows, ...removedRows].map((row, index) => ({ ...row, ...relationMeta(row), relationRowKey: row.removed ? `removed-${row.childId}-${index}` : row.childId }));
    const anomalyMatch = row => !anomaly
      || (anomaly === 'unparented' && !row.parentASIN)
      || (anomaly === 'duplicate' && duplicateKeys[[row.country, row.store, row.childASIN].join('|')] > 1)
      || (anomaly === 'orphan-parent' && row.removed)
      || (anomaly === 'changed' && row.change === '父体变更')
      || (anomaly === 'new' && row.change === '新增')
      || (anomaly === 'impact' && row.change !== '无变化');
    const rows = allRows.filter(row => anomalyMatch(row) && (!query || [row.parentASIN, row.previousParent, row.childASIN, row.country, row.store].some(value => String(value || '').toUpperCase().includes(query.trim().toUpperCase()))));
    const counts = {
      parents: new Set(activeRows.map(row => relationKey(row))).size,
      children: activeRows.length,
      unchanged: allRows.filter(row => row.change === '无变化').length,
      added: allRows.filter(row => row.change === '新增').length,
      changed: allRows.filter(row => row.change === '父体变更').length,
      removed: removedRows.length,
      anomalies: allRows.filter(row => row.state === '异常待处理').length
    };
    const affectedParents = new Set(allRows.filter(row => row.change !== '无变化').flatMap(row => [row.previousParent, row.parentASIN]).filter(Boolean)).size;
    const parentOptions = [...new Set([...activeRows.map(row => row.parentASIN), ...(previous?.relationSnapshot || []).map(row => row.parentASIN), 'B0GRGFFVVN', 'B0H4QG3TLS'].filter(Boolean))].map(value => ({ value, label: value }));
    const childOptions = [...activeRows, ...removedRows].reduce((map, row) => { if (!map.has(row.childId)) map.set(row.childId, { value: row.childId, label: `${row.childASIN} · ${row.country}` }); return map; }, new Map());
    const history = selected ? model.list().flatMap(item => {
      const relation = item.relationSnapshot.find(row => row.childASIN === selected.childASIN && row.country === selected.country);
      const removed = (item.removedRelations || []).find(row => row.childASIN === selected.childASIN && row.country === selected.country);
      const matched = relation || removed;
      if (!matched) return [];
      const result = item.resultSnapshots.find(snapshot => snapshot.version === item.activeResultVersion) || item.resultSnapshots.at(-1);
      const resultRow = result?.rows.find(row => row.childASIN === selected.childASIN && row.country === selected.country);
      const parent = result?.parents.find(row => row.key === [matched.country, matched.store, resultRow?.parentASIN || matched.parentASIN].join('|'));
      return [{ batchId: item.id, batch: item.batchDate, version: item.relationVersion, resultVersion: result?.version, parent: relation?.parentASIN || '—', state: item.id === batch.id ? '当前' : '历史', change: relation ? relationMeta({ ...relation, removed: false }).change : '移除', share: resultRow?.finalShare || 0, childTotal: resultRow?.total || 0, parentTotal: parent?.total || 0 }];
    }) : [];
    const openHistory = row => { setSelected(row); setHistoryDetail(null); setHistoryOpen(true); };
    const inherit = () => modal.confirm({
      title: '沿用上一版本关系',
      content: h(Descriptions, { size: 'small', column: 1, items: [{ key: 'tip', label: '说明', children: '将上一关系版本中的有效关系复制为本批次关系快照。' }, { key: 'count', label: '沿用关系', children: `${previous?.relationSnapshot.length || 0} 条` }, { key: 'change', label: '变更', children: '0 条' }] }),
      okText: '确认沿用', cancelText: '取消',
      onOk: () => { try { model.inheritPreviousRelations(batch.id); setSelectedKeys([]); message.success('已沿用上一关系版本'); } catch (error) { message.error(error.message); } }
    });
    const remove = () => {
      if (!selectedKeys.length) return message.warning('请先选择需要移除的关系');
      modal.confirm({ title: `移除 ${selectedKeys.length} 条本批次关系？`, content: '只从本批次关系快照移除，历史关系版本保持不变。', okText: '确认移除', cancelText: '取消', okButtonProps: { danger: true }, onOk: () => { try { model.removeRelations(batch.id, selectedKeys, '本批次关系清理'); setSelectedKeys([]); message.success('关系已从本批次移除'); } catch (error) { message.error(error.message); } } });
    };
    const confirmRelations = () => { try { model.confirmRelations(batch.id); message.success('本批次关系已确认，历史销量将按当前关系重新归集'); } catch (error) { message.error(error.message); } };
    const columns = [
      { title: '国家', dataIndex: 'country', width: 76 },
      { title: '子ASIN', dataIndex: 'childASIN', width: 145, render: (value, row) => h(Button, { type: 'link', className: 'fp-link', onClick: () => openHistory(row) }, value) },
      { title: '当前父ASIN', dataIndex: 'parentASIN', width: 145, render: value => value || '—' },
      { title: '上一版本父ASIN', dataIndex: 'previousParent', width: 150, render: value => value || '—' },
      { title: '关系状态', dataIndex: 'state', width: 116, render: value => h(Tag, { color: value === '异常待处理' ? 'error' : ['新增', '父体变更', '移除'].includes(value) ? 'warning' : 'default' }, value) },
      { title: '变更类型', dataIndex: 'change', width: 110 },
      { title: '操作', width: 84, fixed: 'right', render: (_, row) => h(Button, { type: 'link', onClick: () => openHistory(row) }, '查看') }
    ];
    return h(React.Fragment, null,
      h(Alert, { type: counts.changed || counts.added || counts.removed ? 'warning' : 'info', showIcon: true, message: counts.changed || counts.added || counts.removed ? '关系发生变更，受影响父ASIN将重新归集历史销量并重新计算预测。' : '本批次父子关系', description: `本批次预测按当前国家 + 子ASIN关系重新归集历史销量。系统检测到 ${counts.changed + counts.added + counts.removed} 条关系变化，影响 ${affectedParents} 个父ASIN；请优先确认后再进入子体拆解。` }),
      h(MetricStrip, { items: [{ label: '父ASIN', value: number(counts.parents) }, { label: '子ASIN', value: number(counts.children) }, { label: '沿用上一版本', value: number(counts.unchanged) }, { label: '新增关系', value: number(counts.added) }, { label: '父体变更', value: number(counts.changed) }, { label: '移除关系', value: number(counts.removed) }, { label: '待处理异常', value: number(counts.anomalies), tone: counts.anomalies ? 'warning' : 'success' }] }),
      (counts.changed > 0) && h('div', { className: 'fp-impact-note' }, h('strong', null, '历史销量归集变化'), h('span', null, `${allRows.find(row => row.change === '父体变更')?.childASIN || '变更子ASIN'} 历史销量 → 本批次重新归集至 ${allRows.find(row => row.change === '父体变更')?.parentASIN || '当前父ASIN'}。历史批次快照不回写。`)),
      h(PlanListPanel, {
        title: '本批次父子关系', meta: h(Tag, null, `${rows.length} 条`),
        search: h(Space, { wrap: true }, h(Input.Search, { allowClear: true, placeholder: '父ASIN / 子ASIN / 国家 / 店铺', onSearch: setQuery, style: { width: 280 } }), h(Select, { allowClear: true, placeholder: '关系异常', value: anomaly, onChange: setAnomaly, style: { width: 190 }, options: [{ value: 'unparented', label: '子ASIN无父ASIN' }, { value: 'duplicate', label: '一个子ASIN多个父ASIN' }, { value: 'orphan-parent', label: '父ASIN无子ASIN' }, { value: 'changed', label: '关系发生变更' }, { value: 'new', label: '新增关系未确认' }, { value: 'impact', label: '关系影响预测结果' }] })),
        toolbar: h(Space, { wrap: true }, h(Button, { onClick: inherit }, '沿用上一版本'), h(Button, { type: 'primary', onClick: () => setAddOpen(true) }, '新增关系'), h(Button, { onClick: () => selectedKeys.length ? setBatchOpen(true) : message.warning('请先选择需要批量调整的子ASIN') }, '批量调整'), h(Button, { onClick: () => setAnomaly(anomaly ? undefined : 'impact') }, '关系异常'), h(Button, { danger: true, disabled: !selectedKeys.length, onClick: remove }, '移除关系'), h(Button, { onClick: confirmRelations, disabled: counts.anomalies > 0 }, batch.relationConfirmed ? '关系已确认' : '确认本批次关系'))
      }, h(PlanTable, { rowKey: 'relationRowKey', dataSource: rows, columns, pagination: { defaultPageSize: 20 }, rowSelection: { selectedRowKeys: selectedKeys, onChange: setSelectedKeys, getCheckboxProps: row => ({ disabled: row.removed }) }, onRow: row => ({ onDoubleClick: () => openHistory(row) }) })),
      h(Drawer, { open: historyOpen, width: 620, title: `${selected?.childASIN || ''} · 父ASIN关系历史`, onClose: () => setHistoryOpen(false), destroyOnClose: true }, selected && h(React.Fragment, null,
        h(Descriptions, { size: 'small', column: 1, items: [{ key: 'current', label: '当前关系', children: `${selected.country} · ${selected.childASIN} → ${selected.parentASIN || '已移除'}` }, { key: 'version', label: '关系版本', children: batch.relationVersion }] }),
        h(Divider, { style: { margin: '14px 0' } }),
        h(PlanTable, { rowKey: row => `${row.batchId}-${row.version}`, dataSource: history, pagination: false, columns: [{ title: '预测批次', dataIndex: 'batch', width: 112, render: (value, row) => h(Button, { type: 'link', onClick: () => setHistoryDetail(row) }, dayText(value)) }, { title: '关系版本', dataIndex: 'version', width: 150 }, { title: '父ASIN', dataIndex: 'parent', width: 135 }, { title: '生效状态', dataIndex: 'state', width: 86, render: value => h(Tag, null, value) }, { title: '变更', dataIndex: 'change', width: 95 }] }),
        historyDetail && h('div', { className: 'fp-history-detail' }, h('strong', null, `${dayText(historyDetail.batch)} 批次计算结果`), h(Descriptions, { size: 'small', column: 2, items: [{ key: 'rel', label: '关系版本', children: historyDetail.version }, { key: 'result', label: '结果版本', children: historyDetail.resultVersion || '未生成' }, { key: 'parent', label: '父ASIN预测', children: number(historyDetail.parentTotal) }, { key: 'share', label: '最终份额', children: percent(historyDetail.share) }, { key: 'child', label: '子ASIN预测', children: number(historyDetail.childTotal) }] }))
      )),
      h(Drawer, { open: addOpen, width: 520, title: '新增父子关系', onClose: () => setAddOpen(false), destroyOnClose: true }, h(RelationAddForm, { batch, parentOptions, childOptions: [...childOptions.values()], onCancel: () => setAddOpen(false), onSubmit: values => { try { model.upsertRelations(batch.id, values); setAddOpen(false); message.success('本批次关系已保存，历史版本未覆盖'); } catch (error) { message.error(error.message); } } })),
      h(Drawer, { open: batchOpen, width: 620, title: '批量调整关系', onClose: () => setBatchOpen(false), destroyOnClose: true }, h(RelationBatchForm, { rows: activeRows.filter(row => selectedKeys.includes(row.childId)), parentOptions, onCancel: () => setBatchOpen(false), onSubmit: values => { try { model.batchAdjustRelations(batch.id, selectedKeys, values.targetParent, values.reason); setBatchOpen(false); setSelectedKeys([]); message.success('批量关系变更已写入本批次版本'); } catch (error) { message.error(error.message); } } }))
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
  function RelationBatchForm({ rows, parentOptions, onSubmit, onCancel }) {
    const [form] = Form.useForm();
    const [fileName, setFileName] = useState('');
    const target = Form.useWatch('targetParent', form);
    return h(Form, { form, layout: 'vertical', initialValues: { reason: '批量调整本批次父子关系' }, onFinish: onSubmit },
      h(Alert, { type: 'info', showIcon: true, message: '先预览变更，确认后才写入本批次关系版本。', style: { marginBottom: 14 } }),
      h(Space, { style: { marginBottom: 14 } }, h(Upload, { accept: '.xlsx,.xls,.csv', maxCount: 1, showUploadList: false, beforeUpload: file => { setFileName(file.name); return false; } }, h(Button, { icon: h(icon.UploadOutlined) }, 'Excel导入')), fileName && h(Tag, null, fileName), h(Tag, null, `已批量选择 ${rows.length} 条`)),
      h(Form.Item, { name: 'targetParent', label: '新父ASIN', rules: [{ required: true, message: '请选择新父ASIN' }] }, h(Select, { showSearch: true, options: parentOptions })),
      h(PlanTable, { rowKey: 'childId', dataSource: rows, pagination: false, columns: [{ title: '国家', dataIndex: 'country', width: 72 }, { title: '子ASIN', dataIndex: 'childASIN', width: 145 }, { title: '原父ASIN', dataIndex: 'parentASIN', width: 145 }, { title: '新父ASIN', width: 145, render: () => target || '待选择' }] }),
      h(Form.Item, { name: 'reason', label: '变更原因', rules: [{ required: true, whitespace: true }] }, h(Input.TextArea, { rows: 3, maxLength: 200, showCount: true })),
      h('div', { className: 'fp-sticky-actions' }, h(Button, { onClick: onCancel }, '取消'), h(Button, { type: 'primary', htmlType: 'submit' }, '确认写入本批次'))
    );
  }
  function RuleChain({ rule }) {
    const nodes = [['父ASIN预测总量', '本批次父体预测池'], ['系统计算子体份额', `${rule.historyWindow}天历史 + ${rule.recentWindow}天近期`], ['PMC人工调配', rule.manualAllowed ? '允许调整并记录原因' : '不允许'], ['最终份额', '同一父ASIN归一化至100%'], ['子ASIN预测量', '父体预测 × 最终份额']];
    return h('div', { className: 'fp-chain' }, nodes.map(([title, value]) => h('div', { className: 'fp-chain-node', key: title }, h('span', null, title), h('strong', null, value))));
  }
  function SplitStep({ batch }) {
    const { message } = App.useApp();
    const parentOptions = [...new Set(batch.childForecastResults.map(row => relationKey(row)))];
    const [selectedParent, setSelectedParent] = useState(parentOptions[0]);
    const siblings = batch.childForecastResults.filter(row => relationKey(row) === selectedParent);
    const [shares, setShares] = useState({});
    const [lastEdited, setLastEdited] = useState(null);
    const [reasonCategory, setReasonCategory] = useState();
    const [reasonNote, setReasonNote] = useState('');
    const [ruleOpen, setRuleOpen] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    useEffect(() => { if (parentOptions.length && !parentOptions.includes(selectedParent)) setSelectedParent(parentOptions[0]); }, [batch.id, parentOptions.join('|')]);
    useEffect(() => { setShares(Object.fromEntries(siblings.map(row => [row.childASIN, Number((row.finalShare / 100).toFixed(2))]))); setLastEdited(null); }, [batch.id, selectedParent, siblings.map(row => row.finalShare).join(',')]);
    const updateFinal = (childASIN, value) => {
      const nextValue = Math.max(0, Math.min(100, Number(value) || 0));
      setShares(current => ({ ...current, [childASIN]: nextValue }));
      setLastEdited(childASIN);
    };
    const updateDelta = (row, value) => updateFinal(row.childASIN, row.systemShare / 100 + (Number(value) || 0));
    const allocateRemaining = () => {
      if (!lastEdited) return message.info('请先调整一个子ASIN，再分配剩余份额');
      const locked = Number(shares[lastEdited]) || 0;
      const others = siblings.filter(row => row.childASIN !== lastEdited);
      const remainder = 100 - locked;
      const systemTotal = others.reduce((total, row) => total + row.systemShare, 0);
      const next = { ...shares, [lastEdited]: locked };
      others.forEach(row => { next[row.childASIN] = Number((systemTotal ? remainder * row.systemShare / systemTotal : remainder / Math.max(1, others.length)).toFixed(2)); });
      const drift = Number((100 - Object.values(next).reduce((total, value) => total + Number(value || 0), 0)).toFixed(2));
      if (others.at(-1)) next[others.at(-1).childASIN] = Number((next[others.at(-1).childASIN] + drift).toFixed(2));
      setShares(next);
      message.success('剩余份额已按其他子体系统份额比例重新分配');
    };
    const rawTotal = Object.values(shares).reduce((a, b) => a + (Number(b) || 0), 0);
    const total = Number(rawTotal.toFixed(2));
    const sharesValid = Math.abs(rawTotal - 100) < 0.005;
    const reason = reasonCategory === '其他' ? reasonNote.trim() : [reasonCategory, reasonNote.trim()].filter(Boolean).join('：');
    const save = () => {
      if (!sharesValid) return message.error('当前父ASIN下最终份额必须合计100%');
      if (!reasonCategory) return message.warning('请选择人工调配原因');
      if (reasonCategory === '其他' && !reasonNote.trim()) return message.warning('选择“其他”时必须填写具体原因');
      const basisPointShares = Object.fromEntries(Object.entries(shares).map(([childASIN, value]) => [childASIN, Math.round((Number(value) || 0) * 100)]));
      try { model.adjustShares(batch.id, selectedParent, basisPointShares, reason); setReasonCategory(undefined); setReasonNote(''); message.success('本批次子ASIN份额已保存并记录调整原因'); } catch (error) { message.error(error.message); }
    };
    const parent = batch.parentForecastResults.find(row => row.key === selectedParent);
    const previewTotal = row => {
      const inputShare = Number(shares[row.childASIN]) || 0;
      const savedShare = row.finalShare / 100;
      if (Math.abs(inputShare - savedShare) < 0.005) return Object.values(row.dailyFinalForecast).reduce((sum, value) => sum + (Number(value) || 0), 0);
      return Math.round((parent?.total || 0) * inputShare / 100);
    };
    const childPreviewTotal = siblings.reduce((value, row) => value + previewTotal(row), 0);
    const difference = childPreviewTotal - Number(parent?.total || 0);
    const basis = row => h('div', { className: 'fp-basis-popover' },
      h(Descriptions, { size: 'small', column: 1, items: [{ key: 'sales', label: '84天Clean销量', children: number(row.history84Sales) }, { key: 'history', label: '84天历史份额', children: percent(row.history84Share) }, { key: 'adu', label: '14天Clean ADU', children: row.recentCleanAdu }, { key: 'days', label: '14天有销量天数', children: `${row.recentSellingDays}天` }, { key: 'judge', label: '判定', children: row.splitJudgement }] }),
      h('div', { className: 'fp-formula' }, row.splitJudgement === '低销量/不稳定' ? `70% × ${percent(row.history84Share)} + 30% × ${percent(row.recent14Share)}，归一化后 ${percent(row.systemShare)}` : `100% × ${percent(row.history84Share)}，归一化后 ${percent(row.systemShare)}`),
      h('div', { className: 'fp-help' }, '系统份额只是父ASIN预测向子ASIN拆解的建议比例，不等于最终预测。')
    );
    const shareColumns = [
      { title: '子ASIN', dataIndex: 'childASIN', width: 145 },
      { title: '84天销量', dataIndex: 'history84Sales', width: 98, render: number },
      { title: '84天份额', dataIndex: 'history84Share', width: 98, render: percent },
      { title: '14天Clean份额', dataIndex: 'recent14Share', width: 118, render: percent },
      { title: '匹配规则', width: 142, render: (_, row) => h(Tag, { color: row.splitJudgement === '低销量/不稳定' ? 'warning' : 'default' }, row.splitJudgement) },
      { title: '系统份额', width: 112, render: (_, row) => h(Space, { size: 4 }, h('span', null, percent(row.systemShare)), h(Popover, { trigger: 'click', title: '系统份额计算依据', content: basis(row), placement: 'left' }, h(Button, { type: 'link', size: 'small' }, '依据'))) },
      { title: 'PMC调整', width: 126, render: (_, row) => h(InputNumber, { min: -100, max: 100, precision: 2, value: Number((Number(shares[row.childASIN] || 0) - row.systemShare / 100).toFixed(2)), addonAfter: '%', onChange: value => updateDelta(row, value), disabled: batch.status === '已冻结' || batch.status === '已完成', style: { width: 116 } }) },
      { title: '最终份额', width: 132, render: (_, row) => h('div', null, h(InputNumber, { min: 0, max: 100, precision: 2, value: shares[row.childASIN], addonAfter: '%', onChange: value => updateFinal(row.childASIN, value), disabled: batch.status === '已冻结' || batch.status === '已完成', style: { width: 118 } }), Math.abs(Number(shares[row.childASIN] || 0) - row.systemShare / 100) > 0.005 && h(Tag, { color: 'gold', className: 'fp-manual-tag' }, `人工 ${Number(shares[row.childASIN] || 0) - row.systemShare / 100 > 0 ? '+' : ''}${(Number(shares[row.childASIN] || 0) - row.systemShare / 100).toFixed(2)}%`)) },
      { title: '最终预测', width: 112, render: (_, row) => h('strong', null, number(previewTotal(row))) }
    ];
    const summary = h(Descriptions, { size: 'small', column: 4, items: [
      { key: 'parent', label: '父ASIN', children: parent?.parentASIN },
      { key: 'total', label: '父ASIN预测总量', children: `${number(parent?.total)} 件` },
      { key: 'current', label: '当前子体数', children: `${siblings.length} 个` },
      { key: 'sum', label: '最终份额合计', children: h(Tag, { color: sharesValid ? 'success' : 'error' }, `${total.toFixed(2)}%`) },
      { key: 'childTotal', label: '子体拆解', children: number(childPreviewTotal) },
      { key: 'difference', label: '差额', children: number(difference) },
      { key: 'balance', label: '状态', children: h(Tag, { color: sharesValid && difference === 0 ? 'success' : 'error' }, sharesValid && difference === 0 ? '已平衡' : '子体拆解未平衡') }
    ] });
    const ruleColumns = [{ title: '规则名称', dataIndex: 'name', width: 170 }, { title: '适用条件', dataIndex: 'conditionText', width: 260 }, { title: '历史观察周期', dataIndex: 'historyWindow', width: 110, render: value => `${value}天` }, { title: '近期观察周期', dataIndex: 'recentWindow', width: 110, render: value => `${value}天` }, { title: '历史权重', dataIndex: 'historyWeight', width: 92, render: value => `${value}%` }, { title: '近期权重', dataIndex: 'recentWeight', width: 92, render: value => `${value}%` }, { title: '状态', dataIndex: 'status', width: 78, render: value => h(Tag, { color: value === '启用' ? 'success' : 'default' }, value) }, { title: '适用范围', dataIndex: 'scope', width: 160 }, { title: '操作', width: 76, fixed: 'right', render: (_, row) => h(Button, { type: 'link', onClick: () => { setEditingRule(row); setRuleOpen(true); } }, '配置') }];
    const confirmSplit = () => { try { model.confirmSplit(batch.id); message.success('本批次子体拆解已确认'); } catch (error) { message.error(error.message); } };
    return h(React.Fragment, null,
      h(Alert, { type: batch.relationConfirmed ? 'info' : 'warning', showIcon: true, message: batch.relationConfirmed ? '系统按84天/14天数据计算建议份额，不自动覆盖PMC人工判断。' : '请先确认本批次父子关系，再进行子体拆解。', description: '关系回答“谁属于谁”，拆解回答“父ASIN预测总量如何分给当前子ASIN”；关系版本与拆解规则版本独立保存。' }),
      h(RuleChain, { rule: batch.splitRuleSnapshot }),
      h('div', { className: 'fp-rule-summary' }, [['系统默认规则', '84天历史份额'], ['低销量 / 不稳定子体', '启用14天近期份额修正'], ['历史 / 近期权重', '70% / 30%'], ['低销量ADU阈值', '< 2'], ['近期有销量天数', '≤ 10天'], ['拆解规则版本', batch.splitRuleSnapshot.version]].map(([label, value]) => h('div', { key: label }, h('label', null, label), h('strong', null, value)))),
      h(PlanListPanel, { title: '拆解规则配置', meta: h(Button, { type: 'primary', onClick: () => { setEditingRule(null); setRuleOpen(true); } }, '新增规则模板') }, h(PlanTable, { rowKey: 'id', dataSource: batch.splitRuleTemplates, columns: ruleColumns, pagination: false })),
      h('div', { className: 'fp-panel' },
        h('div', { className: 'fp-panel-head' },
          h('h2', null, '本批次子ASIN份额调配'),
          h(Space, null,
            h(Select, { value: selectedParent, options: parentOptions.map(value => ({ value, label: `${value.split('|')[0]} · ${value.split('|')[2]}` })), onChange: setSelectedParent, style: { width: 250 }, 'aria-label': '选择父ASIN预测池' }),
            h(Button, { onClick: allocateRemaining }, '按系统份额分配剩余')
          )
        ),
        h('div', { className: 'fp-panel-body' },
          summary,
          h('div', { className: 'fp-table-wrap' }, h(PlanTable, { rowKey: 'childASIN', dataSource: siblings, columns: shareColumns })),
          !sharesValid && h(Alert, { type: 'error', showIcon: true, message: `最终份额合计为${total.toFixed(2)}%，请调整后再保存。`, style: { marginTop: 12 } }),
          h('div', { className: 'fp-adjust-reason' }, h('div', null, h('div', { className: 'fp-kicker' }, '调整原因（必填）'), h(Select, { value: reasonCategory, onChange: setReasonCategory, placeholder: '请选择', style: { width: '100%' }, options: ['尺码需求变化', '近期销售趋势变化', '新品策略', '库存风险', '业务判断', '其他'].map(value => ({ value, label: value })) })), h('div', null, h('div', { className: 'fp-kicker' }, reasonCategory === '其他' ? '具体原因（必填）' : '补充说明'), h(Input, { value: reasonNote, onChange: event => setReasonNote(event.target.value), maxLength: 100, placeholder: '选填；选择“其他”时必填' }))),
          h('div', { className: 'fp-sticky-actions' }, h('span', { className: 'fp-help' }, `父ASIN预测 ${number(parent?.total)} · 子体拆解 ${number(childPreviewTotal)} · 差额 ${number(difference)}`), h(Button, { onClick: confirmSplit, disabled: !batch.relationConfirmed || !sharesValid || difference !== 0 }, '确认子体拆解'), h(Button, { type: 'primary', onClick: save, disabled: !batch.relationConfirmed || batch.status === '已冻结' || batch.status === '已完成' }, '保存人工调配'))
        )
      ),
      h(Drawer, { open: ruleOpen, width: 560, title: editingRule ? `配置拆解规则 · ${editingRule.name}` : '新增拆解规则模板', onClose: () => setRuleOpen(false), destroyOnClose: true }, h(SplitRuleForm, { rule: editingRule, onCancel: () => setRuleOpen(false), onSubmit: values => { if (Number(values.historyWeight) + Number(values.recentWeight) !== 100) return message.error('历史权重与近期权重合计必须为100%'); try { model.saveSplitRule(batch.id, { ...editingRule, ...values }); setRuleOpen(false); message.success('拆解规则模板已保存并生成新版本'); } catch (error) { message.error(error.message); } } }))
    );
  }
  function SplitRuleForm({ rule, onSubmit, onCancel }) {
    const [form] = Form.useForm();
    return h(Form, { form, layout: 'vertical', initialValues: rule || { name: '', scope: '全部国家与父ASIN', conditionText: '国家 = US AND 商品标签 = 正常销售', historyWindow: 84, recentWindow: 14, historyWeight: 70, recentWeight: 30, status: '启用', priority: 50 }, onFinish: onSubmit },
      h(Form.Item, { name: 'name', label: '规则名称', rules: [{ required: true, whitespace: true }] }, h(Input)),
      h(Form.Item, { name: 'scope', label: '适用范围', rules: [{ required: true }] }, h(Input, { placeholder: '例如：US · 正常销售商品' })),
      h(Form.Item, { name: 'conditionText', label: '适用条件', rules: [{ required: true }] }, h(Input.TextArea, { rows: 3, placeholder: '国家 = US AND 14天Clean ADU < 2 AND 14天有销量天数 ≤ 10' })),
      h('div', { className: 'fp-form-grid' }, [['historyWindow', '历史观察周期'], ['recentWindow', '近期观察周期'], ['historyWeight', '历史权重'], ['recentWeight', '近期权重'], ['priority', '优先级']].map(([name, label]) => h(Form.Item, { key: name, name, label, rules: [{ required: true }] }, h(InputNumber, { min: 0, max: name.includes('Weight') ? 100 : 365, addonAfter: name.includes('Weight') ? '%' : name.includes('Window') ? '天' : undefined, style: { width: '100%' } })))),
      h(Form.Item, { name: 'status', label: '状态', rules: [{ required: true }] }, h(Select, { options: [{ value: '启用', label: '启用' }, { value: '停用', label: '停用' }] })),
      h(Alert, { type: 'info', showIcon: true, message: '规则模板只包含适用条件、参数和执行结果，不提供流程编排或公式脚本。' }),
      h('div', { className: 'fp-sticky-actions' }, h(Button, { onClick: onCancel }, '取消'), h(Button, { type: 'primary', htmlType: 'submit' }, '保存规则模板'))
    );
  }
  function ForecastStep({ batch, onStep }) {
    const { message } = App.useApp();
    const validation = model.validateForecast(batch.id);
    const activeSnapshot = batch.resultSnapshots.find(snapshot => snapshot.version === batch.activeResultVersion) || null;
    const showingSnapshot = batch.resultState === '已生成' && activeSnapshot;
    const sourceRows = showingSnapshot ? activeSnapshot.rows : batch.childForecastResults;
    const sourceParents = showingSnapshot ? activeSnapshot.parents : batch.parentForecastResults;
    const [generation, setGeneration] = useState(null);
    const timerRef = useRef(null);
    useEffect(() => () => clearInterval(timerRef.current), []);
    const generationSteps = ['读取本批次父子关系', '按当前关系重新归集历史销量', '计算父ASIN预测', '应用拆解规则', '应用PMC人工调配', '校验父子预测平衡', '生成规则预测快照'];
    const rows = sourceRows.map(source => {
      const live = batch.childForecastResults.find(row => row.childId === source.childId) || source;
      const dailyFinalForecast = source.daily || live.dailyFinalForecast;
      const dailyRuleForecast = source.ruleDaily || live.dailyRuleForecast;
      const parent = sourceParents.find(item => item.key === relationKey(source));
      return { ...live, ...source, id: childForecastKey(source), parentTotal: parent?.total || 0, dailyFinalForecast, dailyRuleForecast, finalTotal: source.total ?? Object.values(dailyFinalForecast).reduce((a, b) => a + (Number(b) || 0), 0), ruleTotal: Object.values(dailyRuleForecast).reduce((a, b) => a + (Number(b) || 0), 0) };
    });
    const startGenerate = () => {
      if (!validation?.passed) return message.error('生成前校验未通过，请先处理异常');
      clearInterval(timerRef.current);
      let index = 0;
      setGeneration({ index, percent: 8, done: false });
      timerRef.current = setInterval(() => {
        index += 1;
        if (index < generationSteps.length) return setGeneration({ index, percent: Math.round((index + 1) / generationSteps.length * 92), done: false });
        clearInterval(timerRef.current);
        try {
          model.generateForecast(batch.id, batch.resultSnapshots.length ? '关系或拆解变更后重新生成' : '首次生成本批次规则预测');
          setGeneration({ index: generationSteps.length - 1, percent: 100, done: true });
          message.success('规则预测生成完成，已形成新的结果快照');
        } catch (error) {
          setGeneration(null);
          message.error(error.message);
        }
      }, 260);
    };
    const processException = () => onStep(validation?.items.some(item => !item.passed && item.label.includes('关系')) ? 'relations' : 'split');
    const columns = [
      { title: '国家', dataIndex: 'country', width: 72 },
      { title: '父ASIN', dataIndex: 'parentASIN', width: 140 },
      { title: '子ASIN', dataIndex: 'childASIN', width: 145 },
      { title: '父ASIN预测', dataIndex: 'parentTotal', width: 118, render: number },
      { title: '系统份额', dataIndex: 'systemShare', width: 96, render: percent },
      { title: 'PMC调整', dataIndex: 'manualAdjustment', width: 96, render: value => h('span', { className: value ? 'fp-highlight' : 'fp-muted' }, `${value > 0 ? '+' : ''}${percent(value)}`) },
      { title: '最终份额', dataIndex: 'finalShare', width: 96, render: (value, row) => h(Space, { size: 4 }, h('strong', null, percent(value)), row.manualAdjustment ? h(Tag, { color: 'gold' }, '人工调整') : null) },
      { title: '子ASIN规则预测', dataIndex: 'finalTotal', width: 140, render: value => h('strong', null, number(value)) }
    ];
    const expandedRowRender = row => h('div', { className: 'fp-forecast-calc' },
      h('div', { className: 'fp-calc-chain' }, h('div', null, h('span', null, '父ASIN预测'), h('strong', null, number(row.parentTotal))), h('b', null, '×'), h('div', null, h('span', null, '最终拆解份额'), h('strong', null, percent(row.finalShare))), h('b', null, '='), h('div', null, h('span', null, '子ASIN规则预测'), h('strong', null, number(row.finalTotal)))),
      h(PlanTable, { rowKey: 'date', pagination: { defaultPageSize: 7, pageSizeOptions: [7, 14, 30, 60], showSizeChanger: true }, dataSource: Object.entries(row.dailyFinalForecast).map(([date, value]) => ({ date, parent: sourceParents.find(item => item.key === relationKey(row))?.daily?.[date] || 0, share: row.finalShare, value })), columns: [{ title: '预测日期', dataIndex: 'date', width: 110, render: dayText }, { title: '父ASIN日预测', dataIndex: 'parent', width: 130, render: number }, { title: '最终份额', dataIndex: 'share', width: 100, render: percent }, { title: '子ASIN规则预测', dataIndex: 'value', width: 140, render: value => h('strong', null, number(value)) }] })
    );
    const latest = batch.resultSnapshots.at(-1);
    return h(React.Fragment, null,
      h(Alert, { type: batch.resultState === '需重新生成' ? 'warning' : batch.resultState === '已生成' ? 'success' : 'info', showIcon: true, message: batch.resultState === '需重新生成' ? `当前关系或拆解已变更，${batch.activeResultVersion} 仍保留且销售继续读取该快照；重新生成后将创建新版本。` : batch.resultState === '已生成' ? `规则预测已生成：${batch.activeResultVersion}` : '完成关系与拆解确认后，生成本批次规则预测快照。' }),
      h(MetricStrip, { items: [{ label: '数据截点', value: dayText(batch.dataCutoffDate) }, { label: '预测周期', value: `${dayText(batch.forecastStartDate)} ~ ${dayText(batch.forecastEndDate)}` }, { label: '父ASIN', value: `${batch.parentForecastResults.length} 个` }, { label: '子ASIN', value: `${batch.childForecastResults.length} 个` }, { label: '状态', value: batch.resultState, tone: batch.resultState === '已生成' ? 'success' : batch.resultState === '需重新生成' ? 'warning' : '' }, { label: '结果版本', value: batch.activeResultVersion || '待生成' }] }),
      h('div', { className: 'fp-panel' }, h('div', { className: 'fp-panel-head' }, h('h2', null, '生成前校验'), h(Tag, { color: validation?.passed ? 'success' : 'error' }, validation?.passed ? '全部通过' : '存在阻断项')), h('div', { className: 'fp-panel-body' },
        h('div', { className: 'fp-validation-grid' }, (validation?.items || []).map(item => h('div', { key: item.label, className: item.passed ? 'pass' : 'fail' }, h('span', null, item.passed ? '✓' : '!'), h('strong', null, item.label), h('em', null, item.passed ? '通过' : `${item.count} 项`)))),
        generation && h('div', { className: 'fp-generation' }, h(Progress, { percent: generation.percent, status: generation.done ? 'success' : 'active', size: 'small' }), h('div', { className: 'fp-generation-steps' }, generationSteps.map((label, index) => h('span', { key: label, className: index < generation.index || generation.done ? 'done' : index === generation.index ? 'active' : '' }, `${index + 1}. ${label}`))), generation.done && h(Alert, { type: 'success', showIcon: true, message: '规则预测生成完成', description: `生成版本：${batch.activeResultVersion || latest?.version || ''} · 生成时间：${dateText(batch.resultSnapshots.at(-1)?.generatedAt || new Date().toISOString())}` })),
        h('div', { className: 'fp-sticky-actions' }, validation?.passed ? h(Button, { type: 'primary', loading: generation && !generation.done, onClick: startGenerate, disabled: batch.status === '已冻结' || batch.status === '已完成' }, batch.resultSnapshots.length ? '重新生成本批次规则预测' : '生成本批次规则预测') : h(Button, { type: 'primary', danger: true, onClick: processException }, '处理异常'))
      )),
      h(PlanListPanel, {
        title: showingSnapshot ? `规则预测结果 · ${activeSnapshot.version}` : '待生成结果预览',
        meta: h('span', { className: 'fp-muted' }, showingSnapshot ? `生成时间 ${dateText(activeSnapshot.generatedAt)}` : '当前草稿不会覆盖已生成快照')
      }, h(PlanTable, { rowKey: 'id', dataSource: rows, columns, expandable: { expandedRowRender } })),
      batch.resultSnapshots.length > 0 && h(PlanListPanel, { title: '结果版本记录', meta: h('span', { className: 'fp-muted' }, '历史快照不可覆盖') }, h(PlanTable, { rowKey: 'version', pagination: false, dataSource: batch.resultSnapshots.slice().reverse(), columns: [{ title: '结果版本', dataIndex: 'version', width: 170, render: value => h(Space, null, h('strong', null, value), value === batch.activeResultVersion && h(Tag, { color: 'success' }, '当前')) }, { title: '生成时间', dataIndex: 'generatedAt', width: 150, render: dateText }, { title: '关系版本', dataIndex: 'relationVersion', width: 160 }, { title: '拆解规则版本', dataIndex: 'splitRuleVersion', width: 160 }, { title: '父ASIN预测', dataIndex: 'parentTotal', width: 120, render: number }, { title: '子ASIN预测', dataIndex: 'childTotal', width: 120, render: number }] }))
    );
  }
  function WindowStep({ batch }) {
    const { message, modal } = App.useApp();
    const toInput = value => String(value || '').slice(0, 16);
    const [values, setValues] = useState({ start: toInput(batch.submissionWindow.submissionStartTime), deadline: toInput(batch.submissionWindow.submissionDeadlineTime), freeze: toInput(batch.submissionWindow.submissionFreezeTime) });
    useEffect(() => setValues({ start: toInput(batch.submissionWindow.submissionStartTime), deadline: toInput(batch.submissionWindow.submissionDeadlineTime), freeze: toInput(batch.submissionWindow.submissionFreezeTime) }), [batch.id, batch.submissionWindow.submissionStartTime]);
    const save = () => { try { const normalize = value => `${value}:00+08:00`; model.publishWindow(batch.id, { submissionStartTime: normalize(values.start), submissionDeadlineTime: normalize(values.deadline), submissionFreezeTime: normalize(values.freeze) }); message.success('销售填报窗口已绑定到本批次'); } catch (error) { message.error(error.message); } };
    const freeze = () => modal.confirm({ title: '冻结本批次销售预测？', content: '冻结后本批次关系、规则、参数和销售提报快照均只读，后续调整需要创建下一批次。', okText: '确认冻结', cancelText: '取消', onOk: () => { try { model.freeze(batch.id); message.success('本批次已冻结'); } catch (error) { message.error(error.message); } } });
    const disabled = batch.status === '已冻结' || batch.status === '已完成';
    const canPublish = batch.resultState === '已生成' && Boolean(batch.activeResultVersion);
    return h(React.Fragment, null,
      h(Alert, { type: canPublish ? 'success' : 'warning', showIcon: true, message: canPublish ? `规则预测 ${batch.activeResultVersion} 已生成，可发布销售填报窗口。` : '请先完成规则预测生成。', description: '发布后销售页面只消费已生成的子ASIN规则预测清单，不参与父子关系或拆解计算。' }),
      h(MetricStrip, { items: [{ label: '规则预测', value: canPublish ? '已生成' : '待生成', tone: canPublish ? 'success' : 'warning' }, { label: '预测结果', value: `${batch.childForecastResults.length} 个子ASIN` }, { label: '销售填报', value: batch.submissionState }, { label: '结果版本', value: batch.activeResultVersion || '—' }] }),
      h('div', { className: 'fp-panel' }, h('div', { className: 'fp-panel-head' }, h('h2', null, '销售填报窗口'), statusTag(batch.submissionState)), h('div', { className: 'fp-panel-body' }, h('div', { className: 'fp-window-grid' }, [['start', '填报开放时间'], ['deadline', '填报截止时间'], ['freeze', '填报冻结时间']].map(([key, label]) => h('div', { key, className: 'fp-readonly' }, h('div', { className: 'fp-kicker' }, label), h(Input, { type: 'datetime-local', value: values[key], onChange: event => setValues({ ...values, [key]: event.target.value }), disabled })))), h(Divider, { style: { margin: '12px 0' } }), h('div', { className: 'fp-help' }, '截止与冻结时间按当前三个独立字段保存；若业务确认截止后立即冻结，再将两者配置为同一时间。'), h('div', { className: 'fp-sticky-actions' }, h(Button, { onClick: () => window.pmcWorkflow?.selectView('sales'), disabled: !canPublish }, '进入销售提报'), h(Tooltip, { title: canPublish ? '' : '请先完成规则预测生成' }, h('span', null, h(Button, { type: 'primary', onClick: save, disabled: disabled || !canPublish }, '发布销售填报窗口'))), h(Button, { danger: true, onClick: freeze, disabled }, '冻结本批次'))))
    );
  }
  function ReviewStep({ batch }) {
    const comparisonPeriod = batch.assessment.comparable ? `${dayText(batch.assessment.comparisonStartDate)} ~ ${dayText(batch.assessment.comparisonEndDate)}` : '等待实际回流';
    const columns = [{ title: '父ASIN', dataIndex: 'parentASIN', width: 150 }, { title: '对比期规则预测', dataIndex: 'total', align: 'right', render: number }, { title: '对比期实际销量', dataIndex: 'actualSales', align: 'right', render: number }, { title: '偏差', dataIndex: 'variance', align: 'right', render: value => `${value > 0 ? '+' : ''}${number(value)}` }, { title: '偏差率', dataIndex: 'varianceRate', align: 'right', render: value => h(Tag, { color: Math.abs(value) > 15 ? 'warning' : 'default' }, signedPercent(value)) }];
    return h(React.Fragment, null, h(Alert, { type: 'info', showIcon: true, message: '复盘只产生下一批次调整依据，不会擅自回写参数或关系。' }), h(PlanListPanel, { title: '规则预测与实际销量', meta: h('span', { className: 'fp-muted' }, `同周期 ${comparisonPeriod} · 按批次快照保留`) }, h(PlanTable, { rowKey: 'key', dataSource: batch.forecastVsActual, columns, locale: { emptyText: '暂无可比批次数据' } })), h('div', { className: 'fp-split' }, h('div', { className: 'fp-panel' }, h('div', { className: 'fp-panel-head' }, h('h2', null, '下一批次调整建议')), h('div', { className: 'fp-panel-body' }, h('div', { className: 'fp-logic-line' }, h('span', { className: 'fp-logic-index' }, '01'), h('strong', null, '参数'), h('span', null, Math.abs(batch.assessment.varianceRate) > 15 ? '复核历史/近期权重与趋势周期' : '默认参数暂不调整')), h('div', { className: 'fp-logic-line' }, h('span', { className: 'fp-logic-index' }, '02'), h('strong', null, '关系'), h('span', null, `${batch.relationChanges.length} 条关系变化需要进入下一批次确认`)), h('div', { className: 'fp-logic-line' }, h('span', { className: 'fp-logic-index' }, '03'), h('strong', null, '拆解'), h('span', null, '复核低销量子体份额与人工调配原因')))), h('div', { className: 'fp-panel' }, h('div', { className: 'fp-panel-head' }, h('h2', null, '批次审计轨迹')), h('div', { className: 'fp-panel-body fp-audit' }, batch.auditTimeline.slice().reverse().map(item => h('div', { className: 'fp-audit-item', key: `${item.at}-${item.action}` }, h('strong', null, `${dateText(item.at)} · ${item.action}`), h('span', null, `${item.actor} · ${item.reason}`)))))));
  }
  function ForecastResultDetail({ row }) {
    const dailyRows = Object.entries(row.dailyFinalForecast || {}).sort(([left], [right]) => left.localeCompare(right)).map(([date, finalForecast]) => {
      const systemForecast = Number(row.dailyRuleForecast?.[date] || 0);
      return { date, parentForecast: row.parentDailyForecast?.[date] ?? 0, systemForecast, adjustment: Number(finalForecast || 0) - systemForecast, finalForecast };
    });
    const signedNumber = value => `${Number(value || 0) > 0 ? '+' : ''}${number(value)}`;
    const columns = [
      { title: '预测日期', dataIndex: 'date', width: 120, render: dayText },
      { title: '父ASIN预测池', dataIndex: 'parentForecast', width: 150, render: number },
      { title: '系统拆解预测', dataIndex: 'systemForecast', width: 150, render: number },
      { title: '人工调配影响', dataIndex: 'adjustment', width: 150, render: value => h('span', { className: value ? 'fp-highlight' : 'fp-muted' }, signedNumber(value)) },
      { title: '销售提报消费数据', dataIndex: 'finalForecast', width: 170, render: value => h('strong', null, number(value)) }
    ];
    return h('div', { className: 'fp-result-detail' },
      h('div', { className: 'fp-table-wrap' }, h(PlanTable, { rowKey: 'date', dataSource: dailyRows, columns, scroll: { x: 900, y: 320 }, pagination: { defaultPageSize: 10, pageSizeOptions: [7, 10, 14, 30, 60], showSizeChanger: true }, locale: { emptyText: '暂无日级预测数据' } }))
    );
  }
  function ResultsView() {
    const [filters, setFilters] = useState({});
    const [expandedResultKey, setExpandedResultKey] = useState(null);
    const resultTableHostRef = useRef(null);
    const resultScrollRef = useRef({ key: null, top: 0, left: 0 });
    const batches = model.list();
    const rows = batches.flatMap(batch => {
      const forecastIndex = contract.getForecastIndex(batch.id);
      return batch.childForecastResults.map(row => {
        const synced = contractChild(forecastIndex, row);
        const parent = contractParent(forecastIndex, row) || batch.parentForecastResults.find(item => item.key === parentForecastKey(row));
        const dailyFinalForecast = synced?.daily || row.dailyFinalForecast || {};
        const dailyRuleForecast = synced?.ruleDaily || row.dailyRuleForecast || {};
        const platform = row.platform || 'Amazon';
        const businessKey = [platform, row.country, row.store, row.parentASIN, row.childASIN].join('|');
        return {
          ...row,
          resultKey: `${batch.id}::${businessKey}`,
          batchId: batch.id,
          batchDate: batch.batchDate,
          batchCreatedAt: batch.createdAt,
          batchStatus: batch.status,
          businessKey,
          forecastStartDate: batch.forecastStartDate,
          forecastEndDate: batch.forecastEndDate,
          relationVersion: batch.relationVersion,
          splitRuleVersion: batch.splitRuleSnapshot.version,
          forecastRuleVersion: batch.forecastRuleSnapshot.version,
          siteStoreKey: `${row.country}|${row.store}`,
          platform,
          submissionState: batch.submissionState,
          parentDailyForecast: parent?.daily || {},
          dailyFinalForecast,
          dailyRuleForecast,
          finalShare: synced?.finalShare ?? row.finalShare,
          systemShare: synced?.systemShare ?? row.systemShare,
          parentTotal: parent?.total ?? 0,
          ruleTotal: synced?.ruleTotal ?? Object.values(dailyRuleForecast).reduce((a, b) => a + (Number(b) || 0), 0),
          total: synced?.total ?? Object.values(dailyFinalForecast).reduce((a, b) => a + (Number(b) || 0), 0)
        };
      });
    });
    const optionList = (values, labeler = value => value) => [...new Set(values.filter(Boolean))].sort().map(value => ({ value, label: labeler(value) }));
    const batchOptions = batches.map(batch => ({ value: batch.id, label: batchText(batch) }));
    const parentOptions = optionList(rows.map(row => row.parentASIN));
    const childOptions = optionList(rows.map(row => row.childASIN));
    const siteStoreOptions = optionList(rows.map(row => row.siteStoreKey), value => value.replace('|', ' · '));
    const platformOptions = optionList(rows.map(row => row.platform));
    const filteredRows = rows.filter(row => (!filters.batchId || row.batchId === filters.batchId)
      && (!filters.parentASIN || row.parentASIN === filters.parentASIN)
      && (!filters.childASIN || row.childASIN === filters.childASIN)
      && (!filters.siteStore || row.siteStoreKey === filters.siteStore)
      && (!filters.platform || row.platform === filters.platform));
    const setFilter = (key, value) => setFilters(current => ({ ...current, [key]: value || undefined }));
    const reset = () => { setFilters({}); setExpandedResultKey(null); };
    const toggleDetail = row => {
      const body = resultTableHostRef.current?.querySelector('.ant-table-body');
      resultScrollRef.current = { key: row.resultKey, top: body?.scrollTop || 0, left: body?.scrollLeft || 0 };
      setExpandedResultKey(current => current === row.resultKey ? null : row.resultKey);
    };
    useEffect(() => {
      const snapshot = resultScrollRef.current;
      if (!snapshot.key) return undefined;
      let secondFrame;
      const firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          const host = resultTableHostRef.current;
          const body = host?.querySelector('.ant-table-body');
          if (body) {
            body.scrollTop = snapshot.top;
            body.scrollLeft = snapshot.left;
          }
          const anchor = [...(host?.querySelectorAll('[data-result-anchor]') || [])].find(node => node.dataset.resultAnchor === snapshot.key);
          anchor?.focus({ preventScroll: true });
        });
      });
      return () => { cancelAnimationFrame(firstFrame); if (secondFrame) cancelAnimationFrame(secondFrame); };
    }, [expandedResultKey]);
    const openCurrent = () => {
      const current = model.getCurrent();
      const target = rows.find(row => row.batchId === current?.id) || rows[0];
      if (target) setExpandedResultKey(target.resultKey);
    };
    const columns = [
      { title: '平台', dataIndex: 'platform', width: 90, fixed: 'left' },
      { title: '站点', dataIndex: 'country', width: 80 },
      { title: '店铺', dataIndex: 'store', width: 120 },
      { title: '父ASIN', dataIndex: 'parentASIN', width: 145 },
      { title: '子ASIN', dataIndex: 'childASIN', width: 145 },
      { title: '预测批次', width: 150, render: (_, row) => h(Button, { type: 'link', className: 'fp-link', icon: h(expandedResultKey === row.resultKey ? icon.UpOutlined : icon.DownOutlined), iconPosition: 'end', onClick: () => toggleDetail(row), 'aria-expanded': expandedResultKey === row.resultKey, 'data-result-anchor': row.resultKey }, batchText(row)) },
      { title: '预测范围', width: 190, render: (_, row) => `${dayText(row.forecastStartDate)} ~ ${dayText(row.forecastEndDate)}` },
      { title: '父ASIN预测总量', dataIndex: 'parentTotal', width: 132, align: 'right', render: value => h('strong', null, number(value)) },
      { title: '子ASIN预测总量', dataIndex: 'total', width: 132, align: 'right', render: value => h('strong', null, number(value)) },
      { title: '最终份额', dataIndex: 'finalShare', width: 92, align: 'right', render: percent },
      { title: '关系版本', dataIndex: 'relationVersion', width: 142 },
      { title: '状态', dataIndex: 'batchStatus', width: 112, render: value => h(Tag, { className: 'fp-result-status' }, value) }
    ];
    return h(React.Fragment, null,
      h(PlanListPanel, {
        search: h(Form, { layout: 'inline', size: 'small', style: { rowGap: 8 } },
            h(Form.Item, { label: '预测批次' }, h(Select, { allowClear: true, showSearch: true, optionFilterProp: 'label', placeholder: '全部批次', value: filters.batchId, options: batchOptions, onChange: value => setFilter('batchId', value), style: { width: 210 } })),
            h(Form.Item, { label: '父ASIN' }, h(Select, { allowClear: true, showSearch: true, optionFilterProp: 'label', placeholder: '全部父ASIN', value: filters.parentASIN, options: parentOptions, onChange: value => setFilter('parentASIN', value), style: { width: 150 } })),
            h(Form.Item, { label: '子ASIN' }, h(Select, { allowClear: true, showSearch: true, optionFilterProp: 'label', placeholder: '全部子ASIN', value: filters.childASIN, options: childOptions, onChange: value => setFilter('childASIN', value), style: { width: 150 } })),
            h(Form.Item, { label: '站点店铺' }, h(Select, { allowClear: true, showSearch: true, optionFilterProp: 'label', placeholder: '全部站点店铺', value: filters.siteStore, options: siteStoreOptions, onChange: value => setFilter('siteStore', value), style: { width: 150 } })),
            h(Form.Item, { label: '平台' }, h(Select, { allowClear: true, placeholder: '全部平台', value: filters.platform, options: platformOptions, onChange: value => setFilter('platform', value), style: { width: 120 } })),
            h(Form.Item, null, h(Button, { onClick: reset }, '重置'))
          ),
        toolbar: h(Button, { type: 'primary', onClick: openCurrent }, '展开当前批次')
      }, h(PlanTable, { hostRef: resultTableHostRef, rowKey: 'resultKey', dataSource: filteredRows, columns, scroll: { y: 'max(120px, calc(100vh - 300px))' }, expandable: { expandedRowKeys: expandedResultKey ? [expandedResultKey] : [], expandedRowRender: row => h(ForecastResultDetail, { row }), showExpandColumn: false }, locale: { emptyText: '未找到匹配的历史批次预测结果，请调整筛选项。' } }))
    );
  }
  function SubmissionView({ batch }) {
    const count = batch.childForecastResults.length;
    return h(React.Fragment, null, h(PageHead, { title: '销售提报', subtitle: '销售端消费本批次预测清单；页面结构与日级填报交互保持冻结。', actions: [h(Button, { key: 'go', type: 'primary', onClick: () => window.pmcWorkflow?.selectView('sales') }, '进入销售提报页面')] }), h(MetricStrip, { items: [{ label: '当前批次', value: batchText(batch) }, { label: '填报子ASIN', value: `${count} 个` }, { label: '填报状态', value: batch.submissionState }, { label: '填报时间', value: dateText(batch.submissionWindow.submissionStartTime) }, { label: '截止并冻结', value: dateText(batch.submissionWindow.submissionFreezeTime) }, { label: '规则来源', value: batch.splitRuleSnapshot.version }] }), h(Alert, { type: 'success', showIcon: true, message: '数据契约已准备：父ASIN、子ASIN、预测日期、规则预测、父子关系版本和拆解规则版本将随本批次清单提供给销售页面。' }), h('div', { className: 'fp-panel' }, h('div', { className: 'fp-panel-head' }, h('h2', null, '销售可见数据范围'), h('span', { className: 'fp-muted' }, '后台生产端 → 销售消费端')), h('div', { className: 'fp-panel-body' }, h('div', { className: 'fp-chain' }, [['父ASIN规则预测', '父ASIN预测池'], ['当前父子关系', batch.relationVersion], ['子ASIN拆解', batch.splitRuleSnapshot.version], ['日级规则预测', `${batch.forecastStartDate} ~ ${batch.forecastEndDate}`], ['销售人工 / 活动', '由冻结销售页填写'], ['最终预测快照', '截止并冻结后形成']].map(([title, value]) => h('div', { className: 'fp-chain-node', key: title }, h('span', null, title), h('strong', null, value)))))));
  }
  function ReviewView() {
    const batches = model.list();
    const columns = [{ title: '调整批次', dataIndex: 'name', width: 190, render: (_, row) => batchText(row) }, { title: '评估来源', render: (_, row) => row.assessment.previousBatchVersion || '待下一批次回流' }, { title: '对比期', render: (_, row) => row.assessment.comparable ? `${dayText(row.assessment.comparisonStartDate)} ~ ${dayText(row.assessment.comparisonEndDate)}` : '—' }, { title: '规则预测', render: (_, row) => row.assessment.comparable ? number(row.assessment.ruleForecastTotal) : '—', align: 'right' }, { title: '实际销量', render: (_, row) => row.assessment.comparable ? number(row.assessment.actualSalesTotal) : '—', align: 'right' }, { title: '整体偏差', render: (_, row) => row.assessment.comparable ? h(Tag, { color: Math.abs(row.assessment.varianceRate) > 15 ? 'warning' : 'default' }, signedPercent(row.assessment.varianceRate)) : h(Tag, null, '待回流'), align: 'right' }, { title: '下一批次依据', render: (_, row) => row.assessment.trend }];
    return h(React.Fragment, null, h(PageHead, { title: '预测复盘', subtitle: '从规则预测、销售提报与实际销量的偏差中形成下一批次调整依据。' }), h(PlanListPanel, { title: '批次复盘总览' }, h(PlanTable, { rowKey: 'id', dataSource: batches, columns })), h(Alert, { style: { marginTop: 12 }, type: 'info', showIcon: true, message: '复盘建议需要PMC确认后才会进入下一批次；系统不会自动修改预测参数。' }));
  }
  function PlanDetail({ batchId, onBack, initialStep }) {
    const revision = useStoreRevision();
    const batch = model.getBatch(batchId);
    const [step, setStep] = useState(initialStep || batch?.currentStep || 'assessment');
    const workflowStepRef = useRef(batch?.currentStep);
    useEffect(() => { workflowStepRef.current = batch?.currentStep; setStep(initialStep || batch?.currentStep || 'assessment'); }, [batchId, initialStep]);
    useEffect(() => { if (workflowStepRef.current !== batch?.currentStep) { workflowStepRef.current = batch?.currentStep; setStep(batch?.currentStep || 'assessment'); } }, [batch?.currentStep]);
    if (!batch) return h(Empty, { description: '预测批次不存在' });
    const content = { assessment: h(AssessmentStep, { batch, onStep: setStep }), parameters: h(ParameterStep, { batch }), relations: h(RelationStep, { batch }), split: h(SplitStep, { batch }), forecast: h(ForecastStep, { batch, onStep: setStep }), submission: h(WindowStep, { batch }), review: h(ReviewStep, { batch }) }[step];
    return h(React.Fragment, null, h(PlanHeader, { batch, onBack }), h(WorkflowSteps, { active: step, batch, onChange: setStep }), content);
  }
  function ForecastPlanWorkspace() {
    useStoreRevision();
    const initialView = pendingRoute.view || 'plans';
    const [view, setView] = useState(initialView);
    const [detailId, setDetailId] = useState(pendingRoute.detailId);
    const [detailStep, setDetailStep] = useState(pendingRoute.step || 'assessment');
    useEffect(() => { const fn = event => { const route = event.detail || {}; setView(route.view || 'plans'); setDetailId(route.detailId || null); setDetailStep(route.step || 'assessment'); }; window.addEventListener('forecast-plan-route', fn); return () => window.removeEventListener('forecast-plan-route', fn); }, []);
    const open = id => { setDetailId(id); setView('plans'); setDetailStep(model.getBatch(id)?.currentStep || 'assessment'); };
    if (view === 'system-detail' && detailId) return h('div', { className: 'forecast-plan-root' }, h(PlanDetail, { batchId: detailId, initialStep: detailStep, onBack: () => window.pmcWorkflow?.showPlanningBaseTab?.() }));
    const activeView = view === 'results' ? 'results' : 'plans';
    const body = detailId ? h(PlanDetail, { batchId: detailId, initialStep: detailStep, onBack: () => setDetailId(null) }) : activeView === 'results' ? h(ResultsView) : h(BatchList, { onOpen: open });
    return h('div', { className: `forecast-plan-root ${detailId ? '' : 'fp-list-page'}` }, h(Tabs, { className: 'fp-nav', size: 'small', tabBarStyle: { margin: 0 }, activeKey: activeView, onChange: key => { setView(key); setDetailId(null); setDetailStep('assessment'); }, items: [{ key: 'plans', label: '预测计划' }, { key: 'results', label: '预测结果' }] }), body);
  }
  function navigate(route) {
    const stepMap = { forecast: 'forecast', split: 'split', relations: 'relations', params: 'parameters' };
    pendingRoute = { view: 'plans', detailId: model.getCurrent().id, step: stepMap[route?.sub] || stepMap[route?.tab] || 'assessment' };
    window.dispatchEvent(new CustomEvent('forecast-plan-route', { detail: pendingRoute }));
  }
  window.ParentAsinModule = {
    ParentAsinWorkspace: ForecastPlanWorkspace,
    navigate,
    openResultsList() {
      pendingRoute = { view: 'results', detailId: null, step: 'assessment' };
      window.dispatchEvent(new CustomEvent('forecast-plan-route', { detail: pendingRoute }));
    },
    openSystemBatchDetail(batchId, step = 'forecast') {
      pendingRoute = { view: 'system-detail', detailId: batchId || model.getCurrent().id, step };
      window.dispatchEvent(new CustomEvent('forecast-plan-route', { detail: pendingRoute }));
    },
    getCurrentBasis() {
      const batch = contract.getCurrent();
      return { batch: batch.batchDate, forecast: batch.forecastRuleSnapshot.version, split: batch.splitRuleSnapshot.version, relation: batch.relationVersion, params: batch.parameterSnapshot.version, status: batch.status };
    }
  };
})();
