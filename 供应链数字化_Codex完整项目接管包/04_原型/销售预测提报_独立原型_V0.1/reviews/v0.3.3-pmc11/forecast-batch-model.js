/* ForecastBatch: batch-owned forecast snapshot and sales-facing contract. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ForecastBatchModel = api;
})(typeof window === 'undefined' ? globalThis : window, function (root) {
  'use strict';

  const STORAGE_KEY = 'pmc-forecast-batch-v4';
  const clone = value => JSON.parse(JSON.stringify(value));
  const sum = values => values.reduce((total, value) => total + (Number(value) || 0), 0);
  const isoDate = value => String(value).slice(0, 10);
  const shiftDate = (value, amount) => {
    const date = new Date(`${isoDate(value)}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
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
    { version, effectiveFrom: '2026-10-01', effectiveTo: '2026-10-31', lines: clone(lines) },
    { version: 'V2', effectiveFrom: '2026-11-01', effectiveTo: null, lines: [{ sku: 'SKU-A', quantity: 1 }, { sku: 'SKU-C', quantity: 2 }] }
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
    const demoCombo = row.country === 'US' && row.childASIN === 'B0GRG6H2KL';
    if (demoCombo) {
      const lines = [{ sku: 'SKU-A', quantity: 1 }, { sku: 'SKU-B', quantity: 2 }];
      return {
        type: 'COMBO',
        code: 'COMB-001',
        version: 'V1',
        snapshot: { code: 'COMB-001', version: 'V1', effectiveFrom: '2026-10-01', effectiveTo: '2026-10-31', lines: clone(lines) },
        history: comboHistory('COMB-001', 'V1', lines)
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
    status: '填报中'
  });
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
    name: '标准子ASIN份额拆解',
    scope: 'US / UK · Amazon · 普通父ASIN',
    priority: 10,
    historyWindow: 84,
    recentWindow: 14,
    historyWeight: 70,
    recentWeight: 30,
    abnormalCondition: '14天 Clean ADU < 2 且 14天有销量天数 ≤ 10天',
    normalization: true,
    manualAllowed: true,
    effectiveTime: (id.match(/(\d{4})(\d{2})(\d{2})/) || []).slice(1).join('-') || '2026-10-21'
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
    row.comboLines = row.comboSnapshot.lines.map((line, index) => {
      const old = previous[line.sku];
      const adjustment = Number(old?.pmcAdjustment) || 0;
      return {
        id: `${row.businessObjectCode}-${line.sku}`,
        sku: line.sku,
        quantity: Number(line.quantity) || 0,
        defaultRatio: quantityRatio(line.quantity, row.comboSnapshot.lines),
        systemSuggested: suggestions[index],
        pmcAdjustment: adjustment,
        finalForecast: suggestions[index] + adjustment,
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
      if (value) return clone(value);
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
    const rows = relations.map(relation => {
      const legacy = Object.fromEntries(dates.map(date => [date, legacyForecast(relation, batch, date, services)]));
      const historyDays = dateRange(shiftDate(batch, -83), batch);
      const recentDays = dateRange(shiftDate(batch, -13), batch);
      const historyTotal = sum(historyDays.map(date => Number(legacyForecast(relation, batch, date, services)?.ai) || 0));
      const siblingHistoryTotal = sum((groups[relationKey(relation)] || []).map(sibling => {
        return sum(historyDays.map(date => Number(legacyForecast(sibling, batch, date, services)?.ai) || 0));
      }));
      const lowSalesDemo = (relation.tags || []).includes('低销');
      const recentTotal = lowSalesDemo ? 22 : sum(recentDays.map(date => Number(legacyForecast(relation, batch, date, services)?.ai) || 0));
      const siblingRecentTotal = sum((groups[relationKey(relation)] || []).map(sibling => {
        if ((sibling.tags || []).includes('低销')) return 22;
        return sum(recentDays.map(date => Number(legacyForecast(sibling, batch, date, services)?.ai) || 0));
      }));
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
      daily: Object.fromEntries(dates.map(date => [date, sum(siblings.map(row => row.dailyBaselineForecast?.[date] ?? row.dailyRuleForecast[date] ?? 0))])),
      total: sum(dates.map(date => sum(siblings.map(row => row.dailyBaselineForecast?.[date] ?? row.dailyRuleForecast[date] ?? 0))))
    }));
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
    const imbalance = Object.entries(grouped).filter(([key, rows]) => {
      const parent = batch.parentForecastResults.find(item => item.key === key);
      return !parent || sum(rows.map(row => sum(Object.values(row.dailyFinalForecast)))) !== parent.total;
    }).length;
    const items = [
      ['父子关系完整', unparentedChildren],
      ['一个子ASIN多个父ASIN', duplicateChildren],
      ['无父ASIN子体', unparentedChildren],
      ['父ASIN预测缺失', parentMissing],
      ['子体份额合计异常', shareAnomalies],
      ['人工调整未填写原因', adjustmentReasonMissing],
      ['销售组合拆解未平衡', comboImbalance],
      ['组合人工调整未填写原因', comboAdjustmentReasonMissing],
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
      parameterVersion: batch.parameterSnapshot.version,
      parentCount: batch.parentForecastResults.length,
      childCount: batch.childForecastResults.length,
      parentTotal: sum(batch.parentForecastResults.map(row => row.total)),
      childTotal: sum(batch.childForecastResults.map(row => sum(Object.values(row.dailyFinalForecast)))),
      parents: batch.parentForecastResults.map(row => ({ key: row.key, country: row.country, store: row.store, parentASIN: row.parentASIN, total: row.total, daily: clone(row.daily) })),
      rows: batch.childForecastResults.map(row => ({
        childId: row.childId,
        country: row.country,
        store: row.store,
        platform: row.platform,
        parentASIN: row.parentASIN,
        childASIN: row.childASIN,
        salesOwner: row.salesOwner,
        tags: clone(row.tags || []),
        systemShare: row.systemShare,
        manualAdjustment: row.manualAdjustment,
        manualReason: row.manualReason,
        finalShare: row.finalShare,
        businessObjectType: row.businessObjectType,
        businessObjectCode: row.businessObjectCode,
        businessObjectVersion: row.businessObjectVersion,
        comboSnapshot: row.comboSnapshot ? clone(row.comboSnapshot) : null,
        comboVersionHistory: clone(row.comboVersionHistory || []),
        comboLines: clone(row.comboLines || []),
        total: sum(Object.values(row.dailyFinalForecast)),
        daily: clone(row.dailyFinalForecast),
        ruleDaily: clone(row.dailyRuleForecast),
        dailyReason: clone(row.dailyReason || {})
      }))
    };
  }
  function invalidateResult(batch, workflowState) {
    batch.resultState = batch.resultSnapshots.length ? '需重新生成' : '待生成';
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
      currentStep: input.currentStep || 'assessment',
      createdBy: 'PMC计划员',
      createdAt: `${batchDate}T09:00:00+08:00`,
      updatedAt: `${batchDate}T09:00:00+08:00`,
      parameterSnapshot: input.parameterSnapshot || defaultParams(input.parameterVersion || `PARAM-${batchDate.replaceAll('-', '')}-V01`),
      forecastRuleSnapshot: input.forecastRuleSnapshot || defaultForecastRule(input.forecastRuleVersion || `FORECAST-${batchDate.replaceAll('-', '')}-V01`),
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
      activeResultVersion: input.resultVersion || null,
      resultSnapshots: [],
      workflowState: input.workflowState || '草稿',
      submissionWindow: input.submissionWindow || defaultWindow(batchDate),
      submissionState: input.submissionState || '待发布',
      actualSales: input.actualSales || actualSnapshot(rows, batchDate, services),
      forecastVsActual: [],
      adjustmentLog: input.adjustmentLog || [],
      auditTimeline: input.auditTimeline || [{ at: `${batchDate}T09:00:00+08:00`, action: '创建预测批次', actor: 'PMC计划员', reason: '继承上一批次预测与实际表现' }]
    };
    rebuildPools(batch, true);
    batch.relationVersions = input.relationVersions || [{ version: batch.relationVersion, at: batch.createdAt, reason: '创建本批次关系快照', relations: clone(batch.relationSnapshot), removedRelations: [] }];
    if (input.resultGenerated) batch.resultSnapshots.push(makeResultSnapshot(batch, input.resultVersion || `RESULT-${batchDate.replaceAll('-', '')}-V01`, input.resultGeneratedAt || batch.updatedAt));
    const comparison = buildForecastComparison(batch, previous);
    batch.assessment = assessment(batch, previous, comparison);
    batch.forecastVsActual = comparison.rows;
    return batch;
  }
  function seed(services = {}) {
    const previousDate = '2026-10-07';
    const currentDate = '2026-10-21';
    const previousRelations = rowsFromGroups(sourceGroups(services), previousDate, services).map(row => relationFromRow(row, previousDate));
    const supportsDemoMove = previousRelations.some(row => row.parentASIN === 'B0GRGFFVVN' && row.childASIN === 'B0GRG7J9MN') && previousRelations.some(row => row.parentASIN === 'B0H4QG3TLS');
    const currentRelations = rowsFromGroups(sourceGroups(services), currentDate, services).map(row => ({
      ...relationFromRow(row, currentDate),
      ...(supportsDemoMove && row.childASIN === 'B0GRG7J9MN' ? { parentASIN: 'B0H4QG3TLS', relationState: 'PMC本批次确认' } : {})
    }));
    const currentRelationChanges = supportsDemoMove ? [{ id: 'REL-CHANGE-001', childASIN: 'B0GRG7J9MN', from: 'B0GRGFFVVN', to: 'B0H4QG3TLS', type: '父体变更', beforeShare: 3500, afterShare: 2700, reason: '父体Listing结构调整', actor: 'PMC计划员', at: '2026-10-21T10:30:00+08:00' }] : [];
    const previous = createBatch({
      id: 'FB-20261007-01', batchVersion: 'V20261007-01', name: '2026-10-07 第1批预测', batchDate: previousDate,
      dataCutoffDate: '2026-10-06', status: '已完成', currentStep: 'review', submissionState: '已冻结', workflowState: '已完成', relationConfirmed: true, splitConfirmed: true, resultGenerated: true, resultVersion: 'RESULT-20261007-V01',
      relationVersion: 'REL-20261007-V01', splitRuleVersion: 'SPLIT-20261007-V01', parameterVersion: 'PARAM-20261007-V01',
      relations: previousRelations
    }, services);
    const current = createBatch({
      id: 'FB-20261021-01', batchVersion: 'V20261021-01', name: '2026-10-21 第1批预测', batchDate: currentDate,
      dataCutoffDate: '2026-10-20', status: '评估中', currentStep: 'assessment', submissionState: '待发布', previousBatchId: previous.id, workflowState: '评估中', relationConfirmed: false, splitConfirmed: false, resultGenerated: false,
      relationVersion: 'REL-20261021-V02', forecastRuleVersion: 'FORECAST-20261021-V01', splitRuleVersion: 'SPLIT-20261021-V01', parameterVersion: 'PARAM-20261021-V01',
      relations: currentRelations,
      relationChanges: currentRelationChanges,
      auditTimeline: [
        { at: '2026-10-21T09:00:00+08:00', action: '创建预测批次', actor: 'PMC计划员', reason: '读取上一批次预测、实际与关系快照' },
        { at: '2026-10-21T09:05:00+08:00', action: '识别评估异常', actor: '系统', reason: supportsDemoMove ? '检测到父子关系变化，等待PMC评估确认' : '检测上一批次预测与实际偏差' }
      ]
    }, services, previous);
    current.relationSnapshot = current.relationSnapshot.map(relation => ({ ...relation, previousParentASIN: previous.relationSnapshot.find(old => old.childASIN === relation.childASIN && old.country === relation.country)?.parentASIN || relation.parentASIN }));
    if (current.relationChanges[0]) current.relationChanges[0].previousBatchId = previous.id;
    if (supportsDemoMove) current.relationVersions = [
      { version: 'REL-20261021-V01', at: '2026-10-21T09:00:00+08:00', reason: '继承上一批次有效关系', relations: clone(previous.relationSnapshot), removedRelations: [] },
      { version: current.relationVersion, at: '2026-10-21T10:30:00+08:00', reason: '确认父体变更', relations: clone(current.relationSnapshot), removedRelations: [] }
    ];
    return { schema: 4, revision: 1, currentBatchId: current.id, batches: [previous, current] };
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
    const listeners = new Set();
    const save = () => { try { storage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { /* demo continues in memory */ } listeners.forEach(listener => listener(getState())); if (root.dispatchEvent && typeof Event !== 'undefined') root.dispatchEvent(new Event('forecast-batch-change')); };
    const getBatchRaw = batchId => { const value = batchId || state.currentBatchId; return state.batches.find(batch => batch.id === value || batch.batchDate === value || batch.batchVersion === value); };
    const getActiveResult = batch => batch?.resultSnapshots?.find(snapshot => snapshot.version === batch.activeResultVersion) || null;
    const getState = () => ({ revision: state.revision, currentBatchId: state.currentBatchId });
    const write = (batchId, mutator) => {
      const batch = getBatchRaw(batchId);
      if (!batch) throw Error('预测批次不存在');
      if (batch.status === '已冻结' || batch.status === '已完成') throw Error('已冻结批次不可直接修改，请创建新的预测批次');
      mutator(batch);
      batch.updatedAt = new Date().toISOString();
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
      if (!row || !child) throw Error('子ASIN关系不存在');
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
      getBatch: batchId => { const raw = getBatchRaw(batchId); return raw ? clone(raw) : null; },
      getWindow: batchId => { const batch = api.getBatch(batchId); if (!batch) return null; return { ...clone(batch.submissionWindow), batchId: batch.id, batchVersion: batch.batchVersion, status: batch.status, submissionStartTime: batch.submissionWindow.submissionStartTime, submissionDeadlineTime: batch.submissionWindow.submissionDeadlineTime, submissionFreezeTime: batch.submissionWindow.submissionFreezeTime }; },
      getSnapshot: batchId => api.getBatch(batchId),
      list: () => state.batches.slice().sort((a, b) => b.batchDate.localeCompare(a.batchDate)).map(clone),
      createNextBatch: input => {
        const previous = getBatchRaw(input?.inheritFromBatchId) || getBatchRaw();
        const nextDate = input?.batchDate || shiftDate(previous.batchDate, 7);
        if (state.batches.some(batch => batch.batchDate === nextDate)) throw Error('该日期已有预测批次，请选择其他批次日期');
        const inherit = input?.inherit || { parameters: true, relations: true, split: true, combo: true, season: true };
        const suffix = nextDate.replaceAll('-', '');
        const defaultRelations = rowsFromGroups(sourceGroups(services), nextDate, services).map(row => relationFromRow(row, nextDate));
        const inScope = row => (!input?.country || input.country === '全部' || row.country === input.country) && (!input?.platform || input.platform === '全部' || row.platform === input.platform);
        const relations = inherit.relations ? previous.relationSnapshot.filter(inScope).map(relation => {
          const current = defaultRelations.find(row => row.childId === relation.childId);
          return { ...clone(relation), childRef: current?.childRef, ...(inherit.combo ? {} : { businessObjectType: current?.businessObjectType, businessObjectCode: current?.businessObjectCode, businessObjectVersion: current?.businessObjectVersion, comboSnapshot: current?.comboSnapshot, comboVersionHistory: current?.comboVersionHistory }) };
        }) : defaultRelations.filter(inScope);
        if (!relations.length) throw Error('所选范围内没有可创建的子ASIN关系');
        const parameters = inherit.parameters ? { ...clone(previous.parameterSnapshot), version: `PARAM-${suffix}-V01`, inheritedFrom: previous.parameterSnapshot.version } : defaultParams(`PARAM-${suffix}-V01`);
        if (!inherit.season) { parameters.seasonIndex = 1; parameters.listingFactor = 1; }
        const next = createBatch({
          id: `FB-${suffix}-01`, batchVersion: `V${suffix}-01`, name: input?.name || `${nextDate} 预测批次`, batchDate: nextDate,
          dataCutoffDate: input?.dataCutoffDate || shiftDate(nextDate, -1), forecastStartDate: input?.forecastStartDate, forecastEndDate: input?.forecastEndDate,
          status: '草稿', currentStep: 'assessment', previousBatchId: previous.id,
          relationVersion: `REL-${suffix}-V01`, forecastRuleVersion: `FORECAST-${suffix}-V01`, splitRuleVersion: `SPLIT-${suffix}-V01`, parameterVersion: `PARAM-${suffix}-V01`,
          parameterSnapshot: parameters,
          forecastRuleSnapshot: inherit.parameters ? { ...clone(previous.forecastRuleSnapshot), version: `FORECAST-${suffix}-V01` } : undefined,
          splitRuleSnapshot: inherit.split ? { ...clone(previous.splitRuleSnapshot), version: `SPLIT-${suffix}-V01` } : undefined,
          splitRuleTemplates: inherit.split ? clone(previous.splitRuleTemplates) : undefined,
          submissionWindow: input?.submissionWindow,
          scope: { country: input?.country || '全部', platform: input?.platform || '全部' },
          relations
        }, services, previous);
        next.auditTimeline[0].reason = `基准 ${previous.name}；继承：${Object.entries(inherit).filter(([, enabled]) => enabled).map(([key]) => key).join('、') || '无'}；等待PMC重新评估与确认`;
        state.batches.push(next); state.currentBatchId = next.id; state.revision += 1; save(); return clone(next);
      },
      confirmAssessment: batchId => write(batchId, batch => { batch.status = '参数调整中'; batch.workflowState = '评估已完成'; batch.currentStep = 'parameters'; batch.auditTimeline.push({ at: new Date().toISOString(), action: '完成预测评估', actor: 'PMC计划员', reason: '确认上一批次偏差与本批次关系异常，进入参数确认' }); }),
      updateParameters: (batchId, changes, reason) => write(batchId, batch => { const before = clone(batch.parameterSnapshot); batch.parameterSnapshot = { ...batch.parameterSnapshot, ...changes, version: nextVersion(batch.parameterSnapshot.version) }; batch.status = '参数已确认'; batch.workflowState = '参数已确认'; batch.currentStep = 'relations'; invalidateResult(batch, '参数已确认'); batch.adjustmentLog.unshift({ at: new Date().toISOString(), type: '预测参数', before, after: clone(batch.parameterSnapshot), reason, actor: 'PMC计划员' }); batch.auditTimeline.push({ at: new Date().toISOString(), action: '调整预测参数', actor: 'PMC计划员', reason }); }),
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
          if (!relation) throw Error(`未找到子ASIN ${childId}`);
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
        if (!changed) throw Error('所选子ASIN与目标父ASIN关系相同');
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
      confirmRelations: batchId => write(batchId, batch => { if (batch.relationSnapshot.some(row => !row.parentASIN)) throw Error('仍有子ASIN未关联父ASIN'); batch.relationConfirmed = true; batch.status = '关系已确认'; batch.workflowState = '关系已确认'; batch.currentStep = 'split'; batch.auditTimeline.push({ at: new Date().toISOString(), action: '确认本批次父子关系', actor: 'PMC计划员', reason: `${batch.relationSnapshot.length} 条关系已确认，按当前关系重新归集历史销量` }); }),
      saveSplitRule: (batchId, rule) => write(batchId, batch => { const next = { ...rule, id: rule.id || `SPLIT-TPL-${Date.now()}` }; const index = batch.splitRuleTemplates.findIndex(item => item.id === next.id); if (index >= 0) batch.splitRuleTemplates[index] = next; else batch.splitRuleTemplates.push(next); batch.splitRuleSnapshot.version = nextVersion(batch.splitRuleSnapshot.version); batch.splitConfirmed = false; batch.status = '拆解规则确认中'; batch.currentStep = 'split'; invalidateResult(batch, '拆解待确认'); batch.auditTimeline.push({ at: new Date().toISOString(), action: '更新子体拆解规则', actor: 'PMC计划员', reason: next.name }); }),
      adjustComboLines: (batchId, childId, adjustments, reason) => write(batchId, batch => {
        if (!batch.relationConfirmed) throw Error('请先确认本批次父子关系');
        const row = batch.childForecastResults.find(item => item.childId === childId || item.childASIN === childId);
        if (!row || row.businessObjectType !== 'COMBO') throw Error('当前子ASIN不是销售组合');
        const total = sum(Object.values(row.dailyFinalForecast || {}));
        const before = clone(row.comboLines || []);
        const next = (row.comboLines || []).map(line => {
          const adjustment = Math.round(Number(adjustments?.[line.sku]) || 0);
          return { ...line, pmcAdjustment: adjustment, finalForecast: line.systemSuggested + adjustment, adjustmentReason: adjustment ? reason : null, source: adjustment ? 'PMC人工调整' : '系统自动' };
        });
        if (next.some(line => line.pmcAdjustment) && !String(reason || '').trim()) throw Error('销售组合明细有人工作调整时必须填写调整原因');
        if (sum(next.map(line => Number(line.finalForecast) || 0)) !== total) throw Error(`销售组合拆解后必须等于子ASIN预测 ${total} 件，请平衡人工调整`);
        row.comboLines = next;
        batch.splitConfirmed = false;
        batch.status = '拆解规则确认中';
        batch.workflowState = '拆解待确认';
        batch.currentStep = 'split';
        invalidateResult(batch, '拆解待确认');
        batch.adjustmentLog.unshift({ at: new Date().toISOString(), type: '销售组合明细', childASIN: row.childASIN, businessObjectCode: row.businessObjectCode, before, after: clone(next), reason, actor: 'PMC计划员' });
        batch.auditTimeline.push({ at: new Date().toISOString(), action: '调整销售组合明细预测', actor: 'PMC计划员', reason: `${row.businessObjectCode} · ${row.childASIN}` });
      }),
      adjustShares: (batchId, key, shares, reason) => write(batchId, batch => { if (!batch.relationConfirmed) throw Error('请先确认本批次父子关系'); const siblings = batch.childForecastResults.filter(row => relationKey(row) === key); if (!siblings.length) throw Error('父ASIN预测池不存在'); const total = sum(siblings.map(row => normalizeRatio(shares[row.childASIN] ?? shares[row.childId]))); if (total !== 10000) throw Error('当前父ASIN下子ASIN最终份额必须合计100%'); const before = siblings.map(row => ({ childASIN: row.childASIN, finalShare: row.finalShare })); siblings.forEach(row => { row.finalShare = normalizeRatio(shares[row.childASIN] ?? shares[row.childId]); row.manualReason = row.finalShare !== row.systemShare ? reason : null; }); recalculateSplit(batch); batch.splitConfirmed = true; batch.status = '拆解已确认'; batch.workflowState = '拆解已确认'; batch.currentStep = 'forecast'; invalidateResult(batch, '拆解已确认'); batch.adjustmentLog.unshift({ at: new Date().toISOString(), type: '子ASIN份额', before, after: siblings.map(row => ({ childASIN: row.childASIN, finalShare: row.finalShare })), reason, actor: 'PMC计划员' }); batch.auditTimeline.push({ at: new Date().toISOString(), action: '完成子ASIN人工调配', actor: 'PMC计划员', reason }); }),
      confirmSplit: batchId => write(batchId, batch => { if (!batch.relationConfirmed) throw Error('请先确认本批次父子关系'); const validation = resultValidation({ ...batch, splitConfirmed: true }); const blocking = validation.items.filter(item => !item.passed && item.label !== '本批次子体拆解已确认'); if (blocking.length) throw Error(`拆解校验未通过：${blocking[0].label}`); batch.splitConfirmed = true; batch.status = '拆解已确认'; batch.workflowState = '拆解已确认'; batch.currentStep = 'forecast'; invalidateResult(batch, '拆解已确认'); batch.auditTimeline.push({ at: new Date().toISOString(), action: '确认本批次子体拆解', actor: 'PMC计划员', reason: '全部父ASIN份额及预测量已平衡' }); }),
      validateForecast: batchId => { const batch = getBatchRaw(batchId); return batch ? clone(resultValidation(batch)) : null; },
      generateForecast: (batchId, reason = '生成本批次规则预测快照') => write(batchId, batch => { const validation = resultValidation(batch); if (!validation.passed) throw Error(`生成前校验未通过：${validation.items.find(item => !item.passed).label}`); recalculateSplit(batch); const prefix = `RESULT-${batch.batchDate.replaceAll('-', '')}-V`; const version = `${prefix}${String(batch.resultSnapshots.length + 1).padStart(2, '0')}`; const generatedAt = new Date().toISOString(); batch.resultSnapshots.push(makeResultSnapshot(batch, version, generatedAt)); batch.activeResultVersion = version; batch.resultState = '已生成'; batch.status = '规则预测已生成'; batch.workflowState = '规则预测已生成'; batch.currentStep = 'submission'; batch.auditTimeline.push({ at: generatedAt, action: '生成规则预测快照', actor: 'PMC计划员', reason: `${reason} · ${version}` }); }),
      recalculate: (batchId, reason = '规则参数已确认，重新生成父/子ASIN规则预测') => api.generateForecast(batchId, reason),
      publishWindow: (batchId, window, reason = '规则预测完成，发布销售填报窗口') => write(batchId, batch => { if (batch.resultState !== '已生成' || !batch.activeResultVersion) throw Error('请先完成规则预测生成'); const next = { ...batch.submissionWindow, ...window, status: '填报中' }; if (Date.parse(next.submissionStartTime) >= Date.parse(next.submissionDeadlineTime)) throw Error('填报开放时间必须早于截止时间'); if (Date.parse(next.submissionDeadlineTime) > Date.parse(next.submissionFreezeTime)) throw Error('填报截止时间不能晚于冻结时间'); batch.submissionWindow = next; batch.submissionState = '填报中'; batch.status = '销售填报中'; batch.workflowState = '填报进行中'; batch.currentStep = 'submission'; batch.auditTimeline.push({ at: new Date().toISOString(), action: '发布销售填报窗口', actor: 'PMC计划员', reason: `${reason} · ${batch.activeResultVersion}` }); }),
      freeze: (batchId, reason = '到达本批次冻结时间') => write(batchId, batch => { if (batch.submissionState !== '填报中') throw Error('请先发布销售填报窗口'); batch.status = '已冻结'; batch.workflowState = '填报已冻结'; batch.submissionState = '已冻结'; batch.submissionWindow.status = '已冻结'; batch.currentStep = 'review'; batch.auditTimeline.push({ at: new Date().toISOString(), action: '冻结销售预测', actor: '系统', reason }); }),
      completeBatch: (batchId, confirmedCount) => {
        const batch = getBatchRaw(batchId);
        if (!batch || batch.status !== '已冻结') throw Error('请先冻结本批次销售填报');
        if (confirmedCount !== batch.childForecastResults.length) throw Error('仍有子ASIN未完成PMC审核');
        batch.status = '已完成';
        batch.workflowState = '已完成';
        batch.updatedAt = new Date().toISOString();
        batch.auditTimeline.push({ at: batch.updatedAt, action: '最终确认预测批次', actor: 'PMC计划员', reason: `${confirmedCount} 个子ASIN已审核并冻结` });
        state.revision += 1; save();
        return clone(batch);
      },
      subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
      contract: {
        getCurrent: () => api.getCurrent(),
        getBatch: batchId => api.getBatch(batchId),
        getWindow: batchId => api.getWindow(batchId),
        getDailyForecast: (batchId, childId, date) => {
          // Contract reads are frequent during table rendering. Keep the batch snapshot
          // immutable to callers without cloning the entire 182-day batch per cell.
          const raw = getBatchRaw(batchId);
          const batch = raw ? { ...raw } : null;
          const result = getActiveResult(batch);
          if (!result) return null;
          const row = result.rows.find(item => item.childId === childId || item.childASIN === childId || [item.country, item.store, item.childASIN].join('|') === childId);
          if (!row) return null;
          const parent = result.parents.find(item => item.key === relationKey(row));
          const ruleForecast = row.daily[date] ?? null;
          return { batchId: batch.id, batchVersion: batch.batchVersion, resultVersion: result.version, dataCutoffDate: batch.dataCutoffDate, forecastStartDate: batch.forecastStartDate, forecastEndDate: batch.forecastEndDate, submissionStartTime: batch.submissionWindow.submissionStartTime, submissionDeadlineTime: batch.submissionWindow.submissionDeadlineTime, submissionFreezeTime: batch.submissionWindow.submissionFreezeTime, status: batch.status, parentASIN: row.parentASIN, childASIN: row.childASIN, country: row.country, site: row.country, store: row.store, salesOwner: row.salesOwner, tags: [...(row.tags || [])], businessObjectType: row.businessObjectType, businessObjectCode: row.businessObjectCode, businessObjectVersion: row.businessObjectVersion, forecastDate: date, parentRuleForecast: parent?.daily?.[date] ?? null, systemSplitForecast: row.ruleDaily[date] ?? null, ai: ruleForecast, manual: null, activity: null, final: ruleForecast, ruleForecast, forecastSource: '规则预测', forecastRuleVersion: result.forecastRuleVersion, splitRuleVersion: result.splitRuleVersion, relationVersion: result.relationVersion, parameterVersion: result.parameterVersion, reason: row.manualAdjustment ? 'PMC已完成本批次子ASIN份额调配' : row.dailyReason?.[date] || '沿用本批次拆解规则' };
        },
        getForecastIndex: batchId => {
          const batch = getBatchRaw(batchId);
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
              parentASIN: row.parentASIN,
              country: row.country,
              store: row.store,
              systemShare: row.systemShare,
              finalShare: row.finalShare,
              manualAdjustment: row.manualAdjustment,
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
          return { batchId: batch.id, batchVersion: batch.batchVersion, resultVersion: result.version, relationVersion: result.relationVersion, splitRuleVersion: result.splitRuleVersion, forecastRuleVersion: result.forecastRuleVersion, parameterVersion: result.parameterVersion, forecastStartDate: batch.forecastStartDate, forecastEndDate: batch.forecastEndDate, children, parents };
        },
        getSubmissionRows: batchId => {
          const batch = api.getBatch(batchId); if (!batch) return [];
          const result = getActiveResult(getBatchRaw(batchId)); if (!result) return [];
          return result.rows.flatMap(row => {
            const parent = result.parents.find(item => item.key === relationKey(row));
            return dateRange(batch.forecastStartDate, batch.forecastEndDate).map(date => ({ batchId: batch.id, batchVersion: batch.batchVersion, resultVersion: result.version, dataCutoffDate: batch.dataCutoffDate, forecastStartDate: batch.forecastStartDate, forecastEndDate: batch.forecastEndDate, submissionStartTime: batch.submissionWindow.submissionStartTime, submissionDeadlineTime: batch.submissionWindow.submissionDeadlineTime, submissionFreezeTime: batch.submissionWindow.submissionFreezeTime, status: batch.status, parentASIN: row.parentASIN, childASIN: row.childASIN, childId: row.childId, country: row.country, site: row.country, store: row.store, salesOwner: row.salesOwner, tags: row.tags, businessObjectType: row.businessObjectType, businessObjectCode: row.businessObjectCode, businessObjectVersion: row.businessObjectVersion, forecastDate: date, parentRuleForecast: parent?.daily?.[date] ?? null, systemSplitForecast: row.ruleDaily[date] ?? null, ruleForecast: row.daily[date] ?? null, forecastSource: '规则预测', forecastRuleVersion: result.forecastRuleVersion, splitRuleVersion: result.splitRuleVersion, relationVersion: result.relationVersion, parameterVersion: result.parameterVersion }));
          });
        },
        getSnapshot: batchId => api.getSnapshot(batchId),
        subscribe: listener => api.subscribe(listener)
      }
    };
    return api;
  }
  return { STORAGE_KEY, clone, dateRange, createStore, seed };
});
