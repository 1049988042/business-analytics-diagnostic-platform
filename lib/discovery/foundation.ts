import {values} from './engine';
import {factors} from './contribution';
import {ratio,growth,question,transactionFactors,driver,factorSummary} from './explanation';
export const ANALYSIS_VERSION='ga-foundation-v1';
export const LABELS:Record<string,string>={revenue:'GMV',transactions:'交易数',aov:'客单价',visitors:'访客数',buyers:'购买访客数',conversion:'购买转化率',frequency:'购买用户人均交易次数'};
export const METRIC_TREE={revenue:{operation:'multiply',children:['transactions','aov']},transactions:{operation:'multiply',children:['visitors','conversion','frequency']},buyers:{operation:'multiply',children:['visitors','conversion']},visitors:{operation:'leaf'},conversion:{operation:'leaf'},aov:{operation:'leaf'},frequency:{operation:'leaf'}} as const;
export const DIMENSIONS=['channel','device'] as const;
export const METRIC_RULES=Object.fromEntries(Object.keys(LABELS).map(k=>[k,{dimensions:[...DIMENSIONS],nature:['revenue','transactions'].includes(k)?'additive':['visitors','buyers'].includes(k)?'distinct':'ratio'}]));
const node=(key:string,c:any,p:any)=>({key,label:LABELS[key],current:c[key],previous:p[key],delta:c[key]==null||p[key]==null?null:c[key]-p[key],relative:growth(c[key],p[key]),title:question(LABELS[key],c[key],p[key])});
function check(expected:number,actual:number,available:boolean){const error=available?actual-expected:null,tolerance=1e-8*Math.max(1,Math.abs(expected));return {status:available?'checked':'unavailable',expected,actual:available?actual:null,error,tolerance,passed:available?Math.abs(error!)<=tolerance:null}}
export function decompose(current:any,previous:any){
 // Hierarchical (Owen-style) allocation: first split T*A by two-factor
 // Shapley, then multiply each three-factor T contribution by mean AOV.
 // Thus internal interactions are averaged over six orders and interactions
 // with AOV are allocated at the parent level. This is not flat 4-factor Shapley.
 const c:any=values(current),p:any=values(previous),gmv=factors(current,previous);const tx=transactionFactors(c,p);
 const scale=c.aov==null||p.aov==null?null:(c.aov+p.aov)/2;
 const decorate=(items:any[],delta:number)=>{const lead=delta===0?null:driver(items,delta);return items.map(i=>({...i,role:i.amount===0?'无净影响':i===lead?(i.amount>0?'主要正向因素':'主要负向因素'):i.amount*delta<0?'抵消因素':'共同作用因素'}))};
 const top=decorate(gmv.items.map(i=>({...node(i.key,c,p),amount:i.amount})),c.revenue-p.revenue);
 const branch=decorate(tx.map(i=>({...node(i.key,c,p),amount:i.amount,gmvImpact:scale==null?null:i.amount*scale})),c.transactions-p.transactions);
 const buyerItems=c.conversion==null||p.conversion==null?[]:decorate([{...node('visitors',c,p),amount:(c.visitors-p.visitors)*(c.conversion+p.conversion)/2},{...node('conversion',c,p),amount:(c.conversion-p.conversion)*(c.visitors+p.visitors)/2}],c.buyers-p.buyers);
 const rootImpact=top.find(i=>i.key==='transactions')?.amount;
 const checks={gmv:check(c.revenue-p.revenue,top.reduce((n,i)=>n+i.amount,0),!gmv.reason),transactionBranch:check(rootImpact??0,branch.reduce((n,i)=>n+(i.gmvImpact||0),0),branch.length===3&&rootImpact!=null),transactions:check(c.transactions-p.transactions,branch.reduce((n,i)=>n+i.amount,0),branch.length===3),buyers:check(c.buyers-p.buyers,buyerItems.reduce((n,i)=>n+i.amount,0),buyerItems.length===2)};
 for(const result of Object.values(checks))if(result.passed===false)throw Error('指标贡献守恒校验失败；请核对原始指标口径');
 const metrics=Object.fromEntries(Object.keys(LABELS).map(k=>[k,node(k,c,p)]));
 const summaries={revenue:factorSummary('GMV',metrics.revenue.relative,top,c.revenue-p.revenue,LABELS),transactions:factorSummary('交易数',metrics.transactions.relative,branch,c.transactions-p.transactions,LABELS),buyers:factorSummary('购买访客数',metrics.buyers.relative,buyerItems,c.buyers-p.buyers,LABELS)};
 const impactSummary={positive:top.filter(i=>i.amount>0).map(i=>i.key),negative:top.filter(i=>i.amount<0).map(i=>i.key),delta:c.revenue-p.revenue,text:summaries.revenue+'最终 GMV 净变化 '+(c.revenue-p.revenue>=0?'+':'−')+'$'+Math.abs(c.revenue-p.revenue).toFixed(2)+'。'};
 const leading={revenue:driver(top,c.revenue-p.revenue)?.key||null,transactions:driver(branch,c.transactions-p.transactions)?.key||null,buyers:driver(buyerItems,c.buyers-p.buyers)?.key||null};
 if(c.revenue===p.revenue)leading.revenue=null;if(c.transactions===p.transactions)leading.transactions=null;if(c.buyers===p.buyers)leading.buyers=null;
 return {type:'MetricDecomposition',method:'hierarchical-shapley-v1',config:METRIC_TREE,metrics,branches:{revenue:top,transactions:branch,buyers:buyerItems},leading,summaries,impactSummary,checks,unavailable:{revenue:gmv.reason,transactions:tx.length?'':'购买访客数或访客数为零，无法定义乘法因素'},values:{current:c,previous:p}};
}
export function diagnose(c:any,p:any){const stages=[['view_add','浏览→加购','view_add_n','views'],['add_checkout','加购→结账','add_checkout_n','adds'],['checkout_purchase','结账→购买','checkout_purchase_n','checkouts']].map(([key,label,n,d])=>{const current=ratio(c[n]||0,c[d]||0),previous=ratio(p[n]||0,p[d]||0);return {key,label,current,previous,pp:current==null||previous==null?null:(current-previous)*100,relative:growth(current,previous),small:(c[d]||0)<100||(p[d]||0)<100}});const lead=[...stages].filter(s=>s.pp!=null&&!s.small).sort((a,b)=>Math.abs(b.pp!)-Math.abs(a.pp!))[0];return {type:'BehavioralDiagnosis',basis:'session_intersection',ordered:false,conversionRelative:growth(ratio(c.buyers,c.visitors),ratio(p.buyers,p.visitors)),stages,leading:lead?.key||null,summary:lead?lead.label+'环节的绝对变化最大：'+(lead.pp!>0?'+':'')+lead.pp!.toFixed(2)+' 个百分点。这里只定位共现变化，不能据此断言该环节造成购买转化变化。':'行为分母不足或比例不可计算，暂不判断主要变化环节。'}}
export function dimensionResult(metric:string,dimension:string,raw:any[],c:any,p:any){
 const nature=METRIC_RULES[metric].nature,map=new Map<string,any>();
 for(const row of raw){const r=map.get(row.dimension)||{id:row.dimension,name:row.dimension,current:{},previous:{}};r[row.period]=row;map.set(row.dimension,r)}
 const groups=[...map.values()].map(r=>{const cv:any=values({revenue:0,transactions:0,visitors:0,buyers:0,...r.current}),pv:any=values({revenue:0,transactions:0,visitors:0,buyers:0,...r.previous});return {...r,currentValue:cv[metric],previousValue:pv[metric],delta:cv[metric]==null||pv[metric]==null?null:cv[metric]-pv[metric],relative:growth(cv[metric],pv[metric]),diagnosis:diagnose(cv,pv)}}).sort((a,b)=>Math.abs(b.delta||0)-Math.abs(a.delta||0)||String(a.name).localeCompare(String(b.name)));
 const positive=groups.filter(r=>r.delta>0),negative=groups.filter(r=>r.delta<0),parent:any=node(metric,values(c),values(p));const sum=groups.reduce((n,r)=>n+(r.delta||0),0);
 if(nature==='additive'&&!check(parent.delta,sum,true).passed)throw Error('维度分组守恒校验失败；请核对筛选与原始指标口径');
 return {type:'DimensionAnalysis',metric,dimension,nature,label:nature==='additive'?'金额/数量变化':'分组变化',exactContribution:nature==='additive',groups,positive,negative,parent,samples:{currentVisitors:c.visitors,previousVisitors:p.visitors},conservation:nature==='additive'?check(parent.delta,sum,true):null,notice:nature==='distinct'?'各分组内独立去重，同一访客可跨组出现；分组变化不可相加为整体精确贡献。':nature==='ratio'?'比例变化不可直接相加；分子与分母继承相同筛选范围。':'同一层分组互斥，变化合计应与父范围一致。'};
}
export {recommend} from './recommendation';
