import {coverageHints} from './coverage';
import {cachedAggregates} from '../aggregate-cache';
import {ANALYSIS_VERSION,decompose,diagnose,dimensionResult} from './foundation';
import {contribution} from './contribution';
import {rows,batchRows} from '../db';import {where,comparisonMonths,type Filters} from '../query';
import {compareMetrics,findings,metricTree,DEFINITIONS} from './engine';
import {periods,monthEnd} from './periods';
export {periods} from './periods';
import {zero,periodQuery} from './aggregation';
export async function scan(input:any={}){
 const f:Filters=input.filters||{};where(f);
 if(f.sample)return {status:'unavailable',reason:'开发样例经过刻意抽样，不用于自动发现经营变化。'};
 const coverageQuery={name:'全店日期覆盖',sql:'SELECT s.date,COUNT(*) sessions FROM sessions s WHERE '+where({}).sql+' GROUP BY s.date ORDER BY s.date',params:[]};
 const evidence:any[]=[coverageQuery];
 const versions=await rows('SELECT month,import_id FROM months ORDER BY month');
 const {results:[coverage]}=await cachedAggregates([coverageQuery],versions);
 const dates=coverage.map(r=>r.date);let period:any;
 if(input.mode==='overview'){
 const comparison=comparisonMonths(f.months||[],versions.map(v=>v.month));
 const span=(months:string[])=>{const start=months[0]+'-01',end=monthEnd(months.at(-1)!);return {start,end,days:Math.round((Date.parse(end)-Date.parse(start))/86400000)+1}};
 period=comparison.reason?{reason:comparison.reason}:{mode:'overview',current:span(comparison.current),previous:span(comparison.previous),reason:''};
 }else period=periods(dates,f.months||[],input.month,input.mode||'month');
 if(period.reason)return {status:'unavailable',reason:period.reason,period,evidence};
 const {current,previous}=period as any;const w=where({...f,months:[]});
 const range=w.sql+' AND s.date BETWEEN ? AND ?',args=[...w.args,previous.start,current.end];
 const periodExpr="CASE WHEN s.date BETWEEN ? AND ? THEN 'current' ELSE 'previous' END",periodArgs=[current.start,current.end,...args];
 const queries=[
 periodQuery(f,period),
 {name:'渠道与设备 GMV贡献',sql:`SELECT ${periodExpr} period,s.channel,s.device,SUM(s.revenue) revenue,SUM(s.transactions) transactions FROM sessions s WHERE ${range} GROUP BY period,s.channel,s.device`,params:periodArgs},
 {name:'日度GMV',sql:`SELECT s.date,SUM(s.revenue) revenue,SUM(s.transactions) transactions FROM sessions s WHERE ${range} GROUP BY s.date ORDER BY s.date`,params:args}
 ];
 evidence.push(...queries);
 const {results:[totals,joint,dailyRows]}=await cachedAggregates(queries,versions);
 const c={...zero,...totals.find(r=>r.period==='current')},p={...zero,...totals.find(r=>r.period==='previous')};
 const segments:any[]=[];for(const kind of ['channel','device']){const map=new Map<string,any>();for(const row of joint){const name=row[kind],v=map.get(name)||{kind,segment:name,currentRevenue:0,previousRevenue:0,currentTransactions:0,previousTransactions:0};v[row.period+'Revenue']+=row.revenue;v[row.period+'Transactions']+=row.transactions;map.set(name,v)}segments.push(...map.values())}
 // A date with no selected-segment records is zero only after global coverage passed.
 const daily=dates.filter(d=>d>=previous.start&&d<=current.end).map(date=>({date,revenue:0,transactions:0,...dailyRows.find(r=>r.date===date)}));
 const metrics=compareMetrics(c,p).filter(m=>['revenue','transactions','aov','visitors','buyers','conversion'].includes(m.key)),cards=findings(metrics,segments,daily,current.start);
 let detail:any=null;
 if(input.detail==='traffic'||input.detail==='behavior'){
 const channel=input.channel?String(input.channel):'';if(channel&&f.channel&&channel!==f.channel)throw Error('下钻条件与全局筛选冲突');
 const dimension=input.detail==='traffic'&&!channel?'channel':'device';
 const query=periodQuery({...f,...(channel?{channel}:{} )},period,dimension);evidence.push(query);
 detail={kind:input.detail,dimension,channel,rows:(await cachedAggregates([query],versions)).results[0]};
 }else if(input.detail==='product'){
 const query={name:'商品结构周期对比',sql:`SELECT ${periodExpr} period,p.sku,MAX(p.name) name,SUM(p.quantity) quantity,SUM(p.revenue) revenue FROM sessions s JOIN products p ON p.import_id=s.import_id AND p.sid=s.sid WHERE ${range} GROUP BY period,p.sku`,params:periodArgs};evidence.push(query);detail={kind:'product',rows:(await cachedAggregates([query],versions)).results[0]};
 }
 const after=await rows('SELECT month,import_id FROM months ORDER BY month');if(JSON.stringify(after)!==JSON.stringify(versions))throw Error('扫描期间数据更新，请重新扫描');
 const sourceVersions=versions.filter(v=>v.month>=previous.start.slice(0,7)&&v.month<=current.end.slice(0,7));if(input.expectedSourceVersions&&JSON.stringify(input.expectedSourceVersions)!==JSON.stringify(sourceVersions))throw Error('数据已更新，请返回概览重新查看分析');
 const foundation=decompose(c,p);if(detail?.dimension){const dr=dimensionResult(detail.kind==='traffic'?'visitors':'conversion',detail.dimension,detail.rows,c,p);detail={...detail,result:dr,groups:dr.groups};}
 if(detail?.kind==='product'){const map=new Map<string,any>();for(const r of detail.rows){const v=map.get(r.sku)||{id:r.sku,name:r.name,current:{revenue:0,quantity:0},previous:{revenue:0,quantity:0}};v[r.period]=r;map.set(r.sku,v)}detail.groups=[...map.values()].map(r=>({...r,revenueDelta:r.current.revenue-r.previous.revenue,currentUnitRevenue:r.current.quantity>0?r.current.revenue/r.current.quantity:null})).sort((a,b)=>Math.abs(b.revenueDelta)-Math.abs(a.revenueDelta)||a.id.localeCompare(b.id));}
 return {status:'ready',analysisVersion:ANALYSIS_VERSION,coverage:coverageHints(foundation,null),decomposition:foundation,diagnosis:diagnose(c,p),detail,contribution:contribution(joint,c,p),period,filters:{channel:f.channel||'全部渠道',device:f.device||'全部设备'},scannedAt:new Date().toISOString(),inputFilters:f,sourceVersions:versions.filter(v=>v.month>=previous.start.slice(0,7)&&v.month<=current.end.slice(0,7)),metrics,cards,aggregates:{current:c,previous:p},tree:{current:metricTree(c),previous:metricTree(p)},segments,daily,evidence,definitions:DEFINITIONS,
 notes:['本模块扫描已确认导入的 GA 数据；通用字段映射数据集暂未接入。','按 GA 原始 date 划分日期，金额为 USD。上一周期可以位于侧栏所选月份之外。','GMV 按 totals.transactionRevenue 汇总并换算为 USD。','规则用于筛选值得查看的变化，不是显著性检验，也不证明业务原因。',...(current.days!==previous.days?[`两期分别有 ${current.days} 天和 ${previous.days} 天。总量变化包含天数差异，详情同时显示日均GMV和日均交易数；访客数不按日相加。`]:[])]};
}
