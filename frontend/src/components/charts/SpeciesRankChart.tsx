import ReactECharts from "echarts-for-react";
import { useEffect, useState } from "react";
import { querySpeciesRank } from "../../api/stats";
import type { Bbox } from "../../types/geo";

type SpeciesRankChartProps = {
  month: number | null;
  bbox?: Bbox;
};

export function SpeciesRankChart({ month, bbox }: SpeciesRankChartProps) {
  const [data, setData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    querySpeciesRank({
      month: month ?? undefined,
      limit: 8,
      bbox,
      signal: controller.signal
    })
      .then((items) => {
        setData(
          items.map((item) => ({
            name: item.species ?? `物种 ${item.species_key}`,
            value: item.record_count
          }))
        );
        setLoading(false);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setData([]);
        setError(reason instanceof Error ? reason.message : "物种排行加载失败");
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [month, bbox]);

  return (
    <section className="flex h-full min-h-[360px] flex-col rounded-md border border-slate-200 bg-white p-3 shadow-sm xl:min-h-0">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            物种排行
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">
            前 8 种观测最多物种
          </h3>
        </div>
        {loading ? <span className="text-xs text-slate-500">加载中…</span> : null}
      </div>
      {error ? <ChartMessage tone="error">{error}</ChartMessage> : null}
      {!error && data.length === 0 && !loading ? (
        <ChartMessage>当前月份暂无排行数据</ChartMessage>
      ) : null}
      {!error && (data.length > 0 || loading) ? (
        <div className="min-h-0 flex-1">
          <ReactECharts
            option={{
          tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" }
          },
          grid: { left: 12, right: 12, top: 12, bottom: 12, containLabel: true },
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
            style={{ width: "100%", height: "100%", minHeight: "260px" }}
          />
        </div>
      ) : null}
    </section>
  );
}

function ChartMessage({
  children,
  tone = "empty"
}: {
  children: React.ReactNode;
  tone?: "empty" | "error";
}) {
  return (
    <div
      className={`flex flex-1 items-center justify-center rounded-md border px-4 text-center text-sm ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-slate-100 bg-slate-50 text-slate-500"
      }`}
    >
      {children}
    </div>
  );
}
