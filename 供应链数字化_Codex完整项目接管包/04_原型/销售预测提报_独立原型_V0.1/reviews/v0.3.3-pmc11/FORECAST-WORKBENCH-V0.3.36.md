# 预测工作台 V0.3.36

## 本轮范围

- SPU不再永久显示；父ASIN悬停或键盘聚焦时通过Ant Design Tooltip显示对应SPU。
- 新增列表筛选区，统一使用现有Ant Design Select、Input、Button和SearchOutlined，支持平台、国家/站点、账号/店铺、销售负责人、预测状态及编码查询与重置。
- 表格新增Ant Design原生行选择；复选框操作不会打开ASIN详情抽屉。
- 普通表头、W周表头、日期表头、父子行、线条、字号、对齐与十字高亮改为销售预测填报同源值；W周折叠图标复用销售预测填报的方形加减SVG。
- 左侧国家节点改用与父ASIN相同的站点国旗SVG；保留ShopOutlined和同路径复制图标。
- 分页使用系统Ant Design Pagination，位于列表右下角，统计提示、20/50条选择和真实单页状态保持一致。

## 验收

- `node --check forecast-workbench.js`
- `node --check verify-forecast-workbench-v033.cjs`
- `node verify-forecast-workbench-v033.cjs`
- `node verify-pmc-refinement-v032.cjs`
- `git diff --check`

浏览器验收直接比较销售预测填报与预测工作台的普通表头、W周表头、日期表头和十字高亮计算样式，并覆盖筛选/重置、行选择、SPU悬停、复制图标、列宽拖拽、W周折叠、分页位置、父子ASIN抽屉及运行时错误。
