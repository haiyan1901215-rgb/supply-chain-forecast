# V0.1.8 验证记录 · 2026-09-22

对象：http://127.0.0.1:8800/?v=0.1.8。隔离Chrome + Playwright，脚本verify-v018.cjs。

## 结果

- 商品分组：父行显示共享编码、括注颜色及“销售：李敏”，子行不再重复SKC/颜色，尺码序列M/L/S/M/S/M独立显示。生命周期与库存标签有明确类别，角色、颜色、尺码、标签提示保持单一浮层。
- 备注：保存后刷新保留；取消不覆盖原值；清空保存恢复“添加备注”；含尖括号内容按文本展示。
- 周汇总：初始W43仅包含10/21—10/25五天；人工填35、0、35，活动80后，AI合计161、人工70（3/5天）、活动80（1/5天）、最终180，父分组321。最终按日优先级汇总，未将预测线相加。
- 周展开：日期宽度手动增加20px后收起再展开保留；复选框状态、人工0值保留。所有周收起为3列，周合计只读，可查看5天明细。分割线2px贯穿表格，折叠列保留行列叠色。
- 日历：双月2026/10和2026/11，范围外日期禁选；只选起点不改表格且不能确认；取消保留原窗口。先选11/05再选10/28可形成正确区间；12/28—01/10对应2026-W53、2027-W1。全部范围、14天快捷项、方向键与Enter选日通过。结束日期仅在所属月份高亮，避免两个面板重复端点。
- 1366×768、1440×900、1920×900：页面无横向溢出，工具栏不超过46px，尺码列60px，分页贴底，日期弹层不超出视口。
- pageerror=0。截图经查看：v018-default.png、v018-week-collapsed.png、v018-date-range-picker.png。

## 规范检查范围

遵循enterprise-product-design-system的静态HTML规则，沿用现有Ant Design样式语义、字体和颜色；本次未安装组件库、迁移框架或添加教学提示。新增日历/备注/周分组有键盘路径、可见状态和可逆操作；Tooltip统一管理。静态原型不等同真实antd集成。

```text
Ant Design Compliance
Component       PASS (Static HTML scope)
Theme           PASS (existing baseline)
Component Rule  PASS (scoped semantic behavior)
Customization   PASS

Design Consistency
Layout          PASS
Interaction     PASS
State           PASS
UX Writing      PASS
Responsive      PASS (desktop widths tested)
Accessibility   PASS (new controls and keyboard paths)
Anti-pattern    PASS

Overall         PASS (scoped prototype verification)
```

## 边界

主数据、销量、库存、日期与标签均为演示数据；本轮不是正式业务规则确认。备注仅在当前浏览器保存，不跨用户共享。既有未接入的模块菜单和分页仍为静态占位。
