> 历史实现记录：此文件保留原开发过程与当时的验证范围。当前求职展示版以根目录 README、claims-verification.md 和 validation-results.md 为准；其中提到的管理、AI、小结及性能数字不表示当前公开版已启用或本轮已重新验证。

# 第一阶段：统一计算底座

## 指标口径与分层 Shapley

服务端固定配置位于 `lib/discovery/foundation.ts` 的 `METRIC_TREE`：

```text
GMV (revenue)
├─ 交易数 (transactions)
│  ├─ 访客数 (visitors)
│  ├─ 购买转化率 (conversion) = buyers / visitors
│  └─ 购买用户人均交易次数 (frequency) = transactions / buyers
└─ 客单价 (aov) = revenue / transactions

购买访客数 (buyers) = visitors × conversion
```

访客与购买访客在完整周期、当前筛选范围内 COUNT DISTINCT。GMV 与交易数分别复用会话收入、totals.transactions 的已入库汇总，不改导入口径。中间数值不舍入，最后展示才格式化。

两因素实现复用 `lib/discovery/contribution.ts::factors`：对两种替换顺序取平均，Δ交易数×Δ客单价交互项各分一半。三因素实现复用 `lib/discovery/explanation.ts::transactionFactors`：对六种替换顺序取平均，双因素交互各分一半，三因素交互各分三分之一。

`foundation.ts::decompose` 组织分层分配。每个交易数子因素的 GMV 影响 = 该因素的交易数 Shapley 影响 × 两期客单价均值。这样所有子因素 GMV 影响之和等于顶层交易数 GMV 影响；不是把四个叶节点直接做平铺 Shapley。守恒失败抛错，不强行补差。零分母返回 unavailable，不伪造增长率或贡献。

## 接口

新增 GET `/api/analysis?input=<JSON URL 编码>` 与 POST `/api/analysis`。复用现有路由、安全检查、周期筛选、数据库访问及浏览器缓存。

```json
{
  "metric": "revenue",
  "operation": "metric_decomposition",
  "comparison": {"mode": "overview"},
  "filters": {"months": ["2017-03"], "channel": "", "device": ""},
  "dimensions": [],
  "scope": []
}
```

响应包括 status、analysisVersion、request、period、sourceVersions、decomposition、diagnosis、dimensions、recommendation、availableDimensions、metricRules、evidence 和 performance。兼容旧页所需的 aggregates、metrics、tree、definitions、contribution 保留。operation 标识请求的分析意图；同一响应保留从同一份本期/上期基础结果生成的三类数据，避免切换分析行为时重复计算基础指标。dimensions 为空时不扫描维度。

`decomposition.type = MetricDecomposition`：固定数学树、变化率、金额/数量影响、主要驱动、守恒。

`dimensions[].type = DimensionAnalysis`：当前范围按渠道或设备分组定位。

`diagnosis.type = BehavioralDiagnosis`：浏览/加购/结账/购买的同会话交集率。ordered=false，不能连乘解释购买转化率，不是 Metric Tree 的乘法子节点。

渠道内看设备：

```json
{"metric":"visitors","operation":"dimension_analysis","filters":{"months":["2017-03"]},"scope":[{"dimension":"channel","value":"Organic Search"}],"dimensions":["device"]}
```

设备内看渠道：

```json
{"metric":"visitors","operation":"dimension_analysis","filters":{"months":["2017-03"]},"scope":[{"dimension":"device","value":"mobile"}],"dimensions":["channel"]}
```

并列基础结果：`dimensions:["channel","device"]` 返回两个独立分组，顺序不表示父子关系。不做交叉矩阵或拖拽 UI。scope 继承全局筛选；冲突报错，不覆盖全局条件。已固定维度从 availableDimensions 移除，重复分析同维度拒绝。字段、指标和维度白名单校验，值全部参数绑定。

## 去重与推荐

METRIC_RULES 只开放渠道和设备。GMV、交易数标记 additive 并检查分组合计；访客数、购买访客数标记 distinct，exactContribution=false、conservation=null；其他派生比例标记 ratio，不加总分组变化。访客归因口径保持不变。

维度结果返回 positive、negative、parent 和 notice。跨组访客可以重叠，统一称“分组变化”，不能把分组人数变化相加作为整体精确贡献。数学树中访客因素的 Shapley 影响与跨组去重人数变化是两件事。

服务端 recommend 返回已请求适用维度的基础推荐：以组内最大绝对变化 / 正负变化绝对值总和衡量集中程度，正向推动和负向抵消分别保留，比例指标排除两期访客任一期少于 200 的组。它是探索优先级启发式，不是显著性检验或因果证明，不用“占净变化百分比”，不在首屏自动扫描所有维度。

## 复用与性能

新 API 与 `/api/discover` 共用 periodQuery、periods、decompose、diagnose、dimensionResult、values、factors、transactionFactors。旧 discover 的发现卡片、日度扫描、渠道设备联合 GMV 和商品结构能力继续保留；没有另写贡献公式。前端只消费服务端的变化率、角色、驱动与分组排序；不再自行进行 Shapley 或判断驱动。

每个请求核心周期聚合仅一次，得到本期/上期全部基础值后在内存复用。只有显式请求 dimensions 才每维度追加一次聚合。无需解析 GA JSON、扫描 hits 或预计算维度排列。新首屏 overview 不再额外扫描全店日期覆盖、日度和渠道设备联合 GMV。

浏览器原有 40 项/60 秒缓存、清理机制和 sourceVersions 检查保留。expectedSourceVersions 验证和请求前后版本一致性检查防止混合导入版本。没有新增数据库缓存或修改数据库/导入结构。

## 验证与边界

真实导入报告 2017-02、2017-03 的汇总值用于实际案例重放；SQLite 集成测试验证真实 SQL 的筛选、旧/新结果一致、替换导入排除、去重和双向下钻。运行 `node scripts/test-analysis.mjs`，再执行 `node node_modules/typescript/bin/tsc --noEmit` 与正式构建。

目前只支持渠道/设备。商品结构继续作为原有诊断线索，其商品收入字段与全店 GMV 不等价。行为数据没有严格路径顺序或同商品约束，不能证明转化原因。购买用户人均交易次数不是复购率；不能从这些数据推断营销活动、价格、折扣、成本等业务原因。
