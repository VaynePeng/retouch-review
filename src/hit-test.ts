import type { Point, Scene, Side } from './model';
import { fitScale, fromWorld, screenToWorld, toWorld, worldToScreen } from './geometry';

function segmentDistance(p:Point,a:Point,b:Point){
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function hitAnnotation(scene:Scene,side:Side,position:Point,width:number,height:number,oa:number,ea:number):string|undefined {
  if(!scene.showMarks||!width||!height)return;
  const camera=side==='original'?scene.camera:scene.rightCamera;
  const world=screenToWorld(position,camera,width,height,oa);
  // Match the topmost visible marker when annotations overlap.
  for(const note of [...scene.annotations].reverse())for(const region of note.regions){
    const opposite=region.opposite&&side!==region.side;
    const raw=opposite?region.opposite!:region.points,source=opposite?side:region.side;
    const screen=(p:Point)=>worldToScreen(source==='retouch'?toWorld(p,scene.alignment,oa,ea):p,camera,width,height,oa);
    const first=screen(raw[0]);
    if(Math.hypot(position.x-first.x,position.y-first.y+15)<=14)return note.id;
    if(region.kind==='point'){if(Math.hypot(position.x-first.x,position.y-first.y)<=12)return note.id;continue;}
    if(region.kind==='pen'){
      const points=raw.map(screen);
      if(points.slice(1).some((p,i)=>segmentDistance(position,points[i],p)<=8))return note.id;
      continue;
    }
    const local=source==='retouch'?fromWorld(world,scene.alignment,oa,ea):world;
    const last=raw.at(-1)!;
    const tolerance=6/(fitScale(width,height,oa)*camera.zoom*(source==='retouch'?scene.alignment.scale:1));
    if(region.kind==='rect'){
      if(local.x>=Math.min(raw[0].x,last.x)-tolerance&&local.x<=Math.max(raw[0].x,last.x)+tolerance&&local.y>=Math.min(raw[0].y,last.y)-tolerance&&local.y<=Math.max(raw[0].y,last.y)+tolerance)return note.id;
    }else{
      const cx=(raw[0].x+last.x)/2,cy=(raw[0].y+last.y)/2,rx=Math.abs(raw[0].x-last.x)/2+tolerance,ry=Math.abs(raw[0].y-last.y)/2+tolerance;
      if(((local.x-cx)/rx)**2+((local.y-cy)/ry)**2<=1)return note.id;
    }
  }
}
