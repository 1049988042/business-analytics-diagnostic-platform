export function normalize(s:any){
 if(!s||typeof s.fullVisitorId!=='string'||!s.fullVisitorId||!s.visitId||!/^\d{8}$/.test(s.date)||!Array.isArray(s.hits))throw Error('缺少会话标识、日期或 hits 数组；访客编号必须保留为字符串');
 const date=s.date.slice(0,4)+'-'+s.date.slice(4,6)+'-'+s.date.slice(6,8);if(new Date(date).toISOString().slice(0,10)!==date)throw Error('日期无效');
 const num=(x:any)=>{if(x==null||x==='')return 0;const n=Number(x);if(!Number.isFinite(n)||n<0)throw Error('金额或数量包含无效值');return n};
 const sid=s.date+':'+s.fullVisitorId+':'+s.visitId,ps=new Map<string,any>(),tx=new Map<string,any>(),ids=new Set();let missing=0,purchaseEvents=0;
 let flags=[0,0,0,0];
 for(const h of s.hits){const action=String(h.eCommerceAction?.action_type||'0'),ix=['2','3','5','6'].indexOf(action);if(ix<0)continue;flags[ix]=1;const t=num(h.time),hn=num(h.hitNumber);const order=t*10000+hn;
 if(action==='6'){purchaseEvents++;if(h.transaction?.transactionId)ids.add(String(h.transaction.transactionId));else missing++}
 for(const p of h.product||[]){if(p.isImpression===true)continue;const sku=String(p.productSKU||'');if(!sku){if(action==='6'||action==='3')throw Error('加购或购买记录缺少商品编号');continue}
 const v=ps.get(sku)||{sku,name:String(p.v2ProductName||sku).slice(0,300),category:String(p.v2ProductCategory||'未分类').slice(0,200),views:0,adds:0,checkouts:0,purchases:0,ordered:0,quantity:0,revenue:0,add:Infinity,buy:-1};
 if(action==='2')v.views=1;if(action==='3'){v.adds=1;v.add=Math.min(v.add,order)}if(action==='5')v.checkouts=1;if(action==='6'){v.purchases=1;const id=h.transaction?.transactionId;if(id){const key=String(id)+'|'+sku;const old=tx.get(key)||{sku,q:0,r:0,time:Infinity};old.time=Math.min(old.time,order);old.q=Math.max(old.q,num(p.productQuantity));old.r=Math.max(old.r,num(p.productRevenue)/1e6);tx.set(key,old)}}ps.set(sku,v);
 }}
 for(const t of tx.values()){const p=ps.get(t.sku);p.quantity+=t.q;p.revenue+=t.r;p.buy=Math.max(p.buy,t.time)}
 for(const p of ps.values()){p.ordered=Number(p.add< p.buy);delete p.add;delete p.buy}
 const transactions=num(s.totals?.transactions);if(!Number.isInteger(transactions))throw Error('交易数不是整数');
 return {session:{sid,date,month:date.slice(0,7),visitor:s.fullVisitorId,channel:String(s.channelGrouping||'未记录').slice(0,100),device:String(s.device?.deviceCategory||'未记录').slice(0,30),transactions,revenue:num(s.totals?.transactionRevenue)/1e6,buyer:Number(transactions>0),views:flags[0],adds:flags[1],checkouts:flags[2],purchases:flags[3],ordered:Number([...ps.values()].some(p=>p.ordered)),hits:s.hits.length,purchase_events:purchaseEvents,transaction_ids:ids.size,missing_ids:missing},products:[...ps.values()]};
}
