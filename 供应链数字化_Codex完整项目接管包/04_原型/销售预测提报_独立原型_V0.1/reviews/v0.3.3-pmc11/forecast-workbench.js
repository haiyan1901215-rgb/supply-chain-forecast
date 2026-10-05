(function () {
  const h = React.createElement;
  const { useEffect, useMemo, useRef, useState } = React;
  const { Alert, Button, Checkbox, DatePicker, Descriptions, Drawer, Dropdown, Form, Input, InputNumber, List, Modal, Pagination, Popover, Select, Space, Table, Tag, Tooltip, Tree } = antd;
  const designTokens = antd.theme.getDesignToken(enterpriseThemeV020);
  const uiStandards = window.EnterpriseUiStandards || {};
  const forecastTableStandards = uiStandards.forecastTable || {
    headerBackground: '#f7f9fc',
    weekHeaderBackground: '#e9eef8',
    dayHeaderBackground: '#f2f5fb',
    parentRowBackground: '#f7f9fc',
    finalRowBackground: '#ffffff',
    headerText: '#53658b',
    dayHeaderText: '#4c5a76',
    parentText: '#32405d',
    manualText: '#3f5bdc',
    toggleBorder: '#acbad0',
    toggleText: '#526078',
    resizeGuide: '#aebbe5',
    dayWidth: 72,
    weekTotalWidth: 112,
    weekHeaderHeight: 28,
    dayHeaderHeight: 34,
    systemRowHeight: 40,
    editableRowHeight: 54,
    finalRowHeight: 55,
    keyboardResizeStep: 8,
    crossHighlight: 'rgba(31, 111, 235, .045)',
    focusBorder: 'rgba(31, 111, 235, .18)',
    weekendBackground: '#fafafa',
    gridBorder: '#e5eaf2',
    weekBoundary: '#b4c3df',
    parentBoundary: '#ced8eb'
  };

  const marketNames = { US: '美国 / US', UK: '英国 / UK', DE: '德国 / DE' };
  const tagDefinitions = {
    'IPD款': { tone: 'blue', hint: '生命周期标签：IPD款' }, '新品': { tone: 'blue', hint: '生命周期标签：新品' }, '成长期': { tone: 'blue', hint: '生命周期标签：成长期' }, '成熟期': { tone: 'blue', hint: '生命周期标签：成熟期' },
    '头部': { tone: 'green', hint: '价值分档标签：头部' }, '中坚': { tone: 'green', hint: '价值分档标签：中坚' }, '维持': { tone: 'green', hint: '价值分档标签：维持' }, '限期拯救': { tone: 'green', hint: '价值分档标签：限期拯救' }, '退市': { tone: 'green', hint: '价值分档标签：退市' },
    '爆款': { tone: 'amber', hint: '销量分层标签：爆款' }, '畅款': { tone: 'amber', hint: '销量分层标签：畅款' }, '平款': { tone: 'amber', hint: '销量分层标签：平款' }, '低销': { tone: 'amber', hint: '销量分层标签：低销' },
    '正常': { tone: 'purple', hint: '采购标签：正常' }, '暂停': { tone: 'purple', hint: '采购标签：暂停' }, '停采': { tone: 'purple', hint: '采购标签：停采' }
  };
  const salesTagPalette = {
    blue: { color: '#66538f', backgroundColor: '#f3effa', borderColor: '#d9cceb' },
    green: { color: '#356a9a', backgroundColor: '#eef5fc', borderColor: '#c9ddec' },
    amber: { color: '#996a1e', backgroundColor: '#fff7e7', borderColor: '#ecd8ad' },
    purple: { color: '#4b5563', backgroundColor: '#f9fafb', borderColor: '#d3d5da' }
  };
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  const icon = name => window.icons?.[name] ? h(window.icons[name]) : null;
  const formatNumber = value => value == null ? '—' : Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 1 });
  const dateKey = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const dateText = value => String(value || '').replaceAll('-', '/');
  const dateLabel = value => `${String(value.getMonth() + 1).padStart(2, '0')}/${String(value.getDate()).padStart(2, '0')}`;
  const parseDate = value => { const [year, month, day] = String(value).split('-').map(Number); return new Date(year, month - 1, day); };
  const makeDates = (start, count) => Array.from({ length: count }, (_, index) => { const value = parseDate(start); value.setDate(value.getDate() + index); return value; });
  const dateSpan = (start, end) => Math.max(1, Math.round((parseDate(end) - parseDate(start)) / 86400000) + 1);
  const total = values => { const numeric = values.filter(value => typeof value === 'number' && Number.isFinite(value)); return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) : null; };
  const average = values => { const numeric = values.filter(value => typeof value === 'number' && Number.isFinite(value)); return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : null; };
  const formatShare = value => `${(Number(value || 0) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

  function copyGlyph() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinejoin: 'round', 'aria-hidden': true },
      h('rect', { x: 8, y: 8, width: 12, height: 13, rx: 1 }),
      h('path', { d: 'M16 8V3H3v13h5' })
    );
  }

  function weekToggleGlyph(collapsed) {
    return stateToggleGlyph(!collapsed);
  }

  function stateToggleGlyph(expanded) {
    if (window.ForecastToggleIcon) return h(window.ForecastToggleIcon, { expanded });
    return h('svg', { viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, 'aria-hidden': true },
      h('path', { d: `M2 6h8${expanded ? '' : 'M6 2v8'}` })
    );
  }

  const workbenchColumnCatalog = [
    { key: 'recentSales', label: '近30天销量', group: '销量 / 库存' },
    { key: 'dailySales', label: '近30天日均', group: '销量 / 库存' },
    { key: 'fbaAvailable', label: 'FBA在库', group: '销量 / 库存' },
    { key: 'fbaInbound', label: 'FBA在途', group: '销量 / 库存' },
    { key: 'dos', label: 'FBA DOS', group: '销量 / 库存' }
  ];
  const defaultWorkbenchColumns = workbenchColumnCatalog.map(field => field.key);
  const compactWorkbenchColumns = ['dailySales', 'fbaAvailable', 'dos'];
  const workbenchColumnStorageKey = 'pmc-forecast-workbench-columns-v1';
  const workbenchShareStorageKey = 'pmc-forecast-workbench-shares-v1';

  function loadStoredList(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value.filter(item => fallback.includes(item)) : [...fallback];
    } catch {
      return [...fallback];
    }
  }

  function loadStoredObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function loadWorkbenchColumnConfig() {
    const fallback = { keys: [...defaultWorkbenchColumns], pinned: [], templates: [] };
    try {
      const value = JSON.parse(localStorage.getItem(workbenchColumnStorageKey));
      if (Array.isArray(value)) return { ...fallback, keys: value.filter(key => defaultWorkbenchColumns.includes(key)) };
      if (!value || typeof value !== 'object') return fallback;
      const keys = Array.isArray(value.keys) ? [...new Set(value.keys.filter(key => defaultWorkbenchColumns.includes(key)))] : [...defaultWorkbenchColumns];
      const pinned = Array.isArray(value.pinned) ? value.pinned.filter(key => keys.includes(key)) : [];
      const templates = Array.isArray(value.templates) ? value.templates.filter(template => template && typeof template.name === 'string').map(template => ({
        name: template.name,
        keys: Array.isArray(template.keys) ? template.keys.filter(key => defaultWorkbenchColumns.includes(key)) : [],
        pinned: Array.isArray(template.pinned) ? template.pinned.filter(key => defaultWorkbenchColumns.includes(key)) : []
      })) : [];
      return { keys, pinned, templates };
    } catch {
      return fallback;
    }
  }

  function allocateBasisPoints(totalPoints, weights) {
    if (!weights.length) return [];
    const safe = weights.map(value => Math.max(0, Number(value) || 0));
    const weightTotal = safe.reduce((sum, value) => sum + value, 0);
    const source = weightTotal ? safe : safe.map(() => 1);
    const sourceTotal = source.reduce((sum, value) => sum + value, 0);
    const exact = source.map(value => value / sourceTotal * totalPoints);
    const result = exact.map(Math.floor);
    let remainder = totalPoints - result.reduce((sum, value) => sum + value, 0);
    exact.map((value, index) => ({ index, fraction: value - result[index] }))
      .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
      .forEach(item => { if (remainder > 0) { result[item.index] += 1; remainder -= 1; } });
    return result;
  }

  function colorWithAlpha(hex, alpha) {
    const value = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(value)) return `rgba(31,111,235,${alpha})`;
    return `rgba(${[0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16)).join(',')},${alpha})`;
  }

  function marketFlag(market) {
    if (market === 'US') return h('svg', { viewBox: '0 0 30 20', 'aria-hidden': true },
      h('path', { fill: '#fff', d: 'M0 0h30v20H0z' }),
      h('path', { stroke: '#bc3347', strokeWidth: 1.55, d: 'M0 1h30M0 4h30M0 7h30M0 10h30M0 13h30M0 16h30M0 19h30' }),
      h('path', { fill: '#354b81', d: 'M0 0h13v11H0z' }),
      h('path', { stroke: '#fff', strokeDasharray: '1 2', d: 'M2 2h9M2 4h9M2 6h9M2 8h9' })
    );
    if (market === 'UK') return h('svg', { viewBox: '0 0 30 20', 'aria-hidden': true },
      h('path', { fill: '#214375', d: 'M0 0h30v20H0z' }),
      h('path', { stroke: '#fff', strokeWidth: 5, d: 'm0 0 30 20M0 20 30 0' }),
      h('path', { stroke: '#c6374d', strokeWidth: 2, d: 'm0 0 30 20M0 20 30 0' }),
      h('path', { stroke: '#fff', strokeWidth: 7, d: 'M15 0v20M0 10h30' }),
      h('path', { stroke: '#c6374d', strokeWidth: 4, d: 'M15 0v20M0 10h30' })
    );
    return h('svg', { viewBox: '0 0 30 20', 'aria-hidden': true },
      h('path', { fill: '#1f1f1f', d: 'M0 0h30v6.67H0z' }),
      h('path', { fill: '#d11f2e', d: 'M0 6.67h30v6.66H0z' }),
      h('path', { fill: '#f2c500', d: 'M0 13.33h30V20H0z' })
    );
  }

  function isoWeek(value) {
    const utc = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    return { year: utc.getUTCFullYear(), week: Math.ceil((((utc - yearStart) / 86400000) + 1) / 7) };
  }

  function groupWeeks(dates) {
    return dates.reduce((result, value) => {
      const iso = isoWeek(value);
      const key = `${iso.year}-W${String(iso.week).padStart(2, '0')}`;
      const current = result.at(-1);
      if (!current || current.key !== key) result.push({ key, label: `W${String(iso.week).padStart(2, '0')}`, days: [] });
      result.at(-1).days.push(value);
      return result;
    }, []);
  }

  function currentMeta() {
    const contract = window.ForecastBatchContract;
    const meta = contract?.getCurrentMeta?.() || contract?.getCurrent?.();
    if (meta) return meta;
    return {
      id: typeof currentBatch === 'string' ? currentBatch : '2026-09-29',
      batchDate: typeof currentBatch === 'string' ? currentBatch : '2026-09-29',
      forecastStartDate: '2026-09-29',
      forecastEndDate: '2027-03-29',
      dataCutoffDate: '2026-09-28',
      batchVersion: 'V3',
      activeResultVersion: 'V3',
      relationVersion: 'V2026.09',
      splitRuleVersion: 'V2.1'
    };
  }

  const bindingState = { initialized: false, records: [], pendingAction: null };

  function ensureBindingState(source) {
    if (bindingState.initialized) return;
    bindingState.records = source.flatMap(group => group.children.map(child => ({
      key: `${group.id}|${child.id}`,
      child,
      originalGroupId: group.id,
      currentGroupId: group.id,
      active: true,
      updatedAt: null
    })));
    bindingState.initialized = true;
  }

  function notifyBindingChange() {
    window.dispatchEvent(new CustomEvent('forecast-binding-change'));
  }

  const ForecastBindingStore = {
    project(source) {
      ensureBindingState(source);
      const projected = source.map(group => ({ ...group, children: [] }));
      const targets = new Map(projected.map(group => [group.id, group]));
      bindingState.records.filter(record => record.active).forEach(record => {
        const target = targets.get(record.currentGroupId);
        if (target) target.children.push(record.child);
      });
      return projected;
    },
    rows(source) {
      ensureBindingState(source);
      const groupsById = new Map(source.map(group => [group.id, group]));
      return bindingState.records.map(record => {
        const original = groupsById.get(record.originalGroupId);
        const current = groupsById.get(record.currentGroupId) || original;
        return {
          ...record,
          childASIN: record.child.asin,
          sku: record.child.sku,
          market: current?.market || original?.market || '',
          account: current?.account || original?.account || '',
          originalParent: original?.parent || '',
          currentParent: current?.parent || '',
          changed: record.currentGroupId !== record.originalGroupId
        };
      });
    },
    groups(source) {
      ensureBindingState(source);
      return source.map(group => ({ value: group.id, label: `${group.parent} 丨 ${group.market} 丨 ${group.account}`, market: group.market, account: group.account }));
    },
    bind(keys, targetGroupId) {
      const updatedAt = new Date().toISOString();
      bindingState.records.forEach(record => {
        if (!keys.includes(record.key)) return;
        record.currentGroupId = targetGroupId;
        record.active = true;
        record.updatedAt = updatedAt;
      });
      notifyBindingChange();
    },
    remove(keys) {
      const updatedAt = new Date().toISOString();
      bindingState.records.forEach(record => {
        if (!keys.includes(record.key)) return;
        record.active = false;
        record.updatedAt = updatedAt;
      });
      notifyBindingChange();
    },
    requestAction(action) { bindingState.pendingAction = action; },
    consumeAction() { const action = bindingState.pendingAction; bindingState.pendingAction = null; return action; }
  };
  window.ForecastBindingStore = ForecastBindingStore;

  function baseSourceGroups() {
    return typeof groups === 'undefined' ? [] : groups;
  }

  function sourceGroups() {
    return ForecastBindingStore.project(baseSourceGroups());
  }

  function forecastValue(child, batchDate, date, metric) {
    const result = typeof forecastAt === 'function' ? forecastAt(child, batchDate, date) : null;
    if (!result || result.forecastStatus) return { value: null, status: result?.forecastStatus || null };
    if (metric === 'system') return { value: result.ai ?? result.systemForecast ?? result.systemSplitForecast ?? null, status: null };
    if (metric === 'manual') return { value: result.manual ?? null, status: null };
    if (metric === 'activity') return { value: result.activity?.qty ?? result.activity ?? null, status: null };
    return { value: result.final ?? result.pmc ?? result.pmcBaseline ?? result.ai ?? null, status: null };
  }

  function forecastLines(child, batchDate, date) {
    const result = typeof forecastAt === 'function' ? forecastAt(child, batchDate, date) : null;
    const status = result?.forecastStatus || null;
    const system = status ? null : result?.ai ?? result?.systemForecast ?? result?.systemSplitForecast ?? null;
    const manual = status ? null : result?.manual ?? null;
    const activity = status ? null : result?.activity?.qty ?? result?.activity ?? null;
    const final = status ? null : result?.final ?? result?.pmc ?? result?.pmcBaseline ?? system;
    const source = window.ForecastLedgerValues?.sourceOf?.(result) || (activity != null ? 'activity' : manual != null ? 'manual' : 'system');
    return { system, manual, activity, final, source, status };
  }

  function ForecastWorkbench({ onOpenBinding, onOpenSales, navigationContext } = {}) {
    const { message, modal } = antd.App.useApp();
    const [shareForm] = Form.useForm();
    const emptyFilters = { platform: '', market: '', account: '', owner: '', status: '', keyword: '' };
    const restoredWorkbench = navigationContext?.workbench || {};
    const [treeQuery, setTreeQuery] = useState('');
    const [filterDraft, setFilterDraft] = useState(() => ({ ...emptyFilters, ...(restoredWorkbench.filterDraft || restoredWorkbench.filters || {}) }));
    const [filters, setFilters] = useState(() => ({ ...emptyFilters, ...(restoredWorkbench.filters || {}) }));
    const [revision, setRevision] = useState(0);
    const [collapsedWeeks, setCollapsedWeeks] = useState(() => new Set(restoredWorkbench.collapsedWeeks || []));
    const [windowSize, setWindowSize] = useState(restoredWorkbench.windowSize || 14);
    const [windowStart, setWindowStart] = useState(restoredWorkbench.windowStart || 0);
    const [selectedKey, setSelectedKey] = useState(restoredWorkbench.selectedKey || navigationContext?.entity?.entityKey || null);
    const [treeExpandedKeys, setTreeExpandedKeys] = useState(restoredWorkbench.treeExpandedKeys || []);
    const [treeCheckedKeys, setTreeCheckedKeys] = useState(restoredWorkbench.treeCheckedKeys || []);
    const [treeExcludedKeys, setTreeExcludedKeys] = useState(() => new Set(restoredWorkbench.treeExcludedKeys || []));
    const [treePanelCollapsed, setTreePanelCollapsed] = useState(Boolean(restoredWorkbench.treePanelCollapsed));
    const [expandedRowKeys, setExpandedRowKeys] = useState(restoredWorkbench.expandedRowKeys || []);
    const [expandedForecastKeys, setExpandedForecastKeys] = useState(() => new Set(restoredWorkbench.expandedForecastKeys || []));
    const [hoveredColumn, setHoveredColumn] = useState(null);
    const [hoveredRow, setHoveredRow] = useState(null);
    const [page, setPage] = useState(restoredWorkbench.page || 1);
    const [pageSize, setPageSize] = useState(restoredWorkbench.pageSize || 20);
    const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
    const [drawerRow, setDrawerRow] = useState(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [shareAdjustments, setShareAdjustments] = useState(() => loadStoredObject(workbenchShareStorageKey));
    const [shareEditor, setShareEditor] = useState(null);
    const [columnConfig, setColumnConfig] = useState(loadWorkbenchColumnConfig);
    const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);
    const [columnDraft, setColumnDraft] = useState(null);
    const [columnSearch, setColumnSearch] = useState('');
    const [columnTemplate, setColumnTemplate] = useState(undefined);
    const [columnTemplateNaming, setColumnTemplateNaming] = useState(false);
    const [columnTemplateName, setColumnTemplateName] = useState('');
    const [columnConfigError, setColumnConfigError] = useState('');
    const [columnDropKey, setColumnDropKey] = useState(null);
    const [pageDestination, setPageDestination] = useState(null);
    const [columnWidths, setColumnWidths] = useState({
      identity: 310,
      share: 82,
      context: 188,
      forecastLine: 108
    });
    const resizeSession = useRef(null);
    const draggedColumn = useRef(null);
    const restoredLocation = useRef(false);

    const meta = useMemo(() => currentMeta(), [revision]);
    const batchSnapshot = useMemo(() => window.ForecastBatchContract?.getCurrent?.() || null, [revision]);
    const batchDate = meta.batchDate || meta.forecastStartDate;
    const coverageStart = meta.forecastStartDate || batchDate;
    const coverageEnd = meta.forecastEndDate || dateKey(makeDates(coverageStart, 182).at(-1));
    const coverageDates = useMemo(() => makeDates(coverageStart, dateSpan(coverageStart, coverageEnd)), [coverageStart, coverageEnd]);
    const windowEnd = Math.min(coverageDates.length - 1, windowStart + windowSize - 1);
    const dates = useMemo(() => coverageDates.slice(windowStart, windowEnd + 1), [coverageDates, windowEnd, windowStart]);
    const weeks = useMemo(() => groupWeeks(dates), [dates]);
    const rawGroups = useMemo(() => sourceGroups(), [revision]);

    const checkedLeafKeys = useMemo(() => treeCheckedKeys.filter(key => key.startsWith('child:')), [treeCheckedKeys]);

    const filteredGroups = useMemo(() => {
      const listKeyword = filters.keyword.trim().toLowerCase();
      const treeKeyword = treeQuery.trim().toLowerCase();
      const checked = new Set(checkedLeafKeys);
      const matches = (values, keyword) => !keyword || values.some(value => String(value || '').toLowerCase().includes(keyword));
      return rawGroups.map(group => {
        if (filters.platform && group.platform !== filters.platform) return null;
        if (filters.market && group.market !== filters.market) return null;
        if (filters.account && group.account !== filters.account) return null;
        if (filters.owner && group.owner !== filters.owner) return null;
        const parentValues = [group.parent, group.spu, group.name, group.owner, group.market, group.account];
        const children = group.children.filter(child => {
          const treeKey = `child:${group.id}|${child.id}`;
          const values = [...parentValues, child.asin, child.sku, child.businessCode, child.size];
          if (!matches(values, listKeyword) || !matches(values, treeKeyword)) return false;
          if (treeExcludedKeys.has(treeKey)) return false;
          if (checked.size && !checked.has(treeKey)) return false;
          const status = forecastValue(child, batchDate, dateKey(dates[0]), 'final').status;
          return !filters.status || (filters.status === 'normal' ? !status : Boolean(status));
        });
        return children.length ? { ...group, children } : null;
      }).filter(Boolean);
    }, [batchDate, checkedLeafKeys, dates, filters, rawGroups, treeExcludedKeys, treeQuery]);

    const treeGroups = useMemo(() => {
      const keyword = treeQuery.trim().toLowerCase();
      if (!keyword) return rawGroups;
      return rawGroups.map(group => {
        const parentMatch = [group.parent, group.spu, group.name].some(value => String(value || '').toLowerCase().includes(keyword));
        const children = parentMatch ? group.children : group.children.filter(child => [child.asin, child.sku, child.businessCode].some(value => String(value || '').toLowerCase().includes(keyword)));
        return children.length ? { ...group, children } : null;
      }).filter(Boolean);
    }, [rawGroups, treeQuery]);

    const openTreeBindingAction = (group, child, mode) => {
      ForecastBindingStore.requestAction({ mode, recordKey: `${group.id}|${child.id}`, childASIN: child.asin });
      onOpenBinding?.();
    };
    const treeData = useMemo(() => treeGroups.map(group => ({
          key: `parent:${group.id}`,
          title: h('div', { className: 'fpw-tree-parent-title' },
            h('div', null,
              h('span', { className: 'country-flag fpw-tree-flag', 'aria-hidden': true }, marketFlag(group.market)),
              h('strong', null, group.parent)
            )
          ),
          children: group.children.map(child => {
            const childKey = `child:${group.id}|${child.id}`;
            const excluded = treeExcludedKeys.has(childKey);
            const menuItems = [
              { key: 'heading', label: '在变体列表中', disabled: true },
              { type: 'divider' },
              { key: 'visibility', icon: excluded ? icon('CheckOutlined') : null, label: excluded ? '显示' : '排除' },
              { type: 'divider' },
              { key: 'edit', label: '修改绑定' },
              { key: 'remove', label: '移除绑定', danger: true }
            ];
            return {
              key: childKey,
              title: h('div', { className: `fpw-tree-child-title ${excluded ? 'is-excluded' : ''}` },
                h('span', null, child.asin),
                excluded && h(Tag, { bordered: false }, '已排除'),
                h(Dropdown, {
                  trigger: ['click'],
                  menu: { items: menuItems, onClick: ({ key, domEvent }) => {
                    domEvent?.stopPropagation?.();
                    if (key === 'visibility') {
                      setTreeExcludedKeys(current => { const next = new Set(current); next.has(childKey) ? next.delete(childKey) : next.add(childKey); return next; });
                      return;
                    }
                    openTreeBindingAction(group, child, key === 'remove' ? 'remove' : 'edit');
                  } }
                }, h(Button, { type: 'text', size: 'small', className: 'fpw-tree-more', icon: icon('MoreOutlined'), 'aria-label': `管理 ${child.asin} 变体`, onClick: event => event.stopPropagation() }))
              ),
              isLeaf: true
            };
          })
        })), [onOpenBinding, treeExcludedKeys, treeGroups]);

    const allTreeKeys = useMemo(() => treeData.map(parent => parent.key), [treeData]);
    const allTreeLeafKeys = useMemo(() => treeData.flatMap(parent => parent.children.map(child => child.key)), [treeData]);
    const allParentKeys = useMemo(() => filteredGroups.map(group => `parent:${group.id}`), [filteredGroups]);

    useEffect(() => {
      setTreeExpandedKeys(allTreeKeys);
      setExpandedRowKeys(allParentKeys);
    }, [allTreeKeys.join('|'), allParentKeys.join('|')]);

    useEffect(() => {
      const refreshBindings = () => setRevision(value => value + 1);
      window.addEventListener('forecast-binding-change', refreshBindings);
      window.addEventListener('forecast-batch-change', refreshBindings);
      window.addEventListener('forecast-values-change', refreshBindings);
      return () => {
        window.removeEventListener('forecast-binding-change', refreshBindings);
        window.removeEventListener('forecast-batch-change', refreshBindings);
        window.removeEventListener('forecast-values-change', refreshBindings);
      };
    }, []);

    useEffect(() => {
      const onResize = () => setViewportHeight(window.innerHeight);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
      const onPointerMove = event => {
        const session = resizeSession.current;
        if (!session) return;
        const width = Math.max(session.min, Math.min(session.max, session.startWidth + event.clientX - session.startX));
        setColumnWidths(current => ({ ...current, [session.key]: Math.round(width) }));
      };
      const finishResize = () => {
        if (!resizeSession.current) return;
        resizeSession.current = null;
        document.body.classList.remove('fpw-is-resizing');
      };
      document.addEventListener('pointermove', onPointerMove, true);
      document.addEventListener('pointerup', finishResize, true);
      document.addEventListener('pointercancel', finishResize, true);
      return () => {
        document.removeEventListener('pointermove', onPointerMove, true);
        document.removeEventListener('pointerup', finishResize, true);
        document.removeEventListener('pointercancel', finishResize, true);
        document.body.classList.remove('fpw-is-resizing');
      };
    }, []);

    const rows = useMemo(() => filteredGroups.map(group => {
      const snapshotRows = (batchSnapshot?.childForecastResults || []).filter(item => item.parentASIN === group.parent && item.country === group.market && item.store === group.account);
      const fallbackTotal = group.children.reduce((sum, child) => sum + Math.max(0, Number(child.base || 0)), 0);
      const shareSources = group.children.map(child => {
        const snapshot = snapshotRows.find(item => item.childId === child.id || item.childASIN === child.asin);
        const fallbackShare = fallbackTotal ? Math.max(0, Number(child.base || 0)) / fallbackTotal * 10000 : 10000 / Math.max(1, group.children.length);
        const adjustment = shareAdjustments[`child:${group.id}|${child.id}`];
        return {
          snapshot,
          system: snapshot?.systemShare ?? fallbackShare,
          final: adjustment?.share ?? snapshot?.finalShare ?? fallbackShare,
          reason: adjustment?.reason ?? snapshot?.manualReason ?? null
        };
      });
      const normalizedSystemShares = allocateBasisPoints(10000, shareSources.map(source => source.system));
      const children = group.children.map((child, childIndex) => {
        const forecast = Object.fromEntries(dates.map(date => [dateKey(date), forecastLines(child, batchDate, dateKey(date))]));
        const daily = Object.fromEntries(dates.map(date => {
          const key = dateKey(date);
          return [key, { value: forecast[key].final, status: forecast[key].status }];
        }));
        return {
          key: `child:${group.id}|${child.id}`,
          type: 'child',
          country: group.market,
          group,
          child,
          label: child.asin,
          recentSales: Math.round(Number(child.base || 0) * 30),
          dailySales: Number(child.base || 0),
          fbaAvailable: Number(child.fba || 0),
          fbaInbound: Number(child.fbaInbound || 0),
          dos: Number(child.doi || 0),
          systemShare: normalizedSystemShares[childIndex],
          share: Math.max(0, Math.round(Number(shareSources[childIndex].final) || 0)),
          shareReason: shareSources[childIndex].reason,
          forecast,
          daily
        };
      });
      const forecast = Object.fromEntries(dates.map(date => {
        const key = dateKey(date);
        const sources = children.map(row => row.forecast[key]?.source).filter(Boolean);
        const statuses = [...new Set(children.map(row => row.forecast[key]?.status).filter(Boolean))];
        const values = Object.fromEntries(['system', 'manual', 'activity', 'final'].map(line => [line, total(children.map(row => row.forecast[key]?.[line]))]));
        return [key, { ...values, source: window.ForecastLedgerValues?.sourceOfMany?.(sources) || (sources.includes('activity') ? 'activity' : sources.includes('manual') ? 'manual' : 'system'), status: values.final == null ? statuses.join('；') || null : null }];
      }));
      const daily = Object.fromEntries(dates.map(date => { const key = dateKey(date); return [key, { value: forecast[key].final, status: forecast[key].status }]; }));
      return {
        key: `parent:${group.id}`,
        type: 'parent',
        country: group.market,
        group,
        label: group.parent,
        recentSales: total(children.map(row => row.recentSales)),
        dailySales: total(children.map(row => row.dailySales)),
        fbaAvailable: total(children.map(row => row.fbaAvailable)),
        fbaInbound: total(children.map(row => row.fbaInbound)),
        dos: average(children.map(row => row.dos)),
        share: children.reduce((sum, row) => sum + row.share, 0),
        forecast,
        daily,
        children
      };
    }), [batchDate, batchSnapshot, dates, filteredGroups, revision, shareAdjustments]);

    const pageRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [page, pageSize, rows]);
    const tableRows = useMemo(() => {
      const lineRows = entity => {
        const lines = expandedForecastKeys.has(entity.key) ? ['system', 'manual', 'activity', 'final'] : ['final'];
        const { children: variantChildren, ...entityFields } = entity;
        return lines.map((forecastLine, lineIndex) => ({
          ...entityFields,
          variantChildren,
          entityKey: entity.key,
          key: lineIndex === 0 ? entity.key : `${entity.key}|${forecastLine}`,
          forecastLine,
          lineIndex,
          lineCount: lines.length
        }));
      };
      return pageRows.flatMap(parent => [
        ...lineRows(parent),
        ...(expandedRowKeys.includes(parent.key) ? parent.children.flatMap(lineRows) : [])
      ]);
    }, [expandedForecastKeys, expandedRowKeys, pageRows]);

    useEffect(() => setPageDestination(null), [page, pageSize, rows.length]);

    const gridBorderStyle = { borderInlineEnd: `1px solid ${forecastTableStandards.gridBorder}`, borderBottom: `1px solid ${forecastTableStandards.gridBorder}` };
    const isForecastPeriodColumn = columnKey => columnKey?.startsWith('date:') || columnKey?.startsWith('collapsed:');
    const columnClass = (columnKey, rowKey, extra = '') => [
      extra,
      isForecastPeriodColumn(columnKey) && hoveredColumn === columnKey ? 'fpw-cross-column' : '',
      isForecastPeriodColumn(columnKey) && hoveredColumn === columnKey && hoveredRow === rowKey ? 'fpw-cross-cell' : ''
    ].filter(Boolean).join(' ');
    const cellEvents = (columnKey, rowKey, extra = '') => {
      const events = { className: columnClass(columnKey, rowKey, extra), style: gridBorderStyle };
      if (!isForecastPeriodColumn(columnKey)) return events;
      return {
        ...events,
        onMouseEnter: () => { setHoveredColumn(columnKey); setHoveredRow(rowKey); },
        onMouseLeave: () => { setHoveredColumn(null); setHoveredRow(null); }
      };
    };
    const headerEvents = (columnKey, extra = '') => ({ className: columnClass(columnKey, null, extra), style: gridBorderStyle });
    const fixedBoundaryEvents = events => ({ ...events, style: { ...events.style, borderInlineEnd: `1px solid ${uiStandards.colors?.borderStrong || '#d1d9e7'}` } });

    const defaultColumnWidth = key => key.startsWith('date:') ? forecastTableStandards.dayWidth : key.startsWith('collapsed:') ? forecastTableStandards.weekTotalWidth : ({ identity: 310, share: 82, context: 188, forecastLine: 108 }[key] || 68);
    const resizeLimits = key => key === 'identity' ? [0, 640] : key.startsWith('date:') ? [0, 180] : [0, 240];
    const startResize = (event, key) => {
      const [min, max] = resizeLimits(key);
      resizeSession.current = { key, startX: event.clientX, startWidth: columnWidths[key] ?? defaultColumnWidth(key), min, max };
      document.body.classList.add('fpw-is-resizing');
      event.preventDefault();
      event.stopPropagation();
    };
    const resizeByKeyboard = (event, key) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const [min, max] = resizeLimits(key);
      const step = forecastTableStandards.keyboardResizeStep || 8;
      setColumnWidths(current => ({ ...current, [key]: Math.max(min, Math.min(max, (current[key] ?? defaultColumnWidth(key)) + (event.key === 'ArrowRight' ? step : -step))) }));
    };
    const resizeHandle = (key, label) => h('span', {
      className: 'fpw-column-resizer',
      role: 'separator',
      tabIndex: 0,
      'aria-orientation': 'vertical',
      'aria-label': `调整${label}列宽`,
      'aria-valuemin': 0,
      'aria-valuenow': columnWidths[key] ?? defaultColumnWidth(key),
      onPointerDown: event => startResize(event, key),
      onKeyDown: event => resizeByKeyboard(event, key)
    });
    const resizableTitle = (label, key, action = null, accessibleLabel = typeof label === 'string' ? label : '字段') => h('div', { className: 'fpw-resizable-title' }, h('span', null, label), action, resizeHandle(key, accessibleLabel));

    const copyCode = async value => {
      try {
        await navigator.clipboard.writeText(value);
        message.success('编码已复制');
      } catch {
        message.error('复制失败，请重试');
      }
    };

    const openDrawer = (row, event) => {
      event?.stopPropagation?.();
      setSelectedKey(row.key);
      setDrawerRow(row);
    };

    const identity = row => {
      const value = row.type === 'parent' ? row.group.parent : row.child.asin;
      const entityKey = row.entityKey || row.key;
      const expanded = expandedRowKeys.includes(entityKey);
      const toggleVariant = event => {
        event.stopPropagation();
        setExpandedRowKeys(current => current.includes(entityKey) ? current.filter(key => key !== entityKey) : [...current, entityKey]);
      };
      const codeValue = (code, label, onActivate = null) => h('span', { className: `fpw-code-value code-value ${onActivate ? 'is-actionable' : ''}` },
        h(Tooltip, { title: label, mouseEnterDelay: 0.2 },
          h('button', { type: 'button', className: 'fpw-code-trigger code-text', 'aria-label': onActivate ? `${label}：${code}，查看详情` : `${label}：${code}`, onClick: event => { event.stopPropagation(); onActivate?.(event); } }, code)
        ),
        h('button', { type: 'button', className: 'copy-code fpw-copy-code', 'aria-label': `复制${label} ${code}`, onClick: event => { event.stopPropagation(); copyCode(code); } }, copyGlyph())
      );
      return h('div', { className: `fpw-identity fpw-identity-${row.type}` },
        row.type === 'child' && h('span', { className: 'fpw-child-branch', 'aria-hidden': true }),
        row.type === 'child' && h('button', { className: 'thumb fpw-child-thumb', type: 'button', 'data-preview': row.group.image, 'aria-label': `放大${row.group.name || row.child.asin}主图`, onClick: event => event.stopPropagation() }, h('img', { src: row.group.image, alt: row.group.name || row.child.asin })),
        h('div', { className: 'fpw-identity-copy' },
          h('div', { className: 'fpw-code-line' },
            row.type === 'parent' && h('button', { type: 'button', className: 'collapse fpw-parent-collapse', 'aria-label': `${expanded ? '收起' : '展开'} ${value} 变体`, 'aria-expanded': expanded, onClick: toggleVariant }, stateToggleGlyph(expanded)),
            row.type === 'parent' && h('span', { className: 'country-flag fpw-country-flag', 'aria-hidden': true }, marketFlag(row.group.market)),
            codeValue(value, row.type === 'parent' ? '父ASIN' : '子ASIN', event => openDrawer(row, event)),
            row.type === 'parent' && h('span', { className: 'fpw-inline-separator', 'aria-hidden': true }, '丨'),
            row.type === 'parent' && codeValue(row.group.spu, 'SPU')
          ),
          row.type === 'parent'
            ? h(React.Fragment, null,
                h('div', { className: 'fpw-parent-meta' },
                  h('span', null, `${row.group.platform} · ${row.group.market}`),
                  h('span', { className: 'fpw-inline-separator', 'aria-hidden': true }, '丨'),
                  h('span', { className: 'fpw-store' }, h('span', { className: 'store-icon', 'aria-hidden': true }, icon('ShopOutlined')), h('span', { className: 'store-name' }, row.group.account)),
                  h('span', { className: 'fpw-inline-separator', 'aria-hidden': true }, '丨'),
                  h('span', null, `销售：${row.group.owner}`)
                ),
                h('div', { className: 'fpw-parent-tags product-tags' }, (row.group.tags || []).slice(0, 3).map(tag => {
                  const definition = tagDefinitions[tag] || { tone: '', hint: `商品标签：${tag}` };
                  const color = { green: 'success', blue: 'processing', amber: 'warning', purple: 'default' }[definition.tone] || 'default';
                  return h(Tooltip, { key: tag, title: definition.hint.split('：')[0], mouseEnterDelay: 0.25 }, h(Tag, { color, 'data-tag-category': definition.hint.split('：')[0], style: { ...salesTagPalette[definition.tone], fontSize: 12, lineHeight: '18px', fontWeight: 400, paddingInline: 3, marginInlineEnd: 0, borderRadius: 3 } }, tag));
                }))
              )
            : h(Tooltip, { title: '业务识别码', mouseEnterDelay: 0.2 }, h('span', { className: 'fpw-child-meta', tabIndex: 0 }, row.child.businessCode || row.child.sku))
        )
      );
    };

    const drawerBatchRows = drawerRow ? (batchSnapshot?.childForecastResults || []).filter(item => item.parentASIN === drawerRow.group.parent && item.country === drawerRow.group.market && item.store === drawerRow.group.account) : [];
    const drawerBatchRow = drawerRow?.type === 'child' ? drawerBatchRows.find(item => item.childId === drawerRow.child.id || item.childASIN === drawerRow.child.asin) : null;
    const drawerLineTotals = drawerRow ? Object.fromEntries(['system', 'manual', 'activity', 'final'].map(line => [line, total(dates.map(date => drawerRow.forecast[dateKey(date)]?.[line]))])) : {};
    const drawerLineDays = drawerRow ? Object.fromEntries(['manual', 'activity'].map(line => [line, dates.filter(date => drawerRow.forecast[dateKey(date)]?.[line] != null).length])) : {};
    const drawerSourceCounts = drawerRow ? dates.reduce((counts, date) => {
      const forecast = drawerRow.forecast[dateKey(date)];
      if (forecast?.final == null || !forecast.source) return counts;
      counts[forecast.source] = (counts[forecast.source] || 0) + 1;
      return counts;
    }, {}) : {};
    const drawerStatuses = drawerRow ? [...new Set(dates.map(date => drawerRow.forecast[dateKey(date)]?.status).filter(Boolean))] : [];
    const sourceOrder = ['system', 'manual', 'activity'];
    const sourceSummary = sourceOrder.filter(source => drawerSourceCounts[source]).map(source => `${({ system: '规则', manual: '人工', activity: '活动' })[source]} ${drawerSourceCounts[source]} 天`).join(' / ') || drawerStatuses.join('；') || '—';
    const drawerWindowStartKey = dates[0] ? dateKey(dates[0]) : coverageStart;
    const drawerWindowEndKey = dates.at(-1) ? dateKey(dates.at(-1)) : coverageEnd;
    const formatDateTime = value => value ? dayjs(value).format('YYYY/MM/DD HH:mm') : '—';
    const currentShare = drawerRow?.type === 'child'
      ? shareAdjustments[`child:${drawerRow.group.id}|${drawerRow.child.id}`]?.share ?? drawerBatchRow?.finalShare ?? drawerRow.share
      : null;
    const drawerTags = drawerRow ? [...new Set(drawerRow.type === 'parent' ? drawerRow.group.tags || [] : drawerBatchRow?.tags || drawerRow.group.tags || [])] : [];
    const drawerResultLines = drawerRow ? [
      { key: 'system', label: '规则预测', value: drawerLineTotals.system, note: '本批次规则结果' },
      { key: 'manual', label: '人工预测', value: drawerLineTotals.manual, note: drawerLineDays.manual ? `已填写 ${drawerLineDays.manual} 天` : '未填写' },
      { key: 'activity', label: '活动预测', value: drawerLineTotals.activity, note: drawerLineDays.activity ? `已填写 ${drawerLineDays.activity} 天` : '未填写' },
      { key: 'final', label: '最终预测', value: drawerLineTotals.final, note: sourceSummary }
    ] : [];
    const drawerNavigationContext = drawerRow ? {
      batchDate,
      windowStartDate: drawerWindowStartKey,
      windowEndDate: drawerWindowEndKey,
      entity: {
        type: drawerRow.type,
        entityKey: drawerRow.entityKey || drawerRow.key,
        parentEntityKey: `parent:${drawerRow.group.id}`,
        groupId: drawerRow.group.id,
        platform: drawerRow.group.platform,
        market: drawerRow.group.market,
        account: drawerRow.group.account,
        owner: drawerRow.group.owner,
        parentAsin: drawerRow.group.parent,
        childId: drawerRow.type === 'child' ? drawerRow.child.id : null,
        childAsin: drawerRow.type === 'child' ? drawerRow.child.asin : null,
        label: drawerRow.type === 'child' ? drawerRow.child.asin : drawerRow.group.parent
      },
      workbench: {
        filters: { ...filters },
        filterDraft: { ...filterDraft },
        page,
        pageSize,
        windowStart,
        windowSize,
        collapsedWeeks: [...collapsedWeeks],
        selectedKey: drawerRow.entityKey || drawerRow.key,
        expandedRowKeys: [...new Set([...expandedRowKeys, `parent:${drawerRow.group.id}`])],
        expandedForecastKeys: [...new Set([...expandedForecastKeys, drawerRow.entityKey || drawerRow.key])],
        treeExpandedKeys: [...treeExpandedKeys],
        treeCheckedKeys: [...treeCheckedKeys],
        treeExcludedKeys: [...treeExcludedKeys],
        treePanelCollapsed
      }
    } : null;
    const forecastBasisPanel = drawerRow && h('div', { className: 'fpw-drawer-content' },
      h('section', { className: 'fpw-drawer-section', 'aria-labelledby': 'fpw-batch-heading' },
        h('div', { className: 'fpw-drawer-section-head' }, h('h3', { id: 'fpw-batch-heading' }, '批次信息'), h(Tag, { color: 'processing' }, batchSnapshot?.status || meta.status || '当前批次')),
        h(Descriptions, {
          size: 'small',
          column: 2,
          items: [
            { key: 'batch', label: '预测批次', span: 2, children: batchSnapshot?.name || `${dateText(batchDate)} 预测批次` },
            { key: 'batch-version', label: '批次版本', children: batchSnapshot?.batchVersion || meta.batchVersion || '—' },
            { key: 'result-version', label: '结果版本', children: batchSnapshot?.activeResultVersion || meta.activeResultVersion || '—' },
            { key: 'period', label: '预测周期', span: 2, children: `${dateText(coverageStart)} ~ ${dateText(coverageEnd)}` },
            { key: 'window', label: '当前查看窗口', span: 2, children: `${dateText(drawerWindowStartKey)} ~ ${dateText(drawerWindowEndKey)}（${dates.length} 天）` },
            { key: 'cutoff', label: '数据截至', children: dateText(batchSnapshot?.dataCutoffDate || meta.dataCutoffDate) },
            { key: 'updated', label: '数据更新时间', children: formatDateTime(batchSnapshot?.dataUpdatedAt || meta.dataUpdatedAt) }
          ]
        })
      ),
      h('section', { className: 'fpw-drawer-section', 'aria-labelledby': 'fpw-object-heading' },
        h('h3', { id: 'fpw-object-heading' }, '当前预测对象'),
        h(Descriptions, {
          size: 'small',
          column: 2,
          items: [
            { key: 'entry', label: '进入路径', span: 2, children: `预测工作台 / ${drawerRow.type === 'parent' ? '父ASIN' : '子ASIN'}` },
            { key: 'type', label: '对象类型', children: drawerRow.type === 'parent' ? '父ASIN' : '子ASIN' },
            { key: 'asin', label: drawerRow.type === 'parent' ? '父ASIN' : '子ASIN', children: drawerRow.type === 'parent' ? drawerRow.group.parent : drawerRow.child.asin },
            { key: 'parent', label: '所属父ASIN', children: drawerRow.group.parent },
            { key: 'sku', label: drawerRow.type === 'parent' ? 'SPU' : 'SKU', children: drawerRow.type === 'parent' ? drawerRow.group.spu : drawerRow.child.sku },
            { key: 'site', label: '平台 / 站点', children: `${drawerRow.group.platform} / ${drawerRow.group.market}` },
            { key: 'store', label: '账号 / 店铺', children: drawerRow.group.account },
            { key: 'owner', label: '销售负责人', children: drawerRow.group.owner },
            { key: 'scope', label: '预测范围', span: 2, children: `${dateText(drawerWindowStartKey)} ~ ${dateText(drawerWindowEndKey)}` }
          ]
        })
      ),
      h('section', { className: 'fpw-drawer-section', 'aria-labelledby': 'fpw-result-heading' },
        h('div', { className: 'fpw-drawer-section-head' }, h('h3', { id: 'fpw-result-heading' }, '预测结果形成'), h('span', { className: 'fpw-result-unit' }, '当前窗口 · 件')),
        h('div', { className: 'fpw-result-formation' }, drawerResultLines.map(line => h('div', { key: line.key, className: `fpw-result-line is-${line.key}` },
          h('span', null, line.label),
          h('strong', null, formatNumber(line.value)),
          h('small', null, line.note)
        ))),
        h('div', { className: 'fpw-formation-rule' }, h('strong', null, '最终值形成'), h('span', null, '按日期取值：活动预测 > 人工预测 > 规则预测。'))
      ),
      h('section', { className: 'fpw-drawer-section', 'aria-labelledby': 'fpw-basis-heading' },
        h('h3', { id: 'fpw-basis-heading' }, '预测依据'),
        h(Descriptions, {
          size: 'small',
          column: 2,
          items: [
            { key: 'recent-sales', label: '近30天销量', children: `${formatNumber(drawerRow.recentSales)} 件` },
            { key: 'daily-sales', label: '近30天日均', children: `${formatNumber(drawerRow.dailySales)} 件` },
            { key: 'share', label: drawerRow.type === 'child' ? '子ASIN份额占比' : '子ASIN范围', children: drawerRow.type === 'child' ? formatShare(currentShare) : `${drawerRow.group.children.length} 个子ASIN` },
            { key: 'tags', label: '商品标签', children: h('span', { className: 'fpw-drawer-tags' }, drawerTags.length ? drawerTags.map(tag => h(Tag, { key: tag }, tag)) : '—') },
            { key: 'forecast-rule', label: '预测规则快照', children: batchSnapshot?.forecastRuleSnapshot?.version || meta.forecastRuleVersion || '—' },
            { key: 'season-rule', label: '季节规则快照', children: batchSnapshot?.seasonRuleVersion || meta.seasonRuleVersion || '—' },
            { key: 'relation-rule', label: '父子关系快照', children: batchSnapshot?.relationVersion || meta.relationVersion || '—' },
            { key: 'split-rule', label: '拆分规则快照', children: batchSnapshot?.splitRuleSnapshot?.version || meta.splitRuleVersion || '—' }
          ]
        })
      )
    );

    const metricHints = {
      recentSales: '当前子ASIN近30天销量；父ASIN为可见子体汇总',
      dailySales: '近30天销量除以有效天数后的日均销量',
      fbaAvailable: '当前FBA可售库存',
      fbaInbound: '已发往FBA但尚未入库的在途库存',
      dos: 'FBA可售库存按当前日均销量折算的可售天数'
    };
    const fieldTitle = (title, key) => h(Tooltip, { title: metricHints[key], mouseEnterDelay: 0.2 }, h('span', { className: 'fpw-field-title', tabIndex: 0 }, title));
    const visibleColumnKeys = columnConfig.keys;
    const forecastLineKeys = ['system', 'manual', 'activity', 'final'];
    const forecastLineLabels = { system: '规则预测', manual: '人工预测', activity: '活动预测', final: '最终预测' };
    const forecastSourceLabels = window.ForecastLedgerValues?.sourceLabels || { system: '规则', manual: '人工', activity: '活动' };
    const metricDefinitions = {
      recentSales: { label: '近30天销量', value: row => formatNumber(row.recentSales) },
      dailySales: { label: '近30天日均', value: row => formatNumber(row.dailySales) },
      fbaAvailable: { label: 'FBA在库', value: row => formatNumber(row.fbaAvailable), tone: 'stock' },
      fbaInbound: { label: 'FBA在途', value: row => formatNumber(row.fbaInbound), tone: 'stock' },
      dos: { label: 'FBA DOS', value: row => row.dos == null ? '—' : `${formatNumber(row.dos)} 天`, tone: row => Number(row.dos) < 20 ? 'warn' : '' }
    };
    const contextContent = row => h('div', { className: 'fpw-metric-grid metric-grid' }, visibleColumnKeys.map(key => {
      const definition = metricDefinitions[key];
      if (!definition) return null;
      const tone = typeof definition.tone === 'function' ? definition.tone(row) : definition.tone || '';
      return h('div', { className: 'fpw-metric metric', key },
        h(Tooltip, { title: metricHints[key], mouseEnterDelay: 0.2 }, h('label', { tabIndex: 0 }, definition.label)),
        h('strong', { className: tone }, definition.value(row))
      );
    }));

    const openSharedForecastEditor = (row, line, date, event) => {
      event?.stopPropagation?.();
      const key = dateKey(date);
      if (typeof canEdit === 'function' && !canEdit(key)) return message.warning('当前日期不可编辑');
      if (!window.openForecastEditor) return message.error('预测编辑器未就绪，请刷新后重试');
      const target = row.type === 'child'
        ? { id: row.child.id }
        : { ids: row.variantChildren.map(childRow => childRow.child.id), weights: row.variantChildren.map(childRow => childRow.share), label: row.group.parent };
      window.openForecastEditor({ kind: line === 'manual' ? 'manual' : 'activity', key, ...target });
    };
    const lineValue = (row, days, line) => {
      const values = days.map(date => row.forecast[dateKey(date)]?.[line]);
      return days.length === 1 ? values[0] : total(values);
    };
    const signedForecastValue = value => `${value > 0 ? '+' : ''}${formatNumber(value)}`;
    const adjustmentDetails = (row, line, key, value) => {
      const children = row.type === 'child' ? [row.child] : row.variantChildren.map(item => item.child);
      const drafts = children.map(child => batchDraft(child, batchDate));
      const expectedLine = line === 'manual' ? '人工预测' : '活动预测';
      const changes = drafts.flatMap(draft => draft.changes || []).filter(item => item.date === key && item.line === expectedLine);
      const latest = [...changes].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))[0];
      const uniqueText = values => [...new Set(values.filter(Boolean))].join('；');
      const changeTime = latest?.at ? dayjs(latest.at).format('YYYY/MM/DD HH:mm') : '';
      if (line === 'manual') {
        return [
          ['预测日期', key.replaceAll('-', '/')],
          ['人工预测销量', formatNumber(value)],
          ['调整原因', uniqueText(drafts.map(draft => draft.manualReasons[key]))],
          ['调整人', latest?.by || row.group.owner || ''],
          ['调整时间', changeTime]
        ];
      }
      const events = drafts.map(draft => draft.activity[key]).filter(Boolean);
      return [
        ['活动日期', key.replaceAll('-', '/')],
        ['活动预测销量', formatNumber(value)],
        ['活动名称', uniqueText(events.map(event => event.name))],
        ['备注', uniqueText(events.map(event => event.note))],
        ['调整人', latest?.by || row.group.owner || ''],
        ['调整时间', changeTime]
      ];
    };
    const forecastLineContent = row => {
      const line = row.forecastLine;
      return h('div', { className: `fpw-line-label fpw-line-${line}` },
        h('span', null, forecastLineLabels[line])
      );
    };
    const forecastCell = (row, days) => {
      const line = row.forecastLine;
      const singleDay = days.length === 1;
      const date = days[0];
      const status = singleDay ? row.forecast[dateKey(date)]?.status : null;
      const value = lineValue(row, days, line);
      const editable = singleDay && (line === 'manual' || line === 'activity') && (typeof canEdit !== 'function' || canEdit(dateKey(date)));
      if (editable) {
        const key = dateKey(date);
        const forecast = row.forecast[key] || {};
        const baseline = line === 'manual' ? forecast.system : (forecast.manual ?? forecast.system);
        const delta = value == null || baseline == null ? null : value - baseline;
        const label = delta == null ? '' : signedForecastValue(delta);
        if (window.ForecastEditableValue) return h(window.ForecastEditableValue, {
          value,
          valueText: value == null ? '' : formatNumber(value),
          ariaLabel: `${row.label} ${dateLabel(date)} ${forecastLineLabels[line]}`,
          onEdit: event => openSharedForecastEditor(row, line, date, event),
          className: `fpw-line-value fpw-line-${line} fpw-forecast-entry-wrap`,
          buttonClassName: `fpw-entry-button fpw-line-${line} ${value == null ? 'fpw-entry-empty' : 'fpw-entry-value'}`,
          adjustmentClassName: 'fpw-adjustment-entry',
          adjustmentLabel: delta == null ? null : label,
          adjustmentContent: `${forecastLineLabels[line]}调整说明`,
          adjustmentAriaLabel: `${forecastLineLabels[line]}详情`,
          adjustmentDetails: value == null ? [] : adjustmentDetails(row, line, key, value)
        });
        return h('button', {
          type: 'button',
          className: `fpw-line-value fpw-line-${line} fpw-entry-button ${value == null ? 'fpw-entry-empty' : 'fpw-entry-value'}`,
          'aria-label': `${row.label} ${dateLabel(date)} ${forecastLineLabels[line]}`,
          onClick: event => openSharedForecastEditor(row, line, date, event)
        }, h('span', null, value == null ? '' : formatNumber(value)), h('span', { className: 'edit-icon', 'aria-hidden': true }, icon('EditOutlined')));
      }
      if (line === 'final') {
          const sources = days.map(day => row.forecast[dateKey(day)]?.source).filter(Boolean);
          const source = window.ForecastLedgerValues?.sourceOfMany?.(sources) || (sources.includes('activity') ? 'activity' : sources.includes('manual') ? 'manual' : 'system');
          return h(Tooltip, { title: status || null }, h('span', { className: `fpw-line-value fpw-line-final ${value == null ? 'fpw-empty-value' : ''}` },
            h('strong', null, value == null ? '—' : formatNumber(value)),
            value != null && h('small', { className: `fpw-source-${source}` }, `(${forecastSourceLabels[source] || '规则'})`)
          ));
      }
      return h(Tooltip, { title: status || null }, h('span', { className: `fpw-line-value fpw-line-${line} ${value == null ? 'fpw-empty-value' : ''}` }, value == null ? '—' : formatNumber(value)));
    };

    const weekColumns = weeks.map((week, weekIndex) => {
      const collapsed = collapsedWeeks.has(week.key);
      const toggleWeek = event => {
        event.stopPropagation();
        setCollapsedWeeks(current => {
          const next = new Set(current);
          next.has(week.key) ? next.delete(week.key) : next.add(week.key);
          return next;
        });
      };
      const title = h('div', { className: 'fpw-week-title' },
        h('strong', null, week.label),
        h('button', { type: 'button', className: 'fpw-week-toggle', 'aria-label': `${collapsed ? '展开' : '收起'} ${week.label} ${dateLabel(week.days[0])} ~ ${dateLabel(week.days.at(-1))}`, 'aria-expanded': !collapsed, onClick: toggleWeek }, weekToggleGlyph(collapsed))
      );
      const dayColumns = week.days.map(date => {
        const key = `date:${dateKey(date)}`;
        const weekend = [0, 6].includes(date.getDay());
        return {
          title: h('div', { className: 'fpw-day-title' }, h('span', null, dateLabel(date)), h('small', null, `周${dayNames[date.getDay()]}`), resizeHandle(key, dateLabel(date))),
          key,
          width: columnWidths[key] ?? defaultColumnWidth(key),
          render: (_, row) => forecastCell(row, [date]),
          onCell: row => cellEvents(key, row.key, `${weekend ? 'fpw-weekend-cell ' : ''}fpw-forecast-cell ${weekIndex > 0 && date === week.days[0] ? 'fpw-week-boundary' : ''}`),
          onHeaderCell: () => headerEvents(key, `${weekend ? 'fpw-weekend-header ' : ''}fpw-header-cell fpw-day-header ${weekIndex > 0 && date === week.days[0] ? 'fpw-week-boundary' : ''}`)
        };
      });
      const collapsedKey = `collapsed:${week.key}`;
      const collapsedColumn = {
        title: h('div', { className: 'fpw-day-title fpw-week-range-title' },
          h('span', null, `${dateLabel(week.days[0])} ~ ${dateLabel(week.days.at(-1))}`),
          resizeHandle(collapsedKey, `${week.label}合计`)
        ),
        key: collapsedKey,
        width: columnWidths[collapsedKey] ?? defaultColumnWidth(collapsedKey),
        render: (_, row) => forecastCell(row, week.days),
        onCell: row => cellEvents(collapsedKey, row.key, `fpw-week-collapsed-cell fpw-forecast-cell ${weekIndex > 0 ? 'fpw-week-boundary' : ''}`),
        onHeaderCell: () => headerEvents(collapsedKey, `fpw-header-cell fpw-week-collapsed-header ${weekIndex > 0 ? 'fpw-week-boundary' : ''}`)
      };
      return { title, key: week.key, onHeaderCell: () => ({ className: `fpw-week-group ${weekIndex > 0 ? 'fpw-week-boundary' : ''}`, style: { ...gridBorderStyle, borderBottom: `1px solid ${uiStandards.colors?.borderStrong || '#d1d9e7'}` } }), children: collapsed ? [collapsedColumn] : dayColumns };
    });

    const allVariantsExpanded = allParentKeys.length > 0 && allParentKeys.every(key => expandedRowKeys.includes(key));
    const variantHeaderAction = h('span', { className: 'fpw-variant-header-actions' },
      h(Tooltip, { title: allVariantsExpanded ? '收起全部父子ASIN' : '展开全部父子ASIN' }, h(Button, {
        type: 'text', size: 'small', className: 'forecast-state-toggle tree-tool', icon: stateToggleGlyph(allVariantsExpanded),
        'aria-label': allVariantsExpanded ? '一键收起全部父子ASIN' : '一键展开全部父子ASIN', 'aria-expanded': allVariantsExpanded,
        onClick: event => { event.stopPropagation(); setExpandedRowKeys(allVariantsExpanded ? [] : allParentKeys); }
      }))
    );

    const allForecastKeys = rows.flatMap(parent => [parent.key, ...parent.children.map(child => child.key)]);
    const allForecastExpanded = allForecastKeys.length > 0 && allForecastKeys.every(key => expandedForecastKeys.has(key));
    const forecastHeaderAction = h(Tooltip, { title: allForecastExpanded ? '收起全部预测线' : '展开全部预测线' }, h(Button, {
      type: 'text', size: 'small', className: 'forecast-state-toggle fpw-forecast-toggle', icon: stateToggleGlyph(allForecastExpanded),
      'aria-label': allForecastExpanded ? '收起全部预测线' : '展开全部预测线',
      onClick: event => { event.stopPropagation(); setExpandedForecastKeys(allForecastExpanded ? new Set() : new Set(allForecastKeys)); }
    }));

    const openShareEditor = (row, event) => {
      event?.stopPropagation?.();
      setShareEditor(row);
      shareForm.setFieldsValue({ share: Number((row.share / 100).toFixed(2)), reason: row.shareReason || '' });
    };
    const saveShare = values => {
      if (!shareEditor) return;
      const parent = rows.find(row => row.type === 'parent' && row.group.id === shareEditor.group.id);
      if (!parent) return message.error('未找到当前父ASIN变体');
      const target = Math.round(Number(values.share) * 100);
      if (!Number.isFinite(target) || target < 0 || target > 10000) return message.error('子ASIN份额占比必须在0%至100%之间');
      const reason = values.reason.trim();
      const sharesByAsin = Object.fromEntries(parent.children.map(row => [row.child.asin, row.key === shareEditor.key ? target : row.share]));
      const shareTotal = Object.values(sharesByAsin).reduce((sum, value) => sum + value, 0);
      const relationKey = [shareEditor.group.market, shareEditor.group.account, shareEditor.group.parent].join('|');
      const contract = window.ForecastBatchContract;
      try {
        const hasContractRows = Boolean(batchSnapshot?.childForecastResults?.some(item => item.parentASIN === shareEditor.group.parent && item.country === shareEditor.group.market && item.store === shareEditor.group.account));
        if (shareTotal === 10000 && hasContractRows && contract?.adjustShares) contract.adjustShares(batchSnapshot.id || meta.id, relationKey, sharesByAsin, reason);
        const updatedAt = new Date().toISOString();
        const next = { ...shareAdjustments, [shareEditor.key]: { share: target, reason, updatedAt } };
        localStorage.setItem(workbenchShareStorageKey, JSON.stringify(next));
        setShareAdjustments(next);
        setShareEditor(null);
        shareForm.resetFields();
        setRevision(value => value + 1);
        const totalText = formatShare(shareTotal);
        if (shareTotal > 10000) message.warning(`子ASIN份额占比已保存，当前父ASIN合计 ${totalText}，已超过100%`);
        else message.success(`子ASIN份额占比已保存，当前父ASIN合计 ${totalText}`);
      } catch (error) {
        message.error(error.message || '占比保存失败，请重试');
      }
    };

    const shareContent = row => {
      if (row.type === 'parent') {
        const over = row.share > 10000;
        return h(Tooltip, { title: over ? '子ASIN份额占比合计超过100%，请检查并调整' : null }, h('strong', { className: `fpw-parent-share ${over ? 'is-over' : ''}` },
          over && h('span', { className: 'fpw-share-warning', 'aria-label': '份额占比合计超过100%' }, icon('WarningOutlined')),
          formatShare(row.share)
        ));
      }
      const trigger = h(Button, { type: 'text', size: 'small', className: 'fpw-share-entry', 'aria-label': `编辑子ASIN ${row.child.asin} 份额占比`, onClick: event => openShareEditor(row, event) },
        h('span', { className: 'fpw-share-value' }, formatShare(row.share)),
        h('span', { className: 'fpw-share-edit-slot', 'aria-hidden': true }, icon('EditOutlined'))
      );
      if (!row.shareReason) return trigger;
      return h(Popover, { trigger: ['hover', 'focus'], placement: 'top', content: h('div', { className: 'fpw-share-reason' }, h('strong', null, '份额占比调整'), h('span', null, `系统份额占比：${formatShare(row.systemShare)}`), h('span', null, `最终份额占比：${formatShare(row.share)}`), h('span', null, `调整原因：${row.shareReason}`)) }, trigger);
    };

    const shareColumn = {
      title: resizableTitle('占比', 'share'),
      key: 'share',
      width: columnWidths.share,
      fixed: 'left',
      align: 'left',
      render: (_, row) => shareContent(row),
      onCell: row => ({ ...cellEvents('share', row.key, 'fpw-number-cell fpw-share-cell'), rowSpan: row.lineIndex === 0 ? row.lineCount : 0 }),
      onHeaderCell: () => headerEvents('share', 'fpw-header-cell fpw-share-header')
    };

    const columns = [
      { title: resizableTitle('变体', 'identity', variantHeaderAction), key: 'identity', width: columnWidths.identity, fixed: 'left', render: (_, row) => identity(row), onCell: row => ({ ...cellEvents('identity', row.key, 'fpw-identity-cell'), rowSpan: row.lineIndex === 0 ? row.lineCount : 0 }), onHeaderCell: () => headerEvents('identity', 'fpw-header-cell fpw-identity-header') },
      shareColumn,
      visibleColumnKeys.length && { title: resizableTitle('销量 / 库存', 'context'), key: 'context', width: columnWidths.context, fixed: 'left', render: (_, row) => contextContent(row), onCell: row => ({ ...cellEvents('context', row.key, 'fpw-context-cell'), rowSpan: row.lineIndex === 0 ? row.lineCount : 0 }), onHeaderCell: () => headerEvents('context', 'fpw-header-cell fpw-context-header') },
      { title: resizableTitle('预测线', 'forecastLine', forecastHeaderAction), key: 'forecastLine', width: columnWidths.forecastLine, fixed: 'left', render: (_, row) => forecastLineContent(row), onCell: row => fixedBoundaryEvents(cellEvents('forecastLine', row.key, 'fpw-line-cell fpw-fixed-boundary')), onHeaderCell: () => fixedBoundaryEvents(headerEvents('forecastLine', 'fpw-header-cell fpw-line-header fpw-fixed-boundary')) },
      ...weekColumns
    ].filter(Boolean);
    const tableScrollWidth = 40 + columns.reduce((sum, column) => sum + (column.children
      ? column.children.reduce((childSum, child) => childSum + Number(child.width || 0), 0)
      : Number(column.width || 0)), 0);

    const locateRow = (key, parentKey = null) => {
      setSelectedKey(key);
      const expandableKey = key.startsWith('parent:') ? key : parentKey;
      if (expandableKey) setExpandedRowKeys(current => current.includes(expandableKey) ? current : [...current, expandableKey]);
      requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector(`[data-row-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })));
    };

    useEffect(() => {
      const restored = navigationContext?.workbench;
      if (!navigationContext?.entity?.entityKey || !restored) return;
      restoredLocation.current = false;
      setFilterDraft({ ...emptyFilters, ...(restored.filterDraft || restored.filters || {}) });
      setFilters({ ...emptyFilters, ...(restored.filters || {}) });
      setPage(restored.page || 1);
      setPageSize(restored.pageSize || 20);
      setWindowStart(restored.windowStart || 0);
      setWindowSize(restored.windowSize || 14);
      setCollapsedWeeks(new Set(restored.collapsedWeeks || []));
      setSelectedKey(restored.selectedKey || navigationContext.entity.entityKey);
      setExpandedRowKeys(restored.expandedRowKeys || []);
      setExpandedForecastKeys(new Set(restored.expandedForecastKeys || []));
      setTreeExpandedKeys(restored.treeExpandedKeys || []);
      setTreeCheckedKeys(restored.treeCheckedKeys || []);
      setTreeExcludedKeys(new Set(restored.treeExcludedKeys || []));
      setTreePanelCollapsed(Boolean(restored.treePanelCollapsed));
    }, [navigationContext]);

    useEffect(() => {
      const entity = navigationContext?.entity;
      if (!entity?.entityKey || restoredLocation.current || !tableRows.some(row => row.entityKey === entity.entityKey)) return;
      restoredLocation.current = true;
      locateRow(entity.entityKey, entity.parentEntityKey);
    }, [navigationContext?.entity?.entityKey, tableRows]);

    const closeDrawerAndLocate = () => {
      if (!drawerRow) return;
      locateRow(drawerRow.entityKey || drawerRow.key, `parent:${drawerRow.group.id}`);
      setDrawerRow(null);
    };
    const enterSalesForecast = () => {
      if (!drawerNavigationContext || !onOpenSales) return message.warning('销售预测填报入口未就绪');
      setDrawerRow(null);
      onOpenSales(drawerNavigationContext);
    };

    const selectAllVariants = () => setTreeCheckedKeys(allTreeLeafKeys);
    const invertVariantSelection = () => {
      const checked = new Set(checkedLeafKeys);
      setTreeCheckedKeys(allTreeLeafKeys.filter(key => !checked.has(key)));
    };
    const excludeSelectedVariants = () => {
      if (!checkedLeafKeys.length) return message.warning('请先勾选需要排除的变体');
      setTreeExcludedKeys(current => {
        const next = new Set(current);
        const restore = checkedLeafKeys.every(key => next.has(key));
        checkedLeafKeys.forEach(key => restore ? next.delete(key) : next.add(key));
        return next;
      });
      setTreeCheckedKeys([]);
      setPage(1);
    };
    const openBindingPage = action => {
      if (action) ForecastBindingStore.requestAction(action);
      onOpenBinding?.();
    };
    const parentCount = filteredGroups.length;
    const childCount = filteredGroups.reduce((sum, group) => sum + group.children.length, 0);
    const optionValues = key => [...new Set(rawGroups.map(group => group[key]).filter(Boolean))].map(value => ({ value, label: key === 'market' ? marketNames[value] || value : value }));
    const selectFilter = (key, label, options) => h(Select, {
      key,
      allowClear: true,
      showSearch: true,
      optionFilterProp: 'label',
      placeholder: label,
      'aria-label': label,
      value: filterDraft[key] || undefined,
      options,
      onChange: value => setFilterDraft(current => ({ ...current, [key]: value || '' }))
    });
    const applyFilters = () => { setFilters({ ...filterDraft }); setPage(1); };
    const resetFilters = () => { setFilterDraft(emptyFilters); setFilters(emptyFilters); setPage(1); };
    const updateWindowSize = size => {
      setWindowSize(size);
      setWindowStart(current => Math.min(current, Math.max(0, coverageDates.length - size)));
      setPage(1);
    };
    const shiftWindow = direction => {
      setWindowStart(current => Math.max(0, Math.min(Math.max(0, coverageDates.length - windowSize), current + direction * windowSize)));
      setPage(1);
    };
    const selectWindowRange = range => {
      if (!range?.every(Boolean)) return;
      const startKey = range[0].format('YYYY-MM-DD');
      const endKey = range[1].format('YYYY-MM-DD');
      const startIndex = coverageDates.findIndex(date => dateKey(date) === startKey);
      const endIndex = coverageDates.findIndex(date => dateKey(date) === endKey);
      if (startIndex < 0 || endIndex < startIndex) return;
      setWindowStart(startIndex);
      setWindowSize(endIndex - startIndex + 1);
      setPage(1);
    };
    const currentWindowStart = dates[0] || coverageDates[0];
    const currentWindowEnd = dates.at(-1) || coverageDates.at(-1);
    const rangePresets = [14, 30].map(days => ({
      label: `未来${days}天`,
      value: [dayjs(coverageStart), dayjs(dateKey(coverageDates[Math.min(days - 1, coverageDates.length - 1)]))]
    })).concat([{ label: '全部预测周期', value: [dayjs(coverageStart), dayjs(coverageEnd)] }]);
    const openColumnDrawer = () => {
      setColumnDraft(JSON.parse(JSON.stringify(columnConfig)));
      setColumnSearch('');
      setColumnTemplate(undefined);
      setColumnTemplateNaming(false);
      setColumnTemplateName('');
      setColumnConfigError('');
      setColumnDrawerOpen(true);
    };
    const closeColumnDrawer = () => {
      if (columnDraft && JSON.stringify(columnDraft) !== JSON.stringify(columnConfig)) {
        modal.confirm({ title: '放弃未应用的列配置？', content: '当前列表仍保留原配置。', okText: '放弃修改', cancelText: '继续编辑', onOk: () => setColumnDrawerOpen(false) });
      } else setColumnDrawerOpen(false);
    };
    const applyColumnConfig = () => {
      const next = {
        keys: (columnDraft?.keys || []).filter(key => defaultWorkbenchColumns.includes(key)),
        pinned: (columnDraft?.pinned || []).filter(key => (columnDraft?.keys || []).includes(key)),
        templates: columnDraft?.templates || []
      };
      localStorage.setItem(workbenchColumnStorageKey, JSON.stringify(next));
      setColumnConfig(next);
      setColumnDrawerOpen(false);
      message.success('列配置已应用');
    };
    const changeColumnTemplate = value => {
      setColumnTemplate(value);
      setColumnDraft(current => {
        const template = value.startsWith('saved-') ? current.templates[Number(value.slice(6))] : null;
        return {
          ...current,
          keys: value === 'default' ? [...defaultWorkbenchColumns] : value === 'compact' ? [...compactWorkbenchColumns] : [...(template?.keys || defaultWorkbenchColumns)],
          pinned: value.startsWith('saved-') ? [...(template?.pinned || [])] : []
        };
      });
    };
    const toggleColumn = (key, checked) => setColumnDraft(current => ({
      ...current,
      keys: checked ? [...new Set([...current.keys, key])] : current.keys.filter(item => item !== key),
      pinned: checked ? current.pinned : current.pinned.filter(item => item !== key)
    }));
    const reorderColumn = (key, target, after = false) => {
      const field = workbenchColumnCatalog.find(item => item.key === key);
      const destination = workbenchColumnCatalog.find(item => item.key === target);
      if (!field || !destination || field.group !== destination.group || key === target) return;
      setColumnDraft(current => {
        if (current.pinned.includes(key) || current.pinned.includes(target)) return current;
        const movable = current.keys.filter(item => {
          const candidate = workbenchColumnCatalog.find(fieldItem => fieldItem.key === item);
          return candidate?.group === field.group && !current.pinned.includes(item);
        });
        if (!movable.includes(key) || !movable.includes(target)) return current;
        const ordered = movable.filter(item => item !== key);
        ordered.splice(ordered.indexOf(target) + (after ? 1 : 0), 0, key);
        let index = 0;
        return { ...current, keys: current.keys.map(item => movable.includes(item) ? ordered[index++] : item) };
      });
    };
    const moveColumnToTop = field => {
      const first = columnDraft.keys.map(key => workbenchColumnCatalog.find(item => item.key === key)).find(item => item?.group === field.group && !columnDraft.pinned.includes(item.key));
      if (first) reorderColumn(field.key, first.key);
    };
    const toggleColumnPin = field => {
      if (!columnDraft.pinned.includes(field.key) && columnDraft.pinned.length >= 7) return message.info('最多可固定7项');
      setColumnDraft(current => ({ ...current, pinned: current.pinned.includes(field.key) ? current.pinned.filter(key => key !== field.key) : [...current.pinned, field.key] }));
    };
    const saveColumnTemplate = () => {
      const name = columnTemplateName.trim();
      if (!name) return setColumnConfigError('请输入模板名称');
      if (columnDraft.templates.some(template => template.name === name)) return setColumnConfigError('模板名称已存在');
      const nextIndex = columnDraft.templates.length;
      setColumnDraft(current => ({ ...current, templates: [...current.templates, { name, keys: [...current.keys], pinned: [...current.pinned] }] }));
      setColumnTemplate(`saved-${nextIndex}`);
      setColumnTemplateNaming(false);
      setColumnTemplateName('');
      setColumnConfigError('');
      message.success('模板将随“保存并应用”一起保存');
    };
    const filteredColumnCatalog = workbenchColumnCatalog.filter(field => !columnSearch.trim() || [field.label, field.group].some(value => value.includes(columnSearch.trim())));
    const columnGroups = [...new Set(workbenchColumnCatalog.map(field => field.group))];
    const selectedColumnFields = (columnDraft?.keys || []).map(key => workbenchColumnCatalog.find(field => field.key === key)).filter(Boolean);
    const templateOptions = [{ value: 'default', label: '默认配置' }, { value: 'compact', label: '精简查看' }, ...(columnDraft?.templates || []).map((template, index) => ({ value: `saved-${index}`, label: template.name }))];
    const selectedColumnRow = (field, index, firstKey) => {
      const pinned = columnDraft.pinned.includes(field.key);
      const movable = !pinned;
      const quickAction = (label, iconName, onClick, disabled = false, pressed = undefined) => h(Button, { type: 'text', size: 'small', className: `column-quick-action ${pressed ? 'is-pinned' : ''}`, icon: icon(iconName), 'aria-label': `${label}${field.label}`, 'aria-pressed': pressed, disabled, onClick });
      return h('div', {
        className: `antd-selected-field-row ${columnDropKey === field.key ? 'is-drop-target' : ''}`,
        key: field.key,
        tabIndex: 0,
        draggable: movable,
        onDragStart: event => { draggedColumn.current = field.key; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', field.key); },
        onDragOver: event => { const source = workbenchColumnCatalog.find(item => item.key === draggedColumn.current); if (source?.group === field.group && movable && source.key !== field.key) { event.preventDefault(); setColumnDropKey(field.key); } },
        onDrop: event => { event.preventDefault(); const source = workbenchColumnCatalog.find(item => item.key === draggedColumn.current); if (source && movable && !columnDraft.pinned.includes(source.key)) reorderColumn(source.key, field.key, event.clientY > event.currentTarget.getBoundingClientRect().top + 18); draggedColumn.current = null; setColumnDropKey(null); },
        onDragEnd: () => { draggedColumn.current = null; setColumnDropKey(null); },
        onKeyDown: event => {
          if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key) || !movable) return;
          event.preventDefault();
          const siblings = columnDraft.keys.map(key => workbenchColumnCatalog.find(item => item.key === key)).filter(item => item?.group === field.group && !columnDraft.pinned.includes(item.key));
          const target = siblings[siblings.findIndex(item => item.key === field.key) + (event.key === 'ArrowDown' ? 1 : -1)];
          if (target) reorderColumn(field.key, target.key, event.key === 'ArrowDown');
        }
      },
      h('span', { className: 'antd-selected-field-drag', 'aria-hidden': true }, icon('HolderOutlined')),
      h('span', { className: 'antd-selected-field-number' }, index + 1),
      h('span', { className: 'antd-selected-field-name' }, field.label),
      h('span', { className: `antd-selected-field-tools ${pinned ? 'has-pin' : ''}` },
        quickAction('移除', 'CloseCircleOutlined', () => toggleColumn(field.key, false)),
        quickAction('置顶', 'VerticalAlignTopOutlined', () => moveColumnToTop(field), !movable || field.key === firstKey),
        h(Tooltip, { title: pinned ? '取消组内位置固定' : '固定组内位置' }, quickAction(pinned ? '取消固定' : '固定', 'PushpinOutlined', () => toggleColumnPin(field), false, pinned))
      ));
    };
    const columnDrawerBody = columnDraft && h(React.Fragment, null,
      h('div', { className: 'antd-column-template' },
        h(Select, { 'aria-label': '选择列配置模板', placeholder: '选择模板', value: columnTemplate, options: templateOptions, onChange: changeColumnTemplate, style: { width: 190 } }),
        columnTemplateNaming
          ? h(Space, null, h(Input, { 'aria-label': '模板名称', placeholder: '模板名称', maxLength: 20, value: columnTemplateName, onChange: event => setColumnTemplateName(event.target.value), onPressEnter: saveColumnTemplate }), h(Button, { onClick: saveColumnTemplate }, '保存模板'))
          : h(Button, { type: 'link', onClick: () => { setColumnTemplateNaming(true); setColumnTemplateName(''); } }, '保存为新模板')
      ),
      h('div', { className: 'antd-column-layout' },
        h('section', { className: 'antd-column-available', 'aria-label': '可选字段' },
          h(Input, { allowClear: true, prefix: icon('SearchOutlined'), placeholder: '搜索字段', 'aria-label': '搜索列字段', value: columnSearch, onChange: event => setColumnSearch(event.target.value) }),
          columnGroups.map(group => h('div', { className: 'antd-column-group', key: group },
            h('div', { className: 'antd-column-group-title' }, group, h(Button, { type: 'link', onClick: () => {
              const fields = filteredColumnCatalog.filter(field => field.group === group);
              const allSelected = fields.every(field => columnDraft.keys.includes(field.key));
              setColumnDraft(current => ({
                ...current,
                keys: allSelected ? current.keys.filter(key => !fields.some(field => field.key === key)) : [...new Set([...current.keys, ...fields.map(field => field.key)])],
                pinned: allSelected ? current.pinned.filter(key => !fields.some(field => field.key === key)) : current.pinned
              }));
            } }, filteredColumnCatalog.filter(field => field.group === group).every(field => columnDraft.keys.includes(field.key)) ? '取消全选' : '全选')),
            h('div', { className: 'antd-column-options' }, filteredColumnCatalog.filter(field => field.group === group).map(field => h('label', { className: 'antd-column-item', key: field.key },
              h(Checkbox, { checked: columnDraft.keys.includes(field.key), onChange: event => toggleColumn(field.key, event.target.checked) }),
              h('span', { className: 'column-name' }, field.label)
            )))
          ))
        ),
        h('section', { className: 'antd-column-selected', 'aria-label': '已选字段' },
          h('div', { className: 'antd-column-selected-header' }, h('strong', null, `已选（${selectedColumnFields.length + 4}）`), h('span', null, '最多可固定7项 · 组内位置')),
          h('div', { className: 'antd-selected-scroll' },
            h('div', { className: 'antd-selected-group' }, h('div', { className: 'antd-selected-group-title' }, '固定字段'), ['变体', '占比', '预测线', '日期预测'].map((label, index) => h('div', { className: 'antd-selected-field-row', key: label }, h('span', { className: 'antd-selected-field-drag is-locked', 'aria-hidden': true }, icon('LockOutlined')), h('span', { className: 'antd-selected-field-number' }, index + 1), h('span', { className: 'antd-selected-field-name' }, label), h(Tooltip, { title: '结构固定' }, h('span', { className: 'column-fixed-icon' }, icon('LockOutlined')))))),
            columnGroups.map(group => {
              const fields = selectedColumnFields.filter(field => field.group === group);
              const first = fields.find(field => !columnDraft.pinned.includes(field.key))?.key;
              return fields.length ? h('div', { className: 'antd-selected-group', key: group }, h('div', { className: 'antd-selected-group-title' }, group), h(List, { split: false, dataSource: fields, renderItem: (field, index) => h(List.Item, { key: field.key, style: { display: 'block', padding: 0 } }, selectedColumnRow(field, index, first)) })) : null;
            })
          ),
          h('div', { className: 'antd-column-selected-hint' }, '拖拽调整组内顺序')
        )
      ),
      columnConfigError && h(Alert, { type: 'error', showIcon: true, message: columnConfigError })
    );
    const sharedVisualStyle = {
      '--forecast-table-head-bg': forecastTableStandards.headerBackground,
      '--forecast-week-head-bg': forecastTableStandards.weekHeaderBackground,
      '--forecast-day-head-bg': forecastTableStandards.dayHeaderBackground,
      '--forecast-parent-row-bg': forecastTableStandards.parentRowBackground,
      '--forecast-final-row-bg': forecastTableStandards.finalRowBackground,
      '--forecast-header-text': forecastTableStandards.headerText,
      '--forecast-day-header-text': forecastTableStandards.dayHeaderText,
      '--forecast-parent-text': forecastTableStandards.parentText,
      '--forecast-manual-text': forecastTableStandards.manualText,
      '--forecast-toggle-border': forecastTableStandards.toggleBorder,
      '--forecast-toggle-text': forecastTableStandards.toggleText,
      '--forecast-resize-guide': forecastTableStandards.resizeGuide,
      '--forecast-grid-border': forecastTableStandards.gridBorder,
      '--forecast-week-boundary': forecastTableStandards.weekBoundary,
      '--forecast-parent-boundary': forecastTableStandards.parentBoundary,
      '--forecast-cross-color': forecastTableStandards.crossHighlight,
      '--forecast-focus-border': forecastTableStandards.focusBorder,
      '--forecast-weekend-bg': forecastTableStandards.weekendBackground,
      '--forecast-week-header-height': `${forecastTableStandards.weekHeaderHeight}px`,
      '--forecast-day-header-height': `${forecastTableStandards.dayHeaderHeight}px`,
      '--forecast-system-row-height': `${forecastTableStandards.systemRowHeight}px`,
      '--forecast-editable-row-height': `${forecastTableStandards.editableRowHeight}px`,
      '--forecast-final-row-height': `${forecastTableStandards.finalRowHeight}px`
    };

    return h('div', { className: 'forecast-workbench-root', style: sharedVisualStyle },
      h('div', { className: `fpw-body ${treePanelCollapsed ? 'fpw-tree-is-collapsed' : ''}` },
        h('aside', { className: `fpw-tree-panel ${treePanelCollapsed ? 'is-collapsed' : ''}`, 'aria-label': '变体' },
          h(Button, { type: 'primary', className: 'fpw-tree-divider-toggle', icon: icon(treePanelCollapsed ? 'RightOutlined' : 'LeftOutlined'), 'aria-label': treePanelCollapsed ? '展开变体栏' : '收起变体栏', onClick: () => setTreePanelCollapsed(value => !value) }),
          !treePanelCollapsed && h('div', { className: 'fpw-tree-head' },
            h('h2', null, '变体'),
            h('div', { className: 'fpw-tree-head-actions' },
              h(Tooltip, { title: '变体关系管理' }, h(Button, { type: 'text', size: 'small', icon: icon('SettingOutlined'), 'aria-label': '变体关系管理', onClick: () => openBindingPage({ mode: 'manage' }) }))
            )
          ),
          !treePanelCollapsed && h(React.Fragment, null,
            h(Input, { allowClear: true, prefix: icon('SearchOutlined'), placeholder: '搜索父/子ASIN', 'aria-label': '搜索变体', value: treeQuery, onChange: event => { setTreeQuery(event.target.value); setPage(1); } }),
            h('div', { className: 'fpw-tree-selection-actions' },
              h(Button, { type: 'link', size: 'small', onClick: selectAllVariants }, '全选'),
              h('span', { 'aria-hidden': true }, '丨'),
              h(Button, { type: 'link', size: 'small', onClick: invertVariantSelection }, '反选'),
              h('span', { 'aria-hidden': true }, '丨'),
              h(Button, { type: 'link', size: 'small', onClick: excludeSelectedVariants }, '排除')
            ),
            h('div', { className: 'fpw-tree-scroll' }, h(Tree, { blockNode: true, checkable: true, showLine: false, treeData, expandedKeys: treeExpandedKeys, checkedKeys: treeCheckedKeys, selectedKeys: selectedKey ? [selectedKey] : [], onExpand: setTreeExpandedKeys, onCheck: keys => { setTreeCheckedKeys(Array.isArray(keys) ? keys : keys.checked); setPage(1); }, onSelect: (keys, info) => {
              const key = keys[0] || info?.node?.key;
              if (!key) return;
              locateRow(key);
            } }))
          )
        ),
        h('main', { className: 'fpw-main' },
          h('section', { className: 'fpw-search-panel', 'aria-label': '预测列表筛选' },
            h('div', { className: 'fpw-filter-row' },
              selectFilter('platform', '平台', optionValues('platform')),
              selectFilter('market', '国家 / 站点', optionValues('market')),
              selectFilter('account', '账号 / 店铺', optionValues('account')),
              selectFilter('owner', '销售负责人', optionValues('owner')),
              selectFilter('status', '预测状态', [{ value: 'normal', label: '预测正常' }, { value: 'pending', label: '待实际销量' }])
            ),
            h('div', { className: 'fpw-search-row' },
              h(Input, { allowClear: true, prefix: icon('SearchOutlined'), placeholder: '父ASIN / 子ASIN / SKU / SPU', 'aria-label': '父ASIN、子ASIN、SKU或SPU', value: filterDraft.keyword, onChange: event => setFilterDraft(current => ({ ...current, keyword: event.target.value })), onPressEnter: applyFilters }),
              h(Button, { type: 'primary', icon: icon('SearchOutlined'), onClick: applyFilters }, '查询'),
              h(Button, { onClick: resetFilters }, '重置')
            )
          ),
          h('section', { className: 'fpw-range-bar', 'aria-label': '预测时间轴导航' },
            h('div', { className: 'fpw-range-left' },
              h('div', { className: 'fpw-range-title' }, h('span', null, '预测范围'), h('strong', null, `${dateText(coverageStart)} ~ ${dateText(coverageEnd)}`)),
              h('span', { className: 'fpw-range-divider', 'aria-hidden': true }, '丨'),
              h('div', { className: 'fpw-range-current' },
                h('span', null, '当前查看窗口'),
                h(DatePicker.RangePicker, {
                  value: [dayjs(dateKey(currentWindowStart)), dayjs(dateKey(currentWindowEnd))],
                  format: 'YYYY/MM/DD',
                  separator: '~',
                  locale: window.forecastInsights?.calendarLocale,
                  allowClear: false,
                  inputReadOnly: true,
                  presets: rangePresets,
                  minDate: dayjs(coverageStart),
                  maxDate: dayjs(coverageEnd),
                  variant: 'borderless',
                  'aria-label': '当前查看窗口',
                  style: { width: 184, paddingInline: 0 },
                  onChange: selectWindowRange
                })
              ),
              h('div', { className: 'fpw-range-nav' },
                h(Button, { size: 'small', icon: icon('LeftOutlined'), 'aria-label': '向前切换窗口', disabled: windowStart === 0, onClick: () => shiftWindow(-1) }),
                h(Button, { size: 'small', icon: icon('RightOutlined'), 'aria-label': '向后切换窗口', disabled: windowEnd === coverageDates.length - 1, onClick: () => shiftWindow(1) })
              ),
              h('div', { className: 'fpw-range-tabs', role: 'group', 'aria-label': '窗口天数' },
                [14, 30].map(size => h(Button, { key: size, type: 'text', size: 'small', className: windowSize === size ? 'is-active' : '', 'aria-pressed': windowSize === size, onClick: () => updateWindowSize(size) }, `${size}天`))
              )
            ),
            h('div', { className: 'fpw-range-actions' },
              selectedRowKeys.length ? h('span', { className: 'fpw-selected-summary' }, `已选 ${selectedRowKeys.length} 项`) : null,
              h(Tooltip, { title: '列配置' }, h(Button, { type: 'text', size: 'small', icon: icon('SettingOutlined'), 'aria-label': '列配置', onClick: openColumnDrawer }))
            )
          ),
          h('div', { className: 'fpw-table-shell', onMouseLeave: () => { setHoveredColumn(null); setHoveredRow(null); } },
            h(Table, {
              className: 'fpw-table',
              size: 'small',
              bordered: true,
              rowKey: 'key',
              columns,
              dataSource: tableRows,
              pagination: false,
              tableLayout: 'fixed',
              rowSelection: { fixed: true, columnWidth: 40, selectedRowKeys, preserveSelectedRowKeys: true, onCell: row => ({ rowSpan: row.lineIndex === 0 ? row.lineCount : 0 }), onChange: keys => setSelectedRowKeys(keys.filter(key => !String(key).includes('|system') && !String(key).includes('|manual') && !String(key).includes('|activity') && !String(key).includes('|final'))) },
              scroll: { x: Math.max(1, tableScrollWidth), y: Math.max(280, viewportHeight - 320) },
              rowClassName: row => [row.type === 'parent' ? 'fpw-parent-row' : 'fpw-child-row', 'fpw-prediction-row', `fpw-prediction-${row.forecastLine}`, row.lineIndex === 0 ? 'fpw-entity-start' : '', row.lineIndex === row.lineCount - 1 ? 'fpw-entity-end' : '', hoveredRow === row.key ? 'fpw-cross-row' : ''].filter(Boolean).join(' '),
              onRow: row => ({ onClick: () => setSelectedKey(row.entityKey) }),
              locale: { emptyText: '暂无符合条件的父子ASIN' }
            })
          ),
          h('footer', { className: 'fpw-footer' },
            h('div', { className: 'forecast-pagination-bar' },
              h(Pagination, { size: 'small', current: page, pageSize, total: rows.length, showSizeChanger: true, showQuickJumper: false, hideOnSinglePage: false, pageSizeOptions: [5, 20, 50], showTotal: count => h('span', { className: 'forecast-page-total' }, '共 ', h('b', null, count), ' 个父ASIN / ', h('b', null, childCount), ' 个子ASIN，当前页 ', h('b', null, pageRows.reduce((sum, row) => sum + row.children.length, 0)), ' 个子ASIN'), onChange: (nextPage, nextSize) => { setPage(nextSize !== pageSize ? 1 : nextPage); setPageSize(nextSize); } }),
              h('label', { className: 'forecast-page-jump' }, '跳至', h(InputNumber, { 'aria-label': '跳转页码', min: 1, max: Math.max(1, Math.ceil(rows.length / pageSize)), precision: 0, controls: false, disabled: !rows.length, value: pageDestination, onChange: setPageDestination, onPressEnter: () => { if (pageDestination != null) setPage(Math.max(1, Math.min(Math.ceil(rows.length / pageSize) || 1, Math.trunc(pageDestination)))); }, onBlur: () => { if (pageDestination != null) setPage(Math.max(1, Math.min(Math.ceil(rows.length / pageSize) || 1, Math.trunc(pageDestination)))); }, style: { width: 44 }, size: 'small' }), '页')
            )
          )
        )
      ),
      h(Drawer, {
        className: 'fpw-detail-drawer',
        placement: 'right',
        width: 'min(672px, 92vw)',
        open: Boolean(drawerRow),
        onClose: () => setDrawerRow(null),
        title: drawerRow && h('div', { className: 'fpw-drawer-title' },
          h('strong', null, '预测批次详情'),
          h('span', null, `· ${drawerRow.type === 'parent' ? drawerRow.group.parent : drawerRow.child.asin}`)
        ),
        extra: drawerRow && h(Tag, { color: 'default', style: { marginInlineEnd: 0 } }, drawerRow.type === 'parent' ? '父ASIN' : '子ASIN'),
        footer: drawerRow && h('div', { className: 'fpw-drawer-footer' },
          h(Button, { icon: icon('LeftOutlined'), onClick: closeDrawerAndLocate }, '返回列表并定位'),
          h(Button, { type: 'primary', icon: icon('EditOutlined'), onClick: enterSalesForecast }, '进入销售预测填报')
        ),
        styles: { header: { padding: '14px 18px' }, body: { padding: '0 18px 18px' }, footer: { padding: '10px 18px' } }
      }, forecastBasisPanel),
      h(Modal, {
        open: Boolean(shareEditor),
        title: '调整子ASIN份额占比',
        width: 440,
        maskClosable: false,
        destroyOnHidden: true,
        onCancel: () => { setShareEditor(null); shareForm.resetFields(); },
        footer: h('div', { className: 'forecast-editor-footer' }, h('span'), h(Space, null,
          h(Button, { onClick: () => { setShareEditor(null); shareForm.resetFields(); } }, '取消'),
          h(Button, { type: 'primary', onClick: () => shareForm.submit() }, '保存')
        ))
      }, shareEditor && h(React.Fragment, null,
        h('div', { className: 'forecast-editor-context' }, `${shareEditor.group.parent} · ${shareEditor.child.asin}`),
        h(Form, { form: shareForm, layout: 'vertical', onFinish: saveShare, scrollToFirstError: true, validateTrigger: ['onChange', 'onBlur'] },
          h(Form.Item, { name: 'share', label: '子ASIN份额占比', rules: [{ required: true, message: '请输入子ASIN份额占比' }, { type: 'number', min: 0, max: 100, message: '份额占比必须在0%至100%之间' }] }, h(InputNumber, { min: 0, max: 100, precision: 2, controls: false, addonAfter: '%', style: { width: '100%' }, 'aria-label': '子ASIN份额占比' })),
          h(Form.Item, { name: 'reason', label: '调整原因', rules: [{ required: true, whitespace: true, message: '请填写份额占比调整原因' }, { max: 200, message: '最多200字' }] }, h(Input.TextArea, { ...(window.ForecastEditorStandards?.countedTextAreaProps || { showCount: true, maxLength: 200, autoSize: { minRows: 3, maxRows: 5 } }), 'aria-label': '份额占比调整原因' }))
        )
      )),
      h(Drawer, {
        title: '列配置',
        'aria-label': '列配置',
        open: columnDrawerOpen,
        onClose: closeColumnDrawer,
        width: 'min(860px,96vw)',
        destroyOnHidden: true,
        styles: { body: { display: 'flex', flexDirection: 'column', padding: '16px 20px', overflow: 'hidden' } },
        footer: h('div', { className: 'column-footer' },
          h(Button, { onClick: () => { setColumnDraft(current => ({ ...current, keys: [...defaultWorkbenchColumns], pinned: [] })); setColumnTemplate('default'); } }, '恢复默认'),
          h(Space, null, h(Button, { onClick: closeColumnDrawer }, '取消'), h(Button, { type: 'primary', onClick: applyColumnConfig }, '保存并应用'))
        )
      }, columnDrawerBody)
    );
  }

  function ForecastBindingWorkspace({ onBack } = {}) {
    const { message, modal } = antd.App.useApp();
    const [revision, setRevision] = useState(0);
    const [query, setQuery] = useState('');
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [dialog, setDialog] = useState(null);
    const source = useMemo(() => baseSourceGroups(), [revision]);
    const rows = useMemo(() => ForecastBindingStore.rows(source), [revision, source]);
    const groupOptions = useMemo(() => ForecastBindingStore.groups(source), [revision, source]);
    const visibleRows = useMemo(() => {
      const keyword = query.trim().toLowerCase();
      return rows.filter(row => !keyword || [row.childASIN, row.sku, row.originalParent, row.currentParent, row.market, row.account].some(value => String(value || '').toLowerCase().includes(keyword)));
    }, [query, rows]);

    const confirmRemove = keys => {
      if (!keys.length) return message.warning('请先选择需要移除的子ASIN');
      modal.confirm({
        title: `移除 ${keys.length} 项变体绑定？`,
        content: '移除后，对应子ASIN将不再参与当前预测工作台的父体汇总，可通过“新增绑定”恢复。',
        okText: '确认移除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: () => {
          ForecastBindingStore.remove(keys);
          setSelectedKeys([]);
          message.success('变体绑定已移除');
        }
      });
    };

    useEffect(() => {
      const refreshBindings = () => setRevision(value => value + 1);
      window.addEventListener('forecast-binding-change', refreshBindings);
      return () => window.removeEventListener('forecast-binding-change', refreshBindings);
    }, []);

    useEffect(() => {
      const action = ForecastBindingStore.consumeAction();
      if (!action) return;
      const row = rows.find(item => item.key === action.recordKey || item.childASIN === action.childASIN);
      if (action.mode === 'remove' && row) {
        requestAnimationFrame(() => confirmRemove([row.key]));
        return;
      }
      if (action.mode === 'edit' && row) {
        setDialog({ mode: 'edit', keys: [row.key], targetGroupId: row.currentGroupId, childKey: row.key });
        return;
      }
      if (action.parentGroupId) {
        const group = source.find(item => item.id === action.parentGroupId);
        if (group) setQuery(group.parent);
      }
      if (action.mode === 'add') setDialog({ mode: 'add', keys: [], targetGroupId: action.parentGroupId || undefined, childKey: undefined });
    }, []);

    const openManage = keys => {
      if (!keys.length) return message.warning('请先选择需要管理的子ASIN');
      const first = rows.find(row => row.key === keys[0]);
      setDialog({ mode: keys.length > 1 ? 'manage' : 'edit', keys, targetGroupId: first?.currentGroupId, childKey: first?.key });
    };

    const dialogRows = dialog?.mode === 'add'
      ? rows
      : rows.filter(row => dialog?.keys?.includes(row.key));
    const dialogMarket = dialogRows[0]?.market;
    const dialogAccount = dialogRows[0]?.account;
    const compatibleGroups = groupOptions.filter(option => !dialogMarket || (option.market === dialogMarket && option.account === dialogAccount));
    const saveBinding = () => {
      const keys = dialog.mode === 'add' ? [dialog.childKey].filter(Boolean) : dialog.keys;
      if (!keys.length || !dialog.targetGroupId) return message.warning('请选择子ASIN和目标父ASIN');
      ForecastBindingStore.bind(keys, dialog.targetGroupId);
      setDialog(null);
      setSelectedKeys([]);
      message.success(dialog.mode === 'add' ? '变体绑定已添加' : '变体绑定已更新');
    };

    const columns = [
      { title: '国家 / 站点', dataIndex: 'market', width: 110, render: value => marketNames[value] || value },
      { title: '账号 / 店铺', dataIndex: 'account', width: 130 },
      { title: '子ASIN', dataIndex: 'childASIN', width: 150 },
      { title: 'SKU', dataIndex: 'sku', width: 130 },
      { title: '原父ASIN', dataIndex: 'originalParent', width: 150 },
      { title: '当前父ASIN', dataIndex: 'currentParent', width: 150 },
      { title: '绑定状态', key: 'status', width: 100, render: (_, row) => row.active ? h(Tag, { color: row.changed ? 'processing' : 'default' }, row.changed ? '已修改' : '已绑定') : h(Tag, null, '已移除') },
      { title: '操作', key: 'action', width: 130, fixed: 'right', render: (_, row) => h(Space, { size: 4 },
        h(Button, { type: 'link', size: 'small', onClick: () => openManage([row.key]) }, '修改'),
        h(Button, { type: 'link', size: 'small', danger: true, disabled: !row.active, onClick: () => confirmRemove([row.key]) }, '移除')
      ) }
    ];

    return h('div', { className: 'fpw-binding-workspace' },
      h('header', { className: 'fpw-binding-head' },
        h('div', null, h('h2', null, '变体绑定管理'), h('p', null, '管理当前预测工作台中父ASIN与子ASIN的绑定关系。')),
        h(Button, { type: 'link', onClick: onBack }, '返回预测工作台')
      ),
      h('section', { className: 'fpw-binding-toolbar' },
        h(Input.Search, { allowClear: true, value: query, onChange: event => setQuery(event.target.value), placeholder: '父ASIN / 子ASIN / SKU', 'aria-label': '搜索变体绑定', style: { width: 320 } }),
        h(Space, null,
          h(Button, { type: 'primary', icon: icon('PlusOutlined'), onClick: () => setDialog({ mode: 'add', keys: [], targetGroupId: undefined, childKey: undefined }) }, '新增绑定'),
          h(Button, { icon: icon('SettingOutlined'), disabled: !selectedKeys.length, onClick: () => openManage(selectedKeys) }, '管理已选'),
          h(Button, { danger: true, icon: icon('DeleteOutlined'), disabled: !selectedKeys.length, onClick: () => confirmRemove(selectedKeys) }, '移除绑定')
        )
      ),
      h('div', { className: 'fpw-binding-table' }, h(Table, {
        size: 'small',
        bordered: true,
        rowKey: 'key',
        columns,
        dataSource: visibleRows,
        rowSelection: { selectedRowKeys: selectedKeys, onChange: setSelectedKeys },
        scroll: { x: 1050, y: Math.max(300, window.innerHeight - 275) },
        pagination: { size: 'small', showSizeChanger: true, showQuickJumper: true, pageSizeOptions: [20, 50], showTotal: count => `共 ${count} 条绑定` },
        locale: { emptyText: '暂无匹配的变体绑定' }
      })),
      h(Modal, {
        open: Boolean(dialog),
        title: dialog?.mode === 'add' ? '新增变体绑定' : dialog?.mode === 'manage' ? '批量管理变体绑定' : '修改变体绑定',
        okText: '保存',
        cancelText: '取消',
        onOk: saveBinding,
        onCancel: () => setDialog(null),
        destroyOnHidden: true
      }, dialog && h('div', { className: 'fpw-binding-form' },
        dialog.mode === 'add' && h('label', null, h('span', null, '子ASIN'), h(Select, {
          showSearch: true,
          optionFilterProp: 'label',
          value: dialog.childKey,
          placeholder: '选择需要绑定的子ASIN',
          options: rows.map(row => ({ value: row.key, label: `${row.childASIN} 丨 ${row.sku}${row.active ? '' : ' 丨 已移除'}` })),
          onChange: childKey => {
            const row = rows.find(item => item.key === childKey);
            setDialog(current => ({ ...current, childKey, keys: [childKey], targetGroupId: row?.currentGroupId }));
          }
        })),
        h('label', null, h('span', null, '目标父ASIN'), h(Select, {
          showSearch: true,
          optionFilterProp: 'label',
          value: dialog.targetGroupId,
          placeholder: '选择目标父ASIN',
          options: compatibleGroups,
          onChange: targetGroupId => setDialog(current => ({ ...current, targetGroupId }))
        })),
        dialog.mode !== 'add' && h('p', null, `本次将更新 ${dialog.keys.length} 个子ASIN的父体绑定。`)
      ))
    );
  }

  window.ForecastWorkbench = ForecastWorkbench;
  window.ForecastBindingWorkspace = ForecastBindingWorkspace;
})();
