/* V0.3.3-pmc11: configurable planning rules, relation maintenance, and demo workflow states. */
(() => {
  const h = React.createElement;
  const { useMemo, useState } = React;
  const {
    Alert,
    App,
    Button,
    Checkbox,
    Drawer,
    Empty,
    Input,
    InputNumber,
    Modal,
    Radio,
    Select,
    Space,
    Switch,
    Table,
    Tabs,
    Tag,
    Tooltip,
    Typography
  } = antd;

  const flag = { US: '🇺🇸', UK: '🇬🇧', DE: '🇩🇪' };
  const currentBatchLabel = typeof currentBatch === 'string' ? currentBatch.replaceAll('-', '/') : '2026/10/21';
  const formatNumber = value => Number(value || 0).toLocaleString('zh-CN');
  const formatPercent = value => `${Number(value || 0).toFixed(1)}%`;
  const closeTo = (value, target) => Math.abs(Number(value || 0) - target) < 0.05;
  const sourceGroups = typeof groups === 'undefined' ? [] : groups;

  const forecastRuleSeed = [
    { key: 'forecast-default-growth', name: '成长款默认预测', scope: '全局默认', lifecycle: '成长', historyWindow: 30, recentWindow: 10, historyWeight: 40, recentWeight: 60, alpha: '0.10 / 0.20 / 0.35', seasonal: '启用', listing: '启用', status: '启用', note: '当前说明书成长款初始化规则' },
    { key: 'forecast-default-mature', name: '成熟款默认预测', scope: '全局默认', lifecycle: '成熟 / 后期', historyWindow: 45, recentWindow: 20, historyWeight: 30, recentWeight: 70, alpha: '0.10 / 0.20 / 0.35', seasonal: '启用', listing: '启用', status: '启用', note: '当前说明书后期初始化规则' },
    { key: 'forecast-us-new', name: 'US 新品观察期', scope: 'Amazon / US', lifecycle: '新品', historyWindow: 28, recentWindow: 14, historyWeight: 30, recentWeight: 70, alpha: '0.05 / 0.10 / 0.20', seasonal: '启用', listing: '按新品', status: '草稿', note: '演示：新品不直接覆盖已冻结批次' }
  ];
  const splitRuleSeed = [
    { key: 'split-default', name: '默认子体拆解', scope: '全部', conditionText: '全部子ASIN', baseWindow: 84, recentWindow: '', judgement: '无', historyWeight: 100, recentWeight: '', method: '历史份额', priority: 100, status: '启用', normalize: true, conditions: [] },
    { key: 'split-low-volume', name: '低销量不稳定调和', scope: '全部 Amazon', conditionText: '14天 Clean ADU < 2 且有销量天数 ≤ 10', baseWindow: 84, recentWindow: 14, judgement: 'ADU<2 且天数≤10', historyWeight: 70, recentWeight: 30, method: '历史 + 近期调和', priority: 20, status: '启用', normalize: true, conditions: [{ field: '近14天 Clean ADU', operator: '小于', value: '2' }, { field: '近14天有销量天数', operator: '小于等于', value: '10' }] },
    { key: 'split-minority-size', name: '小众尺码保护', scope: 'US / 畅款', conditionText: '变体标签 = 小众尺码', baseWindow: 56, recentWindow: 14, judgement: '按标签匹配', historyWeight: 50, recentWeight: 50, method: '历史 + 近期调和', priority: 30, status: '草稿', normalize: true, conditions: [{ field: '变体标签', operator: '等于', value: '小众尺码' }] },
    { key: 'split-new-version', name: '新版本观察', scope: 'US / 新版本', conditionText: 'SKU版本 = 新', baseWindow: 28, recentWindow: 14, judgement: '按版本匹配', historyWeight: 30, recentWeight: 70, method: '历史 + 近期调和', priority: 25, status: '草稿', normalize: true, conditions: [{ field: 'SKU版本', operator: '等于', value: '新' }] }
  ];
  const parameterVersionSeed = [
    { key: 'v11', version: 'V1.1', createdAt: '2026/10/01 09:00', scope: 'Amazon / 全部站点', description: '默认规则与低销量调和规则', batch: '2026/10/21', status: '当前使用', lock: '已冻结' },
    { key: 'v12', version: 'V1.2', createdAt: '2026/10/20 16:30', scope: 'US / 畅款 / 新版本', description: '增加小众尺码与新品专项规则', batch: '未绑定', status: '草稿', lock: '可编辑' },
    { key: 'v10', version: 'V1.0', createdAt: '2026/09/01 09:00', scope: 'Amazon / 全部站点', description: '首版默认拆解规则', batch: '2026/09/23', status: '已归档', lock: '历史快照' }
  ];

  function buildRelationGroups() {
    const previousParents = ['B0H7K3L9P2', 'B0H8M4R6T1', 'B0H9N5S7V3'];
    return sourceGroups.filter(group => group.children?.length >= 2).flatMap((group, groupIndex) => {
      const children = group.children.slice(0, 4);
      const versions = [
        { version: 'R01', effectiveAt: '2026/07/01', status: '历史', parent: previousParents[groupIndex % previousParents.length], source: '平台同步', changedAt: '2026/07/01', current: false },
        { version: 'R02', effectiveAt: '2026/08/15', status: '历史', parent: `B0${String(6 + groupIndex)}J${String(4 + groupIndex)}N${String(7 + groupIndex)}Q${String(2 + groupIndex)}M`, source: '平台同步', changedAt: '2026/08/15', current: false },
        { version: 'R03', effectiveAt: '2026/09/10', status: groupIndex === 1 ? '已发生变化' : '本批次已冻结', parent: group.parent, source: groupIndex === 1 ? '人工维护' : '平台同步', changedAt: groupIndex === 1 ? '2026/10/20' : '2026/09/10', current: true }
      ];
      return [versions[2], versions[1], versions[0]].map(version => {
        const rows = children.map((child, childIndex) => ({
          key: `relation-${group.id}-${version.version}-${child.id}`,
          type: 'child',
          spu: group.spu,
          version: version.version,
          effectiveAt: version.effectiveAt,
          current: version.current,
          parent: version.parent,
          parentKey: group.id,
          child: child.asin,
          site: group.market || 'US',
          store: group.account || 'BRABIC-US',
          source: version.source,
          status: version.status,
          volume84: version.current ? Math.round((child.base || 24) * 42 + (3 - childIndex) * 18) : null,
          changedAt: version.changedAt,
          size: child.size,
          color: child.color
        }));
        const total = rows.reduce((sum, child) => sum + (child.volume84 || 0), 0);
        return {
          key: `relation-parent-${group.id}-${version.version}`,
          type: 'parent',
          spu: group.spu,
          version: version.version,
          effectiveAt: version.effectiveAt,
          current: version.current,
          parent: version.parent,
          site: group.market || 'US',
          store: group.account || 'BRABIC-US',
          childCount: rows.length,
          source: version.source,
          status: version.status,
          volume84: version.current ? total : null,
          share84: version.current ? 100 : null,
          changedAt: version.changedAt,
          children: rows.map(child => ({ ...child, share84: total && child.volume84 != null ? child.volume84 / total * 100 : null }))
        };
      });
    });
  }

  function buildSplitGroups() {
    const weights = {
      2: [58, 42],
      3: [46, 32, 22],
      4: [40, 30, 20, 10]
    };
    return sourceGroups.filter(group => group.children?.length >= 2).slice(0, 3).map((group, groupIndex) => {
      const children = group.children.slice(0, 4);
      const parentTotal = [1000, 860, 720][groupIndex] || 600;
      const baseWeights = weights[children.length] || weights[4];
      const rows = children.map((child, childIndex) => {
        const weight = baseWeights[childIndex] || 10;
        const volume84 = Math.max(20, Math.round(parentTotal * weight / 100));
        const clean14 = Math.max(6, Math.round(volume84 / 6.4) - childIndex * 2 - (groupIndex === 1 ? 2 : 0));
        const sellingDays = Math.max(5, 12 - childIndex * 2 - (groupIndex === 2 ? 2 : 0));
        return {
          key: `split-${group.id}-${child.id}`,
          parentKey: group.id,
          parent: group.parent,
          child: child.asin,
          site: group.market || 'US',
          store: group.account || 'BRABIC-US',
          size: child.size,
          color: child.color,
          parentTotal,
          volume84,
          clean14,
          sellingDays,
          unstable: clean14 / 14 < 2 && sellingDays <= 10,
          systemShare: 0,
          reason: childIndex === children.length - 1 ? '近期销量不稳定' : '正常'
        };
      });
      const total84 = rows.reduce((sum, row) => sum + row.volume84, 0);
      const total14 = rows.reduce((sum, row) => sum + row.clean14, 0);
      rows.forEach(row => {
        row.share84 = total84 ? row.volume84 / total84 * 100 : 0;
        row.share14 = total14 ? row.clean14 / total14 * 100 : 0;
        row.systemShare = row.unstable ? row.share84 * 0.7 + row.share14 * 0.3 : row.share84;
      });
      const systemTotal = rows.reduce((sum, row) => sum + row.systemShare, 0);
      rows.forEach(row => { row.systemShare = systemTotal ? row.systemShare / systemTotal * 100 : 0; });
      return {
        key: `split-parent-${group.id}`,
        parentKey: group.id,
        spu: group.spu,
        version: 'R03',
        effectiveAt: '2026/09/10',
        parent: group.parent,
        site: group.market || 'US',
        store: group.account || 'BRABIC-US',
        parentTotal,
        children: rows
      };
    });
  }

  function asOptions(values, allLabel) {
    return [{ value: '', label: allLabel }, ...values.map(value => ({ value, label: value }))];
  }

  function statusTag(value) {
    const color = value === '本批次已冻结' ? 'blue' : value === '已发生变化' ? 'warning' : value === '当前有效' ? 'success' : 'default';
    return h(Tag, { color, style: { marginInlineEnd: 0 } }, value);
  }

  const editorField = (label, control) => h('label', { className: 'decomp-editor-field' }, h('span', null, label), control);
  const statusConfig = value => ({ 启用: 'success', 草稿: 'warning', 当前使用: 'processing', 已归档: 'default' }[value] || 'default');

  function ForecastRulesTab() {
    const { message } = App.useApp();
    const [rows, setRows] = useState(forecastRuleSeed);
    const [scope, setScope] = useState('');
    const [editor, setEditor] = useState(null);
    const filtered = rows.filter(row => !scope || row.scope.includes(scope));
    const newDraft = () => setEditor({ mode: 'new', key: `forecast-${Date.now()}`, name: '', scope: '全局默认', lifecycle: '全部', historyWindow: 30, recentWindow: 14, historyWeight: 50, recentWeight: 50, alpha: '0.10 / 0.20 / 0.35', seasonal: '启用', listing: '启用', status: '草稿', note: '' });
    const save = () => {
      if (!editor.name.trim()) return message.warning('请填写预测规则名称');
      if (Number(editor.historyWeight || 0) + Number(editor.recentWeight || 0) !== 100) return message.warning('历史权重与近期权重合计必须为100%');
      setRows(old => editor.mode === 'new' ? [editor, ...old] : old.map(row => row.key === editor.key ? editor : row));
      setEditor(null);
      message.success('预测规则已保存为配置草稿，不会改写已冻结批次');
    };
    const columns = [
      { title: '规则名称', dataIndex: 'name', width: 165, fixed: 'left', render: value => h('strong', { className: 'decomp-table-strong' }, value) },
      { title: '适用范围', dataIndex: 'scope', width: 125 },
      { title: '生命周期', dataIndex: 'lifecycle', width: 105 },
      { title: '历史观察周期', dataIndex: 'historyWindow', width: 105, align: 'right', render: value => `${value}天` },
      { title: '近期观察周期', dataIndex: 'recentWindow', width: 105, align: 'right', render: value => value ? `${value}天` : '' },
      { title: '历史权重', dataIndex: 'historyWeight', width: 85, align: 'right', render: value => value == null ? '' : `${value}%` },
      { title: '近期权重', dataIndex: 'recentWeight', width: 85, align: 'right', render: value => value == null ? '' : `${value}%` },
      { title: '动态α', dataIndex: 'alpha', width: 125 },
      { title: '季节 / Listing', key: 'adapt', width: 135, render: (_, row) => `${row.seasonal} / ${row.listing}` },
      { title: '状态', dataIndex: 'status', width: 85, render: value => h(Tag, { color: statusConfig(value), style: { marginInlineEnd: 0 } }, value) },
      { title: '操作', key: 'action', width: 90, fixed: 'right', render: (_, row) => h(Button, { type: 'link', size: 'small', onClick: () => setEditor({ mode: 'edit', ...row }) }, '编辑') }
    ];
    return h(React.Fragment, null,
      h(Alert, { className: 'decomp-config-alert', type: 'info', showIcon: true, message: '预测规则只定义父ASIN总量如何计算；保存后进入参数版本，已绑定批次按快照继续使用。' }),
      h('div', { className: 'decomp-filter-panel decomp-rule-toolbar' },
        h(Select, { size: 'small', value: scope, onChange: setScope, options: asOptions(['全局默认', 'Amazon / US', 'Amazon / UK'], '全部适用范围'), 'aria-label': '预测规则适用范围' }),
        h(Space, { size: 8 }, h(Button, { type: 'primary', size: 'small', onClick: newDraft }, '新建预测规则'), h(Button, { size: 'small', onClick: () => setScope('') }, '重置筛选')),
        h('span', { className: 'decomp-filter-spacer' }), h('span', { className: 'decomp-toolbar-note' }, '父体总预测 · ADU · 生命周期 · 季节性')
      ),
      h(Table, { className: 'decomp-table decomp-config-table', size: 'small', rowKey: 'key', dataSource: filtered, columns, scroll: { x: 1240, y: 420 }, pagination: { size: 'small', showSizeChanger: true, showTotal: total => `共 ${total} 条预测规则` } }),
      h(Drawer, { title: editor?.mode === 'new' ? '新建预测规则' : '编辑预测规则', open: Boolean(editor), onClose: () => setEditor(null), width: 520, destroyOnHidden: true, footer: h(Space, null, h(Button, { onClick: () => setEditor(null) }, '取消'), h(Button, { type: 'primary', onClick: save }, '保存为草稿')) }, editor ? h('div', { className: 'decomp-editor-drawer' },
        h(Alert, { type: 'info', showIcon: true, message: '规则修改不会回写已绑定批次', description: '请通过参数版本发布后，应用到下一次预测运行。' }),
        h('div', { className: 'decomp-editor-grid' },
          editorField('规则名称', h(Input, { size: 'small', value: editor.name, onChange: event => setEditor({ ...editor, name: event.target.value }), placeholder: '例如：US 新品观察期' })),
          editorField('适用范围', h(Select, { size: 'small', value: editor.scope, onChange: value => setEditor({ ...editor, scope: value }), options: ['全局默认', 'Amazon / US', 'Amazon / UK'].map(value => ({ value, label: value })) })),
          editorField('生命周期', h(Select, { size: 'small', value: editor.lifecycle, onChange: value => setEditor({ ...editor, lifecycle: value }), options: ['全部', '新品', '成长', '成熟 / 后期', '非销售季'].map(value => ({ value, label: value })) })),
          editorField('状态', h(Select, { size: 'small', value: editor.status, onChange: value => setEditor({ ...editor, status: value }), options: ['草稿', '启用'].map(value => ({ value, label: value })) })),
          editorField('历史观察周期', h(InputNumber, { size: 'small', min: 1, value: editor.historyWindow, onChange: value => setEditor({ ...editor, historyWindow: value }), addonAfter: '天', controls: false })),
          editorField('近期观察周期', h(InputNumber, { size: 'small', min: 0, value: editor.recentWindow, onChange: value => setEditor({ ...editor, recentWindow: value }), addonAfter: '天', controls: false })),
          editorField('历史权重', h(InputNumber, { size: 'small', min: 0, max: 100, value: editor.historyWeight, onChange: value => setEditor({ ...editor, historyWeight: value }), addonAfter: '%', controls: false })),
          editorField('近期权重', h(InputNumber, { size: 'small', min: 0, max: 100, value: editor.recentWeight, onChange: value => setEditor({ ...editor, recentWeight: value }), addonAfter: '%', controls: false })),
          editorField('动态α', h(Input, { size: 'small', value: editor.alpha, onChange: event => setEditor({ ...editor, alpha: event.target.value }), placeholder: '0.10 / 0.20 / 0.35' })),
          editorField('季节指数', h(Switch, { checked: editor.seasonal === '启用', onChange: checked => setEditor({ ...editor, seasonal: checked ? '启用' : '关闭' }), checkedChildren: '启用', unCheckedChildren: '关闭' })),
          editorField('Listing适配', h(Select, { size: 'small', value: editor.listing, onChange: value => setEditor({ ...editor, listing: value }), options: ['启用', '关闭', '按新品'].map(value => ({ value, label: value })) })),
          editorField('规则说明', h(Input.TextArea, { rows: 3, maxLength: 120, showCount: true, value: editor.note, onChange: event => setEditor({ ...editor, note: event.target.value }), placeholder: '说明该规则适用的业务条件' }))
        )
      ) : null)
    );
  }

  function SplitRulesTab() {
    const { message } = App.useApp();
    const [rows, setRows] = useState(splitRuleSeed);
    const [editor, setEditor] = useState(null);
    const newDraft = () => setEditor({ mode: 'new', key: `split-${Date.now()}`, name: '', scope: '全部', baseWindow: 84, recentWindow: 14, historyWeight: 70, recentWeight: 30, method: '历史 + 近期调和', priority: 50, status: '草稿', normalize: true, conditions: [{ field: '近14天 Clean ADU', operator: '小于', value: '2' }] });
    const openEdit = row => setEditor({ mode: 'edit', ...row, conditions: row.conditions?.map(item => ({ ...item })) || [] });
    const save = () => {
      if (!editor.name.trim()) return message.warning('请填写拆解规则名称');
      if (editor.method === '历史 + 近期调和' && Number(editor.historyWeight || 0) + Number(editor.recentWeight || 0) !== 100) return message.warning('调和权重合计必须为100%');
      const conditionText = editor.conditions.length ? editor.conditions.map(item => `${item.field} ${item.operator} ${item.value}`).join(' 且 ') : '全部子ASIN';
      const next = { ...editor, conditionText, judgement: editor.conditions.length ? '组合条件匹配' : '无' };
      setRows(old => editor.mode === 'new' ? [next, ...old] : old.map(row => row.key === editor.key ? next : row));
      setEditor(null);
      message.success('拆解规则已保存为配置草稿，不会改写已冻结批次');
    };
    const addCondition = () => setEditor({ ...editor, conditions: [...editor.conditions, { field: '变体标签', operator: '等于', value: '' }] });
    const updateCondition = (index, key, value) => setEditor({ ...editor, conditions: editor.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) });
    const conditionOptions = ['近14天 Clean ADU', '近14天有销量天数', '近84天销量', '商品标签', '变体标签', 'SKU版本'];
    const columns = [
      { title: '规则名称', dataIndex: 'name', width: 165, fixed: 'left', render: value => h('strong', { className: 'decomp-table-strong' }, value) },
      { title: '适用条件', dataIndex: 'conditionText', width: 230, ellipsis: true },
      { title: '基础份额周期', dataIndex: 'baseWindow', width: 105, align: 'right', render: value => `${value}天` },
      { title: '近期周期', dataIndex: 'recentWindow', width: 88, align: 'right', render: value => value ? `${value}天` : '' },
      { title: '历史 / 近期权重', key: 'weights', width: 125, align: 'right', render: (_, row) => row.recentWeight === '' ? `${row.historyWeight}%` : `${row.historyWeight}% / ${row.recentWeight}%` },
      { title: '拆解方式', dataIndex: 'method', width: 135 },
      { title: '优先级', dataIndex: 'priority', width: 75, align: 'right' },
      { title: '状态', dataIndex: 'status', width: 80, render: value => h(Tag, { color: statusConfig(value), style: { marginInlineEnd: 0 } }, value) },
      { title: '操作', key: 'action', width: 90, fixed: 'right', render: (_, row) => h(Button, { type: 'link', size: 'small', onClick: () => openEdit(row) }, '编辑') }
    ];
    return h(React.Fragment, null,
      h(Alert, { className: 'decomp-config-alert', type: 'info', showIcon: true, message: '拆解规则只决定父ASIN总量如何分到子ASIN；命中最高优先级后不重复套用其他规则。' }),
      h('div', { className: 'decomp-rule-priority' }, h('span', null, '规则优先级'), h(Tag, { color: 'blue' }, '人工指定'), h('span', null, '→'), h(Tag, { color: 'processing' }, 'ASIN专项'), h('span', null, '→'), h(Tag, { color: 'default' }, '商品标签'), h('span', null, '→'), h(Tag, { color: 'default' }, '国家 / 渠道'), h('span', null, '→'), h(Tag, { color: 'default' }, '默认规则')),
      h('div', { className: 'decomp-filter-panel decomp-rule-toolbar' }, h(Button, { type: 'primary', size: 'small', onClick: newDraft }, '新建拆解规则'), h('span', { className: 'decomp-filter-spacer' }), h('span', { className: 'decomp-toolbar-note' }, '条件组 · 观察周期 · 权重 · 归一化')),
      h(Table, { className: 'decomp-table decomp-config-table', size: 'small', rowKey: 'key', dataSource: rows.slice().sort((a, b) => a.priority - b.priority), columns, scroll: { x: 1080, y: 420 }, pagination: { size: 'small', showSizeChanger: true, showTotal: total => `共 ${total} 条拆解规则` } }),
      h(Drawer, { title: editor?.mode === 'new' ? '新建拆解规则' : '编辑拆解规则', open: Boolean(editor), onClose: () => setEditor(null), width: 640, destroyOnHidden: true, footer: h(Space, null, h(Button, { onClick: () => setEditor(null) }, '取消'), h(Button, { type: 'primary', onClick: save }, '保存为草稿')) }, editor ? h('div', { className: 'decomp-editor-drawer' },
        h(Alert, { type: 'info', showIcon: true, message: '命中规则后只使用这一条规则', description: '规则修改先进入草稿，需绑定新的参数版本才会参与后续计算。' }),
        h('div', { className: 'decomp-editor-grid' },
          editorField('规则名称', h(Input, { size: 'small', value: editor.name, onChange: event => setEditor({ ...editor, name: event.target.value }), placeholder: '例如：小众尺码保护' })),
          editorField('适用范围', h(Select, { size: 'small', value: editor.scope, onChange: value => setEditor({ ...editor, scope: value }), options: ['全部', '全部 Amazon', 'US / 畅款', 'US / 新版本'].map(value => ({ value, label: value })) })),
          editorField('优先级', h(InputNumber, { size: 'small', min: 1, max: 999, value: editor.priority, onChange: value => setEditor({ ...editor, priority: value }), controls: false })),
          editorField('状态', h(Select, { size: 'small', value: editor.status, onChange: value => setEditor({ ...editor, status: value }), options: ['草稿', '启用'].map(value => ({ value, label: value })) })),
          h('div', { className: 'decomp-editor-span' }, h('div', { className: 'decomp-editor-label' }, '触发条件'), h('div', { className: 'decomp-condition-list' }, editor.conditions.map((condition, index) => h('div', { className: 'decomp-condition-row', key: index }, h(Select, { size: 'small', value: condition.field, onChange: value => updateCondition(index, 'field', value), options: conditionOptions.map(value => ({ value, label: value })) }), h(Select, { size: 'small', value: condition.operator, onChange: value => updateCondition(index, 'operator', value), options: ['等于', '小于', '小于等于', '大于', '大于等于'].map(value => ({ value, label: value })) }), h(Input, { size: 'small', value: condition.value, onChange: event => updateCondition(index, 'value', event.target.value), placeholder: '阈值 / 枚举值' }), h(Button, { type: 'text', size: 'small', danger: true, onClick: () => setEditor({ ...editor, conditions: editor.conditions.filter((_, itemIndex) => itemIndex !== index) }), 'aria-label': `移除条件${index + 1}` }, '×'))), h(Button, { type: 'link', size: 'small', onClick: addCondition }, '+ 添加条件'), h('span', { className: 'decomp-field-help' }, editor.conditions.length ? '满足以下全部条件（AND）' : '无条件时适用于全部子ASIN'))),
          editorField('拆解方式', h(Select, { size: 'small', value: editor.method, onChange: value => setEditor({ ...editor, method: value }), options: ['历史份额', '历史 + 近期调和', '固定比例', '人工指定'].map(value => ({ value, label: value })) })),
          editorField('历史份额周期', h(InputNumber, { size: 'small', min: 1, value: editor.baseWindow, onChange: value => setEditor({ ...editor, baseWindow: value }), addonAfter: '天', controls: false })),
          editorField('近期份额周期', h(InputNumber, { size: 'small', min: 0, value: editor.recentWindow, onChange: value => setEditor({ ...editor, recentWindow: value }), addonAfter: '天', controls: false })),
          editorField('历史权重', h(InputNumber, { size: 'small', min: 0, max: 100, value: editor.historyWeight, onChange: value => setEditor({ ...editor, historyWeight: value }), addonAfter: '%', controls: false })),
          editorField('近期权重', h(InputNumber, { size: 'small', min: 0, max: 100, value: editor.recentWeight, onChange: value => setEditor({ ...editor, recentWeight: value }), addonAfter: '%', controls: false })),
          editorField('最终份额自动归一化', h(Switch, { checked: editor.normalize, onChange: checked => setEditor({ ...editor, normalize: checked }), checkedChildren: '开启', unCheckedChildren: '关闭' })),
          h('div', { className: 'decomp-editor-span decomp-preview-box' }, h('div', { className: 'decomp-editor-label' }, '规则示例'), h('div', { className: 'decomp-preview-copy' }, 'A：84天 70% → 70.0%', h('br'), 'B：84天 20% + 14天 2% → 调和后归一化', h('br'), 'C：84天 10% → 10.0%', h('br'), h('strong', null, '系统会在子体合计不为100%时统一归一化。')))
        )
      ) : null)
    );
  }

  function VersionsTab() {
    const { message } = App.useApp();
    const [rows, setRows] = useState(parameterVersionSeed);
    const [detail, setDetail] = useState(null);
    const publishDraft = row => { setRows(old => old.map(item => item.key === row.key ? { ...item, status: '当前使用', lock: '已冻结', batch: currentBatchLabel } : item)); message.success(`${row.version} 已绑定演示批次 ${currentBatchLabel}；历史批次仍使用原快照`); };
    const columns = [
      { title: '参数版本', dataIndex: 'version', width: 100, fixed: 'left', render: value => h(Tag, { color: value === 'V1.1' ? 'blue' : 'default', style: { marginInlineEnd: 0 } }, value) },
      { title: '创建时间', dataIndex: 'createdAt', width: 145 },
      { title: '适用范围', dataIndex: 'scope', width: 150 },
      { title: '版本说明', dataIndex: 'description', width: 260 },
      { title: '绑定批次', dataIndex: 'batch', width: 120 },
      { title: '状态', dataIndex: 'status', width: 95, render: value => h(Tag, { color: statusConfig(value), style: { marginInlineEnd: 0 } }, value) },
      { title: '操作', key: 'action', width: 145, fixed: 'right', render: (_, row) => h(Space, { size: 0 }, h(Button, { type: 'link', size: 'small', onClick: () => setDetail(row) }, '查看差异'), row.status === '草稿' ? h(Button, { type: 'link', size: 'small', onClick: () => publishDraft(row) }, '绑定演示批次') : null) }
    ];
    return h(React.Fragment, null,
      h(Alert, { className: 'decomp-config-alert', type: 'warning', showIcon: true, message: '预测批次绑定参数版本后形成计算快照；后续修改规则不会影响已经生成的历史预测。' }),
      h('div', { className: 'decomp-version-summary' }, h('div', null, h('span', null, '当前批次'), h('strong', null, currentBatchLabel)), h('div', null, h('span', null, '当前使用版本'), h('strong', null, 'V1.1')), h('div', null, h('span', null, '快照状态'), h(Tag, { color: 'blue' }, '已冻结')), h(Button, { size: 'small', onClick: () => message.info('参数版本草稿由规则 Tab 保存后生成') }, '创建版本草稿')),
      h(Table, { className: 'decomp-table decomp-config-table', size: 'small', rowKey: 'key', dataSource: rows, columns, scroll: { x: 980, y: 420 }, pagination: { size: 'small', showSizeChanger: true, showTotal: total => `共 ${total} 个参数版本` } }),
      h(Drawer, { title: detail ? `参数版本差异 · ${detail.version}` : '', open: Boolean(detail), onClose: () => setDetail(null), width: 460, destroyOnHidden: true }, detail ? h('div', { className: 'decomp-editor-drawer' }, h(Alert, { type: detail.status === '当前使用' ? 'info' : 'warning', showIcon: true, message: detail.status === '当前使用' ? '该版本已绑定当前预测批次' : '该版本尚未绑定预测批次' }), h('div', { className: 'decomp-detail-grid' }, h('span', null, '版本说明'), h('strong', null, detail.description), h('span', null, '适用范围'), h('strong', null, detail.scope), h('span', null, '绑定批次'), h('strong', null, detail.batch), h('span', null, '快照状态'), h('strong', null, detail.lock)), h('div', { className: 'decomp-version-diff' }, h('strong', null, '版本差异示例'), h('p', null, detail.version === 'V1.2' ? '新增：小众尺码 56天 / 14天、历史与近期权重 50% / 50%。' : '沿用：低销量不稳定子体 84天 / 14天、70% / 30% 调和。'), h('p', null, '应用规则变更需要创建新版本，不会回写已冻结批次。')) ) : null)
    );
  }

  function RelationTab({ data }) {
    const { message } = App.useApp();
    const [filters, setFilters] = useState({ site: '', store: '', spu: '', parent: '', child: '', status: '' });
    const [draft, setDraft] = useState(filters);
    const [detail, setDetail] = useState(null);
    const [relationAction, setRelationAction] = useState(null);
    const [relationDraft, setRelationDraft] = useState({ targetParent: '', effectiveAt: '2026/09/25', impact: '从生效日期开始', reason: '' });
    const openRelationAction = (row, mode) => {
      setRelationDraft({ targetParent: row.type === 'parent' ? '' : row.parent, effectiveAt: '2026/09/25', impact: '从生效日期开始', reason: '' });
      setRelationAction({ row, mode });
    };
    const submitRelationAction = () => {
      if (!relationDraft.targetParent.trim()) return message.warning('请选择或填写调整后的父ASIN');
      if (!relationDraft.reason.trim()) return message.warning('请填写关系调整原因');
      setRelationAction(null);
      message.success(`${relationAction.mode === 'batch' ? '批量迁移' : '父子关系调整'}已提交，待下一预测批次生成关系快照`);
    };
    const filtered = useMemo(() => data.filter(group => {
      const matchesGroup = !filters.parent || group.parent.includes(filters.parent);
      const matchesSite = !filters.site || group.site === filters.site;
      const matchesStore = !filters.store || group.store === filters.store;
      const matchesSpu = !filters.spu || group.spu.includes(filters.spu);
      const matchesStatus = !filters.status || group.status === filters.status;
      const children = group.children.filter(child => {
        return (!filters.child || child.child.includes(filters.child)) && (!filters.status || child.status === filters.status);
      });
      return matchesGroup && matchesSite && matchesStore && matchesSpu && matchesStatus && children.length > 0;
    }).map(group => ({ ...group, children: group.children.filter(child => !filters.child || child.child.includes(filters.child)) })), [data, filters]);
    const rows = filtered.length ? filtered : [];
    const columns = [
      { title: 'SPU / 父ASIN / 子ASIN', key: 'asin', width: 250, fixed: 'left', render: (_, row) => row.type === 'parent'
        ? h('div', { className: 'decomp-primary-cell' }, h('strong', null, row.spu), h('span', { className: 'decomp-context-strong' }, row.parent), h('span', { className: 'decomp-count' }, `(${row.childCount}个子体)`))
        : h('div', { className: 'decomp-child-cell' }, h(Typography.Link, { onClick: () => setDetail(row) }, row.child), h('span', { className: 'decomp-muted' }, `${row.color} · ${row.size}`)) },
      { title: '关系版本', dataIndex: 'version', width: 90, render: value => h(Tag, { bordered: false, style: { marginInlineEnd: 0, color: '#526078', background: '#f1f4f8' } }, value) },
      { title: '生效时间', dataIndex: 'effectiveAt', width: 110 },
      { title: '国家 / 站点', key: 'site', width: 125, render: (_, row) => h('span', { className: row.type === 'parent' ? 'decomp-context-strong' : 'decomp-muted' }, `${flag[row.site] || ''} ${row.site === 'US' ? '美国 / US' : row.site}`) },
      { title: '账号 / 店铺', dataIndex: 'store', width: 145, ellipsis: true },
      { title: '关系来源', dataIndex: 'source', width: 105, render: value => h(Tag, { bordered: false, style: { color: value === '人工维护' ? '#a66a00' : '#526078', background: value === '人工维护' ? '#fff7e6' : '#f1f4f8', marginInlineEnd: 0 } }, value) },
      { title: '关系状态', dataIndex: 'status', width: 125, render: value => statusTag(value) },
      { title: '近84天销量', dataIndex: 'volume84', width: 110, align: 'right', render: value => value == null ? '' : formatNumber(value) },
      { title: '近84天份额', key: 'share84', width: 105, align: 'right', render: (_, row) => row.share84 == null ? '' : row.type === 'parent' ? '100.0%' : formatPercent(row.share84) },
      { title: '最近一次变化', dataIndex: 'changedAt', width: 125 },
      { title: '操作', key: 'action', width: 160, fixed: 'right', render: (_, row) => h(Space, { size: 0 }, h(Button, { type: 'link', size: 'small', onClick: () => setDetail(row) }, '查看'), h(Button, { type: 'link', size: 'small', onClick: () => openRelationAction(row, row.type === 'parent' ? 'batch' : 'single') }, row.type === 'parent' ? '批量迁移' : '调整关系')) }
    ];
    return h(React.Fragment, null,
      h('div', { className: 'decomp-filter-panel' },
        h('div', { className: 'decomp-field' }, h('span', null, '平台'), h(Select, { size: 'small', value: 'Amazon', options: [{ value: 'Amazon', label: 'Amazon' }], 'aria-label': '平台' })),
        h('div', { className: 'decomp-field' }, h('span', null, '国家 / 站点'), h(Select, { size: 'small', value: draft.site, onChange: value => setDraft(old => ({ ...old, site: value })), options: asOptions(['US', 'UK'], '全部国家 / 站点'), 'aria-label': '国家 / 站点' })),
        h('div', { className: 'decomp-field' }, h('span', null, '账号 / 店铺'), h(Select, { size: 'small', value: draft.store, onChange: value => setDraft(old => ({ ...old, store: value })), options: asOptions([...new Set(data.map(row => row.store))], '全部账号 / 店铺'), 'aria-label': '账号 / 店铺' })),
        h(Input, { size: 'small', value: draft.spu, onChange: event => setDraft(old => ({ ...old, spu: event.target.value.toUpperCase() })), placeholder: 'SPU', 'aria-label': 'SPU' }),
        h(Input, { size: 'small', value: draft.parent, onChange: event => setDraft(old => ({ ...old, parent: event.target.value.toUpperCase() })), placeholder: '父ASIN', 'aria-label': '父ASIN' }),
        h(Input, { size: 'small', value: draft.child, onChange: event => setDraft(old => ({ ...old, child: event.target.value.toUpperCase() })), placeholder: '子ASIN', 'aria-label': '子ASIN' }),
        h('div', { className: 'decomp-field' }, h('span', null, '状态'), h(Select, { size: 'small', value: draft.status, onChange: value => setDraft(old => ({ ...old, status: value })), options: asOptions(['历史', '本批次已冻结', '已发生变化'], '全部关系状态'), 'aria-label': '关系状态' })),
        h(Space, { size: 8 }, h(Button, { type: 'primary', size: 'small', onClick: () => setFilters(draft) }, '查询'), h(Button, { size: 'small', onClick: () => { const empty = { site: '', store: '', spu: '', parent: '', child: '', status: '' }; setDraft(empty); setFilters(empty); } }, '重置'), h(Button, { size: 'small', onClick: () => openRelationAction(data[0], 'batch'), disabled: !data.length }, '批量调整关系'))
      ),
      h('div', { className: 'decomp-table-meta' }, h('span', null, `当前有效关系 ${data.filter(group => group.current).reduce((sum, group) => sum + group.childCount, 0)} 个子ASIN · ${data.length} 个关系版本`), h('span', null, `本批次关系快照 ${currentBatchLabel}`)),
      h(Table, { className: 'decomp-table', size: 'small', rowKey: 'key', dataSource: rows, columns, scroll: { x: 1320, y: 420 }, pagination: { size: 'small', showSizeChanger: true, showQuickJumper: true, showTotal: total => `共 ${total} 个关系版本` }, expandable: { defaultExpandAllRows: true }, rowClassName: row => row.type === 'parent' ? 'decomp-parent-row' : '' }),
      h(Drawer, { title: detail?.type === 'parent' ? '父子关系详情' : '子ASIN关系详情', open: Boolean(detail), onClose: () => setDetail(null), width: 420, destroyOnHidden: true }, detail ? h('div', { className: 'decomp-detail-drawer' },
        h('div', { className: 'decomp-detail-title' }, detail.type === 'parent' ? detail.parent : detail.child),
        h('div', { className: 'decomp-detail-grid' },
          h('span', null, 'SPU'), h('strong', null, detail.spu),
          h('span', null, '关系版本'), h('strong', null, detail.version),
          h('span', null, '生效时间'), h('strong', null, detail.effectiveAt),
          h('span', null, '关系来源'), h('strong', null, detail.source),
          h('span', null, '关系状态'), h('strong', null, detail.status),
          h('span', null, '国家 / 站点'), h('strong', null, `${flag[detail.site] || ''} ${detail.site}`),
          h('span', null, '账号 / 店铺'), h('strong', null, detail.store),
          h('span', null, '最近一次变化'), h('strong', null, detail.changedAt)
        ),
        h(Alert, { type: detail.status === '已发生变化' ? 'warning' : 'info', showIcon: true, message: detail.status === '历史' ? '历史关系仅用于追溯；本轮预测不按历史父ASIN分别计算。' : '本轮按当前国家 + 子ASIN关系归集历史销量到当前父ASIN预测池；本批次快照不会被后续同步改写。' })
      ) : null),
      h(Drawer, { title: relationAction?.mode === 'batch' ? '批量调整父子关系' : '调整父子关系', open: Boolean(relationAction), onClose: () => setRelationAction(null), width: 470, destroyOnHidden: true, footer: h(Space, null, h(Button, { onClick: () => setRelationAction(null) }, '取消'), h(Button, { type: 'primary', onClick: submitRelationAction }, '提交调整')) }, relationAction ? h('div', { className: 'decomp-editor-drawer' },
        h(Alert, { type: 'info', showIcon: true, message: '关系调整只影响新生成的关系快照', description: '已经绑定预测批次的父子关系不会被直接改写。' }),
        h('div', { className: 'decomp-detail-grid' }, h('span', null, '国家 / 站点'), h('strong', null, `${flag[relationAction.row.site] || ''} ${relationAction.row.site}`), h('span', null, 'SPU'), h('strong', null, relationAction.row.spu), h('span', null, relationAction.mode === 'batch' ? '迁移子ASIN' : '子ASIN'), h('strong', null, relationAction.mode === 'batch' ? `${relationAction.row.children?.length || 0} 个子ASIN` : relationAction.row.child), h('span', null, '当前父ASIN'), h('strong', null, relationAction.row.parent)),
        h('div', { className: 'decomp-editor-grid' },
          editorField('调整为', h(Input, { size: 'small', value: relationDraft.targetParent, onChange: event => setRelationDraft({ ...relationDraft, targetParent: event.target.value.toUpperCase() }), placeholder: '输入或选择目标父ASIN' })),
          editorField('生效时间', h(Input, { size: 'small', value: relationDraft.effectiveAt, onChange: event => setRelationDraft({ ...relationDraft, effectiveAt: event.target.value }), placeholder: 'YYYY/MM/DD' })),
          editorField('影响范围', h(Radio.Group, { value: relationDraft.impact, onChange: event => setRelationDraft({ ...relationDraft, impact: event.target.value }), options: [{ value: '仅本次预测', label: '仅本次预测' }, { value: '从生效日期开始', label: '从生效日期开始' }] })),
          h('div', { className: 'decomp-editor-span' }, editorField('调整原因', h(Input.TextArea, { rows: 4, maxLength: 200, showCount: true, value: relationDraft.reason, onChange: event => setRelationDraft({ ...relationDraft, reason: event.target.value }), placeholder: '例如：亚马逊变体重新组合' })))
        )
      ) : null)
    );
  }

  function ShareTab({ groupsData, onOpenRules }) {
    const { message } = App.useApp();
    const [draftShares, setDraftShares] = useState({});
    const [filters, setFilters] = useState({ parent: '', child: '' });
    const [draftFilters, setDraftFilters] = useState(filters);
    const [modalOpen, setModalOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [reasonTags, setReasonTags] = useState([]);
    const [history, setHistory] = useState([]);
    const visibleGroups = useMemo(() => groupsData.map(group => ({
      ...group,
      children: group.children.filter(row => (!filters.parent || row.parent.includes(filters.parent)) && (!filters.child || row.child.includes(filters.child)))
    })).filter(group => group.children.length), [groupsData, filters]);
    const groupRows = visibleGroups.map(group => {
      const children = group.children.map(row => ({ ...row, type: 'child', finalShare: draftShares[row.key] ?? row.systemShare }));
      const totalShare = children.reduce((sum, row) => sum + row.finalShare, 0);
      return { ...group, type: 'parent', children, totalShare };
    });
    const changedRows = groupsData.flatMap(group => group.children.filter(row => draftShares[row.key] !== undefined && !closeTo(draftShares[row.key], row.systemShare)));
    const invalidGroups = groupRows.filter(group => !closeTo(group.totalShare, 100));
    const changedParents = [...new Set(changedRows.map(row => row.parent))];
    const setShare = (key, value) => setDraftShares(old => ({ ...old, [key]: value == null ? undefined : Number(value) }));
    const openSave = () => {
      if (!changedRows.length) return message.info('当前没有需要保存的份额调优');
      if (invalidGroups.length) return message.error(`${invalidGroups[0].parent} 的最终份额合计为 ${formatPercent(invalidGroups[0].totalShare)}，必须调整到100%`);
      setModalOpen(true);
    };
    const saveAdjustments = () => {
      if (!reason.trim()) return message.warning('请填写本次调优原因');
      setHistory(old => [{ key: Date.now(), at: '2026/10/21 10:30', by: '张三 · PMC', parents: changedParents.join('、'), reason: reason.trim() }, ...old]);
      setModalOpen(false);
      setReason('');
      setReasonTags([]);
      message.success('子体份额调优已保存');
    };
    const resetShares = () => { setDraftShares({}); message.info('已恢复系统建议份额'); };
    const columns = [
      { title: 'SPU / 父ASIN / 子ASIN', key: 'asin', width: 250, fixed: 'left', render: (_, row) => row.type === 'parent'
        ? h('div', { className: 'decomp-primary-cell' }, h('strong', null, row.spu), h('span', { className: 'decomp-context-strong' }, row.parent), h('span', { className: 'decomp-count' }, `${row.children.length}个子体`))
        : h('div', { className: 'decomp-child-cell' }, h(Typography.Link, null, row.child), h('span', { className: 'decomp-muted' }, `${row.color} · ${row.size}`)) },
      { title: '父体预测', key: 'parentTotal', width: 100, align: 'right', render: (_, row) => row.type === 'parent' ? h('strong', null, formatNumber(row.parentTotal)) : '' },
      { title: '近84天销量', key: 'volume84', width: 105, align: 'right', render: (_, row) => row.type === 'parent' ? formatNumber(row.children.reduce((sum, child) => sum + child.volume84, 0)) : formatNumber(row.volume84) },
      { title: '84天份额', key: 'share84', width: 92, align: 'right', render: (_, row) => row.type === 'parent' ? '100.0%' : formatPercent(row.share84) },
      { title: '14天Clean销量', key: 'clean14', width: 112, align: 'right', render: (_, row) => row.type === 'parent' ? '' : formatNumber(row.clean14) },
      { title: '14天份额', key: 'share14', width: 92, align: 'right', render: (_, row) => row.type === 'parent' ? '' : formatPercent(row.share14) },
      { title: '系统计算份额', key: 'systemShare', width: 118, align: 'right', render: (_, row) => row.type === 'parent' ? '100.0%' : h(Button, { type: 'link', size: 'small', className: 'decomp-share-link', onClick: () => onOpenRules(row) }, formatPercent(row.systemShare)) },
      { title: 'PMC调优份额', key: 'adjustShare', width: 128, align: 'right', render: (_, row) => row.type === 'parent'
        ? h('span', { className: `decomp-share-total ${closeTo(row.totalShare, 100) ? 'is-valid' : 'is-invalid'}` }, formatPercent(row.totalShare))
        : h(InputNumber, { size: 'small', min: 0, max: 100, precision: 1, controls: false, suffix: '%', value: Number(row.finalShare.toFixed(1)), onChange: value => setShare(row.key, value), 'aria-label': `${row.child} PMC调优份额` }) },
      { title: '最终份额', key: 'finalShare', width: 100, align: 'right', render: (_, row) => row.type === 'parent' ? formatPercent(row.totalShare) : h('strong', { className: 'decomp-final-share' }, formatPercent(row.finalShare)) },
      { title: '最终预测', key: 'finalQty', width: 100, align: 'right', render: (_, row) => row.type === 'parent' ? h('strong', null, formatNumber(row.parentTotal)) : h('strong', { className: 'decomp-final-qty' }, formatNumber(Math.round(row.parentTotal * row.finalShare / 100))) },
      { title: '判断', key: 'judgement', width: 125, render: (_, row) => row.type === 'parent' ? '' : row.unstable ? h(Tag, { color: 'warning', style: { marginInlineEnd: 0 } }, '近期不稳定') : h(Tag, { bordered: false, style: { marginInlineEnd: 0, color: '#526078', background: '#f1f4f8' } }, '正常') }
    ];
    return h(React.Fragment, null,
      h('div', { className: 'decomp-scope-bar' }, h('div', null, h('span', null, '预测批次'), h('strong', null, currentBatchLabel), h('span', { className: 'decomp-scope-divider' }, '丨'), h('span', null, '当前父ASIN预测池'), h(Tag, { color: 'blue', style: { marginInlineEnd: 0 } }, '已冻结')), h(Button, { type: 'link', size: 'small', onClick: () => onOpenRules(null) }, '查看拆解规则')),
      h('div', { className: 'decomp-filter-panel decomp-share-filter' },
        h(Input, { size: 'small', value: draftFilters.parent, onChange: event => setDraftFilters(old => ({ ...old, parent: event.target.value.toUpperCase() })), placeholder: '父ASIN', 'aria-label': '父ASIN' }),
        h(Input, { size: 'small', value: draftFilters.child, onChange: event => setDraftFilters(old => ({ ...old, child: event.target.value.toUpperCase() })), placeholder: '子ASIN', 'aria-label': '子ASIN' }),
        h(Space, { size: 8 }, h(Button, { type: 'primary', size: 'small', onClick: () => setFilters(draftFilters) }, '查询'), h(Button, { size: 'small', onClick: () => { const empty = { parent: '', child: '' }; setDraftFilters(empty); setFilters(empty); } }, '重置')),
        h('span', { className: 'decomp-filter-spacer' }),
        h(Button, { size: 'small', onClick: resetShares, disabled: !changedRows.length }, '恢复系统建议'),
        h(Button, { type: 'primary', size: 'small', onClick: openSave, disabled: !changedRows.length || invalidGroups.length > 0 }, '保存调优')
      ),
      invalidGroups.length ? h(Alert, { className: 'decomp-share-alert', type: 'warning', showIcon: true, message: `${invalidGroups[0].parent} 的份额合计为 ${formatPercent(invalidGroups[0].totalShare)}，请调整 PMC 调优份额，使每个父体合计为100%。` }) : h('div', { className: 'decomp-share-status' }, `当前显示 ${groupRows.length} 个父ASIN预测池 · 历史销量按本轮国家 + 子ASIN关系归集 · 子体预测由父体总量自动计算`),
      h(Table, { className: 'decomp-table decomp-share-table', size: 'small', rowKey: 'key', dataSource: groupRows, columns, scroll: { x: 1290, y: 380 }, pagination: { size: 'small', showSizeChanger: true, showQuickJumper: true, showTotal: total => `共 ${total} 个父ASIN` }, expandable: { defaultExpandAllRows: true }, rowClassName: row => row.type === 'parent' ? 'decomp-parent-row' : '' }),
      h('section', { className: 'decomp-history' }, h('div', { className: 'decomp-section-title' }, h('strong', null, '调整记录'), h('span', null, '只记录份额调优，不记录父体预测数量变更')), history.length ? h(Table, { size: 'small', rowKey: 'key', pagination: false, dataSource: history, columns: [{ title: '时间', dataIndex: 'at', width: 150 }, { title: '操作人', dataIndex: 'by', width: 130 }, { title: '父ASIN', dataIndex: 'parents', width: 220 }, { title: '调整原因', dataIndex: 'reason' }] }) : h(Empty, { image: Empty.PRESENTED_IMAGE_SIMPLE, description: '暂无份额调优记录' })),
      h(Modal, { title: '保存子体份额调优', open: modalOpen, onCancel: () => setModalOpen(false), onOk: saveAdjustments, okText: '保存调优', cancelText: '取消', destroyOnHidden: true },
        h('div', { className: 'decomp-modal-summary' }, h('span', null, '本次调整'), h('strong', null, changedParents.join('、')), h('span', null, ` · ${changedRows.length} 个子ASIN`)),
        h('div', { className: 'decomp-modal-field' }, h('label', null, '调整类型'), h(Checkbox.Group, { options: ['小众尺码', '新版本', '库存结构调整', '商品策略调整', '其他'], value: reasonTags, onChange: setReasonTags })),
        h('div', { className: 'decomp-modal-field' }, h('label', null, '调整原因 <em>必填</em>'), h(Input.TextArea, { rows: 4, maxLength: 200, showCount: true, value: reason, onChange: event => setReason(event.target.value), placeholder: '请说明为什么需要调整子体份额', 'aria-label': '份额调优原因' }))
      )
    );
  }

  function ParentAsinWorkspace() {
    const [active, setActive] = useState('forecast');
    const [ruleTarget, setRuleTarget] = useState(undefined);
    const relationGroups = useMemo(buildRelationGroups, []);
    const splitGroups = useMemo(buildSplitGroups, []);
    const openRules = target => setRuleTarget(target || null);
    const ruleRows = [
      { key: 'pool', label: '历史销量归集口径', value: '按本轮关系', note: '国家 + 子ASIN → 当前国家 + 父ASIN，不按历史父ASIN拆分' },
      { key: 'history', label: '历史份额观察周期', value: '84天', note: '取完整12周历史销量' },
      { key: 'recent', label: '近期份额观察周期', value: '14天', note: '低销量/不稳定子体启用' },
      { key: 'historyWeight', label: '历史份额权重', value: '70%', note: '异常子体的历史贡献份额' },
      { key: 'recentWeight', label: '近期份额权重', value: '30%', note: '异常子体的近期 Clean 份额' },
      { key: 'adu', label: '低销量 ADU 阈值', value: '< 2', note: '14天 Clean ADU 判断条件' },
      { key: 'days', label: '近期有销量天数', value: '≤ 10天', note: '与 ADU 条件同时满足时标记不稳定' }
    ];
    return h('div', { className: 'decomp-workspace' },
      h('div', { className: 'decomp-page-head' }, h('div', null, h('div', { className: 'decomp-breadcrumb' }, '计划配置  /  规则与关系维护'), h('h1', null, '计划配置'), h('div', { className: 'decomp-page-meta' }, h(Tag, { color: 'blue', style: { marginInlineEnd: 0 } }, '参数版本 V1.1'), h('span', null, `${currentBatchLabel} · 规则快照已冻结`), h('span', null, '最后同步 2026/10/20 08:30'))), h(Button, { size: 'small', onClick: () => openRules(null) }, '查看当前拆解规则')),
      h('div', { className: 'decomp-model-strip' },
        h('div', { className: 'decomp-model-item' }, h('strong', null, 'SPU'), h('span', null, '稳定商品归属 / 汇总层')),
        h('span', { className: 'decomp-model-arrow', 'aria-hidden': 'true' }, '→'),
        h('div', { className: 'decomp-model-item' }, h('strong', null, '当前父ASIN'), h('span', null, '本轮动态预测池')),
        h('span', { className: 'decomp-model-arrow', 'aria-hidden': 'true' }, '→'),
        h('div', { className: 'decomp-model-item' }, h('strong', null, '子ASIN'), h('span', null, '历史销量 / 份额 / 最终预测颗粒')),
        h('span', { className: 'decomp-model-note' }, 'SKU拆解在后续备货计划处理')
      ),
      h(Tabs, { className: 'decomp-tabs decomp-config-tabs', activeKey: active, onChange: setActive, items: [{ key: 'forecast', label: '预测规则' }, { key: 'split', label: '拆解规则' }, { key: 'relation', label: '关系维护' }, { key: 'adjust', label: '人工调优' }, { key: 'versions', label: '参数版本' }] }),
      active === 'forecast' ? h(ForecastRulesTab) : active === 'split' ? h(SplitRulesTab) : active === 'relation' ? h(RelationTab, { data: relationGroups }) : active === 'adjust' ? h(ShareTab, { groupsData: splitGroups, onOpenRules: openRules }) : h(VersionsTab),
      h(Drawer, { title: ruleTarget ? `系统份额依据 · ${ruleTarget.child}` : '子体拆解规则', open: ruleTarget !== undefined, onClose: () => setRuleTarget(undefined), width: 480, destroyOnHidden: true }, h('div', { className: 'decomp-rule-drawer' },
        ruleTarget ? h(Alert, { type: 'info', showIcon: true, message: `${ruleTarget.child} 当前系统建议份额 ${formatPercent(ruleTarget.systemShare)}`, description: ruleTarget.unstable ? '近期 Clean ADU < 2 且有销量天数 ≤ 10天，系统已启用 70% 历史 + 30% 近期份额并归一化。' : '该子ASIN近期销量稳定，系统沿用84天历史贡献份额。' }) : h('div', { className: 'decomp-rule-intro' }, 'SPU用于稳定归属和经营汇总；本轮按当前国家 + 子ASIN关系把历史销量归集到当前父ASIN预测池，PMC只在本模块处理关系异常和份额调优。'),
        h(Table, { size: 'small', rowKey: 'key', pagination: false, dataSource: ruleRows, columns: [{ title: '参数', dataIndex: 'label', width: 155 }, { title: '当前值', dataIndex: 'value', width: 90 }, { title: '说明', dataIndex: 'note' }] })
      ))
    );
  }

  window.ParentAsinModule = { ParentAsinWorkspace };
})();
