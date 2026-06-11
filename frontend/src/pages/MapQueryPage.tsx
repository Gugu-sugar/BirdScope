import { MapPanel } from "../components/map/MapPanel";
import { QueryPanel } from "../components/query/QueryPanel";
import { ResultList } from "../components/query/ResultList";

export function MapQueryPage() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              BirdScope
            </p>
            <h1 className="text-xl font-semibold">鸟类观测查询工作台</h1>
          </div>
          <div className="text-sm text-slate-500">2024 年 8-11 月迁徙季</div>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
        <aside className="min-h-0 rounded border border-slate-200 bg-white shadow-sm">
          <QueryPanel />
        </aside>

        <section className="min-h-[420px] rounded border border-slate-200 bg-white shadow-sm lg:min-h-0">
          <MapPanel />
        </section>

        <aside className="min-h-[320px] rounded border border-slate-200 bg-white shadow-sm lg:min-h-0">
          <ResultList />
        </aside>
      </section>
    </main>
  );
}
