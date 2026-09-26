# V0.2.0 验证记录

日期：2026-09-22。环境：本地静态服务器8800、Chrome/Playwright、隔离浏览器上下文。入口：/?v=0.2.0。测试不会改写用户浏览器中的填写数据。

## 交互结果

- 数值与来源12px，千分位显示；最终来源独立第二行；最终数值与人工修正右边缘误差小于2px。
- SKC与颜色无复制占位间隔，按钮位于颜色之后；实际Clipboard API回读为C0001A-91。销售负责人位于SKC后。
- 人工1234显示1,234，0保持有效；活动2345优先覆盖人工。历史提报只读，返回本次仍保留填写值。
- 国家/平台并入父体；列配置图标在更新时间右侧；实际Ant Design筛选可以查询UK并重置。
- 历史对比原位展开；实销核对打开及切换对比批次不改变当前填报批次和窗口。2026/10/20实际销量示例为32，历史明细随所选提报更新。
- 列配置5个必选字段禁用取消；7日ADU置顶与30日ADU真实拖拽排序均影响列表；保存应用、取消放弃、恢复默认通过。
- 人工拖拽列宽后切换14/30天，商品及日期列宽不随日期数量改变；右移14天到11/04，左移返回；ISO W43折叠/展开通过。
- 1366×768、1440×900、1920×900：页面无整体横向溢出，底部分页贴合窗口底部，时间工具栏保持单行，筛选区未换行。
- 页面运行错误0，控制台错误0。verify-v020.cjs退出码0。

## 视觉证据

- evidence/v020-default.png：默认页面。
- evidence/v020-inline-history.png：当前四条线、换行来源、同目标日期历史。
- evidence/v020-actual-review.png：原位历史预测与实际核对。
- evidence/v020-antd-select.png：实际Ant Design筛选下拉。
- evidence/v020-column-config.png：实际Ant Design列配置抽屉。
- evidence/v020-layout-1366.png、v020-layout-1440.png、v020-layout-1920.png：桌面布局。

## 组件与边界

Ant Design Component：本轮新增筛选、选择器、列配置Drawer/Tree/Checkbox/Button/Tooltip、确认Modal及实销核对RangePicker使用真实组件。

Theme / Component Rule / Customization：使用共享ConfigProvider主题和公共props，新增代码未使用!important、Ant Design内部DOM修改或全局.ant-*覆写。

Design Consistency：本轮字号、对齐、布局、状态、取消保护、可访问名称与桌面尺寸检查通过；未宣称全站无障碍验收通过。

迁移边界：既有业务网格、分页、主日期窗口和原有详情仍是静态HTML实现，整个原型并非完整Ant Design React工程。历史和实销为Mock；本地存储不等于生产持久化，没有真实模型、权限及接口。
