export default function App() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
        <section className="w-full max-w-2xl rounded border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase text-emerald-700">
            BirdScope
          </p>
          <h1 className="mt-2 text-3xl font-semibold">前端查询工作台</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            React、Tailwind 和 TypeScript 已接入，后续模块会在这里扩展查询面板、结果列表和地图联动。
          </p>
        </section>
      </div>
    </main>
  );
}
