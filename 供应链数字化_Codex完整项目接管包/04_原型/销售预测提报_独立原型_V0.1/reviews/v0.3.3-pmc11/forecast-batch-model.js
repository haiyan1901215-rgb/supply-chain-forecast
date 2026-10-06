/* ForecastBatch: batch-owned forecast snapshot and sales-facing contract. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ForecastBatchModel = api;
})(typeof window === 'undefined' ? globalThis : window, function (root) {
  'use strict';

  const STORAGE_KEY = 'pmc-forecast-batch-v6-sales-demo';
  const clone = value => JSON.parse(JSON.stringify(value));
  const workbenchDraft = value => ({
    manual: { ...(value?.manual || {}) },
    manualReasons: { ...(value?.manualReasons || {}) },
    activity: clone(value?.activity || {}),
    reason: String(value?.reason || ''),
    changes: clone(value?.changes || [])
  });
  const sum = values => values.reduce((total, value) => total + (Number(value) || 0), 0);
  const isoDate = value => String(value).slice(0, 10);
  const shanghaiDate = value => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const shiftDate = (value, amount) => {
    const date = new Date(`${isoDate(value)}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  };
  const BUSINESS_CALENDAR = Object.freeze({
    version: 'CN-BUSINESS-CALENDAR-2026-V1',
    source: '国务院办公厅关于2026年部分节假日安排的通知（国办发明电〔2025〕7号）',
    holidays: Object.freeze([
      '2026-01-01', '2026-01-02', '2026-01-03',
      '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
      '2026-04-04', '2026-04-05', '2026-04-06',
      '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
      '2026-06-19', '2026-06-20', '2026-06-21',
      '2026-09-25', '2026-09-26', '2026-09-27',
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'
    ]),
    workingWeekends: Object.freeze(['2026-01-04', '2026-02-14', '2026-02-28', '2026-05-09', '2026-09-20', '2026-10-10'])
  });
  const holidaySet = new Set(BUSINESS_CALENDAR.holidays);
  const workingWeekendSet = new Set(BUSINESS_CALENDAR.workingWeekends);
  const isBusinessDay = date => {
    if (workingWeekendSet.has(date)) return true;
    if (holidaySet.has(date)) return false;
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    return day !== 0 && day !== 6;
  };
  const nextBusinessDate = (date, includeCurrent = false) => {
    let cursor = includeCurrent ? isoDate(date) : shiftDate(date, 1);
    while (!isBusinessDay(cursor)) cursor = shiftDate(cursor, 1);
    return cursor;
  };
  const addBusinessDays = (date, amount) => {
    let cursor = isoDate(date);
    for (let count = 0; count < amount; count += 1) cursor = nextBusinessDate(cursor);
    return cursor;
  };
  const shanghaiParts = value => Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  const scheduleSubmissionWindow = (launchedAt = new Date().toISOString()) => {
    const parts = shanghaiParts(launchedAt);
    let startDate = `${parts.year}-${parts.month}-${parts.day}`;
    let startClock = `${parts.hour}:${parts.minute}:00`;
    if (!isBusinessDay(startDate) || startClock >= '18:00:00') {
      startDate = nextBusinessDate(startDate);
      startClock = '09:00:00';
    } else if (startClock < '09:00:00') startClock = '09:00:00';
    const deadlineDate = addBusinessDays(startDate, 4);
    const freezeDate = nextBusinessDate(deadlineDate);
    return {
      submissionStartTime: `${startDate}T${startClock}+08:00`,
      submissionDeadlineTime: `${deadlineDate}T18:00:00+08:00`,
      submissionFreezeTime: `${freezeDate}T00:00:00+08:00`,
      ruleEffectiveTime: `${freezeDate}T09:00:00+08:00`,
      calendarVersion: BUSINESS_CALENDAR.version,
      status: '填报中',
      autoFreeze: true
    };
  };
  const dateRange = (start, end) => {
    const result = [];
    for (let cursor = start; cursor <= end; cursor = shiftDate(cursor, 1)) result.push(cursor);
    return result;
  };
  const sourceGroups = services => services.groups || (typeof groups !== 'undefined' ? groups : []);
  const sourceForecast = services => services.forecastAt || (typeof forecastAt === 'function' ? forecastAt : null);
  const sourceActual = services => services.actualAt || (typeof actualAt === 'function' ? actualAt : null);
  const rowsFromGroups = (groupsValue, batch, services) => groupsValue.flatMap(group => group.children.map(child => ({
    childId: child.id,
    childASIN: child.asin,
    parentASIN: group.parent,
    country: group.market,
    store: group.account,
    platform: group.platform,
    salesOwner: group.owner,
    sellerSku: child.businessCode || child.sku,
    sku: child.sku,
    historicSku: child.historicSku,
    salesCombo: child.combo,
    salesComboMeta: child.salesComboMeta ? clone(child.salesComboMeta) : null,
    businessCode: child.businessCode,
    typeCode: child.typeCode || group.typeCode || 'F03',
    size: child.size,
    color: child.color,
    spu: group.spu,
    skc: group.skc,
    image: group.image,
    brand: group.brand,
    channel: group.channel,
    businessVersion: group.businessVersion,
    owner: group.owner,
    listedAt: group.listedAt,
    listingDays: group.listingDays,
    productName: group.name,
    productType: '服饰',
    tags: [...(group.tags || [])],
    relationState: '平台同步',
    effectiveFrom: batch,
    effectiveTo: null,
    childRef: child,
    services
  })));
  const relationKey = row => [row.country, row.store, row.parentASIN].join('|');
  const rowKey = row => [row.country, row.store, row.childASIN].join('|');
  const normalizeRatio = value => Math.max(0, Math.min(10000, Math.round(Number(value) || 0)));
  const nextVersion = value => String(value || '').replace(/V(\d+)$/, (_, number) => `V${String(Number(number) + 1).padStart(number.length, '0')}`);
  const comboHistory = (code, version, lines) => [
    { version, effectiveFrom: '2026-09-01', effectiveTo: '2026-09-30', lines: clone(lines) },
    { version: 'V2', effectiveFrom: '2026-10-01', effectiveTo: null, lines: [{ sku: 'SKU-A', quantity: 1 }, { sku: 'SKU-C', quantity: 2 }] }
  ].map(item => ({ ...item, code }));
  const businessObjectForRow = row => {
    const source = row.businessObjectType ? row : row.childRef;
    if (source?.businessObjectType) return {
      type: source.businessObjectType,
      code: source.businessObjectCode || row.sellerSku || source.sku,
      version: source.businessObjectVersion || null,
      snapshot: source.comboSnapshot ? clone(source.comboSnapshot) : null,
      history: source.comboVersionHistory ? clone(source.comboVersionHistory) : []
    };
    const comboMeta = source?.salesComboMeta || row.salesComboMeta || root.getSalesComboDefinition?.(row.childRef || row.childASIN);
    // The existing demo split is part of the legacy validation flow. New combo
    // metadata is display-only and must not create a new forecast object.
    const supportsForecastDecomposition = row.country === 'US' && row.childASIN === 'B0GRG6H2KL';
    if (comboMeta?.isCombo && supportsForecastDecomposition) {
      const lines = clone(comboMeta.lines || []);
      return {
        type: 'COMBO',
        code: comboMeta.code || row.salesCombo || row.sellerSku || '—',
        version: comboMeta.version || 'V1',
        snapshot: { code: comboMeta.code || row.salesCombo || '—', version: comboMeta.version || 'V1', name: comboMeta.name || comboMeta.description || '销售组合', description: comboMeta.description || comboMeta.name || '销售组合', effectiveFrom: '2026-09-01', effectiveTo: '2026-09-30', lines },
        history: comboHistory(comboMeta.code || row.salesCombo || '—', comboMeta.version || 'V1', lines)
      };
    }
    return { type: 'SKU', code: row.childRef?.sku || row.sellerSku || '—', version: 'SKU-MASTER-V01', snapshot: null, history: [] };
  };
  const relationFromRow = (row, batchDate) => ({
    ...(() => {
      const businessObject = businessObjectForRow(row);
      return {
        childId: row.childId,
        childASIN: row.childASIN,
        parentASIN: row.parentASIN,
        country: row.country,
        store: row.store,
        platform: row.platform,
        salesOwner: row.salesOwner,
        sellerSku: row.sellerSku,
        sku: row.sku,
        historicSku: row.historicSku,
        salesCombo: row.salesCombo,
        salesComboMeta: row.salesComboMeta ? clone(row.salesComboMeta) : null,
        businessCode: row.businessCode,
        typeCode: row.typeCode,
        size: row.size,
        color: row.color,
        spu: row.spu,
        skc: row.skc,
        image: row.image,
        brand: row.brand,
        channel: row.channel,
        businessVersion: row.businessVersion,
        owner: row.owner,
        listedAt: row.listedAt,
        listingDays: row.listingDays,
        productName: row.productName,
        productType: row.productType,
        tags: row.tags,
        relationState: row.relationState,
        effectiveFrom: batchDate,
        effectiveTo: null,
        businessObjectType: businessObject.type,
        businessObjectCode: businessObject.code,
        businessObjectVersion: businessObject.version,
        comboSnapshot: businessObject.snapshot,
        comboVersionHistory: businessObject.history,
        childRef: row.childRef
      };
    })()
  });
  const defaultWindow = batch => ({
    submissionStartTime: `${batch}T09:00:00+08:00`,
    submissionDeadlineTime: `${shiftDate(batch, 4)}T18:00:00+08:00`,
    submissionFreezeTime: `${shiftDate(batch, 5)}T00:00:00+08:00`,
    ruleEffectiveTime: `${shiftDate(batch, 5)}T09:00:00+08:00`,
    calendarVersion: BUSINESS_CALENDAR.version,
    status: '待发起',
    autoFreeze: true
  });
  const calibrationComplete = batch => ['待发起销售填报', '销售填报中', '已冻结'].includes(batch?.calibrationStatus)
    || ['待发起销售填报', '销售填报中', '已冻结'].includes(batch?.status);
  const defaultParams = id => ({
    version: id,
    historyShareWindow: 84,
    recentShareWindow: 14,
    historyShareWeight: 70,
    recentShareWeight: 30,
    lowSalesAduThreshold: 2,
    recentSellingDaysThreshold: 10,
    trendWindow: 30,
    seasonIndex: 1,
    listingFactor: 1,
    basis: 'Clean销量；剔除断货及活动异常日',
    inheritedFrom: 'Param-V4'
  });
  const defaultSplitRule = id => ({
    version: id,
    name: '标准ASIN份额拆解',
    scope: 'US / UK · Amazon · 普通父ASIN',
    priority: 10,
    historyWindow: 84,
    recentWindow: 14,
    historyWeight: 70,
    recentWeight: 30,
    abnormalCondition: '14天 Clean ADU < 2 且 14天有销量天数 ≤ 10天',
    normalization: true,
    manualAllowed: true,
    effectiveTime: (id.match(/(\d{4})(\d{2})(\d{2})/) || []).slice(1).join('-') || '2026-09-29'
  });
  const defaultSplitRuleTemplates = () => ([
    { id: 'SPLIT-TPL-DEFAULT', name: '默认子体拆解', scope: '正常销售子体', conditionText: '商品标签 = 正常销售', historyWindow: 84, recentWindow: 14, historyWeight: 100, recentWeight: 0, status: '启用', priority: 10 },
    { id: 'SPLIT-TPL-LOW', name: '低销量/不稳定子体', scope: '全部国家与父ASIN', conditionText: '14天 Clean ADU < 2 AND 14天有销量天数 ≤ 10', historyWindow: 84, recentWindow: 14, historyWeight: 70, recentWeight: 30, status: '启用', priority: 100 },
    { id: 'SPLIT-TPL-SIZE', name: '特殊尺码调配', scope: '商品标签 = 特殊尺码策略', conditionText: '尺码 IN [XS, XL, XXL]', historyWindow: 84, recentWindow: 14, historyWeight: 60, recentWeight: 40, status: '停用', priority: 80 },
    { id: 'SPLIT-TPL-NEW', name: '新品特殊规则', scope: '商品标签 = 新品', conditionText: '上架天数 ≤ 30', historyWindow: 28, recentWindow: 7, historyWeight: 40, recentWeight: 60, status: '停用', priority: 70 },
    { id: 'SPLIT-TPL-PARENT', name: '指定父ASIN特殊规则', scope: '指定父ASIN', conditionText: '父ASIN = 指定范围', historyWindow: 84, recentWindow: 14, historyWeight: 70, recentWeight: 30, status: '启用', priority: 60 }
  ]);
  const defaultForecastRule = id => ({
    version: id,
    name: '父ASIN日级预测标准规则',
    scope: 'Amazon · US / UK · 成长与后期商品',
    historyWindow: 30,
    recentWindow: 10,
    historyWeight: 40,
    recentWeight: 60,
    dynamicAlpha: '0.10 / 0.20 / 0.35',
    seasonIndex: 1,
    listingFactor: 1,
    cleanBasis: '剔除断货及活动异常日'
  });
  function allocateComboTotal(total, lines) {
    const quantityTotal = sum(lines.map(line => Number(line.quantity) || 0));
    if (!quantityTotal) return lines.map(() => 0);
    const raw = lines.map(line => (Number(total) || 0) * (Number(line.quantity) || 0) / quantityTotal);
    const values = raw.map(Math.floor);
    let remainder = Math.max(0, Math.round(Number(total) || 0) - sum(values));
    raw.map((value, index) => ({ index, fraction: value - values[index] }))
      .sort((left, right) => right.fraction - left.fraction || left.index - right.index)
      .forEach(item => { if (remainder > 0) { values[item.index] += 1; remainder -= 1; } });
    return values;
  }
  function applyComboAllocation(row) {
    if (row.businessObjectType !== 'COMBO' || !row.comboSnapshot?.lines?.length) return;
    const total = sum(Object.values(row.dailyFinalForecast || {}));
    const suggestions = allocateComboTotal(total, row.comboSnapshot.lines);
    const previous = Object.fromEntries((row.comboLines || []).map(line => [line.sku, line]));
    const manualRatios = row.comboSnapshot.lines.map(line => previous[line.sku]?.pmcRatio);
    const manualTotals = manualRatios.every(value => Number.isInteger(value)) && sum(manualRatios) === 10000
      ? allocateComboTotal(total, row.comboSnapshot.lines.map((line, index) => ({ quantity: manualRatios[index] }))) : null;
    row.comboLines = row.comboSnapshot.lines.map((line, index) => {
      const old = previous[line.sku];
      const finalForecast = manualTotals ? manualTotals[index] : suggestions[index] + (Number(old?.pmcAdjustment) || 0);
      const adjustment = finalForecast - suggestions[index];
      return {
        id: `${row.businessObjectCode}-${line.sku}`,
        sku: line.sku,
        quantity: Number(line.quantity) || 0,
        defaultRatio: quantityRatio(line.quantity, row.comboSnapshot.lines),
        pmcRatio: manualTotals ? manualRatios[index] : null,
        systemSuggested: suggestions[index],
        pmcAdjustment: adjustment,
        finalForecast,
        adjustmentReason: adjustment ? (old?.adjustmentReason || null) : null,
        source: adjustment ? 'PMC人工调整' : '系统自动'
      };
    });
  }
  function quantityRatio(quantity, lines) {
    const total = sum(lines.map(line => Number(line.quantity) || 0));
    return total ? Math.round((Number(quantity) || 0) / total * 10000) : 0;
  }
  function rebuildComboAllocations(batch) {
    batch.childForecastResults.filter(row => row.businessObjectType === 'COMBO').forEach(applyComboAllocation);
  }
  function legacyForecast(row, batch, date, services) {
    const reader = sourceForecast(services);
    if (reader && row.childRef) {
      const value = reader(row.childRef, batch, date);
      // The seed builder only reads forecast values. Avoid cloning the same
      // daily object thousands of times during the initial batch snapshot.
      if (value) return value;
    }
    const base = Math.max(1, Number(row.childRef?.base) || 8);
    const distance = Math.max(0, Math.round((Date.parse(date) - Date.parse(batch)) / 86400000));
    const ai = Math.max(1, base + (distance % 5 === 0 ? 1 : 0));
    return { ai, manual: null, activity: null, final: ai, reason: '沿用规则基准' };
  }
  function buildForecastRows(relations, batch, start, end, services, inherited) {
    const dates = dateRange(start, end);
    const groups = relations.reduce((map, row) => {
      (map[relationKey(row)] ||= []).push(row);
      return map;
    }, {});
    const forecastCache = new Map();
    const forecastFor = (relation, date) => {
      const cacheKey = `${relation.childId}|${date}`;
      if (!forecastCache.has(cacheKey)) forecastCache.set(cacheKey, legacyForecast(relation, batch, date, services));
      return forecastCache.get(cacheKey);
    };
    const historyDays = dateRange(shiftDate(batch, -83), batch);
    const recentDays = dateRange(shiftDate(batch, -13), batch);
    const historyTotals = new Map(relations.map(relation => [relation.childId, sum(historyDays.map(date => Number(forecastFor(relation, date)?.ai) || 0))]));
    const recentTotals = new Map(relations.map(relation => [relation.childId, (relation.tags || []).includes('低销') ? 22 : sum(recentDays.map(date => Number(forecastFor(relation, date)?.ai) || 0))]));
    const rows = relations.map(relation => {
      const legacy = Object.fromEntries(dates.map(date => [date, forecastFor(relation, date)]));
      const historyTotal = historyTotals.get(relation.childId) || 0;
      const siblingHistoryTotal = sum((groups[relationKey(relation)] || []).map(sibling => historyTotals.get(sibling.childId) || 0));
      const lowSalesDemo = (relation.tags || []).includes('低销');
      const recentTotal = recentTotals.get(relation.childId) || 0;
      const siblingRecentTotal = sum((groups[relationKey(relation)] || []).map(sibling => recentTotals.get(sibling.childId) || 0));
      const historyShare = siblingHistoryTotal ? Math.round(historyTotal / siblingHistoryTotal * 10000) : 0;
      const recentShare = siblingRecentTotal ? Math.round(recentTotal / siblingRecentTotal * 10000) : historyShare;
      const recentCleanAdu = Number((recentTotal / 14).toFixed(2));
      const recentSellingDays = lowSalesDemo ? 8 : recentDays.length;
      const lowOrUnstable = recentCleanAdu < 2 && recentSellingDays <= 10;
      const suggestedShare = lowOrUnstable ? Math.round(historyShare * 0.7 + recentShare * 0.3) : historyShare;
      return {
        ...relation,
        id: rowKey(relation),
        historicalSales: historyTotal,
        history84Sales: historyTotal,
        history84Share: historyShare,
        recent14CleanSales: recentTotal,
        recent14Share: recentShare,
        recentCleanAdu,
        recentSellingDays,
        splitJudgement: lowOrUnstable ? '低销量/不稳定' : '正常',
        matchedSplitRuleId: lowOrUnstable ? 'SPLIT-TPL-LOW' : 'SPLIT-TPL-DEFAULT',
        systemShare: suggestedShare,
        manualAdjustment: 0,
        finalShare: suggestedShare,
        manualReason: null,
        dailyBaselineForecast: Object.fromEntries(dates.map(date => [date, Number(legacy[date]?.ai) || 0])),
        dailyRuleForecast: Object.fromEntries(dates.map(date => [date, Number(legacy[date]?.ai) || 0])),
        dailyManualForecast: Object.fromEntries(dates.map(date => [date, legacy[date]?.manual ?? null])),
        dailyActivityForecast: Object.fromEntries(dates.map(date => [date, legacy[date]?.activity ?? null])),
        dailyFinalForecast: Object.fromEntries(dates.map(date => [date, Number(legacy[date]?.final) || 0])),
        dailyReason: Object.fromEntries(dates.map(date => [date, legacy[date]?.reason || '沿用规则基准']))
      };
    });
    Object.values(groups).forEach(siblings => {
      const ratioTotal = sum(siblings.map(row => row.systemShare));
      siblings.forEach(row => { row.systemShare = ratioTotal ? Math.round(row.systemShare / ratioTotal * 10000) : Math.round(10000 / siblings.length); row.finalShare = row.systemShare; });
      const drift = 10000 - sum(siblings.map(row => row.systemShare));
      if (siblings.at(-1)) siblings.at(-1).systemShare += drift, siblings.at(-1).finalShare += drift;
    });
    rows.forEach(applyComboAllocation);
    return rows;
  }
  function parentForecastResults(rows, start, end) {
    const dates = dateRange(start, end);
    const grouped = rows.reduce((map, row) => { (map[relationKey(row)] ||= []).push(row); return map; }, {});
    return Object.entries(grouped).map(([key, siblings]) => ({
      key,
      country: siblings[0].country,
      store: siblings[0].store,
      parentASIN: siblings[0].parentASIN,
      typeCode: siblings[0].typeCode,
      productName: siblings[0].productName,
      spu: siblings[0].spu,
      skc: siblings[0].skc,
      image: siblings[0].image,
      owner: siblings[0].owner,
      tags: [...(siblings[0].tags || [])],
      daily: Object.fromEntries(dates.map(date => [date, sum(siblings.map(row => row.dailyBaselineForecast?.[date] ?? row.dailyRuleForecast[date] ?? 0))])),
      total: sum(dates.map(date => sum(siblings.map(row => row.dailyBaselineForecast?.[date] ?? row.dailyRuleForecast[date] ?? 0))))
  }));
  }

  const sourceRowKey = (type, row) => {
    if (!row) return '';
    if (type === 'parent') return `${row.country || row['国家'] || ''}|${row.parentASIN || row['父体ASIN'] || ''}`;
    if (type === 'child') return `${row.country || row['国家'] || ''}|${row.childASIN || row['子体ASIN'] || ''}`;
    if (type === 'season') return `${row.site || row['站点'] || ''}|${row.typeCode || row['类型编码'] || ''}`;
    return String(row.typeCode || row['类型编码'] || '');
  };

  const hydrateProductFields = (batch, services) => {
    const source = sourceGroups(services).flatMap(group => group.children.map(child => ({
      child,
      group,
      childASIN: child.asin,
      country: group.market
    })));
    const findProduct = row => source.find(item => item.country === row.country && item.childASIN === row.childASIN);
    batch.relationSnapshot?.forEach(row => {
      const item = findProduct(row);
      if (item) Object.assign(row, {
        sku: row.sku || item.child.sku,
        historicSku: row.historicSku || item.child.historicSku,
        salesCombo: row.salesCombo || item.child.combo,
        salesComboMeta: row.salesComboMeta || (item.child.salesComboMeta ? clone(item.child.salesComboMeta) : null) || root.getSalesComboDefinition?.(row.childASIN) || null,
        businessCode: row.businessCode || item.child.businessCode,
        typeCode: row.typeCode || item.child.typeCode || item.group.typeCode || 'F03',
        size: row.size || item.child.size,
        color: row.color || item.child.color,
        spu: row.spu || item.group.spu,
        skc: row.skc || item.group.skc,
        image: row.image || item.group.image,
        owner: row.owner || item.group.owner,
        listedAt: row.listedAt || item.group.listedAt,
        listingDays: row.listingDays || item.group.listingDays
      });
    });
    batch.childForecastResults?.forEach(row => {
      const item = findProduct(row);
      if (item) Object.assign(row, {
        sku: row.sku || item.child.sku,
        historicSku: row.historicSku || item.child.historicSku,
        salesCombo: row.salesCombo || item.child.combo,
        salesComboMeta: row.salesComboMeta || (item.child.salesComboMeta ? clone(item.child.salesComboMeta) : null) || root.getSalesComboDefinition?.(row.childASIN) || null,
        businessCode: row.businessCode || item.child.businessCode,
        typeCode: row.typeCode || item.child.typeCode || item.group.typeCode || 'F03',
        size: row.size || item.child.size,
        color: row.color || item.child.color,
        spu: row.spu || item.group.spu,
        skc: row.skc || item.group.skc,
        image: row.image || item.group.image,
        owner: row.owner || item.group.owner,
        listedAt: row.listedAt || item.group.listedAt,
        listingDays: row.listingDays || item.group.listingDays
      });
    });
    batch.parentForecastResults?.forEach(parent => {
      const child = batch.childForecastResults?.find(row => relationKey(row) === parent.key);
      if (!child) return;
      const item = findProduct(child);
      Object.assign(parent, {
        spu: parent.spu || child.spu || item?.group?.spu,
        skc: parent.skc || child.skc || item?.group?.skc,
        image: parent.image || child.image || item?.group?.image,
        productName: parent.productName || child.productName || item?.group?.name,
        owner: parent.owner || child.owner || item?.group?.owner,
        tags: parent.tags || child.tags || item?.group?.tags || []
      });
    });
    batch.sourceReferences ||= {};
    batch.sourceOverrides ||= { parent: {}, child: {}, season: {}, rules: {} };
  };
  function applyCalibration(batch) {
    const dates = dateRange(batch.forecastStartDate, batch.forecastEndDate);
    const numeric = value => typeof value === 'number' && Number.isFinite(value);
    const scale = (daily, adjustment) => {
      if (!adjustment) return { ...daily };
      const values = Object.values(daily).filter(numeric);
      const mean = values.length ? sum(values) / values.length : 0;
      return Object.fromEntries(Object.entries(daily).map(([date, value]) => {
        if (!numeric(value)) return [date, null];
        if (adjustment.mode === 'daily') return [date, date === adjustment.date ? Math.max(0, Math.round(adjustment.value)) : value];
        return [date, Math.max(0, Math.round(adjustment.mode === 'ratio' ? value * (1 + adjustment.value / 100) : mean ? value * adjustment.value / mean : adjustment.value))];
      }));
    };
    batch.parentForecastResults.forEach(parent => {
      const children = batch.childForecastResults.filter(row => relationKey(row) === parent.key);
      const parentAdjustment = batch.calibrations?.parent?.[parent.key];
      const adjusted = scale(parent.daily, parentAdjustment);
      dates.forEach(date => {
        const known = numeric(adjusted[date]);
        const allocations = !known ? children.map(() => null) : parentAdjustment ? allocateComboTotal(adjusted[date], children.map(row => ({ quantity: row.finalShare }))) : children.map(row => row.dailyFinalForecast[date]);
        children.forEach((row, index) => {
          row.dailyForecastStatus ||= {};
          const status = parent.dailyForecastStatus?.[date] || null;
          if (status) row.dailyForecastStatus[date] = status; else delete row.dailyForecastStatus[date];
          row.dailyFinalForecast[date] = status ? null : allocations[index];
          if (status) row.dailyRuleForecast[date] = null;
        });
      });
      children.forEach(row => {
        const childAdjustment = batch.calibrations?.child?.[row.childId];
        row.dailyFinalForecast = scale(childAdjustment ? row.dailyRuleForecast : row.dailyFinalForecast, childAdjustment);
        row.pmcCalibration = clone(batch.calibrations?.child?.[row.childId] || batch.calibrations?.parent?.[parent.key] || null);
      });
      parent.baselineDaily = Object.fromEntries(dates.map(date => [date, parent.dailyForecastStatus?.[date] || !children.some(row => numeric(row.dailyFinalForecast[date])) ? null : sum(children.map(row => row.dailyFinalForecast[date]))]));
      parent.baselineTotal = sum(Object.values(parent.baselineDaily));
    });
  }
  function recalculateSplit(batch) {
    const dates = dateRange(batch.forecastStartDate, batch.forecastEndDate);
    const grouped = batch.childForecastResults.reduce((map, row) => { (map[relationKey(row)] ||= []).push(row); return map; }, {});
    Object.values(grouped).forEach(siblings => {
      const parent = batch.parentForecastResults.find(item => item.key === relationKey(siblings[0]));
      siblings.forEach(row => { row.manualAdjustment = row.finalShare - row.systemShare; });
      dates.forEach(date => {
        const parentValue = parent?.daily?.[date] || 0;
        const systemValues = siblings.map(row => Math.round(parentValue * row.systemShare / 10000));
        const finalValues = siblings.map(row => Math.round(parentValue * row.finalShare / 10000));
        if (siblings.length) {
          systemValues[systemValues.length - 1] += parentValue - sum(systemValues);
          finalValues[finalValues.length - 1] += parentValue - sum(finalValues);
        }
        siblings.forEach((row, index) => {
          row.dailyRuleForecast[date] = systemValues[index];
          row.dailyFinalForecast[date] = finalValues[index];
        });
      });
    });
    applyCalibration(batch);
    rebuildComboAllocations(batch);
  }
  function rebuildPools(batch, resetFinal = true) {
    const grouped = batch.childForecastResults.reduce((map, row) => { (map[relationKey(row)] ||= []).push(row); return map; }, {});
    Object.values(grouped).forEach(siblings => {
      const historyTotal = sum(siblings.map(row => row.historicalSales));
      const recentTotal = sum(siblings.map(row => row.recent14CleanSales));
      siblings.forEach(row => {
        row.history84Share = historyTotal ? Math.round(row.historicalSales / historyTotal * 10000) : Math.round(10000 / siblings.length);
        row.recent14Share = recentTotal ? Math.round(row.recent14CleanSales / recentTotal * 10000) : row.history84Share;
        const lowOrUnstable = row.recentCleanAdu < 2 && row.recentSellingDays <= 10;
        row.splitJudgement = lowOrUnstable ? '低销量/不稳定' : '正常';
        row.matchedSplitRuleId = lowOrUnstable ? 'SPLIT-TPL-LOW' : 'SPLIT-TPL-DEFAULT';
        row.systemShare = lowOrUnstable ? Math.round(row.history84Share * 0.7 + row.recent14Share * 0.3) : row.history84Share;
      });
      const systemTotal = sum(siblings.map(row => row.systemShare));
      siblings.forEach(row => { row.systemShare = systemTotal ? Math.round(row.systemShare / systemTotal * 10000) : Math.round(10000 / siblings.length); if (resetFinal) row.finalShare = row.systemShare; });
      const drift = 10000 - sum(siblings.map(row => row.systemShare));
      if (siblings.at(-1)) {
        siblings.at(-1).systemShare += drift;
        if (resetFinal) siblings.at(-1).finalShare += drift;
      }
    });
    batch.parentForecastResults = parentForecastResults(batch.childForecastResults, batch.forecastStartDate, batch.forecastEndDate);
    recalculateSplit(batch);
  }
  function resultValidation(batch) {
    const childKeys = batch.relationSnapshot.map(row => `${row.country}|${row.store}|${row.childASIN}`);
    const duplicateChildren = childKeys.filter((key, index) => childKeys.indexOf(key) !== index).length;
    const unparentedChildren = batch.relationSnapshot.filter(row => !row.parentASIN).length;
    const parentMissing = batch.relationSnapshot.filter(row => !batch.parentForecastResults.some(parent => parent.key === relationKey(row))).length;
    const grouped = batch.childForecastResults.reduce((map, row) => { (map[relationKey(row)] ||= []).push(row); return map; }, {});
    const shareAnomalies = Object.values(grouped).filter(rows => sum(rows.map(row => row.finalShare)) !== 10000).length;
    const adjustmentReasonMissing = batch.childForecastResults.filter(row => row.manualAdjustment && !row.manualReason).length;
    const comboRows = batch.childForecastResults.filter(row => row.businessObjectType === 'COMBO');
    const comboImbalance = comboRows.filter(row => sum((row.comboLines || []).map(line => Number(line.finalForecast) || 0)) !== sum(Object.values(row.dailyFinalForecast || {}))).length;
    const comboAdjustmentReasonMissing = comboRows.flatMap(row => row.comboLines || []).filter(line => Number(line.pmcAdjustment) && !line.adjustmentReason).length;
    const seasonRuleReview = (batch.seasonRuleReview || []).length;
    const imbalance = Object.entries(grouped).filter(([key, rows]) => {
      const parent = batch.parentForecastResults.find(item => item.key === key);
      return !parent || dateRange(batch.forecastStartDate, batch.forecastEndDate).some(date => {
        const expected = (parent.baselineDaily || parent.daily)[date];
        if (parent.dailyForecastStatus?.[date]) return rows.some(row => row.dailyFinalForecast[date] != null);
        return typeof expected !== 'number' || rows.some(row => typeof row.dailyFinalForecast[date] !== 'number') || sum(rows.map(row => row.dailyFinalForecast[date])) !== expected;
      });
    }).length;
    const missingDays = batch.childForecastResults.filter(row => dateRange(batch.forecastStartDate, batch.forecastEndDate).some(date => row.dailyFinalForecast[date] == null && !row.dailyForecastStatus?.[date])).length;
    const items = [
      ['预测日期缺少数值或明确状态', missingDays],
      ['父子关系完整', unparentedChildren],
      ['一个ASIN多个父ASIN', duplicateChildren],
      ['无父ASIN子体', unparentedChildren],
      ['父ASIN预测缺失', parentMissing],
      ['子体份额合计异常', shareAnomalies],
      ['人工调整未填写原因', adjustmentReasonMissing],
      ['销售组合拆解未平衡', comboImbalance],
      ['组合人工调整未填写原因', comboAdjustmentReasonMissing],
      ['特殊季节运行规则待复核', seasonRuleReview],
      ['拆解结果与父体不平衡', imbalance]
    ].map(([label, count]) => ({ label, count, passed: count === 0 }));
    if (!batch.relationConfirmed) items.unshift({ label: '本批次父子关系已确认', count: 1, passed: false });
    if (!batch.splitConfirmed) items.push({ label: '本批次子体拆解已确认', count: 1, passed: false });
    return { passed: items.every(item => item.passed), items };
  }
  function makeResultSnapshot(batch, version, generatedAt) {
    return {
      version,
      generatedAt,
      relationVersion: batch.relationVersion,
      splitRuleVersion: batch.splitRuleSnapshot.version,
      forecastRuleVersion: batch.forecastRuleSnapshot.version,
      seasonRuleVersion: batch.seasonRuleVersion,
      seasonRuleMode: batch.seasonRuleMode,
      parameterVersion: batch.parameterSnapshot.version,
      parentCount: batch.parentForecastResults.length,
      childCount: batch.childForecastResults.length,
      parentTotal: sum(batch.parentForecastResults.map(row => row.baselineTotal ?? row.total)),
      childTotal: sum(batch.childForecastResults.map(row => sum(Object.values(row.dailyFinalForecast)))),
      parents: batch.parentForecastResults.map(row => ({ key: row.key, country: row.country, store: row.store, parentASIN: row.parentASIN, total: row.baselineTotal ?? row.total, daily: clone(row.baselineDaily || row.daily), systemDaily: clone(row.daily), dailyForecastStatus: clone(row.dailyForecastStatus || {}), systemTags: clone(row.tags || []), tagOverrides: clone(batch.parentTagOverrides?.[row.key] || {}) })),
      rows: batch.childForecastResults.map(row => ({
        childId: row.childId,
        country: row.country,
        store: row.store,
        platform: row.platform,
        parentASIN: row.parentASIN,
        childASIN: row.childASIN,
        salesOwner: row.salesOwner,
        tags: clone([...new Set([...(row.tags || []), ...Object.values(row.tagOverrides || {}).filter(Boolean)])]),
        systemTags: clone(row.tags || []),
        tagOverrides: clone(row.tagOverrides || {}),
        systemShare: row.systemShare,
        manualAdjustment: row.manualAdjustment,
        manualReason: row.manualReason,
        finalShare: row.finalShare,
        businessObjectType: row.businessObjectType,
        businessObjectCode: row.businessObjectCode,
        businessObjectVersion: row.businessObjectVersion,
        salesComboMeta: row.salesComboMeta ? clone(row.salesComboMeta) : null,
        comboSnapshot: row.comboSnapshot ? clone(row.comboSnapshot) : null,
        comboVersionHistory: clone(row.comboVersionHistory || []),
        comboLines: clone(row.comboLines || []),
        total: sum(Object.values(row.dailyFinalForecast)),
        daily: clone(row.dailyFinalForecast),
        dailyForecastStatus: clone(row.dailyForecastStatus || {}),
        pmcCalibration: clone(row.pmcCalibration || null),
        ruleDaily: clone(row.dailyRuleForecast),
        dailyReason: clone(row.dailyReason || {})
      }))
    };
  }
  function materializeResultSnapshot(batch) {
    if (!batch?.resultSnapshotDeferred || !batch.activeResultVersion) return;
    if (batch.resultSnapshots?.some(snapshot => snapshot.version === batch.activeResultVersion)) {
      batch.resultSnapshotDeferred = false;
      return;
    }
    batch.resultSnapshots.push(makeResultSnapshot(batch, batch.activeResultVersion, batch.resultGeneratedAt || batch.updatedAt));
    batch.resultSnapshotDeferred = false;
  }
  function invalidateResult(batch, workflowState) {
    batch.resultState = batch.resultSnapshots.length ? '需重新生成' : '待生成';
    batch.resultConfirmed = false;
    batch.workflowState = workflowState;
  }
  function captureRelationVersion(batch, reason) {
    batch.relationVersion = nextVersion(batch.relationVersion);
    batch.relationVersions.push({ version: batch.relationVersion, at: new Date().toISOString(), reason, relations: clone(batch.relationSnapshot), removedRelations: clone(batch.removedRelations || []) });
  }
  function actualSnapshot(rows, batch, services) {
    const reader = sourceActual(services);
    return Object.fromEntries(rows.map(row => {
      const actual = {};
      if (reader && row.childRef) {
        for (let date = shiftDate(batch, -30); date < batch; date = shiftDate(date, 1)) actual[date] = reader(row.childRef, date);
      }
      return [row.id, actual];
    }));
  }
  function buildForecastComparison(batch, previous) {
    if (!previous) return { start: null, end: null, dates: [], rows: [] };
    const actualDates = Object.values(batch.actualSales).flatMap(values => Object.keys(values)).sort();
    const start = [previous.forecastStartDate, actualDates[0]].filter(Boolean).sort().at(-1);
    const end = [previous.forecastEndDate, batch.dataCutoffDate, actualDates.at(-1)].filter(Boolean).sort().at(0);
    const dates = start && end && start <= end ? dateRange(start, end) : [];
    const rows = previous.parentForecastResults.map(parent => {
      const children = previous.childForecastResults.filter(row => relationKey(row) === parent.key);
      const ruleForecast = sum(dates.map(date => parent.daily?.[date] || 0));
      const actualSales = sum(children.flatMap(row => dates.map(date => batch.actualSales[row.id]?.[date] || 0)));
      const variance = actualSales - ruleForecast;
      return {
        key: parent.key,
        country: parent.country,
        store: parent.store,
        parentASIN: parent.parentASIN,
        total: ruleForecast,
        actualSales,
        variance,
        varianceRate: ruleForecast ? Number((variance / ruleForecast * 100).toFixed(1)) : 0,
        comparisonStartDate: start,
        comparisonEndDate: end,
        sourceBatchId: previous.id,
        sourceBatchVersion: previous.batchVersion
      };
    });
    return { start, end, dates, rows };
  }
  function assessment(batch, previous, comparison) {
    const ruleTotal = sum(comparison.rows.map(parent => parent.total));
    const actualTotal = sum(comparison.rows.map(parent => parent.actualSales));
    const variance = actualTotal - ruleTotal;
    const comparable = comparison.dates.length > 0;
    return {
      previousBatchId: previous?.id || null,
      previousBatchVersion: previous?.batchVersion || null,
      comparisonStartDate: comparison.start,
      comparisonEndDate: comparison.end,
      comparisonDays: comparison.dates.length,
      comparable,
      ruleForecastTotal: ruleTotal,
      actualSalesTotal: actualTotal,
      variance: Math.round(variance),
      varianceRate: ruleTotal ? Number((variance / ruleTotal * 100).toFixed(1)) : 0,
      trend: !comparable ? '暂无完整可比批次，等待下一批次实际销量回流' : variance >= 0 ? '同周期实际销量高于规则预测，近期趋势偏强' : '同周期实际销量低于规则预测，近期趋势偏弱',
      anomalyCount: batch.relationChanges.length + batch.childForecastResults.filter(row => row.finalShare < 500).length,
      relationChanges: batch.relationChanges.length
    };
  }
  function createBatch(input, services, previous) {
    const batchDate = input.batchDate;
    const start = input.forecastStartDate || batchDate;
    const end = input.forecastEndDate || shiftDate(start, 181);
    const baseRows = rowsFromGroups(sourceGroups(services), batchDate, services);
    const relations = input.relations || baseRows.map(row => relationFromRow(row, batchDate));
    const rows = buildForecastRows(relations, batchDate, start, end, services, previous);
    const batch = {
      schema: 4,
      id: input.id,
      batchVersion: input.batchVersion,
      name: input.name,
      batchDate,
      dataCutoffDate: input.dataCutoffDate || shiftDate(batchDate, -1),
      forecastStartDate: start,
      forecastEndDate: end,
      scope: input.scope || { country: '全部', platform: '全部' },
      previousBatchId: previous?.id || input.previousBatchId || null,
      status: input.status || '草稿',
      calibrationStatus: input.calibrationStatus || (input.status === '已完成' || input.status === '已冻结' ? '已冻结' : '待校准'),
      calibrationStartedAt: input.calibrationStartedAt || null,
      calibrationCompletedAt: input.calibrationCompletedAt || null,
      workbenchEntries: clone(input.workbenchEntries || {}),
      currentStep: input.currentStep || 'assessment',
      createdBy: 'PMC计划员',
      createdAt: `${batchDate}T09:00:00+08:00`,
      updatedAt: `${batchDate}T09:00:00+08:00`,
      dataUpdatedAt: input.dataUpdatedAt || `${input.dataCutoffDate || shiftDate(batchDate, -1)}T08:30:00+08:00`,
      parameterSnapshot: input.parameterSnapshot || defaultParams(input.parameterVersion || `PARAM-${batchDate.replaceAll('-', '')}-V01`),
      pendingParameterSnapshot: input.pendingParameterSnapshot || null,
      parameterSubmittedAt: input.parameterSubmittedAt || null,
      parameterEffectiveAt: input.parameterEffectiveAt || null,
      forecastRuleSnapshot: input.forecastRuleSnapshot || defaultForecastRule(input.forecastRuleVersion || `FORECAST-${batchDate.replaceAll('-', '')}-V01`),
      seasonRuleVersion: input.seasonRuleVersion || 'SEASON-V3',
      seasonRuleMode: input.seasonRuleMode || '常规季节指数',
      relationVersion: input.relationVersion || `REL-${batchDate.replaceAll('-', '')}-V01`,
      splitRuleSnapshot: input.splitRuleSnapshot || defaultSplitRule(input.splitRuleVersion || `SPLIT-${batchDate.replaceAll('-', '')}-V01`),
      splitRuleTemplates: input.splitRuleTemplates || defaultSplitRuleTemplates(),
      relationSnapshot: relations.map(relation => ({ ...relation, childRef: undefined })),
      removedRelations: input.removedRelations || [],
      relationChanges: input.relationChanges || [],
      relationConfirmed: input.relationConfirmed ?? false,
      splitConfirmed: input.splitConfirmed ?? false,
      parentForecastResults: parentForecastResults(rows, start, end),
      childForecastResults: rows.map(row => ({ ...row, childRef: undefined })),
      resultState: input.resultGenerated ? '已生成' : '待生成',
      resultConfirmed: input.resultConfirmed ?? Boolean(input.resultGenerated),
      activeResultVersion: input.resultVersion || null,
      resultSnapshots: [],
      resultSnapshotDeferred: Boolean(input.deferResultSnapshot),
      resultGeneratedAt: input.resultGeneratedAt || null,
      workflowState: input.workflowState || '草稿',
      submissionWindow: input.submissionWindow || defaultWindow(batchDate),
      submissionState: input.submissionState || '待发布',
      frozenAt: input.frozenAt || null,
      frozenResultVersion: input.frozenResultVersion || null,
      frozenForecastSnapshot: input.frozenForecastSnapshot || null,
      downstreamReady: Boolean(input.downstreamReady),
      actualSales: input.actualSales || actualSnapshot(rows, batchDate, services),
      forecastVsActual: [],
      sourceReferences: input.sourceReferences || {},
      sourceOverrides: input.sourceOverrides || { parent: {}, child: {}, season: {}, rules: {} },
      adjustmentLog: input.adjustmentLog || [],
      auditTimeline: input.auditTimeline || [{ at: `${batchDate}T09:00:00+08:00`, action: '创建预测批次', actor: 'PMC计划员', reason: '继承上一批次预测与实际表现' }]
    };
    rebuildPools(batch, true);
    batch.relationVersions = input.relationVersions || [{ version: batch.relationVersion, at: batch.createdAt, reason: '创建本批次关系快照', relations: clone(batch.relationSnapshot), removedRelations: [] }];
    if (input.resultGenerated && !input.deferResultSnapshot) batch.resultSnapshots.push(makeResultSnapshot(batch, input.resultVersion || `RESULT-${batchDate.replaceAll('-', '')}-V01`, input.resultGeneratedAt || batch.updatedAt));
    const comparison = buildForecastComparison(batch, previous);
    batch.assessment = assessment(batch, previous, comparison);
    batch.forecastVsActual = comparison.rows;
    hydrateProductFields(batch, services);
    return batch;
  }
  function seed(services = {}) {
    const historicalDates = ['2026-09-08', '2026-09-15', '2026-09-22'];
    const demoSalesSubmissionDate = '2026-09-22';
    const currentDate = '2026-09-29';
    const previousDate = historicalDates.at(-1);
    const localPrototypeReady = !services.groups && !services.forecastAt && !services.actualAt;
    const previousRelations = rowsFromGroups(sourceGroups(services), previousDate, services).map(row => relationFromRow(row, previousDate));
    const supportsDemoMove = previousRelations.some(row => row.parentASIN === 'B0GRGFFVVN' && row.childASIN === 'B0GRG7J9MN') && previousRelations.some(row => row.parentASIN === 'B0H4QG3TLS');
    const currentRelations = rowsFromGroups(sourceGroups(services), currentDate, services).map(row => ({
      ...relationFromRow(row, currentDate),
      ...(supportsDemoMove && row.childASIN === 'B0GRG7J9MN' ? { parentASIN: 'B0H4QG3TLS', relationState: 'PMC本批次确认' } : {})
    }));
    const currentRelationChanges = supportsDemoMove ? [{ id: 'REL-CHANGE-001', childASIN: 'B0GRG7J9MN', from: 'B0GRGFFVVN', to: 'B0H4QG3TLS', type: '父体变更', beforeShare: 3500, afterShare: 2700, reason: '父体Listing结构调整', actor: 'PMC计划员', at: '2026-09-29T10:30:00+08:00' }] : [];
    const historical = historicalDates.reduce((batches, batchDate) => {
      const suffix = batchDate.replaceAll('-', '');
      const previous = batches.at(-1);
      const relations = rowsFromGroups(sourceGroups(services), batchDate, services).map(row => relationFromRow(row, batchDate));
      const demoSalesSubmission = batchDate === demoSalesSubmissionDate;
      const batch = createBatch({
        id: `FB-${suffix}-01`, batchVersion: `V${suffix}-01`, name: `${batchDate} 预测批次`, batchDate,
        dataCutoffDate: shiftDate(batchDate, -1),
        status: demoSalesSubmission ? '销售填报中' : '已冻结',
        calibrationStatus: demoSalesSubmission ? '销售填报中' : '已冻结',
        currentStep: demoSalesSubmission ? 'submission' : 'review',
        submissionState: demoSalesSubmission ? '填报中' : '已冻结',
        workflowState: demoSalesSubmission ? '填报进行中' : '填报已冻结',
        relationConfirmed: true, splitConfirmed: true, resultGenerated: true, resultVersion: `RESULT-${suffix}-V01`,
        frozenAt: demoSalesSubmission ? null : `${shiftDate(batchDate, 5)}T00:00:00+08:00`,
        frozenResultVersion: demoSalesSubmission ? null : `FROZEN-${suffix}-V01`,
        downstreamReady: !demoSalesSubmission,
        submissionWindow: demoSalesSubmission ? {
          submissionStartTime: '2026-10-06T00:00:00+08:00',
          submissionDeadlineTime: '2026-10-10T18:00:00+08:00',
          submissionFreezeTime: '2026-10-12T00:00:00+08:00',
          ruleEffectiveTime: '2026-10-12T09:00:00+08:00',
          calendarVersion: BUSINESS_CALENDAR.version,
          status: '填报中',
          autoFreeze: true
        } : undefined,
        relationVersion: `REL-${suffix}-V01`, forecastRuleVersion: `FORECAST-${suffix}-V01`, splitRuleVersion: `SPLIT-${suffix}-V01`, parameterVersion: `PARAM-${suffix}-V01`, deferResultSnapshot: true,
        relations
      }, services, previous);
      if (demoSalesSubmission) batch.auditTimeline.push({ at: '2026-10-06T00:00:00+08:00', action: '销售预测演示批次已开启', actor: '系统', reason: '用于演示销售预测列表待填报与多人协同入口' });
      batches.push(batch);
      return batches;
    }, []);
    const previous = historical.at(-1);
    const current = createBatch({
      id: 'FB-20260929-01', batchVersion: 'V20260929-01', name: '2026-09-29 预测批次', batchDate: currentDate,
      dataCutoffDate: '2026-09-28', status: localPrototypeReady ? '待校准' : '评估中', currentStep: localPrototypeReady ? 'forecast' : 'assessment', submissionState: '待发布', previousBatchId: previous.id, workflowState: localPrototypeReady ? '待校准' : '评估中', relationConfirmed: localPrototypeReady, splitConfirmed: localPrototypeReady, resultGenerated: localPrototypeReady, resultConfirmed: false, resultVersion: localPrototypeReady ? `RESULT-${currentDate.replaceAll('-', '')}-V01` : null,
      relationVersion: 'REL-20260929-V02', forecastRuleVersion: 'FORECAST-20260929-V01', splitRuleVersion: 'SPLIT-20260929-V01', parameterVersion: 'PARAM-20260929-V01',
      relations: currentRelations,
      relationChanges: currentRelationChanges,
      auditTimeline: [
        { at: '2026-09-29T09:00:00+08:00', action: '创建预测批次', actor: 'PMC计划员', reason: '读取上一批次预测、实际与关系快照' },
        { at: '2026-09-29T09:05:00+08:00', action: localPrototypeReady ? '生成系统预测' : '识别评估异常', actor: localPrototypeReady ? '系统' : '系统', reason: localPrototypeReady ? (supportsDemoMove ? '按本批次关系快照生成父体预测池与子体分配结果' : '按当前批次规则生成系统预测结果') : (supportsDemoMove ? '检测到父子关系变化，等待PMC评估确认' : '检测上一批次预测与实际偏差') }
      ]
    }, services, previous);
    current.relationSnapshot = current.relationSnapshot.map(relation => ({ ...relation, previousParentASIN: previous.relationSnapshot.find(old => old.childASIN === relation.childASIN && old.country === relation.country)?.parentASIN || relation.parentASIN }));
    if (current.relationChanges[0]) current.relationChanges[0].previousBatchId = previous.id;
    if (supportsDemoMove) current.relationVersions = [
      { version: 'REL-20260929-V01', at: '2026-09-29T09:00:00+08:00', reason: '继承上一批次有效关系', relations: clone(previous.relationSnapshot), removedRelations: [] },
      { version: current.relationVersion, at: '2026-09-29T10:30:00+08:00', reason: '确认父体变更', relations: clone(current.relationSnapshot), removedRelations: [] }
    ];
    return { schema: 4, revision: 1, currentBatchId: current.id, batches: [...historical, current] };
  }
  function validState(value) {
    return value && value.schema === 4 && Array.isArray(value.batches) && value.batches.length > 0 && value.batches.every(batch => batch.id && Array.isArray(batch.childForecastResults) && Array.isArray(batch.resultSnapshots) && Array.isArray(batch.relationVersions) && batch.relationVersion && batch.assessment && 'comparisonDays' in batch.assessment);
  }
  function createStore(services = {}, storage = root.localStorage) {
    let state;
    try {
      const saved = storage?.getItem(STORAGE_KEY);
      state = saved ? JSON.parse(saved) : null;
    } catch (error) {
      state = null;
    }
    if (!validState(state)) state = seed(services);
    state.batches.forEach(batch => {
      if (batch.resultConfirmed == null) batch.resultConfirmed = batch.resultState === '已生成' && batch.submissionState !== '待发布';
      if (!('pendingParameterSnapshot' in batch)) batch.pendingParameterSnapshot = null;
      if (!('parameterSubmittedAt' in batch)) batch.parameterSubmittedAt = null;
      if (!('parameterEffectiveAt' in batch)) batch.parameterEffectiveAt = null;
      if (!batch.dataUpdatedAt) batch.dataUpdatedAt = `${batch.dataCutoffDate}T08:30:00+08:00`;
      if (!batch.seasonRuleVersion) batch.seasonRuleVersion = 'SEASON-V3';
      if (!batch.seasonRuleMode) batch.seasonRuleMode = '常规季节指数';
      const legacyCompleted = batch.calibrationStatus === '已完成' || batch.status === '已完成';
      if (batch.submissionState === '已冻结') {
        batch.calibrationStatus = '已冻结';
        batch.status = '已冻结';
        batch.workflowState = '填报已冻结';
      } else if (legacyCompleted) {
        batch.calibrationStatus = '待发起销售填报';
        batch.status = '待发起销售填报';
        batch.workflowState = 'PMC校准已完成';
        batch.submissionState = '待发起销售填报';
      } else if (!batch.calibrationStatus) batch.calibrationStatus = batch.status === '销售填报中' ? '销售填报中' : '待校准';
      if (!('calibrationStartedAt' in batch)) batch.calibrationStartedAt = null;
      if (!('calibrationCompletedAt' in batch)) batch.calibrationCompletedAt = calibrationComplete(batch) ? batch.updatedAt : null;
      batch.submissionWindow ||= defaultWindow(batch.batchDate);
      batch.submissionWindow.calendarVersion ||= BUSINESS_CALENDAR.version;
      batch.submissionWindow.autoFreeze ??= true;
      if (!('ruleEffectiveTime' in batch.submissionWindow)) batch.submissionWindow.ruleEffectiveTime = `${shiftDate(batch.batchDate, 5)}T09:00:00+08:00`;
      if (!('frozenAt' in batch)) batch.frozenAt = batch.status === '已冻结' ? batch.updatedAt : null;
      if (!('frozenResultVersion' in batch)) batch.frozenResultVersion = batch.status === '已冻结' ? `FROZEN-${batch.batchDate.replaceAll('-', '')}-V01` : null;
      if (!('frozenForecastSnapshot' in batch)) batch.frozenForecastSnapshot = null;
      if (!('downstreamReady' in batch)) batch.downstreamReady = batch.status === '已冻结';
      batch.workbenchEntries ||= {};
    });
    const listeners = new Set();
    const save = () => { try { storage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { /* demo continues in memory */ } listeners.forEach(listener => listener(getState())); if (root.dispatchEvent && typeof Event !== 'undefined') root.dispatchEvent(new Event('forecast-batch-change')); };
    const getBatchRaw = batchId => { const value = batchId || state.currentBatchId; const batch = state.batches.find(item => item.id === value || item.batchDate === value || item.batchVersion === value); if (batch) hydrateProductFields(batch, services); return batch; };
    const getActiveResult = batch => batch?.resultSnapshots?.find(snapshot => snapshot.version === batch.activeResultVersion) || null;
    const finalizeWorkbenchCalibration = (batch, at = new Date().toISOString()) => {
      materializeResultSnapshot(batch);
      const activeResult = getActiveResult(batch);
      const dates = dateRange(batch.forecastStartDate, batch.forecastEndDate);
      batch.childForecastResults.forEach(row => {
        const baselineRow = activeResult?.rows.find(item => item.childId === row.childId || item.childASIN === row.childASIN);
        const draft = workbenchDraft(batch.workbenchEntries?.[row.childId]);
        row.dailyFinalForecast = Object.fromEntries(dates.map(date => {
          if (row.dailyForecastStatus?.[date]) return [date, null];
          const baseline = baselineRow?.daily?.[date] ?? row.dailyFinalForecast?.[date] ?? row.dailyRuleForecast?.[date] ?? null;
          const activity = draft.activity?.[date];
          return [date, activity?.qty ?? draft.manual?.[date] ?? baseline];
        }));
        row.workbenchCalibrationSnapshot = clone(draft);
      });
      batch.parentForecastResults.forEach(parent => {
        const children = batch.childForecastResults.filter(row => relationKey(row) === parent.key);
        parent.baselineDaily = Object.fromEntries(dates.map(date => {
          const values = children.map(row => row.dailyFinalForecast?.[date]).filter(value => typeof value === 'number' && Number.isFinite(value));
          return [date, values.length ? sum(values) : null];
        }));
        parent.baselineTotal = sum(Object.values(parent.baselineDaily));
      });
      const version = `RESULT-${batch.batchDate.replaceAll('-', '')}-V${String(batch.resultSnapshots.length + 1).padStart(2, '0')}`;
      const snapshot = makeResultSnapshot(batch, version, at);
      snapshot.workbenchEntries = clone(batch.workbenchEntries || {});
      batch.resultSnapshots.push(snapshot);
      batch.activeResultVersion = version;
      batch.resultGeneratedAt = at;
      batch.resultState = '已生成';
      batch.resultConfirmed = true;
      batch.calibrationStatus = '待发起销售填报';
      batch.calibrationStartedAt ||= at;
      batch.calibrationCompletedAt = at;
      batch.status = '待发起销售填报';
      batch.submissionState = '待发起销售填报';
      batch.workflowState = 'PMC校准已完成';
      batch.currentStep = 'submission';
      batch.auditTimeline.push({ at, action: '完成PMC批次校准', actor: 'PMC计划员', reason: `${batch.childForecastResults.length} 个ASIN最终预测已形成 · ${version}` });
    };
    const fallbackFrozenSnapshot = (batch, at) => {
      materializeResultSnapshot(batch);
      const result = getActiveResult(batch);
      return {
        batchId: batch.id,
        batchVersion: batch.batchVersion,
        resultVersion: result?.version || batch.activeResultVersion,
        frozenAt: at,
        source: '规则预测',
        rows: (result?.rows || []).map(row => ({ childId: row.childId, childASIN: row.childASIN, parentASIN: row.parentASIN, country: row.country, store: row.store, daily: clone(row.daily || {}) }))
      };
    };
    const getState = () => ({ revision: state.revision, currentBatchId: state.currentBatchId });
    const write = (batchId, mutator, allowPublished = false) => {
      const original = getBatchRaw(batchId);
      if (!original) throw Error('预测批次不存在');
      const batch = clone(original);
      if (batch.status === '已冻结') throw Error('已冻结批次不可直接修改，请创建新的预测批次');
      if (batch.submissionState === '填报中' && !allowPublished) throw Error('已发布基准不可修改，请新建预测批次');
      mutator(batch);
      const allocationConfig = value => value.childForecastResults.map(row => ({ childId: row.childId, finalShare: row.finalShare, combo: (row.comboLines || []).map(line => ({ sku: line.sku, ratio: line.pmcRatio ?? line.defaultRatio })) }));
      if (JSON.stringify(allocationConfig(original)) !== JSON.stringify(allocationConfig(batch))) {
        batch.splitRuleSnapshot.version = nextVersion(original.splitRuleSnapshot.version);
        batch.splitVersions ||= [{ version: original.splitRuleSnapshot.version, allocations: allocationConfig(original) }];
        batch.splitVersions.push({ version: batch.splitRuleSnapshot.version, at: new Date().toISOString(), allocations: allocationConfig(batch) });
      }
      batch.updatedAt = new Date().toISOString();
      Object.assign(original, batch);
      state.revision += 1;
      save();
      return clone(batch);
    };
    const sourceRelation = (childId, batchDate) => {
      const row = rowsFromGroups(sourceGroups(services), batchDate, services).find(item => item.childId === childId || item.childASIN === childId);
      return row ? relationFromRow(row, batchDate) : null;
    };
    const moveRelation = (batch, childId, targetParent, reason) => {
      const row = batch.relationSnapshot.find(item => item.childId === childId || item.childASIN === childId);
      const child = batch.childForecastResults.find(item => item.childId === childId || item.childASIN === childId);
      if (!row || !child) throw Error('ASIN关系不存在');
      const before = row.parentASIN;
      if (before === targetParent) return 0;
      row.previousParentASIN ||= before;
      row.parentASIN = targetParent;
      row.relationState = 'PMC本批次确认';
      child.previousParentASIN ||= before;
      child.parentASIN = targetParent;
      child.relationState = 'PMC本批次确认';
      child.manualReason = null;
      batch.relationChanges.unshift({ id: `REL-CHANGE-${Date.now()}-${row.childASIN}`, childASIN: row.childASIN, from: before, to: targetParent, type: '父体变更', beforeShare: child.finalShare, afterShare: 0, reason, actor: 'PMC计划员', at: new Date().toISOString() });
      return 1;
    };
    const finalizeRelationMutation = (batch, reason) => {
      rebuildPools(batch, true);
      captureRelationVersion(batch, reason);
      batch.relationConfirmed = false;
      batch.splitConfirmed = false;
      batch.status = '关系确认中';
      batch.currentStep = 'relations';
      invalidateResult(batch, '关系待确认');
      batch.auditTimeline.push({ at: new Date().toISOString(), action: '调整本批次父子关系', actor: 'PMC计划员', reason });
    };
    const api = {
      key: STORAGE_KEY,
      getState,
      getCurrent: () => { const raw = getBatchRaw(); return raw ? clone(raw) : null; },
      getBatch: (batchId, options = {}) => { const raw = getBatchRaw(batchId); if (options.materialize) materializeResultSnapshot(raw); return raw ? clone(raw) : null; },
      getBatchMeta: batchId => {
        const raw = getBatchRaw(batchId);
        if (!raw) return null;
        return { id: raw.id, batchId: raw.id, batchVersion: raw.batchVersion, name: raw.name, batchDate: raw.batchDate, forecastStartDate: raw.forecastStartDate, forecastEndDate: raw.forecastEndDate, dataCutoffDate: raw.dataCutoffDate, dataUpdatedAt: raw.dataUpdatedAt, status: raw.status, calibrationStatus: raw.calibrationStatus, calibrationStartedAt: raw.calibrationStartedAt, calibrationCompletedAt: raw.calibrationCompletedAt, currentStep: raw.currentStep, submissionState: raw.submissionState, submissionWindow: clone(raw.submissionWindow), frozenAt: raw.frozenAt, frozenResultVersion: raw.frozenResultVersion, downstreamReady: raw.downstreamReady, resultState: raw.resultState, activeResultVersion: raw.activeResultVersion, relationVersion: raw.relationVersion, parameterVersion: raw.parameterSnapshot.version, forecastRuleVersion: raw.forecastRuleSnapshot.version, seasonRuleVersion: raw.seasonRuleVersion, seasonRuleMode: raw.seasonRuleMode, splitRuleVersion: raw.splitRuleSnapshot.version, childForecastResults: raw.childForecastResults.map(row => ({ childId: row.childId, childASIN: row.childASIN })) };
      },
      getCurrentMeta: () => {
        const raw = getBatchRaw();
        return raw ? api.getBatchMeta(raw.id) : null;
      },
      getWindow: batchId => { const raw = getBatchRaw(batchId); if (!raw) return null; return { ...clone(raw.submissionWindow), batchId: raw.id, batchVersion: raw.batchVersion, status: raw.status, submissionStartTime: raw.submissionWindow.submissionStartTime, submissionDeadlineTime: raw.submissionWindow.submissionDeadlineTime, submissionFreezeTime: raw.submissionWindow.submissionFreezeTime }; },
      getSnapshot: batchId => { const raw = getBatchRaw(batchId); materializeResultSnapshot(raw); return raw ? clone(raw) : null; },
      refresh: batchId => {
        const raw = getBatchRaw(batchId);
        if (!raw) throw Error('预测批次不存在');
        hydrateProductFields(raw, services);
        listeners.forEach(listener => listener(getState()));
        return clone(raw);
      },
      list: () => state.batches.slice().sort((a, b) => b.batchDate.localeCompare(a.batchDate)).map(clone),
      getWorkbenchDraft: (batchId, childId) => {
        const batch = getBatchRaw(batchId);
        if (!batch) return workbenchDraft();
        return workbenchDraft(batch.workbenchEntries?.[childId]);
      },
      startWorkbenchCalibration: batchId => write(batchId, batch => {
        if (calibrationComplete(batch)) return;
        if (batch.calibrationStatus !== '校准中') {
          batch.calibrationStatus = '校准中';
          batch.status = '校准中';
          batch.workflowState = 'PMC校准中';
          batch.calibrationStartedAt = new Date().toISOString();
          batch.auditTimeline.push({ at: batch.calibrationStartedAt, action: '开始PMC批次校准', actor: 'PMC计划员', reason: '从预测批次列表进入详情' });
        }
      }),
      saveWorkbenchDrafts: (batchId, entries) => write(batchId, batch => {
        if (calibrationComplete(batch)) throw Error('PMC校准已结束，当前批次仅支持查看');
        if (!Array.isArray(entries) || !entries.length) throw Error('没有可保存的PMC校准内容');
        batch.workbenchEntries ||= {};
        entries.forEach(entry => {
          const row = batch.childForecastResults.find(item => item.childId === entry.childId || item.childASIN === entry.childId);
          if (!row) throw Error('预测对象不存在');
          batch.workbenchEntries[row.childId] = workbenchDraft(entry.draft);
        });
        if (batch.calibrationStatus !== '校准中') {
          batch.calibrationStatus = '校准中';
          batch.status = '校准中';
          batch.workflowState = 'PMC校准中';
          batch.calibrationStartedAt ||= new Date().toISOString();
        }
      }),
      saveWorkbenchCalibration: (batchId, savedAt = new Date().toISOString()) => write(batchId, batch => {
        if (calibrationComplete(batch)) throw Error('销售填报已发起，当前批次不可继续保存PMC校准');
        batch.workbenchEntries ||= {};
        batch.calibrationStatus = '校准中';
        batch.status = '校准中';
        batch.workflowState = 'PMC校准中';
        batch.calibrationStartedAt ||= savedAt;
        batch.auditTimeline.push({ at: savedAt, action: '保存PMC批次校准草稿', actor: 'PMC计划员', reason: '仅保存当前校准内容，未发起销售填报' });
      }),
      completeWorkbenchCalibration: (batchId, completedAt) => write(batchId, batch => {
        if (calibrationComplete(batch)) return;
        finalizeWorkbenchCalibration(batch, completedAt || new Date().toISOString());
      }),
      createNextBatch: input => {
        const previous = getBatchRaw(input?.inheritFromBatchId) || getBatchRaw();
        const nextDate = input?.batchDate || shiftDate(previous.batchDate, 7);
        if (state.batches.some(batch => batch.batchDate === nextDate)) throw Error('该日期已有预测批次，请选择其他批次日期');
        const inherit = input?.inherit || { parameters: true, relations: true, split: true, combo: true, season: true, tags: true };
        const suffix = nextDate.replaceAll('-', '');
        const defaultRelations = rowsFromGroups(sourceGroups(services), nextDate, services).map(row => relationFromRow(row, nextDate));
        const inScope = row => (!input?.country || input.country === '全部' || row.country === input.country) && (!input?.platform || input.platform === '全部' || row.platform === input.platform);
        const relations = inherit.relations ? previous.relationSnapshot.filter(inScope).map(relation => {
          const current = defaultRelations.find(row => row.childId === relation.childId);
          return { ...clone(relation), childRef: current?.childRef, ...(inherit.combo ? {} : { businessObjectType: current?.businessObjectType, businessObjectCode: current?.businessObjectCode, businessObjectVersion: current?.businessObjectVersion, comboSnapshot: current?.comboSnapshot, comboVersionHistory: current?.comboVersionHistory }) };
        }) : defaultRelations.filter(inScope);
        if (!relations.length) throw Error('所选范围内没有可创建的ASIN关系');
        const pendingIsEffective = previous.pendingParameterSnapshot && previous.parameterEffectiveAt && Date.parse(previous.parameterEffectiveAt) <= Date.parse(`${nextDate}T00:00:00+08:00`);
        const inheritedParameters = pendingIsEffective ? previous.pendingParameterSnapshot : previous.parameterSnapshot;
        const parameters = inherit.parameters ? { ...clone(inheritedParameters), version: `PARAM-${suffix}-V01`, inheritedFrom: inheritedParameters.version } : defaultParams(`PARAM-${suffix}-V01`);
        if (!inherit.season) { parameters.seasonIndex = 1; parameters.listingFactor = 1; }
        const next = createBatch({
          id: `FB-${suffix}-01`, batchVersion: `V${suffix}-01`, name: input?.name || `${nextDate} 预测批次`, batchDate: nextDate,
          dataCutoffDate: input?.dataCutoffDate || shiftDate(nextDate, -1), forecastStartDate: input?.forecastStartDate, forecastEndDate: input?.forecastEndDate,
          status: '草稿', currentStep: 'assessment', previousBatchId: previous.id,
          relationVersion: `REL-${suffix}-V01`, forecastRuleVersion: `FORECAST-${suffix}-V01`, splitRuleVersion: `SPLIT-${suffix}-V01`, parameterVersion: `PARAM-${suffix}-V01`,
          parameterSnapshot: parameters,
          forecastRuleSnapshot: inherit.parameters ? { ...clone(previous.forecastRuleSnapshot), version: `FORECAST-${suffix}-V01` } : undefined,
          seasonRuleVersion: inherit.season ? previous.seasonRuleVersion : 'SEASON-V3',
          seasonRuleMode: inherit.season ? previous.seasonRuleMode : '常规季节指数',
          splitRuleSnapshot: inherit.split ? { ...clone(previous.splitRuleSnapshot), version: `SPLIT-${suffix}-V01` } : undefined,
          splitRuleTemplates: inherit.split ? clone(previous.splitRuleTemplates) : undefined,
          submissionWindow: input?.submissionWindow,
          scope: { country: input?.country || '全部', platform: input?.platform || '全部' },
          relations
        }, services, previous);
        if (inherit.tags) {
          next.childForecastResults.forEach(row => {
            const old = previous.childForecastResults.find(item => item.country === row.country && item.childASIN === row.childASIN);
            row.tagOverrides = clone(old?.tagOverrides || {});
          });
          next.parentTagOverrides = Object.fromEntries(next.parentForecastResults.map(parent => [parent.key, clone(previous.parentTagOverrides?.[parent.key] || {})]));
        }
        if (inherit.combo) next.childForecastResults.forEach(row => {
          const old = previous.childForecastResults.find(item => item.country === row.country && item.childASIN === row.childASIN);
          if (row.businessObjectType !== 'COMBO' || !old?.comboLines?.length) return;
          row.comboLines = (row.comboLines || []).map(line => ({ ...line, pmcRatio: old.comboLines.find(item => item.sku === line.sku)?.pmcRatio ?? null }));
          applyComboAllocation(row);
        });
        const priorByChild = new Map(previous.childForecastResults.map(row => [`${row.country}|${row.childASIN}`, row]));
        next.inheritanceSummary = { source: previous.name, changedCount: next.childForecastResults.filter(row => {
          const old = priorByChild.get(`${row.country}|${row.childASIN}`);
          return !old || old.parentASIN !== row.parentASIN || old.finalShare !== row.finalShare || sum(Object.values(old.dailyFinalForecast || {})) !== sum(Object.values(row.dailyFinalForecast || {}));
        }).length };
        next.auditTimeline[0].reason = `基准 ${previous.name}；继承：${Object.entries(inherit).filter(([, enabled]) => enabled).map(([key]) => key).join('、') || '无'}；等待PMC重新评估与确认`;
        state.batches.push(next); state.currentBatchId = next.id; state.revision += 1; save(); return clone(next);
      },
      confirmAssessment: batchId => write(batchId, batch => { batch.status = '参数调整中'; batch.workflowState = '评估已完成'; batch.currentStep = 'parameters'; batch.auditTimeline.push({ at: new Date().toISOString(), action: '完成预测评估', actor: 'PMC计划员', reason: '确认上一批次偏差与本批次关系异常，进入参数确认' }); }),
      saveDraft: batchId => write(batchId, batch => {
        batch.draftSavedAt = new Date().toISOString();
        batch.savedDraft = { calibration: clone(batch.calibrations || {}), relationVersion: batch.relationVersion, splitVersion: batch.splitRuleSnapshot.version, savedAt: batch.draftSavedAt };
        batch.auditTimeline.push({ at: batch.draftSavedAt, action: '保存批次调整', actor: 'PMC计划员', reason: '保存当前会话批次草稿，尚未发布销售填报' });
      }),
      calibrateBaseline: (batchId, level, key, adjustment, reason) => write(batchId, batch => {
        if (!['parent', 'child'].includes(level)) throw Error('校准层级无效');
        if (!String(reason || '').trim()) throw Error('请填写校准原因');
        const row = level === 'parent' ? batch.parentForecastResults.find(item => item.key === key) : batch.childForecastResults.find(item => item.childId === key);
        if (!row) throw Error('预测对象不存在');
        const daily = level === 'parent' ? row.daily : row.dailyRuleForecast;
        if (!Object.values(daily).some(value => typeof value === 'number' && Number.isFinite(value))) throw Error('待实际销量，无数值预测可校准');
        if (adjustment && (!['adu', 'ratio', 'daily'].includes(adjustment.mode) || adjustment.value == null || !Number.isFinite(Number(adjustment.value)) || adjustment.mode !== 'ratio' && Number(adjustment.value) < 0 || adjustment.mode === 'ratio' && Number(adjustment.value) < -100 || adjustment.mode === 'daily' && !Object.prototype.hasOwnProperty.call(daily, adjustment.date))) throw Error('请输入有效的ADU、比例或日级调整（比例不得低于-100%）');
        batch.calibrations ||= { parent: {}, child: {} };
        const before = clone(batch.calibrations[level][key] || null);
        const mean = data => { const numbers = Object.values(data || {}).filter(value => typeof value === 'number' && Number.isFinite(value)); return numbers.length ? Number((sum(numbers) / numbers.length).toFixed(2)) : null; };
        const beforeAdu = mean(level === 'parent' ? row.baselineDaily || row.daily : row.dailyFinalForecast);
        if (adjustment) batch.calibrations[level][key] = { mode: adjustment.mode, value: Number(adjustment.value), ...(adjustment.mode === 'daily' ? { date: adjustment.date } : {}), note: String(adjustment.note || '').trim(), reason: String(reason).trim() };
        else delete batch.calibrations[level][key];
        recalculateSplit(batch);
        invalidateResult(batch, 'PMC基准已校准');
        batch.adjustmentLog.unshift({ at: new Date().toISOString(), type: 'PMC基准', level, key, beforeAdu, afterAdu: mean(level === 'parent' ? row.baselineDaily : row.dailyFinalForecast), childASIN: row.childASIN, parentASIN: row.parentASIN, before, after: clone(batch.calibrations[level][key] || null), reason: String(reason).trim(), actor: 'PMC计划员' });
        batch.auditTimeline.push({ at: new Date().toISOString(), action: adjustment ? '校准PMC基准' : '撤销PMC基准校准', actor: 'PMC计划员', reason: `${row.childASIN || row.parentASIN} · ${reason}` });
      }),
      importDailyModelResults: (batchId, parentKey, daily, statuses, reason) => write(batchId, batch => {
        const parent = batch.parentForecastResults.find(row => row.key === parentKey);
        if (!parent) throw Error('父ASIN不存在');
        const dates = dateRange(batch.forecastStartDate, batch.forecastEndDate);
        if (!String(reason || '').trim() || dates.some(date => statuses?.[date] != null ? statuses[date] !== '人工启动（待实际销量）' || daily[date] != null : !(typeof daily[date] === 'number' && Number.isFinite(daily[date]) && daily[date] >= 0))) throw Error('上游结果必须为每个日期提供非负数值或人工启动状态，并记录来源');
        parent.daily = Object.fromEntries(dates.map(date => [date, statuses?.[date] ? null : Math.round(daily[date])]));
        parent.dailyForecastStatus = clone(statuses || {});
        parent.total = sum(Object.values(parent.daily));
        batch.seasonRuleReview = (batch.seasonRuleReview || []).filter(row => row.typeCode !== parent.typeCode);
        recalculateSplit(batch);
        invalidateResult(batch, '上游结果已刷新');
        batch.auditTimeline.push({ at: new Date().toISOString(), action: '读取上游日级预测结果', actor: '数据服务', reason });
      }),
      updateParameters: (batchId, changes, reason) => write(batchId, batch => {
        if (!String(reason || '').trim()) throw Error('请填写参数调整原因');
        const submittedAt = new Date().toISOString();
        const effectiveDate = shiftDate(shanghaiDate(submittedAt), 1);
        const before = clone(batch.pendingParameterSnapshot || batch.parameterSnapshot);
        const baseVersion = batch.pendingParameterSnapshot?.version || batch.parameterSnapshot.version;
        batch.pendingParameterSnapshot = { ...clone(batch.parameterSnapshot), ...clone(changes), version: nextVersion(baseVersion), pendingFrom: batch.parameterSnapshot.version };
        batch.parameterSubmittedAt = submittedAt;
        batch.parameterEffectiveAt = `${effectiveDate}T00:00:00+08:00`;
        batch.status = '参数已确认';
        batch.workflowState = '参数已提交待生效';
        batch.currentStep = 'relations';
        batch.adjustmentLog.unshift({ at: submittedAt, type: '预测参数', state: '待生效', effectiveAt: batch.parameterEffectiveAt, before, after: clone(batch.pendingParameterSnapshot), reason: String(reason).trim(), actor: 'PMC计划员' });
        batch.auditTimeline.push({ at: submittedAt, action: '提交预测参数', actor: 'PMC计划员', reason: `${String(reason).trim()} · 次日 00:00 生效，当前批次参数快照不变` });
      }),
      inheritPreviousRelations: batchId => write(batchId, batch => {
        const previous = getBatchRaw(batch.previousBatchId);
        if (!previous) throw Error('没有可沿用的上一关系版本');
        const relations = previous.relationSnapshot.map(item => ({ ...clone(item), previousParentASIN: item.parentASIN, effectiveFrom: batch.batchDate, childRef: sourceRelation(item.childId, batch.batchDate)?.childRef }));
        batch.relationSnapshot = relations.map(item => ({ ...item, childRef: undefined }));
        batch.childForecastResults = buildForecastRows(relations, batch.batchDate, batch.forecastStartDate, batch.forecastEndDate, services).map(item => ({ ...item, childRef: undefined }));
        batch.removedRelations = [];
        batch.relationChanges = [];
        rebuildPools(batch, true);
        captureRelationVersion(batch, '沿用上一版本有效关系');
        batch.relationConfirmed = true;
        batch.splitConfirmed = false;
        batch.status = '关系已确认';
        batch.workflowState = '关系已确认';
        batch.currentStep = 'split';
        invalidateResult(batch, '关系已确认');
        batch.auditTimeline.push({ at: new Date().toISOString(), action: '沿用上一关系版本', actor: 'PMC计划员', reason: `复制 ${relations.length} 条有效关系` });
      }),
      upsertRelations: (batchId, payload) => write(batchId, batch => {
        const reason = payload.reason || '新增父子关系';
        (payload.childIds || []).forEach(childId => {
          const existing = batch.relationSnapshot.find(item => item.childId === childId || item.childASIN === childId);
          if (existing) return moveRelation(batch, childId, payload.parentASIN, reason);
          const removed = (batch.removedRelations || []).find(item => item.childId === childId || item.childASIN === childId);
          const relation = removed || sourceRelation(childId, batch.batchDate);
          if (!relation) throw Error(`未找到ASIN ${childId}`);
          const nextRelation = { ...clone(relation), country: payload.country || relation.country, parentASIN: payload.parentASIN, previousParentASIN: removed?.parentASIN || null, relationState: '新增待确认', effectiveFrom: batch.batchDate, effectiveTo: null, childRef: undefined };
          batch.relationSnapshot.push(nextRelation);
          const source = sourceRelation(childId, batch.batchDate) || relation;
          const child = buildForecastRows([{ ...nextRelation, childRef: source.childRef }], batch.batchDate, batch.forecastStartDate, batch.forecastEndDate, services)[0];
          batch.childForecastResults.push({ ...child, childRef: undefined });
          batch.removedRelations = (batch.removedRelations || []).filter(item => item.childId !== childId);
          batch.relationChanges.unshift({ id: `REL-CHANGE-${Date.now()}-${nextRelation.childASIN}`, childASIN: nextRelation.childASIN, from: removed?.parentASIN || null, to: payload.parentASIN, type: removed ? '恢复关系' : '新增关系', reason, actor: 'PMC计划员', at: new Date().toISOString() });
        });
        finalizeRelationMutation(batch, reason);
      }),
      batchAdjustRelations: (batchId, childIds, targetParent, reason) => write(batchId, batch => {
        const changed = childIds.reduce((count, childId) => count + moveRelation(batch, childId, targetParent, reason), 0);
        if (!changed) throw Error('所选ASIN与目标父ASIN关系相同');
        finalizeRelationMutation(batch, reason);
      }),
      removeRelations: (batchId, childIds, reason) => write(batchId, batch => {
        const selected = batch.relationSnapshot.filter(item => childIds.includes(item.childId));
        if (!selected.length) throw Error('请选择需要移除的关系');
        batch.removedRelations ||= [];
        selected.forEach(row => {
          batch.removedRelations.unshift({ ...clone(row), relationState: '已移除', effectiveTo: batch.batchDate, removedReason: reason });
          batch.relationChanges.unshift({ id: `REL-CHANGE-${Date.now()}-${row.childASIN}`, childASIN: row.childASIN, from: row.parentASIN, to: null, type: '移除关系', reason, actor: 'PMC计划员', at: new Date().toISOString() });
        });
        batch.relationSnapshot = batch.relationSnapshot.filter(item => !childIds.includes(item.childId));
        batch.childForecastResults = batch.childForecastResults.filter(item => !childIds.includes(item.childId));
        finalizeRelationMutation(batch, reason);
      }),
      adjustRelation: (batchId, childId, targetParent, reason) => write(batchId, batch => { if (!moveRelation(batch, childId, targetParent, reason)) throw Error('新旧父ASIN不能相同'); finalizeRelationMutation(batch, reason); }),
      importReferenceSheets: (batchId, sheets, fileName, options = {}) => write(batchId, batch => {
        batch.sourceReferences ||= {};
        batch.sourceOverrides ||= { parent: {}, child: {}, season: {}, rules: {} };
        const importedAt = new Date().toISOString();
        const summary = { fileName, importedAt, applied: Boolean(options.apply), sheets: [] };
        for (const sheet of sheets) {
          if (!['parent', 'child', 'season', 'rules'].includes(sheet.type)) throw Error('无法识别导入表格类型');
          batch.sourceOverrides[sheet.type] ||= {};
          const currentRows = sheet.type === 'parent' ? batch.parentForecastResults : batch.childForecastResults;
          const currentKeys = new Set(currentRows.map(row => sourceRowKey(sheet.type, row)));
          let matchedRows = sheet.rows.filter(row => currentKeys.has(sourceRowKey(sheet.type, row)));
          let unmatchedRows = sheet.rows.filter(row => !currentKeys.has(sourceRowKey(sheet.type, row)));
          if (sheet.type === 'season') {
            const seasonKeys = new Set(batch.parentForecastResults.map(row => `${row.country}|${row.typeCode || row.productType}`).filter(Boolean));
            matchedRows = sheet.rows.filter(row => seasonKeys.has(sourceRowKey('season', row)));
            unmatchedRows = sheet.rows.filter(row => !seasonKeys.has(sourceRowKey('season', row)));
          }
          if (sheet.type === 'rules') {
            const ruleKeys = new Set(batch.childForecastResults.map(row => row.typeCode || row.productType).filter(Boolean));
            matchedRows = sheet.rows.filter(row => ruleKeys.has(sourceRowKey('rules', row)));
            unmatchedRows = sheet.rows.filter(row => !ruleKeys.has(sourceRowKey('rules', row)));
          }
          if (options.apply) {
            matchedRows.forEach(row => {
              if (sheet.type === 'parent' && String(row['历史数据截点'] || '').slice(0, 10) !== batch.dataCutoffDate) return;
              if (sheet.type === 'rules' || sheet.type === 'season' && Object.values(row).some(value => typeof value === 'string' && value.includes('人工启动'))) return;
              batch.sourceOverrides[sheet.type][sourceRowKey(sheet.type, row)] = clone(row);
            });
            if (sheet.type === 'child') {
              let relationChanged = false;
              matchedRows.forEach(source => {
                const current = batch.childForecastResults.find(item => sourceRowKey('child', item) === sourceRowKey('child', source));
                if (!current) return;
                const targetParent = source['父体ASIN'];
                if (targetParent && targetParent !== current.parentASIN) { moveRelation(batch, current.childId, targetParent, '附件导入覆盖父子关系'); relationChanged = true; }
                const importedShare = source['最终子体份额'];
                if (importedShare !== '' && importedShare != null && Number.isFinite(Number(importedShare))) {
                  const ratio = Number(importedShare) <= 1 ? Math.round(Number(importedShare) * 10000) : Math.round(Number(importedShare) * 100);
                  current.finalShare = normalizeRatio(ratio);
                  current.manualAdjustment = current.finalShare - current.systemShare;
                  current.manualReason = '附件导入覆盖';
                }
              });
              if (relationChanged) { rebuildPools(batch, false); captureRelationVersion(batch, '附件导入覆盖父子关系'); batch.relationConfirmed = false; batch.splitConfirmed = false; }
              recalculateSplit(batch);
            }
            if (sheet.type === 'parent') {
              matchedRows.forEach(source => {
                const parent = batch.parentForecastResults.find(item => sourceRowKey('parent', item) === sourceRowKey('parent', source));
                if (!parent) return;
                if (String(source['历史数据截点'] || '').slice(0, 10) !== batch.dataCutoffDate) return;
                const currentMonth = `${Number(String(batch.forecastStartDate).slice(5, 7))}月`;
                const value = Number(source['当前月季节指数'] || source[currentMonth]);
                if (!Number.isFinite(value) || value <= 0) return;
                parent.seasonBaseDaily ||= clone(parent.daily);
                parent.daily = Object.fromEntries(Object.entries(parent.seasonBaseDaily).map(([date, amount]) => [date, Math.max(0, Math.round(Number(amount || 0) * value))]));
                parent.total = sum(Object.values(parent.daily));
                parent.seasonIndexOverride = value;
                parent.seasonIndexReason = '附件导入覆盖';
              });
              recalculateSplit(batch);
            }
            if (sheet.type === 'season') {
              matchedRows.forEach(source => {
                batch.parentForecastResults.filter(parent => `${parent.country}|${parent.typeCode || parent.productType}` === sourceRowKey('season', source)).forEach(parent => {
                  parent.seasonBaseDaily ||= clone(parent.daily);
                  parent.dailyForecastStatus = {};
                  parent.seasonRuntime = { typeCode: source['类型编码'], version: batch.seasonRuleVersion };
                  parent.daily = Object.fromEntries(Object.entries(parent.seasonBaseDaily).map(([date, amount]) => {
                    const month = `${Number(date.slice(5, 7))}月`;
                    const raw = source[month];
                    if (typeof raw === 'string' && raw.includes('人工启动')) { parent.dailyForecastStatus[date] = '人工启动（待实际销量）'; return [date, null]; }
                    const value = Number(raw);
                    return [date, raw !== '' && raw != null && Number.isFinite(value) && value >= 0 ? Math.max(0, Math.round(Number(amount || 0) * value)) : Number(amount || 0)];
                  }));
                  parent.total = sum(Object.values(parent.daily));
                  const currentIndex = Number(source[`${Number(String(batch.forecastStartDate).slice(5, 7))}月`]);
                  parent.seasonIndexOverride = Number.isFinite(currentIndex) ? currentIndex : null;
                  parent.seasonIndexReason = '季节指数库导入覆盖';
                });
              });
              batch.seasonRuleReview = (batch.seasonRuleReview || []).filter(review => !matchedRows.some(source => source['类型编码'] === review.typeCode));
              recalculateSplit(batch);
            }
            if (sheet.type === 'rules') {
              const reviews = matchedRows.filter(row => (row['重启动月'] || row['未启动预测展示'] === '人工启动（待实际销量）') && !batch.parentForecastResults.some(parent => parent.typeCode === row['类型编码'] && Object.values(parent.dailyForecastStatus || {}).some(Boolean))).map(row => ({ typeCode: row['类型编码'], mode: row['季节运行模式'], reason: '人工启动和非销售季需专用日级计算规则；本原型不以普通数值预测替代' }));
              batch.seasonRuleReview = [...new Map([...(batch.seasonRuleReview || []), ...reviews].map(row => [row.typeCode, row])).values()];
            }
          }
          const specialSeasonRows = 0;
          const staleRows = sheet.type === 'parent' ? matchedRows.filter(row => String(row['历史数据截点'] || '').slice(0, 10) !== batch.dataCutoffDate).length : 0;
          const reviewRows = specialSeasonRows + (sheet.type === 'rules' ? matchedRows.length : 0);
          const appliedRows = options.apply ? matchedRows.length - staleRows - reviewRows : 0;
          batch.sourceReferences[sheet.type] = { fileName, sheetName: sheet.name, importedAt, rows: clone(sheet.rows), matchedRows: matchedRows.length, unmatchedRows: unmatchedRows.length, staleRows, reviewRows, appliedRows, unmatched: clone(unmatchedRows), applied: appliedRows > 0 };
          summary.sheets.push({ type: sheet.type, name: sheet.name, rows: sheet.rows.length, matched: matchedRows.length, unmatched: unmatchedRows.length, staleRows, reviewRows, appliedRows });
        }
        batch.importSummary = summary;
        batch.auditTimeline.push({ at: importedAt, action: options.apply ? '导入并覆盖本批次字段' : '保存预测参考快照', actor: 'PMC计划员', reason: `${fileName} · ${sheets.map(sheet => `${sheet.name} ${sheet.rows.length} 行`).join('、')} · ${summary.sheets.map(item => `${item.type}匹配${item.matched}/未匹配${item.unmatched}`).join('；')}` });
        if (options.apply) invalidateResult(batch, '附件字段覆盖');
      }),
      updateSourceFields: (batchId, type, key, fields, reason) => write(batchId, batch => {
        if (!['parent', 'child', 'season', 'rules'].includes(type)) throw Error('不支持的来源字段类型');
        if (!String(reason || '').trim()) throw Error('请填写字段覆盖原因');
        batch.sourceOverrides ||= { parent: {}, child: {}, season: {}, rules: {} };
        batch.sourceOverrides[type] ||= {};
        const before = clone(batch.sourceOverrides[type][key] || {});
        batch.sourceOverrides[type][key] = { ...before, ...clone(fields || {}) };
        invalidateResult(batch, '本批次来源字段覆盖');
        batch.adjustmentLog.unshift({ at: new Date().toISOString(), type: '来源字段覆盖', sourceType: type, sourceKey: key, before, after: clone(batch.sourceOverrides[type][key]), reason: String(reason).trim(), actor: 'PMC计划员' });
        batch.auditTimeline.push({ at: new Date().toISOString(), action: '编辑本批次来源字段', actor: 'PMC计划员', reason: `${type} · ${key} · ${String(reason).trim()}` });
      }),
      adjustParentSeasonIndex: (batchId, key, index, reason) => write(batchId, batch => {
        const parent = batch.parentForecastResults.find(item => item.key === key);
        const value = Number(index);
        if (!parent) throw Error('父ASIN预测池不存在');
        if (!Number.isFinite(value) || value < 0 || value > 5) throw Error('季节指数必须在0至5之间');
        if (!String(reason || '').trim()) throw Error('请填写季节指数调整原因');
        const before = parent.seasonIndexOverride ?? 1;
        const baseline = parent.seasonBaseDaily || parent.daily;
        parent.seasonBaseDaily ||= clone(parent.daily);
        parent.daily = Object.fromEntries(Object.entries(baseline).map(([date, amount]) => [date, Math.max(0, Math.round(Number(amount || 0) * value))]));
        parent.total = sum(Object.values(parent.daily));
        parent.seasonIndexOverride = value;
        parent.seasonIndexReason = String(reason).trim();
        recalculateSplit(batch);
        batch.splitConfirmed = false;
        invalidateResult(batch, '季节指数调整');
        batch.adjustmentLog.unshift({ at: new Date().toISOString(), type: '父ASIN季节指数', parentASIN: parent.parentASIN, before, after: value, reason, actor: 'PMC计划员' });
        batch.auditTimeline.push({ at: new Date().toISOString(), action: '调整父ASIN季节指数', actor: 'PMC计划员', reason: `${parent.parentASIN} ${before} → ${value} · ${reason}` });
      }),
      confirmRelations: batchId => write(batchId, batch => { if (batch.relationSnapshot.some(row => !row.parentASIN)) throw Error('仍有ASIN未关联父ASIN'); batch.relationConfirmed = true; batch.status = '关系已确认'; batch.workflowState = '关系已确认'; batch.currentStep = 'split'; batch.auditTimeline.push({ at: new Date().toISOString(), action: '确认本批次父子关系', actor: 'PMC计划员', reason: `${batch.relationSnapshot.length} 条关系已确认，按当前关系重新归集历史销量` }); }),
      saveSplitRule: (batchId, rule) => write(batchId, batch => { const next = { ...rule, id: rule.id || `SPLIT-TPL-${Date.now()}` }; const index = batch.splitRuleTemplates.findIndex(item => item.id === next.id); if (index >= 0) batch.splitRuleTemplates[index] = next; else batch.splitRuleTemplates.push(next); batch.splitRuleSnapshot.version = nextVersion(batch.splitRuleSnapshot.version); batch.splitConfirmed = false; batch.status = '拆解规则确认中'; batch.currentStep = 'split'; invalidateResult(batch, '拆解待确认'); batch.auditTimeline.push({ at: new Date().toISOString(), action: '更新子体拆解规则', actor: 'PMC计划员', reason: next.name }); }),
      adjustComboLines: (batchId, childId, adjustments, reason) => write(batchId, batch => {
        const row = batch.childForecastResults.find(item => item.childId === childId || item.childASIN === childId);
        if (!row || row.businessObjectType !== 'COMBO') throw Error('当前ASIN不是销售组合');
        const total = sum(Object.values(row.dailyFinalForecast || {}));
        const before = clone(row.comboLines || []);
        const next = (row.comboLines || []).map(line => {
          const adjustment = Math.round(Number(adjustments?.[line.sku]) || 0);
          return { ...line, pmcAdjustment: adjustment, finalForecast: line.systemSuggested + adjustment, adjustmentReason: adjustment ? reason : null, source: adjustment ? 'PMC人工调整' : '系统自动' };
        });
        if (next.some(line => line.pmcAdjustment) && !String(reason || '').trim()) throw Error('销售组合明细有人工作调整时必须填写调整原因');
        if (sum(next.map(line => Number(line.finalForecast) || 0)) !== total) throw Error(`销售组合拆解后必须等于ASIN预测 ${total} 件，请平衡人工调整`);
        row.comboLines = next;
        batch.splitConfirmed = false;
        batch.status = '拆解规则确认中';
        batch.workflowState = '拆解待确认';
        batch.currentStep = 'split';
        invalidateResult(batch, '拆解待确认');
        batch.adjustmentLog.unshift({ at: new Date().toISOString(), type: '销售组合明细', childASIN: row.childASIN, businessObjectCode: row.businessObjectCode, before, after: clone(next), reason, actor: 'PMC计划员' });
        batch.auditTimeline.push({ at: new Date().toISOString(), action: '调整销售组合明细预测', actor: 'PMC计划员', reason: `${row.businessObjectCode} · ${row.childASIN}` });
      }),
      adjustComboRatios: (batchId, childId, ratios, reason) => write(batchId, batch => {
        const row = batch.childForecastResults.find(item => item.childId === childId || item.childASIN === childId);
        if (!row || row.businessObjectType !== 'COMBO') throw Error('当前ASIN不是销售组合');
        if (!String(reason || '').trim()) throw Error('请填写组合比例调整原因');
        const values = row.comboLines.map(line => normalizeRatio(ratios?.[line.sku] ?? line.defaultRatio));
        if (sum(values) !== 10000) throw Error('组合SKU比例必须合计100%');
        const before = clone(row.comboLines);
        row.comboLines.forEach((line, index) => { line.pmcRatio = values[index]; line.adjustmentReason = reason; });
        applyComboAllocation(row);
        batch.splitConfirmed = false;
        batch.status = '拆解规则确认中';
        invalidateResult(batch, '组合拆解待确认');
        batch.adjustmentLog.unshift({ at: new Date().toISOString(), type: '销售组合比例', childASIN: row.childASIN, before, after: clone(row.comboLines), reason, actor: 'PMC计划员' });
        batch.auditTimeline.push({ at: new Date().toISOString(), action: '调整组合SKU比例', actor: 'PMC计划员', reason: `${row.businessObjectCode} · ${reason}` });
      }),
      adjustShares: (batchId, key, shares, reason) => write(batchId, batch => { const siblings = batch.childForecastResults.filter(row => relationKey(row) === key); if (!siblings.length) throw Error('父ASIN预测池不存在'); if (!String(reason || '').trim()) throw Error('请填写份额调整原因'); const total = sum(siblings.map(row => normalizeRatio(shares[row.childASIN] ?? shares[row.childId]))); if (total !== 10000) throw Error('当前父ASIN下ASIN最终份额必须合计100%'); const before = siblings.map(row => ({ childASIN: row.childASIN, finalShare: row.finalShare })); siblings.forEach(row => { row.finalShare = normalizeRatio(shares[row.childASIN] ?? shares[row.childId]); row.manualReason = row.finalShare !== row.systemShare ? reason : null; }); recalculateSplit(batch); batch.splitConfirmed = batch.relationConfirmed; batch.status = batch.relationConfirmed ? '拆解已确认' : '关系确认中'; batch.workflowState = batch.relationConfirmed ? '拆解已确认' : '关系待确认'; batch.currentStep = batch.relationConfirmed ? 'forecast' : 'relations'; invalidateResult(batch, batch.workflowState); batch.adjustmentLog.unshift({ at: new Date().toISOString(), type: 'ASIN份额', before, after: siblings.map(row => ({ childASIN: row.childASIN, finalShare: row.finalShare })), reason, actor: 'PMC计划员' }); batch.auditTimeline.push({ at: new Date().toISOString(), action: '完成ASIN人工调配', actor: 'PMC计划员', reason }); }),
      adjustChildForecast: (batchId, childId, targetValue, reason) => write(batchId, batch => {
        if (!String(reason || '').trim()) throw Error('请填写初始预测调整原因');
        const row = batch.childForecastResults.find(item => item.childId === childId || item.childASIN === childId);
        if (!row) throw Error('ASIN预测不存在');
        const siblings = batch.childForecastResults.filter(item => relationKey(item) === relationKey(row));
        const parent = batch.parentForecastResults.find(item => item.key === relationKey(row));
        const parentTotal = Number(parent?.total || 0);
        const target = Math.max(0, Math.round(Number(targetValue) || 0));
        if (!parentTotal || target > parentTotal) throw Error('调整数量不能超过父ASIN预测池');
        const targetShare = Math.round(target / parentTotal * 10000);
        const others = siblings.filter(item => item.childId !== row.childId);
        const remainder = 10000 - targetShare;
        const basis = others.map(item => Math.max(0, Number(item.systemShare) || 0));
        const basisTotal = sum(basis);
        const exact = others.map((item, index) => remainder * (basisTotal ? basis[index] / basisTotal : 1 / Math.max(1, others.length)));
        const allocated = exact.map(Math.floor);
        let leftover = remainder - sum(allocated);
        exact.map((value, index) => ({ index, fraction: value - allocated[index] })).sort((a, b) => b.fraction - a.fraction || a.index - b.index).forEach(part => { if (leftover > 0) { allocated[part.index] += 1; leftover -= 1; } });
        const before = siblings.map(item => ({ childASIN: item.childASIN, total: sum(Object.values(item.dailyFinalForecast || {})), finalShare: item.finalShare }));
        row.finalShare = targetShare;
        row.manualReason = targetShare === row.systemShare ? null : String(reason).trim();
        others.forEach((item, index) => { item.finalShare = allocated[index]; item.manualReason = item.finalShare === item.systemShare ? null : `因 ${row.childASIN} 初始预测调整而平衡：${String(reason).trim()}`; });
        recalculateSplit(batch);
        batch.splitConfirmed = batch.relationConfirmed;
        batch.status = batch.relationConfirmed ? '拆解已确认' : '关系确认中';
        batch.workflowState = batch.relationConfirmed ? '拆解已确认' : '关系待确认';
        batch.currentStep = batch.relationConfirmed ? 'forecast' : 'relations';
        invalidateResult(batch, '初始预测调整');
        const after = siblings.map(item => ({ childASIN: item.childASIN, total: sum(Object.values(item.dailyFinalForecast || {})), finalShare: item.finalShare }));
        batch.adjustmentLog.unshift({ at: new Date().toISOString(), type: 'ASIN初始预测', before, after, reason: String(reason).trim(), actor: 'PMC计划员' });
        batch.auditTimeline.push({ at: new Date().toISOString(), action: '调整ASIN初始预测', actor: 'PMC计划员', reason: `${row.childASIN} · ${target} 件` });
      }),
      adjustChildDailyForecast: (batchId, childId, date, targetValue, reason) => write(batchId, batch => {
        const row = batch.childForecastResults.find(item => item.childId === childId || item.childASIN === childId);
        if (!row) throw Error('ASIN预测不存在');
        const parent = batch.parentForecastResults.find(item => item.key === relationKey(row));
        if (!parent || !(date in (parent.daily || {}))) throw Error('当前日期不在本批次预测范围内');
        const parentDaily = Math.max(0, Math.round(Number(parent.daily[date]) || 0));
        const target = Math.max(0, Math.round(Number(targetValue) || 0));
        if (target > parentDaily) throw Error(`当日调整值不能超过父ASIN预测池 ${parentDaily} 件`);
        const siblings = batch.childForecastResults.filter(item => relationKey(item) === relationKey(row));
        const others = siblings.filter(item => item.childId !== row.childId);
        if (!others.length && target !== parentDaily) throw Error('唯一ASIN必须与父ASIN当日预测一致');
        const before = siblings.map(item => ({ childASIN: item.childASIN, value: Number(item.dailyFinalForecast?.[date] || 0) }));
        const weights = others.map(item => Math.max(0, Number(item.dailyRuleForecast?.[date] ?? item.dailyFinalForecast?.[date]) || 0));
        const allocated = allocateComboTotal(parentDaily - target, others.map((item, index) => ({ quantity: weights[index] || 1 })));
        row.dailyFinalForecast[date] = target;
        row.dailyReason ||= {};
        row.dailyReason[date] = String(reason || '列表行内调整').trim();
        others.forEach((item, index) => {
          item.dailyFinalForecast[date] = allocated[index];
          item.dailyReason ||= {};
          if (allocated[index] !== Number(item.dailyRuleForecast?.[date] || 0)) item.dailyReason[date] = `因 ${row.childASIN} 当日调整而自动平衡`;
          else delete item.dailyReason[date];
        });
        const totals = siblings.map(item => sum(Object.values(item.dailyFinalForecast || {})));
        const shares = allocateComboTotal(10000, siblings.map((item, index) => ({ quantity: totals[index] || 1 })));
        siblings.forEach((item, index) => {
          item.finalShare = shares[index];
          item.manualAdjustment = item.finalShare - item.systemShare;
          const hasDailyAdjustment = Object.keys(item.dailyFinalForecast || {}).some(key => Number(item.dailyFinalForecast[key] || 0) !== Number(item.dailyRuleForecast?.[key] || 0));
          item.manualReason = hasDailyAdjustment ? (item.childId === row.childId ? String(reason || '列表行内调整').trim() : `因 ${row.childASIN} 行内调整而平衡`) : null;
          applyComboAllocation(item);
        });
        batch.splitConfirmed = batch.relationConfirmed;
        batch.status = batch.relationConfirmed ? '拆解已确认' : '关系确认中';
        batch.workflowState = batch.relationConfirmed ? '拆解已确认' : '关系待确认';
        batch.currentStep = batch.relationConfirmed ? 'forecast' : 'relations';
        invalidateResult(batch, 'ASIN日预测行内调整');
        batch.adjustmentLog.unshift({ at: new Date().toISOString(), type: 'ASIN日预测', childASIN: row.childASIN, date, before, after: siblings.map(item => ({ childASIN: item.childASIN, value: Number(item.dailyFinalForecast?.[date] || 0) })), reason: String(reason || '列表行内调整').trim(), actor: 'PMC计划员' });
        batch.auditTimeline.push({ at: new Date().toISOString(), action: '行内调整ASIN日预测', actor: 'PMC计划员', reason: `${row.childASIN} · ${date} · ${target} 件` });
      }),
      updateChildTags: (batchId, childId, tags, reason) => write(batchId, batch => {
        if (!String(reason || '').trim()) throw Error('请填写标签调整原因');
        const row = batch.childForecastResults.find(item => item.childId === childId || item.childASIN === childId);
        if (!row) throw Error('ASIN关系不存在');
        const before = clone(row.tagOverrides || {});
        row.tagOverrides = clone(tags || {});
        invalidateResult(batch, '预测标签调整');
        batch.adjustmentLog.unshift({ at: new Date().toISOString(), type: '预测标签', childASIN: row.childASIN, before, after: clone(row.tagOverrides), reason: String(reason).trim(), actor: 'PMC计划员' });
        batch.auditTimeline.push({ at: new Date().toISOString(), action: '调整预测标签', actor: 'PMC计划员', reason: `${row.childASIN} · ${String(reason).trim()}` });
      }),
      updateParentTags: (batchId, key, tags, reason) => write(batchId, batch => {
        if (!String(reason || '').trim()) throw Error('请填写标签调整原因');
        const parent = batch.parentForecastResults.find(item => item.key === key);
        if (!parent) throw Error('父ASIN预测池不存在');
        batch.parentTagOverrides ||= {};
        const before = clone(batch.parentTagOverrides[key] || {});
        batch.parentTagOverrides[key] = clone(tags || {});
        invalidateResult(batch, '父ASIN标签调整');
        batch.adjustmentLog.unshift({ at: new Date().toISOString(), type: '预测标签', parentASIN: parent.parentASIN, before, after: clone(batch.parentTagOverrides[key]), reason: String(reason).trim(), actor: 'PMC计划员' });
        batch.auditTimeline.push({ at: new Date().toISOString(), action: '调整父ASIN预测标签', actor: 'PMC计划员', reason: `${parent.parentASIN} · ${String(reason).trim()}` });
      }),
      confirmSplit: batchId => write(batchId, batch => { if (!batch.relationConfirmed) throw Error('请先确认本批次父子关系'); const validation = resultValidation({ ...batch, splitConfirmed: true }); const blocking = validation.items.filter(item => !item.passed && item.label !== '本批次子体拆解已确认'); if (blocking.length) throw Error(`拆解校验未通过：${blocking[0].label}`); batch.splitConfirmed = true; batch.status = '拆解已确认'; batch.workflowState = '拆解已确认'; batch.currentStep = 'forecast'; invalidateResult(batch, '拆解已确认'); batch.auditTimeline.push({ at: new Date().toISOString(), action: '确认本批次子体拆解', actor: 'PMC计划员', reason: '全部父ASIN份额及预测量已平衡' }); }),
      validateForecast: batchId => { const batch = getBatchRaw(batchId); return batch ? clone(resultValidation(batch)) : null; },
      previewShares: (batchId, key, shares) => {
        const batch = clone(getBatchRaw(batchId));
        const siblings = batch.childForecastResults.filter(row => relationKey(row) === key);
        const dates = dateRange(batch.forecastStartDate, batch.forecastEndDate).slice(0, 90);
        const total = row => { const values = dates.map(date => row.dailyFinalForecast[date]).filter(value => typeof value === 'number'); return values.length ? sum(values) : null; };
        const before = siblings.map(row => total(row));
        siblings.forEach(row => { row.finalShare = normalizeRatio(shares[row.childASIN]); });
        if (sum(siblings.map(row => row.finalShare)) !== 10000) return null;
        recalculateSplit(batch);
        return siblings.map((row, index) => ({ childId: row.childId, childASIN: row.childASIN, before: before[index], after: total(row), delta: before[index] == null ? null : total(row) - before[index] }));
      },
      generateForecast: (batchId, reason = '生成本批次规则预测快照') => write(batchId, batch => { const validation = resultValidation(batch); if (!validation.passed) throw Error(`生成前校验未通过：${validation.items.find(item => !item.passed).label}`); recalculateSplit(batch); const prefix = `RESULT-${batch.batchDate.replaceAll('-', '')}-V`; const version = `${prefix}${String(batch.resultSnapshots.length + 1).padStart(2, '0')}`; const generatedAt = new Date().toISOString(); batch.resultSnapshots.push(makeResultSnapshot(batch, version, generatedAt)); batch.activeResultVersion = version; batch.resultState = '已生成'; batch.resultConfirmed = false; batch.status = '规则预测待确认'; batch.workflowState = '规则预测待确认'; batch.currentStep = 'forecast'; batch.auditTimeline.push({ at: generatedAt, action: '生成规则预测快照', actor: 'PMC计划员', reason: `${reason} · ${version}` }); }),
      confirmForecast: batchId => write(batchId, batch => { if (batch.resultState !== '已生成' || !batch.activeResultVersion) throw Error('请先生成规则预测'); if (!resultValidation(batch).passed) throw Error('发布检查未通过，请处理阻断项'); batch.resultConfirmed = true; batch.status = '规则预测已确认'; batch.workflowState = '规则预测已确认'; batch.currentStep = 'submission'; batch.auditTimeline.push({ at: new Date().toISOString(), action: 'PMC确认规则预测', actor: 'PMC计划员', reason: batch.activeResultVersion }); }),
      recalculate: (batchId, reason = '规则参数已确认，重新生成父ASIN/ASIN规则预测', options = {}) => {
        // Work on a clone and publish one version only after all gates succeed.
        return write(batchId, batch => {
          if (options.applyPendingParameters) {
            if (!batch.pendingParameterSnapshot) throw Error('没有待应用参数版本');
            batch.parameterSnapshot = clone(batch.pendingParameterSnapshot);
            batch.pendingParameterSnapshot = null;
            batch.parameterEffectiveAt = null;
          }
          if (options.clearCalibration) {
            const before = clone(batch.calibrations);
            batch.calibrations = { parent: {}, child: {} };
            batch.adjustmentLog.unshift({ at: new Date().toISOString(), type: 'PMC校准清除', before, after: clone(batch.calibrations), actor: 'PMC计划员', reason });
          }
          recalculateSplit(batch);
          const validation = resultValidation(batch);
          if (!validation.passed) throw Error('重算校验未通过：' + validation.items.find(item => !item.passed).label);
          const version = 'RESULT-' + batch.batchDate.replaceAll('-', '') + '-V' + String(batch.resultSnapshots.length + 1).padStart(2, '0');
          const at = new Date().toISOString();
          batch.resultSnapshots.push(makeResultSnapshot(batch, version, at));
          batch.activeResultVersion = version;
          batch.resultState = '已生成';
          batch.resultConfirmed = false;
          batch.status = '规则预测待确认';
          batch.workflowState = '规则预测待确认';
          batch.currentStep = 'forecast';
          batch.auditTimeline.push({ at, action: '重新计算预测', actor: 'PMC计划员', reason: reason + ' · ' + version + ' · ' + (options.clearCalibration ? '清除PMC校准' : '保留PMC校准') + ' · 参数 ' + batch.parameterSnapshot.version + ' · 关系 ' + batch.relationVersion });
        });
      },
      updateSubmissionWindow: (batchId, window, reason = '保存销售填报窗口配置') => write(batchId, batch => {
        if (batch.submissionState === '已冻结') throw Error('已冻结批次不可修改填报窗口');
        const next = { ...batch.submissionWindow, ...window };
        const start = Date.parse(next.submissionStartTime);
        const deadline = Date.parse(next.submissionDeadlineTime);
        const freeze = Date.parse(next.submissionFreezeTime);
        if (![start, deadline, freeze].every(Number.isFinite)) throw Error('填报窗口时间格式无效');
        if (start >= deadline) throw Error('填报开放时间必须早于截止时间');
        if (deadline > freeze) throw Error('填报截止时间不能晚于冻结时间');
        batch.submissionWindow = next;
        batch.auditTimeline.push({ at: new Date().toISOString(), action: '保存销售填报窗口', actor: 'PMC计划员', reason });
      }, true),
      publishWindow: (batchId, window, reason = '规则预测完成，发布销售填报窗口') => write(batchId, batch => { if (batch.resultState !== '已生成' || !batch.activeResultVersion) throw Error('请先完成规则预测生成'); if (!batch.resultConfirmed) throw Error('请先确认本批次规则预测'); const check = resultValidation(batch); if (!check.passed) throw Error('发布检查未通过：' + check.items.find(item => !item.passed).label); const next = { ...batch.submissionWindow, ...window, status: '填报中', autoFreeze: true }; if (Date.parse(next.submissionStartTime) >= Date.parse(next.submissionDeadlineTime)) throw Error('填报开放时间必须早于截止时间'); if (Date.parse(next.submissionDeadlineTime) > Date.parse(next.submissionFreezeTime)) throw Error('填报截止时间不能晚于冻结时间'); batch.submissionWindow = next; batch.submissionState = '填报中'; batch.calibrationStatus = '销售填报中'; batch.status = '销售填报中'; batch.workflowState = '填报进行中'; batch.currentStep = 'submission'; batch.auditTimeline.push({ at: new Date().toISOString(), action: '发布销售填报窗口', actor: 'PMC计划员', reason: `${reason} · ${batch.activeResultVersion}` }); }),
      launchSalesSubmission: (batchId, launchedAt = new Date().toISOString()) => write(batchId, batch => {
        if (!calibrationComplete(batch)) finalizeWorkbenchCalibration(batch, launchedAt);
        if (batch.calibrationStatus !== '待发起销售填报') throw Error('当前批次不可重复发起销售填报');
        const check = resultValidation(batch);
        if (!check.passed) throw Error('发布检查未通过：' + check.items.find(item => !item.passed).label);
        batch.submissionWindow = scheduleSubmissionWindow(launchedAt);
        batch.submissionState = '填报中';
        batch.calibrationStatus = '销售填报中';
        batch.status = '销售填报中';
        batch.workflowState = '填报进行中';
        batch.currentStep = 'submission';
        batch.auditTimeline.push({ at: launchedAt, action: '发起销售填报', actor: 'PMC计划员', reason: `系统按 ${BUSINESS_CALENDAR.version} 生成填报、截止与冻结时间 · ${batch.activeResultVersion}` });
      }),
      freeze: (batchId, reason = '到达本批次冻结时间', salesSnapshot = null, frozenAt = new Date().toISOString()) => write(batchId, batch => {
        if (batch.submissionState !== '填报中') throw Error('请先发布销售填报窗口并发起销售填报');
        const snapshot = salesSnapshot ? clone(salesSnapshot) : fallbackFrozenSnapshot(batch, frozenAt);
        batch.status = '已冻结';
        batch.calibrationStatus = '已冻结';
        batch.workflowState = '填报已冻结';
        batch.submissionState = '已冻结';
        batch.submissionWindow.status = '已冻结';
        batch.currentStep = 'review';
        batch.frozenAt = frozenAt;
        batch.frozenResultVersion = `FROZEN-${batch.batchDate.replaceAll('-', '')}-V${String((batch.freezeVersions?.length || 0) + 1).padStart(2, '0')}`;
        batch.frozenForecastSnapshot = { ...snapshot, batchId: batch.id, batchVersion: batch.batchVersion, frozenAt, frozenResultVersion: batch.frozenResultVersion };
        batch.freezeVersions ||= [];
        batch.freezeVersions.push(clone(batch.frozenForecastSnapshot));
        batch.downstreamReady = true;
        batch.auditTimeline.push({ at: frozenAt, action: '冻结销售预测', actor: '系统', reason: `${reason} · ${batch.frozenResultVersion} · 下游备货/采购计划可读取` });
      }, true),
      completeBatch: (batchId, confirmedCount) => {
        const batch = getBatchRaw(batchId);
        if (!batch || batch.status !== '已冻结') throw Error('请先冻结本批次销售填报');
        if (confirmedCount !== batch.childForecastResults.length) throw Error('仍有ASIN未完成PMC审核');
        batch.status = '已冻结';
        batch.calibrationStatus = '已冻结';
        batch.workflowState = '填报已冻结';
        batch.updatedAt = new Date().toISOString();
        batch.auditTimeline.push({ at: batch.updatedAt, action: '确认冻结结果', actor: 'PMC计划员', reason: `${confirmedCount} 个ASIN冻结结果已确认，下游继续读取同一快照` });
        state.revision += 1; save();
        return clone(batch);
      },
      subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
      contract: {
        getCurrent: () => api.getCurrent(),
        getCurrentMeta: () => api.getCurrentMeta(),
        getBatch: batchId => api.getBatch(batchId),
        getBatchMeta: batchId => api.getBatchMeta(batchId),
        listBatches: () => api.list(),
        getWorkbenchDraft: (batchId, childId) => api.getWorkbenchDraft(batchId, childId),
        startWorkbenchCalibration: batchId => api.startWorkbenchCalibration(batchId),
        saveWorkbenchDrafts: (batchId, entries) => api.saveWorkbenchDrafts(batchId, entries),
        saveWorkbenchCalibration: (batchId, savedAt) => api.saveWorkbenchCalibration(batchId, savedAt),
        completeWorkbenchCalibration: (batchId, completedAt) => api.completeWorkbenchCalibration(batchId, completedAt),
        launchSalesSubmission: (batchId, launchedAt) => api.launchSalesSubmission(batchId, launchedAt),
        freeze: (batchId, reason, salesSnapshot, frozenAt) => api.freeze(batchId, reason, salesSnapshot, frozenAt),
        scheduleSubmissionWindow: launchedAt => clone(scheduleSubmissionWindow(launchedAt)),
        isBusinessDay,
        getWindow: batchId => api.getWindow(batchId),
        getDailyForecast: (batchId, childId, date) => {
          // Contract reads are frequent during table rendering. Keep the batch snapshot
          // immutable to callers without cloning the entire 182-day batch per cell.
          const raw = getBatchRaw(batchId);
          if (!raw) return null;
          const result = getActiveResult(raw);
          const deferred = Boolean(raw.resultSnapshotDeferred && raw.activeResultVersion);
          const row = result
            ? result.rows.find(item => item.childId === childId || item.childASIN === childId || [item.country, item.store, item.childASIN].join('|') === childId)
            : deferred
              ? raw.childForecastResults.find(item => item.childId === childId || item.childASIN === childId || [item.country, item.store, item.childASIN].join('|') === childId)
              : null;
          if (!row) return null;
          const batch = raw;
          const parent = (result?.parents || batch.parentForecastResults).find(item => item.key === relationKey(row));
          const daily = result ? row.daily : row.dailyFinalForecast;
          const ruleDaily = result ? row.ruleDaily : row.dailyRuleForecast;
          const ruleForecast = daily?.[date] ?? null;
          const salesRuleForecast = calibrationComplete(batch) ? ruleForecast : ruleDaily?.[date] ?? null;
          return { batchId: batch.id, batchVersion: batch.batchVersion, resultVersion: result?.version || batch.activeResultVersion, dataCutoffDate: batch.dataCutoffDate, forecastStartDate: batch.forecastStartDate, forecastEndDate: batch.forecastEndDate, submissionStartTime: batch.submissionWindow.submissionStartTime, submissionDeadlineTime: batch.submissionWindow.submissionDeadlineTime, submissionFreezeTime: batch.submissionWindow.submissionFreezeTime, status: batch.status, calibrationStatus: batch.calibrationStatus, parentASIN: row.parentASIN, childASIN: row.childASIN, country: row.country, site: row.country, store: row.store, salesOwner: row.salesOwner, tags: [...(row.tags || [])], businessObjectType: row.businessObjectType, businessObjectCode: row.businessObjectCode, businessObjectVersion: row.businessObjectVersion, salesComboMeta: row.salesComboMeta ? clone(row.salesComboMeta) : null, comboSnapshot: row.comboSnapshot ? clone(row.comboSnapshot) : null, forecastDate: date, parentRuleForecast: parent?.daily?.[date] ?? null, systemSplitForecast: ruleDaily?.[date] ?? null, ai: ruleDaily?.[date] ?? null, systemForecast: ruleDaily?.[date] ?? null, salesRuleForecast, pmcBaseline: ruleForecast, forecastStatus: row.dailyForecastStatus?.[date] || null, pmcCalibration: row.pmcCalibration ? clone(row.pmcCalibration) : null, manual: null, activity: null, final: ruleForecast, ruleForecast, forecastSource: '规则预测', forecastRuleVersion: result?.forecastRuleVersion || batch.forecastRuleSnapshot.version, seasonRuleVersion: result?.seasonRuleVersion || batch.seasonRuleVersion, splitRuleVersion: result?.splitRuleVersion || batch.splitRuleSnapshot.version, relationVersion: result?.relationVersion || batch.relationVersion, parameterVersion: result?.parameterVersion || batch.parameterSnapshot.version, reason: row.manualAdjustment ? 'PMC已完成本批次ASIN份额调配' : row.dailyReason?.[date] || '沿用本批次拆解规则' };
        },
        getForecastIndex: batchId => {
          const batch = getBatchRaw(batchId);
          materializeResultSnapshot(batch);
          if (!batch) return null;
          const result = getActiveResult(batch);
          if (!result) return null;
          const children = {};
          result.rows.forEach(row => {
            const key = rowKey(row);
            const daily = { ...row.daily };
            const ruleDaily = { ...row.ruleDaily };
            children[key] = {
              childId: row.childId,
              childASIN: row.childASIN,
              salesComboMeta: row.salesComboMeta ? clone(row.salesComboMeta) : null,
              parentASIN: row.parentASIN,
              country: row.country,
              store: row.store,
              systemShare: row.systemShare,
              finalShare: row.finalShare,
              manualAdjustment: row.manualAdjustment,
              dailyForecastStatus: { ...(row.dailyForecastStatus || {}) },
              pmcCalibration: clone(row.pmcCalibration || null),
              ruleTotal: sum(Object.values(ruleDaily)),
              total: sum(Object.values(daily)),
              ruleDaily,
              daily
            };
          });
          const parents = {};
          result.parents.forEach(parent => {
            parents[parent.key] = { parentASIN: parent.parentASIN, country: parent.country, store: parent.store, total: parent.total, daily: { ...parent.daily } };
          });
          return { batchId: batch.id, batchVersion: batch.batchVersion, resultVersion: result.version, relationVersion: result.relationVersion, splitRuleVersion: result.splitRuleVersion, forecastRuleVersion: result.forecastRuleVersion, seasonRuleVersion: result.seasonRuleVersion || batch.seasonRuleVersion, parameterVersion: result.parameterVersion, forecastStartDate: batch.forecastStartDate, forecastEndDate: batch.forecastEndDate, children, parents };
        },
        getSubmissionRows: batchId => {
          materializeResultSnapshot(getBatchRaw(batchId));
          const batch = api.getBatch(batchId); if (!batch) return [];
          const result = getActiveResult(getBatchRaw(batchId)); if (!result) return [];
          return result.rows.flatMap(row => {
            const parent = result.parents.find(item => item.key === relationKey(row));
            return dateRange(batch.forecastStartDate, batch.forecastEndDate).map(date => ({ batchId: batch.id, batchVersion: batch.batchVersion, resultVersion: result.version, dataCutoffDate: batch.dataCutoffDate, forecastStartDate: batch.forecastStartDate, forecastEndDate: batch.forecastEndDate, submissionStartTime: batch.submissionWindow.submissionStartTime, submissionDeadlineTime: batch.submissionWindow.submissionDeadlineTime, submissionFreezeTime: batch.submissionWindow.submissionFreezeTime, status: batch.status, calibrationStatus: batch.calibrationStatus, parentASIN: row.parentASIN, childASIN: row.childASIN, childId: row.childId, country: row.country, site: row.country, store: row.store, salesOwner: row.salesOwner, tags: row.tags, businessObjectType: row.businessObjectType, businessObjectCode: row.businessObjectCode, businessObjectVersion: row.businessObjectVersion, salesComboMeta: row.salesComboMeta ? clone(row.salesComboMeta) : null, comboSnapshot: row.comboSnapshot ? clone(row.comboSnapshot) : null, forecastDate: date, parentRuleForecast: parent?.daily?.[date] ?? null, systemSplitForecast: row.ruleDaily[date] ?? null, systemForecast: row.ruleDaily[date] ?? null, salesRuleForecast: calibrationComplete(batch) ? row.daily[date] ?? null : row.ruleDaily[date] ?? null, pmcBaseline: row.daily[date] ?? null, forecastStatus: row.dailyForecastStatus?.[date] || null, ruleForecast: row.daily[date] ?? null, forecastSource: '规则预测', forecastRuleVersion: result.forecastRuleVersion, seasonRuleVersion: result.seasonRuleVersion || batch.seasonRuleVersion, splitRuleVersion: result.splitRuleVersion, relationVersion: result.relationVersion, parameterVersion: result.parameterVersion }));
          });
        },
        getDownstreamSnapshot: batchId => {
          const batch = getBatchRaw(batchId);
          if (!batch || batch.status !== '已冻结' || !batch.downstreamReady) return null;
          return clone(batch.frozenForecastSnapshot || fallbackFrozenSnapshot(batch, batch.frozenAt || batch.updatedAt));
        },
        getSnapshot: batchId => api.getSnapshot(batchId),
        subscribe: listener => api.subscribe(listener)
      }
    };
    return api;
  }
  return { STORAGE_KEY, BUSINESS_CALENDAR, clone, dateRange, isBusinessDay, scheduleSubmissionWindow, createStore, seed };
});
