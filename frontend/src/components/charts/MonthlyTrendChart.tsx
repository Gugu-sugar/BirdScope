import ReactECharts from "echarts-for-react";
import { useEffect, useState } from "react";
import { queryMonthlyTrend } from "../../api/stats";

type MonthlyTrendChartProps = {
  speciesKey?: number;
};

export function MonthlyTrendChart({ speciesKey }: MonthlyTrendChartProps) {
  const [data, setData] = useState<{ month: number; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    queryMonthlyTrend({ speciesKey })
      .then((items) => {
        setData(items.map((item) => ({ month: item.month, count: item.record_count })));
      })
      .finally(() => setLoading(false));
  }, [speciesKey]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            月度趋势
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">
            观测数量随月份变化
          </h3>
        </div>
        {loading ? <span className="text-xs text-slate-500">加载中…</span> : null}
      </div>
      <ReactECharts
        option={{
          tooltip: { trigger: "axis" },
          xAxis: {
            type: "category",
            data: data.map((item) => `${item.month}月`)
          },
          yAxis: {
            type: "value",
            axisLabel: { formatter: "{value}" }
          },
          series: [
            {
              name: "记录数",
              type: "line",
              smooth: true,
              data: data.map((item) => item.count),
              lineStyle: { color: "#047857" },
              itemStyle: { color: "#047857" },
              areaStyle: { color: "rgba(16, 185, 129, 0.12)" }
            }
          ]
        }}
        style={{ width: "100%", height: "300px" }}
      />
    </section>
  );
}
