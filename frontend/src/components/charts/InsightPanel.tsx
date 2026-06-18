import {
  BarChart3,
  ChartNoAxesCombined,
  MapPinned
} from "lucide-react";
import { useState } from "react";
import type { ActiveQuery } from "../../store/queryStore";
import { MonthlyTrendChart } from "./MonthlyTrendChart";
import { RegionStatsChart } from "./RegionStatsChart";
import { SpeciesRankChart } from "./SpeciesRankChart";
import { TimeSlider } from "./TimeSlider";

type InsightPanelProps = {
  activeQuery: ActiveQuery | null;
  month: number | null;
  setMonth: (month: number) => void;
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
  activeQuery,
  month,
  setMonth
}: InsightPanelProps) {
  const [activeView, setActiveView] = useState<InsightView>("rank");
  const speciesKey = activeQuery?.speciesKey;
  const bbox = activeQuery?.bbox;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fbfdf8]">
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
        {activeView === "rank" ? (
          <SpeciesRankChart month={month} bbox={bbox} />
        ) : null}
        {activeView === "trend" ? (
          <MonthlyTrendChart speciesKey={speciesKey} bbox={bbox} />
        ) : null}
        {activeView === "region" ? (
          <RegionStatsChart month={month} speciesKey={speciesKey} bbox={bbox} />
        ) : null}
      </div>
    </div>
  );
}
