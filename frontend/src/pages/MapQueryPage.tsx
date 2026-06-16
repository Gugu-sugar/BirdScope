import {
  Activity,
  Database,
  Globe2,
  Layers3,
  List,
  SlidersHorizontal
} from "lucide-react";
import { useEffect, useState } from "react";
import { InsightPanel } from "../components/charts/InsightPanel";
import { MapPanel } from "../components/map/MapPanel";
import { QueryPanel } from "../components/query/QueryPanel";
import { ResultList } from "../components/query/ResultList";
import { useQueryStore } from "../store/queryStore";
import type { Bbox, GeoJsonPolygon, LngLat } from "../types/geo";

type SidebarView = "query" | "results";

export function MapQueryPage() {
  const {
    bbox,
    buffer,
    polygon,
    month,
    activeQuery,
    results,
    loading,
    error,
    setBbox,
    setBufferCenter,
    setPolygon,
    setMonth,
    setSpatialMode,
    spatialMode
  } = useQueryStore();
  const [sidebarView, setSidebarView] = useState<SidebarView>("query");

  useEffect(() => {
    if (!loading && (results || error)) {
      setSidebarView("results");
    }
  }, [error, loading, results]);

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

  return (
    <main className="app-shell flex h-dvh min-h-0 flex-col overflow-hidden text-slate-950">
      <header className="relative z-10 shrink-0 border-b border-emerald-950/10 bg-[#f8fbf6]/90 px-4 py-2 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur md:px-6">
        <div className="mx-auto flex w-full max-w-[1920px] flex-wrap items-center justify-between gap-3">
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

          <div className="hidden gap-2 text-xs text-slate-600 md:grid md:grid-cols-3">
            <StatusPill icon={Globe2} label="坐标系" value="WGS-84" />
            <StatusPill icon={Activity} label="样本季" value="2024.08-11" />
            <StatusPill icon={Database} label="数据源" value="GBIF / eBird" />
          </div>
        </div>
      </header>

      <section className="mx-auto grid min-h-0 w-full max-w-[1920px] flex-1 grid-cols-1 gap-3 overflow-auto p-3 xl:grid-cols-[340px_minmax(0,1fr)_380px] xl:grid-rows-[minmax(0,1fr)] xl:overflow-hidden">
        <aside className="panel-shell flex min-h-[620px] flex-col overflow-hidden xl:h-full xl:min-h-0">
          <div
            aria-label="查询侧栏选择"
            className="grid shrink-0 grid-cols-2 gap-1 border-b border-emerald-950/10 bg-white/75 p-2"
            role="tablist"
          >
            <SidebarTab
              active={sidebarView === "query"}
              icon={SlidersHorizontal}
              label="查询条件"
              onClick={() => setSidebarView("query")}
            />
            <SidebarTab
              active={sidebarView === "results"}
              badge={results?.total}
              icon={List}
              label="查询结果"
              onClick={() => setSidebarView("results")}
            />
          </div>
          <div className="min-h-0 flex-1">
            {sidebarView === "query" ? <QueryPanel /> : <ResultList />}
          </div>
        </aside>

        <section className="panel-shell min-h-[620px] overflow-hidden xl:h-full xl:min-h-0">
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
        </section>

        <aside className="panel-shell min-h-[620px] overflow-hidden xl:h-full xl:min-h-0">
          <InsightPanel
            activeQuery={activeQuery}
            month={month}
            setMonth={setMonth}
          />
        </aside>
      </section>

      <footer className="shrink-0 border-t border-emerald-950/10 bg-[#f8fbf6]/80 px-4 py-1.5 text-xs text-slate-500 md:px-6">
        <div className="mx-auto flex w-full max-w-[1920px] items-center justify-between gap-2">
          <span>生态观测数据仅代表记录采样密度，请结合空间范围解读。</span>
          <span className="inline-flex items-center gap-1 text-emerald-800">
            <Layers3 className="h-3.5 w-3.5" />
            查询预览层 · 统计结果联动
          </span>
        </div>
      </footer>
    </main>
  );
}

type SidebarTabProps = {
  active: boolean;
  badge?: number;
  icon: typeof List;
  label: string;
  onClick: () => void;
};

function SidebarTab({
  active,
  badge,
  icon: Icon,
  label,
  onClick
}: SidebarTabProps) {
  return (
    <button
      aria-selected={active}
      className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-[#123b3f] text-white shadow-sm"
          : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-900"
      }`}
      onClick={onClick}
      role="tab"
      type="button"
    >
      <Icon className="h-4 w-4" />
      {label}
      {badge !== undefined ? (
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] ${
            active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

type StatusPillProps = {
  icon: typeof Globe2;
  label: string;
  value: string;
};

function StatusPill({ icon: Icon, label, value }: StatusPillProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-emerald-950/10 bg-white/80 px-3 py-2 shadow-sm">
      <Icon className="h-4 w-4 shrink-0 text-emerald-700" />
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
