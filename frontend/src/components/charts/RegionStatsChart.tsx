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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    queryProvinceStats({ month: month ?? undefined, speciesKey })
      .then((items) => {
        if (active) {
          setData(
            items
              .slice(0, 8)
              .map((item) => ({
                name: item.state_province ?? "未知省份",
                value: item.record_count
              }))
              .sort((a, b) => b.value - a.value)
          );
        }
      })
      .catch((reason) => {
        if (active) {
          setData([]);
          setError(reason instanceof Error ? reason.message : "区域统计加载失败");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [month, speciesKey]);

  return (
    <section className="flex h-full min-h-[360px] flex-col rounded-md border border-slate-200 bg-white p-3 shadow-sm xl:min-h-0">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            区域统计
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">
            省级观测量排行
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
          当前条件暂无区域数据
        </div>
      ) : null}
      {!error && (data.length > 0 || loading) ? (
        <div className="min-h-0 flex-1">
          <ReactECharts
            option={{
          tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
          grid: { left: 12, right: 12, top: 12, bottom: 12, containLabel: true },
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
            style={{ width: "100%", height: "100%", minHeight: "260px" }}
          />
        </div>
      ) : null}
    </section>
  );
}
