import { Activity, Database, Globe2, Layers3 } from "lucide-react";
import { MapPanel } from "../components/map/MapPanel";
import { QueryPanel } from "../components/query/QueryPanel";
import { ResultList } from "../components/query/ResultList";
import { SpeciesRankChart } from "../components/charts/SpeciesRankChart";
import { MonthlyTrendChart } from "../components/charts/MonthlyTrendChart";
import { RegionStatsChart } from "../components/charts/RegionStatsChart";
import { TimeSlider } from "../components/charts/TimeSlider";
import { useQueryStore } from "../store/queryStore";
import type { Bbox, GeoJsonPolygon, LngLat } from "../types/geo";

export function MapQueryPage() {
  const {
    bbox,
    buffer,
    polygon,
    month,
    selectedSpecies,
    setBbox,
    setBufferCenter,
    setPolygon,
    setMonth,
    setSpatialMode,
    spatialMode
  } = useQueryStore();

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
    <main className="app-shell flex min-h-screen flex-col text-slate-950">
      <header className="relative z-10 border-b border-emerald-950/10 bg-[#f8fbf6]/90 px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur md:px-6">
        <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-emerald-900/15 bg-[#102f2b] text-sm font-semibold text-lime-200 shadow-sm">
              BS
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase text-emerald-700">
                BirdScope Migration Observatory
              </p>
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-950 md:text-2xl">
                鸟类观测空间查询工作台
              </h1>
            </div>
          </div>

          <div className="grid w-full gap-2 text-xs text-slate-600 sm:w-auto sm:grid-cols-3">
            <StatusPill icon={Globe2} label="坐标系" value="WGS-84" />
            <StatusPill icon={Activity} label="样本季" value="2024.08-11" />
            <StatusPill icon={Database} label="数据源" value="GBIF / eBird" />
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1800px] flex-1 grid-cols-1 gap-3 p-3 lg:min-h-0 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_390px]">
        <aside className="panel-shell min-h-0 overflow-hidden lg:order-1">
          <QueryPanel />
        </aside>

        <section className="panel-shell min-h-[560px] overflow-hidden lg:order-2 lg:min-h-0">
          <MapPanel
            bbox={bbox}
            buffer={buffer}
            onBboxSelected={handleBboxSelected}
            onBufferCenterSelected={handleBufferCenterSelected}
            onPolygonSelected={handlePolygonSelected}
            polygon={polygon}
            spatialMode={spatialMode}
          />
        </section>

        <aside className="panel-shell min-h-[420px] overflow-hidden lg:order-3 xl:min-h-0">
          <div className="flex h-full min-h-0 flex-col gap-3 p-3">
            <TimeSlider month={month} setMonth={setMonth} />
            <SpeciesRankChart
              month={month}
              speciesKey={selectedSpecies?.species_key ?? undefined}
            />
            <MonthlyTrendChart
              speciesKey={selectedSpecies?.species_key ?? undefined}
            />
            <RegionStatsChart
              month={month}
              speciesKey={selectedSpecies?.species_key ?? undefined}
            />
          </div>
        </aside>
      </section>

      <footer className="border-t border-emerald-950/10 bg-[#f8fbf6]/80 px-4 py-2 text-xs text-slate-500 md:px-6">
        <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-2">
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
