/* Forecast-plan workspace: batch-first backend operations. */
(() => {
  const h = React.createElement;
  const { useEffect, useMemo, useState } = React;
  const { Alert, App, Button, Descriptions, Divider, Drawer, Empty, Form, Input, InputNumber, Segmented, Select, Space, Steps, Table, Tabs, Tag, Timeline, Tooltip } = antd;
  const icon = window.icons || {};
  const model = window.ForecastBatchModel.createStore();
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
  const statusColor = { 草稿: 'default', 评估中: 'processing', 参数调整中: 'processing', 关系确认中: 'warning', 拆解规则确认中: 'warning', 预测计算中: 'processing', 待发布: 'default', 销售填报中: 'processing', 待复盘: 'warning', 已冻结: 'blue', 已完成: 'success' };
  const steps = [
    { key: 'assessment', title: '预测评估', description: '上一批次表现' },
    { key: 'parameters', title: '预测参数', description: '本批次执行值' },
    { key: 'relations', title: '父子关系', description: '关系快照确认' },
    { key: 'split', title: '拆解规则', description: '份额与调配' },
    { key: 'forecast', title: '规则预测', description: '父子预测结果' },
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
  const planPagination = pagination => {
    const base = { size: 'small', pageSize: 12, showSizeChanger: true, showQuickJumper: true, hideOnSinglePage: false, showTotal: total => `共 ${total} 条` };
    if (pagination === false || pagination == null) return base;
    return { ...base, ...pagination, showTotal: pagination.showTotal || base.showTotal };
  };
  const planScroll = (columns, scroll) => ({ x: Math.max(960, sumColumnWidths(columns)), y: 420, ...(scroll || {}) });
  function PlanTable({ columns = [], className, pagination, scroll, ...props }) {
    return h(Table, { size: 'small', sticky: true, ...props, className: ['fp-plan-table', className].filter(Boolean).join(' '), columns: normalizePlanColumns(columns), scroll: planScroll(columns, scroll), pagination: planPagination(pagination) });
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
      }, h(PlanTable, { rowKey: 'id', dataSource: batches, columns, onRow: row => ({ className: 'fp-batch-row', onDoubleClick: () => onOpen(row.id) }) }))
    );
  }
  function DemoControl({ batch, onChange }) {
    const options = [{ value: 'auto', label: '按实际状态' }, ...steps.map(step => ({ value: step.key, label: `演示：${step.title}` }))];
    return h(Space, { size: 6 }, h('span', { className: 'fp-demo-label' }, '流程演示状态'), h(Select, { size: 'small', value: model.getDemoStage(), options, onChange: value => { model.setDemoStage(value); if (value !== 'auto') onChange(value); }, style: { width: 148 }, 'aria-label': '流程演示状态' }), h(Tooltip, { title: '仅切换当前界面展示的流程节点，不切换角色账号，不创建或回滚版本' }, h('span', { className: 'fp-muted' }, 'ⓘ')));
  }
  function PlanHeader({ batch, onBack, onStep }) {
    const status = batch.status;
    return h(React.Fragment, null,
      h(PageHead, { title: h('div', { className: 'fp-detail-title' }, h(Button, { type: 'text', icon: h(icon.ArrowLeftOutlined), onClick: onBack, 'aria-label': '返回预测计划列表' }), h('strong', null, batchText(batch)), statusTag(status)), subtitle: `${batch.batchVersion} · 数据截点 ${dayText(batch.dataCutoffDate)} · 预测周期 ${dayText(batch.forecastStartDate)} ~ ${dayText(batch.forecastEndDate)}`, actions: [h(DemoControl, { key: 'demo', batch, onChange: onStep })] }),
      h(MetricStrip, { items: [
        { label: '父ASIN预测池', value: `${new Set(batch.relationSnapshot.map(item => `${item.country}|${item.store}|${item.parentASIN}`)).size} 个` },
        { label: '子ASIN清单', value: `${batch.childForecastResults.length} 个` },
        { label: '关系版本', value: batch.relationVersion },
        { label: '父ASIN预测规则', value: batch.forecastRuleSnapshot.version },
        { label: '销售填报', value: batch.submissionState, tone: batch.submissionState === '已冻结' ? 'success' : '' },
        { label: '当前负责人', value: batch.createdBy }
      ] })
    );
  }
  function WorkflowSteps({ active, onChange }) {
    const current = stepIndex(active);
    const items = steps.map((step, index) => ({ ...step, status: index < current ? 'finish' : index === current ? 'process' : 'wait' }));
    return h('div', { className: 'fp-stepbar' }, h(Steps, { current, size: 'small', responsive: true, items, onChange: index => onChange(steps[index].key) }));
  }
  function AssessmentStep({ batch, onStep }) {
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
        toolbar: h(Button, { type: 'primary', onClick: () => onStep('parameters') }, '进入参数调整')
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
    const { message } = App.useApp();
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(null);
    const [drawer, setDrawer] = useState(false);
    const rows = batch.relationSnapshot.filter(row => !query || [row.parentASIN, row.childASIN, row.sellerSku].some(value => String(value).includes(query.trim().toUpperCase())));
    const history = selected ? model.list().flatMap(item => item.relationSnapshot.filter(row => row.childASIN === selected.childASIN && row.country === selected.country).map(row => ({ batch: item.batchDate, version: item.relationVersion, parent: row.parentASIN, share: item.childForecastResults.find(child => child.childASIN === row.childASIN)?.finalShare || 0, forecast: item.childForecastResults.find(child => child.childASIN === row.childASIN)?.dailyFinalForecast || {}, status: item.status }))) : [];
    const submit = values => { try { model.adjustRelation(batch.id, selected.childId, values.targetParent, values.reason); message.success('本批次父子关系已更新并记录原因'); setDrawer(false); } catch (error) { message.error(error.message); } };
    const columns = [
      { title: '父ASIN', dataIndex: 'parentASIN', width: 140 }, { title: '子ASIN', dataIndex: 'childASIN', width: 145, render: value => h(Button, { type: 'link', onClick: () => setSelected(rows.find(row => row.childASIN === value)) }, value) },
      { title: 'Seller SKU', dataIndex: 'sellerSku', width: 165 }, { title: '国家 / 店铺', width: 150, render: (_, row) => `${row.country} · ${row.store}` }, { title: '上一批次父体', dataIndex: 'previousParentASIN', width: 145, render: value => value || '—' }, { title: '关系状态', dataIndex: 'relationState', width: 120, render: value => h(Tag, { color: value === '平台同步' ? 'default' : 'warning' }, value) }, { title: '操作', width: 88, fixed: 'right', render: (_, row) => h(Button, { type: 'link', onClick: () => { setSelected(row); setDrawer(true); } }, '调整关系') }
    ];
    const parentOptions = [...new Set(batch.relationSnapshot.map(row => row.parentASIN))].map(value => ({ value, label: value }));
    return h(React.Fragment, null,
      h(Alert, { type: 'info', showIcon: true, message: '本批次关系快照决定预测池；历史父ASIN只用于追溯，历史销量按国家 + 店铺 + 子ASIN归集到当前父ASIN预测池。' }),
      h(PlanListPanel, {
        title: '本批次父子ASIN关系',
        meta: h(Tag, null, `${rows.length} 条关系`),
        search: h(Input.Search, { allowClear: true, placeholder: '父ASIN / 子ASIN / SKU', onSearch: setQuery, style: { width: 260 } })
      }, h(PlanTable, { rowKey: 'childId', dataSource: rows, columns, pagination: { pageSize: 12 }, onRow: row => ({ onClick: () => setSelected(row) }) })),
      selected && h(PlanListPanel, {
        title: `${selected.childASIN} · 历史挂靠关系`,
        meta: h('span', { className: 'fp-muted' }, `当前父ASIN ${selected.parentASIN}`)
      }, h(PlanTable, { rowKey: row => `${row.batch}-${row.version}`, dataSource: history, columns: [{ title: '预测批次', dataIndex: 'batch', render: dayText }, { title: '关系版本', dataIndex: 'version' }, { title: '父ASIN', dataIndex: 'parent' }, { title: '当时份额', dataIndex: 'share', align: 'right', render: percent }, { title: '状态', dataIndex: 'status', render: statusTag }, { title: '规则预测', render: (_, row) => number(Object.values(row.forecast).reduce((a, b) => a + (Number(b) || 0), 0)) }], locale: { emptyText: '暂无历史关系' } })),
      h(Drawer, { open: drawer, width: 480, title: `调整本批次关系 · ${selected?.childASIN || ''}`, onClose: () => setDrawer(false), destroyOnClose: true, footer: null }, selected && h(RelationForm, { selected, parentOptions, onSubmit: submit, onCancel: () => setDrawer(false), disabled: batch.status === '已冻结' || batch.status === '已完成' }))
    );
  }
  function RelationForm({ selected, parentOptions, onSubmit, onCancel, disabled }) {
    const [form] = Form.useForm();
    return h(Form, { form, layout: 'vertical', initialValues: { targetParent: selected.parentASIN }, onFinish: onSubmit }, h(Alert, { type: 'warning', showIcon: true, message: '保存后只更新当前批次草稿；历史批次关系与预测快照不变。', style: { marginBottom: 14 } }), h(Form.Item, { label: '子ASIN' }, h(Input, { value: selected.childASIN, disabled: true })), h(Form.Item, { name: 'targetParent', label: '本批次父ASIN', rules: [{ required: true, message: '请选择父ASIN' }] }, h(Select, { options: parentOptions, showSearch: true })), h(Form.Item, { name: 'reason', label: '变更原因', rules: [{ required: true, whitespace: true, message: '请填写关系变更原因' }] }, h(Input.TextArea, { rows: 3, maxLength: 200, showCount: true, placeholder: '例如：父体Listing结构调整' })), h('div', { className: 'fp-sticky-actions' }, h(Button, { onClick: onCancel }, '取消'), h(Button, { type: 'primary', htmlType: 'submit', disabled }, '保存关系快照')));
  }
  function RuleChain({ rule }) {
    const nodes = [['适用对象', rule.scope], ['数据周期', `${rule.historyWindow}天历史 Clean销量 + ${rule.recentWindow}天近期 Clean销量`], ['异常判断', rule.abnormalCondition], ['计算方式', `${rule.historyWeight}% × 历史份额 + ${rule.recentWeight}% × 近期份额`], ['归一化', rule.normalization ? '同一父ASIN下重新归一化至100%' : '关闭'], ['人工调配', rule.manualAllowed ? '允许PMC在本批次调配' : '不允许'], ['输出结果', '子ASIN最终规则预测']];
    return h('div', { className: 'fp-chain' }, nodes.map(([title, value]) => h('div', { className: 'fp-chain-node', key: title }, h('span', null, title), h('strong', null, value))));
  }
  function SplitStep({ batch }) {
    const { message } = App.useApp();
    const parentOptions = [...new Set(batch.childForecastResults.map(row => relationKey(row)))];
    const forecastIndex = contract.getForecastIndex(batch.id);
    const [selectedParent, setSelectedParent] = useState(parentOptions[0]);
    const siblings = batch.childForecastResults.filter(row => relationKey(row) === selectedParent);
    const [shares, setShares] = useState({});
    const [reason, setReason] = useState('');
    const [mode, setMode] = useState('proportional');
    useEffect(() => { if (parentOptions.length && !parentOptions.includes(selectedParent)) setSelectedParent(parentOptions[0]); }, [batch.id, parentOptions.join('|')]);
    useEffect(() => setShares(Object.fromEntries(siblings.map(row => [row.childASIN, Number(((contractChild(forecastIndex, row)?.finalShare ?? row.finalShare) / 100).toFixed(2))]))), [batch.id, selectedParent, forecastIndex?.batchVersion, siblings.map(row => row.finalShare).join(',')]);
    const update = (childASIN, value) => {
      const nextValue = Math.max(0, Math.min(100, Number(value) || 0));
      if (mode === 'manual') return setShares({ ...shares, [childASIN]: nextValue });
      const others = siblings.filter(row => row.childASIN !== childASIN);
      const remainder = 100 - nextValue;
      const oldTotal = others.reduce((total, row) => total + (Number(shares[row.childASIN]) || 0), 0);
      const next = { ...shares, [childASIN]: nextValue };
      others.forEach(row => { next[row.childASIN] = oldTotal ? Number((remainder * (Number(shares[row.childASIN]) || 0) / oldTotal).toFixed(2)) : Number((remainder / others.length).toFixed(2)); });
      const drift = Number((100 - Object.values(next).reduce((total, value) => total + value, 0)).toFixed(2));
      if (others.at(-1)) next[others.at(-1).childASIN] = Number((next[others.at(-1).childASIN] + drift).toFixed(2));
      setShares(next);
    };
    const rawTotal = Object.values(shares).reduce((a, b) => a + (Number(b) || 0), 0);
    const total = Number(rawTotal.toFixed(2));
    const sharesValid = Math.abs(rawTotal - 100) < 0.005;
    const save = () => {
      if (!sharesValid) return message.error('当前父ASIN下最终份额必须合计100%');
      if (!reason.trim()) return message.warning('请填写人工调配原因');
      const basisPointShares = Object.fromEntries(Object.entries(shares).map(([childASIN, value]) => [childASIN, Math.round((Number(value) || 0) * 100)]));
      try { model.adjustShares(batch.id, selectedParent, basisPointShares, reason.trim()); setReason(''); message.success('本批次子ASIN份额已保存'); } catch (error) { message.error(error.message); }
    };
    const parent = batch.parentForecastResults.find(row => row.key === selectedParent);
    const syncedParent = forecastIndex?.parents?.[selectedParent] || null;
    const previewTotal = row => {
      const inputShare = Number(shares[row.childASIN]) || 0;
      const synced = contractChild(forecastIndex, row);
      const savedShare = (synced?.finalShare ?? row.finalShare) / 100;
      if (Math.abs(inputShare - savedShare) < 0.005) return synced?.total ?? Object.values(row.dailyFinalForecast).reduce((sum, value) => sum + (Number(value) || 0), 0);
      return Math.round(((syncedParent?.total ?? parent?.total) || 0) * inputShare / 100);
    };
    const shareColumns = [
      { title: '子ASIN', dataIndex: 'childASIN', width: 145 },
      { title: '历史销量', dataIndex: 'historicalSales', align: 'right', render: number },
      { title: '系统份额', align: 'right', render: (_, row) => percent(contractChild(forecastIndex, row)?.systemShare ?? row.systemShare) },
      { title: '人工调整', align: 'right', render: (_, row) => { const systemShare = contractChild(forecastIndex, row)?.systemShare ?? row.systemShare; const delta = Number(shares[row.childASIN] || 0) - systemShare / 100; return h('span', { className: delta ? 'fp-highlight' : 'fp-muted' }, `${delta > 0 ? '+' : ''}${delta.toFixed(2)}%`); } },
      { title: '最终份额', width: 130, align: 'right', render: (_, row) => h(InputNumber, { min: 0, max: 100, precision: 2, value: shares[row.childASIN], addonAfter: '%', onChange: value => update(row.childASIN, value), disabled: batch.status === '已冻结' || batch.status === '已完成', style: { width: 118 } }) },
      { title: h(Tooltip, { title: '未保存调整按父ASIN总量 × 当前份额估算；保存后按日级拆解并校正取整。' }, h('span', null, '预测合计预览')), align: 'right', render: (_, row) => h('strong', null, `${number(previewTotal(row))} 件`) }
    ];
    const summary = h(Descriptions, { size: 'small', column: 4, items: [
      { key: 'parent', label: '父ASIN', children: parent?.parentASIN },
      { key: 'total', label: '父ASIN规则预测', children: `${number(syncedParent?.total ?? parent?.total)} 件` },
      { key: 'current', label: '当前子体数', children: `${siblings.length} 个` },
      { key: 'sum', label: '最终份额合计', children: h(Tag, { color: sharesValid ? 'success' : 'error' }, `${total.toFixed(2)}%`) }
    ] });
    return h(React.Fragment, null,
      h(Alert, { type: 'info', showIcon: true, message: '关系回答“谁属于谁”，拆解规则回答“父ASIN总量如何拆到子ASIN”；两者在本批次快照中独立保存。' }),
      h(RuleChain, { rule: batch.splitRuleSnapshot }),
      h('div', { className: 'fp-rule-summary' }, [['历史周期', `${batch.splitRuleSnapshot.historyWindow} 天`], ['近期周期', `${batch.splitRuleSnapshot.recentWindow} 天`], ['历史 / 近期权重', `${batch.splitRuleSnapshot.historyWeight} / ${batch.splitRuleSnapshot.recentWeight}`], ['规则版本', batch.splitRuleSnapshot.version]].map(([label, value]) => h('div', { key: label }, h('label', null, label), h('strong', null, value)))),
      h('div', { className: 'fp-panel' },
        h('div', { className: 'fp-panel-head' },
          h('h2', null, '本批次子ASIN份额调配'),
          h(Space, null,
            h(Select, { value: selectedParent, options: parentOptions.map(value => ({ value, label: `${value.split('|')[0]} · ${value.split('|')[2]}` })), onChange: setSelectedParent, style: { width: 250 }, 'aria-label': '选择父ASIN预测池' }),
            h(Segmented, { size: 'small', value: mode, onChange: setMode, options: [{ label: '按比例压缩其他子体', value: 'proportional' }, { label: '手工重新分配', value: 'manual' }] })
          )
        ),
        h('div', { className: 'fp-panel-body' },
          summary,
          h('div', { className: 'fp-table-wrap' }, h(PlanTable, {rowKey: 'childASIN', dataSource: siblings, columns: shareColumns })),
          h('div', { className: 'fp-kicker', style: { marginTop: 12 } }, '调整原因（必填）'),
          h(Input.TextArea, { value: reason, onChange: event => setReason(event.target.value), rows: 2, maxLength: 200, showCount: true, placeholder: '例如：XL近期销量异常，按运营策略提高本批次份额。', disabled: batch.status === '已冻结' || batch.status === '已完成' }),
          h('div', { className: 'fp-sticky-actions' }, h(Button, { type: 'primary', onClick: save, disabled: batch.status === '已冻结' || batch.status === '已完成' }, '保存本批次调配'))
        )
      )
    );
  }
  function ForecastStep({ batch }) {
    const forecastIndex = contract.getForecastIndex(batch.id);
    const rows = batch.childForecastResults.map(row => {
      const synced = contractChild(forecastIndex, row);
      const dailyFinalForecast = synced?.daily || row.dailyFinalForecast;
      const dailyRuleForecast = synced?.ruleDaily || row.dailyRuleForecast;
      return { ...row, finalShare: synced?.finalShare ?? row.finalShare, systemShare: synced?.systemShare ?? row.systemShare, dailyFinalForecast, dailyRuleForecast, finalTotal: synced?.total ?? Object.values(dailyFinalForecast).reduce((a, b) => a + (Number(b) || 0), 0), ruleTotal: synced?.ruleTotal ?? Object.values(dailyRuleForecast).reduce((a, b) => a + (Number(b) || 0), 0) };
    });
    const columns = [
      { title: '父ASIN', dataIndex: 'parentASIN', width: 140 },
      { title: '子ASIN', dataIndex: 'childASIN', width: 145 },
      { title: '国家 / 店铺', width: 145, render: (_, row) => `${row.country} · ${row.store}` },
      { title: '父ASIN规则', width: 142, render: () => batch.forecastRuleSnapshot.version },
      { title: '拆解规则', width: 142, render: () => batch.splitRuleSnapshot.version },
      { title: '系统份额', dataIndex: 'systemShare', align: 'right', render: percent },
      { title: '人工调整', dataIndex: 'manualAdjustment', align: 'right', render: value => h('span', { className: value ? 'fp-highlight' : 'fp-muted' }, `${value > 0 ? '+' : ''}${percent(value)}`) },
      { title: '规则预测合计', dataIndex: 'ruleTotal', align: 'right', render: number },
      { title: '最终规则预测', dataIndex: 'finalTotal', align: 'right', render: value => h('strong', null, number(value)) },
      { title: '预测来源', render: () => h(Tag, null, '规则预测') }
    ];
    const expandedRowRender = row => h(PlanTable, {rowKey: 'date', pagination: { pageSize: 7, showSizeChanger: false }, dataSource: Object.entries(row.dailyFinalForecast).slice(0, 14).map(([date, value]) => ({ date, rule: row.dailyRuleForecast[date], value })), columns: [{ title: '预测日期', dataIndex: 'date', render: dayText }, { title: '规则预测', dataIndex: 'rule', align: 'right', render: number }, { title: '最终规则预测', dataIndex: 'value', align: 'right', render: number }] });
    return h(React.Fragment, null,
      h(Alert, { type: 'success', showIcon: true, message: '规则预测已按“父ASIN预测池 → 当前父子关系 → 拆解规则 → 本批次人工调配”生成；销售提报只消费下方子ASIN日级清单。' }),
      h(PlanListPanel, {
        title: '子ASIN规则预测清单',
        meta: h(Tag, { color: 'blue' }, `${rows.length} 个子ASIN · ${batch.forecastStartDate} ~ ${batch.forecastEndDate}`)
      }, h(PlanTable, { rowKey: 'id', dataSource: rows, columns, expandable: { expandedRowRender } })),
      h('div', { className: 'fp-panel' }, h('div', { className: 'fp-panel-body' }, h('div', { className: 'fp-help' }, '数据契约字段包含 batchId、batchVersion、dataCutoffDate、预测窗口、关系版本、拆解规则版本、父/子ASIN、预测日期、规则预测值与预测来源；销售页面不参与后台计算。')))
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
    return h(React.Fragment, null, h(Alert, { type: 'info', showIcon: true, message: '销售填报窗口属于预测批次；只有规则预测完成后才发布，达到冻结时间后形成销售预测快照。' }), h('div', { className: 'fp-panel' }, h('div', { className: 'fp-panel-head' }, h('h2', null, '销售填报窗口'), statusTag(batch.submissionState)), h('div', { className: 'fp-panel-body' }, h('div', { className: 'fp-window-grid' }, [['start', '填报开始时间'], ['deadline', '填报截止时间'], ['freeze', '预测冻结时间']].map(([key, label]) => h('div', { key, className: 'fp-readonly' }, h('div', { className: 'fp-kicker' }, label), h(Input, { type: 'datetime-local', value: values[key], onChange: event => setValues({ ...values, [key]: event.target.value }), disabled })))), h(Divider, { style: { margin: '12px 0' } }), h('div', { className: 'fp-help' }, '冻结以后销售不能继续修改；后台只通过批次契约向销售提报页面提供本批次日级规则预测清单，不改变销售页面的布局和交互。'), h('div', { className: 'fp-sticky-actions' }, h(Button, { onClick: () => window.pmcWorkflow?.selectView('sales') }, '进入销售提报'), h(Button, { onClick: save, disabled }, '保存窗口'), h(Button, { danger: true, onClick: freeze, disabled }, '冻结本批次')))));
  }
  function ReviewStep({ batch }) {
    const comparisonPeriod = batch.assessment.comparable ? `${dayText(batch.assessment.comparisonStartDate)} ~ ${dayText(batch.assessment.comparisonEndDate)}` : '等待实际回流';
    const columns = [{ title: '父ASIN', dataIndex: 'parentASIN', width: 150 }, { title: '对比期规则预测', dataIndex: 'total', align: 'right', render: number }, { title: '对比期实际销量', dataIndex: 'actualSales', align: 'right', render: number }, { title: '偏差', dataIndex: 'variance', align: 'right', render: value => `${value > 0 ? '+' : ''}${number(value)}` }, { title: '偏差率', dataIndex: 'varianceRate', align: 'right', render: value => h(Tag, { color: Math.abs(value) > 15 ? 'warning' : 'default' }, signedPercent(value)) }];
    return h(React.Fragment, null, h(Alert, { type: 'info', showIcon: true, message: '复盘只产生下一批次调整依据，不会擅自回写参数或关系。' }), h(PlanListPanel, { title: '规则预测与实际销量', meta: h('span', { className: 'fp-muted' }, `同周期 ${comparisonPeriod} · 按批次快照保留`) }, h(PlanTable, { rowKey: 'key', dataSource: batch.forecastVsActual, columns, locale: { emptyText: '暂无可比批次数据' } })), h('div', { className: 'fp-split' }, h('div', { className: 'fp-panel' }, h('div', { className: 'fp-panel-head' }, h('h2', null, '下一批次调整建议')), h('div', { className: 'fp-panel-body' }, h('div', { className: 'fp-logic-line' }, h('span', { className: 'fp-logic-index' }, '01'), h('strong', null, '参数'), h('span', null, Math.abs(batch.assessment.varianceRate) > 15 ? '复核历史/近期权重与趋势周期' : '默认参数暂不调整')), h('div', { className: 'fp-logic-line' }, h('span', { className: 'fp-logic-index' }, '02'), h('strong', null, '关系'), h('span', null, `${batch.relationChanges.length} 条关系变化需要进入下一批次确认`)), h('div', { className: 'fp-logic-line' }, h('span', { className: 'fp-logic-index' }, '03'), h('strong', null, '拆解'), h('span', null, '复核低销量子体份额与人工调配原因')))), h('div', { className: 'fp-panel' }, h('div', { className: 'fp-panel-head' }, h('h2', null, '批次审计轨迹')), h('div', { className: 'fp-panel-body fp-audit' }, batch.auditTimeline.slice().reverse().map(item => h('div', { className: 'fp-audit-item', key: `${item.at}-${item.action}` }, h('strong', null, `${dateText(item.at)} · ${item.action}`), h('span', null, `${item.actor} · ${item.reason}`)))))));
  }
  function ResultsView() {
    const [filters, setFilters] = useState({});
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
    const reset = () => setFilters({});
    const openBatch = row => {
      if (window.pmcWorkflow?.openForecastResultBatch) window.pmcWorkflow.openForecastResultBatch(row.batchId);
      else window.dispatchEvent(new CustomEvent('forecast-plan-route', { detail: { view: 'system-detail', detailId: row.batchId, step: 'forecast' } }));
    };
    const openCurrent = () => {
      const current = model.getCurrent();
      const target = rows.find(row => row.batchId === current?.id) || rows[0];
      if (target) openBatch(target);
    };
    const columns = [
      { title: '平台', dataIndex: 'platform', width: 90, fixed: 'left' },
      { title: '站点', dataIndex: 'country', width: 80 },
      { title: '店铺', dataIndex: 'store', width: 120 },
      { title: '父ASIN', dataIndex: 'parentASIN', width: 145 },
      { title: '子ASIN', dataIndex: 'childASIN', width: 145 },
      { title: '预测批次', width: 132, render: (_, row) => h(Button, { type: 'link', className: 'fp-link', onClick: () => openBatch(row) }, batchText(row)) },
      { title: '批次时间', width: 126, render: (_, row) => h('div', null, dayText(row.batchDate), h('div', { className: 'fp-muted' }, dateText(row.batchCreatedAt))) },
      { title: '预测范围', width: 190, render: (_, row) => `${dayText(row.forecastStartDate)} ~ ${dayText(row.forecastEndDate)}` },
      { title: '父ASIN预测总量', dataIndex: 'parentTotal', width: 132, align: 'right', render: value => h('strong', null, number(value)) },
      { title: '子ASIN预测总量', dataIndex: 'total', width: 132, align: 'right', render: value => h('strong', null, number(value)) },
      { title: '最终份额', dataIndex: 'finalShare', width: 92, align: 'right', render: percent },
      { title: '关系版本', dataIndex: 'relationVersion', width: 142 },
      { title: '状态', dataIndex: 'batchStatus', width: 112, render: statusTag },
      { title: '来源', width: 96, render: () => h(Tag, null, '规则预测') }
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
        toolbar: h(Button, { type: 'primary', onClick: openCurrent }, '打开当前批次')
      }, h(PlanTable, { rowKey: 'resultKey', dataSource: filteredRows, columns, scroll: { x: 1680 }, pagination: { pageSize: 12 }, locale: { emptyText: '未找到匹配的历史批次预测结果，请调整筛选项。' } }))
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
    useEffect(() => { if (initialStep) setStep(initialStep); }, [batchId, initialStep]);
    if (!batch) return h(Empty, { description: '预测批次不存在' });
    const content = { assessment: h(AssessmentStep, { batch, onStep: setStep }), parameters: h(ParameterStep, { batch }), relations: h(RelationStep, { batch }), split: h(SplitStep, { batch }), forecast: h(ForecastStep, { batch }), submission: h(WindowStep, { batch }), review: h(ReviewStep, { batch }) }[step];
    return h(React.Fragment, null, h(PlanHeader, { batch, onBack, onStep: setStep }), h(WorkflowSteps, { active: step, onChange: setStep }), content);
  }
  function ForecastPlanWorkspace() {
    useStoreRevision();
    const initialView = pendingRoute.view || 'plans';
    const [view, setView] = useState(initialView);
    const [detailId, setDetailId] = useState(pendingRoute.detailId);
    const [detailStep, setDetailStep] = useState(pendingRoute.step || 'assessment');
    useEffect(() => { const fn = event => { const route = event.detail || {}; setView(route.view || 'plans'); setDetailId(route.detailId || null); setDetailStep(route.step || 'assessment'); }; window.addEventListener('forecast-plan-route', fn); return () => window.removeEventListener('forecast-plan-route', fn); }, []);
    const open = id => { setDetailId(id); setView('plans'); setDetailStep('assessment'); };
    if (view === 'system-detail' && detailId) return h('div', { className: 'forecast-plan-root' }, h(PlanDetail, { batchId: detailId, initialStep: detailStep, onBack: () => window.pmcWorkflow?.showPlanningBaseTab?.() }));
    const activeView = view === 'results' ? 'results' : 'plans';
    const body = detailId ? h(PlanDetail, { batchId: detailId, initialStep: detailStep, onBack: () => setDetailId(null) }) : activeView === 'results' ? h(ResultsView) : h(BatchList, { onOpen: open });
    return h('div', { className: 'forecast-plan-root' }, h(Tabs, { className: 'fp-nav', size: 'small', tabBarStyle: { margin: 0 }, activeKey: activeView, onChange: key => { setView(key); setDetailId(null); setDetailStep('assessment'); }, items: [{ key: 'plans', label: '预测计划' }, { key: 'results', label: '预测结果' }] }), body);
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
