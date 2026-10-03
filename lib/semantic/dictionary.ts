export type Field={key:string;label:string;type:'id'|'number'|'time'|'category'|'text';definition:string;aliases:string[]};
export const fields:Field[]=[
{key:'order_id',label:'订单编号',type:'id',definition:'一笔业务订单的稳定编号；订单明细和重复购买上报可以共享同一个编号。',aliases:['order_id','orderid','订单id','订单编号','订单号','交易编号','交易号','transaction_id']},
{key:'user_id',label:'用户编号',type:'id',definition:'用于去重用户的稳定标识，不是姓名或手机号。',aliases:['user_id','userid','用户id','用户编号','客户编号','客户id','访客编号','visitor_id','fullVisitorId']},
{key:'amount',label:'金额',type:'number',definition:'必须确认是整单金额还是行金额，以及实付金额或 GMV 的业务口径。不是单价。',aliases:['amount','实付金额','支付金额','订单金额','成交额','交易金额','行金额','商品实付金额','销售额','revenue','gmv']},
{key:'quantity',label:'商品件数',type:'number',definition:'商品数量，不是订单笔数。订单数量、数量等模糊列名需人工判断。',aliases:['quantity','购买件数','商品件数','商品数量','销售数量','购买数量','销量']},
{key:'event_time',label:'业务时间',type:'time',definition:'指标归属时间，必须确认下单、支付或行为发生时间，不能用注册或发货时间替代。',aliases:['event_time','下单时间','支付时间','订单时间','行为时间','事件时间','order_time','paid_at','timestamp']},
{key:'channel',label:'渠道',type:'category',definition:'流量或订单渠道；同一用户可能跨渠道出现，分组人数不一定可相加。',aliases:['channel','渠道','流量来源','来源渠道','获客渠道','channelGrouping']},
{key:'device',label:'设备类别',type:'category',definition:'如 mobile、desktop、tablet；保留上传值，不猜测设备型号含义。',aliases:['device','设备','设备类型','设备类别','device_category']},
{key:'product_id',label:'商品编号',type:'id',definition:'识别同一商品的稳定编号，SKU 指 Stock Keeping Unit（库存单位）。',aliases:['product_id','productid','sku','商品id','商品编号','商品编码','productSKU']},
{key:'product_name',label:'商品名称',type:'text',definition:'商品展示名称；关联与去重使用商品编号。',aliases:['product_name','商品名称','商品名','品名','v2ProductName']},
{key:'category',label:'商品类别',type:'category',definition:'商品所属业务品类。',aliases:['category','商品类别','商品品类','品类','类别','v2ProductCategory']},
{key:'event_type',label:'行为类型',type:'category',definition:'需另行确认原始值对应浏览、加购、移除、结账、购买或其他。',aliases:['event_type','行为类型','事件类型','行为','action_type','action']},
{key:'event_id',label:'事件编号',type:'id',definition:'一次事件的稳定编号，用于识别重复上报；不是行为类型。',aliases:['event_id','事件id','事件编号','埋点id']},
{key:'session_id',label:'会话编号',type:'id',definition:'把一次访问中的行为关联起来，不等于用户编号。',aliases:['session_id','sessionid','会话id','会话编号','访问编号']},
{key:'line_id',label:'订单明细编号',type:'id',definition:'同一订单内一条商品明细的稳定编号，用于区分重复行和合法的多条明细。',aliases:['line_id','order_item_id','明细编号','订单明细编号','订单行id']},
{key:'region',label:'地区',type:'category',definition:'上传数据定义的地域，不自动推断为收货地或访问地。',aliases:['region','地区','省份','地域']},
{key:'user_type',label:'用户类型',type:'category',definition:'如新客、老客，沿用已确认的数据定义，不从单月首次出现推断。',aliases:['user_type','用户类型','新老用户','客户类型']}
];
export const eventLabels:Record<string,string>={view:'商品浏览',add_to_cart:'加购',remove_from_cart:'移除',checkout:'结账',purchase:'完成购买',other:'其他 / 不参与购物行为指标'};
export const eventAliases:Record<string,string>={view:'view',view_item:'view',product_view:'view','商品浏览':'view','浏览':'view',add_to_cart:'add_to_cart','加购':'add_to_cart','加入购物车':'add_to_cart',remove_from_cart:'remove_from_cart','移除':'remove_from_cart','移出购物车':'remove_from_cart',begin_checkout:'checkout',checkout:'checkout','结账':'checkout','开始结账':'checkout',purchase:'purchase','完成购买':'purchase','购买':'purchase','支付成功':'purchase'};
export const metricDictionary=[
{key:'orders',label:'订单数',dependencies:['order_id','event_time'],formula:'COUNT(DISTINCT order_id)',dedup:'订单编号；行为数据仅取已确认的 purchase 记录',time:'订单表按确认的下单或支付时间；事件表按首次购买事件时间'},
{key:'amount',label:'业务金额',dependencies:['order_id','amount','event_time'],formula:'整单金额先按订单去重，再 SUM；行金额先按订单＋明细编号去重，再 SUM',dedup:'相同订单的整单金额必须一致；行金额使用订单＋明细编号',time:'与订单数使用同一订单归属时间'},
{key:'buyers',label:'购买用户数',dependencies:['order_id','user_id','event_time'],formula:'COUNT(DISTINCT user_id) FROM 合格购买订单',dedup:'所选数据范围内用户去重，不能相加月份或渠道的用户数',time:'合格购买订单的归属时间'},
{key:'aov',label:'客单价',dependencies:['order_id','amount','event_time'],formula:'业务金额 / 订单数',dedup:'继承金额与订单数口径，分母为 0 返回不可计算',time:'分子分母相同范围'},
{key:'visitors',label:'访客数',dependencies:['user_id','event_time','event_type'],formula:'COUNT(DISTINCT user_id) FROM 全量访问行为',dedup:'用户范围去重；订单表无法提供未购买访客',time:'行为发生时间；需确认包含全部访客'},
{key:'conversion',label:'购买转化率',dependencies:['order_id','user_id','event_time','event_type'],formula:'购买用户数 / 访客数',dedup:'双方均按用户去重；无完整流量覆盖时不计算',time:'相同数据集和时间范围'},
{key:'quantity',label:'商品销量',dependencies:['order_id','product_id','line_id','quantity'],formula:'SUM(quantity) FROM 去重购买明细',dedup:'订单＋明细编号；订单总表不推断商品级销量',time:'所属购买订单的时间'}
];
export type Config={grain:'orders'|'order_items'|'events';mapping:Record<string,string>;amountScope:'order_total'|'line_total'|'';amountMeaning:'paid'|'gmv'|'recorded'|'';currency:string;unit:number;timeRole:'order'|'payment'|'event'|'';timezone:string;deduplicate:boolean;paidOnly:boolean;fullTraffic:boolean;eventMap:Record<string,string>;confirmed:boolean};
export const timezones=[{key:'Asia/Shanghai',label:'北京时间 UTC+8',offset:'+08:00'},{key:'UTC',label:'UTC',offset:'Z'},{key:'America/Los_Angeles',label:'美国洛杉矶（自动夏令时）',offset:''}];
export function validateConfig(c:Config,headers:string[]){if(!c||!c.confirmed)throw Error('请人工确认字段与业务口径');if(!['orders','order_items','events'].includes(c.grain))throw Error('请选择每行代表什么');const used=new Set<string>();for(const [raw,key]of Object.entries(c.mapping||{})){if(!headers.includes(raw))throw Error('映射列不在文件中');if(!key)continue;if(!fields.some(f=>f.key===key))throw Error('未知标准字段');if(used.has(key))throw Error('一个标准字段不能对应多个原始列');used.add(key)}if(!used.has('event_time'))throw Error('必须映射业务时间');if(!timezones.some(t=>t.key===c.timezone))throw Error('请选择时间口径');if(!(c.grain==='events'?['event']:['order','payment']).includes(c.timeRole))throw Error('请选择与数据类型匹配的业务时间含义');if(c.grain==='events'&&!used.has('event_type'))throw Error('行为数据必须映射行为类型');if(c.grain!=='events'&&!used.has('order_id'))throw Error('订单数据必须映射订单编号');if(c.grain!=='events'&&!c.paidOnly)throw Error('请确认文件仅包含口径一致的有效购买订单；取消、退款和未支付订单需先处理');if(c.grain==='order_items'&&(!used.has('line_id')||!used.has('product_id')))throw Error('商品明细必须有订单明细编号和商品编号');if(used.has('amount')){if(!['order_total','line_total'].includes(c.amountScope)||!['paid','gmv','recorded'].includes(c.amountMeaning)||!['CNY','USD','EUR'].includes(c.currency)||![1,100,1000000].includes(Number(c.unit)))throw Error('请确认金额层级、业务含义、币种和单位');if(c.amountScope==='line_total'&&!used.has('line_id'))throw Error('行金额需要稳定的明细编号，防止重复求和');if(c.grain==='orders'&&c.amountScope!=='order_total')throw Error('一行一订单应使用整单金额')}for(const value of Object.values(c.eventMap||{}))if(!Object.hasOwn(eventLabels,value))throw Error('未知的标准行为');}
