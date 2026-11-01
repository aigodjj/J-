import { useEffect, useState } from "react";
import { ACTIONS, ACTION_LABEL, ActionKey, ARENAS, CHARS, DEFAULT_KEYS, DEFAULT_RULES, DIFFICULTIES, keyLabel, tr } from "../game/data";
import { updateSettings, useStore } from "../game/store";
import { audio } from "../game/audio";
import { Btn, Row, Screen, Seg, Slider, Toggle } from "./common";
import { RulesEditor } from "./Setup";

type Tab = "keys" | "audio" | "gfx" | "lang" | "rules";
const RESERVED = ["Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyR", "Tab", "F5", "F11", "F12"];

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { settings: s } = useStore();
  const [tab, setTab] = useState<Tab>("keys");
  const [listen, setListen] = useState<ActionKey | null>(null);
  const [msg, setMsg] = useState("");
  const [fs, setFs] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  useEffect(() => {
    if (!listen) return;
    const h = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.code === "Escape") { setListen(null); return; }
      if (RESERVED.includes(e.code)) { setMsg(tr("此按鍵為系統保留（Esc、方向鍵、R、Tab…），請改用其他按鍵。", "That key is reserved (Esc, arrows, R, Tab…). Pick another.")); audio.sfx("error"); return; }
      const keys = { ...s.keys };
      const other = ACTIONS.find((a) => a !== listen && keys[a] === e.code);
      if (other) { keys[other] = keys[listen]; setMsg(tr(`已與「${ACTION_LABEL[other][0]}」交換按鍵以避免衝突。`, `Swapped with "${ACTION_LABEL[other][1]}" to avoid a conflict.`)); } else setMsg("");
      keys[listen] = e.code;
      updateSettings({ keys });
      audio.sfx("confirm");
      setListen(null);
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [listen, s.keys]);

  const toggleFs = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().catch(() => setMsg(tr("瀏覽器不允許全螢幕。", "Fullscreen not allowed."))); };
  const tabs: [Tab, string][] = [["keys", tr("操作", "Controls")], ["audio", tr("音訊", "Audio")], ["gfx", tr("畫面", "Graphics")], ["lang", tr("語言", "Language")], ["rules", tr("預設規則", "Default Rules")]];
  return (
    <Screen title={tr("設定", "Settings")} onBack={onBack}>
      <div className="flex gap-2 mb-3 flex-wrap">{tabs.map(([k, l]) => <Btn key={k} color={tab === k ? "#ff4fa0" : "#4b3a8a"} onClick={() => setTab(k)}>{l}</Btn>)}</div>
      <div className="panel p-5 text-white max-w-3xl">
        {tab === "keys" && (
          <>
            <div className="text-sm text-white/70 mb-2">{tr("點擊按鈕後按下新按鍵即可改鍵（Esc 取消）。重複的按鍵會自動交換。方向鍵固定可作為移動輔助鍵。", "Click a button, then press a new key (Esc cancels). Duplicates are swapped automatically. Arrow keys always work as alternate movement.")}</div>
            {ACTIONS.map((a) => (
              <Row key={a} label={tr(ACTION_LABEL[a][0], ACTION_LABEL[a][1])}>
                <button onClick={() => { setListen(a); setMsg(""); }} className={`btn-chunk px-4 py-1.5 min-w-28 ${listen === a ? "bg-[#ffd24a] text-[#1d0f45] animate-pulse" : "bg-white text-[#1d0f45]"}`}>{listen === a ? tr("按下按鍵…", "Press a key…") : keyLabel(s.keys[a])}</button>
              </Row>
            ))}
            {msg && <div className="mt-2 text-[#ffd24a] text-sm font-bold">{msg}</div>}
            <div className="mt-3"><Btn small color="#6d5bd0" onClick={() => { updateSettings({ keys: { ...DEFAULT_KEYS } }); setMsg(""); }}>{tr("恢復預設按鍵", "Reset to defaults")}</Btn></div>
          </>
        )}
        {tab === "audio" && (
          <>
            {(["master", "music", "sfx"] as const).map((k) => (
              <Row key={k} label={({ master: tr("主音量", "Master volume"), music: tr("音樂音量", "Music volume"), sfx: tr("音效音量", "SFX volume") })[k]}>
                <Slider value={s[k]} onChange={(v) => { updateSettings({ [k]: v }); audio.applyVolumes(); }} />
              </Row>
            ))}
            <div className="mt-3 flex gap-2 flex-wrap"><Btn small color="#6d5bd0" onClick={() => audio.sfx("hit3")}>{tr("測試音效", "Test SFX")}</Btn><Btn small color="#6d5bd0" onClick={() => audio.sfx("win")}>{tr("測試勝利音", "Test jingle")}</Btn></div>
          </>
        )}
        {tab === "gfx" && (
          <>
            <Row label={tr("畫質", "Graphics quality")} hint={tr("影響抗鋸齒與像素密度", "Affects anti-aliasing & pixel density")}><Seg value={s.quality} onChange={(v) => updateSettings({ quality: v })} options={[{ v: "low", label: tr("低", "Low") }, { v: "medium", label: tr("中", "Medium") }, { v: "high", label: tr("高", "High") }]} /></Row>
            <Row label={tr("解析度比例", "Resolution scale")} hint={tr("降低可提升效能（下次進入戰鬥生效）", "Lower for performance (applies next battle)")}><Slider value={s.resScale} min={0.5} max={1} step={0.05} onChange={(v) => updateSettings({ resScale: v })} /></Row>
            <Row label={tr("視窗大小", "Window size")}><Seg value={s.winSize} onChange={(v) => updateSettings({ winSize: v })} options={[{ v: "fit", label: tr("填滿", "Fit") }, { v: "1280", label: "1280" }, { v: "1024", label: "1024" }, { v: "800", label: "800" }]} /></Row>
            <Row label={tr("全螢幕", "Fullscreen")}><Btn small color={fs ? "#ff4d6d" : "#4ade80"} text={fs ? "#fff" : "#10381f"} onClick={toggleFs}>{fs ? tr("離開全螢幕", "Exit fullscreen") : tr("進入全螢幕", "Enter fullscreen")}</Btn></Row>
            <Row label={tr("視覺特效", "Visual effects")}><Seg value={s.vfx} onChange={(v) => updateSettings({ vfx: v })} options={[{ v: 0, label: tr("關", "Off") }, { v: 1, label: tr("簡化", "Reduced") }, { v: 2, label: tr("完整", "Full") }]} /></Row>
            <Row label={tr("畫面震動", "Screen shake")}><Toggle value={s.shake} onChange={(v) => updateSettings({ shake: v })} /></Row>
            <Row label={tr("FPS 上限", "FPS cap")}><Seg value={s.fpsCap} onChange={(v) => updateSettings({ fpsCap: v })} options={[{ v: 30, label: "30" }, { v: 60, label: "60" }, { v: 120, label: "120" }, { v: 0, label: tr("無限制", "Unlimited") }]} /></Row>
            <Row label={tr("顯示 FPS", "Show FPS")}><Toggle value={s.showFps} onChange={(v) => updateSettings({ showFps: v })} /></Row>
            {msg && <div className="mt-2 text-[#ffd24a] text-sm font-bold">{msg}</div>}
          </>
        )}
        {tab === "lang" && (
          <Row label={tr("語言 Language", "Language")}><Seg value={s.lang} onChange={(v) => updateSettings({ lang: v })} options={[{ v: "zh", label: "繁體中文（台灣）" }, { v: "en", label: "English" }]} /></Row>
        )}
        {tab === "rules" && (
          <>
            <RulesEditor rules={s.rules} onChange={(rules) => updateSettings({ rules })} />
            <Row label={tr("預設 CPU 難度", "Default CPU difficulty")}><Seg value={s.difficulty} onChange={(v) => updateSettings({ difficulty: v })} options={DIFFICULTIES.map((d, i) => ({ v: i, label: tr(d.zh, d.en) }))} /></Row>
            <Row label={tr("預設角色", "Default character")}><Seg value={s.defChar} onChange={(v) => updateSettings({ defChar: v })} options={CHARS.map((c) => ({ v: c.id, label: tr(c.name, c.en) }))} /></Row>
            <Row label={tr("預設場地", "Default arena")}><Seg value={s.defArena} onChange={(v) => updateSettings({ defArena: v })} options={ARENAS.map((a) => ({ v: a.id, label: tr(a.name, a.en) }))} /></Row>
            <div className="mt-3"><Btn small color="#6d5bd0" onClick={() => updateSettings({ rules: { ...DEFAULT_RULES } })}>{tr("恢復預設規則", "Reset rules")}</Btn></div>
          </>
        )}
      </div>
    </Screen>
  );
}
