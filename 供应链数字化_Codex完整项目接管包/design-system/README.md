# 供应链项目 Design System

本目录是项目 UI 的正式规则来源。历史先上线的“销售预测”是规则提取用 Golden Reference；规则沉淀后，以本目录和共享代码为准，截图仅用于验证。

## 开发前必读

1. 根目录 `AGENTS.md`
2. `principles.md`
3. `tokens.md`
4. 与任务相关的组件规范
5. 与页面类型对应的 `patterns/` 文档

列表和工作台任务必须额外读取：

- `tables.md`
- `list-background.md`
- `icons.md`
- `patterns/workspace.md`
- `patterns/table-operation.md`

## 工程载体

- Ant Design Theme：`enterprise-theme.js`
- 共享 UI 合同：`window.EnterpriseUiStandards`
- 共享预测控件：`v033-controls.js`
- 共享 Token / 基础样式：`v033.css`
- Golden Reference：销售预测原生台账
- 首个迁移页面：预测工作台

## 变更规则

新增长期规则前先证明现有 Token、组件和 Pattern 无法覆盖，并在代码修改的同一版本更新本目录。页面级 Magic Number 不能成为新规范。

