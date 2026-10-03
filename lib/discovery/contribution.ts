type Amount={revenue:number,transactions:number};
export function factors(current:Amount,previous:Amount){
 const delta=current.revenue-previous.revenue;
 if(current.transactions<=0||previous.transactions<=0)return {delta,reason:'至少一期交易数为零，无法拆分交易数与客单价贡献',items:[]};
 // Symmetric (two-factor Shapley) decomposition of R=T*A.
 // Delta R=A0*Delta T + T0*Delta A + Delta T*Delta A.
 // Average both substitution orders: each receives half of the interaction.
 // No residual balancing or rounding adjustment is used.
 const a=current.revenue/current.transactions,b=previous.revenue/previous.transactions;
 return {delta,reason:'',items:[{key:'transactions',label:'交易数变化',amount:(current.transactions-previous.transactions)*(a+b)/2},{key:'aov',label:'客单价变化',amount:(a-b)*(current.transactions+previous.transactions)/2}]};
}
export function contribution(joint:any[],current:Amount,previous:Amount){
 const groups=new Map<string,any>();
 for(const row of joint){let channel=groups.get(row.channel);if(!channel){channel={name:row.channel,current:0,previous:0,currentTransactions:0,previousTransactions:0,devices:new Map()};groups.set(row.channel,channel)}
 let device=channel.devices.get(row.device);if(!device){device={name:row.device,current:0,previous:0,currentTransactions:0,previousTransactions:0};channel.devices.set(row.device,device)}
 for(const target of [channel,device]){target[row.period]+=Number(row.revenue);target[row.period+'Transactions']+=Number(row.transactions)}
 }
 const delta=current.revenue-previous.revenue;
 const decorate=(row:any,parentDelta:number)=>({...row,delta:row.current-row.previous,share:Math.abs(parentDelta)<0.01?null:(row.current-row.previous)/parentDelta*100,relative:row.previous?(row.current-row.previous)/Math.abs(row.previous)*100:null});
 const sort=(a:any,b:any)=>Math.abs(b.delta)-Math.abs(a.delta)||a.name.localeCompare(b.name);
 const channels=[...groups.values()].map(({devices,...row})=>{const c=decorate(row,delta);return {...c,devices:[...devices.values()].map(d=>decorate(d,c.delta)).sort(sort)}}).sort(sort);
 const residual=delta-channels.reduce((n,c)=>n+c.delta,0);
 if(Math.abs(residual)>0.01)throw Error('渠道贡献与整体金额未对齐，请重新扫描');
 return {current:current.revenue,previous:previous.revenue,delta,factors:factors(current,previous),channels,residual,method:'对称分摊法，将交易数与客单价的交互变化各分一半；属于算术拆解，不代表因果关系。'};
}
