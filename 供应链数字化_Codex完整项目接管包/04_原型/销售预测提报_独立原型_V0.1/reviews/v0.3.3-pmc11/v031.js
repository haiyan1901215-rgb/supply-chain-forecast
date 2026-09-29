/* V0.3.1: preserve manual widths while tightening fixed and date columns. */
(() => {
  const compactDateWidth = 72;
  const compactWeekWidth = 112;
  const compactLineWidth = 96;
  const compactIdentityWidth = 290;
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

  if (!savedWidths || !Number.isFinite(savedWidths.identity)) state.identityWidth = compactIdentityWidth;
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
