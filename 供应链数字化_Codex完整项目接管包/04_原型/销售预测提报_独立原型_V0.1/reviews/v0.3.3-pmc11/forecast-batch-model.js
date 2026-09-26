/* ForecastBatch: batch-owned forecast snapshot and sales-facing contract. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ForecastBatchModel = api;
})(typeof window === 'undefined' ? globalThis : window, function (root) {
  'use strict';

  const STORAGE_KEY = 'pmc-forecast-batch-v3';
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
  const relationFromRow = (row, batchDate) => ({
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
    childRef: row.childRef
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
      const historyTotal = sum(historyDays.map(date => Number(legacyForecast(relation, batch, date, services)?.ai) || 0));
      const siblingHistoryTotal = sum((groups[relationKey(relation)] || []).map(sibling => {
        return sum(historyDays.map(date => Number(legacyForecast(sibling, batch, date, services)?.ai) || 0));
      }));
      return {
        ...relation,
        id: rowKey(relation),
        historicalSales: historyTotal,
        systemShare: siblingHistoryTotal ? Math.round(historyTotal / siblingHistoryTotal * 10000) : 0,
        manualAdjustment: 0,
        finalShare: siblingHistoryTotal ? Math.round(historyTotal / siblingHistoryTotal * 10000) : 0,
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
      if (ratioTotal && ratioTotal !== 10000) siblings.at(-1).systemShare += 10000 - ratioTotal;
      siblings.forEach(row => { row.finalShare = row.systemShare; });
    });
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
      schema: 3,
      id: input.id,
      batchVersion: input.batchVersion,
      name: input.name,
      batchDate,
      dataCutoffDate: input.dataCutoffDate || shiftDate(batchDate, -1),
      forecastStartDate: start,
      forecastEndDate: end,
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
      relationSnapshot: relations.map(relation => ({ ...relation, childRef: undefined })),
      relationChanges: input.relationChanges || [],
      parentForecastResults: parentForecastResults(rows, start, end),
      childForecastResults: rows.map(row => ({ ...row, childRef: undefined })),
      submissionWindow: input.submissionWindow || defaultWindow(batchDate),
      submissionState: input.submissionState || '待发布',
      actualSales: input.actualSales || actualSnapshot(rows, batchDate, services),
      forecastVsActual: [],
      adjustmentLog: input.adjustmentLog || [],
      auditTimeline: input.auditTimeline || [{ at: `${batchDate}T09:00:00+08:00`, action: '创建预测批次', actor: 'PMC计划员', reason: '继承上一批次预测与实际表现' }]
    };
    recalculateSplit(batch);
    const comparison = buildForecastComparison(batch, previous);
    batch.assessment = assessment(batch, previous, comparison);
    batch.forecastVsActual = comparison.rows;
    return batch;
  }
  function seed(services = {}) {
    const previousDate = '2026-10-07';
    const currentDate = '2026-10-21';
    const previousRelations = rowsFromGroups(sourceGroups(services), previousDate, services).map(row => ({
      ...relationFromRow(row, previousDate),
      parentASIN: row.childASIN === 'B0GRG7J9MN' ? 'B0OLDPOOL1' : row.parentASIN,
      relationState: row.childASIN === 'B0GRG7J9MN' ? '历史父体' : row.relationState
    }));
    const previous = createBatch({
      id: 'FB-20261007-01', batchVersion: 'V20261007-01', name: '2026-10-07 第1批预测', batchDate: previousDate,
      dataCutoffDate: '2026-10-06', status: '已完成', currentStep: 'review', submissionState: '已冻结',
      relationVersion: 'REL-20261007-V01', splitRuleVersion: 'SPLIT-20261007-V01', parameterVersion: 'PARAM-20261007-V01',
      relations: previousRelations
    }, services);
    const current = createBatch({
      id: 'FB-20261021-01', batchVersion: 'V20261021-01', name: '2026-10-21 第1批预测', batchDate: currentDate,
      dataCutoffDate: '2026-10-20', status: '销售填报中', currentStep: 'submission', submissionState: '填报中', previousBatchId: previous.id,
      relationVersion: 'REL-20261021-V01', forecastRuleVersion: 'FORECAST-20261021-V01', splitRuleVersion: 'SPLIT-20261021-V01', parameterVersion: 'PARAM-20261021-V01',
      relationChanges: [{ id: 'REL-CHANGE-001', childASIN: 'B0GRG7J9MN', from: 'B0OLDPOOL1', to: 'B0GRGFFVVN', type: '子ASIN更换父ASIN', beforeShare: 3500, afterShare: 2700, reason: '父体Listing结构调整', actor: 'PMC计划员', at: '2026-10-21T10:30:00+08:00' }],
      auditTimeline: [
        { at: '2026-10-21T09:00:00+08:00', action: '创建预测批次', actor: 'PMC计划员', reason: '读取上一批次预测、实际与关系快照' },
        { at: '2026-10-21T09:20:00+08:00', action: '完成预测评估', actor: 'PMC计划员', reason: '识别低销量子体与父体趋势变化' },
        { at: '2026-10-21T10:30:00+08:00', action: '确认本批次关系', actor: 'PMC计划员', reason: 'B0GRG7J9MN 归入当前父体预测池' },
        { at: '2026-10-21T11:00:00+08:00', action: '发布销售填报窗口', actor: 'PMC计划员', reason: '规则预测完成后交给销售填报' }
      ]
    }, services, previous);
    current.relationSnapshot = current.relationSnapshot.map(relation => ({ ...relation, previousParentASIN: previous.relationSnapshot.find(old => old.childASIN === relation.childASIN && old.country === relation.country)?.parentASIN || relation.parentASIN }));
    current.relationChanges[0].previousBatchId = previous.id;
    return { schema: 3, revision: 1, currentBatchId: current.id, batches: [previous, current] };
  }
  function validState(value) {
    return value && value.schema === 3 && Array.isArray(value.batches) && value.batches.length > 0 && value.batches.every(batch => batch.id && Array.isArray(batch.childForecastResults) && batch.relationVersion && batch.assessment && 'comparisonDays' in batch.assessment);
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
    let demoStage = 'auto';
    const listeners = new Set();
    const save = () => { try { storage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { /* demo continues in memory */ } listeners.forEach(listener => listener(getState())); if (root.dispatchEvent && typeof Event !== 'undefined') root.dispatchEvent(new Event('forecast-batch-change')); };
    const getBatchRaw = batchId => { const value = batchId || state.currentBatchId; return state.batches.find(batch => batch.id === value || batch.batchDate === value || batch.batchVersion === value); };
    const effectiveStatus = batch => demoStage === 'auto' || batch.id !== state.currentBatchId ? batch.status : ({ assessment: '评估中', parameters: '参数调整中', relations: '关系确认中', split: '拆解规则确认中', forecast: '预测计算中', submission: '销售填报中', review: '待复盘' }[demoStage] || batch.status);
    const getState = () => ({ revision: state.revision, currentBatchId: state.currentBatchId, demoStage });
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
    const api = {
      key: STORAGE_KEY,
      getState,
      getCurrent: () => { const raw = getBatchRaw(); if (!raw) return null; const batch = clone(raw); batch.status = effectiveStatus(batch); batch.demoStage = demoStage; return batch; },
      getBatch: batchId => { const raw = getBatchRaw(batchId); if (!raw) return null; const batch = clone(raw); batch.status = effectiveStatus(batch); batch.demoStage = demoStage; return batch; },
      getWindow: batchId => { const batch = api.getBatch(batchId); if (!batch) return null; return { ...clone(batch.submissionWindow), batchId: batch.id, batchVersion: batch.batchVersion, status: batch.status, submissionStartTime: batch.submissionWindow.submissionStartTime, submissionDeadlineTime: batch.submissionWindow.submissionDeadlineTime, submissionFreezeTime: batch.submissionWindow.submissionFreezeTime }; },
      getSnapshot: batchId => api.getBatch(batchId),
      list: () => state.batches.slice().sort((a, b) => b.batchDate.localeCompare(a.batchDate)).map(batch => ({ ...clone(batch), status: effectiveStatus(batch) })),
      setDemoStage: stage => { demoStage = stage || 'auto'; listeners.forEach(listener => listener(getState())); root.dispatchEvent?.(new Event('forecast-batch-demo-change')); },
      getDemoStage: () => demoStage,
      createNextBatch: input => {
        const previous = getBatchRaw();
        const nextDate = input?.batchDate || shiftDate(previous.batchDate, 7);
        const next = createBatch({
          id: `FB-${nextDate.replaceAll('-', '')}-01`, batchVersion: `V${nextDate.replaceAll('-', '')}-01`, name: input?.name || `${nextDate} 第1批预测`, batchDate: nextDate,
          dataCutoffDate: shiftDate(nextDate, -1), status: '草稿', currentStep: 'assessment', previousBatchId: previous.id,
          relationVersion: `REL-${nextDate.replaceAll('-', '')}-V01`, forecastRuleVersion: `FORECAST-${nextDate.replaceAll('-', '')}-V01`, splitRuleVersion: `SPLIT-${nextDate.replaceAll('-', '')}-V01`, parameterVersion: `PARAM-${nextDate.replaceAll('-', '')}-V01`,
          relations: previous.relationSnapshot.map(relation => ({ ...relation, childRef: (sourceGroups(services).flatMap(group => group.children).find(child => child.id === relation.childId) || undefined) }))
        }, services, previous);
        next.auditTimeline[0].reason = '继承上一批次快照，等待PMC重新评估与确认';
        state.batches.push(next); state.currentBatchId = next.id; state.revision += 1; save(); return clone(next);
      },
      updateParameters: (batchId, changes, reason) => write(batchId, batch => { const before = clone(batch.parameterSnapshot); batch.parameterSnapshot = { ...batch.parameterSnapshot, ...changes, version: `${batch.parameterSnapshot.version.split('-V')[0]}-V${Number(batch.parameterSnapshot.version.match(/V(\d+)$/)?.[1] || 1) + 1}` }; batch.status = '参数调整中'; batch.currentStep = 'parameters'; batch.adjustmentLog.unshift({ at: new Date().toISOString(), type: '预测参数', before, after: clone(batch.parameterSnapshot), reason, actor: 'PMC计划员' }); batch.auditTimeline.push({ at: new Date().toISOString(), action: '调整预测参数', actor: 'PMC计划员', reason }); }),
      adjustRelation: (batchId, childId, targetParent, reason) => write(batchId, batch => {
        const row = batch.relationSnapshot.find(item => item.childId === childId || item.childASIN === childId);
        const child = batch.childForecastResults.find(item => item.childId === childId || item.childASIN === childId);
        if (!row || !child) throw Error('子ASIN关系不存在');
        const before = row.parentASIN, beforeShare = child.finalShare;
        if (before === targetParent) throw Error('新旧父ASIN不能相同');
        row.parentASIN = targetParent; row.relationState = 'PMC本批次确认';
        child.parentASIN = targetParent; child.relationState = 'PMC本批次确认'; child.finalShare = 0; child.systemShare = 0;
        const groups = batch.childForecastResults.reduce((map, item) => { (map[relationKey(item)] ||= []).push(item); return map; }, {});
        Object.values(groups).forEach(siblings => {
          const total = sum(siblings.map(item => item.historicalSales));
          siblings.forEach(item => { item.systemShare = total ? Math.round(item.historicalSales / total * 10000) : Math.round(10000 / siblings.length); item.finalShare = item.systemShare; });
          const drift = 10000 - sum(siblings.map(item => item.systemShare)); if (siblings.at(-1)) siblings.at(-1).systemShare += drift, siblings.at(-1).finalShare += drift;
        });
        batch.parentForecastResults = parentForecastResults(batch.childForecastResults, batch.forecastStartDate, batch.forecastEndDate);
        recalculateSplit(batch);
        batch.relationChanges.unshift({ id: `REL-CHANGE-${Date.now()}`, childASIN: row.childASIN, from: before, to: targetParent, type: '子ASIN更换父ASIN', beforeShare, afterShare: child.finalShare, reason, actor: 'PMC计划员', at: new Date().toISOString() });
        batch.status = '关系确认中'; batch.currentStep = 'relations';
      }),
      adjustShares: (batchId, key, shares, reason) => write(batchId, batch => { const siblings = batch.childForecastResults.filter(row => relationKey(row) === key); if (!siblings.length) throw Error('父ASIN预测池不存在'); const total = sum(siblings.map(row => normalizeRatio(shares[row.childASIN] ?? shares[row.childId]))); if (total !== 10000) throw Error('当前父ASIN下子ASIN最终份额必须合计100%'); const before = siblings.map(row => ({ childASIN: row.childASIN, finalShare: row.finalShare })); siblings.forEach(row => { row.finalShare = normalizeRatio(shares[row.childASIN] ?? shares[row.childId]); }); recalculateSplit(batch); batch.status = '拆解规则确认中'; batch.currentStep = 'split'; batch.adjustmentLog.unshift({ at: new Date().toISOString(), type: '子ASIN份额', before, after: siblings.map(row => ({ childASIN: row.childASIN, finalShare: row.finalShare })), reason, actor: 'PMC计划员' }); batch.auditTimeline.push({ at: new Date().toISOString(), action: '完成子ASIN人工调配', actor: 'PMC计划员', reason }); }),
      recalculate: (batchId, reason = '规则参数已确认，重新生成父/子ASIN规则预测') => write(batchId, batch => { recalculateSplit(batch); batch.status = '预测计算中'; batch.currentStep = 'forecast'; batch.auditTimeline.push({ at: new Date().toISOString(), action: '重新生成规则预测', actor: 'PMC计划员', reason }); }),
      publishWindow: (batchId, window, reason = '规则预测完成，发布销售填报窗口') => write(batchId, batch => { const next = { ...batch.submissionWindow, ...window, status: '填报中' }; if (Date.parse(next.submissionStartTime) >= Date.parse(next.submissionDeadlineTime)) throw Error('填报开始时间必须早于截止时间'); if (Date.parse(next.submissionDeadlineTime) > Date.parse(next.submissionFreezeTime)) throw Error('填报截止时间不能晚于冻结时间'); batch.submissionWindow = next; batch.submissionState = '填报中'; batch.status = '销售填报中'; batch.currentStep = 'submission'; batch.auditTimeline.push({ at: new Date().toISOString(), action: '发布销售填报窗口', actor: 'PMC计划员', reason }); }),
      freeze: (batchId, reason = '到达本批次冻结时间') => write(batchId, batch => { batch.status = '已冻结'; batch.submissionState = '已冻结'; batch.submissionWindow.status = '已冻结'; batch.currentStep = 'review'; batch.auditTimeline.push({ at: new Date().toISOString(), action: '冻结销售预测', actor: '系统', reason }); }),
      subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
      contract: {
        getCurrent: () => api.getCurrent(),
        getBatch: batchId => api.getBatch(batchId),
        getWindow: batchId => api.getWindow(batchId),
        getDailyForecast: (batchId, childId, date) => {
          const batch = api.getBatch(batchId);
          const row = batch?.childForecastResults.find(item => item.childId === childId || item.childASIN === childId || item.id === childId);
          if (!row) return null;
          const parent = batch.parentForecastResults.find(item => item.key === relationKey(row));
          const activity = row.dailyActivityForecast[date];
          const ruleForecast = row.dailyFinalForecast[date] ?? null;
          return { batchId: batch.id, batchVersion: batch.batchVersion, dataCutoffDate: batch.dataCutoffDate, forecastStartDate: batch.forecastStartDate, forecastEndDate: batch.forecastEndDate, submissionStartTime: batch.submissionWindow.submissionStartTime, submissionDeadlineTime: batch.submissionWindow.submissionDeadlineTime, submissionFreezeTime: batch.submissionWindow.submissionFreezeTime, status: batch.status, parentASIN: row.parentASIN, childASIN: row.childASIN, country: row.country, site: row.country, store: row.store, salesOwner: row.salesOwner, tags: row.tags, forecastDate: date, parentRuleForecast: parent?.daily?.[date] ?? null, systemSplitForecast: row.dailyRuleForecast[date] ?? null, ai: ruleForecast, manual: null, activity: null, final: ruleForecast, ruleForecast, forecastSource: '规则预测', forecastRuleVersion: batch.forecastRuleSnapshot.version, splitRuleVersion: batch.splitRuleSnapshot.version, relationVersion: batch.relationVersion, parameterVersion: batch.parameterSnapshot.version, reason: row.manualAdjustment ? 'PMC已完成本批次子ASIN份额调配' : row.dailyReason[date] || '沿用本批次拆解规则' };
        },
        getSubmissionRows: batchId => {
          const batch = api.getBatch(batchId); if (!batch) return [];
          return batch.childForecastResults.flatMap(row => {
            const parent = batch.parentForecastResults.find(item => item.key === relationKey(row));
            return dateRange(batch.forecastStartDate, batch.forecastEndDate).map(date => ({ batchId: batch.id, batchVersion: batch.batchVersion, dataCutoffDate: batch.dataCutoffDate, forecastStartDate: batch.forecastStartDate, forecastEndDate: batch.forecastEndDate, submissionStartTime: batch.submissionWindow.submissionStartTime, submissionDeadlineTime: batch.submissionWindow.submissionDeadlineTime, submissionFreezeTime: batch.submissionWindow.submissionFreezeTime, status: batch.status, parentASIN: row.parentASIN, childASIN: row.childASIN, childId: row.childId, country: row.country, site: row.country, store: row.store, salesOwner: row.salesOwner, tags: row.tags, forecastDate: date, parentRuleForecast: parent?.daily?.[date] ?? null, systemSplitForecast: row.dailyRuleForecast[date] ?? null, ruleForecast: row.dailyFinalForecast[date] ?? null, forecastSource: '规则预测', forecastRuleVersion: batch.forecastRuleSnapshot.version, splitRuleVersion: batch.splitRuleSnapshot.version, relationVersion: batch.relationVersion, parameterVersion: batch.parameterSnapshot.version }));
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
