import {
  CalendarDays,
  CircleDot,
  Eraser,
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
  helper: string;
  Icon: typeof Square;
}> = [
  { mode: "bbox", label: "矩形框选", helper: "区域边界", Icon: Square },
  { mode: "polygon", label: "多边形", helper: "精细范围", Icon: Pentagon },
  { mode: "buffer", label: "缓冲区", helper: "中心半径", Icon: CircleDot }
];

export function QueryPanel() {
  const {
    selectedSpecies,
    setSelectedSpecies,
    queryMonths,
    toggleQueryMonth,
    spatialMode,
    setSpatialMode,
    radiusKm,
    setRadiusKm,
    loading,
    runCurrentQuery,
    clearResults,
    clearSpatialSelection,
    bbox,
    polygon,
    buffer
  } = useQueryStore();
  const [searchText, setSearchText] = useState("");
  const [speciesOptions, setSpeciesOptions] = useState<SpeciesItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const canClearSpecies = Boolean(selectedSpecies || searchText);
  const hasSpatialSelection = Boolean(bbox || polygon || buffer);

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
            setSpeciesOptions(data);
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
    <div className="flex h-full min-h-0 flex-col bg-[#fbfdf8]">
      <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4">
        <section className="field-group">
          <label
            className="field-label"
            htmlFor="species-search"
          >
            <span className="field-icon text-emerald-800">
              <Search className="h-4 w-4" />
            </span>
            物种搜索
          </label>
          <div className="relative mt-2">
            <input
              className="control-input pr-16"
              id="species-search"
              onChange={(event) => {
                setSearchText(event.target.value);
                setSelectedSpecies(null);
              }}
              placeholder="输入中文名、拉丁名或科学名"
              value={searchText}
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
              ) : null}
              {canClearSpecies ? (
                <button
                  className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
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
            <p className="mt-2 rounded-md border border-emerald-900/10 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
              当前物种：{selectedLabel}
            </p>
          ) : null}
          {searchError ? (
            <p className="mt-2 text-xs font-medium text-red-600">
              {searchError}
            </p>
          ) : null}
          {speciesOptions.length > 0 ? (
            <div className="mt-2 max-h-56 overflow-auto rounded-md border border-emerald-950/10 bg-white shadow-lg shadow-emerald-950/5">
              {speciesOptions.map((species) => (
                <button
                  className="block w-full border-b border-slate-100 px-3 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-emerald-50"
                  key={species.species_key}
                  onClick={() => handleSelectSpecies(species)}
                  type="button"
                >
                  <span className="block font-semibold text-slate-900">
                    {species.display_name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {species.family ?? "未知科"} · {species.record_count} 条记录
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="field-group">
          <label className="field-label">
            <span className="field-icon text-amber-800">
              <CalendarDays className="h-4 w-4" />
            </span>
            迁徙月份
          </label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {MONTHS.map((option) => (
              <button
                className={`month-button ${
                  queryMonths.includes(option)
                    ? "border-amber-500 bg-amber-100 text-amber-950 shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50"
                }`}
                key={option}
                onClick={() => toggleQueryMonth(option)}
                type="button"
              >
                <span className="text-base font-semibold">{option}</span>
                <span className="text-[10px] uppercase">月</span>
              </button>
            ))}
          </div>
        </section>

        <section className="field-group">
          <label className="field-label">
            <span className="field-icon text-cyan-800">
              <MapPin className="h-4 w-4" />
            </span>
            空间筛选
          </label>
          <div className="mt-2 grid gap-2">
            {SPATIAL_OPTIONS.map(({ mode, label, helper, Icon }) => (
              <button
                className={`mode-button ${
                  spatialMode === mode
                    ? "border-cyan-600 bg-cyan-50 text-cyan-950 shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50"
                }`}
                key={mode}
                onClick={() => setSpatialMode(mode)}
                type="button"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs text-slate-500">{helper}</span>
                </span>
              </button>
            ))}
          </div>
          {hasSpatialSelection ? (
            <button
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              onClick={clearSpatialSelection}
              title="清空当前选区与查询结果"
              type="button"
            >
              <Eraser className="h-4 w-4" />
              清空选区
            </button>
          ) : null}
        </section>

        {spatialMode === "buffer" ? (
          <section className="field-group">
            <label
              className="field-label"
              htmlFor="radius-km"
            >
              缓冲半径（公里）
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                className="control-input"
                id="radius-km"
                max={500}
                min={1}
                onChange={(event) => setRadiusKm(Number(event.target.value))}
                type="number"
                value={radiusKm}
              />
              <span className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600">
                km
              </span>
            </div>
          </section>
        ) : null}
      </div>

      <div className="border-t border-emerald-950/10 bg-white/70 p-4">
        <button
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#123b3f] px-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/15 transition hover:bg-[#0b2b2e] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
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
