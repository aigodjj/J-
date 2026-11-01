// ===== Shared game data: characters, moves, arenas, settings types =====

export type Lang = "zh" | "en";
let curLang: Lang = "zh";
export const setLang = (l: Lang) => {
  curLang = l;
};
export const getLang = () => curLang;
/** Inline bilingual helper: zh-TW first, English optional */
export const tr = (zh: string, en: string) => (curLang === "en" ? en : zh);

export type ActionKey =
  | "left" | "right" | "up" | "down" | "jump" | "attack" | "heavy" | "special"
  | "grab" | "block" | "dodge" | "ultimate";

export const ACTIONS: ActionKey[] = [
  "left", "right", "up", "down", "jump", "attack", "heavy", "special", "grab", "block", "dodge", "ultimate",
];
export const ACTION_LABEL: Record<ActionKey, [string, string]> = {
  left: ["向左移動", "Move Left"],
  right: ["向右移動", "Move Right"],
  up: ["向上（上段招式）", "Up (up attacks)"],
  down: ["向下（穿台／下段）", "Down (drop / low)"],
  jump: ["跳躍（可二段跳）", "Jump (double jump)"],
  attack: ["普通攻擊", "Attack"],
  heavy: ["重攻擊", "Heavy Attack"],
  special: ["必殺技", "Special"],
  grab: ["抓取／投擲", "Grab / Throw"],
  block: ["格擋（按住）", "Block (hold)"],
  dodge: ["閃避／翻滾", "Dodge / Roll"],
  ultimate: ["究極奧義", "Ultimate"],
};
export const DEFAULT_KEYS: Record<ActionKey, string> = {
  left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS", jump: "Space",
  attack: "KeyJ", heavy: "KeyK", special: "KeyL", grab: "KeyU", block: "KeyI", dodge: "KeyO", ultimate: "KeyP",
};
export const keyLabel = (code: string) =>
  code.replace(/^Key/, "").replace(/^Digit/, "").replace("Arrow", "").replace("Semicolon", ";").replace("Comma", ",").replace("Period", ".").replace("ShiftLeft", "LShift").replace("ShiftRight", "RShift");

export interface Rules {
  stocks: number;
  time: number; // minutes, 0 = unlimited
  dmgMul: number;
  kbMul: number;
  ult: boolean;
  hazards: boolean;
}
export const DEFAULT_RULES: Rules = { stocks: 3, time: 3, dmgMul: 1, kbMul: 1, ult: true, hazards: true };

export interface Settings {
  lang: Lang;
  keys: Record<ActionKey, string>;
  master: number;
  music: number;
  sfx: number;
  quality: "low" | "medium" | "high";
  resScale: number;
  winSize: "fit" | "1280" | "1024" | "800";
  vfx: 0 | 1 | 2;
  fpsCap: number; // 0 = unlimited
  showFps: boolean;
  shake: boolean;
  rules: Rules;
  defChar: number;
  defArena: number;
  difficulty: number;
}
export const DEFAULT_SETTINGS: Settings = {
  lang: "zh", keys: { ...DEFAULT_KEYS }, master: 0.8, music: 0.5, sfx: 0.8,
  quality: "medium", resScale: 1, winSize: "fit", vfx: 2, fpsCap: 60, showFps: false, shake: true,
  rules: { ...DEFAULT_RULES }, defChar: 0, defArena: 0, difficulty: 1,
};

// ===== Moves =====
export interface ProjDef {
  shape: string; sp: number; vy?: number; g?: number; life: number; w: number; h: number;
  dmg: number; kb: number; ks: number; ang: number; col: number;
  pierce?: boolean; explode?: number; homing?: number;
}
export interface Fire { t: number; dx?: number; dy?: number; vx?: number; vy?: number; sky?: number; sx?: number; big?: boolean }
export interface Move {
  key: string; name: string; en: string; anim: string;
  st: number; ac: number; rc: number;
  dmg: number; kb: number; ks: number; ang: number;
  hb: [number, number, number, number];
  air?: boolean; lunge?: number; hop?: number; dash?: number; rise?: number; multi?: number;
  inv?: boolean; noG?: boolean; proj?: ProjDef; fire?: Fire[];
  fin?: { dmg: number; kb: number; ks: number; ang: number };
  pull?: boolean; ult?: boolean; grab?: boolean; col: number; sfx: string; fx: string;
}

const BASE: Record<string, Partial<Move> & { n: [string, string] }> = {
  jab: { n: ["輕拳連擊", "Quick Jab"], anim: "jab", st: 0.06, ac: 0.08, rc: 0.13, dmg: 3.5, kb: 5, ks: 0.6, ang: 22, hb: [0.9, 0.9, 1.2, 0.8] },
  ftilt: { n: ["前方強擊", "Forward Tilt"], anim: "swing", st: 0.12, ac: 0.1, rc: 0.2, dmg: 7, kb: 7, ks: 0.9, ang: 32, hb: [1.1, 0.9, 1.6, 0.9], lunge: 3 },
  utilt: { n: ["上挑", "Up Tilt"], anim: "uppercut", st: 0.1, ac: 0.1, rc: 0.22, dmg: 6, kb: 7.5, ks: 0.9, ang: 85, hb: [0.2, 1.6, 1.4, 1.3] },
  dtilt: { n: ["下掃", "Down Tilt"], anim: "kick", st: 0.09, ac: 0.1, rc: 0.2, dmg: 5, kb: 6, ks: 0.7, ang: 55, hb: [1.0, 0.35, 1.7, 0.6] },
  heavy: { n: ["蓄力重擊", "Heavy Smash"], anim: "smash", st: 0.32, ac: 0.12, rc: 0.38, dmg: 15, kb: 10, ks: 1.5, ang: 38, hb: [1.3, 1.0, 1.9, 1.3], lunge: 4 },
  uheavy: { n: ["沖天重擊", "Up Smash"], anim: "uppercut", st: 0.3, ac: 0.14, rc: 0.36, dmg: 13, kb: 10, ks: 1.4, ang: 82, hb: [0.1, 1.6, 1.8, 1.8] },
  dheavy: { n: ["旋風掃堂", "Down Smash"], anim: "spin", st: 0.28, ac: 0.16, rc: 0.38, dmg: 12, kb: 9, ks: 1.2, ang: 35, hb: [0, 0.6, 3.2, 1.0] },
  nair: { n: ["空中旋身", "Neutral Air"], anim: "spin", st: 0.07, ac: 0.22, rc: 0.12, dmg: 6, kb: 6, ks: 0.8, ang: 40, hb: [0, 0.9, 2.0, 1.5], air: true },
  fair: { n: ["空中前擊", "Forward Air"], anim: "swing", st: 0.12, ac: 0.1, rc: 0.2, dmg: 8, kb: 7.5, ks: 1, ang: 32, hb: [1.0, 1.0, 1.5, 1.1], air: true },
  bair: { n: ["空中後踢", "Back Air"], anim: "kick", st: 0.12, ac: 0.1, rc: 0.2, dmg: 9, kb: 8, ks: 1.1, ang: 35, hb: [-1.0, 1.0, 1.5, 1.1], air: true },
  uair: { n: ["空中上擊", "Up Air"], anim: "uppercut", st: 0.09, ac: 0.12, rc: 0.18, dmg: 6.5, kb: 7, ks: 0.9, ang: 88, hb: [0.1, 1.9, 1.5, 1.2], air: true },
  dair: { n: ["空中下砸", "Down Air"], anim: "dive", st: 0.16, ac: 0.12, rc: 0.22, dmg: 8, kb: 6, ks: 0.8, ang: -55, hb: [0.1, 0.2, 1.1, 1.5], air: true },
};

interface NormalTweak {
  dmg: number; as: number; reach: number; col: number; sfx: string; fx: string;
  names?: Record<string, [string, string]>;
  over?: Record<string, Partial<Move>>;
}
function normals(t: NormalTweak): Record<string, Move> {
  const out: Record<string, Move> = {};
  for (const k of Object.keys(BASE)) {
    const b = BASE[k];
    const nm = t.names?.[k] || b.n;
    const hb = b.hb!;
    const m: Move = {
      key: k, name: nm[0], en: nm[1], anim: b.anim!,
      st: b.st! / t.as, ac: b.ac!, rc: b.rc! / t.as,
      dmg: b.dmg! * t.dmg, kb: b.kb!, ks: b.ks!, ang: b.ang!,
      hb: [hb[0] * t.reach, hb[1], hb[2] * t.reach, hb[3]],
      air: b.air, lunge: b.lunge, col: t.col, sfx: t.sfx, fx: t.fx,
    };
    Object.assign(m, t.over?.[k] || {});
    out[k] = m;
  }
  out.grab = {
    key: "grab", name: "抓取", en: "Grab", anim: "grab", st: 0.14, ac: 0.1, rc: 0.36, dmg: 0, kb: 0, ks: 0, ang: 0,
    hb: [0.9 * t.reach, 0.9, 1.2, 1.0], grab: true, col: t.col, sfx: "grab", fx: "none",
  };
  return out;
}

const mv = (p: Partial<Move> & { key: string; name: string; en: string }): Move => ({
  anim: "smash", st: 0.2, ac: 0.12, rc: 0.3, dmg: 8, kb: 8, ks: 1, ang: 35, hb: [1.0, 1.0, 1.5, 1.2], col: 0xffffff, sfx: "special", fx: "slash", ...p,
});

export interface CharDef {
  id: number; key: string; name: string; en: string;
  role: [string, string]; desc: [string, string]; quote: [string, string];
  color: number; css: string; css2: string;
  stats: { power: number; speed: number; weight: number; range: number; tech: number };
  phys: { speed: number; jump: number; weight: number; grav: number; air: number };
  moves: Record<string, Move>;
  voice: number; // pitch base
}

export const CHARS: CharDef[] = [
  {
    id: 0, key: "godjj", name: "GODJJ", en: "GODJJ",
    role: ["鴨嘴獸連擊手", "Platypus Combo Master"],
    desc: ["穿著鴨嘴獸連帽外套的紫粉髮少女。動作超快、連段豐富，還會揮舞河狸尾巴；但體重輕，被打到很容易飛出去。", "A purple-pink haired girl in a platypus hoodie. Blazing fast with rich combos and a beaver tail, but light and easy to launch."],
    quote: ["嘎嘎～今天也是鴨力滿滿！", "Quack~ full of duck power today!"],
    color: 0x3fc9b5, css: "#3fc9b5", css2: "#ff7ab8",
    stats: { power: 3, speed: 5, weight: 2, range: 2, tech: 4 },
    phys: { speed: 9.2, jump: 16, weight: 0.85, grav: 1, air: 0.9 },
    voice: 1.35,
    moves: (() => {
      const m = normals({
        dmg: 0.92, as: 1.18, reach: 1.0, col: 0x3fc9b5, sfx: "swing", fx: "slash",
        names: { jab: ["河狸尾連拍", "Tail Slaps"], ftilt: ["鴨嘴頂頂", "Bill Bonk"], heavy: ["河狸尾全壘打", "Beaver Tail Homerun"] },
      });
      m.special = mv({
        key: "special", name: "嘎嘎音波", en: "Quack Wave", anim: "cast", st: 0.16, ac: 0.05, rc: 0.22, dmg: 0, hb: [0, 0, 0, 0], col: 0x3fc9b5, fx: "none",
        proj: { shape: "wave", sp: 14, life: 0.75, w: 1.0, h: 1.0, dmg: 5, kb: 5, ks: 0.6, ang: 22, col: 0x3fc9b5 }, fire: [{ t: 0, dx: 0.9, dy: 1.0 }],
      });
      m.sspecial = mv({
        key: "sspecial", name: "鴨嘴衝刺", en: "Bill Dash", anim: "thrust", st: 0.13, ac: 0.3, rc: 0.3, dmg: 8, kb: 8, ks: 1.0, ang: 40, dash: 17, noG: true,
        hb: [0.9, 0.9, 1.5, 1.1], col: 0xffa63d, fx: "burst",
      });
      m.uspecial = mv({
        key: "uspecial", name: "河狸尾旋風", en: "Tail Twister", anim: "spin", st: 0.1, ac: 0.38, rc: 0.3, dmg: 2.6, kb: 4.5, ks: 0.4, ang: 80, rise: 17, multi: 0.12,
        hb: [0, 1.0, 2.4, 2.0], col: 0x8b5a2b, fx: "ring", fin: { dmg: 3, kb: 8, ks: 0.8, ang: 80 },
      });
      m.ult = mv({
        key: "ult", name: "鴨嘴獸大突擊", en: "Platypus Rampage", anim: "thrust", ult: true, st: 0.5, ac: 1.1, rc: 0.4, dmg: 2.6, kb: 3.5, ks: 0.2, ang: 15, dash: 10, multi: 0.1, inv: true, noG: true,
        hb: [1.0, 1.0, 2.4, 2.0], col: 0xffa63d, sfx: "ult", fx: "burst", fin: { dmg: 14, kb: 14, ks: 1.7, ang: 35 },
      });
      return m;
    })(),
  },
  {
    id: 1, key: "dingyi", name: "丁義", en: "Ding Yi",
    role: ["黑柴主廚（重量級）", "Shiba Head Chef (Heavy)"],
    desc: ["戴著主廚帽、愛吐舌頭眨眼的黑柴廚師。體型厚實、攻擊緩慢但威力驚人，不容易被擊飛，擅長用辣椒炸彈製造範圍壓制。", "A winking shiba chef in a toque. Heavy and slow with huge damage; hard to launch and excels at area control with chili bombs."],
    quote: ["料理完成，請慢用！汪！", "Dinner is served! Woof!"],
    color: 0xe8a33d, css: "#e8a33d", css2: "#9b1c31",
    stats: { power: 5, speed: 2, weight: 5, range: 3, tech: 2 },
    phys: { speed: 6.5, jump: 14, weight: 1.38, grav: 1.1, air: 0.7 },
    voice: 0.8,
    moves: (() => {
      const m = normals({
        dmg: 1.25, as: 0.88, reach: 1.05, col: 0xe8a33d, sfx: "heavy", fx: "slash",
        names: { jab: ["肉球拳", "Paw Punch"], ftilt: ["湯勺敲擊", "Ladle Whack"], heavy: ["平底鍋猛砸", "Frying Pan Smash"] },
      });
      m.special = mv({
        key: "special", name: "辣椒炸彈", en: "Chili Bomb", anim: "cast", st: 0.22, ac: 0.05, rc: 0.35, dmg: 0, hb: [0, 0, 0, 0], col: 0xe03c2d, fx: "none",
        proj: { shape: "bomb", sp: 8, vy: 6, g: 22, life: 1.8, w: 0.8, h: 0.8, dmg: 9, kb: 9, ks: 1.2, ang: 55, col: 0xe03c2d, explode: 2.3 }, fire: [{ t: 0, dx: 0.8, dy: 1.2 }],
      });
      m.sspecial = mv({
        key: "sspecial", name: "烈火爆炒", en: "Flambé Rush", anim: "smash", st: 0.3, ac: 0.14, rc: 0.4, dmg: 16, kb: 10.5, ks: 1.6, ang: 35, lunge: 7,
        hb: [1.5, 1.0, 2.2, 1.5], col: 0xff6a2a, fx: "burst",
      });
      m.uspecial = mv({
        key: "uspecial", name: "廚師帽直升機", en: "Toque Copter", anim: "spin", st: 0.12, ac: 0.5, rc: 0.35, dmg: 2.4, kb: 4, ks: 0.4, ang: 80, rise: 15, multi: 0.1,
        hb: [0, 1.5, 2.6, 2.6], col: 0xffffff, fx: "ring", fin: { dmg: 4, kb: 8, ks: 0.9, ang: 80 },
      });
      m.ult = mv({
        key: "ult", name: "黑柴爆炒大爆發", en: "Grand Wok Blast", anim: "slam", ult: true, st: 0.65, ac: 0.25, rc: 0.5, dmg: 22, kb: 13, ks: 2.0, ang: 50, inv: true,
        hb: [0, 1.4, 7, 5], col: 0xff7a1a, sfx: "ult", fx: "nova",
      });
      return m;
    })(),
  },
  {
    id: 2, key: "shizimaru", name: "獅子丸", en: "Shizimaru",
    role: ["傲嬌獅王（力量型）", "Grumpy Lion King (Bruiser)"],
    desc: ["一臉不耐煩的方塊小獅子，鬃毛蓬鬆如雲。攻守均衡、近身肉搏強悍，獅吼震波可貫穿對手。", "A square little lion with a perpetually unimpressed face and a huge mane. Balanced brawler whose roar shockwave pierces opponents."],
    quote: ["哼，這種程度…還算不錯啦。", "Hmph... not bad, I guess."],
    color: 0xb87a45, css: "#c28a52", css2: "#f6e2b8",
    stats: { power: 4, speed: 3, weight: 4, range: 3, tech: 3 },
    phys: { speed: 7.5, jump: 15, weight: 1.15, grav: 1.05, air: 0.8 },
    voice: 0.95,
    moves: (() => {
      const m = normals({
        dmg: 1.15, as: 0.96, reach: 1.0, col: 0xc28a52, sfx: "heavy", fx: "slash",
        names: { jab: ["獅爪連抓", "Claw Swipes"], ftilt: ["獅王掌", "Lion Palm"], heavy: ["鬃毛頭槌", "Mane Headbutt"] },
      });
      m.special = mv({
        key: "special", name: "獅吼震波", en: "Roar Wave", anim: "cast", st: 0.26, ac: 0.05, rc: 0.3, dmg: 0, hb: [0, 0, 0, 0], col: 0xffd27a, fx: "none",
        proj: { shape: "wave", sp: 9, life: 0.5, w: 1.7, h: 1.7, dmg: 6, kb: 8, ks: 1.0, ang: 15, col: 0xffd27a, pierce: true }, fire: [{ t: 0, dx: 1.0, dy: 1.1 }],
      });
      m.sspecial = mv({
        key: "sspecial", name: "獅子撲擊", en: "Lion Pounce", anim: "thrust", st: 0.16, ac: 0.3, rc: 0.35, dmg: 11, kb: 9, ks: 1.2, ang: 40, dash: 14, noG: true,
        hb: [0.9, 1.0, 1.6, 1.4], col: 0xc28a52, fx: "burst",
      });
      m.uspecial = mv({
        key: "uspecial", name: "鬃毛火箭", en: "Mane Rocket", anim: "uppercut", st: 0.12, ac: 0.38, rc: 0.35, dmg: 8, kb: 8, ks: 1.0, ang: 80, rise: 16.5,
        hb: [0.3, 1.2, 1.7, 1.9], col: 0xffb347, fx: "burst",
      });
      m.ult = mv({
        key: "ult", name: "百獸之王怒吼", en: "King's Roar", anim: "cast", ult: true, st: 0.6, ac: 1.0, rc: 0.45, dmg: 3.5, kb: 3, ks: 0.2, ang: 15, multi: 0.12, inv: true,
        hb: [6.0, 1.2, 12, 2.6], col: 0xffd27a, sfx: "ult", fx: "beam", fin: { dmg: 12, kb: 14, ks: 1.8, ang: 30 },
      });
      return m;
    })(),
  },
  {
    id: 3, key: "dakai", name: "大楷", en: "Da Kai",
    role: ["西裝眼鏡男（技巧型）", "Suited Strategist (Technical)"],
    desc: ["戴著眼鏡、一臉嚴肅的西裝青年。均衡且射程長，簽約文件飛鏢速度極快，奧義『股票暴跌』能從天而降鎖定對手。", "A serious guy in a suit and glasses. Balanced with long reach; contract darts are fast and his ultimate rains down on the opponent."],
    quote: ["這場比賽的結果，早就寫在合約裡了。", "The result was written in the contract all along."],
    color: 0x7b86b8, css: "#8a95c8", css2: "#2b2d3a",
    stats: { power: 3, speed: 3, weight: 3, range: 5, tech: 4 },
    phys: { speed: 8, jump: 15.5, weight: 1.0, grav: 1, air: 0.85 },
    voice: 0.9,
    moves: (() => {
      const m = normals({
        dmg: 1.0, as: 1.0, reach: 1.18, col: 0x9aa5e0, sfx: "swing", fx: "slash",
        names: { jab: ["西裝直拳", "Suit Jab"], ftilt: ["領帶鞭打", "Necktie Whip"], heavy: ["公事包重擊", "Briefcase Smash"] },
      });
      m.special = mv({
        key: "special", name: "簽約文件", en: "Contract Dart", anim: "cast", st: 0.12, ac: 0.05, rc: 0.18, dmg: 0, hb: [0, 0, 0, 0], col: 0xffffff, fx: "none",
        proj: { shape: "doc", sp: 20, life: 0.7, w: 0.7, h: 0.5, dmg: 4.5, kb: 4, ks: 0.5, ang: 15, col: 0xffffff }, fire: [{ t: 0, dx: 0.9, dy: 1.1 }],
      });
      m.sspecial = mv({
        key: "sspecial", name: "公事包橫掃", en: "Briefcase Sweep", anim: "swing", st: 0.2, ac: 0.12, rc: 0.3, dmg: 11, kb: 9, ks: 1.2, ang: 35, lunge: 6,
        hb: [1.7, 1.0, 2.8, 1.1], col: 0x9aa5e0, fx: "slash",
      });
      m.uspecial = mv({
        key: "uspecial", name: "西裝飛升", en: "Suit Ascension", anim: "uppercut", st: 0.1, ac: 0.3, rc: 0.35, dmg: 5, kb: 6, ks: 0.7, ang: 85, rise: 17.5,
        hb: [0.2, 1.2, 1.5, 1.7], col: 0xffffff, fx: "burst",
      });
      m.ult = mv({
        key: "ult", name: "股票暴跌", en: "Market Crash", anim: "cast", ult: true, st: 0.55, ac: 1.3, rc: 0.45, dmg: 0, hb: [0, 0, 0, 0], inv: false, col: 0xff4d4d, sfx: "ult", fx: "none",
        proj: { shape: "arrow", sp: 0, vy: -17, life: 1.2, w: 0.9, h: 1.3, dmg: 5.5, kb: 7, ks: 0.8, ang: 70, col: 0xff4d4d },
        fire: Array.from({ length: 11 }, (_, i) => ({ t: i * 0.12, sky: 10, sx: ((i % 5) - 2) * 1.5 + (i % 2 ? 0.5 : -0.5) })),
      });
      return m;
    })(),
  },
  {
    id: 4, key: "jingyeni", name: "京野妮子", en: "Jingye Nizi",
    role: ["Z世代魔法少女（遠程型）", "Gen-Z Magical Girl (Ranged)"],
    desc: ["別著粉紅Z字髮夾的暗紫色鮑伯頭少女。擅長遠程愛心彈幕與高機動空戰，但防禦脆弱，是經典的玻璃大砲。", "A dark-purple bob girl with a pink Z hairpin. Heart bullet spam and agile air combat, but fragile glass cannon."],
    quote: ["Z世代的實力，你看見了嗎？", "Did you see the power of Gen Z?"],
    color: 0xff6fa5, css: "#ff6fa5", css2: "#7a3fd0",
    stats: { power: 3, speed: 4, weight: 1, range: 5, tech: 4 },
    phys: { speed: 8.3, jump: 16.5, weight: 0.8, grav: 0.95, air: 1.0 },
    voice: 1.5,
    moves: (() => {
      const m = normals({
        dmg: 0.95, as: 1.08, reach: 1.0, col: 0xff6fa5, sfx: "swing", fx: "slash",
        names: { jab: ["厚底靴連踢", "Platform Kicks"], ftilt: ["格紋裙旋踢", "Plaid Spin Kick"], heavy: ["粉紅毛衣重拳", "Sweater Smash"] },
      });
      m.special = mv({
        key: "special", name: "愛心彈", en: "Heart Shot", anim: "cast", st: 0.18, ac: 0.05, rc: 0.25, dmg: 0, hb: [0, 0, 0, 0], col: 0xff6fa5, fx: "none",
        proj: { shape: "heart", sp: 10, life: 1.2, w: 0.9, h: 0.9, dmg: 6, kb: 5, ks: 0.6, ang: 30, col: 0xff6fa5, homing: 0.07 }, fire: [{ t: 0, dx: 0.8, dy: 1.2 }],
      });
      m.sspecial = mv({
        key: "sspecial", name: "Z字斬", en: "Z Slash", anim: "thrust", st: 0.14, ac: 0.26, rc: 0.3, dmg: 8, kb: 9, ks: 1.0, ang: 45, dash: 16, noG: true, hop: 3,
        hb: [0.9, 1.0, 1.8, 1.5], col: 0xff6fa5, fx: "zslash",
      });
      m.uspecial = mv({
        key: "uspecial", name: "厚底靴彈跳", en: "Platform Pop", anim: "dive", st: 0.1, ac: 0.3, rc: 0.3, dmg: 5, kb: 6, ks: 0.7, ang: 85, rise: 18.5,
        hb: [0.1, 0.4, 1.4, 1.2], col: 0xff9ad0, fx: "burst",
      });
      m.ult = mv({
        key: "ult", name: "Z世代全開", en: "Gen-Z Overdrive", anim: "cast", ult: true, st: 0.45, ac: 1.1, rc: 0.45, dmg: 0, hb: [0, 0, 0, 0], inv: true, col: 0xff6fa5, sfx: "ult", fx: "none",
        proj: { shape: "heart", sp: 14, life: 1.1, w: 1.0, h: 1.0, dmg: 4, kb: 5, ks: 0.4, ang: 25, col: 0xff6fa5 },
        fire: [
          ...Array.from({ length: 12 }, (_, i) => ({ t: i * 0.08, dx: 0.8, dy: 1.2, vx: 14, vy: ((i % 5) - 2) * 1.8 })),
          { t: 1.05, dx: 1.0, dy: 1.2, big: true, vx: 11, vy: 0 },
        ],
      });
      return m;
    })(),
  },
  {
    id: 5, key: "yutou", name: "芋頭", en: "Yu Tou",
    role: ["紫電科技少女（機動／陷阱型）", "Violet Tech Girl (Mobility / Trap)"],
    desc: ["淡紫短髮、穿著科技感白外套的少女。擁有瞬間閃現與滯留電子球，能用位移與陷阱逼迫對手，奧義『資料洪流』會把人吸進去再爆炸。", "A lavender-haired girl in a tech jacket. Blink dash and lingering orbs control space; her ultimate sucks foes in before detonating."],
    quote: ["資料分析完畢，勝率 100%。", "Analysis complete. Win rate: 100%."],
    color: 0x9b7bff, css: "#9b7bff", css2: "#c9b6ff",
    stats: { power: 3, speed: 5, weight: 2, range: 3, tech: 5 },
    phys: { speed: 8.6, jump: 16, weight: 0.9, grav: 1, air: 0.95 },
    voice: 1.25,
    moves: (() => {
      const m = normals({
        dmg: 1.0, as: 1.1, reach: 1.0, col: 0xb69cff, sfx: "swing", fx: "slash",
        names: { jab: ["電擊手套", "Shock Gloves"], ftilt: ["高跟踢擊", "Heel Kick"], heavy: ["外套甩擊", "Jacket Lash"] },
      });
      m.special = mv({
        key: "special", name: "電子護盾彈", en: "Cyber Orb", anim: "cast", st: 0.2, ac: 0.05, rc: 0.3, dmg: 0, hb: [0, 0, 0, 0], col: 0x9b7bff, fx: "none",
        proj: { shape: "orb", sp: 5, life: 2.4, w: 1.2, h: 1.2, dmg: 5, kb: 5, ks: 0.5, ang: 60, col: 0x9b7bff, pierce: true }, fire: [{ t: 0, dx: 0.9, dy: 1.1 }],
      });
      m.sspecial = mv({
        key: "sspecial", name: "紫電閃現", en: "Violet Blink", anim: "thrust", st: 0.12, ac: 0.14, rc: 0.22, dmg: 7, kb: 7.5, ks: 1.0, ang: 35, dash: 27, noG: true, inv: true,
        hb: [1.0, 1.0, 1.8, 1.3], col: 0x9b7bff, fx: "zslash",
      });
      m.uspecial = mv({
        key: "uspecial", name: "噴射推進", en: "Jet Boost", anim: "dive", st: 0.1, ac: 0.4, rc: 0.3, dmg: 4, kb: 5, ks: 0.5, ang: 85, rise: 16, multi: 0.13,
        hb: [0, 0.4, 1.8, 1.4], col: 0x7ad7ff, fx: "burst", fin: { dmg: 3, kb: 7, ks: 0.7, ang: 80 },
      });
      m.ult = mv({
        key: "ult", name: "資料洪流", en: "Data Torrent", anim: "cast", ult: true, st: 0.5, ac: 1.3, rc: 0.45, dmg: 2.5, kb: 3, ks: 0.2, ang: 20, multi: 0.15, pull: true, inv: true,
        hb: [0, 1.3, 7, 4.5], col: 0x9b7bff, sfx: "ult", fx: "vortex", fin: { dmg: 14, kb: 14, ks: 1.8, ang: 50 },
      });
      return m;
    })(),
  },
];

export const MOVE_ORDER: [string, string, string][] = [
  ["jab", "attack", "J"],
  ["heavy", "heavy", "K"],
  ["special", "special", "L"],
  ["sspecial", "special", "→ + L"],
  ["uspecial", "special", "↑ + L"],
  ["ult", "ultimate", "P"],
];

// ===== Arenas =====
export interface ArenaMeta {
  id: number; name: string; en: string; desc: [string, string]; hazard: [string, string]; theme: [string, string];
  css: string; blastX: number; blastY: number; topY: number; spawn: number;
}
export const ARENAS: ArenaMeta[] = [
  {
    id: 0, name: "彩虹棉花糖島", en: "Rainbow Marshmallow Isle",
    desc: ["漂浮在雲端的甜點島，三座柔軟浮台提供豐富的空戰空間，場地寬敞適合新手。", "A floating dessert island with three soft platforms. Wide and friendly for beginners."],
    hazard: ["無危險物（新手友善）", "No hazards (beginner friendly)"],
    theme: ["夢幻甜點", "Dreamy Sweets"], css: "linear-gradient(135deg,#ffb3e6,#8fd3ff)", blastX: 28, blastY: 15, topY: 26, spawn: 4,
  },
  {
    id: 1, name: "像素熔岩工廠", en: "Pixel Lava Foundry",
    desc: ["漂浮在熔岩上的鐵工廠，主台較窄，會移動的上層浮台與定時噴發的熔岩間歇泉增添變化。", "An iron foundry above lava. Narrow main stage, a moving top platform and timed lava geysers."],
    hazard: ["熔岩間歇泉：噴發前會有紅色預警，被擊中會受傷並被擊飛", "Lava geysers: red warning first, then damage + knockback"],
    theme: ["熾熱工業", "Fiery Industrial"], css: "linear-gradient(135deg,#ff6a2a,#3a0f1c)", blastX: 25, blastY: 14, topY: 25, spawn: 4,
  },
  {
    id: 2, name: "霓虹夜市屋頂", en: "Neon Night Market Rooftop",
    desc: ["台灣風情的夜市屋頂，燈籠與霓虹招牌閃爍，兩側高台與來回移動的攤車頂棚考驗走位。", "A Taiwanese night-market rooftop with lanterns and neon. Side platforms and a sliding stall roof test your positioning."],
    hazard: ["移動平台（無傷害危險物）", "Moving platform (no damaging hazard)"],
    theme: ["熱鬧夜市", "Lively Night Market"], css: "linear-gradient(135deg,#3b1d6e,#ff4fa0)", blastX: 27, blastY: 15, topY: 26, spawn: 3.5,
  },
];

export const DIFFICULTIES: { key: string; zh: string; en: string; react: number; aggr: number; block: number; dodge: number; recover: number; combo: number; ult: number; acc: number }[] = [
  { key: "easy", zh: "簡單", en: "Easy", react: 0.55, aggr: 0.25, block: 0.08, dodge: 0.0, recover: 0.35, combo: 0.1, ult: 0.2, acc: 0.45 },
  { key: "normal", zh: "普通", en: "Normal", react: 0.34, aggr: 0.45, block: 0.3, dodge: 0.15, recover: 0.65, combo: 0.35, ult: 0.5, acc: 0.65 },
  { key: "hard", zh: "困難", en: "Hard", react: 0.2, aggr: 0.62, block: 0.55, dodge: 0.4, recover: 0.85, combo: 0.6, ult: 0.8, acc: 0.8 },
  { key: "expert", zh: "專家", en: "Expert", react: 0.11, aggr: 0.78, block: 0.78, dodge: 0.65, recover: 0.96, combo: 0.82, ult: 0.95, acc: 0.92 },
  { key: "highest", zh: "最高", en: "Highest", react: 0.05, aggr: 0.92, block: 0.94, dodge: 0.88, recover: 1.0, combo: 1.0, ult: 1.0, acc: 1.0 },
];

export interface MatchConfig {
  mode: "cpu" | "training" | "online";
  arena: number;
  rules: Rules;
  players: { charId: number; name: string; avatar: number; cpu: boolean; level: number }[];
  localSlot: number;
  seed?: number;
}

export interface PlayerResult {
  slot: number; charId: number; name: string; avatar: number; dmg: number; kos: number; falls: number; lives: number; percent: number;
}
export interface MatchResult {
  mode: MatchConfig["mode"]; winner: number; // slot or -1
  reason: "ko" | "time" | "forfeit" | "aborted";
  players: PlayerResult[]; dur: number; localSlot: number; arena: number;
}
