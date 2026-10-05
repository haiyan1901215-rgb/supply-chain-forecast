# 供应链数字化项目 Codex 工作规则

## 1. 项目定位
这是一个跨境电商服饰企业的供应链数字化 0→1 项目。当前阶段目标不是一次性建设所有供应链系统，而是围绕真实业务主链，先完成业务事实、对象、单据、系统边界、数据流和MVP验证，再进入原型与PRD。

## 2. 当前业务优先级（项目输入，不得擅自改写）
1. MES：已有外采源码系统，当前重点是Bug修复、微调、现场排查与推广使用，不默认重做。
2. PMC计划：当前阶段重点，核心是把现有人工计划工作线上化。
3. SCM：已有下单等模块，业务已使用；当前主要问题是与其他系统未完成串联，需先盘点后决定重构范围。
4. 面辅料：能力基本空白，暂不预设独立系统或SCM内置，必须基于业务对象、单据、数据Owner和流程边界判断。
5. 全流程库存：与PMC强关联，需要逐步线上化；此前其他公司的库存方案只能作为方法参考，不能当作本公司的事实或规则。

## 3. 分析原则
- 事实、业务规则、产品推断、待确认问题必须分开。
- 原始业务材料优先于历史推断；最新已确认业务结论优先于旧结论。
- 不要因为“行业常见做法”而替业务补规则。
- 不要把“系统名”直接等同于业务边界。
- 每次新增会议材料都要检查与历史结论的冲突。
- 业务没有确认的内容标记【待确认】，不能伪装成已确认事实。
- 原始材料只读，不覆盖。
- 历史分析允许修订，但保留版本与变更说明。

## 4. 原型原则
原型首先用于业务验证，不等于开发方案。优先做能让业务带入真实场景的验证型原型。原型修改前先更新事实/规则/决策记录。

## 5. 输出顺序
原始材料 → 事实矩阵 → As-Is → 业务对象与单据 → 系统边界与数据流 → 访谈/待确认 → To-Be → MVP → 验证型原型 → PRD。

## 6. 文件操作限制
- 只允许在本项目目录工作。
- 不扫描或修改项目目录外文件。
- 不覆盖原始材料。
- 生成HTML原型即可，默认不要编译、不安装依赖、不生成构建产物，除非用户明确要求。

## 7. UI / Design System Rules

1. 开发或修改 UI 前必须先读 `design-system/README.md` 和任务相关规范。
2. “销售预测”是历史 Golden Reference；正式长期规则以 `design-system/` 和共享代码为准。
3. Ant Design 是唯一基础组件库，禁止引入第二套 UI 或 Icon Library。
4. 新页面禁止自行创造 Button、Icon、Table、Filter、Modal、Drawer、Tabs 或反馈风格。
5. 优先复用已有业务组件、`window.EnterpriseUiStandards`、共享 Pattern 和 Ant Design Theme。
6. 新增组件前必须搜索现有组件；新增 Icon 前必须检查 `design-system/icons.md`。
7. Token 优先于页面 Magic Number；新增长期 Token 必须同步更新 `design-system/tokens.md`。
8. 新增页面必须先确认对应 `design-system/patterns/`，不得仅凭截图实现。
9. 截图只用于视觉验证，不能作为唯一设计规则来源。
10. Golden Reference 与 Design System 冲突时，以 Design System 为准，并在审计或变更说明中记录原因。

## 8. Table / List Rules

创建或修改表格、列表、工作台数据区时：

1. 必读 `design-system/tables.md` 和 `design-system/list-background.md`。
2. 文本、数值、日期、状态、选择和操作列必须使用文档定义的 Alignment。
3. 日级预测矩阵的左对齐是已记录例外，不得推广到普通数值列。
4. 长文本使用单行省略和 Tooltip；内容不得强制撑宽列。
5. 列宽可由用户拖拽到内容宽度以下，指针和键盘操作都必须可用。
6. 固定列、边界、行高、表头、分页、Empty、Loading、Error 必须复用共享 Pattern。
7. 不得新增斑马纹或无规范的行背景、Hover、Selected、Warning、Error、Success 底色。
8. 预测日期区域只使用共享十字高亮 Token，非日期业务列不得跟随 hover 改底色。
9. 操作入口遵循 `design-system/patterns/table-operation.md`。
10. 没有现成规则时先参考 Golden Reference 并记录审计，不得静默创造长期模式。

## 9. 新增页面自检

完成 UI 任务前必须依次执行：

1. 读取 `AGENTS.md` 和 Design System。
2. 识别可复用组件、Icon、Token 和 Pattern。
3. 实现后检查 Layout、Typography、Color、Spacing、Icon、Component 和 Interaction。
4. 检查 Table/List Alignment 与背景层级。
5. 运行语法、业务回归、UI 一致性、浏览器控制台和视觉验证。
6. 在交付说明中列出未解决的 P0/P1/P2；不得把未验证状态描述为已通过。
7. 预测矩阵必须真实操作预测线展开/收起、周展开/收起、连续单元格 Hover 和移出清除；静态 DOM 或单张截图不能代替交互验收。
