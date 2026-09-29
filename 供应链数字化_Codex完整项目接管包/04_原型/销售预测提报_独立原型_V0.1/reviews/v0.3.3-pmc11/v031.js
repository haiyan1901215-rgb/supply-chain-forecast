/* V0.3.1: preserve manual widths while tightening fixed and date columns. */
(() => {
  const compactDateWidth = 72;
  const compactWeekWidth = 112;
  const compactLineWidth = 96;
  const compactIdentityWidth = 270;
  const compactIdentityVersion = '0.3.9-product-layout2';
  const compactIdentityVersionKey = 'pmc-forecast-identity-width-version';
  const inheritedWidth = columnWidth;
  const savedWidths = (() => {
    try {
      return JSON.parse(localStorage.getItem(columnWidthStorageKey) || 'null');
    } catch {
      return null;
    }
  })();

  columnWidth = function(key) {
    if (key.startsWith('date:')) {
      const saved = state.dateWidths[key.slice(5)];
      return Number.isFinite(saved) ? saved : compactDateWidth;
    }
    if (key.startsWith('week:')) {
      const saved = state.weekWidths[key.slice(5)];
      return Number.isFinite(saved) ? saved : compactWeekWidth;
    }
    return inheritedWidth(key);
  };

  const identityNeedsMigration = (() => {
    try { return localStorage.getItem(compactIdentityVersionKey) !== compactIdentityVersion; } catch { return true; }
  })();
  if (identityNeedsMigration || !savedWidths || !Number.isFinite(savedWidths.identity)) {
    setColumnWidth('identity', compactIdentityWidth);
    try { localStorage.setItem(compactIdentityVersionKey, compactIdentityVersion); } catch {}
  }
  if (!savedWidths || !Number.isFinite(savedWidths.line)) state.lineWidth = compactLineWidth;

  const inheritedApply = applyColumnWidths;
  applyColumnWidths = function() {
    inheritedApply();
    const table = $('.forecast-table');
    if (table) {
      table.dataset.densityVersion = '0.3.1';
      table.style.setProperty('--forecast-date-default-width', compactDateWidth + 'px');
      table.style.setProperty('--forecast-week-default-width', compactWeekWidth + 'px');
      table.style.setProperty('--forecast-identity-default-width', compactIdentityWidth + 'px');
    }
  };
  const inheritedRender = renderTable;
  renderTable = function() {
    inheritedRender();
    applyColumnWidths();
  };
  renderTable();
})();
