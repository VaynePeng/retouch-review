import type { Project } from './model';
export function exportPairs(project:Project,scope:string,currentId:string|undefined,selectedIds:string[],pendingOnly:boolean){
  return project.pairs.filter(pair=>{
    if(scope==='current')return pair.id===currentId;
    if(scope==='all')return true;
    if(scope==='annotated')return pair.versions.find(v=>v.id===pair.versionId)?.annotations.some(a=>!pendingOnly||a.status!=='已通过')??false;
    return selectedIds.includes(pair.id);
  });
}
