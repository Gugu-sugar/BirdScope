import { Play, Pause, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const MONTHS = [8, 9, 10, 11];

type TimeSliderProps = {
  month: number | null;
  setMonth: (month: number) => void;
  onPlayChange?: (playing: boolean) => void;
};

export function TimeSlider({ month, setMonth, onPlayChange }: TimeSliderProps) {
  const [playing, setPlaying] = useState(false);

  const currentIndex = useMemo(
    () => (month === null ? 0 : MONTHS.indexOf(month)),
    [month]
  );

  useEffect(() => {
    if (!playing) {
      return;
    }

    const timer = window.setInterval(() => {
      const index = MONTHS.indexOf(month ?? MONTHS[0]);
      const nextIndex = (index + 1) % MONTHS.length;
      setMonth(MONTHS[nextIndex]);
    }, 1600);

    return () => window.clearInterval(timer);
  }, [playing, month, setMonth]);

  useEffect(() => {
    onPlayChange?.(playing);
  }, [playing, onPlayChange]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            时空动态
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {month ? `${month} 月观测分布` : "请选择月份"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="map-action bg-emerald-600 hover:bg-emerald-700"
            type="button"
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            className="map-action bg-slate-800 hover:bg-slate-900"
            type="button"
            onClick={() => {
              setPlaying(false);
              setMonth(MONTHS[0]);
            }}
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>开始</span>
          <span>结束</span>
        </div>
        <div className="h-2 rounded-full bg-slate-200">
          <div
            className="h-2 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${((currentIndex + 1) / MONTHS.length) * 100}%` }}
          />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-[11px] text-slate-600">
          {MONTHS.map((option) => (
            <button
              key={option}
              className={`rounded-full py-2 transition ${
                month === option
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-slate-50 hover:bg-slate-100"
              }`}
              type="button"
              onClick={() => {
                setMonth(option);
                setPlaying(false);
              }}
            >
              {option} 月
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
