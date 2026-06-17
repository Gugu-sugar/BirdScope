import {
  CircleDot,
  Globe2,
  Grid2X2,
  Layers3,
  Map,
  Mountain,
  RefreshCw,
  Satellite
} from "lucide-react";
import { useEffect, useState } from "react";
import { listGeoServerLayers, type GeoServerLayer } from "../../api/geoserver";
import {
  type BasemapKey,
  type GridSize,
  type LayerVisibility,
  useQueryStore
} from "../../store/queryStore";

type LayerPanelProps = {
  refreshToken: number;
};

const BASEMAP_OPTIONS: Array<{
  key: BasemapKey;
  label: string;
  helper: string;
  Icon: typeof Map;
}> = [
  { key: "street", label: "街道", helper: "OpenStreetMap", Icon: Map },
  {
    key: "imagery",
    label: "影像",
    helper: "ArcGIS World Imagery",
    Icon: Satellite
  },
  { key: "terrain", label: "地形", helper: "ArcGIS Topographic", Icon: Mountain }
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
    setBasemap,
    setGridSize,
    setLayerVisibility
  } = useQueryStore();
  const [layers, setLayers] = useState<GeoServerLayer[]>([]);
  const [loadingLayers, setLoadingLayers] = useState(false);
  const [layersError, setLayersError] = useState<string | null>(null);

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

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fbfdf8]">
      <div className="panel-header">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Layer Control</p>
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">
              图层管理
            </h2>
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-emerald-900/10 bg-emerald-50 text-emerald-800">
            <Layers3 className="h-4 w-4" />
          </span>
        </div>
      </div>

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
                {layers.map((layer) => (
                  <div
                    className="border-b border-slate-100 px-3 py-2.5 text-sm last:border-b-0"
                    key={layer.name}
                  >
                    <p className="font-semibold text-slate-900">
                      {layer.name}
                    </p>
                    {layer.href ? (
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {layer.href}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
