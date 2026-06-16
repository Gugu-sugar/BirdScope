import ReactECharts from "echarts-for-react";
import { useEffect, useState } from "react";
import { queryMonthlyTrend } from "../../api/stats";

type MonthlyTrendChartProps = {
  speciesKey?: number;
};

export function MonthlyTrendChart({ speciesKey }: MonthlyTrendChartProps) {
  const [data, setData] = useState<{ month: number; count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    queryMonthlyTrend({ speciesKey })
      .then((items) => {
        if (active) {
          setData(items.map((item) => ({ month: item.month, count: item.record_count })));
        }
      })
      .catch((reason) => {
        if (active) {
          setData([]);
          setError(reason instanceof Error ? reason.message : "月度趋势加载失败");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [speciesKey]);

  return (
    <section className="flex h-full min-h-[360px] flex-col rounded-md border border-slate-200 bg-white p-3 shadow-sm xl:min-h-0">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            月度趋势
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">
            观测数量随月份变化
          </h3>
        </div>
        {loading ? <span className="text-xs text-slate-500">加载中…</span> : null}
      </div>
      {error ? (
        <div className="flex flex-1 items-center justify-center rounded-md border border-red-200 bg-red-50 px-4 text-center text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {!error && data.length === 0 && !loading ? (
        <div className="flex flex-1 items-center justify-center rounded-md border border-slate-100 bg-slate-50 px-4 text-center text-sm text-slate-500">
          当前条件暂无月度数据
        </div>
      ) : null}
      {!error && (data.length > 0 || loading) ? (
        <div className="min-h-0 flex-1">
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
          grid: { left: 12, right: 12, top: 18, bottom: 12, containLabel: true },
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
            style={{ width: "100%", height: "100%", minHeight: "260px" }}
          />
        </div>
      ) : null}
    </section>
  );
}
