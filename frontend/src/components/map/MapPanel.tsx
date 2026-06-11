import { CircleDot, Crosshair, MapPin, Pentagon, Square } from "lucide-react";
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
    <div className="flex h-full min-h-[460px] flex-col">
      <div className="border-b border-slate-200 bg-[#fbfcfa] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">地图工作区</h2>
            <p className="mt-1 text-sm text-slate-500">
              Cesium 主场景接入位置
            </p>
          </div>
          <ModeBadge mode={spatialMode} />
        </div>
      </div>

      <div className="relative flex flex-1 overflow-hidden bg-[#092124]">
        <div className="absolute inset-0 map-grid opacity-80" />
        <div className="absolute inset-0 map-bathymetry" />
        <div className="map-land map-land-a" />
        <div className="map-land map-land-b" />
        <div className="map-land map-land-c" />

        <div className="absolute left-4 top-4 rounded border border-white/15 bg-[#061719]/85 px-3 py-2 text-xs text-slate-200 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2 font-medium text-white">
            <Crosshair className="h-3.5 w-3.5 text-teal-300" />
            WGS-84
          </div>
          <p className="mt-1 text-slate-400">Lon 70-140 · Lat 20-55</p>
        </div>

        <div className="absolute right-4 top-4 rounded border border-white/15 bg-[#061719]/85 px-3 py-2 text-xs text-slate-300 shadow-sm backdrop-blur">
          Layer · Query Preview
        </div>

        <div className="absolute bottom-4 left-4 right-4 grid gap-3 rounded border border-white/15 bg-[#061719]/90 p-3 text-sm text-slate-200 shadow-sm backdrop-blur md:grid-cols-[1fr_auto]">
          <div>
            <p className="font-medium text-white">空间选择</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
              BBOX · POLYGON · BUFFER
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 md:w-[390px]">
            <button
              className="flex h-10 items-center justify-center gap-2 rounded border border-teal-400/30 bg-teal-400/10 px-3 text-slate-100 transition hover:border-teal-300 hover:bg-teal-400/20"
              onClick={() => onBboxSelected(SAMPLE_BBOX)}
              title="模拟矩形框选"
              type="button"
            >
              <Square className="h-4 w-4" />
              中国范围
            </button>
            <button
              className="flex h-10 items-center justify-center gap-2 rounded border border-lime-300/30 bg-lime-300/10 px-3 text-slate-100 transition hover:border-lime-200 hover:bg-lime-300/20"
              onClick={() => onPolygonSelected(SAMPLE_POLYGON)}
              title="模拟多边形选择"
              type="button"
            >
              <Pentagon className="h-4 w-4" />
              北京样例
            </button>
            <button
              className="flex h-10 items-center justify-center gap-2 rounded border border-amber-300/30 bg-amber-300/10 px-3 text-slate-100 transition hover:border-amber-200 hover:bg-amber-300/20"
              onClick={() => onBufferCenterSelected(SAMPLE_BUFFER_CENTER)}
              title="模拟缓冲区中心点"
              type="button"
            >
              <CircleDot className="h-4 w-4" />
              上海中心
            </button>
          </div>
        </div>

        <div className="absolute bottom-[104px] left-4 right-4 md:bottom-[92px]">
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
    <span className="inline-flex items-center gap-1 rounded border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800">
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
    <div className="inline-flex max-w-full rounded border border-white/15 bg-[#061719]/85 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="ml-2 truncate text-slate-100">{value}</span>
    </div>
  );
}
