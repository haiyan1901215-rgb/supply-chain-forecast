/* config12: planning rule, relationship snapshot and parameter workbench. */
(() => {
  const h = React.createElement, PD = window.PlanningDomain;
  const { useEffect, useMemo, useState } = React;
  const { Alert, App, Button, Checkbox, Descriptions, Divider, Drawer, Empty, Form, Input, InputNumber, Modal, Popover, Radio, Segmented, Select, Space, Switch, Table, Tabs, Tag, Tooltip, Typography } = antd;
  const sourceGroups = typeof groups === 'undefined' ? [] : groups;
  const store = PD.createStore(sourceGroups, window.localStorage);
  const statusColor = { '草稿': 'default', '待确认': 'processing', '已生效': 'success', '已冻结': 'blue', '历史版本': 'default' };
  const pct = v => `${(Number(v || 0) / 100).toFixed(2).replace(/\.00$/, '')}%`;
  const dateText = v => String(v || '').slice(0, 16).replace('T', ' ');
  const relationKey = row => PD.groupKey(row);
  const formatBatch = v => String(v || '').replaceAll('-', '/');
  const copy = PD.clone;
  let requestedRoute = { tab: 'rules', sub: 'split' };

  function navigate(route) {
    requestedRoute = { ...requestedRoute, ...route };
    window.dispatchEvent(new CustomEvent('planning-route', { detail: requestedRoute }));
  }
  const notifyError = (message, error) => message.error(error?.message || '操作失败');
  function useStore() {
    const [revision, setRevision] = useState(0);
    useEffect(() => store.subscribe(() => setRevision(v => v + 1)), []);
    return [store.get(), revision];
  }
  function Head({ title, note, actions }) {
    return h('div', { className: 'pc12-head' }, h('div', null, h('div', { className: 'pc12-crumb' }, '计划配置'), h('h1', null, title), note && h('div', { className: 'pc12-subtitle' }, note)), actions && h(Space, { className: 'pc12-head-actions' }, actions));
  }
  function Status({ value }) { return h(Tag, { color: statusColor[value] }, value); }
  function Metric({ label, value }) { return h('div', { className: 'pc12-metric' }, h('span', null, label), h('strong', null, value)); }
  function SectionTitle({ title, extra }) { return h('div', { className: 'pc12-section-title' }, h('strong', null, title), extra); }
  function Field({ label, children, span = false }) { return h('label', { className: 'pc12-field' + (span ? ' pc12-span' : '') }, h('span', null, label), children); }
  const inputNumber = props => h(InputNumber, { min: 0, precision: 0, style: { width: '100%' }, ...props });
  const select = (options, props) => h(Select, { options: options.map(v => typeof v === 'string' ? { value: v, label: v } : v), style: { width: '100%' }, ...props });

  function RuleChain({ rule }) {
    if (!rule) return h(Empty, { image: Empty.PRESENTED_IMAGE_SIMPLE, description: '请选择规则查看计算链' });
    const split = rule.kind === 'split';
    const nodes = split ? [
      ['适用场景', `${rule.platform} · ${rule.country} · ${rule.scene}${rule.tag ? ' · ' + rule.tag : ''}`],
      ['数据口径', `${rule.history}天 Clean 销量${rule.method.includes('近期') || rule.abnormal ? ` + ${rule.recent}天近期 Clean 销量` : ''}`],
      ['基础计算', rule.method === '历史份额' ? '子ASIN Clean销量 ÷ 当前父体全部子ASIN Clean销量' : rule.method],
      ['异常判断', rule.abnormal ? `${rule.recent}天 Clean ADU < ${rule.adu} 且有销量天数 ≤ ${rule.sellingDays}` : '不启用异常子体修正'],
      ['参数修正', rule.method === '历史+近期加权' || rule.abnormal ? `${rule.historyWeight}% × 历史份额 + ${rule.recentWeight}% × 近期份额` : rule.method === '自定义规则' ? `历史份额保底 ${rule.floor}%` : '沿用基础份额'],
      ['归一化', rule.normalize ? '当前父ASIN子体份额重新归一化至100%' : '未开启'],
      ['最终输出', `子ASIN系统份额${rule.allowManual ? ' → PMC批次内调优 → 最终份额/预测' : ' → 最终份额/预测'}`]
    ] : [
      ['适用场景', `${rule.platform} · ${rule.country} · ${rule.lifecycle}`],
      ['数据口径', rule.clean],
      ['基础计算', `${rule.forecastHistory}天历史 + ${rule.forecastRecent}天近期`],
      ['趋势修正', `${rule.forecastHistoryWeight}% × 历史 + ${rule.forecastRecentWeight}% × 近期`],
      ['动态α', rule.alpha], ['季节 / Listing', `${rule.season} / ${rule.listing}`], ['最终输出', '父ASIN预测池日级预测']
    ];
    return h('div', { className: 'pc12-chain', 'aria-label': '规则计算链' }, nodes.map(([name, value], i) => h(React.Fragment, { key: name }, h('div', { className: 'pc12-chain-node' }, h('span', null, name), h('strong', null, value)), i < nodes.length - 1 && h(icons.DownOutlined, { className: 'pc12-chain-arrow' }))));
  }

  function RuleDrawer({ open, onClose, base, original, kind }) {
    const { message, modal } = App.useApp(), [form] = Form.useForm();
    const initial = original ? copy(original) : { ...PD.newRule(kind, store.get().params.at(-1)), code: kind === 'forecast' ? 'F-' : 'S-' };
    useEffect(() => { if (open) form.setFieldsValue(initial); }, [open, original?.code, base?.id]);
    const close = () => form.isFieldsTouched() ? modal.confirm({ title: '放弃未保存的规则？', okText: '放弃', cancelText: '继续编辑', onOk: onClose }) : onClose();
    const save = values => {
      try { const id = store.saveRule(base.id, { ...initial, ...values, kind }, original?.code); message.success(`已生成规则版本 ${id}`); form.resetFields(); onClose(id); }
      catch (e) { notifyError(message, e); }
    };
    const scenes = ['普通父ASIN', '新父体', '父子关系刚发生变化', '子ASIN低销量', '子ASIN近期波动明显', '特定国家', '特定商品类型', '特定业务标签'];
    const methods = ['历史份额', '近期份额', '历史+近期加权', '固定比例', '人工指定比例', '自定义规则'];
    return h(Drawer, { open, width: 736, title: original ? '编辑规则并生成新版本' : kind === 'forecast' ? '新增父ASIN预测规则' : '新增子ASIN拆解规则', onClose: close, destroyOnClose: true, footer: h('div', { className: 'pc12-drawer-actions' }, h(Button, { onClick: close }, '取消'), h(Button, { type: 'primary', onClick: () => form.submit() }, '保存为新版本')) },
      h(Form, { form, layout: 'vertical', initialValues: initial, onFinish: save, scrollToFirstError: true },
        h(Alert, { type: 'info', showIcon: true, message: `基于 ${base?.id} 新建不可变版本；已绑定历史批次不会改变。`, className: 'pc12-form-alert' }),
        h(Descriptions, { size: 'small', column: 3, className: 'pc12-rule-meta', items: [
          { key: 'version', label: '来源版本', children: base?.id || '' },
          { key: 'creator', label: '创建人', children: initial.creator || 'PMC计划员' },
          { key: 'updated', label: '最近修改', children: original ? dateText(original.updatedAt) : '新建后生成' }
        ] }),
        h('div', { className: 'pc12-form-grid' },
          h(Form.Item, { name: 'name', label: '规则名称', rules: [{ required: true, whitespace: true, message: '请输入规则名称' }, { max: 40 }] }, h(Input, { maxLength: 40, showCount: true })),
          h(Form.Item, { name: 'code', label: '规则编码', rules: [{ required: true, pattern: /^[A-Z][A-Z0-9-]{2,19}$/, message: '3～20位大写字母、数字或短横线' }] }, h(Input, { maxLength: 20 })),
          h(Form.Item, { name: 'platform', label: '适用平台', rules: [{ required: true }] }, select(['Amazon'])),
          h(Form.Item, { name: 'country', label: '适用国家', rules: [{ required: true }] }, select(['全部', 'US', 'UK', 'DE'])),
          h(Form.Item, { name: 'scope', label: '商品范围', rules: [{ required: true }] }, select(['全部商品', '服饰', '塑身衣', '运动内衣'])),
          h(Form.Item, { name: 'priority', label: '优先级（数字越小越优先）', rules: [{ required: true, type: 'integer', min: 1, max: 999 }] }, inputNumber({ min: 1, max: 999 })),
          h(Form.Item, { name: 'effective', label: '生效时间', rules: [{ required: true, pattern: /^\d{4}-\d{2}-\d{2}$/, message: '格式：YYYY-MM-DD' }] }, h(Input, { placeholder: '2026-10-28' })),
          h(Form.Item, { name: 'enabled', label: '状态', valuePropName: 'checked' }, h(Switch, { checkedChildren: '启用', unCheckedChildren: '停用' })),
          kind === 'forecast' ? h(React.Fragment, null,
            h(Form.Item, { name: 'lifecycle', label: '生命周期' }, select(['成长', '后期', '全部'])),
            h(Form.Item, { name: 'clean', label: 'Clean数据口径' }, h(Input, null)),
            h(Form.Item, { name: 'forecastHistory', label: '历史观察周期（天）', rules: [{ required: true, type: 'integer', min: 1, max: 180 }] }, inputNumber({ min: 1, max: 180 })),
            h(Form.Item, { name: 'forecastRecent', label: '近期观察周期（天）', rules: [{ required: true, type: 'integer', min: 1, max: 180 }] }, inputNumber({ min: 1, max: 180 })),
            h(Form.Item, { name: 'forecastHistoryWeight', label: '历史权重（%）', rules: [{ required: true, min: 0, max: 100 }] }, inputNumber({ max: 100 })),
            h(Form.Item, { name: 'forecastRecentWeight', label: '近期权重（%）', dependencies: ['forecastHistoryWeight'], rules: [{ required: true }, ({ getFieldValue }) => ({ validator(_, value) { return Number(value) + Number(getFieldValue('forecastHistoryWeight')) === 100 ? Promise.resolve() : Promise.reject(Error('两项权重合计必须为100%')); } })] }, inputNumber({ max: 100 })),
            h(Form.Item, { name: 'alpha', label: '动态α' }, h(Input, { placeholder: '0.10/0.20/0.35' })),
            h(Form.Item, { name: 'season', label: '季节系数' }, inputNumber({ precision: 2, step: .05 })),
            h(Form.Item, { name: 'listing', label: 'Listing适配系数' }, inputNumber({ precision: 2, step: .05 }))
          ) : h(React.Fragment, null,
            h(Form.Item, { name: 'scene', label: '适用场景' }, select(scenes)),
            h(Form.Item, { noStyle: true, shouldUpdate: (a, b) => a.scene !== b.scene }, ({ getFieldValue }) => getFieldValue('scene') === '特定业务标签' ? h(Form.Item, { name: 'tag', label: '业务标签', rules: [{ required: true, whitespace: true }] }, h(Input, { placeholder: '如：小众尺码' })) : null),
            h(Form.Item, { name: 'method', label: '计算方式' }, select(methods)),
            h(Form.Item, { noStyle: true, shouldUpdate: (a, b) => a.method !== b.method || a.abnormal !== b.abnormal || a.scene !== b.scene }, ({ getFieldValue }) => {
              const method = getFieldValue('method'), weighted = method === '历史+近期加权' || getFieldValue('abnormal'), fixed = ['固定比例', '人工指定比例'].includes(method);
              return h(React.Fragment, null,
                !fixed && h(Form.Item, { name: 'history', label: '历史观察周期（天）', rules: [{ required: true, type: 'integer', min: 1, max: 180 }] }, inputNumber({ min: 1, max: 180 })),
                (weighted || method === '近期份额') && h(Form.Item, { name: 'recent', label: '近期观察周期（天）', rules: [{ required: true, type: 'integer', min: 1, max: 180 }] }, inputNumber({ min: 1, max: 180 })),
                weighted && h(Form.Item, { name: 'historyWeight', label: '历史权重（%）' }, inputNumber({ max: 100 })),
                weighted && h(Form.Item, { name: 'recentWeight', label: '近期权重（%）', dependencies: ['historyWeight'], rules: [({ getFieldValue }) => ({ validator(_, value) { return Number(value) + Number(getFieldValue('historyWeight')) === 100 ? Promise.resolve() : Promise.reject(Error('两项权重合计必须为100%')); } })] }, inputNumber({ max: 100 })),
                fixed && h(Form.Item, { name: 'parent', label: '专项父ASIN', rules: [{ required: true, pattern: /^[A-Z0-9]{10}$/ }] }, h(Input, { placeholder: '10位父ASIN' })),
                fixed && h(Form.Item, { name: 'fixed', label: '子ASIN比例（每行：子ASIN=百分比）', className: 'pc12-full', rules: [{ required: true }] }, h(Input.TextArea, { rows: 4, placeholder: 'B0XXXXXXXX=40\nB0YYYYYYYY=60' })),
                method === '自定义规则' && h(Form.Item, { name: 'floor', label: '历史份额保底（%）' }, inputNumber({ max: 100 })),
                getFieldValue('scene') === '父子关系刚发生变化' && h(Form.Item, { name: 'changeDays', label: '关系变化观察期（天）' }, inputNumber({ min: 1, max: 180 }))
              );
            }),
            h(Form.Item, { name: 'abnormal', label: '低销量/不稳定子体修正', valuePropName: 'checked' }, h(Switch, null)),
            h(Form.Item, { noStyle: true, shouldUpdate: (a, b) => a.abnormal !== b.abnormal || a.scene !== b.scene }, ({ getFieldValue }) => getFieldValue('abnormal') || getFieldValue('scene') === '子ASIN低销量' ? h(React.Fragment, null,
              h(Form.Item, { name: 'adu', label: 'Clean ADU 小于' }, inputNumber({ precision: 2, step: .1 })),
              h(Form.Item, { name: 'sellingDays', label: '有销量天数小于等于' }, inputNumber({ min: 0, max: 180 }))
            ) : null),
            h(Form.Item, { name: 'normalize', label: '最终份额自动归一化', valuePropName: 'checked' }, h(Switch, null)),
            h(Form.Item, { name: 'allowManual', label: '允许批次内人工调配', valuePropName: 'checked' }, h(Switch, null))
          )
        ),
        h(Form.Item, { noStyle: true, shouldUpdate: true }, ({ getFieldsValue }) => h('div', { className: 'pc12-live-example' }, h('strong', null, '实时计算示例'), h('span', null, (() => {
          const v = getFieldsValue();
          if (kind === 'forecast') return `父体历史基准100件/日：${v.forecastHistoryWeight || 0}% × 100 + ${v.forecastRecentWeight || 0}% × 120 = ${(Number(v.forecastHistoryWeight || 0) + Number(v.forecastRecentWeight || 0) * 1.2).toFixed(1)}件/日，再应用季节与Listing系数。`;
          const history = 20, recent = 25;
          const result = v.method === '近期份额' ? recent : v.method === '历史+近期加权' || v.abnormal ? history * Number(v.historyWeight || 0) / 100 + recent * Number(v.recentWeight || 0) / 100 : v.method === '自定义规则' ? Math.max(history, Number(v.floor || 0)) : history;
          return `示例子体：历史份额20%，近期份额25% → 修正份额 ${result.toFixed(2)}% → 同父体全部子体归一化至100%。`;
        })())))
      ));
  }

  function RuleWorkspace({ initialSub = 'split', initialVersion = null }) {
    const [db] = useStore(), [kind, setKind] = useState(initialSub), [selectedId, setSelectedId] = useState(initialVersion), [drawer, setDrawer] = useState(null);
    useEffect(() => { const fn = e => { if (e.detail?.tab === 'rules') { setKind(e.detail.sub || 'split'); setSelectedId(e.detail.versionId || null); } }; window.addEventListener('planning-route', fn); return () => window.removeEventListener('planning-route', fn); }, []);
    const versions = db.rules.filter(v => v.kind === kind), latest = versions.at(-1), selected = versions.find(v => v.id === selectedId) || latest;
    const sample = db.versions.find(v => v.status === '草稿') || db.versions.at(-1);
    const row = kind === 'split' && selected && sample ? PD.calculate(sample.rows, selected.rules, sample.batch)[0] : null;
    const hitCode = row?.matches?.find(m => m.hit)?.code;
    const [selectedCode, setSelectedCode] = useState(null), active = selected?.rules.find(r => r.code === selectedCode) || selected?.rules.find(r => r.code === hitCode) || selected?.rules[0];
    useEffect(() => setSelectedCode(hitCode || selected?.rules[0]?.code), [selected?.id, hitCode]);
    const columns = [
      { title: '优先级', dataIndex: 'priority', width: 74, sorter: (a, b) => a.priority - b.priority },
      { title: '规则名称 / 编码', key: 'name', width: 240, render: (_, r) => h('div', { className: 'pc12-primary-cell' }, h('button', { onClick: () => setSelectedCode(r.code) }, r.name), h('span', null, r.code)) },
      { title: '适用范围', key: 'scope', width: 205, render: (_, r) => `${r.platform} · ${r.country} · ${kind === 'split' ? r.scene : r.lifecycle}` },
      { title: kind === 'split' ? '计算方式' : '观察周期', width: 150, render: (_, r) => kind === 'split' ? r.method : `${r.forecastHistory}/${r.forecastRecent}天` },
      { title: '状态', width: 82, render: (_, r) => h(Tag, { color: r.enabled ? 'success' : 'default' }, r.enabled ? '启用' : '停用') },
      { title: '操作', width: 72, render: (_, r) => h(Button, { type: 'link', onClick: () => setDrawer({ original: r }) }, '编辑') }
    ];
    const matches = row?.matches || [];
    return h(React.Fragment, null,
      h(Head, { title: '预测规则', note: '规则说明系统怎么算；规则编辑会形成新版本，历史批次保持原快照。', actions: [h(Button, { key: 'add', type: 'primary', icon: h(icons.PlusOutlined), onClick: () => setDrawer({}) }, kind === 'forecast' ? '新增父ASIN规则' : '新增拆解规则')] }),
      h(Segmented, { className: 'pc12-subnav', value: kind, onChange: setKind, options: [{ label: '父ASIN预测规则', value: 'forecast' }, { label: '子ASIN拆解规则', value: 'split' }] }),
      h('div', { className: 'pc12-versionbar' }, h('span', null, '当前查看版本'), select(versions.slice().reverse().map(v => ({ value: v.id, label: `${v.id} · ${dateText(v.createdAt)}` })), { value: selected?.id, onChange: setSelectedId, 'aria-label': '规则版本', style: { width: 270 } }), h(Tag, { color: 'blue' }, `共 ${selected?.rules.length || 0} 条规则`), h('span', { className: 'pc12-muted' }, '优先级数字越小越优先，命中后停止继续套用。')),
      h('div', { className: 'pc12-rule-layout' },
        h('section', { className: 'pc12-main-pane' }, h(Table, { size: 'small', rowKey: 'code', pagination: false, dataSource: selected?.rules || [], columns, rowClassName: r => r.code === active?.code ? 'pc12-row-selected' : '', onRow: r => ({ onClick: e => { if (!e.target.closest('button')) setSelectedCode(r.code); } }) })),
        h('aside', { className: 'pc12-context-pane' },
          h(SectionTitle, { title: '规则计算链', extra: active && h(Tag, null, active.code) }),
          h(RuleChain, { rule: active }),
          kind === 'split' && h(React.Fragment, null,
            h(Divider, null),
            h(SectionTitle, { title: '规则命中说明' }),
            row ? h('div', { className: 'pc12-hit' },
              h('strong', null, `${row.parent} / ${row.child}`),
              matches.map(m => h('div', { key: m.code }, h(Tag, { color: m.hit ? 'success' : 'default' }, m.hit ? '命中' : '跳过'), h('span', null, `${m.name}：${m.reason}`)))
            ) : h(Empty, { image: Empty.PRESENTED_IMAGE_SIMPLE })
          )
        )
      ),
      h(RuleDrawer, { open: !!drawer, onClose: id => { setDrawer(null); if (id) setSelectedId(id); }, base: selected, original: drawer?.original, kind })
    );
  }

  function NewVersionDrawer({ open, onClose }) {
    const [db] = useStore(), { message } = App.useApp(), [form] = Form.useForm();
    const latest = db.versions.at(-1), rules = kind => db.rules.filter(r => r.kind === kind);
    const initial = { baseId: latest?.id, batch: '2026-11-04', forecastId: rules('forecast').at(-1)?.id, splitId: rules('split').at(-1)?.id, paramId: db.params.at(-1)?.id };
    useEffect(() => { if (open) form.setFieldsValue(initial); }, [open]);
    return h(Drawer, { open, title: '新建父子关系版本', width: 576, onClose, destroyOnClose: true, footer: h('div', { className: 'pc12-drawer-actions' }, h(Button, { onClick: onClose }, '取消'), h(Button, { type: 'primary', onClick: () => form.submit() }, '创建草稿')) },
      h(Form, { form, layout: 'vertical', initialValues: initial, onFinish: values => { try { const id = store.createVersion(values); message.success(`已创建 ${id}`); onClose(id); } catch (e) { notifyError(message, e); } } },
        h(Alert, { type: 'info', showIcon: true, message: '从既有关系快照复制。新批次绑定规则、参数和关系版本，后续变化不会改写历史。', className: 'pc12-form-alert' }),
        h(Form.Item, { name: 'baseId', label: '来源关系版本', rules: [{ required: true }] }, select(db.versions.map(v => ({ value: v.id, label: `${v.id} · ${formatBatch(v.batch)} · ${v.status}` })))),
        h(Form.Item, { name: 'batch', label: '关联预测批次', rules: [{ required: true, pattern: /^\d{4}-\d{2}-\d{2}$/, message: '格式：YYYY-MM-DD' }] }, h(Input, null)),
        h(Form.Item, { name: 'forecastId', label: '父ASIN预测规则', rules: [{ required: true }] }, select(rules('forecast').map(v => v.id))),
        h(Form.Item, { name: 'splitId', label: '子ASIN拆解规则', rules: [{ required: true }] }, select(rules('split').map(v => v.id))),
        h(Form.Item, { name: 'paramId', label: '预测参数版本', rules: [{ required: true }] }, select(db.params.map(v => v.id)))
      ));
  }

  function AllocationPanel({ version, selected, onSelect }) {
    const { message } = App.useApp(), [mode, setMode] = useState('proportional'), [reason, setReason] = useState(), [note, setNote] = useState(''), [shares, setShares] = useState({});
    const editable = version.status === '草稿', siblings = selected ? version.rows.filter(r => relationKey(r) === relationKey(selected)) : [];
    useEffect(() => setShares(Object.fromEntries(siblings.map(r => [r.id, r.final / 100]))), [selected?.id, version.id]);
    if (!selected) return h('aside', { className: 'pc12-context-pane pc12-sticky' }, h(Empty, { image: Empty.PRESENTED_IMAGE_SIMPLE, description: '选择子ASIN查看计算与调配' }));
    const update = (row, value) => {
      value = Math.max(0, Math.min(100, Number(value || 0)));
      if (mode === 'manual') return setShares({ ...shares, [row.id]: value });
      const others = siblings.filter(r => r.id !== row.id), remainder = 100 - value, old = PD.sum(others.map(r => shares[r.id] || 0));
      const next = { ...shares, [row.id]: value };
      if (!others.length) next[row.id] = 100;
      else if (old > 0) { const distributed = PD.distribute(others.map(r => shares[r.id] || 0), Math.round(remainder * 100)); others.forEach((r, i) => next[r.id] = distributed[i] / 100); }
      else { const distributed = PD.distribute(others.map(() => 1), Math.round(remainder * 100)); others.forEach((r, i) => next[r.id] = distributed[i] / 100); }
      setShares(next);
    };
    const total = PD.sum(Object.values(shares));
    const save = () => { try { store.allocate(version.id, relationKey(selected), shares, reason, note); message.success('份额调配已保存并记录审计'); } catch (e) { notifyError(message, e); } };
    return h('aside', { className: 'pc12-context-pane pc12-sticky' },
      h(SectionTitle, { title: '子体份额调配', extra: h(Status, { value: version.status }) }),
      h('div', { className: 'pc12-selected-id' }, h('strong', null, selected.child), h('span', null, selected.parent)),
      h(Descriptions, { size: 'small', column: 2, items: [
        { key: 1, label: '历史份额', children: pct(Math.round(selected.metrics?.historyShare * 100)) }, { key: 2, label: '系统份额', children: pct(selected.system) },
        { key: 3, label: '命中规则', children: selected.ruleCode || '' }, { key: 4, label: '父体预测', children: `${selected.parentQty || 0}件` }
      ] }),
      h(Divider, null),
      h('span', { className: 'pc12-label' }, '调配方式'), h(Radio.Group, { value: mode, disabled: !editable, onChange: e => setMode(e.target.value), options: [{ value: 'proportional', label: '按比例压缩其他子体' }, { value: 'manual', label: '手工重新分配' }] }),
      h('div', { className: 'pc12-share-list' }, siblings.map(r => h('div', { key: r.id, className: r.id === selected.id ? 'active' : '' }, h('button', { onClick: () => onSelect(r) }, r.child), inputNumber({ value: shares[r.id], precision: 2, max: 100, addonAfter: '%', disabled: !editable, onChange: v => update(r, v), 'aria-label': `${r.child}最终份额` }), h('span', null, `≈ ${Math.round((r.parentQty || 0) * (shares[r.id] || 0) / 100)}件`)))),
      h('div', { className: Math.abs(total - 100) < .005 ? 'pc12-total valid' : 'pc12-total invalid' }, h('span', null, '合计'), h('strong', null, `${total.toFixed(2)}%`)),
      h('span', { className: 'pc12-label' }, '调整原因'), select(['尺码结构变化', '新增/下架子体', '近期销售表现异常', '商品运营策略', '其他'], { value: reason, disabled: !editable, placeholder: '请选择', onChange: setReason, 'aria-label': '调整原因' }),
      h('span', { className: 'pc12-label' }, '备注'), h(Input.TextArea, { rows: 2, maxLength: 200, showCount: true, value: note, disabled: !editable, onChange: e => setNote(e.target.value), 'aria-label': '调配备注' }),
      h(Button, { type: 'primary', block: true, className: 'pc12-save-share', disabled: !editable, onClick: save }, '保存调配'),
      !editable && h(Alert, { type: 'info', showIcon: true, className: 'pc12-readonly-alert', message: '该关系版本为只读快照。请为下一预测批次新建关系版本。' }),
      h(Divider, null), h(SectionTitle, { title: '为什么这样拆' }), h('div', { className: 'pc12-explain' },
        h('p', null, `${selected.metrics?.hist || 0}件 ÷ 父体${selected.metrics?.hTotal || 0}件 = ${Number(selected.metrics?.historyShare || 0).toFixed(2)}%`),
        h('p', null, `${selected.metrics?.recent || 0}件近期 Clean销量，ADU ${Number(selected.metrics?.adu || 0).toFixed(2)}，有销量${selected.metrics?.selling || 0}天。`),
        h('p', null, selected.unstable ? `命中异常修正：${selected.rule?.historyWeight}/${selected.rule?.recentWeight}加权后归一化。` : '未命中异常修正，按规则基础份额归一化。')
      )
    );
  }

  function RelationActionDrawer({ open, onClose, version, preset }) {
    const { message } = App.useApp(), [form] = Form.useForm(), type = Form.useWatch('type', form);
    const groups = Object.entries(version.rows.reduce((acc, r) => { acc[relationKey(r)] = r.parent; return acc; }, {})).map(([value, label]) => ({ value, label: `${label} · ${value.split('|')[2]}` }));
    useEffect(() => { if (open) form.setFieldsValue({ type: preset || '子ASIN更换父ASIN', ids: [], parentKey: groups[0]?.value, reason: '父体Listing结构调整' }); }, [open, preset]);
    return h(Drawer, { open, width: 576, title: '调整父子关系', onClose, destroyOnClose: true, footer: h('div', { className: 'pc12-drawer-actions' }, h(Button, { onClick: onClose }, '取消'), h(Button, { type: 'primary', onClick: () => form.submit() }, '提交变更')) },
      h(Form, { form, layout: 'vertical', onFinish: values => { try { store.changeRelations(version.id, values); message.success('关系已更新并记录变更'); onClose(); } catch (e) { notifyError(message, e); } } },
        h(Alert, { type: 'warning', showIcon: true, message: `影响范围：仅 ${formatBatch(version.batch)} 关系草稿。历史关系及已冻结批次不会改变。`, className: 'pc12-form-alert' }),
        h(Form.Item, { name: 'type', label: '变更类型', rules: [{ required: true }] }, select(['新增子ASIN', '移除子ASIN', '子ASIN更换父ASIN', '父ASIN拆分', '多个父ASIN关系调整'])),
        type === '新增子ASIN' ? h(React.Fragment, null,
          h(Form.Item, { name: 'parentKey', label: '目标父ASIN / 店铺', rules: [{ required: true }] }, select(groups)),
          h(Form.Item, { name: 'child', label: '新增子ASIN', rules: [{ required: true, pattern: /^[A-Z0-9]{10}$/, message: '请输入10位ASIN' }] }, h(Input, null)),
          h(Form.Item, { name: 'sellerSku', label: 'Seller SKU', rules: [{ required: true, whitespace: true }] }, h(Input, null))
        ) : h(React.Fragment, null,
          h(Form.Item, { name: 'ids', label: '选择子ASIN', rules: [{ required: true, type: 'array', min: 1, message: '至少选择一个子ASIN' }] }, select(version.rows.map(r => ({ value: r.id, label: `${r.child} · ${r.parent} · ${r.store}` })), { mode: 'multiple', showSearch: true, optionFilterProp: 'label' })),
          type !== '移除子ASIN' && h(Form.Item, { name: 'target', label: '目标父ASIN', rules: [{ required: true, pattern: /^[A-Z0-9]{10}$/, message: '请输入10位父ASIN' }] }, h(Input, null))
        ),
        h(Form.Item, { name: 'reason', label: '变更原因', rules: [{ required: true, whitespace: true }] }, h(Input, null)),
        h(Form.Item, { name: 'note', label: '备注' }, h(Input.TextArea, { rows: 3, maxLength: 200, showCount: true }))
      ));
  }

  function RelationDetail({ id, onBack }) {
    const [db] = useStore(), { message, modal } = App.useApp(), version = db.versions.find(v => v.id === id);
    const [queryMode, setQueryMode] = useState('parent'), [query, setQuery] = useState(''), [selected, setSelected] = useState(null), [action, setAction] = useState(false);
    if (!version) return h(Empty, { description: '关系版本不存在' });
    const editable = version.status === '草稿', groups = PD.parentGroups(version.rows), changes = db.changes.filter(c => c.versionId === version.id);
    const filtered = version.rows.filter(r => !query || (queryMode === 'parent' ? r.parent : r.child).includes(query.trim().toUpperCase()));
    const selectedLive = selected && version.rows.find(r => r.id === selected.id);
    const history = queryMode === 'child' && query.trim() ? store.history(query.trim().toUpperCase()) : [];
    const columns = [
      { title: '父ASIN', dataIndex: 'parent', width: 130, fixed: 'left', render: v => h(Typography.Text, { copyable: true }, v) },
      { title: '子ASIN', dataIndex: 'child', width: 132, fixed: 'left', render: v => h(Button, { type: 'link', className: 'pc12-cell-link' }, v) },
      { title: 'Seller SKU', dataIndex: 'sellerSku', width: 170, ellipsis: true },
      { title: '历史份额', width: 94, align: 'right', render: (_, r) => pct(Math.round((r.metrics?.historyShare || 0) * 100)) },
      { title: '系统份额', dataIndex: 'system', width: 94, align: 'right', render: pct },
      { title: '人工调整', width: 94, align: 'right', render: (_, r) => { const d = r.final - r.system; return h('span', { className: d ? 'pc12-adjusted' : 'pc12-muted' }, `${d > 0 ? '+' : ''}${pct(d)}`); } },
      { title: '最终份额', dataIndex: 'final', width: 96, align: 'right', render: v => h('strong', null, pct(v)) },
      { title: '最终预测', dataIndex: 'qty', width: 94, align: 'right', render: v => h('strong', null, `${v}件`) },
      { title: '命中规则', dataIndex: 'ruleCode', width: 112, render: v => h(Tag, null, v || '未命中') },
      { title: '关系状态', dataIndex: 'relationState', width: 112, render: v => h(Tag, { color: v === '平台同步' ? 'default' : 'warning' }, v) }
    ];
    const transition = target => { try { store.transition(version.id, target); message.success(`关系版本已变更为${target}`); } catch (e) { notifyError(message, e); } };
    const actionButtons = editable ? [h(Button, { key: 'relation', icon: h(icons.SwapOutlined), onClick: () => setAction(true) }, '调整关系'), h(Button, { key: 'submit', type: 'primary', onClick: () => transition('待确认') }, '提交确认')] : version.status === '待确认' ? [h(Button, { key: 'return', onClick: () => transition('草稿') }, '退回草稿'), h(Button, { key: 'activate', type: 'primary', onClick: () => transition('已生效') }, '确认生效')] : version.status === '已生效' ? [h(Button, { key: 'freeze', type: 'primary', onClick: () => modal.confirm({ title: '冻结关系版本？', content: '冻结后不能解冻或直接修改；后续调整需新建下一批次关系版本。', okText: '确认冻结', cancelText: '取消', onOk: () => transition('已冻结') }) }, '冻结版本')] : [];
    return h(React.Fragment, null,
      h(Head, { title: `${version.id} · 父子关系版本`, note: '关系版本回答本批次“谁属于谁”；历史销量按国家 + 店铺 + 子ASIN归集到本版本父体预测池。', actions: [h(Button, { key: 'back', icon: h(icons.ArrowLeftOutlined), onClick: onBack }, '返回版本列表'), ...actionButtons] }),
      h('div', { className: 'pc12-summary' }, h(Metric, { label: '关联预测批次', value: formatBatch(version.batch) }), h(Metric, { label: '父ASIN', value: `${groups.length}个` }), h(Metric, { label: '子ASIN', value: `${version.rows.length}个` }), h(Metric, { label: '关系变更', value: `${changes.length}条` }), h(Metric, { label: '人工调配', value: `${changes.filter(c => c.type === '份额调优').length}条` }), h(Metric, { label: '状态', value: h(Status, { value: version.status }) })),
      h('div', { className: 'pc12-basis' }, h('strong', null, '计算依据'), [['父ASIN预测规则', version.forecastId, 'forecast'], ['子ASIN拆解规则', version.splitId, 'split'], ['父子关系', version.id, 'relation'], ['预测参数', version.paramId, 'params']].map(([label, value, target]) => h(Button, { key: label, className: 'pc12-basis-link', type: 'link', onClick: () => target === 'relation' ? null : navigate({ tab: target === 'params' ? 'params' : 'rules', sub: target, versionId: value }) }, `${label}：${value}`))),
      h('div', { className: 'pc12-filterbar' }, h(Radio.Group, { value: queryMode, onChange: e => { setQueryMode(e.target.value); setQuery(''); }, optionType: 'button', buttonStyle: 'solid', options: [{ label: '按父ASIN', value: 'parent' }, { label: '按子ASIN', value: 'child' }] }), h(Input.Search, { value: query, allowClear: true, placeholder: queryMode === 'parent' ? '输入父ASIN' : '输入子ASIN反查历史父体', onChange: e => setQuery(e.target.value.toUpperCase()), style: { width: 310 } }), h('span', { className: 'pc12-muted' }, `当前显示 ${filtered.length} 条 · 点击子ASIN在右侧查看与调配`)),
      h('div', { className: 'pc12-relation-layout' }, h('section', { className: 'pc12-main-pane' }, h(Table, { className: 'pc12-relation-table', size: 'small', rowKey: 'id', sticky: true, pagination: { pageSize: 20, showSizeChanger: false, showTotal: n => `共 ${n} 条` }, scroll: { x: 1260, y: 480 }, columns, dataSource: filtered, rowClassName: r => r.id === selectedLive?.id ? 'pc12-row-selected' : '', onRow: r => ({ onClick: () => setSelected(r) }) }),
        queryMode === 'child' && query.trim() && h('section', { className: 'pc12-history-block' }, h(SectionTitle, { title: '历史挂靠关系', extra: h('span', { className: 'pc12-muted' }, `${query.trim()} · 当前页面追溯`) }), history.length ? h(Table, { size: 'small', rowKey: r => r.versionId + r.id, pagination: false, dataSource: history, columns: [{ title: '预测批次', dataIndex: 'batch', render: formatBatch }, { title: '关系版本', dataIndex: 'versionId' }, { title: '当时父ASIN', dataIndex: 'parent' }, { title: '当时份额', dataIndex: 'final', align: 'right', render: pct }, { title: '关系状态', dataIndex: 'status', render: v => h(Status, { value: v }) }] }) : h(Empty, { image: Empty.PRESENTED_IMAGE_SIMPLE, description: '未找到已生效/冻结的历史关系' }))),
        h(AllocationPanel, { version, selected: selectedLive, onSelect: setSelected })),
      h(RelationActionDrawer, { open: action, onClose: () => setAction(false), version })
    );
  }

  function VersionList({ openDetail }) {
    const [db] = useStore(), [drawer, setDrawer] = useState(false), [query, setQuery] = useState('');
    const rows = db.versions.slice().reverse().filter(v => !query || [v.id, v.batch].some(s => s.includes(query)));
    const columns = [
      { title: '关系版本', dataIndex: 'id', width: 150, render: (v, r) => h(Button, { type: 'link', onClick: () => openDetail(r.id) }, v) },
      { title: '关联预测批次', dataIndex: 'batch', width: 130, render: formatBatch }, { title: '平台', dataIndex: 'platform', width: 90 }, { title: '国家', dataIndex: 'country', width: 90 },
      { title: '生效时间', dataIndex: 'effective', width: 120, render: formatBatch }, { title: '父ASIN数', width: 96, align: 'right', render: (_, r) => PD.parentGroups(r.rows).length }, { title: '子ASIN数', width: 96, align: 'right', render: (_, r) => r.rows.length },
      { title: '关系变更', width: 96, align: 'right', render: (_, r) => db.changes.filter(c => c.versionId === r.id && c.type !== '份额调优').length }, { title: '人工调配', width: 96, align: 'right', render: (_, r) => db.changes.filter(c => c.versionId === r.id && c.type === '份额调优').length },
      { title: '状态', dataIndex: 'status', width: 100, render: v => h(Status, { value: v }) }, { title: '操作', width: 82, fixed: 'right', render: (_, r) => h(Button, { type: 'link', onClick: () => openDetail(r.id) }, '查看') }
    ];
    return h(React.Fragment, null,
      h(Head, { title: '父子关系版本', note: '每个预测批次锁定一份关系快照，当前变化不重新解释历史预测。', actions: [h(Button, { key: 'new', type: 'primary', icon: h(icons.PlusOutlined), onClick: () => setDrawer(true) }, '新建关系版本')] }),
      h('div', { className: 'pc12-filterbar' }, h(Input.Search, { allowClear: true, placeholder: '关系版本 / 预测批次', onSearch: setQuery, style: { width: 300 } }), h('span', { className: 'pc12-muted' }, '草稿 → 待确认 → 已生效 → 已冻结；冻结后不可直接修改。')),
      h(Table, { size: 'small', rowKey: 'id', sticky: true, scroll: { x: 1220 }, pagination: false, dataSource: rows, columns }),
      h(NewVersionDrawer, { open: drawer, onClose: id => { setDrawer(false); if (id) openDetail(id); } })
    );
  }

  function ChangeLog() {
    const [db] = useStore(), [filters, setFilters] = useState({});
    const set = (key, value) => setFilters({ ...filters, [key]: value });
    const rows = db.changes.filter(c => ['batch', 'child', 'country', 'type', 'actor'].every(k => !filters[k] || c[k]?.includes(filters[k])) && (!filters.parent || c.from?.includes(filters.parent) || c.to?.includes(filters.parent)) && (!filters.time || c.at?.slice(0, 10).includes(filters.time)));
    const columns = [{ title: '变更时间', dataIndex: 'at', width: 155, render: dateText }, { title: '子ASIN', dataIndex: 'child', width: 125 }, { title: '原父ASIN', dataIndex: 'from', width: 125 }, { title: '新父ASIN', dataIndex: 'to', width: 125 }, { title: '变更类型', dataIndex: 'type', width: 140, render: v => h(Tag, null, v) }, { title: '变更前份额', dataIndex: 'before', align: 'right', width: 105, render: v => v == null ? '' : pct(v) }, { title: '变更后份额', dataIndex: 'after', align: 'right', width: 105, render: v => v == null ? '' : pct(v) }, { title: '预测批次', dataIndex: 'batch', width: 115, render: formatBatch }, { title: '国家', dataIndex: 'country', width: 70 }, { title: '操作人', dataIndex: 'actor', width: 100 }, { title: '原因 / 备注', width: 230, render: (_, r) => h('div', null, r.reason, r.note && h('div', { className: 'pc12-muted' }, r.note)) }];
    return h(React.Fragment, null, h(Head, { title: '关系变更记录', note: '父子迁移、拆分、新增移除和份额调优均保留批次、前后值、原因与操作人。' }),
      h('div', { className: 'pc12-filterbar pc12-wrap' }, ...[['batch', '预测批次'], ['parent', '父ASIN'], ['child', '子ASIN'], ['country', '国家'], ['type', '变更类型'], ['actor', '操作人'], ['time', '时间 YYYY-MM-DD']].map(([k, p]) => h(Input, { key: k, allowClear: true, placeholder: p, value: filters[k], onChange: e => set(k, e.target.value), style: { width: k === 'type' || k === 'time' ? 150 : 130 } })), h(Button, { onClick: () => setFilters({}) }, '重置')),
      h(Table, { size: 'small', rowKey: 'id', sticky: true, scroll: { x: 1450, y: 540 }, pagination: { pageSize: 20, showSizeChanger: false }, dataSource: rows, columns }));
  }

  function RelationshipWorkspace({ requestedId }) {
    const [view, setView] = useState('versions'), [detailId, setDetailId] = useState(requestedId || null);
    useEffect(() => { const fn = e => { if (e.detail?.tab === 'relations') { setView('versions'); if (e.detail.versionId) setDetailId(e.detail.versionId); } }; window.addEventListener('planning-route', fn); return () => window.removeEventListener('planning-route', fn); }, []);
    if (detailId) return h(RelationDetail, { id: detailId, onBack: () => setDetailId(null) });
    return h(React.Fragment, null, h(Segmented, { className: 'pc12-subnav', value: view, onChange: setView, options: [{ label: '关系版本', value: 'versions' }, { label: '关系变更记录', value: 'changes' }] }), view === 'versions' ? h(VersionList, { openDetail: setDetailId }) : h(ChangeLog));
  }

  function ParametersWorkspace({ requestedId = null }) {
    const [db] = useStore(), { message } = App.useApp(), [section, setSection] = useState('sales'), [selectedId, setSelectedId] = useState(requestedId), [form] = Form.useForm();
    const current = db.params.find(p => p.id === selectedId) || db.params.at(-1);
    useEffect(() => { const fn = e => { if (e.detail?.tab === 'params') setSelectedId(e.detail.versionId || null); }; window.addEventListener('planning-route', fn); return () => window.removeEventListener('planning-route', fn); }, []);
    useEffect(() => form.setFieldsValue(current), [current.id]);
    const save = values => { try { const id = store.saveParams({ ...current, ...values }); setSelectedId(id); message.success(`已生成参数版本 ${id}`); } catch (e) { notifyError(message, e); } };
    const sectionFields = {
      sales: [['growthHistory', '成长款历史周期（天）'], ['growthRecent', '成长款近期周期（天）'], ['lateHistory', '后期历史周期（天）'], ['lateRecent', '后期近期周期（天）']],
      share: [['history', '子体历史份额周期（天）'], ['recent', '子体近期份额周期（天）']],
      threshold: [['adu', 'Clean ADU阈值'], ['sellingDays', '近期有销量天数阈值']],
      weight: [['historyWeight', '子体历史份额权重（%）'], ['recentWeight', '子体近期份额权重（%）'], ['season', '默认季节系数'], ['listing', '默认Listing适配系数']]
    };
    return h(React.Fragment, null, h(Head, { title: '预测参数', note: '参数提供规则默认值与数据口径；正式批次记录参数版本，历史结果不随当前配置改变。' }),
      h('div', { className: 'pc12-versionbar' }, h('span', null, '当前查看版本'), select(db.params.slice().reverse().map(p => ({ value: p.id, label: `${p.id} · ${dateText(p.createdAt)}` })), { value: current.id, onChange: setSelectedId, 'aria-label': '参数版本', style: { width: 270 } }), h('span', { className: 'pc12-muted' }, `被 ${db.versions.filter(v => v.paramId === current.id).length} 个关系批次引用`)),
      h(Segmented, { className: 'pc12-subnav', value: section, onChange: section => { setSection(section); form.resetFields(); }, options: [{ label: '销售周期', value: 'sales' }, { label: '份额观察周期', value: 'share' }, { label: '异常判断阈值', value: 'threshold' }, { label: '权重参数', value: 'weight' }] }),
      h('div', { className: 'pc12-param-layout' }, h('section', { className: 'pc12-param-form' }, h(SectionTitle, { title: `${current.id} · ${current.basis}` }), h(Form, { form, layout: 'vertical', initialValues: current, onFinish: save }, h('div', { className: 'pc12-form-grid' }, sectionFields[section].map(([name, label]) => h(Form.Item, { key: name, name, label, rules: [{ required: true, type: 'number', min: name === 'sellingDays' ? 0 : .01 }] }, inputNumber({ precision: ['adu', 'season', 'listing'].includes(name) ? 2 : 0, max: name.includes('Weight') ? 100 : 180 })))), h(Form.Item, { className: 'pc12-full' }, h(Button, { type: 'primary', htmlType: 'submit' }, '保存为新参数版本')))),
        h('aside', { className: 'pc12-context-pane' }, h(SectionTitle, { title: '版本使用情况' }), h('div', { className: 'pc12-version-list' }, db.params.slice().reverse().map(p => h('div', { key: p.id }, h('strong', null, p.id), h('span', null, dateText(p.createdAt)), h('span', null, `绑定 ${db.versions.filter(v => v.paramId === p.id).length} 个关系批次`)))), h(Alert, { type: 'info', showIcon: true, message: '规则实例中的显式参数优先。修改此处生成新参数版本，不批量覆盖既有规则或批次。' })))
    );
  }

  function FlowStrip() {
    return h('div', { className: 'pc12-flow' }, ['预测批次', '规则版本', '父子关系版本', '父ASIN预测池', '子ASIN系统份额', 'PMC人工调配', '子ASIN最终预测'].map((v, i, all) => h(React.Fragment, { key: v }, h('span', null, v), i < all.length - 1 && h(icons.RightOutlined, null))));
  }
  function ParentAsinWorkspace() {
    const [tab, setTab] = useState(requestedRoute.tab || 'rules'), [route, setRoute] = useState(requestedRoute);
    useEffect(() => { const fn = e => { const next = e.detail || requestedRoute; setRoute(next); setTab(next.tab || 'rules'); }; window.addEventListener('planning-route', fn); return () => window.removeEventListener('planning-route', fn); }, []);
    const items = [{ key: 'rules', label: '预测规则' }, { key: 'relations', label: '父子关系' }, { key: 'params', label: '预测参数' }];
    const body = h('div', { className: 'pc12-workspace' }, store.error() && h(Alert, { type: 'error', showIcon: true, message: store.error() }), h(FlowStrip), h(Tabs, { className: 'pc12-tabs', activeKey: tab, onChange: key => { setTab(key); setRoute({ tab: key }); }, items }), tab === 'rules' ? h(RuleWorkspace, { initialSub: route.sub, initialVersion: route.versionId }) : tab === 'relations' ? h(RelationshipWorkspace, { requestedId: route.versionId }) : h(ParametersWorkspace, { requestedId: route.versionId }));
    return h(antd.ConfigProvider, { theme: { token: { fontSize: 14 }, components: { Table: { fontSize: 13 }, Form: { labelFontSize: 12 } } } }, body);
  }
  window.ParentAsinModule = { ParentAsinWorkspace, navigate, getCurrentBasis() { const db = store.get(), current = db.versions.find(v => v.batch === (typeof currentBatch === 'string' ? currentBatch : '2026-10-21')) || db.versions.at(-1); return { batch: current.batch, forecast: current.forecastId, split: current.splitId, relation: current.id, params: current.paramId, status: current.status }; } };
})();
