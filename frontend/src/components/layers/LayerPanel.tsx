import {
  CircleDot,
  Eye,
  EyeOff,
  Globe2,
  Grid2X2,
  Loader2,
  Lock,
  Map,
  Mountain,
  RefreshCw,
  Satellite,
  Trash2
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  deleteGeoServerLayer,
  listGeoServerLayers,
  type GeoServerLayer
} from "../../api/geoserver";
import {
  type BasemapKey,
  type GridSize,
  type LayerVisibility,
  useQueryStore
} from "../../store/queryStore";

type LayerPanelProps = {
  refreshToken: number;
};

// 默认月度聚合层，受保护：不可删除，且只通过「全球 WMS」开关（带动态 CQL）显示，
// 不在已发布列表里提供静态叠加开关（静态叠加不带 CQL 会令各月份/粒度重影）。
const PROTECTED_LAYER = "occurrence_grid_monthly";

const BASEMAP_OPTIONS: Array<{
  key: BasemapKey;
  label: string;
  helper: string;
  Icon: typeof Map;
}> = [
  { key: "street", label: "街道", helper: "天地图矢量", Icon: Map },
  {
    key: "imagery",
    label: "影像",
    helper: "天地图影像",
    Icon: Satellite
  },
  { key: "terrain", label: "地形", helper: "天地图地形", Icon: Mountain }
];

const LAYER_OPTIONS: Array<{
  key: keyof LayerVisibility;
  label: string;
  helper: string;
  Icon: typeof CircleDot;
}> = [
  { key: "points", label: "矢量点位", helper: "当前查询观测点", Icon: CircleDot },
  {
    key: "grid",
    label: "联动热力网格",
    helper: "按当前范围请求 /stats/grid",
    Icon: Grid2X2
  },
  {
    key: "globalWms",
    label: "全球 WMS",
    helper: "occurrence_grid_monthly",
    Icon: Globe2
  }
];

const GRID_SIZE_OPTIONS: GridSize[] = [1, 0.5];

export function LayerPanel({ refreshToken }: LayerPanelProps) {
  const {
    basemap,
    gridSize,
    layerVisibility,
    displayedLayers,
    setBasemap,
    setGridSize,
    setLayerVisibility,
    togglePublishedLayer,
    removePublishedLayer
  } = useQueryStore();
  const [layers, setLayers] = useState<GeoServerLayer[]>([]);
  const [loadingLayers, setLoadingLayers] = useState(false);
  const [layersError, setLayersError] = useState<string | null>(null);
  const [deletingLayer, setDeletingLayer] = useState<string | null>(null);

  const loadLayers = () => {
    setLoadingLayers(true);
    setLayersError(null);
    listGeoServerLayers()
      .then(setLayers)
      .catch((error) => {
        setLayers([]);
        setLayersError(
          error instanceof Error ? error.message : "已发布图层加载失败"
        );
      })
      .finally(() => setLoadingLayers(false));
  };

  useEffect(() => {
    loadLayers();
  }, [refreshToken]);

  const handleDelete = (name: string) => {
    if (name === PROTECTED_LAYER) return;
    if (!window.confirm(`确认删除已发布图层「${name}」？该操作不可撤销。`)) {
      return;
    }
    setDeletingLayer(name);
    setLayersError(null);
    deleteGeoServerLayer(name)
      .then(() => {
        removePublishedLayer(name);
        loadLayers();
      })
      .catch((error) => {
        setLayersError(
          error instanceof Error ? error.message : `删除图层 ${name} 失败`
        );
      })
      .finally(() => setDeletingLayer(null));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fbfdf8]">
      <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4">
        <section>
          <h3 className="text-sm font-semibold text-slate-900">底图</h3>
          <div className="mt-2 grid gap-2">
            {BASEMAP_OPTIONS.map(({ key, label, helper, Icon }) => (
              <button
                className={`mode-button ${
                  basemap === key
                    ? "border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                }`}
                key={key}
                onClick={() => setBasemap(key)}
                type="button"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block font-medium">{label}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {helper}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-900">显示图层</h3>
          <div className="mt-2 grid gap-2">
            {LAYER_OPTIONS.map(({ key, label, helper, Icon }) => (
              <label
                className="flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                key={key}
              >
                <Icon className="h-4 w-4 shrink-0 text-emerald-800" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-900">
                    {label}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {helper}
                  </span>
                </span>
                <input
                  checked={layerVisibility[key]}
                  className="h-4 w-4 accent-emerald-700"
                  onChange={(event) =>
                    setLayerVisibility(key, event.target.checked)
                  }
                  type="checkbox"
                />
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-900">网格粒度</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {GRID_SIZE_OPTIONS.map((option) => (
              <button
                className={`month-button ${
                  gridSize === option
                    ? "border-amber-500 bg-amber-100 text-amber-950 shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50"
                }`}
                key={option}
                onClick={() => setGridSize(option)}
                type="button"
              >
                <span className="text-base font-semibold">{option}</span>
                <span className="text-[10px] uppercase">度</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">
              已发布图层
            </h3>
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
              disabled={loadingLayers}
              onClick={loadLayers}
              type="button"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingLayers ? "animate-spin" : ""}`}
              />
              刷新
            </button>
          </div>

          <div className="mt-2 rounded-md border border-slate-200 bg-white">
            {layersError ? (
              <p className="px-3 py-3 text-sm text-red-600">{layersError}</p>
            ) : loadingLayers ? (
              <p className="px-3 py-3 text-sm text-slate-500">
                正在读取 GeoServer 图层
              </p>
            ) : layers.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-500">
                暂无已发布图层
              </p>
            ) : (
              <div className="max-h-64 overflow-auto">
                {layers.map((layer) => {
                  const isProtected = layer.name === PROTECTED_LAYER;
                  const isShown = displayedLayers.includes(layer.name);
                  const isDeleting = deletingLayer === layer.name;
                  return (
                    <div
                      className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm last:border-b-0"
                      key={layer.name}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">
                          {layer.name}
                        </p>
                        {isProtected ? (
                          <p className="mt-0.5 text-xs text-slate-500">
                            默认层 · 由上方「全球 WMS」开关控制显示
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {isShown ? "已叠加到地图" : "未显示"}
                          </p>
                        )}
                      </div>

                      {isProtected ? (
                        <span
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-400"
                          title="默认层受保护，不可删除"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          默认
                        </span>
                      ) : (
                        <>
                          <button
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
                              isShown
                                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:bg-emerald-50"
                            }`}
                            onClick={() => togglePublishedLayer(layer.name)}
                            title={isShown ? "从地图隐藏" : "在地图显示"}
                            type="button"
                          >
                            {isShown ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isDeleting}
                            onClick={() => handleDelete(layer.name)}
                            title="删除图层"
                            type="button"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
