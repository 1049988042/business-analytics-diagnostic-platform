export type Aggregate=Record<string,number>;
export const DEFINITIONS=[
 {key:'revenue',label:'GMV',unit:'money',formula:'SUM(transactionRevenue / 1,000,000)',dependency:'totals.transactionRevenue',dedup:'每个会话一行，汇总会话金额',threshold:15},
 {key:'transactions',label:'交易数',unit:'number',formula:'SUM(totals.transactions)',dependency:'totals.transactions',dedup:'每个会话一行，不使用购买事件次数',threshold:15},
 {key:'visitors',label:'访客数',unit:'number',formula:'COUNT DISTINCT(fullVisitorId)',dependency:'fullVisitorId',dedup:'在每个完整对比周期内去重，不累加日访客',threshold:15},
 {key:'buyers',label:'购买人数',unit:'number',formula:'COUNT DISTINCT(fullVisitorId WHERE transactions > 0)',dependency:'fullVisitorId、totals.transactions',dedup:'在每个对比周期内去重',threshold:15},
 {key:'conversion',label:'购买转化率',unit:'rate',formula:'购买人数 / 访客数',dependency:'fullVisitorId、totals.transactions',dedup:'分子、分母均为周期去重人数',threshold:0.3},
 {key:'aov',label:'客单价',unit:'money',formula:'GMV / 交易数',dependency:'totals.transactionRevenue、totals.transactions',dedup:'使用周期总额及总交易数，不平均日客单价',threshold:15},
 {key:'view_add',label:'浏览与加购会话交集率',unit:'rate',formula:'浏览会话中也发生过加购的会话数 / 浏览会话数',dependency:'action_type 2、3',dedup:'每会话至多计一次，不要求先后顺序或同商品',threshold:0.3},
 {key:'add_checkout',label:'加购与结账会话交集率',unit:'rate',formula:'加购会话中也发生过结账的会话数 / 加购会话数',dependency:'action_type 3、5',dedup:'每会话至多计一次，不要求先后顺序或同商品',threshold:0.3},
 {key:'checkout_purchase',label:'结账与购买会话交集率',unit:'rate',formula:'结账会话中也发生过购买的会话数 / 结账会话数',dependency:'action_type 5、6',dedup:'每会话至多计一次，不要求先后顺序或同商品',threshold:0.3}
];
const div=(a:number,b:number)=>b?a/b:null;
export function values(a:Aggregate){return {...a,conversion:div(a.buyers,a.visitors),aov:div(a.revenue,a.transactions),view_add:div(a.view_add_n,a.views),add_checkout:div(a.add_checkout_n,a.adds),checkout_purchase:div(a.checkout_purchase_n,a.checkouts),frequency:div(a.transactions,a.buyers)}}
export function compareMetrics(current:Aggregate,previous:Aggregate){const c:any=values(current),p:any=values(previous);
 return DEFINITIONS.map(d=>{const now=c[d.key]??null,before=p[d.key]??null;let reason='';
 if(now==null||before==null)reason='至少一个周期分母为零，无法比较';
 else if(d.key==='visitors'&&Math.min(current.visitors,previous.visitors)<200)reason='至少一个周期访客不足 200';
 else if(d.key==='buyers'&&Math.max(current.buyers,previous.buyers)<20)reason='两个周期购买人数都不足 20';
 else if(d.key==='conversion'&&(Math.min(current.visitors,previous.visitors)<200||Math.max(current.buyers,previous.buyers)<20))reason='转化率扫描要求两期访客各至少 200，且至少一期购买人数达到 20';
 else if(['revenue','transactions','aov'].includes(d.key)&&Math.max(current.transactions,previous.transactions)<20)reason='两个周期交易数都不足 20';
 else if(d.key==='aov'&&Math.min(current.transactions,previous.transactions)<20)reason='客单价要求两期交易数各至少 20';
 else if(['view_add','add_checkout','checkout_purchase'].includes(d.key)){const denominator={view_add:'views',add_checkout:'adds',checkout_purchase:'checkouts'}[d.key]!;if(Math.min(current[denominator],previous[denominator])<100)reason='至少一个周期的行为分母不足 100 个会话'}
 const delta=now==null||before==null?null:now-before,relative=delta==null||before===0?null:delta/Math.abs(before)*100,pp=delta==null||d.unit!=='rate'?null:delta*100;
 const flagged=!reason&&delta!==null&&delta!==0&&(d.unit==='rate'?Math.abs(pp!)>=d.threshold&&(relative==null||Math.abs(relative)>=10):before===0?now>0:Math.abs(relative!)>=d.threshold);
 return {...d,current:now,previous:before,delta,relative,pp,reason,flagged,direction:delta==null||delta===0?'stable':delta>0?'growth':'decline'};
 });
}
export function findings(metrics:any[],segments:any[],daily:any[],currentStart:string){const cards:any[]=[];
 for(const m of metrics.filter(m=>m.flagged))cards.push({id:'metric-'+m.key,type:m.direction==='growth'?'增长':'下降',title:m.label+(m.direction==='growth'?'上升':'下降'),metric:m.key,current:m.current,previous:m.previous,relative:m.relative,pp:m.pp,unit:m.unit,detail:m.previous===0?'上期为零，只报告绝对变化，不计算增长百分比。':'达到当前扫描规则的变化阈值。',score:m.unit==='rate'?Math.abs(m.pp)/0.3:Math.abs(m.relative??100)/15});
 const find=(key:string)=>metrics.find(m=>m.key===key);
 const revenue=find('revenue'),conversion=find('conversion'),visitors=find('visitors');
 for(const [a,b,title] of [[revenue,conversion,'GMV与购买转化率走势相反'],[visitors,conversion,'访客数与购买转化率走势相反']] as any){if(a?.flagged&&b?.flagged&&a.delta*b.delta<0)cards.push({id:'divergence-'+a.key,type:'指标背离',title,detail:'两项指标均达到变化阈值，但方向相反。可继续检查客单价、购买频次及流量构成；当前结果不能确定业务原因。',evidence:[a,b],score:4})}
 for(const dimension of ['channel','device']){const group=segments.filter(s=>s.kind===dimension),ct=group.reduce((n,s)=>n+s.currentRevenue,0),pt=group.reduce((n,s)=>n+s.previousRevenue,0);if(ct<1000||pt<1000)continue;
 for(const s of group){const current=s.currentRevenue/ct,previous=s.previousRevenue/pt,pp=(current-previous)*100;if(Math.abs(pp)>=5&&Math.max(s.currentTransactions,s.previousTransactions)>=20)cards.push({id:'share-'+dimension+'-'+s.segment,type:'结构变化',title:`${dimension==='channel'?'渠道':'设备'} ${s.segment} 的GMV占比${pp>0?'上升':'下降'}`,unit:'rate',current,previous,pp,relative:null,detail:'两期总GMV均至少 1,000 USD，占比变化至少 5 个百分点，且该分组至少一期有 20 笔交易。这是结构变化，不代表因果贡献。',segment:s,score:Math.abs(pp)/5})}}
 for(let i=7;i<daily.length;i++){const day=daily[i];if(day.date<currentStart)continue;const history=daily.slice(i-7,i);if((Date.parse(day.date)-Date.parse(history[0].date))/86400000!==7)continue;
 const baseline=history.reduce((n,d)=>n+d.revenue,0)/7,orders=history.reduce((n,d)=>n+d.transactions,0)/7,change=baseline?(day.revenue-baseline)/baseline*100:null;
 if(change!=null&&Math.abs(change)>=50&&Math.abs(day.revenue-baseline)>=100&&Math.max(day.transactions,orders)>=10)cards.push({id:'daily-'+day.date,type:'日度波动',title:day.date+' GMV偏离前 7 日均值',unit:'money',current:day.revenue,previous:baseline,relative:change,pp:null,detail:'探索性规则：偏离至少 50%、金额差至少 100 USD，且当天或参考期日均交易至少 10 笔。未校正星期、节假日和促销影响，不代表统计显著异常。',history,score:Math.abs(change)/50})}
 const priority:Record<string,number>={'指标背离':0,'增长':1,'下降':1,'结构变化':2,'日度波动':3};
 return cards.sort((a,b)=>priority[a.type]-priority[b.type]||b.score-a.score||a.id.localeCompare(b.id));
}
export function metricTree(a:Aggregate){const v=values(a);return {revenue:a.revenue,transactions:a.transactions,aov:v.aov,visitors:a.visitors,conversion:v.conversion,buyers:a.buyers,frequency:v.frequency,equations:['GMV = 交易数 × 客单价','交易数 = 访客数 × 购买转化率 × 购买用户人均交易次数','购买转化率 = 购买访客数 / 访客数','购买用户人均交易次数 = 交易数 / 购买访客数'],note:'以上为同一统计范围内的恒等关系，分母为零时不计算。行为阶段比例没有严格顺序，不能连乘当作全店购买转化率。'}}
