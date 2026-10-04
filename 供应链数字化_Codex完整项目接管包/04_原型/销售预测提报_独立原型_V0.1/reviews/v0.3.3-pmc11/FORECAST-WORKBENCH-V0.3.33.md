# 预测工作台 V0.3.33

## 本轮范围

- 在一级菜单中新增“预测工作台”，位于“销售预测”之前；原销售预测、备货计划、调拨计划和计划配置入口保持不变。
- 以附件原型的“父子ASIN树 + W周预测矩阵”为结构参考，复用当前门户壳层、Ant Design组件、企业主题、销售预测的表格密度及图标体系。
- 工作台继续读取现有 `groups`、`forecastAt` 和 `ForecastBatchContract`，未新建第二套预测数据或覆盖销售填报逻辑。

## 页面结构

- 批次标题、预测周期、版本快照和批次动作。
- 国家 -> 父ASIN -> 子ASIN树，支持搜索、展开/收起和定位预测行。
- 父子层级预测矩阵，保留近30天销量、FBA、DOS、W周和日级预测。
- 支持周内展开、收起到周合计，以及系统预测、人工校准、最终销售预测口径切换。
- 底部分页使用现有Ant Design分页规范；打开销售填报和批次配置均复用既有路由。

## 一致性边界

- 不复制销售预测填报的编辑能力，不改变其字段、优先级和数据合同。
- 不新增卡片式Dashboard、独立配置中心或另一套基础组件。
- 左侧业务列形成连续固定区域，横向滚动只发生在预测矩阵内部。

## 验收

- `node --check forecast-workbench.js`
- `node --check pmc-workflow.js`
- `node verify-forecast-workbench-v033.cjs`
- `node verify-pmc-refinement-v032.cjs`
- `git diff --check`
