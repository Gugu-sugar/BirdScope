import type { Bbox } from "../types/geo";

/**
 * 查询后联动热力图的「粒度随范围自适应」策略。
 *
 * 依据查询范围外接框面积（平方度）选网格粒度：范围越小粒度越细；小到一定程度
 * 直接不画网格、只留矢量点（点位在街道级比网格更有信息量）。
 *
 * 阈值结合实测标定（month=10，密集区为准）：
 * - 大范围走预聚合表（1.0°/0.5°，26–360ms）；
 * - 中范围 0.25°、中小范围 0.1° 走实时聚合，热态 ≤ ~1.6s 且避开 max_cells=10000 截断；
 * - 面积 ≤ 6 平方度（约 2.5°×2.5° 以内）判为「本地」，返回 null = 仅点位。
 *
 * 返回 null 表示「太小，仅显示矢量点，不画热力网格」。
 */
export function adaptiveGridSize(bbox: Bbox): number | null {
  const area = bboxAreaSqDeg(bbox);
  if (area <= 6) return null; // 本地：仅点位
  if (area <= 60) return 0.1; // 中小范围：最细网格
  if (area <= 300) return 0.25; // 中范围：细网格
  if (area <= 4000) return 0.5; // 大范围：预聚合
  return 1; // 洲级 / 全球：预聚合
}

/** 给信息卡用的可读描述。 */
export function describeLinkedGrid(bbox: Bbox): string {
  const gs = adaptiveGridSize(bbox);
  return gs === null ? "本地 · 仅点位" : `${gs}° 网格`;
}

/** 外接框面积（平方度），跨经度方向取绝对值，纬度方向同理。 */
export function bboxAreaSqDeg(bbox: Bbox): number {
  const [minx, miny, maxx, maxy] = bbox;
  return Math.abs((maxx - minx) * (maxy - miny));
}
