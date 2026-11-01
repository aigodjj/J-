import { useEffect, useState } from "react";
import { ARENAS, CHARS, MatchResult, tr } from "../game/data";
import { Btn, Portrait, Screen } from "./common";
import { CharViewer, Cmd } from "./views3d";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function Results({ r, online, onAgain, onChange, onLobby, onMenu }: { r: MatchResult; online: boolean; onAgain?: () => void; onChange?: () => void; onLobby?: () => void; onMenu: () => void }) {
  const me = r.localSlot;
  const aborted = r.reason === "aborted";
  const draw = r.winner < 0;
  const won = r.winner === me;
  const order = draw ? [0, 1] : [r.winner, 1 - r.winner];
  const wChar = r.players[draw ? me : r.winner].charId;
  const [cmd, setCmd] = useState<Cmd | undefined>();
  useEffect(() => { const t = setTimeout(() => setCmd({ id: 1, kind: "win" }), 500); const t2 = setInterval(() => setCmd({ id: Math.random(), kind: "win" }), 3500); return () => { clearTimeout(t); clearInterval(t2); }; }, []);
  const title = aborted ? tr("連線中斷", "DISCONNECTED") : draw ? tr("平手", "DRAW") : won ? tr("勝利！", "VICTORY!") : tr("敗北…", "DEFEAT…");
  const color = aborted ? "#ffb020" : draw ? "#ffd24a" : won ? "#4ade80" : "#ff6a6a";
  const reason = { ko: tr("擊倒所有殘機", "All stocks eliminated"), time: tr("時間到，依殘機與傷害判定", "Time up – decided by stocks & damage"), forfeit: tr("對手斷線，判定獲勝", "Opponent disconnected – win by forfeit"), aborted: tr("與對手的連線中斷，本場不計入戰績", "Connection lost – match not recorded") }[r.reason];
  return (
    <Screen title={tr("對戰結果", "Match Results")} wide>
      <div className="h-full grid md:grid-cols-[minmax(260px,1fr)_minmax(320px,1.3fr)] gap-4 max-w-6xl mx-auto">
        <div className="panel relative overflow-hidden min-h-[300px]" style={{ background: `radial-gradient(circle at 50% 40%, ${CHARS[wChar].css}99, rgba(24,12,60,.85) 70%)` }}>
          <CharViewer charId={wChar} cmd={cmd} cycle={false} className="absolute inset-0" />
          <div className="absolute top-3 left-0 right-0 text-center">
            <div className="text-6xl font-black pop-in" style={{ color, WebkitTextStroke: "3px #1d0f45", paintOrder: "stroke fill", textShadow: "0 6px 0 #1d0f45" }}>{title}</div>
            {!aborted && !draw && <div className="mt-1 text-white font-bold bg-black/40 inline-block px-3 rounded-full">「{tr(CHARS[wChar].quote[0], CHARS[wChar].quote[1])}」</div>}
          </div>
        </div>
        <div className="flex flex-col gap-3 min-h-0 overflow-auto">
          <div className="panel p-3 text-white text-sm flex flex-wrap gap-x-6 gap-y-1">
            <span>⏱ {tr("對戰時間", "Duration")}：<b>{fmt(r.dur)}</b></span>
            <span>🏟 {tr(ARENAS[r.arena].name, ARENAS[r.arena].en)}</span>
            <span className="text-white/70">{reason}</span>
          </div>
          {order.map((slot, rank) => {
            const p = r.players[slot];
            const mine = slot === me;
            return (
              <div key={slot} className="panel p-3 flex items-center gap-4 slide-up" style={{ animationDelay: rank * 0.15 + "s", borderColor: mine ? "#ffe14d" : undefined }}>
                <div className="text-4xl font-black w-14 text-center" style={{ color: draw ? "#ffd24a" : rank === 0 ? "#ffd24a" : "#cbd5e1" }}>{draw ? "=" : rank === 0 ? "1st" : "2nd"}</div>
                <Portrait id={p.charId} size={72} ring={slot === 0 ? "#ff4d6d" : "#3d8bff"} />
                <div className="flex-1 text-white">
                  <div className="font-black text-lg flex items-center gap-2">{p.name}{mine && <span className="text-xs px-1.5 rounded bg-[#ffe14d] text-[#1d0f45]">{tr("你", "YOU")}</span>}
                    <span className="text-xs font-bold px-2 rounded-full" style={{ background: r.winner === slot ? "#4ade80" : draw ? "#ffd24a" : "#64748b", color: "#10181f" }}>{draw ? tr("平手", "Draw") : r.winner === slot ? tr("勝利", "Victory") : tr("敗北", "Defeat")}</span></div>
                  <div className="text-sm" style={{ color: CHARS[p.charId].css }}>{tr(CHARS[p.charId].name, CHARS[p.charId].en)}</div>
                  <div className="grid grid-cols-4 gap-2 mt-1 text-center">
                    {[[tr("造成傷害", "Damage dealt"), p.dmg + "%"], [tr("擊倒 KO", "KOs"), p.kos], [tr("被淘汰", "Falls"), p.falls], [tr("剩餘殘機", "Stocks left"), p.lives]].map(([k, v]) => (
                      <div key={String(k)} className="bg-black/30 rounded-lg py-1"><div className="text-[10px] text-white/60">{k}</div><div className="font-black text-lg">{v}</div></div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="flex gap-2 flex-wrap mt-auto pt-2">
            {online ? (
              <>
                <Btn color="#4ade80" text="#10381f" sound="confirm" onClick={onLobby}>↺ {tr("回到大廳（再玩一次／換角色）", "Back to lobby (rematch / change)")}</Btn>
                <Btn color="#ff4d6d" onClick={onMenu}>{tr("離開並回主選單", "Leave to menu")}</Btn>
              </>
            ) : (
              <>
                <Btn color="#4ade80" text="#10381f" sound="confirm" onClick={onAgain}>↺ {tr("再玩一次", "Play again")}</Btn>
                <Btn color="#ff4fa0" onClick={onChange}>{tr("更換角色", "Change characters")}</Btn>
                <Btn color="#3d8bff" onClick={onLobby}>{tr("模式選單", "Mode menu")}</Btn>
                <Btn color="#ffd24a" text="#1d0f45" onClick={onMenu}>{tr("主選單", "Main menu")}</Btn>
              </>
            )}
          </div>
        </div>
      </div>
    </Screen>
  );
}
