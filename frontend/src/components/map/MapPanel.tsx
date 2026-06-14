import {
  CircleDot,
  Crosshair,
  Layers3,
  MapPin,
  Pentagon,
  Ruler,
  Square
} from "lucide-react";
import type {
  Bbox,
  BufferSelection,
  GeoJsonPolygon,
  LngLat,
  SpatialMode
} from "../../types/geo";

type MapPanelProps = {
  spatialMode: SpatialMode;
  bbox: Bbox | null;
  polygon: GeoJsonPolygon | null;
  buffer: BufferSelection | null;
  onBboxSelected: (bbox: Bbox) => void;
  onPolygonSelected: (geometry: GeoJsonPolygon) => void;
  onBufferCenterSelected: (point: LngLat) => void;
};

const SAMPLE_BBOX: Bbox = [70, 20, 140, 55];
const SAMPLE_POLYGON: GeoJsonPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [116, 39],
      [117, 39],
      [117, 40],
      [116, 40],
      [116, 39]
    ]
  ]
};
const SAMPLE_BUFFER_CENTER: LngLat = { lng: 121.5, lat: 31.2 };

export function MapPanel({
  spatialMode,
  bbox,
  polygon,
  buffer,
  onBboxSelected,
  onPolygonSelected,
  onBufferCenterSelected
}: MapPanelProps) {
  return (
    <div className="flex h-full min-h-[560px] flex-col bg-[#071c1b]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#092321] px-4 py-3 text-white">
        <div>
          <p className="section-kicker text-lime-200/80">Spatial Canvas</p>
          <h2 className="text-lg font-semibold tracking-tight">地图工作区</h2>
          <p className="mt-1 text-sm text-slate-300">
            Cesium 主场景接入位置 · 当前为查询范围预览
          </p>
        </div>
        <ModeBadge mode={spatialMode} />
      </div>

      <div className="relative flex flex-1 overflow-hidden bg-[#071c1b]">
        <div className="absolute inset-0 map-atmosphere" />
        <div className="absolute inset-0 map-grid opacity-90" />
        <div className="absolute inset-0 map-bathymetry" />
        <div className="map-land map-land-a" />
        <div className="map-land map-land-b" />
        <div className="map-land map-land-c" />
        <div className="map-track map-track-a" />
        <div className="map-track map-track-b" />

        <div className="absolute left-4 top-4 grid max-w-[calc(100%-2rem)] gap-2 text-xs text-slate-200">
          <MapBadge icon={Crosshair} title="WGS-84" detail="Lon 70-140 · Lat 20-55" />
          <div className="hidden sm:block">
            <MapBadge icon={Layers3} title="Layer Stack" detail="Observation · Range" />
          </div>
          <SelectionSummary bbox={bbox} buffer={buffer} polygon={polygon} />
        </div>

        <div className="absolute right-4 top-4 hidden rounded-md border border-white/15 bg-[#061719]/85 px-3 py-2 text-xs text-slate-300 shadow-xl shadow-black/20 backdrop-blur 2xl:block">
          <div className="flex items-center gap-2 text-white">
            <Ruler className="h-3.5 w-3.5 text-lime-200" />
            Query Preview
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px] uppercase text-slate-400">
            <span>BBOX</span>
            <span>POLYGON</span>
            <span>BUFFER</span>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 grid gap-3 rounded-md border border-white/15 bg-[#061719]/90 p-3 text-sm text-slate-200 shadow-2xl shadow-black/25 backdrop-blur">
          <div>
            <p className="font-semibold text-white">快速写入空间样例</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
              这些按钮仅用于模拟地图绘制结果，保留原有查询数据流。
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <button
              className="map-action border-teal-300/30 bg-teal-300/10 hover:border-teal-200 hover:bg-teal-300/20"
              onClick={() => onBboxSelected(SAMPLE_BBOX)}
              title="模拟矩形框选"
              type="button"
            >
              <Square className="h-4 w-4" />
              中国范围
            </button>
            <button
              className="map-action border-lime-300/30 bg-lime-300/10 hover:border-lime-200 hover:bg-lime-300/20"
              onClick={() => onPolygonSelected(SAMPLE_POLYGON)}
              title="模拟多边形选择"
              type="button"
            >
              <Pentagon className="h-4 w-4" />
              北京样例
            </button>
            <button
              className="map-action border-amber-300/30 bg-amber-300/10 hover:border-amber-200 hover:bg-amber-300/20"
              onClick={() => onBufferCenterSelected(SAMPLE_BUFFER_CENTER)}
              title="模拟缓冲区中心点"
              type="button"
            >
              <CircleDot className="h-4 w-4" />
              上海中心
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeBadge({ mode }: { mode: SpatialMode }) {
  const label =
    mode === "bbox" ? "矩形框选" : mode === "polygon" ? "多边形" : "缓冲区";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-lime-200/20 bg-lime-200/10 px-2.5 py-1.5 text-xs font-semibold text-lime-100">
      <MapPin className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

type MapBadgeProps = {
  icon: typeof Crosshair;
  title: string;
  detail: string;
};

function MapBadge({ icon: Icon, title, detail }: MapBadgeProps) {
  return (
    <div className="rounded-md border border-white/15 bg-[#061719]/85 px-3 py-2 shadow-xl shadow-black/20 backdrop-blur">
      <div className="flex items-center gap-2 font-semibold text-white">
        <Icon className="h-3.5 w-3.5 text-teal-300" />
        {title}
      </div>
      <p className="mt-1 text-slate-400">{detail}</p>
    </div>
  );
}

function SelectionSummary({
  bbox,
  polygon,
  buffer
}: {
  bbox: Bbox | null;
  polygon: GeoJsonPolygon | null;
  buffer: BufferSelection | null;
}) {
  if (bbox) {
    return <SummaryText label="当前矩形" value={bbox.join(", ")} tone="teal" />;
  }

  if (polygon) {
    return (
      <SummaryText
        label="当前多边形"
        tone="lime"
        value={`${polygon.coordinates[0]?.length ?? 0} 个坐标点`}
      />
    );
  }

  if (buffer) {
    return (
      <SummaryText
        label="当前缓冲区"
        tone="amber"
        value={`${buffer.lng.toFixed(4)}, ${buffer.lat.toFixed(4)} · ${
          buffer.radiusKm
        } km`}
      />
    );
  }

  return (
    <SummaryText
      label="当前选择"
      tone="slate"
      value="尚未选择空间范围"
    />
  );
}

function SummaryText({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "amber" | "lime" | "slate" | "teal";
}) {
  const toneClass =
    tone === "teal"
      ? "border-teal-300/25 bg-teal-300/10"
      : tone === "lime"
        ? "border-lime-300/25 bg-lime-300/10"
        : tone === "amber"
          ? "border-amber-300/25 bg-amber-300/10"
          : "border-white/15 bg-[#061719]/80";

  return (
    <div
      className={`inline-flex max-w-full items-center rounded-md border px-3 py-2 text-xs shadow-xl shadow-black/20 backdrop-blur ${toneClass}`}
    >
      <span className="shrink-0 font-medium text-slate-300">{label}</span>
      <span className="ml-2 truncate font-semibold text-white">{value}</span>
    </div>
  );
}
