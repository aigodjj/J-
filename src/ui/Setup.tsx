import { useEffect, useState } from "react";
import { ARENAS, CHARS, DIFFICULTIES, MatchConfig, Rules, tr } from "../game/data";
import { getProfile, getSettings, updateSettings, useStore } from "../game/store";
import { audio } from "../game/audio";
import { thumbs } from "../game/snap";
import { Btn, Portrait, Row, Screen, Seg, Toggle } from "./common";
import { CharSelect } from "./Select";

export function RulesEditor({ rules, onChange, readOnly }: { rules: Rules; onChange: (r: Rules) => void; readOnly?: boolean }) {
  const set = (p: Partial<Rules>) => !readOnly && onChange({ ...rules, ...p });
  const dis = readOnly ? "opacity-60 pointer-events-none" : "";
  return (
    <div className={`text-white ${dis}`}>
      <Row label={tr("殘機數（生命）", "Stocks (lives)")}><Seg value={rules.stocks} onChange={(v) => set({ stocks: v })} options={[1, 2, 3, 4, 5].map((v) => ({ v, label: String(v) }))} /></Row>
      <Row label={tr("比賽時間", "Match time")}><Seg value={rules.time} onChange={(v) => set({ time: v })} options={[{ v: 0, label: tr("無限", "∞") }, ...[1, 2, 3, 5].map((v) => ({ v, label: v + tr(" 分", "m") }))]} /></Row>
      <Row label={tr("傷害倍率", "Damage ×")}><Seg value={rules.dmgMul} onChange={(v) => set({ dmgMul: v })} options={[0.5, 1, 1.5, 2].map((v) => ({ v, label: "×" + v }))} /></Row>
      <Row label={tr("擊飛倍率", "Knockback ×")}><Seg value={rules.kbMul} onChange={(v) => set({ kbMul: v })} options={[0.75, 1, 1.25, 1.5].map((v) => ({ v, label: "×" + v }))} /></Row>
      <Row label={tr("允許究極奧義", "Ultimates")}><Toggle value={rules.ult} onChange={(v) => set({ ult: v })} /></Row>
      <Row label={tr("場地危險物", "Stage hazards")}><Toggle value={rules.hazards} onChange={(v) => set({ hazards: v })} /></Row>
    </div>
  );
}

export function ArenaPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {ARENAS.map((a) => (
        <button key={a.id} onClick={() => onChange(a.id)} className={`rounded-xl overflow-hidden border-4 text-left transition ${value === a.id ? "border-[#ffe14d] card-sel" : "border-transparent opacity-70 hover:opacity-100"}`}>
          <div className="aspect-video" style={{ background: a.css }}>{thumbs[a.id] && <img src={thumbs[a.id]} className="w-full h-full object-cover" draggable={false} />}</div>
          <div className="bg-black/60 text-white text-xs font-bold px-2 py-1 truncate">{tr(a.name, a.en)}</div>
        </button>
      ))}
    </div>
  );
}

export function OfflineFlow({ mode, onStart, onBack }: { mode: "cpu" | "training"; onStart: (cfg: MatchConfig) => void; onBack: () => void }) {
  const { settings } = useStore();
  const [step, setStep] = useState(0);
  const [p1, setP1] = useState(settings.defChar);
  const [p2, setP2] = useState((settings.defChar + 1) % 6);
  const [arena, setArena] = useState(settings.defArena);
  const [diff, setDiff] = useState(settings.difficulty);
  const [rules, setRules] = useState<Rules>({ ...settings.rules });

  useEffect(() => {
    if (step < 2) {
      audio.playMusic("character-select");
    } else if (mode === "training") {
      audio.playMusic("training");
    } else {
      audio.playMusic("menu");
    }
  }, [mode, step]);

  if (step === 0) return <CharSelect title={tr("選擇你的角色", "Choose Your Fighter")} tag="P1" initial={p1} onBack={onBack} onConfirm={(id) => { setP1(id); setStep(1); }} />;
  if (step === 1) return <CharSelect title={mode === "cpu" ? tr("選擇 CPU 對手", "Choose CPU Opponent") : tr("選擇訓練假人", "Choose Training Dummy")} tag={mode === "cpu" ? "CPU" : "DUMMY"} initial={p2} onBack={() => setStep(0)} onConfirm={(id) => { setP2(id); setStep(2); }} />;

  const start = () => {
    updateSettings({ defChar: p1, defArena: arena, difficulty: diff, rules: mode === "cpu" ? rules : settings.rules });
    const prof = getProfile();
    onStart({
      mode, arena, localSlot: 0,
      rules: mode === "training" ? { ...rules, stocks: 99, time: 0 } : rules,
      players: [
        { charId: p1, name: prof.name, avatar: prof.avatar, cpu: false, level: 0 },
        { charId: p2, name: mode === "cpu" ? "CPU" : tr("訓練假人", "Dummy"), avatar: p2, cpu: mode === "cpu", level: diff },
      ],
    });
  };

  return (
    <Screen title={mode === "cpu" ? tr("對戰設定 · VS CPU", "Match Setup · VS CPU") : tr("訓練模式設定", "Training Setup")} onBack={() => setStep(1)}>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="panel p-4 flex flex-col gap-4">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center"><Portrait id={p1} size={96} ring="#ff4d6d" /><div className="text-white font-black mt-1">{tr(CHARS[p1].name, CHARS[p1].en)}</div><div className="text-xs text-[#ff7a90] font-bold">P1</div></div>
            <div className="text-4xl font-black text-[#ffd24a]">VS</div>
            <div className="text-center"><Portrait id={p2} size={96} ring="#3d8bff" /><div className="text-white font-black mt-1">{tr(CHARS[p2].name, CHARS[p2].en)}</div><div className="text-xs text-[#7fb0ff] font-bold">{mode === "cpu" ? "CPU" : tr("假人", "Dummy")}</div></div>
          </div>
          <div>
            <div className="text-white font-black mb-2">{tr("選擇場地", "Arena")}</div>
            <ArenaPicker value={arena} onChange={setArena} />
            <div className="text-xs text-white/70 mt-2">{tr(ARENAS[arena].desc[0], ARENAS[arena].desc[1])}</div>
          </div>
          {mode === "cpu" && (
            <div>
              <div className="text-white font-black mb-2">{tr("CPU 難度", "CPU Difficulty")}</div>
              <Seg value={diff} onChange={setDiff} options={DIFFICULTIES.map((d, i) => ({ v: i, label: tr(d.zh, d.en) }))} />
              <div className="text-xs text-white/70 mt-2">
                {tr("反應時間", "Reaction")} {DIFFICULTIES[diff].react}s · {tr("格擋率", "Block")} {Math.round(DIFFICULTIES[diff].block * 100)}% · {tr("閃避率", "Dodge")} {Math.round(DIFFICULTIES[diff].dodge * 100)}% · {tr("連段", "Combo")} {Math.round(DIFFICULTIES[diff].combo * 100)}%
              </div>
            </div>
          )}
        </div>
        <div className="panel p-4 flex flex-col gap-3">
          <div className="text-white font-black text-xl">{mode === "cpu" ? tr("比賽規則", "Match Rules") : tr("訓練說明", "Training Notes")}</div>
          {mode === "cpu" ? <RulesEditor rules={rules} onChange={setRules} /> : (
            <ul className="text-white/85 text-sm list-disc pl-5 space-y-1">
              <li>{tr("無淘汰、無時間限制，被擊飛出場後會重生。", "No eliminations or timer. You respawn after ring-outs.")}</li>
              <li>{tr("畫面右下角顯示傷害、擊飛力道、角度與連擊資訊。", "Damage, knockback, angle and combo info appear bottom-right.")}</li>
              <li>{tr("按 R 重置位置；Esc 開啟訓練選單（假人行為、傷害%、補滿奧義）。", "Press R to reset positions; Esc opens training menu (dummy behaviour, damage %, fill ultimate).")}</li>
              <li>{tr("你的奧義條永遠是滿的，可隨時練習究極奧義。", "Your ultimate meter is always full for practice.")}</li>
            </ul>
          )}
          <div className="mt-auto flex justify-end"><Btn big color="#4ade80" text="#10381f" sound="confirm" onClick={start}>▶ {tr("開始！", "Start!")}</Btn></div>
        </div>
      </div>
    </Screen>
  );
}
void getSettings;
