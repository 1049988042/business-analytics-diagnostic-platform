export const ratio=(a:number,b:number)=>b>0?a/b:null;
export const growth=(c:number|null,p:number|null)=>c==null||p==null||p===0?null:(c-p)/Math.abs(p)*100;
export const pct=(n:number|null)=>n==null?'无法计算环比':(n>0?'+':'')+n.toFixed(2)+'%';
export const movement=(n:number)=>n>0?'增长':n<0?'下降':'持平';
export function question(label:string,c:number|null,p:number|null){const r=growth(c,p);return r==null?label+' 为什么变化？':r===0?label+' 为什么保持不变？':label+' 为什么'+movement(r)+' '+Math.abs(r).toFixed(2)+'%？'}
// Exact three-factor Shapley decomposition: average each factor's marginal
// effect across all six substitution orders. Pairwise interactions are split
// equally between their two factors, triple interaction equally among three.
export function transactionFactors(c:any,p:any){
 const keys=['visitors','conversion','frequency'];const cv=[c.visitors,ratio(c.buyers,c.visitors),ratio(c.transactions,c.buyers)],pv=[p.visitors,ratio(p.buyers,p.visitors),ratio(p.transactions,p.buyers)];
 if(cv.some(v=>v==null)||pv.some(v=>v==null))return [];
 const orders=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]],amounts=[0,0,0];
 for(const order of orders){const v=pv as number[];const state=[...v];for(const i of order){const before=state.reduce((a,b)=>a*b,1);state[i]=cv[i]!;amounts[i]+=(state.reduce((a,b)=>a*b,1)-before)/6}}
 return keys.map((key,i)=>({key,current:cv[i],previous:pv[i],relative:growth(cv[i],pv[i]),amount:amounts[i]}));
}
export function driver(items:any[],delta:number){const eligible=items.filter(i=>delta===0||i.amount*delta>0).sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount));if(!eligible.length)return null;return eligible[0]}
export function factorSummary(label:string,relative:number|null,items:any[],delta:number,labels:Record<string,string>){
 if(relative==null)return '上期为零或分母不足，先查看绝对变化，暂不判断增长率驱动。';
 if(Math.abs(delta)<1e-8)return label+(items.some(i=>Math.abs(i.amount)>1e-8)?'本期持平，各因素的正负影响相互抵消。':'本期持平，未发现非零的因素影响。');
 const lead=driver(items,delta);const same=items.filter(i=>i.amount*delta>0&&i!==lead),opposite=items.filter(i=>i.amount*delta<0);
 return label+'本期'+movement(delta)+' '+Math.abs(relative).toFixed(2)+'%，'+(lead?'主要由'+labels[lead.key]+movement(lead.current-lead.previous)+'推动':'需继续检查指标')+(same.length?'；'+same.map(i=>labels[i.key]+movement(i.current-i.previous)).join('、')+'共同作用':'')+(opposite.length?'；'+opposite.map(i=>labels[i.key]+movement(i.current-i.previous)).join('、')+'形成部分抵消':'')+'。';
}
