export function ResultList() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold">查询结果</h2>
        <p className="mt-1 text-sm text-slate-500">等待选择范围后显示观测记录</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">
        暂无结果
      </div>
    </div>
  );
}
