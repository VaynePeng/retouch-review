import { type Project, type Scene, type Recording } from './model';
import { focusPoints, regionWorldPoints } from './geometry';
export interface Chapter { time:number; title:string; }
export interface Playback { events:Recording['events']; duration:number; chapters:Chapter[]; name:string; }
export function makeTour(project:Project,onlyPending=false,includeEmpty=false):Playback{
  const events:Recording['events']=[],chapters:Chapter[]=[];let time=0;
  for(const pair of project.pairs){
    const v=pair.versions.find(x=>x.id===pair.versionId),o=project.assets.find(a=>a.id===pair.originalId);if(!v||!o)continue;
    const e=project.assets.find(a=>a.id===v.assetId)!;const annotations=v.annotations.filter(a=>a.text.trim()&&(!onlyPending||a.status!=='已通过'));
    if(!annotations.length&&!includeEmpty)continue;
    const oa=o.height/o.width,ea=e.height/e.width,camera={x:.5,y:oa/2,zoom:1};
    const scene:Scene={pairId:pair.id,versionId:v.id,originalId:o.id,retouchId:e.id,alignment:v.alignment,annotations,camera,rightCamera:camera,selectedId:'',showMarks:true};
    chapters.push({time,title:`${o.name} · ${v.name}`});events.push({time,scene:structuredClone(scene)});time+=annotations.length?1000:3000;
    for(const a of annotations){const view=focusPoints(a.regions.flatMap(r=>regionWorldPoints(r,v.alignment,oa,ea)),oa);chapters.push({time,title:`#${a.number} ${a.text}`});events.push({time,scene:structuredClone({...scene,camera:view,rightCamera:view,selectedId:a.id})});time+=a.duration*1000;}
  }
  return {events,duration:time,chapters,name:'批注讲解'};
}
export function recordingPlayback(recording:Recording,skipIdle:boolean):Playback{
  let removed=0,last=0;
  const events=recording.events.map(e=>{if(skipIdle)removed+=Math.max(0,e.time-last-3000);last=e.time;return {time:e.time-removed,scene:e.scene};});
  return {events,duration:Math.max(1,(events.at(-1)?.time??0)+1000),chapters:events.filter((e,i)=>i===0||e.scene.pairId!==events[i-1].scene.pairId||e.scene.selectedId!==events[i-1].scene.selectedId).map(e=>({time:e.time,title:e.scene.annotations.find(a=>a.id===e.scene.selectedId)?.text||'照片视图'})),name:recording.name};
}
export function sceneAt(playback:Playback,time:number):Scene|undefined{
  if(!playback.events.length)return;
  let left=0,right=playback.events.length-1;
  while(left<right){const mid=Math.ceil((left+right)/2);if(playback.events[mid].time<=time)left=mid;else right=mid-1;}
  return playback.events[left].scene;
}
