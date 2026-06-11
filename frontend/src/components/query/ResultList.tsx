import { AlertCircle, CalendarDays, Loader2, MapPin, Users } from "lucide-react";
import { useQueryStore } from "../../store/queryStore";
import type { OccurrenceFeature } from "../../types/api";

export function ResultList() {
  const { results, loading, error } = useQueryStore();
  const features = results?.features ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">查询结果</h2>
            <p className="mt-1 text-sm text-slate-500">
              {results ? `${results.total} 条观测记录` : "等待查询条件"}
            </p>
          </div>
        </div>
      </div>

      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState message={error} /> : null}
      {!loading && !error && !results ? <EmptyState /> : null}
      {!loading && !error && results && features.length === 0 ? (
        <EmptyState message="当前条件下没有观测记录" />
      ) : null}
      {!loading && !error && features.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div className="space-y-2">
            {features.map((feature) => (
              <ResultItem feature={feature} key={feature.properties.gbif_id} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 p-6 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      正在查询
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle className="h-4 w-4" />
          查询失败
        </div>
        <p className="mt-1">{message}</p>
      </div>
    </div>
  );
}

function EmptyState({ message = "暂无结果" }: { message?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function ResultItem({ feature }: { feature: OccurrenceFeature }) {
  const { properties, geometry } = feature;
  const speciesName =
    properties.species ?? properties.scientific_name ?? "未命名物种";
  const [lng, lat] = geometry.coordinates;

  return (
    <article className="rounded border border-slate-200 bg-white p-3 shadow-sm">
      <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">
        {speciesName}
      </h3>
      {properties.scientific_name &&
      properties.scientific_name !== speciesName ? (
        <p className="mt-1 truncate text-xs italic text-slate-500">
          {properties.scientific_name}
        </p>
      ) : null}

      <dl className="mt-3 grid gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
          <dt className="sr-only">日期</dt>
          <dd>{properties.event_date ?? "日期未知"}</dd>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 text-slate-400" />
          <dt className="sr-only">地点</dt>
          <dd>
            {properties.locality ?? "地点未知"}
            <span className="block text-slate-400">
              {properties.state_province ?? "地区未知"} ·{" "}
              {properties.country_code ?? "国家未知"}
            </span>
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-slate-400" />
          <dt className="sr-only">个体数量</dt>
          <dd>
            {properties.individual_count === null
              ? "数量未知"
              : `${properties.individual_count} 只`}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-[11px] text-slate-400">
        {lng.toFixed(4)}, {lat.toFixed(4)}
      </p>
    </article>
  );
}
