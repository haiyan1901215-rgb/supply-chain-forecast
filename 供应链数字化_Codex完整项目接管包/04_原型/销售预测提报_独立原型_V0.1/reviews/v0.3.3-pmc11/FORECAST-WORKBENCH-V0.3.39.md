# 预测工作台 V0.3.39

日期：2026-10-04

预览：http://127.0.0.1:8816/index.html?v=0.3.39-interaction-parity

## 本轮收口

- 系统默认打开「预测工作台」，不再默认进入销售预测。
- 变体表头的一键展开/收起与父ASIN行的单组展开/收起，直接对照销售预测填报的SVG路径、视口和线宽；父体按钮使用 `12x12 / stroke-width 1.3`。
- 父/子ASIN编码本身直接打开右侧抽屉，不再增加独立详情图标；抽屉保留预测依据、子体拆分、父子关系和销售组合四个页签。
- 销量和FBA表头统一为字段提示交互，分组表头、子字段及数值统一左对齐。
- 左侧变体树不显示子ASIN数量，子节点不保留绑定管理入口；只在变体标题右侧保留「变体关系管理」。
- 变体关系管理使用门户可关闭工作页签，可与预测工作台并存、切换和通过 `x` 关闭。
- 父ASIN占比显示子体合计 `100.00%`；子ASIN占比悬停显示同源编辑图标，保存必填原因，其他子体自动平衡且合计严格保持100%，后续悬停可查看系统占比、最终占比和调整原因。
- 工作台右上角保留与销售预测填报一致的 `SettingOutlined` 列配置入口，默认/精简模板和恢复默认均可用。

## 验证

- `verify-forecast-workbench-v039.cjs`：通过。浏览器回归直接读取销售预测填报的SVG并与工作台比较，同时覆盖默认菜单、编码抽屉、占比编辑、列配置和多页签关闭。
- `verify-role-baseline.cjs`：通过。
- `node --check forecast-workbench.js pmc-workflow.js v031-workspace.js verify-forecast-workbench-v039.cjs`：通过。
- `git diff --check`：通过。
- 浏览器截图：`evidence/forecast-workbench-v039.png`。

## 设计系统合规

- 组件：PASS。继续使用Ant Design `Table / Tree / Tabs / Drawer / Modal / Form / Tooltip / Popover / Pagination`。
- 主题：PASS。继续使用已有 `enterpriseThemeV020`。
- 交互：PASS。页签、表单校验、抽屉、列配置都保留Ant Design原生键盘和焦点行为。
- 定制：PASS（本轮增量）。未新增 `!important`或Ant Design内部DOM定制；表格外观继承当前销售预测原型已存在的历史样式层。

