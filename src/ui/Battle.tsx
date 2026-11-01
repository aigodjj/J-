import { useEffect, useRef, useState } from "react";
import { ACTIONS, ACTION_LABEL, CHARS, DIFFICULTIES, MatchConfig, MatchResult, ARENAS, keyLabel, tr } from "../game/data";
import { Engine, HudPlayer, HudState } from "../game/engine";
import { getSettings, updateSettings, useStore } from "../game/store";
import { audio } from "../game/audio";
import { room, useRoom } from "../game/net";
import { Btn, Portrait, Slider, Spinner } from "./common";

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const pctColor = (p: number) => (p < 40 ? "#ffffff" : p < 80 ? "#ffe14d" : p < 120 ? "#ffa23d" : p < 170 ? "#ff5a3d" : "#c1121f");

function PlayerCard({ p, side, mode, you }: { p: HudPlayer; side: "l" | "r"; mode: string; you: boolean }) {
  const c = CHARS[p.charId];
  const col = p.slot === 0 ? "#ff4d6d" : "#3d8bff";
  const lives = mode === "training" ? -1 : p.lives;
  return (
    <div className={`flex items-end gap-3 ${side === "r" ? "flex-row-reverse" : ""}`}>
      <div className="relative">
        <Portrait id={p.charId} size={78} ring={col} className={p.out ? "grayscale" : ""} />
        <div className="absolute -top-2 px-2 rounded-md text-xs font-black text-white border-2 border-[#1d0f45]" style={{ background: col, [side === "l" ? "left" : "right"]: -6 }}>
          {p.cpu ? "CPU" : `P${p.slot + 1}`}
        </div>
      </div>
      <div className={`flex flex-col ${side === "r" ? "items-end" : "items-start"}`}>
        <div className="text-white font-black text-sm drop-shadow flex items-center gap-1" style={{ textShadow: "0 2px 0 #1d0f45" }}>
          {you && <span className="px-1.5 rounded bg-[#ffe14d] text-[#1d0f45] text-[10px]">{tr("你", "YOU")}</span>}
          {p.name} <span className="opacity-70 font-bold">· {tr(c.name, c.en)}</span>
        </div>
        <div className="hud-num font-black text-5xl leading-none" style={{ color: pctColor(p.percent), transform: `scale(${1 + Math.min(0.15, p.percent / 2000)})` }}>
          {Math.floor(p.percent)}<span className="text-2xl">%</span>
        </div>
        <div className="flex items-center gap-1 h-5 mt-0.5">
          {lives < 0 ? <span className="text-white font-black text-lg">∞</span> : Array.from({ length: Math.max(0, Math.min(lives, 7)) }, (_, i) => (
            <span key={i} className="text-lg leading-none" style={{ color: col, textShadow: "0 2px 0 #1d0f45" }}>●</span>
          ))}
          {lives >= 0 && lives <= 0 && <span className="text-red-300 text-xs font-bold">OUT</span>}
        </div>
        <div className="w-44 h-3 rounded-full bg-black/50 border-2 border-[#1d0f45] overflow-hidden mt-1 relative">
          <div className={`h-full ${p.meter >= 100 ? "shine" : ""}`} style={{ width: `${p.meter}%`, background: p.meter >= 100 ? "#ffd24a" : "#8b5cf6" }} />
        </div>
        <div className="text-[10px] font-black text-white/80 tracking-widest">{p.meter >= 100 ? tr("奧義就緒！", "ULTIMATE READY!") : "ULT"}</div>
      </div>
    </div>
  );
}

export function Battle({ cfg, onEnd, onExit, onRestart }: { cfg: MatchConfig; onEnd: (r: MatchResult) => void; onExit: () => void; onRestart: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const eng = useRef<Engine | null>(null);
  const endRef = useRef(onEnd); endRef.current = onEnd;
  const [hud, setHud] = useState<HudState | null>(null);
  const [paused, setPaused] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [hints, setHints] = useState(true);
  const { settings } = useStore();
  const rm = useRoom();
  const online = cfg.mode === "online";

  useEffect(() => {
    let e: Engine | null = null;
    try {
      e = new Engine(ref.current!, cfg, {
        onHud: setHud,
        onEnd: (r) => endRef.current(r),
        onPauseKey: () => setPaused((p) => { const n = !p; e?.setPaused(n); audio.sfx(n ? "click" : "back"); return n; }),
      });
      eng.current = e;
    } catch (ex) {
      setErr(String(ex));
    }
    const t1 = setTimeout(() => setLoading(false), 900);
    const t2 = setTimeout(() => setHints(false), 12000);
    return () => { clearTimeout(t1); clearTimeout(t2); e?.dispose(); eng.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resume = () => { setPaused(false); eng.current?.setPaused(false); };
  const size = settings.winSize === "fit" ? undefined : { width: Math.min(parseInt(settings.winSize), window.innerWidth), aspectRatio: "16 / 9", maxHeight: "100%" };
  const keys = settings.keys;
  const me = online ? cfg.localSlot : 0;

  if (err) return (
    <div className="absolute inset-0 bg-candy flex flex-col items-center justify-center gap-4 text-white p-8 text-center">
      <div className="text-3xl font-black">{tr("無法啟動 3D 戰鬥", "Cannot start 3D battle")}</div>
      <div className="max-w-xl text-white/80">{tr("您的瀏覽器可能不支援 WebGL，或硬體加速被關閉。請啟用硬體加速後重試。", "Your browser may not support WebGL or hardware acceleration is disabled.")}</div>
      <div className="text-xs opacity-60">{err}</div>
      <Btn onClick={onExit}>{tr("返回", "Back")}</Btn>
    </div>
  );

  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center">
      <div ref={ref} className="relative w-full h-full overflow-hidden" style={size}>
        {hud && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-3 left-4 right-4 flex justify-between items-start">
              <PlayerCard p={hud.players[0]} side="l" mode={cfg.mode} you={online && me === 0} />
              <div className="flex flex-col items-center gap-1">
                <div className="px-5 py-1 rounded-2xl bg-black/55 border-[3px] border-[#1d0f45] text-white font-black text-3xl hud-num">{hud.unlimited && cfg.mode !== "training" ? "∞" : fmtTime(hud.time)}</div>
                <div className="text-xs text-white/80 font-bold bg-black/40 rounded-full px-3 py-0.5">{tr(ARENAS[cfg.arena].name, ARENAS[cfg.arena].en)}{cfg.mode === "cpu" ? ` · CPU ${tr(DIFFICULTIES[cfg.players[1].level].zh, DIFFICULTIES[cfg.players[1].level].en)}` : ""}</div>
                {online && <div className="text-xs font-bold px-3 py-0.5 rounded-full bg-black/50 text-white">📶 {rm.ping} ms</div>}
                {settings.showFps && <div className="text-xs font-mono text-green-300 bg-black/50 px-2 rounded">{hud.fps} FPS</div>}
              </div>
              <PlayerCard p={hud.players[1]} side="r" mode={cfg.mode} you={online && me === 1} />
            </div>
            {hud.countdown > 0 && <div key={hud.countdown} className="absolute inset-0 flex items-center justify-center"><div className="count-anim title-stroke font-black" style={{ fontSize: "12rem" }}>{hud.countdown}</div></div>}
            {hud.banner && <div key={hud.banner.id} className="absolute top-[26%] left-0 right-0 flex justify-center"><div className="banner-anim text-5xl md:text-6xl font-black px-6 text-center" style={{ color: hud.banner.color, WebkitTextStroke: "3px #1d0f45", paintOrder: "stroke fill", textShadow: "0 6px 0 #1d0f45" }}>{hud.banner.text}</div></div>}
            {hints && hud.countdown === 0 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 rounded-2xl px-4 py-2 text-white text-xs flex gap-3 flex-wrap justify-center max-w-[95%] fade-in">
                {([["left", ""], ["jump", ""], ["attack", ""], ["heavy", ""], ["special", ""], ["grab", ""], ["block", ""], ["dodge", ""], ["ultimate", ""]] as const).map(([a]) => (
                  <span key={a}><span className="kbd">{keyLabel(keys[a])}</span> {tr(ACTION_LABEL[a][0].split("（")[0], ACTION_LABEL[a][1].split(" (")[0])}</span>
                ))}
                <span><span className="kbd">Esc</span> {tr("選單", "Menu")}</span>
              </div>
            )}
            {cfg.mode === "training" && hud.train && (
              <div className="absolute right-3 bottom-3 w-64 panel p-3 text-white text-sm pointer-events-none">
                <div className="font-black text-[#ffd24a] mb-1">{tr("訓練資訊", "Training Info")}</div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  <span className="text-white/70">{tr("上次招式", "Last move")}</span><span className="font-bold text-right truncate">{hud.train.move}</span>
                  <span className="text-white/70">{tr("傷害", "Damage")}</span><span className="font-bold text-right">{hud.train.lastDmg.toFixed(1)}%</span>
                  <span className="text-white/70">{tr("擊飛力道", "Knockback")}</span><span className="font-bold text-right">{hud.train.lastKb.toFixed(1)}</span>
                  <span className="text-white/70">{tr("擊飛角度", "Angle")}</span><span className="font-bold text-right">{Math.round(hud.train.lastAng)}°</span>
                  <span className="text-white/70">{tr("硬直", "Hitstun")}</span><span className="font-bold text-right">{hud.train.lastStun.toFixed(2)}s</span>
                  <span className="text-white/70">{tr("連擊", "Combo")}</span><span className="font-bold text-right">{hud.train.combo} (max {hud.train.maxCombo})</span>
                  <span className="text-white/70">{tr("連擊總傷害", "Combo dmg")}</span><span className="font-bold text-right">{hud.train.total.toFixed(1)}%</span>
                  <span className="text-white/70">{tr("假人", "Dummy")}</span><span className="font-bold text-right">{({ stand: tr("站立", "Stand"), block: tr("格擋", "Block"), jump: tr("跳躍", "Jump"), cpu: "CPU" } as Record<string, string>)[hud.train.dummy]}</span>
                </div>
                <div className="text-xs text-white/60 mt-1"><span className="kbd">R</span> {tr("重置位置", "Reset positions")} · <span className="kbd">Esc</span> {tr("訓練選單", "Menu")}</div>
              </div>
            )}
            {hud.lost !== null && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 text-white pointer-events-auto">
                <Spinner className="w-12 h-12" />
                <div className="text-3xl font-black">{tr("與對手的連線中斷", "Connection to opponent lost")}</div>
                <div className="text-lg">{tr(`嘗試重新連線中… ${Math.ceil(hud.lost)} 秒後判定對戰結束`, `Reconnecting… match ends in ${Math.ceil(hud.lost)}s`)}</div>
                <Btn color="#ff4d6d" onClick={onExit}>{tr("離開對戰", "Leave match")}</Btn>
              </div>
            )}
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 bg-candy flex flex-col items-center justify-center gap-4 text-white z-20">
            <div className="text-4xl font-black title-stroke">{tr(ARENAS[cfg.arena].name, ARENAS[cfg.arena].en)}</div>
            <Spinner className="w-12 h-12" />
            <div className="font-bold">{tr("載入場地中…", "Loading arena…")}</div>
            <div className="text-sm text-white/70 max-w-md text-center">{tr("小技巧：敵人傷害越高就越容易被擊飛；剛按下格擋時被攻擊可觸發「完美格擋」並反擊！", "Tip: higher damage % means farther knockback. Block right before impact for a Perfect Block and counter!")}</div>
          </div>
        )}
        {paused && (
          <div className="absolute inset-0 bg-black/65 flex items-center justify-center z-30 pointer-events-auto fade-in">
            <div className="panel p-6 w-[min(560px,94%)] max-h-[92%] overflow-auto text-white flex flex-col gap-3">
              <div className="text-3xl font-black text-center">{online ? tr("選單（對戰持續進行中）", "Menu (match continues)") : tr("暫停", "PAUSED")}</div>
              {cfg.mode === "training" && eng.current && <TrainingMenu e={eng.current} />}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm bg-black/25 rounded-xl p-3">
                {ACTIONS.map((a) => <div key={a} className="flex justify-between"><span className="text-white/80">{tr(ACTION_LABEL[a][0], ACTION_LABEL[a][1])}</span><span className="kbd">{keyLabel(keys[a])}</span></div>)}
              </div>
              {(["master", "music", "sfx"] as const).map((k) => (
                <div key={k} className="flex items-center justify-between"><span className="font-bold">{({ master: tr("主音量", "Master"), music: tr("音樂", "Music"), sfx: tr("音效", "SFX") })[k]}</span>
                  <Slider value={settings[k]} onChange={(v) => { updateSettings({ [k]: v }); audio.applyVolumes(); }} /></div>
              ))}
              <div className="flex gap-2 justify-center flex-wrap mt-2">
                <Btn color="#4ade80" text="#10381f" onClick={resume}>{tr("繼續", "Resume")}</Btn>
                {!online && <Btn color="#ffd24a" text="#1d0f45" onClick={onRestart}>{tr("重新開始", "Restart")}</Btn>}
                <Btn color="#ff4d6d" onClick={() => { if (online) room.leave(); onExit(); }}>{tr("離開對戰", "Leave")}</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrainingMenu({ e }: { e: Engine }) {
  const [dummy, setDummy] = useState(e.train.dummy);
  const b = (label: string, fn: () => void, color = "#6d5bd0") => <Btn small color={color} onClick={fn}>{label}</Btn>;
  return (
    <div className="bg-black/25 rounded-xl p-3 flex flex-col gap-2">
      <div className="font-black text-[#ffd24a]">{tr("訓練設定", "Training Options")}</div>
      <div className="flex gap-2 flex-wrap items-center"><span className="text-sm">{tr("假人行為", "Dummy")}</span>
        {(["stand", "block", "jump", "cpu"] as const).map((m) => <Btn key={m} small color={dummy === m ? "#ffd24a" : "#6d5bd0"} text={dummy === m ? "#1d0f45" : "#fff"} onClick={() => { e.setDummy(m); setDummy(m); }}>{({ stand: tr("站立", "Stand"), block: tr("格擋", "Block"), jump: tr("跳躍", "Jump"), cpu: "CPU" })[m]}</Btn>)}
      </div>
      <div className="flex gap-2 flex-wrap items-center"><span className="text-sm">{tr("假人傷害", "Dummy %")}</span>
        {[0, 50, 100, 150, 200].map((p) => b(p + "%", () => e.setTrainPercent(p)))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {b(tr("重置位置", "Reset positions"), () => e.resetTraining(false), "#3d8bff")}
        {b(tr("重置全部", "Reset all"), () => e.resetTraining(true), "#3d8bff")}
        {b(tr("補滿奧義", "Fill ultimate"), () => e.fillMeter(), "#ff4fa0")}
      </div>
    </div>
  );
}

export { getSettings };
