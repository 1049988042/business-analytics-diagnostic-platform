import assert from 'node:assert/strict';
import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {env,sql} from './storage.mjs';
import {ingest} from '../lib/imports.ts';import {ingest as before} from './fixtures/imports-before.ts';
import {projectSession,gaBatches,jsonBatches} from '../lib/ga-batch.ts';
import {normalize} from '../lib/normalize.ts';
import {startBenchmark,finishBenchmark,cleanBenchmark} from '../lib/ga-benchmark.ts';
const sample=JSON.parse(fs.readFileSync(new URL('../lib/sample.json',import.meta.url),'utf8'));
let checks=0;function check(name,fn){fn();checks++;console.log('PASS',name)}
const rawSamplePath=new URL('../../data/development_sample_201701.jsonl(1).gz',import.meta.url);
if(fs.existsSync(rawSamplePath)){const original=gunzipSync(fs.readFileSync(rawSamplePath)).toString().trim().split('\n').map(JSON.parse);check('original nested gzip sample retains every normalized field and hit count',()=>{for(const r of original)assert.deepEqual(normalize(projectSession(r)),normalize(r))});}
check('projection preserves exact normalization of all sample sessions',()=>{for(const r of sample)assert.deepEqual(normalize(projectSession(r)),normalize(r))});
const cases=[{...sample[0],fullVisitorId:123},{...sample[0],date:'20170230'},{...sample[0],totals:{transactions:-1}},{...sample[0],hits:[{eCommerceAction:{action_type:'3'},product:[{}]}]}];
check('projection retains malformed data for existing validation',()=>{for(const r of cases){assert.throws(()=>normalize(r));assert.throws(()=>normalize(projectSession(r)))}});
const snapshots=id=>Object.fromEntries(['sessions','products'].map(t=>[t,sql.prepare(`SELECT * FROM ${t} WHERE import_id=? ORDER BY sid${t==='products'?',sku':''}`).all(id).map(({import_id,...r})=>r)]));
for(let i=0;i<sample.length;i+=40)await before('old',i,sample.slice(i,i+40));await ingest('new',0,sample.map(projectSession));
check('all session and product columns equal old implementation',()=>assert.deepEqual(snapshots('old'),snapshots('new')));
const result=await ingest('new',0,sample.map(projectSession));check('batch replay does not write twice',()=>assert.equal(result.duplicate,true));
await assert.rejects(()=>ingest('bad',0,[sample[0],{...sample[0],date:'bad'}]));check('validation failure writes zero rows',()=>assert.equal(sql.prepare("SELECT COUNT(*) n FROM sessions WHERE import_id='bad'").get().n,0));
await assert.rejects(()=>ingest('rollback',0,[sample[0],sample[0]]));check('SQL conflict rolls back sessions, products and chunk marker',()=>{for(const t of ['sessions','products','chunks'])assert.equal(sql.prepare(`SELECT COUNT(*) n FROM ${t} WHERE import_id='rollback'`).get().n,0)});
check('JSON split respects UTF-8 bytes and rows',()=>{const parts=jsonBatches(Array.from({length:100},(_,n)=>({n,text:'中文'.repeat(100)})),15,2000);assert.equal(parts.flatMap(JSON.parse).length,100);for(const p of parts){assert.ok(Buffer.byteLength(p)<=2000);assert.ok(JSON.parse(p).length<=15)}});
// Synthetic workload is for batch sizing only, never a business dataset.
const big=Array.from({length:10000},(_,i)=>({...sample[i%sample.length],fullVisitorId:'bench'+i,visitId:i+1}));
const fileArg=process.argv.indexOf('--file');
const file=fileArg>=0?process.argv[fileArg+1]:null;
const blob=file?new Blob([fs.readFileSync(file)]):new Blob([big.map(r=>JSON.stringify(r)).join('\n')]);
const name=file||'synthetic.jsonl';
const realPrepare=env.DB.prepare,realBatch=env.DB.batch;
let counter;env.DB.prepare=q=>{const st=realPrepare(q);if(counter){if(/^INSERT/.test(q))counter.insertStatements++;if(/^SELECT/.test(q))counter.readCalls++;}return st};
env.DB.batch=async ss=>{const t=performance.now();const result=await realBatch(ss);if(counter){counter.batchCalls++;counter.writeWallMs+=performance.now()-t}return result};
const reports=[];let baseline;
for(const mode of ['legacy','bulk-5000','bulk-10000']){
 const id='perf-'+mode;counter={insertStatements:0,readCalls:0,batchCalls:0,writeWallMs:0};let n=0,sessions=0,events=0,maxBatch=0;const start=performance.now();
 for await(const batch of gaBatches(blob,name,mode==='legacy',mode==='bulk-10000'?10000:5000)){
 await (mode==='legacy'?before:ingest)(id,n++,batch);sessions+=batch.length;events+=batch.reduce((n,r)=>n+r.hits.length,0);maxBatch=Math.max(maxBatch,batch.length);
 }
 const stats=counter;counter=null;const processingMs=performance.now()-start,stored=snapshots(id);
 const fingerprint=createHash('sha256').update(JSON.stringify(stored)).digest('hex');if(baseline)assert.equal(fingerprint,baseline);else baseline=fingerprint;
 const totals=sql.prepare('SELECT COUNT(*) sessions,COUNT(DISTINCT visitor) visitors,COUNT(DISTINCT CASE WHEN buyer=1 THEN visitor END) buyers,SUM(transactions) transactions,SUM(hits) events FROM sessions WHERE import_id=?').get(id);
 if(file&&sessions===64694)assert.deepEqual({...totals},{sessions:64694,visitors:53041,buyers:662,transactions:713,events:300074});
 const storedRows=stored.sessions.length+stored.products.length;
 reports.push({mode,...stats,transactions:stats.batchCalls,processingMs,sessions,events,productRows:stored.products.length,storedRows,maxBatch,fingerprint,storedRowsPerSecond:storedRows*1000/stats.writeWallMs,totals});
 for(const t of ['sessions','products','chunks'])sql.prepare(`DELETE FROM ${t} WHERE import_id=?`).run(id);
}
check('legacy, 5000 and 10000 have identical complete row fingerprints',()=>assert.equal(new Set(reports.map(r=>r.fingerprint)).size,1));
sql.prepare("INSERT INTO imports(id,hash,name,status,sample,created,report,raw) VALUES('old','test','sample.jsonl','committed',0,'now','{}',1)").run();
const bench=await startBenchmark('old','bulk-5000');const r=await ingest(bench.id,0,sample);const finished=await finishBenchmark(bench.id,{...r.telemetry});
check('benchmark compares full rows and cleans only isolated staging',()=>{assert.equal(finished.equal,true);assert.equal(sql.prepare('SELECT COUNT(*) n FROM sessions WHERE import_id=?').get(bench.id).n,0);assert.equal(sql.prepare("SELECT COUNT(*) n FROM sessions WHERE import_id='old'").get().n,90)});
await assert.rejects(()=>cleanBenchmark('old'));checks++;console.log('PASS cleanup rejects formal data');
const output={environment:'Local Node SQLite in-memory; no production network or D1 timing',dataset:file?{file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}:{synthetic:true,description:'10000 unique session IDs, cycling development sample; NOT January data'},checks,reports};
fs.mkdirSync('docs',{recursive:true});fs.writeFileSync('docs/ga-local-benchmark.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
