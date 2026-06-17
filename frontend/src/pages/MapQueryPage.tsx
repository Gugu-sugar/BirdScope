import {
  BarChart3,
  Info,
  Layers3,
  List,
  Search,
  Send,
  X,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { InsightPanel } from "../components/charts/InsightPanel";
import { LayerPanel } from "../components/layers/LayerPanel";
import { PublishLayerDialog } from "../components/layers/PublishLayerDialog";
import { MapPanel } from "../components/map/MapPanel";
import { QueryPanel } from "../components/query/QueryPanel";
import { ResultList } from "../components/query/ResultList";
import { useQueryStore, type ActiveQuery } from "../store/queryStore";
import type { OccurrenceFeature } from "../types/api";
import type { Bbox, BufferSelection, GeoJsonPolygon, LngLat, SpatialMode } from "../types/geo";

type WorkspacePanel = "query" | "results" | "charts" | "layers";

const PANEL_META: Record<
  WorkspacePanel,
  {
    title: string;
    kicker: string;
    description: string;
  }
> = {
  query: {
    title: "查询条件",
    kicker: "Query",
    description: "按物种、月份和空间范围筛选观测记录。"
  },
  results: {
    title: "查询结果",
    kicker: "Records",
    description: "查看当前查询返回的观测点列表。"
  },
  charts: {
    title: "统计图表",
    kicker: "Charts",
    description: "物种排行、月度趋势与区域统计。"
  },
  layers: {
    title: "图层管理",
    kicker: "Layers",
    description: "图层开关与发布列表将在批次③接入。"
  }
};

export function MapQueryPage() {
  const {
    bbox,
    buffer,
    polygon,
    month,
    activeQuery,
    results,
    selectedGbifId,
    loading,
    error,
    setBbox,
    setBufferCenter,
    setPolygon,
    setMonth,
    setSpatialMode,
    spatialMode
  } = useQueryStore();
  const [activePanel, setActivePanel] = useState<WorkspacePanel | null>("query");
  // 收缩动画期间保留最后一个面板的内容，避免空盒子塌陷；只在打开时更新。
  const [displayedPanel, setDisplayedPanel] = useState<WorkspacePanel>("query");
  const [publishOpen, setPublishOpen] = useState(false);
  const [layerRefreshToken, setLayerRefreshToken] = useState(0);

  useEffect(() => {
    if (!loading && (results || error)) {
      setActivePanel("results");
    }
  }, [error, loading, results]);

  useEffect(() => {
    if (activePanel) {
      setDisplayedPanel(activePanel);
    }
  }, [activePanel]);

  const handleBboxSelected = (nextBbox: Bbox) => {
    setSpatialMode("bbox");
    setBbox(nextBbox);
    setPolygon(null);
    setBufferCenter(null);
  };

  const handlePolygonSelected = (geometry: GeoJsonPolygon) => {
    setSpatialMode("polygon");
    setPolygon(geometry);
    setBbox(null);
    setBufferCenter(null);
  };

  const handleBufferCenterSelected = (point: LngLat) => {
    setSpatialMode("buffer");
    setBufferCenter(point);
    setBbox(null);
    setPolygon(null);
  };

  const panelMeta = PANEL_META[displayedPanel];
  const selectedFeature =
    selectedGbifId === null
      ? null
      : results?.features.find(
          (feature) => feature.properties.gbif_id === selectedGbifId
        ) ?? null;
  const railItems = useMemo(
    () => [
      { id: "query" as const, label: "查询", Icon: Search },
      { id: "results" as const, label: "结果", Icon: List, badge: results?.total },
      { id: "charts" as const, label: "图表", Icon: BarChart3 },
      { id: "layers" as const, label: "图层", Icon: Layers3 }
    ],
    [results?.total]
  );

  return (
    <main className="app-shell flex h-dvh min-h-0 flex-col overflow-hidden text-slate-950">
      <header className="relative z-30 shrink-0 border-b border-emerald-950/10 bg-[#f8fbf6]/92 px-4 py-2 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur md:px-6">
        <div className="mx-auto flex w-full max-w-[1920px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald-900/15 bg-[#102f2b] text-sm font-semibold text-lime-200 shadow-sm">
              BS
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase text-emerald-700">
                BirdScope Migration Observatory
              </p>
              <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950 md:text-xl">
                鸟类观测空间查询工作台
              </h1>
            </div>
          </div>

          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-900/15 bg-[#123b3f] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b2b2e] disabled:cursor-not-allowed disabled:opacity-65"
            onClick={() => setPublishOpen(true)}
            title="将当前月份和网格粒度发布为 GeoServer 图层"
            type="button"
          >
            <Send className="h-4 w-4" />
            发布当前图层
          </button>
        </div>
      </header>

      <section className="mx-auto flex min-h-0 w-full max-w-[1920px] flex-1 p-3">
        <nav
          aria-label="工作台面板"
          className="z-30 flex w-[68px] shrink-0 flex-col items-center gap-2 rounded-md border border-emerald-950/10 bg-[#f8fbf6]/90 p-2 shadow-xl shadow-slate-950/10 backdrop-blur"
        >
          {railItems.map(({ id, label, Icon, badge }) => (
            <RailButton
              active={activePanel === id}
              badge={badge}
              icon={Icon}
              key={id}
              label={label}
              onClick={() => setActivePanel(activePanel === id ? null : id)}
            />
          ))}
        </nav>

        <aside
          aria-hidden={!activePanel}
          className={`z-20 flex shrink-0 flex-col overflow-hidden rounded-md bg-[#fbfdf8] shadow-2xl shadow-slate-950/12 transition-[width,opacity,margin] duration-200 ease-out ${
            activePanel
              ? "ml-3 w-[360px] border border-emerald-950/10 opacity-100"
              : "pointer-events-none ml-0 w-0 border-0 opacity-0"
          }`}
        >
          {/* 固定宽度内层：aside 宽度动画时只裁剪不重排，保证收缩平滑 */}
          <div className="flex h-full w-[360px] flex-col">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-emerald-950/10 bg-white/70 p-3">
              <div className="min-w-0">
                <p className="section-kicker">{panelMeta.kicker}</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                  {panelMeta.title}
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {panelMeta.description}
                </p>
              </div>
              <button
                aria-label="收起面板"
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
                onClick={() => setActivePanel(null)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              {displayedPanel === "query" ? <QueryPanel /> : null}
              {displayedPanel === "results" ? <ResultList /> : null}
              {displayedPanel === "charts" ? (
                <InsightPanel
                  activeQuery={activeQuery}
                  month={month}
                  setMonth={setMonth}
                />
              ) : null}
              {displayedPanel === "layers" ? (
                <LayerPanel refreshToken={layerRefreshToken} />
              ) : null}
            </div>
          </div>
        </aside>

        <section className="relative ml-3 min-w-0 flex-1 overflow-hidden rounded-md border border-emerald-950/10 bg-[#071c1b] shadow-2xl shadow-slate-950/15">
          <MapPanel
            activeQuery={activeQuery}
            bbox={bbox}
            buffer={buffer}
            onBboxSelected={handleBboxSelected}
            onBufferCenterSelected={handleBufferCenterSelected}
            onPolygonSelected={handlePolygonSelected}
            polygon={polygon}
            spatialMode={spatialMode}
          />
          <FloatingInfoCard
            activeQuery={activeQuery}
            bbox={bbox}
            buffer={buffer}
            month={month}
            polygon={polygon}
            resultsTotal={results?.total}
            selectedFeature={selectedFeature}
            spatialMode={spatialMode}
          />
        </section>
      </section>

      <PublishLayerDialog
        onClose={() => setPublishOpen(false)}
        onPublished={() => setLayerRefreshToken((value) => value + 1)}
        open={publishOpen}
      />
    </main>
  );
}

type RailButtonProps = {
  active: boolean;
  badge?: number;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
};

function RailButton({ active, badge, icon: Icon, label, onClick }: RailButtonProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`group relative flex h-12 w-12 items-center justify-center rounded-md border text-sm transition ${
        active
          ? "border-emerald-900/15 bg-[#123b3f] text-lime-100 shadow-sm"
          : "border-transparent bg-white/70 text-slate-600 hover:border-emerald-900/10 hover:bg-emerald-50 hover:text-emerald-900"
      }`}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className="h-5 w-5" />
      {badge !== undefined ? (
        <span className="absolute -right-1 -top-1 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950 shadow-sm">
          {badge > 999 ? "999+" : badge}
        </span>
      ) : null}
      <span className="pointer-events-none absolute left-[calc(100%+0.5rem)] z-50 hidden whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
        {label}
      </span>
    </button>
  );
}

function FloatingInfoCard({
  activeQuery,
  bbox,
  buffer,
  month,
  polygon,
  resultsTotal,
  selectedFeature,
  spatialMode
}: {
  activeQuery: ActiveQuery | null;
  bbox: Bbox | null;
  buffer: BufferSelection | null;
  month: number | null;
  polygon: GeoJsonPolygon | null;
  resultsTotal?: number;
  selectedFeature: OccurrenceFeature | null;
  spatialMode: SpatialMode;
}) {
  const rangeText = activeQuery
    ? formatBbox(activeQuery.bbox)
    : describeCurrentSelection(spatialMode, bbox, polygon, buffer);

  return (
    <aside className="map-glass-card pointer-events-auto absolute right-4 top-4 z-20 w-[310px] rounded-md p-4 text-sm text-slate-200">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-lime-200/20 bg-lime-200/10 text-lime-100">
          <Info className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-lime-200">
            Live Context
          </p>
          <h2 className="map-strong-text mt-1 text-base font-semibold">
            当前地图上下文
          </h2>
        </div>
      </div>

      <dl className="mt-4 grid gap-2 text-xs">
        <InfoRow label="月份" value={month ? `${month} 月` : "未选择"} />
        <InfoRow
          label="记录"
          value={resultsTotal === undefined ? "等待查询" : `${resultsTotal} 条`}
        />
        <InfoRow
          label="物种"
          value={activeQuery?.speciesName ?? "全部物种"}
        />
        <InfoRow
          label="选中"
          value={
            selectedFeature
              ? occurrenceLabel(selectedFeature)
              : "尚未选择点位"
          }
        />
        <InfoRow label="范围" value={rangeText} />
      </dl>

      <p className="mt-4 rounded-md border border-amber-100/40 bg-amber-200/15 px-3 py-2 text-xs font-medium leading-5 text-amber-50">
        数据仅代表 GBIF / eBird 观测记录采样密度，不等同真实种群丰度；当前样本覆盖 2024 年 8–11 月。
      </p>
    </aside>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-2">
      <dt className="map-muted-text">{label}</dt>
      <dd className="map-strong-text truncate font-semibold" title={value}>
        {value}
      </dd>
    </div>
  );
}

function describeCurrentSelection(
  spatialMode: SpatialMode,
  bbox: Bbox | null,
  polygon: GeoJsonPolygon | null,
  buffer: BufferSelection | null
) {
  if (bbox && spatialMode === "bbox") {
    return formatBbox(bbox);
  }
  if (polygon && spatialMode === "polygon") {
    return `${polygon.coordinates[0]?.length ?? 0} 点多边形`;
  }
  if (buffer && spatialMode === "buffer") {
    return `${buffer.lng.toFixed(2)}, ${buffer.lat.toFixed(2)} / ${buffer.radiusKm}km`;
  }
  return "尚未选择范围";
}

function formatBbox(bbox: Bbox) {
  return bbox.map((value) => value.toFixed(2)).join(", ");
}

function occurrenceLabel(feature: OccurrenceFeature) {
  return (
    feature.properties.species ??
    feature.properties.scientific_name ??
    `#${feature.properties.gbif_id}`
  );
}
