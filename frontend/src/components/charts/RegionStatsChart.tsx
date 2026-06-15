import ReactECharts from "echarts-for-react";
import { useEffect, useState } from "react";
import { queryProvinceStats } from "../../api/stats";

type RegionStatsChartProps = {
  month: number | null;
  speciesKey?: number;
};

export function RegionStatsChart({ month, speciesKey }: RegionStatsChartProps) {
  const [data, setData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    queryProvinceStats({ month: month ?? undefined, speciesKey })
      .then((items) => {
        setData(
          items
            .slice(0, 8)
            .map((item) => ({
              name: item.state_province ?? "未知省份",
              value: item.record_count
            }))
            .sort((a, b) => b.value - a.value)
        );
      })
      .finally(() => setLoading(false));
  }, [month, speciesKey]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            区域统计
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">
            省级观测量排行
          </h3>
        </div>
        {loading ? <span className="text-xs text-slate-500">加载中…</span> : null}
      </div>
      <ReactECharts
        option={{
          tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
          grid: { left: "10%", right: "5%", top: "12%", bottom: "10%" },
          xAxis: { type: "value" },
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
              itemStyle: { color: "#0c4a6e" },
              emphasis: { itemStyle: { color: "#1e429f" } }
            }
          ]
        }}
        style={{ width: "100%", height: "320px" }}
      />
    </section>
  );
}
