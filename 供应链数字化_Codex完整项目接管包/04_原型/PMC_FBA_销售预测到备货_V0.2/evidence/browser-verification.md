# Browser Verification - PMC FBA 销售预测到备货 V0.2

## Preview

- Current preview URL: `http://127.0.0.1:8793/`
- Screenshot capture URL: `http://127.0.0.1:8792/` before the preview server was restarted on port `8793`
- Date: 2026-09-09
- Browser: Chrome headless for screenshots, Codex in-app browser for interaction checks

## Screenshot Evidence

| File | Viewport | Evidence |
|---|---:|---|
| `01-batch-page.png` | 1440x900 | 预测批次、周期可配置、业务边界、待确认不写死 |
| `02-forecast-wide-table-1440.png` | 1440x900 | 预测填报宽表左侧基础信息、固定列、横向滚动 |
| `03-child-asin-drawer-1440.png` | 1440x900 | Child ASIN详情抽屉、历史销量、库存、AI/人工选择、`#REF!`可见 |
| `04-moq-modal-1440.png` | 1440x900 | MOQ凑单处理、采购500、拉长备货周期、跨渠道凑单、销售确认 |
| `05-forecast-wide-table-mobile.png` | 390x844 | 窄屏保持宽表横向滚动，不重排为卡片 |
| `06-demand-to-supply-1440.png` | 1440x900 | 需求转供给、SKU/首版SKU、版本供给策略 |
| `07-forecast-prediction-area-1440.png` | 1440x900 | 宽表右侧预测填报区、AI构成、人工预测、采用来源 |

## Interaction Checklist

| Check | Result |
|---|---|
| 预测批次进入销售填报首页 | Verified |
| 侧边导航切换到预测填报表 | Verified |
| 预测填报表存在宽表横向溢出 | Verified. Measured `clientWidth=402`, `scrollWidth=3548` in narrow browser viewport. |
| 宽表保留 `#REF!` 来源/映射异常 | Verified |
| Child ASIN详情抽屉可打开 | Verified |
| Child ASIN详情展示采用AI和使用人工预测 | Verified |
| 批量操作弹窗可打开 | Verified |
| 批量采用AI、批量人工、修改周期、添加备注可见 | Verified |
| 提交检查弹窗可打开 | Verified |
| 150天周转显示为需销售确认，不是禁止提交 | Verified |
| PMC预测审核页可打开 | Verified |
| PMC预测审核显示销售提交、采用AI、人工调整 | Verified |
| 需求转供给页可打开 | Verified |
| SKU / 首版SKU供给聚合可见 | Verified |
| 最新版本采购默认、旧版本原因要求可见 | Verified |
| MOQ弹窗可打开 | Verified |
| MOQ三方案和销售确认可见 | Verified |
| Browser console error | 0 errors |

## Static Checks

- HTML inline script syntax: `script syntax ok 1`
- Original materials were not modified.
- V0.1 prototype was not overwritten.
- No Git commit was created.

## Notes

- Headless Chrome emitted macOS display/updater warnings during screenshot generation, but screenshots were written successfully.
- The prototype is static HTML for business validation. It does not implement real data persistence, real AI forecast computation, SCM writeback, or permission controls.
