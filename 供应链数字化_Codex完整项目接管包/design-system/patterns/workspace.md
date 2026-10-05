# Workspace Pattern

适用于预测工作台、计划工作台等高频业务操作页。

```text
Portal shell
└── Workspace
    ├── Compact filters
    ├── Range and actions
    ├── Relationship tree (optional, collapsible)
    ├── Dense data table
    └── Pagination/status footer
```

规则：

1. 首屏直接进入业务工作区，不增加说明型 Hero。
2. 筛选、时间轴、数据表连续排列，间距 8-12px。
3. 关系树只负责筛选和定位，不复制主表所有操作。
4. 主表内部滚动；固定列、表头和分页保持稳定。
5. 配置使用 Drawer，详情使用 Drawer，简短确认使用 Modal。
6. 角色差异通过权限和操作显隐实现，不复制整套表格设计。

