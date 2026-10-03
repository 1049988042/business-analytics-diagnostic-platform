'use client';
import {useState} from 'react';
import {gaRequest,writeGa} from '../lib/ga-client';
export function GaStats({stats}:any){if(!stats)return null;const sec=(v:any)=>v==null?null:v/1000;const f=(v:any)=>v==null?'未测量':Number(v).toLocaleString('zh-CN',{maximumFractionDigits:2});return <details><summary>导入性能记录</summary><p>会话 {f(stats.sessions)} · 行为 {f(stats.events)} · 商品行 {f(stats.productRows)} · 实际写入数据行 {f(stats.storedRows)}</p><p>数据库批量调用等待 {f(sec(stats.writeWallMs))} 秒 · 数据库引擎执行 {stats.engineMs==null?'未提供':f(stats.engineMs/1000)+' 秒'} · 写入吞吐 {f(stats.storedRowsPerSecond)} 数据行/秒</p><p>数据 INSERT {f(stats.dataInsertStatements)} 条 · 含批次标记 INSERT {f(stats.insertStatements)} 条 · batch 调用/事务 {f(stats.batchCalls)} 次 · 查询 {f(stats.readCalls)} 次</p><p>请求累计 {f(sec(stats.requestMs))} 秒 · 解析至写完 {f(sec(stats.processingMs))} 秒 · 总处理 {f(sec(stats.totalMs))} 秒 · 传输 {f(stats.requestBytes/1024/1024)} MB</p><p>总处理计时截止预览/验证完成，不包含人工确认等待。基准重放不包含首次上传原始文件。数据库等待包含绑定服务往返，独立于引擎执行耗时。</p></details>}
export default function GaBenchmark({source,disabled,onRunning}:any){
 const [progress,setProgress]=useState(''),[result,setResult]=useState<any[]>([]),[running,setRunning]=useState(false);
 async function run(full=false){setRunning(true);onRunning(true);setResult([]);let active='';try{
 setProgress('读取已保留的原始文件');const r=await fetch('/api/import/raw?id='+source.id);if(r.redirected||!r.ok||r.headers.get('content-type')?.includes('text/html'))throw Error(`原文件读取失败（HTTP ${r.status}），请确认网站登录状态后再试`);const file=await r.blob();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==source.hash)throw Error('原文件校验值不一致');
 const expected=JSON.parse(source.report||'{}').months?.reduce((a:any,m:any)=>({sessions:a.sessions+m.sessions,hits:a.hits+m.hits}),{sessions:0,hits:0});
 for(const mode of (full?['legacy','bulk-5000','bulk-10000']:['bulk-5000'])){
 const start=await gaRequest('import/benchmark-start',{sourceId:source.id,mode});active=start.id;const t=performance.now();
 const stats=await writeGa(file,source.name,active,s=>setProgress((mode==='legacy'?'旧方式':mode==='bulk-5000'?'新版 · 目标 5,000':'新版 · 目标 10,000')+' · '+s),mode==='legacy',mode==='bulk-10000'?10000:5000,expected);
 setProgress(mode+' · 核对全部会话及商品行');const done=await gaRequest('import/benchmark-finish?id='+active,{stats});stats.totalMs=performance.now()-t;
 await gaRequest('import/benchmark-timing?id='+active,{totalMs:stats.totalMs});active='';setResult(v=>[...v,{mode,stats,...done}]);
 }setProgress('对照完成，完整结果已保存在导入记录中');
 }catch(e){setProgress(e instanceof Error?e.message:'测试失败')}finally{if(active)await gaRequest('import/benchmark-cleanup?id='+active,{}).catch(()=>{});setRunning(false);onRunning(false)}}
 return <div><button className="primary" disabled={disabled||running} onClick={()=>run(false)}>只测试新版</button><button disabled={disabled||running} onClick={()=>run(true)}>完整文件性能对照（含旧版）</button><small>建议先只测试新版，直接核对全部正式数据。完整对照从旧方式开始，会较慢。</small>{progress&&<p role="status">{progress}</p>}{running&&<p>测试中请保留页面。字节上限可能提前分批，测试数据隔离，不替换正式看板。</p>}{result.map(r=><div key={r.mode}><strong>{r.mode} · {r.equal?'全部会话和商品字段一致':'校验失败'}</strong><GaStats stats={r.stats}/></div>)}</div>
}
