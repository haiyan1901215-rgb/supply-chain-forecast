# Layouts

门户壳层保持统一：侧边导航、顶部页签、面包屑和业务工作区由现有 portal shell 管理。

业务工作台结构：

```text
Workspace
├── Context / Filter
├── Range / Toolbar
├── Main data region
│   ├── Optional relationship tree
│   └── Table / List
└── Pagination / Status footer
```

- 主工作区使用稳定高度并在数据区域内部滚动。
- 固定工具栏不得遮挡表格和分页。
- 侧栏折叠后宽度为 0，仅保留贴边展开按钮。
- 不把页面分区全部做成浮动 Card；筛选、工具栏和主表按连续工作流组合。

