/* Shared role lines and numeric/state semantics. No model calculation lives here. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ForecastLedgerValues = api;
})(typeof window === 'undefined' ? globalThis : window, function() {
  const waiting = '人工启动（待实际销量）';
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  const sum = values => { const numbers = values.filter(numeric); return numbers.length ? numbers.reduce((a, b) => a + b, 0) : null; };
  // The PMC calibration line remains part of the planning ledger. Sales only
  // receives the confirmed baseline and its own manual/activity inputs.
  const lines = { pmc: ['system', 'pmc', 'final'], sales: ['system', 'manual', 'activity', 'final'] };
  const labels = { system: '规则预测', pmc: 'PMC校准', manual: '人工预测', activity: '活动预测', final: '最终预测' };
  const sourceLabels = { system: '规则', manual: '人工', activity: '活动' };
  const sourceOf = forecast => forecast?.activity != null ? 'activity' : forecast?.manual != null ? 'manual' : 'system';
  const sourceOfMany = sources => sources.includes('activity') ? 'activity' : sources.includes('manual') ? 'manual' : 'system';
  const stateText = statuses => [...new Set(statuses.filter(Boolean))].join('；');
  return { waiting, numeric, sum, lines, labels, sourceLabels, sourceOf, sourceOfMany, stateText };
});
