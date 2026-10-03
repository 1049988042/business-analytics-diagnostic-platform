// Server-only policy. Consumes existing Shapley and recommendation results;
// it does not recompute metrics, change attribution, or claim statistical significance.
export const COVERAGE_VERSION='coverage-v1';
export const COVERAGE_RULES={factorShare:0.2,parentScale:0.01};
export function coverageHints(decomposition:any,recommendation:any,dimensions:any[]=[]){
 const factors=Object.entries(decomposition.branches).flatMap(([parent,items]:any)=>{
  const gross=items.reduce((n:number,i:any)=>n+Math.abs(i.amount),0);
  const floor=Math.abs(decomposition.metrics[parent].previous||0)*COVERAGE_RULES.parentScale;
  return items.map((i:any)=>({parent,metric:i.key,significant:Number.isFinite(i.amount)&&Math.abs(i.amount)>0&&Math.abs(i.amount)>=gross*COVERAGE_RULES.factorShare&&Math.abs(i.amount)>=floor,reason:{code:'absolute_shapley_share',amount:i.amount,gross,minimumShare:COVERAGE_RULES.factorShare,minimumImpact:floor,role:i.role}}));
 });
 const dimensionFlags=(recommendation?.candidates||[]).map((c:any)=>{
  const result=dimensions.find(d=>d.dimension===c.dimension);
  const canDrill=dimensions.some(d=>d.dimension!==c.dimension);
  // Only the strongest eligible increase/decrease, using existing denominator-weighted
  // ranking for ratios. No share of net change is constructed for distinct metrics.
  const groups=c.usable&&canDrill?['positive','negative'].flatMap(sign=>c.highlights[sign].slice(0,1).map((g:any)=>({name:g.name,significant:true,reason:{code:'leading_eligible_group',direction:sign,nature:result?.nature}}))):[];
  return {dimension:c.dimension,significant:c.usable,reason:{code:'existing_recommendation_signal',score:c.score,usable:c.usable},groups};
 });
 return {version:COVERAGE_VERSION,rules:COVERAGE_RULES,factors,dimensions:dimensionFlags};
}
