import { Loader2, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  publishGeoServerLayer,
  publishSpeciesGridLayer
} from "../../api/geoserver";
import { type GridSize, useQueryStore } from "../../store/queryStore";
import type { SpeciesItem } from "../../types/api";

type PublishLayerDialogProps = {
  open: boolean;
  onClose: () => void;
  onPublished: () => void;
};

const DEFAULT_API_KEY = import.meta.env.VITE_GEOSERVER_API_KEY as
  | string
  | undefined;

const TABLE_NAME = "occurrence_grid_monthly";
const DEFAULT_STYLE = "grid_heatmap";

/** 数据源：预聚合全物种（快、不含物种维度） vs 实时聚合当前物种。 */
type PublishMode = "preaggregated" | "species";

export function PublishLayerDialog({
  open,
  onClose,
  onPublished
}: PublishLayerDialogProps) {
  const { gridSize, month, selectedSpecies } = useQueryStore();
  const [mode, setMode] = useState<PublishMode>("preaggregated");
  const [layerName, setLayerName] = useState("");
  const [styleName, setStyleName] = useState(DEFAULT_STYLE);
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY ?? "");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasSpecies = selectedSpecies !== null;
  const cqlFilter = useMemo(
    () => buildCqlFilter(gridSize, month),
    [gridSize, month]
  );

  // 打开弹窗时按当前选择初始化：选了物种则默认实时聚合模式。
  useEffect(() => {
    if (!open) return;
    const nextMode: PublishMode = hasSpecies ? "species" : "preaggregated";
    setMode(nextMode);
    setStyleName(DEFAULT_STYLE);
    setError(null);
    setSuccess(null);
  }, [open, hasSpecies]);

  // 模式 / 查询条件变化时刷新默认图层名（用户手动改过后由输入框接管）。
  useEffect(() => {
    if (!open) return;
    setLayerName(
      buildDefaultLayerName(
        mode,
        gridSize,
        month,
        mode === "species" ? selectedSpecies?.species_key : undefined
      )
    );
  }, [open, mode, gridSize, month, selectedSpecies]);

  if (!open) return null;

  const handleSubmit = async () => {
    const normalizedLayerName = layerName.trim();
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(normalizedLayerName)) {
      setError("图层名需以字母开头，只能包含字母、数字和下划线。");
      return;
    }
    if (mode === "species" && !selectedSpecies) {
      setError("实时聚合模式需先在查询面板选择物种。");
      return;
    }
    // HTTP 头只接受 Latin-1；粘贴 Key 时易混入全角空格/BOM 等非 ASCII 字符，
    // 否则 fetch 会抛 "String contains non ISO-8859-1 code point"。提前拦下给出可读提示。
    const trimmedKey = apiKey.trim();
    if (trimmedKey && !/^[\x20-\x7E]+$/.test(trimmedKey)) {
      setError("X-API-Key 含非 ASCII 字符（可能是粘贴时混入的空格/不可见字符），请重新输入。");
      return;
    }

    setPublishing(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === "species" && selectedSpecies) {
        await publishSpeciesGridLayer(
          {
            layer_name: normalizedLayerName,
            species_key: selectedSpecies.species_key,
            grid_size: gridSize,
            month: month ?? undefined,
            year: 2024,
            style_name: styleName.trim() || undefined
          },
          trimmedKey || undefined
        );
      } else {
        await publishGeoServerLayer(
          {
            layer_name: normalizedLayerName,
            table_name: TABLE_NAME,
            style_name: styleName.trim() || undefined,
            cql_filter: cqlFilter
          },
          trimmedKey || undefined
        );
      }
      setSuccess(`已发布 ${normalizedLayerName}`);
      onPublished();
    } catch (error) {
      setError(error instanceof Error ? error.message : "图层发布失败");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-md border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="section-kicker">GeoServer Publish</p>
            <h2 className="text-lg font-semibold text-slate-950">
              发布当前图层
            </h2>
          </div>
          <button
            className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <span className="text-sm font-semibold text-slate-800">数据源</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ModeButton
                active={mode === "preaggregated"}
                onClick={() => setMode("preaggregated")}
                title="预聚合 · 全物种"
                subtitle="快，按现成网格表发布"
              />
              <ModeButton
                active={mode === "species"}
                disabled={!hasSpecies}
                onClick={() => hasSpecies && setMode("species")}
                title="实时聚合 · 当前物种"
                subtitle={
                  hasSpecies ? "按所选物种聚合" : "请先在查询面板选择物种"
                }
              />
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-slate-800">
              图层名
            </span>
            <input
              className="control-input mt-2"
              onChange={(event) => setLayerName(event.target.value)}
              value={layerName}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-800">
              样式名
            </span>
            <input
              className="control-input mt-2"
              onChange={(event) => setStyleName(event.target.value)}
              value={styleName}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-800">
              X-API-Key
            </span>
            <input
              className="control-input mt-2"
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="后端未配置 GEOSERVER_API_KEY 时可留空"
              type="password"
              value={apiKey}
            />
          </label>

          <PublishSummary
            mode={mode}
            species={selectedSpecies}
            month={month}
            gridSize={gridSize}
            cqlFilter={cqlFilter}
          />

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {success}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            关闭
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-[#123b3f] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-950/15 transition hover:bg-[#0b2b2e] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            disabled={publishing}
            onClick={() => void handleSubmit()}
            type="button"
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            发布
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  title,
  subtitle
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      className={`rounded-md border px-3 py-2 text-left transition ${
        active
          ? "border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
      } ${disabled ? "cursor-not-allowed opacity-50 hover:border-slate-200 hover:bg-white" : ""}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="block text-sm font-semibold">{title}</span>
      <span className="mt-0.5 block text-xs text-slate-500">{subtitle}</span>
    </button>
  );
}

function PublishSummary({
  mode,
  species,
  month,
  gridSize,
  cqlFilter
}: {
  mode: PublishMode;
  species: SpeciesItem | null;
  month: number | null;
  gridSize: GridSize;
  cqlFilter: string;
}) {
  const monthText = month !== null ? `${month} 月` : "全年（所有月份）";
  return (
    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <p className="font-semibold">发布参数</p>
      <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
        <span className="text-amber-700">物种</span>
        <span className="font-medium">
          {mode === "species" && species
            ? species.display_name
            : "全部物种（预聚合层不含物种维度）"}
        </span>
        <span className="text-amber-700">月份</span>
        <span className="font-medium">{monthText}</span>
        <span className="text-amber-700">粒度</span>
        <span className="font-medium">{gridSize}°</span>
        {mode === "preaggregated" ? (
          <>
            <span className="text-amber-700">过滤器</span>
            <span className="font-mono">{cqlFilter}</span>
          </>
        ) : (
          <>
            <span className="text-amber-700">数据源</span>
            <span className="font-medium">
              occurrence_clean 实时聚合（首次渲染稍慢）
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function buildCqlFilter(gridSize: GridSize, month: number | null) {
  const parts = [`grid_size=${gridSize}`, `year=2024`];
  if (month !== null) {
    parts.push(`month=${month}`);
  }
  return parts.join(" AND ");
}

function buildDefaultLayerName(
  mode: PublishMode,
  gridSize: GridSize,
  month: number | null,
  speciesKey?: number
) {
  const sizeToken = String(gridSize).replace(".", "_");
  const monthToken = month !== null ? `m${month}` : "mall";
  const spToken =
    mode === "species" && speciesKey !== undefined ? `sp${speciesKey}_` : "";
  const timestamp = new Date()
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replaceAll(".", "")
    .replace("T", "")
    .replace("Z", "")
    .slice(0, 12);
  return `grid_${spToken}${monthToken}_g${sizeToken}_${timestamp}`;
}
