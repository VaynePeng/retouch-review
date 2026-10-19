import type { Camera, Point } from './model';
import { clamp, fitScale, screenToWorld, zoomAt } from './geometry';
export type InputMode = 'trackpad' | 'mouse';
export interface WheelInput { deltaX:number; deltaY:number; deltaMode:number; ctrlKey:boolean; metaKey:boolean; altKey:boolean; }
export function wheelCamera(camera:Camera,event:WheelInput,position:Point,width:number,height:number,aspect:number,mode:InputMode):Camera {
  const unit=event.deltaMode===1?16:event.deltaMode===2?height:1;
  const dx=event.deltaX*unit,dy=event.deltaY*unit;
  if(event.ctrlKey||event.metaKey||event.altKey||mode==='mouse') {
    const sensitivity=event.ctrlKey||event.metaKey? .01 : .0025;
    return zoomAt(camera,position,Math.exp(-clamp(dy,-160,160)*sensitivity),width,height,aspect);
  }
  const scale=fitScale(width,height,aspect)*camera.zoom;
  return {...camera,x:camera.x+dx/scale,y:camera.y+dy/scale};
}
export function touchCamera(start:Camera,anchor:Point,center:Point,factor:number,width:number,height:number,aspect:number):Camera {
  const zoom=clamp(start.zoom*factor,.1,40),scale=fitScale(width,height,aspect)*zoom;
  return {zoom,x:anchor.x-(center.x-width/2)/scale,y:anchor.y-(center.y-height/2)/scale};
}
interface Options {
  enabled:()=>boolean;
  camera:()=>Camera;
  aspect:()=>number;
  mode:()=>InputMode;
  singleTouchPan:()=>boolean;
  onStart:()=>void;
  onChange:(camera:Camera)=>void;
  onEnd:()=>void;
  onTap?:(position:Point)=>void;
}
export function bindViewportGestures(canvas:HTMLCanvasElement,options:Options) {
  let safariGesture=false;
  canvas.addEventListener('wheel',event=>{
    event.preventDefault();if(!options.enabled()||safariGesture)return;
    const rect=canvas.getBoundingClientRect();
    options.onChange(wheelCamera(options.camera(),event,{x:event.clientX-rect.left,y:event.clientY-rect.top},rect.width,rect.height,options.aspect(),options.mode()));
  },{passive:false});
  const touches=new Map<number,Point>();
  let gesture: {camera:Camera;anchor:Point;distance:number}|undefined;
  let consumed=false;
  let tapStart:Point|undefined;
  const geometry=()=>{
    const points=[...touches.values()],a=points[0],b=points[1]||a;
    return {center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))};
  };
  const position=(event:PointerEvent)=>{const r=canvas.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};};
  canvas.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='touch'||!options.enabled())return;
    touches.set(event.pointerId,position(event));tapStart=touches.size===1?position(event):undefined;canvas.setPointerCapture(event.pointerId);
    if(touches.size<2&&!options.singleTouchPan())return;
    event.preventDefault();event.stopImmediatePropagation();consumed=true;options.onStart();
    const r=canvas.getBoundingClientRect(),g=geometry(),camera={...options.camera()};
    gesture={camera,anchor:screenToWorld(g.center,camera,r.width,r.height,options.aspect()),distance:g.distance};
  },{capture:true});
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerType!=='touch'||!touches.has(event.pointerId))return;
    touches.set(event.pointerId,position(event));if(tapStart&&Math.hypot(position(event).x-tapStart.x,position(event).y-tapStart.y)>5)tapStart=undefined;if(!consumed)return;
    event.preventDefault();event.stopImmediatePropagation();if(!gesture||!options.enabled())return;
    const r=canvas.getBoundingClientRect(),g=geometry();
    options.onChange(touchCamera(gesture.camera,gesture.anchor,g.center,touches.size>1?g.distance/gesture.distance:1,r.width,r.height,options.aspect()));
  },{capture:true});
  const end=(event:PointerEvent)=>{
    if(event.pointerType!=='touch'||!touches.has(event.pointerId))return;
    touches.delete(event.pointerId);
    if(consumed){event.preventDefault();event.stopImmediatePropagation();gesture=undefined;options.onEnd();if(event.type==='pointerup'&&tapStart&&!touches.size)options.onTap?.(tapStart);}
    if(!touches.size)consumed=false;
  };
  canvas.addEventListener('pointerup',end,{capture:true});canvas.addEventListener('pointercancel',end,{capture:true});
  // Safari exposes trackpad pinch as GestureEvent rather than only ctrl+wheel.
  let safariStart:Camera|undefined,safariAnchor:Point|undefined;
  canvas.addEventListener('gesturestart',event=>{
    event.preventDefault();if(!options.enabled())return;safariGesture=true;safariStart={...options.camera()};
    const e=event as Event&{clientX:number;clientY:number},r=canvas.getBoundingClientRect();
    safariAnchor=screenToWorld({x:e.clientX-r.left,y:e.clientY-r.top},safariStart,r.width,r.height,options.aspect());
  });
  canvas.addEventListener('gesturechange',event=>{
    event.preventDefault();if(!safariGesture||!safariStart||!safariAnchor||!options.enabled())return;
    const e=event as Event&{clientX:number;clientY:number;scale:number},r=canvas.getBoundingClientRect();
    options.onChange(touchCamera(safariStart,safariAnchor,{x:e.clientX-r.left,y:e.clientY-r.top},e.scale,r.width,r.height,options.aspect()));
  });
  canvas.addEventListener('gestureend',event=>{event.preventDefault();safariGesture=false;options.onEnd();});
}
