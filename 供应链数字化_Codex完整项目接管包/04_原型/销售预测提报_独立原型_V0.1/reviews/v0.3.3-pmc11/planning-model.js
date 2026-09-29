/* config12: immutable calculation references and batch-scoped relation snapshots. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PlanningDomain = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const sum = values => values.reduce((a, b) => a + b, 0);
  const groupKey = r => [r.platform, r.country, r.store, r.parent].join('|');
  const identity = r => [r.platform, r.country, r.store, r.child].join('|');
  const parentGroups = rows => Object.values(rows.reduce((acc, r) => { (acc[groupKey(r)] ||= []).push(r); return acc; }, {}));
  const now = () => new Date().toISOString();
  const fail = (test, message) => { if (!test) throw Error(message); };
  function distribute(weights, total = 10000) {
    fail(weights.length > 0 && weights.every(v => Number.isFinite(v) && v >= 0), '分配依据必须为非负数');
    const denom = sum(weights);
    fail(denom > 0, '没有可用的销量或比例，请为全部子体人工指定份额');
    const exact = weights.map(w => w / denom * total), result = exact.map(Math.floor);
    const order = exact.map((v, i) => ({ i, fraction: v - result[i] })).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
    const remainder = total - sum(result);
    for (let n = 0; n < remainder; n++) result[order[n % order.length].i]++;
    return result;
  }
  const totalsValid = rows => rows.length > 0 && parentGroups(rows).every(siblings => siblings.every(r => Number.isInteger(r.final) && r.final >= 0 && r.final <= 10000) && sum(siblings.map(r => r.final)) === 10000);
  const params = { history: 84, recent: 14, historyWeight: 70, recentWeight: 30, adu: 2, sellingDays: 10, growthHistory: 30, growthRecent: 10, lateHistory: 45, lateRecent: 20, season: 1, listing: 1 };
  function newRule(kind, p = params) {
    return { code: '', name: '', platform: 'Amazon', country: '全部', scope: '全部商品', tag: '', parent: '', scene: '普通父ASIN', priority: 100, enabled: true, effective: '2026-09-29', creator: 'PMC计划员', updatedAt: now(), method: '历史份额', history: p.history, recent: p.recent, historyWeight: p.historyWeight, recentWeight: p.recentWeight, abnormal: true, adu: p.adu, sellingDays: p.sellingDays, normalize: true, allowManual: true, floor: 5, fixed: '', changeDays: 30, lifecycle: '成长', forecastHistory: p.growthHistory, forecastRecent: p.growthRecent, forecastHistoryWeight: 40, forecastRecentWeight: 60, alpha: '0.10/0.20/0.35', season: p.season, listing: p.listing, clean: '剔除断货及活动异常日', kind };
  }
  function parseFixed(text) {
    const map = {};
    String(text || '').trim().split(/\n+/).filter(Boolean).forEach(line => {
      const match = line.trim().match(/^([A-Z0-9]{10})\s*[:：=]\s*(\d+(?:\.\d{1,2})?)\s*%?$/i);
      fail(match, '比例格式：子ASIN=百分比，每行一个，最多两位小数');
      fail(map[match[1].toUpperCase()] == null, '子ASIN比例重复');
      map[match[1].toUpperCase()] = Math.round(Number(match[2]) * 100);
    });
    fail(Object.keys(map).length > 0 && sum(Object.values(map)) === 10000, '固定/人工比例合计必须为100%');
    return map;
  }
  function validateRule(r) {
    fail(r.name?.trim() && r.code?.trim(), '请填写规则名称和编码');
    fail(Number.isInteger(r.priority) && r.priority >= 1, '优先级必须是大于0的整数');
    fail(/^\d{4}-\d{2}-\d{2}$/.test(r.effective), '请填写生效日期');
    const windows = r.kind === 'forecast' ? [r.forecastHistory, r.forecastRecent] : [r.history, r.recent];
    fail(windows.every(n => Number.isInteger(n) && n >= 1 && n <= 180), '观察周期必须是1～180天的整数');
    if (r.kind === 'forecast') {
      fail(r.forecastRecent <= r.forecastHistory, '近期周期不能超过历史周期');
      fail(r.forecastHistoryWeight >= 0 && r.forecastRecentWeight >= 0 && Math.abs(r.forecastHistoryWeight + r.forecastRecentWeight - 100) < 0.00001, '预测权重合计必须为100%');
      fail(/^0(?:\.\d+)?\/0(?:\.\d+)?\/0(?:\.\d+)?$/.test(r.alpha) && r.alpha.split('/').every(v => Number(v) <= 1), '动态α格式如0.10/0.20/0.35，范围0～1');
      fail(r.season > 0 && r.listing > 0, '季节和Listing系数必须大于0');
    } else {
      fail(r.recent <= r.history, '近期周期不能超过历史周期');
      if (r.method === '历史+近期加权' || r.abnormal) fail(r.historyWeight >= 0 && r.recentWeight >= 0 && Math.abs(r.historyWeight + r.recentWeight - 100) < 0.00001, '历史和近期权重合计必须为100%');
      if (r.abnormal || r.scene === '子ASIN低销量') fail(r.adu > 0 && Number.isInteger(r.sellingDays) && r.sellingDays >= 0 && r.sellingDays <= r.recent, '异常阈值无效：有销量天数不能超过近期周期');
      if (['固定比例', '人工指定比例'].includes(r.method)) { fail(/^[A-Z0-9]{10}$/.test(r.parent), '固定/人工比例规则必须指定父ASIN'); parseFixed(r.fixed); }
      if (r.method === '自定义规则') fail(Number.isFinite(r.floor) && r.floor >= 0 && r.floor <= 100, '历史份额保底须在0～100%之间');
      if (r.scene === '父子关系刚发生变化') fail(Number.isInteger(r.changeDays) && r.changeDays > 0, '关系变化观察天数必须大于0');
    }
    if (r.scene === '特定业务标签') fail(r.tag?.trim(), '请填写业务标签');
    return r;
  }
  function metrics(r, siblings, rule) {
    const count = (row, n) => sum(row.facts.slice(-n));
    const hTotal = sum(siblings.map(s => count(s, rule.history))), recentTotal = sum(siblings.map(s => count(s, rule.recent)));
    const hist = count(r, rule.history), recent = count(r, rule.recent), selling = r.facts.slice(-rule.recent).filter(v => v > 0).length;
    return { hist, recent, historyShare: hTotal ? hist / hTotal * 100 : 0, recentShare: recentTotal ? recent / recentTotal * 100 : 0, adu: recent / rule.recent, selling, hTotal, recentTotal };
  }
  function matchRule(rule, row, siblings, batch) {
    if (!rule.enabled) return '规则未启用';
    if (rule.effective > batch) return '尚未生效';
    if (rule.country !== '全部' && rule.country !== row.country) return '国家不匹配';
    if (rule.platform !== row.platform) return '平台不匹配';
    if (rule.parent && rule.parent !== row.parent) return '父ASIN不匹配';
    if (rule.scope !== '全部商品' && rule.scope !== row.productType) return '商品类型不匹配';
    if (rule.tag && !row.tags.includes(rule.tag)) return '业务标签不匹配';
    const m = metrics(row, siblings, rule);
    if (rule.scene === '新父体' && !row.isNew) return '不是新父体';
    if (rule.scene === '父子关系刚发生变化' && (row.changedDays == null || row.changedDays > rule.changeDays)) return '关系不在变化观察期内';
    if (rule.scene === '子ASIN低销量' && !(m.adu < rule.adu && m.selling <= rule.sellingDays)) return '不满足低销量且有销量天数阈值';
    if (rule.scene === '子ASIN近期波动明显' && Math.abs(m.recentShare - m.historyShare) < 10) return '近期份额变化未达到10个百分点';
    return '';
  }
  function calculate(rows, rules, batch) {
    const output = clone(rows), sorted = [...rules].sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code));
    parentGroups(output).forEach(siblings => {
      siblings.forEach(row => {
        let selected;
        row.matches = sorted.map(rule => {
          const reason = matchRule(rule, row, siblings, batch), hit = !reason && !selected;
          if (hit) selected = rule;
          return { code: rule.code, name: rule.name, priority: rule.priority, hit, reason: reason || (hit ? '条件满足，优先命中' : '条件满足，已有更高优先级规则命中') };
        });
        row.error = '';
        if (!selected) { row.error = '没有命中规则，请配置默认规则'; row.raw = 0; return; }
        row.ruleCode = selected.code; row.ruleName = selected.name;
        row.rule = clone(selected); row.metrics = metrics(row, siblings, selected);
        const m = row.metrics;
        row.unstable = m.adu < selected.adu && m.selling <= selected.sellingDays;
        row.raw = m.historyShare;
        if (selected.method === '近期份额') row.raw = m.recentShare;
        if (selected.method === '历史+近期加权' || (selected.method === '历史份额' && selected.abnormal && row.unstable)) row.raw = m.historyShare * selected.historyWeight / 100 + m.recentShare * selected.recentWeight / 100;
        if (selected.method === '自定义规则') row.raw = Math.max(m.historyShare, selected.floor);
        if (['固定比例', '人工指定比例'].includes(selected.method)) {
          const fixed = parseFixed(selected.fixed);
          if (fixed[row.child] == null) row.error = '指定比例缺少该子ASIN';
          row.raw = (fixed[row.child] || 0) / 100;
        }
        if (!m.hTotal && !['固定比例', '人工指定比例'].includes(selected.method)) row.error = '历史销量为0，请配置人工比例';
      });
      const rawTotal = sum(siblings.map(r => r.raw));
      const shares = rawTotal ? distribute(siblings.map(r => r.raw)) : siblings.map(() => 0);
      siblings.forEach((row, i) => { row.rawTotal = rawTotal; row.system = shares[i]; row.final = shares[i]; row.reason = ''; row.note = ''; });
      quantities(siblings);
    });
    return output;
  }
  function quantities(siblings) {
    const total = Math.round(sum(siblings.map(r => r.demandBasis)));
    const qty = sum(siblings.map(r => r.final)) > 0 ? distribute(siblings.map(r => r.final), total) : siblings.map(() => 0);
    siblings.forEach((row, i) => { row.parentQty = total; row.qty = qty[i]; });
  }
  function seed(source) {
    const base = newRule('split'), forecast = newRule('forecast');
    const splitRules = [{ ...base, code: 'S-DEFAULT', name: '普通父ASIN｜标准子体拆解', priority: 100 }, { ...base, code: 'S-CHANGE', name: '关系变更后30天特殊拆解', scene: '父子关系刚发生变化', priority: 10, history: 28, historyWeight: 50, recentWeight: 50, method: '历史+近期加权', abnormal: false }];
    const db = { schema: 12, revision: 0, rules: [{ id: 'Forecast-V3', kind: 'forecast', createdAt: '2026-09-01T09:00:00+08:00', rules: [{ ...forecast, code: 'F-GROW', name: '成长款父体预测', priority: 10 }, { ...forecast, code: 'F-LATE', name: '后期父体预测', lifecycle: '后期', forecastHistory: 45, forecastRecent: 20, forecastHistoryWeight: 30, forecastRecentWeight: 70, priority: 20 }] }, { id: 'Split-V2', kind: 'split', createdAt: '2026-09-01T09:00:00+08:00', rules: splitRules }], params: [{ id: 'Param-V4', createdAt: '2026-09-01T09:00:00+08:00', ...params, basis: 'Clean销量' }], versions: [], changes: [] };
    ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06'].forEach((batch, bi) => {
      const rows = source.flatMap((g, gi) => g.children.map((c, ci) => {
        const weights = g.children.length === 4 ? [40, 30, 20, 10] : g.children.length === 3 ? [46, 32, 22] : [58, 42];
        const facts = Array.from({ length: 180 }, (_, d) => Math.max(0, Math.round(weights[ci] / 3 + ((d + ci + bi) % 9 - 4))));
        if (ci === g.children.length - 1) facts.splice(-14, 14, ...Array.from({ length: 14 }, (_, i) => i % 3 === 0 ? 0 : 1));
        return { id: [g.platform, g.market, g.account, c.asin].join('|'), platform: g.platform, country: g.market, store: g.account, spu: g.spu, productType: '服饰', parent: gi === 0 && bi < 4 ? 'B0OLDPOOL1' : g.parent, child: c.asin, sellerSku: c.businessCode || c.sku, tags: [...g.tags, ci === g.children.length - 1 ? '小众尺码' : '标准尺码'], isNew: false, changedDays: gi === 0 && bi >= 4 ? 7 + (bi - 4) * 7 : null, demandBasis: Math.round((1000 - gi * 60) * weights[ci] / 100), facts, relationState: '平台同步' };
      }));
      const id = 'R' + batch.replaceAll('-', ''), status = bi < 4 ? '历史版本' : bi === 4 ? '已冻结' : '草稿';
      const version = { id, batch, effective: batch, platform: 'Amazon', country: 'US / UK', status, forecastId: 'Forecast-V3', splitId: 'Split-V2', paramId: 'Param-V4', createdAt: batch + 'T09:00:00+08:00', rows: calculate(rows, splitRules, batch) };
      db.versions.push(version);
      if (bi === 4) {
        const previous = db.versions[bi - 1];
        version.rows.filter(r => r.parent !== previous.rows.find(p => p.id === r.id)?.parent).forEach(r => {
          const old = previous.rows.find(p => p.id === r.id);
          db.changes.push({ id: 'seed-' + r.id, versionId: id, batch, country: r.country, store: r.store, child: r.child, from: old.parent, to: r.parent, before: old.final, after: r.final, type: '子ASIN更换父ASIN', reason: '父体Listing结构调整', note: '按新版本关系归集子ASIN历史销量', actor: 'PMC计划员', at: batch + 'T10:30:00+08:00' });
        });
      }
    });
    return db;
  }
  function createStore(source, storage, key = 'pmc-planning-config12') {
    let db = seed(source), error = '', listeners = new Set();
    try { const saved = storage?.getItem(key); if (saved) { const parsed = JSON.parse(saved); fail(parsed.schema === 12 && Array.isArray(parsed.versions) && Array.isArray(parsed.rules), '配置数据格式不兼容'); db = parsed; } } catch (e) { error = '配置读取失败，已停止写入：' + e.message; }
    const get = () => clone(db);
    function transact(fn) {
      fail(!error, error);
      const saved = storage?.getItem(key);
      if (saved) fail(JSON.parse(saved).revision === db.revision, '另一窗口已更新配置，请刷新后重试');
      const next = clone(db), result = fn(next);
      next.revision++;
      storage?.setItem(key, JSON.stringify(next));
      db = next; listeners.forEach(fn => fn()); return clone(result ?? null);
    }
    function version(next, id, editable = true) {
      const v = next.versions.find(v => v.id === id); fail(v, '关系版本不存在');
      if (editable) fail(v.status === '草稿', '仅草稿可修改，已生效或已冻结版本不能直接修改');
      return v;
    }
    function checkVersion(v) {
      fail(v.rows.length && totalsValid(v.rows), '每个父ASIN子体最终份额合计必须为100%');
      fail(v.rows.every(r => !r.error), v.rows.find(r => r.error)?.error || '计算依据不完整');
      fail(new Set(v.rows.map(identity)).size === v.rows.length, '同一国家店铺下子ASIN不能重复归属');
    }
    function log(next, v, old, row, type, reason, note = '') {
      next.changes.unshift({ id: 'C' + (next.changes.length + 1) + '-' + next.revision, versionId: v.id, batch: v.batch, country: (row || old).country, store: (row || old).store, child: (row || old).child, from: old?.parent || '', to: row?.parent || '', before: old?.final ?? null, after: row?.final ?? null, type, reason, note, actor: 'PMC计划员', at: now() });
    }
    const api = {
      get, error: () => error, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      saveRule(baseId, rule, originalCode) {
        validateRule(rule);
        return transact(next => {
          const base = next.rules.find(v => v.id === baseId); fail(base, '请选择规则版本');
          const updated = clone(base.rules); const index = updated.findIndex(r => r.code === originalCode);
          fail(!updated.some((r, i) => r.code === rule.code && i !== index), '规则编码重复');
          if (index >= 0) updated[index] = { ...rule, updatedAt: now() }; else updated.push({ ...rule, updatedAt: now() });
          const prefix = base.kind === 'forecast' ? 'Forecast-V' : 'Split-V';
          const n = Math.max(...next.rules.filter(v => v.kind === base.kind).map(v => Number(v.id.split('-V')[1]))) + 1;
          const created = { id: prefix + n, kind: base.kind, rules: updated, createdAt: now(), basedOn: baseId };
          next.rules.push(created); return created.id;
        });
      },
      saveParams(values) {
        validateRule({ ...newRule('split'), ...values, name: '参数', code: 'P', abnormal: true });
        fail([values.growthHistory, values.growthRecent, values.lateHistory, values.lateRecent].every(v => Number.isInteger(v) && v > 0 && v <= 180), '销售观察周期须为1～180天');
        fail(values.growthRecent <= values.growthHistory && values.lateRecent <= values.lateHistory && values.season > 0 && values.listing > 0, '请检查销售周期及系数');
        return transact(next => { const id = 'Param-V' + (Math.max(...next.params.map(p => Number(p.id.split('-V')[1]))) + 1); next.params.push({ ...values, id, createdAt: now(), basis: 'Clean销量' }); return id; });
      },
      createVersion(input) {
        return transact(next => {
          fail(/^\d{4}-\d{2}-\d{2}$/.test(input.batch), '请选择预测批次日期');
          fail(!next.versions.some(v => v.batch === input.batch), '该批次已绑定关系版本，请选择新的预测批次');
          const base = version(next, input.baseId, false), split = next.rules.find(r => r.id === input.splitId && r.kind === 'split');
          fail(split && next.rules.some(r => r.id === input.forecastId && r.kind === 'forecast') && next.params.some(p => p.id === input.paramId), '规则或参数版本不存在');
          fail(input.batch > base.batch, '新批次须晚于来源批次');
          const id = 'R' + input.batch.replaceAll('-', '');
          const rows = clone(base.rows).map(r => ({ ...r, changedDays: r.changedDays == null ? null : r.changedDays + Math.round((Date.parse(input.batch) - Date.parse(base.batch)) / 86400000) }));
          const v = { ...base, ...input, id, effective: input.batch, status: '草稿', createdAt: now(), rows: calculate(rows, split.rules, input.batch) };
          next.versions.push(v); return id;
        });
      },
      transition(id, target) {
        return transact(next => {
          const v = version(next, id, false), transitions = { '草稿': ['待确认'], '待确认': ['草稿', '已生效'], '已生效': ['已冻结'] };
          fail(transitions[v.status]?.includes(target), '不允许该状态转换，已冻结版本不能解冻改写');
          if (target !== '草稿') checkVersion(v);
          v.status = target; v.updatedAt = now(); return id;
        });
      },
      allocate(id, parent, shares, reason, note = '') {
        fail(reason?.trim(), '请选择调整原因');
        return transact(next => {
          const v = version(next, id), siblings = v.rows.filter(r => groupKey(r) === parent);
          fail(siblings.length, '父ASIN不存在');
          fail(siblings.every(r => r.rule?.allowManual !== false), '该父体命中规则不允许人工调配');
          const before = clone(siblings);
          siblings.forEach(r => { fail(Number.isFinite(shares[r.id]), '请填写全部子ASIN份额'); r.final = Math.round(shares[r.id] * 100); });
          fail(totalsValid(siblings), '当前父ASIN份额合计必须为100%');
          quantities(siblings);
          siblings.forEach((r, i) => { if (r.final !== before[i].final) { r.reason = reason; r.note = note; log(next, v, before[i], r, '份额调优', reason, note); } });
          return id;
        });
      },
      changeRelations(id, input) {
        fail(input.reason?.trim(), '请填写关系变更原因');
        return transact(next => {
          const v = version(next, id), before = clone(v.rows), affected = new Set();
          const selected = before.filter(r => input.ids?.includes(r.id));
          if (input.type === '新增子ASIN') {
            fail(/^[A-Z0-9]{10}$/.test(input.child || ''), '子ASIN须为10位大写字母或数字');
            const sibling = before.find(r => groupKey(r) === input.parentKey); fail(sibling, '请选择目标父体');
            const row = { ...clone(sibling), child: input.child, sellerSku: input.sellerSku, facts: Array(180).fill(0), demandBasis: 0, isNew: true, changedDays: 0, relationState: '新增子体' }; row.id = identity(row);
            fail(!before.some(r => r.id === row.id), '该子ASIN已在此国家店铺中存在');
            fail(input.sellerSku?.trim(), '请填写Seller SKU');
            v.rows.push(row); affected.add(groupKey(row));
          } else {
            fail(selected.length > 0, '请选择需要调整的子ASIN');
            selected.forEach(r => affected.add(groupKey(r)));
            if (input.type === '移除子ASIN') v.rows = v.rows.filter(r => !input.ids.includes(r.id));
            else {
              fail(/^[A-Z0-9]{10}$/.test(input.target || ''), '目标父ASIN须为10位大写字母或数字');
              fail(selected.every(r => r.parent !== input.target), '目标父ASIN不能与原父ASIN相同');
              fail(new Set(selected.map(r => [r.country, r.store, r.platform].join('|'))).size === 1, '关系迁移不能跨国家或店铺');
              if (input.type === '父ASIN拆分') fail(new Set(selected.map(groupKey)).size === 1 && selected.length < before.filter(r => groupKey(r) === groupKey(selected[0])).length, '拆分须选择同一父体的部分子体');
              v.rows.forEach(r => { if (input.ids.includes(r.id)) { r.parent = input.target; r.changedDays = 0; r.relationState = input.type; affected.add(groupKey(r)); } });
            }
          }
          fail(v.rows.length > 0, '至少保留一个父体预测池');
          const rules = next.rules.find(b => b.id === v.splitId).rules;
          const calculated = calculate(v.rows.filter(r => affected.has(groupKey(r))), rules, v.batch);
          v.rows = v.rows.map(r => calculated.find(c => c.id === r.id) || r);
          const changedIds = new Set([...before.filter(r => affected.has(groupKey(r))).map(r => r.id), ...calculated.map(r => r.id)]);
          changedIds.forEach(childId => {
            const old = before.find(r => r.id === childId), row = v.rows.find(r => r.id === childId);
            if (!old || !row || old.parent !== row.parent || old.final !== row.final) log(next, v, old, row, !old ? '新增子ASIN' : !row ? '移除子ASIN' : old.parent !== row.parent ? input.type : '关系变更后重算', input.reason, input.note);
          });
          return id;
        });
      },
      history(child, country = '', storeName = '') {
        return db.versions.filter(v => v.status !== '草稿' && v.status !== '待确认').flatMap(v => v.rows.filter(r => r.child === child && (!country || r.country === country) && (!storeName || r.store === storeName)).map(r => ({ ...clone(r), versionId: v.id, batch: v.batch, status: v.status }))).sort((a, b) => b.batch.localeCompare(a.batch));
      }
    };
    return api;
  }
  return { createStore, seed, newRule, validateRule, calculate, metrics, matchRule, distribute, totalsValid, parentGroups, groupKey, identity, parseFixed, clone, sum, params };
});
