import { CircleDot, MapPin, Pentagon, Square } from "lucide-react";
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
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">地图区域</h2>
            <p className="mt-1 text-sm text-slate-500">Cesium 主场景接入位置</p>
          </div>
          <ModeBadge mode={spatialMode} />
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-900 p-4">
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(#334155_1px,transparent_1px),linear-gradient(90deg,#334155_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative grid w-full max-w-3xl gap-3 rounded border border-slate-600 bg-slate-950 p-4 text-sm text-slate-200 shadow-sm">
          <div>
            <p className="font-medium text-white">占位地图联动测试</p>
            <p className="mt-1 text-slate-400">
              后续 2 号可用 Cesium 绘制结果替换这些按钮，保留相同回调。
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <button
              className="flex h-10 items-center justify-center gap-2 rounded border border-slate-600 bg-slate-900 px-3 text-slate-100 hover:border-emerald-500 hover:text-emerald-200"
              onClick={() => onBboxSelected(SAMPLE_BBOX)}
              title="模拟矩形框选"
              type="button"
            >
              <Square className="h-4 w-4" />
              中国范围
            </button>
            <button
              className="flex h-10 items-center justify-center gap-2 rounded border border-slate-600 bg-slate-900 px-3 text-slate-100 hover:border-emerald-500 hover:text-emerald-200"
              onClick={() => onPolygonSelected(SAMPLE_POLYGON)}
              title="模拟多边形选择"
              type="button"
            >
              <Pentagon className="h-4 w-4" />
              北京样例
            </button>
            <button
              className="flex h-10 items-center justify-center gap-2 rounded border border-slate-600 bg-slate-900 px-3 text-slate-100 hover:border-emerald-500 hover:text-emerald-200"
              onClick={() => onBufferCenterSelected(SAMPLE_BUFFER_CENTER)}
              title="模拟缓冲区中心点"
              type="button"
            >
              <CircleDot className="h-4 w-4" />
              上海中心
            </button>
          </div>

          <SelectionSummary bbox={bbox} buffer={buffer} polygon={polygon} />
        </div>
      </div>
    </div>
  );
}

function ModeBadge({ mode }: { mode: SpatialMode }) {
  const label =
    mode === "bbox" ? "矩形框选" : mode === "polygon" ? "多边形" : "缓冲区";
  return (
    <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
      <MapPin className="h-3.5 w-3.5" />
      {label}
    </span>
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
    return <SummaryText label="当前矩形" value={bbox.join(", ")} />;
  }

  if (polygon) {
    return (
      <SummaryText
        label="当前多边形"
        value={`${polygon.coordinates[0]?.length ?? 0} 个坐标点`}
      />
    );
  }

  if (buffer) {
    return (
      <SummaryText
        label="当前缓冲区"
        value={`${buffer.lng.toFixed(4)}, ${buffer.lat.toFixed(4)} · ${
          buffer.radiusKm
        } km`}
      />
    );
  }

  return <SummaryText label="当前选择" value="尚未选择空间范围" />;
}

function SummaryText({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="ml-2 text-slate-100">{value}</span>
    </div>
  );
}
