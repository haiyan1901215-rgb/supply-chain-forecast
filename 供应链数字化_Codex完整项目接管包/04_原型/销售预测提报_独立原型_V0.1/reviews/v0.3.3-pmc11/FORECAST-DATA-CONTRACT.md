# 预测数据合同 · V0.3.4-sync1

## 结论

销售提报页面保留现有表格、编辑入口和覆盖优先级。预测工作台不再自行生成一个用于展示的最终预测值，而是读取当前预测批次合同中的日级最终预测。

## 唯一来源

`ForecastBatchModel` 按预测批次保存父体预测池、子ASIN拆解和关系快照。销售填报通过 `ForecastBatchContract.getDailyForecast(batchId, childId, date)` 读取单日值；预测工作台通过 `ForecastBatchContract.getForecastIndex(batchId)` 读取同一快照的子体/父体合计、份额与日级明细。旧 config12 模块保留兼容降级，但当前“计划配置”入口由 `ForecastPlanWorkspace` 承载。

## 关联键

- 子ASIN展示键：`country + store + childASIN`
- 父ASIN展示键：`country + store + parentASIN`
- 业务时间键：`batchId + childId + forecastDate`
- 最终规则预测：`childForecastResults[].dailyFinalForecast[forecastDate]`

国家、店铺和ASIN必须同时参与关联，避免US/UK、不同店铺或同ASIN跨账号串数。历史批次使用历史批次自己的关系和预测快照，不被当前配置覆盖。

## 读取与性能

合同单日读取只返回不可变的轻量对象，不再对整批182天快照做深拷贝。销售工作台缓存静态规则预测，人工输入和活动输入仍在当前页面状态中实时合成最终值。批次发生调整时通过 `forecast-batch-change` 清理缓存。

## 降级规则

如果合同未加载，旧 config12 模块才允许显示原规则模型中的 `qty`，并显示“预测合同未连接，显示规则回退值”。这只是开发/异常降级，不是正常业务数据来源。

## 验收口径

对同一批次、同一国家、同一店铺、同一子ASIN、同一天：

1. 预测工作台展示的最终预测必须等于合同 `dailyFinalForecast`。
2. 销售填报规则预测必须等于合同 `getDailyForecast(...).ruleForecast`。
3. 父体预测池日值必须等于其子ASIN最终预测日值之和。
4. 共享合同不可用时必须可见地提示降级，不得静默产生第二套正常值。
