> 历史实现记录：此文件保留原开发过程与当时的验证范围。当前求职展示版以根目录 README、claims-verification.md 和 validation-results.md 为准；其中提到的管理、AI、小结及性能数字不表示当前公开版已启用或本轮已重新验证。

# v31 查询优化与结论校准

## 已确认的问题
生产 Worker 历史日志中：首页请求出现 3704 ms、4106 ms，分析请求出现 1007 ms；热请求也有约 47–55 ms。这些是服务端时长，不包含浏览器网络与渲染。
原首页无论当前页面是否需要，都聚合日趋势、月趋势、渠道、设备，并请求已保存分析。点击 KPI 又发起单独分析请求。

## 本次变更
- app/ui.tsx：首页仅请求 overview 模式；月趋势/渠道/设备/已保存分析按进入页面加载；KPI 点击直接消费首页同批服务端分析快照，不再额外请求；保留原筛选、下钻及切换。
- lib/query.ts：兼容原完整 dashboard 返回，新增 overview 选项，冷聚合从 5 个降为 2 个；复用已计算的两期 raw totals 构造分析快照。
- lib/discovery/analysis-result.ts：从原 analyze 原样提取单一服务端结果组装函数。首页和 /api/analysis 共用，不在前端重算 Shapley 或驱动判断。
- lib/discovery/analysis.ts、lib/aggregate-cache.ts：将已计算分组的原始两期总量缓存到对应 scope 的标准查询键，后续下钻无需再次扫描该分组总量。渠道→设备与设备→渠道一致。只缓存独立分组原始结果，不累加 distinct 人数。
- app/api/[...path]/route.ts：overview 参数；增加不含业务数据的查询耗时/命中数日志，便于后续线上定位。
- app/dimension-analysis.tsx：无唯一推荐时说明“当前先展示”，不会冒充唯一推荐。
- lib/discovery/explanation.ts：所有因素无变化时不再称为正负抵消。

## 一致性与性能验证
1. 原始指标、200 组随机守恒、旧 /api/discover 一致性、七种指标结论模板、推荐与范围继承测试通过。
2. 首页分析快照与独立 /api/analysis 的 decomposition、metrics、sourceVersions、diagnosis 完全一致。
3. 双向下钻缓存结果与清空缓存重新查出的 aggregates、dimensions、decomposition 完全一致；已固定维度不循环。
4. 本地 120354 条合成 SQLite 数据，7 次冷查询中位数：完整 dashboard 54.83 ms，overview 35.81 ms，下降约 35%。这不是线上 D1 的端到端提速承诺。
5. 首页：聚合 5 → 2；KPI 点击：HTTP 请求 1 → 0；同一 Worker 缓存命中的分组下钻：聚合 2 → 1。跨 Worker 或缓存失效仍需正常查询。
6. React 交互验证：初始不请求隐藏面板；KPI 直接进入；月趋势、渠道、设备、保存分析打开时才查；本步结论、返回、切换及双向下钻通过。
7. TypeScript 类型检查和生产构建通过。

## 真实数据与范围
通过 Sites 只读数据库工具核对当前 months → committed imports 报告：
- 2017-02：62192 会话、51364 访客、666 购买人数、733 交易、GMV 108756.52。
- 2017-03：69931 会话、57888 访客、809 购买人数、993 交易、GMV 130964.27。
这些真实汇总与现有验收基准一致。GMV +20.42%，交易数 +35.47%，访客数 +12.70%；GMV 及分层分支 Shapley 守恒误差为 0。

没有取得已登录浏览器的完整真实渠道/设备结果，因此并未声称这部分真实端到端验收通过。发布后线上冷查询和网络耗时仍需实测；新增日志可用于区分服务器计算与浏览器等待。

未修改数据库结构、导入规则、指标树、Shapley 算法、维度推荐评分、sourceVersions 校验、缓存容量和失效期限。没有 AI 参与计算。
