import { Loader2, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { publishGeoServerLayer } from "../../api/geoserver";
import { type GridSize, useQueryStore } from "../../store/queryStore";

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

export function PublishLayerDialog({
  open,
  onClose,
  onPublished
}: PublishLayerDialogProps) {
  const { gridSize, month } = useQueryStore();
  const [layerName, setLayerName] = useState("");
  const [styleName, setStyleName] = useState(DEFAULT_STYLE);
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY ?? "");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const cqlFilter = useMemo(
    () => buildCqlFilter(gridSize, month ?? 10),
    [gridSize, month]
  );

  useEffect(() => {
    if (!open) return;
    setLayerName(buildDefaultLayerName(gridSize, month ?? 10));
    setStyleName(DEFAULT_STYLE);
    setError(null);
    setSuccess(null);
  }, [gridSize, month, open]);

  if (!open) return null;

  const handleSubmit = async () => {
    const normalizedLayerName = layerName.trim();
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(normalizedLayerName)) {
      setError("图层名需以字母开头，只能包含字母、数字和下划线。");
      return;
    }

    setPublishing(true);
    setError(null);
    setSuccess(null);

    try {
      await publishGeoServerLayer(
        {
          layer_name: normalizedLayerName,
          table_name: TABLE_NAME,
          style_name: styleName.trim() || undefined,
          cql_filter: cqlFilter
        },
        apiKey.trim() || undefined
      );
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

          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <p className="font-semibold">发布范围</p>
            <p className="mt-1 font-mono text-xs">{cqlFilter}</p>
            <p className="mt-2 text-xs leading-5 text-amber-900">
              当前版本按现成表发布；该表不含物种维度，物种精确查询的物化发布留待后续。
            </p>
          </div>

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

function buildCqlFilter(gridSize: GridSize, month: number) {
  return `grid_size=${formatGridSize(gridSize)} AND year=2024 AND month=${month}`;
}

function buildDefaultLayerName(gridSize: GridSize, month: number) {
  const sizeToken = String(gridSize).replace(".", "_");
  const timestamp =
    new Date().toISOString().match(/\d/g)?.join("").slice(0, 12) ??
    "000000000000";
  return `grid_m${month}_g${sizeToken}_${timestamp}`;
}

function formatGridSize(gridSize: GridSize) {
  return gridSize === 1 ? "1.0" : "0.5";
}
