import { MapPanel } from "../components/map/MapPanel";
import { QueryPanel } from "../components/query/QueryPanel";
import { ResultList } from "../components/query/ResultList";
import { useQueryStore } from "../store/queryStore";
import type { Bbox, GeoJsonPolygon, LngLat } from "../types/geo";

export function MapQueryPage() {
  const {
    bbox,
    buffer,
    polygon,
    setBbox,
    setBufferCenter,
    setPolygon,
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
    <main className="flex min-h-screen flex-col bg-[#eef3f1] text-slate-950">
      <header className="border-b border-slate-200 bg-[#fbfcfa] px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded border border-teal-200 bg-teal-50 text-sm font-semibold text-teal-800">
              BS
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                BirdScope
              </p>
              <h1 className="text-xl font-semibold tracking-tight">
                鸟类观测查询工作台
              </h1>
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600">
            WGS-84 · 2024 年 8-11 月迁徙季
          </div>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[330px_minmax(0,1fr)_370px]">
        <aside className="min-h-0 overflow-hidden rounded border border-slate-200 bg-[#fbfcfa] shadow-sm">
          <QueryPanel />
        </aside>

        <section className="min-h-[460px] overflow-hidden rounded border border-slate-200 bg-[#fbfcfa] shadow-sm lg:min-h-0">
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

        <aside className="min-h-[340px] overflow-hidden rounded border border-slate-200 bg-[#fbfcfa] shadow-sm lg:min-h-0">
          <ResultList />
        </aside>
      </section>
    </main>
  );
}
