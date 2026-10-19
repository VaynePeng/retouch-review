import { z } from 'zod';
export const pointSchema = z.object({ x: z.number().finite(), y: z.number().finite() });
export const cameraSchema = pointSchema.extend({ zoom: z.number().positive().max(100) });
export const alignmentSchema = z.object({ x: z.number().finite(), y: z.number().finite(), scale: z.number().positive().max(10), rotation: z.number().finite() });
export const regionSchema = z.object({ kind: z.enum(['point','rect','ellipse','pen']), side: z.enum(['original','retouch']), points: z.array(pointSchema).min(1).max(20000), opposite: z.array(pointSchema).optional() });
export const annotationSchema = z.object({ id: z.string(), number: z.number().int().positive(), text: z.string().max(20000), category: z.string(), priority: z.enum(['普通','必须修改','建议调整']), status: z.enum(['待修改','待复核','已通过']), regions: z.array(regionSchema), createdAt: z.string(), updatedAt: z.string(), duration: z.number().min(1).max(120), sourceId: z.string().optional(), needsPositionCheck: z.boolean().optional() });
export const versionSchema = z.object({ id: z.string(), name: z.string(), assetId: z.string(), alignment: alignmentSchema, annotations: z.array(annotationSchema), nextNumber: z.number().int().positive(), approved: z.boolean() });
export const pairSchema = z.object({ id: z.string(), originalId: z.string(), versions: z.array(versionSchema), versionId: z.string() });
export const assetSchema = z.object({ preview:z.string().regex(/^data:image\/jpeg;base64,/).optional(), id: z.string(), name: z.string(), width: z.number().positive().max(100000), height: z.number().positive().max(100000), size: z.number().nonnegative(), type: z.enum(['image/jpeg','image/png','image/webp']), hash: z.string() });
export const sceneSchema = z.object({ pairId: z.string(), versionId: z.string(), originalId: z.string(), retouchId: z.string(), alignment: alignmentSchema, annotations: z.array(annotationSchema), camera: cameraSchema, rightCamera: cameraSchema, showMarks: z.boolean(), selectedId: z.string(), draft: regionSchema.optional() });
export const eventSchema = z.object({ time: z.number().nonnegative(), scene: sceneSchema });
export const recordingSchema = z.object({ id: z.string(), name: z.string(), createdAt: z.string(), duration: z.number().nonnegative(), events: z.array(eventSchema) });
export const projectSchema = z.object({ formatVersion: z.literal(1), id: z.string(), name: z.string().max(200), updatedAt: z.string(), assets: z.array(assetSchema), pairs: z.array(pairSchema), recordings: z.array(recordingSchema), selectedPairId: z.string() });
export type Point = z.infer<typeof pointSchema>;
export type Camera = z.infer<typeof cameraSchema>;
export type Alignment = z.infer<typeof alignmentSchema>;
export type Region = z.infer<typeof regionSchema>;
export type Annotation = z.infer<typeof annotationSchema>;
export type Version = z.infer<typeof versionSchema>;
export type Pair = z.infer<typeof pairSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Recording = z.infer<typeof recordingSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Side = 'original' | 'retouch';
export type Tool = 'hand' | Region['kind'];
export const uid = () => crypto.randomUUID();
export const identity = (): Alignment => ({ x: 0, y: 0, scale: 1, rotation: 0 });
export const newProject = (): Project => ({ formatVersion: 1, id: uid(), name: '未命名审阅', updatedAt: new Date().toISOString(), assets: [], pairs: [], recordings: [], selectedPairId: '' });
export function validateProject(input: unknown): Project {
  const p = projectSchema.parse(input);
  const assets = new Set(p.assets.map(a => a.id));
  if (assets.size !== p.assets.length) throw new Error('项目包含重复资源 ID');
  for (const pair of p.pairs) {
    if (!assets.has(pair.originalId) || pair.versions.some(v => !assets.has(v.assetId))) throw new Error('项目存在缺失图片');
    if (pair.versionId && !pair.versions.some(v => v.id === pair.versionId)) throw new Error('修图版本引用无效');
    for (const v of pair.versions) if (v.annotations.some(a => a.number >= v.nextNumber)) throw new Error('批注编号计数无效');
  }
  for (const r of p.recordings) {
    let last = -1;
    for (const e of r.events) {
      if (e.time < last || e.time > r.duration || !assets.has(e.scene.originalId) || !assets.has(e.scene.retouchId)) throw new Error('回放数据无效');
      last = e.time;
    }
  }
  return p;
}
