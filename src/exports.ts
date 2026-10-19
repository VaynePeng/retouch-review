import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import type { Camera,Pair,Project,Scene } from './model';
import { loadImage } from './storage';
import { drawScene } from './renderer';
import { focusPoints,regionWorldPoints } from './geometry';
import type { Playback } from './replay';
import offlineCode from './offline-player.js?raw';
function canvas(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function baseScene(p:Project,pair:Pair):Scene{
  const v=pair.versions.find(v=>v.id===pair.versionId);if(!v)throw new Error('请先为所有导出照片配对修图');
  const original=p.assets.find(a=>a.id===pair.originalId)!,camera={x:.5,y:original.height/original.width/2,zoom:1};
  return {pairId:pair.id,versionId:v.id,originalId:pair.originalId,retouchId:v.assetId,alignment:v.alignment,annotations:v.annotations,selectedId:'',showMarks:true,camera,rightCamera:camera};
}
function wrap(ctx:CanvasRenderingContext2D,text:string,width:number):string[]{
  const lines:string[]=[];for(const paragraph of text.split('\n')){let line='';for(const ch of paragraph){if(ctx.measureText(line+ch).width>width&&line){lines.push(line);line=ch;}else line+=ch;}lines.push(line);}return lines;
}
async function panels(ctx:CanvasRenderingContext2D,p:Project,s:Scene,x:number,y:number,w:number,h:number){
  const original=p.assets.find(a=>a.id===s.originalId)!,retouch=p.assets.find(a=>a.id===s.retouchId)!;
  for(const [i,side] of (['original','retouch'] as const).entries()){
    const c=canvas(w/2-8,h),image=await loadImage(side==='original'?s.originalId:s.retouchId);drawScene(c.getContext('2d')!,{scene:s,side,original,retouch,image,width:c.width,height:c.height});ctx.drawImage(c,x+i*w/2,y);
  }
}
async function pngImage(p:Project,pair:Pair,width:number,view?:{camera:Camera;rightCamera:Camera}):Promise<Blob>{
  const s=baseScene(p,pair);if(view)Object.assign(s,view);const o=p.assets.find(a=>a.id===s.originalId)!,v=pair.versions.find(v=>v.id===pair.versionId)!;
  const font=Math.round(width/85),margin=Math.round(width*.025),imageHeight=Math.round(width*.42);
  const measure=canvas(width,1).getContext('2d')!;measure.font=`${font}px sans-serif`;
  const lines=s.annotations.flatMap(a=>wrap(measure,`#${a.number}  [${a.priority} / ${a.status}] ${a.text}`,width-margin*2).concat(['']));
  const c=canvas(width,imageHeight+margin*4+font*(lines.length*1.65+3)),ctx=c.getContext('2d')!;ctx.fillStyle='#f5f4ef';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#2b3026';ctx.font=`bold ${font*1.2}px sans-serif`;ctx.fillText(`${p.name} · ${o.name} · ${v.name}`,margin,margin+font, width-margin*2);ctx.font=`${font}px sans-serif`;ctx.fillText('原图 / ORIGINAL',margin,margin*2+font);ctx.fillText(`修图 / ${v.name}`,width/2,margin*2+font);
  await panels(ctx,p,s,margin,margin*2+font*1.5,width-margin*2,imageHeight);
  let y=margin*3+font*2+imageHeight;ctx.fillStyle='#33392e';for(const line of lines){ctx.fillText(line,margin,y);y+=font*1.65;}
  return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('图片导出失败')),'image/png'));
}
export async function exportPng(p:Project,width:number,progress:(n:number)=>void,view?:{camera:Camera;rightCamera:Camera}):Promise<Blob>{
  if(p.pairs.length===1)return pngImage(p,p.pairs[0],width,view);const zip=new JSZip();for(let i=0;i<p.pairs.length;i++){const pair=p.pairs[i];zip.file(`${String(i+1).padStart(2,'0')}-对比.png`,await pngImage(p,pair,width));progress((i+1)/p.pairs.length*.9);}return zip.generateAsync({type:'blob'});
}
export async function exportPdf(p:Project,progress:(n:number)=>void):Promise<Blob>{
  const pdf=new jsPDF({unit:'pt',format:'a4'});let page=0;
  function add(c:HTMLCanvasElement){if(page++)pdf.addPage();pdf.addImage(c.toDataURL('image/jpeg',.92),'JPEG',0,0,595.28,841.89);}
  function newPage(title:string,subtitle:string){const c=canvas(1440,2036),ctx=c.getContext('2d')!;ctx.fillStyle='#f5f4ef';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#282e24';ctx.font='bold 38px sans-serif';ctx.fillText(title,70,100,1300);ctx.font='22px sans-serif';ctx.fillStyle='#64705a';ctx.fillText(subtitle,70,147,1300);ctx.font='18px sans-serif';ctx.fillText(`${p.name} · 对照修图 · ${page+1}`,70,1980,1300);return {c,ctx};}
  for(let i=0;i<p.pairs.length;i++){
    const pair=p.pairs[i],s=baseScene(p,pair),o=p.assets.find(a=>a.id===s.originalId)!,r=p.assets.find(a=>a.id===s.retouchId)!,v=pair.versions.find(v=>v.id===pair.versionId)!;
    const overview=newPage(o.name,`${v.name} · ${s.annotations.length} 条修改意见 · 左：原图 / 右：修图`);await panels(overview.ctx,p,s,70,200,1300,1100);overview.ctx.fillStyle='#38412f';overview.ctx.font='25px sans-serif';let y=1380;
    for(const a of s.annotations){if(y>1850){overview.ctx.fillText('完整意见见后续详情页。',70,y);break;}const text=`#${a.number} [${a.status}] ${a.text}`;for(const line of wrap(overview.ctx,text,1280).slice(0,2)){overview.ctx.fillText(line,70,y);y+=39;}y+=18;}add(overview.c);
    for(const a of s.annotations){const view=focusPoints(a.regions.flatMap(g=>regionWorldPoints(g,s.alignment,o.height/o.width,r.height/r.width)),o.height/o.width);const detail={...s,selectedId:a.id,camera:view,rightCamera:view};const first=newPage(`${o.name} · ${v.name} · #${a.number}`,`${a.category} / ${a.priority} / ${a.status}`);await panels(first.ctx,p,detail,70,200,1300,800);first.ctx.fillStyle='#30382a';first.ctx.font='28px sans-serif';const lines=wrap(first.ctx,a.text,1280);let cursor=0,ctx=first.ctx,c=first.c;
      while(cursor<lines.length){let y=cursor===0?1080:220;for(;cursor<lines.length&&y<1880;cursor++,y+=46)ctx.fillText(lines[cursor],70,y);add(c);if(cursor<lines.length){const next=newPage(`${o.name} · ${v.name} · #${a.number}（续）`,`${a.priority} / ${a.status}`);ctx=next.ctx;c=next.c;ctx.fillStyle='#30382a';ctx.font='28px sans-serif';}}
    }
    progress((i+1)/p.pairs.length);
  }
  return pdf.output('blob');
}
export async function exportHtml(p:Project,replay:Playback,progress:(n:number)=>void):Promise<Blob>{
  if(!replay.events.length)throw new Error('没有可导出的回放，请先配对修图');
  const ids=[...new Set(replay.events.flatMap(e=>[e.scene.originalId,e.scene.retouchId]))];const images:Record<string,string>={};
  for(let i=0;i<ids.length;i++){const a=p.assets.find(a=>a.id===ids[i])!,img=await loadImage(a.id),c=canvas(a.width,a.height);c.getContext('2d')!.drawImage(img,0,0);images[a.id]=c.toDataURL('image/jpeg',.95);progress((i+1)/ids.length*.95);}
  const payload=JSON.stringify({name:p.name,assets:p.assets.filter(a=>ids.includes(a.id)),replay,images}).replace(/</g,'\\u003c');
  const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>对照修图 · 离线回放</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f8f4;color:#39432f;font:14px "PingFang SC",sans-serif;padding:20px}header{display:flex;justify-content:space-between;align-items:center}h1{font-size:20px}small{color:#81926d}.panels{display:grid;grid-template-columns:1fr 1fr;gap:2px;background:#dbe3d1;margin-top:15px}.panel{min-width:0;background:#ffffff}.label{padding:12px}.panel canvas{display:block;width:100%;height:60vh;min-height:240px;touch-action:none}.controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:18px 0}button,select{background:#ffffff;color:inherit;border:1px solid #ced9c0;border-radius:5px;padding:9px;cursor:pointer}input{accent-color:#ba944f;flex:1;min-width:80px}#caption{white-space:pre-wrap;line-height:1.8;color:#8c6a30}#chapters{display:flex;gap:8px;overflow-x:auto}#chapters button{max-width:220px;flex-shrink:0;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.muted{font-size:12px;color:#81926d}@media(max-width:600px){body{padding:10px}.panel canvas{height:45vh}.label{font-size:11px}}</style><header><h1 id="title"></h1><small>对照修图 · 离线回放</small></header><p id="photo" class="muted"></p><div class="panels"><section class="panel"><div class="label">原图 / ORIGINAL</div><canvas id="original"></canvas></section><section class="panel"><div class="label">修图 / RETOUCHED</div><canvas id="retouch"></canvas></section></div><div class="controls"><button id="previous">上一条</button><button id="play">播放</button><button id="next">下一条</button><input id="seek" type="range" min="0" max="1000" value="0" aria-label="回放进度"><span id="time"></span><select id="speed" aria-label="播放速度"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select><button id="reset">恢复回放视角</button></div><p id="caption"></p><div id="chapters"></div><p class="muted">暂停后可缩放与拖动观察，两侧同步。继续播放将恢复录制视角。所有图片已包含在本文件中，无需联网。</p><script id="data" type="application/json">${payload}</script><script>${offlineCode}</script></html>`;
  return new Blob([html],{type:'text/html;charset=utf-8'});
}
