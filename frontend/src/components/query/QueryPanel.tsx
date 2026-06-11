import {
  CalendarDays,
  CircleDot,
  Loader2,
  MapPin,
  Pentagon,
  Play,
  Search,
  Square,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { searchSpecies } from "../../api/species";
import { useQueryStore } from "../../store/queryStore";
import type { SpeciesItem } from "../../types/api";
import type { SpatialMode } from "../../types/geo";

const MONTHS = [8, 9, 10, 11];

const SPATIAL_OPTIONS: Array<{
  mode: SpatialMode;
  label: string;
  Icon: typeof Square;
}> = [
  { mode: "bbox", label: "矩形框选", Icon: Square },
  { mode: "polygon", label: "多边形", Icon: Pentagon },
  { mode: "buffer", label: "缓冲区", Icon: CircleDot }
];

export function QueryPanel() {
  const {
    selectedSpecies,
    setSelectedSpecies,
    month,
    setMonth,
    spatialMode,
    setSpatialMode,
    radiusKm,
    setRadiusKm,
    loading,
    runCurrentQuery,
    clearResults
  } = useQueryStore();
  const [searchText, setSearchText] = useState("");
  const [speciesOptions, setSpeciesOptions] = useState<SpeciesItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const canClearSpecies = Boolean(selectedSpecies || searchText);

  useEffect(() => {
    const keyword = searchText.trim();
    if (keyword.length < 2) {
      setSpeciesOptions([]);
      setSearchError(null);
      return;
    }

    let active = true;
    setSearching(true);
    setSearchError(null);

    const timer = window.setTimeout(() => {
      searchSpecies(keyword, 8)
        .then((data) => {
          if (active) {
            setSpeciesOptions(data.results);
          }
        })
        .catch((error) => {
          if (active) {
            setSpeciesOptions([]);
            setSearchError(
              error instanceof Error ? error.message : "物种搜索失败"
            );
          }
        })
        .finally(() => {
          if (active) {
            setSearching(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchText]);

  const selectedLabel = useMemo(
    () => selectedSpecies?.display_name ?? selectedSpecies?.scientific_name,
    [selectedSpecies]
  );

  const handleSelectSpecies = (species: SpeciesItem) => {
    setSelectedSpecies(species);
    setSearchText(species.display_name);
    setSpeciesOptions([]);
  };

  const handleClearSpecies = () => {
    setSelectedSpecies(null);
    setSearchText("");
    setSpeciesOptions([]);
    clearResults();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200 bg-[#fbfcfa] px-4 py-3">
        <h2 className="text-base font-semibold tracking-tight">查询条件</h2>
        <p className="mt-1 text-sm text-slate-500">组合筛选</p>
      </div>

      <div className="space-y-5 overflow-auto p-4">
        <section>
          <label
            className="flex items-center gap-2 text-sm font-medium text-slate-800"
            htmlFor="species-search"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded border border-teal-200 bg-teal-50 text-teal-800">
              <Search className="h-4 w-4" />
            </span>
            物种搜索
          </label>
          <div className="relative mt-2">
            <input
              className="h-10 w-full rounded border border-slate-300 bg-white px-3 pr-16 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              id="species-search"
              onChange={(event) => {
                setSearchText(event.target.value);
                setSelectedSpecies(null);
              }}
              placeholder="输入拉丁名或科学名"
              value={searchText}
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : null}
              {canClearSpecies ? (
                <button
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  onClick={handleClearSpecies}
                  title="清空物种"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
          {selectedLabel ? (
            <p className="mt-2 rounded border border-teal-200 bg-teal-50 px-2 py-1 text-xs text-teal-800">
              当前物种：{selectedLabel}
            </p>
          ) : null}
          {searchError ? (
            <p className="mt-2 text-xs text-red-600">{searchError}</p>
          ) : null}
          {speciesOptions.length > 0 ? (
            <div className="mt-2 max-h-48 overflow-auto rounded border border-slate-200 bg-white shadow-sm">
              {speciesOptions.map((species) => (
                <button
                  className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm transition hover:bg-teal-50/60"
                  key={species.species_key}
                  onClick={() => handleSelectSpecies(species)}
                  type="button"
                >
                  <span className="block font-medium text-slate-800">
                    {species.display_name}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {species.family ?? "未知科"} · {species.record_count} 条记录
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </section>
        <section>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <span className="flex h-7 w-7 items-center justify-center rounded border border-amber-200 bg-amber-50 text-amber-800">
              <CalendarDays className="h-4 w-4" />
            </span>
            月份
          </label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {MONTHS.map((option) => (
              <button
                className={`flex h-9 items-center justify-center rounded border text-sm transition ${
                  month === option
                    ? "border-amber-500 bg-amber-50 text-amber-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-amber-50/60"
                }`}
                key={option}
                onClick={() => setMonth(option)}
                type="button"
              >
                {option} 月
              </button>
            ))}
          </div>
        </section>
        <section>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <span className="flex h-7 w-7 items-center justify-center rounded border border-cyan-200 bg-cyan-50 text-cyan-800">
              <MapPin className="h-4 w-4" />
            </span>
            空间筛选
          </label>
          <div className="mt-2 grid gap-2">
            {SPATIAL_OPTIONS.map(({ mode, label, Icon }) => (
              <button
                className={`flex h-10 items-center gap-2 rounded border px-3 text-sm transition ${
                  spatialMode === mode
                    ? "border-cyan-600 bg-cyan-50 text-cyan-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-cyan-50/60"
                }`}
                key={mode}
                onClick={() => setSpatialMode(mode)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </section>
        {spatialMode === "buffer" ? (
          <section>
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="radius-km"
            >
              缓冲半径（公里）
            </label>
            <input
              className="mt-2 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              id="radius-km"
              max={500}
              min={1}
              onChange={(event) => setRadiusKm(Number(event.target.value))}
              type="number"
              value={radiusKm}
            />
          </section>
        ) : null}
        <button
          className="flex h-10 w-full items-center justify-center gap-2 rounded bg-[#123b3f] px-3 text-sm font-medium text-white transition hover:bg-[#0b2b2e] disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={loading}
          onClick={() => void runCurrentQuery()}
          title="执行当前查询条件"
          type="button"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          执行查询
        </button>
      </div>
    </div>
  );
}
