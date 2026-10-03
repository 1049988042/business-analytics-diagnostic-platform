# 项目设计说明

经营数据智能诊断平台 — Business Analytics Diagnostic Platform

## 目标与分析类型

将 KPI 变化后的追问组织成可重复步骤：变了什么、数学驱动是什么、集中在哪里、行为阶段有什么线索、证据能解释到哪一层。

| 类型 | 问题 | 依据 | 边界 |
|---|---|---|---|
| Metric Decomposition | 什么指标驱动变化 | 公式、分层 Shapley | 非业务因果 |
| Dimension Analysis | 变化集中在哪里 | 同范围分组聚合 | distinct 不守恒、ratio 不相加 |
| Behavioral Diagnosis | 哪个阶段变化明显 | 会话交集率、百分点 | 非严格全路径漏斗 |

## 指标设计

V 为周期访客、B 为购买访客、T 为交易数、R 为 GMV。C=B/V，F=T/B，A=R/T；T=V×C×F，R=T×A，B=V×C。零分母使相关拆解不可用，不临时改变定义。

顶层对 T、A 两种变化顺序平均，交易分支对 V、C、F 六种顺序平均，再以平均 A 映射金额。分组结构影响交互项分配，因此声明分层方法，不称为平铺四因素 Shapley。主要因素由贡献 amount 和父变化方向决定，不按自身涨幅排序。

## 数据准备与查询

会话规范化为 sessions、products，微美元换算美元。商品购买按会话、交易 ID、SKU 去重，对重复观测取最大数量、金额。months 指向生效导入，未激活或替换批次不进入正式聚合。

SQL 字段使用受控映射、值参数绑定。请求内复用本期/上期基础结果，sourceVersions 参与缓存失效，不为每个指标节点重新解析 hits。底层 analysis 被统一入口和兼容发现接口复用。

## scope 与三种聚合性质

渠道、设备是平行维度。scope 与全局条件合并，冲突和重复维度被拒绝。mobile 下渠道结论仅属于 mobile，某渠道下设备结论仅属于该渠道。

additive 互斥分组净变化可守恒；distinct 各组去重可能重叠；ratio 必须看分子、分母，不能相加分组比例或直接平均得到整体率。

## 推荐规则

recommendation.ts 的评分为 `100 × quality × groupFactor × (0.5×scale + 0.3×concentration + 0.2×cancellation)`。scale 衡量绝对变化相对父量级，concentration 衡量变化集中，cancellation 体现正负抵消，quality 结合有效样本、已知分组覆盖、有效变化覆盖。ratio 按分母加权。

最低分 15；候选差距不超过 max(5,最高分×10%) 可返回接近状态。固定维度不再扫描。这是探索排序，不是 p-value 或因果模型。

## 本步结论与运行边界

指标层消费服务端 summaries；维度层消费 dimensionResult、highlights 和规范化范围。前端不从 DOM 或格式化数值重新推导驱动。行为诊断对比共现阶段，不连接成严格用户漏斗。

旧管理、AI、语义工作台、session 代码暂保留，不作为当前可用功能。展示副本白名单禁用管理/模型接口，本地使用合成 seed。未新增业务功能或改动已验证指标算法。
