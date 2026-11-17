import type { Pair, Project } from './model';
export type PhotoStatus = 'all' | 'annotated' | 'pending';
export function roundVersion(pair:Pair,round:number){
  return round>0?pair.versions[round-1]:pair.versions.find(v=>v.id===pair.versionId);
}
export function filterPhotos(project:Project,round:number,status:PhotoStatus,annotationRound=0){
  return project.pairs.filter(pair=>{
    const version=roundVersion(pair,round);
    if(round>0&&!version)return false;
    if(status==='all')return true;
    const notesVersion=annotationRound?roundVersion(pair,annotationRound):version;
    return notesVersion?.annotations.some(a=>status==='annotated'||a.status!=='已通过')??false;
  });
}
