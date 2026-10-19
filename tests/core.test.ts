import test from 'node:test';
import assert from 'node:assert/strict';
import {fromWorld,toWorld,zoomAt,screenToWorld,filenameKey} from '../src/geometry.ts';
import {newProject,identity,validateProject,type Project} from '../src/model.ts';
import {makeTour,sceneAt,recordingPlayback} from '../src/replay.ts';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('裁切、旋转、缩放映射可逆，非方形照片不发生坐标漂移',()=>{
  const align={x:.12,y:-.08,scale:1.3,rotation:37};
  for(const p of [{x:0,y:0},{x:.4,y:.8},{x:1,y:1.5}]){const back=fromWorld(toWorld(p,align,1.5,1.2),align,1.5,1.2);near(back.x,p.x);near(back.y,p.y);}
});
test('围绕鼠标缩放保持指向的图片位置',()=>{const c={x:.4,y:.8,zoom:1.5},pos={x:95,y:210};const a=screenToWorld(pos,c,600,700,1.5),next=zoomAt(c,pos,2,600,700,1.5),b=screenToWorld(pos,next,600,700,1.5);near(a.x,b.x);near(a.y,b.y);});
function sample():Project{const p=newProject();p.assets=[{id:'o',name:'a.jpg',width:1000,height:1500,size:1,type:'image/jpeg',hash:'x'},{id:'e',name:'a-edit.jpg',width:500,height:750,size:1,type:'image/jpeg',hash:'y'}];p.pairs=[{id:'p',originalId:'o',versionId:'v',versions:[{id:'v',name:'V1',assetId:'e',alignment:identity(),approved:false,nextNumber:3,annotations:[{id:'a',number:1,text:'保留纹理',category:'皮肤',priority:'普通',status:'待修改',regions:[{kind:'ellipse',side:'original',points:[{x:.2,y:.3},{x:.4,y:.6}]}],duration:5,createdAt:'',updatedAt:''},{id:'b',number:2,text:'背景处理',category:'背景',priority:'普通',status:'已通过',regions:[],duration:8,createdAt:'',updatedAt:''}]}]}];return p;}
test('讲解时间轴可以跳转并定位正确意见',()=>{const p=sample(),tour=makeTour(p);assert.equal(tour.duration,14000);assert.equal(sceneAt(tour,0)?.selectedId,'');assert.equal(sceneAt(tour,2000)?.selectedId,'a');assert.equal(sceneAt(tour,10000)?.selectedId,'b');assert.ok(sceneAt(tour,2000)!.camera.zoom>1);assert.equal(makeTour(p,true).duration,6000);});
test('回放为独立快照，不随之后的批注编辑改变',()=>{const p=sample(),tour=makeTour(p);p.pairs[0].versions[0].annotations[0].text='已修改';assert.equal(sceneAt(tour,1000)?.annotations[0].text,'保留纹理');});
test('历史录制可压缩空闲时间并跳转到完整场景',()=>{const scene=sceneAt(makeTour(sample()),1000)!;const playback=recordingPlayback({id:'r',name:'录制',createdAt:'',duration:10000,events:[{time:0,scene},{time:10000,scene:{...scene,selectedId:'b'}}]},true);assert.equal(playback.events[1].time,3000);assert.equal(sceneAt(playback,3500)?.selectedId,'b');});
test('项目包拒绝新格式和缺失图片引用',()=>{const p=sample();assert.equal(validateProject(p).pairs.length,1);assert.throws(()=>validateProject({...p,formatVersion:2}));assert.throws(()=>validateProject({...p,assets:[]}));});
test('文件名配对仅提供稳定候选',()=>{assert.equal(filenameKey('IMG_1234_edit.JPG'),filenameKey('IMG_1234.JPG'));assert.notEqual(filenameKey('IMG_1234.jpg'),filenameKey('IMG_4321.jpg'));});

import {wheelCamera,touchCamera} from '../src/gestures.ts';
test('触控板双指滚动只平移，捏合围绕手势位置缩放',()=>{
  const camera={x:.5,y:.75,zoom:2},pos={x:250,y:300};
  const base={deltaX:36,deltaY:60,deltaMode:0,ctrlKey:false,metaKey:false,altKey:false};
  const pan=wheelCamera(camera,base,pos,600,800,1.5,'trackpad');
  assert.equal(pan.zoom,camera.zoom);assert.ok(pan.x>camera.x&&pan.y>camera.y);
  const pinch=wheelCamera(camera,{...base,deltaX:0,deltaY:-20,ctrlKey:true},pos,600,800,1.5,'trackpad');
  assert.ok(pinch.zoom>camera.zoom);
  const a=screenToWorld(pos,camera,600,800,1.5),b=screenToWorld(pos,pinch,600,800,1.5);near(a.x,b.x);near(a.y,b.y);
});
test('鼠标模式滚轮缩放；触屏两指可以同时平移和缩放',()=>{
  const camera={x:.5,y:.75,zoom:1},center={x:300,y:400};
  const mouse=wheelCamera(camera,{deltaX:0,deltaY:-3,deltaMode:1,ctrlKey:false,metaKey:false,altKey:false},center,600,800,1.5,'mouse');assert.ok(mouse.zoom>1);
  const anchor=screenToWorld(center,camera,600,800,1.5),nextCenter={x:360,y:440};
  const moved=touchCamera(camera,anchor,nextCenter,1.5,600,800,1.5),world=screenToWorld(nextCenter,moved,600,800,1.5);
  near(moved.zoom,1.5);near(world.x,anchor.x);near(world.y,anchor.y);
});

import {hitAnnotation} from '../src/hit-test.ts';
import {worldToScreen} from '../src/geometry.ts';
test('批注命中覆盖编号、区域和对侧，隐藏标记时不命中',()=>{
  const s=sceneAt(makeTour(sample()),0)!;
  const center=worldToScreen({x:.3,y:.45},s.camera,600,800,1.5);
  assert.equal(hitAnnotation(s,'original',center,600,800,1.5,1.5),'a');
  assert.equal(hitAnnotation(s,'retouch',center,600,800,1.5,1.5),'a');
  const badge=worldToScreen({x:.2,y:.3},s.camera,600,800,1.5);badge.y-=15;
  assert.equal(hitAnnotation(s,'original',badge,600,800,1.5,1.5),'a');
  assert.equal(hitAnnotation({...s,showMarks:false},'original',center,600,800,1.5,1.5),undefined);
  assert.equal(hitAnnotation(s,'original',{x:5,y:5},600,800,1.5,1.5),undefined);
});
