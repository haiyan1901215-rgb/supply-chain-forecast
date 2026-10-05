# Feedback

| 场景 | 组件 | 规则 |
|---|---|---|
| 操作成功 | Ant Message | 简短说明结果，单次最多一个 |
| 可恢复输入错误 | Form validation | 保留输入并定位字段 |
| 页面级错误 | Alert | 说明影响和下一步 |
| 高风险确认 | Modal.confirm | 明确对象、影响、主次按钮 |
| 轻量说明 | Tooltip | 只解释当前控件/字段 |
| 调整原因/构成 | Popover | 结构化展示，不阻断主流程 |
| Loading | Table loading / Spin | 保持表头和布局稳定 |
| Empty | Table/Empty | 说明为什么为空和如何处理 |

关闭行为遵循 Ant 默认 ESC 和关闭按钮；存在未保存输入时必须阻止静默丢失。

