# 预测工作台 V0.3.34

## 本轮范围

- 删除批次头部、版本和配置操作，以及表格右上角的周合计说明。
- 预测矩阵与销售预测填报统一表头、行色、边线、对齐、十字高亮、W周图标、周边界和分页位置。
- 日级列和左侧业务列支持拖拽与键盘调整列宽。
- 父ASIN集中展示SPU、平台/站点、店铺、销售和标签；子ASIN不再重复国旗、站点、店铺和销售。
- 父子树只保留编码与子体数量，表格标签不在树中重复。
- 复制图标仅在编码悬停/键盘聚焦时显示，不显示提示浮层。
- 删除周合计列；周标题仅显示W周次，收起时保留可重新展开的窄列。

## 验收

- `node --check forecast-workbench.js`
- `node --check verify-forecast-workbench-v033.cjs`
- `node verify-forecast-workbench-v033.cjs`
- `node verify-pmc-refinement-v032.cjs`
- `git diff --check`

浏览器验收覆盖菜单路由、删除项、父子层级、复制显隐、十字高亮、列宽拖拽、周折叠、指标切换、分页与无运行时告警。
