# Components

## Button

- 默认使用 Ant `Button`。
- 主操作 `primary`，次操作 `default`，低强调操作 `text/link`，破坏性操作 `danger`。
- 同组按钮高度和间距一致；图标命令优先 Icon Button + Tooltip。

## Table

- 使用 `tables.md` 和 `list-background.md`。
- 业务层级复杂时允许原生 table 或 Ant Table，但必须消费同一语义 Token。
- 固定列、日期矩阵、预测线和列宽调整必须复用既有 Pattern。

## Filter

- 紧凑 Select/Input，支持 Enter 查询、清空、查询、重置。
- 基础条件先展示，高级条件按需折叠；不得为相同筛选语义重新设计控件。

## Modal / Drawer

- Modal 用于确认或需要聚焦完成的表单；Drawer 用于上下文详情、列配置和复杂辅助流程。
- Footer 顺序：左侧辅助操作，右侧取消、主操作。
- 表单提交显示 Loading，成功使用 Message，失败保留输入并显示错误。
- TextArea 计数器位于输入框内部，复用 `ForecastEditorStandards.countedTextAreaProps`。

## Tooltip / Popover

- Icon 功能名用 Tooltip。
- 调整原因、计算构成等结构化轻详情用 Popover。
- 不把主要业务操作隐藏在仅 hover 可见且无键盘入口的内容中。
- 人工/活动预测单元格统一复用 `ForecastEditableValue`：第一行展示 `entry-number + entry-edit-slot`，第二行展示相对基线的增减值并复用 `ForecastAdjustmentPopover`。父 ASIN 聚合行和子 ASIN 行不得采用不同结构。

## Empty / Loading / Error

- 表格 Empty 位于表体内，文案说明下一步。
- Loading 使用 Ant Spin/Table loading，不改变表头与列宽。
- Error 使用 Alert 或 Message；可恢复错误提供重试入口。
