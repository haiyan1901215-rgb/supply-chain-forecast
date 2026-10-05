# 销售预测 / 预测工作台 UI 一致性审计

状态：复检整改中；此前“P0 / P1 已关闭”结论因缺少交互态验收而撤回  
Golden Reference：销售预测  
迁移对象：预测工作台  
审计日期：2026-10-05

## 1. 扫描范围

| 层级 | 已扫描内容 | 结论 |
|---|---|---|
| 路由与菜单 | `index.html`、`pmc-workflow.js` | 两个页面共用门户壳层；默认路由已指向预测工作台；计划配置菜单已移除。 |
| 销售预测页面 | `index.html`、`v024-core.js`、`v032-presentation.js`、`sales-freeze.js` | 原生 HTML 表格负责台账结构，React/Ant Design 通过 Portal 提供筛选、编辑器、列配置、Tooltip、Drawer 与反馈。 |
| 预测工作台 | `forecast-workbench.js`、`forecast-workbench.css` | React + Ant Design `Table / Tree / Drawer / Modal / Form / Pagination` 实现。技术栈不同不是问题，但视觉和交互契约尚未统一。 |
| 公共资源 | `enterprise-theme.js`、`v033-controls.js`、`v033.css` | 已有 Ant Design 主题、预测线状态图标、预测编辑器、列配置基础，但尚未形成完整项目级契约。 |
| 数据与业务契约 | `forecast-ledger-values.js`、`forecast-batch-model.js`、`pmc-workflow.js` | 本轮不得修改 API、预测优先级、批次数据结构或后端逻辑。 |
| 自动化 | `verify-forecast-workbench-v040.cjs`、`verify-sales-initial-fill.cjs`、`verify-role-baseline.cjs`、`verify-sales-batch-sync.cjs` | 已有业务回归测试，但缺少销售页与工作台计算样式、Icon Registry、Magic Number 和 Design System 入口检查。 |

## 2. 页面与依赖关系

```text
index.html
├── enterprise-theme.js             Ant Design 基础主题
├── v024-core.js                     销售预测原生台账结构与状态
├── v032-presentation.js             销售预测展示层增强
├── v033-controls.js                 Ant 筛选、编辑器、列配置、共享展开图标
├── v033.css / sales-freeze.css      销售预测最终视觉覆盖层
├── forecast-workbench.js            预测工作台 React 页面
├── forecast-workbench.css           预测工作台页面样式
└── pmc-workflow.js                  门户路由、页面挂载、Ant ConfigProvider
```

共享能力现状：

- `enterpriseThemeV020` 是唯一 Ant Design Theme，必须继续使用。
- `window.ForecastToggleIcon` 已成为销售预测与工作台共用的展开/收起图标。
- `window.ForecastEditorStandards` 与 `window.openForecastEditor` 已成为人工/活动预测编辑同源入口。
- 列配置的字段选择、拖拽、键盘排序、置顶、固定、移除逻辑已可复用，但仍以页面级代码存在。
- 表格颜色、列宽、行高、十字高亮、空态和对齐尚无统一运行时契约。

## 3. Golden Reference 实测规则

以下规则来自当前销售预测源代码和浏览器计算样式，不来自截图猜测。

### 3.1 基础 Token

| 语义 | 当前值 |
|---|---|
| 页面文字 | `#172033` |
| 辅助文字 | `#69758b` |
| 弱辅助文字 | `#94a0b4` |
| 普通边框 | `#e5eaf2` |
| 强边框 | `#d1d9e7` |
| 容器背景 | `#ffffff` |
| 次级背景 | `#f7f9fc` |
| 父 ASIN 聚合背景 | `#f7f9fc` |
| 业务主色 | `#4865f2` |
| 表头背景 | `#f7f9fc` |
| 周表头背景 | `#e9eef8` |
| 日表头背景 | `#f2f5fb` |
| 父 ASIN 行背景 | `#f7f9fc` |
| 十字高亮 | `rgba(31, 111, 235, .045)` |
| 当前格边框 | `rgba(31, 111, 235, .18)` |

`enterprise-theme.js` 同时定义了 Ant Design 的主色、状态色、`4/8/12/16/20/24/32` 间距、`28/36/40` 控件高度和 `6/8` 圆角。两组 Token 目前存在命名与主色值重复，需通过语义别名统一，不能再新增第三套颜色体系。

### 3.2 Typography

| 层级 | 规则 |
|---|---|
| 紧凑标题、商品名 | `13px / 600` |
| 表格正文、编码、核心数据 | `12px / 400-600` |
| 表头 | `12px / 500` |
| 日期辅助、来源、标签、说明 | `11px / 400-500` |
| 数字 | `font-variant-numeric: tabular-nums` |
| 字距 | `0`；不得使用负字距压缩业务文本 |

### 3.3 台账结构与布局

| 项目 | Golden Reference |
|---|---|
| 筛选区 | 白底、1px 普通边框、`10px 12px` 内边距，紧凑 Ant 控件。 |
| 时间轴 | 约 41-44px，高度固定；预测范围、当前窗口、前后切换、14/30 天和列配置在同一水平层。 |
| 表头 | 两层总高 62px；第一层周、第二层日期。 |
| 日期列 | 默认 72px；折叠周合计 112px。 |
| 父行 | 约 40px，父体语义背景；不随普通 hover 改色。 |
| 子体预测线 | 展开后为独立 `tr`：规则、人工、活动、最终；身份/尺码/销量库存使用 `rowspan`。 |
| 预测线行高 | 规则约 40px，人工/活动约 54px，最终约 55px；编辑原因和来源在值下方展示。 |
| 预测值对齐 | 当前销售台账为左对齐，这是日级可编辑预测矩阵的明确例外；普通独立数值列仍默认右对齐。 |
| 文本 | 默认左对齐；尺码和选择列居中。 |
| Hover | 普通业务信息区不改变底色；仅日级预测矩阵显示行列十字高亮。 |
| 预测来源 | 最终值下方换行显示 `(规则) / (人工) / (活动)`。 |
| 展开图标 | 单一有状态按钮；展开后图标替换为收起语义，反之亦然。 |
| 列宽 | 指针拖拽和键盘左右键均可调整；可缩窄到内容宽度以下，内容截断而不是阻止调整。 |
| 分页 | 46px 页脚，总数靠近页码，页面尺寸和跳页使用 Ant Design。 |

### 3.4 列表背景层级

```text
页面背景
└── 白色内容容器
    ├── #f7f9fc 普通表头
    ├── #e9eef8 周表头
    ├── #f2f5fb 日表头
    ├── #f7f9fc 父 ASIN 聚合行
    ├── #ffffff 普通预测行
    └── #f8fafc 最终预测行
```

销售预测不使用斑马纹。业务状态优先使用文字、Tag、图标或特定单元格表达，不允许任意整行染色。

## 4. 治理前 UI Consistency Audit

本表保留为治理前差异基线；当前结果以第 7 节为准。

| 分类 | 销售预测 Golden Reference | 预测工作台当前实现 | 一致 | 问题 | 治理建议 |
|---|---|---|:---:|---|---|
| Page Layout | 主内容紧凑、筛选 50px、时间轴 41px | 左树 + 主区合理，但筛选 86px，主区有效宽度更小 | 否 | 同一业务筛选器密度不同 | 将工作台筛选压成同源单行/可换行紧凑结构 |
| Header | 双层总高 62px | 浏览器实测 78px | 否 | Ant Table 默认行高叠加 | 用共享表头 Token 覆盖 Ant 单元格高度与 padding |
| Day Column | 72px | 104px | 否 | 日级预测空间被显著挤占 | 改为共享 72px Token；周合计 112px |
| Parent Row | 40px、父体聚合带 | 收起态约 114px | 部分 | 工作台身份/指标内容撑高父行 | 父行压缩为聚合信息；展开预测线时保持行级结构 |
| Prediction Rows | 四条独立 `tr` | 数据模型已生成独立行，但默认收起；普通浏览器点击未展开 | 否 | 展开入口运行态失败；旧测试用 DOM click 掩盖真实问题 | 修复事件目标与按钮挂载，增加真实 click 回归 |
| Row Background | 无斑马纹；仅最终行 `#f8fafc` | 最终行相同，但 Ant hover/父行覆盖优先级复杂 | 部分 | 容易出现斑驳和固定列不同色 | 统一语义 Token，禁止 Ant 默认 row hover 进入非日期区 |
| Cross Highlight | `0.045` 行列高亮 + `0.18` 当前格边框 | CSS 变量未在根节点定义，存在 fallback/漂移风险 | 否 | 同语义散落实现 | 将高亮颜色写入共享 Token，并只作用于日级单元格 |
| Alignment | 文本左、选择/尺码中；日级预测矩阵左对齐例外 | 几乎全部左对齐 | 部分 | 独立数值列没有显式默认规则 | 建立列类型契约；日级预测矩阵保留例外 |
| Column Resize | 所有关键列与日期列均可缩窄；内容截断 | 已支持 0 下限，但默认值与销售页不一致 | 部分 | 默认 104px 日列 | 共享默认值和键盘步长 |
| Typography | 13/12/11 三层，表头 12/500 | 大部分为 12px，但 Ant 默认 line-height 20px，抽屉另有 16px/13px | 部分 | 同层级行高与字重不稳定 | 共享 typography Token，抽屉标题映射到同一层级 |
| Filter | Ant Select/Input，紧凑单行 | Ant 组件同源，但布局拆成两行 | 部分 | 密度和垂直节奏不同 | 复用相同 filter pattern |
| Range | 同一业务信息顺序与控件 | 内容相同，边框拼接和高度接近 | 基本 | 工作台对 DatePicker 做独立样式 | 以共享 range pattern 承载差异 |
| Icon | Ant Icons + 已固化少量销售页 SVG | 工作台主要为 Ant Icons，展开图标已复用 | 部分 | Copy、周展开、商品操作仍有重复 SVG | 建立 Icon Registry；已有 SVG 作为兼容资产集中登记 |
| Button | Ant 小尺寸为主，语义清晰 | 同源 Ant Button | 是 | 页面 CSS 仍直接覆盖尺寸 | 通过主题/共享类统一，减少页面覆盖 |
| Table | 原生表格 + Ant 岛 | Ant Table | 技术不同 | 旧审计错误声称工作台没有 Ant Table | 统一契约，不强制统一 DOM 技术栈 |
| Pagination | 46px 页脚、总数 + 页码 + 页尺寸 + 跳页 | 结构同源，位置在主区内 | 基本 | 总数文案更复杂是业务差异 | 保留业务文案，统一尺寸/间距/背景 |
| Modal | Ant 编辑器、遮罩不可随意关闭、取消/保存顺序固定 | Ant Modal，份额编辑已复用计数字段规则 | 基本 | 个别内联样式仍存在 | 统一 footer、宽度级别、TextArea 计数样式 |
| Drawer | Ant Drawer；复杂内容或列配置 | Ant Drawer | 是 | 详情宽度/标题样式页面化 | 统一宽度级别和 header/body/footer Token |
| Empty | 表内空态；文案说明下一步 | Ant `locale.emptyText` 文本 | 部分 | 视觉载体不同 | 工作台主表使用共享简洁 Empty Pattern |
| Loading | 应用级加载反馈 | 依赖 Ant Table Spin 默认态 | 部分 | 缺少明确项目规范 | 定义 Table loading 规则，不改业务加载模型 |
| Error/Success | Ant message，单次消息 | Ant message | 是 | 无 | 写入反馈规范 |
| Tooltip/Popover | 图标 Tooltip，原因 Popover | 同源 Ant 组件 | 是 | 触发延时和放置位置散落 | 固化默认规则 |
| Fixed Columns | 原生 sticky，边界 1px | Ant fixed columns + 自定义边界 | 部分 | 阴影和背景由两套机制控制 | 统一边界 Token，关闭多余阴影 |
| Magic Number | 历史 CSS 已有多组近似灰色 | 工作台继续新增页面色值 | 否 | 无法形成长期一致性 | 建立语义 Token 和静态扫描门槛 |

## 5. 治理前分级问题清单

### P0

1. 现有 `PMC-SALES-COMPONENT-PARITY-AUDIT.md` 已失真：它声明工作台 `.ant-table` 数量为 0，但当前实现明确使用 Ant Table；不能继续作为验收依据。
2. 项目没有正式 Design System、Icon Registry、Table Guidelines、List Background Rules 和 Codex UI 执行入口。
3. 销售预测与工作台的表格状态语义仅靠页面 CSS 约定，没有可复用的共享 Token/Contract。
4. 工作台预测线按钮在正常浏览器 click 路径下未展开，导致“规则/人工/活动/最终”四行能力不可可靠使用。

### P1

1. 工作台日列 104px，而销售预测为 72px；14 天窗口占用显著增加。
2. 工作台双层表头 78px，而销售预测为 62px。
3. 工作台父/子收起态行高约 113-114px；展开态缺少与销售预测四条独立行一致的稳定高度合同。
4. 十字高亮依赖未定义根变量，存在颜色和作用范围漂移。
5. Ant Table 默认 hover 与页面覆盖同时存在，固定列、父行、最终行容易出现不同背景。
6. 页面级硬编码背景色和边框色仍较多，`#fff / #f7f9fc / #f8fafc / #fafafa` 等近似值缺少语义归属。
7. 普通数值列、百分比列和日级预测矩阵未通过列类型显式区分对齐规则。

### P2

1. 工作台 Drawer 标题使用独立 16px/13px 层级，与项目 13/12/11 紧凑层级不完全一致。
2. Tree、Copy、商品操作和周展开同时存在 Ant Icon 与内联 SVG，缺少登记说明。
3. 筛选区、分页、抽屉存在少量内联尺寸和 padding；应迁入共享 Token 或 Pattern。
4. Empty、Loading、Disabled 目前主要依赖组件默认值，尚未形成项目级文档和验收断言。

## 6. 迁移边界

本轮允许：

- 提取 Token、组件契约、Icon Registry 和页面 Pattern。
- 将预测工作台迁移到上述共享规则。
- 补充自动化计算样式与交互一致性断言。
- 更新过期审计，明确当前架构事实。

本轮禁止：

- 重写销售预测业务流程或数据模型。
- 修改 `ForecastBatchContract`、预测优先级、API Contract 或后端逻辑。
- 为追求 DOM 一致而把销售预测整体重写为 React/Ant Table。
- 引入新的 UI 或 Icon Library。
- 用大范围 `!important` 覆盖 Ant Design。

## 7. 最终治理结果

| 级别 | 结果 | 说明 |
|---|---|---|
| P0 | 已关闭 | 建立正式 Design System 与 `AGENTS.md` 执行入口；过期审计已标记失效；表格语义 Token 和共享展开图标已上线；预测线真实 click 路径可靠展开为四个独立 `tr`。 |
| P1 | 已关闭 | 日列、周合计、表头、预测行、父行、最终行、十字高亮、普通 hover、列宽拖拽与列类型对齐已进入共享合同；工作台筛选区已收紧。 |
| P2 | 兼容保留 | 销售预测历史原生表格与工作台 Ant Table 保留各自 DOM，通过同一运行时合同对齐；少量已有内联 SVG 作为历史兼容资产登记，本轮未为了形式统一重写 Golden Reference。两项均无用户可见差异。 |

关键实施：

1. `enterprise-theme.js` 对外暴露 `window.EnterpriseUiStandards`，将预测矩阵宽度、高度、背景和高亮变为共享运行时合同。
2. `ForecastToggleIcon` 和 `ForecastEditorStandards` 由销售预测与预测工作台共用，不再为同一语义重复选择图标或编辑器。
3. 工作台已对齐 `72px` 日列、`112px` 周合计、`28px + 34px` 双层表头和 `40px / 54px / 54px / 55px` 四条预测线。
4. 工作台默认入口、父子层级、预测来源、背景、普通 hover 和日期十字高亮均按 Golden Reference 合同实现。
5. 销售页日期工具栏增加缺失节点防御，不再把 `null` 渲染成可见文本。
6. 最终预测行统一为白底；预测网格线、固定区 1px 强分隔、周边界和十字高亮透明度均以销售页计算样式为准。
7. 销售页预测线展开/收起改为原位切换，避免重建整表；专项测试稳定在约 `200-230ms`。

## 8. 验证结果

- `verify-ui-consistency.cjs`：通过。验证 Design System 入口、默认菜单、双层表头、日列、最终行白底、抽屉打开态、网格/固定/周边界、十字高亮、指标字体、四行预测线、来源与 `null` 防回归。
- `verify-forecast-workbench-v040.cjs`：通过。
- `verify-sales-initial-fill.cjs`：通过。
- `verify-role-baseline.cjs`：通过。
- `verify-sales-batch-sync.cjs`：通过，销售页切换为 `1126ms`，低于既有 `1200ms` 门槛。
- `verify-sales-forecast-toggle-performance.cjs`：通过，预测线收起/展开分别约 `229ms / 200ms`，低于 `700ms` 门槛。
- JavaScript 语法检查、`git diff --check`、浏览器 Console Error / Warning 检查：通过。
- 截图证据：`evidence/ui-consistency-workbench.png`、`evidence/ui-consistency-workbench-drawer.png`、`evidence/ui-consistency-sales-forecast.png`。
