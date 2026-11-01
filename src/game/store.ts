import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, DEFAULT_KEYS, DEFAULT_RULES, Settings, setLang, MatchResult } from "./data";

const SKEY = "jqun-brawl-settings-v1";
const PKEY = "jqun-brawl-profile-v1";

export interface HistoryItem {
  ts: number; mode: string; myChar: number; oppChar: number; oppName: string; result: "win" | "loss" | "draw"; dur: number; dmg: number; arena: number;
}
export interface Profile {
  name: string; avatar: number; played: number; wins: number; losses: number;
  usage: number[]; charWins: number[]; history: HistoryItem[]; totalDmg: number; totalKos: number;
}
const DEFAULT_PROFILE: Profile = {
  name: "訪客" + Math.floor(Math.random() * 900 + 100), avatar: 0, played: 0, wins: 0, losses: 0,
  usage: [0, 0, 0, 0, 0, 0], charWins: [0, 0, 0, 0, 0, 0], history: [], totalDmg: 0, totalKos: 0,
};

function load<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(def);
    return { ...structuredClone(def), ...JSON.parse(raw) };
  } catch {
    return structuredClone(def);
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable: progress will not persist */
  }
}

let settings: Settings = load(SKEY, DEFAULT_SETTINGS);
settings.keys = { ...DEFAULT_KEYS, ...settings.keys };
settings.rules = { ...DEFAULT_RULES, ...settings.rules };
let profile: Profile = load(PKEY, DEFAULT_PROFILE);
save(PKEY, profile);
setLang(settings.lang);

const subs = new Set<() => void>();
let ver = 0;
const emit = () => {
  ver++;
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

export const getSettings = () => settings;
export const getProfile = () => profile;
export function updateSettings(p: Partial<Settings>) {
  settings = { ...settings, ...p };
  setLang(settings.lang);
  save(SKEY, settings);
  emit();
}
export function updateProfile(p: Partial<Profile>) {
  profile = { ...profile, ...p };
  save(PKEY, profile);
  emit();
}
export function resetProfileStats() {
  profile = { ...DEFAULT_PROFILE, name: profile.name, avatar: profile.avatar, usage: [0, 0, 0, 0, 0, 0], charWins: [0, 0, 0, 0, 0, 0], history: [] };
  save(PKEY, profile);
  emit();
}
export function useStore() {
  useSyncExternalStore(subscribe, () => ver);
  return { settings, profile };
}

export function recordMatch(r: MatchResult) {
  if (r.reason === "aborted" || r.mode === "training") return;
  const me = r.players[r.localSlot];
  const opp = r.players[1 - r.localSlot];
  if (!me || !opp) return;
  const result: "win" | "loss" | "draw" = r.winner < 0 ? "draw" : r.winner === r.localSlot ? "win" : "loss";
  const usage = [...profile.usage];
  usage[me.charId]++;
  const cw = [...profile.charWins];
  if (result === "win") cw[me.charId]++;
  const history: HistoryItem[] = [
    { ts: Date.now(), mode: r.mode, myChar: me.charId, oppChar: opp.charId, oppName: opp.name, result, dur: r.dur, dmg: me.dmg, arena: r.arena },
    ...profile.history,
  ].slice(0, 20);
  updateProfile({
    played: profile.played + 1,
    wins: profile.wins + (result === "win" ? 1 : 0),
    losses: profile.losses + (result === "loss" ? 1 : 0),
    usage, charWins: cw, history,
    totalDmg: profile.totalDmg + Math.round(me.dmg),
    totalKos: profile.totalKos + me.kos,
  });
}
