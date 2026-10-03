> 历史实现记录：此文件保留原开发过程与当时的验证范围。当前求职展示版以根目录 README、claims-verification.md 和 validation-results.md 为准；其中提到的管理、AI、小结及性能数字不表示当前公开版已启用或本轮已重新验证。

# GA 导入性能检查（2026-09-30）

## 已确认的旧实现

基线源码 d316aad31605467b85209cb0bb91abede6424fa9，测试保留原 ingest 于 tests/fixtures/imports-before.ts。

- 浏览器串行发送，每批最多 40 会话或约 600,000 字符原始 JSON，整个解析流等待请求完成。
- 不使用 ORM create；按最多 95 绑定参数拼接多行 INSERT。sessions 有 19 列，每语句最多 5 行；products 有 12 列，每语句最多 7 行。
- 每批一次导入状态 SELECT、一次 chunks 主键 SELECT，无逐会话/事件 SELECT。
- 每批一次 db.batch，D1 隐式原子事务；无逐行 commit。
- 每批一条 chunks INSERT。请求数量不等于 SQL 语句数量。
- 进度每批更新，单位是会话，不是行为事件。
- 按 chunk 主键跳过重复批次；商品在 normalize 内按会话、交易、SKU 整理。没有重复数据库检查每个商品的逻辑。
- 64,694 会话意味着至少 1,618 个批次/事务（字节限制可能增加）；至少 12,939 条会话 INSERT，另加商品 INSERT 和批次标记。不能据此声称存在 300,074 个独立数据库请求。
- 旧版未记录耗时、请求字节、SQL 计数或完成时间，不能追溯历史的准确数据库耗时。用户观察的约半小时是端到端体验，不是已测量的数据库执行时间。

## 线上已有数据（只读核验）

原文件 sessions_201701.jsonl.gz 已 committed，SHA-256 为 500bb2c54ccb0f26c30f8cc980ee63f110a5b0419c9bab333487d637d758d20c。
报告有 64,694 sessions、53,041 unique visitors、662 purchasing visitors、713 transactions、300,074 hits，收入 97,877.79 USD。
这些是优化前线上报告，不是优化后复测结果。
现有 D1 表保存会话及会话商品统计；300,074 个原始行为完整保留在原文件，SUM(sessions.hits) 对应其数量。此次不改变这套存储粒度。

## 修改

1. 保持 normalize 不变。所有现有计算及校验仍在服务端运行。
2. 原文件先完整保留。浏览器仅裁剪 normalize 从不读取的传输字段，保留每个 hit。无分析用途的原始字段仍可从原文件重新处理。
3. 默认目标每请求 5,000 会话，同时限制约 4 MB UTF-8 投影 JSON；服务端支持最多 10,000 会话。非固定满 5,000。
4. INSERT INTO ... SELECT json_extract(...) FROM json_each(?)。每 JSON 参数最多 1.5 MB、5,000 标准行，规避 D1 100 参数和 2 MB 字符串限制。
5. 一批 sessions/products/chunk marker 使用同一 db.batch，失败全部回滚。无并发写入压力、无删减质量校验。
6. 每批返回会话数、行为数、商品行数、真实落表行数、SQL 和事务计数、归一化耗时、数据库调用等待及 D1 meta.duration。前端分别累加请求与处理总耗时，预览后保存。
7. 1 月发布门槛新增 hits=300074，原四项检查保留。

## 对照与口径

后台 GA 数据、已导入原文件行中的“完整文件性能对照”依次执行旧算法、目标 5,000、目标 10,000。使用当前登录用户权限读取已保留的 gzip，校验 SHA-256 后原样重放。

所有测试写入 sample=2 的独立 import_id，不修改 months，不允许确认成正式数据。每次对照使用 SQL EXCEPT 双向比较每一个 sessions/products 持久字段，随后删除隔离的测试数据及 chunk，保留性能报告；失败也尝试清理，绝不删正式数据。测试旧方式仍可能耗时较长。

- storedRows = sessions + 会话商品行，records/s 分子使用实际落表数据行；行为数单独列出，不能误称行为已逐条落表。
- writeWallMs 是等待 db.batch 的累计时间，含数据库绑定往返。
- engineMs 是 D1 返回每条语句 meta.duration 的和；未提供则显示未测量，不能拿墙钟时间冒充。
- insertStatements 包含 chunk 标记，dataInsertStatements 不包含。
- batchCalls/transactions 为数据写入阶段的事务数；不包含创建导入、报告保存、验证和清理的管理事务。
- readCalls 包含写入请求中的状态检查和幂等检查，不包括最终汇总/一致性验证查询。
- 总处理截止预览或一致性验证完成；重放总计时包含测试清理，但不含最初上传原文件、读取原文件和文件 hash。普通上传总计时包含原文件 hash 和上传。不包含人工确认等待。
- 性能汇总由已认证浏览器累加服务端批次数据，并在报告中注明来源；这不是独立服务端审计日志。

## 本地验证及限制

见 ga-local-benchmark.json。10,000 合成会话仅用于批次与完整行一致性测试，绝不写入经营数据。
原始嵌套 gzip 的 90 会话样例另外逐字段验证投影前后 normalize 结果。
本地旧/新对照运行真实 SQLite 和实际 SQL，但无 D1 网络开销；不能外推完整文件速度。
JSON 解析在本地增加 CPU 消耗，本地写入耗时未证明提速。优化证据是更少的 SQL 和服务往返，生产收益等待实测。

当前工作区和文件检索中没有完整 1 月文件。Sites 可读线上汇总，完整原文件接口要求用户身份，服务凭证不提供用户身份。没有放宽下载权限来运行测试。因此完整文件优化后耗时与五项基准复测尚未完成，不能写成“已验证”。

可在后台运行完整对照，或提供同一 gzip 后本地运行：

```
node --import ./tests/register.mjs tests/ga-bulk.mjs --file /absolute/path/sessions_201701.jsonl.gz
```

后者仍是本地 SQLite，线上实测必须使用后台对照。
