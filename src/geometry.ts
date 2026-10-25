import type { Alignment, Camera, Point, Region } from './model';
export const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
export function fitScale(w: number, h: number, aspect: number): number { return Math.min(w, h / aspect) * .9; }
export function screenToWorld(p: Point, camera: Camera, w: number, h: number, aspect: number): Point {
  const s = fitScale(w,h,aspect) * camera.zoom;
  return { x: camera.x + (p.x-w/2)/s, y: camera.y + (p.y-h/2)/s };
}
export function worldToScreen(p: Point, camera: Camera, w: number, h: number, aspect: number): Point {
  const s = fitScale(w,h,aspect) * camera.zoom;
  return { x: (p.x-camera.x)*s+w/2, y: (p.y-camera.y)*s+h/2 };
}
export function toWorld(p: Point, a: Alignment, originalAspect: number, editAspect: number): Point {
  const x=p.x-.5, y=p.y-editAspect/2, r=a.rotation*Math.PI/180;
  return { x:.5+a.x+a.scale*(x*Math.cos(r)-y*Math.sin(r)), y:originalAspect/2+a.y+a.scale*(x*Math.sin(r)+y*Math.cos(r)) };
}
export function fromWorld(p: Point, a: Alignment, originalAspect: number, editAspect: number): Point {
  const x=(p.x-.5-a.x)/a.scale, y=(p.y-originalAspect/2-a.y)/a.scale, r=-a.rotation*Math.PI/180;
  return { x:.5+x*Math.cos(r)-y*Math.sin(r), y:editAspect/2+x*Math.sin(r)+y*Math.cos(r) };
}
export function zoomAt(camera: Camera, position: Point, factor: number, w: number, h: number, aspect: number): Camera {
  const anchor=screenToWorld(position,camera,w,h,aspect), zoom=clamp(camera.zoom*factor,.1,40);
  const s=fitScale(w,h,aspect)*zoom;
  return {zoom,x:anchor.x-(position.x-w/2)/s,y:anchor.y-(position.y-h/2)/s};
}
export function regionWorldPoints(region: Region, alignment: Alignment, oa: number, ea: number, side?: 'original'|'retouch'): Point[] {
  const opposite=side && side !== region.side && region.opposite;
  const points=opposite || region.points;
  const anchorSide=opposite ? side : region.side;
  return anchorSide==='retouch' ? points.map(p=>toWorld(p,alignment,oa,ea)) : points;
}
export function focusPoints(points: Point[], aspect: number): Camera {
  if (!points.length) return {x:.5,y:aspect/2,zoom:1};
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys);
  return {x:(Math.max(...xs)+Math.min(...xs))/2,y:(Math.max(...ys)+Math.min(...ys))/2,zoom:clamp(Math.min(.65/Math.max(width,.13),aspect*.65/Math.max(height,.13)),1,6)};
}
export function filenameKey(name: string): string { return name.replace(/\.[^.]+$/,'').replace(/[-_ ]?(edited|edit|retouched|retouch|final|修图|精修|原图|v\d+)$/i,'').toLowerCase(); }

// Preserve the relative position and scale established by the two current views.
export function linkedCamera(previous:Camera,next:Camera,other:Camera):Camera {
  const ratio=previous.zoom/other.zoom;
  return {x:other.x+(next.x-previous.x)*ratio,y:other.y+(next.y-previous.y)*ratio,zoom:other.zoom*next.zoom/previous.zoom};
}
