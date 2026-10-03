import {analysisResult} from './discovery/analysis-result';
import {METRIC_RULES} from './discovery/foundation';
import {cachedAggregates} from './aggregate-cache';
import {periodQuery} from './discovery/aggregation';
import {monthEnd} from './discovery/periods';
import {rows,batchRows} from './db';
export type Filters={months?:string[],channel?:string,device?:string,sample?:boolean};
export function where(f:Filters={},alias='s'){const args:any[]=[];let sql=f.sample?`${alias}.import_id='sample-v1'`:`(${alias}.month,${alias}.import_id) IN (SELECT month,import_id FROM months)`;
 if(f.months?.length){if(f.months.length>60||f.months.some(m=>!/^\d{4}-\d{2}$/.test(m)))throw Error('月份无效');sql+=` AND ${alias}.month IN (${f.months.map(()=>'?').join(',')})`;args.push(...f.months)}
 for(const k of ['channel','device'] as const)if(f[k]){sql+=` AND ${alias}.${k}=?`;args.push(f[k])}return {sql,args}}
export const measures:any={revenue:'SUM(s.revenue)',transactions:'SUM(s.transactions)',visitors:'COUNT(DISTINCT s.visitor)',buyers:'COUNT(DISTINCT CASE WHEN s.buyer=1 THEN s.visitor END)',conversion:'1.0*COUNT(DISTINCT CASE WHEN s.buyer=1 THEN s.visitor END)/NULLIF(COUNT(DISTINCT s.visitor),0)',aov:'SUM(s.revenue)/NULLIF(SUM(s.transactions),0)',sessions:'COUNT(*)',views:'SUM(s.views)',adds:'SUM(s.adds)',checkouts:'SUM(s.checkouts)',purchases:'SUM(s.purchases)',ordered:'SUM(s.ordered)',cart_conversion:'1.0*SUM(s.ordered)/NULLIF(SUM(s.adds),0)'};
const pm:any={views:'SUM(p.views)',adds:'SUM(p.adds)',checkouts:'SUM(p.checkouts)',purchases:'SUM(p.purchases)',ordered:'SUM(p.ordered)',quantity:'SUM(p.quantity)',product_revenue:'SUM(p.revenue)',add_rate:'1.0*SUM(CASE WHEN p.views=1 AND p.adds=1 THEN 1 ELSE 0 END)/NULLIF(SUM(p.views),0)',cart_conversion:'1.0*SUM(p.ordered)/NULLIF(SUM(p.adds),0)'};
export const labels:any={revenue:'GMV',transactions:'交易数',visitors:'访客数',buyers:'购买人数',conversion:'购买转化率',aov:'客单价',sessions:'会话数',views:'浏览会话',adds:'加购会话',checkouts:'结账会话',purchases:'购买事件会话',ordered:'加购后购买会话',cart_conversion:'加购后购买比例',quantity:'销售数量',product_revenue:'商品 GMV',add_rate:'浏览会话加购比例'};
export function preparePlan(input:any,override?:Filters){const dimension=input.dimension||'total';if(!['total','date','month','channel','device','product','channel_month'].includes(dimension))throw Error('不支持的分析维度');const product=dimension==='product';const dict=product?pm:measures;const metrics=Array.isArray(input.metrics)?input.metrics:[];if(!metrics.length||metrics.length>8||metrics.some((m:any)=>!Object.hasOwn(dict,m)))throw Error('不支持的指标组合');const f={...(input.filters||{}),...(override||{})};const w=where(f);const dims:any={date:'s.date',month:'s.month',channel:'s.channel',device:'s.device',product:'p.sku',channel_month:"s.month || ' · ' || s.channel"};const select=dimension==='total'?"'全部' AS dimension":`${dims[dimension]} AS dimension${product?', MAX(p.name) AS product_name':''}`;let filter=w.sql;const args=[...w.args];if(product&&input.product){filter+=' AND (p.name LIKE ? OR p.sku LIKE ?)';args.push('%'+String(input.product).slice(0,100)+'%','%'+String(input.product).slice(0,100)+'%')}
 if(product&&input.minViews!=null){const min=Number(input.minViews);if(!Number.isInteger(min)||min<0||min>1000000)throw Error('浏览阈值无效')}const having=product&&input.minViews?` HAVING SUM(p.views)>=${Number(input.minViews)}`:'';const direction=input.direction==='asc'?'ASC':'DESC';const sort=input.sort==='dimension'?'dimension':metrics.includes(input.sort)?input.sort:metrics[0];const sortSql=sort==='dimension'&&product?'product_name':sort;const sql=`SELECT ${select}, ${metrics.map((m:string)=>dict[m]+' AS '+m).join(', ')} FROM sessions s ${product?'JOIN products p ON p.import_id=s.import_id AND p.sid=s.sid':''} WHERE ${filter}${dimension==='total'?'':' GROUP BY '+dims[dimension]}${having} ORDER BY ${['date','month'].includes(dimension)?'dimension ASC':sortSql+' '+direction} LIMIT ${dimension==='date'?366:100}`;
 return {sql,params:args,plan:{dimension,metrics,filters:f,product:input.product||'',sort,direction:input.direction==='asc'?'asc':'desc',minViews:Number(input.minViews)||0},labels:Object.fromEntries(metrics.map((m:string)=>[m,labels[m]])),scope:'访客按筛选范围去重；金额为 USD。商品指标按会话×商品统计。加购后购买要求同一会话、同一商品，购买晚于加购；不代表跨会话转化。'};}
export async function runPlan(input:any,override?:Filters){const plan=preparePlan(input,override);return {...plan,rows:await rows(plan.sql,plan.params)}}
export async function shoppingTransitions(f:Filters){
 const w=where(f),pairs=[['views','adds'],['adds','checkouts'],['checkouts','purchases']];
 const sql=`SELECT ${pairs.map(([a,b],i)=>`SUM(CASE WHEN s.${a}=1 AND s.${b}=1 THEN 1 ELSE 0 END) AS n${i}, SUM(s.${a}) AS d${i}`).join(', ')} FROM sessions s WHERE ${w.sql}`;
 const r=(await rows(sql,w.args))[0];
 return {rows:pairs.map(([from,to],i)=>{const numerator=Number(r?.['n'+i]||0),denominator=Number(r?.['d'+i]||0);return {from,to,basis:'session_intersection',ordered:false,numerator,denominator,rate:denominator?numerator/denominator:null}}),sql,params:w.args};
}
export function comparisonMonths(selected:string[],available:string[]){
 const current=[...new Set(selected.length?selected:available)].sort();
 if(!current.length)return {current,previous:[],reason:'暂无本期数据'};
 const shift=(m:string,n:number)=>new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5))-1+n,1)).toISOString().slice(0,7);
 if(current.some((m,i)=>m!==shift(current[0],i)))return {current,previous:[],reason:'请选择连续月份进行环比'};
 const previous=current.map(m=>shift(m,-current.length));
 return {current,previous,reason:previous.every(m=>available.includes(m))?'':'暂无上期数据'};
}
export async function dashboard(f:Filters,options:{overview?:boolean}={}){
 const started=performance.now(),versions=await rows('SELECT month,import_id FROM months ORDER BY month');
 const available=versions.map(r=>r.month);
 const period=comparisonMonths(f.months||[],available);if(f.sample)period.reason='样例不计算经营环比';
 const w=where(f),pairs=[['views','adds'],['adds','checkouts'],['checkouts','purchases']];
 const keys=['revenue','transactions','aov','visitors','buyers','conversion','sessions','views','adds','checkouts','purchases','ordered','cart_conversion'];
 const sql=`SELECT ${keys.map(k=>measures[k]+' AS '+k).join(',')},${pairs.map(([a,b],i)=>`SUM(CASE WHEN s.${a}=1 AND s.${b}=1 THEN 1 ELSE 0 END) AS n${i}`).join(',')} FROM sessions s WHERE ${w.sql}`;
 const plans=[
 preparePlan({dimension:'date',metrics:['revenue','transactions','visitors','conversion','aov'],filters:f}),
 preparePlan({dimension:'channel',metrics:['revenue','visitors','buyers','conversion'],filters:f}),
 preparePlan({dimension:'device',metrics:['adds','ordered','cart_conversion'],filters:f}),
 preparePlan({dimension:'month',metrics:['revenue','transactions','visitors','conversion','aov'],filters:f}),
 ...(!period.reason?[preparePlan({dimension:'total',metrics:['revenue','transactions','aov','visitors','buyers','conversion'],filters:{...f,months:period.previous}})]:[])
 ];
 // The same raw period aggregation feeds dashboard, Metric Tree and dimension analysis.
 const span=(months:string[])=>{const start=months[0]+'-01',end=monthEnd(months.at(-1)!);return {start,end,days:Math.round((Date.parse(end)-Date.parse(start))/86400000)+1}};
 const shared=period.reason?null:periodQuery(f,{current:span(period.current),previous:span(period.previous)});
 const queries=shared?[shared,...(options.overview?plans.slice(0,1):plans.slice(0,4))]:[{sql,params:w.args},...(options.overview?plans.slice(0,1):plans)];
 const {results:[totals,trend,channels,devices,monthly],stats}=await cachedAggregates(queries,versions);
 const asDashboard=(r:any)=>{
  const count=r?.sessions||0,result:any={};
  for(const key of keys)result[key]=['visitors','buyers','sessions'].includes(key)?r?.[key]||0:count?r[key]:null;
  result.aov=r?.transactions?r.revenue/r.transactions:null;
  result.conversion=r?.visitors?r.buyers/r.visitors:null;
  result.cart_conversion=r?.adds?r.ordered/r.adds:null;
  ['view_add_n','add_checkout_n','checkout_purchase_n'].forEach((k,i)=>result['n'+i]=count?r[k]:null);
  return result;
 };
 const total=shared?asDashboard(totals.find(r=>r.period==='current')):totals[0];
 const previous:any=shared?{dimension:'全部',...Object.fromEntries(['revenue','transactions','aov','visitors','buyers','conversion'].map(k=>[k,asDashboard(totals.find(r=>r.period==='previous'))[k]]))}:undefined;
 const after=await rows('SELECT month,import_id FROM months ORDER BY month');
 if(JSON.stringify(versions)!==JSON.stringify(after))throw Error('查询期间数据更新，请重新查询');
 const changes=Object.fromEntries(['revenue','transactions','aov','visitors','buyers','conversion'].map(k=>{const c=total[k],p=previous?.[k];const reason=period.reason||(p==null||c==null?'暂无可比数据':p===0?'上期为零':'');return [k,{relative:reason?null:(c-p)/Math.abs(p)*100,reason}]}));
 // Reuse exact server results from the already validated dashboard snapshot.
 const analysis=shared?analysisResult({plan:{metric:'revenue',filters:f,dimensions:[],scope:[],recommendation:undefined,availableDimensions:METRIC_RULES.revenue.dimensions.filter(d=>!f[d as 'channel'|'device']),operation:'metric_decomposition',mode:'overview',month:undefined},period:{mode:'overview',current:span(period.current),previous:span(period.previous),reason:''},sourceVersions:versions.filter(v=>v.month>=period.previous[0]&&v.month<=period.current.at(-1)!),queries:[shared],results:[totals],stats:{...stats,executed:0,databaseMs:0,reusedDashboard:true},started}):null;
 return {analysis,sourceVersions:versions,performance:{serverMs:performance.now()-started,totalQueries:stats.executed+2,aggregation:stats},total,trend,monthly,channels,devices,funnel:total,transitions:pairs.map(([from,to],i)=>({from,to,basis:'session_intersection',ordered:false,numerator:Number(total['n'+i]||0),denominator:Number(total[from]||0),rate:total[from]?Number(total['n'+i]||0)/total[from]:null})),transitionEvidence:{sql,params:w.args},comparison:{...period,previousTotal:previous,changes}};
}
