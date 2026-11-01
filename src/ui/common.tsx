import { ReactNode, useEffect, useRef } from "react";
import { CHARS, tr } from "../game/data";
import { portraits } from "../game/snap";
import { audio } from "../game/audio";

export const click = () => audio.sfx("click");

export function Btn({ children, onClick, color = "#ff4fa0", text = "#fff", disabled, className = "", big, small, sound = "click" }: {
  children: ReactNode; onClick?: () => void; color?: string; text?: string; disabled?: boolean; className?: string; big?: boolean; small?: boolean; sound?: string;
}) {
  return (
    <button
      disabled={disabled}
      className={`btn-chunk ${big ? "px-8 py-4 text-2xl" : small ? "px-3 py-1.5 text-sm" : "px-5 py-2.5 text-lg"} ${className}`}
      style={{ background: color, color: text }}
      onMouseEnter={() => audio.sfx("hover")}
      onClick={(e) => { audio.init(); audio.sfx(sound); (e.currentTarget as HTMLElement).blur(); onClick?.(); }}
    >
      {children}
    </button>
  );
}

export function Portrait({ id, size = 64, className = "", ring }: { id: number; size?: number; className?: string; ring?: string }) {
  const c = CHARS[id];
  return (
    <div
      className={`relative overflow-hidden shrink-0 ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.22, background: `radial-gradient(circle at 50% 30%, ${c.css}, ${c.css2})`, border: `3px solid ${ring || "#1d0f45"}` }}
    >
      {portraits[id] && <img src={portraits[id]} alt={c.name} draggable={false} className="w-full h-full object-cover" />}
    </div>
  );
}

export function Screen({ title, onBack, children, right, wide }: { title: string; onBack?: () => void; children: ReactNode; right?: ReactNode; wide?: boolean }) {
  useKey((e) => { if ((e.code === "Escape" || e.code === "Backspace") && onBack && !(e.target instanceof HTMLInputElement)) { audio.sfx("back"); onBack(); } });
  return (
    <div className="absolute inset-0 bg-candy bg-grid overflow-hidden flex flex-col fade-in">
      <div className="relative z-10 flex items-center gap-3 px-5 py-3">
        {onBack && <Btn onClick={onBack} color="#ffd24a" text="#1d0f45" sound="back">◀ {tr("返回", "Back")}</Btn>}
        <h1 className="text-3xl font-black text-white tracking-wider" style={{ textShadow: "0 3px 0 #1d0f45" }}>{title}</h1>
        <div className="ml-auto">{right}</div>
      </div>
      <div className={`relative z-10 flex-1 min-h-0 overflow-auto px-5 pb-5 ${wide ? "" : "mx-auto w-full max-w-6xl"}`}>{children}</div>
    </div>
  );
}

export function useKey(fn: (e: KeyboardEvent) => void) {
  const r = useRef(fn);
  r.current = fn;
  useEffect(() => {
    const h = (e: KeyboardEvent) => r.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
}

export function Pips({ v, max = 5, color }: { v: number; max?: number; color: string }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <div key={i} className="h-3 w-6 rounded-sm border-2 border-[#1d0f45]" style={{ background: i < v ? color : "rgba(255,255,255,.15)" }} />
      ))}
    </div>
  );
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 bg-black/30 p-1 rounded-xl">
      {options.map((o) => (
        <button key={String(o.v)} onMouseEnter={() => audio.sfx("hover")} onClick={() => { audio.sfx("click"); onChange(o.v); }}
          className={`px-3 py-1.5 rounded-lg font-bold text-sm transition ${o.v === value ? "bg-[#ffd24a] text-[#1d0f45] shadow" : "text-white/80 hover:bg-white/10"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-white/10">
      <div><div className="font-bold text-white">{label}</div>{hint && <div className="text-xs text-white/60">{hint}</div>}</div>
      <div>{children}</div>
    </div>
  );
}

export function Slider({ value, min = 0, max = 1, step = 0.01, onChange, fmt }: { value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <div className="flex items-center gap-3">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} onMouseUp={() => audio.sfx("hover")} className="w-48" />
      <span className="w-14 text-right text-white font-bold tabular-nums">{fmt ? fmt(value) : Math.round(value * 100) + "%"}</span>
    </div>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => { audio.sfx("click"); onChange(!value); }} className={`w-16 h-8 rounded-full border-[3px] border-[#1d0f45] relative transition ${value ? "bg-[#4ade80]" : "bg-gray-500"}`}>
      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: value ? 34 : 3 }} />
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <div className={`spin w-8 h-8 rounded-full border-4 border-white/30 border-t-white ${className}`} />;
}
