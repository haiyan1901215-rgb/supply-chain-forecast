# V0.1.7 验证记录

日期：2026-09-22。测试对象：http://127.0.0.1:8800/?v=0.1.7。

## 浏览器验证

使用隔离 Chrome 和现有 Playwright 运行 verify-v017.cjs，同时在应用内浏览器查看原型。

- 1366×768、1440×900、1920×900：工具栏单行45px，当前窗口→左右箭头→14/30天顺序正确，更新信息靠右，无页面级横向溢出。两个日期值字号和字重相同。
- 五类编码均无原生title；唯一类型提示与复制按钮共用归属，指针离开即关闭；焦点和Escape可操作，与主图预览互斥。Clipboard API回读父体编码正确。
- 14天窗口由10/21—11/03切换到11/04—11/17；30天由10/21—11/19切换到11/20—12/19。自定义跨年12/28—01/10对应W53、W1。
- 商品列手动加宽32px后切换14/30天保留宽度。
- 人工修正35覆盖AI；10/23人工35与活动80并存时最终仍为80。十字行列均有半透明颜色且覆盖最终预测行。
- 销售趋势显示对应近30天销量870件；预测分析读取当前日期窗口和最新填写值；SKU映射、商品档案可访问，关闭返回原入口焦点。
- 垂直滚动后表头不动，分页贴底，横向滚动条固定在分页上方。pageerror=0。
- 已人工查看 evidence/v017-default.png、v017-code-tooltip.png、v017-forecast-analysis.png，未见文字/控制重叠；v017-cross-highlight.png记录行列聚焦状态。

## 设计规范检查（本轮改动范围）

本交付沿用静态HTML，依SKILL.md的Static HTML例外匹配Ant Design语义；不是React/antd组件实现。筛选区使用组件内标题是用户已明确的产品要求。未扩展为全系统可用性验收。

```text
Ant Design Compliance
Component       PASS (Static HTML exception)
Theme           PASS (existing shared visual baseline retained)
Component Rule  PASS (within static prototype scope)
Customization   PASS (no new important overrides or framework)

Design Consistency
Layout          PASS
Interaction     PASS
State           PASS (new local detail states)
UX Writing      PASS
Responsive      PASS (1366 / 1440 / 1920)
Accessibility   PASS (new entries, tooltips, focus return)
Anti-pattern    PASS (no nested cards or overlapping hints)

Overall         PASS (scoped prototype verification)
```

## 限制

- 数据为本地演示；历史映射、上架日期、库存口径等不能视为真实业务事实。
- 未接入后端、权限、真实预测模型或外部商品系统；既有分页和全局模块菜单为静态占位。
- 小于1020px保留横向时间工具栏，企业台账仍面向桌面使用；不承诺移动端完整操作体验。
