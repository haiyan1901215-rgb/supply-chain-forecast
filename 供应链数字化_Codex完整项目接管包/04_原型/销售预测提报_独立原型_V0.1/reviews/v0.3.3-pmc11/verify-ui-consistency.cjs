const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.47-workbench-table-governance';
const chrome = process.env.PLAYWRIGHT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const projectRoot = path.resolve(__dirname, '../../../..');

const requiredGuidelines = [
  'AGENTS.md',
  'design-system/README.md',
  'design-system/tokens.md',
  'design-system/icons.md',
  'design-system/components.md',
  'design-system/tables.md',
  'design-system/list-background.md',
  'design-system/patterns/workspace.md',
  'design-system/patterns/table-operation.md',
  'design-system/audits/sales-forecast-workbench.md'
];

const measureEmptyForecastEntry = locator => locator.evaluate(node => {
  const cell = node.closest('td').getBoundingClientRect();
  const icon = node.querySelector('.edit-icon').getBoundingClientRect();
  return {
    horizontalDelta: Math.abs((cell.left + cell.width / 2) - (icon.left + icon.width / 2)),
    verticalDelta: Math.abs((cell.top + cell.height / 2) - (icon.top + icon.height / 2))
  };
});

for (const relativePath of requiredGuidelines) {
  assert.ok(fs.existsSync(path.join(projectRoot, relativePath)), `缺少项目规范：${relativePath}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = [];
    const warnings = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
      if (message.type() === 'warning') warnings.push(message.text());
    });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(url, { waitUntil: 'networkidle' });

    const workbench = page.locator('.forecast-workbench-root');
    await workbench.waitFor();
    assert.equal((await page.locator('.ant-tabs-tab-active').innerText()).trim(), '预测工作台');
    assert.equal(await page.locator('.app-sider').getByText('计划配置', { exact: true }).count(), 0, '主菜单不得出现计划配置');

    const workbenchContract = await workbench.locator('.fpw-table').evaluate(node => {
      const headerRows = [...node.querySelectorAll('.ant-table-header thead tr')];
      const dayHeader = node.querySelector('th.fpw-day-header');
      const parentCell = node.querySelector('tr.fpw-parent-row td.fpw-identity-cell');
      const childFinal = node.querySelector('tr.fpw-child-row.fpw-prediction-final td.fpw-forecast-cell');
      const nextWeekCell = node.querySelector('th.fpw-day-header.fpw-week-boundary');
      const nextWeekHeader = node.querySelector('th.fpw-week-group.fpw-week-boundary');
      const nextWeekBody = node.querySelector('td.fpw-forecast-cell.fpw-week-boundary');
      const fixedBoundary = node.querySelector('th.fpw-fixed-boundary');
      const metricLabel = node.querySelector('.fpw-metric label');
      const metricValue = node.querySelector('.fpw-metric strong');
      const contextCell = node.querySelector('tr.fpw-child-row td.fpw-context-cell');
      const root = node.closest('.forecast-workbench-root');
      const rootStyle = getComputedStyle(root);
      const labelStyle = getComputedStyle(metricLabel);
      const valueStyle = getComputedStyle(metricValue);
      return {
        headerHeights: headerRows.map(row => Math.round(row.getBoundingClientRect().height)),
        dayWidth: Math.round(dayHeader.getBoundingClientRect().width),
        parentBackground: getComputedStyle(parentCell).backgroundColor,
        finalBackground: getComputedStyle(childFinal).backgroundColor,
        rowBorder: `${getComputedStyle(childFinal).borderBottomWidth} ${getComputedStyle(childFinal).borderBottomColor}`,
        weekBoundary: {
          weekHeader: `${getComputedStyle(nextWeekHeader).borderLeftWidth} ${getComputedStyle(nextWeekHeader).borderLeftColor}`,
          dayHeader: `${getComputedStyle(nextWeekCell).borderLeftWidth} ${getComputedStyle(nextWeekCell).borderLeftColor}`,
          body: `${getComputedStyle(nextWeekBody).borderLeftWidth} ${getComputedStyle(nextWeekBody).borderLeftColor}`,
          fixedRight: `${getComputedStyle(fixedBoundary).borderRightWidth} ${getComputedStyle(fixedBoundary).borderRightColor}`
        },
        fixedBoundaryShadow: getComputedStyle(fixedBoundary, '::after').boxShadow,
        metricLabel: [labelStyle.fontSize, labelStyle.fontWeight, labelStyle.color],
        metricValue: [valueStyle.fontSize, valueStyle.fontWeight, valueStyle.color],
        metricValueColors: [...new Set([...contextCell.querySelectorAll('.fpw-metric strong')].map(value => getComputedStyle(value).color))],
        metricSections: [...contextCell.querySelectorAll('.fpw-context-section')].map(section => {
          const style = getComputedStyle(section);
          const gridStyle = getComputedStyle(section.querySelector('.fpw-metric-grid'));
          return {
            key: section.dataset.section,
            title: section.querySelector('.fpw-context-section-title')?.textContent?.trim(),
            background: style.backgroundColor,
            padding: style.padding,
            radius: style.borderRadius,
            marginTop: style.marginTop,
            columns: gridStyle.gridTemplateColumns.split(' ').length,
            rowGap: gridStyle.rowGap,
            columnGap: gridStyle.columnGap
          };
        }),
        crossHighlight: rootStyle.getPropertyValue('--forecast-cross-color').trim(),
        focusBorder: rootStyle.getPropertyValue('--forecast-focus-border').trim(),
        standards: window.EnterpriseUiStandards
      };
    });

    assert.deepEqual(workbenchContract.headerHeights, [28, 34]);
    assert.equal(workbenchContract.dayWidth, 72);
    assert.equal(workbenchContract.standards.forecastTable.dayWidth, 72);
    assert.equal(workbenchContract.standards.forecastTable.weekTotalWidth, 112);
    assert.equal(workbenchContract.crossHighlight, 'rgba(31, 111, 235, .045)');
    assert.equal(workbenchContract.focusBorder, 'rgba(31, 111, 235, .18)');

    const workbenchWeekControl = workbench.locator('.fpw-week-title').first();
    const workbenchWeekGeometry = await workbenchWeekControl.evaluate(node => {
      const label = node.querySelector('strong').getBoundingClientRect();
      const button = node.querySelector('button').getBoundingClientRect();
      return { labelLeft: label.left, labelRight: label.right, buttonLeft: button.left, containerLeft: node.getBoundingClientRect().left };
    });
    assert.ok(workbenchWeekGeometry.buttonLeft >= workbenchWeekGeometry.labelRight, '工作台周折叠按钮必须在 W 标签右侧');
    assert.ok(workbenchWeekGeometry.buttonLeft - workbenchWeekGeometry.labelRight <= 10, '工作台周折叠按钮必须紧跟 W 标签');
    assert.ok(workbenchWeekGeometry.labelLeft - workbenchWeekGeometry.containerLeft <= 2, '工作台 W 周标题组必须保持左对齐');
    const workbenchForecastHeader = workbench.locator('th.fpw-line-header');
    const workbenchForecastGeometry = await workbenchForecastHeader.evaluate(node => {
      const title = node.querySelector('.fpw-resizable-title > span:first-child').getBoundingClientRect();
      const button = node.querySelector('.fpw-forecast-toggle').getBoundingClientRect();
      return { titleRight: title.right, buttonLeft: button.left };
    });
    assert.ok(workbenchForecastGeometry.buttonLeft >= workbenchForecastGeometry.titleRight, '工作台预测线按钮必须在标题右侧');
    assert.ok(workbenchForecastGeometry.buttonLeft - workbenchForecastGeometry.titleRight <= 10, '工作台预测线按钮必须紧跟标题');
    assert.equal(await workbench.locator('th.fpw-line-header .fpw-forecast-toggle').count(), 1, '工作台预测线只能保留一个表头级开关');
    assert.equal(await workbench.locator('tbody tr[data-row-key] .fpw-forecast-toggle').count(), 0, '父子ASIN行内不得重复出现预测线开关');

    const workbenchWeekToggle = workbench.locator('.fpw-week-title .fpw-week-toggle').first();
    await workbenchWeekToggle.click();
    assert.equal(await workbench.locator('.fpw-week-title .fpw-week-toggle').first().getAttribute('aria-expanded'), 'false');
    assert.match((await workbench.locator('.fpw-week-range-title').first().innerText()).trim(), /^\d{2}\/\d{2} ~ \d{2}\/\d{2}$/);
    await page.screenshot({ path: 'evidence/ui-consistency-week-collapsed.png', fullPage: false });
    await workbench.locator('.fpw-week-title .fpw-week-toggle').first().click();
    assert.equal(await workbench.locator('.fpw-week-title .fpw-week-toggle').first().getAttribute('aria-expanded'), 'true');

    const firstChild = workbench.locator('tr.fpw-child-row').first();
    const identityCell = firstChild.locator('td.fpw-identity-cell');
    const identityBackground = await identityCell.evaluate(node => getComputedStyle(node).backgroundColor);
    await identityCell.hover();
    assert.equal(await identityCell.evaluate(node => getComputedStyle(node).backgroundColor), identityBackground, '工作台非日期列 hover 不得染色');
    assert.equal(await workbench.locator('.fpw-cross-row, .fpw-cross-column, .fpw-cross-cell').count(), 0);

    const forecastCell = firstChild.locator('td.fpw-forecast-cell').first();
    await forecastCell.hover();
    const forecastCellImage = await forecastCell.evaluate(node => getComputedStyle(node).backgroundImage);
    assert.ok(forecastCellImage.includes('rgba(31, 111, 235'), `日期格应使用共享十字高亮：${forecastCellImage}`);
    assert.ok(await firstChild.locator('td.fpw-forecast-cell.fpw-cross-column').count() > 0);
    assert.equal(await firstChild.locator('td.fpw-identity-cell.fpw-cross-column').count(), 0);

    const hoverTargets = [
      workbench.locator('tr.fpw-child-row td.fpw-forecast-cell').nth(1),
      workbench.locator('tr.fpw-child-row td.fpw-forecast-cell').nth(3),
      workbench.locator('tr.fpw-parent-row td.fpw-forecast-cell').nth(2)
    ];
    let previousTarget = null;
    for (const target of hoverTargets) {
      await target.hover();
      assert.equal(await workbench.locator('tr.fpw-cross-row').count(), 1, '连续 hover 时只允许一个高亮行');
      assert.equal(await workbench.locator('td.fpw-cross-cell').count(), 1, '连续 hover 时只允许一个当前格');
      assert.ok(await workbench.locator('.fpw-cross-column').count() > 1, '当前日期列必须形成列高亮');
      assert.ok(await workbench.locator('tr.fpw-cross-row td.fpw-line-cell').evaluate(node => getComputedStyle(node).backgroundImage.includes('rgba(31, 111, 235')), '横向高亮必须贯穿预测线名称格');
      const crossColumnEdges = await workbench.locator('.fpw-cross-column').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return [Math.round(rect.left), Math.round(rect.right)];
      }));
      assert.equal(new Set(crossColumnEdges.map(edge => edge.join(':'))).size, 1, '纵向高亮的表头与数据格必须完整对齐，不得错位或截断');
      if (previousTarget) assert.equal(await previousTarget.evaluate(node => node.classList.contains('fpw-cross-cell')), false, '旧 hover 单元格必须立即清除');
      previousTarget = target;
    }
    await identityCell.hover();
    assert.equal(await workbench.locator('.fpw-cross-row, .fpw-cross-column, .fpw-cross-cell').count(), 0, '移入固定信息列后必须清除十字高亮');

    assert.equal(await workbench.getByRole('button', { name: '收起全部预测线' }).count(), 1, '工作台预测线必须默认展开');
    await workbench.getByRole('button', { name: '收起全部预测线' }).click();
    assert.equal(await workbench.getByRole('button', { name: '展开全部预测线' }).count(), 1, '收起后必须在原位替换为展开操作');
    await workbench.getByRole('button', { name: '展开全部预测线' }).click();
    await page.waitForTimeout(100);
    const workbenchEmptyEntries = {
      manual: await measureEmptyForecastEntry(workbench.locator('tr.fpw-child-row.fpw-prediction-manual .fpw-entry-empty').first()),
      activity: await measureEmptyForecastEntry(workbench.locator('tr.fpw-child-row.fpw-prediction-activity .fpw-entry-empty').first())
    };
    for (const [line, geometry] of Object.entries(workbenchEmptyEntries)) {
      assert.ok(geometry.horizontalDelta <= 1 && geometry.verticalDelta <= 1, `工作台 ${line} 空值编辑图标必须相对整个单元格居中：${JSON.stringify(geometry)}`);
    }
    const firstExpandedChildSystem = workbench.locator('tr.fpw-child-row.fpw-prediction-system').first();
    const firstExpandedChildManual = workbench.locator('tr.fpw-child-row.fpw-prediction-manual').first();
    const fixedBusinessCells = firstExpandedChildSystem.locator('td.fpw-identity-cell, td.fpw-share-cell, td.fpw-context-cell');
    const fixedBusinessBackgrounds = await fixedBusinessCells.evaluateAll(cells => cells.map(cell => getComputedStyle(cell).backgroundColor));
    await firstExpandedChildManual.locator('td.fpw-forecast-cell').first().hover();
    assert.deepEqual(await fixedBusinessCells.evaluateAll(cells => cells.map(cell => getComputedStyle(cell).backgroundColor)), fixedBusinessBackgrounds, '十字高亮不得越过预测线污染固定业务列');
    assert.ok(fixedBusinessBackgrounds.every(color => color === 'rgb(255, 255, 255)'), '子ASIN的变体、占比、销量 / 库存必须保持白底');
    const expandedRows = await workbench.locator('tr.fpw-child-row').evaluateAll(rows => {
      const entityKeyOf = row => row.getAttribute('data-row-key')?.replace(/\|(system|manual|activity|final)$/, '');
      const entityKey = entityKeyOf(rows[0]);
      return rows.filter(row => entityKeyOf(row) === entityKey).map(row => ({
        line: row.querySelector('.fpw-line-label')?.textContent?.trim(),
        height: Math.round(row.getBoundingClientRect().height),
        labels: row.querySelectorAll('.fpw-line-label').length
      }));
    });
    assert.deepEqual(expandedRows.map(row => row.line), ['规则预测', '人工预测', '活动预测', '最终预测']);
    assert.equal(await workbench.getByText('系统预测', { exact: true }).count(), 0, '工作台不得残留旧“系统预测”文案');
    assert.ok(expandedRows.every(row => row.labels === 1), '预测线必须是四个独立 tr');
    assert.deepEqual(expandedRows.map(row => row.height), [40, 54, 54, 55]);
    assert.equal(await workbench.getByText('(PMC)', { exact: true }).count(), 0);
    assert.ok(await workbench.getByText('(规则)', { exact: true }).count() > 0, '工作台最终预测来源应显示为规则');
    assert.equal(await workbench.getByRole('button', { name: '收起全部预测线' }).count(), 1, '展开后必须在表头原位替换为收起开关');

    const workbenchForecastColors = await workbench.locator('.fpw-table').evaluate(node => {
      const sourceHost = node.querySelector('.fpw-line-value.fpw-line-final');
      const sourceColor = className => {
        const probe = document.createElement('small');
        probe.className = className;
        sourceHost.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      return {
        manualLine: getComputedStyle(node.querySelector('.fpw-line-label.fpw-line-manual')).color,
        activityLine: getComputedStyle(node.querySelector('.fpw-line-label.fpw-line-activity')).color,
        manualSource: sourceColor('fpw-source-manual'),
        activitySource: sourceColor('fpw-source-activity')
      };
    });

    const childLineBackgrounds = await workbench.locator('tr.fpw-child-row').evaluateAll(rows => {
      const entityKeyOf = row => row.getAttribute('data-row-key')?.replace(/\|(system|manual|activity|final)$/, '');
      const entityKey = entityKeyOf(rows[0]);
      return rows.filter(row => entityKeyOf(row) === entityKey).map(row => ({
        line: [...row.classList].find(name => /^fpw-prediction-(system|manual|activity|final)$/.test(name))?.replace('fpw-prediction-', ''),
        colors: [...row.querySelectorAll('td.fpw-forecast-cell')].map(cell => getComputedStyle(cell).backgroundColor),
        token: getComputedStyle(row).getPropertyValue('--ui-color-bg-container').trim(),
        rowClasses: row.className,
        selectorMatches: row.querySelector('td.fpw-forecast-cell')?.matches('.forecast-workbench-root .fpw-table .ant-table-tbody > tr.fpw-prediction-system > td.fpw-forecast-cell')
      }));
    });
    for (const row of childLineBackgrounds) {
      const expected = 'rgb(255, 255, 255)';
      assert.ok(row.colors.length > 1 && row.colors.every(color => color === expected), `子ASIN ${row.line} 行不得出现周末条纹或单元格杂色：${JSON.stringify(row)}`);
    }
    const foregroundBackgrounds = await workbench.locator('tr.fpw-child-row .fpw-line-value, tr.fpw-child-row .fpw-entry-button').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
    assert.ok(foregroundBackgrounds.every(color => color === 'rgba(0, 0, 0, 0)'), '预测值与编辑按钮不得用白底遮断十字高亮');
    const workbenchHoverProof = workbench.locator('tr.fpw-child-row.fpw-prediction-manual td.fpw-forecast-cell').nth(1);
    await workbenchHoverProof.hover();
    assert.ok(await workbench.locator('tr.fpw-cross-row td.fpw-line-cell').evaluate(node => getComputedStyle(node).backgroundImage.includes('rgba(31, 111, 235')));
    await page.screenshot({ path: 'evidence/ui-consistency-workbench-hover.png', fullPage: false });

    await workbench.locator('tr.fpw-child-row.fpw-prediction-system .fpw-code-trigger').first().click();
    const detailDrawer = page.locator('.fpw-detail-drawer');
    await detailDrawer.waitFor();
    assert.equal(await workbench.locator('.fpw-selected-row').count(), 0, '打开详情抽屉不得给预测线叠加选中行双线');
    const drawerOpenShadows = await workbench.locator('tr.fpw-child-row td.fpw-forecast-cell').evaluateAll(cells => cells.map(cell => getComputedStyle(cell).boxShadow));
    assert.ok(drawerOpenShadows.every(shadow => !shadow.includes('1px 0px') && !shadow.includes('-1px 0px')), '抽屉打开后预测行不得出现蓝色上下双线');
    await page.screenshot({ path: 'evidence/ui-consistency-workbench-drawer.png', fullPage: false });
    await detailDrawer.locator('.ant-drawer-close').click();
    await detailDrawer.waitFor({ state: 'hidden' });

    const firstParent = workbench.locator('tr.fpw-parent-row').first();
    const parentLineBackgrounds = await workbench.locator('tr.fpw-parent-row').evaluateAll(rows => {
      const entityKeyOf = row => row.getAttribute('data-row-key')?.replace(/\|(system|manual|activity|final)$/, '');
      const entityKey = entityKeyOf(rows[0]);
      return rows.filter(row => entityKeyOf(row) === entityKey).map(row => ({
        line: [...row.classList].find(name => /^fpw-prediction-(system|manual|activity|final)$/.test(name))?.replace('fpw-prediction-', ''),
        colors: [...row.querySelectorAll('td.fpw-line-cell, td.fpw-forecast-cell')].map(cell => getComputedStyle(cell).backgroundColor)
      }));
    });
    for (const row of parentLineBackgrounds) {
      assert.ok(row.colors.length > 1 && row.colors.every(color => color === workbenchContract.parentBackground), `父ASIN ${row.line} 展开后必须保持聚合行底色：${JSON.stringify(row.colors)}`);
    }
    await page.mouse.move(1590, 890);
    assert.equal(await workbench.locator('.fpw-cross-row, .fpw-cross-column, .fpw-cross-cell').count(), 0, '移出表格后不得残留十字高亮');
    await page.screenshot({ path: 'evidence/ui-consistency-workbench.png', fullPage: false });

    await page.locator('[data-view="sales"][data-menu-origin="top-sales"]').click();
    const salesTable = page.locator('.forecast-table:visible');
    await salesTable.waitFor();
    assert.equal((await page.locator('.range-right').innerText()).includes('null'), false, '日期工具栏不得显示 null 占位文本');
    const salesForecastToggle = salesTable.locator('[data-forecast-toggle-button="all"]');
    if (await salesForecastToggle.getAttribute('aria-expanded') === 'true') {
      await salesForecastToggle.click();
      await page.waitForTimeout(100);
    }
    const salesContract = await salesTable.evaluate(node => {
      const headerRows = [...node.querySelectorAll('thead tr')].slice(0, 2);
      const dayHeader = node.querySelector('th.date-head');
      const parentCell = node.querySelector('tr.parent-row td.parent-band');
      const finalCell = node.querySelector('tr[data-forecast-line="final"] td.date-col');
      const nextWeekCell = [...node.querySelectorAll('th.date-head.week-boundary')].find(cell => parseFloat(getComputedStyle(cell).borderLeftWidth) > 0);
      const nextWeekHeader = [...node.querySelectorAll('th.week-head.week-boundary')].find(cell => parseFloat(getComputedStyle(cell).borderLeftWidth) > 0);
      const nextWeekBody = [...node.querySelectorAll('td.date-col.week-boundary')].find(cell => parseFloat(getComputedStyle(cell).borderLeftWidth) > 0);
      const fixedDivider = document.querySelector('#forecastFixedDivider');
      const metricLabel = node.querySelector('.metric label');
      const metricValue = node.querySelector('.metric strong');
      const contextCell = node.querySelector('tr[data-child-row] td.context-cell');
      const collapsedFinal = node.querySelector('tr.forecast-collapsed[data-forecast-line="final"]');
      const collapsedLine = collapsedFinal.querySelector('td.line-cell');
      const collapsedDate = collapsedFinal.querySelector('td.date-col');
      const collapsedValue = collapsedDate.querySelector('.final-value');
      const sourceColor = className => {
        const probe = document.createElement('span');
        probe.className = `source-tag ${className}`;
        collapsedValue.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      const labelStyle = getComputedStyle(metricLabel);
      const valueStyle = getComputedStyle(metricValue);
      return {
        headerHeights: headerRows.map(row => Math.round(row.getBoundingClientRect().height)),
        dayWidth: Math.round(dayHeader.getBoundingClientRect().width),
        parentBackground: getComputedStyle(parentCell).backgroundColor,
        finalBackground: getComputedStyle(finalCell).backgroundColor,
        rowBorder: `${getComputedStyle(finalCell).borderBottomWidth} ${getComputedStyle(finalCell).borderBottomColor}`,
        weekBoundary: {
          weekHeader: `${getComputedStyle(nextWeekHeader).borderLeftWidth} ${getComputedStyle(nextWeekHeader).borderLeftColor}`,
          dayHeader: `${getComputedStyle(nextWeekCell).borderLeftWidth} ${getComputedStyle(nextWeekCell).borderLeftColor}`,
          body: `${getComputedStyle(nextWeekBody).borderLeftWidth} ${getComputedStyle(nextWeekBody).borderLeftColor}`,
          fixedRight: `${getComputedStyle(fixedDivider).width} ${getComputedStyle(fixedDivider).backgroundColor}`
        },
        metricLabel: [labelStyle.fontSize, labelStyle.fontWeight, labelStyle.color],
        metricValue: [valueStyle.fontSize, valueStyle.fontWeight, valueStyle.color],
        metricValueColors: [...new Set([...contextCell.querySelectorAll('.metric strong')].map(value => getComputedStyle(value).color))],
        metricSections: [...contextCell.querySelectorAll('.context-section')].map(section => {
          const style = getComputedStyle(section);
          const gridStyle = getComputedStyle(section.querySelector('.metric-grid'));
          return {
            key: section.dataset.section,
            title: section.querySelector('.context-section-title')?.textContent?.trim(),
            background: style.backgroundColor,
            padding: style.padding,
            radius: style.borderRadius,
            marginTop: style.marginTop,
            columns: gridStyle.gridTemplateColumns.split(' ').length,
            rowGap: gridStyle.rowGap,
            columnGap: gridStyle.columnGap
          };
        }),
        forecastColors: {
          manualLine: getComputedStyle(node.querySelector('td.line-cell.line-manual')).color,
          activityLine: getComputedStyle(node.querySelector('td.line-cell.line-event')).color,
          manualSource: sourceColor('manual'),
          activitySource: sourceColor('activity')
        },
        collapsedFinal: {
          lineVerticalAlign: getComputedStyle(collapsedLine).verticalAlign,
          dateVerticalAlign: getComputedStyle(collapsedDate).verticalAlign,
          alignItems: getComputedStyle(collapsedValue).alignItems,
          justifyContent: getComputedStyle(collapsedValue).justifyContent,
          textAlign: getComputedStyle(collapsedValue).textAlign
        }
      };
    });

    assert.deepEqual(salesContract.headerHeights, workbenchContract.headerHeights, '两页双层表头高度必须一致');
    assert.equal(salesContract.dayWidth, workbenchContract.dayWidth, '两页日列宽度必须一致');
    assert.equal(salesContract.parentBackground, workbenchContract.parentBackground, '两页父ASIN背景必须一致');
    assert.equal(salesContract.finalBackground, workbenchContract.finalBackground, '两页最终预测背景必须一致');
    assert.equal(salesContract.finalBackground, 'rgb(255, 255, 255)', '两页最终预测行必须统一白底');
    assert.equal(salesContract.rowBorder, workbenchContract.rowBorder, '两页预测行网格线必须一致');
    assert.deepEqual(salesContract.weekBoundary, workbenchContract.weekBoundary, '预测线与首周之间只允许使用同一条周边界线');
    assert.equal(workbenchContract.fixedBoundaryShadow, 'none', '工作台固定区不得再叠加第二条分割阴影');
    assert.deepEqual(salesContract.metricLabel, workbenchContract.metricLabel, '两页销量/库存标签字号、字重和颜色必须一致');
    assert.deepEqual(salesContract.metricValue, workbenchContract.metricValue, '两页销量/库存数值字号、字重和颜色必须一致');
    assert.deepEqual(salesContract.metricValueColors, workbenchContract.metricValueColors, '工作台库存数值不得额外使用青色或橙色');
    assert.deepEqual(salesContract.metricSections, workbenchContract.metricSections, '两页销量/库存分区底色、间距、圆角和网格必须一致');
    assert.deepEqual(salesContract.forecastColors, workbenchForecastColors, '两页人工、活动预测及最终预测来源颜色必须一致');
    assert.deepEqual(salesContract.collapsedFinal, { lineVerticalAlign: 'top', dateVerticalAlign: 'top', alignItems: 'flex-start', justifyContent: 'flex-start', textAlign: 'left' }, '销售页收起态最终预测必须顶部左对齐');
    assert.ok(await salesTable.getByText('(规则)', { exact: true }).count() > 0, '销售填报最终预测来源应显示为规则');
    assert.equal(await salesTable.getByText('系统预测', { exact: true }).count(), 0, '销售填报不得残留旧“系统预测”文案');

    const salesWeekControl = salesTable.locator('.week-heading').first();
    const salesWeekGeometry = await salesWeekControl.evaluate(node => {
      const label = node.querySelector('span').getBoundingClientRect();
      const button = node.querySelector('button').getBoundingClientRect();
      return { labelLeft: label.left, labelRight: label.right, buttonLeft: button.left, containerLeft: node.getBoundingClientRect().left };
    });
    assert.ok(salesWeekGeometry.buttonLeft >= salesWeekGeometry.labelRight, '销售预测周折叠按钮必须在 W 标签右侧');
    assert.ok(salesWeekGeometry.buttonLeft - salesWeekGeometry.labelRight <= 10, '销售预测周折叠按钮必须紧跟 W 标签');
    assert.ok(salesWeekGeometry.labelLeft - salesWeekGeometry.containerLeft <= 2, '销售预测 W 周标题组必须保持左对齐');
    const salesForecastGeometry = await salesTable.locator('.forecast-line-heading').evaluate(node => {
      const title = node.querySelector('span').getBoundingClientRect();
      const control = node.querySelector('[data-forecast-toggle="all"]').getBoundingClientRect();
      return { titleRight: title.right, controlLeft: control.left };
    });
    assert.ok(salesForecastGeometry.controlLeft >= salesForecastGeometry.titleRight, '销售预测预测线按钮必须在标题右侧');
    assert.ok(salesForecastGeometry.controlLeft - salesForecastGeometry.titleRight <= 10, '销售预测预测线按钮必须紧跟标题');

    await salesTable.locator('.week-heading .week-toggle').first().click();
    assert.equal(await salesTable.locator('.week-heading .week-toggle').first().getAttribute('aria-expanded'), 'false');
    assert.match((await salesTable.locator('th.week-collapsed .week-period').first().innerText()).trim(), /^\d{1,2}\/\d{1,2} ~ \d{1,2}\/\d{1,2}$/);
    await salesTable.locator('.week-heading .week-toggle').first().click();

    if (await salesForecastToggle.getAttribute('aria-expanded') === 'false') {
      await salesForecastToggle.click();
      await page.waitForTimeout(100);
    }
    const salesEmptyEntries = {
      manual: await measureEmptyForecastEntry(salesTable.locator('tr[data-forecast-line="manual"] .entry-icon').first()),
      activity: await measureEmptyForecastEntry(salesTable.locator('tr[data-forecast-line="activity"] .entry-icon').first())
    };
    for (const line of ['manual', 'activity']) {
      assert.ok(salesEmptyEntries[line].horizontalDelta <= 1 && salesEmptyEntries[line].verticalDelta <= 1, `销售页 ${line} 空值编辑图标必须相对整个单元格居中`);
      assert.ok(Math.abs(workbenchEmptyEntries[line].horizontalDelta - salesEmptyEntries[line].horizontalDelta) <= 1 && Math.abs(workbenchEmptyEntries[line].verticalDelta - salesEmptyEntries[line].verticalDelta) <= 1, `两页 ${line} 空值编辑图标必须使用同一整格居中规则`);
    }
    const salesHoverProof = salesTable.locator('tr[data-child-row]:not([hidden]) td.date-col').nth(1);
    await salesHoverProof.hover();
    assert.equal(await salesTable.locator('tr.focus-cross-row').count(), 1, '销售预测只能保留一个十字高亮行');
    assert.equal(await salesTable.locator('td.focus-cross-cell').count(), 1, '销售预测只能保留一个当前格');
    const salesLineHighlight = await salesTable.locator('tr.focus-cross-row td.line-cell').evaluate(node => ({
      image: getComputedStyle(node).backgroundImage,
      token: getComputedStyle(node.closest('.forecast-table')).getPropertyValue('--forecast-cross-color').trim(),
      rowToken: getComputedStyle(node).getPropertyValue('--cross-row').trim()
    }));
    assert.notEqual(salesLineHighlight.image, 'none', `销售预测横向高亮必须贯穿预测线名称格：${JSON.stringify(salesLineHighlight)}`);
    assert.equal(salesLineHighlight.rowToken, salesLineHighlight.token, '销售预测十字高亮必须消费共享透明度 Token');
    const salesCrossColumnEdges = await salesTable.locator('.focus-cross-column').evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return [Math.round(rect.left), Math.round(rect.right)];
    }));
    assert.equal(new Set(salesCrossColumnEdges.map(edge => edge.join(':'))).size, 1, '销售预测纵向高亮必须完整对齐');
    await page.screenshot({ path: 'evidence/ui-consistency-sales-hover.png', fullPage: false });

    const salesIdentity = salesTable.locator('tbody td.identity-cell').first();
    const salesIdentityBackground = await salesIdentity.evaluate(node => getComputedStyle(node).backgroundColor);
    await salesIdentity.hover();
    assert.equal(await salesIdentity.evaluate(node => getComputedStyle(node).backgroundColor), salesIdentityBackground, '销售预测非日期列 hover 不得染色');
    await page.mouse.move(1590, 890);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'evidence/ui-consistency-sales-forecast.png', fullPage: false });

    assert.deepEqual(errors, [], `页面运行时错误：${errors.join('；')}`);
    assert.deepEqual(warnings, [], `页面运行时告警：${warnings.join('；')}`);
    console.log('Sales forecast / workbench UI consistency verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
