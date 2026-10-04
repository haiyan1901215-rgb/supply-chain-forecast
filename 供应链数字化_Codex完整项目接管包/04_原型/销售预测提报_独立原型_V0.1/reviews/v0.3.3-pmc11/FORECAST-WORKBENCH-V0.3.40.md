# 预测工作台 V0.3.40

日期：2026-10-04

预览：http://127.0.0.1:8816/index.html?v=0.3.40-forecast-lines

## 本轮收口

- 子ASIN占比调整改为独立保存，不再自动重分配其他子ASIN；父ASIN显示实际合计，超过100%时使用红色文字和预警图标提醒。
- 占比编辑图标保持在数值右侧的稳定位置，与销售预测填报的编辑入口同源，不再覆盖数值。
- 恢复左侧变体树父/子ASIN的悬停操作；变体栏折叠后宽度为0，只保留22x36的贴边展开按钮。
- 变体列的展开/折叠入口放在“变体”标题右侧，不再推到列末端。
- 列配置补齐拖拽和键盘排序、置顶、固定/取消固定、移除、模板保存、精简模板和恢复默认。
- 销量、库存和FBA DOS合并为“销量 / 库存”上下文列，复用销售填报页指标网格层级，不再以独立业务列挤占日级预测空间。
- 新增固定“预测线”列，默认只显示最终预测；每个父/子ASIN可独立展开系统预测、人工预测、活动预测和最终预测。
- 子ASIN人工/活动预测直接复用销售填报编辑器；父ASIN使用同一编辑器，按当前子体占比精确分配到子ASIN。
- 最终预测优先级继续使用销售填报的同源规则：活动预测 > 人工预测 > 系统/PMC基线。
- 修复门户菜单`data-view`与销售台账内部视图的命名空间冲突；销售历史提报记录恢复可展开。

## 验证

- `verify-forecast-workbench-v040.cjs`：通过。覆盖占比独立编辑和超额预警、树节点操作、变体栏折叠、列配置、父/子ASIN预测线、人工/活动编辑和优先级。
- `verify-sales-initial-fill.cjs`：通过。销售预测初始填报状态和人工预测编辑未受影响。
- `verify-role-baseline.cjs`：通过。预测基线、重算、发布锁定和非数值状态通过。
- `verify-sales-batch-sync.cjs`：功能断言通过，包括批次发布、日级快照一致性、销售提交和批次隔离；菜单切换两次分别为1224ms和1236ms，未通过旧脚本1200ms的性能门槛，本轮未放宽标准。
- `node --check forecast-workbench.js v033-controls.js v024-core.js verify-forecast-workbench-v040.cjs verify-sales-initial-fill.cjs verify-sales-batch-sync.cjs`：通过。
- `git diff --check`：通过。
- 浏览器证据：`evidence/forecast-workbench-v040.png`。

## 设计系统合规

- 组件：PASS。继续使用Ant Design `Table / Tree / Drawer / Modal / Form / InputNumber / Pagination / Tooltip / Popover`。
- 主题：PASS。继续使用已有`enterpriseThemeV020`，未引入第二套基础组件系统。
- 交互：PASS。编辑、列配置、预警、页签和折叠均保留键盘、焦点和可访问名称。
- 定制：PASS（本轮增量）。未新增`!important`、未复制Ant Design源码，工作台复用销售填报的预测数据模型和编辑器。
