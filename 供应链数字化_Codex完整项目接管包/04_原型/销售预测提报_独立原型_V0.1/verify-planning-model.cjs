const assert = require('node:assert/strict');
const PD = require('./reviews/v0.3.3-pmc11/planning-model.js');

const memory = () => {
  const data = new Map();
  return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) };
};
const source = [{
  platform: 'Amazon', market: 'US', account: 'BRABIC-US', parent: 'B0PARENT01', spu: 'C0001', tags: ['畅款'],
  children: [
    { asin: 'B0CHILD001', sku: 'SKU001', businessCode: 'N0C0001A-91-S' },
    { asin: 'B0CHILD002', sku: 'SKU002', businessCode: 'N0C0001A-91-M' },
    { asin: 'B0CHILD003', sku: 'SKU003', businessCode: 'N0C0001A-91-L' }
  ]
}];

const storage = memory(), store = PD.createStore(source, storage, 'test-planning-config12');
let db = store.get();
assert(PD.totalsValid(db.versions.find(v => v.id === 'R20261021').rows));
const frozenBefore = JSON.stringify(db.versions.find(v => v.id === 'R20261021'));

const newId = store.createVersion({ baseId: 'R20261028', batch: '2026-11-04', forecastId: 'Forecast-V3', splitId: 'Split-V2', paramId: 'Param-V4' });
assert.equal(newId, 'R20261104');
db = store.get();
let draft = db.versions.find(v => v.id === newId), siblings = draft.rows;
const shares = Object.fromEntries(siblings.map((r, i) => [r.id, [50, 30, 20][i]]));
store.allocate(newId, PD.groupKey(siblings[0]), shares, '尺码结构变化', '验证人工调配');
draft = store.get().versions.find(v => v.id === newId);
assert.equal(draft.rows.reduce((n, r) => n + r.final, 0), 10000);
assert.equal(draft.rows.reduce((n, r) => n + r.qty, 0), draft.rows[0].parentQty);

store.changeRelations(newId, { type: '子ASIN更换父ASIN', ids: [draft.rows[0].id], target: 'B0NEWPOOL1', reason: '父体Listing结构调整', note: '验证迁移' });
draft = store.get().versions.find(v => v.id === newId);
assert(PD.totalsValid(draft.rows));
assert.equal(draft.rows.find(r => r.id === siblings[0].id).parent, 'B0NEWPOOL1');
assert.equal(JSON.stringify(store.get().versions.find(v => v.id === 'R20261021')), frozenBefore, '历史快照不得因新批次操作改变');

store.transition(newId, '待确认');
store.transition(newId, '已生效');
store.transition(newId, '已冻结');
assert.equal(store.get().versions.find(v => v.id === newId).status, '已冻结');
assert.throws(() => store.allocate(newId, PD.groupKey(draft.rows[0]), shares, '其他'), /仅草稿可修改/);
assert.throws(() => store.transition(newId, '草稿'), /已冻结版本不能解冻改写/);

const splitBefore = JSON.stringify(store.get().rules.find(v => v.id === 'Split-V2'));
const baseRule = PD.clone(store.get().rules.find(v => v.id === 'Split-V2').rules[0]);
const nextRule = store.saveRule('Split-V2', { ...baseRule, name: '标准拆解优化', history: 56 }, baseRule.code);
assert.equal(nextRule, 'Split-V3');
assert.equal(JSON.stringify(store.get().rules.find(v => v.id === 'Split-V2')), splitBefore, '旧规则版本不得被覆盖');
assert.equal(store.get().rules.find(v => v.id === 'Split-V3').rules[0].history, 56);

assert.equal(PD.distribute([1, 1, 1]).reduce((a, b) => a + b, 0), 10000);
assert.equal(PD.distribute([1, 1, 1], 1001).reduce((a, b) => a + b, 0), 1001);
console.log('verify-planning-model: PASS');
