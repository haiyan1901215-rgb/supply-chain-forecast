# 预测工作台 V0.3.35

## 本轮范围

- 父ASIN、子ASIN编码及左侧父子树节点打开同一个右侧详情抽屉。
- 抽屉固定使用“预测依据 / 子体拆分 / 父子关系 / 销售组合”四个页签，父子对象共享结构并按当前对象展示内容。
- 父ASIN编码前复用销售预测填报的站点国旗SVG，店铺复用 `ShopOutlined`。
- 复制入口替换为销售预测填报同一SVG结构和13px尺寸，保留悬停显隐且不触发详情抽屉。

## 验收

- `node --check forecast-workbench.js`
- `node --check verify-forecast-workbench-v033.cjs`
- `node verify-forecast-workbench-v033.cjs`
- `node verify-pmc-refinement-v032.cjs`
- `git diff --check`

浏览器验收覆盖父/子ASIN抽屉、四页签切换、树节点联动、父体国旗、店铺图标、复制图标SVG一致性、复制防误触、既有矩阵交互和无运行时告警。
