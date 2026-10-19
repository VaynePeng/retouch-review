import type { Annotation, Asset, Camera, Region, Scene, Side } from './model';
import { fitScale, regionWorldPoints, toWorld, worldToScreen, fromWorld } from './geometry';
export interface DrawOptions {scene:Scene;side:Side;original:Asset;retouch:Asset;image:CanvasImageSource; width:number;height:number; overlay?:CanvasImageSource; opacity?:number;}
export function drawScene(ctx:CanvasRenderingContext2D,o:DrawOptions){
  const {scene,side,original,retouch,width:w,height:h}=o,oa=original.height/original.width,ea=retouch.height/retouch.width;
  const camera=side==='original'?scene.camera:scene.rightCamera;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#eef0ed';ctx.fillRect(0,0,w,h);
  const s=fitScale(w,h,oa)*camera.zoom;
  const origin=worldToScreen({x:0,y:0},camera,w,h,oa);
  function imageDraw(image:CanvasImageSource,isEdit:boolean,alpha=1){
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(origin.x,origin.y);ctx.scale(s,s);
    if(isEdit){ctx.translate(.5+scene.alignment.x,oa/2+scene.alignment.y);ctx.rotate(scene.alignment.rotation*Math.PI/180);ctx.scale(scene.alignment.scale,scene.alignment.scale);ctx.translate(-.5,-ea/2);}
    ctx.drawImage(image,0,0,1,isEdit?ea:oa);ctx.restore();
  }
  imageDraw(o.image,side==='retouch');if(o.overlay)imageDraw(o.overlay,true,o.opacity??.5);
  if(scene.showMarks){for(const a of scene.annotations)for(const r of a.regions) drawRegion(ctx,r,a,scene,camera,w,h,oa,ea,side);}
  if(scene.draft)drawRegion(ctx,scene.draft,undefined,scene,camera,w,h,oa,ea,side);
}
function drawRegion(ctx:CanvasRenderingContext2D,r:Region,a:Annotation|undefined,scene:Scene,camera:Camera,w:number,h:number,oa:number,ea:number,side:Side){
  const world=regionWorldPoints(r,scene.alignment,oa,ea,side);
  const points=world.map(p=>worldToScreen(p,camera,w,h,oa));if(!points.length)return;
  // Draw shapes in their anchor coordinate system so rotations preserve their geometry.
  const sourceSide=r.opposite&&side!==r.side?side:r.side;
  const raw=(r.opposite&&side!==r.side?r.opposite:r.points);
  const project=(p:{x:number,y:number})=>worldToScreen(sourceSide==='retouch'?toWorld(p,scene.alignment,oa,ea):p,camera,w,h,oa);
  const color=a?.status==='已通过'?'#8bba9a':a?.id===scene.selectedId?'#ffe3a1':'#e4b978';
  ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=a?.id===scene.selectedId?2.5:1.8;ctx.shadowColor='#0008';ctx.shadowBlur=3;
  ctx.beginPath();const p=points[0],q=raw[raw.length-1],start=raw[0];
  if(r.kind==='point'){ctx.arc(p.x,p.y,8,0,Math.PI*2);}
  else if(r.kind==='rect'){const corners=[start,{x:q.x,y:start.y},q,{x:start.x,y:q.y}].map(project);ctx.moveTo(corners[0].x,corners[0].y);corners.slice(1).forEach(t=>ctx.lineTo(t.x,t.y));ctx.closePath();}
  else if(r.kind==='ellipse'){for(let i=0;i<=60;i++){const angle=i/60*Math.PI*2,t=project({x:(start.x+q.x)/2+Math.abs(q.x-start.x)/2*Math.cos(angle),y:(start.y+q.y)/2+Math.abs(q.y-start.y)/2*Math.sin(angle)});if(i===0)ctx.moveTo(t.x,t.y);else ctx.lineTo(t.x,t.y);}}
  else {ctx.moveTo(p.x,p.y);points.slice(1).forEach(t=>ctx.lineTo(t.x,t.y));}
  ctx.stroke();if(a){ctx.shadowBlur=0;ctx.beginPath();ctx.arc(p.x,p.y-15,11,0,Math.PI*2);ctx.fill();ctx.fillStyle='#26251f';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(a.number),p.x,p.y-15);}
  ctx.restore();
}
export function outsideRegion(r:Region,scene:Scene,oa:number,ea:number,side:Side){return regionWorldPoints(r,scene.alignment,oa,ea,side).every(p=>{const q=side==='retouch'?fromWorld(p,scene.alignment,oa,ea):p;return q.x<0||q.x>1||q.y<0||q.y>(side==='retouch'?ea:oa);});}
