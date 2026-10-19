/* Standalone, dependency-free viewer embedded into exported HTML files. */
(() => {
  const data=JSON.parse(document.getElementById('data').textContent);
  const $=id=>document.getElementById(id),r=data.replay;
  $('title').textContent=data.name;
  let time=0,playing=false,last=0,speed=1,scene,override,token=0;
  const cache=new Map();
  const asset=id=>data.assets.find(a=>a.id===id);
  const camera=side=>override||(side==='original'?scene.camera:scene.rightCamera);
  const scale=(w,h,oa,c)=>Math.min(w,h/oa)*.9*c.zoom;
  function map(p,oa,ea){const a=scene.alignment,x=p.x-.5,y=p.y-ea/2,t=a.rotation*Math.PI/180;return {x:.5+a.x+a.scale*(x*Math.cos(t)-y*Math.sin(t)),y:oa/2+a.y+a.scale*(x*Math.sin(t)+y*Math.cos(t))};}
  async function image(id){if(cache.has(id))return cache.get(id);const img=new Image();img.src=data.images[id];await img.decode();cache.set(id,img);if(cache.size>4)cache.delete(cache.keys().next().value);return img;}
  function at(){let l=0,h=r.events.length-1;while(l<h){const m=Math.ceil((l+h)/2);if(r.events[m].time<=time)l=m;else h=m-1;}scene=r.events[l].scene;}
  async function draw(){const ticket=++token;at();const o=asset(scene.originalId),e=asset(scene.retouchId),oa=o.height/o.width,ea=e.height/e.width;
    $('photo').textContent=o.name+' · '+e.name;
    $('caption').textContent=scene.annotations.find(a=>a.id===scene.selectedId)?.text||'全图概览';
    $('seek').value=time/r.duration*1000;$('time').textContent=fmt(time)+' / '+fmt(r.duration);
    for(const side of ['original','retouch']){const img=await image(side==='original'?o.id:e.id);if(ticket!==token)return;const cv=$(side),w=cv.clientWidth,h=cv.clientHeight,ratio=Math.min(devicePixelRatio||1,2);cv.width=w*ratio;cv.height=h*ratio;const c=cv.getContext('2d'),cam=camera(side),s=scale(w,h,oa,cam),px=p=>({x:(p.x-cam.x)*s+w/2,y:(p.y-cam.y)*s+h/2});c.scale(ratio,ratio);c.fillStyle='#eef0ed';c.fillRect(0,0,w,h);c.save();c.translate(w/2-cam.x*s,h/2-cam.y*s);c.scale(s,s);if(side==='retouch'){const a=scene.alignment;c.translate(.5+a.x,oa/2+a.y);c.rotate(a.rotation*Math.PI/180);c.scale(a.scale,a.scale);c.translate(-.5,-ea/2);}c.drawImage(img,0,0,1,side==='original'?oa:ea);c.restore();
      const marks=scene.showMarks?scene.annotations:[];
      for(const note of [...marks,...(scene.draft?[{regions:[scene.draft]}]:[])])for(const region of note.regions){const opposite=region.opposite&&side!==region.side,raw=opposite?region.opposite:region.points,source=opposite?side:region.side,toPixel=p=>px(source==='retouch'?map(p,oa,ea):p);const p=toPixel(raw[0]),q=raw[raw.length-1],a=raw[0];c.strokeStyle=note.status==='已通过'?'#9cc6a4':note.id===scene.selectedId?'#ffe0a0':'#e1b474';c.fillStyle=c.strokeStyle;c.lineWidth=2;c.beginPath();if(region.kind==='point')c.arc(p.x,p.y,8,0,Math.PI*2);else if(region.kind==='rect'){const corners=[a,{x:q.x,y:a.y},q,{x:a.x,y:q.y}].map(toPixel);c.moveTo(corners[0].x,corners[0].y);corners.slice(1).forEach(t=>c.lineTo(t.x,t.y));c.closePath();}else if(region.kind==='ellipse'){for(let i=0;i<=60;i++){const angle=i/60*Math.PI*2,t=toPixel({x:(a.x+q.x)/2+Math.abs(q.x-a.x)/2*Math.cos(angle),y:(a.y+q.y)/2+Math.abs(q.y-a.y)/2*Math.sin(angle)});if(!i)c.moveTo(t.x,t.y);else c.lineTo(t.x,t.y);}}else{c.moveTo(p.x,p.y);raw.slice(1).map(toPixel).forEach(t=>c.lineTo(t.x,t.y));}c.stroke();if(note.number){c.beginPath();c.arc(p.x,p.y-15,11,0,Math.PI*2);c.fill();c.fillStyle='#24271f';c.font='bold 11px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(note.number,p.x,p.y-15);}}
    }
  }
  function fmt(ms){const s=Math.floor(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
  function seek(t){time=Math.max(0,Math.min(r.duration,t));override=undefined;void draw();}
  function tick(now){if(!playing)return;if(last)seek(time+(now-last)*speed);last=now;if(time>=r.duration){playing=false;$('play').textContent='播放';return;}requestAnimationFrame(tick);}
  $('play').onclick=()=>{playing=!playing;last=0;override=undefined;$('play').textContent=playing?'暂停':'播放';if(playing){if(time>=r.duration)seek(0);requestAnimationFrame(tick);}};
  $('seek').oninput=()=>seek(Number($('seek').value)/1000*r.duration);
  $('speed').onchange=()=>speed=Number($('speed').value);
  $('previous').onclick=()=>seek([...r.chapters].reverse().find(c=>c.time<time-100)?.time||0);
  $('next').onclick=()=>seek(r.chapters.find(c=>c.time>time+100)?.time||r.duration);
  $('reset').onclick=()=>{override=undefined;void draw();};
  r.chapters.forEach(ch=>{const b=document.createElement('button');b.textContent=ch.title;b.onclick=()=>seek(ch.time);$('chapters').append(b);});
  for(const side of ['original','retouch']){const cv=$(side);let drag;
    cv.addEventListener('wheel',ev=>{ev.preventDefault();if(playing)return;const rect=cv.getBoundingClientRect(),c=camera(side),oa=asset(scene.originalId).height/asset(scene.originalId).width,s=scale(rect.width,rect.height,oa,c),x=ev.clientX-rect.left-rect.width/2,y=ev.clientY-rect.top-rect.height/2,anchor={x:c.x+x/s,y:c.y+y/s},zoom=Math.max(.1,Math.min(40,c.zoom*Math.exp(-ev.deltaY*.0015))),ns=scale(rect.width,rect.height,oa,{zoom});override={zoom,x:anchor.x-x/ns,y:anchor.y-y/ns};void draw();},{passive:false});
    cv.onpointerdown=ev=>{if(playing)return;cv.setPointerCapture(ev.pointerId);drag={x:ev.clientX,y:ev.clientY,c:{...camera(side)}};};
    cv.onpointermove=ev=>{if(!drag)return;const oa=asset(scene.originalId).height/asset(scene.originalId).width,s=scale(cv.clientWidth,cv.clientHeight,oa,drag.c);override={...drag.c,x:drag.c.x-(ev.clientX-drag.x)/s,y:drag.c.y-(ev.clientY-drag.y)/s};void draw();};cv.onpointerup=cv.onpointercancel=()=>drag=undefined;
  }
  new ResizeObserver(()=>void draw()).observe($('original'));void draw();
})();
