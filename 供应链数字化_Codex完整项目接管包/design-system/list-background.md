# List / Table Background Rules

| 状态 | Token / 规则 | 页面可自定义 |
|---|---|:---:|
| Page | `background.page` | 否 |
| Container/List | `background.container` | 否 |
| Table Header | `forecast.table.header` 或 Ant Table Token | 否 |
| Week Header | `forecast.table.weekHeader` | 否 |
| Day Header | `forecast.table.dayHeader` | 否 |
| Row Default | `#ffffff` | 否 |
| Parent Row | `forecast.table.parentRow` | 否 |
| Final Forecast Row | `forecast.table.finalRow` | 否 |
| Hover | 普通行保持默认；预测矩阵使用十字高亮 | 否 |
| Selected | Ant Theme selected token 或明确边框 | 否 |
| Disabled | Ant Theme disabled token | 否 |
| Warning/Error/Success | Tag/Icon/文字优先，原则上不染整行 | 原则上否 |
| Empty | 容器白底 | 否 |

边框使用 `color.border`，固定区和周边界使用 `color.border.strong`。禁止新增斑马纹、无语义近似灰色或页面级整行状态底色。

预测矩阵正文不得因为周末产生列底色。子 ASIN 展开后，规则/人工/活动预测行均使用 `Row Default`，最终预测行也统一为白色 `Final Forecast Row`。父 ASIN 属于聚合区，无论预测线收起或展开，身份、预测线与日期区域都保持 `Parent Row`，不得因展开状态形成左右两块底色。十字高亮是临时叠加状态，不得改变上述基础背景层级。
