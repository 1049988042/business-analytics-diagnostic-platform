'use client';
import {useState} from 'react';
const money=(n:number)=>'$'+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const signed=(n:number)=>(n>0?'+':n<0?'−':'')+money(n);
export default function GmvContribution({data}:any){
 const [selected,setSelected]=useState('');const channel=data.channels.find((c:any)=>c.name===selected);
 const table=(rows:any[],drill:boolean)=><div className="tablewrap"><table><thead><tr><th>{drill?'渠道':'设备'}</th><th>上期 GMV</th><th>本期 GMV</th><th>增减金额</th></tr></thead><tbody>{rows.map((r:any)=><tr key={r.name}><td>{drill?<button className="textbtn" onClick={()=>setSelected(r.name)}>{r.name||'未标明'} · 查看来源</button>:r.name}</td><td>{money(r.previous)}</td><td>{money(r.current)}</td><td>{signed(r.delta)}</td></tr>)}</tbody></table></div>;
 return <div className="gmv-contribution"><div className="driver-sources">{[1,-1].map(direction=><section key={direction}><h4>{direction===1?'主要增长来源':'主要拖累来源'}</h4>{data.channels.filter((c:any)=>c.delta*direction>0).slice(0,3).map((c:any)=><div key={c.name}><strong>{c.delta>0?'↑':'↓'} {c.name} {signed(c.delta)}</strong><button onClick={()=>setSelected(c.name)}>{'查看 '+c.name+(c.delta>0?' 增长来源':' 下跌来源')}</button></div>)}</section>)}</div>
 <details><summary>展开完整渠道表</summary>{table(data.channels,true)}</details>{channel&&<section className="analysis-node"><h4>{channel.name} · 设备金额变化</h4>{table(channel.devices,false)}</section>}
 <details><summary>金额贡献及占净变化比例口径</summary><p>{data.method}</p><p>渠道金额变化为本期减上期；设备属于所选渠道，不能与渠道重复相加。净变化比例仅用于明细，正负抵消时可为负或超过 100%。</p>{data.channels.map((c:any)=><p key={c.name}>{c.name}：{signed(c.delta)}；占净变化 {c.share==null?'—':c.share.toFixed(2)+'%'}</p>)}{channel?.devices.map((d:any)=><p key={d.name}>{channel.name} / {d.name}：{signed(d.delta)}；占该渠道净变化 {d.share==null?'—':d.share.toFixed(2)+'%'}</p>)}</details></div>
}
