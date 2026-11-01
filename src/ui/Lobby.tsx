import { useState } from "react";
import { ARENAS, CHARS, MatchConfig, tr } from "../game/data";
import { room, useRoom, LobbyPlayer } from "../game/net";
import { getProfile, getSettings } from "../game/store";
import { fullShots } from "../game/snap";
import { audio } from "../game/audio";
import { Btn, Portrait, Screen, Spinner } from "./common";
import { ArenaSelect, CharSelect } from "./Select";
import { RulesEditor } from "./Setup";

function Slot({ p, idx, me, host }: { p: LobbyPlayer | null; idx: number; me: boolean; host: boolean }) {
  if (!p) {
    return (
      <div className="panel border-dashed p-4 flex flex-col items-center justify-center gap-3 text-white/70 min-h-[300px]">
        <Spinner />
        <div className="font-black text-lg">{tr("空位", "Empty slot")} · P{idx + 1}</div>
        <div className="text-sm text-center">{tr("等待玩家輸入房間代碼加入…", "Waiting for a player to join with the room code…")}</div>
      </div>
    );
  }
  const c = CHARS[p.char];
  return (
    <div className="panel p-4 flex flex-col items-center gap-2 relative min-h-[300px]" style={{ borderColor: p.ready ? "#4ade80" : "rgba(255,255,255,.18)", background: `linear-gradient(180deg, ${c.css}33, rgba(24,12,60,.75))` }}>
      <div className="absolute top-2 left-3 text-sm font-black px-2 rounded-md text-white border-2 border-[#1d0f45]" style={{ background: idx === 0 ? "#ff4d6d" : "#3d8bff" }}>P{idx + 1}</div>
      {host && <div className="absolute top-2 right-3 text-sm font-black px-2 rounded-md bg-[#ffd24a] text-[#1d0f45] border-2 border-[#1d0f45]">👑 {tr("房主", "HOST")}</div>}
      <div className="h-44 flex items-end">{fullShots[p.char] ? <img src={fullShots[p.char]} className="h-full object-contain floaty" draggable={false} /> : <Portrait id={p.char} size={120} />}</div>
      <div className="text-2xl font-black text-white flex items-center gap-2">{p.name}{me && <span className="text-xs px-1.5 rounded bg-[#ffe14d] text-[#1d0f45]">{tr("你", "YOU")}</span>}</div>
      <div className="text-sm font-bold" style={{ color: c.css }}>{tr(c.name, c.en)} · {tr(c.role[0], c.role[1])}</div>
      <div className="flex gap-2 items-center">
        <span className={`text-xs font-black px-3 py-1 rounded-full border-2 border-[#1d0f45] ${p.ready ? "bg-[#4ade80] text-[#10381f]" : "bg-gray-500 text-white"}`}>{p.ready ? "✔ " + tr("準備完成", "READY") : tr("未準備", "NOT READY")}</span>
        <span className={`text-xs font-bold ${p.connected ? "text-green-300" : "text-red-300"}`}>● {p.connected ? tr("已連線", "Connected") : tr("已斷線", "Disconnected")}</span>
      </div>
    </div>
  );
}

export function OnlineScreen({ onBack, onStart }: { onBack: () => void; onStart: (cfg: MatchConfig) => void }) {
  const r = useRoom();
  const [view, setView] = useState<"main" | "char" | "arena">("main");
  const [tab, setTab] = useState<"create" | "join">("create");
  const [code, setCode] = useState("");
  const [roomName, setRoomName] = useState("");
  const [copied, setCopied] = useState(false);
  const prof = getProfile();
  const st = getSettings();

  const inRoom = r.role !== null && (r.status === "waiting" || r.status === "connected" || r.status === "reconnecting");

  // ---------- hub ----------
  if (!inRoom) {
    const connecting = r.status === "connecting";
    const dead = r.status === "closed" || r.status === "error";
    return (
      <Screen title={tr("線上 1V1 對戰", "Online 1V1")} onBack={() => { room.reset(); onBack(); }}>
        <div className="max-w-2xl mx-auto panel p-6 flex flex-col gap-4 text-white mt-4">
          <div className="flex gap-2">
            <Btn color={tab === "create" ? "#ff4fa0" : "#4b3a8a"} onClick={() => setTab("create")}>{tr("建立房間", "Create Room")}</Btn>
            <Btn color={tab === "join" ? "#3d8bff" : "#4b3a8a"} onClick={() => setTab("join")}>{tr("加入房間", "Join Room")}</Btn>
          </div>
          <div className="flex items-center gap-3 bg-black/25 rounded-xl p-3">
            <Portrait id={prof.avatar} size={56} />
            <div><div className="text-sm text-white/60">{tr("你的暱稱（可到玩家檔案修改）", "Your nickname (edit in Profile)")}</div><div className="font-black text-xl">{prof.name}</div></div>
          </div>
          {tab === "create" ? (
            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold">{tr("房間名稱", "Room name")}</label>
              <input value={roomName} maxLength={16} onChange={(e) => setRoomName(e.target.value)} placeholder={prof.name + tr("的房間", "'s room")} className="px-4 py-3 rounded-xl bg-white/10 border-2 border-white/30 text-white font-bold outline-none focus:border-[#ffd24a]" />
              <Btn big disabled={connecting} color="#ff4fa0" onClick={() => room.createRoom({ name: prof.name, avatar: prof.avatar }, roomName.trim(), st.rules, st.defArena, st.defChar)}>{connecting ? tr("建立中…", "Creating…") : tr("建立房間並產生代碼", "Create room & get code")}</Btn>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold">{tr("房間代碼（5 碼）", "Room code (5 chars)")}</label>
              <input value={code} maxLength={5} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCDE" className="px-4 py-3 rounded-xl bg-white/10 border-2 border-white/30 text-white font-black text-3xl tracking-[0.4em] text-center outline-none focus:border-[#ffd24a]" />
              <Btn big disabled={connecting || code.trim().length < 5} color="#3d8bff" onClick={() => room.joinRoom(code, { name: prof.name, avatar: prof.avatar }, st.defChar)}>{connecting ? tr("連線中…", "Connecting…") : tr("加入房間", "Join room")}</Btn>
            </div>
          )}
          {connecting && <div className="flex items-center gap-3 text-[#ffd24a] font-bold"><Spinner />{tr("正在連線，請稍候…", "Connecting, please wait…")}<Btn small color="#ff4d6d" onClick={() => room.reset()}>{tr("取消", "Cancel")}</Btn></div>}
          {dead && r.error && <div className="bg-red-900/50 border-2 border-red-400 rounded-xl p-3 text-red-100 font-bold">⚠ {r.error}</div>}
          <div className="text-xs text-white/60 leading-relaxed">
            {tr("連線方式：WebRTC 點對點（P2P），透過公共 PeerJS 信令服務建立連線，之後資料直接在兩位玩家間傳輸。限制：無自架 TURN 伺服器，極少數嚴格 NAT／公司網路可能無法連線。1V1 僅限兩位玩家。", "Connection: WebRTC peer-to-peer; the public PeerJS broker is only used for signalling. Limitation: no TURN relay, so very strict NATs/corporate networks may fail. 1V1 supports exactly two players.")}
          </div>
        </div>
      </Screen>
    );
  }

  // ---------- lobby ----------
  const L = r.lobby;
  const isHost = r.role === "host";
  const me = L.players[r.myIdx];
  const guest = L.players[1];
  if (view === "char") return <CharSelect title={tr("選擇你的角色", "Choose Your Fighter")} tag={`P${r.myIdx + 1}`} initial={me?.char ?? 0} onBack={() => setView("main")} onConfirm={(id) => { room.setMe({ char: id, ready: isHost }); setView("main"); }} />;
  if (view === "arena") return <ArenaSelect title={tr("選擇場地", "Choose Arena")} initial={L.arena} onBack={() => setView("main")} onConfirm={(id) => { room.setConfig({ arena: id }); setView("main"); }} />;

  const start = () => { const cfg = room.startMatch(); if (cfg) { audio.sfx("confirm"); onStart(cfg); } };
  const statusChip = r.status === "reconnecting" ? { t: tr("重新連線中…", "Reconnecting…"), c: "#ffb020" } : r.status === "waiting" ? { t: tr("等待對手", "Waiting for opponent"), c: "#ffd24a" } : { t: tr("已連線", "Connected"), c: "#4ade80" };
  return (
    <Screen title={`${L.roomName || tr("房間", "Room")}`} onBack={() => { room.leave(); onBack(); }} right={
      <div className="flex items-center gap-3 text-white font-bold">
        <span className="px-3 py-1 rounded-full text-[#1d0f45] text-sm" style={{ background: statusChip.c }}>{statusChip.t}</span>
        {r.status === "connected" && <span className="text-sm">📶 {r.ping} ms</span>}
      </div>
    }>
      <div className="flex flex-col gap-4">
        <div className="panel p-3 flex items-center gap-4 flex-wrap text-white">
          <div className="text-sm text-white/70">{tr("房間代碼", "Room code")}</div>
          <div className="text-4xl font-black tracking-[0.3em] text-[#ffd24a]" style={{ textShadow: "0 3px 0 #1d0f45" }}>{r.code}</div>
          <Btn small color="#3d8bff" onClick={() => { navigator.clipboard?.writeText(r.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => undefined); }}>{copied ? "✔ " + tr("已複製", "Copied") : tr("複製代碼", "Copy")}</Btn>
          <div className="text-sm text-white/70 ml-auto">{tr("把代碼傳給朋友，讓他在「加入房間」輸入即可。", "Share this code with a friend to join.")}</div>
        </div>
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
          <Slot p={L.players[0]} idx={0} me={r.myIdx === 0} host />
          <div className="hidden md:flex items-center text-5xl font-black text-[#ffd24a] title-stroke">VS</div>
          <Slot p={guest} idx={1} me={r.myIdx === 1} host={false} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="panel p-4 text-white">
            <div className="flex items-center justify-between mb-2"><div className="font-black text-xl">{tr("場地", "Arena")}</div>{isHost && <Btn small color="#ff4fa0" onClick={() => setView("arena")}>{tr("更換場地", "Change")}</Btn>}</div>
            <div className="flex gap-3 items-center"><div className="w-40 aspect-video rounded-lg overflow-hidden border-2 border-[#1d0f45]" style={{ background: ARENAS[L.arena].css }}>{fullShots.length >= 0 && <ArenaThumb id={L.arena} />}</div>
              <div><div className="font-black text-lg">{tr(ARENAS[L.arena].name, ARENAS[L.arena].en)}</div><div className="text-xs text-white/70">{tr(ARENAS[L.arena].hazard[0], ARENAS[L.arena].hazard[1])}</div></div></div>
            <div className="font-black text-xl mt-4 mb-1">{tr("比賽規則", "Match rules")} {!isHost && <span className="text-xs text-white/60 font-bold">({tr("由房主設定", "set by host")})</span>}</div>
            <RulesEditor rules={L.rules} readOnly={!isHost} onChange={(rules) => room.setConfig({ rules })} />
          </div>
          <div className="panel p-4 flex flex-col gap-3 text-white">
            <div className="font-black text-xl">{tr("準備", "Ready up")}</div>
            <Btn color="#ff4fa0" onClick={() => setView("char")}>{tr("選擇角色", "Choose character")}（{me ? tr(CHARS[me.char].name, CHARS[me.char].en) : "-"}）</Btn>
            {!isHost && <Btn color={me?.ready ? "#ffb020" : "#4ade80"} text={me?.ready ? "#1d0f45" : "#10381f"} onClick={() => room.setMe({ ready: !me?.ready })}>{me?.ready ? tr("取消準備", "Cancel ready") : tr("準備！", "Ready!")}</Btn>}
            {isHost && <Btn big disabled={!room.canStart()} color="#4ade80" text="#10381f" sound="confirm" onClick={start}>▶ {tr("開始對戰", "Start match")}</Btn>}
            {isHost && !room.canStart() && <div className="text-xs text-white/70">{!guest ? tr("需要另一位玩家加入。", "Need a second player.") : !guest.ready ? tr("等待對手按下「準備」。", "Waiting for opponent to ready up.") : tr("連線不穩，請稍候…", "Connection unstable, please wait…")}</div>}
            {!isHost && <div className="text-xs text-white/70">{tr("只有房主可以開始對戰、更換場地與規則。", "Only the host can start the match or change arena/rules.")}</div>}
            <Btn color="#ff4d6d" className="mt-auto" onClick={() => { room.leave(); onBack(); }}>{tr("離開房間", "Leave room")}</Btn>
            {r.status === "reconnecting" && <div className="text-[#ffb020] text-sm font-bold">{tr("對手連線中斷，等待重新連線…", "Opponent dropped, waiting for reconnect…")}</div>}
          </div>
        </div>
      </div>
    </Screen>
  );
}

import { thumbs } from "../game/snap";
function ArenaThumb({ id }: { id: number }) {
  return thumbs[id] ? <img src={thumbs[id]} className="w-full h-full object-cover" draggable={false} /> : null;
}
