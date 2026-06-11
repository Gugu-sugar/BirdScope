export function MapPanel() {
  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold">地图区域</h2>
        <p className="mt-1 text-sm text-slate-500">Cesium 主场景接入位置</p>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-900">
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(#334155_1px,transparent_1px),linear-gradient(90deg,#334155_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative rounded border border-slate-600 bg-slate-950 px-4 py-3 text-sm text-slate-200 shadow-sm">
          等待 2 号同学接入 Cesium 地图
        </div>
      </div>
    </div>
  );
}
