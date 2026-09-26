/* V0.3.3-pmc10: SPU ownership, ASIN relation versions, and child allocation. */
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
    Select,
    Space,
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

  function RelationTab({ data }) {
    const [filters, setFilters] = useState({ site: '', store: '', spu: '', parent: '', child: '', status: '' });
    const [draft, setDraft] = useState(filters);
    const [detail, setDetail] = useState(null);
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
      { title: '操作', key: 'action', width: 82, fixed: 'right', render: (_, row) => h(Button, { type: 'link', size: 'small', onClick: () => setDetail(row) }, '查看') }
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
        h(Space, { size: 8 }, h(Button, { type: 'primary', size: 'small', onClick: () => setFilters(draft) }, '查询'), h(Button, { size: 'small', onClick: () => { const empty = { site: '', store: '', spu: '', parent: '', child: '', status: '' }; setDraft(empty); setFilters(empty); } }, '重置'))
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
    const [active, setActive] = useState('relation');
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
      h('div', { className: 'decomp-page-head' }, h('div', null, h('div', { className: 'decomp-breadcrumb' }, '计划配置  /  商品映射'), h('h1', null, '父子ASIN拆解'), h('div', { className: 'decomp-page-meta' }, h(Tag, { color: 'blue', style: { marginInlineEnd: 0 } }, '预测批次关系快照'), h('span', null, `${currentBatchLabel} · 已冻结`), h('span', null, '最后同步 2026/10/20 08:30'))), h(Button, { size: 'small', onClick: () => openRules(null) }, '查看预测规则')),
      h('div', { className: 'decomp-model-strip' },
        h('div', { className: 'decomp-model-item' }, h('strong', null, 'SPU'), h('span', null, '稳定商品归属 / 汇总层')),
        h('span', { className: 'decomp-model-arrow', 'aria-hidden': 'true' }, '→'),
        h('div', { className: 'decomp-model-item' }, h('strong', null, '当前父ASIN'), h('span', null, '本轮动态预测池')),
        h('span', { className: 'decomp-model-arrow', 'aria-hidden': 'true' }, '→'),
        h('div', { className: 'decomp-model-item' }, h('strong', null, '子ASIN'), h('span', null, '历史销量 / 份额 / 最终预测颗粒')),
        h('span', { className: 'decomp-model-note' }, 'SKU拆解在后续备货计划处理')
      ),
      h(Tabs, { className: 'decomp-tabs', activeKey: active, onChange: setActive, items: [{ key: 'relation', label: '关系版本' }, { key: 'share', label: '子体份额调优' }] }),
      active === 'relation' ? h(RelationTab, { data: relationGroups }) : h(ShareTab, { groupsData: splitGroups, onOpenRules: openRules }),
      h(Drawer, { title: ruleTarget ? `系统份额依据 · ${ruleTarget.child}` : '子体拆解规则', open: ruleTarget !== undefined, onClose: () => setRuleTarget(undefined), width: 480, destroyOnHidden: true }, h('div', { className: 'decomp-rule-drawer' },
        ruleTarget ? h(Alert, { type: 'info', showIcon: true, message: `${ruleTarget.child} 当前系统建议份额 ${formatPercent(ruleTarget.systemShare)}`, description: ruleTarget.unstable ? '近期 Clean ADU < 2 且有销量天数 ≤ 10天，系统已启用 70% 历史 + 30% 近期份额并归一化。' : '该子ASIN近期销量稳定，系统沿用84天历史贡献份额。' }) : h('div', { className: 'decomp-rule-intro' }, 'SPU用于稳定归属和经营汇总；本轮按当前国家 + 子ASIN关系把历史销量归集到当前父ASIN预测池，PMC只在本模块处理关系异常和份额调优。'),
        h(Table, { size: 'small', rowKey: 'key', pagination: false, dataSource: ruleRows, columns: [{ title: '参数', dataIndex: 'label', width: 155 }, { title: '当前值', dataIndex: 'value', width: 90 }, { title: '说明', dataIndex: 'note' }] })
      ))
    );
  }

  window.ParentAsinModule = { ParentAsinWorkspace };
})();
