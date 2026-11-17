import { bindViewportGestures, type InputMode } from './gestures';
import { clamp,fitScale,zoomAt } from './geometry';
import type { Camera } from './model';

export function bindPreviewGestures(stage:HTMLElement,image:HTMLImageElement,mode:()=>InputMode){
  const aspect=()=>image.naturalHeight/image.naturalWidth||1;
  const centered=():Camera=>({x:.5,y:aspect()/2,zoom:1});
  let camera=centered(),drag:{id:number;x:number;y:number;camera:Camera}|undefined;
  const size=()=>({w:stage.clientWidth,h:stage.clientHeight});
  function draw(){
    const {w,h}=size();if(!w||!h)return;
    const a=aspect(),base=fitScale(w,h,a),scale=base*camera.zoom;
    image.style.width=`${base}px`;
    image.style.transform=`translate(${(.5-camera.x)*scale}px, ${(a/2-camera.y)*scale}px) scale(${camera.zoom})`;
    stage.classList.toggle('preview-zoomed',camera.zoom>1);
  }
  function update(next:Camera){
    if(next.zoom<=1){camera=centered();draw();return;}
    const {w,h}=size(),a=aspect(),scale=fitScale(w,h,a)*next.zoom;
    const dx=Math.max(0,(1-w/scale)/2),dy=Math.max(0,(a-h/scale)/2);
    camera={zoom:next.zoom,x:clamp(next.x,.5-dx,.5+dx),y:clamp(next.y,a/2-dy,a/2+dy)};draw();
  }
  const enabled=()=>!image.hidden;
  bindViewportGestures(stage,{enabled,camera:()=>camera,mode,aspect,singleTouchPan:()=>true,onStart:()=>{},onChange:update,onEnd:()=>{}});
  stage.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch'||e.button!==0||!enabled()||camera.zoom<=1)return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,camera};stage.setPointerCapture(e.pointerId);stage.classList.add('preview-dragging');
  });
  stage.addEventListener('pointermove',e=>{
    if(drag?.id!==e.pointerId)return;
    const {w,h}=size(),scale=fitScale(w,h,aspect())*drag.camera.zoom;
    update({...drag.camera,x:drag.camera.x-(e.clientX-drag.x)/scale,y:drag.camera.y-(e.clientY-drag.y)/scale});
  });
  function endDrag(){drag=undefined;stage.classList.remove('preview-dragging');}
  stage.addEventListener('lostpointercapture',e=>{if(drag?.id===e.pointerId)endDrag();});
  stage.addEventListener('dblclick',e=>{
    if(!enabled())return;
    if(camera.zoom>1){reset();return;}
    const {x,y,width,height}=stage.getBoundingClientRect();
    update(zoomAt(camera,{x:e.clientX-x,y:e.clientY-y},2.5,width,height,aspect()));
  });
  function reset(){endDrag();camera=centered();draw();}
  const observer=new ResizeObserver(draw);observer.observe(stage);
  return {reset,dispose:()=>observer.disconnect()};
}
