/* V0.3.0: compact defaults only; user-adjusted widths remain authoritative. */
(() => {
  const compactDateWidth = 96;
  const compactWeekWidth = 120;
  const compactLineWidth = 96;
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

  /* V0.2.9 used 108px as the line-column default. A stored value means the user
     has interacted with the resizer, so it must remain unchanged. */
  if (!savedWidths || !Number.isFinite(savedWidths.line)) state.lineWidth = compactLineWidth;

  const inheritedApply = applyColumnWidths;
  applyColumnWidths = function() {
    inheritedApply();
    const table = $('.forecast-table');
    if (!table) return;
    table.dataset.densityVersion = '0.3.0';
    table.style.setProperty('--forecast-date-default-width', compactDateWidth + 'px');
    table.style.setProperty('--forecast-week-default-width', compactWeekWidth + 'px');
  };

  const inheritedRender = renderTable;
  renderTable = function() {
    inheritedRender();
    applyColumnWidths();
  };

  renderTable();
})();
