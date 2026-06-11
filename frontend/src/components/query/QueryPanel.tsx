export function QueryPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold">查询条件</h2>
        <p className="mt-1 text-sm text-slate-500">物种、时间和空间范围</p>
      </div>

      <div className="space-y-4 overflow-auto p-4">
        <div>
          <label className="text-sm font-medium text-slate-700">物种搜索</label>
          <div className="mt-2 h-10 rounded border border-slate-200 bg-slate-50" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">月份</label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[8, 9, 10, 11].map((month) => (
              <div
                className="flex h-9 items-center justify-center rounded border border-slate-200 bg-slate-50 text-sm"
                key={month}
              >
                {month} 月
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">空间筛选</label>
          <div className="mt-2 grid gap-2">
            {["矩形框选", "多边形", "缓冲区"].map((mode) => (
              <div
                className="flex h-10 items-center rounded border border-slate-200 bg-slate-50 px-3 text-sm"
                key={mode}
              >
                {mode}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
