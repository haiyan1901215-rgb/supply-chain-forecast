const assert = (condition, message) => { if (!condition) throw new Error(message); };
const model = require('./forecast-batch-model.js');

const groups = [{
  parent: 'B0PARENT01', market: 'US', platform: 'Amazon', account: 'STORE-US', owner: '测试销售', name: '测试商品', tags: ['成熟期', '头部'],
  children: [{ id: 'US-C000000001', asin: 'C000000001', base: 12, businessCode: 'SKU-A' }, { id: 'US-C000000002', asin: 'C000000002', base: 8, businessCode: 'COMB-001', businessObjectType: 'COMBO', businessObjectCode: 'COMB-001', businessObjectVersion: 'V1', comboSnapshot: { code: 'COMB-001', version: 'V1', effectiveFrom: '2026-09-01', effectiveTo: '2026-09-30', lines: [{ sku: 'SKU-A', quantity: 1 }, { sku: 'SKU-B', quantity: 2 }] }, comboVersionHistory: [{ code: 'COMB-001', version: 'V1', effectiveFrom: '2026-09-01', effectiveTo: '2026-09-30', lines: [{ sku: 'SKU-A', quantity: 1 }, { sku: 'SKU-B', quantity: 2 }] }, { code: 'COMB-001', version: 'V2', effectiveFrom: '2026-10-01', effectiveTo: null, lines: [{ sku: 'SKU-A', quantity: 1 }, { sku: 'SKU-C', quantity: 2 }] }] }]
}, {
  parent: 'B0PARENT02', market: 'US', platform: 'Amazon', account: 'STORE-US', owner: '测试销售', name: '测试商品2', tags: ['成长'],
  children: [{ id: 'US-B0GRG7J9MN', asin: 'B0GRG7J9MN', base: 6, businessCode: 'SKU-C' }]
}];
const forecastAt = (child, batch, date) => ({ ai: child.base, manual: null, activity: null, final: child.base, reason: '规则基准' });
const actualAt = child => child.base - 1;
const storage = { value: null, getItem() { return this.value; }, setItem(_, value) { this.value = value; } };
const store = model.createStore({ groups, forecastAt, actualAt }, storage);
const current = store.getCurrent();
assert(current.id === 'FB-20260929-01', 'seed current batch');
assert(current.previousBatchId === 'FB-20260922-01', 'previous batch linkage');
assert(current.forecastRuleSnapshot.version === 'FORECAST-20260929-V01', 'forecast rule snapshot');
assert(current.splitRuleSnapshot.version === 'SPLIT-20260929-V01', 'split rule snapshot');
assert(current.relationVersion === 'REL-20260929-V02', 'relation snapshot version');
assert(store.list().map(batch => batch.batchDate).join(',') === '2026-09-29,2026-09-22,2026-09-15,2026-09-08', 'seed includes current and historical planning batches');
assert(current.childForecastResults.length === 3, 'child forecast result count');
assert(current.schema === 4, 'batch schema version');
assert(current.status === '评估中' && current.currentStep === 'assessment', 'seed starts at assessment');
assert(current.resultSnapshots.length === 0 && current.activeResultVersion === null && current.submissionState === '待发布', 'seed result waits for operation-driven generation');
assert(current.assessment.comparisonStartDate === '2026-09-22' && current.assessment.comparisonEndDate === '2026-09-28' && current.assessment.comparisonDays === 7, 'assessment uses the same comparison period');
assert(current.assessment.ruleForecastTotal === 182 && current.assessment.actualSalesTotal === 161, 'assessment compares same-period forecast and actual totals');
assert(current.assessment.varianceRate === -11.5, 'assessment variance rate');
assert(current.childForecastResults.every(row => row.dailyRuleForecast[current.forecastStartDate] != null), 'daily rule forecast');
assert(current.childForecastResults.every(row => row.childRef === undefined), 'stored snapshot excludes runtime child reference');
const seededCombo = current.childForecastResults.find(row => row.businessObjectType === 'COMBO');
assert(seededCombo && seededCombo.businessObjectVersion === 'V1' && seededCombo.comboSnapshot.lines[1].sku === 'SKU-B', 'combo relation snapshot');
assert(seededCombo.comboLines[0].defaultRatio === 3333 && seededCombo.comboLines[1].defaultRatio === 6667, 'combo quantity ratio snapshot');
assert(seededCombo.comboLines.reduce((total, line) => total + line.systemSuggested, 0) === Object.values(seededCombo.dailyFinalForecast).reduce((total, value) => total + value, 0), 'combo integer allocation conserves child forecast');
const previous = store.getBatch(current.previousBatchId);
assert(previous.relationSnapshot.find(row => row.childASIN === 'B0GRG7J9MN').parentASIN === 'B0PARENT02', 'historical relation snapshot keeps its parent');
assert(previous.childForecastResults.find(row => row.childASIN === 'B0GRG7J9MN').parentASIN === 'B0PARENT02', 'historical child forecast keeps its parent');
current.parentForecastResults.forEach(parent => {
  const children = current.childForecastResults.filter(row => `${row.country}|${row.store}|${row.parentASIN}` === parent.key);
  assert(children.reduce((total, row) => total + row.dailyRuleForecast[current.forecastStartDate], 0) === parent.daily[current.forecastStartDate], 'system split conserves parent daily forecast');
  assert(children.reduce((total, row) => total + row.dailyFinalForecast[current.forecastStartDate], 0) === parent.daily[current.forecastStartDate], 'final split conserves parent daily forecast');
});

assert(store.contract.getDailyForecast(current.batchDate, 'US-C000000001', current.forecastStartDate) === null, 'ungenerated seed is not exposed to sales contract');
assert(store.contract.getForecastIndex(current.batchDate) === null, 'ungenerated seed has no forecast index');
assert(store.contract.getSubmissionRows(current.id).length === 0, 'ungenerated seed has no sales-facing rows');

const next = store.createNextBatch({ batchDate: '2026-10-06', name: '2026-10-06 预测批次' });
assert(next.previousBatchId === current.id && next.status === '草稿', 'next batch is draft and linked');
store.updateSubmissionWindow(next.id, { submissionStartTime: '2026-10-06T09:00:00+08:00', submissionDeadlineTime: '2026-10-10T18:00:00+08:00', submissionFreezeTime: '2026-10-11T00:00:00+08:00', autoFreeze: true });
assert(store.getBatch(next.id).submissionState === '待发布' && store.getBatch(next.id).submissionWindow.autoFreeze === true, 'draft window save does not publish sales submission');
assert(store.getBatch(next.id).auditTimeline.at(-1).action === '保存销售填报窗口', 'draft window save is audited');
let invalidWindowBlocked = false;
try { store.updateSubmissionWindow(next.id, { submissionStartTime: '2026-10-10T18:00:00+08:00', submissionDeadlineTime: '2026-10-06T09:00:00+08:00', submissionFreezeTime: '2026-10-11T00:00:00+08:00' }); } catch (error) { invalidWindowBlocked = /开放时间/.test(error.message); }
assert(invalidWindowBlocked, 'invalid draft window ordering is blocked');
const parentKey = `${next.relationSnapshot[0].country}|${next.relationSnapshot[0].store}|${next.relationSnapshot[0].parentASIN}`;
store.confirmAssessment(next.id);
assert(store.getBatch(next.id).status === '参数调整中' && store.getBatch(next.id).currentStep === 'parameters', 'assessment operation advances to parameters');
store.updateParameters(next.id, { recentShareWeight: 40, historyShareWeight: 60 }, '测试：近期趋势需要复核');
const changed = store.getBatch(next.id);
assert(changed.parameterSnapshot.recentShareWeight === 30 && changed.parameterSnapshot.historyShareWeight === 70, 'parameter submission keeps the current batch snapshot active');
assert(changed.pendingParameterSnapshot.recentShareWeight === 40 && changed.pendingParameterSnapshot.historyShareWeight === 60, 'parameter submission creates a pending snapshot');
assert(changed.parameterSubmittedAt && changed.parameterEffectiveAt.endsWith('T00:00:00+08:00'), 'pending parameters take effect at midnight on the next day');
assert(changed.adjustmentLog.length === 1 && changed.adjustmentLog[0].state === '待生效', 'parameter submission is audited as pending');
assert(changed.resultState === '待生成', 'parameter submission does not invalidate or recalculate the current batch');
assert(changed.status === '参数已确认' && changed.currentStep === 'relations', 'parameter save advances to relations');
store.adjustRelation(next.id, next.relationSnapshot[0].childId, 'B0PARENT02', '测试：子ASIN迁移父体');
const relationChanged = store.getBatch(next.id);
assert(relationChanged.relationChanges.length === 1 && relationChanged.childForecastResults.find(row => row.childId === next.relationSnapshot[0].childId).parentASIN === 'B0PARENT02', 'relation migration sync');
assert(relationChanged.relationVersions.length === 2 && relationChanged.relationVersions[0].relations[0].parentASIN !== relationChanged.relationVersions[1].relations[0].parentASIN, 'relation versions preserve before and after snapshots');
store.confirmRelations(next.id);
assert(store.getBatch(next.id).status === '关系已确认' && store.getBatch(next.id).currentStep === 'split', 'relation confirmation advances to split');
const nextCombo = store.getBatch(next.id).childForecastResults.find(row => row.businessObjectType === 'COMBO');
const nextComboTotal = Object.values(nextCombo.dailyFinalForecast).reduce((total, value) => total + value, 0);
const comboAdjustments = { 'SKU-A': 20, 'SKU-B': -20 };
let comboReasonBlocked = false;
try { store.adjustComboLines(next.id, nextCombo.childId, { 'SKU-A': 10, 'SKU-B': -10 }, ''); } catch (error) { comboReasonBlocked = /调整原因/.test(error.message); }
assert(comboReasonBlocked, 'combo manual adjustment requires reason');
store.adjustComboLines(next.id, nextCombo.childId, comboAdjustments, '测试：老版本库存较高，优先消化');
const comboAdjusted = store.getBatch(next.id).childForecastResults.find(row => row.childId === nextCombo.childId);
assert(comboAdjusted.comboLines.find(line => line.sku === 'SKU-A').finalForecast === comboAdjusted.comboLines.find(line => line.sku === 'SKU-A').systemSuggested + 20, 'combo PMC adjustment');
assert(comboAdjusted.comboLines.reduce((total, line) => total + line.finalForecast, 0) === nextComboTotal, 'combo manual adjustment remains balanced');
assert(comboAdjusted.comboLines.every(line => line.pmcAdjustment === 0 || line.adjustmentReason.includes('老版本库存')), 'combo adjustment reason audit');
let ratioRejected = false;
try { store.adjustComboRatios(next.id, nextCombo.childId, { 'SKU-A': 6000, 'SKU-B': 3000 }, '测试比例'); } catch (error) { ratioRejected = /100%/.test(error.message); }
assert(ratioRejected, 'combo ratios must total 100%');
store.adjustComboRatios(next.id, nextCombo.childId, { 'SKU-A': 6000, 'SKU-B': 4000 }, '测试：组合比例校准');
const ratioAdjusted = store.getBatch(next.id).childForecastResults.find(row => row.childId === nextCombo.childId);
assert(ratioAdjusted.comboLines.reduce((total, line) => total + line.finalForecast, 0) === nextComboTotal, 'ratio allocation conserves integer forecast');
assert(ratioAdjusted.comboLines[0].pmcRatio === 6000 && ratioAdjusted.comboLines[1].pmcRatio === 4000, 'PMC ratio is retained separately from default ratio');
assert(comboAdjusted.comboVersionHistory.some(version => version.version === 'V2' && version.lines[1].sku === 'SKU-C'), 'combo future version history retained');
const siblings = relationChanged.childForecastResults.filter(row => row.parentASIN === 'B0PARENT02');
const shares = Object.fromEntries(siblings.map((row, index) => [row.childASIN, index === 0 ? 6000 : 4000]));
if (siblings.length === 1) shares[siblings[0].childASIN] = 10000;
const activeKey = `${siblings[0].country}|${siblings[0].store}|${siblings[0].parentASIN}`;
store.adjustShares(next.id, activeKey, shares, '测试：按近期趋势人工调配');
const allocated = store.getBatch(next.id);
assert(allocated.status === '拆解已确认' && allocated.currentStep === 'forecast', 'split save advances to forecast');
assert(allocated.childForecastResults.filter(row => `${row.country}|${row.store}|${row.parentASIN}` === activeKey).reduce((sum, row) => sum + row.finalShare, 0) === 10000, 'share conservation');
const allocatedParent = allocated.parentForecastResults.find(row => row.key === activeKey);
assert(allocated.childForecastResults.filter(row => `${row.country}|${row.store}|${row.parentASIN}` === activeKey).reduce((sum, row) => sum + row.dailyFinalForecast[allocated.forecastStartDate], 0) === allocatedParent.daily[allocated.forecastStartDate], 'adjusted daily forecast conserves parent result');
assert(store.contract.getDailyForecast(next.id, siblings[0].childId, allocated.forecastStartDate) === null, 'ungenerated draft is not exposed to sales contract');
let publishBlocked = false;
try { store.publishWindow(next.id, { submissionStartTime: '2026-10-06T09:00:00+08:00', submissionDeadlineTime: '2026-10-10T18:00:00+08:00', submissionFreezeTime: '2026-10-11T00:00:00+08:00' }); } catch (error) { publishBlocked = /规则预测/.test(error.message); }
assert(publishBlocked, 'window publish blocked before result generation');
let freezeBlocked = false;
try { store.freeze(next.id); } catch (error) { freezeBlocked = /先发布/.test(error.message); }
assert(freezeBlocked, 'freeze is blocked until sales submission is published');
store.generateForecast(next.id);
const generatedV1 = store.getBatch(next.id);
assert(generatedV1.status === '规则预测待确认' && generatedV1.currentStep === 'forecast' && !generatedV1.resultConfirmed, 'generated result awaits PMC confirmation');
let unconfirmedPublishBlocked = false;
try { store.publishWindow(next.id, { submissionStartTime: '2026-10-06T09:00:00+08:00', submissionDeadlineTime: '2026-10-10T18:00:00+08:00', submissionFreezeTime: '2026-10-11T00:00:00+08:00' }); } catch (error) { unconfirmedPublishBlocked = /确认/.test(error.message); }
assert(unconfirmedPublishBlocked, 'generated but unconfirmed result cannot be published');
const v1Daily = generatedV1.resultSnapshots[0].rows.find(row => row.childId === siblings[0].childId).daily[generatedV1.forecastStartDate];
assert(store.contract.getDailyForecast(next.id, siblings[0].childId, generatedV1.forecastStartDate).ruleForecast === v1Daily, 'sales contract uses generated snapshot');
const generatedCombo = generatedV1.resultSnapshots[0].rows.find(row => row.childId === nextCombo.childId);
assert(generatedCombo.comboSnapshot.version === 'V1' && generatedCombo.comboLines.find(line => line.sku === 'SKU-B').pmcRatio === 4000, 'generated result keeps combo snapshot and adjustment');
const submissionRows = store.contract.getSubmissionRows(next.id);
assert(generatedV1.resultSnapshots[0].seasonRuleVersion === generatedV1.seasonRuleVersion, 'result snapshot pins the seasonal rule version');
assert(submissionRows.every(row => row.seasonRuleVersion === generatedV1.resultSnapshots[0].seasonRuleVersion), 'sales rows use the pinned seasonal rule version');
assert(store.contract.getDailyForecast(next.id, siblings[0].childId, generatedV1.forecastStartDate).seasonRuleVersion === generatedV1.seasonRuleVersion, 'daily contract includes seasonal traceability');
assert(submissionRows.length === generatedV1.childForecastResults.length * 182, 'sales-facing daily contract range');
const snapshotChildren = new Map(generatedV1.resultSnapshots[0].rows.map(row => [row.childId, row]));
assert(submissionRows.every(row => {
  const snapshot = snapshotChildren.get(row.childId);
  return snapshot && row.country === snapshot.country && row.store === snapshot.store && row.childASIN === snapshot.childASIN && row.ruleForecast === snapshot.daily[row.forecastDate];
}), 'every sales child/date value and identity matches the immutable PMC snapshot');
assert(['batchId', 'batchVersion', 'resultVersion', 'parentASIN', 'childASIN', 'country', 'site', 'store', 'forecastDate', 'parentRuleForecast', 'systemSplitForecast', 'ruleForecast', 'submissionDeadlineTime', 'relationVersion', 'splitRuleVersion'].every(key => key in submissionRows[0]), 'contract fields');
const v2Shares = Object.fromEntries(generatedV1.childForecastResults.filter(row => `${row.country}|${row.store}|${row.parentASIN}` === activeKey).map(row => [row.childASIN, row.finalShare]));
const v2Keys = Object.keys(v2Shares);
if (v2Keys.length > 1) { v2Shares[v2Keys[0]] -= 100; v2Shares[v2Keys.at(-1)] += 100; }
store.adjustShares(next.id, activeKey, v2Shares, '测试：生成后再次调配');
const invalidated = store.getBatch(next.id);
assert(invalidated.resultState === '需重新生成' && invalidated.activeResultVersion === 'RESULT-20261006-V01', 'draft changes invalidate without replacing active snapshot');
assert(store.contract.getDailyForecast(next.id, siblings[0].childId, invalidated.forecastStartDate).ruleForecast === v1Daily, 'sales contract remains on V01 while draft changes');
store.generateForecast(next.id);
const generatedV2 = store.getBatch(next.id);
assert(generatedV2.resultSnapshots.length === 2 && generatedV2.activeResultVersion === 'RESULT-20261006-V02', 'regeneration creates V02 snapshot');
assert(generatedV2.resultSnapshots[0].rows.find(row => row.childId === siblings[0].childId).daily[generatedV2.forecastStartDate] === v1Daily, 'V01 result snapshot remains immutable');
assert(store.contract.getDailyForecast(next.id, siblings[0].childId, generatedV2.forecastStartDate).resultVersion === 'RESULT-20261006-V02', 'contract exposes active result version');
store.confirmForecast(next.id);
assert(store.getBatch(next.id).resultConfirmed && store.getBatch(next.id).status === '规则预测已确认', 'PMC confirmation freezes the active rule forecast for publication');
store.publishWindow(next.id, { submissionStartTime: '2026-10-06T09:00:00+08:00', submissionDeadlineTime: '2026-10-10T18:00:00+08:00', submissionFreezeTime: '2026-10-11T00:00:00+08:00' });
assert(store.getBatch(next.id).status === '销售填报中', 'window publish state');
store.freeze(next.id);
assert(store.getBatch(next.id).status === '已冻结' && store.getBatch(next.id).currentStep === 'review', 'freeze advances to review');
let frozenError = false;
try { store.updateParameters(next.id, { trendWindow: 14 }, '不应写入'); } catch (error) { frozenError = /冻结/.test(error.message); }
assert(frozenError, 'frozen batch write protection');
let incompleteError = false;
try { store.completeBatch(next.id, 0); } catch (error) { incompleteError = /PMC审核/.test(error.message); }
assert(incompleteError, 'final confirmation requires all child forecasts to pass PMC review');
store.completeBatch(next.id, store.getBatch(next.id).childForecastResults.length);
assert(store.getBatch(next.id).status === '已冻结' && store.getBatch(next.id).auditTimeline.at(-1).action === '确认冻结结果', 'final confirmation retains the frozen lifecycle state and audits the snapshot');
const snapshot = store.contract.getSnapshot(next.id);
snapshot.name = '外部修改不应回写';
assert(store.getBatch(next.id).name !== snapshot.name, 'immutable snapshot read');
const transient = model.createStore({ groups, forecastAt, actualAt }, null);
transient.confirmAssessment(transient.getCurrent().id);
assert(transient.getCurrent().status === '参数调整中', 'in-memory demo state mutates during session');
const refreshed = model.createStore({ groups, forecastAt, actualAt }, null);
assert(refreshed.getCurrent().status === '评估中' && refreshed.getCurrent().currentStep === 'assessment', 'refresh creates initial demo state');
refreshed.updateParameters(refreshed.getCurrent().id, { historyShareWindow: 60 }, '测试继承');
refreshed.saveSplitRule(refreshed.getCurrent().id, { id: 'SPLIT-TPL-DEFAULT', name: '测试自定义规则', historyWeight: 70, recentWeight: 30 });
const unInherited = refreshed.createNextBatch({ batchDate: '2026-10-06', inherit: { parameters: false, relations: false, split: false, combo: false, season: false }, country: 'US', platform: 'Amazon' });
assert(unInherited.parameterSnapshot.historyShareWindow === 84 && unInherited.splitRuleTemplates[0].name === '默认子体拆解', 'unchecked inheritance uses defaults rather than previous snapshots');
assert(unInherited.relationSnapshot.every(row => row.country === 'US' && row.platform === 'Amazon'), 'creation scope filters batch relations');
assert(refreshed.getBatch(current.id).parameterSnapshot.historyShareWindow === 84, 'parameter submission never overwrites the active source snapshot');
assert(refreshed.getBatch(current.id).pendingParameterSnapshot.historyShareWindow === 60, 'pending source parameters remain available for a future effective batch');

const preconfirm = model.createStore({ groups, forecastAt, actualAt }, null);
const preBatch = preconfirm.getCurrent();
const preParent = preBatch.parentForecastResults[0];
const preChildren = preBatch.childForecastResults.filter(row => `${row.country}|${row.store}|${row.parentASIN}` === preParent.key);
preconfirm.adjustShares(preBatch.id, preParent.key, Object.fromEntries(preChildren.map(row => [row.childASIN, row.finalShare])), '生成前核对份额');
assert(!preconfirm.getCurrent().relationConfirmed && !preconfirm.getCurrent().splitConfirmed, 'share editing is allowed before relationship confirmation without silently confirming it');
preconfirm.adjustChildForecast(preBatch.id, preChildren[0].childId, Object.values(preChildren[0].dailyFinalForecast).reduce((sum, value) => sum + value, 0), '生成前校准初始预测');
assert(preconfirm.getCurrent().resultState === '待生成', 'pre-generation adjustments remain editable drafts');

const sourceStore = model.createStore({ groups, forecastAt, actualAt }, null);
const sourceBatch = sourceStore.getCurrent();
const sourceParent = sourceBatch.parentForecastResults[0];
const septDate = '2026-09-29', octDate = '2026-10-01';
const initialSept = sourceParent.daily[septDate], initialOct = sourceParent.daily[octDate];
sourceStore.importReferenceSheets(sourceBatch.id, [{ type: 'parent', name: '父体标签结果', rows: [{ 国家: 'US', 父体ASIN: sourceParent.parentASIN, 历史数据截点: '2026-07-31', 当前月季节指数: 3 }] }], '父体标签结果.xlsx', { apply: true });
assert(sourceStore.getCurrent().parentForecastResults[0].daily[septDate] === initialSept, 'stale parent cutoff cannot overwrite current daily forecast');
assert(sourceStore.getCurrent().sourceReferences.parent.staleRows === 1 && sourceStore.getCurrent().sourceReferences.parent.appliedRows === 0, 'stale parent row is counted as skipped, not applied');
sourceStore.importReferenceSheets(sourceBatch.id, [{ type: 'season', name: '月度指数', rows: [{ 站点: 'US', 类型编码: 'F03', '9月': 0.5, '10月': 2 }] }], '季节指数.xlsx', { apply: true });
const seasonal = sourceStore.getCurrent();
assert(seasonal.sourceReferences.season.appliedRows === 1, 'matched monthly index is counted as applied');
assert(seasonal.parentForecastResults[0].daily[septDate] === Math.round(initialSept * 0.5), 'September uses the September index');
assert(seasonal.parentForecastResults[0].daily[octDate] === Math.round(initialOct * 2), 'October uses the October index');
assert(seasonal.childForecastResults.filter(row => `${row.country}|${row.store}|${row.parentASIN}` === sourceParent.key).reduce((sum, row) => sum + row.dailyFinalForecast[septDate], 0) === seasonal.parentForecastResults[0].daily[septDate], 'monthly index keeps child daily totals balanced');
sourceStore.importReferenceSheets(sourceBatch.id, [{ type: 'rules', name: '运行规则', rows: [{ 类型编码: 'F03', 重启动月: '8', 未启动预测展示: '人工启动（待实际销量）' }] }], '运行规则.xlsx', { apply: true });
assert(sourceStore.getCurrent().seasonRuleReview.length === 1 && !sourceStore.validateForecast(sourceBatch.id).passed, 'special seasonal restart must block ordinary numeric forecast generation');
assert(sourceStore.getCurrent().sourceReferences.rules.reviewRows === 1 && sourceStore.getCurrent().sourceReferences.rules.appliedRows === 0, 'special rule is counted as review, not numeric coverage');

const tagStore = model.createStore({ groups, forecastAt, actualAt }, null);
const tagBatch = tagStore.getCurrent();
tagStore.confirmRelations(tagBatch.id);
tagStore.confirmSplit(tagBatch.id);
tagStore.generateForecast(tagBatch.id);
const tagChild = tagStore.getCurrent().childForecastResults[0];
const originalTags = tagStore.getCurrent().resultSnapshots[0].rows[0].tags;
tagStore.updateChildTags(tagBatch.id, tagChild.childId, { stockTag: '畅款-备货' }, 'PMC人工复核');
assert(tagStore.getCurrent().resultState === '需重新生成', 'tag editing invalidates generated result');
assert(JSON.stringify(tagStore.getCurrent().resultSnapshots[0].rows[0].tags) === JSON.stringify(originalTags), 'historical snapshot tags stay immutable');
tagStore.generateForecast(tagBatch.id);
assert(tagStore.getCurrent().resultSnapshots[1].rows[0].tagOverrides.stockTag === '畅款-备货', 'new result version includes audited tag override');
tagStore.updateChildTags(tagBatch.id, tagChild.childId, {}, '撤销本批次人工标签');
assert(Object.keys(tagStore.getCurrent().childForecastResults[0].tagOverrides).length === 0, 'manual tag can be removed');
assert(JSON.stringify(tagStore.getCurrent().childForecastResults[0].tags) === JSON.stringify(originalTags), 'removing a manual tag preserves system labels');
console.log('forecast batch verification passed');
