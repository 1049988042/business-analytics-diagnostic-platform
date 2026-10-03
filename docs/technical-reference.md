# 技术参考与本地复现

本页承接 README 下沉的接口示例、架构与历史模块边界、测试命令和本地运行步骤。分析逻辑与核验范围未改变。

## 7. 维度下钻与 scope

统一 `/api/analysis` 接收 metric、filters、scope、dimensions。渠道→设备与设备→渠道共用查询逻辑。当前可靠维度只有渠道和设备。

合成演示请求示例（不是实际经营发现）：

```json
{"metric":"visitors","filters":{"months":["2017-03"]},"scope":[{"dimension":"channel","value":"Synthetic Search"}],"dimensions":["device"]}
```

下钻继承全局条件，冲突范围和重复固定维度被拒绝。推荐考虑变化规模、集中程度、正负抵消、有效分组数和样本质量；接近的候选允许并列。评分不代表统计显著性。

additive 检查分组守恒；distinct 使用“分组变化”，不声称精确贡献率；ratio 查看分子/分母，不能相加分组比例。下钻结论必须标明渠道或设备 scope，不能扩大为全店。


## 11. 技术架构

React/TypeScript 展示，Vinext/Vite 构建，Cloudflare Worker 执行 API，D1 存储会话和商品，R2 存储原文件，Drizzle 管理表结构及迁移。

`/api/analysis → analysis.ts → 聚合/缓存 → foundation/recommendation/step-conclusion → 页面`。

沿用 sourceVersions 失效和结果复用。旧 AI、管理、session 文件保留，公开 API 白名单禁用管理和模型调用，不作为当前可用功能宣传。部署依赖平台适配，不能直接上传 GitHub Pages 运行完整后端。


## 12. 测试与正确性验证

覆盖守恒、正反向变化、零分母、distinct 重叠、两种下钻顺序、scope 冲突、防循环、查询参数及结论边界。SQLite 合成测试不是生产全量回归。

```sh
node scripts/test-analysis.mjs
node scripts/test-public-demo.mjs
node --import ./tests/register.mjs scripts/verify-real-case.mjs
node scripts/audit-public.mjs
node node_modules/typescript/bin/tsc --noEmit
```

见[测试记录](validation-results.md)、[声明核验表](claims-verification.md)。旧工作站集成测试依赖已禁用管理接口，不属于公开版通过清单。


## 13. 本地运行方法

使用支持 `node:sqlite` 和 `registerHooks` 的 **Node 22.15+，建议 Node 24**，以及 package.json 指定的 pnpm。无需真实 API Key。在新建空的本地数据库中：

```sh
pnpm install --frozen-lockfile
node scripts/run-framework.mjs build
node --import ./tests/register.mjs scripts/seed-demo.mjs
node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file .sites-runtime/synthetic-demo.sql
pnpm start
```

打开终端打印的本地地址，选 2017-03。seed 只生成合成 SQL；导入必须保留 `--local`。不要对线上库运行。重复初始化会因表存在而停止，不会自动删除已有库。

UI 测试依赖单独安装：`npm install --prefix .sites-runtime/session-ui --no-save react@19.2.6 react-test-renderer@19.2.6`。之后运行 `node scripts/test-dashboard-ui.mjs`、`node scripts/test-session-ui.mjs`。这是组件交互测试，不是真浏览器截图测试。

