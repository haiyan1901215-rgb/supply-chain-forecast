# Design Tokens

运行时权威来源是 `enterprise-theme.js` 中的 `enterpriseThemeV020` 与 `window.EnterpriseUiStandards`，CSS 通过 `v033.css` 中的语义变量消费。

## 命名层级

```text
基础值 -> 语义 Token -> 组件 Token -> 页面实现
```

页面不得绕过语义层直接复制颜色、行高、列宽或高亮值。

## 核心 Token

| 类型 | Token | 值 |
|---|---|---|
| Color | `color.text` | `#172033` |
| Color | `color.text.secondary` | `#69758b` |
| Color | `color.text.tertiary` | `#94a0b4` |
| Color | `color.border` | `#e5eaf2` |
| Color | `color.border.strong` | `#d1d9e7` |
| Color | `color.background.page` | `#eef2f7` |
| Color | `color.background.container` | `#ffffff` |
| Color | `color.primary.forecast` | `#4865f2` |
| Type | `font.size.xs` | `11px` |
| Type | `font.size.sm` | `12px` |
| Type | `font.size.md` | `13px` |
| Type | `font.size.lg` | `14px` |
| Type | `font.size.xl` | `16px` |
| Weight | `font.weight.regular` | `400` |
| Weight | `font.weight.medium` | `500` |
| Weight | `font.weight.semibold` | `600` |
| Spacing | `spacing.xxs/xs/sm/md/lg/xl/xxl` | `2/4/8/12/16/20/24px` |
| Radius | `radius.control/container` | `6/8px` |

## 预测台账 Token

| Token | 值 |
|---|---|
| `forecast.table.header` | `#f7f9fc` |
| `forecast.table.weekHeader` | `#e9eef8` |
| `forecast.table.dayHeader` | `#f2f5fb` |
| `forecast.table.parentRow` | `#f7f9fc` |
| `forecast.table.finalRow` | `#ffffff` |
| `forecast.table.weekend` | `#fafafa` |
| `forecast.table.headerText/dayHeaderText` | `#53658b / #4c5a76` |
| `forecast.table.parentText/manualText` | `#32405d / #3f5bdc` |
| `forecast.table.toggleBorder/toggleText` | `#acbad0 / #526078` |
| `forecast.table.resizeGuide` | `#aebbe5` |
| `forecast.table.crossHighlight` | `rgba(31, 111, 235, .045)` |
| `forecast.table.focusBorder` | `rgba(31, 111, 235, .18)` |
| `forecast.table.gridBorder` | `#e5eaf2` |
| `forecast.table.weekBoundary` | `#b4c3df` |
| `forecast.table.parentBoundary` | `#ced8eb` |
| `forecast.table.dayWidth` | `72px` |
| `forecast.table.weekTotalWidth` | `112px` |
| `forecast.table.headerHeight` | `62px` |
| `forecast.table.systemRowHeight` | `40px` |
| `forecast.table.editableRowHeight` | `54px` |
| `forecast.table.finalRowHeight` | `55px` |
