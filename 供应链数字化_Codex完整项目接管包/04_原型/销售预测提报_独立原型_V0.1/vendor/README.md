# 本地浏览器依赖 · 更新至V0.2.5

使用官方npm包的浏览器分发文件，经unpkg取得并固定版本；不修改依赖源码。运行时仅加载本地文件。

| 本地文件 | 来源 |
| --- | --- |
| react-18.3.1.min.js | https://unpkg.com/react@18.3.1/umd/react.production.min.js |
| react-dom-18.3.1.min.js | https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js |
| dayjs-1.11.13.min.js | https://unpkg.com/dayjs@1.11.13/dayjs.min.js |
| antd-5.27.6.min.js | https://unpkg.com/antd@5.27.6/dist/antd.min.js |
| antd-icons-5.6.1.min.js | https://unpkg.com/@ant-design/icons@5.6.1/dist/index.umd.min.js |
| echarts-6.0.0.min.js | https://raw.githubusercontent.com/apache/echarts/6.0.0/dist/echarts.min.js |

React、ReactDOM、Day.js、Ant Design及图标包采用MIT许可证，对应LICENSE保存在本目录；Ant Design打包依赖版权声明另见antd.min.js.LICENSE.txt。ECharts采用Apache-2.0许可证，来源为https://raw.githubusercontent.com/apache/echarts/6.0.0/LICENSE，保存为echarts-LICENSE.txt；官方NOTICE来源为https://raw.githubusercontent.com/apache/echarts/6.0.0/NOTICE，保存为echarts-NOTICE.txt。发行文件原有版权声明予以保留。

ECharts分发文件SHA-256：`baa8dfe7e1d9336b98e8986ba7e20ea15e7cdbea1ef42a59d59478632fa45a1d`。

共享企业主题从enterprise-product-design-system的theme-config.ts引入，转换为浏览器变量，仅去掉TypeScript类型与模块导出。
