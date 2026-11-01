import { useEffect, useState } from "react";
import { ARENAS, CHARS, MOVE_ORDER, tr, keyLabel, ACTION_LABEL } from "../game/data";
import { audio } from "../game/audio";
import { thumbs } from "../game/snap";
import { getSettings } from "../game/store";
import { CharViewer, Cmd } from "./views3d";
import { Btn, Pips, Portrait, Screen, useKey } from "./common";

export function CharInfo({ id, compact }: { id: number; compact?: boolean }) {
  const c = CHARS[id];
  const keys = getSettings().keys;
  const stats: [string, number][] = [
    [tr("力量", "Power"), c.stats.power], [tr("速度", "Speed"), c.stats.speed], [tr("重量", "Weight"), c.stats.weight],
    [tr("射程", "Range"), c.stats.range], [tr("技巧", "Tech"), c.stats.tech],
  ];
  return (
    <div className="flex flex-col gap-3 text-white">
      <div>
        <div className="text-4xl font-black" style={{ color: c.css, textShadow: "0 3px 0 #1d0f45" }}>{tr(c.name, c.en)}</div>
        <div className="inline-block mt-1 px-3 py-1 rounded-full text-sm font-bold text-[#1d0f45]" style={{ background: c.css }}>{tr(c.role[0], c.role[1])}</div>
      </div>
      {!compact && <p className="text-sm leading-relaxed text-white/85">{tr(c.desc[0], c.desc[1])}</p>}
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-center">
        {stats.map(([n, v]) => (
          <div key={n} className="contents"><span className="text-sm font-bold text-white/80">{n}</span><Pips v={v} color={c.css} /></div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {MOVE_ORDER.map(([k, act, hint]) => {
          const m = c.moves[k];
          const kk = hint.replace(/[JKLP]$/, (s) => keyLabel(keys[{ J: "attack", K: "heavy", L: "special", P: "ultimate" }[s as "J"] as "attack"]));
          return (
            <div key={k} className="flex items-center gap-2 text-sm bg-black/25 rounded-lg px-2 py-1">
              <span className="kbd shrink-0">{kk}</span>
              <span className={`font-bold ${m.ult ? "text-[#ffd24a]" : ""}`}>{tr(m.name, m.en)}</span>
              <span className="ml-auto text-white/50 text-xs">{tr(ACTION_LABEL[act as "attack"][0], ACTION_LABEL[act as "attack"][1])}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CharSelect({ title, tag, initial = 0, onConfirm, onBack, confirmText }: { title: string; tag: string; initial?: number; onConfirm: (id: number) => void; onBack: () => void; confirmText?: string }) {
  const [cur, setCur] = useState(initial);
  const [cmd, setCmd] = useState<Cmd | undefined>();
  useEffect(() => { audio.voice(cur, "pick"); setCmd({ id: Math.random(), kind: "move", key: "jab" }); }, [cur]);
  const move = (d: number) => { audio.sfx("select"); setCur((c) => (c + d + 6) % 6); };
  useKey((e) => {
    if (e.code === "ArrowRight" || e.code === "KeyD") move(1);
    else if (e.code === "ArrowLeft" || e.code === "KeyA") move(-1);
    else if (e.code === "ArrowDown" || e.code === "KeyS") move(3);
    else if (e.code === "ArrowUp" || e.code === "KeyW") move(-3);
    else if (e.code === "Enter" || e.code === "Space" || e.code === "KeyJ") { audio.sfx("confirm"); audio.voice(cur, "win"); onConfirm(cur); }
  });
  const c = CHARS[cur];
  return (
    <Screen title={title} onBack={onBack} wide>
      <div className="h-full grid gap-4 px-0 md:grid-cols-[minmax(260px,340px)_1fr_minmax(280px,360px)] grid-cols-1 overflow-auto">
        <div className="panel p-4 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            {CHARS.map((ch) => (
              <button key={ch.id} onMouseEnter={() => audio.sfx("hover")} onClick={() => { if (cur === ch.id) { audio.sfx("confirm"); onConfirm(cur); } else { audio.sfx("select"); setCur(ch.id); } }}
                className={`relative rounded-2xl p-1 transition-transform ${cur === ch.id ? "card-sel scale-105" : "hover:scale-105"}`} style={{ background: cur === ch.id ? "#ffe14d33" : "transparent" }}>
                <Portrait id={ch.id} size={86} className="mx-auto" ring={cur === ch.id ? "#ffe14d" : undefined} />
                <div className="text-xs font-black text-white mt-1 truncate text-center">{tr(ch.name, ch.en)}</div>
                {cur === ch.id && <div className="absolute -top-2 -left-1 px-2 py-0.5 rounded-md bg-[#ff4d6d] text-white text-xs font-black border-2 border-[#1d0f45] pop-in">{tag}</div>}
              </button>
            ))}
          </div>
          <div className="text-xs text-white/60 text-center mt-1">{tr("← ↑ ↓ → 移動游標　Enter 確認　Esc 返回", "Arrows move cursor · Enter confirm · Esc back")}</div>
          <div className="text-xs text-white/70 italic text-center">「{tr(c.quote[0], c.quote[1])}」</div>
          <div className="mt-auto flex gap-2 justify-center">
            <Btn color="#4ade80" text="#10381f" onClick={() => onConfirm(cur)} sound="confirm" big>{confirmText || tr("確認選擇", "Confirm")}</Btn>
          </div>
        </div>
        <div className="panel relative overflow-hidden min-h-[320px]" style={{ background: `radial-gradient(circle at 50% 40%, ${c.css}88, rgba(24,12,60,.8) 70%)` }}>
          <CharViewer charId={cur} cmd={cmd} className="absolute inset-0" />
          <div className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/70">{tr("拖曳旋轉・點擊播放招式", "Drag to rotate · Click to play moves")}</div>
          <div className="absolute top-3 left-0 right-0 text-center text-6xl font-black opacity-20 text-white tracking-widest select-none">{c.en.toUpperCase()}</div>
        </div>
        <div className="panel p-4 overflow-auto"><CharInfo id={cur} /></div>
      </div>
    </Screen>
  );
}

export function ArenaSelect({ title, initial = 0, onConfirm, onBack, hideBack }: { title: string; initial?: number; onConfirm: (id: number) => void; onBack: () => void; hideBack?: boolean }) {
  const [cur, setCur] = useState(initial);
  useKey((e) => {
    if (e.code === "ArrowRight" || e.code === "KeyD") { audio.sfx("select"); setCur((c) => (c + 1) % 3); }
    else if (e.code === "ArrowLeft" || e.code === "KeyA") { audio.sfx("select"); setCur((c) => (c + 2) % 3); }
    else if (e.code === "Enter" || e.code === "Space") { audio.sfx("confirm"); onConfirm(cur); }
  });
  void hideBack;
  return (
    <Screen title={title} onBack={onBack} wide>
      <div className="h-full flex flex-col gap-4">
        <div className="grid md:grid-cols-3 gap-4 flex-1 min-h-0">
          {ARENAS.map((a) => (
            <button key={a.id} onMouseEnter={() => audio.sfx("hover")} onClick={() => { if (cur === a.id) { audio.sfx("confirm"); onConfirm(a.id); } else { audio.sfx("select"); setCur(a.id); } }}
              className={`panel p-3 text-left flex flex-col gap-2 transition-transform ${cur === a.id ? "card-sel scale-[1.02]" : "opacity-80 hover:opacity-100"}`}>
              <div className="rounded-xl overflow-hidden border-[3px] border-[#1d0f45] aspect-video" style={{ background: a.css }}>
                {thumbs[a.id] && <img src={thumbs[a.id]} alt={a.name} className="w-full h-full object-cover" draggable={false} />}
              </div>
              <div className="text-2xl font-black text-white">{tr(a.name, a.en)}</div>
              <div className="text-xs font-bold text-[#ffd24a]">{tr(a.theme[0], a.theme[1])}</div>
              <p className="text-sm text-white/80 flex-1">{tr(a.desc[0], a.desc[1])}</p>
              <div className="text-xs bg-black/30 rounded-lg px-2 py-1 text-white/80">⚠ {tr(a.hazard[0], a.hazard[1])}</div>
            </button>
          ))}
        </div>
        <div className="flex justify-center"><Btn big color="#4ade80" text="#10381f" sound="confirm" onClick={() => onConfirm(cur)}>{tr("選擇此場地", "Select Arena")}</Btn></div>
      </div>
    </Screen>
  );
}
