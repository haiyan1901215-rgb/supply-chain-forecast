export const plan = {
  year:2026, developers:4, version:'V1.0',
  holidaySource:'https://big5.www.gov.cn/gate/big5/www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm',
  assumptions:[
    '按2026年10—12月、中国大陆双休及国务院已公布调休安排编排。',
    '4名开发全程投入，建议配置为1名前端、2名后端、1名全栈/接口，真实技能组合待确认。',
    '复用现有登录、权限基础、SCM与MES服务，原型不视为已完成生产开发。',
    '产品、PMC、采购、数仓及MES接口责任人提供评审和验收支持，未计为额外开发人力。',
    '未假设专职测试，52人日由4名开发承担联调、交叉测试、缺陷修复和发布支持。',
    '人日为建议估算，不是经研发拆解后的承诺。10月10日完成技术评审后重估。'
  ],
  months:[
    {name:'10月',days:18,capacity:72,feature:48,quality:12,reserve:12,goal:'规则与接口定版，预测和计划基础可验收'},
    {name:'11月',days:21,capacity:84,feature:58,quality:12,reserve:14,goal:'打通PMC—SCM主链，完成P0业务验收'},
    {name:'12月',days:23,capacity:92,feature:42,quality:28,reserve:22,goal:'限定试点，P1样板联评，稳定与季度收口'}
  ],
  packages:[
    {name:'公共基础与必要配置',priority:'P0',oct:20,nov:0,dec:0,total:20,owner:'D1 / D2，D3 / D4协同',scope:'角色、审计、日历、规则版本及试点必要参数；复用现有框架'},
    {name:'PMC日级销量预测',priority:'P0',oct:24,nov:10,dec:0,total:34,owner:'D1 / D2',scope:'周期、日级基准/修正/活动、提交退回、冻结与版本追溯'},
    {name:'PMC备货与采购需求',priority:'P0',oct:4,nov:24,dec:6,total:34,owner:'D1 / D2，D4协同',scope:'引用库存在途、SKU版本、人工校准、确认需求及SCM交接'},
    {name:'SCM与供应商执行状态',priority:'P0',oct:0,nov:18,dec:14,total:32,owner:'D3，D1 / D4协同',scope:'复用PR/PO，需求接收去重、关键状态/异常治理、接单交期发货回传'},
    {name:'MRP限定场景验证',priority:'P1',oct:0,nov:6,dec:12,total:18,owner:'D4，D3协同',scope:'固定BOM和物料库存的净需求、采购建议、备料发料清单及业务复核'},
    {name:'已有MES最小接入',priority:'P1',oct:0,nov:0,dec:10,total:10,owner:'D4，D3协同',scope:'单工厂订单关联、已有进度/完工结果回传；延期异常标记'}
  ],
  people:[
    {id:'D1',role:'前端',focus:'PMC界面与共用交互，SCM必要前端增量',oct:[14,3,1],nov:[14,4,3],dec:[10,7,6]},
    {id:'D2',role:'后端 / PMC',focus:'周期与预测状态、计划计算、权限及版本',oct:[14,3,1],nov:[16,3,2],dec:[10,7,6]},
    {id:'D3',role:'后端 / SCM',focus:'数据契约协同，PR/PO增量及执行状态回流',oct:[10,3,5],nov:[16,3,2],dec:[10,7,6]},
    {id:'D4',role:'全栈 / 接口',focus:'事实数据接入，MRP样板，已有MES对接',oct:[10,3,5],nov:[12,2,7],dec:[12,7,4]}
  ],
  phases:[
    {month:'10月',start:'2026-10-08',end:'2026-10-10',days:3,work:'需求与技术评审，锁定试点与数据契约',output:'范围、字段/接口、验收样例、权限边界',gate:'10/10：评审并重估人日'},
    {month:'10月',start:'2026-10-12',end:'2026-10-23',days:10,work:'预测全链路开发，库存/映射接口及计划骨架',output:'日级填报、原因与活动、提交/审核/退回',gate:'每日自测，接口使用固定样例'},
    {month:'10月',start:'2026-10-26',end:'2026-10-30',days:5,work:'预测交叉测试与UAT，备货基础演示',output:'预测闭环验收记录，11月接口就绪清单',gate:'G1 10/30：预测闭环通过'},
    {month:'11月',start:'2026-11-02',end:'2026-11-13',days:10,work:'备货/PR交接与SCM增量并行开发',output:'库存引用、SKU拆解、确认需求、接收去重',gate:'MRP只启动数据就绪样板'},
    {month:'11月',start:'2026-11-16',end:'2026-11-20',days:5,work:'主链端到端联调，执行状态回传',output:'预测—计划—PR—PO—供应商关联可追溯',gate:'重试、重复请求和错误回传测试'},
    {month:'11月',start:'2026-11-23',end:'2026-11-27',days:5,work:'业务UAT、关键缺陷修复与回归',output:'PMC/采购联合验收及试点手册',gate:'未通过项不得带入正式试点'},
    {month:'11月',start:'2026-11-30',end:'2026-11-30',days:1,work:'P0上线准备评审',output:'试点名单、发布与回滚方案',gate:'G2 11/30：P0进入试点准备'},
    {month:'12月',start:'2026-12-01',end:'2026-12-11',days:9,work:'P0限定试点，MRP样例核对及MES接入',output:'真实任务执行记录，P1试点对账差异',gate:'12/01仅在G2通过后启动'},
    {month:'12月',start:'2026-12-14',end:'2026-12-18',days:5,work:'P1样板联评、试点修复及主链回归',output:'MRP/MES有条件验收，P0稳定性记录',gate:'不以P1阻塞P0稳定交付'},
    {month:'12月',start:'2026-12-21',end:'2026-12-24',days:4,work:'满足门槛后有限扩围，季度验收',output:'正式交接、运维责任、遗留问题清单',gate:'G3 12/24：验收并冻结常规变更'},
    {month:'12月',start:'2026-12-25',end:'2026-12-31',days:5,work:'观察、缺陷收尾、文档归档和下季排期',output:'Q4总结及Q1待办，严重问题按应急流程',gate:'G4 12/31：季度收口，不安排大版本'}
  ],
  dependencies:[
    ['10/10','人员能力、代码复用与试点范围','研发负责人 / PMC / 采购','重估后调小范围，不以加班填平缺口'],
    ['10/16','SKU关系、销量/库存/在途样例及口径','商品主数据 / 数仓 / 库存责任方','隔离演示数据，正式验收与上线顺延'],
    ['10/23','SCM接收接口、PR/PO状态及异常约定','SCM负责人 / 采购','保留可追溯需求导出，但不宣称自动闭环'],
    ['10/30','试点BOM版本、物料库存、损耗等参数','PLM / MRP业务 / 物料责任方','MRP停留样例验证，生产扩展排入Q1'],
    ['11/13','MES订单标识、进度/完工接口及环境','MES负责人 / 工厂','只做联调准备，缺少接口不承诺自动回传'],
    ['11/20','业务UAT人员、试点名单与操作时段','PMC / 销售 / 采购 / 供应商','缩小试点，不未经业务验收直接上线']
  ]
};
