# 公开安全检查与发布边界

检查日期：2026-10-03。对象为独立 job-portfolio 副本；按公开演示版 210 个 Git 跟踪文件建立快照，未复制 .git、未同步线上、未创建 GitHub 仓库。

## 方法与范围

清点所有候选源文件、配置、文档、测试和静态资源；检查密钥/token 格式、字面量秘密、带凭据 URL、邮箱、Sites 项目 ID、真实访客字段、数据库及压缩原文件。脚本 `scripts/audit-public.mjs` 只报告文件和规则，不输出秘密值。结合手动阅读环境样例、API、表结构、样例来源与运行脚本。

本轮不读取线上 secrets/settings，也不导出生产库。没有改写或复制原 Git 历史。扫描未发现真实 API Key 的明文不等于证明所有历史无密钥；未来不能直接镜像原历史。

## 发现与处理

| 项目 | 处理 |
|---|---|
| API 所有者邮箱及相应测试值 | 展示副本替换为 owner@example.invalid；只读白名单保持不变 |
| .openai/hosting.json 项目标识 | 副本仅保留 DB/BUCKET 逻辑绑定，移除生产项目 ID |
| 原 lib/sample.json | 90 条会话、约 1.77 MB，含访客/会话/交易标识和 hits；替换为 236 条人工合成数据 |
| .env.example | 只有 CONFIG_ENCRYPTION_KEY、DEEPSEEK_API_KEY 空值；保留作结构说明，不要求演示配置 |
| build 本地 mock 身份 | 通用 sites.test 测试值，不是真实账号；保留 |
| tests 固定加密材料、测试 token | 确定性测试 fixture，不是真实凭据；保留，不能用于部署 |
| DB/R2 | 保留逻辑声明与表结构，不复制生产实例、内容、密钥 |
| .wrangler / .sites-runtime | 本地运行产生的合成库和日志已忽略，不进入候选文件 |
| 第三方代码 | 原许可文件保留；没有擅自添加整个项目的开源许可证 |

## sample 来源与替代决策

原项目说明将数据归于 Google Merchandise Store 的 UA BigQuery 样例。字段结构、日期、Google 商品名与该来源一致；[官方说明](https://support.google.com/analytics/answer/7586738?hl=en)确认存在该混淆数据集。但本地样例没有 provenance 字段、导出 SQL 或下载审计链，不能证明其具体提取过程和重新分发权利。

`app/api/[...path]/route.ts` 静态 import 该文件，因此删除文件会影响构建；公开白名单已经禁用 sample 加载管理接口，所以正式看板计算不依赖样例内容。采用合成替换保持 import 兼容。

替代数据：2/3 月完整日期、2 个虚构渠道、desktop/mobile、浏览/加购/结账/购买事件和一个虚构商品。所有访客、会话、交易及商品标识带 SYNTHETIC 前缀，生成不以原始用户记录为输入。`scripts/seed-demo.mjs` 使用原 normalize/ingest 管道，仅生成本地初始化 SQL。没有另写一套分析计算。

## 应进入未来仓库

app、lib（仅合成 sample）、db、drizzle、components、hooks、public、vendor、build、scripts、tests、docs、依赖锁文件和构建配置、空值环境模板、.gitignore。保留构建所需 .openai/hosting.json 的无生产标识版本。

## 禁止进入未来仓库

真实 .env/.dev.vars、任何 API Key/token/私钥/凭据 URL、生产数据库导出、原 GA 会话压缩包、原始上传文件、含标识的请求日志、旧 .git 历史、.wrangler 本地库、.sites-runtime、node_modules、dist/.next、父级 outputs 与部署压缩包。完整数据库即使密钥加密，也不应公开。

## 待确认用途的文件：保留，未删除

- 根目录 app.js、index.html、styles.css、dom-smoke-test.cjs：早期静态原型，包含模拟渠道/地区，不代表当前可靠维度。
- app/analysis-summary.tsx、lib/analysis-session.ts、coverage.ts、session 文档及测试：历史 session/小结能力，当前不提供最终报告入口。
- app/semantic-workspace.tsx、lib/semantic、导入/benchmark、AI 代码：原工作站能力，演示版禁用。
- examples/d1、未引用的通用 UI 组件：模板示例和候选依赖，不因本轮整理贸然删除。
- 历史性能文档、ga-local-benchmark.json、旧 integration/semantic 测试：历史证据，不作为本轮上线性能或公开版回归通过依据。

建议下一轮由用户决定是否归档这些文件；本轮仅加历史说明，不删除。

## 结论

当前候选源码已完成已知身份/环境信息处理及规则扫描，可供本地审阅。尚不是“一切内容均已审计完毕、可自动公开”的保证。发布前需要确认自有代码许可、审阅保留历史材料、补截图；真实维度案例仍缺证据。没有执行任何公开动作。
