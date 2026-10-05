# Table Operation Pattern

1. 行内只保留高频操作；低频操作进入 `MoreOutlined` 菜单。
2. Icon Button 必须有 Tooltip 和 `aria-label`。
3. 同一语义在所有页面使用同一 Icon 和反馈方式。
4. 编辑入口 hover/focus 出现时必须预留稳定槽位，不能覆盖值或导致布局跳动。
5. 父/子层级展开使用 `ForecastToggleIcon`；同一位置只显示当前可执行状态的一个图标。
6. 点击 ASIN 编码本身打开详情；不得要求用户点击额外详情 Icon。
7. 复制按钮可 hover/focus 出现，复制成功用 Ant Message。
8. 操作列超过三个直接动作时收敛到更多菜单。

