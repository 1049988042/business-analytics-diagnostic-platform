const day=(s:string,n:number)=>new Date(Date.parse(s+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export const monthEnd=(m:string)=>new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5)),0)).toISOString().slice(0,10);
const previousMonth=(m:string)=>new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5))-2,1)).toISOString().slice(0,7);
export function periods(dates:string[],selected:string[],anchor?:string,mode='month'){
 const available=[...new Set(dates.map(d=>d.slice(0,7)))].sort(),options=selected.length?available.filter(m=>selected.includes(m)):available;
 const month=anchor||options.at(-1);if(!month||!options.includes(month))return {reason:'当前选择范围没有可扫描的正式数据',options};
 const prev=previousMonth(month),method=mode==='auto'?(available.includes(prev)?'month':'week'):mode;
 if(!['month','week'].includes(method))throw Error('对比方式无效');
 const end=method==='month'?monthEnd(month):dates.filter(d=>d.startsWith(month)).at(-1)!;
 const current={start:method==='month'?month+'-01':day(end,-6),end};
 const previous={start:method==='month'?prev+'-01':day(end,-13),end:method==='month'?monthEnd(prev):day(end,-7)};
 const span=(p:any)=>Math.round((Date.parse(p.end)-Date.parse(p.start))/86400000)+1;
 const covered=(p:any)=>dates.filter(d=>d>=p.start&&d<=p.end).length===span(p);
 return {options,month,mode:method,current:{...current,days:span(current)},previous:{...previous,days:span(previous)},reason:covered(current)&&covered(previous)?'':'当前周期或对比周期数据不完整，暂不扫描；缺失日期不会当作零。'};
}
