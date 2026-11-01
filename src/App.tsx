import { Component, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ARENAS, MatchConfig, MatchResult, tr } from "./game/data";
import { generateAssets } from "./game/snap";
import { audio } from "./game/audio";
import { recordMatch, updateSettings, useStore } from "./game/store";
import { room } from "./game/net";
import { Btn, Screen, Spinner } from "./ui/common";
import { MainMenu, Dest } from "./ui/Menu";
import { ArenaSelect, CharSelect } from "./ui/Select";
import { OfflineFlow } from "./ui/Setup";
import { OnlineScreen } from "./ui/Lobby";
import { Battle } from "./ui/Battle";
import { Results } from "./ui/Results";
import { Gallery, ProfilePage, Tutorial } from "./ui/Pages";
import { SettingsScreen } from "./ui/SettingsScreen";

type Scr = "loading" | "menu" | Dest | "battle" | "results";

class Boundary extends Component<{ children: ReactNode; onReset: () => void }, { err: string }> {
  state = { err: "" };
  static getDerivedStateFromError(e: unknown) { return { err: String(e) }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="absolute inset-0 bg-candy flex flex-col items-center justify-center gap-4 text-white p-8 text-center">
        <div className="text-3xl font-black">{tr("發生錯誤", "Something went wrong")}</div>
        <div className="text-xs opacity-70 max-w-xl break-all">{this.state.err}</div>
        <Btn onClick={() => { this.setState({ err: "" }); this.props.onReset(); }}>{tr("返回主選單", "Back to menu")}</Btn>
      </div>
    );
  }
}

export default function App() {
  const { settings } = useStore();
  const [scr, setScr] = useState<Scr>("loading");
  const [prog, setProg] = useState(0);
  const [ready, setReady] = useState(false);
  const [battle, setBattle] = useState<{ cfg: MatchConfig; key: number } | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [toast, setToast] = useState("");
  const scrRef = useRef<Scr>("loading"); scrRef.current = scr;
  const [errKey, setErrKey] = useState(0);

  useEffect(() => {
    void generateAssets(setProg).then(() => setReady(true));
    const unlock = () => { audio.init(); audio.applyVolumes(); audio.resumeMusic(); };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);

  // Background music: MP3 files from /public/audio.
  // Results are intentionally silent; OfflineFlow controls its own nested setup steps.
  // Background music: MP3 files from /public/audio.
useEffect(() => {
  audio.applyVolumes();

  if (scr === "loading") {
    audio.stopMusic();
    return;
  }

  // 結算畫面：依照本機玩家的比賽結果播放音樂
  if (scr === "results") {
    if (!result || result.reason === "aborted" || result.winner < 0) {
      audio.stopMusic();
    } else if (result.winner === result.localSlot) {
      audio.playMusic("victory");
    } else {
      audio.playMusic("defeat");
    }
    return;
  }

  if (scr === "battle") {
    if (!battle) {
      audio.stopMusic();
    } else if (battle.cfg.mode === "training") {
      audio.playMusic("training");
    } else {
      audio.playMusic(`arena${battle.cfg.arena}`);
    }
    return;
  }

  if (scr === "charsel") {
    audio.playMusic("character-select");
    return;
  }

  if (scr === "cpu" || scr === "training") {
    // OfflineFlow switches between character-select and setup music.
    return;
  }

  audio.playMusic("menu");
}, [
  scr,
  result?.winner,
  result?.localSlot,
  result?.reason,
  battle?.cfg.mode,
  battle?.cfg.arena,
  settings.master,
  settings.music,
]);

  useEffect(() => { audio.applyVolumes(); }, [settings.master, settings.music, settings.sfx]);

  const startBattle = useCallback((cfg: MatchConfig) => {
    setBattle((b) => ({ cfg, key: (b?.key ?? 0) + 1 }));
    setScr("battle");
  }, []);

  // Guest receives "start" from host.
  useEffect(() => {
    const off = room.on("start", (m) => {
      if (room.role !== "guest" || scrRef.current === "battle") return;
      startBattle({ ...m.cfg, localSlot: 1 });
    });
    return () => { off(); };
  }, [startBattle]);

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2200); };

  const onEnd = (r: MatchResult) => {
    recordMatch(r);
    if (r.mode === "online") room.endMatch();
    setResult(r);
    setScr("results");
  };
  const toMenu = () => { if (battle?.cfg.mode === "online" || room.role) room.leave(); setScr("menu"); };

  let body: ReactNode = null;
  switch (scr) {
    case "loading":
      body = (
        <div className="absolute inset-0 bg-candy bg-grid flex flex-col items-center justify-center gap-6 text-white">
          <div className="text-7xl md:text-8xl font-black title-stroke text-center leading-tight floaty">J群斜咖<br />大亂鬥</div>
          <div className="w-80 h-5 rounded-full bg-black/40 border-[3px] border-[#1d0f45] overflow-hidden"><div className="h-full bg-[#ff4fa0] transition-all" style={{ width: prog * 100 + "%" }} /></div>
          {ready ? <Btn big color="#4ade80" text="#10381f" sound="confirm" onClick={() => { audio.init(); audio.playMusic("menu"); setScr("menu"); }}>▶ {tr("點擊開始", "Click to Start")}</Btn> : <div className="flex items-center gap-3 font-bold"><Spinner />{tr("載入 3D 角色與場地中…", "Loading 3D characters & arenas…")}</div>}
          <div className="text-xs text-white/60">{tr("建議使用桌面版 Chrome / Edge / Firefox，並使用鍵盤遊玩", "Best on desktop Chrome/Edge/Firefox with a keyboard")}</div>
        </div>
      );
      break;
    case "menu": body = <MainMenu go={(d) => setScr(d)} />; break;
    case "cpu": case "training":
      body = <OfflineFlow key={scr} mode={scr} onBack={() => setScr("menu")} onStart={startBattle} />; break;
    case "online": body = <OnlineScreen onBack={() => setScr("menu")} onStart={startBattle} />; break;
    case "charsel":
      body = <CharSelect title={tr("角色選擇（設為預設角色）", "Characters (set default)")} tag="P1" initial={settings.defChar} onBack={() => setScr("menu")} confirmText={tr("設為預設角色", "Set as default")}
        onConfirm={(id) => { updateSettings({ defChar: id }); flash(tr("已設定預設角色！", "Default character set!")); setScr("menu"); }} />;
      break;
    case "arenasel":
      body = <ArenaSelect title={tr("場地選擇（設為預設場地）", "Arenas (set default)")} initial={settings.defArena} onBack={() => setScr("menu")}
        onConfirm={(id) => { updateSettings({ defArena: id }); flash(tr(`預設場地：${ARENAS[id].name}`, `Default arena: ${ARENAS[id].en}`)); setScr("menu"); }} />;
      break;
    case "profile": body = <ProfilePage onBack={() => setScr("menu")} />; break;
    case "gallery": body = <Gallery onBack={() => setScr("menu")} />; break;
    case "settings": body = <SettingsScreen onBack={() => setScr("menu")} />; break;
    case "tutorial": body = <Tutorial onBack={() => setScr("menu")} />; break;
    case "battle":
      body = battle ? (
        <Battle key={battle.key} cfg={battle.cfg} onEnd={onEnd}
          onExit={() => { if (battle.cfg.mode === "online") { room.leave(); setScr("menu"); } else setScr(battle.cfg.mode); }}
          onRestart={() => startBattle(battle.cfg)} />
      ) : null;
      break;
    case "results":
      body = result && battle ? (
        <Results r={result} online={result.mode === "online"}
          onAgain={() => startBattle(battle.cfg)}
          onChange={() => setScr(battle.cfg.mode === "training" ? "training" : "cpu")}
          onLobby={() => (result.mode === "online" ? setScr("online") : setScr("menu"))}
          onMenu={toMenu} />
      ) : <Screen title="" onBack={() => setScr("menu")}>{null}</Screen>;
      break;
  }
  return (
    <div className="absolute inset-0 overflow-hidden text-white">
      <Boundary key={errKey} onReset={() => { setErrKey((k) => k + 1); setScr("menu"); }}>{body}</Boundary>
      {toast && <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-[#4ade80] text-[#10381f] font-black px-6 py-2 rounded-full border-[3px] border-[#1d0f45] pop-in">{toast}</div>}
    </div>
  );
}
