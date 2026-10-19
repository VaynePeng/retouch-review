import JSZip from 'jszip';
import { type Asset, type Project, uid, validateProject } from './model';
let database: Promise<IDBDatabase> | undefined;
function db(): Promise<IDBDatabase> {
  return database ??= new Promise((resolve,reject)=>{
    const req=indexedDB.open('retouch-review',1);
    req.onupgradeneeded=()=>{req.result.createObjectStore('projects');req.result.createObjectStore('assets');};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function write(store: string,key:string,value:unknown):Promise<void>{
  const d=await db();await new Promise<void>((resolve,reject)=>{const tx=d.transaction(store,'readwrite');tx.objectStore(store).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
}
async function read<T>(store:string,key:string):Promise<T|undefined>{const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result as T);r.onerror=()=>reject(r.error);});}
export const saveProject=(p:Project)=>write('projects',p.id,p);
export async function listProjects():Promise<Project[]>{const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('projects').objectStore('projects').getAll();r.onsuccess=()=>resolve((r.result as Project[]).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));r.onerror=()=>reject(r.error);});}
export const getBlob=(id:string)=>read<Blob>('assets',id);
export const putBlob=(id:string,blob:Blob)=>write('assets',id,blob);
export async function digest(blob:Blob):Promise<string>{return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function importImage(file:File):Promise<Asset>{
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error(`${file.name}：仅支持 JPEG / PNG / WebP`);
  if(file.size>30*1024*1024) throw new Error(`${file.name} 超过 30 MB，请先缩小或压缩`);
  const image=await createImageBitmap(file,{imageOrientation:'from-image'});
  if(image.width*image.height>24000000){image.close();throw new Error(`${file.name} 超过 2400 万像素，请先缩小`);}
  const preview=document.createElement('canvas');preview.width=120;preview.height=Math.round(120*image.height/image.width);preview.getContext('2d')!.drawImage(image,0,0,preview.width,preview.height);
  const asset:Asset={preview:preview.toDataURL('image/jpeg',.7),id:uid(),name:file.name,width:image.width,height:image.height,size:file.size,type:file.type as Asset['type'],hash:await digest(file)};
  image.close();await putBlob(asset.id,file);return asset;
}
const imageCache=new Map<string,{url:string,image:HTMLImageElement}>();
const loadingImages=new Map<string,Promise<HTMLImageElement>>();
export async function loadImage(id:string):Promise<HTMLImageElement>{
  const existing=loadingImages.get(id);if(existing)return existing;
  const job=decodeImage(id);loadingImages.set(id,job);
  try{return await job;}finally{loadingImages.delete(id);}
}
async function decodeImage(id:string):Promise<HTMLImageElement>{
  const cached=imageCache.get(id);if(cached){imageCache.delete(id);imageCache.set(id,cached);return cached.image;}
  const blob=await getBlob(id);if(!blob)throw new Error('图片资源不存在，请重新导入项目包');
  const url=URL.createObjectURL(blob),image=new Image();image.src=url;try{await image.decode();}catch(error){URL.revokeObjectURL(url);throw error;}
  imageCache.set(id,{url,image});while(imageCache.size>6){const first=imageCache.keys().next().value!;URL.revokeObjectURL(imageCache.get(first)!.url);imageCache.delete(first);}
  return image;
}
export function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();window.addEventListener('focus',()=>URL.revokeObjectURL(url),{once:true});}
export async function exportPackage(project:Project,onProgress:(n:number)=>void):Promise<Blob>{
  const zip=new JSZip();zip.file('project.json',JSON.stringify(project));
  for(let i=0;i<project.assets.length;i++){const a=project.assets[i],b=await getBlob(a.id);if(!b)throw new Error(`缺少资源：${a.name}`);zip.file(`assets/${a.id}`,b);onProgress((i+1)/project.assets.length*.5);}
  return zip.generateAsync({type:'blob',compression:'STORE'},m=>onProgress(.5+m.percent/200));
}
export async function importPackage(file:File):Promise<Project>{
  if(file.size>1024*1024*1024) throw new Error('项目包超过 1 GB，请拆分导入');
  const zip=await JSZip.loadAsync(file),manifest=zip.file('project.json');if(!manifest)throw new Error('项目包缺少 project.json');
  const project=validateProject(JSON.parse(await manifest.async('string')));
  const blobs: {id:string,blob:Blob}[]=[];
  for(const a of project.assets){const entry=zip.file(`assets/${a.id}`);if(!entry)throw new Error(`缺少图片：${a.name}`);const blob=new Blob([await entry.async('arraybuffer')],{type:a.type});if(await digest(blob)!==a.hash)throw new Error(`校验失败：${a.name}`);blobs.push({id:a.id,blob});}
  for(const {id,blob} of blobs) await putBlob(id,blob);
  project.id=uid();project.name+=' · 导入';project.updatedAt=new Date().toISOString();await saveProject(project);return project;
}
