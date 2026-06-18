import { Pause, Play, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";

const MONTHS = [8, 9, 10, 11];

type TimeSliderProps = {
  month: number | null;
  setMonth: (month: number) => void;
  onPlayChange?: (playing: boolean) => void;
};

export function TimeSlider({ month, setMonth, onPlayChange }: TimeSliderProps) {
  const [playing, setPlaying] = useState(false);

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
    <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
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

      <div className="mt-4 space-y-2">
        <input
          aria-label="选择显示月份"
          className="w-full cursor-pointer accent-emerald-600"
          type="range"
          min={MONTHS[0]}
          max={MONTHS[MONTHS.length - 1]}
          step={1}
          value={month ?? MONTHS[0]}
          onChange={(event) => {
            setMonth(Number(event.target.value));
            setPlaying(false);
          }}
        />
        <div className="flex justify-between px-0.5 text-[11px] font-medium text-slate-500">
          {MONTHS.map((option) => (
            <span
              key={option}
              className={
                month === option ? "text-emerald-700" : undefined
              }
            >
              {option} 月
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
