import { useState } from "react";
import { ACTIONS, ACTION_LABEL, ARENAS, CHARS, MOVE_ORDER, keyLabel, tr } from "../game/data";
import { resetProfileStats, updateProfile, useStore } from "../game/store";
import { thumbs } from "../game/snap";
import { Btn, Portrait, Screen, Seg } from "./common";
import { CharViewer, Cmd } from "./views3d";
import { CharInfo } from "./Select";

export function ProfilePage({ onBack }: { onBack: () => void }) {
  const { profile: p } = useStore();
  const rate = p.played ? Math.round((p.wins / p.played) * 100) : 0;
  const maxUse = Math.max(1, ...p.usage);
  const fav = p.usage.indexOf(Math.max(...p.usage));
  return (
    <Screen title={tr("玩家檔案", "Player Profile")} onBack={onBack}>
      <div className="grid md:grid-cols-[320px_1fr] gap-4">
        <div className="panel p-4 flex flex-col gap-3 text-white items-center">
          <Portrait id={p.avatar} size={140} ring="#ffe14d" />
          <div className="w-full">
            <label className="text-xs text-white/60">{tr("暱稱", "Nickname")}</label>
            <input value={p.name} maxLength={12} onChange={(e) => updateProfile({ name: e.target.value.slice(0, 12) || "Guest" })} className="w-full px-3 py-2 rounded-xl bg-white/10 border-2 border-white/30 font-black text-xl outline-none focus:border-[#ffd24a]" />
          </div>
          <div className="w-full">
            <div className="text-xs text-white/60 mb-1">{tr("頭像", "Avatar")}</div>
            <div className="grid grid-cols-6 gap-1.5">
              {CHARS.map((c) => <button key={c.id} onClick={() => updateProfile({ avatar: c.id })} className={`rounded-xl transition ${p.avatar === c.id ? "scale-110 ring-4 ring-[#ffe14d]" : "opacity-70 hover:opacity-100"}`}><Portrait id={c.id} size={44} /></button>)}
            </div>
          </div>
          <div className="text-xs text-white/70 bg-black/25 rounded-lg p-2">{tr("目前為訪客模式：本站為純前端遊戲，沒有帳號伺服器，因此不提供帳號登入。你的進度與設定會儲存在這台裝置的瀏覽器中（localStorage）。", "Guest mode: this is a front-end only game with no account server, so login is unavailable. Progress and settings are saved in this browser (localStorage).")}</div>
          <Btn small color="#ff4d6d" onClick={() => { if (confirm(tr("確定要清除所有戰績嗎？", "Reset all stats?"))) resetProfileStats(); }}>{tr("清除戰績", "Reset stats")}</Btn>
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[[tr("對戰場數", "Matches"), p.played, "#3d8bff"], [tr("勝場", "Wins"), p.wins, "#4ade80"], [tr("敗場", "Losses"), p.losses, "#ff6a6a"], [tr("勝率", "Win rate"), rate + "%", "#ffd24a"]].map(([k, v, c]) => (
              <div key={String(k)} className="panel p-3 text-center"><div className="text-sm text-white/70">{k}</div><div className="text-4xl font-black" style={{ color: String(c) }}>{v}</div></div>
            ))}
          </div>
          <div className="panel p-4 text-white">
            <div className="font-black text-xl mb-2">{tr("角色使用統計", "Character usage")} {p.played > 0 && <span className="text-sm text-white/60">· {tr("最常使用", "Favourite")}：{tr(CHARS[fav].name, CHARS[fav].en)}</span>}</div>
            <div className="grid gap-2">
              {CHARS.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <Portrait id={c.id} size={36} /><div className="w-24 font-bold text-sm truncate">{tr(c.name, c.en)}</div>
                  <div className="flex-1 h-4 rounded-full bg-black/40 overflow-hidden"><div className="h-full rounded-full" style={{ width: (p.usage[c.id] / maxUse) * 100 + "%", background: c.css }} /></div>
                  <div className="w-24 text-right text-sm tabular-nums">{p.usage[c.id]} {tr("場", "games")} · {p.charWins[c.id]}{tr("勝", "W")}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-white/60 mt-2">{tr("累計造成傷害", "Total damage dealt")}：{p.totalDmg}% · {tr("累計 KO", "Total KOs")}：{p.totalKos}</div>
          </div>
          <div className="panel p-4 text-white">
            <div className="font-black text-xl mb-2">{tr("近期對戰紀錄", "Recent matches")}</div>
            {p.history.length === 0 && <div className="text-white/60 text-sm">{tr("尚無紀錄，去打一場吧！（訓練模式不計入）", "No matches yet — go fight! (Training isn't recorded)")}</div>}
            <div className="flex flex-col gap-1.5 max-h-72 overflow-auto">
              {p.history.map((h, i) => (
                <div key={i} className="flex items-center gap-3 bg-black/25 rounded-xl px-3 py-1.5 text-sm">
                  <span className={`w-12 text-center font-black rounded-md ${h.result === "win" ? "bg-green-400 text-green-950" : h.result === "loss" ? "bg-red-400 text-red-950" : "bg-yellow-300 text-yellow-950"}`}>{h.result === "win" ? tr("勝", "WIN") : h.result === "loss" ? tr("敗", "LOSS") : tr("平", "DRAW")}</span>
                  <Portrait id={h.myChar} size={30} /><span className="text-white/50">VS</span><Portrait id={h.oppChar} size={30} />
                  <span className="font-bold truncate flex-1">{h.oppName}</span>
                  <span className="text-white/70 hidden md:inline">{h.mode === "online" ? tr("線上", "Online") : "CPU"} · {tr(ARENAS[h.arena]?.name || "", ARENAS[h.arena]?.en || "")}</span>
                  <span className="text-white/60 tabular-nums">{Math.floor(h.dur / 60)}:{String(h.dur % 60).padStart(2, "0")}</span>
                  <span className="text-white/40 text-xs hidden md:inline">{new Date(h.ts).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

export function Gallery({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<"char" | "arena">("char");
  const [cur, setCur] = useState(0);
  const [cmd, setCmd] = useState<Cmd | undefined>();
  const [ar, setAr] = useState(0);
  const send = (kind: Cmd["kind"], key?: string) => setCmd({ id: Math.random(), kind, key });
  const c = CHARS[cur];
  return (
    <Screen title={tr("圖鑑", "Gallery")} onBack={onBack} wide right={<Seg value={tab} onChange={setTab} options={[{ v: "char", label: tr("角色", "Characters") }, { v: "arena", label: tr("場地", "Arenas") }]} />}>
      {tab === "char" ? (
        <div className="h-full grid md:grid-cols-[110px_1fr_340px] gap-4">
          <div className="flex md:flex-col gap-2 overflow-auto">
            {CHARS.map((ch) => <button key={ch.id} onClick={() => setCur(ch.id)} className={`rounded-2xl transition ${cur === ch.id ? "card-sel scale-105" : "opacity-70 hover:opacity-100"}`}><Portrait id={ch.id} size={86} /></button>)}
          </div>
          <div className="panel relative overflow-hidden min-h-[360px]" style={{ background: `radial-gradient(circle at 50% 40%, ${c.css}88, rgba(24,12,60,.85) 70%)` }}>
            <CharViewer charId={cur} cmd={cmd} className="absolute inset-0" />
            <div className="absolute bottom-3 left-0 right-0 flex flex-wrap gap-2 justify-center px-2">
              <Btn small color="#4ade80" text="#10381f" onClick={() => send("win")}>{tr("勝利姿勢", "Victory pose")}</Btn>
              {MOVE_ORDER.map(([k]) => <Btn key={k} small color={k === "ult" ? "#ffd24a" : "#6d5bd0"} text={k === "ult" ? "#1d0f45" : "#fff"} onClick={() => send("move", k)}>{tr(c.moves[k].name, c.moves[k].en)}</Btn>)}
            </div>
          </div>
          <div className="panel p-4 overflow-auto"><CharInfo id={cur} /><div className="text-xs text-white/60 mt-3 italic">「{tr(c.quote[0], c.quote[1])}」</div></div>
        </div>
      ) : (
        <div className="h-full grid md:grid-cols-[1fr_340px] gap-4">
          <div className="panel p-3 flex flex-col gap-3">
            <div className="flex-1 rounded-xl overflow-hidden border-4 border-[#1d0f45] min-h-[240px]" style={{ background: ARENAS[ar].css }}>{thumbs[ar] && <img src={thumbs[ar]} className="w-full h-full object-cover" draggable={false} />}</div>
            <div className="grid grid-cols-3 gap-2">{ARENAS.map((a) => <button key={a.id} onClick={() => setAr(a.id)} className={`rounded-lg overflow-hidden border-4 transition ${ar === a.id ? "border-[#ffe14d]" : "border-transparent opacity-70"}`}>{thumbs[a.id] && <img src={thumbs[a.id]} className="w-full aspect-video object-cover" draggable={false} />}</button>)}</div>
          </div>
          <div className="panel p-4 text-white flex flex-col gap-3">
            <div className="text-3xl font-black">{tr(ARENAS[ar].name, ARENAS[ar].en)}</div>
            <div className="text-[#ffd24a] font-bold">{tr(ARENAS[ar].theme[0], ARENAS[ar].theme[1])}</div>
            <p className="text-white/85">{tr(ARENAS[ar].desc[0], ARENAS[ar].desc[1])}</p>
            <div className="bg-black/30 rounded-xl p-3 text-sm">⚠ {tr(ARENAS[ar].hazard[0], ARENAS[ar].hazard[1])}</div>
            <div className="text-sm text-white/70">{tr("擊飛邊界", "Blast zones")}: X ±{ARENAS[ar].blastX} · {tr("下", "Bottom")} -{ARENAS[ar].blastY} · {tr("上", "Top")} {ARENAS[ar].topY}</div>
          </div>
        </div>
      )}
    </Screen>
  );
}

export function Tutorial({ onBack }: { onBack: () => void }) {
  const { settings } = useStore();
  const k = settings.keys;
  const tips: [string, string][] = [
    [tr("傷害與擊飛", "Damage & knockback"), tr("本遊戲沒有血條：被打到會累積傷害%，百分比越高，被擊飛得越遠。把對手打出場地邊界（左右、上方、下方）就會損失一條殘機。", "No health bars: taking hits raises your damage %, and the higher it is the farther you fly. Knock foes past the blast zones to take a stock.")],
    [tr("跳躍與空戰", "Jumping & air"), tr("可二段跳；空中按住下可快速下落；站在浮台上按「下」可穿過浮台。", "Double jump is available; hold Down in air to fast-fall; press Down on a soft platform to drop through.")],
    [tr("攻擊方向", "Attack directions"), tr("普攻／重攻擊／必殺技搭配方向鍵會變化：上＋攻擊＝上挑、下＋攻擊＝下掃、左右＋攻擊＝前擊；空中另有前／後／上／下空中攻擊；必殺技＋上＝回場招式（空中只能用一次）。", "Directions change your attacks: Up/Down/Side + Attack for tilts, aerials in the air, Special + Up is your recovery (once per airtime).")],
    [tr("格擋與完美格擋", "Block & Perfect Block"), tr("按住格擋可擋下攻擊（護盾會消耗，破盾會暈眩）。在被擊中前一瞬間才按下格擋會觸發「完美格擋」，讓對手硬直並使你下一擊傷害 ×1.5（反擊）。", "Hold Block to absorb hits (shield drains; broken shield = stun). Blocking right before impact triggers a Perfect Block that staggers the attacker and gives your next hit ×1.5 (counter).")],
    [tr("閃避與抓取", "Dodge & Grab"), tr("閃避有短暫無敵（可配合方向翻滾，空中閃避一次）。抓取無法被格擋，但可被閃避；抓到後依方向鍵決定投擲方向。", "Dodge grants brief invincibility (roll with a direction; one air dodge). Grabs can't be blocked but can be dodged; hold a direction to choose the throw.")],
    [tr("究極奧義", "Ultimate"), tr("攻擊與被攻擊都會累積奧義條，集滿 100 後按奧義鍵發動，每位角色都有獨一無二的奧義！", "Dealing and taking damage fills the ultimate meter. At 100, unleash your character's unique ultimate!")],
    [tr("線上 1V1", "Online 1V1"), tr("一人建立房間取得 5 碼代碼，另一人輸入代碼加入；選好角色並按「準備」，房主即可開始。對戰中若斷線，會暫停最多 15 秒等待重連。", "One player creates a room and shares the 5-character code; the other joins. Pick characters, ready up, and the host starts. If someone disconnects, the match freezes up to 15 s for reconnection.")],
  ];
  return (
    <Screen title={tr("新手教學與操作說明", "Tutorial & Controls")} onBack={onBack}>
      <div className="grid md:grid-cols-[360px_1fr] gap-4">
        <div className="panel p-4 text-white">
          <div className="font-black text-xl mb-2">{tr("鍵盤操作（可於設定中改鍵）", "Keyboard controls (rebind in Settings)")}</div>
          <div className="flex flex-col gap-1.5">
            {ACTIONS.map((a) => <div key={a} className="flex justify-between items-center bg-black/25 rounded-lg px-3 py-1"><span className="text-sm">{tr(ACTION_LABEL[a][0], ACTION_LABEL[a][1])}</span><span className="kbd">{keyLabel(k[a])}</span></div>)}
            <div className="flex justify-between bg-black/25 rounded-lg px-3 py-1"><span className="text-sm">{tr("方向鍵（輔助移動）", "Arrow keys (alt movement)")}</span><span className="kbd">← ↑ ↓ →</span></div>
            <div className="flex justify-between bg-black/25 rounded-lg px-3 py-1"><span className="text-sm">{tr("暫停／選單", "Pause / menu")}</span><span className="kbd">Esc</span></div>
            <div className="flex justify-between bg-black/25 rounded-lg px-3 py-1"><span className="text-sm">{tr("重置位置（訓練）", "Reset positions (training)")}</span><span className="kbd">R</span></div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {tips.map(([t, d]) => <div key={t} className="panel p-3 text-white"><div className="font-black text-[#ffd24a]">{t}</div><div className="text-sm text-white/85 leading-relaxed">{d}</div></div>)}
        </div>
      </div>
    </Screen>
  );
}
