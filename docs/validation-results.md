# 本轮验证记录

日期：2026-10-03。环境为本机 Node、独立副本；node_modules 使用现有依赖目录的本地链接，不进入发布文件。未宣称在全新机器完成依赖下载。

| 检查 | 结果与范围 |
|---|---|
| node scripts/test-analysis.mjs | 通过；200 组参数变化、反向、守恒、零分母、legacy parity、SQL scope、distinct、推荐、结论和维度渲染 |
| node scripts/test-public-demo.mjs | 通过；匿名和 owner 均不能调用非白名单接口，拒绝发生在 DB/模型访问前 |
| node scripts/test-dashboard-ui.mjs | 通过；首页请求流、KPI 复用、隐藏管理/AI |
| node scripts/test-session-ui.mjs | 通过；指标结论、默认维度、双向下钻、返回、scope、切换/reset、无小结入口 |
| node --import ./tests/register.mjs scripts/verify-real-case.mjs | 通过；重新读取的报告快照输入当前算法，四项守恒误差 0 |
| node node_modules/typescript/bin/tsc --noEmit | 通过 |
| node scripts/run-framework.mjs build | 通过 |
| seed-demo + Wrangler D1 --local | 通过；空本地库创建表并导入 236 合成会话，不接触线上 |
| 本地 dashboard HTTP | 200；3 月 124 会话、41 交易、GMV 3690，全部为合成数据 |
| 本地 analysis HTTP | 3 个 POST 请求均 HTTP 200 / ready；全局 channel/device 各 2 组，Synthetic Search scope 下 device 1 组，mobile scope 下 channel 1 组；distinct exactContribution 均 false |
| audit-public.mjs | 无未处理规则命中；模式扫描不构成绝对安全保证 |

react-test-renderer 给出弃用提示；测试成功不等于完成真实浏览器视觉测试。生产冷查询没有重测。旧 integration.mjs / semantic.mjs 依赖公开版禁用的管理接口，本轮不把它们列为通过。截图与真实维度接口响应未取得。
