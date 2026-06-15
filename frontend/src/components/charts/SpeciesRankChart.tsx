import ReactECharts from "echarts-for-react";
import { useEffect, useState } from "react";
import { querySpeciesRank } from "../../api/stats";
import type { SpeciesItem } from "../../types/api";

type SpeciesRankChartProps = {
  month: number | null;
  speciesKey?: number;
};

export function SpeciesRankChart({ month, speciesKey }: SpeciesRankChartProps) {
  const [data, setData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    querySpeciesRank({ month: month ?? undefined, speciesKey, limit: 8 })
      .then((items) => {
        setData(
          items.map((item) => ({
            name: item.species ?? `物种 ${item.species_key}`,
            value: item.record_count
          }))
        );
      })
      .finally(() => setLoading(false));
  }, [month, speciesKey]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            物种排行
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">
            前 8 种观测最多物种
          </h3>
        </div>
        {loading ? <span className="text-xs text-slate-500">加载中…</span> : null}
      </div>
      <ReactECharts
        option={{
          tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" }
          },
          grid: { left: "10%", right: "5%", top: "12%", bottom: "10%" },
          xAxis: {
            type: "value",
            boundaryGap: [0, 0.01]
          },
          yAxis: {
            type: "category",
            data: data.map((item) => item.name),
            inverse: true,
            axisLabel: { interval: 0, fontSize: 12 }
          },
          series: [
            {
              name: "记录数",
              type: "bar",
              data: data.map((item) => item.value),
              itemStyle: { color: "#0f766e" },
              emphasis: { itemStyle: { color: "#115e59" } }
            }
          ]
        }}
        style={{ width: "100%", height: "320px" }}
      />
    </section>
  );
}
