# README 声明核验表

| README 中的声明 | 对应代码/证据 | 对应测试 | 是否确认真实 |
|---|---|---|---|
| 固定 GMV、交易数、购买人数公式 | lib/discovery/foundation.ts、engine.ts | tests/analysis.test.ts | 已确认代码及测试 |
| 分层 Shapley、交互项、分支守恒 | foundation.ts、contribution.ts、explanation.ts | analysis.test.ts；scripts/verify-real-case.mjs | 已确认，非平铺四因素 |
| 真实 GMV +20.42%、交易数 +35.47% 等 | verified-monthly-aggregates.json | verify-real-case.mjs | 生效导入报告+当前代码复算；未全表重扫 |
| 交易数 +$36,433.71、AOV −$14,225.96 | verified-case-result.json | 四项 conservation checks | 已确认；本例误差均 0 |
| 196,817 会话、871,268 hits | verified-monthly-aggregates.json | 三个月报告求和 | 已确认报告规模，不是跨月 UV |
| 渠道/设备双向下钻、范围继承 | analysis.ts、app/dimension-analysis.tsx | analysis.test.ts、session-ui.test.tsx、本地 HTTP | 已确认合成数据运行 |
| distinct 不冒充精确贡献 | foundation.dimensionResult、step-conclusion.ts | analysis.test.ts、dimension-render.test.tsx | 已确认 |
| ratio 不相加，结论包含分子分母 | foundation.ts、step-conclusion.ts | analysis.test.ts | 已确认 |
| 确定性维度推荐，不固定渠道优先 | recommendation.ts | recommendation.test.ts、session-ui.test.tsx | 已确认；非统计显著性 |
| 行为交集率不等于完整漏斗 | normalize.ts、foundation.diagnose | analysis.test.ts；normalize 源码检查 | 计算类型已确认，未重测全部旧商品测试 |
| 本步结论、不依赖 AI | explanation.ts、step-conclusion.ts、reason-analysis.tsx | analysis.test.ts、session-ui.test.tsx | 已确认核心路径 |
| 公开版无 AI/管理写接口 | lib/public-demo.ts、API route | public-demo.test.ts、dashboard-ui.test.tsx | 已确认；旧实现仍保留 |
| 本地合成数据可运行 | lib/sample.json、seed-demo.mjs | 构建、D1 初始化、HTTP 看板和双向 scope 请求 | 已确认；依赖使用本机现有安装 |
| sourceVersions 与缓存复用 | analysis.ts、aggregate-cache.ts、client-cache.ts | analysis.test.ts、dashboard-ui.test.tsx | 机制确认；本轮不主张生产提速 |
| 真实渠道/设备最大变化分组 | 尚缺当前真实聚合响应 | 无 | 未确认，未写具体排名 |
| 真正独立来源证明/再分发许可 | 无原始导出审计链 | 无 | 未确认，原始样例不分发 |
| 项目效果截图 | docs/images/README.md | 待用户实际截图 | 未完成，不生成假图 |

详细测试执行见 validation-results.md。历史测试文件的存在，不等于本轮执行通过。
