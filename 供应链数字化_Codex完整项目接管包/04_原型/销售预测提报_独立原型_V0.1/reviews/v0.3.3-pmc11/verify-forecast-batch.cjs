const assert = (condition, message) => { if (!condition) throw new Error(message); };
const model = require('./forecast-batch-model.js');

const groups = [{
  parent: 'B0PARENT01', market: 'US', platform: 'Amazon', account: 'STORE-US', owner: '测试销售', name: '测试商品', tags: ['成熟期', '头部'],
  children: [{ id: 'US-C000000001', asin: 'C000000001', base: 12, businessCode: 'SKU-A' }, { id: 'US-C000000002', asin: 'C000000002', base: 8, businessCode: 'SKU-B' }]
}, {
  parent: 'B0PARENT02', market: 'US', platform: 'Amazon', account: 'STORE-US', owner: '测试销售', name: '测试商品2', tags: ['成长'],
  children: [{ id: 'US-B0GRG7J9MN', asin: 'B0GRG7J9MN', base: 6, businessCode: 'SKU-C' }]
}];
const forecastAt = (child, batch, date) => ({ ai: child.base, manual: null, activity: null, final: child.base, reason: '规则基准' });
const actualAt = child => child.base - 1;
const storage = { value: null, getItem() { return this.value; }, setItem(_, value) { this.value = value; } };
const store = model.createStore({ groups, forecastAt, actualAt }, storage);
const current = store.getCurrent();
assert(current.id === 'FB-20261021-01', 'seed current batch');
assert(current.previousBatchId === 'FB-20261007-01', 'previous batch linkage');
assert(current.forecastRuleSnapshot.version === 'FORECAST-20261021-V01', 'forecast rule snapshot');
assert(current.splitRuleSnapshot.version === 'SPLIT-20261021-V01', 'split rule snapshot');
assert(current.relationVersion === 'REL-20261021-V01', 'relation snapshot version');
assert(current.childForecastResults.length === 3, 'child forecast result count');
assert(current.schema === 3, 'batch schema version');
assert(current.assessment.comparisonStartDate === '2026-10-07' && current.assessment.comparisonEndDate === '2026-10-20' && current.assessment.comparisonDays === 14, 'assessment uses the same comparison period');
assert(current.assessment.ruleForecastTotal === 364 && current.assessment.actualSalesTotal === 322, 'assessment compares same-period forecast and actual totals');
assert(current.assessment.varianceRate === -11.5, 'assessment variance rate');
assert(current.childForecastResults.every(row => row.dailyRuleForecast[current.forecastStartDate] != null), 'daily rule forecast');
assert(current.childForecastResults.every(row => row.childRef === undefined), 'stored snapshot excludes runtime child reference');
const previous = store.getBatch(current.previousBatchId);
assert(previous.relationSnapshot.find(row => row.childASIN === 'B0GRG7J9MN').parentASIN === 'B0OLDPOOL1', 'historical relation snapshot keeps old parent');
assert(previous.childForecastResults.find(row => row.childASIN === 'B0GRG7J9MN').parentASIN === 'B0OLDPOOL1', 'historical child forecast keeps old parent');
current.parentForecastResults.forEach(parent => {
  const children = current.childForecastResults.filter(row => `${row.country}|${row.store}|${row.parentASIN}` === parent.key);
  assert(children.reduce((total, row) => total + row.dailyRuleForecast[current.forecastStartDate], 0) === parent.daily[current.forecastStartDate], 'system split conserves parent daily forecast');
  assert(children.reduce((total, row) => total + row.dailyFinalForecast[current.forecastStartDate], 0) === parent.daily[current.forecastStartDate], 'final split conserves parent daily forecast');
});

const contractRow = store.contract.getDailyForecast(current.batchDate, 'US-C000000001', current.forecastStartDate);
assert(contractRow && contractRow.ruleForecast === current.childForecastResults[0].dailyFinalForecast[current.forecastStartDate] && contractRow.parentRuleForecast != null && contractRow.forecastRuleVersion === current.forecastRuleSnapshot.version, 'contract daily forecast');
const submissionRows = store.contract.getSubmissionRows(current.id);
assert(submissionRows.length === current.childForecastResults.length * 182, 'sales-facing daily contract range');
assert(['batchId', 'batchVersion', 'parentASIN', 'childASIN', 'country', 'site', 'store', 'forecastDate', 'parentRuleForecast', 'systemSplitForecast', 'ruleForecast', 'submissionDeadlineTime', 'relationVersion', 'splitRuleVersion'].every(key => key in submissionRows[0]), 'contract fields');

const next = store.createNextBatch({ batchDate: '2026-10-28', name: '2026-10-28 第1批预测' });
assert(next.previousBatchId === current.id && next.status === '草稿', 'next batch is draft and linked');
const parentKey = `${next.relationSnapshot[0].country}|${next.relationSnapshot[0].store}|${next.relationSnapshot[0].parentASIN}`;
store.updateParameters(next.id, { recentShareWeight: 40, historyShareWeight: 60 }, '测试：近期趋势需要复核');
const changed = store.getBatch(next.id);
assert(changed.parameterSnapshot.recentShareWeight === 40 && changed.adjustmentLog.length === 1, 'parameter audit');
store.adjustRelation(next.id, next.relationSnapshot[0].childId, 'B0PARENT02', '测试：子ASIN迁移父体');
const relationChanged = store.getBatch(next.id);
assert(relationChanged.relationChanges.length === 1 && relationChanged.childForecastResults.find(row => row.childId === next.relationSnapshot[0].childId).parentASIN === 'B0PARENT02', 'relation migration sync');
const siblings = relationChanged.childForecastResults.filter(row => row.parentASIN === 'B0PARENT02');
const shares = Object.fromEntries(siblings.map((row, index) => [row.childASIN, index === 0 ? 6000 : 4000]));
if (siblings.length === 1) shares[siblings[0].childASIN] = 10000;
const activeKey = `${siblings[0].country}|${siblings[0].store}|${siblings[0].parentASIN}`;
store.adjustShares(next.id, activeKey, shares, '测试：按近期趋势人工调配');
const allocated = store.getBatch(next.id);
assert(allocated.childForecastResults.filter(row => `${row.country}|${row.store}|${row.parentASIN}` === activeKey).reduce((sum, row) => sum + row.finalShare, 0) === 10000, 'share conservation');
const allocatedParent = allocated.parentForecastResults.find(row => row.key === activeKey);
assert(allocated.childForecastResults.filter(row => `${row.country}|${row.store}|${row.parentASIN}` === activeKey).reduce((sum, row) => sum + row.dailyFinalForecast[allocated.forecastStartDate], 0) === allocatedParent.daily[allocated.forecastStartDate], 'adjusted daily forecast conserves parent result');
assert(store.contract.getDailyForecast(next.id, siblings[0].childId, allocated.forecastStartDate).ruleForecast === allocated.childForecastResults.find(row => row.childId === siblings[0].childId).dailyFinalForecast[allocated.forecastStartDate], 'sales contract uses final adjusted split');
store.publishWindow(next.id, { submissionStartTime: '2026-10-28T09:00:00+08:00', submissionDeadlineTime: '2026-11-01T18:00:00+08:00', submissionFreezeTime: '2026-11-02T00:00:00+08:00' });
assert(store.getBatch(next.id).status === '销售填报中', 'window publish state');
store.freeze(next.id);
assert(store.getBatch(next.id).status === '已冻结', 'freeze state');
let frozenError = false;
try { store.updateParameters(next.id, { trendWindow: 14 }, '不应写入'); } catch (error) { frozenError = /冻结/.test(error.message); }
assert(frozenError, 'frozen batch write protection');
const snapshot = store.contract.getSnapshot(next.id);
snapshot.name = '外部修改不应回写';
assert(store.getBatch(next.id).name !== snapshot.name, 'immutable snapshot read');
store.setDemoStage('split');
assert(store.getCurrent().status === '拆解规则确认中' && store.getCurrent().id === store.getState().currentBatchId, 'demo stage changes state only');
store.setDemoStage('auto');
console.log('forecast batch verification passed');
