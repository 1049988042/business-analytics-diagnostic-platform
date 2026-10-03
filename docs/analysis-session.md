> 历史实现记录：此文件保留原开发过程与当时的验证范围。当前求职展示版以根目录 README、claims-verification.md 和 validation-results.md 为准；其中提到的管理、AI、小结及性能数字不表示当前公开版已启用或本轮已重新验证。

# 本次分析小结与探索覆盖检查：验收说明

## 发布范围
同页展开小结、内存 Analysis Session、所有探索分支保留、重要遗漏分支提醒、恢复指标或 scope。没有 AI、历史保存、导出功能、新字段或自动补跑。

## Analysis Session
```ts
{
  id, contextKey, root,
  period: { current, previous },
  filters, sourceVersions, metricVersion, coverageVersion,
  snapshot, // 初始 /api/analysis 结构化结果
  nodes: { [id]: {
    kind: 'metric' | 'dimension' | 'group' | 'behavior' | 'product',
    metric, parentMetric?, dimension?, group?,
    scope, path,
    computed, significant, presented, explored,
    result, reason
  } },
  history: [{ sequence, action, nodeId, scope }],
  responses: { [metricAndCanonicalScope]: analysisResponse }
}
```
节点 ID 包含类型、指标、规范化 scope、维度和分组。scope 保存当时查询的下钻条件；全局筛选单独保存在 session 中。分组节点还保存 dimension/group，继续分析时加入 scope。history 保留实际顺序，返回不删除节点。改变筛选或重新进入 KPI 会创建新的组件/session；数据版本、周期或实际筛选不匹配的响应不会合入历史。仅保存在当前页面内存，刷新或离开分析页结束。

## significant 规则（服务端）
位置：`lib/discovery/coverage.ts`，版本 `coverage-v1`。
- 指标因素必须有非零有限 Shapley 影响；绝对影响至少占同父节点全部绝对影响之和的 20%，且至少达到父指标上期绝对值的 1%。不是看自身涨幅，也不是占净变化比例。
- 维度沿用现有推荐候选的 usable（有效分组、样本和评分门槛），不重复计算推荐引擎。
- 尚有下钻维度时，每个可用候选最多提醒一个正向、一个负向突出分组，直接复用原有排序（ratio 已按分母加权）；末端分组不会出现无法继续的提醒。
- 提醒集合严格为 computed && significant && !explored。没有重要分支时显示“尚未识别出达到规则的重要分支”，不宣称已经完成分析。

## explored 触发
- KPI 入口标记起始指标；点击指标节点或小结“继续分析”标记主动进入的指标。
- 后台维度扫描只 computed；默认显示只 presented。
- 主动选择维度、展开完整分组表才标记该维度 explored。
- 点击具体分组，下一层响应成功后标记父分组已进入；用户下钻后实际显示的剩余维度也标记 explored。
- 行为诊断折叠面板打开、商品结构请求成功，分别记录诊断线索。
- 返回仅记录导航并保留所有旧结果。恢复旧 scope 使用本 session 的已验证响应，不必重查。

## 修改文件
- `lib/discovery/coverage.ts`：重要性规则。
- `lib/discovery/analysis.ts`、`lib/discovery/service.ts`：提供覆盖提示，继续复用现有计算。
- `lib/analysis-session.ts`：session、状态、历史、scope、覆盖集合、恢复目标。
- `app/analysis-summary.tsx`：结构化数据模板，五部分小结。
- `app/reason-analysis.tsx`：指标导航、session 生命周期与继续分析。
- `app/dimension-analysis.tsx`：展示/主动探索事件、范围恢复和结果复用。
- `app/ui.tsx`：新 KPI 入口独立 session。
- `app/globals.css`：小结和提醒样式。
- `tests/session.test.tsx`、`tests/session-ui.test.tsx`、`scripts/test-session.mjs`、`scripts/test-session-ui.mjs`：状态和组件交互验收。

## 基于已知真实历史汇总生成的示例
这部分使用用户此前给出的真实 2017-03/02 汇总数，不是本次重新拉取的线上完整数据。当前导入版本号未重新验证，不填造渠道/设备数字。

发生了什么：2017-03 GMV $130,964.27，对比 2017-02 $108,756.52；环比 +20.42%，净增加 $22,207.75。

指标驱动：交易数 +35.47%，对 GMV 的 Shapley 影响 +$36,433.71；客单价 −11.11%，影响 −$14,225.96。

若已点击交易数和访客数，未点击其他因素：购买转化率、购买用户人均交易次数、客单价均满足本规则，出现在“值得继续关注”。点击“继续分析客单价”后，客单价指标更新为“已展开”，该指标提醒消失；未探索的重要维度仍有自己的提醒。

在未取得实际维度结果时，小结不会编写 Organic Search、Mobile 等分组结论。

## 路径与交互测试
合成 SQLite 数据，经实际 analyze → recommendation → session → React 组件交互执行：
GMV → 交易数 → 访客数 → 推荐渠道 → Organic Search → 设备；再打开小结 → 继续分析客单价 → 再打开小结 → 恢复先前渠道内设备 → 返回。
- 两条分支保留，父 scope 和全局 scope 分开。
- 默认展示不冒充主动探索；普通后台节点不进入已探索结果。
- 重要客单价提醒出现，点击后该指标提醒消失。
- 恢复已看 scope 零新网络请求；生成/展开小结零 SQL。
- 返回保留历史，更换 session 清空旧探索。
- 错误 sourceVersions、实际 scope、周期或指标版本的结果拒绝合入。
- distinct 小结使用分组变化，不生成精确贡献率；ratio 单列边界。

## 测试与性能
状态/模板测试、React 交互测试、既有 Metric Tree/Shapley/推荐测试、缓存性能测试和 TypeScript 检查均通过；生产构建通过。
新增覆盖提示只遍历已经返回的因素和候选分组，SQL 查询数未增加。打开小结无网络请求。首次进入此前未查的维度范围仍走原有 /api/analysis，不自动补查。
本地 coverageHints 10000 次运行均值约 0.0017 ms/次，不能等同线上冷请求延迟。线上冷查询性能仍待实测；本次未改 SQL、缓存策略或导入结构。

测试渲染器安装在忽略目录，不进入生产依赖。复现组件测试：
```sh
npm install --prefix .sites-runtime/session-ui --no-audit --no-fund --ignore-scripts react-test-renderer@19.2.6 react@19.2.6
node scripts/test-session.mjs
node scripts/test-session-ui.mjs
```

## 未完成的真实线上验收
使用 Sites 提供的访问凭证请求当前 /api/analysis 仍返回 HTTP 403；浏览器工具没有可用标签页。因此没有把合成 Organic Search 路径写成真实 GA 验收，也未获得本次线上完整生成的小结。发布后需要在用户已登录页面验证指定真实路径；上述历史汇总示例和本地交互验证分别标明来源。
