export const source = {
  scheme:'/Users/yan/Documents/codex/供应链/Q4供应链系统建设汇报_V3.0/可编辑文件/Q4供应链系统建设.pptx',
  holiday:'https://big5.www.gov.cn/gate/big5/www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm',
  checked:'2026-09-17',
  assumption:'建议排期，按4名开发全职共享投入，复用既有认证、组织人员、SCM和MES能力，首批接入范围待评审确认。'
};
export const milestones = [
 {date:'10/15',domain:'公司门户',stage:'前置交付①',color:'blue',start:'09/28',end:'10/15',deliver:'公司统一入口、应用目录与工作台\n完成首批既有系统接入，发布后续接入规范',outcome:'员工从统一入口访问业务系统',accept:'首批系统入口可达，应用可见范围与已有权限一致\n入口清单、访问验证和接入规范完成交接',dependency:'首批系统清单、现有登录能力及入口责任人',boundary:'公司级门户一期；首批既有系统接入，不默认所有存量系统一次性改造。'},
 {date:'10/16',domain:'统一权限',stage:'前置交付②',color:'blue',start:'09/28',end:'10/16',deliver:'用户/组织/角色与应用授权，首批权限接入\n授权回收、接口鉴权、关键数据范围与审计',outcome:'统一管理访问资格，关键操作可控可追溯',accept:'授权、撤权及越权拦截测试通过\n首批系统接口执行鉴权，权限矩阵与审计记录可查',dependency:'组织人员来源、角色矩阵和已有认证服务',boundary:'交付公共权限底座和首批联验；各业务模块上线前完成自身接口/数据权限接入。'},
 {date:'11/13',domain:'PMC计划',stage:'业务里程碑①',color:'blue',start:'10/19',end:'11/13',deliver:'日级预测填报、活动/人工修正与PMC审核\n库存/在途引用、SKU版本拆解、备货及采购需求',outcome:'销售需求形成可审核、可追溯的采购需求',accept:'试点商品完成预测、退回、确认、备货及需求输出\n需求数量/日期有依据，权限及版本留痕通过',dependency:'预测基准、库存/在途、商品映射与业务规则',boundary:'首批场景交付，AI基准引用已有结果，正式PR/PO执行由SCM承接。'},
 {date:'11/30',domain:'SCM采购',stage:'业务里程碑②',color:'orange',start:'10/19',end:'11/30',deliver:'采购需求承接、PR/PO关联及供应商分配\n接单/交期/发货状态，关闭与异常流转治理',outcome:'计划进入采购执行，供应商任务和进度可追踪',accept:'PMC需求到PR/PO关联可追溯，重试不重复建单\n供应商关键状态可回传，关闭及异常处理验证通过',dependency:'PMC需求口径、SCM服务、供应商与技术资料来源',boundary:'复用SCM，增量优化关键单据与状态；QC和库存事实按已明确节点接入。'},
 {date:'12/11',domain:'MRP物料计划',stage:'业务里程碑③',color:'purple',start:'11/16',end:'12/11',deliver:'BOM与物料库存引用、面辅料净需求计算\n采购建议、备料/发料清单和缺料提示',outcome:'从成衣计划明确所需物料及物料缺口',accept:'试点BOM与物料库存样例对账通过\n净需求有依据，采购与备料/发料分流经业务确认',dependency:'有效BOM版本、物料库存/在途及损耗等参数',boundary:'限定品类/工厂样板，物料采购交SCM；MRP不是成衣采购的必经串行关卡。'},
 {date:'12/18',domain:'MES生产协同',stage:'业务里程碑④',color:'green',start:'12/01',end:'12/18',deliver:'关联SCM订单，回传开工/进度/完工状态\n延期提示、异常补报及试点工厂使用培训',outcome:'生产进度可见，异常反馈采购与PMC',accept:'试点订单与MES任务关联，进度/完工回传通过\n延期/补报可处理，工厂操作及责任交接完成',dependency:'已有MES接口、订单标识、试点工厂与采集数据',boundary:'已有MES协同接入与推广，首批工厂范围，不按重建整套MES承诺。'},
 {date:'12/24',domain:'季度闭环验收',stage:'总体里程碑',color:'teal',start:'12/21',end:'12/24',deliver:'完成首批场景贯通、数据对账与业务验收\n交付运行手册、回滚方案及下一季度扩展清单',outcome:'计划、物料、采购和生产结果形成反馈闭环',accept:'真实试点单据链、对账与业务验收记录齐备\n无核心数量/权限/流程阻断缺陷，完成回滚与运维交接',dependency:'四个业务节点通过各自验收，业务责任人参与',boundary:'12/25—12/31稳定观察、缺陷收尾及归档，不安排常规大版本。'}
];
