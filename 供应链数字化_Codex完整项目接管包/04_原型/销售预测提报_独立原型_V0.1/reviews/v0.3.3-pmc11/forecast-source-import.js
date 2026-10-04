/* Browser-side source workbook reader for the PMC batch workspace. */
window.ForecastSourceImport = (() => {
  const parentFields = '国家+父体ASIN,国家,父体ASIN,开卖时间,开卖天数,时间阶段,类型编码,商品类型,历史数据截点,预测开始日,预测日数,季节属性_实际使用,季节运行模式,毛利率,BSR排名,ADU窗口天数,近期窗口天数,全窗有效Clean天数,近期有效Clean天数,全窗Clean ADU,近期Clean ADU,近期窗回退全窗,初始化ADU0,当前Clean ADU0,去季节化日均销量,当前EWMA基准ADU,EWMA截止日状态,趋势状态_动态α,动态α,销量趋势变化率,市场变化率,相对市场表现,7天前相对市场表现,渠道级-趋势标签,趋势标签说明,渠道级-价值分级,价值标签说明,当前月季节指数,季节指数匹配状态,Listing适配系数,初始ADU0计算式,预测截止日'.split(',');
  const childFields = '国家,父体ASIN,子体ASIN,国家+子体ASIN,标准SKU,原标签,时间阶段,类型编码,商品类型,季节属性_实际使用,渠道级-价值分级,渠道级-趋势标签,渠道级-运营标签,88天历史份额,近14天Clean ADU,近14天有销量天数,低销量不稳定子体,近14天Clean份额,调和前份额,最终子体份额,未来90天预测ADU,未来90天预测销量,未来90天人工启动待实际天数,未来90天预测状态,FBA仓在库,FBA仓在途,FBA可用库存,FBA仓库存周转天数,FBA仓-库存标签'.split(',');
  const seasonFields = ['站点', '类型编码', '商品类型', ...Array.from({ length: 12 }, (_, index) => `${index + 1}月`)];
  const seasonRuleFields = '类型编码,季节运行模式,重启动月,销售月份,非销售月份,启动月季节系数,启动月季节来源,启动确认条件,未启动预测展示,非销售季最终预测,活动覆盖规则,执行备注'.split(',');
  const templates = { parent: { label: '父体标签结果', fields: parentFields, key: '父体ASIN' }, child: { label: '子体标签与90天预测结果', fields: childFields, key: '子体ASIN' }, season: { label: '季节大盘指数库', fields: seasonFields, key: '类型编码' }, rules: { label: '季节运行规则', fields: seasonRuleFields, key: '类型编码' } };
  const csvRows = text => {
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted; }
      else if (!quoted && (char === ',' || char === '\n' || char === '\r')) {
        row.push(cell); cell = '';
        if (char !== ',') { if (row.some(value => value !== '')) rows.push(row); row = []; if (char === '\r' && text[i + 1] === '\n') i += 1; }
      } else cell += char;
    }
    row.push(cell); if (row.some(value => value !== '')) rows.push(row);
    return rows;
  };
  const unzip = async buffer => {
    const bytes = new Uint8Array(buffer), view = new DataView(buffer), files = {};
    let end = bytes.length - 22;
    while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
    if (end < 0) throw Error('无效的 XLSX 文件');
    let offset = view.getUint32(end + 16, true);
    const count = view.getUint16(end + 10, true);
    for (let index = 0; index < count; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) throw Error('XLSX 文件目录损坏');
      const method = view.getUint16(offset + 10, true), size = view.getUint32(offset + 20, true), nameLength = view.getUint16(offset + 28, true), extra = view.getUint16(offset + 30, true), comment = view.getUint16(offset + 32, true), local = view.getUint32(offset + 42, true);
      const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength));
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      if (name.startsWith('xl/') && name.endsWith('.xml')) {
        const payload = bytes.slice(start, start + size);
        if (method === 0) files[name] = new TextDecoder().decode(payload);
        else if (method === 8) files[name] = await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
        else throw Error('暂不支持此 XLSX 压缩格式');
      }
      offset += 46 + nameLength + extra + comment;
    }
    return files;
  };
  const xml = text => new DOMParser().parseFromString(text, 'application/xml');
  const elements = (node, name) => [...node.getElementsByTagNameNS('*', name)];
  const decodeXml = value => String(value || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const regexSheetRows = (content, strings) => [...String(content || '').matchAll(/<(?:[A-Za-z0-9_]+:)?row\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?row>/g)].map(match => {
    const values = [];
    for (const cell of match[1].matchAll(/<(?:[A-Za-z0-9_]+:)?c\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?c>/g)) {
      const ref = cell[1].match(/\br="([A-Z]+)\d+"/i)?.[1] || 'A';
      let column = 0; for (const letter of ref) column = column * 26 + letter.toUpperCase().charCodeAt(0) - 64;
      const type = cell[1].match(/\bt="([^"]+)"/i)?.[1];
      const raw = cell[2].match(/<(?:[A-Za-z0-9_]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?v>/i)?.[1] || cell[2].match(/<(?:[A-Za-z0-9_]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?t>/i)?.[1] || '';
      values[column - 1] = type === 's' ? strings[Number(raw)] : decodeXml(raw);
    }
    return values;
  });
  const sheetRows = (content, strings) => {
    const doc = xml(content);
    return elements(doc, 'row').map(row => {
      const values = [];
      for (const cell of elements(row, 'c')) {
        const ref = cell.getAttribute('r') || 'A1';
        const letters = ref.match(/^[A-Z]+/)[0];
        let column = 0; for (const letter of letters) column = column * 26 + letter.charCodeAt(0) - 64;
        const raw = elements(cell, 'v')[0]?.textContent;
        values[column - 1] = cell.getAttribute('t') === 's' ? strings[Number(raw)] : cell.getAttribute('t') === 'inlineStr' ? elements(cell, 'is')[0]?.textContent : raw ?? '';
      }
      return values;
    });
  };
  const toObjects = rows => {
    const headerAt = rows.findIndex(row => row.includes('父体ASIN') || row.includes('子体ASIN') || row.includes('类型编码'));
    if (headerAt < 0) throw Error('没有找到受支持的表头');
    const headers = rows[headerAt].map(value => String(value || '').trim());
    const dateFields = new Set(['开卖时间', '历史数据截点', '预测开始日', '预测截止日']);
    const cellValue = (key, value) => {
      if (!dateFields.has(key) || !/^\d+(?:\.\d+)?$/.test(String(value))) return value ?? '';
      const date = new Date(Date.UTC(1899, 11, 30) + Number(value) * 86400000);
      return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
    };
    return rows.slice(headerAt + 1).filter(row => row.some(value => value != null && value !== '')).map(row => Object.fromEntries(headers.map((key, index) => [key, cellValue(key, row[index])]).filter(([key]) => key))).filter(row => {
      if ('子体ASIN' in row) return Boolean(row['国家'] && row['子体ASIN']);
      if ('父体ASIN' in row) return Boolean(row['国家'] && row['父体ASIN']);
      return /^[A-Z]\d{2}$/.test(String(row['类型编码'] || ''));
    });
  };
  const read = async file => {
    if (/\.csv$/i.test(file.name)) return [{ name: file.name, rows: toObjects(csvRows((await file.text()).replace(/^\uFEFF/, ''))) }];
    if (!/\.xlsx$/i.test(file.name)) throw Error('仅支持 .xlsx 或 .csv；旧版 .xls 请另存为 .xlsx');
    const files = await unzip(await file.arrayBuffer());
    const shared = files['xl/sharedStrings.xml'] ? [...files['xl/sharedStrings.xml'].matchAll(/<(?:[A-Za-z0-9_]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?si>/g)].map(match => decodeXml(match[1])) : [];
    const workbook = xml(files['xl/workbook.xml']);
    const sheets = elements(workbook, 'sheet');
    const rels = xml(files['xl/_rels/workbook.xml.rels']);
    const targets = Object.fromEntries(elements(rels, 'Relationship').map(node => [node.getAttribute('Id'), node.getAttribute('Target')]));
    return sheets.map((sheet, index) => {
      const relationshipId = sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      const target = targets[relationshipId];
      const resolvedPath = target?.startsWith('/') ? target.slice(1) : target ? `xl/${target}` : '';
      const path = files[resolvedPath] ? resolvedPath : `xl/worksheets/sheet${index + 1}.xml`;
      const rawRows = regexSheetRows(files[path] || '', shared);
      if (!rawRows.length) throw Error(`未读取到工作表 ${sheet.getAttribute('name')} 的数据`);
      return { name: sheet.getAttribute('name'), rows: toObjects(rawRows) };
    }).filter(sheet => sheet.rows.length);
  };
  const classify = sheet => {
    const headers = Object.keys(sheet.rows[0] || {});
    if (headers.includes('子体ASIN')) return 'child';
    if (headers.includes('父体ASIN')) return 'parent';
    if (headers.includes('重启动月')) return 'rules';
    if (headers.includes('1月') && headers.includes('12月')) return 'season';
    return null;
  };
  return { templates, read, classify };
})();
