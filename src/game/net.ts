// Online 1V1 networking: WebRTC peer-to-peer via PeerJS (public broker only used for signalling).
// The host owns the lobby state; during battle each client is authoritative for its own fighter.
import Peer, { DataConnection } from "peerjs";
import { useSyncExternalStore } from "react";
import { DEFAULT_RULES, MatchConfig, Rules, tr } from "./data";

const PREFIX = "jqun-brawl-v1-";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }] };

export interface LobbyPlayer { name: string; avatar: number; char: number; ready: boolean; connected: boolean }
export interface LobbyState { roomName: string; arena: number; rules: Rules; players: (LobbyPlayer | null)[]; inMatch: boolean }
export type NetStatus = "idle" | "connecting" | "waiting" | "connected" | "reconnecting" | "closed" | "error";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Msg = any;

class Room {
  role: "host" | "guest" | null = null;
  code = "";
  status: NetStatus = "idle";
  error = "";
  ping = 0;
  lobby: LobbyState = { roomName: "", arena: 0, rules: { ...DEFAULT_RULES }, players: [null, null], inMatch: false };
  peer: Peer | null = null;
  conn: DataConnection | null = null;
  token = Math.random().toString(36).slice(2);
  guestToken = "";
  profile = { name: "Guest", avatar: 0 };
  ver = 0;
  subs = new Set<() => void>();
  handlers = new Map<string, Set<(m: Msg) => void>>();
  pingTimer: number | null = null;
  lastRecv = 0;
  retryTimer: number | null = null;
  retries = 0;
  leaving = false;
  joinTimer: number | null = null;

  subscribe = (f: () => void) => {
    this.subs.add(f);
    return () => this.subs.delete(f);
  };
  getVer = () => this.ver;
  emit() {
    this.ver++;
    this.subs.forEach((f) => f());
  }
  on(type: string, fn: (m: Msg) => void) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }
  fire(type: string, m: Msg) {
    this.handlers.get(type)?.forEach((f) => f(m));
  }
  get connected() {
    return !!this.conn && this.conn.open && this.status === "connected";
  }
  get myIdx() {
    return this.role === "host" ? 0 : 1;
  }
  send(m: Msg) {
    try {
      if (this.conn && this.conn.open) this.conn.send(m);
    } catch {
      /* connection dropped; heartbeat will notice */
    }
  }
  private setError(msg: string, status: NetStatus = "error") {
    this.error = msg;
    this.status = status;
    this.emit();
  }
  private cleanupPeer() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.joinTimer) clearTimeout(this.joinTimer);
    this.pingTimer = this.retryTimer = this.joinTimer = null;
    try { this.conn?.close(); } catch { /* noop */ }
    try { this.peer?.destroy(); } catch { /* noop */ }
    this.conn = null;
    this.peer = null;
  }
  reset() {
    this.leaving = true;
    this.cleanupPeer();
    this.role = null;
    this.code = "";
    this.status = "idle";
    this.error = "";
    this.ping = 0;
    this.lobby = { roomName: "", arena: 0, rules: { ...DEFAULT_RULES }, players: [null, null], inMatch: false };
    this.guestToken = "";
    this.emit();
  }
  leave() {
    this.send({ t: "bye" });
    setTimeout(() => this.reset(), 60);
    this.leaving = true;
  }

  // ---------- Host ----------
  createRoom(profile: { name: string; avatar: number }, roomName: string, rules: Rules, arena: number, char: number, attempt = 0) {
    this.cleanupPeer();
    this.leaving = false;
    this.profile = profile;
    this.role = "host";
    this.code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
    this.status = "connecting";
    this.error = "";
    this.lobby = {
      roomName: roomName || profile.name + tr("的房間", "'s room"), arena, rules: { ...rules },
      players: [{ name: profile.name, avatar: profile.avatar, char, ready: true, connected: true }, null], inMatch: false,
    };
    this.emit();
    try {
      const peer = new Peer(PREFIX + this.code, { debug: 0, config: ICE });
      this.peer = peer;
      peer.on("open", () => {
        this.status = "waiting";
        this.startHeartbeat();
        this.emit();
      });
      peer.on("connection", (c) => this.onIncoming(c));
      peer.on("disconnected", () => {
        if (!this.leaving) try { peer.reconnect(); } catch { /* noop */ }
      });
      peer.on("error", (e) => {
        if (e.type === "unavailable-id" && attempt < 6) return this.createRoom(profile, this.lobby.roomName, rules, arena, char, attempt + 1);
        if (this.status === "waiting" || this.status === "connected") return; // non-fatal after established
        this.setError(tr("無法建立房間（連線服務不可用）：", "Cannot create room (signalling unavailable): ") + e.type);
      });
    } catch (e) {
      this.setError(tr("無法建立房間：", "Cannot create room: ") + String(e));
    }
  }
  private onIncoming(c: DataConnection) {
    c.on("open", () => {
      const md = (c.metadata || {}) as { token?: string; name?: string; avatar?: number };
      const cur = this.lobby.players[1];
      const sameGuest = !!cur && md.token && md.token === this.guestToken;
      const slotBusy = !!cur && cur.connected && !sameGuest && this.conn?.open;
      const reserved = !!cur && !cur.connected && !sameGuest && this.lobby.inMatch;
      if (slotBusy || reserved) {
        c.send({ t: "full" });
        setTimeout(() => c.close(), 200);
        return;
      }
      if (this.conn && this.conn !== c) { try { this.conn.close(); } catch { /* noop */ } }
      this.conn = c;
      this.guestToken = md.token || "";
      this.lastRecv = performance.now();
      this.lobby.players[1] = {
        name: String(md.name || "Guest").slice(0, 12), avatar: md.avatar ?? 0,
        char: sameGuest ? cur!.char : 1, ready: sameGuest && this.lobby.inMatch ? cur!.ready : false, connected: true,
      };
      this.status = "connected";
      this.broadcastLobby();
      this.fire("peerback", {});
      this.emit();
    });
    c.on("data", (d) => { if (this.conn === c) this.onData(d); });
    c.on("close", () => { if (this.conn === c) this.onHostLostGuest(); });
    c.on("error", () => { if (this.conn === c) this.onHostLostGuest(); });
  }
  private onHostLostGuest() {
    if (this.leaving) return;
    this.conn = null;
    const p = this.lobby.players[1];
    if (p) {
      if (this.lobby.inMatch) p.connected = false;
      else this.lobby.players[1] = null;
    }
    this.status = this.lobby.inMatch ? "reconnecting" : "waiting";
    this.fire("peerlost", {});
    this.broadcastLobby();
    this.emit();
  }
  broadcastLobby() {
    this.send({ t: "lobby", s: this.lobby });
  }
  setConfig(p: Partial<Pick<LobbyState, "roomName" | "arena" | "rules">>) {
    if (this.role !== "host") return;
    this.lobby = { ...this.lobby, ...p };
    this.broadcastLobby();
    this.emit();
  }
  setMe(p: Partial<LobbyPlayer>) {
    const i = this.myIdx;
    const cur = this.lobby.players[i];
    if (this.role === "host") {
      if (cur) this.lobby.players[i] = { ...cur, ...p };
      this.broadcastLobby();
      this.emit();
    } else {
      if (cur) this.lobby.players[i] = { ...cur, ...p };
      this.send({ t: "me", p });
      this.emit();
    }
  }
  canStart() {
    const g = this.lobby.players[1];
    return this.role === "host" && !!g && g.connected && g.ready && this.connected;
  }
  startMatch(): MatchConfig | null {
    if (!this.canStart()) return null;
    const [a, b] = this.lobby.players as LobbyPlayer[];
    const cfg: MatchConfig = {
      mode: "online", arena: this.lobby.arena, rules: this.lobby.rules, localSlot: 0, seed: Math.floor(Math.random() * 1e9),
      players: [a, b].map((p) => ({ charId: p.char, name: p.name, avatar: p.avatar, cpu: false, level: 0 })),
    };
    this.lobby.inMatch = true;
    this.send({ t: "start", cfg });
    this.emit();
    return cfg;
  }
  endMatch() {
    this.lobby.inMatch = false;
    if (this.role === "host") {
      this.lobby.players.forEach((p) => { if (p && p !== this.lobby.players[0]) p.ready = false; });
      if (this.lobby.players[1] && !this.lobby.players[1].connected) this.lobby.players[1] = null;
      this.broadcastLobby();
    }
    this.emit();
  }

  // ---------- Guest ----------
  joinRoom(code: string, profile: { name: string; avatar: number }, char: number, attempt = 0) {
    this.cleanupPeer();
    this.leaving = false;
    this.profile = profile;
    this.role = "guest";
    this.code = code.toUpperCase().trim();
    this.status = "connecting";
    this.error = "";
    this.retries = 0;
    this.lobby = { roomName: "", arena: 0, rules: { ...DEFAULT_RULES }, players: [null, { name: profile.name, avatar: profile.avatar, char, ready: false, connected: true }], inMatch: false };
    this.emit();
    try {
      const peer = new Peer({ debug: 0, config: ICE });
      this.peer = peer;
      peer.on("open", () => this.connectToHost());
      peer.on("disconnected", () => { if (!this.leaving) try { peer.reconnect(); } catch { /* noop */ } });
      peer.on("error", (e) => {
        if (e.type === "peer-unavailable") {
          if (this.status === "reconnecting") return; // keep retrying
          this.setError(tr("找不到這個房間代碼，請確認後重試。", "Room code not found. Check and retry."));
          this.cleanupPeer();
          return;
        }
        if (this.status === "connected") return;
        if (this.status === "reconnecting") return;
        if (attempt < 1 && e.type === "network") return;
        this.setError(tr("連線失敗（連線服務不可用或網路受限）：", "Connection failed (signalling unavailable or network restricted): ") + e.type);
      });
      this.joinTimer = window.setTimeout(() => {
        if (this.status === "connecting") {
          this.setError(tr("連線逾時：房主可能不在線上，或網路（NAT）阻擋了點對點連線。", "Timed out: host offline or NAT blocking peer-to-peer."));
          this.cleanupPeer();
        }
      }, 15000);
    } catch (e) {
      this.setError(tr("無法連線：", "Cannot connect: ") + String(e));
    }
  }
  private connectToHost() {
    if (!this.peer) return;
    const c = this.peer.connect(PREFIX + this.code, { reliable: true, metadata: { token: this.token, name: this.profile.name, avatar: this.profile.avatar } });
    this.conn = c;
    c.on("open", () => {
      this.lastRecv = performance.now();
      this.retries = 0;
      this.startHeartbeat();
      // push my current choice
      const me = this.lobby.players[1];
      if (me) this.send({ t: "me", p: { char: me.char, ready: false } });
    });
    c.on("data", (d) => { if (this.conn === c) this.onData(d); });
    c.on("close", () => { if (this.conn === c) this.onGuestLost(); });
    c.on("error", () => { if (this.conn === c) this.onGuestLost(); });
  }
  private onGuestLost() {
    if (this.leaving || this.status === "closed" || this.status === "error") return;
    this.status = "reconnecting";
    this.fire("peerlost", {});
    this.emit();
    this.scheduleRetry();
  }
  private scheduleRetry() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = window.setTimeout(() => {
      if (this.leaving || this.status !== "reconnecting") return;
      this.retries++;
      if (this.retries > 8) {
        this.setError(tr("與房主的連線已中斷。", "Connection to host lost."), "closed");
        this.fire("closed", {});
        return;
      }
      try {
        if (!this.peer || this.peer.destroyed) {
          const peer = new Peer({ debug: 0, config: ICE });
          this.peer = peer;
          peer.on("open", () => this.connectToHost());
          peer.on("error", () => { /* retry loop continues */ });
        } else if (this.peer.disconnected) {
          this.peer.reconnect();
          setTimeout(() => this.connectToHost(), 800);
        } else this.connectToHost();
      } catch { /* retry */ }
      this.scheduleRetry();
    }, 2000);
  }

  // ---------- Shared ----------
  private startHeartbeat() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = window.setInterval(() => {
      if (this.conn && this.conn.open) {
        this.send({ t: "ping", ts: performance.now() });
        if (performance.now() - this.lastRecv > 9000) {
          try { this.conn.close(); } catch { /* noop */ }
          if (this.role === "host") this.onHostLostGuest();
          else this.onGuestLost();
        }
      }
    }, 1500);
  }
  private onData(m: Msg) {
    if (!m || typeof m.t !== "string") return;
    this.lastRecv = performance.now();
    switch (m.t) {
      case "ping": this.send({ t: "pong", ts: m.ts }); return;
      case "pong": this.ping = Math.round(performance.now() - m.ts); this.emit(); return;
      case "full":
        this.setError(tr("房間已滿（1V1 只支援兩位玩家）。", "Room is full (1V1 supports two players)."));
        this.cleanupPeer();
        return;
      case "bye":
        if (this.role === "guest") {
          this.leaving = true;
          this.cleanupPeer();
          this.status = "closed";
          this.error = tr("房主已離開房間。", "The host left the room.");
          this.emit();
          this.fire("closed", {});
        } else {
          this.conn = null;
          this.lobby.players[1] = null;
          this.status = "waiting";
          this.fire("peerlost", { bye: true });
          this.broadcastLobby();
          this.emit();
        }
        return;
      case "me":
        if (this.role === "host" && this.lobby.players[1]) {
          this.lobby.players[1] = { ...this.lobby.players[1]!, ...m.p, connected: true };
          this.broadcastLobby();
          this.emit();
        }
        return;
      case "lobby":
        if (this.role === "guest") {
          const wasInMatch = this.lobby.inMatch;
          // keep my own optimistic char/ready until host echoes
          this.lobby = m.s;
          if (this.status !== "connected") {
            this.status = "connected";
            if (this.joinTimer) clearTimeout(this.joinTimer);
            this.fire("peerback", {});
          }
          if (wasInMatch && !m.s.inMatch) this.fire("lobbyReset", {});
          this.emit();
        }
        return;
      default:
        this.fire(m.t, m);
    }
  }
}

export const room = new Room();
export function useRoom() {
  useSyncExternalStore(room.subscribe, room.getVer);
  return room;
}
