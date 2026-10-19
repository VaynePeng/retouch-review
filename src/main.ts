import { hitAnnotation } from './hit-test';
import { bindViewportGestures, type InputMode } from './gestures';
import './style.css';
import { type Project,type Pair,type Version,type Asset,type Region,type Annotation,type Scene,type Side,type Tool,type Camera,type Recording,uid,identity,newProject } from './model';
import { clamp,fitScale,screenToWorld,fromWorld,focusPoints,regionWorldPoints,zoomAt,filenameKey } from './geometry';
import { saveProject,listProjects,importImage,loadImage,importPackage,exportPackage,download } from './storage';
import { drawScene,outsideRegion } from './renderer';
import { makeTour,recordingPlayback,sceneAt,type Playback } from './replay';

const icons:Record<string,string>={plus:'<path d="M12 5v14M5 12h14"/>',hand:'<path d="M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v8c0 4-2 6-6 6h-1c-2 0-3-1-4-3l-5-6a2 2 0 0 1 3-2l1 1"/>',point:'<circle cx="12" cy="12" r="7"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',rect:'<rect x="4" y="5" width="16" height="14" rx="1"/>',ellipse:'<ellipse cx="12" cy="12" rx="9" ry="7"/>',pen:'<path d="m15 4 5 5-10 10-6 1 1-6Z"/><path d="m13 6 5 5"/>',play:'<path d="m9 5 11 7-11 7Z"/>',pause:'<path d="M8 5v14M16 5v14"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>',link:'<path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',fit:'<path d="M4 9V4h5m6 0h5v5m0 6v5h-5M9 20H4v-5"/>',undo:'<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14"/>',redo:'<path d="m16 4 5 5-5 5m5-5H11a7 7 0 0 0 0 14"/>',folder:'<path d="M3 7V4h6l3 3h9v13H3Z"/>',image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="2"/><path d="m3 18 6-6 4 4 3-4 5 6"/>',check:'<path d="m5 12 4 4L20 5"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',align:'<path d="M12 2v20M2 12h20"/><rect x="6" y="6" width="12" height="12"/>',record:'<circle cx="12" cy="12" r="7"/>',chevron:'<path d="m9 5 7 7-7 7"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>'};
const icon=(name:string)=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>`;
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const $=<T extends HTMLElement=HTMLElement>(q:string)=>document.querySelector<T>(q)!;
const button=(action:string,label:string,i?:string,cls='')=>`<button type="button" data-action="${action}" class="${cls}">${i?icon(i):''}${label}</button>`;
const app=$('#app');
document.body.classList.add('sidebar-hidden','photos-hidden');
app.innerHTML=`<header class="topbar"><a class="brand" href="#" aria-label="对照修图首页"><span class="brand-mark">◧</span><strong>对照<span>RETOUCH REVIEW</span></strong></a><span class="divider"></span><button class="project-name" data-action="rename">未命名审阅</button><span id="saved" class="save-state">准备就绪</span><div class="top-actions">${button('projects','项目','folder')}${button('import','导入照片','plus')}${button('export','导出反馈','download','primary')}</div></header>
<main><section class="workspace"><div class="workspace-heading"><div><div class="eyebrow">REVIEW WORKSPACE</div><h1 id="photo-title">每一处细节，都值得对照。</h1></div><div class="heading-actions"><div class="view-modes" role="group" aria-label="图片查看模式"><button data-view="both" aria-pressed="true">对比</button><button data-view="original" aria-pressed="false">仅原图</button><button data-view="retouch" aria-pressed="false">仅精修</button></div><span id="count-label">本地工作台</span>${button('toggle-sidebar','批注','menu','text-button')}</div></div>
<div class="toolbar"><div class="tool-group" role="group" aria-label="标记工具">${(['hand','point','rect','ellipse','pen'] as Tool[]).map((t,i)=>`<button data-tool="${t}" class="tool ${i===0?'active':''}" title="${['平移 H','点标记 P','矩形 R','椭圆 O','自由圈画 B'][i]}" aria-label="${['平移','点标记','矩形','椭圆','自由圈画'][i]}">${icon(t)}</button>`).join('')}</div><span class="divider"></span>${button('undo','','undo','icon-button')}${button('redo','','redo','icon-button')}<div class="toolbar-spacer"></div><select id="input-mode" aria-label="输入设备" title="触控板：双指平移、捏合缩放；鼠标：滚轮缩放"><option value="trackpad">触控板</option><option value="mouse">鼠标</option></select>${button('sync','同步视图','link','text-button active')}${button('align','对齐','align','text-button')}${button('marks','','eye','icon-button')}${button('fit','适应','fit','text-button')}${button('pixel','100%','','text-button')}</div>
<div class="compare" data-view="both"><article class="image-panel"><div class="panel-label"><span><i class="dot original"></i>原图 <small>ORIGINAL</small></span><span id="original-scale">—</span></div><div class="canvas-wrap" data-side="original"><canvas id="original-canvas" aria-label="原图画布"></canvas><div class="empty-panel" id="original-empty"><span class="empty-symbol">${icon('image')}</span><h2>从原图开始</h2><p>拖入照片，或从电脑中选择<br>JPEG、PNG、WebP · 单张不超过 30 MB</p>${button('originals','选择原图','plus')}<small>照片只保存在当前浏览器</small></div></div><div class="panel-footer" id="original-info">尚未导入原图</div></article><article class="image-panel"><div class="panel-label"><span><i class="dot retouch"></i>修图 <small>RETOUCHED</small></span><div class="version-control"><select id="version-select" aria-label="修图版本"></select><button data-action="version" title="追加修图版本" class="icon-button">${icon('plus')}</button><span id="retouch-scale">—</span></div></div><div class="canvas-wrap" data-side="retouch"><canvas id="retouch-canvas" aria-label="修图画布"></canvas><div class="empty-panel" id="retouch-empty"><span class="empty-symbol paired">${icon('image')}</span><h2>看看，哪里不一样</h2><p>添加对应的修图<br>放大、平移与圈点，两侧同步</p>${button('retouches','选择修图','plus')}<small>支持多轮修图与逐项复核</small></div></div><div class="panel-footer" id="retouch-info">等待配对修图</div></article></div>
<div class="canvas-status"><span id="canvas-hint">双指平移 · 捏合缩放 · 空格拖动 · Alt + 滚轮缩放</span><span id="selection-label"></span></div>
<div class="replay-bar"><div class="replay-title">${icon('play')}<strong>审阅回放</strong><span id="replay-summary">把每一条意见，讲清楚。</span></div><div>${button('toggle-photos','照片列表','image','text-button')}${button('record','录制','record','text-button')}${button('replay','批注讲解','play','text-button')}</div></div><div id="player" hidden><div class="player-controls">${button('prev','上一条')}${button('play','播放','play')}${button('next','下一条')}<input type="range" id="seek" min="0" max="1000" value="0" aria-label="回放进度"><span id="play-time">0:00 / 0:00</span><select id="speed" aria-label="播放速度"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select>${button('fullscreen','','fit','icon-button')}${button('stop','','close','icon-button')}</div><p id="play-caption"></p><div id="chapters"></div></div>
<div class="filmstrip"><div class="filmstrip-heading"><span>照片列表 <b id="pair-count">0</b></span>${button('originals','添加','plus','text-button')}</div><div id="pairs"><div class="filmstrip-empty">导入照片后，在这里切换审阅。</div></div></div></section>
<aside class="sidebar"><div class="sidebar-heading"><div><span class="eyebrow">FEEDBACK</span><h2>修改意见 <span id="note-count">0</span></h2></div>${button('note','','plus','icon-button')}</div><div class="filters"><button data-filter="all" class="active">全部</button><button data-filter="pending">未通过</button><button data-filter="passed">已通过</button></div><div id="notes" class="notes"></div><div class="sidebar-bottom"><div id="review-progress"><span>等待开始审阅</span></div>${button('approve','确认此版本通过','check','approve-button')}<p>每条意见都与当前修图版本关联</p></div></aside></main>
<footer class="app-footer"><span><i class="status-dot"></i>本地优先 · 图片无需上传</span><span>对照细节，表达准确。</span><button data-action="help">快捷键与帮助</button></footer><dialog id="dialog"></dialog><div id="toast" role="status" hidden></div><input type="file" id="file-input" hidden multiple accept="image/jpeg,image/png,image/webp"><input type="file" id="package-input" hidden accept=".retouch,.zip">`;

let inputMode:InputMode=localStorage.getItem('retouch-input-mode')==='mouse'?'mouse':'trackpad';
$<HTMLSelectElement>('#input-mode').value=inputMode;
$('#input-mode').addEventListener('change',()=>{inputMode=$<HTMLSelectElement>('#input-mode').value as InputMode;localStorage.setItem('retouch-input-mode',inputMode);$('#canvas-hint').textContent=inputMode==='trackpad'?'双指平移 · 捏合缩放 · 空格拖动 · Alt + 滚轮缩放':'滚轮缩放 · 拖动平移 · 空格临时平移';});
let project:Project=newProject(),pair:Pair|undefined,version:Version|undefined,tool:Tool='hand',filter='all';
let camera:Camera={x:.5,y:.5,zoom:1},rightCamera={...camera},synced=true,showMarks=true,selectedId='',space=false;
let undo:Project[]=[],redo:Project[]=[],saveQueue=Promise.resolve(),renderToken=0,pendingWrites=0,activeSide:Side='original';
let pending:Annotation|undefined,pendingIsNew=false,addingRegion=false,oppositeRegion=false;
let draft:Region|undefined;
let playback:Playback|undefined,playTime=0,playing=false,speed=1,lastFrame=0,playScene:Scene|undefined;
let recording:Recording|undefined,recordStart=0,recordPauseStart=0,recordPaused=false,lastRecord=0;
let importMode:'original'|'retouch'|'version'='original',dialogCleanup:undefined|(()=>void);
const canvas={original:$('#original-canvas') as HTMLCanvasElement,retouch:$('#retouch-canvas') as HTMLCanvasElement};
const dialog=$('#dialog') as HTMLDialogElement;
function toast(message:string){$('#toast').textContent=message;$('#toast').hidden=false;}
$('#toast').onclick=()=>{$('#toast').hidden=true;};
function error(e:unknown){toast(e instanceof Error?e.message:String(e));}
function current(){pair=project.pairs.find(p=>p.id===project.selectedPairId);version=pair?.versions.find(v=>v.id===pair?.versionId);}
function asset(id:string|undefined){return project.assets.find(a=>a.id===id);}
function aspect(){const a=asset(pair?.originalId);return a?a.height/a.width:1;}
function snapshot(){return structuredClone(project);}
function remember(){undo.push(snapshot());if(undo.length>40)undo.shift();redo=[];}
function persist(){
  project.updatedAt=new Date().toISOString();const saved=snapshot();pendingWrites++;$('#saved').textContent='保存中…';
  saveQueue=saveQueue.catch(()=>{}).then(()=>saveProject(saved)).then(()=>{pendingWrites--;if(!pendingWrites)$('#saved').textContent='已保存到本机';}).catch(e=>{pendingWrites--;$('#saved').textContent='保存失败，请导出备份';error(e);});
}
function changed(){current();persist();renderUI();void renderCanvas();capture(true);}
function fit(){camera={x:.5,y:aspect()/2,zoom:1};rightCamera={...camera};void renderCanvas();capture(true);}
function scene():Scene|undefined{
  if(!pair||!version)return;
  return {pairId:pair.id,versionId:version.id,originalId:pair.originalId,retouchId:version.assetId,alignment:version.alignment,annotations:version.annotations,camera,rightCamera,showMarks,selectedId,...(draft?{draft}: {})};
}
function selected(){return version?.annotations.find(a=>a.id===selectedId);}
function capture(force=false){if(!recording||recordPaused)return;const now=performance.now();if(!force&&now-lastRecord<50)return;const s=scene();if(!s)return;lastRecord=now;const time=now-recordStart;recording.events.push({time,scene:structuredClone(s)});recording.duration=time;}
function selectPair(id:string){if(playback)return;project.selectedPairId=id;current();selectedId='';draft=undefined;fit();persist();renderUI();}
function setTool(t:Tool){tool=t;document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));document.querySelectorAll<HTMLElement>('.canvas-wrap').forEach(e=>e.style.cursor=t==='hand'?'grab':'crosshair');}
function renderUI(){
  current();$('.project-name').textContent=project.name;
  const o=asset(pair?.originalId),r=asset(version?.assetId);
  $('#photo-title').textContent=o?.name||'每一处细节，都值得对照。';
  $('#count-label').textContent=pair?`${project.pairs.indexOf(pair)+1} / ${project.pairs.length} 组照片`:'本地工作台';
  $('#pair-count').textContent=String(project.pairs.length);
  $('#original-empty').hidden=!!o;$('#retouch-empty').hidden=!!r;
  $('#original-info').textContent=o?`${o.width} × ${o.height} · ${(o.size/1048576).toFixed(1)} MB`:'尚未导入原图';
  $('#retouch-info').textContent=r?`${r.name} · ${r.width} × ${r.height}`:'等待配对修图';
  $('#version-select').innerHTML=pair?.versions.map(v=>`<option value="${v.id}" ${version?.id===v.id?'selected':''}>${esc(v.name)}${v.approved?' · 已通过':''}</option>`).join('')||'<option>未配对</option>';
  const list=$('#pairs');list.replaceChildren();
  for(const p of project.pairs){const a=asset(p.originalId)!,v=p.versions.find(v=>v.id===p.versionId),b=document.createElement('button');b.className=`photo-card ${p.id===pair?.id?'selected':''}`;b.dataset.pair=p.id;b.innerHTML=`<div class="thumbnail">${icon('image')}</div><span><strong>${esc(a.name)}</strong><small>${v?`${v.name} · ${v.approved?'已通过':`${v.annotations.length} 条意见`}`:'等待修图'}</small></span><em>${String(project.pairs.indexOf(p)+1).padStart(2,'0')}</em>`;list.append(b);if(a.preview){const img=document.createElement('img');img.src=a.preview;img.alt='';b.querySelector('.thumbnail')!.replaceChildren(img);}}
  if(!project.pairs.length)list.innerHTML='<div class="filmstrip-empty">导入照片后，在这里切换审阅。</div>';
  renderNotes();
  const recordButton=$('[data-action="record"]');recordButton.classList.toggle('recording',!!recording);recordButton.innerHTML=icon('record')+(recording?'结束录制':'录制');
  $('#replay-summary').textContent=recording?(recordPaused?'录制已暂停':'正在录制审阅操作'):project.recordings.length?`${project.recordings.length} 段录制 · 可回看历史审阅`:'把每一条意见，讲清楚。';
  $('[data-action="sync"]').classList.toggle('active',synced);$('[data-action="marks"]').classList.toggle('active',showMarks);
  ($('[data-action="undo"]') as HTMLButtonElement).disabled=!undo.length||!!playback;
  ($('[data-action="redo"]') as HTMLButtonElement).disabled=!redo.length||!!playback;
}
function renderNotes(){
  const notes=version?.annotations||[];$('#note-count').textContent=String(notes.length);
  $('#notes').innerHTML=notes.filter(a=>filter==='all'||(filter==='passed'?a.status==='已通过':a.status!=='已通过')).map(a=>`<article class="note ${a.id===selectedId?'selected':''}" data-note="${a.id}"><div class="note-top"><span class="note-number">${String(a.number).padStart(2,'0')}</span><span class="tag ${a.priority==='必须修改'?'urgent':''}">${esc(a.priority)}</span><span class="note-category">${esc(a.category)}</span></div><button class="note-text" data-focus="${a.id}">${esc(a.text)}</button>${a.needsPositionCheck?'<p class="warning">继承区域待检查定位</p>':''}<div class="note-bottom"><select data-status="${a.id}" aria-label="批注 ${a.number} 状态">${['待修改','待复核','已通过'].map(s=>`<option ${a.status===s?'selected':''}>${s}</option>`).join('')}</select><button data-edit="${a.id}">编辑 ${icon('chevron')}</button></div></article>`).join('')||`<div class="notes-empty"><div class="annotation-illustration"><span>01</span><svg viewBox="0 0 140 90"><path d="M20 55C10 5 120 0 122 43S35 88 20 55" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 5"/><path d="m95 60 16 18 2-9 10-3Z" fill="currentColor"/></svg></div><h3>${notes.length?'没有符合条件的意见':'从一个小细节开始'}</h3><p>在照片上圈出需要修改的位置，<br>或者添加一条整体意见。</p>${button('note','添加整体意见','plus','text-button')}</div>`;
  const done=notes.filter(a=>a.status==='已通过').length;$('#review-progress').innerHTML=`<span>${version?.approved?'此版本已确认通过':`${done} / ${notes.length} 条意见已通过`}</span><div class="progress"><i style="width:${notes.length?done/notes.length*100:0}%"></i></div>`;
  ($('[data-action="approve"]') as HTMLButtonElement).disabled=!version||notes.some(a=>a.status!=='已通过');
}
let paintRequested=false;
function renderCanvas(){
  ++renderToken;
  if(paintRequested)return;
  paintRequested=true;
  requestAnimationFrame(()=>{paintRequested=false;void paintCanvas();});
}
function canvasContext(c:HTMLCanvasElement,width:number,height:number){
  const ratio=Math.min(devicePixelRatio||1,2),w=Math.round(width*ratio),h=Math.round(height*ratio);
  // Reallocating the backing store during every gesture stalls the rendering pipeline.
  if(c.width!==w)c.width=w;
  if(c.height!==h)c.height=h;
  const ctx=c.getContext('2d')!;ctx.setTransform(ratio,0,0,ratio,0,0);return ctx;
}
async function paintCanvas(){
  const token=renderToken,s=playScene||scene();
  if(!s){for(const side of ['original','retouch'] as Side[]){const c=canvas[side],a=side==='original'?asset(pair?.originalId):undefined;const rect=c.getBoundingClientRect();if(!rect.width||!rect.height)continue;const ctx=canvasContext(c,rect.width,rect.height);ctx.fillStyle='#eef0ed';ctx.fillRect(0,0,rect.width,rect.height);if(a){try{const img=await loadImage(a.id);if(token!==renderToken)return;const scale=fitScale(rect.width,rect.height,a.height/a.width);ctx.drawImage(img,(rect.width-scale)/2,(rect.height-scale*a.height/a.width)/2,scale,scale*a.height/a.width);}catch(e){error(e);}}}return;}
  const o=asset(s.originalId),r=asset(s.retouchId);if(!o||!r)return;
  try{const [original,retouch]=await Promise.all([loadImage(o.id),loadImage(r.id)]);if(token!==renderToken)return;
    for(const side of ['original','retouch'] as Side[]){const c=canvas[side],rect=c.getBoundingClientRect();if(!rect.width||!rect.height)continue;const ctx=canvasContext(c,rect.width,rect.height);drawScene(ctx,{scene:s,side,original:o,retouch:r,image:side==='original'?original:retouch,width:rect.width,height:rect.height,...(dialog.open&&dialog.dataset.kind==='align'&&side==='original'?{overlay:retouch,opacity:.5}:{})});const cam=side==='original'?s.camera:s.rightCamera;const percent=fitScale(rect.width,rect.height,o.height/o.width)*cam.zoom/(side==='original'?o.width:r.width/(s.alignment.scale));$(`#${side}-scale`).textContent=`${Math.round(percent*100)}%`;}
    const note=s.annotations.find(a=>a.id===s.selectedId);$('#selection-label').textContent=note?`#${note.number} ${note.regions.some(g=>outsideRegion(g,s,o.height/o.width,r.height/r.width,'retouch'))?'该区域在修图中不可见':''}`:'';
  }catch(e){error(e);}
}
function openDialog(title:string,body:string,kind='generic'){
  if(dialog.open)closeDialog();dialog.dataset.kind=kind;dialog.innerHTML=`<div class="dialog-heading"><div><span class="eyebrow">RETOUCH REVIEW</span><h2>${title}</h2></div>${button('close-dialog','','close','icon-button')}</div>${body}`;dialog.showModal();
}
function closeDialog(){dialogCleanup?.();dialogCleanup=undefined;dialog.close();}
dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
function requireVersion(){if(!version){toast('请先导入原图，并配对一张修图。');return false;}return true;}
function focusAnnotation(id:string){selectedId=id;const a=selected();if(!a)return;const r=asset(version!.assetId)!;camera=focusPoints(a.regions.flatMap(g=>regionWorldPoints(g,version!.alignment,aspect(),r.height/r.width)),aspect());rightCamera={...camera};synced=true;renderNotes();void renderCanvas();capture(true);}
function draftSave(){if(!pending)return;const text=$('#note-text') as HTMLTextAreaElement|null;if(text)pending.text=text.value;try{localStorage.setItem(`retouch-draft-${project.id}`,JSON.stringify({pairId:pair?.id,versionId:version?.id,note:pending,isNew:pendingIsNew}));}catch{toast('草稿暂存失败，请尽快保存批注');}}
function editNote(id?:string,region?:Region){
  if(!requireVersion()||playback)return;
  pendingIsNew=!id;pending=id?structuredClone(version!.annotations.find(a=>a.id===id)!):{id:uid(),number:version!.nextNumber,text:'',category:'其他',priority:'普通',status:'待修改',regions:region?[region]:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),duration:5};
  showNoteEditor();
}
function showNoteEditor(){if(!pending)return;const n=pending;
  openDialog(`${pendingIsNew?'添加':'编辑'}修改意见 · #${n.number}`,`<form id="note-form"><label>修改说明<textarea id="note-text" required rows="5" placeholder="哪里需要调整？你希望改成什么样？">${esc(n.text)}</textarea></label><div class="form-row"><label>分类<select id="note-category">${['皮肤','五官','体形','头发','服装','背景','色彩','其他'].map(c=>`<option ${n.category===c?'selected':''}>${c}</option>`).join('')}</select></label><label>优先级<select id="note-priority">${['普通','必须修改','建议调整'].map(c=>`<option ${n.priority===c?'selected':''}>${c}</option>`).join('')}</select></label><label>回放停留（秒）<input id="note-duration" type="number" min="1" max="120" value="${n.duration}"></label></div><div class="region-row"><span>${n.regions.length?`${n.regions.length} 个关联区域`:'整体意见 · 无局部区域'}</span>${button('add-region','补充区域','plus','text-button')}${n.regions.length?button('opposite','指定另一侧位置','','text-button'):''}</div>${n.regions.length?`<div class="form-row"><label>区域水平位移<input id="region-x" type="number" step="0.01" value="0"></label><label>区域垂直位移<input id="region-y" type="number" step="0.01" value="0"></label><label>区域大小倍率<input id="region-scale" type="number" min="0.1" max="10" step="0.1" value="1"></label></div><small>数值相对图像宽度；应用后可在画布查看，并用撤销恢复。</small>`:''}<div class="dialog-actions">${!pendingIsNew?button('delete-note','删除意见','','danger'):''}${button('cancel-note','取消')}<button type="submit" class="primary">保存意见</button></div></form>`,'note');
  $('#note-text').focus();$('#note-text').addEventListener('input',draftSave);
  $('#note-form').addEventListener('submit',e=>{e.preventDefault();saveNote();});
  dialogCleanup=()=>{draft=undefined;void renderCanvas();};
}
function collectPending(){if(!pending)return;pending.text=($('#note-text') as HTMLTextAreaElement).value;pending.category=($('#note-category') as HTMLSelectElement).value;pending.priority=($('#note-priority') as HTMLSelectElement).value as Annotation['priority'];pending.duration=clamp(Number(($('#note-duration') as HTMLInputElement).value)||5,1,120);}
function saveNote(){if(!pending||!version)return;collectPending();if(!pending.text.trim())return;remember();pending.text=pending.text.trim();pending.updatedAt=new Date().toISOString();const dx=Number(($<HTMLInputElement>('#region-x'))?.value||0),dy=Number(($<HTMLInputElement>('#region-y'))?.value||0),scale=clamp(Number(($<HTMLInputElement>('#region-scale'))?.value||1),.1,10);
  for(const region of pending.regions){const center={x:region.points.reduce((s,p)=>s+p.x,0)/region.points.length,y:region.points.reduce((s,p)=>s+p.y,0)/region.points.length};region.points=region.points.map(p=>({x:center.x+(p.x-center.x)*scale+dx,y:center.y+(p.y-center.y)*scale+dy}));}
  pending.needsPositionCheck=false;if(pendingIsNew){version.annotations.push(pending);version.nextNumber++;}else version.annotations[version.annotations.findIndex(a=>a.id===pending!.id)]=pending;
  version.approved=false;selectedId=pending.id;pending=undefined;localStorage.removeItem(`retouch-draft-${project.id}`);closeDialog();changed();
}
function openAnnotationCard(id:string){
  if(playback)return;
  selectedId=id;filter='all';
  document.body.classList.remove('sidebar-hidden');
  document.querySelectorAll<HTMLElement>('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));
  renderNotes();renderCanvas();capture(true);
  const card=[...document.querySelectorAll<HTMLElement>('[data-note]')].find(e=>e.dataset.note===id);
  if(card){card.tabIndex=-1;card.focus({preventScroll:true});card.scrollIntoView({block:'nearest',inline:'nearest'});}
}
function markerAt(side:Side,position:{x:number;y:number}){
  const s=scene(),r=asset(version?.assetId);if(!s||!r||playback)return;
  const rect=canvas[side].getBoundingClientRect();return hitAnnotation(s,side,position,rect.width,rect.height,aspect(),r.height/r.width);
}
let clickedMarker:{id:string;pointerId:number;side:Side;start:{x:number;y:number};camera:Camera;moved:boolean}|undefined;
function restoreDraft(){const text=localStorage.getItem(`retouch-draft-${project.id}`);if(!text)return;try{const d=JSON.parse(text);if(d.pairId===pair?.id&&d.versionId===version?.id){pending=d.note;pendingIsNew=d.isNew;showNoteEditor();}}catch{localStorage.removeItem(`retouch-draft-${project.id}`);}}

let drag:{side:Side,start:{x:number,y:number},camera:Camera,region?:Region}|undefined;
for(const side of ['original','retouch'] as Side[]){const c=canvas[side];
  bindViewportGestures(c,{
    enabled:()=>!!(playScene||version)&&!playing,
    camera:()=>side==='original'?camera:rightCamera,
    aspect:()=>{const o=asset(playScene?.originalId||pair?.originalId);return o?o.height/o.width:1;},
    mode:()=>inputMode,
    singleTouchPan:()=>tool==='hand'||!!playback,
    onStart:()=>{clickedMarker=undefined;drag=undefined;draft=undefined;renderCanvas();},
    onChange:next=>{activeSide=side;if(synced){camera=next;rightCamera={...next};}else if(side==='original')camera=next;else rightCamera=next;if(playScene)playScene={...playScene,camera,rightCamera};renderCanvas();capture();},
    onEnd:()=>capture(true),
    onTap:position=>{const id=markerAt(side,position);if(id)openAnnotationCard(id);},
  });
  c.addEventListener('pointerdown',e=>{if(!version||playback||e.button!==0)return;activeSide=side;const rect=c.getBoundingClientRect(),pos={x:e.clientX-rect.left,y:e.clientY-rect.top};drag={side,start:pos,camera:{...(side==='original'?camera:rightCamera)}};c.setPointerCapture(e.pointerId);
    const hit=!space&&!addingRegion?markerAt(side,pos):undefined;if(hit){clickedMarker={id:hit,pointerId:e.pointerId,side,start:pos,camera:{...drag.camera},moved:false};drag=undefined;return;}
    if(tool!=='hand'&&!space){const world=screenToWorld(pos,drag.camera,rect.width,rect.height,aspect()),r=asset(version.assetId)!,point=side==='original'?world:fromWorld(world,version.alignment,aspect(),r.height/r.width);if(point.x<0||point.x>1||point.y<0||point.y>(side==='original'?aspect():r.height/r.width)){drag=undefined;return;}
      draft={kind:tool,side,points:[point]};drag.region=draft;void renderCanvas();capture(true);}
  });
  c.addEventListener('pointermove',e=>{
    if(clickedMarker?.pointerId===e.pointerId){
      const rect=c.getBoundingClientRect(),dx=e.clientX-rect.left-clickedMarker.start.x,dy=e.clientY-rect.top-clickedMarker.start.y;
      if(Math.hypot(dx,dy)>5)clickedMarker.moved=true;
      if(clickedMarker.moved&&tool==='hand'){const scale=fitScale(rect.width,rect.height,aspect())*clickedMarker.camera.zoom,next={...clickedMarker.camera,x:clickedMarker.camera.x-dx/scale,y:clickedMarker.camera.y-dy/scale};if(synced){camera=next;rightCamera={...next};}else if(side==='original')camera=next;else rightCamera=next;renderCanvas();capture();}
      return;
    }
    if(!drag||drag.side!==side)return;const rect=c.getBoundingClientRect(),pos={x:e.clientX-rect.left,y:e.clientY-rect.top};if(drag.region){const world=screenToWorld(pos,drag.camera,rect.width,rect.height,aspect()),r=asset(version!.assetId)!,point=side==='original'?world:fromWorld(world,version!.alignment,aspect(),r.height/r.width);if(drag.region.kind==='pen')drag.region.points.push(point);else if(drag.region.kind!=='point')drag.region.points=[drag.region.points[0],point];draft=drag.region;}else{const s=fitScale(rect.width,rect.height,aspect())*drag.camera.zoom,next={...drag.camera,x:drag.camera.x-(pos.x-drag.start.x)/s,y:drag.camera.y-(pos.y-drag.start.y)/s};if(synced){camera=next;rightCamera={...next};}else if(side==='original')camera=next;else rightCamera=next;}void renderCanvas();capture();});
  const finish=(event:PointerEvent)=>{if(clickedMarker?.pointerId===event.pointerId){const hit=clickedMarker;clickedMarker=undefined;if(!hit.moved)openAnnotationCard(hit.id);else capture(true);return;}if(!drag)return;const region=drag.region;drag=undefined;if(region){if(region.kind!=='point'&&region.points.length<2){draft=undefined;void renderCanvas();return;}if(addingRegion&&pending){if(oppositeRegion){const first=pending.regions[0];if(first.side===region.side){toast('请在原标记的另一侧画布重新圈选。');draft=undefined;void renderCanvas();return;}first.opposite=region.points;}else pending.regions.push(region);addingRegion=false;oppositeRegion=false;showNoteEditor();}else editNote(undefined,region);}capture(true);};
  c.addEventListener('pointerup',finish);c.addEventListener('pointercancel',()=>{clickedMarker=undefined;drag=undefined;draft=undefined;void renderCanvas();});
  c.parentElement!.addEventListener('dragover',e=>{e.preventDefault();c.parentElement!.classList.add('drag-over');});c.parentElement!.addEventListener('dragleave',()=>c.parentElement!.classList.remove('drag-over'));c.parentElement!.addEventListener('drop',e=>{e.preventDefault();c.parentElement!.classList.remove('drag-over');if(playback||recording)return;importMode=side==='original'?'original':'retouch';void importFiles([...(e.dataTransfer?.files||[])]);});
}
function chooseFiles(mode:typeof importMode){if(playback||recording){toast('请先结束回放或录制再导入照片');return;}importMode=mode;const input=$('#file-input') as HTMLInputElement;input.value='';input.multiple=mode!=='version';input.click();}
$('#file-input').addEventListener('change',e=>void importFiles([...((e.target as HTMLInputElement).files||[])]));
async function importFiles(files:File[]){if(!files.length)return;const imported:Asset[]=[],failures:string[]=[];toast(`正在导入 ${files.length} 张照片…`);for(const f of files){try{imported.push(await importImage(f));}catch(e){failures.push(e instanceof Error?e.message:String(e));}}
  if(!imported.length){toast(failures.join('；'));return;}if(importMode==='original'){remember();project.assets.push(...imported);for(const a of imported)project.pairs.push({id:uid(),originalId:a.id,versions:[],versionId:''});project.selectedPairId=project.pairs.at(-imported.length)!.id;current();fit();changed();}
  else if(importMode==='version'&&pair){remember();project.assets.push(...imported);for(const a of imported)addVersion(pair,a);changed();fit();}
  else showPairing(imported);
  toast(failures.length?`已导入 ${imported.length} 张；${failures.join('；')}`:`已读取 ${imported.length} 张照片${importMode==='retouch'?'，请确认配对':''}`);
}
function addVersion(p:Pair,a:Asset){const v:Version={id:uid(),name:`V${p.versions.length+1}`,assetId:a.id,alignment:identity(),annotations:[],nextNumber:1,approved:false};p.versions.push(v);p.versionId=v.id;}
function showPairing(images:Asset[]){
  if(!project.pairs.length){toast('请先导入原图，再选择对应修图。');return;}
  openDialog('确认照片配对',`<p class="dialog-intro">按文件名建议配对。请检查后确认；同一原图可关联多个修图版本。</p><div class="pairing-list">${images.map((a,i)=>{const matches=project.pairs.filter(p=>filenameKey(asset(p.originalId)!.name)===filenameKey(a.name));const suggested=matches.length===1?matches[0].id:project.pairs.length===1?project.pairs[0].id:'';return `<label class="pairing-row"><span><strong>${esc(a.name)}</strong><small>${a.width} × ${a.height}</small></span>${icon('chevron')}<select data-pair-index="${i}"><option value="">暂不配对</option>${project.pairs.map(p=>`<option value="${p.id}" ${p.id===suggested?'selected':''}>${esc(asset(p.originalId)!.name)}</option>`).join('')}</select></label>`;}).join('')}</div><div class="dialog-actions">${button('close-dialog','取消')}<button id="confirm-pairs" class="primary">确认配对</button></div>`);
  $('#confirm-pairs').onclick=()=>{const choices=[...dialog.querySelectorAll<HTMLSelectElement>('[data-pair-index]')].filter(s=>s.value);if(!choices.length){toast('请至少选择一组配对');return;}remember();for(const select of choices){const a=images[Number(select.dataset.pairIndex)];project.assets.push(a);addVersion(project.pairs.find(p=>p.id===select.value)!,a);}closeDialog();changed();fit();};
}
function alignmentDialog(){if(!requireVersion())return;const before=structuredClone(version!.alignment);openDialog('对齐原图与修图',`<p class="dialog-intro">左侧显示 50% 透明叠加，用平移、缩放和旋转对齐主体。局部液化可在批注中单独指定另一侧位置。</p>${[['x','水平位移',-.5,.5,.001],['y','垂直位移',-.5,.5,.001],['scale','缩放',.2,3,.001],['rotation','旋转角度',-180,180,.1]].map(([key,label,min,max,step])=>`<label class="slider-label">${label}<output id="align-${key}-value">${version!.alignment[key as keyof typeof before]}</output><input data-align="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${version!.alignment[key as keyof typeof before]}"></label>`).join('')}<p class="warning">调整会影响已有跨图标记，请预览后应用。可以使用撤销恢复。</p><div class="dialog-actions">${button('close-dialog','取消')}<button id="apply-alignment" class="primary">应用对齐</button></div>`,'align');
  // Keep the dialog to the side so the alignment overlay remains visible.
  dialog.classList.add('align-dialog');dialog.querySelectorAll<HTMLInputElement>('[data-align]').forEach(input=>input.oninput=()=>{const key=input.dataset.align as keyof typeof before;version!.alignment[key]=Number(input.value);$(`#align-${key}-value`).textContent=Number(input.value).toFixed(3);void renderCanvas();});
  dialogCleanup=()=>{version!.alignment=before;dialog.classList.remove('align-dialog');void renderCanvas();};
  $('#apply-alignment').onclick=()=>{const after=structuredClone(version!.alignment);version!.alignment=before;remember();version!.alignment=after;dialogCleanup=undefined;dialog.classList.remove('align-dialog');dialog.close();changed();};void renderCanvas();
}
function startPlayback(p:Playback){if(!p.events.length){toast('还没有可回放的批注，请先添加修改意见。');return;}if(recording){toast('请先结束录制');return;}playback=p;playTime=0;playing=false;$('#player').hidden=false;$('#chapters').innerHTML=p.chapters.map((c,i)=>`<button data-chapter="${i}">${esc(c.title)}</button>`).join('');seek(0);renderUI();}
function seek(time:number){if(!playback)return;playTime=clamp(time,0,playback.duration);playScene=structuredClone(sceneAt(playback,playTime));if(!playScene)return;camera={...playScene.camera};rightCamera={...playScene.rightCamera};$('#original-empty').hidden=true;$('#retouch-empty').hidden=true;$('#photo-title').textContent=asset(playScene.originalId)?.name||'回放';$('#play-caption').textContent=playScene.annotations.find(a=>a.id===playScene!.selectedId)?.text||'全图概览';($('#seek') as HTMLInputElement).value=String(playTime/playback.duration*1000);$('#play-time').textContent=`${formatTime(playTime)} / ${formatTime(playback.duration)}`;void renderCanvas();}
function formatTime(ms:number){const sec=Math.floor(ms/1000);return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;}
function playTick(time:number){if(!playing||!playback)return;if(lastFrame)seek(playTime+(time-lastFrame)*speed);lastFrame=time;if(playTime>=playback.duration){playing=false;lastFrame=0;updatePlayButton();return;}requestAnimationFrame(playTick);}
function updatePlayButton(){$('[data-action="play"]').innerHTML=icon(playing?'pause':'play')+(playing?'暂停':'播放');}
function stopPlayback(){playing=false;playback=undefined;playScene=undefined;lastFrame=0;$('#player').hidden=true;current();fit();renderUI();}
function replayDialog(){openDialog('选择回放',`<div class="choice-card"><h3>批注讲解</h3><p>按照片和意见顺序，自动定位每一处细节。</p><label class="checkbox"><input type="checkbox" id="include-empty">包含没有批注的照片</label><button id="start-tour" class="primary">开始讲解</button></div>${project.recordings.length?`<h3>审阅操作录制</h3><label class="checkbox"><input type="checkbox" id="skip-idle" checked>跳过超过 3 秒的等待</label><div class="recordings">${project.recordings.map(r=>`<button data-recording="${r.id}">${icon('play')}<span>${esc(r.name)}<small>${formatTime(r.duration)}</small></span></button>`).join('')}</div>`:'<p class="muted">主动录制后，可在这里回看历史审阅过程。</p>'}`);
  $('#start-tour').onclick=()=>{const include=$<HTMLInputElement>('#include-empty').checked;closeDialog();startPlayback(makeTour(project,false,include));};
}
function finishRecording(){if(!recording)return;if(recordPaused)recordStart+=performance.now()-recordPauseStart;recordPaused=false;capture(true);remember();project.recordings.push(recording);recording=undefined;changed();toast('录制已保存，可在“批注讲解”中选择历史录制。');}
function projectsDialog(){void listProjects().then(projects=>{openDialog('你的审阅项目',`<div class="dialog-actions left">${button('new-project','新建项目','plus')}${button('open-package','导入项目包','folder')}</div><div class="project-list">${projects.map(p=>`<button data-project="${p.id}"><strong>${esc(p.name)}</strong><span>${p.pairs.length} 组照片 · ${new Date(p.updatedAt).toLocaleString('zh-CN')}</span></button>`).join('')||'<p class="muted">还没有保存的项目</p>'}</div>`);dialog.querySelectorAll<HTMLButtonElement>('[data-project]').forEach(b=>b.onclick=()=>{project=projects.find(p=>p.id===b.dataset.project)!;undo=[];redo=[];closeDialog();current();fit();renderUI();restoreDraft();});}).catch(error);}
function exportDialog(){if(!project.pairs.length){toast('先导入照片再导出反馈。');return;}openDialog('导出反馈',`<p class="dialog-intro">把修改意见交给后期，或保存一份可继续编辑的备份。</p><label>导出范围<select id="export-scope"><option value="current">当前照片</option><option value="all">整个项目</option><option value="selected">选择照片</option></select></label><div id="export-pairs" hidden>${project.pairs.map(p=>`<label class="checkbox"><input type="checkbox" value="${p.id}" ${p.id===pair?.id?'checked':''}>${esc(asset(p.originalId)!.name)}</label>`).join('')}</div><div class="form-row"><label>批注范围<select id="export-filter"><option value="all">全部批注</option><option value="pending">仅未通过</option></select></label><label>PNG 输出总宽度<select id="export-width"><option value="2400">2400 px</option><option value="3600">3600 px</option><option value="4800">4800 px</option></select></label></div><label class="checkbox"><input type="checkbox" id="export-viewport">PNG 使用当前视野（仅当前照片）</label><label>HTML 回放内容<select id="export-replay"><option value="tour">按当前批注讲解</option>${project.recordings.map(r=>`<option value="${r.id}">${esc(r.name)}（完整历史录制）</option>`).join('')}</select></label><div class="export-options">${[['png','PNG 对比图','适合聊天发送'],['pdf','PDF 反馈单','含全图、局部对照与完整意见'],['html','离线 HTML 回放','无需网络，可交互播放'],['package','可编辑项目包','完整备份所有版本与源图']].map(([id,title,desc])=>`<button data-export="${id}">${icon('download')}<span><strong>${title}</strong><small>${desc}</small></span>${icon('chevron')}</button>`).join('')}</div><p id="export-estimate" class="muted"></p><p class="muted">项目包包含原始文件，可能含拍摄元数据。PDF / PNG / HTML 使用重新编码的展示图片。单张导出尺寸放大不会增加真实细节。</p><progress id="export-progress" max="1" value="0" hidden></progress><button id="cancel-export" hidden>取消导出</button>`,'export');
  const update=()=>{const scope=$<HTMLSelectElement>('#export-scope').value;$('#export-pairs').hidden=scope!=='selected';const count=scope==='current'?1:scope==='all'?project.pairs.length:dialog.querySelectorAll('#export-pairs input:checked').length;$('#export-estimate').textContent=`预计 ${count} 组照片；完整项目源文件约 ${(project.assets.reduce((s,a)=>s+a.size,0)/1048576).toFixed(1)} MB。HTML 内嵌图片体积以导出结果为准。`;};$('#export-scope').onchange=update;$('#export-pairs').onchange=update;update();
}
async function runExport(kind:string){
  const scope=$<HTMLSelectElement>('#export-scope').value,pendingOnly=$<HTMLSelectElement>('#export-filter').value==='pending';
  const ids=scope==='current'?[pair?.id]:scope==='all'?project.pairs.map(p=>p.id):[...dialog.querySelectorAll<HTMLInputElement>('#export-pairs input:checked')].map(e=>e.value);
  const p=snapshot();p.pairs=p.pairs.filter(pair=>ids.includes(pair.id));if(!p.pairs.length){toast('请选择至少一组照片');return;}
  if(pendingOnly)for(const pair of p.pairs)for(const v of pair.versions)v.annotations=v.annotations.filter(a=>a.status!=='已通过');
  let cancelled=false;$('#cancel-export').hidden=false;$('#cancel-export').onclick=()=>{cancelled=true;};const progress=$<HTMLProgressElement>('#export-progress');progress.hidden=false;
  dialog.querySelectorAll<HTMLButtonElement>('[data-export]').forEach(b=>b.disabled=true);
  const report=(n:number)=>{if(cancelled)throw new Error('导出已取消，项目和批注已保留');progress.value=n;};
  try{const {exportPng,exportPdf,exportHtml}=await import('./exports');const name=project.name.replace(/[\\/:*?"<>|]/g,'_');let blob:Blob;
    if(kind==='package'){blob=await exportPackage(project,report);report(1);download(blob,`${name}.retouch`);}
    else if(kind==='png'){const width=Number($<HTMLSelectElement>('#export-width').value),viewport=$<HTMLInputElement>('#export-viewport').checked&&scope==='current';blob=await exportPng(p,width,report,viewport?{camera,rightCamera}:undefined);report(1);download(blob,`${name}.${p.pairs.length===1?'png':'zip'}`);}
    else if(kind==='pdf'){blob=await exportPdf(p,report);report(1);download(blob,`${name}-反馈.pdf`);}
    else {const choice=$<HTMLSelectElement>('#export-replay').value;const rec=project.recordings.find(r=>r.id===choice);blob=await exportHtml(rec?project:p,rec?recordingPlayback(rec,true):makeTour(p,false,true),report);report(1);download(blob,`${name}-回放.html`);}
    toast('导出文件已生成。');
  }catch(e){error(e);}finally{dialog.querySelectorAll<HTMLButtonElement>('[data-export]').forEach(b=>b.disabled=false);$('#cancel-export').hidden=true;}
}
const actions:Record<string,()=>void>={
  originals:()=>chooseFiles('original'),retouches:()=>chooseFiles('retouch'),version:()=>{if(pair)chooseFiles('version');else toast('先导入原图');},
  import:()=>openDialog('导入照片',`<div class="import-grid"><button data-action="originals">${icon('image')}<strong>添加原图</strong><span>创建新的照片组</span></button><button data-action="retouches">${icon('image')}<strong>添加修图</strong><span>与原图配对或追加版本</span></button></div><p class="muted">JPEG / PNG / WebP · 单张不超过 30 MB、2400 万像素</p>`),
  rename:()=>{openDialog('项目名称',`<form id="rename-form"><label>名称<input id="project-title" maxlength="200" required value="${esc(project.name)}"></label><div class="dialog-actions"><button class="primary">保存</button></div></form>`);$('#rename-form').onsubmit=e=>{e.preventDefault();const name=$<HTMLInputElement>('#project-title').value.trim();if(!name)return;remember();project.name=name;closeDialog();changed();};},
  projects:projectsDialog,'new-project':()=>{project=newProject();undo=[];redo=[];closeDialog();current();fit();changed();},
  'open-package':()=>{$<HTMLInputElement>('#package-input').value='';$<HTMLInputElement>('#package-input').click();},
  note:()=>editNote(),fit,align:alignmentDialog,
  pixel:()=>{if(!requireVersion())return;const rect=canvas[activeSide].getBoundingClientRect(),a=asset(activeSide==='original'?pair!.originalId:version!.assetId)!;const zoom=clamp(a.width/(fitScale(rect.width,rect.height,aspect())*(activeSide==='retouch'?version!.alignment.scale:1)),.1,40);const next={...(activeSide==='original'?camera:rightCamera),zoom};if(synced){camera=next;rightCamera={...next};}else if(activeSide==='original')camera=next;else rightCamera=next;void renderCanvas();capture(true);},
  sync:()=>{synced=!synced;if(synced){camera={...(activeSide==='original'?camera:rightCamera)};rightCamera={...camera};}renderUI();void renderCanvas();capture(true);},
  marks:()=>{showMarks=!showMarks;renderUI();void renderCanvas();capture(true);},
  undo:()=>{if(!undo.length)return;redo.push(snapshot());project=undo.pop()!;changed();},redo:()=>{if(!redo.length)return;undo.push(snapshot());project=redo.pop()!;changed();},
  'close-dialog':closeDialog,'cancel-note':()=>{pending=undefined;localStorage.removeItem(`retouch-draft-${project.id}`);closeDialog();},
  'delete-note':()=>{if(!pending||!version)return;remember();version.annotations=version.annotations.filter(a=>a.id!==pending!.id);pending=undefined;selectedId='';localStorage.removeItem(`retouch-draft-${project.id}`);closeDialog();changed();},
  'add-region':()=>{collectPending();draftSave();closeDialog();addingRegion=true;oppositeRegion=false;setTool('ellipse');toast('请在画布圈出补充区域，完成后继续编辑意见。');},
  opposite:()=>{collectPending();draftSave();closeDialog();addingRegion=true;oppositeRegion=true;setTool(pending!.regions[0].kind);toast(`请在${pending!.regions[0].side==='original'?'修图':'原图'}画布指定对应位置。`);},
  approve:()=>{if(!version||version.annotations.some(a=>a.status!=='已通过'))return;remember();version.approved=true;changed();},
  'toggle-sidebar':()=>{document.body.classList.toggle('sidebar-hidden');},
  'toggle-photos':()=>{document.body.classList.toggle('photos-hidden');},
  replay:replayDialog,
  record:()=>{if(recording){openDialog('结束本次录制',`<p class="dialog-intro">已记录 ${formatTime(recording.duration)} 的审阅过程。文字按确认后的内容保存。</p><div class="dialog-actions">${button('pause-record',recordPaused?'继续录制':'暂停录制')}${button('finish-record','保存并结束','','primary')}</div>`);return;}if(!requireVersion())return;recording={id:uid(),name:`审阅录制 ${project.recordings.length+1}`,createdAt:new Date().toISOString(),duration:0,events:[]};recordStart=performance.now();recordPaused=false;capture(true);renderUI();},
  'pause-record':()=>{if(recordPaused){recordStart+=performance.now()-recordPauseStart;recordPaused=false;}else{capture(true);recordPauseStart=performance.now();recordPaused=true;}closeDialog();renderUI();},
  'finish-record':()=>{closeDialog();finishRecording();},
  play:()=>{if(!playback)return;playing=!playing;lastFrame=0;if(playing){if(playTime>=playback.duration)seek(0);requestAnimationFrame(playTick);}updatePlayButton();},
  stop:stopPlayback,prev:()=>{if(!playback)return;seek([...playback.chapters].reverse().find(c=>c.time<playTime-100)?.time||0);},next:()=>{if(!playback)return;seek(playback.chapters.find(c=>c.time>playTime+100)?.time||playback.duration);},
  fullscreen:()=>{if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen().catch(error);},
  export:exportDialog,
  help:()=>openDialog('使用帮助',`<div class="help-list"><p><kbd>H</kbd>平移 <kbd>P</kbd>点标记 <kbd>R</kbd>矩形 <kbd>O</kbd>椭圆 <kbd>B</kbd>自由圈画</p><p><kbd>空格 + 拖动</kbd>临时平移 · 触控板双指滑动平移，捏合缩放。鼠标可切换工具栏“鼠标”模式，用滚轮缩放</p><p><kbd>⌘ / Ctrl + Z</kbd>撤销 <kbd>⇧ + ⌘ / Ctrl + Z</kbd>重做</p><p>在任意一侧画出区域，然后填写修改说明。点击意见可自动定位。</p><p>若两张照片裁切不同，先点击“对齐”。局部变形可在意见编辑器指定另一侧位置。</p><p>“批注讲解”自动生成回放；“录制”保存主动审阅过程。导出 HTML 可离线播放。</p><p>照片保存在当前浏览器，清理浏览器数据会删除它们。请定期导出可编辑项目包。</p></div>`),
};
document.addEventListener('click',e=>{
  const target=(e.target as Element).closest<HTMLElement>('button,[data-focus]');if(!target)return;
  const allowedDuringPlayback=['play','stop','prev','next','fullscreen','help','toggle-sidebar','toggle-photos','export','close-dialog'];
  const action=target.dataset.action;
  if(playback&&((action&&!allowedDuringPlayback.includes(action))||target.dataset.tool||target.dataset.edit||target.dataset.pair)){toast('回放为只读，点击关闭回放后继续编辑。');return;}
  if(recording&&action&&['projects','new-project','open-package'].includes(action)){toast('请先保存并结束录制');return;}
  if(action){if(['originals','retouches','version'].includes(action)&&dialog.open)closeDialog();actions[action]?.();}
  if(target.dataset.view){$('.compare').dataset.view=target.dataset.view;document.querySelectorAll<HTMLElement>('[data-view]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String(b.dataset.view===target.dataset.view));});if(target.dataset.view!=='both')activeSide=target.dataset.view as Side;renderCanvas();}
  if(target.dataset.tool)setTool(target.dataset.tool as Tool);
  if(target.dataset.pair)selectPair(target.dataset.pair);
  if(target.dataset.focus)focusAnnotation(target.dataset.focus);
  if(target.dataset.edit)editNote(target.dataset.edit);
  if(target.dataset.filter){filter=target.dataset.filter;document.querySelectorAll('[data-filter]').forEach(e=>e.classList.toggle('active',(e as HTMLElement).dataset.filter===filter));renderNotes();}
  if(target.dataset.chapter&&playback)seek(playback.chapters[Number(target.dataset.chapter)].time);
  if(target.dataset.recording){const skip=$<HTMLInputElement>('#skip-idle').checked,r=project.recordings.find(r=>r.id===target.dataset.recording)!;closeDialog();startPlayback(recordingPlayback(r,skip));}
  if(target.dataset.export)void runExport(target.dataset.export);
});
document.addEventListener('change',e=>{const t=e.target as HTMLSelectElement;if(t.dataset.status&&version){if(playback){renderNotes();return;}remember();version.annotations.find(a=>a.id===t.dataset.status)!.status=t.value as Annotation['status'];version.approved=false;changed();}});
$('#version-select').addEventListener('change',e=>{if(!pair||playback){renderUI();return;}pair.versionId=(e.target as HTMLSelectElement).value;current();selectedId='';fit();persist();renderUI();if(version&&pair.versions.length>1&&!version.annotations.length){const old=pair.versions[pair.versions.indexOf(version)-1];if(old?.annotations.some(a=>a.status!=='已通过')){openDialog('复核新版本',`<p class="dialog-intro">是否将上一版本未通过的意见复制到此版本？复制的区域将标记为待检查定位。</p><div class="dialog-actions">${button('close-dialog','暂不复制')}<button id="copy-notes" class="primary">复制待处理意见</button></div>`);$('#copy-notes').onclick=()=>{remember();for(const a of old.annotations.filter(a=>a.status!=='已通过')){version!.annotations.push({...structuredClone(a),id:uid(),number:version!.nextNumber++,sourceId:a.id,status:'待复核',needsPositionCheck:true});}closeDialog();changed();};}}});
$('#seek').addEventListener('input',e=>{if(playback)seek(Number((e.target as HTMLInputElement).value)/1000*playback.duration);});$('#speed').addEventListener('change',e=>{speed=Number((e.target as HTMLSelectElement).value);});
$('#package-input').addEventListener('change',async e=>{const f=(e.target as HTMLInputElement).files?.[0];if(!f)return;try{toast('正在校验并恢复项目…');project=await importPackage(f);undo=[];redo=[];closeDialog();current();fit();renderUI();toast('项目已恢复。');}catch(e){error(e);}});
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes((e.target as Element).tagName)||dialog.open)return;if(e.code==='Space'){e.preventDefault();space=true;}if(playback)return;const tools:Record<string,Tool>={h:'hand',p:'point',r:'rect',o:'ellipse',b:'pen'};if(tools[e.key.toLowerCase()]&&!e.metaKey&&!e.ctrlKey)setTool(tools[e.key.toLowerCase()]);if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();actions[e.shiftKey?'redo':'undo']();}});document.addEventListener('keyup',e=>{if(e.code==='Space')space=false;});window.addEventListener('blur',()=>{space=false;});
new ResizeObserver(()=>void renderCanvas()).observe($('.compare'));
window.addEventListener('beforeunload',e=>{if(recording||pendingWrites){e.preventDefault();}});
void listProjects().then(projects=>{if(projects.length)project=projects[0];current();fit();renderUI();restoreDraft();}).catch(e=>{renderUI();error(e);});
