export type Scope=Array<{dimension:string;value:string}>;
export type ExplorationNode={id:string;kind:'metric'|'dimension'|'group'|'behavior'|'product';metric:string;parentMetric?:string;dimension?:string;group?:string;scope:Scope;path:string[];computed:boolean;significant:boolean;presented:boolean;explored:boolean;result:any;reason?:any};
export type AnalysisSession={id:string;contextKey:string;root:string;period:any;filters:any;sourceVersions:any[];metricVersion:string;coverageVersion:string;snapshot:any;nodes:Record<string,ExplorationNode>;history:Array<{sequence:number;action:string;nodeId:string;scope:Scope}>;responses:Record<string,any>};
const canonicalScope=(scope:Scope)=>[...scope].sort((a,b)=>a.dimension.localeCompare(b.dimension));
export const responseKey=(metric:string,scope:Scope)=>JSON.stringify([metric,canonicalScope(scope)]);
export const nodeId=(kind:string,metric:string,scope:Scope=[],dimension='',group='')=>JSON.stringify([kind,metric,canonicalScope(scope),dimension,group]);
export const sessionContext=(snapshot:any,root:string)=>JSON.stringify([root,snapshot.period,snapshot.inputFilters,snapshot.sourceVersions,snapshot.analysisVersion||snapshot.decomposition.method,snapshot.coverage?.version]);
export function metricPath(snapshot:any,root:string,target:string):string[]{if(root===target)return [root];for(const child of snapshot.decomposition.config[root]?.children||[]){const path=metricPath(snapshot,child,target);if(path.length)return [root,...path]}return []}
function upsert(s:AnalysisSession,n:ExplorationNode){const old=s.nodes[n.id];s.nodes[n.id]={...n,presented:n.presented||!!old?.presented,explored:n.explored||!!old?.explored}}
function mark(s:AnalysisSession,id:string,explored=false){const n=s.nodes[id];if(n)s.nodes[id]={...n,presented:true,explored:n.explored||explored}}
function copy(s:AnalysisSession):AnalysisSession{return {...s,nodes:{...s.nodes},history:[...s.history],responses:{...s.responses}}}
function history(s:AnalysisSession,action:string,id:string,scope:Scope=[]){s.history.push({sequence:s.history.length+1,action,nodeId:id,scope:structuredClone(scope)})}
export function startSession(snapshot:any,root:string,id:string):AnalysisSession{
 const s:AnalysisSession={id,root,contextKey:sessionContext(snapshot,root),period:snapshot.period,filters:snapshot.inputFilters,sourceVersions:snapshot.sourceVersions,metricVersion:snapshot.analysisVersion||snapshot.decomposition.method,coverageVersion:snapshot.coverage?.version||'unavailable',snapshot,nodes:{},history:[],responses:{}};
 const visit=(metric:string,parentMetric?:string)=>{
  const factor=snapshot.decomposition.branches[parentMetric||'']?.find((n:any)=>n.key===metric);
  const hint=snapshot.coverage?.factors.find((n:any)=>n.parent===parentMetric&&n.metric===metric);
  upsert(s,{id:nodeId('metric',metric),kind:'metric',metric,parentMetric,scope:[],path:metricPath(snapshot,root,metric),computed:true,significant:!!hint?.significant,presented:metric===root||parentMetric===root,explored:metric===root,result:factor||snapshot.decomposition.metrics[metric],reason:hint?.reason});
  for(const child of snapshot.decomposition.config[metric]?.children||[])visit(child,metric);
 };visit(root);history(s,'entry',nodeId('metric',root));return root==='conversion'?recordDiagnostic(s,'behavior',root,[],snapshot.diagnosis,true):s;
}
export function visitMetric(session:AnalysisSession,metric:string,action='click'){
 if(!session.nodes[nodeId('metric',metric)])return session;
 const s=copy(session);mark(s,nodeId('metric',metric),action!=='back');
 // Explicit continuation to a descendant enters its ancestor path as well.
 if(action==='resume')for(const ancestor of metricPath(s.snapshot,s.root,metric))mark(s,nodeId('metric',ancestor),true);
 for(const child of s.snapshot.decomposition.config[metric]?.children||[])mark(s,nodeId('metric',child));
 history(s,action,nodeId('metric',metric));return s;
}
export function recordDimensions(session:AnalysisSession,metric:string,scope:Scope,data:any,selected:string|null,exploreSelected=false){
 if(JSON.stringify(data.sourceVersions)!==JSON.stringify(session.sourceVersions)||data.analysisVersion!==session.snapshot.analysisVersion||data.coverage?.version!==session.coverageVersion)return session;
 const expected={...session.filters};for(const part of scope)expected[part.dimension]=part.value;
 if(data.request?.metric!==metric||['channel','device'].some(k=>(data.inputFilters?.[k]||'')!==(expected[k]||''))||['current','previous'].some(k=>data.period[k].start!==session.period[k].start||data.period[k].end!==session.period[k].end))return session;
 const s=copy(session),path=metricPath(s.snapshot,s.root,metric);s.responses[responseKey(metric,scope)]=data;
 for(const d of data.dimensions){
  const hint=data.coverage?.dimensions.find((n:any)=>n.dimension===d.dimension);
  const candidate=data.recommendation.candidates.find((n:any)=>n.dimension===d.dimension);
  const id=nodeId('dimension',metric,scope,d.dimension);
  upsert(s,{id,kind:'dimension',metric,dimension:d.dimension,scope:structuredClone(scope),path,computed:true,significant:!!hint?.significant,presented:selected===d.dimension,explored:selected===d.dimension&&exploreSelected,result:{dimension:d,candidate},reason:hint?.reason});
  const highlights=[...candidate.highlights.positive,...candidate.highlights.negative];
  for(const g of d.groups){const gh=hint?.groups.find((n:any)=>n.name===g.name);
   upsert(s,{id:nodeId('group',metric,scope,d.dimension,g.name),kind:'group',metric,dimension:d.dimension,group:g.name,scope:structuredClone(scope),path,computed:true,significant:!!gh?.significant,presented:selected===d.dimension&&highlights.some((n:any)=>n.name===g.name),explored:false,result:g,reason:gh?.reason});
  }
 }
 // A successful child-scope load confirms the explicitly requested group was entered.
 if(scope.length){const parent=scope.slice(0,-1),last=scope.at(-1)!;mark(s,nodeId('dimension',metric,parent,last.dimension),true);mark(s,nodeId('group',metric,parent,last.dimension,last.value),true)}
 if(selected)history(s,exploreSelected?'explore_dimension':'present_dimension',nodeId('dimension',metric,scope,selected),scope);
 return s;
}
export function expandDimension(session:AnalysisSession,metric:string,scope:Scope,dimension:string){
 const s=copy(session);mark(s,nodeId('dimension',metric,scope,dimension),true);
 for(const n of Object.values(s.nodes))if(n.kind==='group'&&n.metric===metric&&n.dimension===dimension&&responseKey(metric,n.scope)===responseKey(metric,scope))mark(s,n.id);
 history(s,'expand_groups',nodeId('dimension',metric,scope,dimension),scope);return s;
}
export function recordDiagnostic(session:AnalysisSession,kind:'behavior'|'product',metric:string,scope:Scope,result:any,explored:boolean){
 const s=copy(session),id=nodeId(kind,metric,scope);upsert(s,{id,kind,metric,scope:structuredClone(scope),path:metricPath(s.snapshot,s.root,metric),computed:true,significant:false,presented:true,explored,result});history(s,explored?'explore_diagnosis':'present_diagnosis',id,scope);return s;
}
export function sessionSummary(s:AnalysisSession){
 const all=Object.values(s.nodes);
 const missing=all.filter(n=>n.computed&&n.significant&&!n.explored);
 return {root:s.snapshot.decomposition.metrics[s.root],drivers:all.filter(n=>n.kind==='metric'&&n.parentMetric&&(n.parentMetric===s.root||s.nodes[nodeId('metric',n.parentMetric)]?.explored)),dimensions:all.filter(n=>n.kind==='dimension'&&n.explored),diagnoses:all.filter(n=>['behavior','product'].includes(n.kind)&&n.explored),explored:all.filter(n=>n.explored),missing,coverage:missing.length?'仍有重要变化尚未展开分析。':all.some(n=>n.significant)?'本次分析已覆盖当前数据识别出的主要推动和抵消因素。':'当前已计算结果尚未识别出达到覆盖规则的重要分支。'};
}
export function resumeTarget(n:ExplorationNode){return {metric:n.metric,scope:n.kind==='group'?[...n.scope,{dimension:n.dimension!,value:n.group!}]:n.scope,dimension:n.kind==='dimension'?n.dimension:null}}

export function recordBack(session:AnalysisSession,metric:string,scope:Scope){const s=copy(session);history(s,'back_dimension',nodeId('metric',metric),scope);return s}
