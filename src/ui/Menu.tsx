import { useState } from "react";
import { tr, CHARS } from "../game/data";
import { useStore } from "../game/store";
import { audio } from "../game/audio";
import { Btn, Portrait, Screen, useKey } from "./common";
import { Showcase } from "./views3d";

export type Dest = "online" | "cpu" | "training" | "charsel" | "arenasel" | "profile" | "gallery" | "settings" | "tutorial";

export function MainMenu({ go }: { go: (d: Dest) => void }) {
  const { profile } = useStore();
  const [modes, setModes] = useState(false);
  const [idx, setIdx] = useState(0);
  const items: { label: string; sub: string; icon: string; color: string; act: () => void }[] = [
    { label: tr("開始遊戲", "Play"), sub: "PLAY", icon: "▶", color: "#ff4fa0", act: () => setModes(true) },
    { label: tr("線上 1V1", "Online 1V1"), sub: "ONLINE", icon: "🌐", color: "#3d8bff", act: () => go("online") },
    { label: tr("對戰 CPU", "VS CPU"), sub: "VS CPU", icon: "🤖", color: "#a855f7", act: () => go("cpu") },
    { label: tr("訓練模式", "Training"), sub: "TRAINING", icon: "🥊", color: "#10b981", act: () => go("training") },
    { label: tr("角色選擇", "Characters"), sub: "CHARACTERS", icon: "🐾", color: "#f59e0b", act: () => go("charsel") },
    { label: tr("場地選擇", "Arenas"), sub: "ARENAS", icon: "🏝", color: "#06b6d4", act: () => go("arenasel") },
    { label: tr("玩家檔案", "Profile"), sub: "PROFILE", icon: "👤", color: "#ec4899", act: () => go("profile") },
    { label: tr("圖鑑", "Gallery"), sub: "GALLERY", icon: "🖼", color: "#84cc16", act: () => go("gallery") },
    { label: tr("設定", "Settings"), sub: "SETTINGS", icon: "⚙", color: "#64748b", act: () => go("settings") },
    { label: tr("教學", "Tutorial"), sub: "HOW TO PLAY", icon: "❓", color: "#ef4444", act: () => go("tutorial") },
  ];
  useKey((e) => {
    if (modes) return;
    if (e.code === "ArrowDown" || e.code === "KeyS") { audio.sfx("hover"); setIdx((i) => (i + 2) % items.length); }
    else if (e.code === "ArrowUp" || e.code === "KeyW") { audio.sfx("hover"); setIdx((i) => (i - 2 + items.length) % items.length); }
    else if (e.code === "ArrowRight" || e.code === "KeyD") { audio.sfx("hover"); setIdx((i) => (i + 1) % items.length); }
    else if (e.code === "ArrowLeft" || e.code === "KeyA") { audio.sfx("hover"); setIdx((i) => (i - 1 + items.length) % items.length); }
    else if (e.code === "Enter" || e.code === "Space") { audio.sfx("confirm"); items[idx].act(); }
  });
  if (modes) {
    const cards: [string, string, string, string, Dest][] = [
      [tr("線上 1V1", "Online 1V1"), tr("建立房間或輸入代碼，和朋友即時對戰", "Create or join a room and fight a friend in real time"), "🌐", "#3d8bff", "online"],
      [tr("對戰 CPU", "VS CPU"), tr("五種難度的 CPU 對手，自訂規則", "Five CPU difficulties with custom rules"), "🤖", "#a855f7", "cpu"],
      [tr("訓練模式", "Training"), tr("無淘汰練習招式，顯示傷害與擊飛資訊", "Practice moves with damage & knockback info"), "🥊", "#10b981", "training"],
    ];
    return (
      <Screen title={tr("選擇模式", "Select Mode")} onBack={() => setModes(false)}>
        <div className="grid md:grid-cols-3 gap-5 mt-6">
          {cards.map(([t, d, ic, c, dest]) => (
            <button key={dest} onMouseEnter={() => audio.sfx("hover")} onClick={() => { audio.sfx("confirm"); go(dest); }} className="panel p-6 flex flex-col items-center gap-3 text-white hover:scale-105 transition-transform" style={{ borderColor: c }}>
              <div className="text-7xl floaty">{ic}</div><div className="text-3xl font-black" style={{ color: c }}>{t}</div><div className="text-sm text-white/80 text-center">{d}</div>
            </button>
          ))}
        </div>
        <div className="flex justify-center mt-6"><Btn color="#ef4444" onClick={() => go("tutorial")}>❓ {tr("新手教學", "Tutorial")}</Btn></div>
      </Screen>
    );
  }
  return (
    <div className="absolute inset-0 bg-candy bg-grid overflow-hidden fade-in">
      <Showcase className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#1c1040]/80 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 flex flex-col md:flex-row p-4 md:p-8 gap-4 overflow-auto">
        <div className="flex flex-col gap-3 md:w-[430px] shrink-0">
          <div className="slide-up">
            <div className="text-6xl md:text-7xl font-black title-stroke leading-[1.05]">J群斜咖<br />大亂鬥</div>
            <div className="mt-3 text-white/90 font-black tracking-[0.3em] text-sm bg-[#ff4fa0] inline-block px-3 py-1 rounded-lg border-2 border-[#1d0f45]">J-GROUP BRAWL</div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {items.map((it, i) => (
              <button key={it.sub} onMouseEnter={() => { setIdx(i); audio.sfx("hover"); }} onClick={() => { audio.init(); audio.sfx("confirm"); it.act(); }}
                className={`btn-chunk flex items-center gap-2 px-3 py-2.5 text-left text-white slide-up ${i === 0 ? "col-span-2 py-4" : ""} ${idx === i ? "scale-105 !brightness-110 ring-4 ring-white/70" : ""}`}
                style={{ background: it.color, animationDelay: i * 0.04 + "s" }}>
                <span className={`${i === 0 ? "text-3xl" : "text-xl"}`}>{it.icon}</span>
                <span><span className={`block font-black ${i === 0 ? "text-3xl" : "text-lg"}`}>{it.label}</span><span className="block text-[10px] opacity-70 tracking-widest">{it.sub}</span></span>
              </button>
            ))}
          </div>
          <div className="text-xs text-white/60">{tr("↑↓←→ 選擇　Enter 確認　全程支援鍵盤與滑鼠", "Arrows to select · Enter to confirm · mouse works too")}</div>
        </div>
        <div className="md:ml-auto self-end md:self-start flex items-center gap-3 panel px-3 py-2 text-white cursor-pointer hover:scale-105 transition-transform" onClick={() => { audio.sfx("click"); go("profile"); }}>
          <Portrait id={profile.avatar} size={46} />
          <div><div className="font-black">{profile.name}</div><div className="text-xs text-white/70">{tr("勝", "W")} {profile.wins} · {tr("敗", "L")} {profile.losses} · {tr("訪客模式", "Guest")}</div></div>
        </div>
      </div>
      <div className="absolute bottom-2 right-4 text-[11px] text-white/50 pointer-events-none">{CHARS.map((c) => tr(c.name, c.en)).join(" · ")}</div>
    </div>
  );
}
