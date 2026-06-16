import {
  BarChart3,
  ChartNoAxesCombined,
  MapPinned
} from "lucide-react";
import { useState } from "react";
import { MonthlyTrendChart } from "./MonthlyTrendChart";
import { RegionStatsChart } from "./RegionStatsChart";
import { SpeciesRankChart } from "./SpeciesRankChart";
import { TimeSlider } from "./TimeSlider";

type InsightPanelProps = {
  month: number | null;
  setMonth: (month: number) => void;
  speciesKey?: number;
  speciesName?: string | null;
};

type InsightView = "rank" | "trend" | "region";

const TABS: Array<{
  id: InsightView;
  label: string;
  Icon: typeof BarChart3;
}> = [
  { id: "rank", label: "物种排行", Icon: BarChart3 },
  { id: "trend", label: "月度趋势", Icon: ChartNoAxesCombined },
  { id: "region", label: "区域统计", Icon: MapPinned }
];

export function InsightPanel({
  month,
  setMonth,
  speciesKey,
  speciesName
}: InsightPanelProps) {
  const [activeView, setActiveView] = useState<InsightView>("rank");

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fbfdf8]">
      <div className="panel-header shrink-0 py-3">
        <p className="section-kicker">Analysis Deck</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">
              时空统计
            </h2>
            <p className="mt-1 truncate text-xs text-slate-500">
              {speciesName ? `当前物种：${speciesName}` : "当前范围：全部物种"}
            </p>
          </div>
          <span className="rounded-md border border-emerald-900/10 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            记录数
          </span>
        </div>
      </div>

      <div className="shrink-0 border-b border-emerald-950/10 p-3">
        <TimeSlider month={month} setMonth={setMonth} />
      </div>

      <div
        aria-label="统计图表选择"
        className="grid shrink-0 grid-cols-3 gap-1 border-b border-emerald-950/10 bg-white/70 p-2"
        role="tablist"
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = activeView === id;
          return (
            <button
              aria-selected={active}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold transition ${
                active
                  ? "bg-[#123b3f] text-white shadow-sm"
                  : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-900"
              }`}
              key={id}
              onClick={() => setActiveView(id)}
              role="tab"
              type="button"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 p-3">
        {activeView === "rank" ? <SpeciesRankChart month={month} /> : null}
        {activeView === "trend" ? (
          <MonthlyTrendChart speciesKey={speciesKey} />
        ) : null}
        {activeView === "region" ? (
          <RegionStatsChart month={month} speciesKey={speciesKey} />
        ) : null}
      </div>
    </div>
  );
}
