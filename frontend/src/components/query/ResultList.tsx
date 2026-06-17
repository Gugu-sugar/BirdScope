import {
  AlertCircle,
  CalendarDays,
  Loader2,
  MapPin,
  Navigation,
  Users
} from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { useQueryStore } from "../../store/queryStore";
import type { OccurrenceFeature } from "../../types/api";

export function ResultList() {
  const { results, loading, error, selectedGbifId, setSelectedGbifId } =
    useQueryStore();
  const features = results?.features ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fbfdf8]">
      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState message={error} /> : null}
      {!loading && !error && !results ? <EmptyState /> : null}
      {!loading && !error && results && features.length === 0 ? (
        <EmptyState message="当前条件下没有观测记录" />
      ) : null}
      {!loading && !error && features.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-auto bg-[#f2f6f0] p-3">
          <div className="space-y-2.5">
            {features.map((feature) => (
              <ResultItem
                feature={feature}
                key={feature.properties.gbif_id}
                onSelect={() => setSelectedGbifId(feature.properties.gbif_id)}
                selected={feature.properties.gbif_id === selectedGbifId}
              />
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
      <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
      正在查询观测记录
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-4 w-4" />
          查询失败
        </div>
        <p className="mt-1 leading-5">{message}</p>
      </div>
    </div>
  );
}

function EmptyState({ message = "暂无结果" }: { message?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <div>
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md border border-emerald-900/10 bg-white text-emerald-800 shadow-sm">
          <Navigation className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-medium text-slate-700">{message}</p>
        <p className="mt-1 text-xs text-slate-500">
          选择空间范围后执行查询，结果会显示在这里。
        </p>
      </div>
    </div>
  );
}

function ResultItem({
  feature,
  onSelect,
  selected
}: {
  feature: OccurrenceFeature;
  onSelect: () => void;
  selected: boolean;
}) {
  const itemRef = useRef<HTMLElement>(null);
  const { properties, geometry } = feature;
  const speciesName =
    properties.species ?? properties.scientific_name ?? "未命名物种";
  const [lng, lat] = geometry.coordinates;

  useEffect(() => {
    if (selected) {
      itemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selected]);

  return (
    <article
      aria-pressed={selected}
      className={`cursor-pointer rounded-md border p-3 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
        selected
          ? "border-amber-500 bg-amber-50 shadow-md shadow-amber-950/10"
          : "border-emerald-950/10 bg-white hover:border-emerald-800/25 hover:shadow-md"
      }`}
      data-gbif-id={properties.gbif_id}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      ref={itemRef}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-950">
            {speciesName}
          </h3>
          {properties.scientific_name &&
          properties.scientific_name !== speciesName ? (
            <p className="mt-1 truncate text-xs italic text-slate-500">
              {properties.scientific_name}
            </p>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${
            selected
              ? "bg-amber-100 text-amber-900"
              : "bg-emerald-50 text-emerald-800"
          }`}
        >
          #{properties.gbif_id}
        </span>
      </div>

      <dl className="mt-3 grid gap-2 text-xs text-slate-600">
        <MetaRow icon={CalendarDays} label="日期">
          {properties.event_date ?? "日期未知"}
        </MetaRow>
        <MetaRow icon={MapPin} label="地点">
          <span>
            {properties.locality ?? "地点未知"}
            <span className="block text-slate-400">
              {properties.state_province ?? "地区未知"} ·{" "}
              {properties.country_code ?? "国家未知"}
            </span>
          </span>
        </MetaRow>
        <MetaRow icon={Users} label="个体数量">
          {properties.individual_count === null
            ? "数量未知"
            : `${properties.individual_count} 只`}
        </MetaRow>
      </dl>

      <p className="mt-3 rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500">
        {lng.toFixed(4)}, {lat.toFixed(4)}
      </p>
    </article>
  );
}

type MetaRowProps = {
  icon: typeof CalendarDays;
  label: string;
  children: ReactNode;
};

function MetaRow({ icon: Icon, label, children }: MetaRowProps) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 leading-5">{children}</dd>
    </div>
  );
}
