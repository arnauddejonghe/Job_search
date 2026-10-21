/**
 * Radar — plateforme personnelle de veille emploi & pilotage de candidatures.
 * Artefact React (fichier unique) · Tailwind (classes de base) · lucide-react · recharts.
 * Persistance : window.storage (jamais localStorage).
 * IA : API Claude appelée depuis l'artefact (web_search + serveurs MCP Gmail / Google Calendar).
 * Principe : l'IA prépare, l'utilisateur valide. Rien n'est envoyé sans action explicite.
 */
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useContext, createContext, useId, useDeferredValue } from "react";
import {
  LayoutDashboard, Briefcase, Columns, Sparkles, BellRing, Users, Radio, User, ShieldCheck, Search,
  Command, Play, Loader2, Plus, X, ChevronRight, ChevronsLeft, ChevronsRight, ExternalLink, Mail,
  CalendarPlus, Copy, Check, Trash2, Download, Upload, RotateCcw, Moon, Sun, Monitor, AlertTriangle,
  Info, Clock, Menu, History, FileText, RefreshCw, Building2, Inbox,
  Clipboard, Wand2, Flag, HelpCircle, Eye, EyeOff, Save, Target, Gauge, ArrowRight, CheckCircle2, Linkedin, TrendingUp, Pencil, Phone, GitMerge, Undo2, MailCheck, Palette, ChevronLeft, Filter, Link2, CalendarClock, CalendarDays, Unlink,
  Maximize2, Minimize2, Redo2, ArrowUp, ArrowDown, Lightbulb, SlidersHorizontal, Circle, Minus,
  RotateCw, Crop, Star, GripVertical, ArrowLeftRight, Image as ImageIcon, FileDown, Languages,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid, Cell } from "recharts";

/* ════════════════════════════════════════════════════════════════════════
   1. CONSTANTES & VALEURS PAR DÉFAUT
   ════════════════════════════════════════════════════════════════════════ */

const NC = "non communiqué";
const DATA_VERSION = 1;
const API_URL = "https://api.anthropic.com/v1/messages";

const KEYS = {
  settings: "radar:settings",
  profile: "radar:profile",
  criteria: "radar:criteria",
  sources: "radar:sources",
  offers: "radar:offers",
  apps: "radar:apps",
  contacts: "radar:contacts",
  ratings: "radar:ratings",
  briefs: "radar:briefs",
  media: "radar:media",
};
const DEFAULT_MEDIA = { photo: null };

const STAGES = [
  { id: "new", label: "Nouvelle" },
  { id: "retained", label: "Retenue" },
  { id: "prep", label: "En préparation" },
  { id: "sent", label: "Envoyée" },
  { id: "followup", label: "Relance" },
  { id: "interview", label: "Entretien" },
  { id: "offer", label: "Offre" },
  { id: "closed", label: "Clôturée" },
];
const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, s.label]));
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));
const OUTCOMES = [
  { id: "refused", label: "Refus" },
  { id: "withdrawn", label: "Abandon" },
  { id: "accepted", label: "Acceptée" },
];
const OUTCOME_LABEL = Object.fromEntries(OUTCOMES.map((o) => [o.id, o.label]));
const FU_KINDS = { relance1: "1re relance", relance2: "2e relance", merci: "Remerciement", custom: "Relance" };
const DOC_TYPES = [
  { id: "cv", label: "CV adapté" },
  { id: "letter", label: "Lettre de motivation" },
  { id: "linkedin", label: "Message LinkedIn" },
  { id: "answers", label: "Réponses formulaire" },
  { id: "email", label: "E-mail de candidature" },
];
const DOC_LABEL = Object.fromEntries(DOC_TYPES.map((d) => [d.id, d.label]));
const REPLY_KINDS = {
  accuse_reception: "Accusé de réception",
  invitation_entretien: "Invitation à un entretien",
  refus: "Refus",
  demande_info: "Demande d'information",
  offre: "Offre",
  autre: "Autre",
};
const CONTACT_TYPES = { recruiter: "Recruteur", agency: "Cabinet", hiring: "Hiring manager", network: "Réseau" };

const DEFAULT_SETTINGS = {
  theme: "system",
  threshold: 70,
  autoRescore: true,
  discreet: true,
  discreetCalendarTitles: true,
  employerNames: ["FEB", "VBO", "Fédération des Entreprises de Belgique", "Verbond van Belgische Ondernemingen"],
  model: "claude-opus-5-5",
  fallbackModel: "claude-sonnet-5-5",
  mcpMode: "auto",
  mcp: { gmail: "https://gmail.mcp.claude.com/mcp", gcal: "https://gcal.mcp.claude.com/mcp" },
  restrictTools: true,
  mcpTools: {
    gmailRead: ["search_threads", "get_thread", "get_message"],
    gmailDraft: ["create_draft"],
    gcal: ["create_event", "list_calendars"],
  },
  followUp: { afterSend: [7, 14], afterInterview: 2, calendarReminders: true },
  lookbackDays: 30,
  maxPerSource: 10,
  gmailDays: 14,
  lastWatchAt: null,
  lastGmailImportAt: null,
  lastReplyCheckAt: null,
  autoWatch: false,
  autoWatchHours: 24,
  autoGmail: false,
  importedRuns: [],
  sourcesPack: 2,
  autoNext: true,
  hideOlderThan: 45,
  sidebarCollapsed: false,
  // v3 : tri automatique, scoring et dédoublonnage systématiques, vérification des liens
  rules: null, // null = DEFAULT_RULES
  autoScore: true,
  autoScoreMax: 60,
  autoDedupe: true,
  autoDedupeAI: true,
  lastAiDedupeAt: null,
  autoVerify: true,
  lastVerifyAt: null,
  importedVerify: [],
  lastVisitAt: null,
  rulesAppliedV3: false,
};

const DEFAULT_PROFILE = {
  name: "",
  email: "",
  phone: "",
  linkedinUrl: "",
  education: [],
  certifications: [],
  headline: "Business Improvement Manager",
  home: "Ohain (Brabant wallon)",
  summary:
    "Business Improvement Manager dans une fédération patronale belge. Responsable du CRM (Dynamics 365) et d'une équipe de 4 personnes. Pilote des projets de digitalisation et d'automatisation des processus.",
  skills: [
    "Dynamics 365 / Dataverse",
    "Power Platform",
    "Automatisation (Power Automate, Make)",
    "Gestion d'équipe",
    "Transformation digitale",
    "Gestion de projets ICT",
    "Amélioration continue",
  ],
  experiences: [
    {
      id: "exp1",
      role: "Business Improvement Manager",
      org: "Fédération patronale belge",
      period: "[à compléter]",
      highlights: "Gestion du CRM Dynamics 365, management d'une équipe de 4, projets de digitalisation et d'automatisation.",
    },
  ],
  achievements: ["[à compléter : réalisation chiffrée 1]", "[à compléter : réalisation chiffrée 2]"],
  languages: [
    { lang: "Français", level: "courant" },
    { lang: "Néerlandais", level: "courant" },
    { lang: "Anglais", level: "courant" },
  ],
  cvText: "",
};

const DEFAULT_CRITERIA_BODY = {
  roles: [
    "Digital transformation manager",
    "Digital manager",
    "IT manager",
    "CRM manager",
    "Head of digital",
    "Business transformation manager",
    "Operational excellence manager",
    "CIO (structure moyenne)",
    "CDO (structure moyenne)",
  ],
  zones: ["Brabant wallon", "Bruxelles"],
  maxCommute: 60,
  remote: "Hybride",
  mustHave: ["Responsabilités managériales (équipe à diriger)", "Lieu de travail en Brabant wallon ou à Bruxelles", "Télétravail hybride possible"],
  wishes: [
    { id: "w1", label: "Périmètre transformation digitale / CRM / IT", weight: 5 },
    { id: "w2", label: "Bon équilibre vie professionnelle / vie privée", weight: 4 },
    { id: "w3", label: "Trajet court depuis Ohain", weight: 3 },
    { id: "w4", label: "Structure de taille moyenne, accès à la direction", weight: 3 },
    { id: "w5", label: "Environnement multilingue FR/NL/EN valorisé", weight: 2 },
  ],
  exclusions: ["Poste junior, stage ou intérim", "Poste 100 % sur site sans aucune flexibilité"],
  redFlags: ["Environnement décrit comme à très forte pression", "Turnover élevé", "Rôle ou périmètre flou"],
  keywords: {
    fr: ["transformation digitale", "responsable CRM", "responsable digital", "excellence opérationnelle", "amélioration continue"],
    nl: ["digitale transformatie", "CRM manager", "hoofd digitalisering", "operationele excellentie"],
    en: ["digital transformation", "CRM manager", "head of digital", "business transformation", "operational excellence"],
  },
};

const SOURCE_KIND_LABEL = {
  board: "Sites d'emploi",
  public: "Services publics & secteur public",
  agency: "Cabinets de recrutement",
  company: "Entreprises cibles",
  email: "Alertes e-mail uniquement",
  custom: "Sources personnalisées",
};

const DEFAULT_SOURCES = [
  { name: "Jobat", kind: "board", domains: ["jobat.be"] },
  { name: "StepStone", kind: "board", domains: ["stepstone.be"] },
  { name: "Indeed", kind: "board", domains: ["be.indeed.com"] },
  { name: "Références", kind: "board", domains: ["references.be"] },
  { name: "Welcome to the Jungle", kind: "board", domains: ["welcometothejungle.com"] },
  { name: "Glassdoor", kind: "board", domains: ["glassdoor.be"] },
  { name: "VDAB", kind: "public", domains: ["vdab.be"] },
  { name: "Le Forem", kind: "public", domains: ["leforem.be"] },
  { name: "Actiris", kind: "public", domains: ["actiris.brussels"] },
  { name: "Travailler pour la Belgique (ex-Selor / SPF)", kind: "public", domains: ["travaillerpour.be", "werkenvoor.be"] },
  { name: "Michael Page", kind: "agency", domains: ["michaelpage.be"] },
  { name: "Page Executive", kind: "agency", domains: ["pageexecutive.com"] },
  { name: "Hays", kind: "agency", domains: ["hays.be"] },
  { name: "Robert Walters", kind: "agency", domains: ["robertwalters.be"] },
  {
    name: "LinkedIn",
    kind: "email",
    domains: ["linkedin.com"],
    note: "Pas de collecte directe (scraping interdit par LinkedIn). Les offres arrivent via l'import des alertes e-mail Gmail.",
  },
].map((s, i) => ({ id: `src_default_${i}`, enabled: s.kind !== "email", careersUrl: null, lastRunAt: null, lastCount: null, lastError: null, lastNote: null, note: null, ...s }));

/* Pack « top employeurs belges » (Bruxelles, Brabant wallon et alentours) : surveillés via la recherche web sur leur domaine. */
const TOP_EMPLOYERS = [
  ["Proximus", "proximus.com"], ["Belfius", "belfius.be"], ["KBC / CBC", "kbc.com"], ["BNP Paribas Fortis", "bnpparibasfortis.be"],
  ["ING Belgique", "ing.be"], ["AG Insurance", "aginsurance.be"], ["AXA Belgium", "axa.be"], ["Ethias", "ethias.be"],
  ["Allianz Benelux", "allianz.be"], ["Baloise", "baloise.be"], ["Euroclear", "euroclear.com"], ["Swift (La Hulpe)", "swift.com"],
  ["Mastercard (Waterloo)", "mastercard.com"], ["UCB (Braine-l'Alleud)", "ucb.com"], ["GSK (Wavre / Rixensart)", "gsk.com"],
  ["IBA (Louvain-la-Neuve)", "iba-worldwide.com"], ["Syensqo", "syensqo.com"], ["Solvay", "solvay.com"], ["Lhoist", "lhoist.com"],
  ["D'Ieteren", "dieteren.be"], ["Colruyt Group", "colruytgroup.com"], ["Delhaize", "delhaize.be"], ["bpost", "bpost.be"],
  ["SNCB", "belgiantrain.be"], ["Infrabel", "infrabel.be"], ["Elia", "elia.be"], ["Engie Belgium", "engie.be"], ["Sibelga", "sibelga.be"],
  ["Vivaqua", "vivaqua.be"], ["STIB-MIVB", "stib-mivb.be"], ["Brussels Airport", "brusselsairport.be"], ["Securex", "securex.be"],
  ["SD Worx", "sdworx.com"], ["Partena", "partena.be"], ["Smals", "smals.be"], ["Solidaris", "solidaris.be"], ["Mutualité chrétienne", "mc.be"],
  ["Partenamut", "partenamut.be"], ["UCLouvain", "uclouvain.be"], ["ULB", "ulb.be"], ["Cliniques universitaires Saint-Luc", "saintluc.be"],
  ["Paradigm (Région bruxelloise)", "paradigm.brussels"], ["Bruxelles Environnement", "environnement.brussels"], ["Sodexo", "sodexo.com"],
].map(([name, domain]) => ({
  id: `src_top_${domain.replace(/[^a-z0-9]/gi, "_")}`, name, kind: "company", domains: [domain], careersUrl: null, enabled: true, pack: "top-be",
  lastRunAt: null, lastCount: null, lastError: null, lastNote: null, note: null,
}));
DEFAULT_SOURCES.push(...TOP_EMPLOYERS);

/* Temps de trajet voiture hors heures de pointe depuis Ohain — ordre de grandeur, toujours affiché comme estimation. */
const COMMUTE_FROM_OHAIN = {
  ohain: 5, lasne: 8, "la hulpe": 12, waterloo: 12, rixensart: 15, genval: 15, overijse: 15, hoeilaart: 15,
  "braine l alleud": 18, wavre: 20, limal: 20, bierges: 20, ottignies: 22, "louvain la neuve": 25, "court saint etienne": 25,
  tervuren: 25, uccle: 25, "watermael boitsfort": 25, "auderghem": 27, nivelles: 30, ixelles: 30, woluwe: 30, zaventem: 30,
  etterbeek: 32, diegem: 32, bruxelles: 35, brussels: 35, brussel: 35, "saint gilles": 32, forest: 30, halle: 35, machelen: 35,
  gembloux: 35, leuven: 35, louvain: 35, "saint josse": 38, evere: 40, schaerbeek: 40, anderlecht: 40, vilvoorde: 40, jodoigne: 40,
  "molenbeek": 42, mechelen: 45, malines: 45, namur: 45, charleroi: 45, aalst: 55, alost: 55, mons: 55, antwerpen: 60, anvers: 60,
  hasselt: 65, gent: 70, gand: 70, liege: 70, luik: 70,
};
const COMMUTE_KEYS = Object.keys(COMMUTE_FROM_OHAIN).sort((a, b) => b.length - a.length);

/* ════════════════════════════════════════════════════════════════════════
   2. UTILITAIRES
   ════════════════════════════════════════════════════════════════════════ */

const uid = (p = "id") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const nowISO = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (iso, n) => { const d = new Date(iso || Date.now()); d.setDate(d.getDate() + n); return d.toISOString(); };
const daysFromToday = (iso) => Math.round((startOfDay(iso) - startOfDay(new Date())) / 864e5);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const deepClone = (o) => JSON.parse(JSON.stringify(o));

function fmtDate(iso, opts = {}) {
  if (!iso) return NC;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const s = d.toLocaleDateString("fr-BE", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
  return opts.time ? `${s} · ${d.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })}` : s;
}
function relDay(iso) {
  const n = daysFromToday(iso);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  if (n === -1) return "hier";
  return n > 0 ? `dans ${n} j` : `il y a ${-n} j`;
}
function relTime(iso) {
  if (!iso) return "jamais";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 6e4);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}
const show = (v) => (v === null || v === undefined || v === "" ? NC : v);
const toLocalInput = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const EMPTY_MARKERS = /^(null|n\/?a|none|unknown|inconnu|non communiqu[ée]|non pr[ée]cis[ée]|not specified|-|—)$/i;
function str(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return !s || EMPTY_MARKERS.test(s) ? null : s;
}
function normText(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
const STOP = new Set("h f m x v w de du des la le les et en a au aux the of and for een het van voor bij met of in to".split(" "));
const tokens = (s) => normText(s).split(" ").filter((t) => t.length > 1 && !STOP.has(t));
function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((x) => B.has(x) && inter++);
  return inter / (A.size + B.size - inter);
}
const companyKey = (s) =>
  normText(s).replace(/\b(sa|nv|srl|bv|bvba|sprl|asbl|vzw|group|groupe|belgium|belgique|belgie|international)\b/g, " ").replace(/\s+/g, " ").trim();

function canonicalUrl(u) {
  if (!u) return "";
  try {
    const x = new URL(u);
    [...x.searchParams.keys()].forEach((k) => {
      if (/^(utm_|ref|trk|tracking|src$|from$|refid|trackingid|origin)/i.test(k)) x.searchParams.delete(k);
    });
    x.hash = "";
    return (x.host.replace(/^www\./, "") + x.pathname.replace(/\/$/, "") + x.search).toLowerCase();
  } catch {
    return String(u).toLowerCase();
  }
}
const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return null; } };

function estimateCommute(location, aiMinutes) {
  const n = ` ${normText(location)} `;
  if (n.trim()) {
    const key = COMMUTE_KEYS.find((k) => n.includes(` ${k} `));
    if (key) return { minutes: COMMUTE_FROM_OHAIN[key], basis: "table locale" };
  }
  const m = Number(aiMinutes);
  if (Number.isFinite(m) && m > 0 && m < 400) return { minutes: Math.round(m), basis: "estimation IA" };
  return null;
}
const commuteLabel = (c) => (c ? `~${c.minutes} min` : NC);

/* Identifiant stable d'une annonce sur les grands sites (LinkedIn, Indeed, StepStone, Jobat…), quel que soit le format d'URL. */
function jobKey(u) {
  if (!u) return null;
  let m;
  const s = String(u).toLowerCase();
  if ((m = s.match(/linkedin\.com\/(?:comm\/)?jobs\/view\/(?:[^/?#]*?-)?(\d{6,})/))) return `li:${m[1]}`;
  if ((m = s.match(/linkedin\.com\/jobs\/.*[?&]currentjobid=(\d{6,})/))) return `li:${m[1]}`;
  if ((m = s.match(/indeed\.[a-z.]+\/.*[?&](?:jk|vjk)=([0-9a-f]{12,})/))) return `in:${m[1]}`;
  if ((m = s.match(/stepstone\.be\/.*?--(\d{6,})/))) return `st:${m[1]}`;
  if ((m = s.match(/glassdoor\.[a-z.]+\/.*?jl=?(\d{6,})/))) return `gd:${m[1]}`;
  if ((m = s.match(/jobat\.be\/.*?\/(\d{6,})/))) return `jb:${m[1]}`;
  return null;
}
/* Intitulé nettoyé pour comparer : sans (m/f/x), h/f, lieu ou référence en suffixe. */
function cleanTitle(t) {
  return normText(String(t || "")
    .replace(/\((?:[mhfvwxd]\s*[/|,]\s*)+[mhfvwxd]\)|\b[mhfv]\s*\/\s*[mhfvwx](?:\s*\/\s*[xd])?\b/gi, " ")
    .replace(/\s[-–|·]\s.*$/, " ")
    .replace(/\b(ref|réf|job id)\b.*$/i, " "));
}
const realCompany = (c) => !!str(c) && !/confidenti|anonym|non communiqu|undisclosed|our client|notre client|onze klant|client final/i.test(c);
const offerKeys = (o) => (o.sources || []).flatMap((s) => [canonicalUrl(s.url), jobKey(s.url)]).filter(Boolean);

/* Déduplication : même URL ou même identifiant d'annonce ; ou même entreprise + intitulés proches ;
   ou, employeur masqué (cabinet), intitulé identique et même lieu. */
const FEAT = new WeakMap();
function offerFeat(o) {
  let f = FEAT.get(o);
  if (!f) {
    f = { keys: new Set(offerKeys(o)), toks: tokens(cleanTitle(o.title)), co: realCompany(o.company) ? companyKey(o.company) : "", loc: normText(o.location) };
    FEAT.set(o, f);
  }
  return f;
}
function sameOffer(a, b) {
  const fa = offerFeat(a), fb = offerFeat(b);
  for (const k of fa.keys) if (fb.keys.has(k)) return true;
  const sim = jaccard(fa.toks, fb.toks);
  if (fa.co && fb.co) {
    const sameCo = fa.co === fb.co || (fa.co.length > 3 && fb.co.length > 3 && (fa.co.includes(fb.co) || fb.co.includes(fa.co)));
    return sameCo && sim >= 0.6;
  }
  return sim >= 0.85 && !!fa.loc && fa.loc === fb.loc;
}
const FILLABLE = ["company", "location", "commute", "contract", "seniority", "salary", "remote", "language", "publishedAt", "deadline"];
function mergeOffers(existing, incoming) {
  const list = [...existing]; // seules les offres touchées deviennent de nouveaux objets (sauvegarde différentielle)
  const added = [], merged = [];
  for (const inc of incoming) {
    const hi = list.findIndex((o) => !o.spontaneous && sameOffer(o, inc));
    if (hi >= 0) {
      const hit = { ...list[hi] };
      list[hi] = hit;
      const srcs = [...(hit.sources || [])];
      for (const s of inc.sources) if (!srcs.some((x) => canonicalUrl(x.url) === canonicalUrl(s.url) && x.name === s.name)) srcs.push(s);
      for (const k of FILLABLE) if ((hit[k] === null || hit[k] === undefined || hit[k] === "") && inc[k]) hit[k] = inc[k];
      if (hit.publishedApprox && inc.publishedAt && !inc.publishedApprox) { hit.publishedAt = inc.publishedAt; delete hit.publishedApprox; }
      if (inc.description && (!hit.description || inc.description.length > hit.description.length)) hit.description = inc.description;
      if (inc.fullText && !hit.fullText) hit.fullText = inc.fullText;
      hit.sources = srcs;
      hit.lastSeenAt = nowISO();
      if (!merged.includes(hit.id) && !added.includes(hit.id)) merged.push(hit.id);
    } else {
      list.unshift(inc);
      added.push(inc.id);
    }
  }
  return { list, added, merged };
}

/* Fusion d'un groupe d'offres identiques dans une offre principale (annulable via mergeHistory). */
function pickPrimary(members, pipeIds) {
  return members.find((o) => pipeIds.has(o.id))
    || members.find((o) => o.dismissedBy === "user" || o.expiredBy === "user")
    || [...members].sort((a, b) => (b.score?.value ?? -1) - (a.score?.value ?? -1) || new Date(a.collectedAt) - new Date(b.collectedAt))[0];
}
function mergeMembers(primary, absorbed, reason, origin) {
  const before = { sources: primary.sources, description: primary.description, ...Object.fromEntries(FILLABLE.map((k) => [k, primary[k]])) };
  const merged = { ...primary, sources: [...(primary.sources || [])] };
  for (const o of absorbed) {
    for (const src of o.sources || []) if (!merged.sources.some((x) => canonicalUrl(x.url) === canonicalUrl(src.url) && x.name === src.name)) merged.sources.push(src);
    for (const k of FILLABLE) if ((merged[k] === null || merged[k] === undefined || merged[k] === "") && o[k]) merged[k] = o[k];
    if (o.description && (!merged.description || o.description.length > merged.description.length)) merged.description = o.description;
    if (!merged.seenAt && o.seenAt) merged.seenAt = o.seenAt;
  }
  const slim = absorbed.map(({ mergeHistory: _m, ...rest }) => rest);
  merged.mergeHistory = [...(primary.mergeHistory || []), { id: uid("merge"), at: nowISO(), reason: str(reason), origin, before, absorbed: slim }];
  return merged;
}
/* Dédoublonnage local systématique (URL, identifiant d'annonce, entreprise + intitulé) sur tout le stock. */
function dedupeLocal(list, apps) {
  const pipeIds = new Set((apps || []).map((a) => a.offerId));
  const n = list.length;
  const parent = list.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const members = (r) => list.filter((_, k) => find(k) === r);
  for (let i = 0; i < n; i++) {
    if (list[i].demo || list[i].spontaneous) continue;
    for (let j = i + 1; j < n; j++) {
      if (list[j].demo || list[j].spontaneous || find(i) === find(j) || !sameOffer(list[i], list[j])) continue;
      const ri = find(i), rj = find(j);
      const pipes = [...members(ri), ...members(rj)].filter((o) => pipeIds.has(o.id)).length;
      if (pipes > 1) continue; // deux candidatures distinctes : jamais fusionnées
      parent[rj] = ri;
    }
  }
  const groups = {};
  list.forEach((o, i) => { const r = find(i); (groups[r] = groups[r] || []).push(o); });
  const multi = Object.values(groups).filter((g) => g.length > 1);
  if (!multi.length) return { list, merged: 0 };
  const drop = new Set();
  const repl = new Map();
  for (const g of multi) {
    const p = pickPrimary(g, pipeIds);
    const abs = g.filter((o) => o !== p);
    abs.forEach((o) => drop.add(o.id));
    repl.set(p.id, mergeMembers(p, abs, "même annonce (URL, identifiant ou entreprise + intitulé)", "automatique"));
  }
  return { list: list.filter((o) => !drop.has(o.id)).map((o) => repl.get(o.id) || o), merged: drop.size };
}
/* Applique les règles à une liste : renvoie la nouvelle liste et les offres modifiées (pour annuler). */
function applyRules(list, ver, rules, onlyIds) {
  const prev = [];
  const counts = {};
  const at = nowISO();
  const next = list.map((o) => {
    if (onlyIds && !onlyIds.has(o.id)) return o;
    const v = ruleVerdict(o, ver, rules);
    if (!v) return o;
    prev.push(o);
    counts[v.rule] = (counts[v.rule] || 0) + 1;
    return applyVerdict(o, v, at);
  });
  return { list: next, prev, counts };
}
const RULE_LABEL = { title: "intitulé exclu", seniority: "pas de management", domain: "hors périmètre", deadline: "date limite dépassée", link: "annonce clôturée", age: "trop ancienne", commute: "trajet trop long", score: "score trop bas" };
const rulesOf = (settings) => ({ ...DEFAULT_RULES, ...(settings?.rules || {}) });

/* Date « YYYY-MM-DD » valide et plausible (pas dans plus d'un an), sinon null. */
function isoDay(v) {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`) : new Date(s);
  if (isNaN(d.getTime()) || Math.abs(d.getTime() - Date.now()) > 400 * 864e5) return null;
  return d.toISOString().slice(0, 10);
}
function normalizeOffer(raw, { sourceName, via, verifiedUrls, toolText, allowNoUrl }) {
  if (!raw || typeof raw !== "object") return null;
  const urlRaw = str(raw.url);
  const url = urlRaw && /^https?:\/\//i.test(urlRaw) ? urlRaw : null;
  const title = str(raw.title);
  if (!title || (!url && !allowNoUrl)) return null;
  let verified = null;
  if (url && verifiedUrls) verified = verifiedUrls.some((v) => canonicalUrl(v) === canonicalUrl(url));
  if (url && toolText) verified = toolText.includes(url) || toolText.includes(url.replace(/&/g, "&amp;"));
  const lang = str(raw.language);
  const t = nowISO();
  return {
    id: uid("off"),
    title,
    company: str(raw.company),
    location: str(raw.location),
    commute: estimateCommute(raw.location, raw.commuteMinutes),
    contract: str(raw.contract),
    seniority: str(raw.seniority),
    salary: str(raw.salary),
    remote: str(raw.remote),
    language: lang && /^(fr|nl|en)$/i.test(lang) ? lang.toLowerCase() : null,
    publishedAt: isoDay(raw.publishedAt),
    publishedApprox: raw.publishedApprox === true || undefined,
    deadline: isoDay(raw.deadline),
    description: (str(raw.description) || "").slice(0, 4000) || null,
    collectedAt: t,
    lastSeenAt: t,
    sources: [{ name: str(raw.sourceName) || sourceName, url, collectedAt: t, via, verified, emailSubject: str(raw.emailSubject) }],
    status: "new",
    score: null,
    demo: false,
  };
}

async function pool(items, size, fn) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift());
  });
  await Promise.all(workers);
}

function mentionsEmployer(text, names) {
  if (!text) return [];
  return (names || []).filter((n) => {
    const s = (n || "").trim();
    if (!s) return false;
    if (s.length <= 4) return new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
    return text.toLowerCase().includes(s.toLowerCase());
  });
}

function veilleConfig(version, sources, settings, sourceIds) {
  const { id, label, createdAt, ...c } = version || {};
  const src = sources
    .filter((x) => x.kind !== "email" && (sourceIds ? sourceIds.includes(x.id) : x.enabled))
    .map((x) => ({ name: x.name, kind: x.kind, domains: x.kind === "company" && x.careersUrl ? [hostOf(x.careersUrl)].filter(Boolean) : x.domains || [], careersUrl: x.careersUrl || null }));
  const body = {
    criteriaLabel: label || null,
    roles: c.roles || [], zones: c.zones || [], maxCommute: c.maxCommute ?? 60, remote: c.remote || null,
    mustHave: c.mustHave || [], exclusions: c.exclusions || [], keywords: c.keywords || { fr: [], nl: [], en: [] },
    sources: src, lookbackDays: settings.lookbackDays, maxPerSource: settings.maxPerSource, home: "Ohain (Brabant wallon)",
    filters: (() => { const r = rulesOf(settings); return { maxAgeDays: r.maxAgeDays, titleExclude: r.titleExclude, managementOnly: r.requireSeniority, seniorityWords: r.seniorityTokens.slice(0, 25) }; })(),
  };
  return { ...body, sig: JSON.stringify(body) };
}

/* Une offre « active » : ni écartée, ni expirée, ni liée à une candidature clôturée. */
const INACTIVE = ["dismissed", "expired", "closed"];
const isActiveOffer = (o) => !o.spontaneous && !INACTIVE.includes(o.status);
const ratingKey = (company) => companyKey(company || "").replace(/\s+/g, "-").slice(0, 120);
const fmtRating = (r) => (r && typeof r.rating === "number" ? r.rating.toFixed(1).replace(".", ",") : null);

/* ── Fraîcheur, règles de tri automatique, score systématique ─────────── */
const DAY = 864e5;
const validDate = (d) => !!d && !isNaN(new Date(d).getTime());
const ageDays = (iso) => (validDate(iso) ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : null);
const deadlineIn = (o) => (validDate(o.deadline) ? daysFromToday(o.deadline) : null);
const pubRef = (o) => (validDate(o.publishedAt) ? o.publishedAt : null);

/* Étiquette de fraîcheur affichée partout : publiée il y a X j (ou « date inconnue »). */
function freshness(o) {
  const a = ageDays(pubRef(o));
  if (a === null) return { label: "date inconnue", tone: "warn", days: null };
  const label = a <= 0 ? "aujourd'hui" : a === 1 ? "hier" : `il y a ${a} j`;
  return { label: o.publishedApprox ? `≈ ${label}` : label, tone: a <= 7 ? "ok" : a <= 21 ? "neutral" : "warn", days: a };
}

const DEFAULT_RULES = {
  enabled: true,
  titleExclude: ["junior", "stage", "stagiaire", "stagiair", "intern", "internship", "trainee", "student", "etudiant", "jobstudent", "alternance", "apprenti", "apprentice", "graduate", "starter", "vrijwilliger", "benevole"],
  requireSeniority: true,
  seniorityTokens: ["manager", "head", "lead", "leader", "director", "directeur", "directrice", "direction", "responsable", "responsible", "mgr", "chef", "hoofd", "diensthoofd", "verantwoordelijke", "teamleader", "teamlead", "chief", "cio", "cdo", "cto", "dsi", "vp", "president"],
  requireDomain: true,
  domainTokens: ["digital", "digitale", "digitalisation", "digitalisering", "it", "ict", "informatique", "informatica", "crm", "transformation", "transformatie", "process", "processus", "processen", "excellence", "excellentie", "operations", "operational", "operationnel", "operationele", "amelioration", "improvement", "verbetering", "data", "information", "informatie", "systems", "systemes", "business", "innovation", "erp", "dynamics", "automation", "automatisation", "technology", "technologie", "applications", "programme", "program", "pmo", "projects", "projets", "change", "cio", "cdo", "cto", "dsi", "digitalization", "digitization", "application", "solution", "solutions", "workplace", "web", "iam", "security", "cyber", "architecture", "platform", "dt", "delivery", "service desk", "servicedesk", "quality"],
  maxAgeDays: 30,
  unknownDateMaxDays: 21,
  commuteSlack: 20,
  dismissBelow: 40,
};

/* Verdict des règles pour une offre active non protégée : null (garder) ou { status, reason }. */
function ruleVerdict(o, crit, rules) {
  if (!rules?.enabled || !o || o.demo || o.spontaneous || o.userKept || !["new"].includes(o.status)) return null;
  const tt = ` ${normText(o.title)} `;
  const hit = (rules.titleExclude || []).find((w) => w && tt.includes(` ${normText(w)} `));
  if (hit) return { status: "dismissed", rule: "title", reason: `intitulé exclu (« ${hit} »)` };
  if (rules.requireSeniority && !(rules.seniorityTokens || []).some((w) => tt.includes(` ${normText(w)} `)))
    return { status: "dismissed", rule: "seniority", reason: "pas un poste de management (intitulé)" };
  if (rules.requireDomain) {
    const roleTokens = (crit?.roles || []).flatMap((r) => tokens(r)).filter((w) => !(rules.seniorityTokens || []).includes(w));
    const dom = [...new Set([...(rules.domainTokens || []), ...roleTokens].map(normText).filter(Boolean))];
    if (!dom.some((w) => tt.includes(` ${w} `))) return { status: "dismissed", rule: "domain", reason: "hors périmètre digital / IT / CRM / transformation (intitulé)" };
  }
  const dl = deadlineIn(o);
  if (dl !== null && dl < 0) return { status: "expired", rule: "deadline", reason: `date limite dépassée (${fmtDate(o.deadline)})` };
  if (o.link?.state === "closed") return { status: "expired", rule: "link", reason: o.link.evidence ? `annonce clôturée : ${o.link.evidence}` : "annonce clôturée (vérifiée)" };
  const age = ageDays(pubRef(o));
  if (age !== null && rules.maxAgeDays && age > rules.maxAgeDays) return { status: "expired", rule: "age", reason: `publiée il y a ${age} j (probablement pourvue)` };
  if (age === null && rules.unknownDateMaxDays && o.link?.state !== "open") {
    const seen = ageDays(o.collectedAt);
    if (seen !== null && seen > rules.unknownDateMaxDays) return { status: "expired", rule: "age", reason: `date inconnue, collectée il y a ${seen} j` };
  }
  const max = Number(crit?.maxCommute) || 0;
  if (max && o.commute?.minutes && o.commute.minutes > max + (rules.commuteSlack || 0)) return { status: "dismissed", rule: "commute", reason: `trajet ~${o.commute.minutes} min (max ${max})` };
  if (rules.dismissBelow && o.score?.method === 2 && o.score.value < rules.dismissBelow) return { status: "dismissed", rule: "score", reason: `score ${o.score.value} < ${rules.dismissBelow}` };
  return null;
}
const applyVerdict = (o, v, at = nowISO()) => ({ ...o, status: v.status, autoReason: v.reason, autoRule: v.rule, dismissedBy: "auto", ...(v.status === "expired" ? { expiredAt: at } : { dismissedAt: at }) });

/* Liste figée des critères d'une version, avec identifiants stables pour le scoring. */
function criteriaList(ver) {
  return [
    ...(ver?.mustHave || []).map((label, i) => ({ id: `M${i + 1}`, kind: "indispensable", label, weight: null })),
    ...(ver?.wishes || []).map((w, i) => ({ id: `W${i + 1}`, kind: "souhaité", label: w.label, weight: clamp(Number(w.weight) || 1, 1, 5) })),
    ...(ver?.exclusions || []).map((label, i) => ({ id: `X${i + 1}`, kind: "exclusion", label, weight: null })),
    ...(ver?.redFlags || []).map((label, i) => ({ id: `A${i + 1}`, kind: "alerte", label, weight: null })),
  ];
}

/* Score systématique : calculé ici, à partir des taux de correspondance renvoyés par l'IA, toujours avec la même formule.
   55 % souhaités (moyenne pondérée) + 45 % indispensables (moyenne) ; plafonds et pénalités ci-dessous. */
function computeScore(rows) {
  const avg = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
  const must = rows.filter((r) => r.kind === "indispensable");
  const wish = rows.filter((r) => r.kind === "souhaité");
  const wSum = wish.reduce((a, r) => a + (r.weight || 1), 0);
  const wishAvg = wSum ? wish.reduce((a, r) => a + r.match * (r.weight || 1), 0) / wSum : null;
  const mustAvg = avg(must.map((r) => r.match));
  let score = wishAvg === null ? mustAvg ?? 50 : mustAvg === null ? wishAvg : 0.55 * wishAvg + 0.45 * mustAvg;
  const caps = [];
  const alerts = rows.filter((r) => r.kind === "alerte" && r.match >= 70).length;
  if (alerts) { score -= Math.min(15, alerts * 5); caps.push(`${alerts} signal(aux) d'alerte : −${Math.min(15, alerts * 5)}`); }
  if (must.some((r) => r.match < 30)) { score = Math.min(score, 45); caps.push("indispensable non rempli : plafond 45"); }
  if (rows.some((r) => r.kind === "exclusion" && r.match >= 70)) { score = Math.min(score, 20); caps.push("exclusion touchée : plafond 20"); }
  return { value: clamp(Math.round(score), 0, 100), caps, wishAvg: wishAvg === null ? null : Math.round(wishAvg), mustAvg: mustAvg === null ? null : Math.round(mustAvg) };
}

/* ── Documents « prêts à envoyer » : balisage léger → modèle → mise en page ──
   # Nom · > accroche (CV) ou destinataire (lettre) · @ coordonnées · = date · ## section / objet
   ### Poste | Organisation | Lieu | Période · - puce · **Libellé :** valeur · ~ signature · ligne vide = paragraphe
   Chaque bloc garde ses lignes sources (l0, l1) : un clic dans l'aperçu édite exactement ces lignes. */
function parseDoc(text) {
  const blocks = [];
  let para = null;
  const flush = () => { if (para) { blocks.push({ t: "para", text: para.lines.join(" "), l0: para.l0, l1: para.l1 }); para = null; } };
  const push = (b, i) => { flush(); blocks.push({ ...b, l0: i, l1: i }); };
  String(text || "").split("\n").forEach((raw, i) => {
    const l = raw.trim();
    let m;
    if (!l) { flush(); return; }
    if (l.startsWith("### ")) push({ t: "h3", text: l.slice(4) }, i);
    else if (l.startsWith("## ")) push({ t: "h2", text: l.slice(3) }, i);
    else if (l.startsWith("# ")) push({ t: "name", text: l.slice(2) }, i);
    else if (/^[-•*] /.test(l)) push({ t: "bullet", text: l.slice(2) }, i);
    else if (l.startsWith("> ")) push({ t: "quote", text: l.slice(2) }, i);
    else if (l.startsWith("@ ")) push({ t: "contact", text: l.slice(2) }, i);
    else if (l.startsWith("= ")) push({ t: "date", text: l.slice(2) }, i);
    else if (l.startsWith("~ ")) push({ t: "sign", text: l.slice(2) }, i);
    else if ((m = l.match(/^\*\*(.+?)\*\*\s*(.*)$/))) push({ t: "kv", label: m[1], text: m[2] }, i);
    else { if (!para) para = { lines: [], l0: i, l1: i }; para.lines.push(l); para.l1 = i; }
  });
  flush();
  return blocks.map((b) => ({ ...b, text: String(b.text || "").replace(/\*\*/g, ""), label: b.label && b.label.replace(/\*\*/g, "") }));
}
function docPlainText(text) {
  return parseDoc(text).map((b) => {
    if (b.t === "h2") return `\n${b.text.toUpperCase()}`;
    if (b.t === "h3") return `\n${b.text.split("|").map((x) => x.trim()).filter(Boolean).join(" | ")}`;
    if (b.t === "bullet") return `- ${b.text}`;
    if (b.t === "kv") return `${b.label} ${b.text}`;
    if (b.t === "para") return `${b.text}\n`;
    return b.text;
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
const HEX = /^#?([0-9a-f]{6})$/i;
const cleanHex = (h, fallback = "#3f3d56") => (HEX.test(String(h || "").trim()) ? `#${String(h).trim().replace("#", "").toLowerCase()}` : fallback);
const hexRgb = (h) => { const x = cleanHex(h).slice(1); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)); };
const rgbHex = (r) => `#${r.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("")}`;
const mixHex = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A.map((v, i) => v + (B[i] - v) * t)); };
const luminance = (h) => { const [r, g, b] = hexRgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/* ── Document structuré : découpage du balisage, modèle d'édition, ordre de rendu ──
   Le texte balisé reste la source enregistrée (versions, PDF, copie ATS) ; l'éditeur travaille sur un modèle
   (en-tête + sections typées) reconverti en balisage à chaque frappe. */
const PERIOD_RE = /\b(19|20)\d{2}\b|aujourd|pr[ée]sent|heden|today|now\b|actuel|current|en cours|depuis|sinds|since/i;
const SEC = {
  profile: /^(profil|profile|profiel|r[ée]sum[ée]|summary|samenvatting|about|à propos)/i,
  achievements: /(r[ée]alisations|achievements|realisaties|accomplishments|r[ée]sultats cl|key results|verwezenlijkingen)/i,
  experience: /(exp[ée]rience|werkervaring|ervaring|parcours|loopbaan|employment)/i,
  skills: /(comp[ée]tences|skills|vaardigheden|competenties|expertise|outils)/i,
  languages: /^(langues|languages|talen)/i,
  education: /(formation|education|opleiding|dipl[oô]mes|[ée]tudes|studies)/i,
};
const oneLine = (s) => String(s || "").replace(/\s*\n+\s*/g, " ").replace(/\s{2,}/g, " ").trim();
const stripColon = (s) => String(s || "").replace(/\s*:\s*$/, "").trim();
const mkItem = (text = "") => ({ id: uid("i"), text });

function splitH3(text) {
  const p = String(text || "").split("|").map((x) => x.trim());
  while (p.length > 1 && !p[p.length - 1]) p.pop();
  if (p.length >= 4) return { role: p[0], org: p[1], place: p[2], period: p.slice(3).filter(Boolean).join(" · ") };
  if (p.length === 3) return PERIOD_RE.test(p[2]) ? { role: p[0], org: p[1], place: "", period: p[2] } : { role: p[0], org: p[1], place: p[2], period: "" };
  if (p.length === 2) return PERIOD_RE.test(p[1]) ? { role: p[0], org: "", place: "", period: p[1] } : { role: p[0], org: p[1], place: "", period: "" };
  return { role: p[0] || "", org: "", place: "", period: "" };
}
function joinH3(e) {
  const p = [e.role, e.org, e.place, e.period].map((x) => oneLine(x).replace(/\|/g, "/"));
  while (p.length > 1 && !p[p.length - 1]) p.pop();
  return p.join(" | ");
}

function docOutline(text, kind) {
  const head = [], sections = [];
  let cur = null, sign = "";
  for (const raw of String(text || "").split("\n")) {
    const l = raw.trim();
    if (l.startsWith("## ")) { cur = { title: l.slice(3).replace(/\*\*/g, "").trim(), lines: [] }; sections.push(cur); continue; }
    if (l.startsWith("~ ")) { sign = l.slice(2).trim(); continue; }
    (cur ? cur.lines : head).push(raw);
  }
  const o = { name: "", headline: "", contact: "", date: "", recipients: [], sign, sections };
  for (const b of parseDoc(head.join("\n"))) {
    if (b.t === "name" && !o.name) o.name = b.text;
    else if (b.t === "contact") o.contact = o.contact ? `${o.contact} | ${b.text}` : b.text;
    else if (b.t === "date" && !o.date) o.date = b.text;
    else if (b.t === "quote") { if (kind === "cv") o.headline = o.headline ? `${o.headline} ${b.text}` : b.text; else o.recipients.push(b.text); }
  }
  const pre = head.filter((l) => !/^(# |> |@ |= )/.test(l.trim()));
  if (pre.some((l) => l.trim())) sections.unshift({ title: "", lines: pre });
  return o;
}

function sectionFromLines(title, lines) {
  const blocks = parseDoc(lines.join("\n"));
  const s = { id: uid("sec"), title, kind: "raw" };
  const ts = blocks.map((b) => b.t);
  const only = (...k) => ts.every((t) => k.includes(t));
  if (!blocks.length || only("para")) return { ...s, kind: "text", paras: blocks.length ? blocks.map((b) => mkItem(b.text)) : [mkItem()] };
  if (only("bullet")) return { ...s, kind: "bullets", items: blocks.map((b) => mkItem(b.text)) };
  if (only("kv")) return { ...s, kind: "kv", rows: blocks.map((b) => ({ id: uid("r"), label: stripColon(b.label), value: b.text })) };
  if (ts[0] === "h3" && only("h3", "para", "bullet")) {
    const entries = [];
    let ok = true;
    for (const b of blocks) {
      if (b.t === "h3") { entries.push({ id: uid("e"), ...splitH3(b.text), paras: [], bullets: [] }); continue; }
      const e = entries[entries.length - 1];
      if (b.t === "bullet") e.bullets.push(mkItem(b.text));
      else if (e.bullets.length) { ok = false; break; } else e.paras.push(mkItem(b.text));
    }
    if (ok) return { ...s, kind: "entries", entries };
  }
  return { ...s, raw: lines.join("\n").trim() };
}

function docToModel(text, kind) {
  const o = docOutline(text, kind);
  return {
    name: o.name, headline: o.headline, contact: o.contact, date: o.date, recipients: o.recipients.join("\n"), sign: o.sign,
    sections: o.sections.map((s) => sectionFromLines(s.title, s.lines)),
  };
}

function sectionToLines(s, lang) {
  const L = [];
  const colon = lang === "fr" ? " :" : ":";
  if (s.kind === "text") for (const p of s.paras || []) { const t = oneLine(p.text); if (t) L.push(t, ""); }
  else if (s.kind === "bullets") for (const it of s.items || []) { const t = oneLine(it.text); if (t) L.push(`- ${t}`); }
  else if (s.kind === "kv") {
    for (const r of s.rows || []) {
      const lab = oneLine(stripColon(r.label)).replace(/\*\*/g, ""), val = oneLine(r.value);
      if (lab) L.push(`**${lab}${colon}** ${val}`); else if (val) L.push(`**${val}**`);
    }
  } else if (s.kind === "entries") {
    for (const e of s.entries || []) {
      const h = joinH3(e);
      const paras = (e.paras || []).map((p) => oneLine(p.text)).filter(Boolean);
      const bullets = (e.bullets || []).map((b) => oneLine(b.text)).filter(Boolean);
      if (!h && !paras.length && !bullets.length) continue;
      L.push(`### ${h || "[à compléter : intitulé]"}`);
      paras.forEach((p) => L.push(p, ""));
      bullets.forEach((b) => L.push(`- ${b}`));
      L.push("");
    }
  } else L.push(String(s.raw || "").trim());
  return L;
}

function modelToDoc(m, kind, lang) {
  const L = [];
  if (oneLine(m.name)) L.push(`# ${oneLine(m.name)}`);
  if (kind === "cv" && oneLine(m.headline)) L.push(`> ${oneLine(m.headline)}`);
  if (oneLine(m.contact)) L.push(`@ ${oneLine(m.contact)}`);
  if (oneLine(m.date)) L.push(`= ${oneLine(m.date)}`);
  if (kind !== "cv") String(m.recipients || "").split("\n").map(oneLine).filter(Boolean).forEach((r) => L.push(`> ${r}`));
  m.sections.forEach((s, i) => {
    const body = sectionToLines(s, lang);
    const title = oneLine(s.title) || (i > 0 ? "Section" : "");
    if (!title && !body.some(Boolean)) return;
    L.push("");
    if (title) L.push(`## ${title}`);
    L.push(...body);
  });
  if (oneLine(m.sign)) L.push("", `~ ${oneLine(m.sign)}`);
  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
const normalizeDoc = (text, kind, lang) => modelToDoc(docToModel(String(text || "").replace(/^```\w*\n?|```\s*$/g, ""), kind), kind, lang);

/* Ordre de rendu commun à l'aperçu et au PDF ; sec = index de section (« head », « sign » pour l'en-tête et la signature). */
function layoutBlocks(text, kind) {
  const o = docOutline(text, kind);
  const out = [];
  if (o.name) out.push({ t: "name", text: o.name, sec: "head" });
  if (kind === "cv" && o.headline) out.push({ t: "quote", text: o.headline, sec: "head" });
  if (o.contact) out.push({ t: "contact", text: o.contact, sec: "head" });
  if (o.date) out.push({ t: "date", text: o.date, sec: "head" });
  if (kind !== "cv") o.recipients.forEach((r) => out.push({ t: "quote", text: r, sec: "head" }));
  o.sections.forEach((s, i) => {
    if (s.title) out.push({ t: "h2", text: s.title, sec: i });
    parseDoc(s.lines.join("\n")).forEach((b) => out.push({ ...b, sec: i }));
  });
  if (o.sign) out.push({ t: "sign", text: o.sign, sec: "sign" });
  return out;
}

/* Diff mot à mot (propositions de l'IA : ajouts / suppressions). */
function wordDiff(a, b) {
  const A = String(a || "").split(/\s+/).filter(Boolean), B = String(b || "").split(/\s+/).filter(Boolean);
  if (A.length * B.length > 250000) return [{ t: "del", w: A.join(" ") }, { t: "add", w: B.join(" ") }];
  const dp = Array.from({ length: A.length + 1 }, () => new Uint16Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  const push = (t, w) => { const l = out[out.length - 1]; if (l && l.t === t) l.w += ` ${w}`; else out.push({ t, w }); };
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { push("same", A[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) push("del", A[i++]);
    else push("add", B[j++]);
  }
  while (i < A.length) push("del", A[i++]);
  while (j < B.length) push("add", B[j++]);
  return out;
}

/* ── 6b · Ce que vous corrigez à la main : écart mot à mot entre la version IA et votre version ── */
function editDelta(base, edited) {
  const rows = lineDiff(base || "", edited || "");
  const wc = (s) => String(s || "").split(/\s+/).filter(Boolean).length;
  let del = 0, add = 0;
  const hunks = [];
  for (const r of rows) {
    if (r.t === "del") { del += wc(r.text); hunks.push({ del: r.text, add: "" }); }
    else if (r.t === "add") { add += wc(r.text); hunks.push({ del: "", add: r.text }); }
    else if (r.t === "chg") {
      const d = r.segs.filter((x) => x.t === "del").map((x) => x.w).join(" … ");
      const a = r.segs.filter((x) => x.t === "add").map((x) => x.w).join(" … ");
      del += wc(d); add += wc(a);
      if (d || a) hunks.push({ del: d, add: a });
    }
  }
  const total = wc(displayMarkup(base)) + wc(displayMarkup(edited));
  return { pct: total ? Math.round(((del + add) / total) * 100) : 0, changed: del + add, hunks: hunks.slice(0, 20).map((h) => ({ del: h.del.slice(0, 220), add: h.add.slice(0, 220) })) };
}
const learningOf = (p) => (p?.ruleLearning && typeof p.ruleLearning === "object" ? p.ruleLearning : { edits: [], lastLearnAt: null });
const pendingLearnDocs = (p) => {
  const l = learningOf(p);
  const since = l.lastLearnAt ? new Date(l.lastLearnAt).getTime() : 0;
  return new Set(l.edits.filter((e) => new Date(e.at).getTime() > since).map((e) => `${e.appId}:${e.type}`)).size;
};

/* ── 6c · CV maître par langue : seuls la ligne de positionnement, le Profil, les Réalisations, l'ordre des puces et les Compétences changent ── */
const masterOf = (p, lang) => (p?.masterCv && p.masterCv[lang]?.text ? p.masterCv[lang] : null);
const ADAPTABLE = ["profile", "achievements", "skills"];
const secKindOf = (title) => Object.keys(SEC).find((k) => SEC[k].test(String(title || ""))) || null;
const bulletKey = (s) => normText(String(s || "").replace(/^[-•*]\s*/, ""));
const similar = (a, b) => { const A = tokens(a), B = tokens(b); return A.length && B.length && jaccard(A, B) >= 0.6; };
/* 6d · puces verrouillées : recopiées mot pour mot, jamais réécrites. */
const lockedOf = (p) => (Array.isArray(p?.lockedBullets) ? p.lockedBullets.filter((x) => str(x)) : []);
const touchesLocked = (before, locked) => {
  const b = normText(before);
  return !!b && locked.some((l) => { const k = normText(l); return k && (b.includes(k) || (k.includes(b) && b.length > 25)); });
};
function restoreLocked(lines, locked) {
  if (!locked.length) return lines;
  return lines.map((l) => {
    const m = l.match(/^(\s*[-•*]\s+)(.*)$/);
    if (!m) return l;
    const hit = locked.find((x) => bulletKey(x) !== bulletKey(m[2]) && similar(x, m[2]));
    return hit ? `${m[1]}${hit.replace(/^[-•*]\s*/, "")}` : l;
  });
}
/* Fusion : tout vient du maître, sauf les sections adaptables et l'ordre des puces de chaque poste. */
function enforceMaster(genText, masterText, locked = []) {
  const G = docOutline(genText, "cv"), M = docOutline(masterText, "cv");
  const gBy = (k) => G.sections.find((s) => secKindOf(s.title) === k);
  const out = [];
  let insertedMissing = false;
  const missingAdaptable = ADAPTABLE.filter((k) => !M.sections.some((s) => secKindOf(s.title) === k) && gBy(k));
  for (const ms of M.sections) {
    const k = secKindOf(ms.title);
    if (ADAPTABLE.includes(k) && gBy(k)) out.push({ title: ms.title, lines: restoreLocked(gBy(k).lines, locked) });
    else if (k === "experience") {
      const gs = gBy("experience");
      const gEntries = [];
      (gs?.lines || []).forEach((l) => { const t = l.trim(); if (t.startsWith("### ")) gEntries.push({ h: t.slice(4), bullets: [] }); else if (/^[-•*]\s/.test(t) && gEntries.length) gEntries[gEntries.length - 1].bullets.push(t.replace(/^[-•*]\s*/, "")); });
      const lines = [];
      let entry = null;
      const flush = () => {
        if (!entry) return;
        const g = gEntries.find((e) => similar(e.h.split("|").slice(0, 2).join(" "), entry.h.split("|").slice(0, 2).join(" ")));
        let ordered = entry.bullets;
        if (g) {
          const used = new Set();
          const seq = [];
          g.bullets.forEach((gb) => { const i = entry.bullets.findIndex((mb, j) => !used.has(j) && (bulletKey(mb) === bulletKey(gb) || similar(mb, gb))); if (i >= 0) { used.add(i); seq.push(entry.bullets[i]); } });
          ordered = [...seq, ...entry.bullets.filter((_, j) => !used.has(j))];
        }
        lines.push(`### ${entry.h}`, ...entry.pre, ...ordered.map((b) => `- ${b}`), "");
        entry = null;
      };
      for (const l of ms.lines) {
        const t = l.trim();
        if (t.startsWith("### ")) { flush(); entry = { h: t.slice(4), pre: [], bullets: [] }; }
        else if (entry && /^[-•*]\s/.test(t)) entry.bullets.push(t.replace(/^[-•*]\s*/, ""));
        else if (entry && t) entry.pre.push(l);
        else if (!entry) lines.push(l);
      }
      flush();
      out.push({ title: ms.title, lines });
    } else out.push(ms);
    if (k === "profile" && !insertedMissing) { missingAdaptable.forEach((mk) => out.push({ title: gBy(mk).title, lines: restoreLocked(gBy(mk).lines, locked) })); insertedMissing = true; }
  }
  if (!insertedMissing) missingAdaptable.forEach((mk) => out.unshift({ title: gBy(mk).title, lines: gBy(mk).lines }));
  const head = [`# ${M.name || G.name}`, (G.headline || M.headline) ? `> ${G.headline || M.headline}` : "", `@ ${M.contact || G.contact}`].filter((x) => x && x !== "@ ");
  return [...head, "", ...out.flatMap((s) => [s.title ? `## ${s.title}` : "", ...s.lines.map((l) => l.trimEnd()), ""])].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* Remplacement ciblé proposé par l'IA : « before » doit exister dans le texte (tolérance typographique). */
const typoNorm = (s) => String(s || "").replace(/[‘’′]/g, "'").replace(/[“”]/g, '"').replace(/[  ]/g, " ").replace(/[ \t]+/g, " ");
function applyEdit(text, before, after) {
  const b = String(before || "");
  if (!b.trim() || typeof after !== "string") return null;
  if (text.includes(b)) return text.replace(b, after);
  const tn = typoNorm(text), bn = typoNorm(b).trim();
  const i = tn.indexOf(bn);
  if (i < 0) return null;
  return tn.slice(0, i) + after + tn.slice(i + bn.length);
}

/* ── Mots-clés ATS : variantes tolérées (pluriel, accents, tirets, casse) ── */
const KW_CATS = { titre: "Intitulé", competence: "Compétences métier", outil: "Outils & plateformes", methode: "Méthodes & cadres", soft: "Savoir-être", langue: "Langues", secteur: "Secteur", diplome: "Formation" };
const KW_STATUS = ["prouvé", "transférable", "absent"];
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const kwReCache = new Map();
function kwPattern(form) {
  if (kwReCache.has(form)) return kwReCache.get(form);
  const toks = normText(form).split(" ").filter(Boolean);
  const re = toks.length ? new RegExp(`(?:^| )${toks.map((t) => {
    if (t.length <= 3 || /\d/.test(t)) return escRe(t);
    const stem = /[^s]s$/.test(t) || /x$/.test(t) ? t.slice(0, -1) : t;
    return `${escRe(stem)}(?:s|x|es|en|e|n)?`;
  }).join(" ")}(?= |$)`, "g") : null;
  kwReCache.set(form, re);
  return re;
}
const kwObj = (k) => (typeof k === "string" ? { term: k, variants: [], category: "competence", importance: 2, status: "prouvé", evidence: null } : k);
function kwCount(hay, k) {
  let n = 0;
  for (const f of [k.term, ...(k.variants || [])]) { const re = kwPattern(f); if (re) n = Math.max(n, (hay.match(re) || []).length); }
  return n;
}
const hayOf = (s) => ` ${normText(s)} `;

/* ── Contrôle qualité local (instantané, sans IA) ── */
const CLICHES = {
  fr: ["passionné", "passionnée", "dynamique", "force de proposition", "je me permets", "n'hésitez pas", "fort de", "forte de", "motivé", "motivée", "challenge", "challenges", "polyvalent", "polyvalente", "proactif", "proactive", "esprit d'équipe", "vif intérêt", "grand intérêt", "véritable", "parfaitement", "atout majeur", "synergie", "synergies", "touche-à-tout", "nouveaux défis", "nouveau défi", "c'est avec enthousiasme", "je suis convaincu", "je suis persuadé", "suite à votre annonce"],
  nl: ["gedreven", "gepassioneerd", "gemotiveerd", "dynamisch", "teamplayer", "teamspeler", "hierbij solliciteer ik", "met veel interesse", "stressbestendig", "nieuwe uitdaging", "proactief"],
  en: ["passionate", "dynamic", "motivated", "results-driven", "hard-working", "hardworking", "team player", "self-starter", "go-getter", "think outside the box", "synergy", "synergies", "proven track record", "i am writing to", "leverage", "new challenge"],
};
const CLAIMS = {
  fr: ["orienté résultats", "orientée résultats", "rigoureux", "rigoureuse", "organisé", "organisée", "autonome", "sens de l'organisation", "sens des responsabilités", "excellent relationnel", "esprit d'analyse", "esprit de synthèse", "leadership naturel", "excellente communication"],
  nl: ["resultaatgericht", "nauwkeurig", "zelfstandig", "communicatief sterk", "analytisch sterk", "natuurlijk leiderschap"],
  en: ["results-oriented", "detail-oriented", "strong communication skills", "excellent communication", "highly organized", "self-motivated", "natural leader"],
};
const WEAK_OPENERS = {
  fr: /^(responsable (de|du|des|d')|en charge (de|du|des|d')|charg[ée]e? (de|du|des|d')|participation (à|au|aux)|particip[ée] (à|au|aux)|aide (à|au)|travail sur|impliqu[ée]e? dans|contribution (à|au))/i,
  nl: /^(verantwoordelijk voor|meegewerkt|deelgenomen|hulp bij|betrokken bij)/i,
  en: /^(responsible for|in charge of|worked on|helped|assisted|participated|involved in|duties included)/i,
};
const PRONOUNS = { fr: /(^|[\s(])(je|j'|j’|mon|ma|mes|moi)(?=[\s,.;:!?)]|$)/i, nl: /\b(ik|mijn|mij)\b/i, en: /\b(I|my|me|My)\b/ };
const REP_STOP = new Set("avec dans pour plus leurs notre votre cette entre depuis ainsi afin selon aupres travers chaque toutes plusieurs about their which would these other where there while worden zijn binnen tussen onder waarbij hebben werden ensuite egalement notamment".split(" "));
const LEVEL_ORDER = { block: 0, warn: 1, info: 2 };
/* ── Lettre ≠ CV : mesures de complémentarité (sans IA) ── */
const LETTER_FORMULAS = /(madame|monsieur|geachte|mevrouw|heer|dear|hiring manager|agr[ée]er|salutations distingu|met vriendelijke groet|hoogachtend|yours sincerely|kind regards)/i;
/* Corps de la lettre : paragraphes, sans en-tête, objet, formules d'appel et de politesse ni signature. */
function letterBody(text) {
  return parseDoc(text).filter((b) => b.t === "para" && !(LETTER_FORMULAS.test(b.text) && b.text.split(/\s+/).length < 18)).map((b) => b.text).join("\n");
}
const ngrams = (s, n = 4) => {
  const t = normText(s).split(" ").filter(Boolean);
  const out = [];
  for (let i = 0; i + n <= t.length; i++) out.push(t.slice(i, i + n).join(" "));
  return out;
};
/* Part des 4-grammes de la lettre déjà présents dans le CV. */
function overlapPct(letterText, cvText) {
  const L = ngrams(letterBody(letterText));
  if (!L.length || !String(cvText || "").trim()) return null;
  const C = new Set(ngrams(docPlainText(cvText)));
  return Math.round((L.filter((g) => C.has(g)).length / L.length) * 100);
}
/* Chiffres significatifs (années exclues ; 1 200 = 1200 ; 40 % = 40). */
function sigNumbers(text) {
  const out = new Set();
  for (const m of String(text || "").matchAll(/[−-]?\d[\d\s  .,]*\d|\d/g)) {
    const n = m[0].replace(/[\s  ]/g, "").replace(/^[−-]/, "").replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".");
    if (/^(19|20)\d\d$/.test(n)) continue;
    if (n.replace(/\D/g, "").length >= 8) continue;
    out.add(n);
  }
  return [...out];
}
function letterMetrics(letterText, cvText) {
  const body = letterBody(letterText);
  const nums = sigNumbers(body);
  const cvNums = new Set(sigNumbers(docPlainText(cvText || "")));
  return { overlap: overlapPct(letterText, cvText), numbers: nums.length, sharedNumbers: nums.filter((n) => cvNums.has(n)).length, words: body.split(/\s+/).filter(Boolean).length };
}
function normalizeUsed(u) {
  u = u && typeof u === "object" ? u : {};
  const list = (x) => (Array.isArray(x) ? x.map((y) => str(y)).filter(Boolean) : []);
  return { companyFacts: list(u.companyFacts), convictionId: str(u.convictionId), storyId: str(u.storyId), keywords: list(u.keywords), numbers: list(u.numbers), sharedWithCv: str(u.sharedWithCv) };
}
const SIG_STOP = new Set("avec dans pour plus leurs notre votre cette entre depuis ainsi afin selon aupres travers chaque toutes plusieurs about their which would these other where there while worden zijn binnen tussen onder waarbij hebben werden comme leur sont etre avoir fait faire tout tous mais donc alors aussi tres bien".split(" "));
const sigTokens = (s) => new Set(normText(s).split(" ").filter((w) => w.length >= 5 && !SIG_STOP.has(w)));
/* Une source (fait, conviction, histoire) est « présente » si la lettre en reprend au moins 3 mots significatifs (ou 40 % de ses mots). */
function echoes(hayTokens, source) {
  const t = [...sigTokens(source)];
  if (!t.length) return false;
  const hit = t.filter((w) => hayTokens.has(w)).length;
  return hit >= Math.min(3, t.length) || hit / t.length >= 0.4;
}
const FLATTERY = {
  fr: ["leader", "leader incontesté", "acteur majeur", "acteur incontournable", "référence", "renommée", "prestigieuse", "prestigieux", "réputation", "j'admire", "entreprise innovante", "excellence reconnue", "fleuron", "rayonnement"],
  nl: ["marktleider", "toonaangevend", "gerenommeerd", "prestigieus", "bewonder", "innovatieve organisatie", "vooraanstaand"],
  en: ["industry leader", "market leader", "renowned", "prestigious", "world-class", "i admire", "leading company", "innovative company", "reputation"],
};


function analyzeDoc(text, kind, ctx = {}) {
  const lang = ctx.lang || "fr";
  const o = docOutline(text, kind);
  const blocks = layoutBlocks(text, kind);
  const plain = docPlainText(text);
  const words = plain.split(/\s+/).filter(Boolean).length;
  const issues = [];
  const add = (level, cat, key, title, detail, extra = {}) => issues.push({ id: `${cat}:${key}`, level, cat, title, detail, ...extra });
  const secText = o.sections.map((s) => docPlainText(s.lines.join("\n")));
  const secHay = secText.map(hayOf);
  const findSec = (pred) => { const i = secHay.findIndex(pred); return i >= 0 ? i : undefined; };
  const allHay = hayOf(`${o.headline} ${plain}`);

  /* Mots-clés : couverture pondérée par l'importance ; un terme présent seulement dans une liste compte moins. */
  const kw = (ctx.keywords || []).map(kwObj).map((k) => {
    const where = [];
    let count = 0;
    const hc = kwCount(hayOf(o.headline), k);
    if (hc) { where.push({ sec: "head", title: "En-tête" }); count += hc; }
    o.sections.forEach((s, i) => {
      const c = kwCount(secHay[i], k);
      if (c) { where.push({ sec: i, title: s.title || "Introduction", list: SEC.skills.test(s.title) || SEC.languages.test(s.title) }); count += c; }
    });
    return { ...k, count, where, found: count > 0, onlyList: count > 0 && where.every((w) => w.list) };
  });
  /* Lettre : seuls les mots-clés essentiels (importance 3) comptent, pour éviter le bourrage. */
  const eligible = kw.filter((k) => k.status !== "absent" && (kind === "cv" || k.importance === 3));
  const wsum = eligible.reduce((n, k) => n + k.importance, 0);
  const wfound = eligible.reduce((n, k) => n + (k.found ? k.importance * (k.onlyList && kind === "cv" ? 0.75 : 1) : 0), 0);
  const kwPct = wsum ? Math.round((wfound / wsum) * 100) : null;
  const titleForms = [ctx.jobTitle, ...(ctx.titleVariants || [])].filter(Boolean);
  const titleIn = (hay) => titleForms.some((t) => kwCount(hay, { term: t, variants: [] }) > 0);
  const titleFound = titleForms.length ? titleIn(allHay) : null;
  const missingKw = eligible.filter((k) => !k.found);
  if (missingKw.length && kind === "cv") {
    const top = missingKw.filter((k) => k.importance >= 2);
    if (top.length) add(kind === "cv" && top.some((k) => k.importance === 3) ? "warn" : "info", "ats", "kw-missing", `${top.length} mot(s)-clé(s) ${kind === "cv" ? "justifiable(s)" : "essentiel(s)"} absent(s)`, `${top.slice(0, 6).map((k) => `« ${k.term} »`).join(", ")}${top.length > 6 ? "…" : ""} : votre profil les justifie, ${kind === "cv" ? "l'ATS les cherche" : "citez-les naturellement"}.`, { tab: "kw" });
  }
  const listOnly = eligible.filter((k) => k.onlyList && k.importance >= 2);
  if (kind === "cv" && listOnly.length) add("info", "ats", "kw-list", `${listOnly.length} mot(s)-clé(s) cité(s) seulement dans une liste`, `${listOnly.slice(0, 4).map((k) => `« ${k.term} »`).join(", ")} : démontrez-les aussi dans une puce d'expérience ou de réalisation.`, { tab: "kw" });

  /* En-tête */
  if (!o.contact) add("block", "format", "contact", "Coordonnées absentes", "Ajoutez une ligne de coordonnées (e-mail, téléphone, ville, LinkedIn).", { sec: "head" });
  else {
    if (!/@/.test(o.contact)) add("warn", "format", "email", "Pas d'adresse e-mail dans les coordonnées", null, { sec: "head" });
    if (!/\d[\d\s./-]{7,}/.test(o.contact)) add("info", "format", "phone", "Pas de numéro de téléphone", null, { sec: "head" });
  }
  if (!o.name) add("block", "format", "name", "Nom absent", null, { sec: "head" });

  const ph = [];
  (text.match(/\[à compléter[^\]]*\]/gi) || []).forEach((m) => ph.push(m));
  if (ph.length) {
    const sec = findSec((h, i) => /\[à compléter/i.test(o.sections[i].lines.join("\n")));
    add("block", "fiabilite", "placeholders", `${ph.length} élément(s) [à compléter]`, `${ph.slice(0, 3).join(" · ")}${ph.length > 3 ? "…" : ""} — complétez avec un fait réel ou supprimez le passage.`, { sec });
  }
  /* Employeur actuel : réglage unique CV + lettre (employerNamed). Non nommé → toute mention bloque ; nommé → aucune alerte. */
  const empNames = [...(ctx.employerNames || []), ...(ctx.employerNamed === false && !genericOrg(ctx.currentOrg) ? [ctx.currentOrg] : [])];
  const emp = ctx.employerNamed === true ? [] : mentionsEmployer(text, empNames);
  if (emp.length) add(ctx.employerNamed === false ? "block" : "warn", "fiabilite", "employer", `Employeur actuel cité (${emp.join(", ")})`, ctx.employerNamed === false ? "Cette candidature est réglée sur « employeur non nommé » : remplacez-le par une désignation générique." : "Vous êtes en poste : vérifiez que c'est voulu avant diffusion.", { sec: findSec((h, i) => mentionsEmployer(o.sections[i].lines.join("\n"), empNames).length > 0), autoFix: ctx.employerNamed === false });

  /* Clichés et affirmations non prouvées */
  const hits = (list) => (list[lang] || list.fr).filter((c) => kwCount(allHay, { term: c, variants: [] }) > 0);
  const cl = hits(CLICHES);
  if (cl.length) add("warn", "style", "cliches", `Clichés : ${cl.slice(0, 5).join(", ")}`, "Remplacez-les par un fait ou un résultat.", { sec: findSec((h) => cl.some((c) => kwCount(h, { term: c, variants: [] }))), autoFix: true });
  const cla = hits(CLAIMS);
  if (cla.length) add("info", "style", "claims", `Affirmations à prouver : ${cla.slice(0, 5).join(", ")}`, "Un recruteur ne les retient que si une réalisation les démontre.", { sec: findSec((h) => cla.some((c) => kwCount(h, { term: c, variants: [] }))) });

  /* Répétitions */
  const kwToks = new Set(kw.flatMap((k) => normText(k.term).split(" ")));
  const freq = {};
  normText(plain).split(" ").forEach((w) => { if (w.length >= 5 && !REP_STOP.has(w) && !kwToks.has(w)) freq[w] = (freq[w] || 0) + 1; });
  const reps = Object.entries(freq).filter(([, n]) => n >= (kind === "cv" ? 6 : 4)).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (reps.length) add("info", "style", "reps", `Répétitions : ${reps.map(([w, n]) => `« ${w} » ×${n}`).join(", ")}`, "Variez le vocabulaire (sauf mots-clés de l'annonce).");

  let impact = 70, read = 100, letterScores = null;
  const pages = ctx.pages || null;
  if (kind === "cv") {
    const hl = o.headline;
    const tgt = tokens(ctx.jobTitle || "");
    const cur = tokens(ctx.currentTitle || "");
    const sameAsCurrent = tgt.length && cur.length && jaccard(tgt, cur) >= 0.6;
    const claims = (s) => { const t = tokens(s); return tgt.length && !sameAsCurrent && (jaccard(t, tgt) >= 0.6 || tgt.every((x) => t.includes(x))); };
    if (!hl) add("warn", "format", "hl-missing", "Ligne sous le nom absente", "Indiquez votre positionnement : titre actuel + 2 ou 3 expertises.", { sec: "head", fix: "headline" });
    else {
      const first = hl.split(/\s[|·–—-]\s|[|·]|,/)[0].trim();
      if (claims(first)) add("block", "fiabilite", "hl-claim", "Le titre sous votre nom annonce le poste visé", `« ${first} » laisse croire que vous occupez déjà ce poste. Mettez votre titre réel${ctx.currentTitle ? ` (${ctx.currentTitle})` : ""} et vos expertises ; l'intitulé visé se cite comme objectif dans le profil.`, { sec: "head", fix: "headline", autoFix: true });
      if (hl.length > 90) add("info", "format", "hl-long", `Ligne sous le nom longue (${hl.length} caractères)`, "Visez 85 caractères maximum : une seule ligne, lisible d'un coup d'œil.", { sec: "head" });
    }
    const prof = o.sections.findIndex((s) => SEC.profile.test(s.title));
    if (prof < 0) add("warn", "format", "no-profile", "Section « Profil » absente", "3 ou 4 phrases : qui vous êtes aujourd'hui, vos preuves, ce que vous apportez au poste.");
    else {
      const pt = secText[prof];
      const pw = pt.split(/\s+/).filter(Boolean).length;
      const firstSentence = pt.split(/[.!?]\s/)[0] || "";
      if (claims(firstSentence.split(/\s+/).slice(0, 9).join(" "))) add("block", "fiabilite", "prof-claim", "Le profil se présente avec l'intitulé visé", "La première phrase doit décrire votre fonction réelle ; l'intitulé visé vient en fin de profil, comme objectif.", { sec: prof, autoFix: true });
      if (titleForms.length && !titleIn(secHay[prof])) add("warn", "ats", "prof-title", ctx.spontaneous ? "Le rôle visé n'apparaît pas dans le profil" : "L'intitulé exact du poste n'apparaît pas dans le profil", `Citez « ${ctx.jobTitle} » comme objectif (« … dans un rôle de ${ctx.jobTitle} ») : les ATS et les recruteurs comparent l'intitulé.`, { sec: prof, autoFix: true });
      if (ctx.voice !== "je" && PRONOUNS[lang]?.test(pt)) add("warn", "style", "prof-pron", "Pronoms personnels dans le profil", "Style CV : phrases sans « je / mon » (ou choisissez la 1re personne dans les réglages).", { sec: prof, autoFix: true });
      if (pw > 110) add("info", "format", "prof-long", `Profil long (${pw} mots)`, "Visez 55 à 90 mots.", { sec: prof });
      if (pw < 30) add("warn", "format", "prof-short", `Profil court (${pw} mots)`, "Visez 55 à 90 mots.", { sec: prof });
    }
    const need = [["experience", "Expérience professionnelle", "warn"], ["skills", "Compétences", "warn"], ["languages", "Langues", "info"], ["education", "Formation", "info"]];
    need.forEach(([k, label, lvl]) => { if (!o.sections.some((s) => SEC[k].test(s.title))) { add(lvl, "format", `no-${k}`, `Section « ${label} » absente`, null); read -= lvl === "warn" ? 10 : 5; } });
    if (!o.sections.some((s) => SEC.achievements.test(s.title))) add("info", "impact", "no-achievements", "Pas de section « Réalisations clés »", "3 ou 4 résultats chiffrés en tête de CV captent l'attention du recruteur.");

    const impactSecs = new Set(o.sections.map((s, i) => (SEC.achievements.test(s.title) || SEC.experience.test(s.title) ? i : -1)).filter((i) => i >= 0));
    const bul = blocks.filter((b) => b.t === "bullet" && impactSecs.has(b.sec));
    const quant = bul.filter((b) => /\d/.test(b.text));
    const weak = bul.filter((b) => WEAK_OPENERS[lang]?.test(b.text.trim()));
    const qRatio = bul.length ? quant.length / bul.length : 0;
    if (bul.length && qRatio < 0.4) add("warn", "impact", "quant", `${bul.length - quant.length} puce(s) sur ${bul.length} sans résultat chiffré`, "Ajoutez un ordre de grandeur réel (volume, %, délai, budget, utilisateurs) quand vous l'avez.", { sec: bul.find((b) => !/\d/.test(b.text))?.sec });
    if (weak.length) add("warn", "impact", "weak", `${weak.length} puce(s) commencent par une formule faible`, `« ${weak[0].text.slice(0, 70)}${weak[0].text.length > 70 ? "…" : ""} » : commencez par un verbe d'action (Piloté, Déployé, Réduit…).`, { sec: weak[0].sec, autoFix: true });
    const longB = blocks.filter((b) => b.t === "bullet" && b.text.length > 230);
    if (longB.length) add("info", "format", "long-bullets", `${longB.length} puce(s) de plus de 2 lignes`, "Une idée par puce, 2 lignes maximum.", { sec: longB[0].sec });
    if (ctx.voice !== "je") {
      const pb = blocks.filter((b) => b.t === "bullet" && PRONOUNS[lang]?.test(b.text));
      if (pb.length) add("info", "style", "bul-pron", `${pb.length} puce(s) à la première personne`, "Style CV : commencez directement par le verbe.", { sec: pb[0].sec });
    }
    impact = Math.round(100 * (0.65 * qRatio + 0.35 * (bul.length ? 1 - weak.length / bul.length : 0.5))) - cl.length * 6 - cla.length * 2;
    if (words < 380) { add("warn", "format", "short", `CV court (${words} mots)`, "Visez 550 à 850 mots pour un poste de management."); read -= 15; }
    if (words > 950) { add("warn", "format", "long", `CV long (${words} mots)`, "Visez 2 pages maximum : resserrez les postes anciens."); read -= 15; }
    if (pages && pages > 2) { add("warn", "format", "pages", `${pages} pages`, "Visez 2 pages maximum."); read -= 20; }
    read -= Math.min(15, longB.length * 3);
  } else {
    const subj = o.sections.find((s) => s.title)?.title || "";
    const bodyText = o.sections.map((s, i) => secText[i]).join("\n");
    const bodyHay = hayOf(bodyText);
    if (!subj) add("warn", "format", "subject", "Objet absent", "Ajoutez « Objet : candidature au poste de … ».");
    else if (titleForms.length && !titleIn(hayOf(subj))) add("warn", "ats", "subject-title", ctx.spontaneous ? "L'objet ne mentionne pas le rôle visé" : "L'objet ne reprend pas l'intitulé exact du poste", `Reprenez « ${ctx.jobTitle} »${ctx.spontaneous ? " (« Candidature spontanée — … »)" : ""}.`, { sec: o.sections.findIndex((s) => s.title === subj), autoFix: true });
    if (ctx.spontaneous && /(votre annonce|votre offre|poste à pourvoir|vacature|your (job )?(ad|posting|offer))/i.test(bodyText)) add("block", "fiabilite", "no-ad", "La lettre fait référence à une annonce", "Candidature spontanée : aucune offre n'existe. Retirez « votre annonce », « le poste à pourvoir »…", { autoFix: true });
    const ck = companyKey(ctx.company || "");
    const companyIn = !ck || ck.length < 3 || bodyHay.includes(` ${ck} `) || bodyHay.includes(ck);
    if (!companyIn) add("warn", "impact", "company", `La lettre ne cite pas ${ctx.company}`, "Nommez l'entreprise au moins une fois : une lettre générique se repère immédiatement.", { autoFix: true });
    const paras = blocks.filter((b) => b.t === "para");
    const lastPara = [...paras].reverse().find((b) => !/(agr[ée]er|salutations|groeten|regards|sincerely)/i.test(b.text));
    const cta = lastPara && /(entretien|rencontr|[ée]changer|discuter|interview|meet|gesprek|kennismak|toelicht)/i.test(lastPara.text);
    if (!cta) add("info", "impact", "cta", "Pas de demande d'entretien en conclusion", "Terminez par votre disponibilité pour un échange.", { sec: lastPara?.sec });
    if (!/(madame|monsieur|dear|geachte|beste)/i.test(bodyText)) add("info", "format", "salutation", "Formule d'appel absente", "FR : « Madame, Monsieur, » ; NL : « Geachte heer, mevrouw, » ; EN : « Dear … ».");
    if (!String(o.recipients.join(" ")).trim()) add("info", "format", "recipient", "Destinataire absent", null, { sec: "head" });
    if (!o.date) add("info", "format", "date", "Lieu et date absents", null, { sec: "head" });
    /* Débuts de phrase : jamais deux phrases consécutives en « Je ». */
    const jeRe = lang === "en" ? /^I\b/ : lang === "nl" ? /^ik\b/i : /^(je\b|j'|j’)/i;
    const sentences = letterBody(text).split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
    const jeFlags = sentences.map((x) => jeRe.test(x));
    const jeRuns = jeFlags.filter((f, i) => f && jeFlags[i - 1]).length;
    const je = jeFlags.filter(Boolean).length;
    if (jeRuns) add("warn", "style", "je-run", `${jeRuns + 1 > 2 ? `${jeRuns} enchaînements` : "Deux phrases consécutives"} en « ${lang === "en" ? "I" : lang === "nl" ? "Ik" : "Je"} »`, "Commencez l'une par l'entreprise, le rôle ou un fait.", { autoFix: true });

    /* Lettre ≠ CV : complémentarité (recouvrement, chiffres). */
    const m = letterMetrics(text, ctx.cvText);
    if (m.overlap !== null) {
      if (m.overlap > 30) add("block", "complementarite", "overlap", `La lettre recopie le CV (${m.overlap} % de recouvrement)`, "Au-delà de 30 %, la lettre résume le CV. Remplacez les preuves par le « pourquoi » : entreprise, rôle, méthode, une histoire racontée.", { autoFix: true });
      else if (m.overlap > 15) add("warn", "complementarite", "overlap", `Recouvrement avec le CV : ${m.overlap} %`, "Visez 15 % maximum : la lettre explique, le CV prouve.", { autoFix: true });
    } else add("info", "complementarite", "no-cv", "Recouvrement non mesuré : aucun CV pour cette candidature", "Générez ou enregistrez d'abord le CV.");
    if (m.sharedNumbers > 1) add("warn", "complementarite", "shared-nums", `${m.sharedNumbers} chiffres repris du CV`, "Gardez au plus un chiffre commun : le CV porte les résultats.", { autoFix: true });
    if (m.numbers > 2) add("warn", "complementarite", "nums", `${m.numbers} chiffres dans la lettre`, "2 au maximum : une preuve racontée vaut mieux qu'une série de résultats.", { autoFix: true });

    /* Spécificité : pourquoi eux, conviction, histoire, sans flatterie. */
    const bodyTok = sigTokens(letterBody(text));
    const facts = (ctx.companyFacts || []).filter(Boolean);
    const whyThem = facts.some((f) => echoes(bodyTok, f));
    if (!ctx.spontaneous || ctx.spontaneous === "company") {
      if (!facts.length) add("warn", "specificite", "why-them", "« Pourquoi eux » non étayé", "Aucun fait vérifié sur l'entreprise : collez l'annonce complète ou complétez le contexte de l'entreprise.");
      else if (!whyThem) add("warn", "specificite", "why-them", "« Pourquoi eux » absent", "Aucun fait propre à l'entreprise n'est repris : une phrase qui resterait vraie pour un concurrent est interchangeable.", { autoFix: true });
    }
    const motiv = ctx.motivation || emptyMotivation();
    const convOk = motiv.convictions.some((c) => echoes(bodyTok, c.text));
    const storyOk = motiv.stories.some((st) => echoes(bodyTok, [st.situation, st.action, st.result].join(" ")));
    if (!motiv.convictions.length) add("info", "specificite", "conviction", "Aucune conviction dans votre profil", "Renseignez vos convictions (Profil & critères → Motivations) : elles rendent la lettre personnelle.");
    else if (!convOk) add("warn", "specificite", "conviction", "Aucune de vos convictions n'apparaît", "Reliez « pourquoi ce rôle » à une conviction que vous défendez.", { autoFix: true });
    if (!motiv.stories.length) add("info", "specificite", "story", "Banque d'histoires vide", "Ajoutez 2 ou 3 histoires (Motivations) : la lettre en raconte une.");
    else if (!storyOk) add("warn", "specificite", "story", "Aucune histoire racontée", "Racontez une histoire de votre banque (situation → action → effet) plutôt qu'une liste de résultats.", { autoFix: true });
    const flat = (FLATTERY[lang] || FLATTERY.fr).filter((c) => kwCount(bodyHay, { term: c, variants: [] }) > 0);
    if (flat.length) add("warn", "specificite", "flattery", `Flatterie : ${flat.slice(0, 4).join(", ")}`, "Remplacez le compliment par un fait précis sur l'entreprise.", { autoFix: true });
    const kwUsed = kw.filter((k) => k.found && k.status !== "absent" && k.importance >= 2).length;
    if (kwUsed > 6) add("info", "complementarite", "kw-many", `${kwUsed} mots-clés de l'annonce dans la lettre`, "2 à 4 suffisent : la lettre n'est pas un second CV.");

    const spec = clamp(100 - (facts.length ? (whyThem ? 0 : 35) : 25) - (motiv.convictions.length ? (convOk ? 0 : 25) : 15) - (motiv.stories.length ? (storyOk ? 0 : 25) : 15) - flat.length * 10 - (companyIn ? 0 : 15), 0, 100);
    const compl = m.overlap === null ? null : clamp(100 - Math.max(0, m.overlap - 10) * 4 - Math.max(0, m.sharedNumbers - 1) * 15 - Math.max(0, m.numbers - 2) * 10, 0, 100);
    impact = 100 - (cta ? 0 : 20) - (storyOk ? 0 : 20) - (subj && (!titleForms.length || titleIn(hayOf(subj))) ? 0 : 15) - cl.length * 8;
    read -= jeRuns * 8 + Math.max(0, je - 4) * 3;
    letterScores = { spec, compl, overlap: m.overlap, numbers: m.numbers, sharedNumbers: m.sharedNumbers };
    const [minW, maxW] = ctx.spontaneous ? [220, 300] : [250, 320];
    if (words < minW - 40) { add("info", "format", "short", `Lettre courte (${words} mots)`, `Visez ${minW} à ${maxW} mots.`); read -= 10; }
    if (words > maxW + 80) { add("warn", "format", "long", `Lettre longue (${words} mots)`, `Une page maximum : visez ${minW} à ${maxW} mots.`); read -= 15; }
    if (pages && pages > 1) { add("warn", "format", "pages", `La lettre tient sur ${pages} pages`, "Une page maximum."); read -= 20; }
  }
  read -= reps.length * 4;
  if (!o.contact) read -= 20;
  const ats = kwPct === null ? (titleFound === null ? null : titleFound ? 80 : 50) : Math.round(0.78 * kwPct + (titleFound === false ? 0 : 22));
  const sc = (n) => (n === null ? null : clamp(Math.round(n), 0, 100));
  /* CV : ATS 40 / impact 35 / lisibilité 25. Lettre : spécificité 35 / complémentarité 25 / impact 20 / lisibilité 20 (plus de mots-clés). */
  const scores = kind === "cv"
    ? { ats: sc(ats), impact: sc(impact), read: sc(read) }
    : { ats: null, spec: sc(letterScores?.spec ?? null), compl: sc(letterScores?.compl ?? null), impact: sc(impact), read: sc(read), overlap: letterScores?.overlap ?? null, numbers: letterScores?.numbers ?? null };
  const parts = (kind === "cv"
    ? [[scores.ats, 0.4], [scores.impact, 0.35], [scores.read, 0.25]]
    : [[scores.spec, 0.35], [scores.compl, 0.25], [scores.impact, 0.2], [scores.read, 0.2]]).filter(([v]) => v !== null);
  let total = Math.round(parts.reduce((n, [v, w]) => n + v * w, 0) / parts.reduce((n, [, w]) => n + w, 0));
  const blockers = issues.filter((i) => i.level === "block").length;
  if (blockers) total = Math.min(total, 69);
  issues.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  return { kind, issues, kw, kwPct, titleFound, scores: { ...scores, total }, words, blockers };
}

/* Points que la passe de correction automatique traite après génération. */
function autoFixList(rep) {
  const list = rep.issues.filter((i) => i.autoFix).map((i) => ({ title: i.title, detail: i.detail }));
  /* Lettre : aucune injection de mots-clés. */
  if (rep.kind === "cv") rep.kw.filter((k) => k.status !== "absent" && !k.found && k.importance >= 2).slice(0, 10)
    .forEach((k) => list.push({ title: `Intégrer le mot-clé « ${k.term} »`, detail: k.evidence ? `preuve dans le profil : ${k.evidence}` : "justifié par le profil" }));
  return list.slice(0, 14);
}

/* PDF texte (lisible par les ATS) via jsPDF, chargé à la demande depuis cdnjs. */
let jspdfPromise = null;
function loadJsPDF() {
  if (typeof window !== "undefined" && window.jspdf?.jsPDF) return Promise.resolve(window.jspdf);
  if (!jspdfPromise) {
    jspdfPromise = new Promise((resolve, reject) => {
      const sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      sc.onload = () => (window.jspdf?.jsPDF ? resolve(window.jspdf) : reject(new Error("jsPDF indisponible")));
      sc.onerror = () => { jspdfPromise = null; reject(new Error("Chargement du générateur PDF impossible (réseau).")); };
      document.head.appendChild(sc);
    });
  }
  return jspdfPromise;
}
/* Les polices PDF standard couvrent le jeu Windows-1252 (€, œ, ’, “ ”, – …). Hors de ce jeu, on retire
   les accents (Dvořák → Dvorak) au lieu de supprimer la lettre. */
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const TRANSLIT = { "\u0141": "L", "\u0142": "l", "\u0110": "D", "\u0111": "d", "\u0131": "i", "\u2192": "->", "\u2713": "v" };
const pdfSafe = (t) => String(t || "")
  .replace(/[\u00A0\u202F\u2009]/g, " ").replace(/\u2212/g, "-").replace(/\u2032/g, "'").replace(/\u2033/g, '"')
  .replace(/[^\x00-\xFF]/g, (ch) => (CP1252_EXTRA.includes(ch) ? ch : TRANSLIT[ch] ?? ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x00-\xFF]/g, "")));


async function saveFile(filename, data, mime) {
  if (RT.mode === "published") {
    if (!RT.downloads) throw new Error("Téléchargement indisponible dans cette vue.");
    try { await RT.downloads.save({ filename, data }); return "saved"; }
    catch (e) { if (e?.code === "declined" || e?.code === "cancelled") return "declined"; throw new Error(e?.message || "Téléchargement refusé"); }
  }
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "saved";
}

/* ── Langues, sections, icônes ─────────────────────────────────────────── */
const DOC_LANGS = ["fr", "nl", "en", "de"];
const SECTION_ALIASES = {
  profile: ["profil", "profiel", "profile", "summary", "professional summary", "résumé", "à propos", "about me", "over mij", "kurzprofil", "profil professionnel"],
  achievements: ["réalisations clés", "réalisations", "belangrijkste realisaties", "realisaties", "key achievements", "achievements", "wichtigste erfolge", "erfolge"],
  experience: ["expérience professionnelle", "expérience", "expériences", "parcours professionnel", "werkervaring", "beroepservaring", "ervaring", "professional experience", "work experience", "experience", "berufserfahrung", "berufliche erfahrung"],
  skills: ["compétences", "compétences clés", "vaardigheden", "competenties", "skills", "core skills", "key skills", "kompetenzen", "kenntnisse", "fähigkeiten"],
  languages: ["langues", "talen", "talenkennis", "languages", "sprachen", "sprachkenntnisse"],
  education: ["formation", "formations", "études", "opleiding", "opleidingen", "education", "ausbildung", "bildung"],
  certifications: ["certifications", "certificats", "certificaties", "certificaten", "certificates", "zertifikate", "zertifizierungen"],
  interests: ["centres d'intérêt", "intérêts", "loisirs", "interesses", "hobby's", "interests", "hobbies", "interessen"],
  projects: ["projets", "projets clés", "projecten", "projects", "key projects", "projekte"],
};
const SECTION_TITLES = {
  fr: { profile: "Profil", achievements: "Réalisations clés", experience: "Expérience professionnelle", skills: "Compétences", languages: "Langues", education: "Formation", certifications: "Certifications", interests: "Centres d'intérêt", projects: "Projets" },
  nl: { profile: "Profiel", achievements: "Belangrijkste realisaties", experience: "Werkervaring", skills: "Vaardigheden", languages: "Talen", education: "Opleiding", certifications: "Certificaten", interests: "Interesses", projects: "Projecten" },
  en: { profile: "Profile", achievements: "Key achievements", experience: "Professional experience", skills: "Skills", languages: "Languages", education: "Education", certifications: "Certifications", interests: "Interests", projects: "Projects" },
  de: { profile: "Profil", achievements: "Wichtigste Erfolge", experience: "Berufserfahrung", skills: "Kompetenzen", languages: "Sprachen", education: "Ausbildung", certifications: "Zertifikate", interests: "Interessen", projects: "Projekte" },
};
const ALIAS_INDEX = Object.entries(SECTION_ALIASES).flatMap(([k, l]) => l.map((a) => [normText(a), k]));
function sectionKey(title) {
  const n = normText(title);
  const hit = ALIAS_INDEX.find(([a]) => a === n) || ALIAS_INDEX.find(([a]) => a.length > 5 && n.startsWith(a));
  return hit ? hit[1] : `x_${n.replace(/\s+/g, "_").slice(0, 30) || "section"}`;
}
const baseKey = (k) => String(k || "").replace(/_\d+$/, "");
const sectionLabel = (sec) => sec?.title || SECTION_TITLES.fr[baseKey(sec?.key)] || "Introduction";
const SIDE_DEFAULT = ["skills", "languages", "certifications", "interests"];
const PHOTO_SRC = { l0: -1, l1: -1, photo: true };

/* Icônes vectorielles (24 × 24, trait), dessinées à l'identique dans l'aperçu, le PDF et le Word. */
const DOC_ICONS = {
  mail: ["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M22 6l-10 7L2 6"],
  phone: ["M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"],
  pin: ["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z", "M12 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6z"],
  linkedin: ["M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z", "M2 9h4v12H2z", "M4 2a2 2 0 1 0 0 4a2 2 0 1 0 0-4z"],
  globe: ["M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20z", "M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
  user: ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8z"],
  award: ["M12 2a7 7 0 1 0 0 14a7 7 0 1 0 0-14z", "M8.21 13.89L7 23l5-3 5 3-1.21-9.12"],
  briefcase: ["M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z", "M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"],
  zap: ["M13 2L3 14h9l-1 8 10-12h-9l1-8z"],
  chat: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  cap: ["M22 10L12 5 2 10l10 5 10-5z", "M6 12v5c3 3 9 3 12 0v-5"],
  check: ["M22 11.08V12a10 10 0 1 1-5.93-9.14", "M22 4L12 14.01l-3-3"],
  heart: ["M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"],
  folder: ["M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"],
};
const SECTION_ICON = { profile: "user", achievements: "award", experience: "briefcase", skills: "zap", languages: "chat", education: "cap", certifications: "check", interests: "heart", projects: "folder" };
const contactIcon = (s) => (/^\S+@\S+\.\S+$/.test(s) ? "mail" : /linkedin\./i.test(s) ? "linkedin" : /^\+?[\d\s().\/-]{7,}$/.test(s) ? "phone" : /^(https?:\/\/|www\.)|\.(com|be|eu|net|org|io|dev|me|lu|nl|fr)(\/\S*)?$/i.test(s) ? "globe" : "pin");

/* ── Modèle de document ────────────────────────────────────────────────── */
function designModel(text, kind) {
  const blocks = parseDoc(text);
  const head = { name: null, headline: [], contact: [] };
  const letter = { date: null, recipient: [], subject: null, body: [], sign: null };
  const sections = [];
  const seen = {};
  let cur = null;
  for (const b of blocks) {
    if (kind === "letter") {
      if (b.t === "name" && !head.name) head.name = b;
      else if (b.t === "contact" && !letter.body.length) head.contact.push(b);
      else if (b.t === "date" && !letter.date) letter.date = b;
      else if (b.t === "quote" && !letter.subject && !letter.body.length) letter.recipient.push(b);
      else if (b.t === "h2" && !letter.subject && !letter.body.length) letter.subject = b;
      else if (b.t === "sign") letter.sign = b;
      else letter.body.push(b);
      continue;
    }
    if (b.t === "h2") {
      let key = sectionKey(b.text);
      seen[key] = (seen[key] || 0) + 1;
      if (seen[key] > 1) key = `${key}_${seen[key]}`;
      cur = { key, title: b.text, heading: b, blocks: [] };
      sections.push(cur);
      continue;
    }
    if (!cur) {
      if (b.t === "name" && !head.name) { head.name = b; continue; }
      if (b.t === "quote") { head.headline.push(b); continue; }
      if (b.t === "contact") { head.contact.push(b); continue; }
      cur = { key: "intro", title: null, heading: null, blocks: [] };
      sections.push(cur);
    }
    cur.blocks.push(b);
  }
  return { kind, head, sections, letter, blocks };
}
const contactItems = (head) => head.contact.flatMap((b) => b.text.split(/\s*[|·•]\s*/).map((s) => s.trim()).filter(Boolean).map((s) => ({ text: s, icon: contactIcon(s), src: b })));

function arrangeSections(sections, layout, two) {
  const L = layout || {};
  const keys = sections.map((s) => s.key);
  const order = [...(L.order || []).filter((k) => keys.includes(k)), ...keys.filter((k) => !(L.order || []).includes(k))];
  const hidden = new Set(L.hidden || []);
  const isSide = (k) => (Array.isArray(L.side) ? L.side.includes(k) : SIDE_DEFAULT.includes(baseKey(k)));
  const byKey = Object.fromEntries(sections.map((s) => [s.key, s]));
  const main = [], side = [];
  order.forEach((k) => { if (!hidden.has(k)) (two && isSide(k) ? side : main).push(byKey[k]); });
  return { main, side, order, hidden, isSide };
}

/* ── Design : base, gabarits ───────────────────────────────────────────── */
const PAGE_SIZES = { a4: [210, 297], letter: [215.9, 279.4] };
const MMPT = 0.3528; // mm par point typographique
const FONT_CSS = { sans: 'Helvetica, Arial, "Liberation Sans", sans-serif', serif: '"Times New Roman", Times, "Liberation Serif", serif', mono: '"Courier New", Courier, "Liberation Mono", monospace' };
const FONT_PDF = { sans: "helvetica", serif: "times", mono: "courier" };
const FONT_DOCX = { sans: "Arial", serif: "Times New Roman", mono: "Courier New" };

const DESIGN_BASE = {
  template: "ats", page: "a4",
  font: "sans", headingFont: "sans", size: 10, lineHeight: 1.35, nameSize: 2.3, headingSize: 1.08, headingCase: "upper", headingSpacing: 0.4,
  margin: { t: 16, r: 17, b: 15, l: 17 }, sectionGap: 5, itemGap: 2.2, paraGap: 1.6,
  colors: { accent: "#1f3a5f", text: "#262626", muted: "#6b6b6b", rule: "#d4d4d4", side: "#f1f5f9", sideText: "#262626", band: "#1f3a5f", bandText: "#ffffff" },
  header: "left", headingStyle: "line", rule: 0.3, bullet: "dot",
  icons: false, sectionIcons: false, datesRight: true, skillsAsTags: false, justify: false,
  columns: 1, side: "left", sideWidth: 32, colGap: 7, sideFull: false,
  photo: { show: false, shape: "circle", size: 28, border: 0, borderColor: "#ffffff" },
  layout: { order: [], side: null, hidden: [] },
};
const TEMPLATES = [
  { id: "ats", label: "Classique ATS", hint: "1 colonne, sobre, lu par tous les logiciels de tri", d: { colors: { accent: "#1f3a5f", rule: "#1f3a5f" }, rule: 0.35 } },
  { id: "modern", label: "Moderne", hint: "2 colonnes, photo ronde, icônes", d: { columns: 2, side: "right", sideWidth: 31, header: "left", headingStyle: "bar", icons: true, photo: { show: true, shape: "circle", size: 26 }, colors: { accent: "#2563eb", side: "#f1f5f9", rule: "#e2e8f0", band: "#2563eb" } } },
  { id: "executive", label: "Exécutif", hint: "bandeau bord à bord, titres serif", d: { header: "band", headingFont: "serif", headingStyle: "line", icons: true, nameSize: 2.4, photo: { show: true, shape: "rounded", size: 27, border: 0.8, borderColor: "#ffffff" }, colors: { accent: "#1e293b", band: "#1e293b", bandText: "#ffffff", rule: "#94a3b8" } } },
  { id: "minimal", label: "Minimal", hint: "centré, aéré, sans filet", d: { header: "center", headingStyle: "plain", headingSpacing: 1.4, headingSize: 0.95, sectionGap: 6.5, lineHeight: 1.45, colors: { accent: "#111827", muted: "#6b7280", rule: "#e5e7eb" } } },
  { id: "compact", label: "Compact", hint: "dense, tient sur une page", d: { columns: 2, side: "left", sideWidth: 30, size: 9.2, lineHeight: 1.25, sectionGap: 3.6, itemGap: 1.6, paraGap: 1.1, headingStyle: "pill", skillsAsTags: true, margin: { t: 12, r: 12, b: 12, l: 12 }, colors: { accent: "#0f766e", side: "#f0fdfa", rule: "#99f6e4", band: "#0f766e" } } },
  { id: "creative", label: "Créatif", hint: "colonne colorée bord à bord, photo", d: { columns: 2, side: "left", sideWidth: 33, sideFull: true, header: "side", headingStyle: "line", icons: true, sectionIcons: true, skillsAsTags: true, photo: { show: true, shape: "circle", size: 34, border: 1, borderColor: "#ffffff" }, colors: { accent: "#0f766e", side: "#134e4a", sideText: "#f0fdfa", rule: "#5eead4", band: "#0f766e" } } },
  { id: "elegant", label: "Élégant", hint: "serif, centré, filets doubles", d: { font: "serif", headingFont: "serif", header: "center", headingStyle: "double", headingSpacing: 1.6, headingSize: 1.0, nameSize: 2.5, lineHeight: 1.4, colors: { accent: "#7c2d12", rule: "#d6c7b8", band: "#7c2d12" } } },
];
const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));
function mergeDesign(a, b) {
  const o = { ...a, ...(b || {}) };
  ["colors", "margin", "photo", "layout"].forEach((k) => { o[k] = { ...(a?.[k] || {}), ...(b?.[k] || {}) }; });
  return o;
}
function designFromTemplate(id, keep) {
  const d = mergeDesign(DESIGN_BASE, TEMPLATE_BY_ID[id]?.d);
  d.template = TEMPLATE_BY_ID[id] ? id : "ats";
  if (keep?.layout) d.layout = deepClone(keep.layout);
  if (keep?.accent) d.colors = { ...d.colors, accent: keep.accent, ...(TEMPLATE_BY_ID[id]?.d?.colors?.band === TEMPLATE_BY_ID[id]?.d?.colors?.accent ? { band: keep.accent } : {}) };
  if (keep?.photoShow !== undefined) d.photo = { ...d.photo, show: keep.photoShow };
  if (keep?.page) d.page = keep.page;
  return d;
}
/* ── Mesure du texte (canvas : Arial ≈ Helvetica, Times New Roman ≈ Times, métriques compatibles) ── */
let measureCtx = null;
const measureCache = new Map();
function textWidth(s, f) {
  const key = `${f.font}|${f.bold ? 1 : 0}|${f.italic ? 1 : 0}|${s}`;
  let r = measureCache.get(key);
  if (r === undefined) {
    if (measureCtx === null && typeof document !== "undefined") { try { measureCtx = document.createElement("canvas").getContext("2d") || false; } catch { measureCtx = false; } }
    if (measureCtx) {
      measureCtx.font = `${f.italic ? "italic " : ""}${f.bold ? "bold " : ""}100px ${FONT_CSS[f.font] || FONT_CSS.sans}`;
      r = measureCtx.measureText(s).width / 100;
    } else r = s.length * (f.bold ? 0.56 : 0.52);
    if (measureCache.size > 30000) measureCache.clear();
    measureCache.set(key, r);
  }
  return r * f.size * MMPT + (f.cs ? f.cs * Math.max(0, s.length - 1) : 0);
}
function wrapText(s, firstW, f, restW = firstW) {
  const words = String(s || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  const width = () => (lines.length ? restW : firstW) * 0.99;
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (textWidth(t, f) <= width()) { cur = t; continue; }
    if (cur) { lines.push(cur); cur = ""; }
    if (textWidth(w, f) <= width()) { cur = w; continue; }
    let part = "";
    for (const ch of w) {
      if (part && textWidth(part + ch, f) > width()) { lines.push(part); part = ch; } else part += ch;
    }
    cur = part;
  }
  if (cur || !lines.length) lines.push(cur);
  return lines;
}

/* ── Mise en page : positions en mm, pages, zones cliquables ─────────────
   Opérations : rect, line, circle, text (ligne de base), icon, photo. Zones : blocs (l0..l1) et sections. */
function layoutDocument(model, design, { photo, lang = "fr" } = {}) {
  const D = mergeDesign(DESIGN_BASE, design);
  const C = D.colors;
  const [W, H] = PAGE_SIZES[D.page] || PAGE_SIZES.a4;
  const M = D.margin;
  const isCv = model.kind === "cv";
  const two = isCv && Number(D.columns) === 2;
  const contentW = W - M.l - M.r;
  const sideW = two ? (contentW * clamp(Number(D.sideWidth) || 32, 20, 45)) / 100 : 0;
  const mainW = two ? contentW - sideW - D.colGap : contentW;
  const sideLeft = D.side !== "right";
  const sideX = sideLeft ? M.l : M.l + mainW + D.colGap;
  const mainX = two && sideLeft ? M.l + sideW + D.colGap : M.l;
  const bottom = H - Math.max(M.b, 6) - 3;
  const sideDark = luminance(C.side) < 0.35;
  const sideBg = two && cleanHex(C.side) !== "#ffffff";
  const pad = sideBg && !D.sideFull ? 4 : 0;
  const headerMode = D.header === "side" && !two ? "left" : D.header;
  const hasPhoto = !!(photo && D.photo.show);
  const pages = [];
  const page = (i) => { while (pages.length <= i) pages.push({ ops: [], hits: [], secs: [], sideTop: 0, sideBottom: 0 }); return pages[i]; };
  const lh = (size) => size * MMPT * D.lineHeight;
  const base = (size) => (lh(size) - size * MMPT) / 2 + size * MMPT * 0.8;
  const boxes = new Map();
  const track = (src, p, x, y0, w, y1, kind = "block") => {
    if (!src) return;
    const id = kind === "section" ? `s:${src.key}:${p}` : `b:${src.l0}:${p}`;
    const b = boxes.get(id);
    if (b) { b.x = Math.min(b.x, x); b.y0 = Math.min(b.y0, y0); b.x1 = Math.max(b.x1, x + w); b.y1 = Math.max(b.y1, y1); }
    else boxes.set(id, { kind, p, x, y0, x1: x + w, y1, src });
  };
  const caseOf = (s) => (D.headingCase === "upper" ? String(s).toLocaleUpperCase(lang === "de" ? "de-DE" : "fr-BE") : s);
  const palette = (inSide) => ({
    text: inSide && sideBg ? C.sideText : C.text,
    muted: inSide && sideBg ? (sideDark ? mixHex(C.sideText, C.side, 0.28) : C.muted) : C.muted,
    accent: inSide && sideDark ? C.sideText : C.accent,
    rule: inSide && sideDark ? mixHex(C.sideText, C.side, 0.45) : C.rule,
    tag: inSide && sideDark ? mixHex(C.side, "#ffffff", 0.16) : mixHex(C.accent, "#ffffff", 0.88),
    tagText: inSide && sideDark ? C.sideText : mixHex(C.accent, "#000000", 0.15),
  });

  /* Flux de colonne : y courant, page courante, saut de page automatique. */
  const flow = (x, w, top, inSide) => ({ x, w, y: top, p: 0, top, inSide, first: true });
  const ensure = (fl, h) => { if (fl.y + h > bottom && fl.y > M.t + 0.5) { fl.p += 1; fl.y = M.t + (fl.inSide && pad ? pad : 0); fl.first = true; } };
  const text = (fl, s, x, f, anchor = "start", size = f.size) => {
    page(fl.p).ops.push({ t: "text", x, y: fl.y + base(size), s, font: f.font, bold: !!f.bold, italic: !!f.italic, size: f.size, color: f.color, anchor, cs: f.cs || 0 });
  };
  const lines = (fl, arr, f, { x = fl.x, w = fl.w, src, justify = false, align = "start" } = {}) => {
    const h = lh(f.size);
    arr.forEach((ln, i) => {
      ensure(fl, h);
      if (justify && i < arr.length - 1 && ln.includes(" ")) {
        const words = ln.split(" ");
        const gap = (w - words.reduce((n, wd) => n + textWidth(wd, f), 0)) / (words.length - 1);
        let cx = x;
        if (gap < textWidth(" ", f) * 3) words.forEach((wd) => { text(fl, wd, cx, f); cx += textWidth(wd, f) + gap; });
        else text(fl, ln, x, f);
      } else if (align === "end") text(fl, ln, x + w, f, "end");
      else if (align === "middle") text(fl, ln, x + w / 2, f, "middle");
      else text(fl, ln, x, f);
      track(src, fl.p, x, fl.y, w, fl.y + h);
      fl.y += h;
    });
  };
  const icon = (p, name, x, y, s, color) => { if (DOC_ICONS[name]) page(p).ops.push({ t: "icon", name, x, y, s, color }); };

  /* ── Blocs ── */
  const bulletMark = (fl, f, cy, color) => {
    const x = fl.x + 0.9;
    const o = page(fl.p).ops;
    if (D.bullet === "dot") o.push({ t: "circle", cx: x + 0.3, cy, r: 0.55, fill: color });
    else if (D.bullet === "square") o.push({ t: "rect", x: x - 0.25, y: cy - 0.55, w: 1.1, h: 1.1, fill: color });
    else if (D.bullet === "dash") o.push({ t: "line", x1: x - 0.4, y1: cy, x2: x + 1.2, y2: cy, color, w: 0.3 });
    else if (D.bullet === "arrow") o.push({ t: "text", x: x - 0.4, y: cy + f.size * MMPT * 0.32, s: "›", font: f.font, bold: true, italic: false, size: f.size * 1.15, color, anchor: "start", cs: 0 });
  };
  const block = (fl, b, sec) => {
    const P = palette(fl.inSide);
    const body = { font: D.font, size: D.size, color: P.text };
    const key = baseKey(sec?.key);
    if (b.t === "h3") {
      const parts = b.text.split("|").map((x) => x.trim()).filter(Boolean);
      const role = parts[0] || "";
      let rest = parts.slice(1);
      const last = rest[rest.length - 1];
      const period = last && /\d{4}|aujourd|présent|present|heden|heute|actuel|nu\b/i.test(last) ? last : null;
      if (period) rest = rest.slice(0, -1);
      const fRole = { font: D.font, bold: true, size: D.size * 1.03, color: P.text };
      const fMeta = { font: D.font, size: D.size * 0.9, color: P.muted };
      if (!fl.first) fl.y += D.itemGap * 0.8;
      ensure(fl, lh(fRole.size) * 2 + lh(D.size));
      const right = D.datesRight && period && fl.w > 60;
      const pw = right ? textWidth(period, fMeta) + 3 : 0;
      const rl = wrapText(role, fl.w - pw, fRole);
      if (right) {
        ensure(fl, lh(fRole.size));
        page(fl.p).ops.push({ t: "text", x: fl.x + fl.w, y: fl.y + base(fRole.size), s: period, font: fMeta.font, bold: false, italic: false, size: fMeta.size, color: P.muted, anchor: "end", cs: 0 });
      }
      lines(fl, rl, fRole, { src: b, w: fl.w });
      const meta = [...rest, ...(right ? [] : period ? [period] : [])].join("  ·  ");
      if (meta) lines(fl, wrapText(meta, fl.w, fMeta), fMeta, { src: b });
      fl.y += 0.6;
    } else if (b.t === "bullet") {
      const ind = D.bullet === "none" ? 0 : 3.6;
      const arr = wrapText(b.text, fl.w - ind, body);
      ensure(fl, lh(D.size));
      if (D.bullet !== "none") bulletMark(fl, body, fl.y + lh(D.size) / 2, P.accent);
      lines(fl, arr, body, { x: fl.x + ind, w: fl.w - ind, src: b });
      track(b, fl.p, fl.x, fl.y - lh(D.size), ind, fl.y);
      fl.y += D.itemGap * 0.25;
    } else if (b.t === "kv") {
      const fL = { ...body, bold: true };
      if (D.skillsAsTags && key === "skills") {
        const fT = { font: D.font, size: D.size * 0.86, color: P.tagText };
        if (b.label) { lines(fl, wrapText(b.label.replace(/\s*:\s*$/, ""), fl.w, { ...fL, size: D.size * 0.92, color: P.muted }), { ...fL, size: D.size * 0.92, color: P.muted }, { src: b }); fl.y += 0.4; }
        const tags = b.text.split(/\s*[,;·]\s*/).filter(Boolean);
        const th = lh(fT.size) + 0.9;
        let cx = fl.x;
        ensure(fl, th + 1);
        tags.forEach((tg) => {
          const tw = Math.min(textWidth(tg, fT) + 3.4, fl.w);
          if (cx > fl.x && cx + tw > fl.x + fl.w) { cx = fl.x; fl.y += th + 1.1; ensure(fl, th + 1); }
          page(fl.p).ops.push({ t: "rect", x: cx, y: fl.y, w: tw, h: th, fill: P.tag, r: 1.2 });
          page(fl.p).ops.push({ t: "text", x: cx + 1.7, y: fl.y + 0.45 + base(fT.size), s: tg, font: fT.font, bold: false, italic: false, size: fT.size, color: fT.color, anchor: "start", cs: 0 });
          track(b, fl.p, cx, fl.y, tw, fl.y + th);
          cx += tw + 1.3;
        });
        fl.y += th + 1.6;
      } else {
        const label = `${b.label} `;
        const lw = textWidth(label, fL);
        const arr = wrapText(b.text, Math.max(10, fl.w - lw), body, fl.w);
        ensure(fl, lh(D.size));
        text(fl, label.trim(), fl.x, fL);
        lines(fl, arr.slice(0, 1), body, { x: fl.x + lw, w: fl.w - lw, src: b });
        track(b, fl.p, fl.x, fl.y - lh(D.size), lw, fl.y);
        if (arr.length > 1) lines(fl, arr.slice(1), body, { src: b });
        fl.y += D.itemGap * 0.3;
      }
    } else if (b.t === "quote") {
      const f = { ...body, italic: true, color: P.muted };
      lines(fl, wrapText(b.text, fl.w, f), f, { src: b });
      fl.y += D.paraGap;
    } else {
      lines(fl, wrapText(b.text, fl.w, body), body, { src: b, justify: !isCv && D.justify });
      fl.y += isCv ? D.paraGap : Math.max(D.paraGap * 1.8, 3);
    }
    fl.first = false;
  };

  const heading = (fl, sec) => {
    const P = palette(fl.inSide);
    const f = { font: D.headingFont, bold: true, size: D.size * D.headingSize, color: P.accent, cs: D.headingCase === "upper" ? D.headingSpacing * MMPT : 0 };
    const hh = lh(f.size);
    ensure(fl, hh + 4 + lh(D.size) * 2);
    const o = () => page(fl.p).ops;
    const y0 = fl.y;
    let x = fl.x;
    const label = caseOf(sectionLabel(sec));
    if (D.headingStyle === "double" && D.rule > 0) { o().push({ t: "line", x1: fl.x, y1: fl.y, x2: fl.x + fl.w, y2: fl.y, color: P.rule, w: D.rule }); fl.y += 1.4; }
    if (D.headingStyle === "pill") { o().push({ t: "rect", x: fl.x, y: fl.y - 0.3, w: fl.w, h: hh + 0.6, fill: P.tag, r: 1.4 }); x += 2.2; }
    if (D.headingStyle === "bar") { o().push({ t: "rect", x: fl.x, y: fl.y + hh * 0.18, w: 1.2, h: hh * 0.64, fill: P.accent, r: 0.3 }); x += 3.4; }
    const icName = D.sectionIcons && SECTION_ICON[baseKey(sec.key)];
    if (icName) { const s = f.size * MMPT * 1.15; icon(fl.p, icName, x, fl.y + (hh - s) / 2, s, P.accent); x += s + 1.8; }
    const ls = wrapText(label, fl.x + fl.w - x, f);
    const center = D.headingStyle !== "pill" && D.headingStyle !== "bar" && D.header === "center" && !two && !icName;
    ls.forEach((ln) => { center ? text(fl, ln, fl.x + fl.w / 2, f, "middle") : text(fl, ln, x, f); fl.y += hh; });
    if ((D.headingStyle === "line" || D.headingStyle === "double") && D.rule > 0) { fl.y += 0.9; o().push({ t: "line", x1: fl.x, y1: fl.y, x2: fl.x + fl.w, y2: fl.y, color: D.headingStyle === "line" ? P.rule : P.rule, w: D.rule }); fl.y += D.rule; }
    fl.y += D.headingStyle === "plain" ? 1.2 : 2;
    if (sec.heading) track(sec.heading, fl.p, fl.x, y0, fl.w, fl.y);
    fl.first = true;
  };
  const section = (fl, sec) => {
    if (!sec) return;
    if (!fl.firstSection) fl.y += D.sectionGap; else fl.firstSection = false;
    const p0 = fl.p, y0 = fl.y;
    if (sec.heading) heading(fl, sec);
    sec.blocks.forEach((b) => block(fl, b, sec));
    for (let p = p0; p <= fl.p; p++) track(sec, p, fl.x, p === p0 ? y0 : M.t, fl.w, p === fl.p ? fl.y : bottom, "section");
    page(fl.p).secs.push(sec.key);
  };

  /* ── En-tête ── */
  const header = (x, w, y, mode, inSide) => {
    const fl = { x, w, y, p: 0, inSide, first: true };
    const P = palette(inSide);
    const band = mode === "band";
    const nameColor = band ? C.bandText : P.accent;
    const subColor = band ? mixHex(C.bandText, C.band, 0.22) : P.muted;
    const center = mode === "center" || mode === "side";
    const S = D.photo.size;
    let tx = x, tw = w;
    const y0 = y;
    if (hasPhoto) {
      if (center) { page(0).ops.push({ t: "photo", x: x + (w - S) / 2, y: fl.y, s: S, shape: D.photo.shape, border: D.photo.border, borderColor: D.photo.borderColor }); fl.y += S + 4; }
      else { page(0).ops.push({ t: "photo", x, y: fl.y, s: S, shape: D.photo.shape, border: D.photo.border, borderColor: D.photo.borderColor }); tx = x + S + 6; tw = w - S - 6; }
      track(PHOTO_SRC, 0, center ? x + (w - S) / 2 : x, center ? fl.y - S - 4 : fl.y, S, center ? fl.y - 4 : fl.y + S);
    }
    const opStart = page(0).ops.length;
    const al = center ? "middle" : "start";
    const ax = center ? tx + tw / 2 : tx;
    const put = (arr, f, src) => arr.forEach((ln) => { text(fl, ln, ax, f, al); track(src, 0, tx, fl.y, tw, fl.y + lh(f.size)); fl.y += lh(f.size); });
    if (model.head.name) {
      const f = { font: D.headingFont, bold: true, size: D.size * D.nameSize, color: nameColor };
      put(wrapText(model.head.name.text, tw, f), f, model.head.name);
    }
    model.head.headline.forEach((hb) => { const f = { font: D.font, size: D.size * 1.12, color: subColor }; fl.y += 0.6; put(wrapText(hb.text, tw, f), f, hb); });
    const items = contactItems(model.head);
    if (items.length) {
      fl.y += 1.6;
      const f = { font: D.font, size: D.size * 0.88, color: band ? subColor : P.muted };
      const is = D.icons ? f.size * MMPT * 1.15 : 0;
      const sep = D.icons ? 4 : textWidth("  ·  ", f);
      const h = lh(f.size) + 0.4;
      if (inSide) {
        items.forEach((it) => {
          const iw = textWidth(it.text, f);
          const cw = Math.min(tw, iw + (is ? is + 1.4 : 0));
          const cx = tx + (tw - cw) / 2;
          if (is) icon(0, it.icon, cx, fl.y + (h - is) / 2, is, band ? C.bandText : P.accent);
          const arr = wrapText(it.text, tw - (is ? is + 1.4 : 0), f);
          arr.forEach((ln, i) => { text(fl, ln, is ? cx + is + 1.4 : tx + tw / 2, f, is ? "start" : "middle"); if (i < arr.length - 1) fl.y += lh(f.size); });
          track(it.src, 0, tx, fl.y, tw, fl.y + h);
          fl.y += h;
        });
      } else {
        const rows = [[]];
        let rw = 0;
        items.forEach((it) => {
          const iw = Math.min(textWidth(it.text, f), tw) + (is ? is + 1.2 : 0);
          if (rows[rows.length - 1].length && rw + sep + iw > tw) { rows.push([]); rw = 0; }
          rows[rows.length - 1].push({ ...it, iw });
          rw += (rw ? sep : 0) + iw;
        });
        rows.forEach((row) => {
          const total = row.reduce((n, it, i) => n + it.iw + (i ? sep : 0), 0);
          let cx = center ? tx + (tw - total) / 2 : tx;
          row.forEach((it, i) => {
            if (i && !D.icons) text(fl, "·", cx + sep / 2, { ...f, bold: true }, "middle");
            if (i) cx += sep;
            if (is) { icon(0, it.icon, cx, fl.y + (h - is) / 2, is, band ? C.bandText : P.accent); }
            text(fl, it.text, cx + (is ? is + 1.2 : 0), f);
            track(it.src, 0, cx, fl.y, it.iw, fl.y + h);
            cx += it.iw;
          });
          fl.y += h;
        });
      }
    }
    // Texte centré verticalement sur la photo quand celle-ci est plus haute.
    if (hasPhoto && !center && fl.y - y0 < S) {
      const dy = (S - (fl.y - y0)) / 2;
      page(0).ops.slice(opStart).forEach((o) => { o.y += dy; });
      const heads = new Set([model.head.name, ...model.head.headline, ...model.head.contact].filter(Boolean));
      boxes.forEach((b) => { if (b.p === 0 && heads.has(b.src)) { b.y0 += dy; b.y1 += dy; } });
    }
    return Math.max(fl.y, hasPhoto && !center ? y0 + S : 0);
  };

  /* ── Assemblage ── */
  let mainTop = M.t, sideTop = M.t;
  if (headerMode === "band") {
    page(0);
    const bandIdx = pages[0].ops.length;
    const end = header(M.l, contentW, Math.max(M.t * 0.75, 8), "band", false);
    const bh = end + Math.max(M.t * 0.6, 6);
    pages[0].ops.splice(bandIdx, 0, { t: "rect", x: 0, y: 0, w: W, h: bh, fill: C.band });
    mainTop = sideTop = bh + Math.max(D.sectionGap, 5);
  } else if (headerMode === "side" && two) {
    sideTop = header(sideX + pad, sideW - 2 * pad, M.t + pad, "side", true) + D.sectionGap + 1;
    mainTop = M.t;
  } else if (isCv || model.head.name || model.head.contact.length) {
    const end = header(M.l, contentW, M.t, headerMode === "center" ? "center" : "left", false);
    const rule = headerMode !== "center" && D.headingStyle !== "plain" && D.rule > 0;
    if (rule) pages[0].ops.push({ t: "line", x1: M.l, y1: end + 2.2, x2: M.l + contentW, y2: end + 2.2, color: C.accent, w: Math.max(D.rule, 0.5) });
    mainTop = sideTop = end + (rule ? 2.2 + D.sectionGap + 0.6 : D.sectionGap + 1);
  }

  if (isCv) {
    const arr = arrangeSections(model.sections, D.layout, two);
    const main = flow(mainX, mainW, mainTop, false);
    main.firstSection = true;
    arr.main.forEach((sec) => section(main, sec));
    if (two) {
      const side = flow(sideX + pad, sideW - 2 * pad, sideTop + (headerMode === "side" ? 0 : pad), true);
      side.firstSection = true;
      arr.side.forEach((sec) => section(side, sec));
      page(side.p);
      pages.forEach((pg, i) => {
        const top = i === 0 ? (headerMode === "side" ? 0 : headerMode === "band" ? mainTop - Math.max(D.sectionGap, 5) : (D.sideFull ? sideTop - D.sectionGap * 0.5 : sideTop)) : 0;
        if (!sideBg) return;
        const rect = D.sideFull
          ? { x: sideLeft ? 0 : sideX - D.colGap / 2, y: top, w: sideLeft ? sideX + sideW + D.colGap / 2 : W - (sideX - D.colGap / 2), h: H - top }
          : { x: sideX, y: i === 0 && headerMode !== "side" ? sideTop : M.t, w: sideW, h: (i === side.p ? side.y + pad : bottom) - (i === 0 && headerMode !== "side" ? sideTop : M.t), r: 2.5 };
        if (rect.h > 0) pg.ops.unshift({ t: "rect", ...rect, fill: C.side });
      });
    }
    page(main.p);
  } else {
    const L = model.letter;
    const fl = flow(M.l, contentW, mainTop + 2, false);
    const body = { font: D.font, size: D.size, color: C.text };
    if (L.date) { lines(fl, [L.date.text], { ...body, color: C.muted }, { align: "end", src: L.date }); fl.y += 3; }
    L.recipient.forEach((r) => lines(fl, wrapText(r.text, contentW * 0.6, body), body, { src: r }));
    if (L.recipient.length) fl.y += 5;
    if (L.subject) { const f = { ...body, bold: true }; lines(fl, wrapText(L.subject.text, contentW, f), f, { src: L.subject }); fl.y += 4; }
    L.body.forEach((b) => block(fl, b, null));
    if (L.sign) { fl.y += 3; const f = { ...body, bold: true }; lines(fl, wrapText(L.sign.text, contentW, f), f, { src: L.sign }); }
    page(fl.p);
  }

  /* Numéros de page, zones cliquables */
  if (pages.length > 1) pages.forEach((pg, i) => pg.ops.push({ t: "text", x: W - Math.max(M.r, 8), y: H - Math.max(M.b * 0.45, 4), s: `${i + 1} / ${pages.length}`, font: D.font, bold: false, italic: false, size: 7.5, color: C.muted, anchor: "end", cs: 0 }));
  boxes.forEach((b) => page(b.p).hits.push({ kind: b.kind, x: b.x - 0.8, y: b.y0 - 0.4, w: b.x1 - b.x + 1.6, h: b.y1 - b.y0 + 0.8, src: b.src }));
  return { W, H, pages, design: D, two };
}

/* ── Rendu PDF vectoriel (jsPDF) ───────────────────────────────────────── */
const iconPngCache = new Map();
function iconPng(name, color, px = 96) {
  const key = `${name}|${color}|${px}`;
  if (iconPngCache.has(key)) return iconPngCache.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const ctx = c.getContext("2d");
  ctx.scale(px / 24, px / 24);
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  (DOC_ICONS[name] || []).forEach((d) => ctx.stroke(new Path2D(d)));
  const url = c.toDataURL("image/png");
  iconPngCache.set(key, url);
  return url;
}
const hexPoints = (x, y, s) => [[x + s / 2, y], [x + s, y + s * 0.25], [x + s, y + s * 0.75], [x + s / 2, y + s], [x, y + s * 0.75], [x, y + s * 0.25]];
function pdfShape(pdf, o, style) {
  if (o.shape === "circle") pdf.circle(o.x + o.s / 2, o.y + o.s / 2, o.s / 2, style);
  else if (o.shape === "rounded") pdf.roundedRect(o.x, o.y, o.s, o.s, o.s * 0.18, o.s * 0.18, style);
  else if (o.shape === "hexagon") {
    const pts = hexPoints(o.x, o.y, o.s);
    pdf.lines(pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]), pts[0][0], pts[0][1], [1, 1], style, true);
  } else pdf.rect(o.x, o.y, o.s, o.s, style);
}
function drawPdfPage(pdf, pg, { photo }) {
  for (const o of pg.ops) {
    if (o.t === "rect") {
      pdf.setFillColor(...hexRgb(o.fill));
      if (o.r) pdf.roundedRect(o.x, o.y, o.w, o.h, o.r, o.r, "F"); else pdf.rect(o.x, o.y, o.w, o.h, "F");
    } else if (o.t === "circle") { pdf.setFillColor(...hexRgb(o.fill)); pdf.circle(o.cx, o.cy, o.r, "F"); }
    else if (o.t === "line") { pdf.setDrawColor(...hexRgb(o.color)); pdf.setLineWidth(o.w); pdf.line(o.x1, o.y1, o.x2, o.y2); }
    else if (o.t === "text") {
      pdf.setFont(FONT_PDF[o.font] || "helvetica", o.bold && o.italic ? "bolditalic" : o.bold ? "bold" : o.italic ? "italic" : "normal");
      pdf.setFontSize(o.size);
      pdf.setTextColor(...hexRgb(o.color));
      const opt = {};
      if (o.anchor === "end") opt.align = "right"; else if (o.anchor === "middle") opt.align = "center";
      if (o.cs) opt.charSpace = o.cs;
      pdf.text(pdfSafe(o.s), o.x, o.y, opt);
    } else if (o.t === "icon") {
      try { pdf.addImage(iconPng(o.name, o.color), "PNG", o.x, o.y, o.s, o.s, `ic_${o.name}_${o.color.slice(1)}`, "FAST"); } catch { /* icône facultative */ }
    } else if (o.t === "photo" && photo?.src) {
      pdf.saveGraphicsState();
      pdfShape(pdf, o, null);
      pdf.clip();
      pdf.discardPath();
      pdf.addImage(photo.src, "JPEG", o.x, o.y, o.s, o.s, "photo", "FAST");
      pdf.restoreGraphicsState();
      if (o.border > 0) { pdf.setDrawColor(...hexRgb(o.borderColor)); pdf.setLineWidth(o.border); pdfShape(pdf, o, "S"); }
    }
  }
}
async function buildPdf(items, { title, author, keywords, subject } = {}) {
  const { jsPDF } = await loadJsPDF();
  const first = items[0].layout;
  const pdf = new jsPDF({ unit: "mm", format: [first.W, first.H], compress: true });
  let n = 0;
  for (const it of items) {
    const start = n + 1;
    it.layout.pages.forEach((pg) => { if (n > 0) pdf.addPage([it.layout.W, it.layout.H]); n += 1; drawPdfPage(pdf, pg, it); });
    if (items.length > 1) { try { pdf.outline.add(null, pdfSafe(it.title), { pageNumber: start }); } catch { /* signets facultatifs */ } }
  }
  pdf.setProperties({ title: pdfSafe(title), subject: pdfSafe(subject || ""), author: pdfSafe(author || ""), keywords: pdfSafe((keywords || []).join(", ")), creator: "Radar" });
  return pdf.output("arraybuffer");
}

/* ── ZIP (méthode « stockée », sans compression) : sert au .docx et aux exports groupés ── */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
const toBytes = (d) => (typeof d === "string" ? new TextEncoder().encode(d) : d instanceof Uint8Array ? d : new Uint8Array(d));
function zipStore(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const time = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const date = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = toBytes(f.data);
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2], [28, 0, 2]]
      .forEach(([o, v, s]) => (s === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true)));
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]]
      .forEach(([o, v, s]) => (s === 4 ? ch.setUint32(o, v, true) : ch.setUint16(o, v, true)));
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let o = 0;
  all.forEach((p) => { out.set(p, o); o += p.length; });
  return out;
}
const dataUrlBytes = (u) => { const b = atob(String(u).split(",")[1] || ""); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };

/* ── Word (.docx) natif : styles Titre 1 / Titre 2 (lus par les ATS), colonnes en tableau, photo en forme native ── */
const TW = 56.6929; // twips par mm
const EMU = 36000; // EMU par mm
const xmlEsc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hexW = (h) => cleanHex(h).slice(1).toUpperCase();
const DOCX_LANG = { fr: "fr-BE", nl: "nl-BE", en: "en-GB", de: "de-DE" };
function buildDocx(items, { photo, title, author, keywords, mode = "design" } = {}) {
  const media = [];
  let drawId = 1;
  const rels = [];
  const mediaRel = (key, name, bytes) => {
    let m = media.find((x) => x.key === key);
    if (!m) { m = { key, name, bytes, rid: `rIdM${media.length + 1}` }; media.push(m); rels.push(`<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`); }
    return m.rid;
  };
  const drawing = (rid, wmm, hmm, prst = "rect", ln) => {
    const id = drawId++;
    const cx = Math.round(wmm * EMU), cy = Math.round(hmm * EMU);
    const line = ln ? `<a:ln w="${Math.round(ln.w * EMU)}"><a:solidFill><a:srgbClr val="${hexW(ln.color)}"/></a:solidFill></a:ln>` : "";
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Image ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="img${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>${line}</pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  };
  const body = [];
  let sect = null;
  items.forEach((it, idx) => {
    const D = mergeDesign(DESIGN_BASE, it.design);
    const C = D.colors;
    const lang = DOCX_LANG[it.lang] || "fr-BE";
    const fBody = FONT_DOCX[D.font], fHead = FONT_DOCX[D.headingFont];
    const [W] = PAGE_SIZES[D.page] || PAGE_SIZES.a4;
    const contentW = W - D.margin.l - D.margin.r;
    const ats = mode === "ats";
    const two = !ats && it.kind === "cv" && Number(D.columns) === 2;
    if (!sect) sect = D;
    const run = (t, o = {}) => `<w:r><w:rPr><w:rFonts w:ascii="${o.font || fBody}" w:hAnsi="${o.font || fBody}" w:cs="${o.font || fBody}"/>${o.bold ? "<w:b/>" : ""}${o.italic ? "<w:i/>" : ""}${o.caps ? "<w:caps/>" : ""}<w:color w:val="${hexW(o.color || C.text)}"/>${o.cs ? `<w:spacing w:val="${Math.round(o.cs * 20)}"/>` : ""}<w:sz w:val="${Math.round((o.size || D.size) * 2)}"/><w:szCs w:val="${Math.round((o.size || D.size) * 2)}"/><w:lang w:val="${lang}"/></w:rPr><w:t xml:space="preserve">${xmlEsc(t)}</w:t></w:r>`;
    const tab = (o = {}) => `<w:r><w:rPr><w:sz w:val="${Math.round((o.size || D.size) * 2)}"/></w:rPr><w:tab/></w:r>`;
    const p = (runs, o = {}) => {
      const sp = `<w:spacing w:before="${Math.round((o.before || 0) * TW)}" w:after="${Math.round((o.after ?? 0) * TW)}" w:line="${Math.round(240 * (o.line || D.lineHeight) * 0.86)}" w:lineRule="auto"/>`;
      const bdr = o.border || "";
      return `<w:p><w:pPr>${o.style ? `<w:pStyle w:val="${o.style}"/>` : ""}${o.keepNext ? "<w:keepNext/>" : ""}${bdr}${o.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${hexW(o.shade)}"/>` : ""}${o.tabs || ""}${sp}${o.ind ? `<w:ind w:left="${Math.round(o.ind.left * TW)}" w:hanging="${Math.round((o.ind.hanging || 0) * TW)}"/>` : ""}${o.align ? `<w:jc w:val="${o.align}"/>` : ""}</w:pPr>${runs}</w:p>`;
    };
    const colors = (inSide) => {
      const dark = luminance(C.side) < 0.35;
      return { text: inSide && two ? C.sideText : C.text, muted: inSide && two && dark ? mixHex(C.sideText, C.side, 0.28) : C.muted, accent: inSide && two && dark ? C.sideText : C.accent, rule: inSide && two && dark ? mixHex(C.sideText, C.side, 0.45) : C.rule };
    };
    const sectionXml = (sec, inSide, colW) => {
      const K = colors(inSide);
      const out = [];
      if (sec.heading) {
        const rulePt = Math.max(2, Math.round((D.rule / MMPT) * 8));
        const bd = ats ? "" : D.headingStyle === "line" && D.rule > 0 ? `<w:pBdr><w:bottom w:val="single" w:sz="${rulePt}" w:space="2" w:color="${hexW(K.rule)}"/></w:pBdr>`
          : D.headingStyle === "double" && D.rule > 0 ? `<w:pBdr><w:top w:val="single" w:sz="${rulePt}" w:space="2" w:color="${hexW(K.rule)}"/><w:bottom w:val="single" w:sz="${rulePt}" w:space="2" w:color="${hexW(K.rule)}"/></w:pBdr>`
          : D.headingStyle === "bar" ? `<w:pBdr><w:left w:val="single" w:sz="24" w:space="6" w:color="${hexW(K.accent)}"/></w:pBdr>` : "";
        out.push(p(run(sectionLabel(sec), { font: fHead, bold: true, caps: D.headingCase === "upper", cs: D.headingCase === "upper" ? D.headingSpacing : 0, size: D.size * D.headingSize, color: K.accent }), { style: "Heading1", keepNext: true, before: D.sectionGap, after: 1.6, border: bd, shade: !ats && D.headingStyle === "pill" ? mixHex(C.accent, "#ffffff", 0.88) : null }));
      }
      sec.blocks.forEach((b) => {
        if (b.t === "h3") {
          const parts = b.text.split("|").map((x) => x.trim()).filter(Boolean);
          let rest = parts.slice(1);
          const last = rest[rest.length - 1];
          const period = last && /\d{4}|aujourd|présent|present|heden|heute|actuel/i.test(last) ? last : null;
          if (period) rest = rest.slice(0, -1);
          const right = D.datesRight && period && colW > 60;
          out.push(p(run(parts[0] || "", { bold: true, size: D.size * 1.03, color: K.text }) + (right ? tab() + run(period, { size: D.size * 0.9, color: K.muted }) : ""), { style: "Heading2", keepNext: true, before: D.itemGap * 0.8, tabs: right ? `<w:tabs><w:tab w:val="right" w:pos="${Math.round(colW * TW)}"/></w:tabs>` : "" }));
          const meta = [...rest, ...(right ? [] : period ? [period] : [])].join("  ·  ");
          if (meta) out.push(p(run(meta, { size: D.size * 0.9, color: K.muted }), { after: 0.6 }));
        } else if (b.t === "bullet") {
          const mark = { dot: "•", square: "▪", dash: "–", arrow: "›", none: "" }[D.bullet] ?? "•";
          out.push(p((mark ? run(mark, { color: K.accent }) + tab() : "") + run(b.text, { color: K.text }), { ind: mark ? { left: 3.6, hanging: 3.6 } : null, after: 0.4 }));
        } else if (b.t === "kv") {
          out.push(p(run(`${b.label} `, { bold: true, color: K.text }) + run(b.text, { color: K.text }), { after: 0.5 }));
        } else if (b.t === "quote") out.push(p(run(b.text, { italic: true, color: K.muted }), { after: D.paraGap }));
        else out.push(p(run(b.text, { color: K.text }), { after: D.paraGap }));
      });
      return out.join("");
    };
    const m = designModel(it.text, it.kind);
    const showPhoto = !ats && photo?.src && D.photo.show;
    const prst = { circle: "ellipse", rounded: "roundRect", hexagon: "hexagon", square: "rect" }[D.photo.shape] || "rect";
    const photoRun = showPhoto ? drawing(mediaRel("photo", "photo.jpg", dataUrlBytes(photo.src)), D.photo.size, D.photo.size, prst, D.photo.border > 0 ? { w: D.photo.border, color: D.photo.borderColor } : null) : "";
    const band = !ats && D.header === "band";
    const center = D.header === "center" || (D.header === "side" && !two);
    const nameColor = band ? C.bandText : C.accent;
    const subColor = band ? mixHex(C.bandText, C.band, 0.22) : C.muted;
    const headParas = (align, inSide) => {
      const out = [];
      const K = colors(inSide);
      if (m.head.name) out.push(p(run(m.head.name.text, { font: fHead, bold: true, size: D.size * D.nameSize, color: inSide ? K.accent : nameColor }), { style: "Title", align, after: 0.6, line: 1.05 }));
      m.head.headline.forEach((h) => out.push(p(run(h.text, { size: D.size * 1.12, color: inSide ? K.muted : subColor }), { align, after: 0.6 })));
      const items = contactItems(m.head);
      if (items.length) {
        const col = inSide ? K.muted : band ? subColor : C.muted;
        const icCol = inSide ? K.accent : band ? C.bandText : C.accent;
        const runs = items.map((x, i) => {
          const ic = !ats && D.icons ? drawing(mediaRel(`ic_${x.icon}_${icCol}`, `ic_${x.icon}_${hexW(icCol)}.png`, dataUrlBytes(iconPng(x.icon, icCol))), D.size * 0.88 * MMPT * 1.15, D.size * 0.88 * MMPT * 1.15) + run(" ", { size: D.size * 0.88 }) : "";
          return (inSide ? "" : i ? run(D.icons && !ats ? "     " : "  ·  ", { size: D.size * 0.88, color: col }) : "") + ic + run(x.text, { size: D.size * 0.88, color: col });
        });
        if (inSide) runs.forEach((r) => out.push(p(r, { align, after: 0.5 })));
        else out.push(p(runs.join(""), { align, before: 1.2, after: 0.4 }));
      }
      return out.join("");
    };
    const tbl = (cells, { indent = 0, width } = {}) => {
      const total = width || contentW;
      return `<w:tbl><w:tblPr><w:tblW w:w="${Math.round(total * TW)}" w:type="dxa"/>${indent ? `<w:tblInd w:w="${Math.round(indent * TW)}" w:type="dxa"/>` : ""}<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${cells.map((c) => `<w:gridCol w:w="${Math.round(c.w * TW)}"/>`).join("")}</w:tblGrid><w:tr>${cells.map((c) => `<w:tc><w:tcPr><w:tcW w:w="${Math.round(c.w * TW)}" w:type="dxa"/>${c.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${hexW(c.shade)}"/>` : ""}<w:tcMar><w:top w:w="${Math.round((c.pad?.[0] || 0) * TW)}" w:type="dxa"/><w:left w:w="${Math.round((c.pad?.[1] || 0) * TW)}" w:type="dxa"/><w:bottom w:w="${Math.round((c.pad?.[2] || 0) * TW)}" w:type="dxa"/><w:right w:w="${Math.round((c.pad?.[3] || 0) * TW)}" w:type="dxa"/></w:tcMar><w:vAlign w:val="${c.valign || "top"}"/></w:tcPr>${c.xml || p("")}</w:tc>`).join("")}</w:tr></w:tbl>`;
    };
    if (idx > 0) body.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
    // En-tête
    if (!(two && D.header === "side")) {
      const align = center ? "center" : "left";
      if (band) {
        const inner = photoRun && !center
          ? tbl([{ w: D.photo.size + 6, xml: p(photoRun), valign: "center" }, { w: W - D.photo.size - 6 - D.margin.l - D.margin.r, xml: headParas("left", false), valign: "center" }], { width: W - D.margin.l - D.margin.r }) + p("", { line: 0.5 })
          : (photoRun ? p(photoRun, { align: "center" }) : "") + headParas(align, false);
        body.push(tbl([{ w: W, shade: C.band, pad: [Math.max(D.margin.t * 0.6, 6), D.margin.l, Math.max(D.margin.t * 0.6, 6), D.margin.r], xml: inner }], { indent: -D.margin.l, width: W }));
        body.push(p("", { after: 1 }));
      } else if (photoRun && !center) {
        body.push(tbl([{ w: D.photo.size + 6, xml: p(photoRun), valign: "center" }, { w: contentW - D.photo.size - 6, xml: headParas("left", false), valign: "center" }]));
        body.push(p("", { after: 1, border: !ats && D.rule > 0 ? `<w:pBdr><w:bottom w:val="single" w:sz="${Math.max(4, Math.round((Math.max(D.rule, 0.5) / MMPT) * 8))}" w:space="1" w:color="${hexW(C.accent)}"/></w:pBdr>` : "" }));
      } else {
        if (photoRun) body.push(p(photoRun, { align: "center", after: 2 }));
        body.push(headParas(align, false));
        if (!center && !ats && D.rule > 0) body.push(p("", { after: 1, border: `<w:pBdr><w:bottom w:val="single" w:sz="${Math.max(4, Math.round((Math.max(D.rule, 0.5) / MMPT) * 8))}" w:space="1" w:color="${hexW(C.accent)}"/></w:pBdr>` }));
      }
    }
    if (it.kind === "letter") {
      const L = m.letter;
      if (L.date) body.push(p(run(L.date.text, { color: C.muted }), { align: "right", before: 4, after: 3 }));
      L.recipient.forEach((r) => body.push(p(run(r.text))));
      if (L.subject) body.push(p(run(L.subject.text, { bold: true }), { before: 5, after: 4 }));
      L.body.forEach((b) => {
        if (b.t === "bullet") body.push(p(run("•", { color: C.accent }) + tab() + run(b.text), { ind: { left: 3.6, hanging: 3.6 }, after: 0.4 }));
        else body.push(p(run(b.text), { after: Math.max(D.paraGap * 1.8, 3), align: D.justify ? "both" : null }));
      });
      if (L.sign) body.push(p(run(L.sign.text, { bold: true }), { before: 4 }));
    } else {
      const arr = arrangeSections(m.sections, D.layout, two);
      if (!two) {
        // ATS : une seule colonne, colonne principale puis secondaire, dans l'ordre choisi dans le Studio.
        const flat = ats && Number(D.columns) === 2 ? (({ main, side }) => [...main, ...side])(arrangeSections(m.sections, D.layout, true)) : arr.main;
        flat.forEach((sec) => body.push(sectionXml(sec, false, contentW)));
      }
      else {
        const sideW = (contentW * clamp(Number(D.sideWidth) || 32, 20, 45)) / 100;
        const mainW = contentW - sideW;
        const pad = 3.5;
        let sideXml = arr.side.map((sec) => sectionXml(sec, true, sideW - 2 * pad)).join("");
        if (D.header === "side") sideXml = (photoRun ? p(photoRun, { align: "center", after: 3 }) : "") + headParas("center", true) + sideXml;
        const mainXml = arr.main.map((sec) => sectionXml(sec, false, mainW - D.colGap)).join("");
        const sideCell = { w: sideW, shade: cleanHex(C.side) !== "#ffffff" ? C.side : null, pad: [pad, pad, pad, pad], xml: sideXml || p("") };
        const mainCell = { w: mainW, pad: [0, D.side === "left" ? D.colGap : 0, 0, D.side === "left" ? 0 : D.colGap], xml: mainXml || p("") };
        body.push(tbl(D.side === "left" ? [sideCell, mainCell] : [mainCell, sideCell]));
        body.push(p(""));
      }
    }
  });
  const D0 = mergeDesign(DESIGN_BASE, sect);
  const [PW, PH] = PAGE_SIZES[D0.page] || PAGE_SIZES.a4;
  const sectPr = `<w:sectPr><w:pgSz w:w="${Math.round(PW * TW)}" w:h="${Math.round(PH * TW)}"/><w:pgMar w:top="${Math.round(D0.margin.t * TW)}" w:right="${Math.round(D0.margin.r * TW)}" w:bottom="${Math.round(D0.margin.b * TW)}" w:left="${Math.round(D0.margin.l * TW)}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`;
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body.join("")}${sectPr}</w:body></w:document>`;
  const f0 = FONT_DOCX[D0.font];
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${f0}" w:hAnsi="${f0}" w:cs="${f0}" w:eastAsia="${f0}"/><w:sz w:val="${Math.round(D0.size * 2)}"/><w:szCs w:val="${Math.round(D0.size * 2)}"/><w:lang w:val="${DOCX_LANG[items[0]?.lang] || "fr-BE"}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/></w:pPr></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="709"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdT" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${rels.join("")}</Relationships>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const iso = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEsc(title || "")}</dc:title><dc:creator>${xmlEsc(author || "")}</dc:creator><cp:keywords>${xmlEsc((keywords || []).join(", "))}</cp:keywords><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`;
  const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Radar</Application></Properties>`;
  return zipStore([
    { name: "[Content_Types].xml", data: ct },
    { name: "_rels/.rels", data: rootRels },
    { name: "docProps/core.xml", data: core },
    { name: "docProps/app.xml", data: app },
    { name: "word/document.xml", data: doc },
    { name: "word/styles.xml", data: styles },
    { name: "word/settings.xml", data: settingsXml },
    { name: "word/_rels/document.xml.rels", data: docRels },
    ...media.map((m) => ({ name: `word/media/${m.name}`, data: m.bytes })),
  ]);
}

/* ── Photo : recadrage local (jamais envoyée à l'IA) ──────────────────── */
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Image illisible")); i.src = src; });
function drawCrop(ctx, img, size, crop) {
  const { zoom = 1, x = 0, y = 0, rot = 0 } = crop || {};
  const r = ((rot % 360) + 360) % 360;
  const iw = r % 180 ? img.height : img.width, ih = r % 180 ? img.width : img.height;
  const s = Math.max(size / iw, size / ih) * zoom;
  ctx.save();
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size);
  ctx.translate(size / 2 + x * size, size / 2 + y * size);
  ctx.rotate((r * Math.PI) / 180);
  ctx.drawImage(img, (-img.width * s) / 2, (-img.height * s) / 2, img.width * s, img.height * s);
  ctx.restore();
}
async function downscaleImage(src, max = 1200) {
  const img = await loadImg(src);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.88);
}
async function cropPhoto(original, crop, out = 640) {
  const img = await loadImg(original);
  const c = document.createElement("canvas");
  c.width = c.height = out;
  drawCrop(c.getContext("2d"), img, out, crop);
  return c.toDataURL("image/jpeg", 0.9);
}


const activeVersion = (criteria) => criteria?.versions?.[criteria.versions.length - 1] || null;
const isStale = (offer, versionId) => !offer.score || offer.score.criteriaVersionId !== versionId || (!offer.demo && offer.score.method !== 2);
const offerLang = (o) => o?.language || "fr";
const LANG_NAME = { fr: "français", nl: "néerlandais", en: "anglais", de: "allemand" };
const LANG_FLAG = { fr: "FR", nl: "NL", en: "EN", de: "DE" };
/* Versions par langue (CV et lettre) : une version sans langue vaut la langue du dossier. */
const docLangOf = (app, offer, v) => v?.language || app?.docLanguage || offer?.language || "fr";
const markupVersions = (app, offer, type, lang) => (app?.docs?.[type] || []).filter((v) => v.format === "markup" && (!lang || docLangOf(app, offer, v) === lang));
const docLangs = (app, offer, type) => DOC_LANGS.filter((l) => markupVersions(app, offer, type, l).length);
const latestDoc = (app, offer, type, lang) => markupVersions(app, offer, type, lang).slice(-1)[0] || null;
/* Texte à exporter : le brouillon en cours s'il porte sur cette version, sinon la version enregistrée. */
const docTextOf = (app, type, v) => { const d = app?.drafts?.[type]; return d && v && d.baseId === v.id ? { text: d.text, accent: d.accent ?? v.accent } : { text: v?.text || "", accent: v?.accent }; };

/* ════════════════════════════════════════════════════════════════════════
   3. ENVIRONNEMENT & PERSISTANCE
   Deux environnements, détectés au chargement :
   - « chat » : artefact dans une conversation claude.ai → window.storage + API Claude (web_search, MCP) ;
   - « publié » : page Artifact publiée → capacités claude.use() : db (données privées par personne),
     sample (Claude sur le compte du lecteur), mcp (connecteurs Gmail / Google Calendar), downloads.
   ════════════════════════════════════════════════════════════════════════ */

const RT = { mode: null, db: null, uid: null, sample: null, mcp: null, downloads: null };
const MCP_SERVER_NAME = { gmail: "Gmail", gcal: "Google Calendar" };

async function initRuntime() {
  if (RT.mode) return RT;
  if (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function") {
    RT.mode = "chat";
    return RT;
  }
  if (typeof window !== "undefined" && window.claude?.use) {
    const use = (n) => window.claude.use(n).catch(() => null);
    const [db, user, sample, mcp, downloads] = await Promise.all([use("db"), use("user"), use("sample"), use("mcp"), use("downloads")]);
    Object.assign(RT, { db, sample, mcp, downloads });
    try { RT.uid = user ? await user.id() : null; } catch { RT.uid = null; }
    RT.mode = "published";
    return RT;
  }
  RT.mode = "none";
  return RT;
}

/* ── Données publiées, sous data/users/<id>/ (privé) ─────────────────────
   Le format v1 découpait chaque collection en tranches de 180 000 caractères réécrites sur place : une
   écriture interrompue laissait une tranche neuve à côté de tranches anciennes, et la lecture échouait
   (« Expected ',' or ']' … position 180000 »). Désormais :
   - les offres sont stockées UNE PAR DOCUMENT (seules les offres modifiées sont réécrites) ;
   - les autres collections sont écrites en tranches d'une nouvelle « génération », puis le document
     __meta bascule sur elle (avec somme de contrôle), puis l'ancienne génération est supprimée :
     une écriture interrompue laisse l'ancienne version intacte ;
   - une collection illisible est réparée (récupération élément par élément) au lieu de tout bloquer. */
const DB_CHUNK = 100000;
const dbQueues = {};
const dbDoc = (name) => RT.db.doc(`data/users/${RT.uid}/${name}`);
const dbName = (key) => key.replace(/[^a-z0-9]/gi, "_");
function checksum(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${s.length.toString(36)}-${(h >>> 0).toString(36)}`;
}
const dbRetry = async (fn) => {
  try { return await fn(); }
  catch (e) {
    if (e?.code !== "unavailable" && e?.code !== "resource_exhausted") throw e;
    await sleep(600 + Math.random() * 900);
    return fn();
  }
};
class StoreCorrupt extends Error {
  constructor(key, raw, cause) { super(`données illisibles (${cause})`); this.key = key; this.raw = raw; }
}

/* Récupère les objets complets d'un tableau JSON endommagé (ceux qui chevauchent la zone abîmée sont perdus). */
function scanObjectEnd(s, i) {
  let depth = 0, inStr = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (inStr) { if (c === "\\") j++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return j + 1;
  }
  return -1;
}
function salvageArray(raw, isItem) {
  const out = [], seen = new Set();
  const re = /\{"id":"/g;
  let m;
  while ((m = re.exec(raw || ""))) {
    const end = scanObjectEnd(raw, m.index);
    if (end < 0) continue;
    let o;
    try { o = JSON.parse(raw.slice(m.index, end)); } catch { continue; }
    if (!o || typeof o.id !== "string" || !isItem(o)) continue;
    if (!seen.has(o.id)) { seen.add(o.id); out.push(o); }
    re.lastIndex = end;
  }
  return out;
}
const SALVAGE = {
  offers: (o) => typeof o.title === "string" && Array.isArray(o.sources),
  apps: (o) => typeof o.offerId === "string" && typeof o.stage === "string",
  contacts: (o) => typeof o.name === "string",
};

const dbStore = {
  async readRaw(key) {
    const k = dbName(key);
    const meta = await dbRetry(() => dbDoc(`${k}__meta`).get());
    if (!meta.exists) return null;
    const m = meta.data() || {};
    const n = Number(m.n) || 0;
    const name = (i) => (m.gen ? `${k}__${m.gen}_${i}` : `${k}__${i}`);
    const parts = await Promise.all(Array.from({ length: n }, (_, i) => dbRetry(() => dbDoc(name(i)).get())));
    return { raw: parts.map((x) => String(x.data()?.c ?? "")).join(""), meta: m };
  },
  async get(key) {
    const r = await this.readRaw(key);
    if (!r) return null;
    if (r.meta.sum && checksum(r.raw) !== r.meta.sum) throw new StoreCorrupt(key, r.raw, "somme de contrôle");
    try { return JSON.parse(r.raw); } catch (e) { throw new StoreCorrupt(key, r.raw, e.message); }
  },
  set(key, value) {
    const k = dbName(key);
    const run = async () => {
      const str = typeof value === "string" ? value : JSON.stringify(value);
      const chunks = [];
      for (let i = 0; i < str.length; i += DB_CHUNK) chunks.push(str.slice(i, i + DB_CHUNK));
      if (!chunks.length) chunks.push("");
      const prev = await dbRetry(() => dbDoc(`${k}__meta`).get());
      const pm = prev.exists ? prev.data() || {} : null;
      const gen = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      for (let i = 0; i < chunks.length; i++) await dbRetry(() => dbDoc(`${k}__${gen}_${i}`).set({ c: chunks[i] }));
      await dbRetry(() => dbDoc(`${k}__meta`).set({ n: chunks.length, gen, sum: checksum(str), at: nowISO(), v: 2 }));
      if (pm) {
        const old = (i) => (pm.gen ? `${k}__${pm.gen}_${i}` : `${k}__${i}`);
        for (let i = 0; i < (Number(pm.n) || 0); i++) await dbDoc(old(i)).delete().catch(() => {});
      }
    };
    dbQueues[k] = (dbQueues[k] || Promise.resolve()).catch(() => {}).then(run);
    return dbQueues[k];
  },
  async remove(key) {
    const k = dbName(key);
    const meta = await dbDoc(`${k}__meta`).get().catch(() => null);
    const m = meta?.exists ? meta.data() || {} : {};
    for (let i = 0; i < (Number(m.n) || 0); i++) await dbDoc(m.gen ? `${k}__${m.gen}_${i}` : `${k}__${i}`).delete().catch(() => {});
    await dbDoc(`${k}__meta`).delete().catch(() => {});
  },
};

/* Offres : un document par offre sous data/users/<id>/radar_offers_v2/items/<offerId>.
   Synchronisation par différence : seules les offres dont l'objet a changé sont réécrites. */
const offerStore = {
  saved: new Map(),
  queue: Promise.resolve(),
  root: () => RT.db.doc(`data/users/${RT.uid}/radar_offers_v2`),
  col() { return this.root().collection("items"); },
  async load() {
    const meta = await dbRetry(() => this.root().get());
    if (!meta.exists) return null;
    const out = [];
    let last = null;
    for (let page = 0; page < 30; page++) {
      let q = this.col().orderBy("id").limit(1000);
      if (last) q = q.where("id", ">", last);
      const snap = await dbRetry(() => q.get());
      snap.docs.forEach((d) => { const o = d.data(); if (o && o.id) out.push(o); });
      if (snap.size < 1000) break;
      last = snap.docs[snap.docs.length - 1].data().id;
    }
    this.saved = new Map(out.map((o) => [o.id, o]));
    return out;
  },
  /* Première écriture (migration ou import) : tout est écrit, puis le marqueur racine. */
  async writeAll(list, info = {}) {
    this.saved = new Map();
    await this.sync(list);
    await dbRetry(() => this.root().set({ v: 2, count: list.length, at: nowISO(), ...info }));
  },
  sync(list) {
    const run = async () => {
      const cur = new Map(list.map((o) => [o.id, o]));
      const changed = list.filter((o) => this.saved.get(o.id) !== o);
      const removed = [...this.saved.keys()].filter((id) => !cur.has(id));
      if (!changed.length && !removed.length) return;
      const ops = [
        ...changed.map((o) => async () => { await dbRetry(() => this.col().doc(o.id).set(JSON.parse(JSON.stringify(o)))); this.saved.set(o.id, o); }),
        ...removed.map((id) => async () => { await dbRetry(() => this.col().doc(id).delete()); this.saved.delete(id); }),
      ];
      let firstErr = null;
      await pool(ops, 3, async (op) => { try { await op(); } catch (e) { firstErr = firstErr || e; } });
      if (firstErr) throw firstErr;
      if (this.pendingMigration) { await dbRetry(() => this.root().set({ v: 2, count: list.length, at: nowISO(), migratedFrom: "v1" })); this.pendingMigration = false; }
    };
    this.queue = this.queue.catch(() => {}).then(run);
    return this.queue;
  },
  async clear() {
    for (const id of [...this.saved.keys()]) await this.col().doc(id).delete().catch(() => {});
    this.saved = new Map();
    await this.root().delete().catch(() => {});
  },
};

const storage = {
  available() {
    if (RT.mode === "published") return !!(RT.db && RT.uid);
    return typeof window !== "undefined" && !!window.storage && typeof window.storage.get === "function";
  },
  async list(prefix) {
    if (RT.mode === "published") throw new Error("list indisponible");
    const r = await window.storage.list(prefix);
    const keys = Array.isArray(r) ? r : r?.keys || [];
    return keys.map((k) => (typeof k === "string" ? k : k?.key)).filter(Boolean);
  },
  async get(key) {
    if (RT.mode === "published") return dbStore.get(key);
    const r = await window.storage.get(key);
    if (r === null || r === undefined) return null;
    const raw = typeof r === "string" ? r : r.value;
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== "string") return raw;
    try { return JSON.parse(raw); } catch (e) { throw new StoreCorrupt(key, raw, e.message); }
  },
  async set(key, value) {
    if (RT.mode === "published") {
      if (key === KEYS.offers) return offerStore.sync(value);
      return dbStore.set(key, value);
    }
    await window.storage.set(key, JSON.stringify(value));
  },
  async remove(key) {
    if (RT.mode === "published") {
      if (key === KEYS.offers) { await offerStore.clear(); return dbStore.remove(key); }
      return dbStore.remove(key);
    }
    try { await window.storage.delete(key); } catch { /* clé absente */ }
  },
};

/* ════════════════════════════════════════════════════════════════════════
   4. COUCHE IA — API Claude (web_search, MCP Gmail / Google Calendar)
   ════════════════════════════════════════════════════════════════════════ */

let WORKING_VARIANT = null; // mémorise la combinaison modèle / outil web / format MCP acceptée

function collectBlocks(content, acc) {
  for (const b of content || []) {
    if (b.type === "text") {
      acc.text.push(b.text || "");
      (b.citations || []).forEach((c) => c.url && acc.urls.add(c.url));
    } else if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      b.content.forEach((r) => r.url && acc.urls.add(r.url));
    } else if (b.type === "mcp_tool_result") {
      const c = b.content;
      acc.toolText.push(typeof c === "string" ? c : Array.isArray(c) ? c.map((x) => x.text || "").join("\n") : JSON.stringify(c || ""));
      if (b.is_error) acc.toolErrors.push(acc.toolText[acc.toolText.length - 1].slice(0, 300));
    } else if (b.type === "mcp_tool_use") {
      acc.toolCalls.push(b.name);
    }
  }
}

async function runConversation(settings, v, o) {
  const model = o.models[Math.min(v.m, o.models.length - 1)];
  const mode = o.mcpModes[Math.min(v.p, o.mcpModes.length - 1)];
  const tools = [];
  if (o.web) {
    const t = { type: o.webTypes[Math.min(v.w, o.webTypes.length - 1)], name: "web_search", max_uses: o.web.maxUses || 5 };
    if (o.web.domains?.length) t.allowed_domains = o.web.domains;
    tools.push(t);
  }
  const servers = (o.mcp || []).map((m) => {
    const s = { type: "url", url: settings.mcp[m.server], name: m.server };
    if (mode === "legacy" && settings.restrictTools && m.allow?.length) s.tool_configuration = { enabled: true, allowed_tools: m.allow };
    return s;
  });
  if (mode === "toolset") {
    (o.mcp || []).forEach((m) => {
      const t = { type: "mcp_toolset", mcp_server_name: m.server };
      if (settings.restrictTools && m.allow?.length) {
        t.default_config = { enabled: false };
        t.configs = Object.fromEntries(m.allow.map((n) => [n, { enabled: true }]));
      }
      tools.push(t);
    });
  }
  const headers = { "Content-Type": "application/json" };
  if (servers.length && mode === "toolset") headers["anthropic-beta"] = "mcp-client-2025-11-20";

  const messages = [{ role: "user", content: o.prompt }];
  const acc = { text: [], urls: new Set(), toolText: [], toolCalls: [], toolErrors: [] };
  for (let turn = 0; turn < 5; turn++) {
    const body = { model, max_tokens: o.maxTokens, system: o.system, messages };
    if (tools.length) body.tools = tools;
    if (servers.length) body.mcp_servers = servers;
    let r;
    try {
      r = await fetch(API_URL, { method: "POST", headers, body: JSON.stringify(body) });
    } catch (e) {
      const err = new Error(`API Claude injoignable depuis l'artefact (${e.message}).`);
      err.status = 0;
      throw err;
    }
    let data = null;
    try { data = await r.json(); } catch { /* corps vide */ }
    if (!r.ok) {
      const err = new Error(data?.error?.message || `Erreur API ${r.status}`);
      err.status = r.status;
      throw err;
    }
    collectBlocks(data.content, acc);
    if (data.stop_reason === "refusal") throw new Error("Le modèle a décliné cette requête. Reformulez ou réessayez.");
    if (data.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: data.content });
      continue;
    }
    const lastText = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return {
      text: acc.text.join("\n").trim(),
      lastText: lastText.trim(),
      urls: [...acc.urls],
      toolText: acc.toolText.join("\n"),
      toolCalls: acc.toolCalls,
      toolErrors: acc.toolErrors,
      stop: data.stop_reason,
      model,
    };
  }
  throw new Error("La recherche n'a pas abouti (trop d'étapes). Réessayez avec moins de sources.");
}

/* Outils de connecteurs exposés à Claude dans la version publiée (lecture Gmail uniquement). */
const PUB_TOOLS = {
  gmail: {
    search_threads: {
      description: "Recherche des fils Gmail (syntaxe Gmail : from:, after:YYYY/MM/DD, OR…). Renvoie id, objet, expéditeur, date et extrait des messages. Lecture seule.",
      schema: { type: "object", properties: { query: { type: "string", description: "Requête Gmail" }, pageSize: { type: "integer", description: "1 à 50" } }, required: ["query"] },
      input: (i) => ({ query: String(i.query || ""), pageSize: clamp(Number(i.pageSize) || 20, 1, 50) }),
    },
    get_thread: {
      description: "Lit un fil Gmail complet en texte brut à partir de son identifiant (threadId obtenu par search_threads). Lecture seule.",
      schema: { type: "object", properties: { threadId: { type: "string" } }, required: ["threadId"] },
      input: (i) => ({ threadId: String(i.threadId || ""), messageFormat: "PLAIN_TEXT" }),
    },
  },
};

const SAMPLE_ERRORS = {
  not_granted: "Accès à Claude refusé pour cette page. Rechargez la page pour l'autoriser.",
  rate_limited: "Trop de demandes simultanées. Patientez un instant puis relancez.",
  session_expired: "Session claude.ai expirée : reconnectez-vous puis rechargez la page.",
  sampling_disabled: "L'appel à Claude est désactivé pour votre compte ou votre organisation.",
  prompt_too_large: "Demande trop volumineuse : réduisez le nombre d'offres ou le texte collé.",
  tools_unavailable: "Cette vue ne permet pas à Claude d'utiliser les connecteurs. Ouvrez la page dans claude.ai.",
  cancelled: "Demande annulée.",
};

async function callSample(settings, { system, prompt, web, mcp = [] }) {
  if (!RT.sample) throw new Error("Claude n'est pas disponible dans cette vue : ouvrez la page connecté à claude.ai.");
  const acc = { toolText: [], toolCalls: [], toolErrors: [] };
  const tools = [];
  for (const m of mcp) {
    const defs = PUB_TOOLS[m.server] || {};
    for (const name of m.allow || []) {
      const def = defs[name];
      if (!def) continue;
      tools.push({
        name: `${m.server}_${name}`,
        description: def.description,
        inputSchema: def.schema,
        execute: async (input) => {
          if (!RT.mcp) throw new Error("Connecteur indisponible dans cette vue");
          acc.toolCalls.push(name);
          try {
            const r = await RT.mcp.callTool(MCP_SERVER_NAME[m.server], name, def.input(input || {}));
            const txt = typeof r.payload === "string" ? r.payload : JSON.stringify(r.payload ?? r.content ?? "");
            acc.toolText.push(txt);
            return txt.slice(0, 30000);
          } catch (e) {
            const msg = e?.message || e?.code || "échec du connecteur";
            acc.toolErrors.push(msg);
            throw new Error(msg);
          }
        },
      });
    }
  }
  if (mcp.length && !tools.length) throw new Error("Cette action n'est pas disponible via les connecteurs de la version publiée.");
  const note = web
    ? "\n\nIMPORTANT : aucune recherche web n'est disponible ici. N'utilise que les informations fournies ; n'invente aucune URL, aucun fait externe ni aucune source. Laisse vides les listes qui exigeraient une recherche."
    : "";
  try {
    let r;
    for (let attempt = 0; ; attempt++) {
      try { r = await RT.sample(`${system}\n\n${prompt}${note}`, tools.length ? { tools } : {}); break; }
      catch (e) { if (e?.code === "rate_limited" && attempt < 2) { await sleep(4000 * (attempt + 1)); continue; } throw e; }
    }
    const text = (r.text || "").trim();
    return { text, lastText: text, urls: [], toolText: acc.toolText.join("\n"), toolCalls: acc.toolCalls, toolErrors: acc.toolErrors, stop: r.truncated ? "max_tokens" : "end_turn", model: `claude.ai (${r.modelTierApplied || "default"})` };
  } catch (e) {
    throw new Error(SAMPLE_ERRORS[e?.code] || e?.message || "Échec de l'appel à Claude.");
  }
}

async function callClaude(settings, opts) {
  if (RT.mode === "published") return callSample(settings, opts);
  return callClaudeApi(settings, opts);
}

async function callClaudeApi(settings, { system, prompt, web = null, mcp = [], maxTokens = 12000 }) {
  const o = {
    system, prompt, web, mcp, maxTokens,
    models: [...new Set([settings.model, settings.fallbackModel].filter(Boolean))],
    webTypes: ["web_search_20260209", "web_search_20250305"],
    mcpModes: settings.mcpMode === "auto" ? ["legacy", "toolset"] : [settings.mcpMode],
  };
  let v = WORKING_VARIANT ? { ...WORKING_VARIANT } : { m: 0, w: 0, p: 0 };
  let lastErr;
  for (let attempt = 0; attempt < 7; attempt++) {
    try {
      const res = await runConversation(settings, v, o);
      WORKING_VARIANT = v;
      return res;
    } catch (e) {
      lastErr = e;
      const msg = (e.message || "").toLowerCase();
      if (e.status === 400 || e.status === 404) {
        if (web && /web_search|20260209|tool.*type|tools\.\d/.test(msg) && v.w < o.webTypes.length - 1) { v = { ...v, w: v.w + 1 }; continue; }
        if (mcp.length && /mcp|toolset|beta|tool_configuration/.test(msg) && v.p < o.mcpModes.length - 1) { v = { ...v, p: v.p + 1 }; continue; }
        if (/model/.test(msg) && v.m < o.models.length - 1) { v = { ...v, m: v.m + 1 }; continue; }
        throw e;
      }
      if ([429, 500, 502, 503, 529].includes(e.status) && attempt < 3) { await sleep(2500 * (attempt + 1)); continue; }
      throw e;
    }
  }
  throw lastErr;
}

function extractJSON(text) {
  if (!text) throw new Error("Réponse vide de l'IA.");
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]).reverse();
  for (const c of [...fences, text]) {
    const s = c.trim();
    try { return JSON.parse(s); } catch { /* suite */ }
    const i = s.indexOf("{"), j = s.lastIndexOf("}");
    if (i >= 0 && j > i) { try { return JSON.parse(s.slice(i, j + 1)); } catch { /* suite */ } }
    // dernier objet JSON complet du texte (utile après un pause_turn)
    const k = s.lastIndexOf("\n{");
    if (k >= 0 && j > k) { try { return JSON.parse(s.slice(k + 1, j + 1)); } catch { /* suite */ } }
  }
  throw new Error("Réponse IA non conforme au format JSON attendu.");
}

async function askJSON(settings, opts) {
  const res = await callClaude(settings, opts);
  try {
    return { ...res, data: extractJSON(res.lastText || res.text) };
  } catch {
    try {
      return { ...res, data: extractJSON(res.text) };
    } catch {
      const fix = await callClaude(settings, {
        system: SYSTEM_REPAIR,
        prompt: `Texte à convertir :\n<<<\n${res.text.slice(0, 40000)}\n>>>`,
        maxTokens: opts.maxTokens || 8000,
      });
      return { ...res, data: extractJSON(fix.text) };
    }
  }
}

/* ════════════════════════════════════════════════════════════════════════
   5. PROMPTS INTERNES
   ════════════════════════════════════════════════════════════════════════ */

const SYSTEM_BASE = `Tu es le moteur d'analyse d'une plateforme personnelle de veille emploi, au service d'un candidat en poste qui garde la validation finale.
Règles absolues :
- Ne jamais inventer d'offre, d'entreprise, de salaire, de contact, de chiffre ou d'URL. Une information absente de la source vaut null.
- Rester factuel, sobre, en français (sauf documents rédigés dans la langue de l'annonce).
- Répondre UNIQUEMENT avec un objet JSON valide conforme au schéma demandé : aucun texte avant ou après, aucune balise markdown.`;

const SYSTEM_TOOLS = `Tu exécutes une action précise pour l'utilisateur via les outils MCP fournis, exactement comme décrite, sans initiative supplémentaire.
Tu n'envoies JAMAIS d'e-mail, tu ne supprimes, n'archives et ne modifies aucun message ou événement existant.
Réponds UNIQUEMENT avec le JSON demandé, sans texte autour.`;

const SYSTEM_REPAIR = `Convertis le texte fourni en un JSON strictement valide, en conservant exactement les informations présentes, sans rien ajouter ni inventer. Réponds uniquement avec le JSON.`;

const todayStr = () => new Date().toISOString().slice(0, 10);

function criteriaDigest(c) {
  return [
    `Postes visés : ${c.roles.join(" ; ")}`,
    `Zones : ${c.zones.join(", ")} — trajet max ${c.maxCommute} min depuis Ohain (Brabant wallon)`,
    `Télétravail : ${c.remote}`,
    `Indispensables : ${c.mustHave.join(" ; ") || "aucun"}`,
    `Souhaités (poids 1-5) : ${c.wishes.map((w) => `${w.label} [${w.weight}]`).join(" ; ") || "aucun"}`,
    `Exclusions : ${c.exclusions.join(" ; ") || "aucune"}`,
    `Signaux d'alerte : ${c.redFlags.join(" ; ") || "aucun"}`,
    `Mots-clés FR : ${c.keywords.fr.join(", ")}`,
    `Mots-clés NL : ${c.keywords.nl.join(", ")}`,
    `Mots-clés EN : ${c.keywords.en.join(", ")}`,
  ].join("\n");
}

function profileDigest(p, full = false) {
  return [
    `Poste actuel : ${p.headline}`,
    `Domicile : ${p.home}`,
    `Résumé : ${p.summary}`,
    `Compétences : ${p.skills.join(", ")}`,
    `Expériences clés :\n${p.experiences.map((e) => `- ${e.role} — ${e.org} (${e.period}) : ${e.highlights}`).join("\n")}`,
    `Réalisations chiffrées :\n${p.achievements.map((a) => `- ${a}`).join("\n") || "(aucune renseignée)"}`,
    `Langues : ${p.languages.map((l) => `${l.lang} (${l.level})`).join(", ")}`,
    full && p.cvText ? `CV complet (texte) :\n${p.cvText.slice(0, 15000)}` : "",
  ].filter(Boolean).join("\n");
}

const OFFER_SCHEMA = `{"title":"","company":null,"location":null,"contract":null,"seniority":null,"salary":null,"remote":null,"language":"fr|nl|en","publishedAt":"YYYY-MM-DD ou null","deadline":"YYYY-MM-DD ou null (date limite de candidature)","url":"","description":"","commuteMinutes":null}`;

/* ── Rédaction des documents : réglages, contexte, analyse de l'annonce ── */
const SYSTEM_WRITER = `Tu es un rédacteur senior de CV et de lettres de motivation (niveau cabinet de recrutement de cadres), spécialiste du marché belge en français, néerlandais et anglais.
Tu écris pour deux lecteurs successifs : un logiciel de tri (ATS) qui cherche des termes exacts, puis un recruteur qui décide en 30 secondes.
Règles absolues :
- Vérité : uniquement des faits présents dans le profil fourni. Aucun chiffre, diplôme, outil, employeur, période ou résultat inventé. Une information utile mais absente s'écrit [à compléter : …].
- Le candidat n'occupe pas le poste visé : son poste actuel se décrit au présent, ses postes passés au passé, le poste visé uniquement comme un objectif.
- Répondre UNIQUEMENT avec un objet JSON valide conforme au schéma demandé, sans texte autour ni balise markdown.`;
const DOC_TONES = { sobre: "sobre et factuel", direct: "direct et assertif, phrases très courtes", chaleureux: "chaleureux et engagé, sans emphase" };
const DEFAULT_DOC_PREFS = { language: "auto", tone: "sobre", voice: "nominal", cvLength: "2" };
const docLang = (offer, prefs, a) => (prefs?.language && prefs.language !== "auto" ? prefs.language : a?.language || offer?.language || "fr");
const profileContact = (p) => [String(p.home || "").split("(")[0].trim(), p.email, p.phone, p.linkedinUrl].filter(Boolean).join(" | ") || "[à compléter : coordonnées]";
const profileBlock = (p) => [
  profileDigest(p, true),
  `Formation : ${(p.education || []).join(" ; ") || "non renseignée"}`,
  `Certifications : ${(p.certifications || []).join(" ; ") || "aucune"}`,
].join("\n");
/* ── Motivations (profil) : le « pourquoi », source de la lettre, des messages et de la préparation d'entretien. Jamais du CV. ──
   Champ facultatif profile.motivation ; absent = vide. */
const MOTIV_TEXT_FIELDS = [
  { id: "purpose", label: "Raison d'être professionnelle", hint: "Ce qui vous fait avancer dans votre travail, avec vos mots." },
  { id: "whyNow", label: "Pourquoi changer maintenant", hint: "Le déclencheur réel, formulé positivement." },
  { id: "lookingFor", label: "Ce que vous cherchez", hint: "Rôle, périmètre, culture, type de direction." },
  { id: "method", label: "Votre méthode", hint: "Comment vous menez une transformation, du cadrage à l'adoption." },
  { id: "management", label: "Votre management", hint: "Comment vous dirigez une équipe, avec un exemple." },
];
const emptyMotivation = () => ({ purpose: "", convictions: [], stories: [], management: "", method: "", whyNow: "", lookingFor: "", sectors: [] });
function motivOf(p) {
  const m = p?.motivation && typeof p.motivation === "object" ? p.motivation : {};
  const arr = (x) => (Array.isArray(x) ? x : []);
  return {
    ...emptyMotivation(),
    ...Object.fromEntries(MOTIV_TEXT_FIELDS.map((f) => [f.id, String(m[f.id] || "")])),
    convictions: arr(m.convictions).map((c, i) => ({ id: c?.id || `c${i + 1}`, text: String(c?.text ?? c ?? "") })).filter((c) => c.text.trim()),
    stories: arr(m.stories).map((s, i) => ({ id: s?.id || `s${i + 1}`, title: String(s?.title || ""), situation: String(s?.situation || ""), action: String(s?.action || ""), result: String(s?.result || ""), lesson: String(s?.lesson || "") })).filter((s) => s.title.trim() || s.situation.trim() || s.action.trim()),
    sectors: arr(m.sectors).map(String).filter((x) => x.trim()),
  };
}
const motivFilled = (m) => MOTIV_TEXT_FIELDS.filter((f) => m[f.id].trim()).length + (m.convictions.length ? 1 : 0) + (m.stories.length ? 1 : 0) + (m.sectors.length ? 1 : 0);
const storyText = (s) => [s.title && `« ${s.title} »`, s.situation && `situation : ${s.situation}`, s.action && `action : ${s.action}`, s.result && `résultat : ${s.result}`, s.lesson && `leçon : ${s.lesson}`].filter(Boolean).join(" · ");
/* Bloc « pourquoi » injecté dans la lettre, les messages et la préparation d'entretien (jamais dans le CV). */
function motivationBlock(p) {
  const m = motivOf(p);
  if (!motivFilled(m)) return "MOTIVATIONS DU CANDIDAT : non renseignées. Toute phrase de motivation personnelle s'écrit [à compléter : …].";
  return [
    "MOTIVATIONS DU CANDIDAT (ses propres mots, seule source autorisée pour le « pourquoi » ; reformule sans rien ajouter)",
    m.purpose && `Raison d'être : ${m.purpose}`,
    m.whyNow && `Pourquoi maintenant : ${m.whyNow}`,
    m.lookingFor && `Ce qu'il cherche : ${m.lookingFor}`,
    m.method && `Méthode : ${m.method}`,
    m.management && `Management : ${m.management}`,
    m.sectors.length && `Secteurs qui l'attirent : ${m.sectors.join(" ; ")}`,
    m.convictions.length && `Convictions :\n${m.convictions.map((c) => `- [${c.id}] ${c.text}`).join("\n")}`,
    m.stories.length && `Banque d'histoires (à raconter, pas à lister) :\n${m.stories.map((s) => `- [${s.id}] ${storyText(s)}`).join("\n")}`,
  ].filter(Boolean).join("\n");
}

/* Entretien de motivation : 10 questions ; l'IA reformule les réponses, sans rien ajouter. */
const MOTIV_QUESTIONS = [
  { id: "q1", field: "purpose", q: "Qu'est-ce qui vous fait avancer dans votre travail ? Un moment où vous vous êtes dit « c'est pour ça que je fais ce métier »." },
  { id: "q2", field: "convictions", q: "Quelles convictions défendez-vous sur la transformation digitale, et qu'est-ce qui les a forgées ?" },
  { id: "q3", field: "stories", q: "Racontez le projet dont vous êtes le plus fier : contexte, ce que VOUS avez fait, résultat." },
  { id: "q4", field: "stories", q: "Racontez une résistance au changement ou un échec, et ce que vous en avez appris." },
  { id: "q5", field: "management", q: "Comment dirigez-vous une équipe ? Donnez un exemple concret." },
  { id: "q6", field: "method", q: "Quelle est votre méthode pour mener une transformation, du cadrage à l'adoption par les utilisateurs ?" },
  { id: "q7", field: "whyNow", q: "Pourquoi chercher un nouveau poste maintenant ?" },
  { id: "q8", field: "lookingFor", q: "Que cherchez-vous dans votre prochain poste : rôle, périmètre, culture, type de direction ?" },
  { id: "q9", field: "sectors", q: "Quels secteurs ou types d'organisations vous attirent, et pourquoi ?" },
  { id: "q10", field: "stories", q: "Que diraient de vous votre direction ou vos collègues ? Appuyez-vous sur une situation réelle." },
];

/* ── Règles d'écriture (6a) : prioritaires sur les consignes de style, jamais sur la vérité. Champ facultatif profile.writingRules. ── */
const SEED_RULES = [
  "Positionnement : généraliste de la transformation digitale, pont entre le métier et la technique. Jamais « responsable CRM », ni un rôle réduit au seul CRM.",
  "Trilinguisme FR / NL / EN cité dans le Profil du CV.",
  "Master mentionné discrètement : section Formation uniquement, sans mise en avant.",
  "Preuves prioritaires, quand le profil les contient : plus de 20 projets ; 120 utilisateurs et 80 000 contacts ; 1,5 ETP ; −40 % ; comité IA ; rôle de conseil auprès du COO et du CEO.",
  "Ton humble : les faits parlent, aucune autopromotion.",
].map((text, i) => ({ id: `r${i + 1}`, text, active: true, origin: "départ" }));
const writingRulesOf = (p) => (Array.isArray(p?.writingRules) ? p.writingRules : SEED_RULES);
function rulesBlock(p) {
  const act = writingRulesOf(p).filter((r) => r.active && String(r.text || "").trim());
  const locked = Array.isArray(p?.lockedBullets) ? p.lockedBullets.filter((x) => String(x || "").trim()) : [];
  const parts = [];
  if (act.length) parts.push(`RÈGLES D'ÉCRITURE DU CANDIDAT (prioritaires sur toutes les consignes de style et de ton ci-dessus ; jamais sur la vérité : un fait absent du profil reste [à compléter : …])\n${act.map((r) => `- ${r.text}`).join("\n")}`);
  if (locked.length) parts.push(`PUCES VERROUILLÉES (si tu en utilises une, recopie-la mot pour mot ; ne propose jamais de la modifier)\n${locked.map((b) => `- ${b}`).join("\n")}`);
  return parts.join("\n\n");
}
/* Insère les règles juste avant la consigne de format JSON finale. */
function withRules(prompt, p) {
  const block = rulesBlock(p);
  if (!block) return prompt;
  const i = prompt.lastIndexOf("Réponds uniquement");
  return i < 0 ? `${prompt}\n\n${block}` : `${prompt.slice(0, i)}${block}\n\n${prompt.slice(i)}`;
}
/* ── Fiches entreprise (companyBriefs) : faits sourcés, valables 60 jours. Un fait sans URL vérifiée est exclu. ── */
const BRIEF_TTL_DAYS = 60;
const briefKey = (company) => companyKey(company || "").replace(/\s+/g, "-").slice(0, 120);
const briefFresh = (b) => !!b && !!b.expiresAt && new Date(b.expiresAt).getTime() > Date.now();
const isHttp = (u) => /^https?:\/\/[^\s/]+\.[^\s]+/i.test(String(u || "").trim());
/* verifiedUrls : URL réellement vues dans les résultats de recherche (null = URL fournie par l'utilisateur ou vérifiée par la Routine). */
function makeBrief({ company, summary, facts, origin, verifiedUrls = null, createdAt }) {
  const seen = (u) => verifiedUrls === null || verifiedUrls.some((x) => canonicalUrl(x) === canonicalUrl(u));
  const list = (Array.isArray(facts) ? facts : []).map((f) => ({ text: str(f?.text), url: str(f?.url || f?.sourceUrl) }))
    .filter((f) => f.text && isHttp(f.url) && seen(f.url))
    .slice(0, 12)
    .map((f, i) => ({ id: `B${i + 1}`, text: f.text, url: f.url, verified: true, source: origin }));
  const at = createdAt && !isNaN(new Date(createdAt)) ? new Date(createdAt) : new Date();
  return { company: str(company) || "", summary: str(summary), facts: list, origin, createdAt: at.toISOString(), expiresAt: new Date(at.getTime() + BRIEF_TTL_DAYS * 864e5).toISOString() };
}
function mergeBriefs(a, b) {
  if (!a || !briefFresh(a)) return b;
  const seen = new Set(a.facts.map((f) => normText(f.text)));
  const facts = [...a.facts, ...b.facts.filter((f) => !seen.has(normText(f.text)))].slice(0, 16).map((f, i) => ({ ...f, id: `B${i + 1}` }));
  return { ...b, summary: b.summary || a.summary, facts, origin: a.origin === b.origin ? b.origin : `${a.origin}+${b.origin}` };
}

/* ── Pourquoi cette candidature (app.motivation, facultatif) ── */
const appMotivOf = (app) => ({ factIds: [], whyCompany: "", whyRole: "", personalLink: "", convictionId: null, storyId: null, employerNamed: true, ...(app?.motivation && typeof app.motivation === "object" ? app.motivation : {}) });
/* Faits disponibles : annonce (avec son URL) + fiche entreprise à jour. Les faits sans URL sont exclus. */
function companyFactsFor(app, offer, briefs) {
  const out = [];
  const adUrl = (offer?.sources || []).find((x) => isHttp(x.url))?.url;
  if (!offer?.spontaneous && adUrl) (app?.analysis?.companyFacts || []).filter(Boolean).forEach((t, i) => out.push({ id: `A${i + 1}`, text: t, url: adUrl, source: "annonce" }));
  const b = offer?.company ? briefs?.[briefKey(offer.company)] : null;
  if (briefFresh(b)) b.facts.forEach((f) => out.push({ ...f }));
  return out;
}
function selectedFacts(app, offer, briefs) {
  const all = companyFactsFor(app, offer, briefs);
  const ids = appMotivOf(app).factIds;
  const sel = ids.length ? all.filter((f) => ids.includes(f.id)) : all;
  return sel.length ? sel : all;
}
const genericOrg = (o) => !o || /^(une?|the|a|een)\s/i.test(o) || normText(o) === normText("Fédération patronale belge");
function employerRule(app, profile) {
  const org = profile?.experiences?.[0]?.org || "";
  return appMotivOf(app).employerNamed
    ? `Employeur actuel : nommé par son libellé exact (« ${org || "voir profil"} ») dans le CV ET dans la lettre.`
    : "Employeur actuel : JAMAIS nommé, ni dans le CV ni dans la lettre ni dans les messages. Désigne-le de façon générique (« une fédération patronale belge »), y compris dans les lignes « ### Fonction | Organisation… ».";
}
/* Bloc « pourquoi cette candidature » : vide → [à compléter] (bloquant au contrôle). */
function appMotivationBlock(app, offer, profile, facts) {
  const m = appMotivOf(app);
  const bank = motivOf(profile);
  const conv = bank.convictions.find((c) => c.id === m.convictionId);
  const story = bank.stories.find((s) => s.id === m.storyId);
  const company = offer?.spontaneous === "base" ? "l'entreprise" : show(offer?.company);
  return [
    "POURQUOI CETTE CANDIDATURE (choix du candidat pour cette cible)",
    `Faits retenus sur ${company} : ${facts.length ? facts.map((f) => f.id).join(", ") : "aucun → [à compléter : un fait vérifiable sur l'entreprise, avec sa source]"}`,
    `Pourquoi ${company} : ${m.whyCompany.trim() || (facts.length ? "non précisé : relie un fait retenu à une conviction" : "[à compléter : pourquoi cette entreprise]")}`,
    `Pourquoi ce rôle, maintenant : ${m.whyRole.trim() || (bank.whyNow ? `non précisé pour cette cible ; s'appuyer sur « ${bank.whyNow} »` : "[à compléter : pourquoi ce rôle maintenant]")}`,
    m.personalLink.trim() ? `Lien personnel avec l'entreprise : ${m.personalLink.trim()}` : "",
    conv ? `Conviction à mettre en avant : [${conv.id}] ${conv.text}` : "Conviction : au choix dans la banque (la plus liée aux faits retenus).",
    story ? `Histoire à raconter : [${story.id}] ${storyText(story)}` : "Histoire : au choix dans la banque (la plus proche des enjeux de l'entreprise).",
  ].filter(Boolean).join("\n");
}
const longDate = (lang) => new Date().toLocaleDateString({ fr: "fr-BE", nl: "nl-BE", en: "en-GB", de: "de-DE" }[lang] || "fr-BE", { day: "numeric", month: "long", year: "numeric" });
const adTextOf = (o) => String(o?.fullText || o?.description || "").trim();

/* Cible de rédaction : offre publiée, candidature spontanée (entreprise ciblée, sans offre) ou CV de base (ni offre ni entreprise). */
const SPONT_LABEL = { company: "Candidature spontanée", base: "CV de base" };
function targetInfo(offer, a) {
  const mode = offer?.spontaneous || "offer";
  return { mode, spont: mode !== "offer", base: mode === "base", role: a?.jobTitle || offer?.title || "le poste visé", company: offer?.company || null };
}
function targetBlock(offer, a) {
  const t = targetInfo(offer, a);
  if (!t.spont) return `OFFRE\nIntitulé : ${offer.title} · Entreprise : ${show(offer.company)} · Lieu : ${show(offer.location)}`;
  return [
    t.base ? "CV DE BASE : aucune offre et aucune entreprise ciblée (document réutilisable pour ce type de rôle)" : "CANDIDATURE SPONTANÉE : aucune offre n'a été publiée",
    `Rôle visé : ${offer.title}`,
    t.base ? "" : `Entreprise ciblée : ${show(offer.company)}`,
    offer.location ? `Lieu souhaité : ${offer.location}` : "",
    offer.contactName ? `Interlocuteur : ${offer.contactName}` : "",
    `Contexte fourni par le candidat (seule source d'information sur l'entreprise) : ${adTextOf(offer) || "aucun"}`,
  ].filter(Boolean).join("\n");
}
const targetLine = (offer, a) => {
  const t = targetInfo(offer, a);
  return t.base ? `CV de base pour un rôle de ${t.role} (aucune entreprise ciblée)` : t.spont ? `candidature spontanée chez ${show(t.company)} pour un rôle de ${t.role}` : `${t.role} chez ${show(offer.company)}`;
};
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function analysisDigest(a, offer) {
  if (!a) return `(analyse indisponible : appuie-toi sur l'annonce)\n${adTextOf(offer).slice(0, 6000)}`;
  const kw = (a.keywords || []).map((k) => `- « ${k.term} »${k.variants?.length ? ` (variantes : ${k.variants.join(", ")})` : ""} [${k.category}, importance ${k.importance}, ${k.status}]${k.evidence ? ` — preuve : ${k.evidence}` : ""}`).join("\n");
  return [
    `Intitulé exact du poste : ${a.jobTitle}${a.titleVariants?.length ? ` (équivalents : ${a.titleVariants.join(", ")})` : ""}`,
    a.angle ? `Ce que l'employeur cherche vraiment : ${a.angle}` : "",
    a.requirements?.length ? `Exigences clés :\n${a.requirements.map((r) => `- ${r.text} [importance ${r.importance}]${r.proof ? ` — preuve : ${r.proof}` : " — pas de preuve directe"}`).join("\n")}` : "",
    a.companyFacts?.length ? `Contexte de l'entreprise (tiré de l'annonce) :\n${a.companyFacts.map((f) => `- ${f}`).join("\n")}` : "",
    kw ? `Mots-clés ATS :\n${kw}` : "",
    a.positioning?.headline ? `Ligne de positionnement proposée : ${a.positioning.headline}` : "",
    a.positioning?.pitch ? `Proposition de valeur : ${a.positioning.pitch}` : "",
    a.gaps?.length ? `Écarts à traiter honnêtement :\n${a.gaps.map((g) => `- ${g.text}${g.approach ? ` → ${g.approach}` : ""}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

function normalizeAnalysis(d, offer) {
  d = d && typeof d === "object" ? d : {};
  const arr = (x) => (Array.isArray(x) ? x : []);
  const txt = (x) => (x && typeof x === "object" ? null : str(x));
  const seen = new Set();
  const keywords = arr(d.keywords).map((k) => {
    const term = txt(k?.term);
    const key = normText(term);
    if (!term || !key || seen.has(key)) return null;
    seen.add(key);
    const status = KW_STATUS.includes(k.status) ? k.status : txt(k.evidence) ? "prouvé" : "absent";
    return {
      term, category: KW_CATS[k.category] ? k.category : "competence",
      importance: clamp(Math.round(Number(k.importance) || 2), 1, 3),
      variants: arr(k.variants).map(txt).filter(Boolean).slice(0, 4),
      status, evidence: status === "absent" ? null : txt(k.evidence),
    };
  }).filter(Boolean).slice(0, 40);
  const pos = d.positioning && typeof d.positioning === "object" ? d.positioning : {};
  return {
    jobTitle: txt(d.jobTitle) || offer.title,
    titleVariants: arr(d.titleVariants).map(txt).filter(Boolean).slice(0, 4),
    language: /^(fr|nl|en)$/.test(d.language) ? d.language : offer.language || null,
    keywords,
    requirements: arr(d.requirements).map((r) => ({ text: txt(r?.text) || txt(r), importance: clamp(Math.round(Number(r?.importance) || 2), 1, 3), proof: txt(r?.proof) })).filter((r) => r.text).slice(0, 12),
    angle: txt(d.angle),
    companyFacts: arr(d.companyFacts).map(txt).filter(Boolean).slice(0, 6),
    positioning: { currentTitle: txt(pos.currentTitle), headline: txt(pos.headline), pitch: txt(pos.pitch) },
    gaps: arr(d.gaps).map((g) => ({ text: txt(g?.text) || txt(g), approach: txt(g?.approach) })).filter((g) => g.text).slice(0, 8),
  };
}

/* CV de référence pour la lettre : brouillon en cours, sinon dernière version enregistrée. */
const latestCvText = (app) => app?.drafts?.cv?.text || app?.docs?.cv?.slice(-1)[0]?.text || "";
const lintCtx = ({ offer, analysis, prefs, lang, settings, profile, pages, fallbackKeywords, cvText, app, briefs }) => ({
  cvText: cvText || "", motivation: motivOf(profile),
  companyFacts: app ? selectedFacts({ ...app, analysis: analysis || app.analysis }, offer, briefs).map((f) => f.text) : analysis?.companyFacts || [],
  employerNamed: app ? appMotivOf(app).employerNamed : null,
  currentOrg: profile?.experiences?.[0]?.org || "",
  lang, spontaneous: offer?.spontaneous || null, keywords: offer?.language && lang && lang !== offer.language ? [] : analysis?.keywords?.length ? analysis.keywords : fallbackKeywords || [],
  jobTitle: analysis?.jobTitle || offer?.title, titleVariants: analysis?.titleVariants || [],
  company: offer?.company, currentTitle: profile?.headline, employerNames: settings?.employerNames, voice: prefs?.voice, pages,
});
async function settleLimited(fns, n) {
  const out = new Array(fns.length);
  let next = 0;
  const worker = async () => {
    while (next < fns.length) {
      const i = next++;
      try { out[i] = { status: "fulfilled", value: await fns[i]() }; } catch (e) { out[i] = { status: "rejected", reason: e }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, fns.length) }, worker));
  return out;
}

const P = {
  translate(text, kind, from, to, offer) {
    const titles = SECTION_TITLES[to] || SECTION_TITLES.en;
    const conv = {
      fr: "Formules belges francophones : « Madame, Monsieur, » ; conclusion sobre (« Je me tiens à votre disposition pour un entretien. ») ; date au format « Ville, le 21 octobre 2026 ».",
      nl: "Néerlandais de Belgique, vouvoiement « u » : « Geachte heer, mevrouw, » ; « Met vriendelijke groeten, » ; date au format « Ville, 21 oktober 2026 ». Intitulés de fonction usuels en Flandre (souvent en anglais).",
      en: "Anglais britannique professionnel : « Dear Hiring Manager, » ; « Kind regards, » ; date au format « Ville, 21 October 2026 ».",
      de: "Allemand standard : « Sehr geehrte Damen und Herren, » ; « Mit freundlichen Grüßen » ; date au format « Ville, 21. Oktober 2026 ».",
    }[to];
    return `Mission : traduire ${kind === "cv" ? "un CV" : "une lettre de motivation"} du ${LANG_NAME[from]} vers le ${LANG_NAME[to]}, pour un recruteur ${to === "nl" ? "flamand ou bruxellois" : to === "fr" ? "belge francophone" : "international"}. Poste visé : ${offer?.title || "non communiqué"}${offer?.company ? ` chez ${offer.company}` : ""}.

RÈGLES
- Conserve EXACTEMENT le balisage en début de ligne (#, >, @, =, ##, ###, -, **Libellé :**, ~), l'ordre des lignes et les lignes vides.
- Conserve tels quels : noms propres, organisations, outils, certifications, chiffres, e-mails, téléphones, URL. Traduis les mois.
- Titres de sections standard en ${LANG_NAME[to]} : ${Object.values(titles).join(", ")}.
- Traduction idiomatique et professionnelle, pas littérale. Garde le ton sobre et orienté résultats ; n'ajoute aucun fait, aucun superlatif.
- Les éléments [à compléter : …] restent entre crochets, traduits (${to === "nl" ? "[aan te vullen: …]" : to === "en" ? "[to complete: …]" : to === "de" ? "[zu ergänzen: …]" : "[à compléter : …]"}).
- ${conv}

DOCUMENT
<<<
${text}
>>>

Réponds uniquement {"text":"<document traduit, même balisage>"}.`;
  },
  search(src, c, s) {
    const target = src.kind === "company"
      ? `la page carrières de l'entreprise « ${src.name} »${src.careersUrl ? ` (${src.careersUrl})` : ""}`
      : `le site « ${src.name} » (${(src.domains || []).join(", ")})`;
    return `Date du jour : ${todayStr()}.
Mission : trouver des offres d'emploi RÉELLES et ACTUELLES publiées sur ${target}, correspondant aux critères ci-dessous.

CRITÈRES
${criteriaDigest(c)}

MÉTHODE
1. Lance plusieurs requêtes web_search ciblées (FR, NL, EN) combinant intitulés et zones, par exemple « ${c.roles[0]} ${c.zones[0]} » ou « ${c.keywords.nl[0] || ""} Brussel ».
2. Ne retiens que des pages d'annonces individuelles (pas de pages de résultats, de listes ou d'articles), publiées depuis moins de ${s.lookbackDays} jours quand la date est visible.
3. Maximum ${s.maxPerSource} offres, les plus pertinentes d'abord. Zéro offre est une réponse valable.

RÈGLES STRICTES
- N'invente jamais une offre. L'URL doit être exactement celle d'un résultat de recherche que tu as vu.
- Champ inconnu ou absent de l'annonce → null. Le salaire n'est renseigné que s'il est écrit dans l'annonce.
- publishedAt : date de publication visible (« il y a 5 jours » → calcule la date). deadline : date limite de candidature si elle est indiquée (« postuler avant le… », « apply by », « solliciteren tot »), sinon null.
- Écarte toute annonce marquée « expirée », « n'accepte plus de candidatures », « no longer accepting applications », « closed », « vacature gesloten », ou dont la date limite est passée.
- description : résumé factuel (missions, profil, conditions) en 600 caractères max, sans extrapoler.
- commuteMinutes : estimation du trajet en voiture hors heures de pointe depuis Ohain, null si le lieu est inconnu.

Réponds uniquement avec ce JSON :
{"offers":[${OFFER_SCHEMA}],"notes":"remarque courte sur la recherche (ex. site peu indexé, annonces expirées)"}`;
  },

  gmail(days) {
    const since = addDays(nowISO(), -days).slice(0, 10).replace(/-/g, "/");
    return `Date du jour : ${todayStr()}.
Mission : importer les offres d'emploi reçues dans les e-mails d'alertes emploi. LECTURE SEULE.
1. Avec les outils Gmail, recherche les e-mails reçus depuis le ${since} provenant de services d'alertes emploi (LinkedIn Job Alerts, Indeed, Jobat, StepStone, Références, VDAB, Le Forem, Welcome to the Jungle, Glassdoor, cabinets de recrutement).
   Requête suggérée : after:${since} (from:linkedin.com OR from:indeed OR from:jobat OR from:stepstone OR from:references OR from:vdab OR from:forem OR from:welcometothejungle OR from:glassdoor OR from:michaelpage OR from:hays OR from:robertwalters)
2. Ouvre au maximum 20 messages pertinents et extrais chaque offre qu'ils listent.
3. N'envoie, ne supprime, n'archive et ne modifie aucun message.

RÈGLES
- N'extrais que ce qui figure dans les e-mails. url = lien de l'offre tel qu'il apparaît dans l'e-mail. Champ absent → null.
- publishedAt : date de publication si l'e-mail l'indique ; sinon la date de réception de l'e-mail, avec "publishedApprox": true. deadline : date limite si indiquée, sinon null.
- Garde les offres de niveau management / digital / IT / CRM / transformation / opérations ; ignore stages, postes juniors et métiers sans rapport.
- description : ce que l'e-mail dit de l'offre (souvent court), sans extrapoler.

Réponds uniquement avec ce JSON :
{"offers":[{"title":"","company":null,"location":null,"contract":null,"seniority":null,"salary":null,"remote":null,"language":"fr|nl|en","publishedAt":"YYYY-MM-DD","publishedApprox":false,"deadline":null,"url":"","description":"","commuteMinutes":null,"sourceName":"LinkedIn|Indeed|Jobat|…","emailSubject":""}],"messagesRead":0,"notes":""}`;
  },

  structure({ text, url }) {
    return `Date du jour : ${todayStr()}.
Mission : structurer une annonce d'emploi fournie par l'utilisateur.
${url ? `URL fournie : ${url}\n` : ""}${text ? `Texte de l'annonce :\n<<<\n${text.slice(0, 20000)}\n>>>\n` : ""}
${url && !text ? `Utilise web_search pour retrouver CETTE annonce précise (intitulé, entreprise, contenu). Si tu ne la retrouves pas avec certitude, réponds {"found":false,"reason":"…"}.` : "Base-toi uniquement sur le texte fourni."}
Règles : aucun champ inventé (null si absent) ; publishedAt et deadline (date limite de candidature) au format YYYY-MM-DD s'ils figurent dans l'annonce ; ${url ? "garde l'URL fournie telle quelle" : "url = null si aucune URL n'apparaît dans le texte"} ; description = résumé factuel de 800 caractères max ; commuteMinutes = trajet voiture estimé depuis Ohain ou null.
Réponds uniquement avec ce JSON :
{"found":true,"offer":${OFFER_SCHEMA}}`;
  },

  score(offers, profile, c, versionLabel) {
    const compact = offers.map((o) => ({
      id: o.id, title: o.title, company: o.company, location: o.location,
      commuteMinutes: o.commute?.minutes ?? null, contract: o.contract, seniority: o.seniority,
      salary: o.salary, remote: o.remote, language: o.language, publishedAt: o.publishedAt || null, deadline: o.deadline || null,
      description: (o.description || "").slice(0, 1800),
    }));
    const list = criteriaList(c).map((x) => `${x.id} [${x.kind}${x.weight ? `, poids ${x.weight}` : ""}] ${x.label}`).join("\n");
    return `Mission : évaluer, critère par critère, l'adéquation de chaque offre avec le profil du candidat. Le score final est calculé par la plateforme à partir de tes taux : sois rigoureux et constant d'une offre à l'autre.

PROFIL
${profileDigest(profile)}
Domicile : Ohain (Brabant wallon). Trajet max souhaité : ${c.maxCommute} min. Télétravail : ${c.remote}.

CRITÈRES (version « ${versionLabel} ») — évalue CHACUN, pour CHAQUE offre, avec son identifiant :
${list}

OFFRES
${JSON.stringify(compact)}

GRILLE (identique pour toutes les offres)
- indispensable / souhaité : match = degré de satisfaction. 100 = explicitement satisfait ; 75 = très probable ; 50 = non précisé dans l'annonce ; 25 = peu probable ; 0 = explicitement contraire.
- exclusion / alerte : match = degré de PRÉSENCE. 100 = explicitement présent ; 50 = non précisé ; 0 = explicitement absent.
- Le niveau de responsabilité compte : un poste d'exécution, de consultant sans équipe ou de chef de projet sans management direct ne satisfait pas un critère « responsabilités managériales ».
- note : 12 mots max, factuelle, tirée de l'annonce ; « non précisé » si l'information manque.
- fit : "fort" | "moyen" | "faible" — ton avis global en une lettre de lecture rapide.
- confidence : "haute" si missions, lieu et conditions sont détaillés ; "moyenne" si partiel ; "faible" si l'annonce est pauvre.
- redFlags : uniquement avec une preuve textuelle courte tirée de l'annonce.

Réponds uniquement avec ce JSON (une entrée par offre, une ligne par identifiant de critère) :
{"scores":[{"id":"","matches":[{"c":"M1","match":50,"note":""}],"fit":"fort|moyen|faible","confidence":"haute|moyenne|faible","confidenceReason":"","summary":"2 phrases max","strengths":[],"gaps":[],"questions":[],"redFlags":[{"type":"stress|turnover|role_flou|autre","evidence":""}]}]}`;
  },

  dossier(offer, profile, types, instruction, analysis, extra = {}) {
    const lang = offer.language ? LANG_NAME[offer.language] : "celle de l'annonce (détecte-la)";
    const head = offer.spontaneous
      ? `${targetBlock(offer, analysis)}
Règle : aucune offre n'existe, jamais « suite à votre annonce ». linkedin = prise de contact avec un décideur ou un recruteur de l'entreprise pour proposer un échange ; email = candidature spontanée courte qui demande un échange de 20 à 30 minutes ; answers = questions probables lors d'un premier échange, avec réponses.`
      : `OFFRE
Intitulé : ${offer.title}
Entreprise : ${show(offer.company)}
Lieu : ${show(offer.location)}
Contrat : ${show(offer.contract)} · Télétravail : ${show(offer.remote)}
Annonce : ${adTextOf(offer).slice(0, 6000)}
URL : ${show(offer.sources?.[0]?.url)}`;
    return `Mission : préparer des documents de candidature pour la cible ci-dessous. Le candidat relira, modifiera et validera tout : rien n'est envoyé automatiquement.

${head}
${analysis ? `\nANALYSE ${offer.spontaneous ? "DU RÔLE VISÉ" : "DE L'ANNONCE"}\n${analysisDigest(analysis, offer)}\n` : ""}
PROFIL
${profileDigest(profile, true)}

${motivationBlock(profile)}
${extra.facts?.length ? `\nFAITS SOURCÉS SUR L'ENTREPRISE (seuls autorisés)\n${extra.facts.map((f) => `${f.id}. ${f.text} (source : ${f.url})`).join("\n")}\n` : ""}${extra.appBlock ? `\n${extra.appBlock}\n` : ""}
DOCUMENTS DEMANDÉS : ${types.join(", ")}

CONSIGNES
- Langue : ${lang}.
- Ton naturel, précis, orienté résultats ; phrases courtes. Aucun cliché ni superlatif (« passionné », « dynamique », « force de proposition », « je me permets », « n'hésitez pas », « fort de », « motivé et rigoureux », « challenge »…).
- N'utilise que des faits présents dans le profil. Aucun chiffre inventé. Si un élément utile manque, écris [à compléter : …].
- Le candidat n'occupe PAS encore le poste visé : présente son poste actuel tel qu'il est, et le poste visé comme un objectif.
- ${extra.employer || "Discrétion : le candidat est en poste. Désigne l'employeur actuel de façon générique (« une fédération patronale belge ») plutôt que par son nom."}
- linkedin : 300 caractères maximum, adressé au recruteur ou au hiring manager : un fait propre à l'entreprise (annonce ou contexte) + une conviction ou une histoire du candidat. Pas de liste de compétences. Test de substitution : le message ne doit pas rester vrai pour un concurrent.
- answers : 5 à 7 questions probables du formulaire (motivation, prétentions salariales formulées sans chiffre inventé, préavis, disponibilité, télétravail, langues…) avec réponses. La réponse « Pourquoi nous / votre motivation » s'appuie sur les faits propres à l'entreprise et sur les MOTIVATIONS (conviction, pourquoi maintenant, une histoire), jamais sur un résumé du CV ; manque → [à compléter : …].
- email : objet et corps courts (120 mots max) mentionnant CV et lettre en pièces jointes.
${instruction ? `- Instruction spécifique de l'utilisateur : ${instruction}` : ""}

Réponds uniquement avec ce JSON (n'inclus que les documents demandés) :
{"language":"fr|nl|en","linkedin":{"text":""},"answers":{"items":[{"question":"","answer":""}]},"email":{"subject":"","body":""}}`;
  },

  adAnalysis(offer, adText, profile) {
    return `Mission : analyser cette annonce comme le feraient un logiciel de tri (ATS) puis un recruteur, et la confronter au profil du candidat. Cette analyse pilotera la rédaction de son CV et de sa lettre.

ANNONCE
Intitulé affiché : ${offer.title}
Entreprise : ${show(offer.company)} · Lieu : ${show(offer.location)} · Contrat : ${show(offer.contract)}
Texte de l'annonce :
<<<
${adText.slice(0, 18000)}
>>>

PROFIL DU CANDIDAT (seule source de preuves)
${profileBlock(profile)}

À PRODUIRE
1. jobTitle : l'intitulé exact tel qu'écrit dans l'annonce. titleVariants : 1 à 4 formes équivalentes qu'un ATS ou un recruteur pourrait chercher (traduction FR/NL/EN, abréviation).
2. language : langue de rédaction de l'annonce (fr, nl ou en).
3. keywords : 20 à 35 termes qu'un ATS indexerait pour ce poste, recopiés EXACTEMENT sous la forme de l'annonce. Couvre tout le texte : intitulé, responsabilités, compétences métier, outils et technologies, méthodes et cadres, savoir-être explicitement demandés, langues, secteur, diplôme. Pour chacun :
   - category : titre | competence | outil | methode | soft | langue | secteur | diplome
   - importance : 3 = exigé, répété ou présent dans l'intitulé ; 2 = demandé ; 1 = atout
   - variants : 0 à 3 formes que l'ATS considère équivalentes (singulier/pluriel, acronyme et forme longue, traduction si l'annonce mélange les langues)
   - status : "prouvé" si le profil le démontre directement ; "transférable" si une expérience proche du profil permet de l'affirmer honnêtement ; "absent" sinon
   - evidence : l'élément précis du profil qui le justifie (fonction, réalisation, outil, compétence), null si absent
4. requirements : 5 à 10 exigences ou missions clés, une ligne chacune, avec importance (1-3) et proof (preuve tirée du profil, ou null).
5. angle : en 2 phrases, le problème que l'employeur veut résoudre avec ce recrutement, d'après l'annonce.
6. companyFacts : 0 à 5 faits sur l'entreprise ou son contexte figurant DANS l'annonce (rien d'extérieur).
7. positioning :
   - currentTitle : le titre réel actuel du candidat, tel que dans le profil.
   - headline : la ligne qui figurera sous son nom sur le CV. Elle part de son titre RÉEL (ou d'une expertise vraie), suivi de 2 ou 3 domaines d'expertise qui recoupent l'annonce, séparés par « | » ou « · », 85 caractères maximum. Elle ne reprend JAMAIS l'intitulé du poste visé comme s'il l'occupait déjà, sauf si cet intitulé est identique à son titre actuel.
   - pitch : une phrase : ce que le candidat apporte concrètement à CE poste, appuyé sur ses preuves.
8. gaps : exigences sans preuve dans le profil, chacune avec une façon honnête de l'aborder (lettre, entretien, compétence voisine).

Réponds uniquement avec ce JSON :
{"jobTitle":"","titleVariants":[],"language":"fr|nl|en","keywords":[{"term":"","category":"competence","importance":2,"variants":[],"status":"prouvé|transférable|absent","evidence":null}],"requirements":[{"text":"","importance":2,"proof":null}],"angle":"","companyFacts":[],"positioning":{"currentTitle":"","headline":"","pitch":""},"gaps":[{"text":"","approach":""}]}`;
  },

  targetAnalysis(offer, profile) {
    const base = offer.spontaneous === "base";
    const lang = LANG_NAME[offer.language] || "français";
    return `Mission : préparer ${base ? "un CV de base (aucune offre ni entreprise ciblée)" : "une candidature SPONTANÉE (aucune offre publiée)"}. Déduis ce qu'un recruteur et un logiciel de tri (ATS) attendent pour le rôle visé sur le marché belge, puis confronte-le au profil du candidat. Cette analyse pilotera la rédaction.

CIBLE
${targetBlock(offer)}

PROFIL DU CANDIDAT (seule source de preuves)
${profileBlock(profile)}

À PRODUIRE
1. jobTitle : l'intitulé le plus courant pour ce rôle dans les annonces belges, en ${lang}. titleVariants : 2 à 4 intitulés équivalents (FR/NL/EN, abréviations).
2. language : "${offer.language || "fr"}".
3. keywords : 20 à 30 termes que les annonces pour ce rôle contiennent habituellement (responsabilités, compétences métier, outils, méthodes, savoir-être, langues, secteur), priorisés selon le contexte fourni. Pour chacun :
   - category : titre | competence | outil | methode | soft | langue | secteur | diplome
   - importance : 3 = cœur du rôle ; 2 = fréquent ; 1 = atout
   - variants : 0 à 3 formes équivalentes (pluriel, acronyme et forme longue, traduction)
   - status : "prouvé" si le profil le démontre directement ; "transférable" si une expérience proche permet de l'affirmer honnêtement ; "absent" sinon
   - evidence : l'élément précis du profil qui le justifie, null si absent
4. requirements : 5 à 8 attentes typiques du rôle, une ligne chacune, avec importance (1-3) et proof (preuve tirée du profil, ou null).
5. angle : en 2 phrases, ${base ? "ce qu'une organisation cherche en général en recrutant ce rôle" : "ce que l'entreprise pourrait gagner à recruter ce profil, d'après le contexte fourni (sinon d'après le rôle)"}, formulé comme une hypothèse.
6. companyFacts : uniquement les faits présents dans le contexte fourni (aucun fait extérieur, aucune supposition).
7. positioning :
   - currentTitle : le titre réel actuel du candidat, tel que dans le profil.
   - headline : la ligne sous son nom sur le CV : son titre RÉEL (ou une expertise vraie), puis 2 ou 3 domaines d'expertise qui recoupent le rôle visé, séparés par « | » ou « · », 85 caractères maximum. Jamais le rôle visé présenté comme déjà occupé.
   - pitch : une phrase : ce que le candidat apporte concrètement dans ce rôle${base ? "" : " pour cette entreprise"}, appuyé sur ses preuves.
8. gaps : attentes sans preuve dans le profil, chacune avec une façon honnête de l'aborder.

Réponds uniquement avec ce JSON :
{"jobTitle":"","titleVariants":[],"language":"fr|nl|en","keywords":[{"term":"","category":"competence","importance":2,"variants":[],"status":"prouvé|transférable|absent","evidence":null}],"requirements":[{"text":"","importance":2,"proof":null}],"angle":"","companyFacts":[],"positioning":{"currentTitle":"","headline":"","pitch":""},"gaps":[{"text":"","approach":""}]}`;
  },

  cvWrite(offer, profile, a, prefs, instruction, extra = {}) {
    const lang = LANG_NAME[docLang(offer, prefs, a)] || "celle de l'annonce";
    const contact = profileContact(profile);
    const target = a?.jobTitle || offer.title;
    const voice = prefs.voice === "je"
      ? "à la première personne (« je »), phrases courtes"
      : "sans pronom personnel, style CV (verbes sans sujet ou phrases nominales : « Pilote… », « Responsable du CRM… »)";
    const tg = targetInfo(offer, a);
    const projection = tg.base
      ? `c) la projection : le type de rôle recherché (« ${target} ») comme OBJECTIF, sans nommer d'entreprise.`
      : tg.spont
        ? `c) la projection : ce qu'il veut apporter à ${show(offer.company)} dans un rôle de « ${target} », formulé comme un OBJECTIF (aucune offre n'existe : jamais « en réponse à votre annonce »).`
        : `c) la projection : ce qu'il veut apporter, en citant l'intitulé exact « ${target} » comme OBJECTIF (par ex. « … souhaite mettre cette expérience au service de ${show(offer.company)} en tant que ${target} »), jamais comme une fonction déjà exercée.`;
    const masterBlock = extra.master ? `
CV MAÎTRE (${LANG_NAME[extra.masterLang] || "même langue"}) — base OBLIGATOIRE. Tu l'ADAPTES, tu ne le réécris pas.
Tu ne peux modifier QUE : la ligne de positionnement (« > »), la section Profil, la section Réalisations clés (choisir et ordonner des réalisations du maître ou du profil), l'ORDRE des puces dans chaque poste (sans changer leur texte) et la section Compétences. Tout le reste (en-tête, postes, puces, langues, formation) est recopié à l'identique ; toute autre modification sera annulée.
<<<
${extra.master}
>>>
` : "";
    return `Mission : rédiger le CV du candidat, adapté à la cible ci-dessous et prêt à envoyer après relecture.
${masterBlock}
${targetBlock(offer, a)}

ANALYSE ${tg.spont ? "DU RÔLE VISÉ" : "DE L'ANNONCE"} (déjà confrontée au profil)
${analysisDigest(a, offer)}

PROFIL (seule source de faits)
Nom : ${profile.name || "[à compléter : prénom nom]"}
Coordonnées : ${contact}
${profileBlock(profile)}

CONSIGNES DE RÉDACTION
Langue : ${lang}. Titres de sections standard dans cette langue (FR : Profil, Réalisations clés, Expérience professionnelle, Compétences, Langues, Formation, Certifications ; NL : Profiel, Belangrijkste realisaties, Werkervaring, Vaardigheden, Talen, Opleiding ; EN : Profile, Key achievements, Professional experience, Skills, Languages, Education).
1. Ligne sous le nom (balise « > ») : le positionnement RÉEL du candidat — son titre actuel (« ${profile.headline || "titre actuel"} ») ou une expertise vraie — puis 2 ou 3 domaines d'expertise qui recoupent l'annonce, séparés par « | » ou « · ». 85 caractères maximum. INTERDIT : y placer l'intitulé du poste visé (« ${target} ») comme s'il était déjà occupé, sauf s'il est identique au titre actuel.
2. Profil : 3 ou 4 phrases, 55 à 90 mots, ${voice}. Construction :
   a) qui est le candidat AUJOURD'HUI : fonction réelle, périmètre (équipe, outils, domaine), années d'expérience seulement si elles figurent dans le profil ;
   b) 1 ou 2 preuves fortes, chiffrées si le profil contient des chiffres ;
   ${projection}
   Ne décris pas les missions du rôle visé comme si le candidat les exerçait déjà.
3. Réalisations clés : 3 ou 4 puces choisies pour les exigences clés, chiffrées si le profil le permet, au format « verbe d'action + périmètre + résultat ».
4. Expérience professionnelle, du plus récent au plus ancien : « ### Fonction | Organisation | Lieu | Période » puis 3 à 6 puces (2 à 4 pour les postes anciens). Verbes d'action au présent pour le poste actuel, au passé pour les précédents. Aucune puce ne commence par « Responsable de », « En charge de », « Participation à ». Une idée par puce, 2 lignes maximum.
5. Compétences : 3 ou 4 groupes « **Groupe :** élément, élément » (ex. Transformation & pilotage, Outils & plateformes, Méthodes, Management), avec les termes exacts de l'annonce quand le profil les justifie.
6. Langues (niveau tel que dans le profil), Formation (« ### Diplôme | Établissement | | Année »), Certifications si le profil en contient. N'invente ni niveau ni diplôme.

MOTS-CLÉS ATS — exigence de couverture
- Chaque mot-clé de statut « prouvé » ou « transférable » d'importance 2 ou 3 apparaît au moins une fois sous sa forme exacte, de préférence dans le Profil, les Réalisations ou une puce d'Expérience où il est démontré — pas seulement dans Compétences.
- Les outils et méthodes prouvés figurent aussi dans Compétences.
- Première occurrence d'un acronyme : forme longue entre parenthèses si l'annonce l'utilise (ex. « CRM (Customer Relationship Management) »).
- N'utilise JAMAIS un mot-clé de statut « absent ». Pas de bourrage : 3 occurrences maximum par terme, toujours dans une phrase qui a du sens.

STYLE
- Zéro cliché ni affirmation creuse (« passionné », « dynamique », « force de proposition », « orienté résultats », « rigoureux », « esprit d'équipe », « challenge »…) : montre-le par un fait.
- ${extra.employer || `Organisation actuelle : reprends exactement le libellé du profil (« ${profile.experiences?.[0]?.org || "…"} »).`}
- Longueur : ${prefs.cvLength === "1" ? "1 page (420 à 560 mots)" : "1 à 2 pages (600 à 850 mots)"}.
${instruction ? `- Consigne du candidat : ${instruction}` : ""}

FORMAT (balisage léger, une instruction par ligne)
# Prénom Nom
> Ligne de positionnement
@ ${contact}
## Profil
paragraphe
## Réalisations clés
- puce
## Expérience professionnelle
### Fonction | Organisation | Lieu | Période
- puce
## Compétences
**Groupe :** élément, élément
## Langues
**Langue :** niveau
## Formation
### Diplôme | Établissement | | Année

COULEUR : accent = couleur principale de la charte de l'entreprise en hexadécimal SEULEMENT si tu la connais avec certitude, sinon null.

Réponds uniquement avec ce JSON :
{"cv":"<balisage>","accent":"#RRGGBB ou null","accentSource":"charte connue ou null","tips":["3 conseils concrets pour sortir du lot sur CETTE offre"]}`;
  },

  letterWrite(offer, profile, a, prefs, instruction, cvText, extra = {}) {
    const code = docLang(offer, prefs, a) || "fr";
    const target = a?.jobTitle || offer.title;
    const city = String(profile.home || "").split(/[(,]/)[0].trim() || "[à compléter : ville]";
    const dateLine = code === "fr" ? `${city}, le ${longDate("fr")}` : `${city}, ${longDate(code)}`;
    return P.letterCore({ offer, profile, a, prefs, instruction, cvText, code, target, dateLine, ...extra });
  },

  /* Règle d'or : le CV prouve, la lettre explique. Lettre = pourquoi eux + pourquoi ce rôle maintenant + méthode + 1 preuve racontée. */
  letterCore({ offer, profile, a, prefs, instruction, cvText, code, target, dateLine, facts: factsIn, appBlock, employer }) {
    const tg = targetInfo(offer, a);
    const company = tg.base ? "[à compléter : entreprise]" : show(offer.company);
    const facts = factsIn || [];
    const kws = (a?.keywords || []).filter((k) => k.status !== "absent" && k.importance === 3).slice(0, 6).map((k) => `« ${k.term} »`);
    const subject = tg.spont ? `## Objet : candidature spontanée — ${target}` : `## Objet : candidature au poste de ${target}`;
    return `Mission : rédiger ${tg.base ? "une lettre de candidature spontanée MODÈLE, réutilisable (l'entreprise et ses faits restent à compléter)" : tg.spont ? "une lettre de candidature SPONTANÉE" : "la lettre de motivation"} pour ${tg.spont ? `un rôle de « ${target} »` : `le poste « ${target} »`}${tg.base ? "" : ` chez ${company}`}, prête à envoyer après relecture.

RÈGLE D'OR : le CV prouve, la lettre explique. Le CV ci-dessous est déjà joint : la lettre ne le résume pas. Elle dit pourquoi CETTE entreprise, pourquoi CE rôle MAINTENANT, comment le candidat travaille, et raconte UNE preuve.
TEST DE SUBSTITUTION : relis chaque phrase en remplaçant ${tg.base ? "l'entreprise" : company} par un concurrent. Si elle reste vraie, réécris-la avec un fait propre à ${tg.base ? "l'entreprise" : company}, ou supprime-la.

${targetBlock(offer, a).split("\n").filter((l) => !l.startsWith("Contexte fourni par le candidat")).join("\n")}
${tg.spont && adTextOf(offer) ? `\nNOTES DU CANDIDAT SUR L'ENTREPRISE (son point de vue, pas des faits vérifiés : à utiliser pour le « pourquoi » personnel, jamais citées comme faits sur l'entreprise)\n${adTextOf(offer).slice(0, 1500)}\n` : ""}
CE QUE L'ON SAIT DE ${tg.base ? "L'ENTREPRISE" : company.toUpperCase()} (faits sourcés, seules informations autorisées sur l'entreprise ; cite leurs identifiants dans « used »)
${facts.length ? facts.map((f) => `${f.id}. ${f.text} (source : ${f.url})`).join("\n") : "Aucun fait vérifié. Le paragraphe « pourquoi vous » s'écrit alors [à compléter : un fait précis et vérifiable sur l'entreprise, avec sa source]."}

${appBlock || ""}

ANALYSE ${tg.spont ? "DU RÔLE VISÉ" : "DE L'ANNONCE"} (repères, pas une liste à recopier)
${analysisDigest(a, offer)}

${motivationBlock(profile)}

PROFIL (faits autorisés)
Nom : ${profile.name || "[à compléter : prénom nom]"}
Coordonnées : ${profileContact(profile)}
${profileBlock(profile)}

CV DÉJÀ JOINT (à NE PAS répéter)
<<<
${String(cvText || "(CV non fourni)").slice(0, 9000)}
>>>

TRAME (corps de ${tg.spont ? "220 à 300" : "250 à 320"} mots, paragraphes séparés par une ligne vide)
1. Appel : formule seule sur sa ligne (FR « Madame, Monsieur, » ; NL « Geachte mevrouw, geachte heer, » ; EN « Dear Hiring Manager, » ; interlocuteur nommé si connu).
2. Pourquoi vous (2-3 phrases) : un ou deux faits propres à ${tg.base ? "l'entreprise" : company} (liste ci-dessus) reliés à une conviction ou à un intérêt réel du candidat. Aucune flatterie (« leader », « référence », « renommée », « prestigieuse », « j'admire »…).${tg.spont ? " Aucune offre n'existe : jamais « votre annonce », « le poste à pourvoir »." : ""}
3. Pourquoi ce rôle, maintenant (2-3 phrases) : à partir de « pourquoi maintenant », « ce qu'il cherche » et d'une conviction. Le candidat n'occupe pas le poste visé.
4. Preuve racontée (3-4 phrases) : UNE histoire de la banque, racontée (situation → ce qu'il a fait → ce que ça a changé), pas une liste de réalisations.
5. Méthode (2 phrases) : comment il aborderait les enjeux de ${tg.base ? "l'entreprise" : company}, à partir de sa méthode, formulé comme une intention.
6. Échange (1-2 phrases) : ${tg.spont ? "proposer un échange de 20 à 30 minutes, même sans poste ouvert" : "disponibilité pour un entretien, sans insistance"}, puis formule de politesse sobre adaptée à la langue.

CONTRAINTES
- Langue : ${LANG_NAME[code] || code}. Ton : ${DOC_TONES[prefs.tone] || DOC_TONES.sobre}, humble.
- 2 chiffres au maximum dans toute la lettre.
- Au plus 1 réalisation commune avec le CV, et formulée autrement qu'en puce de CV.
- 2 à 4 mots-clés de l'annonce au plus, seulement s'ils viennent naturellement${kws.length ? ` (parmi : ${kws.join(", ")})` : ""}. Aucune énumération de compétences.
- Jamais deux phrases consécutives commençant par « Je » (« Ik », « I »).
- Intitulé exact « ${target} » dans l'objet ; ${tg.base ? "entreprise laissée en [à compléter]" : `${company} citée au moins une fois`}.
- ${employer || "Discrétion : le candidat est en poste ; désigne son employeur actuel de façon générique (« une fédération patronale belge »), jamais par son nom."}
- Motivation, conviction ou histoire absentes des MOTIVATIONS : écris [à compléter : …], n'invente rien. Aucun fait inventé, aucun cliché.
${instruction ? `- Consigne du candidat : ${instruction}` : ""}

FORMAT (balisage léger, une instruction par ligne)
# Prénom Nom
@ coordonnées
= ${dateLine}
> ${offer.contactName || "Destinataire (service recrutement, ou nom si connu)"}
> ${company}
${subject}
paragraphes séparés par une ligne vide
~ Prénom Nom

« used » décrit honnêtement ce que la lettre utilise : faits entreprise (A1, B1…), conviction (id [c…]), histoire (id [s…]), mots-clés de l'annonce, chiffres écrits, réalisation commune avec le CV (texte ou null).

Réponds uniquement avec ce JSON :
{"letter":"<balisage>","used":{"companyFacts":["A1"],"convictionId":null,"storyId":null,"keywords":[],"numbers":[],"sharedWithCv":null}}`;
  },

  companyBrief(company, context) {
    return `Date du jour : ${todayStr()}.
Mission : établir une fiche factuelle sur l'entreprise « ${company} » (Belgique de préférence), pour aider un candidat à expliquer « pourquoi cette entreprise ».
${context ? `Contexte : ${context}` : ""}
Utilise web_search avec le NOM DE L'ENTREPRISE uniquement (jamais le nom d'une personne). Cherche : activité et modèle, taille et implantation, organisation, stratégie et projets digitaux ou de transformation, actualité des 12 derniers mois, engagements ou valeurs affichés publiquement.
Règles : 5 à 10 faits, une phrase factuelle chacun, chacun avec l'URL EXACTE du résultat qui le montre. Pas de flatterie, pas d'interprétation, pas de fait sans URL. Information introuvable → ne la mentionne pas.
Réponds uniquement {"summary":"2 phrases factuelles","facts":[{"text":"","url":""}]}`;
  },

  briefFromText(company, url, text) {
    return `Mission : extraire de la source ci-dessous les faits utiles sur l'entreprise « ${company} », pour expliquer « pourquoi cette entreprise » dans une candidature.
SOURCE (${url})
<<<
${String(text || "").slice(0, 15000)}
>>>
Règles : uniquement ce que dit la source, une phrase factuelle par fait, 3 à 8 faits, aucune interprétation ni flatterie.
Réponds uniquement {"summary":"1 phrase","facts":[{"text":""}]}`;
  },

  learnRules(edits, rules) {
    return `Mission : déduire des corrections manuelles d'un candidat les règles d'écriture qu'il applique de façon RÉCURRENTE à ses CV et lettres générés par IA.

RÈGLES DÉJÀ CONNUES (ne pas les reproposer)
${rules.map((r) => `- ${r.text}`).join("\n") || "(aucune)"}

CORRECTIONS (supprimé → ajouté), regroupées par document
${edits.map((e) => `[${e.type} · ${e.appId.slice(-6)}]\n${e.hunks.slice(0, 12).map((h) => `- « ${h.del || "∅"} » → « ${h.add || "∅"} »`).join("\n")}`).join("\n\n").slice(0, 14000)}

RÈGLES
- Une règle n'est proposée que si le même type de correction apparaît dans AU MOINS 2 documents différents. Cite ces exemples dans evidence.
- Règle courte, impérative, applicable par un rédacteur (ex. « Ne jamais écrire "responsable CRM" : préférer "transformation digitale" »).
- Style, vocabulaire, ton, structure seulement : une règle ne peut jamais autoriser un fait absent du profil.
- 0 à 5 règles. Aucune si rien n'est récurrent.

Réponds uniquement {"rules":[{"text":"","evidence":"2 exemples courts","docs":2}]}`;
  },

  motivationDraft(answers, current) {
    return `Mission : ranger les réponses d'un candidat à un entretien de motivation dans sa fiche « Motivations ».

RÈGLE ABSOLUE : tu REFORMULES seulement. Aucune idée, aucun fait, aucun chiffre, aucun adjectif valorisant qui ne soit pas dans ses réponses. Garde ses mots quand ils sont précis. Un champ sans matière reste vide ("" ou []). Langue : français, sauf si les réponses sont dans une autre langue.

RÉPONSES
${answers.map((x) => `Q (${x.field}) : ${x.q}\nR : ${x.a || "(pas de réponse)"}`).join("\n\n")}

FICHE ACTUELLE (ne la répète pas ; propose seulement ce que les réponses apportent)
${JSON.stringify(current).slice(0, 6000)}

CHAMPS
- purpose : raison d'être professionnelle (1-2 phrases).
- convictions : 1 phrase chacune, affirmée, telle qu'il la défend.
- stories : histoires racontables { title (5 mots), situation, action (ce qu'IL a fait), result (avec ses chiffres exacts s'il en donne), lesson }.
- management, method, whyNow, lookingFor : 1-3 phrases chacun.
- sectors : secteurs ou types d'organisations cités.
- followUps : 0 à 3 questions de relance quand une réponse est trop vague pour écrire une lettre spécifique (ex. histoire sans résultat, conviction sans exemple). Chaque relance vise un champ.

Réponds uniquement avec ce JSON :
{"purpose":"","convictions":[],"stories":[{"title":"","situation":"","action":"","result":"","lesson":""}],"management":"","method":"","whyNow":"","lookingFor":"","sectors":[],"followUps":[{"field":"","q":""}]}`;
  },

  fixDoc({ kind, text, issues, analysis, profile, offer }) {
    return `Mission : corriger ${kind === "cv" ? "le CV" : "la lettre de motivation"} ci-dessous sur les seuls points listés, par des remplacements ciblés. Ne touche à rien d'autre.

DOCUMENT (balisage ; chaque « before » doit en être une copie EXACTE, caractère pour caractère)
<<<
${text}
>>>

POINTS À CORRIGER
${issues.map((i, n) => `${n + 1}. ${i.title}${i.detail ? ` — ${i.detail}` : ""}`).join("\n")}

RÉFÉRENCES
Cible : ${targetLine(offer, analysis)}
Fonction réelle actuelle du candidat : ${profile.headline || "non renseignée"}
${analysisDigest(analysis, offer)}

PROFIL (faits autorisés)
${profileBlock(profile)}

RÈGLES
- Chaque correction remplace un passage court (une ligne ou une phrase) : "before" = texte exact du document, "after" = nouvelle version, avec le même balisage en début de ligne (« - », « > », « ### »…).
- ${kind === "cv" ? "Pour ajouter un mot-clé, réécris la phrase ou la puce où le profil le démontre ; jamais de liste de mots ajoutée." : "Lettre : n'ajoute ni mot-clé ni chiffre ; elle explique le « pourquoi » (entreprise, rôle, méthode, une histoire), le CV porte les preuves."}
- Le candidat n'occupe pas le poste visé : la ligne sous le nom part de sa fonction réelle ; l'intitulé visé ne s'écrit que comme objectif.
- Aucun fait, chiffre ou outil absent du profil. Aucun cliché. Même langue que le document.
- Un point qui ne peut pas être corrigé honnêtement est ignoré.

Réponds uniquement avec ce JSON :
{"edits":[{"before":"","after":"","reason":"10 mots max"}]}`;
  },

  review({ kind, text, analysis, profile, offer, cvText }) {
    const tg = targetInfo(offer, analysis);
    const reader = tg.base
      ? `un recruteur exigeant qui cherche un profil de « ${tg.role} »`
      : tg.spont
        ? `un dirigeant de ${show(offer.company)} qui reçoit cette candidature spontanée pour un rôle de « ${tg.role} » sans avoir publié d'offre`
        : `un recruteur exigeant qui reçoit 200 candidatures pour le poste « ${tg.role} » chez ${show(offer.company)}`;
    return `Mission : relire ${kind === "cv" ? "ce CV" : "cette lettre de motivation"} comme ${reader}, puis proposer des corrections ciblées.

DOCUMENT (balisage)
<<<
${text}
>>>

ANALYSE ${offer.spontaneous ? "DU RÔLE VISÉ" : "DE L'ANNONCE"}
${analysisDigest(analysis, offer)}

PROFIL (faits autorisés)
${profileBlock(profile)}
${kind === "cv" ? "" : `
${motivationBlock(profile)}

CV JOINT À LA LETTRE
<<<
${String(cvText || "(CV non fourni)").slice(0, 8000)}
>>>

LETTRE : le CV prouve, la lettre explique. Vérifie en priorité :
- TEST DE SUBSTITUTION : chaque phrase qui resterait vraie si l'on remplaçait ${show(offer.company)} par un concurrent est à réécrire (fait propre à l'entreprise, ou [à compléter : fait vérifiable]).
- Répétition du CV : toute phrase qui reformule une puce du CV est à remplacer par du « pourquoi » (conviction, pourquoi maintenant, méthode) ou par l'histoire racontée.
- Présence de : pourquoi eux, pourquoi ce rôle maintenant, une histoire racontée, la méthode, la demande d'échange. Au plus 2 chiffres. Aucune flatterie.
`}
Évalue : positionnement compris en 10 secondes, preuves chiffrées, adéquation aux exigences clés, couverture des mots-clés prouvés, honnêteté (aucune prétention d'occuper déjà le poste visé), style (clichés, répétitions, phrases longues), cohérence des temps.
Propose 4 à 10 corrections, les plus utiles d'abord : "before" = copie EXACTE d'un passage court du document (une ligne ou une phrase), "after" = version améliorée avec le même balisage de début de ligne, "reason" = pourquoi (12 mots max), "severity" = haute | moyenne | basse. Aucun fait absent du profil.

Réponds uniquement avec ce JSON :
{"verdict":"2 phrases : impression d'ensemble et principal levier","score":0,"strengths":["2 ou 3 points forts"],"edits":[{"before":"","after":"","reason":"","severity":"moyenne"}]}`;
  },

  improveSection({ kind, text, title, body, goal, custom, missing, analysis, profile, offer, lang }) {
    const goals = {
      impact: "plus percutant : verbe d'action en tête, périmètre et résultat chiffré quand le profil le contient, une idée par puce",
      concise: "plus concis : environ 30 % de mots en moins, sans perdre les preuves ni les mots-clés",
      keywords: `intégrer, là où le profil les justifie, les mots-clés manquants suivants : ${(missing || []).map((k) => `« ${k.term} »${k.evidence ? ` (preuve : ${k.evidence})` : ""}`).join(", ") || "aucun"}`,
      style: "corriger le style : supprimer clichés, affirmations creuses, pronoms superflus, répétitions et formules faibles",
      custom: custom || "améliorer la section",
    };
    return `Mission : réécrire UNE section ${kind === "cv" ? "du CV" : "de la lettre de motivation"} selon l'objectif ci-dessous.

SECTION « ${title || "introduction"} » (balisage actuel)
<<<
${body}
>>>

OBJECTIF : ${goals[goal] || goals.custom}

DOCUMENT COMPLET (contexte, à ne pas réécrire)
<<<
${text}
>>>

CIBLE : ${targetLine(offer, analysis)}
${analysisDigest(analysis, offer)}

PROFIL (faits autorisés)
${profileBlock(profile)}

RÈGLES
- Garde le même balisage (« - » puce, « ### Fonction | Organisation | Lieu | Période », « **Libellé :** valeur », paragraphes séparés par une ligne vide) et la même structure (mêmes postes, même ordre). Ne renvoie PAS la ligne de titre « ## ».
- Langue : ${LANG_NAME[lang] || "celle du document"}. Uniquement des faits du profil ; [à compléter : …] si un chiffre manque. Aucun cliché.
- Le candidat n'occupe pas le poste visé : poste actuel au présent, postes passés au passé, poste visé uniquement comme objectif.

Réponds uniquement avec ce JSON :
{"body":"<balisage de la section>","note":"ce qui a changé, 15 mots max"}`;
  },

  headlines({ analysis, profile, offer, lang }) {
    return `Propose 4 lignes de positionnement à placer sous le nom du candidat, en tête de son CV. Cible : ${targetLine(offer, analysis)}.

PROFIL
${profileBlock(profile)}

ANALYSE ${offer.spontaneous ? "DU RÔLE VISÉ" : "DE L'ANNONCE"}
${analysisDigest(analysis, offer)}

Règles : chaque ligne part de la fonction RÉELLE du candidat (« ${profile.headline || "fonction actuelle"} ») ou d'une expertise vraie, puis 2 ou 3 domaines d'expertise qui recoupent l'annonce, séparés par « | » ou « · » ; 85 caractères maximum ; langue : ${LANG_NAME[lang] || "celle de l'annonce"} ; aucune ligne ne présente le candidat comme occupant déjà le poste visé ; aucun cliché. Varie les angles (technique, management, transformation, résultats).
Réponds uniquement {"options":[{"headline":"","angle":"5 mots max"}]}`;
  },

  ratings(companies) {
    return `Date du jour : ${todayStr()}.
Mission : trouver la note employeur publique (avis de salariés) de chaque entreprise ci-dessous, en Belgique de préférence : Glassdoor, Indeed (avis entreprises), Jobat ou équivalent.
Entreprises : ${JSON.stringify(companies)}
Règles : utilise web_search. Ne rapporte une note que si elle apparaît explicitement dans un résultat (titre ou extrait) avec sa source ; sinon rating = null. Échelle sur 5. N'invente jamais une note, un nombre d'avis ou une URL.
Réponds uniquement {"ratings":[{"company":"","rating":null,"reviews":null,"source":"Glassdoor|Indeed|Jobat|…","url":null,"note":"remarque courte, ex. note mondiale et non belge"}]}`;
  },

  gmailDraft({ to, subject, body }) {
    return `Crée UN brouillon dans Gmail avec exactement les éléments ci-dessous, sans les modifier. N'ENVOIE PAS le message : brouillon uniquement.
Destinataire : ${to || "(laisser vide)"}
Objet : ${subject}
Corps :
<<<
${body}
>>>
Après création, réponds uniquement {"created":true,"draftId":"identifiant ou null"} ; en cas d'échec {"created":false,"error":"raison"}.`;
  },

  calendarEvent({ title, start, end, description, reminder }) {
    return `Crée UN événement dans l'agenda Google principal de l'utilisateur, fuseau horaire Europe/Brussels.
Titre : ${title}
Début : ${start}
Fin : ${end}
Description : ${description || ""}
Rappel : notification ${reminder || 30} minutes avant.
N'invite personne et ne modifie aucun autre événement.
Réponds uniquement {"created":true,"eventId":"identifiant ou null","link":"lien ou null"} ; en cas d'échec {"created":false,"error":"raison"}.`;
  },

  followUp(app, offer, fu, profile, contact) {
    const log = (app.log || []).slice(-8).map((l) => `- ${fmtDate(l.at)} : ${l.text}`).join("\n");
    return `Rédige un e-mail de type « ${FU_KINDS[fu.kind]} » pour cette candidature.
Poste : ${offer?.title} — ${show(offer?.company)}
Candidature envoyée le : ${fmtDate(app.sentAt)}
${app.interviews?.length ? `Entretien(s) : ${app.interviews.map((i) => `${fmtDate(i.at, { time: true })} (${i.type})`).join(", ")}` : ""}
Contact : ${contact ? `${contact.name} (${contact.role || "rôle non communiqué"})` : "non communiqué"}
Derniers échanges :
${log || "(aucun)"}
Profil (pour une valeur ajoutée concrète) : ${profile.summary}

Consignes : langue ${LANG_NAME[offerLang(offer)]} ; 90 mots maximum ; courtois et factuel ; une valeur ajoutée concrète liée au poste ; aucune insistance ni formule creuse ; ne nomme pas l'employeur actuel ; n'invente aucun fait.
Réponds uniquement {"subject":"","body":""}.`;
  },

  prep(offer, profile, extra = {}) {
    return `Date du jour : ${todayStr()}.
Mission : préparer un entretien pour le poste « ${offer.title} » chez « ${show(offer.company)} ».
Annonce : ${show(offer.description)}

PROFIL
${profileDigest(profile, true)}

${motivationBlock(profile)}
${extra.facts?.length ? `\nFICHE ENTREPRISE DÉJÀ VÉRIFIÉE (réutilise ces faits avec leur URL ; ne les recherche pas à nouveau, complète seulement l'actualité récente)\n${extra.facts.map((f) => `- ${f.text} (${f.url})`).join("\n")}\n` : ""}${extra.appBlock ? `\n${extra.appBlock}\n` : ""}
1. Utilise web_search pour documenter l'entreprise (activité, taille, organisation, actualité des 12 derniers mois, culture, avis publics). Chaque fait doit citer l'URL de sa source. Si une information n'est pas trouvée, ne la mentionne pas.
2. Questions probables pour ce poste, avec l'angle attendu.
3. Exemples STAR construits UNIQUEMENT à partir du profil et de la banque d'histoires (priorité aux histoires) ; si un élément manque, écris [à compléter]. Inclure la réponse à « Pourquoi nous ? » à partir des faits trouvés et des motivations du candidat.
4. Questions pertinentes à poser.
5. Points de négociation. Fourchette salariale uniquement si une source publique chiffrée existe (avec URL), sinon null.

Réponds uniquement avec ce JSON :
{"company":{"summary":"","facts":[{"text":"","sourceUrl":""}],"news":[{"title":"","date":null,"sourceUrl":""}]},"likelyQuestions":[{"question":"","angle":""}],"star":[{"theme":"","situation":"","task":"","action":"","result":""}],"questionsToAsk":[],"negotiation":[{"point":"","argument":""}],"salaryBenchmark":{"range":null,"sourceUrl":null}}`;
  },

  keywords(c) {
    return `Génère des variantes de mots-clés de recherche d'emploi pour le marché belge à partir de :
Postes : ${c.roles.join(" ; ")}
Mots-clés actuels : FR ${c.keywords.fr.join(", ")} | NL ${c.keywords.nl.join(", ")} | EN ${c.keywords.en.join(", ")}
Pour chaque langue (fr, nl, en) : synonymes d'intitulés réellement utilisés dans les annonces, traductions, abréviations courantes. 8 à 15 termes par langue, sans doublon ni terme trop générique.
Réponds uniquement {"fr":[],"nl":[],"en":[]}.`;
  },

  dedupe(offers) {
    const compact = offers.map((o) => ({
      id: o.id, title: o.title, company: o.company, location: o.location, contract: o.contract, publishedAt: o.publishedAt,
      sites: [...new Set((o.sources || []).map((x) => hostOf(x.url) || x.name))],
      excerpt: (o.description || "").slice(0, 220),
    }));
    return `Mission : repérer les offres qui décrivent le MÊME poste publié plusieurs fois (autre site, cabinet qui anonymise l'employeur, intitulé traduit ou reformulé en FR/NL/EN).
OFFRES
${JSON.stringify(compact)}

RÈGLES
- Ne regroupe que si tu es raisonnablement sûr : même poste, même employeur (ou employeur anonymisé compatible), même lieu, période de publication proche.
- Deux postes semblables chez deux employeurs différents ne sont PAS des doublons.
- Chaque id apparaît au plus dans un groupe. Aucun groupe est une réponse valable.
Réponds uniquement {"groups":[{"ids":["",""],"confidence":"haute|moyenne","reason":"20 mots max"}]}`;
  },

  replies(items) {
    return `Date du jour : ${todayStr()}.
Mission : détecter dans Gmail les réponses reçues aux candidatures ci-dessous. LECTURE SEULE.
CANDIDATURES
${JSON.stringify(items)}

MÉTHODE
1. Pour chaque candidature, recherche les e-mails reçus depuis sa date d'envoi (champ since) venant de l'entreprise, du cabinet ou des contacts listés (nom, domaine, adresse). Ignore les alertes emploi automatiques, newsletters et e-mails envoyés par l'utilisateur.
2. Ouvre les messages pertinents (25 au maximum au total).
3. N'envoie, ne supprime, n'archive, ne marque et ne modifie aucun message.

RÈGLES
- Ne rapporte qu'un e-mail réellement lu. subject = objet exact. Si le rattachement à une candidature est incertain, ne le rapporte pas.
- kind : accuse_reception | invitation_entretien | refus | demande_info | offre | autre.
- proposedStage : "interview" pour une invitation, "closed" pour un refus, "offer" pour une offre, sinon null.
- interviewAt : date et heure proposées dans l'e-mail (YYYY-MM-DDTHH:mm), sinon null.
Réponds uniquement {"replies":[{"appId":"","date":"YYYY-MM-DD","from":"","subject":"","kind":"","summary":"25 mots max","proposedStage":null,"interviewAt":null}],"messagesRead":0}`;
  },

  verify(items) {
    return `Date du jour : ${todayStr()}.
Mission : pour chaque offre d'emploi ci-dessous, déterminer si elle est ENCORE OUVERTE aux candidatures.
${JSON.stringify(items)}
Méthode : web_search sur l'intitulé exact + l'entreprise (et le domaine de l'URL). Une offre est "closed" si un résultat montre « expirée », « n'accepte plus de candidatures », « no longer accepting applications », « closed », « vacature gesloten », une date limite passée, ou si l'annonce n'apparaît plus que sur des agrégateurs anciens. "open" seulement si un résultat récent (moins de 30 jours) montre l'annonce active. Sinon "unknown".
evidence : la preuve courte (texte du résultat). publishedAt / deadline : YYYY-MM-DD si visibles, sinon null. N'invente rien.
Réponds uniquement {"results":[{"id":"","state":"open|closed|unknown","evidence":"","publishedAt":null,"deadline":null}]}`;
  },

  today(items) {
    return `Voici les actions candidates d'une recherche d'emploi discrète (JSON). Classe-les par priorité pour aujourd'hui selon les échéances, le score des offres et l'avancement des candidatures. Pour chacune, une raison de 12 mots max. N'ajoute aucune action.
${JSON.stringify(items.map(({ id, label, detail, due }) => ({ id, label, detail, due })))}
Réponds uniquement {"ordered":[{"id":"","priority":1,"reason":""}]} (priorité 1 = urgent, 3 = peut attendre).`;
  },
};

/* Score final : chaque critère de la version active reçoit un taux (50 « non précisé » si l'IA l'a omis),
   puis computeScore applique toujours la même formule. */
function finalizeScore(s, ver) {
  const byId = Object.fromEntries((Array.isArray(s.matches) ? s.matches : []).filter((m) => m && m.c).map((m) => [String(m.c).trim().toUpperCase(), m]));
  const breakdown = criteriaList(ver).map((c) => {
    const m = byId[c.id];
    const raw = Number(m?.match);
    return { id: c.id, criterion: c.label, kind: c.kind, weight: c.weight, match: m && Number.isFinite(raw) ? clamp(Math.round(raw), 0, 100) : 50, note: m ? str(m.note) : "non évalué" };
  });
  const calc = computeScore(breakdown);
  return {
    method: 2,
    value: calc.value,
    wishAvg: calc.wishAvg,
    mustAvg: calc.mustAvg,
    fit: ["fort", "moyen", "faible"].includes(s.fit) ? s.fit : null,
    confidence: ["haute", "moyenne", "faible"].includes(s.confidence) ? s.confidence : "moyenne",
    confidenceReason: str(s.confidenceReason),
    summary: str(s.summary),
    breakdown,
    strengths: (s.strengths || []).map(String).slice(0, 6),
    gaps: (s.gaps || []).map(String).slice(0, 6),
    questions: (s.questions || []).map(String).slice(0, 5),
    redFlags: (s.redFlags || []).filter((r) => r && r.evidence).map((r) => ({ type: r.type || "autre", evidence: String(r.evidence) })),
    caps: calc.caps,
    criteriaVersionId: ver.id,
    scoredAt: nowISO(),
  };
}

/* ════════════════════════════════════════════════════════════════════════
   6. DONNÉES DE DÉMONSTRATION (étiquetées « exemple », supprimables en un clic)
   ════════════════════════════════════════════════════════════════════════ */

function makeCriteriaState(body = DEFAULT_CRITERIA_BODY) {
  const v = { id: uid("crit"), label: "v1 — critères initiaux", createdAt: nowISO(), ...deepClone(body) };
  return { draft: deepClone(body), versions: [v] };
}

function makeDemo(versionId) {
  const t = nowISO();
  const mk = (i, o, sc) => ({
    id: `demo_off_${i}`,
    collectedAt: addDays(t, -i),
    lastSeenAt: t,
    status: "new",
    demo: true,
    seniority: "Senior",
    contract: "CDI",
    salary: null,
    publishedAt: addDays(t, -i - 2).slice(0, 10),
    sources: [{ name: "Exemple (démo)", url: `https://example.com/exemple/offre-${i}`, collectedAt: addDays(t, -i), via: "démo", verified: null }],
    ...o,
    commute: estimateCommute(o.location),
    score: { ...sc, criteriaVersionId: versionId, scoredAt: t, caps: sc.caps || [], questions: sc.questions || [], confidenceReason: null },
  });
  const offers = [
    mk(1, {
      title: "Digital Transformation Manager (exemple)", company: "Exemple Logistics SA", location: "Wavre",
      remote: "Hybride, 2 jours sur site", language: "fr",
      description: "Exemple fictif. Pilotage de la feuille de route digitale, management d'une équipe de 5, gouvernance CRM, automatisation des processus.",
    }, {
      value: 84, confidence: "haute", summary: "Exemple : bon alignement management + CRM, trajet court.",
      breakdown: [
        { criterion: "Responsabilités managériales", kind: "indispensable", match: 90, note: "Équipe de 5 (exemple)" },
        { criterion: "Périmètre transformation digitale / CRM / IT", kind: "souhaité", weight: 5, match: 90, note: "Feuille de route digitale (exemple)" },
        { criterion: "Bon équilibre vie pro / vie privée", kind: "souhaité", weight: 4, match: 60, note: "non précisé" },
      ],
      strengths: ["Management d'équipe", "Gouvernance CRM"], gaps: ["Budget non précisé"], questions: ["Rattachement hiérarchique ?"], redFlags: [],
    }),
    mk(2, {
      title: "Head of CRM & Automation (exemple)", company: "Exemple Mutualité", location: "Bruxelles",
      remote: "Hybride", language: "nl", salary: null,
      description: "Exemple fictif. Direction de l'équipe CRM, migration vers Dynamics 365, automatisation marketing. Environnement bilingue.",
    }, {
      value: 78, confidence: "moyenne", summary: "Exemple : cœur de métier CRM, bilinguisme valorisé.",
      breakdown: [
        { criterion: "Responsabilités managériales", kind: "indispensable", match: 85, note: "Direction d'équipe (exemple)" },
        { criterion: "Environnement multilingue", kind: "souhaité", weight: 2, match: 95, note: "Bilingue FR/NL (exemple)" },
      ],
      strengths: ["Dynamics 365", "Bilinguisme"], gaps: ["Taille d'équipe non précisée"], redFlags: [],
    }),
    mk(3, {
      title: "Operations Excellence Lead (exemple)", company: "Exemple Pharma", location: "Braine-l'Alleud",
      remote: null, language: "en",
      description: "Exemple fictif. Amélioration continue, lean, rythme très soutenu et délais serrés annoncés.",
    }, {
      value: 58, confidence: "moyenne", summary: "Exemple : périmètre pertinent mais signal de forte pression.",
      breakdown: [
        { criterion: "Environnement à très forte pression", kind: "alerte", match: 80, note: "« rythme très soutenu » (exemple)" },
      ],
      strengths: ["Excellence opérationnelle"], gaps: ["Télétravail non précisé"], redFlags: [{ type: "stress", evidence: "« rythme très soutenu et délais serrés » (exemple)" }],
    }),
    mk(4, {
      title: "IT Manager PME (exemple)", company: "Exemple Industrie", location: "Nivelles",
      remote: "Sur site", language: "fr",
      description: "Exemple fictif. Gestion de l'infrastructure et du support, présence sur site requise.",
    }, {
      value: 42, confidence: "faible", summary: "Exemple : poste surtout infrastructure, peu de télétravail.",
      breakdown: [{ criterion: "Télétravail hybride possible", kind: "indispensable", match: 20, note: "Présence sur site requise (exemple)" }],
      strengths: [], gaps: ["Pas de télétravail"], redFlags: [], caps: ["indispensable non rempli"],
    }),
  ];
  offers[0].status = "pipeline";
  offers[1].status = "pipeline";
  const contacts = [
    { id: "demo_ct_1", name: "Recruteur Exemple", role: "Consultant senior", company: "Cabinet Exemple", email: "", linkedin: "", phone: "", type: "agency", notes: "Contact fictif de démonstration.", demo: true, createdAt: t },
  ];
  const sentAt = addDays(t, -8);
  const itv = new Date(addDays(t, 3)); itv.setHours(10, 0, 0, 0);
  const apps = [
    {
      id: "demo_app_1", offerId: "demo_off_1", stage: "sent", demo: true, createdAt: addDays(t, -12), updatedAt: sentAt, sentAt,
      closed: null, docs: {}, prep: null, contactIds: ["demo_ct_1"], interviews: [],
      followUps: [
        { id: "demo_fu_1", kind: "relance1", due: addDays(sentAt, 7), status: "pending", draft: null },
        { id: "demo_fu_2", kind: "relance2", due: addDays(sentAt, 14), status: "pending", draft: null },
      ],
      log: [
        { id: uid("log"), at: addDays(t, -12), type: "stage", text: "Ajoutée au pipeline (exemple)" },
        { id: uid("log"), at: sentAt, type: "stage", text: "Candidature envoyée (exemple)" },
      ],
    },
    {
      id: "demo_app_2", offerId: "demo_off_2", stage: "interview", demo: true, createdAt: addDays(t, -20), updatedAt: t, sentAt: addDays(t, -15),
      closed: null, docs: {}, prep: null, contactIds: [],
      interviews: [{ id: "demo_itv_1", at: itv.toISOString(), durationMin: 60, type: "Visioconférence", location: "Teams", notes: "Premier entretien RH (exemple)", eventCreated: false }],
      followUps: [{ id: "demo_fu_3", kind: "merci", due: addDays(itv.toISOString(), 2), status: "pending", draft: null }],
      log: [{ id: uid("log"), at: addDays(t, -2), type: "email", text: "Invitation à un entretien reçue (exemple)" }],
    },
  ];
  return { offers, apps, contacts };
}

/* ════════════════════════════════════════════════════════════════════════
   7. THÈME & PRIMITIVES D'INTERFACE
   ════════════════════════════════════════════════════════════════════════ */

const THEMES = {
  light: {
    dark: false,
    app: "bg-stone-50 text-stone-900",
    surface: "bg-white",
    sub: "bg-stone-100",
    subHover: "hover:bg-stone-100",
    muted: "text-stone-500",
    faint: "text-stone-400",
    strong: "text-stone-900",
    line: "border-stone-200",
    divide: "divide-stone-100",
    input: "bg-white border border-stone-200 text-stone-900 placeholder-stone-400",
    accentText: "text-indigo-600",
    accentSoft: "bg-indigo-50 text-indigo-700",
    chip: "bg-stone-100 text-stone-700",
    warn: "bg-amber-50 text-amber-900",
    danger: "bg-rose-50 text-rose-800",
    ok: "bg-emerald-50 text-emerald-800",
    btnPrimary: "bg-indigo-600 text-white hover:bg-indigo-700",
    btnSoft: "bg-stone-100 text-stone-800 hover:bg-stone-200",
    btnGhost: "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
    btnDanger: "bg-rose-50 text-rose-700 hover:bg-rose-100",
    ring: "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
    navActive: "bg-white text-stone-900",
    glass: { background: "rgba(255,255,255,0.78)", backdropFilter: "blur(18px) saturate(1.4)", WebkitBackdropFilter: "blur(18px) saturate(1.4)" },
    shadow: { boxShadow: "0 1px 2px rgba(28,25,23,0.04), 0 12px 32px -16px rgba(28,25,23,0.10)" },
    chart: { accent: "#4f46e5", neutral: "#d6d3d1", grid: "#f5f5f4", text: "#78716c" },
  },
  dark: {
    dark: true,
    app: "bg-stone-950 text-stone-100",
    surface: "bg-stone-900",
    sub: "bg-stone-800",
    subHover: "hover:bg-stone-800",
    muted: "text-stone-400",
    faint: "text-stone-500",
    strong: "text-stone-50",
    line: "border-stone-800",
    divide: "divide-stone-800",
    input: "bg-stone-900 border border-stone-700 text-stone-100 placeholder-stone-500",
    accentText: "text-indigo-300",
    accentSoft: "bg-indigo-950 text-indigo-200",
    chip: "bg-stone-800 text-stone-300",
    warn: "bg-amber-950 text-amber-200",
    danger: "bg-rose-950 text-rose-200",
    ok: "bg-emerald-950 text-emerald-200",
    btnPrimary: "bg-indigo-600 text-white hover:bg-indigo-500",
    btnSoft: "bg-stone-800 text-stone-100 hover:bg-stone-700",
    btnGhost: "text-stone-300 hover:bg-stone-800 hover:text-stone-50",
    btnDanger: "bg-rose-950 text-rose-200 hover:bg-rose-900",
    ring: "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900",
    navActive: "bg-stone-800 text-stone-50",
    glass: { background: "rgba(28,25,23,0.80)", backdropFilter: "blur(18px) saturate(1.3)", WebkitBackdropFilter: "blur(18px) saturate(1.3)" },
    shadow: { boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 12px 32px -16px rgba(0,0,0,0.6)" },
    chart: { accent: "#818cf8", neutral: "#57534e", grid: "#292524", text: "#a8a29e" },
  },
};
const ThemeCtx = createContext(THEMES.light);
const useT = () => useContext(ThemeCtx);

function Btn({ variant = "soft", size = "md", icon: Icon, loading, children, className = "", ...rest }) {
  const T = useT();
  const v = { primary: T.btnPrimary, soft: T.btnSoft, ghost: T.btnGhost, danger: T.btnDanger }[variant];
  const s = size === "sm" ? "h-8 px-3 text-xs gap-1.5" : size === "lg" ? "h-11 px-5 text-sm gap-2" : "h-9 px-3.5 text-sm gap-2";
  return (
    <button
      type="button"
      {...rest}
      disabled={loading || rest.disabled}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-xl font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${s} ${v} ${T.ring} ${className}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : Icon ? <Icon className="w-4 h-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function IconBtn({ icon: Icon, label, onClick, className = "", active, ...rest }) {
  const T = useT();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      {...rest}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-xl transition-colors duration-200 ${active ? T.accentSoft : T.btnGhost} ${T.ring} ${className}`}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}

function Card({ children, className = "", as: As = "div", ...rest }) {
  const T = useT();
  return (
    <As className={`${T.surface} rounded-3xl ${className}`} style={T.shadow} {...rest}>
      {children}
    </As>
  );
}

function Chip({ children, tone = "neutral", className = "", ...rest }) {
  const T = useT();
  const c = { neutral: T.chip, accent: T.accentSoft, warn: T.warn, danger: T.danger, ok: T.ok }[tone];
  return <span {...rest} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${c} ${className}`}>{children}</span>;
}

function ScorePill({ score, threshold, size = "md" }) {
  const T = useT();
  if (!score) return <span className={`inline-flex items-center justify-center rounded-full ${size === "lg" ? "w-14 h-14 text-lg" : "w-10 h-10 text-sm"} ${T.sub} ${T.faint} tabular-nums`} title="Non scorée">—</span>;
  const v = score.value;
  const tone = v >= threshold ? "bg-indigo-600 text-white" : v >= 50 ? `${T.sub} ${T.strong}` : `${T.sub} ${T.muted}`;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold tabular-nums ${size === "lg" ? "w-14 h-14 text-lg" : "w-10 h-10 text-sm"} ${tone}`}
      title={`Score ${v}/100 · confiance ${score.confidence}`}
    >
      {v}
    </span>
  );
}

function Field({ label, hint, children, className = "" }) {
  const T = useT();
  return (
    <label className={`block ${className}`}>
      <span className={`block text-xs font-medium mb-1.5 ${T.muted}`}>{label}</span>
      {children}
      {hint && <span className={`block text-xs mt-1 ${T.faint}`}>{hint}</span>}
    </label>
  );
}
function Input(props) {
  const T = useT();
  return <input {...props} className={`w-full h-10 rounded-xl px-3 text-sm transition-colors duration-150 ${T.input} ${T.ring} ${props.className || ""}`} />;
}
function Textarea(props) {
  const T = useT();
  return <textarea {...props} className={`w-full rounded-xl px-3 py-2.5 text-sm leading-relaxed ${T.input} ${T.ring} ${props.className || ""}`} />;
}
function Select({ children, ...props }) {
  const T = useT();
  return (
    <select {...props} className={`h-10 rounded-xl px-3 text-sm ${T.input} ${T.ring} ${props.className || ""}`}>
      {children}
    </select>
  );
}
function Toggle({ checked, onChange, label, description }) {
  const T = useT();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <div className={`text-xs mt-0.5 ${T.muted}`}>{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-10 h-6 rounded-full transition-colors duration-200 ${checked ? "bg-indigo-600" : T.dark ? "bg-stone-700" : "bg-stone-300"} ${T.ring}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${checked ? "translate-x-4" : ""}`} />
      </button>
    </div>
  );
}

function ChipInput({ values, onChange, placeholder, ariaLabel }) {
  const T = useT();
  const [text, setText] = useState("");
  const add = () => {
    const parts = text.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...values, ...parts.filter((p) => !values.includes(p))]);
    setText("");
  };
  return (
    <div className={`rounded-xl p-2 ${T.input}`}>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className={`inline-flex items-center gap-1 rounded-lg pl-2.5 pr-1 py-1 text-xs ${T.chip}`}>
            {v}
            <button type="button" aria-label={`Retirer ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className={`rounded p-0.5 ${T.subHover} ${T.ring}`}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          aria-label={ariaLabel || placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
            if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
          }}
          onBlur={add}
          placeholder={placeholder}
          className="flex-1 min-w-32 bg-transparent text-sm px-1 py-1 outline-none"
        />
      </div>
    </div>
  );
}

function Empty({ icon: Icon = Inbox, title, text, action }) {
  const T = useT();
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${T.sub}`}>
        <Icon className={`w-6 h-6 ${T.faint}`} aria-hidden="true" />
      </div>
      <div className="text-base font-medium">{title}</div>
      {text && <p className={`text-sm mt-1 max-w-sm ${T.muted}`}>{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function Skeleton({ lines = 3 }) {
  const T = useT();
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-4 rounded-lg animate-pulse ${T.sub}`} style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

function Notice({ tone = "neutral", icon: Icon = Info, children, className = "" }) {
  const T = useT();
  const c = { neutral: T.sub, warn: T.warn, danger: T.danger, ok: T.ok, accent: T.accentSoft }[tone];
  return (
    <div className={`flex gap-3 rounded-2xl px-4 py-3 text-sm ${c} ${className}`} role={tone === "danger" ? "alert" : undefined}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SectionTitle({ children, action, className = "" }) {
  const T = useT();
  return (
    <div className={`flex items-center justify-between gap-3 mb-3 ${className}`}>
      <h3 className={`text-xs font-semibold uppercase tracking-wider ${T.muted}`}>{children}</h3>
      {action}
    </div>
  );
}

function PageHeader({ title, subtitle, actions }) {
  const T = useT();
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-light tracking-tight">{title}</h1>
        {subtitle && <p className={`mt-2 text-sm ${T.muted}`}>{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TRAP_STACK = []; // seule la couche du dessus (modale > panneau) réagit au clavier
function useFocusTrap(open, ref, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const token = {};
    TRAP_STACK.push(token);
    const prev = document.activeElement;
    const el = ref.current;
    const focusables = () => el ? [...el.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled) : [];
    setTimeout(() => { const f = focusables(); (el?.querySelector("[data-autofocus]") || f[0])?.focus(); }, 30);
    const onKey = (e) => {
      if (TRAP_STACK[TRAP_STACK.length - 1] !== token) return;
      if (e.key === "Escape") { e.stopPropagation(); onClose?.(); }
      if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      const i = TRAP_STACK.indexOf(token);
      if (i >= 0) TRAP_STACK.splice(i, 1);
      prev?.focus?.();
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
}

function Modal({ open, onClose, title, children, footer, wide }) {
  const T = useT();
  const ref = useRef(null);
  useFocusTrap(open, ref, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0" style={{ background: "rgba(12,10,9,0.35)" }} onClick={onClose} />
      <div
        ref={ref}
        className={`relative w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} max-h-screen sm:max-h-full overflow-hidden rounded-t-3xl sm:rounded-3xl flex flex-col`}
        style={{ ...T.glass, ...T.shadow, maxHeight: "92vh" }}
      >
        <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3">
          <h2 className="text-lg font-medium tracking-tight">{title}</h2>
          <IconBtn icon={X} label="Fermer" onClick={onClose} />
        </div>
        <div className="px-6 pb-6 overflow-y-auto">{children}</div>
        {footer && <div className={`px-6 py-4 border-t ${T.line} flex flex-wrap justify-end gap-2`}>{footer}</div>}
      </div>
    </div>
  );
}

function Drawer({ open, onClose, title, subtitle, children, headerExtra, expandable }) {
  const T = useT();
  const ref = useRef(null);
  const [wide, setWide] = useState(false);
  useFocusTrap(open, ref, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0" style={{ background: "rgba(12,10,9,0.25)" }} onClick={onClose} />
      <aside ref={ref} className={`absolute right-0 top-0 h-full w-full ${wide ? "sm:max-w-5xl" : "sm:max-w-2xl"} flex flex-col ${T.app}`} style={{ ...T.shadow, transition: "max-width .2s" }}>
        <div className={`flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b ${T.line}`}>
          <div className="min-w-0">
            <h2 className="text-xl font-light tracking-tight leading-snug">{title}</h2>
            {subtitle && <div className={`text-sm mt-1 ${T.muted}`}>{subtitle}</div>}
            {headerExtra}
          </div>
          <div className="flex shrink-0 gap-1">
            {expandable && <IconBtn icon={wide ? Minimize2 : Maximize2} label={wide ? "Réduire le panneau" : "Agrandir le panneau"} onClick={() => setWide((w) => !w)} className="hidden sm:inline-flex" />}
            <IconBtn icon={X} label="Fermer" onClick={onClose} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </aside>
    </div>
  );
}

function Tabs({ tabs, value, onChange, compact }) {
  const T = useT();
  return (
    <div role="tablist" className={`inline-flex ${compact ? "" : "flex-wrap"} gap-1 p-1 rounded-2xl ${T.sub}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`${compact ? "px-2.5 whitespace-nowrap" : "px-3"} h-8 rounded-xl text-sm transition-colors duration-150 ${value === t.id ? `${T.navActive} font-medium` : T.muted} ${T.ring}`}
          style={value === t.id ? T.shadow : undefined}
        >
          {t.label}
          {t.count !== undefined && <span className={`ml-1.5 tabular-nums ${T.faint}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

function CopyBtn({ text, label = "Copier", size = "sm" }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text || "");
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text || "";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      } catch { /* presse-papiers indisponible */ }
    }
  };
  return <Btn size={size} variant="ghost" icon={done ? Check : Copy} onClick={copy}>{done ? "Copié" : label}</Btn>;
}

function ExtLink({ href, children, className = "" }) {
  const T = useT();
  if (!href) return <span className={T.faint}>{children || NC}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 underline-offset-4 hover:underline ${T.accentText} ${T.ring} rounded ${className}`}>
      {children || hostOf(href)}
      <ExternalLink className="w-3 h-3" aria-hidden="true" />
    </a>
  );
}

function MatchBar({ value, kind }) {
  const T = useT();
  const inverse = kind === "exclusion" || kind === "alerte";
  const color = inverse ? (value >= 70 ? "bg-rose-500" : T.dark ? "bg-stone-600" : "bg-stone-300") : value >= 70 ? "bg-indigo-600" : value >= 40 ? (T.dark ? "bg-stone-400" : "bg-stone-500") : T.dark ? "bg-stone-600" : "bg-stone-300";
  return (
    <div className={`h-1.5 w-full rounded-full overflow-hidden ${T.sub}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%`, transition: "width 250ms" }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   8. APPLICATION — état, persistance, actions
   ════════════════════════════════════════════════════════════════════════ */

const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);
const FONT = '"Inter", "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const NAV = [
  { id: "dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: "offers", label: "Offres", icon: Briefcase },
  { id: "pipeline", label: "Pipeline", icon: Columns },
  { id: "assistant", label: "Assistant candidature", icon: Sparkles },
  { id: "followups", label: "Relances & agenda", icon: BellRing },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "sources", label: "Sources & collecte", icon: Radio },
  { id: "profile", label: "Profil & critères", icon: User },
  { id: "privacy", label: "Confidentialité & données", icon: ShieldCheck },
];

function usePersist(key, value, enabled, onState) {
  useEffect(() => {
    if (!enabled) return undefined;
    const t = setTimeout(async () => {
      try {
        onState("saving");
        await storage.set(key, value);
        onState("saved");
      } catch (e) {
        onState(`error:${e.message || e}`);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [value, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}

function usePrefersDark() {
  const read = () => {
    if (typeof window === "undefined") return false;
    const forced = document.documentElement.getAttribute("data-theme");
    if (forced === "dark" || forced === "light") return forced === "dark";
    return !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  };
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const h = () => setDark(read());
    mq?.addEventListener?.("change", h);
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(h) : null;
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { mq?.removeEventListener?.("change", h); mo?.disconnect(); };
  }, []);
  return dark;
}

export default function RadarApp() {
  const [loaded, setLoaded] = useState(false);
  const [storageState, setStorageState] = useState({ ok: true, readOnly: false, message: null });
  const [bootMsg, setBootMsg] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [criteria, setCriteria] = useState(() => makeCriteriaState());
  const [sources, setSources] = useState(DEFAULT_SOURCES);
  const [offers, setOffers] = useState([]);
  const [apps, setApps] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [ratings, setRatings] = useState({});
  const [briefs, setBriefs] = useState({});
  const [media, setMedia] = useState(DEFAULT_MEDIA);
  const [offerQueue, setOfferQueue] = useState([]);

  const [view, setView] = useState("dashboard");
  const [offerSel, setOfferSel] = useState(null);
  const [appSel, setAppSel] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState({});
  const [progress, setProgress] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [stageDialog, setStageDialog] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [todayAI, setTodayAI] = useState(null);
  const [offerPreset, setOfferPreset] = useState(null);
  const [dupeProposals, setDupeProposals] = useState(null);
  const [dupePending, setDupePending] = useState(null);
  const [lastBulk, setLastBulk] = useState(null);
  const [visitPrev, setVisitPrev] = useState(null);
  const [replyProposals, setReplyProposals] = useState(null);
  const [genStatus, setGenStatus] = useState({});
  const [studio, setStudio] = useState(null);
  const [spontOpen, setSpontOpen] = useState(false);
  const [veille, setVeille] = useState({ routine: null, status: null, configSig: null, configLoaded: false });
  const veilleRef = useRef(veille);
  veilleRef.current = veille;

  const prefersDark = usePrefersDark();
  const dark = settings.theme === "dark" || (settings.theme === "system" && prefersDark);
  const T = dark ? THEMES.dark : THEMES.light;

  /* Référence toujours à jour pour les traitements asynchrones longs. */
  const R = useRef({});
  R.current = { settings, profile, criteria, sources, offers, apps, contacts, ratings, briefs };
  const busyRef = useRef({});

  /* ── Chargement initial ─────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const applyDefaults = () => {
        const crit = makeCriteriaState();
        const demo = makeDemo(activeVersion(crit).id);
        setCriteria(crit);
        setOffers(demo.offers);
        setApps(demo.apps);
        setContacts(demo.contacts);
      };
      await initRuntime();
      if (!storage.available()) {
        setStorageState({
          ok: false, readOnly: true,
          message: RT.mode === "published"
            ? "Connectez-vous à claude.ai pour enregistrer vos données : en attendant, rien n'est conservé après fermeture."
            : "window.storage n'est pas disponible ici : les données ne seront pas conservées après fermeture.",
        });
        applyDefaults();
        setLoaded(true);
        return;
      }
      try {
        let existing = null;
        try { existing = await storage.list("radar:"); } catch { existing = null; }
        const out = {};
        const repaired = [];
        /* Collection illisible : copie brute mise de côté, puis récupération élément par élément (ou valeurs par défaut). */
        const recover = async (name, key, e) => {
          const items = SALVAGE[name] ? salvageArray(e.raw, SALVAGE[name]) : null;
          // Offres publiées : les tranches v1 restent en place et servent de copie brute.
          if (!(RT.mode === "published" && name === "offers")) {
            try { await storage.set(`radar:backup:${name}`, String(e.raw || "")); } catch { /* sauvegarde best effort */ }
          }
          repaired.push({ name, count: items ? items.length : null, at: nowISO() });
          return items;
        };
        for (const [name, key] of Object.entries(KEYS)) {
          if (RT.mode === "published" && name === "offers") {
            setBootMsg("Lecture des offres…");
            let list = await offerStore.load();
            if (list === null) {
              // Première ouverture depuis le format v1 : migration vers un document par offre.
              try { list = await storage.get(key); } catch (e) { if (!(e instanceof StoreCorrupt)) throw e; list = await recover(name, key, e); }
              if (Array.isArray(list) && list.length) {
                setBootMsg(`Migration de ${list.length} offres vers le nouveau format (une seule fois)…`);
                try { await offerStore.writeAll(list, { migratedFrom: "v1" }); }
                catch { offerStore.pendingMigration = true; }
              }
            }
            out[name] = list;
            continue;
          }
          if (existing && !existing.includes(key)) { out[name] = null; continue; }
          try {
            out[name] = await storage.get(key);
          } catch (e) {
            if (e instanceof StoreCorrupt) { out[name] = await recover(name, key, e); continue; }
            if (existing || RT.mode === "published") throw e; // lecture en échec (réseau) : on n'écrase rien
            out[name] = null; // sans liste, une erreur signifie le plus souvent « clé absente »
          }
        }
        if (repaired.length) setRecovery(repaired);
        const first = Object.values(out).every((v) => v === null || v === undefined);
        if (first) {
          applyDefaults();
        } else {
          const s = out.settings || {};
          // Visite : la « dernière visite » n'avance que si la précédente date de plus de 2 h.
          const lastV = s.lastVisitAt ? new Date(s.lastVisitAt).getTime() : 0;
          const prevV = lastV && Date.now() - lastV > 2 * 36e5 ? s.lastVisitAt : s.visitPrevAt || s.lastVisitAt || null;
          setVisitPrev(prevV);
          setSettings({
            ...DEFAULT_SETTINGS, ...s,
            mcp: { ...DEFAULT_SETTINGS.mcp, ...(s.mcp || {}) },
            mcpTools: { ...DEFAULT_SETTINGS.mcpTools, ...(s.mcpTools || {}) },
            followUp: { ...DEFAULT_SETTINGS.followUp, ...(s.followUp || {}) },
            visitPrevAt: prevV, lastVisitAt: nowISO(),
          });
          if (out.profile) setProfile({ ...DEFAULT_PROFILE, ...out.profile });
          setCriteria(out.criteria?.versions?.length ? out.criteria : makeCriteriaState());
          if (out.sources) {
            const have = new Set(out.sources.map((x) => x.id));
            const missing = (s.sourcesPack || 0) < 2 ? TOP_EMPLOYERS.filter((x) => !have.has(x.id)) : [];
            setSources([...out.sources, ...missing]);
            if (missing.length) setSettings((x) => ({ ...x, sourcesPack: 2 }));
          }
          const closedOffers = new Set((out.apps || []).filter((a) => a.stage === "closed").map((a) => a.offerId));
          let list = (out.offers || []).map((o) => (closedOffers.has(o.id) && o.status !== "closed" ? { ...o, status: "closed" } : o));
          // Tri systématique à chaque ouverture : doublons fusionnés, puis règles (âge, date limite, intitulé, trajet…).
          const merged = s.autoDedupe === false ? 0 : (() => { const d = dedupeLocal(list, out.apps); list = d.list; return d.merged; })();
          const crit0 = out.criteria?.versions?.length ? activeVersion(out.criteria) : null;
          const ruled = crit0 ? applyRules(list, crit0, rulesOf(s)) : { list, prev: [], counts: {} };
          list = ruled.list;
          setOffers(list);
          if (ruled.prev.length || merged) {
            setLastBulk({
              label: `À l'ouverture : ${merged ? `${merged} doublon(s) fusionné(s)` : ""}${merged && ruled.prev.length ? " · " : ""}${ruled.prev.length ? `${ruled.prev.length} offre(s) triée(s) automatiquement (${Object.entries(ruled.counts).map(([k, n]) => `${n} ${RULE_LABEL[k]}`).join(", ")})` : ""}`,
              prev: ruled.prev, at: nowISO(), undoable: ruled.prev.length > 0,
            });
          }
          if (out.ratings) setRatings(out.ratings);
          if (out.briefs) setBriefs(out.briefs);
          if (out.media) setMedia({ ...DEFAULT_MEDIA, ...out.media });
          setApps(out.apps || []);
          setContacts(out.contacts || []);
        }
      } catch (e) {
        setStorageState({ ok: false, readOnly: true, retry: true, message: `Connexion au stockage impossible (${e?.message || e?.code || e}). Vos données ne sont pas touchées : l'enregistrement reste suspendu tant que la lecture n'a pas réussi.` });
        applyDefaults();
      } finally {
        setBootMsg(null);
        setLoaded(true);
      }
    })();
  }, []);

  /* Police Inter (échec silencieux si le chargement externe est bloqué). */
  useEffect(() => {
    try {
      if (document.getElementById("radar-font")) return;
      const l = document.createElement("link");
      l.id = "radar-font";
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap";
      document.head.appendChild(l);
    } catch { /* ignore */ }
  }, []);

  const persistOn = loaded && !storageState.readOnly;
  usePersist(KEYS.settings, settings, persistOn, setSaveState);
  usePersist(KEYS.profile, profile, persistOn, setSaveState);
  usePersist(KEYS.criteria, criteria, persistOn, setSaveState);
  usePersist(KEYS.sources, sources, persistOn, setSaveState);
  usePersist(KEYS.offers, offers, persistOn, setSaveState);
  usePersist(KEYS.apps, apps, persistOn, setSaveState);
  usePersist(KEYS.contacts, contacts, persistOn, setSaveState);
  usePersist(KEYS.ratings, ratings, persistOn, setSaveState);
  usePersist(KEYS.briefs, briefs, persistOn, setSaveState);
  usePersist(KEYS.media, media, persistOn, setSaveState);

  /* ── Utilitaires d'état ─────────────────────────────────────────── */
  const toast = useCallback((text, tone = "neutral") => {
    const id = uid("t");
    setToasts((l) => [...l.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), tone === "danger" ? 8000 : 4500);
  }, []);

  const withBusy = useCallback(async (key, fn) => {
    if (busyRef.current[key]) return undefined;
    busyRef.current[key] = true;
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      return await fn();
    } catch (e) {
      toast(e?.message || String(e), "danger");
      return undefined;
    } finally {
      delete busyRef.current[key];
      setBusy((b) => { const n = { ...b }; delete n[key]; return n; });
    }
  }, [toast]);

  const patchOffer = (id, patch) => setOffers((l) => l.map((o) => (o.id === id ? { ...o, ...(typeof patch === "function" ? patch(o) : patch) } : o)));
  const patchSource = (id, patch) => setSources((l) => l.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  /* Texte complet de l'annonce (base de l'analyse ATS) : mis à jour aussi dans la référence courante pour une génération immédiate. */
  const patchOfferNow = (offerId, patch) => {
    R.current.offers = R.current.offers.map((o) => (o.id === offerId ? { ...o, ...patch } : o));
    patchOffer(offerId, patch);
  };
  const setOfferAdText = (offerId, text) => patchOfferNow(offerId, { fullText: String(text || "").trim().slice(0, 20000) || null });

  /* Candidature spontanée (entreprise ciblée, sans offre) ou CV de base (ni offre ni entreprise) : une « cible » rédigée comme une offre,
     hors veille, scoring et statistiques. La candidature spontanée entre dans le pipeline ; le CV de base reste dans l'Assistant. */
  const createSpontaneous = (d) => {
    const t = nowISO();
    const base = d.mode === "base";
    const site = str(d.website);
    const offer = {
      id: uid("off"), spontaneous: base ? "base" : "company",
      title: str(d.role) || "Rôle à préciser", company: base ? null : str(d.company), location: str(d.location),
      commute: base ? null : estimateCommute(d.location), contract: null, seniority: null, salary: null, remote: null,
      language: /^(fr|nl|en)$/.test(d.language) ? d.language : "fr", publishedAt: null,
      description: str(d.context), fullText: str(d.context) ? String(d.context).trim().slice(0, 20000) : null, contactName: str(d.contactName),
      collectedAt: t, lastSeenAt: t,
      sources: [{ name: SPONT_LABEL[base ? "base" : "company"], url: site ? (/^https?:\/\//i.test(site) ? site : `https://${site}`) : null, collectedAt: t, via: "manuel", verified: null }],
      status: "pipeline", score: null, demo: false,
    };
    const app = {
      id: uid("app"), offerId: offer.id, kind: base ? "base" : "spontaneous", stage: "prep", createdAt: t, updatedAt: t, sentAt: null, closed: null,
      docs: {}, prep: null, contactIds: [], interviews: [], followUps: [], demo: false,
      log: [{ id: uid("log"), at: t, type: "stage", text: base ? `CV de base créé : ${offer.title}` : `Candidature spontanée créée : ${offer.title} — ${offer.company || NC}` }],
    };
    R.current.offers = [offer, ...R.current.offers];
    R.current.apps = [app, ...R.current.apps];
    setOffers((l) => [offer, ...l]);
    setApps((l) => [app, ...l]);
    setStudio({ appId: app.id, type: "cv" });
    return app.id;
  };
  const addLogEntry = (a, type, text) => ({ ...a, updatedAt: nowISO(), log: [...(a.log || []), { id: uid("log"), at: nowISO(), type, text }] });
  const patchApp = (id, fn) => setApps((l) => l.map((a) => (a.id === id ? fn(a) : a)));
  const logApp = (id, type, text) => patchApp(id, (a) => addLogEntry(a, type, text));
  /* Arrivée d'offres : fusion des doublons, puis règles de tri appliquées aux nouvelles ; le scoring et la
     détection IA des doublons suivent automatiquement (effets plus bas). */
  const applyIncoming = (incoming) => {
    const { list, added, merged } = mergeOffers(R.current.offers, incoming);
    const ver = activeVersion(R.current.criteria);
    const ruled = applyRules(list, ver, rulesOf(R.current.settings), new Set(added));
    R.current.offers = ruled.list;
    setOffers(ruled.list);
    const filtered = ruled.prev.length;
    if (added.length) arrivalsRef.current += added.length - filtered;
    return { added, merged, filtered, kept: added.filter((id) => !ruled.prev.some((o) => o.id === id)) };
  };
  const arrivalsRef = useRef(0);

  /* ── Scoring ────────────────────────────────────────────────────── */
  const autoScoreRef = useRef({ failed: new Set(), done: 0, off: false });
  const scoreOffers = (ids, { auto = false } = {}) => withBusy("score", async () => {
    const { settings: s, profile: p, criteria: c } = R.current;
    const ver = activeVersion(c);
    const targets = R.current.offers.filter((o) => ids.includes(o.id) && !o.spontaneous);
    if (!targets.length) return;
    setProgress({ label: auto ? "Scoring automatique" : "Scoring", done: 0, total: targets.length });
    let ok = 0, failed = 0, dismissed = 0;
    const rules = rulesOf(s);
    await pool(chunk(targets, 5), 2, async (batch) => {
      try {
        const { data } = await askJSON(s, { system: SYSTEM_BASE, prompt: P.score(batch, p, ver, ver.label), maxTokens: 14000 });
        const byId = Object.fromEntries((Array.isArray(data?.scores) ? data.scores : []).filter((x) => x && x.id).map((x) => [x.id, x]));
        const got = batch.filter((o) => byId[o.id]).length;
        ok += got;
        failed += batch.length - got;
        batch.filter((o) => !byId[o.id]).forEach((o) => autoScoreRef.current.failed.add(o.id));
        const at = nowISO();
        const next = R.current.offers.map((o) => {
          if (!byId[o.id]) return o;
          const n = { ...o, score: finalizeScore(byId[o.id], ver) };
          const v = ruleVerdict(n, ver, rules);
          if (v) { dismissed++; return applyVerdict(n, v, at); }
          return n;
        });
        R.current.offers = next;
        setOffers(next);
      } catch (e) {
        failed += batch.length;
        batch.forEach((o) => autoScoreRef.current.failed.add(o.id));
        if (/refusé|not_granted|désactivé|disponible/i.test(e.message || "")) autoScoreRef.current.off = true;
        toast(`Scoring : ${e.message}`, "danger");
      } finally {
        setProgress((pr) => pr && { ...pr, done: Math.min(pr.total, pr.done + batch.length) });
      }
    });
    setProgress(null);
    if (auto) autoScoreRef.current.done += ok;
    toast(`${ok} offre(s) scorée(s)${dismissed ? ` · ${dismissed} écartée(s) (score < ${rules.dismissBelow})` : ""}${failed ? ` · ${failed} non scorée(s)` : ""}`, failed ? "warn" : "ok");
  });

  const staleIds = useMemo(() => {
    const vid = activeVersion(criteria)?.id;
    return offers.filter((o) => !o.demo && !o.spontaneous && ["new", "pipeline"].includes(o.status) && isStale(o, vid)).map((o) => o.id);
  }, [offers, criteria]);

  /* Scoring systématique : toute offre à traiter sans score à jour est scorée automatiquement (par lots, plafonné par session). */
  useEffect(() => {
    if (!loaded || storageState.readOnly || !settings.autoScore || RT.mode === "none" || (RT.mode === "published" && !RT.sample)) return undefined;
    const a = autoScoreRef.current;
    if (a.off || a.done >= (settings.autoScoreMax || 60) * 2) return undefined;
    const t = setTimeout(() => {
      if (busyRef.current.score) return;
      const vid = activeVersion(R.current.criteria)?.id;
      const ids = R.current.offers
        .filter((o) => !o.demo && !o.spontaneous && ["new", "pipeline"].includes(o.status) && isStale(o, vid) && !a.failed.has(o.id))
        .sort((x, y) => (x.status === "pipeline" ? -1 : 0) - (y.status === "pipeline" ? -1 : 0) || new Date(y.collectedAt) - new Date(x.collectedAt))
        .slice(0, settings.autoScoreMax || 60)
        .map((o) => o.id);
      if (ids.length) scoreOffers(ids, { auto: true });
    }, 2500);
    return () => clearTimeout(t);
  }, [loaded, staleIds.length, settings.autoScore, busy.score]); // eslint-disable-line react-hooks/exhaustive-deps

  const rescoreStale = () => {
    const vid = activeVersion(R.current.criteria)?.id;
    const ids = R.current.offers
      .filter((o) => !o.demo && ["new", "pipeline"].includes(o.status) && isStale(o, vid))
      .sort((a, b) => new Date(b.collectedAt) - new Date(a.collectedAt))
      .slice(0, 80)
      .map((o) => o.id);
    if (!ids.length) { toast("Tous les scores sont à jour.", "ok"); return undefined; }
    return scoreOffers(ids);
  };

  /* ── Collecte ───────────────────────────────────────────────────── */
  const sourceDomains = (src) => {
    if (src.kind === "company") { const h = hostOf(src.careersUrl); return h ? [h] : []; }
    return src.domains || [];
  };

  const runWatch = ({ sourceIds, version } = {}) => withBusy("watch", async () => {
    if (RT.mode === "published") {
      const trig = veilleRef.current.routine?.triggerId;
      if (!trig) throw new Error("La veille planifiée n'est pas encore reliée à cette page. En attendant : alertes Gmail, annonce collée ou import JSON.");
      if (!RT.mcp || !RT.db) throw new Error("Connexion claude.ai requise pour lancer la veille.");
      const cfg = veilleConfig(version || activeVersion(R.current.criteria), R.current.sources, R.current.settings, sourceIds);
      if (!cfg.sources.length) throw new Error("Aucune source web active. Activez des sources dans « Sources & collecte ».");
      const { sig, ...payload } = cfg;
      try {
        await RT.mcp.callTool("Claude Code Remote", "fire_trigger", {
          trigger_id: trig,
          text: `Lancement manuel depuis la page Radar (${new Date().toLocaleString("fr-BE")}). Utilise CETTE configuration plutôt que veille/config :\n${JSON.stringify(payload)}`,
        });
      } catch (e) {
        throw new Error(`Lancement impossible (${e?.message || e?.code || "connecteur Claude Code Remote"}). Autorisez ce connecteur pour la page puis réessayez.`);
      }
      await RT.db.doc("veille/status").set({ state: "requested", requestedAt: nowISO(), message: sourceIds ? `Sources : ${payload.sources.map((x) => x.name).join(", ")}` : null }).catch(() => {});
      toast("Veille lancée. Les offres arriveront ici d'elles-mêmes d'ici 5 à 15 minutes, même si vous fermez la page.", "ok");
      return;
    }
    const s = R.current.settings;
    const crit = version || activeVersion(R.current.criteria);
    const list = R.current.sources.filter((x) => (sourceIds ? sourceIds.includes(x.id) : x.enabled) && x.kind !== "email");
    if (!list.length) throw new Error("Aucune source web active. Activez des sources dans « Sources & collecte ».");
    const newIds = [];
    let merged = 0, errors = 0, filteredN = 0;
    setProgress({ label: "Veille", done: 0, total: list.length });
    await pool(list, 3, async (src) => {
      try {
        const domains = sourceDomains(src);
        const res = await askJSON(s, {
          system: SYSTEM_BASE,
          prompt: P.search(src, crit, s),
          web: { domains, maxUses: 6 },
          maxTokens: 10000,
        });
        const raw = Array.isArray(res.data?.offers) ? res.data.offers : [];
        // Garde-fou anti-invention : une URL absente des résultats de recherche ET hors du domaine de la source est écartée.
        const resultHosts = new Set(res.urls.map(hostOf).filter(Boolean));
        const onSource = (u) => { const h = hostOf(u); return !!h && (resultHosts.has(h) || domains.some((d) => h === d || h.endsWith(`.${d}`))); };
        const norm = raw
          .map((r) => normalizeOffer(r, { sourceName: src.name, via: "web_search", verifiedUrls: res.urls }))
          .filter((o) => o && (o.sources[0].verified || !res.urls.length || onSource(o.sources[0].url)));
        const r = applyIncoming(norm);
        newIds.push(...r.kept);
        filteredN += r.filtered;
        merged += r.merged.length;
        patchSource(src.id, { lastRunAt: nowISO(), lastCount: norm.length, lastError: null, lastNote: str(res.data?.notes) });
      } catch (e) {
        errors++;
        patchSource(src.id, { lastRunAt: nowISO(), lastError: e.message });
      } finally {
        setProgress((p) => p && { ...p, done: p.done + 1 });
      }
    });
    setProgress(null);
    setSettings((x) => ({ ...x, lastWatchAt: nowISO() }));
    toast(`Veille terminée : ${newIds.length} nouvelle(s) offre(s) retenue(s), ${filteredN} écartée(s) par les règles, ${merged} fusion(s)${errors ? `, ${errors} source(s) en erreur` : ""}`, errors ? "warn" : "ok");
    if (newIds.length) await scoreOffers(newIds);
  });

  const importGmail = (days) => withBusy("gmail", async () => {
    const s = R.current.settings;
    const res = await askJSON(s, {
      system: SYSTEM_BASE,
      prompt: P.gmail(days || s.gmailDays),
      mcp: [{ server: "gmail", allow: s.mcpTools.gmailRead }],
      maxTokens: 16000,
    });
    if (res.toolCalls.some((n) => /send|trash|delete|modify|label|forward|reply|spam/i.test(n))) {
      toast(`Attention : outil Gmail inattendu appelé (${res.toolCalls.join(", ")}). Vérifiez votre boîte.`, "danger");
    }
    if (!res.toolCalls.length) throw new Error("Gmail n'a pas été consulté : vérifiez que le connecteur Gmail est activé et autorisé pour cet artefact.");
    const raw = Array.isArray(res.data?.offers) ? res.data.offers : [];
    const norm = raw.map((r) => normalizeOffer(r, { sourceName: "Alerte e-mail", via: "gmail", toolText: res.toolText })).filter(Boolean);
    const r = applyIncoming(norm);
    setSettings((x) => ({ ...x, lastGmailImportAt: nowISO() }));
    setSources((l) => l.map((x) => (x.kind === "email" ? { ...x, lastRunAt: nowISO(), lastCount: norm.length, lastError: null } : x)));
    toast(`Gmail : ${res.data?.messagesRead ?? "?"} e-mail(s) lu(s), ${r.kept.length} nouvelle(s) offre(s), ${r.filtered} écartée(s) par les règles, ${r.merged.length} fusion(s)`, "ok");
    if (r.kept.length) await scoreOffers(r.kept);
  });

  const importManual = ({ text, url }) => withBusy("manual", async () => {
    const s = R.current.settings;
    const cleanUrl = str(url);
    if (RT.mode === "published" && !str(text)) throw new Error("Dans cette version, la recherche web n'est pas disponible : collez le texte de l'annonce (l'URL sera conservée).");
    const res = await askJSON(s, {
      system: SYSTEM_BASE,
      prompt: P.structure({ text: str(text), url: cleanUrl }),
      web: cleanUrl && !str(text) ? { maxUses: 4 } : null,
      maxTokens: 6000,
    });
    if (!res.data?.found || !res.data.offer) throw new Error(`Annonce non retrouvée${res.data?.reason ? ` (${res.data.reason})` : ""}. Collez plutôt le texte de l'annonce.`);
    const o = normalizeOffer(
      { ...res.data.offer, url: cleanUrl || res.data.offer.url },
      { sourceName: "Import manuel", via: str(text) ? "texte collé" : "URL + web_search", allowNoUrl: true },
    );
    if (!o) throw new Error("Impossible de structurer cette annonce (intitulé manquant).");
    if (o.sources[0].url) o.sources[0].verified = cleanUrl ? true : (text || "").includes(o.sources[0].url);
    if (str(text)) o.fullText = str(text).slice(0, 20000);
    const r = applyIncoming([o]);
    toast(r.added.length ? (r.filtered ? "Annonce importée, mais écartée par vos règles (voir l'onglet Écartées)" : "Annonce importée et structurée") : "Annonce déjà connue : sources fusionnées", r.filtered ? "warn" : "ok");
    if (r.kept.length) await scoreOffers(r.kept);
    return r.added[0] || r.merged[0];
  });

  const importOffersJSON = (text) => withBusy("json-import", async () => {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error(`JSON invalide : ${e.message}`); }
    const raw = Array.isArray(obj) ? obj : Array.isArray(obj?.offers) ? obj.offers : null;
    if (!raw) throw new Error("Format attendu : un tableau d'offres, ou {\"offers\": [...]}.");
    const norm = raw.map((r) => normalizeOffer(r, { sourceName: str(r?.sourceName) || str(r?.source) || "Import JSON", via: "import JSON" })).filter(Boolean);
    const skipped = raw.length - norm.length;
    const r = applyIncoming(norm);
    toast(`Import JSON : ${r.kept.length} nouvelle(s), ${r.filtered} écartée(s) par les règles, ${r.merged.length} fusion(s)${skipped ? `, ${skipped} ignorée(s) (intitulé ou URL manquant)` : ""}`, skipped ? "warn" : "ok");
    if (r.kept.length) await scoreOffers(r.kept);
    return true;
  });

  /* ── Doublons : détection IA, fusion validée, annulable ──────────── */
  const inPipeline = (oid) => R.current.apps.some((a) => a.offerId === oid);
  const detectDuplicates = ({ auto = false } = {}) => withBusy("dedupe", async () => {
    const pool0 = R.current.offers
      .filter((o) => !o.demo && ["new", "pipeline"].includes(o.status))
      .sort((a, b) => companyKey(a.company).localeCompare(companyKey(b.company)) || cleanTitle(a.title).localeCompare(cleanTitle(b.title)))
      .slice(0, 240);
    setSettings((x) => ({ ...x, lastAiDedupeAt: nowISO() }));
    if (pool0.length < 2) { if (!auto) toast("Pas assez d'offres pour rechercher des doublons.", "neutral"); return; }
    const known = new Set(pool0.map((o) => o.id));
    const used = new Set();
    const groups = [];
    for (const batch of chunk(pool0, 60)) {
      const { data } = await askJSON(R.current.settings, { system: SYSTEM_BASE, prompt: P.dedupe(batch), maxTokens: 6000 });
      for (const g of Array.isArray(data?.groups) ? data.groups : []) {
        const ids = [...new Set((g.ids || []).filter((id) => known.has(id) && !used.has(id)))];
        if (ids.length < 2) continue;
        if (ids.filter(inPipeline).length > 1) continue; // deux candidatures distinctes : on ne fusionne pas
        ids.forEach((id) => used.add(id));
        groups.push({ id: uid("dup"), ids, confidence: g.confidence === "haute" ? "haute" : "moyenne", reason: str(g.reason), accept: g.confidence === "haute" });
      }
    }
    if (!groups.length) { if (!auto) toast("Aucun doublon détecté.", "ok"); return; }
    if (!auto) { setDupeProposals(groups); return; }
    // Automatique : confiance haute fusionnée directement (annulable), le reste attend votre validation.
    let n = 0;
    groups.filter((g) => g.confidence === "haute").forEach((g) => { if (mergeGroup(g.ids, g.reason, "IA automatique (confiance haute)")) n++; });
    const rest = groups.filter((g) => g.confidence !== "haute");
    if (rest.length) setDupePending(rest);
    if (n || rest.length) toast(`Doublons : ${n} fusion(s) automatique(s)${rest.length ? ` · ${rest.length} à valider (page Offres)` : ""}`, "ok");
  });

  const mergeGroup = (ids, reason, origin = "IA validée") => {
    const list = R.current.offers;
    const members = ids.map((id) => list.find((o) => o.id === id)).filter(Boolean);
    if (members.length < 2) return false;
    const primary = pickPrimary(members, new Set(R.current.apps.map((a) => a.offerId)));
    const absorbed = members.filter((o) => o.id !== primary.id);
    const merged = mergeMembers(primary, absorbed, reason, origin);
    const absorbedIds = new Set(absorbed.map((o) => o.id));
    const next = list.filter((o) => !absorbedIds.has(o.id)).map((o) => (o.id === primary.id ? merged : o));
    R.current.offers = next;
    setOffers(next);
    return true;
  };
  const applyDupeProposals = (groups) => {
    let n = 0;
    groups.filter((g) => g.accept).forEach((g) => { if (mergeGroup(g.ids, g.reason)) n++; });
    setDupeProposals(null);
    setDupePending(null);
    toast(n ? `${n} fusion(s) effectuée(s) — annulables depuis la fiche de l'offre` : "Aucune fusion appliquée", n ? "ok" : "neutral");
  };
  /* Dédoublonnage IA systématique après chaque arrivée d'offres (au plus toutes les 6 h, sauf grosse arrivée). */
  useEffect(() => {
    if (!loaded || storageState.readOnly || !settings.autoDedupeAI || RT.mode === "none" || (RT.mode === "published" && !RT.sample)) return undefined;
    const t = setTimeout(() => {
      const n = arrivalsRef.current;
      const last = R.current.settings.lastAiDedupeAt ? new Date(R.current.settings.lastAiDedupeAt).getTime() : 0;
      if (!n || busyRef.current.dedupe || busyRef.current.score) return;
      if (n < 5 && Date.now() - last < 6 * 36e5) return;
      arrivalsRef.current = 0;
      detectDuplicates({ auto: true });
    }, 8000);
    return () => clearTimeout(t);
  }, [loaded, offers.length, busy.score]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Actions de masse (annulables) ──────────────────────────────── */
  const bulkOffers = (ids, fn, label) => {
    const want = new Set(ids);
    const prev = [];
    const next = [];
    for (const o of R.current.offers) {
      if (!want.has(o.id)) { next.push(o); continue; }
      const n = fn(o);
      if (n === o) { next.push(o); continue; }
      prev.push(o);
      if (n) next.push(n);
    }
    if (!prev.length) { toast("Aucune offre modifiée.", "neutral"); return 0; }
    R.current.offers = next;
    setOffers(next);
    setLastBulk({ label: `${label} : ${prev.length} offre(s)`, prev, at: nowISO(), undoable: true });
    return prev.length;
  };
  const undoBulk = () => {
    const lb = lastBulk;
    if (!lb?.prev?.length) { setLastBulk(null); return; }
    const byId = new Map(lb.prev.map((o) => [o.id, o]));
    const present = new Set(R.current.offers.map((o) => o.id));
    const next = [...R.current.offers.map((o) => byId.get(o.id) || o), ...lb.prev.filter((o) => !present.has(o.id))];
    R.current.offers = next;
    setOffers(next);
    setLastBulk(null);
    toast(`Annulé : ${lb.prev.length} offre(s) restaurée(s)`, "ok");
  };
  const BULK = {
    dismiss: (o) => (o.status === "pipeline" || o.status === "closed" ? o : { ...o, status: "dismissed", dismissedAt: nowISO(), dismissedBy: "user", autoReason: undefined, autoRule: undefined, seenAt: o.seenAt || nowISO() }),
    expire: (o) => (o.status === "pipeline" || o.status === "closed" ? o : { ...o, status: "expired", expiredAt: nowISO(), expiredBy: "user", autoReason: undefined, autoRule: undefined, seenAt: o.seenAt || nowISO() }),
    seen: (o) => (o.seenAt ? o : { ...o, seenAt: nowISO() }),
    unseen: (o) => (o.seenAt ? { ...o, seenAt: undefined } : o),
    restore: (o) => (["dismissed", "expired"].includes(o.status) ? { ...o, status: "new", userKept: true, autoReason: undefined, autoRule: undefined, dismissedBy: undefined, expiredBy: undefined } : o),
    remove: (o) => (o.status === "pipeline" || R.current.apps.some((a) => a.offerId === o.id) ? o : null),
  };
  const bulkAction = (kind, ids) => {
    const labels = { dismiss: "Écartées", expire: "Marquées expirées / pourvues", seen: "Marquées comme lues", unseen: "Marquées non lues", restore: "Remises à traiter", remove: "Supprimées" };
    if (BULK[kind]) return bulkOffers(ids, BULK[kind], labels[kind]);
    if (kind === "pipeline") { ids.forEach((id) => { if (!inPipeline(id)) addToPipeline(id, "new", { quiet: true }); }); toast(`${ids.length} offre(s) ajoutée(s) au pipeline`, "ok"); return ids.length; }
    if (kind === "score") return scoreOffers(ids);
    if (kind === "verify") return requestVerify(ids);
    if (kind === "merge") { if (mergeGroup(ids, "fusion manuelle", "manuelle")) toast(`${ids.length} offres fusionnées en une (annulable depuis sa fiche)`, "ok"); return 1; }
    return 0;
  };
  const runRules = (onlyIds) => {
    const ver = activeVersion(R.current.criteria);
    const r = applyRules(R.current.offers, ver, rulesOf(R.current.settings), onlyIds ? new Set(onlyIds) : null);
    if (!r.prev.length) { toast("Les règles ne trouvent rien à trier.", "ok"); return 0; }
    R.current.offers = r.list;
    setOffers(r.list);
    setLastBulk({ label: `Règles appliquées : ${r.prev.length} offre(s) (${Object.entries(r.counts).map(([k, n]) => `${n} ${RULE_LABEL[k]}`).join(", ")})`, prev: r.prev, at: nowISO(), undoable: true });
    return r.prev.length;
  };
  const dedupeNow = () => {
    const d = dedupeLocal(R.current.offers, R.current.apps);
    if (!d.merged) { toast("Aucun doublon évident (URL, identifiant ou entreprise + intitulé).", "ok"); return; }
    R.current.offers = d.list;
    setOffers(d.list);
    toast(`${d.merged} doublon(s) fusionné(s) — annulable depuis la fiche de l'offre`, "ok");
  };
  const undoMerge = (offerId) => {
    const list = R.current.offers;
    const o = list.find((x) => x.id === offerId);
    const last = o?.mergeHistory?.slice(-1)[0];
    if (!last) return;
    const restored = { ...o, ...last.before, mergeHistory: o.mergeHistory.slice(0, -1) };
    const next = [...list.map((x) => (x.id === offerId ? restored : x)), ...last.absorbed.filter((a) => !list.some((x) => x.id === a.id))];
    R.current.offers = next;
    setOffers(next);
    toast(`Fusion annulée : ${last.absorbed.length} offre(s) restaurée(s)`, "ok");
  };

  /* ── Réponses des recruteurs (Gmail, lecture seule) ──────────────── */
  const replyKey = (r) => `${r.date || ""}|${normText(r.from)}|${normText(r.subject)}`;
  const checkReplies = () => withBusy("replies", async () => {
    const { settings: s, apps: A, offers: O, contacts: C } = R.current;
    const active = A.filter((a) => !a.demo && a.sentAt && a.stage !== "closed");
    if (!active.length) { toast("Aucune candidature envoyée à surveiller.", "neutral"); return; }
    const items = active.map((a) => {
      const o = O.find((x) => x.id === a.offerId);
      return {
        appId: a.id, title: o?.title || null, company: o?.company || null,
        sites: [...new Set((o?.sources || []).map((x) => hostOf(x.url)).filter(Boolean))],
        contacts: C.filter((c) => (a.contactIds || []).includes(c.id)).map((c) => ({ name: c.name, email: c.email || null, company: c.company || null })),
        since: a.sentAt.slice(0, 10),
      };
    });
    const res = await askJSON(s, { system: SYSTEM_BASE, prompt: P.replies(items), mcp: [{ server: "gmail", allow: s.mcpTools.gmailRead }], maxTokens: 12000 });
    if (res.toolCalls.some((n) => /send|trash|delete|modify|label|forward|reply|spam/i.test(n))) toast(`Attention : outil Gmail inattendu appelé (${res.toolCalls.join(", ")}).`, "danger");
    if (!res.toolCalls.length) throw new Error("Gmail n'a pas été consulté : vérifiez que le connecteur Gmail est activé pour cet artefact.");
    setSettings((x) => ({ ...x, lastReplyCheckAt: nowISO() }));
    const hay = normText(res.toolText);
    const found = (Array.isArray(res.data?.replies) ? res.data.replies : [])
      .filter((r) => r && active.some((a) => a.id === r.appId) && str(r.subject))
      .map((r) => ({
        id: uid("rep"), appId: r.appId, date: str(r.date), from: str(r.from), subject: str(r.subject),
        kind: REPLY_KINDS[r.kind] ? r.kind : "autre", summary: str(r.summary),
        interviewAt: str(r.interviewAt) && !isNaN(new Date(r.interviewAt).getTime()) ? new Date(r.interviewAt).toISOString() : null,
        action: ["interview", "closed", "offer"].includes(r.proposedStage) ? r.proposedStage : "log",
        verified: hay.includes(normText(r.subject)),
      }))
      .filter((r) => !(active.find((a) => a.id === r.appId)?.seenReplies || []).includes(replyKey(r)));
    if (!found.length) { toast(`Aucune nouvelle réponse (${res.data?.messagesRead ?? "?"} e-mail(s) lu(s)).`, "ok"); return; }
    setReplyProposals(found);
  });
  const resolveReply = (r, apply) => {
    patchApp(r.appId, (a) => {
      const n = { ...a, seenReplies: [...(a.seenReplies || []), replyKey(r)] };
      return apply ? addLogEntry(n, "email", `Réponse reçue (${REPLY_KINDS[r.kind]}) de ${r.from || NC} : « ${r.subject} »${r.summary ? ` — ${r.summary}` : ""}`) : n;
    });
    if (apply) {
      if (r.action === "interview") {
        if (r.interviewAt) addInterview(r.appId, { at: r.interviewAt, type: "À préciser", location: "", notes: `Selon l'e-mail « ${r.subject} »` });
        else moveApp(r.appId, "interview");
      } else if (r.action === "closed") moveApp(r.appId, "closed", { outcome: "refused", reason: r.summary || "Réponse négative reçue par e-mail" });
      else if (r.action === "offer") moveApp(r.appId, "offer");
    }
    setReplyProposals((l) => { const rest = (l || []).filter((x) => x.id !== r.id); return rest.length ? rest : null; });
  };

  /* ── Fiches entreprise (pourquoi eux) : web_search (API), Routine (page publiée) ou source collée. ── */
  const requestBrief = (company, context) => withBusy(`brief:${briefKey(company)}`, async () => {
    const name = str(company);
    if (!name || /confidenti|non communiqu|anonyme|\[à compléter/i.test(name)) throw new Error("Entreprise non identifiée.");
    if (RT.mode === "published") {
      const trig = veilleRef.current.routine?.triggerId;
      if (!trig || !RT.mcp) throw new Error("La recherche passe par la veille planifiée, qui n'est pas reliée à cette page. Ajoutez une source à la main.");
      await RT.mcp.callTool("Claude Code Remote", "fire_trigger", { trigger_id: trig, text: `Tâche « fiche entreprise » uniquement : ${JSON.stringify({ task: "brief", companies: [name] })}` })
        .catch((e) => { throw new Error(`Lancement impossible (${e?.message || e?.code}).`); });
      toast(`Fiche demandée pour ${name} : elle s'affichera d'ici quelques minutes.`, "ok");
      return null;
    }
    const res = await askJSON(R.current.settings, { system: SYSTEM_BASE, prompt: P.companyBrief(name, context), web: { maxUses: 6 }, maxTokens: 5000 });
    const b = makeBrief({ company: name, summary: res.data?.summary, facts: res.data?.facts, origin: "web", verifiedUrls: res.urls });
    const dropped = (res.data?.facts || []).length - b.facts.length;
    setBriefs((cur) => ({ ...cur, [briefKey(name)]: mergeBriefs(cur[briefKey(name)], b) }));
    toast(`${b.facts.length} fait(s) sourcé(s) sur ${name}${dropped > 0 ? ` · ${dropped} écarté(s) faute d'URL vérifiée` : ""}`, b.facts.length ? "ok" : "warn");
    return b;
  });
  const addManualBrief = (company, url, text) => withBusy(`brief:${briefKey(company)}`, async () => {
    const name = str(company);
    if (!name) throw new Error("Entreprise non identifiée.");
    if (!isHttp(url)) throw new Error("Indiquez l'URL de la source : un fait sans source vérifiable est exclu.");
    if (String(text || "").trim().length < 80) throw new Error("Collez le texte de la source (au moins quelques phrases).");
    const res = await askJSON(R.current.settings, { system: SYSTEM_BASE, prompt: P.briefFromText(name, url, text), maxTokens: 3000 });
    const b = makeBrief({ company: name, summary: res.data?.summary, facts: (res.data?.facts || []).map((f) => ({ text: f?.text, url })), origin: "manuel" });
    setBriefs((cur) => ({ ...cur, [briefKey(name)]: mergeBriefs(cur[briefKey(name)], b) }));
    toast(`${b.facts.length} fait(s) ajouté(s) à la fiche ${name}`, b.facts.length ? "ok" : "warn");
    return b;
  });
  const removeBriefFact = (company, factId) => setBriefs((cur) => {
    const k = briefKey(company);
    if (!cur[k]) return cur;
    return { ...cur, [k]: { ...cur[k], facts: cur[k].facts.filter((f) => f.id !== factId) } };
  });
  const setAppMotivation = (appId, patch) => patchApp(appId, (a) => ({ ...a, motivation: { ...appMotivOf(a), ...patch } }));

  /* ── Notes employeur (avis publics type Glassdoor) ───────────────── */
  const requestRatings = (companies) => withBusy("ratings", async () => {
    const list = [...new Set((companies || []).map((c) => str(c)).filter(Boolean))].filter((c) => !/confidenti|non communiqu|anonyme/i.test(c)).slice(0, 25);
    if (!list.length) { toast("Aucune entreprise identifiée à noter.", "neutral"); return; }
    if (RT.mode === "published") {
      const trig = veilleRef.current.routine?.triggerId;
      if (!trig || !RT.mcp) throw new Error("La notation passe par la veille planifiée, qui n'est pas reliée à cette page.");
      await RT.mcp.callTool("Claude Code Remote", "fire_trigger", { trigger_id: trig, text: `Tâche « notes employeur » uniquement : ${JSON.stringify({ task: "ratings", companies: list })}` })
        .catch((e) => { throw new Error(`Lancement impossible (${e?.message || e?.code}).`); });
      toast(`Notes demandées pour ${list.length} entreprise(s) : elles s'afficheront d'ici quelques minutes.`, "ok");
      return;
    }
    const res = await askJSON(R.current.settings, { system: SYSTEM_BASE, prompt: P.ratings(list), web: { maxUses: Math.min(10, list.length * 2) }, maxTokens: 6000 });
    const next = {};
    (res.data?.ratings || []).forEach((r) => {
      if (!r?.company) return;
      const url = str(r.url);
      const seen = url && res.urls.some((u) => canonicalUrl(u) === canonicalUrl(url));
      const val = Number(r.rating);
      next[ratingKey(r.company)] = { company: r.company, rating: seen && val > 0 && val <= 5 ? val : null, reviews: seen && Number(r.reviews) > 0 ? Number(r.reviews) : null, source: str(r.source), url: seen ? url : null, note: str(r.note), seenAt: nowISO() };
    });
    setRatings((cur) => ({ ...cur, ...next }));
    toast(`${Object.values(next).filter((x) => x.rating).length} note(s) trouvée(s) sur ${list.length}`, "ok");
  });

  /* ── Vérification des liens (annonce encore ouverte ?) ─────────────
     Page publiée : la Routine ouvre les annonces (ou les recherche) et dépose ses résultats dans veille_verify.
     Elle traite aussi, à chaque passage planifié, la file veille/verify_queue entretenue par la page. */
  const verifyTargets = (ids) => R.current.offers
    .filter((o) => ids.includes(o.id) && !o.spontaneous && (o.sources || []).some((x) => x.url))
    .slice(0, 40)
    .map((o) => ({ id: o.id, url: (o.sources || []).find((x) => x.url)?.url, title: o.title, company: o.company || null }));
  const applyVerifyResults = (results, at, method) => {
    const by = new Map((results || []).filter((r) => r && r.id).map((r) => [r.id, r]));
    if (!by.size) return { closed: 0, open: 0 };
    const ver = activeVersion(R.current.criteria);
    const rules = rulesOf(R.current.settings);
    let closed = 0, open = 0, pipeClosed = 0;
    const next = R.current.offers.map((o) => {
      const r = by.get(o.id);
      if (!r) return o;
      const state = ["open", "closed", "unknown"].includes(r.state) ? r.state : "unknown";
      let n = { ...o, link: { state, evidence: str(r.evidence), at: str(r.checkedAt) || at, method: str(r.method) || method } };
      const pub = isoDay(r.publishedAt), dl = isoDay(r.deadline);
      if (pub && (!n.publishedAt || n.publishedApprox)) { n.publishedAt = pub; delete n.publishedApprox; }
      if (dl && !n.deadline) n.deadline = dl;
      if (state === "closed") { closed++; if (n.status === "pipeline") pipeClosed++; }
      if (state === "open") open++;
      const v = ruleVerdict(n, ver, rules);
      return v ? applyVerdict(n, v, at) : n;
    });
    R.current.offers = next;
    setOffers(next);
    if (pipeClosed) toast(`${pipeClosed} offre(s) de votre pipeline semblent clôturées : vérifiez-les.`, "warn");
    return { closed, open };
  };
  const requestVerify = (ids) => withBusy("verify", async () => {
    const items = verifyTargets(ids);
    if (!items.length) { toast("Aucune offre avec lien à vérifier.", "neutral"); return; }
    const mark = (state) => { const set = new Set(items.map((x) => x.id)); setOffers((l) => l.map((o) => (set.has(o.id) ? { ...o, link: { ...(o.link || {}), state, requestedAt: nowISO() } } : o))); };
    if (RT.mode === "published") {
      const trig = veilleRef.current.routine?.triggerId;
      if (!trig || !RT.mcp) throw new Error("La vérification passe par la veille planifiée, qui n'est pas reliée à cette page.");
      await RT.mcp.callTool("Claude Code Remote", "fire_trigger", { trigger_id: trig, text: `Tâche « vérification des liens » uniquement : ${JSON.stringify({ task: "verify", offers: items })}` })
        .catch((e) => { throw new Error(`Lancement impossible (${e?.message || e?.code}).`); });
      mark("pending");
      setSettings((x) => ({ ...x, lastVerifyAt: nowISO() }));
      toast(`Vérification demandée pour ${items.length} offre(s) : résultats d'ici 5 à 15 minutes. Les annonces clôturées passeront en « Expirées ».`, "ok");
      return;
    }
    const res = await askJSON(R.current.settings, { system: SYSTEM_BASE, prompt: P.verify(items), web: { maxUses: Math.min(20, items.length * 2) }, maxTokens: 8000 });
    const r = applyVerifyResults(res.data?.results, nowISO(), "recherche web");
    setSettings((x) => ({ ...x, lastVerifyAt: nowISO() }));
    toast(`Vérification : ${r.closed} clôturée(s), ${r.open} ouverte(s), le reste indéterminé.`, "ok");
  });
  const ingestVerify = (snapDoc) => {
    if ((R.current.settings.importedVerify || []).includes(snapDoc.id)) return;
    const d = snapDoc.data() || {};
    R.current.settings = { ...R.current.settings, importedVerify: [...(R.current.settings.importedVerify || []), snapDoc.id] };
    setSettings((x) => ({ ...x, importedVerify: [...(x.importedVerify || []), snapDoc.id].slice(-200) }));
    const r = applyVerifyResults(d.results, str(d.createdAt) || nowISO(), str(d.method) || "veille");
    if (r.closed || r.open) toast(`Liens vérifiés : ${r.closed} annonce(s) clôturée(s) (passées en « Expirées »), ${r.open} confirmée(s) ouverte(s).`, "ok");
  };
  /* File de vérification lue par la Routine : offres à traiter ou en pipeline, jamais vérifiées ou vérifiées il y a plus de 5 jours. */
  const verifyQueue = useMemo(() => {
    const due = (o) => !o.link?.at || Date.now() - new Date(o.link.at).getTime() > 5 * DAY;
    const items = offers
      .filter((o) => !o.demo && !o.spontaneous && ["new", "pipeline"].includes(o.status) && due(o) && (o.sources || []).some((x) => x.url))
      .sort((a, b) => (b.score?.value ?? 50) - (a.score?.value ?? 50))
      .slice(0, 40)
      .map((o) => ({ id: o.id, url: (o.sources || []).find((x) => x.url)?.url, title: o.title, company: o.company || null }));
    return { items, sig: items.map((x) => x.id).join(",") };
  }, [offers]);
  const queueSig = useRef(null);
  useEffect(() => {
    if (!loaded || RT.mode !== "published" || !RT.db || storageState.readOnly || !settings.autoVerify || queueSig.current === verifyQueue.sig) return undefined;
    const t = setTimeout(() => {
      queueSig.current = verifyQueue.sig;
      RT.db.doc("veille/verify_queue").set({ offers: verifyQueue.items, updatedAt: nowISO() }).catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, [loaded, verifyQueue.sig, settings.autoVerify]); // eslint-disable-line react-hooks/exhaustive-deps

  /* File des fiches entreprise lue par la Routine : entreprises des candidatures actives sans fiche à jour (5 au plus). */
  const briefQueue = useMemo(() => {
    const names = [];
    apps.filter((a) => !a.demo && a.kind !== "base" && a.stage !== "closed").forEach((a) => {
      const o = offers.find((x) => x.id === a.offerId);
      const c = str(o?.company);
      if (c && !briefFresh(briefs[briefKey(c)]) && !names.some((n) => briefKey(n) === briefKey(c))) names.push(c);
    });
    const items = names.slice(0, 5);
    return { items, sig: items.map(briefKey).join(",") };
  }, [apps, offers, briefs]);
  const briefSig = useRef(null);
  useEffect(() => {
    if (!loaded || RT.mode !== "published" || !RT.db || storageState.readOnly || briefSig.current === briefQueue.sig) return undefined;
    const t = setTimeout(() => {
      briefSig.current = briefQueue.sig;
      RT.db.doc("veille/brief_queue").set({ companies: briefQueue.items, updatedAt: nowISO() }).catch(() => {});
    }, 4500);
    return () => clearTimeout(t);
  }, [loaded, briefQueue.sig]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Tri rapide des offres ──────────────────────────────────────── */
  const nextOfferId = (id) => {
    const q = offerQueue.length ? offerQueue : R.current.offers.filter(isActiveOffer).map((o) => o.id);
    const i = q.indexOf(id);
    return i >= 0 ? q[i + 1] || null : q[0] || null;
  };
  const triageOffer = (id, patch) => {
    const nxt = nextOfferId(id);
    patchOffer(id, (o) => ({ ...patch, seenAt: o.seenAt || nowISO(), autoReason: undefined, autoRule: undefined, ...(patch.status === "dismissed" ? { dismissedBy: "user" } : patch.status === "expired" ? { expiredBy: "user" } : {}) }));
    if (R.current.settings.autoNext && nxt) setOfferSel(nxt);
    else setOfferSel(null);
  };

  /* ── Critères ───────────────────────────────────────────────────── */
  const saveCriteriaVersion = (label) => {
    const c = R.current.criteria;
    const v = { id: uid("crit"), label: label || `v${c.versions.length + 1} — ${fmtDate(nowISO())}`, createdAt: nowISO(), ...deepClone(c.draft) };
    const next = { ...c, versions: [...c.versions, v] };
    R.current.criteria = next;
    setCriteria(next);
    toast(`Version enregistrée : ${v.label}`, "ok");
    if (R.current.settings.autoRescore) setTimeout(() => rescoreStale(), 50);
  };
  const restoreVersion = (vid) => {
    const c = R.current.criteria;
    const old = c.versions.find((v) => v.id === vid);
    if (!old) return;
    const { id, label, createdAt, ...body } = old;
    const next = { ...c, draft: deepClone(body) };
    R.current.criteria = next;
    setCriteria(next);
    saveCriteriaVersion(`Restauration de « ${label} »`);
  };
  const generateKeywords = () => withBusy("keywords", async () => {
    const { data } = await askJSON(R.current.settings, { system: SYSTEM_BASE, prompt: P.keywords(R.current.criteria.draft), maxTokens: 3000 });
    setCriteria((c) => {
      const kw = { ...c.draft.keywords };
      ["fr", "nl", "en"].forEach((l) => {
        const add = (Array.isArray(data?.[l]) ? data[l] : []).map((x) => String(x).trim()).filter(Boolean);
        kw[l] = [...new Set([...(kw[l] || []), ...add])];
      });
      return { ...c, draft: { ...c.draft, keywords: kw } };
    });
    toast("Synonymes et traductions ajoutés au brouillon de critères", "ok");
  });

  /* ── Pipeline ───────────────────────────────────────────────────── */
  const openApp = (id, tab = "track") => setAppSel({ id, tab });
  const openOffer = (id) => setOfferSel(id);

  const addToPipeline = (oid, stage = "retained", { quiet = false } = {}) => {
    const existing = R.current.apps.find((a) => a.offerId === oid);
    if (existing) { openApp(existing.id); return existing.id; }
    const app = {
      id: uid("app"), offerId: oid, stage, createdAt: nowISO(), updatedAt: nowISO(), sentAt: null, closed: null,
      docs: {}, prep: null, contactIds: [], interviews: [], followUps: [], demo: false,
      log: [{ id: uid("log"), at: nowISO(), type: "stage", text: `Ajoutée au pipeline : ${STAGE_LABEL[stage]}` }],
    };
    R.current.apps = [app, ...R.current.apps];
    setApps((l) => [app, ...l]);
    patchOffer(oid, (o) => ({ status: "pipeline", seenAt: o.seenAt || nowISO() }));
    if (!quiet) toast(`Ajoutée au pipeline (${STAGE_LABEL[stage]})`, "ok");
    return app.id;
  };

  const moveApp = (id, stage, extra = {}) => {
    const cur = R.current.apps.find((a) => a.id === id);
    if (cur && cur.stage !== stage) {
      if (stage === "closed") patchOffer(cur.offerId, { status: "closed" });
      else if (cur.stage === "closed") patchOffer(cur.offerId, { status: "pipeline" });
    }
    return moveAppInner(id, stage, extra);
  };
  const moveAppInner = (id, stage, extra = {}) => patchApp(id, (a) => {
    if (a.stage === stage) return a;
    const rules = R.current.settings.followUp;
    let n = { ...a, stage, followUps: [...(a.followUps || [])] };
    if (stage !== "closed") n.reached = Math.max(a.reached ?? STAGE_INDEX[a.stage], STAGE_INDEX[stage]);
    else n.reached = a.reached ?? STAGE_INDEX[a.stage];
    if (stage === "sent" || (STAGE_INDEX[stage] > STAGE_INDEX.sent && !a.sentAt && stage !== "closed")) {
      n.sentAt = extra.sentAt || a.sentAt || nowISO();
      if (!n.followUps.some((f) => f.kind.startsWith("relance")) && stage === "sent") {
        n.followUps.push(...rules.afterSend.map((d, i) => ({ id: uid("fu"), kind: i === 0 ? "relance1" : i === 1 ? "relance2" : "custom", due: addDays(n.sentAt, d), status: "pending", draft: null })));
      }
    }
    if (["interview", "offer", "closed"].includes(stage)) {
      n.followUps = n.followUps.map((f) => (f.status === "pending" && f.kind !== "merci" ? { ...f, status: "cancelled" } : f));
    }
    if (stage === "closed") {
      n.closed = { outcome: extra.outcome || "withdrawn", reason: str(extra.reason), at: nowISO() };
      n.followUps = n.followUps.map((f) => (f.status === "pending" ? { ...f, status: "cancelled" } : f));
    } else {
      n.closed = null;
    }
    const suffix = stage === "closed" ? ` (${OUTCOME_LABEL[n.closed.outcome]}${n.closed.reason ? ` — ${n.closed.reason}` : ""})` : "";
    return addLogEntry(n, "stage", `Étape : ${STAGE_LABEL[a.stage]} → ${STAGE_LABEL[stage]}${suffix}`);
  });

  const requestMove = (id, stage) => {
    const a = R.current.apps.find((x) => x.id === id);
    if (!a || a.stage === stage) return;
    if (stage === "closed" || stage === "interview") setStageDialog({ appId: id, stage });
    else moveApp(id, stage);
  };

  const addInterview = (appId, itv) => {
    const rules = R.current.settings.followUp;
    const entry = { id: uid("itv"), durationMin: 60, eventCreated: false, ...itv };
    moveApp(appId, "interview");
    patchApp(appId, (a) => addLogEntry({
      ...a,
      interviews: [...(a.interviews || []), entry].sort((x, y) => new Date(x.at) - new Date(y.at)),
      followUps: [...(a.followUps || []), { id: uid("fu"), kind: "merci", due: addDays(entry.at, rules.afterInterview), status: "pending", draft: null }],
    }, "interview", `Entretien planifié : ${fmtDate(entry.at, { time: true })} (${entry.type})`));
    return entry;
  };

  /* ── Actions externes (Gmail / Agenda) : toujours confirmées et journalisées ── */
  const confirmExternal = ({ title, lines, text, run }) => {
    const warn = mentionsEmployer(text, R.current.settings.employerNames);
    if (!R.current.settings.discreet && !warn.length) return run();
    setConfirm({ title, lines, text, warn, run });
    return undefined;
  };

  const createGmailDraft = ({ to, subject, body, appId }) => confirmExternal({
    title: "Créer un brouillon Gmail",
    lines: [`Destinataire : ${to || "(à compléter dans Gmail)"}`, `Objet : ${subject || "(sans objet)"}`, "Le message reste dans vos brouillons : rien n'est envoyé."],
    text: `${subject}\n\n${body}`,
    run: () => withBusy("gmail-draft", async () => {
      const s = R.current.settings;
      if (RT.mode === "published") {
        if (!RT.mcp) throw new Error("Connecteur Gmail indisponible dans cette vue.");
        await RT.mcp.callTool("Gmail", "create_draft", { to: to ? [to] : [], subject: subject || "", body: body || "" }).catch((e) => { throw new Error(`Brouillon non créé : ${e?.message || e?.code}`); });
        if (appId) logApp(appId, "email", `Brouillon Gmail créé : « ${subject} »`);
        toast("Brouillon créé dans Gmail — non envoyé", "ok");
        return;
      }
      const res = await askJSON(s, { system: SYSTEM_TOOLS, prompt: P.gmailDraft({ to, subject, body }), mcp: [{ server: "gmail", allow: s.mcpTools.gmailDraft }], maxTokens: 4000 });
      if (res.toolCalls.some((n) => /send/i.test(n))) toast("Alerte : un outil d'envoi a été appelé. Vérifiez vos e-mails envoyés.", "danger");
      if (!res.toolCalls.length) throw new Error("Le connecteur Gmail n'a pas été appelé : aucun brouillon créé. Vérifiez l'activation du connecteur.");
      if (!res.data?.created) throw new Error(`Brouillon non créé : ${res.data?.error || res.toolErrors[0] || "raison inconnue"}`);
      if (appId) logApp(appId, "email", `Brouillon Gmail créé : « ${subject} »`);
      toast("Brouillon créé dans Gmail — non envoyé", "ok");
    }),
  });

  const createCalendarEvent = ({ title, start, end, description, appId, reminder = 30, onDone }) => confirmExternal({
    title: "Créer un événement Google Calendar",
    lines: [`Titre : ${title}`, `Début : ${fmtDate(start, { time: true })}`, `Fin : ${fmtDate(end, { time: true })}`, "Aucun invité n'est ajouté."],
    text: `${title}\n${description || ""}`,
    run: () => withBusy("gcal", async () => {
      const s = R.current.settings;
      if (RT.mode === "published") {
        if (!RT.mcp) throw new Error("Connecteur Google Calendar indisponible dans cette vue.");
        const r = await RT.mcp.callTool("Google Calendar", "create_event", {
          summary: title, startTime: `${toLocalInput(start)}:00`, endTime: `${toLocalInput(end)}:00`, timeZone: "Europe/Brussels",
          description: description || "", overrideReminders: [{ method: "popup", minutes: reminder }],
        }).catch((e) => { throw new Error(`Événement non créé : ${e?.message || e?.code}`); });
        if (appId) logApp(appId, "calendar", `Agenda : « ${title} » le ${fmtDate(start, { time: true })}`);
        onDone?.(r?.payload || {});
        toast("Événement ajouté à Google Calendar", "ok");
        return;
      }
      const res = await askJSON(s, {
        system: SYSTEM_TOOLS,
        prompt: P.calendarEvent({ title, start: toLocalInput(start) + ":00", end: toLocalInput(end) + ":00", description, reminder }),
        mcp: [{ server: "gcal", allow: s.mcpTools.gcal }],
        maxTokens: 3000,
      });
      if (!res.toolCalls.length) throw new Error("Le connecteur Google Calendar n'a pas été appelé : aucun événement créé.");
      if (!res.data?.created) throw new Error(`Événement non créé : ${res.data?.error || res.toolErrors[0] || "raison inconnue"}`);
      if (appId) logApp(appId, "calendar", `Agenda : « ${title} » le ${fmtDate(start, { time: true })}`);
      onDone?.(res.data);
      toast("Événement ajouté à Google Calendar", "ok");
    }),
  });

  const calTitle = (what, company) => (R.current.settings.discreetCalendarTitles ? `Perso · ${what}` : `${what} – ${company || "entreprise"}`);

  /* ── Dossier de candidature ─────────────────────────────────────── */
  const setGen = (appId, st) => setGenStatus((g) => { const n = { ...g }; if (st) n[appId] = st; else delete n[appId]; return n; });
  const appAndOffer = (appId) => {
    const app = R.current.apps.find((a) => a.id === appId);
    const offer = R.current.offers.find((o) => o.id === app?.offerId);
    if (!app || !offer) throw new Error("Candidature introuvable.");
    return { app, offer };
  };

  /* Analyse de l'annonce (mots-clés ATS, exigences, preuves du profil) : mise en cache tant que l'annonce et le profil ne changent pas. */
  const analyzeAd = async (appId, { force = false } = {}) => {
    const { settings: s, profile: p } = R.current;
    const { app, offer } = appAndOffer(appId);
    const adText = adTextOf(offer);
    if (offer.spontaneous ? !str(offer.title) : adText.length < 40) throw new Error(offer.spontaneous ? "Indiquez le rôle visé." : "Annonce trop courte pour être analysée : collez son texte complet.");
    const sig = hashStr(`${offer.spontaneous || ""}§${offer.title}§${offer.company || ""}§${offer.language || ""}§${adText}§${JSON.stringify({ ...p, motivation: undefined, motivationAnswers: undefined, writingRules: undefined })}`);
    if (!force && app.analysis?.sig === sig) return app.analysis;
    const { data } = await askJSON(s, { system: SYSTEM_BASE, prompt: offer.spontaneous ? P.targetAnalysis(offer, p) : P.adAnalysis(offer, adText, p), maxTokens: 9000 });
    const analysis = { ...normalizeAnalysis(data, offer), sig, createdAt: nowISO(), fromSummary: !offer.spontaneous && !offer.fullText, adChars: adText.length, spontaneous: offer.spontaneous || null };
    if (!analysis.keywords.length) throw new Error("L'analyse n'a renvoyé aucun mot-clé.");
    R.current.apps = R.current.apps.map((a) => (a.id === appId ? { ...a, analysis } : a));
    patchApp(appId, (a) => ({ ...a, analysis }));
    return analysis;
  };
  const runAnalysis = (appId) => withBusy(`analysis:${appId}`, async () => {
    await analyzeAd(appId, { force: true });
    toast("Analyse de l'annonce à jour", "ok");
    return true;
  });

  /* Dossier : 1) analyse de l'annonce → 2) rédaction (CV et lettre en parallèle) → 3) contrôle qualité local + corrections ciblées. */
  const generateDocs = (appId, types, instruction, prefsIn) => withBusy(`dossier:${appId}`, async () => {
    try {
      const { settings: s, profile: p } = R.current;
      const { app, offer } = appAndOffer(appId);
      const prefs = { ...DEFAULT_DOC_PREFS, ...(app.docPrefs || {}), ...(prefsIn || {}) };
      const pro = types.filter((t) => t === "cv" || t === "letter");
      const other = types.filter((t) => !pro.includes(t));
      setGen(appId, { step: 1, label: offer.spontaneous ? "Analyse du rôle visé et confrontation à votre profil…" : "Analyse de l'annonce et confrontation à votre profil…" });
      let analysis = null;
      try { analysis = await analyzeAd(appId); } catch (e) { toast(`Analyse de l'annonce impossible (${e.message}) : rédaction à partir de l'annonce seule.`, "warn"); }
      const lang = docLang(offer, prefs, analysis);
      const failed = [];
      const got = {};
      const drafts = {};
      const appNow = R.current.apps.find((a) => a.id === appId) || app;
      const facts = selectedFacts(appNow, offer, R.current.briefs);
      const extra = { facts, appBlock: appMotivationBlock(appNow, offer, p, facts), employer: employerRule(appNow, p) };
      const qaCtx = (x) => lintCtx({ offer, analysis, prefs, lang, settings: s, profile: p, app: appNow, briefs: R.current.briefs, ...x });
      /* Passe de correction ciblée après rédaction (points « autoFix » du contrôle qualité). */
      const autoFix = async (t, d, extra) => {
        d.autoFixed = 0;
        const issues = autoFixList(analyzeDoc(d.text, t, qaCtx(extra)));
        if (!issues.length) return;
        try {
          const r = await askJSON(s, { system: SYSTEM_WRITER, prompt: withRules(P.fixDoc({ kind: t, text: d.text, issues, analysis, profile: p, offer }), p), maxTokens: 5000 });
          let txt = d.text;
          for (const e of Array.isArray(r.data?.edits) ? r.data.edits : []) {
            if (touchesLocked(e?.before, lockedOf(p))) continue;
            const nt = applyEdit(txt, e?.before, e?.after);
            if (nt !== null && nt !== txt) { txt = nt; d.autoFixed++; }
          }
          d.text = normalizeDoc(txt, t, lang);
        } catch { /* passe facultative : le document reste utilisable */ }
      };
      const restJob = other.length
        ? askJSON(s, { system: SYSTEM_BASE, prompt: withRules(P.dossier(offer, p, other, instruction, analysis, extra), p), maxTokens: 8000 }).then((r) => { got.rest = r.data; }).catch((e) => failed.push(e?.message || String(e)))
        : Promise.resolve();
      /* 1) CV, puis 2) lettre écrite AVEC le CV en entrée : elle explique, le CV prouve. */
      if (pro.includes("cv")) {
        const master = masterOf(p, lang);
        setGen(appId, { step: 2, label: master ? "Adaptation du CV maître…" : "Rédaction du CV…" });
        try {
          const r = await askJSON(s, { system: SYSTEM_WRITER, prompt: withRules(P.cvWrite(offer, p, analysis, prefs, instruction, { ...extra, master: master?.text, masterLang: lang }), p), maxTokens: 9000 });
          const raw = r.data?.cv;
          if (typeof raw === "string" && raw.trim()) {
            const accent = cleanHex(r.data?.accent, null);
            const written = normalizeDoc(raw, "cv", lang);
            drafts.cv = { text: master ? normalizeDoc(enforceMaster(written, master.text, lockedOf(p)), "cv", lang) : written, masterAt: master?.at || null, accent, accentSource: accent ? str(r.data?.accentSource) || "suggérée" : null, tips: (r.data?.tips || []).map(String).filter(Boolean).slice(0, 4) };
            setGen(appId, { step: 3, label: "Contrôle qualité du CV…" });
            await autoFix("cv", drafts.cv);
          }
        } catch (e) { failed.push(e?.message || String(e)); }
      }
      if (pro.includes("letter")) {
        const cvText = drafts.cv?.text || app.drafts?.cv?.text || app.docs?.cv?.slice(-1)[0]?.text || "";
        setGen(appId, { step: 2, label: cvText ? "Rédaction de la lettre à partir du CV (sans le répéter)…" : "Rédaction de la lettre…" });
        try {
          const r = await askJSON(s, { system: SYSTEM_WRITER, prompt: withRules(P.letterWrite(offer, p, analysis, prefs, instruction, cvText, extra), p), maxTokens: 9000 });
          const raw = r.data?.letter;
          if (typeof raw === "string" && raw.trim()) {
            drafts.letter = { text: normalizeDoc(raw, "letter", lang), accent: null, accentSource: null, tips: [], used: normalizeUsed(r.data?.used), cvText };
            setGen(appId, { step: 3, label: "Contrôle qualité de la lettre…" });
            await autoFix("letter", drafts.letter, { cvText });
            drafts.letter.metrics = letterMetrics(drafts.letter.text, cvText);
          }
        } catch (e) { failed.push(e?.message || String(e)); }
      }
      await restJob;
      const versions = {};
      const meta = () => ({ id: uid("doc"), createdAt: nowISO(), origin: "IA", instruction: str(instruction), prefs, analysisSig: analysis?.sig || null });
      for (const [t, d] of Object.entries(drafts)) versions[t] = { ...meta(), text: d.text, format: "markup", language: lang, accent: d.accent, accentSource: d.accentSource, tips: d.tips, autoFixed: d.autoFixed, ...(t === "letter" ? { used: d.used, metrics: d.metrics } : { masterAt: d.masterAt || null }) };
      const rest = got.rest || {};
      for (const t of other) {
        const d = rest[t];
        if (!d) continue;
        let v;
        if (t === "answers") v = { text: (d.items || []).map((x) => `Q. ${x.question}\n${x.answer}`).join("\n\n") };
        else if (t === "email") v = { subject: d.subject || "", text: d.body || "" };
        else v = { text: d.text || "" };
        if (v.text) versions[t] = { ...meta(), ...v };
      }
      if (!Object.keys(versions).length) throw new Error(failed[0] || "Aucun document reçu de l'IA.");
      patchApp(appId, (a) => {
        const docs = { ...(a.docs || {}) };
        const dr = { ...(a.drafts || {}) };
        for (const [t, v] of Object.entries(versions)) { docs[t] = [...(docs[t] || []), v]; delete dr[t]; }
        const n = { ...a, docs, drafts: dr, docPrefs: prefs, docLanguage: lang || rest.language || a.docLanguage };
        if (["new", "retained"].includes(a.stage)) n.stage = "prep";
        return addLogEntry(n, "doc", `Généré : ${Object.keys(versions).map((t) => DOC_LABEL[t]).join(", ")}`);
      });
      const fixed = Object.values(drafts).reduce((n, d) => n + (d.autoFixed || 0), 0);
      if (failed.length) toast(`Généré partiellement : ${failed[0]}`, "warn");
      else toast(`Documents prêts à relire${fixed ? ` · ${fixed} correction(s) appliquée(s) automatiquement` : ""}`, "ok");
      return true;
    } finally { setGen(appId, null); }
  });

  /* Assistance ciblée depuis le studio : relecture, corrections, réécriture de section, lignes de positionnement. */
  const docAI = (appId, action, payload = {}) => withBusy(`docai:${appId}:${action}`, async () => {
    const { settings: s, profile: p } = R.current;
    const { app, offer } = appAndOffer(appId);
    const analysis = app.analysis || null;
    const cvText = latestCvText(app);
    const facts = selectedFacts(app, offer, R.current.briefs);
    const args = { cvText, facts, employer: employerRule(app, p), appBlock: appMotivationBlock(app, offer, p, facts), ...payload, analysis, profile: p, offer };
    const prompt = { review: P.review, fix: P.fixDoc, section: P.improveSection, headlines: P.headlines }[action];
    if (!prompt) throw new Error("Action inconnue.");
    const { data } = await askJSON(s, { system: SYSTEM_WRITER, prompt: withRules(prompt(args), p), maxTokens: action === "headlines" ? 2500 : 6000 });
    return data || {};
  });

  /* « J'ai cette compétence » : ajoutée au profil et marquée comme prouvée pour cette candidature. */
  /* 6b : règles apprises de vos corrections (au moins 3 documents corrigés) ; jamais activées seules. */
  const learnRules = () => withBusy("learn-rules", async () => {
    const { settings: s, profile: p } = R.current;
    const l = learningOf(p);
    const since = l.lastLearnAt ? new Date(l.lastLearnAt).getTime() : 0;
    const edits = l.edits.filter((e) => new Date(e.at).getTime() > since);
    if (new Set(edits.map((e) => `${e.appId}:${e.type}`)).size < 3) throw new Error("Corrigez et enregistrez au moins 3 documents générés avant l'apprentissage.");
    const { data } = await askJSON(s, { system: SYSTEM_BASE, prompt: P.learnRules(edits, writingRulesOf(p)), maxTokens: 3000 });
    const found = (Array.isArray(data?.rules) ? data.rules : []).map((r) => ({ text: str(r?.text), evidence: str(r?.evidence) })).filter((r) => r.text).slice(0, 5);
    setProfile((pp) => {
      const cur = writingRulesOf(pp);
      const nid = (i) => `L${Date.now().toString(36)}${i}`;
      const add = found.filter((r) => !cur.some((c) => normText(c.text) === normText(r.text))).map((r, i) => ({ id: nid(i), text: r.text, evidence: r.evidence, active: false, origin: "apprise", createdAt: nowISO() }));
      return { ...pp, writingRules: [...cur, ...add], ruleLearning: { ...learningOf(pp), lastLearnAt: nowISO() } };
    });
    toast(found.length ? `${found.length} règle(s) proposée(s), inactives : activez celles qui vous conviennent.` : "Aucune correction récurrente détectée.", found.length ? "ok" : "neutral");
    return found.length;
  });
  /* 6c / 6d : CV maître par langue et puces verrouillées. */
  const setMasterCv = (lang, text, sourceAppId) => setProfile((p) => ({ ...p, masterCv: { ...(p.masterCv || {}), [lang]: { text, at: nowISO(), sourceAppId: sourceAppId || null } } }));
  const clearMasterCv = (lang) => setProfile((p) => { const m = { ...(p.masterCv || {}) }; delete m[lang]; return { ...p, masterCv: m }; });
  const toggleLockedBullet = (text) => setProfile((p) => {
    const cur = lockedOf(p);
    const k = bulletKey(text);
    return { ...p, lockedBullets: cur.some((x) => bulletKey(x) === k) ? cur.filter((x) => bulletKey(x) !== k) : [...cur, String(text).replace(/^[-•*]\s*/, "").trim()] };
  });

  /* Entretien de motivation : l'IA range les réponses dans la fiche, en reformulant seulement. */
  const draftMotivation = (answers) => withBusy("motiv-draft", async () => {
    const { settings: s, profile: p } = R.current;
    const filled = answers.filter((x) => str(x.a));
    if (filled.length < 3) throw new Error("Répondez à au moins 3 questions.");
    const { data } = await askJSON(s, { system: SYSTEM_BASE, prompt: P.motivationDraft(filled, motivOf(p)), maxTokens: 6000 });
    const d = data && typeof data === "object" ? data : {};
    const t = (x) => (typeof x === "string" ? x.trim() : "");
    const proposal = {
      ...Object.fromEntries(MOTIV_TEXT_FIELDS.map((f) => [f.id, t(d[f.id])])),
      convictions: (Array.isArray(d.convictions) ? d.convictions : []).map((c) => t(c?.text ?? c)).filter(Boolean),
      stories: (Array.isArray(d.stories) ? d.stories : []).map((x) => ({ title: t(x?.title), situation: t(x?.situation), action: t(x?.action), result: t(x?.result), lesson: t(x?.lesson) })).filter((x) => x.title || x.situation || x.action),
      sectors: (Array.isArray(d.sectors) ? d.sectors : []).map(t).filter(Boolean),
      followUps: (Array.isArray(d.followUps) ? d.followUps : []).map((f) => ({ field: t(f?.field), q: t(f?.q) })).filter((f) => f.q).slice(0, 3),
    };
    /* Garde-fou « rien ajouté » : tout chiffre absent des réponses est signalé. */
    const src = new Set(sigNumbers(filled.map((x) => x.a).join("\n")));
    const out = JSON.stringify({ ...proposal, followUps: [] });
    proposal.inventedNumbers = sigNumbers(out).filter((n) => !src.has(n));
    return proposal;
  });

  const declareSkill = (appId, term) => {
    setProfile((p) => (p.skills.some((x) => normText(x) === normText(term)) ? p : { ...p, skills: [...p.skills, term] }));
    patchApp(appId, (a) => (a.analysis ? { ...a, analysis: { ...a.analysis, keywords: a.analysis.keywords.map((k) => (k.term === term ? { ...k, status: "prouvé", evidence: "déclarée par vous (ajoutée au profil)" } : k)) } } : a));
    toast(`« ${term} » ajouté à vos compétences`, "ok");
  };

  /* ── Traduction d'un CV ou d'une lettre : nouvelle version dans la langue cible, balisage et faits conservés ── */
  const translateDoc = (appId, kind, from, to, srcText) => withBusy(`tr:${appId}:${kind}:${to}`, async () => {
    const app = R.current.apps.find((a) => a.id === appId);
    const offer = R.current.offers.find((o) => o.id === app?.offerId);
    const src = latestDoc(app, offer, kind, from);
    const text0 = srcText || (src ? docTextOf(app, kind, src).text : "");
    if (!text0) throw new Error(`Aucune version ${LANG_FLAG[from]} à traduire.`);
    const { data } = await askJSON(R.current.settings, { system: SYSTEM_BASE, prompt: P.translate(text0, kind, from, to, offer), maxTokens: 12000, tier: "balanced", effort: "low" });
    const raw = typeof data?.text === "string" ? data.text.trim() : "";
    if (!raw) throw new Error("Traduction vide : réessayez.");
    const { id: _i, createdAt: _c, origin: _o, instruction: _n, autoFixed: _f, edits: _e, subject: _s, ...keep } = src || {};
    const v = { ...keep, text: normalizeDoc(raw, kind, to), language: to, format: "markup", translatedFrom: from, id: uid("doc"), createdAt: nowISO(), origin: "traduction" };
    patchApp(appId, (a) => addLogEntry({ ...a, docs: { ...a.docs, [kind]: [...(a.docs?.[kind] || []), v] } }, "doc", `${DOC_LABEL[kind]} traduit : ${LANG_FLAG[from]} → ${LANG_FLAG[to]}`));
    return v;
  });

  const saveDocVersion = (appId, type, text, subject, extra = {}) => patchApp(appId, (a) => {
    const prev = a.docs?.[type]?.slice(-1)[0];
    const { id: _i, createdAt: _c, origin: _o, instruction: _n, autoFixed: _f, edits: _e, ...keep } = prev || {};
    /* 6b / 7 : écart avec la dernière version IA (mesure des corrections manuelles, matière de l'apprentissage des règles). */
    const lang0 = extra.language || prev?.language || a.docLanguage;
    const base = [...(a.docs?.[type] || [])].reverse().find((x) => (x.origin === "IA" || x.origin === "traduction") && (!lang0 || (x.language || a.docLanguage) === lang0));
    const delta = base && (type === "cv" || type === "letter") ? editDelta(base.text, text) : null;
    if (delta && delta.hunks.length && !a.demo) {
      setProfile((p) => {
        const l = learningOf(p);
        const entry = { id: uid("ed"), appId, type, lang: base.language || null, at: nowISO(), pct: delta.pct, hunks: delta.hunks };
        return { ...p, ruleLearning: { ...l, edits: [...l.edits.filter((e) => !(e.appId === appId && e.type === type && e.baseId === base.id)), { ...entry, baseId: base.id }].slice(-40) } };
      });
    }
    const v = { ...keep, ...extra, id: uid("doc"), text, subject, createdAt: nowISO(), origin: "édition", ...(delta ? { edits: { baseId: base.id, pct: delta.pct, changed: delta.changed } } : {}) };
    const drafts = { ...(a.drafts || {}) };
    delete drafts[type];
    return addLogEntry({ ...a, drafts, docs: { ...a.docs, [type]: [...(a.docs?.[type] || []), v] } }, "doc", `${DOC_LABEL[type]} : nouvelle version (édition manuelle)`);
  });
  const saveDocDraft = (appId, type, draft) => patchApp(appId, (a) => {
    const drafts = { ...(a.drafts || {}) };
    if (draft) drafts[type] = { ...draft, at: nowISO() }; else delete drafts[type];
    return { ...a, drafts };
  });

  /* ── Relances ───────────────────────────────────────────────────── */
  const setFollowUp = (appId, fuId, patch) => patchApp(appId, (a) => ({ ...a, followUps: (a.followUps || []).map((f) => (f.id === fuId ? { ...f, ...patch } : f)) }));
  const draftFollowUp = (appId, fuId) => withBusy(`fu:${fuId}`, async () => {
    const { settings: s, profile: p, apps: A, offers: O, contacts: C } = R.current;
    const app = A.find((a) => a.id === appId);
    const fu = app?.followUps.find((f) => f.id === fuId);
    const offer = O.find((o) => o.id === app?.offerId);
    const contact = C.find((c) => app?.contactIds?.includes(c.id));
    const { data } = await askJSON(s, { system: SYSTEM_BASE, prompt: withRules(P.followUp(app, offer, fu, p, contact), p), maxTokens: 3000 });
    if (!data?.body) throw new Error("Aucun texte reçu.");
    setFollowUp(appId, fuId, { draft: { subject: data.subject || "", body: data.body, createdAt: nowISO() } });
    toast("Relance rédigée — à relire", "ok");
  });
  const completeFollowUp = (appId, fuId, status) => patchApp(appId, (a) => {
    const fu = a.followUps.find((f) => f.id === fuId);
    let n = { ...a, followUps: a.followUps.map((f) => (f.id === fuId ? { ...f, status, doneAt: nowISO() } : f)) };
    if (status === "done" && fu?.kind.startsWith("relance") && a.stage === "sent") n.stage = "followup";
    return addLogEntry(n, "followup", `${FU_KINDS[fu?.kind] || "Relance"} : ${status === "done" ? "effectuée" : "ignorée"}`);
  });
  const addFollowUp = (appId, due, kind = "custom") => patchApp(appId, (a) => addLogEntry({ ...a, followUps: [...(a.followUps || []), { id: uid("fu"), kind, due, status: "pending", draft: null }] }, "followup", `Relance planifiée le ${fmtDate(due)}`));

  /* ── Préparation d'entretien ────────────────────────────────────── */
  const prepareInterview = (appId) => withBusy(`prep:${appId}`, async () => {
    const { settings: s, profile: p, apps: A, offers: O } = R.current;
    const app = A.find((a) => a.id === appId);
    const offer = O.find((o) => o.id === app?.offerId);
    const brief = offer?.company ? R.current.briefs[briefKey(offer.company)] : null;
    const facts = selectedFacts(app, offer, R.current.briefs);
    const res = await askJSON(s, { system: SYSTEM_BASE, prompt: withRules(P.prep(offer, p, { facts: briefFresh(brief) ? brief.facts : [], appBlock: appMotivationBlock(app, offer, p, facts) }), p), web: { maxUses: briefFresh(brief) ? 3 : 6 }, maxTokens: 14000 });
    const d = res.data || {};
    const seen = (u) => !!u && (res.urls.some((x) => canonicalUrl(x) === canonicalUrl(u)) || (briefFresh(brief) && brief.facts.some((f) => canonicalUrl(f.url) === canonicalUrl(u))));
    /* Les faits vérifiés de la préparation enrichissent la fiche entreprise (réutilisée par la lettre). */
    if (offer?.company) {
      const nb = makeBrief({ company: offer.company, summary: d.company?.summary, facts: (d.company?.facts || []).map((f) => ({ text: f?.text, url: f?.sourceUrl })), origin: "prep", verifiedUrls: [...res.urls, ...(briefFresh(brief) ? brief.facts.map((f) => f.url) : [])] });
      if (nb.facts.length) setBriefs((cur) => ({ ...cur, [briefKey(offer.company)]: mergeBriefs(cur[briefKey(offer.company)], nb) }));
    }
    const prep = {
      createdAt: nowISO(),
      summary: str(d.company?.summary),
      facts: (d.company?.facts || []).filter((f) => f?.text).map((f) => ({ text: f.text, sourceUrl: str(f.sourceUrl), verified: seen(f.sourceUrl) })),
      news: (d.company?.news || []).filter((n) => n?.title).map((n) => ({ ...n, verified: seen(n.sourceUrl) })),
      likelyQuestions: d.likelyQuestions || [],
      star: d.star || [],
      questionsToAsk: d.questionsToAsk || [],
      negotiation: d.negotiation || [],
      salaryBenchmark: d.salaryBenchmark?.range ? { ...d.salaryBenchmark, verified: seen(d.salaryBenchmark.sourceUrl) } : null,
    };
    patchApp(appId, (a) => addLogEntry({ ...a, prep }, "prep", "Fiche de préparation d'entretien générée"));
    toast("Fiche de préparation prête", "ok");
  });

  /* ── Contacts ───────────────────────────────────────────────────── */
  const saveContact = (c) => {
    if (c.id) setContacts((l) => l.map((x) => (x.id === c.id ? { ...x, ...c } : x)));
    else setContacts((l) => [{ ...c, id: uid("ct"), createdAt: nowISO(), demo: false }, ...l]);
    toast("Contact enregistré", "ok");
  };
  const deleteContact = (id) => {
    setContacts((l) => l.filter((c) => c.id !== id));
    setApps((l) => l.map((a) => ({ ...a, contactIds: (a.contactIds || []).filter((x) => x !== id) })));
  };
  const toggleAppContact = (appId, cid) => patchApp(appId, (a) => {
    const has = (a.contactIds || []).includes(cid);
    return { ...a, contactIds: has ? a.contactIds.filter((x) => x !== cid) : [...(a.contactIds || []), cid] };
  });

  /* ── « À faire aujourd'hui » ───────────────────────────────────── */
  const todayItems = useMemo(() => {
    const items = [];
    const th = settings.threshold;
    const offerOf = (a) => offers.find((o) => o.id === a.offerId);
    apps.filter((a) => a.kind !== "base").forEach((a) => {
      const o = offerOf(a);
      const name = `${o?.title || "Poste"} · ${o?.company || NC}`;
      (a.followUps || []).filter((f) => f.status === "pending" && daysFromToday(f.due) <= 0).forEach((f) => {
        items.push({ id: `fu:${f.id}`, label: `${FU_KINDS[f.kind]} due`, detail: name, due: f.due, weight: 1, go: () => setView("followups"), demo: a.demo });
      });
      (a.interviews || []).filter((i) => { const d = daysFromToday(i.at); return d >= 0 && d <= 3; }).forEach((i) => {
        items.push({ id: `itv:${i.id}`, label: a.prep ? `Entretien ${relDay(i.at)}` : `Préparer l'entretien (${relDay(i.at)})`, detail: name, due: i.at, weight: 1, go: () => openApp(a.id, "prep"), demo: a.demo });
      });
      if (a.stage === "retained" && !Object.keys(a.docs || {}).length) items.push({ id: `doc:${a.id}`, label: "Préparer le dossier de candidature", detail: name, weight: 2, go: () => setStudio({ appId: a.id, type: "cv" }), demo: a.demo });
      if (a.stage === "prep" && daysFromToday(a.updatedAt) <= -3) items.push({ id: `send:${a.id}`, label: "Finaliser et envoyer la candidature", detail: name, weight: 2, go: () => openApp(a.id, "docs"), demo: a.demo });
    });
    offers
      .filter((o) => ["new", "pipeline"].includes(o.status) && deadlineIn(o) !== null && deadlineIn(o) >= 0 && deadlineIn(o) <= 3)
      .forEach((o) => items.push({ id: `dl:${o.id}`, label: `Date limite ${relDay(o.deadline)}`, detail: `${o.title} · ${o.company || NC}`, due: o.deadline, weight: 1, go: () => openOffer(o.id) }));
    const unreadGood = offers.filter((o) => o.status === "new" && !o.seenAt && !o.demo && o.score && o.score.value >= th);
    if (unreadGood.length) items.push({ id: "tri-good", label: `Trier ${unreadGood.length} offre(s) non lue(s) au-dessus de ${th}`, detail: unreadGood.slice(0, 2).map((o) => o.title).join(" · "), weight: 1, go: () => setView("offers") || setOfferPreset({ tab: "unread", minScore: th }) });
    const unreadAll = offers.filter((o) => o.status === "new" && !o.seenAt && !o.demo).length;
    if (unreadAll > unreadGood.length) items.push({ id: "tri-all", label: `Trier ${unreadAll} offre(s) non lue(s)`, detail: "Sélection multiple et actions de masse disponibles", weight: 2, go: () => setView("offers") || setOfferPreset({ tab: "unread" }) });
    if (staleIds.length) items.push({ id: "stale", label: `Recalculer ${staleIds.length} score(s) obsolète(s)`, detail: "Les critères ont changé", weight: 3, go: () => rescoreStale() });
    if (apps.some((a) => !a.demo && a.sentAt && a.stage !== "closed") && (!settings.lastReplyCheckAt || (Date.now() - new Date(settings.lastReplyCheckAt)) / 36e5 > 48)) items.push({ id: "replies", label: "Vérifier les réponses des recruteurs", detail: `Dernière vérification : ${relTime(settings.lastReplyCheckAt)}`, weight: 2, go: () => checkReplies() });
    if (!settings.lastWatchAt || (Date.now() - new Date(settings.lastWatchAt)) / 36e5 > 24) items.push({ id: "watch", label: "Lancer la veille", detail: `Dernière collecte : ${relTime(settings.lastWatchAt)}`, weight: 3, go: () => runWatch() });
    const order = todayAI?.order || {};
    return items
      .map((it) => ({ ...it, ai: order[it.id] }))
      .sort((a, b) => (a.ai?.priority ?? a.weight) - (b.ai?.priority ?? b.weight) || new Date(a.due || 8.64e15) - new Date(b.due || 8.64e15));
  }, [apps, offers, settings.threshold, settings.lastWatchAt, settings.lastReplyCheckAt, staleIds, todayAI]); // eslint-disable-line react-hooks/exhaustive-deps

  const prioritizeToday = () => withBusy("today", async () => {
    if (!todayItems.length) return;
    const { data } = await askJSON(R.current.settings, { system: SYSTEM_BASE, prompt: P.today(todayItems), maxTokens: 3000 });
    const order = {};
    (data?.ordered || []).forEach((x) => { if (x?.id) order[x.id] = { priority: clamp(Number(x.priority) || 2, 1, 3), reason: str(x.reason) }; });
    setTodayAI({ order, at: nowISO() });
    toast("Actions priorisées par l'IA", "ok");
  });

  /* ── Données : export / import / réinitialisation ──────────────── */
  const exportPayload = () => ({ app: "radar-emploi", version: DATA_VERSION, exportedAt: nowISO(), settings, profile, criteria, sources, offers, apps, contacts, briefs, ratings, media });
  const importPayload = (obj) => {
    if (!obj || obj.app !== "radar-emploi") throw new Error("Fichier non reconnu (sauvegarde Radar attendue).");
    setSettings({ ...DEFAULT_SETTINGS, ...(obj.settings || {}), mcp: { ...DEFAULT_SETTINGS.mcp, ...(obj.settings?.mcp || {}) }, mcpTools: { ...DEFAULT_SETTINGS.mcpTools, ...(obj.settings?.mcpTools || {}) }, followUp: { ...DEFAULT_SETTINGS.followUp, ...(obj.settings?.followUp || {}) } });
    setProfile({ ...DEFAULT_PROFILE, ...(obj.profile || {}) });
    setCriteria(obj.criteria?.versions?.length ? obj.criteria : makeCriteriaState());
    setSources(obj.sources || DEFAULT_SOURCES);
    setOffers(obj.offers || []);
    setApps(obj.apps || []);
    setContacts(obj.contacts || []);
    if (obj.briefs && typeof obj.briefs === "object") setBriefs(obj.briefs);
    if (obj.ratings && typeof obj.ratings === "object") setRatings(obj.ratings);
    if (obj.media && typeof obj.media === "object") setMedia({ ...DEFAULT_MEDIA, ...obj.media });
    toast("Sauvegarde importée", "ok");
  };
  const resetAll = async () => {
    try {
      for (const k of Object.values(KEYS)) await storage.remove(k);
    } catch { /* ignore */ }
    setSettings(DEFAULT_SETTINGS);
    setProfile(DEFAULT_PROFILE);
    setCriteria(makeCriteriaState());
    setSources(DEFAULT_SOURCES);
    setOffers([]);
    setApps([]);
    setContacts([]);
    setBriefs({});
    setRatings({});
    setMedia(DEFAULT_MEDIA);
    setTodayAI(null);
    toast("Plateforme réinitialisée", "ok");
  };
  const clearDemo = () => {
    setOffers((l) => l.filter((o) => !o.demo));
    setApps((l) => l.filter((a) => !a.demo));
    setContacts((l) => l.filter((c) => !c.demo));
    toast("Données d'exemple supprimées", "ok");
  };
  const loadDemo = () => {
    const d = makeDemo(activeVersion(R.current.criteria).id);
    setOffers((l) => [...d.offers, ...l.filter((o) => !o.demo)]);
    setApps((l) => [...d.apps, ...l.filter((a) => !a.demo)]);
    setContacts((l) => [...d.contacts, ...l.filter((c) => !c.demo)]);
    toast("Exemples rechargés", "ok");
  };
  const hasDemo = offers.some((o) => o.demo) || apps.some((a) => a.demo) || contacts.some((c) => c.demo);

  /* ── Raccourcis clavier ─────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Veille planifiée (page publiée) : état, configuration et offres déposées par la Routine. */
  const ingestRun = (snapDoc) => {
    const d = snapDoc.data() || {};
    if ((R.current.settings.importedRuns || []).includes(snapDoc.id)) return;
    const raw = Array.isArray(d.offers) ? d.offers : [];
    const norm = raw
      .map((r) => {
        const o = normalizeOffer(r, { sourceName: str(r?.sourceName) || "Veille planifiée", via: "veille planifiée (recherche web)" });
        if (o) {
          o.sources[0].verified = r?.verified === true ? true : null;
          const live = ["open", "closed", "unknown"].includes(r?.liveness) ? r.liveness : null;
          if (live && live !== "unknown") o.link = { state: live, evidence: str(r.livenessEvidence), at: str(d.createdAt) || nowISO(), method: str(r.livenessMethod) || "veille" };
        }
        return o;
      })
      .filter(Boolean);
    const r = applyIncoming(norm);
    const at = str(d.createdAt) || nowISO();
    const counts = {};
    norm.forEach((o) => { const n = o.sources[0].name; counts[n] = (counts[n] || 0) + 1; });
    setSources((l) => l.map((x) => (counts[x.name] !== undefined || (d.sourcesSearched || []).includes(x.name) ? { ...x, lastRunAt: at, lastCount: counts[x.name] || 0, lastError: null } : x)));
    setSettings((x) => ({ ...x, lastWatchAt: at, importedRuns: [...(x.importedRuns || []), snapDoc.id].slice(-300) }));
    R.current.settings = { ...R.current.settings, importedRuns: [...(R.current.settings.importedRuns || []), snapDoc.id] };
    if (norm.length || raw.length) toast(`Veille reçue : ${r.kept.length} nouvelle(s) offre(s) retenue(s), ${r.filtered} écartée(s) par vos règles, ${r.merged.length} déjà connue(s). Le scoring suit automatiquement.`, "ok");
  };
  useEffect(() => {
    if (!loaded || RT.mode !== "published" || !RT.db) return undefined;
    const subs = [];
    const quiet = () => {};
    try {
      subs.push(RT.db.doc("veille/routine").onSnapshot((d) => setVeille((v) => ({ ...v, routine: d.exists ? d.data() : null })), quiet));
      subs.push(RT.db.doc("veille/status").onSnapshot((d) => setVeille((v) => ({ ...v, status: d.exists ? d.data() : null })), quiet));
      subs.push(RT.db.doc("veille/config").onSnapshot((d) => setVeille((v) => ({ ...v, configLoaded: true, configSig: d.exists ? d.data()?.sig || null : null })), quiet));
      subs.push(RT.db.collection("veille_inbox").onSnapshot((snap) => snap.docs.forEach(ingestRun), quiet));
      subs.push(RT.db.collection("veille_verify").onSnapshot((snap) => snap.docs.forEach(ingestVerify), quiet));
      /* Fiches entreprise déposées par la Routine (tâche « brief ») : seuls les faits avec URL sont repris. */
      subs.push(RT.db.collection("veille_briefs").onSnapshot((snap) => {
        setBriefs((cur) => {
          let changed = false;
          const next = { ...cur };
          snap.docs.forEach((d) => {
            const r = d.data() || {};
            const key = briefKey(r.company || d.id);
            if (!key || (cur[key] && cur[key].routineAt === r.createdAt)) return;
            next[key] = { ...mergeBriefs(cur[key], makeBrief({ company: r.company || d.id, summary: r.summary, facts: r.facts, origin: "routine", createdAt: r.createdAt })), routineAt: r.createdAt };
            changed = true;
          });
          return changed ? next : cur;
        });
      }, quiet));
      subs.push(RT.db.collection("veille_ratings").onSnapshot((snap) => {
        setRatings((cur) => {
          let changed = false;
          const next = { ...cur };
          snap.docs.forEach((d) => {
            const r = d.data() || {};
            const key = ratingKey(r.company || d.id);
            const prev = cur[key];
            if (key && (!prev || prev.seenAt !== r.seenAt)) { next[key] = { company: r.company, rating: typeof r.rating === "number" ? r.rating : null, reviews: typeof r.reviews === "number" ? r.reviews : null, source: str(r.source), url: str(r.url), note: str(r.note), seenAt: str(r.seenAt) || nowISO() }; changed = true; }
          });
          return changed ? next : cur;
        });
      }, quiet));
    } catch { /* capacité indisponible */ }
    return () => subs.forEach((u) => { try { u?.(); } catch { /* ignore */ } });
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  /* La configuration lue par la veille planifiée suit les critères actifs et les sources (critères et domaines uniquement). */
  const cfgNow = useMemo(() => veilleConfig(activeVersion(criteria), sources, settings), [criteria, sources, settings.lookbackDays, settings.maxPerSource, settings.rules]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (RT.mode !== "published" || !RT.db || !veille.configLoaded || veille.configSig === cfgNow.sig || storageState.readOnly) return undefined;
    const t = setTimeout(() => { RT.db.doc("veille/config").set({ ...cfgNow, updatedAt: nowISO() }).catch(() => {}); }, 1500);
    return () => clearTimeout(t);
  }, [cfgNow.sig, veille.configLoaded, veille.configSig]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Veille automatique à l'ouverture (option, désactivée par défaut) : lecture seule, rien n'est envoyé. */
  const autoRan = useRef(false);
  useEffect(() => {
    if (!loaded || autoRan.current || storageState.readOnly) return;
    autoRan.current = true;
    const s = R.current.settings;
    const stale = (iso) => !iso || (Date.now() - new Date(iso).getTime()) / 36e5 >= (s.autoWatchHours || 24);
    const t = setTimeout(async () => {
      if (s.autoGmail && stale(s.lastGmailImportAt)) await importGmail(s.gmailDays);
      if (s.autoWatch && RT.mode !== "published" && stale(s.lastWatchAt)) { toast("Veille automatique lancée (dernière collecte ancienne)", "neutral"); await runWatch(); }
    }, 1500);
    return () => clearTimeout(t);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (v, preset) => { setView(v); setMobileNav(false); if (preset !== undefined) setOfferPreset(preset); window.scrollTo?.({ top: 0 }); };

  const pApps = useMemo(() => apps.filter((a) => a.kind !== "base"), [apps]);
  const dueCount = useMemo(() => apps.reduce((n, a) => n + (a.followUps || []).filter((f) => f.status === "pending" && daysFromToday(f.due) <= 0).length, 0), [apps]);
  const unreadCount = useMemo(() => offers.filter((o) => o.status === "new" && !o.seenAt && !o.demo).length, [offers]);

  const ctx = {
    T, settings, setSettings, profile, setProfile, criteria, setCriteria, sources, setSources, offers, setOffers, apps: pApps, allApps: apps, contacts,
    busy, progress, toast, go, view, openOffer, openApp, staleIds, todayItems, todayAI, hasDemo, offerPreset, setOfferPreset,
    runWatch, importGmail, importManual, scoreOffers, rescoreStale, saveCriteriaVersion, restoreVersion, generateKeywords,
    addToPipeline, moveApp, requestMove, addInterview, patchApp, logApp, patchOffer, patchSource,
    createGmailDraft, createCalendarEvent, calTitle, generateDocs, draftMotivation, learnRules, setMasterCv, clearMasterCv, toggleLockedBullet, saveDocVersion, saveDocDraft, genStatus, runAnalysis, docAI, declareSkill,
    openStudio: (appId, type = "cv") => setStudio({ appId, type }), setOfferAdText, patchOfferNow, createSpontaneous, setSpontOpen,
    setFollowUp, draftFollowUp, completeFollowUp, addFollowUp, prepareInterview,
    saveContact, deleteContact, toggleAppContact, prioritizeToday,
    exportPayload, importPayload, resetAll, clearDemo, loadDemo, setManualOpen, setConfirm, storageState, saveState,
    media, setMedia, translateDoc,
    openStageDialog: (appId) => setStageDialog({ appId, stage: "interview" }),
    importOffersJSON, detectDuplicates, undoMerge, checkReplies, veille,
    ratings, requestRatings, briefs, requestBrief, addManualBrief, removeBriefFact, setAppMotivation, offerQueue, setOfferQueue, triageOffer, nextOfferId, setOfferSel,
    bulkAction, lastBulk, setLastBulk, undoBulk, runRules, dedupeNow, requestVerify, dupePending,
    openDupePending: () => dupePending && setDupeProposals(dupePending), visitPrev, unreadCount,
  };

  const View = { dashboard: DashboardView, offers: OffersView, pipeline: PipelineView, assistant: AssistantView, followups: FollowupsView, contacts: ContactsView, sources: SourcesView, profile: ProfileView, privacy: PrivacyView }[view] || DashboardView;
  const collapsed = settings.sidebarCollapsed;

  return (
    <ThemeCtx.Provider value={T}>
      <AppCtx.Provider value={ctx}>
        <div className={`min-h-screen ${T.app}`} style={{ fontFamily: FONT, fontFeatureSettings: '"cv11", "ss01"' }}>
          <a href="#radar-main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-indigo-600 focus:text-white">Aller au contenu</a>
          <div className="flex">
            {/* Navigation latérale */}
            <aside className={`hidden md:flex flex-col sticky top-0 h-screen shrink-0 transition-all duration-200 ${collapsed ? "w-16" : "w-60"} px-2 py-5`} aria-label="Navigation principale">
              <SidebarContent collapsed={collapsed} dueCount={dueCount} newCount={unreadCount} onToggle={() => setSettings((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }))} />
            </aside>
            {mobileNav && (
              <div className="md:hidden fixed inset-0 z-40">
                <div className="absolute inset-0" style={{ background: "rgba(12,10,9,0.35)" }} onClick={() => setMobileNav(false)} />
                <aside className={`absolute left-0 top-0 h-full w-72 px-3 py-5 flex flex-col ${T.app}`} style={T.shadow} aria-label="Navigation principale">
                  <SidebarContent collapsed={false} dueCount={dueCount} newCount={unreadCount} onToggle={() => setMobileNav(false)} mobile />
                </aside>
              </div>
            )}

            <main id="radar-main" className="flex-1 min-w-0">
              <TopBar onMenu={() => setMobileNav(true)} onPalette={() => setPaletteOpen(true)} privacy={privacy} setPrivacy={setPrivacy} />
              {progress && (
                <div className={`h-0.5 w-full ${T.sub}`} role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label={progress.label}>
                  <div className="h-full bg-indigo-600" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%`, transition: "width 250ms" }} />
                </div>
              )}
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 md:py-10">
                {storageState.message && (
                  <Notice tone="warn" icon={AlertTriangle} className="mb-6">
                    {storageState.message}
                    {storageState.retry && <Btn size="sm" variant="soft" icon={RefreshCw} className="ml-2" onClick={() => window.location.reload()}>Réessayer</Btn>}
                  </Notice>
                )}
                {recovery && (
                  <Notice tone="ok" icon={CheckCircle2} className="mb-6">
                    Données endommagées réparées : {recovery.map((r) => `${{ offers: "offres", apps: "candidatures", contacts: "contacts" }[r.name] || r.name}${r.count !== null ? ` (${r.count} récupérée(s))` : " (valeurs par défaut)"}`).join(", ")}.
                    Une copie brute est conservée. L'enregistrement fonctionne de nouveau, au format sécurisé.
                    <Btn size="sm" variant="ghost" className="ml-2" onClick={() => setRecovery(null)}>OK</Btn>
                  </Notice>
                )}
                {!loaded ? (
                  <div className="space-y-6">
                    {bootMsg && <p className={`text-sm ${T.muted}`} aria-live="polite">{bootMsg}</p>}
                    <Skeleton lines={2} />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <Card key={i} className="p-6"><Skeleton lines={2} /></Card>)}</div>
                    <Card className="p-6"><Skeleton lines={5} /></Card>
                  </div>
                ) : (
                  <View />
                )}
              </div>
            </main>
          </div>

          {offerSel && <OfferDrawer key={offerSel} id={offerSel} onClose={() => setOfferSel(null)} />}
          {appSel && <AppDrawer id={appSel.id} tab={appSel.tab} setTab={(t) => setAppSel((s) => ({ ...s, tab: t }))} onClose={() => setAppSel(null)} />}
          {studio && <DocStudio key={studio.appId} appId={studio.appId} type={studio.type} setType={(t) => setStudio((x) => ({ ...x, type: t }))} onClose={() => setStudio(null)} />}
          <ManualImportModal open={manualOpen} onClose={() => setManualOpen(false)} />
          <SpontaneousModal open={spontOpen} onClose={() => setSpontOpen(false)} />
          <DupeReviewModal groups={dupeProposals} setGroups={setDupeProposals} onApply={applyDupeProposals} offers={offers} apps={apps} />
          <ReplyReviewModal replies={replyProposals} setReplies={setReplyProposals} onResolve={resolveReply} apps={apps} offers={offers} />
          <StageDialog dialog={stageDialog} onClose={() => setStageDialog(null)} />
          <ConfirmExternalModal confirm={confirm} onClose={() => setConfirm(null)} />
          <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

          {privacy && (
            <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 70, ...T.glass, backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)" }}>
              <Btn variant="soft" icon={Eye} onClick={() => setPrivacy(false)} data-autofocus>Afficher l'écran</Btn>
            </div>
          )}

          <div className={`fixed bottom-4 left-4 flex flex-col gap-2 ${studio ? "right-4 sm:right-auto items-start" : "right-4 sm:left-auto items-end"}`} style={{ zIndex: 80 }} aria-live="polite" role="status">
            {toasts.map((t) => (
              <div key={t.id} className="max-w-sm w-full sm:w-auto rounded-2xl px-4 py-3 text-sm flex items-start gap-2" style={{ ...T.glass, ...T.shadow }}>
                {t.tone === "danger" ? <AlertTriangle className="w-4 h-4 mt-0.5 text-rose-500 shrink-0" /> : t.tone === "ok" ? <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${T.accentText}`} /> : t.tone === "warn" ? <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" /> : <Info className={`w-4 h-4 mt-0.5 shrink-0 ${T.muted}`} />}
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </AppCtx.Provider>
    </ThemeCtx.Provider>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   9. CHROME : navigation, barre supérieure, palette de commandes
   ════════════════════════════════════════════════════════════════════════ */

function SidebarContent({ collapsed, dueCount, newCount, onToggle, mobile }) {
  const { T, view, go, saveState, storageState } = { ...useApp(), T: useT() };
  const badge = { offers: newCount, followups: dueCount };
  return (
    <>
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-2 mb-8`}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-indigo-600 flex items-center justify-center"><Target className="w-4 h-4 text-white" aria-hidden="true" /></span>
            <span className="text-base font-semibold tracking-tight">Radar</span>
          </div>
        )}
        <IconBtn icon={mobile ? X : collapsed ? ChevronsRight : ChevronsLeft} label={mobile ? "Fermer le menu" : collapsed ? "Déplier la navigation" : "Replier la navigation"} onClick={onToggle} />
      </div>
      <nav className="flex-1 space-y-0.5">
        {NAV.map((n) => {
          const active = view === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => go(n.id)}
              aria-current={active ? "page" : undefined}
              title={collapsed ? n.label : undefined}
              className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-3 px-3"} h-10 rounded-xl text-sm transition-colors duration-150 ${active ? `${T.navActive} font-medium` : `${T.muted} ${T.subHover}`} ${T.ring}`}
              style={active ? T.shadow : undefined}
            >
              <span className="relative">
                <n.icon className="w-4 h-4" aria-hidden="true" />
                {collapsed && badge[n.id] > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-600" />}
              </span>
              {!collapsed && <span className="flex-1 text-left truncate">{n.label}</span>}
              {!collapsed && badge[n.id] > 0 && <span className={`text-xs tabular-nums ${n.id === "followups" ? "text-rose-600" : T.faint}`}>{badge[n.id]}</span>}
            </button>
          );
        })}
      </nav>
      {!collapsed && (
        <div className={`px-3 text-xs ${T.faint}`}>
          {storageState.readOnly ? "Enregistrement suspendu" : saveState.startsWith("error") ? <span className="text-rose-600">Erreur d'enregistrement</span> : saveState === "saving" ? "Enregistrement…" : "Données enregistrées"}
        </div>
      )}
    </>
  );
}

function TopBar({ onMenu, onPalette, privacy, setPrivacy }) {
  const T = useT();
  const { settings, setSettings, progress, busy, veille } = useApp();
  const vs = veille?.status;
  const veilleRunning = vs && ["requested", "running"].includes(vs.state) && Date.now() - new Date(vs.requestedAt || vs.startedAt || 0).getTime() < 45 * 6e4;
  const themeNext = { system: "light", light: "dark", dark: "system" };
  const ThemeIcon = settings.theme === "dark" ? Moon : settings.theme === "light" ? Sun : Monitor;
  const running = busy.watch ? "Veille en cours" : busy.gmail ? "Import Gmail" : busy.score ? "Scoring" : null;
  return (
    <div className="sticky z-30" style={{ ...T.glass, top: "env(safe-area-inset-top, 0px)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-14 flex items-center gap-2">
        <IconBtn icon={Menu} label="Ouvrir le menu" onClick={onMenu} className="md:hidden" />
        <button type="button" onClick={onPalette} className={`flex-1 min-w-0 max-w-md flex items-center gap-2 h-9 px-3 rounded-xl text-sm ${T.sub} ${T.muted} ${T.ring}`} aria-label="Ouvrir la palette de commandes">
          <Search className="w-4 h-4" aria-hidden="true" />
          <span className="flex-1 text-left truncate">Rechercher, naviguer, lancer une action…</span>
          <kbd className={`hidden sm:inline-flex items-center gap-0.5 text-xs rounded-md px-1.5 py-0.5 ${T.surface}`}><Command className="w-3 h-3" />K</kbd>
        </button>
        <div className="hidden sm:block flex-1" />
        {(running || progress) && (
          <span className={`hidden sm:inline-flex items-center gap-2 text-xs ${T.muted}`} aria-live="polite">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            {progress ? `${progress.label} · ${progress.done}/${progress.total}` : running}
          </span>
        )}
        {veilleRunning && <span className={`hidden sm:inline-flex items-center gap-2 text-xs ${T.muted}`} aria-live="polite"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />{vs.state === "running" ? "Veille en cours" : "Veille demandée"}</span>}
        {settings.discreet && <Chip tone="accent" className="hidden sm:inline-flex"><ShieldCheck className="w-3 h-3" aria-hidden="true" />Mode discret</Chip>}
        <IconBtn icon={privacy ? Eye : EyeOff} label="Masquer l'écran (confidentialité)" onClick={() => setPrivacy(!privacy)} />
        <IconBtn icon={ThemeIcon} label={`Thème : ${settings.theme === "system" ? "système" : settings.theme === "dark" ? "sombre" : "clair"}`} onClick={() => setSettings((s) => ({ ...s, theme: themeNext[s.theme] }))} />
      </div>
    </div>
  );
}

function CommandPalette({ open, onClose }) {
  const T = useT();
  const app = useApp();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const ref = useRef(null);
  useFocusTrap(open, ref, onClose);
  useEffect(() => { if (open) { setQ(""); setIdx(0); } }, [open]);

  const items = useMemo(() => {
    if (!open) return [];
    const run = (fn) => () => { onClose(); fn(); };
    const list = [
      { group: "Actions", label: "Lancer la veille", hint: "toutes les sources actives", icon: Play, run: run(() => app.runWatch()) },
      { group: "Actions", label: "Importer les alertes e-mail (Gmail)", icon: Mail, run: run(() => app.importGmail()) },
      { group: "Actions", label: "Importer une annonce (URL ou texte)", icon: Clipboard, run: run(() => app.setManualOpen(true)) },
      { group: "Actions", label: "Candidature spontanée ou CV sans offre", hint: "studio", icon: Plus, run: run(() => app.setSpontOpen(true)) },
      { group: "Actions", label: "Voir les relances dues", icon: BellRing, run: run(() => app.go("followups")) },
      { group: "Actions", label: "Vérifier les réponses des recruteurs (Gmail)", icon: MailCheck, run: run(() => app.checkReplies()) },
      { group: "Actions", label: "Détecter les doublons (IA)", icon: GitMerge, run: run(() => app.detectDuplicates()) },
      { group: "Actions", label: "Recalculer les scores obsolètes", hint: `${app.staleIds.length}`, icon: RefreshCw, run: run(() => app.rescoreStale()) },
      { group: "Actions", label: "Prioriser mes actions du jour (IA)", icon: Wand2, run: run(() => { app.go("dashboard"); app.prioritizeToday(); }) },
      { group: "Actions", label: "Exporter une sauvegarde JSON", icon: Download, run: run(() => app.go("privacy")) },
      ...NAV.map((n) => ({ group: "Navigation", label: n.label, icon: n.icon, run: run(() => app.go(n.id)) })),
      ...app.apps
        .filter((a) => ["new", "retained", "prep"].includes(a.stage))
        .map((a) => {
          const o = app.offers.find((x) => x.id === a.offerId);
          return { group: "Préparer candidature", label: `Préparer : ${o?.title || "poste"}`, hint: o?.company || "", icon: Sparkles, run: run(() => app.openStudio(a.id, "cv")) };
        }),
      ...app.offers
        .filter(isActiveOffer)
        .slice(0, 200)
        .map((o) => ({ group: "Offres", label: o.title, hint: `${o.company || NC}${o.score ? ` · ${o.score.value}` : ""}`, icon: Briefcase, run: run(() => app.openOffer(o.id)) })),
    ];
    const nq = normText(q);
    const filtered = nq ? list.filter((i) => normText(`${i.label} ${i.hint || ""} ${i.group}`).includes(nq)) : list.filter((i) => i.group !== "Offres");
    return filtered.slice(0, 40);
  }, [open, q, app.apps, app.offers, app.staleIds]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    if (e.key === "Enter" && items[idx]) { e.preventDefault(); items[idx].run(); }
  };
  let lastGroup = null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" role="dialog" aria-modal="true" aria-label="Palette de commandes">
      <div className="absolute inset-0" style={{ background: "rgba(12,10,9,0.3)" }} onClick={onClose} />
      <div ref={ref} className="relative w-full max-w-xl rounded-3xl overflow-hidden" style={{ ...T.glass, ...T.shadow }}>
        <div className={`flex items-center gap-3 px-5 h-14 border-b ${T.line}`}>
          <Search className={`w-4 h-4 ${T.muted}`} aria-hidden="true" />
          <input
            data-autofocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={onKey}
            placeholder="Tapez une commande ou un intitulé d'offre…"
            className="flex-1 bg-transparent outline-none text-sm"
            aria-label="Commande"
            role="combobox"
            aria-expanded="true"
            aria-controls="radar-palette-list"
            aria-activedescendant={items[idx] ? `pal-${idx}` : undefined}
          />
          <kbd className={`text-xs rounded-md px-1.5 py-0.5 ${T.sub} ${T.muted}`}>Esc</kbd>
        </div>
        <ul id="radar-palette-list" role="listbox" className="max-h-96 overflow-y-auto p-2">
          {items.length === 0 && <li className={`px-3 py-6 text-sm text-center ${T.muted}`}>Aucun résultat</li>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <React.Fragment key={`${it.group}-${it.label}-${i}`}>
                {header && <li className={`px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider ${T.faint}`} role="presentation">{header}</li>}
                <li
                  id={`pal-${i}`}
                  role="option"
                  aria-selected={i === idx}
                  onMouseEnter={() => setIdx(i)}
                  onClick={it.run}
                  className={`flex items-center gap-3 px-3 h-10 rounded-xl text-sm cursor-pointer transition-colors duration-150 ${i === idx ? T.accentSoft : ""}`}
                >
                  <it.icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.hint && <span className={`text-xs truncate max-w-40 ${T.faint}`}>{it.hint}</span>}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   10. VUE D'ENSEMBLE (dashboard bento)
   ════════════════════════════════════════════════════════════════════════ */

function Kpi({ label, value, sub, onClick, icon: Icon }) {
  const T = useT();
  return (
    <Card as="button" type="button" onClick={onClick} className={`p-5 text-left transition-transform duration-200 hover:-translate-y-0.5 ${T.ring}`}>
      <div className={`flex items-center gap-2 text-xs ${T.muted}`}>
        {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
        {label}
      </div>
      <div className="mt-3 text-3xl font-light tracking-tight tabular-nums">{value}</div>
      {sub && <div className={`mt-1 text-xs ${T.faint}`}>{sub}</div>}
    </Card>
  );
}

function ChartTooltip({ active, payload, label, suffix = "" }) {
  const T = useT();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs" style={{ ...T.glass, ...T.shadow }}>
      <div className={T.muted}>{label}</div>
      <div className="font-medium tabular-nums">{payload[0].value}{suffix}</div>
    </div>
  );
}

function weekKey(iso) {
  const d = startOfDay(iso);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function DashboardView() {
  const T = useT();
  const { offers, apps, settings, go, runWatch, busy, todayItems, prioritizeToday, todayAI, openOffer, profile, staleIds, rescoreStale, hasDemo, unreadCount, visitPrev } = useApp();
  const th = settings.threshold;

  const k = useMemo(() => {
    const sent = apps.filter((a) => a.sentAt);
    const responded = sent.filter((a) => ["interview", "offer"].includes(a.stage) || (a.interviews || []).length || (a.stage === "closed" && a.closed?.outcome !== "withdrawn"));
    const upcoming = apps.flatMap((a) => (a.interviews || []).filter((i) => new Date(i.at) >= startOfDay(new Date())));
    return {
      todo: offers.filter((o) => o.status === "new").length,
      above: offers.filter((o) => o.status === "new" && o.score?.value >= th).length,
      active: apps.filter((a) => a.stage !== "closed").length,
      due: apps.reduce((n, a) => n + (a.followUps || []).filter((f) => f.status === "pending" && daysFromToday(f.due) <= 0).length, 0),
      interviews: upcoming.length,
      nextInterview: upcoming.sort((a, b) => new Date(a.at) - new Date(b.at))[0],
      rate: sent.length ? Math.round((responded.length / sent.length) * 100) : null,
      sent: sent.length,
    };
  }, [offers, apps, th]);

  const bySource = useMemo(() => {
    const m = {};
    offers.filter((o) => !o.spontaneous).forEach((o) => [...new Set((o.sources || []).map((s) => s.name))].forEach((n) => { m[n] = (m[n] || 0) + 1; }));
    return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [offers]);

  const scoreTrend = useMemo(() => {
    const m = {};
    offers.filter((o) => o.score).forEach((o) => {
      const w = weekKey(o.collectedAt);
      m[w] = m[w] || { sum: 0, n: 0 };
      m[w].sum += o.score.value;
      m[w].n += 1;
    });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).slice(-10).map(([w, v]) => ({ week: fmtDate(w), avg: Math.round(v.sum / v.n) }));
  }, [offers]);

  const funnel = useMemo(() => {
    const steps = [["retained", "Retenues"], ["prep", "Préparées"], ["sent", "Envoyées"], ["interview", "Entretiens"], ["offer", "Offres"]];
    return steps.map(([id, label]) => ({ label, count: apps.filter((a) => (a.reached ?? (a.stage === "closed" ? 0 : STAGE_INDEX[a.stage])) >= STAGE_INDEX[id]).length }));
  }, [apps]);

  const top = useMemo(() => offers.filter((o) => ["new", "pipeline"].includes(o.status) && o.score).sort((a, b) => b.score.value - a.score.value).slice(0, 5), [offers]);
  const deadlines = useMemo(() => offers.filter((o) => ["new", "pipeline"].includes(o.status) && deadlineIn(o) !== null && deadlineIn(o) >= 0 && deadlineIn(o) <= 21).sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 6), [offers]);
  const since = useMemo(() => {
    const ref = new Date(visitPrev || addDays(nowISO(), -3));
    const arr = offers.filter((o) => new Date(o.collectedAt) > ref && !o.demo && !o.spontaneous);
    return { total: arr.length, kept: arr.filter((o) => ["new", "pipeline"].includes(o.status)).length, auto: arr.filter((o) => o.dismissedBy === "auto").length, good: arr.filter((o) => o.status === "new" && o.score?.value >= th).length };
  }, [offers, visitPrev, th]);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div>
      <PageHeader
        title={`${hello}${profile.name ? `, ${profile.name.split(" ")[0]}` : ""}.`}
        subtitle={`Dernière veille ${relTime(settings.lastWatchAt)} · dernier import Gmail ${relTime(settings.lastGmailImportAt)}`}
        actions={
          <>
            {staleIds.length > 0 && <Btn icon={RefreshCw} onClick={rescoreStale} loading={busy.score}>Scorer {staleIds.length} offre(s)</Btn>}
            <Btn variant="primary" icon={Play} onClick={() => runWatch()} loading={busy.watch}>Lancer la veille</Btn>
          </>
        }
      />
      {hasDemo && (
        <Notice tone="accent" icon={Info} className="mb-6">
          Des données d'<strong>exemple</strong> sont affichées pour la démonstration. Supprimez-les en un clic dans{" "}
          <button type="button" className="underline underline-offset-4" onClick={() => go("privacy")}>Confidentialité & données</button>.
        </Notice>
      )}

      {since.total > 0 && (
        <Card className="p-5 mb-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 text-sm">
              <span className="font-medium">Depuis votre dernière visite{visitPrev ? ` (${relTime(visitPrev)})` : ""} :</span>{" "}
              {since.total} offre(s) arrivée(s) · <strong>{since.kept} retenue(s) à trier</strong>{since.good ? ` dont ${since.good} au-dessus de ${th}` : ""} · {since.auto} écartée(s) ou expirée(s) automatiquement par vos règles.
            </div>
            <div className="flex gap-2">
              <Btn size="sm" variant="primary" icon={Inbox} onClick={() => go("offers", { tab: "unread" })}>Trier les non lues ({unreadCount})</Btn>
              <Btn size="sm" icon={History} onClick={() => go("offers", { tab: "arrivals" })}>Voir les arrivées</Btn>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
        <Kpi label="Non lues" value={unreadCount} sub={`${k.todo} à traiter au total`} icon={Inbox} onClick={() => go("offers", { tab: "unread" })} />
        <Kpi label={`Au-dessus de ${th}`} value={k.above} sub="à traiter, score ≥ seuil" icon={Gauge} onClick={() => go("offers", { tab: "todo", minScore: th })} />
        <Kpi label="Candidatures actives" value={k.active} sub="hors clôturées" icon={Columns} onClick={() => go("pipeline")} />
        <Kpi label="Relances dues" value={k.due} sub="aujourd'hui ou en retard" icon={BellRing} onClick={() => go("followups")} />
        <Kpi label="Entretiens à venir" value={k.interviews} sub={k.nextInterview ? `prochain ${relDay(k.nextInterview.at)}` : "aucun planifié"} icon={CalendarPlus} onClick={() => go("followups")} />
        <Kpi label="Taux de réponse" value={k.rate === null ? "—" : `${k.rate} %`} sub={`${k.sent} envoyée(s)`} icon={TrendingUp} onClick={() => go("pipeline")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
        <Card className="p-6 lg:col-span-3 lg:row-span-2">
          <SectionTitle action={<Btn size="sm" variant="ghost" icon={Wand2} onClick={prioritizeToday} loading={busy.today} disabled={!todayItems.length}>Prioriser avec l'IA</Btn>}>
            À faire aujourd'hui
          </SectionTitle>
          {todayAI && <p className={`text-xs mb-3 ${T.faint}`}>Ordre proposé par l'IA {relTime(todayAI.at)}.</p>}
          {todayItems.length === 0 ? (
            <Empty icon={CheckCircle2} title="Rien d'urgent" text="Aucune relance due ni entretien imminent. Lancez la veille pour alimenter la liste." />
          ) : (
            <ul className="space-y-1">
              {todayItems.slice(0, 9).map((it) => (
                <li key={it.id}>
                  <button type="button" onClick={it.go} className={`w-full flex items-start gap-3 text-left rounded-2xl px-3 py-3 transition-colors duration-150 ${T.subHover} ${T.ring}`}>
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${(it.ai?.priority ?? it.weight) === 1 ? "bg-indigo-600" : (it.ai?.priority ?? it.weight) === 2 ? (T.dark ? "bg-stone-400" : "bg-stone-500") : T.dark ? "bg-stone-600" : "bg-stone-300"}`} aria-hidden="true" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium">{it.label}{it.demo && <Chip className="ml-2">exemple</Chip>}</span>
                      <span className={`block text-xs truncate ${T.muted}`}>{it.detail}{it.due ? ` · ${relDay(it.due)}` : ""}</span>
                      {it.ai?.reason && <span className={`block text-xs mt-0.5 ${T.accentText}`}>{it.ai.reason}</span>}
                    </span>
                    <ChevronRight className={`w-4 h-4 mt-1 ${T.faint}`} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6 lg:col-span-3">
          <SectionTitle action={<Btn size="sm" variant="ghost" onClick={() => go("offers")}>Tout voir</Btn>}>Meilleures offres</SectionTitle>
          {top.length === 0 ? (
            <Empty icon={Briefcase} title="Aucune offre scorée" text="Lancez la veille ou importez vos alertes Gmail." />
          ) : (
            <ul className="space-y-1">
              {top.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => openOffer(o.id)} className={`w-full flex items-center gap-3 rounded-2xl px-2 py-2 text-left ${T.subHover} ${T.ring}`}>
                    <ScorePill score={o.score} threshold={th} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{o.title}</span>
                      <span className={`block text-xs truncate ${T.muted}`}>{show(o.company)} · {show(o.location)} · {commuteLabel(o.commute)}</span>
                    </span>
                    {o.demo && <Chip>exemple</Chip>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6 lg:col-span-3">
          <SectionTitle action={<Btn size="sm" variant="ghost" onClick={() => go("offers", { tab: "deadlines" })}>Tout voir</Btn>}>Dates limites proches</SectionTitle>
          {deadlines.length === 0 ? (
            <Empty icon={CalendarClock} title="Aucune date limite dans les 3 semaines" text="Les dates limites sont extraites des annonces quand elles sont indiquées." />
          ) : (
            <ul className="space-y-1">
              {deadlines.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => openOffer(o.id)} className={`w-full flex items-center gap-3 rounded-2xl px-2 py-2 text-left ${T.subHover} ${T.ring}`}>
                    <span className="w-14 shrink-0"><DeadlineChip o={o} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{o.title}</span>
                      <span className={`block text-xs truncate ${T.muted}`}>{show(o.company)} · limite {fmtDate(o.deadline)}{o.status === "pipeline" ? " · dans le pipeline" : ""}</span>
                    </span>
                    <ScorePill score={o.score} threshold={th} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6 lg:col-span-3">
          <SectionTitle>Entonnoir de candidature</SectionTitle>
          <div className="space-y-2.5">
            {funnel.map((f) => {
              const max = Math.max(1, funnel[0].count);
              return (
                <div key={f.label} className="flex items-center gap-3 text-sm">
                  <span className={`w-24 shrink-0 text-xs ${T.muted}`}>{f.label}</span>
                  <div className={`flex-1 h-6 rounded-lg overflow-hidden ${T.sub}`}>
                    <div className="h-full rounded-lg bg-indigo-600" style={{ width: `${(f.count / max) * 100}%`, opacity: 0.35 + 0.65 * (f.count / max), transition: "width 250ms" }} />
                  </div>
                  <span className="w-8 text-right tabular-nums">{f.count}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6 lg:col-span-3">
          <SectionTitle>Volume par source</SectionTitle>
          {bySource.length === 0 ? <Empty icon={Radio} title="Pas encore de données" /> : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bySource} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: T.chart.text }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip suffix=" offre(s)" />} cursor={{ fill: T.chart.grid }} />
                  <Bar dataKey="count" radius={[6, 6, 6, 6]} barSize={14}>
                    {bySource.map((_, i) => <Cell key={i} fill={i === 0 ? T.chart.accent : T.chart.neutral} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-6 lg:col-span-3">
          <SectionTitle>Score moyen par semaine de collecte</SectionTitle>
          {scoreTrend.length < 2 ? <Empty icon={Gauge} title="Tendance disponible après deux semaines de collecte" /> : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scoreTrend} margin={{ left: -16, right: 16, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke={T.chart.grid} vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: T.chart.text }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: T.chart.text }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip suffix=" / 100" />} />
                  <Line type="monotone" dataKey="avg" stroke={T.chart.accent} strokeWidth={2} dot={{ r: 3, fill: T.chart.accent }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   11. OFFRES
   ════════════════════════════════════════════════════════════════════════ */

const DEFAULT_FILTERS = { tab: "todo", q: "", source: "", minScore: 0, maxCommute: 0, pubWithin: 0, sort: "score", origin: "" };
const OFFER_TABS = [
  { id: "todo", label: "À traiter", hint: "Offres actives pas encore décidées" },
  { id: "unread", label: "Non lues", hint: "À traiter, jamais ouvertes" },
  { id: "arrivals", label: "Arrivées", hint: "Collectées depuis votre dernière visite (toutes, y compris triées automatiquement)" },
  { id: "deadlines", label: "Échéances", hint: "Offres actives avec date limite de candidature" },
  { id: "pipeline", label: "Pipeline" },
  { id: "dismissed", label: "Écartées" },
  { id: "expired", label: "Expirées" },
  { id: "all", label: "Toutes" },
];
const dayLabel = (iso) => {
  const n = -daysFromToday(iso);
  if (n <= 0) return "Aujourd'hui";
  if (n === 1) return "Hier";
  if (n < 7) return new Date(iso).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "short" });
  return `Semaine du ${fmtDate(addDays(startOfDay(iso).toISOString(), -((new Date(iso).getDay() + 6) % 7)))}`;
};

function OffersView() {
  const T = useT();
  const {
    offers, settings, busy, runWatch, setManualOpen, openOffer, offerPreset, setOfferPreset, staleIds, rescoreStale, criteria, detectDuplicates,
    setOfferQueue, ratings, requestRatings, bulkAction, lastBulk, setLastBulk, undoBulk, dedupeNow, dupePending, openDupePending, visitPrev, addToPipeline, triageOffer,
  } = useApp();
  const [f, setF] = useState(DEFAULT_FILTERS);
  const [sel, setSel] = useState(() => new Set());
  const [rulesOpen, setRulesOpen] = useState(false);
  const anchor = useRef(null);
  useEffect(() => {
    if (offerPreset) { setF({ ...DEFAULT_FILTERS, ...offerPreset }); setOfferPreset(null); }
  }, [offerPreset]); // eslint-disable-line react-hooks/exhaustive-deps

  const since = useMemo(() => visitPrev || addDays(nowISO(), -3), [visitPrev]); // stable : sinon la liste se recalcule à chaque rendu
  const realOffers = useMemo(() => offers.filter((o) => !o.spontaneous), [offers]);
  const inTab = useMemo(() => ({
    todo: (o) => o.status === "new",
    unread: (o) => o.status === "new" && !o.seenAt,
    arrivals: (o) => new Date(o.collectedAt) > new Date(since),
    deadlines: (o) => ["new", "pipeline"].includes(o.status) && !!o.deadline,
    pipeline: (o) => o.status === "pipeline",
    dismissed: (o) => o.status === "dismissed",
    expired: (o) => o.status === "expired" || o.status === "closed",
    all: () => true,
  }), [since]);
  const counts = useMemo(() => Object.fromEntries(OFFER_TABS.map((t) => [t.id, realOffers.filter(inTab[t.id]).length])), [realOffers, inTab]);

  const sourceNames = useMemo(() => [...new Set(realOffers.flatMap((o) => (o.sources || []).map((s) => s.name)))].sort(), [realOffers]);
  const vid = activeVersion(criteria)?.id;
  const list = useMemo(() => {
    const nq = normText(f.q);
    const l = realOffers.filter((o) => {
      if (!inTab[f.tab](o)) return false;
      if (f.origin === "auto" && o.dismissedBy !== "auto") return false;
      if (f.origin === "user" && o.dismissedBy === "auto") return false;
      if (f.source && !(o.sources || []).some((s) => s.name === f.source)) return false;
      if (f.minScore && !(o.score?.value >= f.minScore)) return false;
      if (f.maxCommute && !(o.commute && o.commute.minutes <= f.maxCommute)) return false;
      if (f.pubWithin) { const a = ageDays(pubRef(o)); if (a === null || a > f.pubWithin) return false; }
      if (nq && !normText(`${o.title} ${o.company} ${o.location} ${o.description}`).includes(nq)) return false;
      return true;
    });
    const t = (d) => (validDate(d) ? new Date(d).getTime() : null);
    const cmp = {
      score: (a, b) => (b.score?.value ?? -1) - (a.score?.value ?? -1) || (t(b.publishedAt) ?? 0) - (t(a.publishedAt) ?? 0),
      published: (a, b) => (t(b.publishedAt) ?? -1) - (t(a.publishedAt) ?? -1),
      deadline: (a, b) => (t(a.deadline) ?? 8.64e15) - (t(b.deadline) ?? 8.64e15),
      arrival: (a, b) => new Date(b.collectedAt) - new Date(a.collectedAt),
      commute: (a, b) => (a.commute?.minutes ?? 999) - (b.commute?.minutes ?? 999),
    }[f.tab === "deadlines" && f.sort === "score" ? "deadline" : f.tab === "arrivals" && f.sort === "score" ? "arrival" : f.sort] || ((a, b) => 0);
    return [...l].sort(cmp);
  }, [realOffers, f, inTab]);
  useEffect(() => { setOfferQueue(list.map((o) => o.id)); }, [list]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSel((cur) => { const ids = new Set(list.map((o) => o.id)); const n = new Set([...cur].filter((id) => ids.has(id))); return n.size === cur.size ? cur : n; }); }, [list]);
  const unrated = useMemo(() => [...new Set(list.map((o) => o.company).filter((c) => c && !ratings[ratingKey(c)] && realCompany(c)))], [list, ratings]);
  const grouped = f.tab === "arrivals" || f.sort === "arrival";
  const groups = useMemo(() => {
    if (!grouped) return [{ key: "all", label: null, items: list }];
    const g = [];
    list.forEach((o) => { const k = dayLabel(o.collectedAt); const last = g[g.length - 1]; if (last && last.label === k) last.items.push(o); else g.push({ key: k, label: k, items: [o] }); });
    return g;
  }, [list, grouped]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: /minScore|maxCommute|pubWithin/.test(k) ? Number(e.target.value) : e.target.value }));
  const toggle = (id, e) => {
    setSel((cur) => {
      const n = new Set(cur);
      if (e?.shiftKey && anchor.current) {
        const ids = list.map((o) => o.id);
        const a = ids.indexOf(anchor.current), b = ids.indexOf(id);
        if (a >= 0 && b >= 0) { ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((x) => n.add(x)); return n; }
      }
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
    anchor.current = id;
  };
  const allSel = list.length > 0 && list.every((o) => sel.has(o.id));
  const act = (kind) => { const ids = [...sel]; if (!ids.length) return; bulkAction(kind, ids); if (!["score", "verify"].includes(kind)) setSel(new Set()); };
  const selOffers = list.filter((o) => sel.has(o.id));
  const canRestore = selOffers.some((o) => ["dismissed", "expired"].includes(o.status));
  const canDecide = selOffers.some((o) => o.status === "new");

  return (
    <div className="pb-24">
      <PageHeader
        title="Offres"
        subtitle={`${counts.todo} à traiter · ${counts.unread} non lue(s) · ${counts.arrivals} arrivée(s) depuis ${visitPrev ? relTime(visitPrev).replace("il y a ", "") : "3 jours"} · tri, score et doublons automatiques`}
        actions={
          <>
            {dupePending?.length > 0 && <Btn icon={GitMerge} onClick={openDupePending}>{dupePending.length} doublon(s) à valider</Btn>}
            {staleIds.length > 0 && <Btn icon={RefreshCw} onClick={rescoreStale} loading={busy.score}>Scorer {staleIds.length}</Btn>}
            <Btn icon={Filter} onClick={() => setRulesOpen(true)}>Règles de tri</Btn>
            <Btn icon={Clipboard} onClick={() => setManualOpen(true)}>Importer</Btn>
            <Btn variant="primary" icon={Play} onClick={() => runWatch()} loading={busy.watch}>Lancer la veille</Btn>
          </>
        }
      />

      <div className="flex gap-1 overflow-x-auto mb-4 -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Catégories d'offres">
        {OFFER_TABS.map((t) => {
          const active = f.tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              title={t.hint}
              onClick={() => setF((x) => ({ ...x, tab: t.id, origin: "" }))}
              className={`shrink-0 inline-flex items-center gap-2 h-9 px-3 rounded-xl text-sm transition-colors duration-150 ${active ? `${T.navActive} font-medium` : `${T.muted} ${T.subHover}`} ${T.ring}`}
              style={active ? T.shadow : undefined}
            >
              {t.label}
              <span className={`text-xs tabular-nums ${t.id === "unread" && counts.unread ? T.accentText : T.faint}`}>{counts[t.id]}</span>
            </button>
          );
        })}
      </div>

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
          <Field label="Recherche" className="col-span-2">
            <Input value={f.q} onChange={set("q")} placeholder="Intitulé, entreprise, lieu…" />
          </Field>
          <Field label="Source">
            <Select value={f.source} onChange={set("source")} className="w-full">
              <option value="">Toutes</option>
              {sourceNames.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Score minimum">
            <Select value={f.minScore} onChange={set("minScore")} className="w-full">
              <option value={0}>Tous</option>
              <option value={50}>≥ 50</option>
              <option value={settings.threshold}>≥ seuil ({settings.threshold})</option>
              <option value={85}>≥ 85</option>
            </Select>
          </Field>
          <Field label="Publiée depuis">
            <Select value={f.pubWithin} onChange={set("pubWithin")} className="w-full">
              <option value={0}>Indifférent</option>
              <option value={7}>≤ 7 jours</option>
              <option value={14}>≤ 14 jours</option>
              <option value={30}>≤ 30 jours</option>
            </Select>
          </Field>
          <Field label="Trajet max">
            <Select value={f.maxCommute} onChange={set("maxCommute")} className="w-full">
              <option value={0}>Indifférent</option>
              <option value={30}>≤ 30 min</option>
              <option value={45}>≤ 45 min</option>
              <option value={60}>≤ 60 min</option>
            </Select>
          </Field>
          <Field label="Tri">
            <Select value={f.sort} onChange={set("sort")} className="w-full">
              <option value="score">Score</option>
              <option value="published">Date de publication</option>
              <option value="deadline">Date limite</option>
              <option value="arrival">Date d'arrivée (groupée)</option>
              <option value="commute">Trajet</option>
            </Select>
          </Field>
        </div>
        {f.tab === "dismissed" && (
          <div className="flex flex-wrap gap-2 mt-3">
            {[["", "Toutes"], ["auto", "Par les règles"], ["user", "Par vous"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setF((x) => ({ ...x, origin: v }))} className={`h-7 px-3 rounded-lg text-xs ${f.origin === v ? T.navActive : `${T.muted} ${T.subHover}`} ${T.ring}`}>{l}</button>
            ))}
          </div>
        )}
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs ${T.faint}`}>
          <button type="button" className={`underline underline-offset-4 ${T.ring} rounded`} onClick={dedupeNow}>Fusionner les doublons évidents</button>
          <button type="button" className={`underline underline-offset-4 ${T.ring} rounded`} onClick={() => detectDuplicates()} disabled={busy.dedupe}>{busy.dedupe ? "Recherche IA des doublons…" : "Doublons reformulés (IA)"}</button>
          {unrated.length > 0 && <button type="button" className={`underline underline-offset-4 ${T.ring} rounded`} onClick={() => requestRatings(unrated)} disabled={busy.ratings}>Noter {Math.min(25, unrated.length)} employeur(s)</button>}
          {(f.q || f.source || f.minScore || f.maxCommute || f.pubWithin) ? <button type="button" className={`underline underline-offset-4 ${T.ring} rounded`} onClick={() => setF((x) => ({ ...DEFAULT_FILTERS, tab: x.tab, sort: x.sort }))}>Effacer les filtres</button> : null}
        </div>
      </Card>

      {lastBulk && (
        <Notice tone="accent" icon={History} className="mb-4">
          <span>{lastBulk.label}.</span>
          {lastBulk.undoable && <button type="button" className="ml-2 font-medium underline underline-offset-4" onClick={undoBulk}>Annuler</button>}
          <button type="button" className="ml-3 underline underline-offset-4 opacity-70" onClick={() => setLastBulk(null)}>Masquer</button>
        </Notice>
      )}

      {busy.watch && <Card className="p-6 mb-4"><Skeleton lines={4} /></Card>}
      {list.length === 0 && !busy.watch ? (
        <Card>
          <Empty
            icon={f.tab === "unread" || f.tab === "todo" ? CheckCircle2 : Search}
            title={f.tab === "unread" ? "Tout est lu" : f.tab === "todo" ? "Rien à traiter" : "Aucune offre ici"}
            text={f.tab === "todo" || f.tab === "unread" ? "Les nouvelles offres arrivent avec la veille planifiée ; celles qui ne passent pas vos règles vont directement dans « Écartées » ou « Expirées »." : "Élargissez les filtres ou changez d'onglet."}
          />
        </Card>
      ) : (
        <Card className="p-2">
          <div className={`hidden md:flex items-center gap-3 px-3 py-2 text-xs ${T.faint}`}>
            <input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(list.map((o) => o.id)))} aria-label="Tout sélectionner" className="w-4 h-4" />
            <span className="w-10">Score</span>
            <span className="flex-1">Offre</span>
            <span className="w-24">Publiée</span>
            <span className="w-20">Limite</span>
            <span className="w-20">Arrivée</span>
            <span className="w-16">Trajet</span>
            <span className="w-24 text-right">Décider</span>
          </div>
          <div className="md:hidden flex items-center gap-2 px-3 py-2 text-xs">
            <input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(list.map((o) => o.id)))} aria-label="Tout sélectionner" className="w-4 h-4" />
            <span className={T.faint}>Tout sélectionner ({list.length})</span>
          </div>
          {groups.map((g) => (
            <div key={g.key}>
              {g.label && <div className={`px-3 pt-4 pb-1 text-xs font-medium uppercase tracking-wider ${T.faint}`}>{g.label} · {g.items.length}</div>}
              <ul className={`divide-y ${T.divide}`}>
                {g.items.map((o) => (
                  <OfferRow
                    key={o.id}
                    o={o}
                    vid={vid}
                    selected={sel.has(o.id)}
                    onToggle={(e) => toggle(o.id, e)}
                    onOpen={() => openOffer(o.id)}
                    onKeep={() => addToPipeline(o.id, "retained")}
                    onDismiss={() => triageOffer(o.id, { status: "dismissed", dismissedAt: nowISO() })}
                    onExpire={() => triageOffer(o.id, { status: "expired", expiredAt: nowISO() })}
                  />
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}

      {sel.size > 0 && (
        <div className="fixed bottom-4 left-4 right-4 flex justify-center" style={{ zIndex: 60 }}>
          <div className="max-w-full flex flex-wrap items-center gap-1.5 rounded-2xl px-3 py-2" style={{ ...T.glass, ...T.shadow }} role="toolbar" aria-label="Actions sur la sélection">
            <span className="text-sm font-medium px-2 tabular-nums">{sel.size} sélectionnée(s)</span>
            {canDecide && <Btn size="sm" icon={X} onClick={() => act("dismiss")}>Écarter</Btn>}
            {canDecide && <Btn size="sm" icon={Clock} onClick={() => act("expire")}>Expirées</Btn>}
            {canRestore && <Btn size="sm" icon={RotateCcw} onClick={() => act("restore")}>Remettre à traiter</Btn>}
            <Btn size="sm" icon={Eye} onClick={() => act("seen")}>Lues</Btn>
            {canDecide && <Btn size="sm" icon={Plus} onClick={() => act("pipeline")}>Pipeline</Btn>}
            <Btn size="sm" icon={Gauge} onClick={() => act("score")} loading={busy.score}>Scorer</Btn>
            <Btn size="sm" icon={Link2} onClick={() => act("verify")} loading={busy.verify}>Vérifier les liens</Btn>
            {sel.size >= 2 && sel.size <= 6 && <Btn size="sm" icon={GitMerge} onClick={() => act("merge")}>Fusionner</Btn>}
            <Btn size="sm" variant="ghost" icon={Trash2} onClick={() => act("remove")}>Supprimer</Btn>
            <IconBtn icon={X} label="Vider la sélection" onClick={() => setSel(new Set())} />
          </div>
        </div>
      )}

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}

function FreshChip({ o, compact }) {
  const T = useT();
  const fr = freshness(o);
  const color = fr.tone === "ok" ? (T.dark ? "text-emerald-200" : "text-emerald-800") : fr.tone === "warn" ? (T.dark ? "text-amber-200" : "text-amber-900") : T.muted;
  return <span className={`text-xs tabular-nums ${color}`} title={o.publishedAt ? `Publiée le ${fmtDate(o.publishedAt)}${o.publishedApprox ? " (date de l'alerte e-mail)" : ""}` : "Date de publication inconnue"}>{compact ? fr.label.replace("il y a ", "") : fr.label}</span>;
}
function DeadlineChip({ o }) {
  const T = useT();
  const d = deadlineIn(o);
  if (d === null) return <span className={`text-xs ${T.faint}`}>—</span>;
  const cls = d < 0 ? "text-rose-600 line-through" : d <= 3 ? "text-rose-600 font-medium" : d <= 7 ? (T.dark ? "text-amber-200" : "text-amber-900") : T.muted;
  return <span className={`text-xs tabular-nums ${cls}`} title={`Date limite : ${fmtDate(o.deadline)}`}>{d < 0 ? "dépassée" : d === 0 ? "aujourd'hui" : `J-${d}`}</span>;
}
function LinkChip({ o }) {
  const st = o.link?.state;
  if (st === "open") return <Chip tone="ok" title={o.link.evidence || "Annonce vérifiée ouverte"}>lien ouvert</Chip>;
  if (st === "closed") return <Chip tone="danger" title={o.link.evidence || ""}>annonce clôturée</Chip>;
  if (st === "pending") return <Chip>vérification…</Chip>;
  return null;
}

function OfferRow({ o, vid, selected, onToggle, onOpen, onKeep, onDismiss, onExpire }) {
  const T = useT();
  const { settings } = useApp();
  const unread = o.status === "new" && !o.seenAt && !o.demo;
  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl ${selected ? T.sub : ""}`}>
      <input type="checkbox" checked={selected} onChange={() => {}} onClick={(e) => onToggle(e)} aria-label={`Sélectionner ${o.title}`} className="w-4 h-4 shrink-0" />
      <button type="button" onClick={onOpen} className={`flex-1 min-w-0 flex items-center gap-3 text-left rounded-xl ${T.ring}`}>
        <span className="relative shrink-0">
          <ScorePill score={o.score} threshold={settings.threshold} />
          {unread && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-600" aria-label="non lue" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className={`text-sm truncate ${unread ? "font-semibold" : "font-medium"}`}>{o.title}</span>
            {o.demo && <Chip>exemple</Chip>}
            {o.score?.redFlags?.length > 0 && <Flag className="w-3.5 h-3.5 text-rose-500 shrink-0" aria-label="Drapeau rouge" />}
            {isStale(o, vid) && o.score && !o.demo && <Chip tone="warn">à rescorer</Chip>}
          </span>
          <span className={`flex items-center gap-2 text-xs mt-0.5 ${T.muted}`}>
            <span className="truncate">{show(o.company)} · {show(o.location)} · {(o.sources || []).map((s) => s.name).filter((v, i, a) => a.indexOf(v) === i).join(", ")}</span>
            <RatingChip company={o.company} compact />
          </span>
          {(o.autoReason || o.link?.state || (o.status !== "new" && o.status !== "pipeline")) && (
            <span className="flex flex-wrap items-center gap-1.5 mt-1">
              {o.autoReason && <Chip tone={o.status === "expired" ? "warn" : "neutral"} title="Tri automatique — restaurable">auto : {o.autoReason}</Chip>}
              {!o.autoReason && o.status === "dismissed" && <Chip>écartée</Chip>}
              {!o.autoReason && o.status === "expired" && <Chip tone="warn">expirée / pourvue</Chip>}
              {o.status === "pipeline" && <Chip tone="accent">pipeline</Chip>}
              <LinkChip o={o} />
            </span>
          )}
          <span className="flex md:hidden items-center gap-3 mt-1">
            <FreshChip o={o} />
            {o.deadline && <span className="inline-flex items-center gap-1 text-xs"><CalendarClock className="w-3 h-3" aria-hidden="true" /><DeadlineChip o={o} /></span>}
            <span className={`text-xs ${T.faint}`}>arrivée {relDay(o.collectedAt)}</span>
          </span>
        </span>
        <span className="hidden md:block w-24"><FreshChip o={o} /></span>
        <span className="hidden md:block w-20"><DeadlineChip o={o} /></span>
        <span className={`hidden md:block w-20 text-xs tabular-nums ${T.faint}`} title={fmtDate(o.collectedAt, { time: true })}>{relDay(o.collectedAt)}</span>
        <span className={`hidden md:block w-16 text-xs ${T.muted}`}>{commuteLabel(o.commute)}</span>
      </button>
      <span className="hidden sm:flex w-24 justify-end gap-0.5 shrink-0">
        {o.status === "new" && !o.demo ? (
          <>
            <IconBtn icon={Check} label="Retenir (pipeline)" onClick={onKeep} />
            <IconBtn icon={X} label="Écarter" onClick={onDismiss} />
            <IconBtn icon={Clock} label="Expirée / pourvue" onClick={onExpire} />
          </>
        ) : null}
      </span>
    </li>
  );
}

function RulesModal({ open, onClose }) {
  const T = useT();
  const { settings, setSettings, offers, criteria, runRules } = useApp();
  const rules = rulesOf(settings);
  const setR = (k, v) => setSettings((s) => ({ ...s, rules: { ...rulesOf(s), [k]: v } }));
  const setS = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const ver = activeVersion(criteria);
  const preview = useMemo(() => {
    if (!open) return { total: 0, by: {} };
    const by = {};
    let total = 0;
    offers.forEach((o) => { const v = ruleVerdict(o, ver, rules); if (v) { total++; by[v.rule] = (by[v.rule] || 0) + 1; } });
    return { total, by };
  }, [open, offers, ver, settings.rules]); // eslint-disable-line react-hooks/exhaustive-deps
  const num = (k, min, max) => (e) => setR(k, clamp(Number(e.target.value) || 0, min, max));
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Règles de tri automatique"
      footer={<><Btn variant="ghost" onClick={onClose}>Fermer</Btn><Btn variant="primary" icon={Filter} disabled={!preview.total} onClick={() => { runRules(); onClose(); }}>Appliquer maintenant ({preview.total})</Btn></>}
    >
      <div className="space-y-5">
        <Notice icon={Info}>
          Appliquées à chaque arrivée d'offres et à chaque ouverture, uniquement aux offres « à traiter » (jamais au pipeline ni aux offres que vous avez restaurées). Les offres triées restent visibles dans « Écartées » ou « Expirées », avec la raison, et se restaurent en un clic.
        </Notice>
        <Toggle checked={rules.enabled} onChange={(v) => setR("enabled", v)} label="Tri automatique activé" />
        {preview.total > 0 && (
          <p className={`text-sm ${T.muted}`}>Aperçu sur le stock actuel : {Object.entries(preview.by).map(([k, n]) => `${n} ${RULE_LABEL[k]}`).join(" · ")}.</p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Âge max (jours)" hint="depuis la publication"><Input type="number" value={rules.maxAgeDays} onChange={num("maxAgeDays", 0, 120)} /></Field>
          <Field label="Date inconnue : max (j)" hint="depuis la collecte"><Input type="number" value={rules.unknownDateMaxDays} onChange={num("unknownDateMaxDays", 0, 120)} /></Field>
          <Field label="Score minimum" hint="en dessous : écartée"><Input type="number" value={rules.dismissBelow} onChange={num("dismissBelow", 0, 90)} /></Field>
          <Field label="Marge de trajet (min)" hint={`au-delà de ${ver?.maxCommute ?? 60} + marge`}><Input type="number" value={rules.commuteSlack} onChange={num("commuteSlack", 0, 120)} /></Field>
        </div>
        <Field label="Mots qui excluent un intitulé">
          <ChipInput values={rules.titleExclude} onChange={(v) => setR("titleExclude", v)} placeholder="junior, stage…" ariaLabel="Mots exclus" />
        </Field>
        <Toggle checked={rules.requireSeniority} onChange={(v) => setR("requireSeniority", v)} label="L'intitulé doit indiquer un poste de management" description="manager, head, lead, directeur, responsable, hoofd…" />
        {rules.requireSeniority && <ChipInput values={rules.seniorityTokens} onChange={(v) => setR("seniorityTokens", v)} placeholder="mot" ariaLabel="Mots de management" />}
        <Toggle checked={rules.requireDomain} onChange={(v) => setR("requireDomain", v)} label="L'intitulé doit relever de votre périmètre" description="Digital, IT, CRM, transformation, process… complété automatiquement par les mots de vos postes visés." />
        {rules.requireDomain && <ChipInput values={rules.domainTokens} onChange={(v) => setR("domainTokens", v)} placeholder="mot" ariaLabel="Mots du périmètre" />}
        <div className={`pt-4 border-t ${T.line}`}>
          <SectionTitle>Automatisations</SectionTitle>
          <Toggle checked={settings.autoScore} onChange={(v) => setS("autoScore", v)} label="Scoring automatique" description={`Toute offre à traiter est scorée dès son arrivée (jusqu'à ${settings.autoScoreMax} par lot), avec la même formule.`} />
          <Toggle checked={settings.autoDedupe} onChange={(v) => setS("autoDedupe", v)} label="Fusion automatique des doublons évidents" description="Même URL ou identifiant d'annonce, ou même entreprise + intitulé proche. Annulable depuis la fiche." />
          <Toggle checked={settings.autoDedupeAI} onChange={(v) => setS("autoDedupeAI", v)} label="Détection IA des doublons reformulés après chaque arrivée" description="Confiance haute : fusion directe (annulable). Confiance moyenne : à valider." />
          <Toggle checked={settings.autoVerify} onChange={(v) => setS("autoVerify", v)} label="Vérification des liens par la veille planifiée" description="À chaque passage, la Routine vérifie jusqu'à 40 offres actives ; les annonces clôturées passent en « Expirées »." />
        </div>
      </div>
    </Modal>
  );
}

function OfferDrawer({ id, onClose }) {
  const T = useT();
  const { offers, settings, setSettings, apps, addToPipeline, patchOffer, scoreOffers, busy, openApp, criteria, undoMerge, offerQueue, triageOffer, nextOfferId, setOfferSel, requestVerify } = useApp();
  const o = offers.find((x) => x.id === id);
  const queue = offerQueue.length ? offerQueue : offers.filter(isActiveOffer).map((x) => x.id);
  const pos = queue.indexOf(id);
  const prevId = pos > 0 ? queue[pos - 1] : null;
  const nextId = pos >= 0 ? queue[pos + 1] || null : nextOfferId(id);
  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" && nextId) { e.preventDefault(); setOfferSel(nextId); }
      if (e.key === "ArrowLeft" && prevId) { e.preventDefault(); setOfferSel(prevId); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextId, prevId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (o && !o.seenAt && !o.demo) patchOffer(o.id, { seenAt: nowISO() }); }, [o?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!o) return null;
  const mainUrl = (o.sources || []).find((x) => x.url)?.url;
  const s = o.score;
  const app = apps.find((a) => a.offerId === o.id);
  const stale = isStale(o, activeVersion(criteria)?.id);
  const groups = [["indispensable", "Indispensables"], ["souhaité", "Souhaités"], ["exclusion", "Exclusions"], ["alerte", "Signaux d'alerte"]];
  const meta = [
    ["Entreprise", o.company], ["Lieu", o.location],
    ["Trajet depuis Ohain", o.commute ? `~${o.commute.minutes} min en voiture (${o.commute.basis})` : null],
    ["Contrat", o.contract], ["Séniorité", o.seniority], ["Salaire", o.salary], ["Télétravail", o.remote],
    ["Langue", o.language ? LANG_NAME[o.language] : null],
    ["Publication", o.publishedAt ? `${fmtDate(o.publishedAt)} (${freshness(o).label})${o.publishedApprox ? " — date de l'alerte e-mail" : ""}` : null],
    ["Date limite de candidature", o.deadline ? `${fmtDate(o.deadline)}${deadlineIn(o) !== null ? ` (${deadlineIn(o) < 0 ? "dépassée" : `J-${deadlineIn(o)}`})` : ""}` : null],
    ["Collecte", fmtDate(o.collectedAt, { time: true })],
    ["Lien", o.link?.state ? `${{ open: "ouvert", closed: "clôturé", pending: "vérification demandée", unknown: "indéterminé" }[o.link.state] || o.link.state}${o.link.at ? ` · vérifié ${fmtDate(o.link.at)}` : ""}${o.link.evidence ? ` — ${o.link.evidence}` : ""}` : "non vérifié"],
  ];
  return (
    <Drawer
      open
      onClose={onClose}
      title={o.title}
      subtitle={`${show(o.company)} · ${show(o.location)}`}
      headerExtra={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2">
          {mainUrl ? (
            <a href={mainUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 text-xs font-semibold ${T.accentText} hover:underline underline-offset-4 rounded ${T.ring}`}>
              Voir l'offre <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          ) : <span className={`text-xs ${T.faint}`}>Lien {NC}</span>}
          <RatingChip company={o.company} />
          {o.demo && <Chip>exemple — donnée fictive</Chip>}
          {o.status === "expired" && <Chip tone="warn">expirée / pourvue</Chip>}
          {o.status === "closed" && <Chip>candidature clôturée</Chip>}
          <Chip tone={freshness(o).tone === "ok" ? "ok" : freshness(o).tone === "warn" ? "warn" : "neutral"}><CalendarDays className="w-3 h-3" aria-hidden="true" />{freshness(o).days === null ? "date de publication inconnue" : `publiée ${freshness(o).label}`}</Chip>
          {o.deadline && <Chip tone={deadlineIn(o) !== null && deadlineIn(o) <= 7 ? "danger" : "neutral"}><CalendarClock className="w-3 h-3" aria-hidden="true" />limite {fmtDate(o.deadline)}</Chip>}
          <LinkChip o={o} />
          {pos >= 0 && <span className={`text-xs tabular-nums ${T.faint}`}>{pos + 1} / {queue.length}</span>}
          <span className="inline-flex gap-1">
            <IconBtn icon={ChevronLeft} label="Offre précédente (←)" onClick={() => prevId && setOfferSel(prevId)} disabled={!prevId} />
            <IconBtn icon={ChevronRight} label="Offre suivante (→)" onClick={() => nextId && setOfferSel(nextId)} disabled={!nextId} />
          </span>
        </div>
      }
    >
      <div className="flex flex-wrap gap-2 mb-3">
        {app ? (
          <Btn variant="primary" icon={Columns} onClick={() => { onClose(); openApp(app.id); }}>Ouvrir la candidature ({STAGE_LABEL[app.stage]})</Btn>
        ) : (
          <>
            <Btn variant="primary" icon={Check} onClick={() => { const aid = addToPipeline(o.id, "retained"); onClose(); openApp(aid, "docs"); }}>Retenir & préparer</Btn>
            <Btn icon={Plus} onClick={() => { const nxt = nextId; addToPipeline(o.id, "new"); if (settings.autoNext && nxt) setOfferSel(nxt); }}>Ajouter au pipeline</Btn>
          </>
        )}
        {INACTIVE.includes(o.status) && o.status !== "closed" ? (
          <Btn variant="ghost" icon={RotateCcw} onClick={() => patchOffer(o.id, { status: "new", userKept: true, autoReason: undefined, autoRule: undefined, dismissedBy: undefined, expiredBy: undefined })}>Restaurer (à traiter)</Btn>
        ) : !app && (
          <>
            <Btn variant="ghost" icon={X} onClick={() => triageOffer(o.id, { status: "dismissed", dismissedAt: nowISO() })}>Écarter</Btn>
            <Btn variant="ghost" icon={Clock} onClick={() => triageOffer(o.id, { status: "expired", expiredAt: nowISO() })}>Expirée / pourvue</Btn>
            <Btn variant="ghost" icon={Unlink} onClick={() => triageOffer(o.id, { status: "expired", expiredAt: nowISO(), link: { state: "closed", evidence: "lien mort / 404 signalé", at: nowISO(), method: "vous" } })}>Lien mort (404)</Btn>
          </>
        )}
        {!o.demo && mainUrl && <Btn variant="ghost" icon={Link2} onClick={() => requestVerify([o.id])} loading={busy.verify}>Vérifier le lien</Btn>}
        {nextId && <Btn variant="ghost" icon={ArrowRight} onClick={() => setOfferSel(nextId)}>Suivante</Btn>}
        {!o.demo && <Btn variant="ghost" icon={RefreshCw} onClick={() => scoreOffers([o.id])} loading={busy.score}>{s ? "Rescorer" : "Scorer"}</Btn>}
      </div>
      {o.autoReason && (
        <Notice tone={o.status === "expired" ? "warn" : "neutral"} icon={Filter} className="mb-3">
          Triée automatiquement : {o.autoReason}. « Restaurer » la remet à traiter et la protège des règles.
        </Notice>
      )}
      <label className={`flex items-center gap-2 text-xs mb-8 ${T.faint}`}>
        <input type="checkbox" checked={!!settings.autoNext} onChange={(e) => setSettings((x) => ({ ...x, autoNext: e.target.checked }))} />
        Passer automatiquement à l'offre suivante après « Écarter », « Expirée » ou « Ajouter » · flèches ← → pour naviguer
      </label>

      <section className="mb-8">
        <div className="flex items-center gap-4">
          <ScorePill score={s} threshold={settings.threshold} size="lg" />
          <div className="flex-1">
            {s ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={s.confidence === "faible" ? "warn" : s.confidence === "haute" ? "ok" : "neutral"}>Confiance {s.confidence}</Chip>
                  {stale && !o.demo && <Chip tone="warn">critères modifiés depuis</Chip>}
                  {s.fit && <Chip tone={s.fit === "fort" ? "ok" : s.fit === "faible" ? "warn" : "neutral"}>adéquation {s.fit}</Chip>}
                  {s.caps?.map((c) => <Chip key={c} tone="danger">{s.method === 2 ? c : `plafonné : ${c}`}</Chip>)}
                </div>
                {s.summary && <p className="text-sm mt-2">{s.summary}</p>}
                {s.confidenceReason && <p className={`text-xs mt-1 ${T.faint}`}>{s.confidenceReason}</p>}
                {s.method === 2 && <p className={`text-xs mt-1 ${T.faint}`}>Calcul systématique : 55 % souhaités pondérés{s.wishAvg !== null ? ` (${s.wishAvg})` : ""} + 45 % indispensables{s.mustAvg !== null ? ` (${s.mustAvg})` : ""}, puis plafonds et pénalités.</p>}
              </>
            ) : (
              <p className={`text-sm ${T.muted}`}>Pas encore scorée.</p>
            )}
          </div>
        </div>
      </section>

      {s && (
        <>
          <section className="mb-8">
            <SectionTitle>Décomposition par critère</SectionTitle>
            <div className="space-y-5">
              {groups.map(([kind, label]) => {
                const rows = s.breakdown.filter((b) => b.kind === kind);
                if (!rows.length) return null;
                return (
                  <div key={kind}>
                    <div className={`text-xs mb-2 ${T.faint}`}>{label}{kind === "exclusion" || kind === "alerte" ? " — barre = degré de présence" : ""}</div>
                    <ul className="space-y-3">
                      {rows.map((b, i) => (
                        <li key={i}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span>{b.criterion}{b.weight ? <span className={`ml-1 text-xs ${T.faint}`}>×{b.weight}</span> : null}</span>
                            <span className="tabular-nums text-xs">{b.match}</span>
                          </div>
                          <MatchBar value={b.match} kind={b.kind} />
                          {b.note && <div className={`text-xs mt-1 ${T.muted}`}>{b.note}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <BulletList title="Points forts" items={s.strengths} icon={Check} />
            <BulletList title="Écarts" items={s.gaps} icon={ArrowRight} />
            <BulletList title="Questions à clarifier" items={s.questions} icon={HelpCircle} />
            <BulletList title="Drapeaux rouges" items={s.redFlags.map((r) => `${{ stress: "Pression", turnover: "Turnover", role_flou: "Rôle flou" }[r.type] || "Autre"} — ${r.evidence}`)} icon={Flag} danger empty="Aucun signal détecté dans le texte" />
          </section>
        </>
      )}

      <section className="mb-8">
        <SectionTitle>Fiche normalisée</SectionTitle>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {meta.map(([k, v]) => (
            <div key={k}>
              <dt className={`text-xs ${T.faint}`}>{k}</dt>
              <dd className={`text-sm ${v ? "" : T.faint}`}>{show(v)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mb-8">
        <SectionTitle>Annonce (résumé collecté)</SectionTitle>
        <p className={`text-sm leading-relaxed whitespace-pre-line ${o.description ? "" : T.faint}`}>{show(o.description)}</p>
      </section>

      {o.mergeHistory?.length > 0 && (
        <section className="mb-8">
          <SectionTitle action={<Btn size="sm" variant="ghost" icon={Undo2} onClick={() => undoMerge(o.id)}>Annuler la dernière fusion</Btn>}>Historique des fusions</SectionTitle>
          <ul className="space-y-2">
            {[...o.mergeHistory].reverse().map((m) => (
              <li key={m.id} className={`rounded-2xl p-4 text-sm ${T.sub}`}>
                <div className="flex flex-wrap items-center gap-2"><GitMerge className={`w-3.5 h-3.5 ${T.muted}`} aria-hidden="true" /><span>{fmtDate(m.at, { time: true })}</span><Chip>{m.origin}</Chip></div>
                {m.reason && <div className={`text-xs mt-1 ${T.muted}`}>{m.reason}</div>}
                <ul className={`text-xs mt-2 space-y-0.5 ${T.muted}`}>{m.absorbed.map((a) => <li key={a.id}>↳ {a.title} · {show(a.company)} · {(a.sources || []).map((x) => x.name).join(", ")}</li>)}</ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle>Sources ({o.sources?.length || 0})</SectionTitle>
        <ul className="space-y-3">
          {(o.sources || []).map((src, i) => (
            <li key={i} className={`rounded-2xl p-4 ${T.sub}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{src.name}</span>
                <span className={`text-xs ${T.faint}`}>via {src.via} · collectée {fmtDate(src.collectedAt, { time: true })}</span>
                {src.verified === true && <Chip tone="ok">URL vérifiée</Chip>}
                {src.verified === false && <Chip tone="warn">URL à vérifier</Chip>}
              </div>
              {src.emailSubject && <div className={`text-xs mt-1 ${T.muted}`}>E-mail : {src.emailSubject}</div>}
              <div className="mt-1 text-sm break-all">{src.url ? <ExtLink href={src.url}>{src.url}</ExtLink> : <span className={T.faint}>URL {NC}</span>}</div>
            </li>
          ))}
        </ul>
      </section>
    </Drawer>
  );
}

function RatingChip({ company, compact }) {
  const T = useT();
  const { ratings, requestRatings, busy } = useApp();
  if (!company || /confidenti|non communiqu/i.test(company)) return null;
  const r = ratings[ratingKey(company)];
  const v = fmtRating(r);
  if (compact) return v ? <span className={`text-xs tabular-nums ${T.muted}`} title={`${r.source || "Note employeur"}${r.reviews ? ` · ${r.reviews} avis` : ""}`}>★ {v}</span> : null;
  if (v) {
    const label = `★ ${v} / 5 · ${r.source || "avis"}${r.reviews ? ` (${r.reviews.toLocaleString("fr-BE")} avis)` : ""}`;
    return r.url ? (
      <a href={r.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${T.chip} hover:underline ${T.ring}`} title={r.note || "Note employeur publique"}>{label}</a>
    ) : <Chip>{label}</Chip>;
  }
  if (r) return <Chip title={r.note || ""}>note employeur introuvable</Chip>;
  return <Btn size="sm" variant="ghost" className="h-6 px-2" loading={busy.ratings} onClick={() => requestRatings([company])}>★ Note employeur</Btn>;
}

function BulletList({ title, items, icon: Icon, danger, empty = "—" }) {
  const T = useT();
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      {!items?.length ? <p className={`text-sm ${T.faint}`}>{empty}</p> : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <Icon className={`w-3.5 h-3.5 mt-1 shrink-0 ${danger ? "text-rose-500" : T.faint}`} aria-hidden="true" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SPONT_EMPTY = { mode: "company", role: "", company: "", website: "", location: "", contactName: "", language: "fr", context: "" };
const SPONT_MODES = [
  ["company", "Candidature spontanée", "Vous ciblez une entreprise qui n'a pas publié d'offre. CV, lettre, message LinkedIn et e-mail ; suivi dans le pipeline (relances, contacts)."],
  ["base", "CV de base", "Un CV prêt pour un type de rôle, sans entreprise : pour un cabinet de recrutement, un message LinkedIn, ou comme point de départ."],
];

function SpontaneousModal({ open, onClose }) {
  const T = useT();
  const { createSpontaneous, criteria } = useApp();
  const roles = activeVersion(criteria)?.roles || [];
  const [d, setD] = useState(SPONT_EMPTY);
  useEffect(() => { if (open) setD(SPONT_EMPTY); }, [open]);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const base = d.mode === "base";
  const ok = !!d.role.trim() && (base || !!d.company.trim());
  const submit = () => { if (!ok) return; createSpontaneous(d); onClose(); };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="CV ou lettre sans offre"
      wide
      footer={<><Btn variant="ghost" onClick={onClose}>Annuler</Btn><Btn variant="primary" icon={Sparkles} disabled={!ok} onClick={submit}>Créer et ouvrir le studio</Btn></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Type de dossier">
          {SPONT_MODES.map(([id, label, text]) => (
            <button key={id} type="button" role="radio" aria-checked={d.mode === id} onClick={() => set("mode", id)} className={`text-left rounded-2xl p-4 border-2 transition-colors ${d.mode === id ? "border-indigo-500" : T.line} ${T.ring}`}>
              <div className="text-sm font-medium">{label}</div>
              <div className={`text-xs mt-1 leading-relaxed ${T.muted}`}>{text}</div>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Rôle visé *" hint="Ex. Head of Digital, Digital Transformation Manager">
            <Input value={d.role} onChange={(e) => set("role", e.target.value)} list="spont-roles" data-autofocus />
            <datalist id="spont-roles">{roles.map((r) => <option key={r} value={r} />)}</datalist>
          </Field>
          {!base && <Field label="Entreprise ciblée *"><Input value={d.company} onChange={(e) => set("company", e.target.value)} /></Field>}
          {!base && <Field label="Site web (facultatif)"><Input value={d.website} onChange={(e) => set("website", e.target.value)} placeholder="entreprise.be" /></Field>}
          {!base && <Field label="Interlocuteur (facultatif)" hint="Nom et fonction, si vous le connaissez"><Input value={d.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="Mme Anne Dupont, CIO" /></Field>}
          <Field label="Lieu (facultatif)"><Input value={d.location} onChange={(e) => set("location", e.target.value)} placeholder="Bruxelles, Wavre…" /></Field>
          <Field label="Langue des documents">
            <Select value={d.language} onChange={(e) => set("language", e.target.value)} className="w-full">
              <option value="fr">Français</option><option value="nl">Néerlandais</option><option value="en">Anglais</option><option value="de">Allemand</option>
            </Select>
          </Field>
        </div>
        <Field
          label={base ? "Contexte (facultatif)" : "Pourquoi cette entreprise ? (recommandé)"}
          hint={base ? "Secteurs ou types d'organisations visés, ce que vous voulez mettre en avant." : "Activité, projets, actualité, enjeux digitaux, valeurs, lien avec vous. Seule source d'information sur l'entreprise : l'IA n'invente aucun fait."}
        >
          <Textarea rows={6} value={d.context} onChange={(e) => set("context", e.target.value)} placeholder={base ? "Ex. fédérations, mutualités, secteur public bruxellois ; mettre en avant CRM et automatisation." : "Ex. lance un programme de digitalisation de son service membres ; nouveau CEO en 2026 ; utilise Dynamics 365…"} />
        </Field>
      </div>
    </Modal>
  );
}

function ManualImportModal({ open, onClose }) {
  const T = useT();
  const { importManual, busy, openOffer } = useApp();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const submit = async () => {
    const id = await importManual({ url, text });
    if (id) { setUrl(""); setText(""); onClose(); openOffer(id); }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importer une annonce"
      wide
      footer={<><Btn variant="ghost" onClick={onClose}>Annuler</Btn><Btn variant="primary" icon={Wand2} onClick={submit} loading={busy.manual} disabled={!url.trim() && !text.trim()}>Structurer avec l'IA</Btn></>}
    >
      <div className="space-y-4">
        <Notice icon={Info}>
          L'artefact ne peut pas ouvrir directement les sites d'emploi. Avec une URL seule, l'IA tente de retrouver l'annonce via la recherche web ; si elle échoue, collez le texte de l'annonce (le plus fiable). LinkedIn : copiez le texte de l'annonce.
        </Notice>
        <Field label="URL de l'annonce"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" type="url" data-autofocus /></Field>
        <Field label="Texte de l'annonce (recommandé)" hint="Rien n'est inventé : les champs absents du texte seront marqués « non communiqué ».">
          <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Collez ici l'annonce complète…" />
        </Field>
        {busy.manual && <p className={`text-xs ${T.muted}`}>Analyse en cours…</p>}
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   12. PIPELINE (kanban)
   ════════════════════════════════════════════════════════════════════════ */

function nextStep(a) {
  const fu = (a.followUps || []).filter((f) => f.status === "pending").sort((x, y) => new Date(x.due) - new Date(y.due))[0];
  const itv = (a.interviews || []).filter((i) => new Date(i.at) >= startOfDay(new Date())).sort((x, y) => new Date(x.at) - new Date(y.at))[0];
  if (itv && (!fu || new Date(itv.at) <= new Date(fu.due))) return { text: `Entretien ${relDay(itv.at)}`, urgent: daysFromToday(itv.at) <= 1 };
  if (fu) return { text: `${FU_KINDS[fu.kind]} ${relDay(fu.due)}`, urgent: daysFromToday(fu.due) <= 0 };
  return null;
}

function PipelineView() {
  const T = useT();
  const { apps, offers, settings, requestMove, openApp, go, setSpontOpen } = useApp();
  const [over, setOver] = useState(null);
  const [showClosed, setShowClosed] = useState(true);
  const offerOf = (a) => offers.find((o) => o.id === a.offerId);
  const cols = STAGES.filter((s) => showClosed || s.id !== "closed");
  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle="Glissez une carte pour changer d'étape, ou ouvrez-la pour la déplacer au clavier."
        actions={<><Btn variant="ghost" onClick={() => setShowClosed(!showClosed)}>{showClosed ? "Masquer" : "Afficher"} les clôturées</Btn><Btn icon={Plus} onClick={() => setSpontOpen(true)}>Candidature spontanée</Btn><Btn icon={Briefcase} onClick={() => go("offers")}>Ajouter depuis les offres</Btn></>}
      />
      {apps.length === 0 ? (
        <Card><Empty icon={Columns} title="Pipeline vide" text="Retenez une offre ou lancez une candidature spontanée." action={<div className="flex flex-wrap justify-center gap-2"><Btn variant="primary" onClick={() => go("offers")}>Voir les offres</Btn><Btn icon={Plus} onClick={() => setSpontOpen(true)}>Candidature spontanée</Btn></div>} /></Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0" style={{ scrollSnapType: "x proximity" }}>
          {cols.map((st) => {
            const list = apps.filter((a) => a.stage === st.id).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            return (
              <section
                key={st.id}
                aria-label={`Colonne ${st.label}`}
                onDragOver={(e) => { e.preventDefault(); setOver(st.id); }}
                onDragLeave={() => setOver((o) => (o === st.id ? null : o))}
                onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) requestMove(id, st.id); }}
                className={`shrink-0 w-64 rounded-3xl p-3 transition-colors duration-150 ${over === st.id ? T.accentSoft : T.sub}`}
                style={{ scrollSnapAlign: "start", minHeight: 280 }}
              >
                <div className="flex items-center justify-between px-2 pt-1 pb-3">
                  <h2 className="text-sm font-medium">{st.label}</h2>
                  <span className={`text-xs tabular-nums ${T.faint}`}>{list.length}</span>
                </div>
                <ul className="space-y-2">
                  {list.map((a) => {
                    const o = offerOf(a);
                    const ns = nextStep(a);
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData("text/plain", a.id); e.dataTransfer.effectAllowed = "move"; }}
                          onClick={() => openApp(a.id)}
                          className={`w-full text-left rounded-2xl p-4 cursor-grab active:cursor-grabbing transition-transform duration-150 hover:-translate-y-0.5 ${T.surface} ${T.ring}`}
                          style={T.shadow}
                          aria-label={`${o?.title || "Candidature"} — ${o?.company || NC}, étape ${st.label}. Ouvrir la fiche.`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium leading-snug">{o?.title || "Offre supprimée"}</div>
                              <div className={`text-xs mt-0.5 truncate ${T.muted}`}>{show(o?.company)}</div>
                            </div>
                            {o?.score && <span className={`text-xs font-semibold tabular-nums ${o.score.value >= settings.threshold ? T.accentText : T.muted}`}>{o.score.value}</span>}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {a.demo && <Chip>exemple</Chip>}
                            {o?.spontaneous && <Chip tone="accent">spontanée</Chip>}
                            {a.closed && <Chip tone={a.closed.outcome === "accepted" ? "ok" : "neutral"}>{OUTCOME_LABEL[a.closed.outcome]}</Chip>}
                            {Object.keys(a.docs || {}).length > 0 && <Chip><FileText className="w-3 h-3" aria-hidden="true" />{Object.keys(a.docs).length} doc.</Chip>}
                            {ns && <Chip tone={ns.urgent ? "danger" : "neutral"}><Clock className="w-3 h-3" aria-hidden="true" />{ns.text}</Chip>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {list.length === 0 && <div className={`text-xs text-center py-8 ${T.faint}`}>Déposez une carte ici</div>}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StageDialog({ dialog, onClose }) {
  const { moveApp, addInterview, apps, offers, createCalendarEvent, calTitle, patchApp } = useApp();
  const [outcome, setOutcome] = useState("refused");
  const [reason, setReason] = useState("");
  const [itv, setItv] = useState({ at: "", type: "Visioconférence", location: "", notes: "" });
  const [cal, setCal] = useState(true);
  useEffect(() => {
    if (dialog) {
      setOutcome("refused");
      setReason("");
      const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(10, 0, 0, 0);
      setItv({ at: toLocalInput(d.toISOString()), type: "Visioconférence", location: "", notes: "" });
    }
  }, [dialog]);
  if (!dialog) return null;
  const app = apps.find((a) => a.id === dialog.appId);
  const offer = offers.find((o) => o.id === app?.offerId);
  if (dialog.stage === "closed") {
    return (
      <Modal open onClose={onClose} title="Clôturer la candidature" footer={<><Btn variant="ghost" onClick={onClose}>Annuler</Btn><Btn variant="primary" onClick={() => { moveApp(dialog.appId, "closed", { outcome, reason }); onClose(); }}>Clôturer</Btn></>}>
        <div className="space-y-4">
          <fieldset>
            <legend className="text-xs font-medium mb-2">Issue</legend>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((o) => (
                <label key={o.id} className="inline-flex items-center gap-2 text-sm">
                  <input type="radio" name="outcome" value={o.id} checked={outcome === o.id} onChange={() => setOutcome(o.id)} />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Motif"><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. poste pourvu en interne, salaire insuffisant, trop de pression…" data-autofocus /></Field>
        </div>
      </Modal>
    );
  }
  const save = (withEvent) => {
    if (!itv.at) { moveApp(dialog.appId, "interview"); onClose(); return; }
    const start = new Date(itv.at).toISOString();
    const entry = addInterview(dialog.appId, { at: start, type: itv.type, location: itv.location, notes: itv.notes });
    onClose();
    if (withEvent) {
      createCalendarEvent({
        title: calTitle("Entretien", offer?.company),
        start,
        end: new Date(new Date(start).getTime() + 60 * 6e4).toISOString(),
        description: `Poste : ${offer?.title || ""}\nEntreprise : ${offer?.company || NC}\nType : ${itv.type}${itv.location ? `\nLieu / lien : ${itv.location}` : ""}${itv.notes ? `\nNotes : ${itv.notes}` : ""}`,
        appId: dialog.appId,
        reminder: 60,
        onDone: () => patchApp(dialog.appId, (a) => ({ ...a, interviews: a.interviews.map((i) => (i.id === entry.id ? { ...i, eventCreated: true } : i)) })),
      });
    }
  };
  return (
    <Modal open onClose={onClose} title="Planifier l'entretien" footer={<><Btn variant="ghost" onClick={() => { moveApp(dialog.appId, "interview"); onClose(); }}>Passer sans date</Btn><Btn variant="primary" onClick={() => save(cal)}>Enregistrer</Btn></>}>
      <div className="space-y-4">
        <Field label="Date et heure"><Input type="datetime-local" value={itv.at} onChange={(e) => setItv({ ...itv, at: e.target.value })} data-autofocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Format">
            <Select value={itv.type} onChange={(e) => setItv({ ...itv, type: e.target.value })} className="w-full">
              {["Visioconférence", "Présentiel", "Téléphone"].map((x) => <option key={x}>{x}</option>)}
            </Select>
          </Field>
          <Field label="Lieu / lien"><Input value={itv.location} onChange={(e) => setItv({ ...itv, location: e.target.value })} /></Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={itv.notes} onChange={(e) => setItv({ ...itv, notes: e.target.value })} /></Field>
        <Toggle checked={cal} onChange={setCal} label="Créer l'événement dans Google Calendar" description="Une confirmation vous sera demandée en mode discret." />
      </div>
    </Modal>
  );
}

function DupeReviewModal({ groups, setGroups, onApply, offers, apps }) {
  const T = useT();
  if (!groups) return null;
  const offerById = (id) => offers.find((o) => o.id === id);
  const n = groups.filter((g) => g.accept).length;
  return (
    <Modal
      open
      wide
      onClose={() => setGroups(null)}
      title={`Doublons proposés (${groups.length})`}
      footer={<><Btn variant="ghost" onClick={() => setGroups(null)}>Annuler</Btn><Btn variant="primary" icon={GitMerge} disabled={!n} onClick={() => onApply(groups)}>Fusionner {n} groupe(s)</Btn></>}
    >
      <p className={`text-sm mb-4 ${T.muted}`}>Rien n'est fusionné sans votre validation. L'offre conservée est celle du pipeline, sinon la mieux scorée ; toutes les sources sont réunies et chaque fusion reste annulable depuis la fiche de l'offre.</p>
      <ul className="space-y-3">
        {groups.map((g) => (
          <li key={g.id} className={`rounded-2xl p-4 ${T.sub}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={g.accept} onChange={() => setGroups(groups.map((x) => (x.id === g.id ? { ...x, accept: !x.accept } : x)))} aria-label="Fusionner ce groupe" />
              <span className="flex-1 min-w-0">
                <span className="flex flex-wrap items-center gap-2"><Chip tone={g.confidence === "haute" ? "ok" : "warn"}>confiance {g.confidence}</Chip>{g.reason && <span className={`text-xs ${T.muted}`}>{g.reason}</span>}</span>
                <ul className="mt-2 space-y-1">
                  {g.ids.map((id) => {
                    const o = offerById(id);
                    if (!o) return null;
                    return (
                      <li key={id} className="text-sm">
                        <span className="font-medium">{o.title}</span> · {show(o.company)} · {show(o.location)}
                        <span className={`block text-xs ${T.faint}`}>{(o.sources || []).map((x) => x.name).join(", ")} · {o.score ? `score ${o.score.value}` : "non scorée"}{apps.some((a) => a.offerId === id) ? " · dans le pipeline" : ""}</span>
                      </li>
                    );
                  })}
                </ul>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function ReplyReviewModal({ replies, setReplies, onResolve, apps, offers }) {
  const T = useT();
  if (!replies) return null;
  const ACTIONS = { log: "Journaliser seulement", interview: "Passer en « Entretien »", offer: "Passer en « Offre »", closed: "Clôturer (refus)" };
  return (
    <Modal open wide onClose={() => setReplies(null)} title={`Réponses détectées (${replies.length})`}>
      <p className={`text-sm mb-4 ${T.muted}`}>Lecture seule dans Gmail. Validez chaque réponse : elle sera ajoutée au journal et l'étape n'avancera que si vous le choisissez. Les relances en attente sont annulées en cas d'entretien, d'offre ou de refus.</p>
      <ul className="space-y-3">
        {replies.map((r) => {
          const app = apps.find((a) => a.id === r.appId);
          const o = offers.find((x) => x.id === app?.offerId);
          return (
            <li key={r.id} className={`rounded-2xl p-4 ${T.sub}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{o?.title || "Candidature"} · {show(o?.company)}</span>
                <Chip tone={r.kind === "refus" ? "danger" : r.kind === "invitation_entretien" || r.kind === "offre" ? "ok" : "neutral"}>{REPLY_KINDS[r.kind]}</Chip>
                {!r.verified && <Chip tone="warn">objet non retrouvé dans les e-mails lus — à vérifier</Chip>}
              </div>
              <div className={`text-xs mt-1 ${T.muted}`}>{show(r.from)} · {r.date ? fmtDate(r.date) : NC}</div>
              <div className="text-sm mt-2">« {r.subject} »</div>
              {r.summary && <div className={`text-sm mt-1 ${T.muted}`}>{r.summary}</div>}
              {r.interviewAt && <div className="text-xs mt-1">Entretien proposé : {fmtDate(r.interviewAt, { time: true })}</div>}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Select value={r.action} onChange={(e) => setReplies(replies.map((x) => (x.id === r.id ? { ...x, action: e.target.value } : x)))} aria-label="Action" className="h-8 text-xs">
                  {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
                <Btn size="sm" variant="primary" icon={Check} onClick={() => onResolve(r, true)}>Appliquer</Btn>
                <Btn size="sm" variant="ghost" onClick={() => onResolve(r, false)}>Ignorer</Btn>
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

function ConfirmExternalModal({ confirm, onClose }) {
  const T = useT();
  if (!confirm) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={confirm.title}
      footer={<><Btn variant="ghost" onClick={onClose}>Annuler</Btn><Btn variant="primary" icon={Check} onClick={() => { onClose(); confirm.run(); }} data-autofocus>Confirmer</Btn></>}
    >
      <div className="space-y-4">
        <Notice tone="accent" icon={ShieldCheck}>Mode discret : cette action écrit dans votre compte Google. Vérifiez avant de confirmer.</Notice>
        {confirm.warn?.length > 0 && (
          <Notice tone="danger" icon={AlertTriangle}>
            Ce contenu mentionne votre employeur actuel ({confirm.warn.join(", ")}). Vérifiez que c'est voulu.
          </Notice>
        )}
        <ul className="space-y-1 text-sm">{confirm.lines.map((l) => <li key={l}>{l}</li>)}</ul>
        {confirm.text && <pre className={`text-xs whitespace-pre-wrap rounded-2xl p-4 max-h-60 overflow-y-auto ${T.sub}`} style={{ fontFamily: FONT }}>{confirm.text.slice(0, 2500)}</pre>}
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   13. FICHE CANDIDATURE (suivi, dossier, relances, entretien, contacts)
   ════════════════════════════════════════════════════════════════════════ */

function AppDrawer({ id, tab, setTab, onClose }) {
  const T = useT();
  const { allApps: apps, offers, requestMove, openOffer } = useApp();
  const app = apps.find((a) => a.id === id);
  const offer = offers.find((o) => o.id === app?.offerId);
  if (!app) return null;
  const fuPending = (app.followUps || []).filter((f) => f.status === "pending").length;
  return (
    <Drawer
      open
      expandable
      onClose={onClose}
      title={offer?.title || "Candidature"}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <span>{show(offer?.company)}</span>
          {offer?.sources?.find((x) => x.url) && (
            <a href={offer.sources.find((x) => x.url).url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 text-xs font-semibold ${T.accentText} hover:underline underline-offset-4 rounded ${T.ring}`}>{offer.spontaneous ? "Site de l'entreprise" : "Voir l'offre"} <ExternalLink className="w-3 h-3" aria-hidden="true" /></a>
          )}
          {offer?.spontaneous && <Chip tone="accent">{SPONT_LABEL[offer.spontaneous]}</Chip>}
          {offer && !offer.spontaneous && <button type="button" className={`text-xs underline underline-offset-4 ${T.muted} ${T.ring} rounded`} onClick={() => { onClose(); openOffer(offer.id); }}>fiche Radar</button>}
          {offer && <RatingChip company={offer.company} />}
        </span>
      }
      headerExtra={
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <label className={`text-xs ${T.muted}`} htmlFor="stage-select">Étape</label>
          <Select id="stage-select" value={app.stage} onChange={(e) => requestMove(app.id, e.target.value)} className="h-8 text-xs">
            {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
          {app.closed && <Chip>{OUTCOME_LABEL[app.closed.outcome]}{app.closed.reason ? ` — ${app.closed.reason}` : ""}</Chip>}
          {app.demo && <Chip>exemple</Chip>}
        </div>
      }
    >
      <div className="mb-6 overflow-x-auto">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "track", label: "Suivi" },
            { id: "docs", label: "Dossier", count: Object.keys(app.docs || {}).length || undefined },
            { id: "followups", label: "Relances", count: fuPending || undefined },
            { id: "prep", label: "Entretien" },
            { id: "contacts", label: "Contacts", count: (app.contactIds || []).length || undefined },
          ]}
        />
      </div>
      {tab === "track" && <TrackPanel app={app} offer={offer} />}
      {tab === "docs" && <DossierPanel app={app} offer={offer} />}
      {tab === "followups" && <AppFollowUps app={app} offer={offer} />}
      {tab === "prep" && <PrepPanel app={app} offer={offer} />}
      {tab === "contacts" && <AppContacts app={app} />}
    </Drawer>
  );
}

const LOG_ICON = { stage: Columns, doc: FileText, email: Mail, calendar: CalendarPlus, followup: BellRing, interview: Users, prep: Sparkles, note: Pencil, call: Phone };

function TrackPanel({ app, offer }) {
  const T = useT();
  const { logApp, patchApp, openStageDialog, createCalendarEvent, calTitle, busy } = useApp();
  const [note, setNote] = useState("");
  const [type, setType] = useState("note");
  const add = () => {
    if (!note.trim()) return;
    const prefix = { note: "Note", email: "E-mail reçu", call: "Appel" }[type];
    logApp(app.id, type, `${prefix} : ${note.trim()}`);
    setNote("");
  };
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Date d'envoi de la candidature" hint="Les relances sont planifiées à partir de cette date.">
          <Input
            type="date"
            value={app.sentAt ? app.sentAt.slice(0, 10) : ""}
            onChange={(e) => patchApp(app.id, (a) => ({ ...a, sentAt: e.target.value ? new Date(`${e.target.value}T09:00:00`).toISOString() : null }))}
          />
        </Field>
        <div>
          <span className={`block text-xs font-medium mb-1.5 ${T.muted}`}>{offer?.spontaneous ? "Site de l'entreprise" : "Annonce"}</span>
          <div className="text-sm break-all">{offer?.sources?.[0]?.url ? <ExtLink href={offer.sources[0].url}>{offer.spontaneous ? hostOf(offer.sources[0].url) : "Ouvrir l'annonce"}</ExtLink> : <span className={T.faint}>{offer?.spontaneous ? "Non renseigné" : `URL ${NC}`}</span>}</div>
        </div>
      </section>

      <section>
        <SectionTitle action={<Btn size="sm" variant="ghost" icon={Plus} onClick={() => openStageDialog(app.id)}>Ajouter</Btn>}>Entretiens</SectionTitle>
        {!(app.interviews || []).length ? <p className={`text-sm ${T.faint}`}>Aucun entretien planifié.</p> : (
          <ul className="space-y-2">
            {app.interviews.map((i) => (
              <li key={i.id} className={`flex flex-wrap items-center gap-3 rounded-2xl p-4 ${T.sub}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{fmtDate(i.at, { time: true })} · {i.type}</div>
                  <div className={`text-xs ${T.muted}`}>{i.location || "Lieu non communiqué"}{i.notes ? ` · ${i.notes}` : ""}</div>
                </div>
                {i.eventCreated ? <Chip tone="ok">dans l'agenda</Chip> : (
                  <Btn size="sm" icon={CalendarPlus} loading={busy.gcal} onClick={() => createCalendarEvent({
                    title: calTitle("Entretien", offer?.company),
                    start: i.at,
                    end: new Date(new Date(i.at).getTime() + (i.durationMin || 60) * 6e4).toISOString(),
                    description: `Poste : ${offer?.title || ""}\nEntreprise : ${offer?.company || NC}\nType : ${i.type}${i.location ? `\nLieu / lien : ${i.location}` : ""}`,
                    appId: app.id,
                    reminder: 60,
                    onDone: () => patchApp(app.id, (a) => ({ ...a, interviews: a.interviews.map((x) => (x.id === i.id ? { ...x, eventCreated: true } : x)) })),
                  })}>Ajouter à l'agenda</Btn>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Journal des échanges</SectionTitle>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type d'entrée">
            <option value="note">Note</option>
            <option value="email">E-mail reçu</option>
            <option value="call">Appel</option>
          </Select>
          <Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Ajouter une entrée horodatée…" aria-label="Nouvelle entrée du journal" />
          <Btn icon={Plus} onClick={add} disabled={!note.trim()}>Ajouter</Btn>
        </div>
        <ol className="relative space-y-4 pl-6">
          <span className={`absolute left-2 top-1 bottom-1 w-px ${T.dark ? "bg-stone-800" : "bg-stone-200"}`} aria-hidden="true" />
          {[...(app.log || [])].reverse().map((l) => {
            const Icon = LOG_ICON[l.type] || Info;
            return (
              <li key={l.id} className="relative">
                <span className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full flex items-center justify-center ${T.surface}`}><Icon className={`w-3 h-3 ${T.muted}`} aria-hidden="true" /></span>
                <div className="text-sm">{l.text}</div>
                <div className={`text-xs ${T.faint}`}>{fmtDate(l.at, { time: true })}</div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

const MSG_TYPES = DOC_TYPES.filter((d) => d.id !== "cv" && d.id !== "letter");

function DossierPanel({ app, offer }) {
  const { generateDocs, busy, genStatus } = useApp();
  const [type, setType] = useState("linkedin");
  const [exportOpen, setExportOpen] = useState(false);
  const hasDocs = docLangs(app, offer, "cv").length + docLangs(app, offer, "letter").length > 0;
  const docs = app.docs || {};
  const loading = busy[`dossier:${app.id}`];
  const all = DOC_TYPES.filter((d) => docs[d.id]?.length).map((d) => {
    const v = docs[d.id].slice(-1)[0];
    return `### ${d.label}\n${v.subject ? `Objet : ${v.subject}\n` : ""}${v.format === "markup" ? docPlainText(v.text) : v.text}`;
  }).join("\n\n");
  const msgCount = MSG_TYPES.filter((d) => docs[d.id]?.length).length;
  return (
    <div className="space-y-6">
      {offer?.spontaneous ? (
        <Notice icon={Info}>
          {offer.spontaneous === "base"
            ? "CV de base : réutilisable pour un cabinet de recrutement, un message LinkedIn ou comme point de départ d'une candidature ciblée."
            : "Candidature spontanée : envoyez le CV et la lettre en PDF à un décideur nommé (e-mail ou LinkedIn), puis planifiez une relance."}
        </Notice>
      ) : (
        <Notice icon={Info}>
          La soumission automatique sur le site de l'employeur n'est pas possible depuis cet artefact (formulaires tiers, authentification). Ouvrez l'annonce et joignez le CV et la lettre en PDF.{" "}
          {offer?.sources?.[0]?.url && <ExtLink href={offer.sources[0].url}>Ouvrir l'annonce</ExtLink>}
        </Notice>
      )}
      <section>
        <SectionTitle action={all ? <CopyBtn text={all} label="Copier tout le dossier" /> : null}>CV et lettre — studio plein écran</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StudioDocCard app={app} offer={offer} type="cv" />
          <StudioDocCard app={app} offer={offer} type="letter" />
        </div>
        {hasDocs && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Btn size="sm" icon={Languages} onClick={() => setExportOpen(true)}>Exporter le dossier</Btn>
            <span className="text-xs opacity-70">CV + lettre · FR, NL, EN, DE · PDF ou Word · un fichier ou un ZIP</span>
          </div>
        )}
        {exportOpen && <ExportModal app={app} offer={offer} onClose={() => setExportOpen(false)} />}
        {loading && genStatus[app.id] && <div className="mt-3"><GenSteps st={genStatus[app.id]} /></div>}
      </section>
      <section>
        <SectionTitle action={!msgCount && !loading ? <Btn size="sm" variant="ghost" icon={Sparkles} onClick={() => generateDocs(app.id, MSG_TYPES.map((d) => d.id))}>Générer les messages</Btn> : null}>Messages et formulaires</SectionTitle>
        <div className="overflow-x-auto mb-4"><Tabs value={type} onChange={setType} tabs={MSG_TYPES.map((d) => ({ id: d.id, label: d.label, count: docs[d.id]?.length || undefined }))} /></div>
        <DocEditor key={`${app.id}-${type}`} app={app} type={type} />
      </section>
    </div>
  );
}

const slugFile = (x) => normText(x || "").replace(/\s+/g, "-").slice(0, 40) || "document";

function DocEditor({ app, type }) {
  const T = useT();
  const { saveDocVersion, generateDocs, busy, settings, createGmailDraft, contacts, openStudio } = useApp();
  const versions = app.docs?.[type] || [];
  const [idx, setIdx] = useState(versions.length - 1);
  const v = versions[idx];
  const [text, setText] = useState(v?.text || "");
  const [subject, setSubject] = useState(v?.subject || "");
  const [instr, setInstr] = useState("");
  const linked = contacts.filter((c) => (app.contactIds || []).includes(c.id) && c.email);
  const [to, setTo] = useState(linked[0]?.email || "");
  useEffect(() => { setIdx(versions.length - 1); }, [versions.length]);
  useEffect(() => { setText(v?.text || ""); setSubject(v?.subject || ""); }, [v?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const loading = busy[`dossier:${app.id}`];
  const dirty = v && (text !== v.text || (type === "email" && subject !== (v.subject || "")));
  const warn = mentionsEmployer(`${subject}\n${text}`, settings.employerNames);

  if (type === "cv" || type === "letter") {
    return <Card className="p-6"><Empty icon={FileText} title={DOC_LABEL[type]} text="Le CV et la lettre se travaillent dans le studio plein écran." action={<Btn variant="primary" icon={Maximize2} onClick={() => openStudio(app.id, type)}>Ouvrir le studio</Btn>} /></Card>;
  }
  if (!v) {
    return (
      <Card className="p-6">
        {loading ? <Skeleton lines={5} /> : (
          <Empty icon={FileText} title={`${DOC_LABEL[type]} non généré`} action={<Btn variant="primary" icon={Sparkles} onClick={() => generateDocs(app.id, [type])}>Générer ce document</Btn>} />
        )}
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={idx} onChange={(e) => setIdx(Number(e.target.value))} aria-label="Version" className="h-8 text-xs">
          {versions.map((x, i) => <option key={x.id} value={i}>v{i + 1} · {x.origin} · {fmtDate(x.createdAt, { time: true })}</option>)}
        </Select>
        {v.instruction && <Chip>consigne : {v.instruction}</Chip>}
        {dirty && <Chip tone="warn">modifications non enregistrées</Chip>}
      </div>
      {warn.length > 0 && <Notice tone="danger" icon={AlertTriangle}>Ce document mentionne votre employeur actuel ({warn.join(", ")}). Vérifiez que c'est voulu avant toute diffusion.</Notice>}
      {type === "email" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Objet"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
          <Field label="Destinataire" hint={linked.length ? "Contacts liés à cette candidature" : "Aucun contact lié : laissez vide et complétez dans Gmail"}>
            <Input value={to} onChange={(e) => setTo(e.target.value)} list={`to-${app.id}`} placeholder="recruteur@exemple.be" />
            <datalist id={`to-${app.id}`}>{linked.map((c) => <option key={c.id} value={c.email}>{c.name}</option>)}</datalist>
          </Field>
        </div>
      )}
      {loading ? <Card className="p-6"><Skeleton lines={8} /></Card> : (
        <AutoTextarea value={text} onChange={(e) => setText(e.target.value)} aria-label={DOC_LABEL[type]} style={{ fontFamily: FONT, minHeight: type === "linkedin" ? 110 : 280 }} />
      )}
      {type === "linkedin" && (
        <p className={`text-xs ${text.length > 300 ? "text-rose-600" : T.faint}`}>{text.length} / 300 caractères (limite d'une invitation). Envoi manuel depuis LinkedIn : aucune automatisation possible.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Btn variant={dirty ? "primary" : "soft"} icon={Save} disabled={!dirty} onClick={() => saveDocVersion(app.id, type, text, type === "email" ? subject : undefined)}>Enregistrer une version</Btn>
        <CopyBtn text={type === "email" ? `Objet : ${subject}\n\n${text}` : text} size="md" />
        {type === "email" && <Btn icon={Mail} loading={busy["gmail-draft"]} onClick={() => createGmailDraft({ to, subject, body: text, appId: app.id })}>Créer le brouillon Gmail</Btn>}
      </div>
      <div className={`flex flex-col sm:flex-row gap-2 pt-4 border-t ${T.line}`}>
        <Input value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="Consigne de régénération (facultatif) : plus court, plus orienté résultats…" aria-label="Consigne de régénération" />
        <Btn icon={RefreshCw} loading={loading} onClick={() => generateDocs(app.id, [type], instr)}>Régénérer</Btn>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   13 bis. STUDIO CV & LETTRE — plein écran : éditeur structuré, aperçu A4 paginé, optimisation
   ════════════════════════════════════════════════════════════════════════ */

const MM = 96 / 25.4; // pixels CSS par mm à 100 %

/* ── Design du document : modèles, couleurs, colonnes, photo — rendu vectoriel commun à l'aperçu, au PDF et au Word ── */

/* Couleur d'accent de la version (proposée par l'IA ou choisie) appliquée au design ; bandeau et filets la suivent
   quand le modèle les aligne sur l'accent. */
function designWithAccent(app, settings, accent) {
  const base = app?.design ? mergeDesign(DESIGN_BASE, app.design) : settings?.designDefault ? mergeDesign(DESIGN_BASE, settings.designDefault) : designFromTemplate("ats");
  const a = cleanHex(accent, null);
  if (!a) return base;
  const C = base.colors;
  return { ...base, colors: { ...C, accent: a, ...(cleanHex(C.band) === cleanHex(C.accent) ? { band: a } : {}), ...(cleanHex(C.rule) === cleanHex(C.accent) ? { rule: a } : {}) } };
}

/* Ligne du balisage → section de l'éditeur (même découpage que docOutline : « head », index, « sign »). */
function lineSections(text) {
  const lines = String(text || "").split("\n");
  const firstH2 = lines.findIndex((l) => l.trim().startsWith("## "));
  const headEnd = firstH2 < 0 ? lines.length : firstH2;
  const pre = lines.slice(0, headEnd).some((l) => { const t = l.trim(); return t && !/^(# |> |@ |= |~ )/.test(t); });
  let sec = pre ? 0 : -1;
  return lines.map((raw, i) => {
    const t = raw.trim();
    if (t.startsWith("~ ")) return "sign";
    if (i < headEnd) return /^(# |> |@ |= )/.test(t) ? "head" : 0;
    if (t.startsWith("## ")) sec += 1;
    return sec;
  });
}
const TODO_RE = /\[à compl|à compléter|compléter :/i;

/* Une page du moteur de mise en page, en SVG (mêmes coordonnées que le PDF). */
function PageSvg({ page, W, H, photo, idp, secOf, hoverSec, activeSec, onHoverSec, onPickSec }) {
  const shapeEl = (o, props) => {
    if (o.shape === "circle") return <circle cx={o.x + o.s / 2} cy={o.y + o.s / 2} r={o.s / 2} {...props} />;
    if (o.shape === "rounded") return <rect x={o.x} y={o.y} width={o.s} height={o.s} rx={o.s * 0.18} {...props} />;
    if (o.shape === "hexagon") return <polygon points={hexPoints(o.x, o.y, o.s).map((p) => p.join(",")).join(" ")} {...props} />;
    return <rect x={o.x} y={o.y} width={o.s} height={o.s} {...props} />;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: "block", background: "#ffffff" }} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Aperçu de la page">
      <defs>
        {page.ops.map((o, i) => (o.t === "photo" ? <clipPath key={i} id={`${idp}-c${i}`}>{shapeEl(o, {})}</clipPath> : null))}
      </defs>
      {page.ops.map((o, i) => {
        if (o.t === "rect") return <rect key={i} x={o.x} y={o.y} width={o.w} height={o.h} rx={o.r || 0} fill={o.fill} />;
        if (o.t === "circle") return <circle key={i} cx={o.cx} cy={o.cy} r={o.r} fill={o.fill} />;
        if (o.t === "line") return <line key={i} x1={o.x1} y1={o.y1} x2={o.x2} y2={o.y2} stroke={o.color} strokeWidth={o.w} />;
        if (o.t === "text") {
          const todo = TODO_RE.test(o.s);
          const tw = todo ? textWidth(o.s, o) : 0;
          return (
            <React.Fragment key={i}>
              {todo && <rect x={o.anchor === "end" ? o.x - tw : o.anchor === "middle" ? o.x - tw / 2 : o.x} y={o.y - o.size * MMPT * 0.85} width={tw} height={o.size * MMPT * 1.15} rx={0.6} fill="#fef3c7" />}
              <text x={o.x} y={o.y} fontFamily={FONT_CSS[o.font]} fontSize={o.size * MMPT} fontWeight={o.bold ? 700 : 400} fontStyle={o.italic ? "italic" : "normal"} fill={todo ? "#92400e" : o.color} textAnchor={o.anchor} letterSpacing={o.cs || undefined} style={{ whiteSpace: "pre" }}>
                {o.s}
              </text>
            </React.Fragment>
          );
        }
        if (o.t === "icon") {
          return (
            <g key={i} transform={`translate(${o.x} ${o.y}) scale(${o.s / 24})`} fill="none" stroke={o.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              {(DOC_ICONS[o.name] || []).map((d, k) => <path key={k} d={d} />)}
            </g>
          );
        }
        if (o.t === "photo") {
          return (
            <g key={i}>
              {photo?.src ? <image href={photo.src} x={o.x} y={o.y} width={o.s} height={o.s} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${idp}-c${i})`} /> : shapeEl(o, { fill: "#e7e5e4" })}
              {o.border > 0 && shapeEl(o, { fill: "none", stroke: o.borderColor, strokeWidth: o.border })}
            </g>
          );
        }
        return null;
      })}
      {secOf && page.hits.filter((h) => h.kind === "block").map((h, i) => {
        const sec = secOf(h);
        if (sec === null || sec === undefined || sec === -1) return null;
        const on = hoverSec === sec || activeSec === sec;
        return (
          <rect key={`b${i}`} x={h.x - 1.2} y={h.y} width={h.w + 2.4} height={h.h} rx={0.8} fill={on ? "rgba(79,70,229,0.08)" : "transparent"} style={{ cursor: "pointer" }}
            onClick={() => onPickSec?.(sec)} onMouseEnter={() => onHoverSec?.(sec)} onMouseLeave={() => onHoverSec?.(null)}>
            <title>Modifier ce passage</title>
          </rect>
        );
      })}
    </svg>
  );
}

/* Aperçu paginé (remplace l'ancien aperçu HTML) : même API, clic sur un passage → section correspondante dans l'éditeur. */
function DesignPages({ text, kind, design, photo, lang = "fr", zoom = 1, maxPages, onPages, onPick, activeSec }) {
  const idp = `dp${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const deferred = useDeferredValue(text);
  const lay = useMemo(() => layoutDocument(designModel(deferred, kind), design, { photo, lang }), [deferred, kind, design, photo, lang]);
  const secs = useMemo(() => (onPick ? lineSections(deferred) : null), [deferred, !!onPick]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = lay.pages.length;
  useEffect(() => { onPages?.(n); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  const [hover, setHover] = useState(null);
  const secOf = secs ? (h) => (h.src.photo ? "head" : secs[h.src.l0]) : null;
  return (
    <div className="flex flex-col items-center" style={{ gap: Math.round(28 * zoom) + 4 }}>
      {lay.pages.slice(0, maxPages || undefined).map((pg, pi) => (
        <div key={pi} style={{ width: lay.W * MM * zoom, height: lay.H * MM * zoom, flexShrink: 0, background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,.08), 0 18px 40px -22px rgba(0,0,0,.35)" }}>
          <PageSvg page={pg} W={lay.W} H={lay.H} photo={photo} idp={`${idp}-${pi}`} secOf={secOf} hoverSec={hover} activeSec={activeSec} onHoverSec={setHover} onPickSec={onPick} />
        </div>
      ))}
    </div>
  );
}

/* Schéma d'un gabarit (aperçu instantané, sans calcul de mise en page). */
function TemplateThumb({ tpl, accent, active, onClick }) {
  const T = useT();
  const d = mergeDesign(DESIGN_BASE, tpl.d);
  const a = accent || d.colors.accent;
  const two = Number(d.columns) === 2;
  const sw = two ? 34 * (d.sideWidth / 100) : 0;
  const sx = d.side === "right" ? 34 - sw : 0;
  const mx = two && d.side !== "right" ? sw + 2 : 3;
  const mw = two ? 34 - sw - 5 : 28;
  const sideFill = two ? (luminance(d.colors.side) < 0.35 ? a : d.colors.side) : null;
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-2xl p-2 text-left transition-colors duration-150 ${active ? T.accentSoft : T.subHover} ${T.ring}`}>
      <svg viewBox="0 0 34 48" className="w-full" style={{ background: "#fff", borderRadius: 6, border: active ? `1.5px solid ${a}` : "1px solid #e7e5e4" }} aria-hidden="true">
        {d.header === "band" && <rect x="0" y="0" width="34" height="9" fill={a} />}
        {two && <rect x={sx} y={d.header === "side" || d.sideFull ? 0 : 10} width={sw} height={d.header === "side" || d.sideFull ? 48 : 36} fill={sideFill} rx={d.sideFull ? 0 : 1} />}
        {d.photo.show && <circle cx={d.header === "center" ? 17 : d.header === "side" ? sx + sw / 2 : 6} cy={d.header === "side" ? 6 : 5} r="2.6" fill={d.header === "band" ? "#fff" : "#d6d3d1"} />}
        <rect x={d.header === "center" ? 9 : d.header === "side" ? sx + 2 : d.photo.show ? 10 : 3} y={d.header === "side" ? 10 : 3} width={d.header === "side" ? sw - 4 : 16} height="2" rx="0.6" fill={d.header === "band" ? "#fff" : a} />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={mx} y={14 + i * 8} width={mw} height="1.4" rx="0.5" fill={a} opacity={0.9} />)}
        {[0, 1, 2, 3].map((i) => <rect key={`l${i}`} x={mx} y={17 + i * 8} width={mw * 0.85} height="0.9" rx="0.4" fill="#c7c7c7" />)}
        {two && [0, 1, 2].map((i) => <rect key={`s${i}`} x={sx + 2} y={20 + i * 7} width={sw - 4} height="0.9" rx="0.4" fill={luminance(d.colors.side) < 0.35 ? "#fff" : "#bdbdbd"} />)}
      </svg>
      <div className="text-xs font-medium mt-1.5">{tpl.label}</div>
      <div className={`text-xs leading-snug ${T.faint}`}>{tpl.hint}</div>
    </button>
  );
}

/* Petits contrôles du panneau Design. */
function Slider({ label, value, min, max, step = 1, unit = "", onChange }) {
  const T = useT();
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs mb-1"><span className={T.muted}>{label}</span><span className="tabular-nums">{String(Math.round(value * 100) / 100).replace(".", ",")}{unit}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" aria-label={label} />
    </label>
  );
}
function Seg({ label, value, options, onChange }) {
  const T = useT();
  return (
    <div>
      {label && <div className={`text-xs mb-1 ${T.muted}`}>{label}</div>}
      <div role="radiogroup" aria-label={label} className={`flex flex-wrap gap-1 p-1 rounded-xl ${T.sub}`}>
        {options.map(([v, l]) => (
          <button key={String(v)} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={`flex-1 min-w-0 px-2 h-7 rounded-lg text-xs truncate transition-colors duration-150 ${value === v ? `${T.navActive} font-medium` : T.muted} ${T.ring}`} style={value === v ? T.shadow : undefined}>{l}</button>
        ))}
      </div>
    </div>
  );
}
const SWATCHES = ["#1f3a5f", "#1e293b", "#2563eb", "#0f766e", "#047857", "#7c2d12", "#9f1239", "#6d28d9", "#c2410c", "#111827", "#ffffff", "#f1f5f9"];
function ColorField({ label, value, onChange, swatches = SWATCHES }) {
  const T = useT();
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs ${T.muted}`}>{label}</span>
        <input type="color" value={cleanHex(value)} onChange={(e) => onChange(e.target.value)} aria-label={label} style={{ width: 34, height: 24, border: "none", background: "transparent", cursor: "pointer" }} />
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        {swatches.map((c) => (
          <button key={c} type="button" onClick={() => onChange(c)} aria-label={`${label} ${c}`} className={`w-5 h-5 rounded-full ${T.ring}`} style={{ background: c, border: cleanHex(value) === c ? "2px solid #4f46e5" : "1px solid #d6d3d1" }} />
        ))}
      </div>
    </div>
  );
}
function Fold({ title, children, open: open0 = false }) {
  const T = useT();
  const [open, setOpen] = useState(open0);
  return (
    <section className={`border-b ${T.line}`}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={`w-full flex items-center justify-between py-3 text-sm font-medium ${T.ring} rounded-lg`}>
        {title}<ChevronRight className={`w-4 h-4 transition-transform duration-150 ${open ? "rotate-90" : ""} ${T.faint}`} aria-hidden="true" />
      </button>
      {open && <div className="pb-4 space-y-4">{children}</div>}
    </section>
  );
}

/* ── Photo : import, recadrage, rotation (locale, jamais envoyée à l'IA) ── */
function PhotoEditor({ open, onClose }) {
  const T = useT();
  const { media, setMedia, toast } = useApp();
  const [orig, setOrig] = useState(null);
  const [crop, setCrop] = useState({ zoom: 1, x: 0, y: 0, rot: 0 });
  const [shape, setShape] = useState("circle");
  const cv = useRef(null);
  const img = useRef(null);
  const drag = useRef(null);
  const file = useRef(null);
  const V = 260;
  useEffect(() => {
    if (!open) return;
    setOrig(media.photo?.original || null);
    setCrop(media.photo?.crop || { zoom: 1, x: 0, y: 0, rot: 0 });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let off = false;
    if (!orig) { img.current = null; return undefined; }
    loadImg(orig).then((i) => { if (!off) { img.current = i; draw(); } }).catch(() => toast("Image illisible", "danger"));
    return () => { off = true; };
  }, [orig]); // eslint-disable-line react-hooks/exhaustive-deps
  const draw = () => { const c = cv.current; if (c && img.current) drawCrop(c.getContext("2d"), img.current, V * 2, crop); };
  useEffect(draw, [crop]); // eslint-disable-line react-hooks/exhaustive-deps
  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type)) { toast("Choisissez une image (JPEG, PNG…)", "warn"); return; }
    const r = new FileReader();
    r.onload = async () => { try { setOrig(await downscaleImage(String(r.result))); setCrop({ zoom: 1, x: 0, y: 0, rot: 0 }); } catch (err) { toast(err.message, "danger"); } };
    r.readAsDataURL(f);
  };
  const save = async () => {
    if (!orig) return;
    const src = await cropPhoto(orig, crop);
    setMedia((m) => ({ ...m, photo: { src, original: orig, crop, updatedAt: nowISO() } }));
    toast("Photo enregistrée (jamais envoyée à l'IA)", "ok");
    onClose(shape);
  };
  const clip = { circle: "circle(50% at 50% 50%)", rounded: "inset(0 round 18%)", square: "none", hexagon: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" }[shape];
  return (
    <Modal open={open} onClose={() => onClose()} title="Photo de profil" footer={<><Btn variant="ghost" onClick={() => onClose()}>Annuler</Btn><Btn variant="primary" icon={Check} disabled={!orig} onClick={save}>Valider le recadrage</Btn></>}>
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3">
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{ width: V, height: V, background: T.dark ? "#292524" : "#f5f5f4", cursor: orig ? "grab" : "default", touchAction: "none" }}
            onPointerDown={(e) => { if (!orig) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, c: crop }; }}
            onPointerMove={(e) => { const d = drag.current; if (!d) return; setCrop({ ...d.c, x: clamp(d.c.x + (e.clientX - d.x) / V, -1, 1), y: clamp(d.c.y + (e.clientY - d.y) / V, -1, 1) }); }}
            onPointerUp={() => { drag.current = null; }}
            onWheel={(e) => { if (orig) setCrop((c) => ({ ...c, zoom: clamp(c.zoom * (e.deltaY < 0 ? 1.06 : 0.94), 1, 4) })); }}
          >
            {orig ? (
              <>
                <canvas ref={cv} width={V * 2} height={V * 2} style={{ width: V, height: V, opacity: 0.35, position: "absolute", inset: 0 }} aria-hidden="true" />
                <canvas width={V * 2} height={V * 2} style={{ width: V, height: V, position: "absolute", inset: 0, clipPath: clip }} ref={(el) => { if (el && img.current) drawCrop(el.getContext("2d"), img.current, V * 2, crop); }} aria-label="Aperçu du recadrage" />
              </>
            ) : (
              <button type="button" onClick={() => file.current?.click()} className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm ${T.muted} ${T.ring}`}>
                <Upload className="w-6 h-6" aria-hidden="true" />Importer une photo
              </button>
            )}
          </div>
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={onFile} aria-label="Fichier photo" />
          <p className={`text-xs text-center ${T.faint}`}>Glissez pour cadrer, molette ou curseur pour zoomer. La forme finale se règle aussi dans le panneau Design.</p>
        </div>
        {orig && (
          <>
            <Slider label="Zoom" value={crop.zoom} min={1} max={4} step={0.01} unit="×" onChange={(zoom) => setCrop({ ...crop, zoom })} />
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" icon={RotateCw} onClick={() => setCrop({ ...crop, rot: (crop.rot + 90) % 360 })}>Pivoter</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setCrop({ zoom: 1, x: 0, y: 0, rot: 0 })}>Recentrer</Btn>
              <Btn size="sm" variant="ghost" icon={Upload} onClick={() => file.current?.click()}>Autre photo</Btn>
            </div>
            <Seg label="Aperçu de forme" value={shape} onChange={setShape} options={[["circle", "Cercle"], ["rounded", "Arrondi"], ["square", "Carré"], ["hexagon", "Hexagone"]]} />
          </>
        )}
      </div>
    </Modal>
  );
}

/* ── Panneau Design ── */
function DesignPanel({ design, setDesign, accentSuggested, onPhoto, hasPhoto, kind, sections, onReorder }) {
  const T = useT();
  const { settings, setSettings, toast, setMedia } = useApp();
  const D = design;
  const set = (patch) => setDesign({ ...D, ...patch });
  const setC = (k, v) => setDesign({ ...D, colors: { ...D.colors, [k]: v } });
  const setM = (k, v) => setDesign({ ...D, margin: D.linkMargins ? { t: v, r: v, b: v, l: v } : { ...D.margin, [k]: v } });
  const setP = (k, v) => setDesign({ ...D, photo: { ...D.photo, [k]: v } });
  const [keepAccent, setKeepAccent] = useState(true);
  return (
    <div>
      <Fold title="Modèles" open>
        <label className={`flex items-center gap-2 text-xs ${T.muted}`}><input type="checkbox" checked={keepAccent} onChange={(e) => setKeepAccent(e.target.checked)} />Garder ma couleur d'accent</label>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((t) => (
            <TemplateThumb key={t.id} tpl={t} accent={keepAccent ? D.colors.accent : null} active={D.template === t.id}
              onClick={() => setDesign(designFromTemplate(t.id, { layout: D.layout, accent: keepAccent ? D.colors.accent : null, page: D.page }))} />
          ))}
        </div>
      </Fold>
      <Fold title="Couleurs" open>
        {accentSuggested && cleanHex(accentSuggested) !== cleanHex(D.colors.accent) && (
          <button type="button" onClick={() => setDesign({ ...D, colors: { ...D.colors, accent: accentSuggested, ...(D.colors.band === D.colors.accent ? { band: accentSuggested } : {}) } })} className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${T.sub} ${T.ring}`}>
            <span className="w-4 h-4 rounded-full" style={{ background: accentSuggested }} />Appliquer la couleur de l'entreprise (suggestion IA)
          </button>
        )}
        <ColorField label="Accent (titres, puces)" value={D.colors.accent} onChange={(v) => setC("accent", v)} />
        <ColorField label="Texte" value={D.colors.text} onChange={(v) => setC("text", v)} swatches={["#111827", "#262626", "#374151", "#1f2937", "#0f172a"]} />
        <ColorField label="Texte secondaire" value={D.colors.muted} onChange={(v) => setC("muted", v)} swatches={["#6b6b6b", "#6b7280", "#64748b", "#78716c", "#57534e"]} />
        <ColorField label="Filets" value={D.colors.rule} onChange={(v) => setC("rule", v)} swatches={["#d4d4d4", "#e5e7eb", "#94a3b8", D.colors.accent]} />
        {Number(D.columns) === 2 && <>
          <ColorField label="Fond de colonne" value={D.colors.side} onChange={(v) => setC("side", v)} swatches={["#ffffff", "#f1f5f9", "#f5f5f4", "#f0fdfa", "#eff6ff", "#134e4a", "#1e293b", "#1f3a5f", D.colors.accent]} />
          <ColorField label="Texte de colonne" value={D.colors.sideText} onChange={(v) => setC("sideText", v)} swatches={["#262626", "#ffffff", "#f0fdfa", "#e2e8f0"]} />
        </>}
        {D.header === "band" && <>
          <ColorField label="Bandeau" value={D.colors.band} onChange={(v) => setC("band", v)} />
          <ColorField label="Texte du bandeau" value={D.colors.bandText} onChange={(v) => setC("bandText", v)} swatches={["#ffffff", "#f8fafc", "#111827"]} />
        </>}
      </Fold>
      <Fold title="Typographie">
        <Seg label="Police des titres" value={D.headingFont} onChange={(v) => set({ headingFont: v })} options={[["sans", "Sans"], ["serif", "Serif"], ["mono", "Mono"]]} />
        <Seg label="Police du texte" value={D.font} onChange={(v) => set({ font: v })} options={[["sans", "Sans"], ["serif", "Serif"], ["mono", "Mono"]]} />
        <Slider label="Taille du texte" value={D.size} min={8.5} max={12} step={0.25} unit=" pt" onChange={(size) => set({ size })} />
        <Slider label="Interligne" value={D.lineHeight} min={1.05} max={1.8} step={0.05} onChange={(lineHeight) => set({ lineHeight })} />
        <Slider label="Taille du nom" value={D.nameSize} min={1.5} max={3.4} step={0.05} unit="×" onChange={(nameSize) => set({ nameSize })} />
        <Slider label="Taille des titres" value={D.headingSize} min={0.85} max={1.6} step={0.01} unit="×" onChange={(headingSize) => set({ headingSize })} />
        <Seg label="Casse des titres" value={D.headingCase} onChange={(v) => set({ headingCase: v })} options={[["upper", "MAJUSCULES"], ["normal", "Normale"]]} />
        {D.headingCase === "upper" && <Slider label="Espacement des lettres (titres)" value={D.headingSpacing} min={0} max={2.5} step={0.1} unit=" pt" onChange={(headingSpacing) => set({ headingSpacing })} />}
      </Fold>
      <Fold title="Mise en page">
        <Seg label="Format" value={D.page} onChange={(v) => set({ page: v })} options={[["a4", "A4"], ["letter", "US Letter"]]} />
        {kind === "cv" && <Seg label="Colonnes" value={Number(D.columns)} onChange={(v) => set({ columns: v })} options={[[1, "Une"], [2, "Deux"]]} />}
        {kind === "cv" && Number(D.columns) === 2 && <>
          <Seg label="Colonne secondaire" value={D.side} onChange={(v) => set({ side: v })} options={[["left", "À gauche"], ["right", "À droite"]]} />
          <Slider label="Largeur de la colonne" value={D.sideWidth} min={22} max={42} step={1} unit=" %" onChange={(sideWidth) => set({ sideWidth })} />
          <Slider label="Écart entre colonnes" value={D.colGap} min={3} max={14} step={0.5} unit=" mm" onChange={(colGap) => set({ colGap })} />
          <Toggle checked={!!D.sideFull} onChange={(v) => set({ sideFull: v })} label="Fond de colonne bord à bord" description="Le fond va jusqu'au bord de la feuille." />
        </>}
        <Seg label="En-tête" value={D.header} onChange={(v) => set({ header: v })} options={[["left", "Gauche"], ["center", "Centré"], ["band", "Bandeau"], ...(kind === "cv" && Number(D.columns) === 2 ? [["side", "Colonne"]] : [])]} />
        <Toggle checked={!!D.linkMargins} onChange={(v) => setDesign({ ...D, linkMargins: v, margin: v ? { t: D.margin.l, r: D.margin.l, b: D.margin.l, l: D.margin.l } : D.margin })} label="Marges identiques" />
        <div className="grid grid-cols-2 gap-3">
          {(D.linkMargins ? [["l", "Marges"]] : [["t", "Haut"], ["b", "Bas"], ["l", "Gauche"], ["r", "Droite"]]).map(([k, l]) => (
            <Slider key={k} label={l} value={D.margin[k]} min={0} max={30} step={0.5} unit=" mm" onChange={(v) => setM(k, v)} />
          ))}
        </div>
        <Slider label="Espace entre sections" value={D.sectionGap} min={1} max={12} step={0.25} unit=" mm" onChange={(sectionGap) => set({ sectionGap })} />
        <Slider label="Espace entre éléments" value={D.itemGap} min={0} max={6} step={0.1} unit=" mm" onChange={(itemGap) => set({ itemGap })} />
        <Slider label="Espace entre paragraphes" value={D.paraGap} min={0} max={6} step={0.1} unit=" mm" onChange={(paraGap) => set({ paraGap })} />
      </Fold>
      {kind === "cv" && sections?.length > 0 && (
        <Fold title="Sections et colonnes" open={Number(D.columns) === 2}>
          <SectionsFold sections={sections} design={D} setDesign={setDesign} onReorder={onReorder} />
        </Fold>
      )}
      <Fold title="Éléments">
        <Seg label="Style des titres" value={D.headingStyle} onChange={(v) => set({ headingStyle: v })} options={[["line", "Trait"], ["bar", "Barre"], ["pill", "Pastille"], ["double", "Double"], ["plain", "Simple"]]} />
        <Slider label="Épaisseur des traits" value={D.rule} min={0} max={2} step={0.05} unit=" mm" onChange={(rule) => set({ rule })} />
        <Seg label="Puces" value={D.bullet} onChange={(v) => set({ bullet: v })} options={[["dot", "●"], ["square", "■"], ["dash", "–"], ["arrow", "›"], ["none", "Aucune"]]} />
        <Toggle checked={!!D.icons} onChange={(v) => set({ icons: v })} label="Icônes des coordonnées" />
        {kind === "cv" && <Toggle checked={!!D.sectionIcons} onChange={(v) => set({ sectionIcons: v })} label="Icônes des sections" />}
        {kind === "cv" && <Toggle checked={!!D.datesRight} onChange={(v) => set({ datesRight: v })} label="Dates alignées à droite" />}
        {kind === "cv" && <Toggle checked={!!D.skillsAsTags} onChange={(v) => set({ skillsAsTags: v })} label="Compétences en étiquettes" />}
        {kind === "letter" && <Toggle checked={!!D.justify} onChange={(v) => set({ justify: v })} label="Paragraphes justifiés" />}
      </Fold>
      <Fold title="Photo">
        <Toggle checked={!!D.photo.show} onChange={(v) => setP("show", v)} label="Afficher la photo" description={hasPhoto ? "Courant en Belgique ; déconseillé pour l'anglais." : "Aucune photo importée."} />
        <div className="flex flex-wrap gap-2">
          <Btn size="sm" icon={hasPhoto ? Crop : Upload} onClick={onPhoto}>{hasPhoto ? "Recadrer / changer" : "Importer une photo"}</Btn>
          {hasPhoto && <Btn size="sm" variant="ghost" icon={Trash2} onClick={() => { setMedia((m) => ({ ...m, photo: null })); toast("Photo supprimée", "ok"); }}>Supprimer</Btn>}
        </div>
        <Seg label="Forme" value={D.photo.shape} onChange={(v) => setP("shape", v)} options={[["circle", "Cercle"], ["rounded", "Arrondi"], ["square", "Carré"], ["hexagon", "Hexagone"]]} />
        <Slider label="Taille" value={D.photo.size} min={16} max={48} step={0.5} unit=" mm" onChange={(v) => setP("size", v)} />
        <Slider label="Bordure" value={D.photo.border} min={0} max={3} step={0.1} unit=" mm" onChange={(v) => setP("border", v)} />
        {D.photo.border > 0 && <ColorField label="Couleur de bordure" value={D.photo.borderColor} onChange={(v) => setP("borderColor", v)} swatches={["#ffffff", "#e7e5e4", D.colors.accent, "#111827"]} />}
      </Fold>
      <div className="flex flex-wrap gap-2 pt-4">
        <Btn size="sm" icon={Star} onClick={() => { const { layout, ...rest } = D; setSettings((s) => ({ ...s, designDefault: rest })); toast("Style enregistré par défaut pour les prochains dossiers", "ok"); }}>Style par défaut</Btn>
        <Btn size="sm" variant="ghost" icon={RotateCcw} onClick={() => setDesign(designFromTemplate(D.template, { layout: D.layout, accent: D.colors.accent, page: D.page }))}>Réinitialiser le modèle</Btn>
      </div>
      {settings.designDefault && <p className={`text-xs mt-2 ${T.faint}`}>Style par défaut : {TEMPLATE_BY_ID[settings.designDefault.template]?.label || "personnalisé"}.</p>}
    </div>
  );
}

/* ── Panneau Structure : ordre, colonne, visibilité des sections ── */

/* Sections : ordre (celui du texte), colonne, visibilité dans l'aperçu et les exports. Glisser-déposer entre colonnes. */
function SectionsFold({ sections, design, setDesign, onReorder }) {
  const T = useT();
  const two = Number(design.columns) === 2;
  const L = design.layout || {};
  const arr = arrangeSections(sections, { ...L, order: [] }, two);
  const sideList = Array.isArray(L.side) ? L.side : sections.filter((s) => arr.isSide(s.key)).map((s) => s.key);
  const colOf = (k) => (two && sideList.includes(k) ? "side" : "main");
  const setLayout = (patch) => setDesign({ ...design, layout: { ...L, order: [], side: sideList, ...patch } });
  const toggleHide = (k) => setLayout({ hidden: arr.hidden.has(k) ? [...arr.hidden].filter((x) => x !== k) : [...arr.hidden, k] });
  const setCol = (k, col) => setLayout({ side: col === "side" ? [...new Set([...sideList, k])] : sideList.filter((x) => x !== k) });
  const idx = (k) => sections.findIndex((s) => s.key === k);
  const movable = (k) => !!onReorder && k !== "intro";
  const step = (k, dir) => {
    const same = sections.filter((s) => colOf(s.key) === colOf(k) && movable(s.key)).map((s) => s.key);
    const j = same.indexOf(k) + dir;
    if (j >= 0 && j < same.length) onReorder(idx(k), idx(same[j]));
  };
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const drop = (col, beforeKey) => {
    if (drag) {
      if (two && colOf(drag) !== col) setCol(drag, col);
      if (beforeKey && beforeKey !== drag && movable(drag) && movable(beforeKey)) onReorder(idx(drag), idx(beforeKey));
    }
    setDrag(null); setOver(null);
  };
  const cols = two ? [["main", "Colonne principale"], ["side", "Colonne secondaire"]] : [["main", "Sections"]];
  return (
    <div className="space-y-3">
      <p className={`text-xs ${T.muted}`}>Glissez une section pour la déplacer{two ? " ou la changer de colonne" : ""}. Une section masquée reste dans le texte mais n'apparaît ni dans l'aperçu ni dans les exports.</p>
      {cols.map(([col, label]) => {
        const keys = sections.filter((s) => colOf(s.key) === col);
        return (
          <div key={col}
            onDragOver={(e) => { e.preventDefault(); setOver(col); }}
            onDragLeave={() => setOver((c) => (c === col ? null : c))}
            onDrop={(e) => { e.preventDefault(); drop(col, null); }}
            className={`rounded-2xl p-2 transition-colors duration-150 ${over === col ? T.accentSoft : T.sub}`}>
            <div className={`px-2 pb-2 text-xs font-semibold uppercase tracking-wider ${T.faint}`}>{label}</div>
            <ul className="space-y-1">
              {keys.map((s) => {
                const hidden = arr.hidden.has(s.key);
                return (
                  <li key={s.key} draggable
                    onDragStart={(e) => { setDrag(s.key); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", s.key); }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(col, s.key); }}
                    className={`flex items-center gap-0.5 rounded-xl pl-1 pr-1 py-1 ${T.surface} ${hidden ? "opacity-50" : ""}`} style={T.shadow}>
                    <GripVertical className={`w-4 h-4 shrink-0 cursor-grab ${T.faint}`} aria-hidden="true" />
                    <span className="flex-1 min-w-0 text-sm truncate">{sectionLabel(s)}</span>
                    {movable(s.key) && <MiniBtn icon={ArrowUp} label="Monter" onClick={() => step(s.key, -1)} />}
                    {movable(s.key) && <MiniBtn icon={ArrowDown} label="Descendre" onClick={() => step(s.key, 1)} />}
                    {two && <MiniBtn icon={ArrowLeftRight} label={col === "side" ? "Vers la colonne principale" : "Vers la colonne secondaire"} onClick={() => setCol(s.key, col === "side" ? "main" : "side")} />}
                    <MiniBtn icon={hidden ? EyeOff : Eye} label={hidden ? "Afficher" : "Masquer dans l'aperçu et les exports"} onClick={() => toggleHide(s.key)} active={hidden} />
                  </li>
                );
              })}
              {!keys.length && <li className={`text-xs text-center py-4 ${T.faint}`}>Déposez une section ici</li>}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/* ── Export : documents × langues × formats, fichiers séparés ou fusionnés (traductions manquantes générées à la demande) ── */
function ExportModal({ app, offer, onClose, current }) {
  const T = useT();
  const { settings, media, profile, translateDoc, toast } = useApp();
  const avail = { cv: docLangs(app, offer, "cv"), letter: docLangs(app, offer, "letter") };
  const known = DOC_LANGS.filter((l) => avail.cv.includes(l) || avail.letter.includes(l));
  const [docs, setDocs] = useState({ cv: avail.cv.length > 0, letter: avail.letter.length > 0 });
  const [langs, setLangs] = useState(() => (current?.lang ? [current.lang] : known.length ? known : [offer?.language || "fr"]));
  const [format, setFormat] = useState("pdf");
  const [group, setGroup] = useState("perLang");
  const [order, setOrder] = useState("cvFirst");
  const [wordMode, setWordMode] = useState("design");
  const [run, setRun] = useState(null);
  const kinds = (order === "cvFirst" ? ["cv", "letter"] : ["letter", "cv"]).filter((k) => docs[k]);
  const missing = kinds.flatMap((k) => langs.filter((l) => !avail[k].includes(l)).map((l) => ({ k, l })));
  const toTranslate = missing.filter((m) => avail[m.k].length);
  const name = profile.name || "candidat";
  const base = (k, ls) => `${k === "both" ? "Dossier" : k === "cv" ? "CV" : "Lettre"}_${slugFile(name)}_${slugFile(offer?.company || offer?.title)}_${ls.map((l) => LANG_FLAG[l]).join("-")}`;
  const nFiles = (group === "merged" ? 1 : group === "perLang" ? langs.length : langs.length * kinds.length) * (format === "both" ? 2 : 1);
  /* Texte de chaque document : ce qui est affiché dans le studio (modifications non enregistrées comprises), sinon la dernière version. */
  const textOf = (k, l) => {
    if (current && current.type === k && current.lang === l) return { text: current.text, accent: current.accent };
    const v = latestDoc(app, offer, k, l);
    return v ? docTextOf(app, k, v) : null;
  };
  const go = async () => {
    try {
      const got = {};
      for (const { k, l } of toTranslate) {
        const from = avail[k].includes(current?.lang) ? current.lang : avail[k].includes(app.docLanguage) ? app.docLanguage : avail[k][0];
        setRun(`Traduction ${k === "cv" ? "du CV" : "de la lettre"} en ${LANG_NAME[l]}…`);
        const v = await translateDoc(app.id, k, from, l, textOf(k, from)?.text);
        if (!v) throw new Error(`traduction ${LANG_FLAG[l]} impossible`);
        got[`${k}:${l}`] = { text: v.text, accent: v.accent };
      }
      setRun("Mise en page…");
      const items = [];
      for (const l of langs) for (const k of kinds) {
        const t = got[`${k}:${l}`] || textOf(k, l);
        if (t?.text) items.push({ kind: k, lang: l, text: t.text, design: designWithAccent(app, settings, t.accent), title: `${k === "cv" ? "CV" : "Lettre de motivation"} (${LANG_FLAG[l]})` });
      }
      if (!items.length) throw new Error("aucun document à exporter");
      const groups = group === "merged" ? [items] : group === "perLang" ? langs.map((l) => items.filter((i) => i.lang === l)).filter((g) => g.length) : items.map((i) => [i]);
      const kw = (app.analysis?.keywords || latestDoc(app, offer, "cv", offer?.language)?.keywords || []).map((x) => (typeof x === "string" ? x : x?.term)).filter(Boolean).slice(0, 30);
      const photo = media?.photo || null;
      const files = [];
      for (const g of groups) {
        const ks = [...new Set(g.map((i) => i.kind))];
        const fname = base(ks.length > 1 ? "both" : ks[0], [...new Set(g.map((i) => i.lang))]);
        const meta = { title: [ks.length > 1 ? "Dossier de candidature" : g[0].title, profile.name, offer?.title, offer?.company].filter(Boolean).join(" - "), author: profile.name, keywords: kw, subject: offer?.title };
        if (format !== "docx") {
          setRun(`PDF : ${fname}…`);
          const pdf = await buildPdf(g.map((i) => ({ ...i, photo, layout: layoutDocument(designModel(i.text, i.kind), i.design, { photo, lang: i.lang }) })), meta);
          files.push({ name: `${fname}.pdf`, data: new Uint8Array(pdf), mime: "application/pdf" });
        }
        if (format !== "pdf") {
          setRun(`Word : ${fname}…`);
          files.push({ name: `${fname}${wordMode === "ats" ? "_ATS" : ""}.docx`, data: buildDocx(g, { photo, mode: wordMode, ...meta }), mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        }
      }
      setRun("Téléchargement…");
      const out = files.length === 1 ? files[0] : { name: `${base(kinds.length > 1 ? "both" : kinds[0], langs)}.zip`, data: zipStore(files.map((f) => ({ name: f.name, data: f.data }))), mime: "application/zip" };
      const buf = out.data.buffer.slice(out.data.byteOffset, out.data.byteOffset + out.data.byteLength);
      const r = await saveFile(out.name, buf, out.mime);
      if (r === "saved") { toast(files.length === 1 ? `${out.name} prêt` : `${files.length} fichiers regroupés dans ${out.name}`, "ok"); onClose(); }
    } catch (e) {
      toast(`Export impossible : ${e.message}`, "danger");
    } finally { setRun(null); }
  };
  return (
    <Modal open wide onClose={() => !run && onClose()} title="Exporter le dossier"
      footer={<><Btn variant="ghost" onClick={onClose} disabled={!!run}>Annuler</Btn><Btn variant="primary" icon={FileDown} loading={!!run} disabled={!kinds.length || !langs.length || missing.length - toTranslate.length === kinds.length * langs.length} onClick={go}>{toTranslate.length ? `Traduire ${toTranslate.length} et exporter` : `Exporter (${nFiles} fichier${nFiles > 1 ? "s" : ""})`}</Btn></>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div>
            <div className={`text-xs mb-2 ${T.muted}`}>Documents</div>
            <div className="flex flex-wrap gap-2">
              {[["cv", "CV"], ["letter", "Lettre de motivation"]].map(([k, l]) => (
                <label key={k} className={`inline-flex items-center gap-2 rounded-xl px-3 h-9 text-sm ${T.sub}`}><input type="checkbox" checked={docs[k]} disabled={!avail[k].length} onChange={(e) => setDocs({ ...docs, [k]: e.target.checked })} />{l}<span className={`text-xs ${T.faint}`}>{avail[k].map((x) => LANG_FLAG[x]).join(" ") || "—"}</span></label>
              ))}
            </div>
          </div>
          <div>
            <div className={`text-xs mb-2 ${T.muted}`}>Langues</div>
            <div className="flex flex-wrap gap-2">
              {DOC_LANGS.map((l) => {
                const on = langs.includes(l);
                const todo = kinds.some((k) => !avail[k].includes(l));
                return (
                  <button key={l} type="button" aria-pressed={on} onClick={() => setLangs(on ? langs.filter((x) => x !== l) : DOC_LANGS.filter((x) => x === l || langs.includes(x)))} className={`h-9 px-3 rounded-xl text-sm ${on ? T.accentSoft : T.btnSoft} ${T.ring}`}>
                    {LANG_NAME[l]}{on && todo ? " · à traduire" : ""}
                  </button>
                );
              })}
            </div>
            {toTranslate.length > 0 && <p className={`text-xs mt-2 ${T.muted}`}>{toTranslate.length} traduction(s) générée(s) puis enregistrée(s) comme nouvelles versions : relisez-les ensuite dans le studio.</p>}
          </div>
          <Seg label="Ordre" value={order} onChange={setOrder} options={[["cvFirst", "CV puis lettre"], ["letterFirst", "Lettre puis CV"]]} />
        </div>
        <div className="space-y-5">
          <Seg label="Format" value={format} onChange={setFormat} options={[["pdf", "PDF"], ["docx", "Word"], ["both", "PDF + Word"]]} />
          {format !== "pdf" && <Seg label="Word" value={wordMode} onChange={setWordMode} options={[["design", "Fidèle au design"], ["ats", "ATS 1 colonne"]]} />}
          <Seg label="Regroupement" value={group} onChange={setGroup} options={[["perLang", "Un fichier par langue"], ["merged", "Tout en un"], ["separate", "Fichiers séparés"]]} />
          <Notice icon={Info}>
            {group === "merged" ? "Un seul fichier avec tous les documents, dans l'ordre choisi (signets PDF par document)." : group === "perLang" ? "Un fichier par langue réunissant CV et lettre : idéal pour un envoi bilingue." : "Un fichier par document et par langue."}
            {nFiles > 1 ? ` ${nFiles} fichiers, livrés dans un ZIP.` : ""} PDF texte (lisible par les ATS), Word modifiable.
          </Notice>
          {run && <p className={`text-sm ${T.muted}`} aria-live="polite"><Loader2 className="inline w-4 h-4 mr-1 animate-spin" aria-hidden="true" />{run}</p>}
        </div>
      </div>
    </Modal>
  );
}

function useMedia(q) {
  const get = () => typeof window !== "undefined" && !!window.matchMedia?.(q).matches;
  const [m, setM] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return undefined;
    const h = () => setM(mq.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, [q]);
  return m;
}

/* ── Champs de l'éditeur ── */
function AutoTextarea({ value, onChange, className = "", style, ...rest }) {
  const T = useT();
  const ref = useRef(null);
  const fit = () => { const el = ref.current; if (!el) return; el.style.height = "auto"; el.style.height = `${el.scrollHeight + 2}px`; };
  useLayoutEffect(fit, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    let w = el.offsetWidth;
    const ro = new ResizeObserver(() => { if (el.offsetWidth !== w) { w = el.offsetWidth; fit(); } });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <textarea ref={ref} rows={1} value={value} onChange={onChange} {...rest} className={`w-full resize-none rounded-xl px-3 py-2 text-sm leading-relaxed ${T.input} ${T.ring} ${className}`} style={{ overflow: "hidden", ...style }} />;
}

function MiniBtn({ icon: Icon, label, onClick, disabled, active }) {
  const T = useT();
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${active ? T.accentSoft : T.btnGhost} ${T.ring}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
    </button>
  );
}

function AddLink({ onClick, children }) {
  const T = useT();
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2 py-1 ${T.accentText} ${T.subHover} ${T.ring}`}>
      <Plus className="w-3.5 h-3.5" aria-hidden="true" />{children}
    </button>
  );
}

const moveIn = (list, i, d) => { const j = i + d; if (j < 0 || j >= list.length) return list; const n = [...list]; [n[i], n[j]] = [n[j], n[i]]; return n; };

/* Ligne éditable : outils (monter, descendre, supprimer) flottants au survol ou au focus, sans réduire la largeur du texte. */
function RowTools({ children, bullet, onUp, onDown, onRemove }) {
  const T = useT();
  const [hot, setHot] = useState(false);
  const [focus, setFocus] = useState(false);
  const show = hot || focus;
  return (
    <div
      className="relative flex items-start gap-1.5"
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false); }}
    >
      {bullet && <span className="shrink-0 rounded-full bg-indigo-500" style={{ width: 6, height: 6, marginTop: 15 }} aria-hidden="true" />}
      <div className="flex-1 min-w-0">{children}</div>
      <div className={`absolute flex rounded-lg ${T.surface}`} style={{ right: 6, top: -12, zIndex: 2, opacity: show ? 1 : 0, pointerEvents: show ? "auto" : "none", transition: "opacity .12s", ...T.shadow }}>
        <MiniBtn icon={ArrowUp} label="Monter" onClick={onUp || undefined} disabled={!onUp} />
        <MiniBtn icon={ArrowDown} label="Descendre" onClick={onDown || undefined} disabled={!onDown} />
        <MiniBtn icon={X} label="Supprimer" onClick={onRemove} />
      </div>
    </div>
  );
}

/* Liste de paragraphes ou de puces : Entrée crée l'élément suivant, Retour arrière sur un élément vide le supprime, un collage multiligne est découpé. */
function ItemList({ items, onChange, bullet, placeholder, addLabel, warnAt = 230, allowEmpty, label }) {
  const T = useT();
  const wrap = useRef(null);
  const focusItem = (id) => setTimeout(() => {
    const el = wrap.current?.querySelector(`[data-item="${id}"]`);
    if (el) { el.focus(); const n = el.value.length; el.setSelectionRange?.(n, n); }
  }, 0);
  const set = (id, text) => {
    if (text.includes("\n")) {
      const idx = items.findIndex((x) => x.id === id);
      const parts = text.split(/\n+/).map((x) => (bullet ? x.replace(/^\s*[-•*–]\s+/, "") : x).trim());
      const first = parts.shift();
      const extra = parts.filter(Boolean).map((x) => mkItem(x));
      const next = [...items];
      next[idx] = { ...next[idx], text: first };
      next.splice(idx + 1, 0, ...extra);
      onChange(next);
      if (extra.length) focusItem(extra[extra.length - 1].id);
      return;
    }
    onChange(items.map((x) => (x.id === id ? { ...x, text } : x)));
  };
  const insertAfter = (id) => { const it = mkItem(); const i = items.findIndex((x) => x.id === id); const n = [...items]; n.splice(i + 1, 0, it); onChange(n); focusItem(it.id); };
  const remove = (id, focusPrev) => {
    const i = items.findIndex((x) => x.id === id);
    const n = items.filter((x) => x.id !== id);
    onChange(n.length || allowEmpty ? n : [mkItem()]);
    if (focusPrev && n[i - 1]) focusItem(n[i - 1].id);
  };
  return (
    <div ref={wrap} className="space-y-1.5">
      {items.map((it, i) => (
        <RowTools
          key={it.id}
          bullet={bullet}
          onUp={i > 0 ? () => onChange(moveIn(items, i, -1)) : null}
          onDown={i < items.length - 1 ? () => onChange(moveIn(items, i, 1)) : null}
          onRemove={() => remove(it.id)}
        >
            <AutoTextarea
              data-item={it.id}
              value={it.text}
              placeholder={placeholder}
              aria-label={`${label || (bullet ? "Puce" : "Paragraphe")} ${i + 1}`}
              onChange={(e) => set(it.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); insertAfter(it.id); }
                else if (e.key === "Backspace" && !it.text && (items.length > 1 || allowEmpty)) { e.preventDefault(); remove(it.id, true); }
              }}
            />
            {it.text.length > warnAt && <div className="text-xs mt-0.5 text-amber-600">{it.text.length} caractères : trop long, visez {bullet ? "2 lignes" : "des phrases plus courtes"}.</div>}
        </RowTools>
      ))}
      <AddLink onClick={() => { const it = mkItem(); onChange([...items, it]); focusItem(it.id); }}>{addLabel}</AddLink>
      {!items.length && <span className={`text-xs ml-2 ${T.faint}`}>vide</span>}
    </div>
  );
}

function KvEditor({ rows, onChange }) {
  const up = (id, patch) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <RowTools key={r.id} onUp={i > 0 ? () => onChange(moveIn(rows, i, -1)) : null} onDown={i < rows.length - 1 ? () => onChange(moveIn(rows, i, 1)) : null} onRemove={() => onChange(rows.filter((x) => x.id !== r.id))}>
          <div className="flex items-start gap-2">
            <Input value={r.label} onChange={(e) => up(r.id, { label: e.target.value })} placeholder="Libellé" aria-label={`Libellé ${i + 1}`} className="font-medium" style={{ width: "34%", minWidth: 110 }} />
            <div className="flex-1 min-w-0">
              <AutoTextarea value={r.value} onChange={(e) => up(r.id, { value: e.target.value.replace(/\n/g, " ") })} placeholder="élément, élément, élément" aria-label={`Valeur ${i + 1}`} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
            </div>
          </div>
        </RowTools>
      ))}
      <AddLink onClick={() => onChange([...rows, { id: uid("r"), label: "", value: "" }])}>Ligne</AddLink>
    </div>
  );
}

const newEntry = () => ({ id: uid("e"), role: "", org: "", place: "", period: "", paras: [], bullets: [mkItem()] });
function EntriesEditor({ entries, onChange, edu }) {
  const T = useT();
  const L = edu ? ["Diplôme", "Établissement", "Lieu", "Année"] : ["Fonction", "Organisation", "Lieu", "Période"];
  const up = (id, patch) => onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <div key={e.id} className={`rounded-2xl p-3 space-y-2.5 ${T.sub}`}>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0 grid gap-2" style={{ gridTemplateColumns: "minmax(0,1.7fr) minmax(0,1fr)" }}>
              <Input value={e.role} onChange={(ev) => up(e.id, { role: ev.target.value })} placeholder={L[0]} aria-label={L[0]} className="font-medium" />
              <Input value={e.period} onChange={(ev) => up(e.id, { period: ev.target.value })} placeholder={L[3]} aria-label={L[3]} />
              <Input value={e.org} onChange={(ev) => up(e.id, { org: ev.target.value })} placeholder={L[1]} aria-label={L[1]} />
              <Input value={e.place} onChange={(ev) => up(e.id, { place: ev.target.value })} placeholder={`${L[2]} (facultatif)`} aria-label={L[2]} />
            </div>
            <div className="flex flex-col shrink-0">
              <MiniBtn icon={ArrowUp} label="Monter" onClick={() => onChange(moveIn(entries, i, -1))} disabled={i === 0} />
              <MiniBtn icon={ArrowDown} label="Descendre" onClick={() => onChange(moveIn(entries, i, 1))} disabled={i === entries.length - 1} />
              <MiniBtn icon={Trash2} label="Supprimer" onClick={() => onChange(entries.filter((x) => x.id !== e.id))} />
            </div>
          </div>
          {e.paras.length > 0 && <ItemList items={e.paras} onChange={(paras) => up(e.id, { paras })} placeholder="Contexte : organisation, périmètre, enjeu" addLabel="Paragraphe" warnAt={500} allowEmpty label="Contexte" />}
          <ItemList bullet items={e.bullets} onChange={(bullets) => up(e.id, { bullets })} placeholder="Verbe d'action + périmètre + résultat chiffré" addLabel="Puce" allowEmpty />
          {!e.paras.length && <AddLink onClick={() => up(e.id, { paras: [mkItem()] })}>Contexte (facultatif)</AddLink>}
        </div>
      ))}
      <AddLink onClick={() => onChange([...entries, newEntry()])}>{edu ? "Diplôme" : "Poste"}</AddLink>
    </div>
  );
}

function SectionBody({ s, onChange }) {
  const T = useT();
  if (s.kind === "text") return <ItemList items={s.paras} onChange={(paras) => onChange({ ...s, paras })} placeholder="Paragraphe…" addLabel="Paragraphe" warnAt={900} />;
  if (s.kind === "bullets") return <ItemList bullet items={s.items} onChange={(items) => onChange({ ...s, items })} placeholder="Verbe d'action + périmètre + résultat chiffré" addLabel="Puce" />;
  if (s.kind === "kv") return <KvEditor rows={s.rows} onChange={(rows) => onChange({ ...s, rows })} />;
  if (s.kind === "entries") return <EntriesEditor entries={s.entries} onChange={(entries) => onChange({ ...s, entries })} edu={SEC.education.test(s.title)} />;
  return (
    <div className="space-y-1">
      <AutoTextarea value={s.raw} onChange={(e) => onChange({ ...s, raw: e.target.value })} aria-label="Texte balisé de la section" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5 }} />
      <p className={`text-xs ${T.faint}`}>Section mixte, éditée en texte : « - » puce · « ### Poste | Organisation | Lieu | Période » · « **Libellé :** valeur » · ligne vide = paragraphe.</p>
    </div>
  );
}

const SECTION_KIND_LABEL = { text: "paragraphes", bullets: "liste à puces", entries: "postes / diplômes", kv: "libellés", raw: "texte balisé" };
const AI_GOALS = [["impact", "Plus percutant"], ["concise", "Plus concis"], ["keywords", "Mots-clés manquants"], ["style", "Corriger le style"]];
const PRESETS = {
  kinds: ["text", "bullets", "entries", "kv", "kv", "entries", "bullets", "text", "text"],
  fr: ["Profil", "Réalisations clés", "Expérience professionnelle", "Compétences", "Langues", "Formation", "Certifications", "Centres d'intérêt", "Section libre"],
  nl: ["Profiel", "Belangrijkste realisaties", "Werkervaring", "Vaardigheden", "Talen", "Opleiding", "Certificaten", "Interesses", "Vrije sectie"],
  en: ["Profile", "Key achievements", "Professional experience", "Skills", "Languages", "Education", "Certifications", "Interests", "Custom section"],
  de: ["Profil", "Wichtigste Erfolge", "Berufserfahrung", "Kompetenzen", "Sprachen", "Ausbildung", "Zertifikate", "Interessen", "Freier Abschnitt"],
};
const newSection = (title, kind) => ({
  id: uid("sec"), title, kind,
  ...(kind === "text" ? { paras: [mkItem()] } : kind === "bullets" ? { items: [mkItem()] } : kind === "entries" ? { entries: [newEntry()] } : { rows: [{ id: uid("r"), label: "", value: "" }] }),
});

/* Affichage lisible d'un balisage et diff ligne à ligne (puis mot à mot) pour les propositions. */
const displayMarkup = (s) => String(s || "").split("\n").map((l) => l.trim()).filter(Boolean)
  .map((l) => l.replace(/^#{1,3} /, "").replace(/^[-•*] /, "• ").replace(/^[>@=~] /, "").replace(/\*\*/g, "").replace(/\s\|\s+\|?\s*/g, " · ")).join("\n");
function lineDiff(a, b) {
  const A = displayMarkup(a).split("\n").filter(Boolean), B = displayMarkup(b).split("\n").filter(Boolean);
  const dp = Array.from({ length: A.length + 1 }, () => new Uint16Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const rows = [];
  let del = [], add = [];
  const flush = () => {
    const n = Math.min(del.length, add.length);
    for (let k = 0; k < n; k++) rows.push({ t: "chg", segs: wordDiff(del[k], add[k]) });
    del.slice(n).forEach((x) => rows.push({ t: "del", text: x }));
    add.slice(n).forEach((x) => rows.push({ t: "add", text: x }));
    del = []; add = [];
  };
  let i = 0, j = 0;
  while (i < A.length || j < B.length) {
    if (i < A.length && j < B.length && A[i] === B[j]) { flush(); rows.push({ t: "same", text: A[i] }); i++; j++; }
    else if (j >= B.length || (i < A.length && dp[i + 1][j] >= dp[i][j + 1])) del.push(A[i++]);
    else add.push(B[j++]);
  }
  flush();
  return rows;
}

function DiffView({ before, after, compact }) {
  const T = useT();
  const rows = useMemo(() => lineDiff(before, after), [before, after]);
  const addC = T.dark ? "bg-emerald-900 text-emerald-100" : "bg-emerald-100 text-emerald-900";
  const delC = T.dark ? "bg-rose-950 text-rose-300" : "bg-rose-50 text-rose-700";
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {rows.map((r, i) => {
        if (r.t === "same") return compact ? null : <div key={i} className={T.faint}>{r.text}</div>;
        if (r.t === "add") return <div key={i}><span className={`rounded px-0.5 ${addC}`}>{r.text}</span></div>;
        if (r.t === "del") return <div key={i}><span className={`rounded px-0.5 line-through ${delC}`}>{r.text}</span></div>;
        return (
          <div key={i}>
            {r.segs.map((s, k) => (s.t === "same" ? <span key={k}>{s.w} </span>
              : s.t === "add" ? <span key={k} className={`rounded px-0.5 ${addC}`}>{s.w} </span>
              : <span key={k} className={`rounded px-0.5 line-through ${delC}`}>{s.w} </span>))}
          </div>
        );
      })}
    </div>
  );
}

function SectionCard({ s, idx, count, kind, onChange, onMove, onRemove, onAI, aiBusy, proposal, onAccept, onReject, flash, missingCount, spont }) {
  const T = useT();
  const [aiOpen, setAiOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const isSubject = kind !== "cv" && idx === 0;
  return (
    <section id={`studio-sec-${idx}`} className={`rounded-3xl p-4 sm:p-5 space-y-3 ${T.surface}`} style={{ ...T.shadow, scrollMarginTop: 64, boxShadow: flash ? "0 0 0 2px rgba(99,102,241,.6)" : T.shadow.boxShadow, transition: "box-shadow .3s" }}>
      <div className="flex items-center gap-1.5">
        {isSubject ? <div className="flex-1 min-w-0 text-base font-semibold tracking-tight px-1.5">Corps de la lettre</div> : (
          <input
            value={s.title}
            onChange={(e) => onChange({ ...s, title: e.target.value })}
            placeholder={idx === 0 ? "Sans titre (introduction)" : "Titre de la section"}
            aria-label="Titre de la section"
            title={SECTION_KIND_LABEL[s.kind]}
            className={`flex-1 min-w-0 bg-transparent text-base font-semibold tracking-tight rounded-lg px-1.5 py-1 ${T.ring}`}
          />
        )}
        <Btn size="sm" variant={aiOpen ? "primary" : "ghost"} icon={Sparkles} loading={aiBusy} onClick={() => setAiOpen((o) => !o)} aria-expanded={aiOpen} aria-label="Améliorer avec l'IA" title="Améliorer avec l'IA"><span className="hidden sm:inline">Améliorer</span></Btn>
        <MiniBtn icon={ArrowUp} label="Monter la section" onClick={() => onMove(-1)} disabled={idx === 0} />
        <MiniBtn icon={ArrowDown} label="Descendre la section" onClick={() => onMove(1)} disabled={idx === count - 1} />
        {confirmDel
          ? <Btn size="sm" variant="danger" onClick={onRemove}>Supprimer ?</Btn>
          : <MiniBtn icon={Trash2} label="Supprimer la section" onClick={() => { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3500); }} />}
      </div>
      {aiOpen && (
        <div className={`rounded-2xl p-3 space-y-2 ${T.sub}`}>
          <div className="flex flex-wrap gap-1.5">
            {AI_GOALS.filter(([g]) => kind === "cv" || g !== "keywords").map(([g, l]) => (
              <Btn key={g} size="sm" variant="soft" disabled={aiBusy || (g === "keywords" && !missingCount)} onClick={() => onAI(g)}>
                {l}{g === "keywords" ? ` (${missingCount || 0})` : ""}
              </Btn>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) onAI("custom", custom.trim()); }} placeholder="Votre consigne : « mettre en avant le management d'équipe »…" aria-label="Consigne de réécriture" className="h-8 text-xs" />
            <Btn size="sm" disabled={!custom.trim() || aiBusy} onClick={() => onAI("custom", custom.trim())}>Réécrire</Btn>
          </div>
          <p className={`text-xs ${T.faint}`}>L'IA propose une nouvelle version de la section ; vous comparez avant d'appliquer.</p>
        </div>
      )}
      {proposal && (
        <div className={`rounded-2xl p-3 space-y-3 border ${T.line}`} style={{ borderColor: "rgba(99,102,241,.45)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-500">Proposition de réécriture</div>
            {proposal.note && <span className={`text-xs ${T.muted}`}>{proposal.note}</span>}
          </div>
          <DiffView before={proposal.before} after={proposal.body} />
          <div className="flex gap-2">
            <Btn size="sm" variant="primary" icon={Check} onClick={onAccept}>Appliquer</Btn>
            <Btn size="sm" variant="ghost" onClick={onReject}>Ignorer</Btn>
          </div>
        </div>
      )}
      {isSubject && (
        <FieldBox label="Objet" hint={spont ? "Ex. « Candidature spontanée — rôle visé »." : "Reprenez l'intitulé exact du poste."}>
          <Input value={s.title} onChange={(e) => onChange({ ...s, title: e.target.value })} aria-label="Objet de la lettre" />
        </FieldBox>
      )}
      <SectionBody s={s} onChange={onChange} />
    </section>
  );
}

function FieldBox({ label, hint, children, className = "" }) {
  const T = useT();
  return (
    <div className={className}>
      <span className={`block text-xs font-medium mb-1.5 ${T.muted}`}>{label}</span>
      {children}
      {hint && <span className={`block text-xs mt-1 ${T.faint}`}>{hint}</span>}
    </div>
  );
}

function HeaderCard({ model, set, kind, lang, analysis, onHeadlines, hlBusy, hlOpts, flash }) {
  const T = useT();
  const { profile } = useApp();
  const sug = analysis?.positioning?.headline;
  const len = (model.headline || "").length;
  const city = String(profile.home || "").split(/[(,]/)[0].trim();
  const todayLine = lang === "fr" ? `${city}, le ${longDate("fr")}` : `${city}, ${longDate(lang)}`;
  return (
    <section id="studio-sec-head" className={`rounded-3xl p-4 sm:p-5 space-y-4 ${T.surface}`} style={{ ...T.shadow, scrollMarginTop: 64, boxShadow: flash ? "0 0 0 2px rgba(99,102,241,.6)" : T.shadow.boxShadow, transition: "box-shadow .3s" }}>
      <div className="text-base font-semibold tracking-tight">En-tête</div>
      <Field label="Prénom et nom"><Input value={model.name} onChange={(e) => set({ name: e.target.value })} placeholder="Prénom Nom" /></Field>
      {kind !== "cv" && (
        <FieldBox label="Lieu et date">
          <Input value={model.date} onChange={(e) => set({ date: e.target.value })} aria-label="Lieu et date" />
          <div className="mt-1"><AddLink onClick={() => set({ date: todayLine })}>Date du jour</AddLink></div>
        </FieldBox>
      )}
      {kind === "cv" && (
        <FieldBox label="Ligne sous le nom : votre positionnement" hint="Votre fonction réelle + 2 ou 3 expertises qui recoupent l'annonce. L'intitulé du poste visé se cite comme objectif dans le profil, pas ici.">
          <AutoTextarea value={model.headline} onChange={(e) => set({ headline: e.target.value.replace(/\n/g, " ") })} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} placeholder={`${profile.headline || "Fonction actuelle"} | Expertise · Expertise · Expertise`} aria-label="Ligne sous le nom" />
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`text-xs tabular-nums ${len > 85 ? "text-amber-600" : T.faint}`}>{len}/85</span>
            {sug && sug !== model.headline && (
              <button type="button" onClick={() => set({ headline: sug })} className={`text-left text-xs rounded-full px-2.5 py-1 ${T.accentSoft} ${T.ring}`} title="Appliquer la suggestion de l'analyse">Suggestion : {sug}</button>
            )}
            <Btn size="sm" variant="ghost" icon={Sparkles} loading={hlBusy} onClick={onHeadlines}>4 variantes</Btn>
          </div>
          {hlOpts.length > 0 && (
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              {hlOpts.map((o, i) => (
                <button key={i} type="button" onClick={() => set({ headline: o.headline })} className={`text-left rounded-xl px-3 py-2 text-sm ${model.headline === o.headline ? T.accentSoft : `${T.sub} ${T.subHover}`} ${T.ring}`}>
                  <span className="font-medium">{o.headline}</span>{o.angle && <span className={`text-xs ${T.muted}`}> · {o.angle}</span>}
                </button>
              ))}
            </div>
          )}
        </FieldBox>
      )}
      <FieldBox label="Coordonnées" hint="Séparées par « | » : ville, e-mail, téléphone, LinkedIn.">
        <AutoTextarea value={model.contact} onChange={(e) => set({ contact: e.target.value.replace(/\n/g, " ") })} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} aria-label="Coordonnées" />
        <div className="mt-1"><AddLink onClick={() => set({ contact: profileContact(profile) })}>Reprendre depuis mon profil</AddLink></div>
      </FieldBox>
      {kind !== "cv" && (
        <FieldBox label="Destinataire" hint="Une ligne par élément : service ou nom, entreprise, adresse.">
          <AutoTextarea value={model.recipients} onChange={(e) => set({ recipients: e.target.value })} aria-label="Destinataire" />
        </FieldBox>
      )}
    </section>
  );
}

/* ── Panneau d'optimisation ── */
function ScoreRing({ value }) {
  const T = useT();
  const v = clamp(Number(value) || 0, 0, 100);
  const c = v >= 80 ? "#4f46e5" : v >= 60 ? "#d97706" : "#e11d48";
  const r = 22, L = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label={`Score ${v} sur 100`}>
      <circle cx="28" cy="28" r={r} fill="none" stroke={T.dark ? "#292524" : "#e7e5e4"} strokeWidth="5" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(v / 100) * L} ${L}`} transform="rotate(-90 28 28)" style={{ transition: "stroke-dasharray .4s" }} />
      <text x="28" y="33" textAnchor="middle" fontSize="15" fontWeight="600" fill={T.dark ? "#fafaf9" : "#1c1917"}>{v}</text>
    </svg>
  );
}
/* Lettre : deux jauges — recouvrement avec le CV (≤ 15 %) et spécificité. */
function LetterGauges({ scores }) {
  const T = useT();
  const ov = scores.overlap;
  const ovTone = ov === null ? T.faint : ov > 30 ? "text-rose-600" : ov > 15 ? "text-amber-600" : "text-emerald-600";
  const spTone = scores.spec === null ? T.faint : scores.spec >= 80 ? "text-emerald-600" : scores.spec >= 60 ? "text-amber-600" : "text-rose-600";
  const Gauge = ({ label, value, unit, tone, hint, max }) => (
    <div className={`rounded-2xl p-3 ${T.sub}`} title={hint}>
      <div className={`text-xs ${T.muted}`}>{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${tone}`}>{value === null || value === undefined ? "—" : `${value}${unit}`}</div>
      <div className={`h-1.5 mt-1 rounded-full overflow-hidden ${T.dark ? "bg-stone-700" : "bg-stone-200"}`}>
        <div className={`h-full rounded-full ${tone.replace("text-", "bg-")}`} style={{ width: `${value == null ? 0 : clamp((value / max) * 100, 0, 100)}%` }} />
      </div>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      <Gauge label="Recouvrement CV" value={ov} unit=" %" tone={ovTone} max={50} hint="Part des suites de 4 mots de la lettre déjà présentes dans le CV. Cible ≤ 15 %, bloquant au-delà de 30 %." />
      <Gauge label="Spécificité" value={scores.spec} unit="/100" tone={spTone} max={100} hint="Pourquoi eux (fait vérifié), conviction, histoire racontée, aucune flatterie." />
    </div>
  );
}
function ScoreBar({ label, value, hint }) {
  const T = useT();
  if (value === null || value === undefined) return null;
  const c = value >= 80 ? "bg-indigo-600" : value >= 60 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div title={hint}>
      <div className="flex items-center justify-between text-xs mb-1"><span className={T.muted}>{label}</span><span className="tabular-nums font-medium">{value}</span></div>
      <div className={`h-1.5 rounded-full overflow-hidden ${T.sub}`}><div className={`h-full rounded-full ${c}`} style={{ width: `${value}%`, transition: "width .3s" }} /></div>
    </div>
  );
}
const ISSUE_ICON = { block: [AlertTriangle, "text-rose-500"], warn: [AlertTriangle, "text-amber-500"], info: [Lightbulb, "text-stone-400"] };

function IssueRow({ i, api }) {
  const T = useT();
  const [Icon, color] = ISSUE_ICON[i.level];
  return (
    <li className={`rounded-2xl p-3 ${T.sub}`}>
      <div className="flex gap-2.5">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-snug">{i.title}</div>
          {i.detail && <div className={`text-xs mt-0.5 leading-relaxed ${T.muted}`}>{i.detail}</div>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {i.sec !== undefined && i.sec !== null && <Btn size="sm" variant="ghost" icon={ArrowRight} onClick={() => api.goTo(i.sec)}>Voir</Btn>}
            {i.fix === "headline" && api.headlineFix && <Btn size="sm" variant="soft" icon={Check} onClick={api.applyHeadlineFix} title={api.headlineFix}>Appliquer la suggestion</Btn>}
            {i.autoFix && <Btn size="sm" variant="soft" icon={Wand2} loading={api.busyFix} onClick={() => api.fix([{ title: i.title, detail: i.detail }])}>Corriger avec l'IA</Btn>}
            {i.tab === "kw" && <Btn size="sm" variant="ghost" onClick={() => api.setTab("kw")}>Voir les mots-clés</Btn>}
          </div>
        </div>
      </div>
    </li>
  );
}

function ProposalCard({ p, text, api }) {
  const T = useT();
  const stale = p.status === "pending" && applyEdit(text, p.before, p.after) === null;
  if (p.status === "applied") return <li className={`text-xs flex items-center gap-1.5 ${T.faint}`}><Check className="w-3.5 h-3.5" aria-hidden="true" />Appliquée : {p.reason || displayMarkup(p.after).slice(0, 60)}</li>;
  return (
    <li className={`rounded-2xl p-3 space-y-2 ${T.sub}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {p.severity && <Chip tone={p.severity === "haute" ? "danger" : p.severity === "moyenne" ? "warn" : "neutral"}>{p.severity}</Chip>}
        <Chip>{p.source}</Chip>
        {p.reason && <span className={`text-xs ${T.muted}`}>{p.reason}</span>}
      </div>
      <DiffView before={p.before} after={p.after} />
      {stale && <p className="text-xs text-amber-600">Passage introuvable : le texte a changé depuis la proposition.</p>}
      <div className="flex gap-2">
        <Btn size="sm" variant="primary" icon={Check} disabled={stale} onClick={() => api.applyProposal(p)}>Appliquer</Btn>
        <Btn size="sm" variant="ghost" onClick={() => api.ignoreProposal(p.id)}>Ignorer</Btn>
      </div>
    </li>
  );
}

/* 6c / 6d : CV maître par langue (base des CV adaptés) et puces verrouillées. */
function MasterPanel({ app, offer, text }) {
  const T = useT();
  const { profile, setMasterCv, clearMasterCv, toggleLockedBullet } = useApp();
  const lang = docLang(offer, { ...DEFAULT_DOC_PREFS, ...(app.docPrefs || {}) }, app.analysis);
  const master = masterOf(profile, lang);
  const locked = lockedOf(profile);
  const bullets = master ? docOutline(master.text, "cv").sections.filter((s) => ["experience", "achievements"].includes(secKindOf(s.title))).flatMap((s) => s.lines.map((l) => l.trim()).filter((l) => /^[-•*]\s/.test(l)).map((l) => l.replace(/^[-•*]\s*/, ""))) : [];
  return (
    <div className="p-4 space-y-4">
      <p className={`text-xs ${T.muted}`}>Le CV maître ({LANG_NAME[lang] || lang}) sert de base à chaque CV adapté : seuls la ligne de positionnement, le Profil, les Réalisations clés, l'ordre des puces de chaque poste et les Compétences changent. Le reste est recopié à l'identique, même si l'IA s'en écarte.</p>
      {!master ? (
        <div className={`rounded-2xl p-3 space-y-2 ${T.sub}`}>
          <div className="text-sm font-medium">Aucun CV maître en {LANG_NAME[lang] || lang}</div>
          <Btn size="sm" variant="primary" icon={Save} onClick={() => setMasterCv(lang, text, app.id)}>Faire de ce CV le CV maître</Btn>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <Chip tone="accent">maître {String(lang).toUpperCase()} du {fmtDate(master.at)}</Chip>
            <Btn size="sm" variant="soft" icon={Save} onClick={() => setMasterCv(lang, text, app.id)}>Remplacer par ce CV</Btn>
            <Btn size="sm" variant="ghost" icon={Trash2} onClick={() => clearMasterCv(lang)}>Supprimer</Btn>
          </div>
          <div>
            <SectionTitle>Écarts avec le maître</SectionTitle>
            {normText(master.text) === normText(text) ? <p className={`text-xs ${T.faint}`}>Identique au maître.</p> : <DiffView before={master.text} after={text} compact />}
          </div>
          <div>
            <SectionTitle>Puces verrouillées</SectionTitle>
            <p className={`text-xs mb-2 ${T.muted}`}>Une puce verrouillée est recopiée mot pour mot : ni la génération, ni les corrections, ni la relecture ne la modifient.</p>
            <ul className="space-y-1.5">
              {bullets.map((b, i) => {
                const on = locked.some((x) => bulletKey(x) === bulletKey(b));
                return (
                  <li key={i} className="flex gap-2 items-start text-sm">
                    <button type="button" onClick={() => toggleLockedBullet(b)} aria-pressed={on} title={on ? "Déverrouiller" : "Verrouiller"} className={`shrink-0 mt-0.5 text-xs rounded-full px-2 py-0.5 ${on ? "bg-indigo-600 text-white" : T.chip} ${T.ring}`}>{on ? "verrouillée" : "libre"}</button>
                    <span className="min-w-0">{b}</span>
                  </li>
                );
              })}
              {!bullets.length && <li className={`text-xs ${T.faint}`}>Aucune puce d'expérience ou de réalisation dans le maître.</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function OptimPanel({ app, offer, type, report, pages, text, api }) {
  const T = useT();
  const { busy, runAnalysis, setOfferAdText } = useApp();
  const analysis = app.analysis;
  const [kwFilter, setKwFilter] = useState("todo");
  const [ad, setAd] = useState(adTextOf(offer));
  const fixable = autoFixList(report);
  const pending = api.proposals.filter((p) => p.status === "pending");
  const applicable = pending.filter((p) => applyEdit(text, p.before, p.after) !== null);
  const eligible = report.kw.filter((k) => k.status !== "absent" && (type === "cv" || k.importance === 3));
  const toIntegrate = eligible.filter((k) => !k.found);
  const kwShown = report.kw.filter((k) => (kwFilter === "todo" ? toIntegrate.includes(k) : kwFilter === "ok" ? k.found : kwFilter === "absent" ? k.status === "absent" : true));
  const byCat = Object.keys(KW_CATS).map((c) => [c, kwShown.filter((k) => k.category === c).sort((a, b) => b.importance - a.importance)]).filter(([, l]) => l.length);
  const groups = [["block", "À corriger avant envoi"], ["warn", "À améliorer"], ["info", "Conseils"]];
  const tab = api.tab;
  return (
    <div className="flex flex-col min-h-full">
      <div className={`p-4 space-y-3 border-b ${T.line}`}>
        <div className="flex items-center gap-3">
          <ScoreRing value={report.scores.total} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium leading-snug">{report.blockers ? `${report.blockers} point(s) à corriger avant envoi` : "Prêt à envoyer après relecture"}</div>
            <div className={`text-xs ${T.muted}`}>{report.words} mots · {pages || "…"} page(s){!analysis ? " · annonce non analysée" : ""}</div>
          </div>
        </div>
        {type === "cv" ? (
          <>
            <ScoreBar label="Mots-clés ATS" value={report.scores.ats} hint="Couverture pondérée des mots-clés justifiables + intitulé exact" />
            <ScoreBar label="Impact" value={report.scores.impact} hint="Puces chiffrées, verbes d'action, absence de clichés" />
            <ScoreBar label="Lisibilité" value={report.scores.read} hint="Longueur, pages, sections, répétitions" />
          </>
        ) : (
          <>
            <LetterGauges scores={report.scores} />
            <ScoreBar label="Spécificité (35 %)" value={report.scores.spec} hint="Faits propres à l'entreprise, conviction, histoire racontée, aucune flatterie" />
            <ScoreBar label="Complémentarité avec le CV (25 %)" value={report.scores.compl} hint="Recouvrement de 4-grammes avec le CV ≤ 15 %, chiffres communs ≤ 1, 2 chiffres au plus" />
            <ScoreBar label="Impact (20 %)" value={report.scores.impact} hint="Histoire racontée, objet, demande d'échange, aucun cliché" />
            <ScoreBar label="Lisibilité (20 %)" value={report.scores.read} hint="Longueur, débuts de phrase, répétitions, une page" />
          </>
        )}
      </div>
      <div className="px-4 pt-3 overflow-x-auto">
        <Tabs
          compact
          value={tab}
          onChange={api.setTab}
          tabs={[
            { id: "checks", label: "Contrôles", count: report.issues.length || undefined },
            { id: "kw", label: "Mots-clés", count: report.kwPct !== null ? `${report.kwPct} %` : undefined },
            { id: "ai", label: "IA", count: pending.length || undefined },
            { id: "ad", label: offer?.spontaneous ? "Cible" : "Annonce" },
            ...(type === "cv" ? [{ id: "master", label: "Maître" }] : []),
          ]}
        />
      </div>

      {tab === "checks" && (
        <div className="p-4 space-y-5">
          {fixable.length > 0 && (
            <div className={`rounded-2xl p-3 ${T.accentSoft}`}>
              <Btn variant="primary" icon={Wand2} loading={api.busyFix} onClick={() => api.fix(fixable)}>Corriger automatiquement ({fixable.length})</Btn>
              <p className="text-xs mt-2">L'IA propose des remplacements ciblés ({type === "cv" ? "titre, mots-clés, style" : "pourquoi eux, conviction, histoire, recouvrement avec le CV, style"}) ; vous validez chacun dans l'onglet IA.</p>
            </div>
          )}
          {groups.map(([lvl, label]) => {
            const items = report.issues.filter((i) => i.level === lvl);
            if (!items.length) return null;
            return (
              <div key={lvl}>
                <SectionTitle>{label}</SectionTitle>
                <ul className="space-y-2">{items.map((i) => <IssueRow key={i.id} i={i} api={api} />)}</ul>
              </div>
            );
          })}
          {!report.issues.length && <Empty icon={CheckCircle2} title="Aucun point détecté" text="Relisez une dernière fois, puis lancez la relecture recruteur dans l'onglet IA." />}
          {api.tips?.length > 0 && (
            <div className={`rounded-2xl p-4 ${T.sub}`}>
              <div className="text-sm font-medium mb-1">Pour sortir du lot sur cette offre</div>
              <ul className={`text-sm space-y-1 ${T.muted}`}>{api.tips.map((t, i) => <li key={i}>• {t}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {tab === "kw" && (
        <div className="p-4 space-y-4">
          {!analysis && (
            <Notice tone="warn" icon={Info}>
              Annonce pas encore analysée : les mots-clés affichés viennent de l'ancienne version.{" "}
              <button type="button" className="underline underline-offset-4" onClick={() => api.setTab("ad")}>Analyser l'annonce</button>
            </Notice>
          )}
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{type === "cv" ? "Couverture pondérée" : "Mots-clés essentiels"}</span>
              <span className="tabular-nums">{report.kwPct ?? "—"} %</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden mt-1.5 ${T.sub}`}><div className="h-full rounded-full bg-indigo-600" style={{ width: `${report.kwPct || 0}%` }} /></div>
            <div className={`text-xs mt-1.5 ${T.muted}`}>
              {eligible.length - toIntegrate.length}/{eligible.length} mots-clés {type === "cv" ? "justifiables" : "essentiels"} présents
              {report.titleFound !== null && <> · intitulé exact {report.titleFound ? "présent" : <span className="text-amber-600">absent</span>}</>}
            </div>
          </div>
          {toIntegrate.length > 0 && (
            <Btn variant="primary" icon={Wand2} loading={api.busyFix} onClick={() => api.integrate(toIntegrate)}>Intégrer les {toIntegrate.length} manquants</Btn>
          )}
          <div className="overflow-x-auto">
            <Tabs compact value={kwFilter} onChange={setKwFilter} tabs={[
              { id: "todo", label: "À intégrer", count: toIntegrate.length },
              { id: "ok", label: "Présents", count: report.kw.filter((k) => k.found).length },
              { id: "absent", label: "Absents", count: report.kw.filter((k) => k.status === "absent").length },
              { id: "all", label: "Tous" },
            ]} />
          </div>
          {!kwShown.length && <p className={`text-sm ${T.faint}`}>{kwFilter === "todo" ? "Tous les mots-clés justifiables sont présents." : "Aucun."}</p>}
          {byCat.map(([cat, list]) => (
            <div key={cat}>
              <SectionTitle>{KW_CATS[cat]}</SectionTitle>
              <ul className="space-y-1">
                {list.map((k) => (
                  <li key={k.term} className="flex items-start gap-2 py-1">
                    {k.found ? <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" aria-label="présent" />
                      : k.status !== "absent" ? <Circle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" aria-label="à intégrer" />
                      : <Minus className={`w-4 h-4 mt-0.5 shrink-0 ${T.faint}`} aria-label="non prouvé" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <span className="font-medium">{k.term}</span>
                        <span className="ml-1.5 tracking-widest text-indigo-500" title={`Importance ${k.importance}/3`} aria-label={`Importance ${k.importance} sur 3`}>{"•".repeat(k.importance)}</span>
                        {k.found && <span className={`text-xs ml-1.5 tabular-nums ${T.faint}`}>×{k.count}</span>}
                      </div>
                      <div className={`text-xs leading-relaxed ${k.status === "absent" && !k.found ? T.faint : T.muted}`}>
                        {k.found ? `${k.where.map((w) => w.title).join(" · ")}${k.onlyList && type === "cv" ? " — seulement dans une liste" : ""}`
                          : k.status !== "absent" ? `${k.status === "transférable" ? "Transférable" : "Prouvé"}${k.evidence ? ` : ${k.evidence}` : ""}`
                          : "Non prouvé par votre profil : à préparer pour l'entretien."}
                      </div>
                    </div>
                    {!k.found && k.status !== "absent" && <Btn size="sm" variant="ghost" disabled={api.busyFix} onClick={() => api.integrate([k])}>Intégrer</Btn>}
                    {k.status === "absent" && !k.found && analysis && <Btn size="sm" variant="ghost" onClick={() => api.declare(k.term)} title="Vous avez réellement cette compétence : elle est ajoutée à votre profil">Je l'ai</Btn>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === "ai" && (
        <div className="p-4 space-y-4">
          <div className={`rounded-2xl p-3 space-y-2 ${T.sub}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium">Relecture recruteur</div>
                <div className={`text-xs ${T.muted}`}>Lecture critique du document et corrections ciblées.</div>
              </div>
              <Btn size="sm" variant={api.review ? "soft" : "primary"} icon={Sparkles} loading={api.busyReview} onClick={api.runReview}>{api.review ? "Relancer" : "Lancer"}</Btn>
            </div>
            {api.review && (
              <div className="space-y-2 pt-1">
                {api.review.score !== null && <Chip tone={api.review.score >= 80 ? "ok" : api.review.score >= 60 ? "warn" : "danger"}>{api.review.score}/100 selon le relecteur</Chip>}
                {api.review.verdict && <p className="text-sm leading-relaxed">{api.review.verdict}</p>}
                {api.review.strengths?.length > 0 && <ul className={`text-xs space-y-0.5 ${T.muted}`}>{api.review.strengths.map((s, i) => <li key={i}>+ {s}</li>)}</ul>}
              </div>
            )}
          </div>
          {pending.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {applicable.length > 0 && <Btn size="sm" variant="primary" icon={Check} onClick={api.applyAll}>Tout appliquer ({applicable.length})</Btn>}
              <Btn size="sm" variant="ghost" onClick={api.ignoreAll}>Tout ignorer</Btn>
            </div>
          )}
          {api.proposals.length > 0 ? (
            <ul className="space-y-2">{api.proposals.map((p) => <ProposalCard key={p.id} p={p} text={text} api={api} />)}</ul>
          ) : (
            <p className={`text-sm ${T.faint}`}>Les corrections proposées par l'IA (relecture, mots-clés, contrôles) s'affichent ici avec l'avant / après. Rien n'est modifié sans votre accord.</p>
          )}
        </div>
      )}

      {tab === "master" && <MasterPanel app={app} offer={offer} text={text} />}
      {tab === "ad" && (
        <div className="p-4 space-y-5">
          {analysis ? (
            <>
              {offer?.spontaneous && <Notice tone="accent" icon={Info}>Aucune annonce : analyse déduite du rôle visé{offer.spontaneous === "base" ? "" : " et du contexte que vous avez fourni"}.</Notice>}
              <div>
                <div className={`text-xs ${T.muted}`}>{offer?.spontaneous ? "Intitulé courant du rôle" : "Intitulé exact"}</div>
                <div className="text-sm font-medium">{analysis.jobTitle}</div>
                {analysis.titleVariants?.length > 0 && <div className={`text-xs ${T.faint}`}>Équivalents : {analysis.titleVariants.join(", ")}</div>}
              </div>
              {analysis.angle && <div><SectionTitle>{offer?.spontaneous ? "Ce que l'employeur pourrait y gagner" : "Ce que l'employeur cherche"}</SectionTitle><p className="text-sm leading-relaxed">{analysis.angle}</p></div>}
              {analysis.positioning?.pitch && <div><SectionTitle>Votre proposition de valeur</SectionTitle><p className="text-sm leading-relaxed">{analysis.positioning.pitch}</p></div>}
              {analysis.requirements?.length > 0 && (
                <div>
                  <SectionTitle>{offer?.spontaneous ? "Attentes du rôle et preuves" : "Exigences clés et preuves"}</SectionTitle>
                  <ul className="space-y-2">
                    {analysis.requirements.map((r, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        {r.proof ? <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" aria-label="prouvée" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" aria-label="sans preuve" />}
                        <div className="min-w-0"><div>{r.text}</div><div className={`text-xs ${T.muted}`}>{r.proof || "Pas de preuve directe dans votre profil"}</div></div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.gaps?.length > 0 && (
                <div>
                  <SectionTitle>Écarts à traiter honnêtement</SectionTitle>
                  <ul className="space-y-1.5 text-sm">{analysis.gaps.map((g, i) => <li key={i}><span className="font-medium">{g.text}</span>{g.approach && <span className={T.muted}> → {g.approach}</span>}</li>)}</ul>
                </div>
              )}
              {analysis.companyFacts?.length > 0 && (
                <div><SectionTitle>Contexte de l'entreprise (annonce)</SectionTitle><ul className={`text-sm space-y-1 ${T.muted}`}>{analysis.companyFacts.map((f, i) => <li key={i}>• {f}</li>)}</ul></div>
              )}
              <p className={`text-xs ${T.faint}`}>Analyse du {fmtDate(analysis.createdAt, { time: true })} · {offer?.spontaneous ? `rôle « ${offer.title} »` : analysis.fromSummary ? "sur un résumé de l'annonce" : `${analysis.adChars || "?"} caractères d'annonce`}</p>
            </>
          ) : <p className={`text-sm ${T.muted}`}>{offer?.spontaneous ? "L'analyse déduit l'intitulé courant du rôle, 20 à 30 mots-clés habituels des annonces et les attentes du rôle, confrontés à votre profil." : "L'analyse extrait l'intitulé exact, 20 à 35 mots-clés ATS, les exigences clés et les preuves de votre profil."} Elle pilote la rédaction et les contrôles.</p>}
          {!offer?.fullText && !offer?.spontaneous && <Notice tone="warn" icon={AlertTriangle}>Seul un résumé de l'annonce est enregistré : collez le texte complet ci-dessous pour une analyse ATS exhaustive.</Notice>}
          <Field label={offer?.spontaneous ? "Contexte de la candidature" : "Texte complet de l'annonce"} hint={offer?.spontaneous ? "Seule source d'information sur l'entreprise." : `${ad.length} caractères · enregistré sur l'offre`}>
            <Textarea rows={10} value={ad} onChange={(e) => setAd(e.target.value)} onBlur={() => { if (ad.trim() !== adTextOf(offer)) setOfferAdText(offer.id, ad); }} placeholder={offer?.spontaneous ? "Ce que vous savez de l'entreprise et pourquoi elle…" : "Collez ici l'annonce complète (missions, profil, compétences, conditions)…"} />
          </Field>
          <Btn variant={analysis ? "soft" : "primary"} icon={RefreshCw} loading={busy[`analysis:${app.id}`]} onClick={async () => { if (ad.trim() !== adTextOf(offer)) setOfferAdText(offer.id, ad); await runAnalysis(app.id); }}>{analysis ? "Relancer l'analyse" : offer?.spontaneous ? "Analyser le rôle" : "Analyser l'annonce"}</Btn>
        </div>
      )}
    </div>
  );
}

/* ── Réglages de génération ── */
const GEN_STEPS = ["Analyse de l'annonce ou du rôle", "Rédaction", "Contrôle qualité"];
function GenSteps({ st }) {
  const T = useT();
  return (
    <div className={`rounded-2xl p-4 space-y-2 ${T.sub}`} aria-live="polite">
      <ol className="space-y-1.5">
        {GEN_STEPS.map((l, i) => {
          const n = i + 1;
          const done = st && n < st.step, cur = st && n === st.step;
          return (
            <li key={l} className={`flex items-center gap-2 text-sm ${done || cur ? "" : T.faint}`}>
              {done ? <Check className="w-4 h-4 text-emerald-500" aria-hidden="true" /> : cur ? <Loader2 className={`w-4 h-4 animate-spin ${T.accentText}`} aria-hidden="true" /> : <Circle className="w-4 h-4" aria-hidden="true" />}
              <span className={cur ? "font-medium" : ""}>{n}. {l}</span>
            </li>
          );
        })}
      </ol>
      {st?.label && <p className={`text-xs ${T.muted}`}>{st.label}</p>}
    </div>
  );
}

/* ── Pourquoi cette candidature : faits sourcés, pourquoi eux / ce rôle, conviction et histoire, employeur nommé ou non ── */
function AppMotivationCard({ app, offer, types }) {
  const T = useT();
  const { profile, briefs, requestBrief, addManualBrief, removeBriefFact, setAppMotivation, busy, go } = useApp();
  const m = appMotivOf(app);
  const bank = motivOf(profile);
  const set = (patch) => setAppMotivation(app.id, patch);
  const company = offer?.spontaneous === "base" ? null : str(offer?.company);
  const brief = company ? briefs[briefKey(company)] : null;
  const facts = companyFactsFor(app, offer, briefs);
  const chosen = m.factIds.length ? facts.filter((f) => m.factIds.includes(f.id)) : facts;
  const [src, setSrc] = useState({ open: false, url: "", text: "" });
  const bKey = company ? `brief:${briefKey(company)}` : "";
  const writesLetter = types.some((t) => t !== "cv");
  const toggleFact = (id) => {
    const base = m.factIds.length ? m.factIds : facts.map((f) => f.id);
    set({ factIds: base.includes(id) ? base.filter((x) => x !== id) : [...base, id] });
  };
  const missing = [
    company && !chosen.length && "aucun fait sourcé sur l'entreprise",
    !m.whyRole.trim() && !bank.whyNow.trim() && "pourquoi ce rôle maintenant",
    !bank.convictions.length && "aucune conviction dans vos Motivations",
    !bank.stories.length && "banque d'histoires vide",
  ].filter(Boolean);
  return (
    <Card className="p-6 space-y-4 lg:col-span-3">
      <div>
        <div className="text-lg font-medium tracking-tight">Pourquoi cette candidature</div>
        <p className={`text-sm mt-1 ${T.muted}`}>Le CV prouve, la lettre explique. Ces choix nourrissent la lettre{offer?.spontaneous ? "" : ", le message LinkedIn et la réponse « Pourquoi nous ? »"} ; jamais le CV. Laissé vide, un passage s'écrit [à compléter] et bloque l'envoi.</p>
      </div>

      <Toggle checked={m.employerNamed} onChange={(v) => set({ employerNamed: v })} label="Nommer mon employeur actuel (CV et lettre)" description={m.employerNamed ? `Le CV et la lettre citent « ${profile.experiences?.[0]?.org || "votre employeur"} ».` : "Ni le CV ni la lettre ne le nomment : « une fédération patronale belge ». Toute mention est bloquée au contrôle."} />

      {writesLetter && (
        <>
          {company && (
            <FieldBox label={`Faits sourcés sur ${company}`} hint={brief ? `Fiche ${briefFresh(brief) ? `valable jusqu'au ${fmtDate(brief.expiresAt)}` : "expirée (plus de 60 jours)"} · origine : ${brief.origin}. Un fait sans URL vérifiée est exclu.` : "Faits de l'annonce et de la fiche entreprise. Un fait sans URL vérifiée est exclu."}>
              {facts.length ? (
                <ul className="space-y-1.5">
                  {facts.map((f) => (
                    <li key={f.id} className="flex gap-2 items-start text-sm">
                      <input type="checkbox" className="mt-1" checked={!m.factIds.length || m.factIds.includes(f.id)} onChange={() => toggleFact(f.id)} aria-label={`Retenir ${f.id}`} />
                      <span className="flex-1 min-w-0">{f.text} <ExtLink href={f.url} className="text-xs">{f.source === "annonce" ? "annonce" : hostOf(f.url)}</ExtLink></span>
                      {f.source !== "annonce" && <IconBtn icon={X} label="Retirer de la fiche" onClick={() => removeBriefFact(company, f.id)} className="w-7 h-7" />}
                    </li>
                  ))}
                </ul>
              ) : <p className={`text-sm ${T.faint}`}>Aucun fait sourcé pour l'instant.</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                <Btn size="sm" icon={Search} loading={!!busy[bKey]} onClick={() => requestBrief(company, offer?.title ? `poste visé : ${offer.title}` : "")}>{brief ? "Actualiser la fiche" : "Rechercher des faits"}</Btn>
                <Btn size="sm" variant="ghost" icon={Plus} onClick={() => setSrc((x) => ({ ...x, open: !x.open }))}>Coller une source</Btn>
              </div>
              {src.open && (
                <div className={`rounded-2xl p-3 mt-2 space-y-2 ${T.sub}`}>
                  <Input value={src.url} onChange={(e) => setSrc({ ...src, url: e.target.value })} placeholder="URL de la source (obligatoire)" aria-label="URL de la source" />
                  <Textarea rows={5} value={src.text} onChange={(e) => setSrc({ ...src, text: e.target.value })} placeholder="Collez le texte : page « À propos », rapport annuel, article, post LinkedIn de l'entreprise…" aria-label="Texte de la source" />
                  <Btn size="sm" variant="primary" icon={Wand2} loading={!!busy[bKey]} disabled={!isHttp(src.url) || src.text.trim().length < 80} onClick={async () => { const r = await addManualBrief(company, src.url.trim(), src.text); if (r) setSrc({ open: false, url: "", text: "" }); }}>Extraire les faits</Btn>
                </div>
              )}
            </FieldBox>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {company && <Field label={`Pourquoi ${company} ?`} hint="Votre lien réel avec un fait retenu."><Textarea rows={3} value={m.whyCompany} onChange={(e) => set({ whyCompany: e.target.value })} /></Field>}
            <Field label="Pourquoi ce rôle, maintenant ?" hint={bank.whyNow ? `Par défaut : « ${bank.whyNow.slice(0, 80)}${bank.whyNow.length > 80 ? "…" : ""} »` : "Rien dans vos Motivations."}><Textarea rows={3} value={m.whyRole} onChange={(e) => set({ whyRole: e.target.value })} /></Field>
            {company && <Field label="Lien personnel (facultatif)" hint="Client, utilisateur, rencontre, secteur…"><Textarea rows={2} value={m.personalLink} onChange={(e) => set({ personalLink: e.target.value })} /></Field>}
            <Field label="Conviction à mettre en avant">
              <Select value={m.convictionId || ""} onChange={(e) => set({ convictionId: e.target.value || null })} className="w-full">
                <option value="">{bank.convictions.length ? "Au choix de l'IA" : "Aucune conviction renseignée"}</option>
                {bank.convictions.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.text.slice(0, 70)}</option>)}
              </Select>
            </Field>
            <Field label="Histoire à raconter">
              <Select value={m.storyId || ""} onChange={(e) => set({ storyId: e.target.value || null })} className="w-full">
                <option value="">{bank.stories.length ? "Au choix de l'IA" : "Banque d'histoires vide"}</option>
                {bank.stories.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.title || x.situation.slice(0, 60)}</option>)}
              </Select>
            </Field>
          </div>
          {missing.length > 0 && (
            <Notice tone="warn" icon={AlertTriangle}>
              Manquant : {missing.join(" · ")}. La lettre écrira [à compléter] à ces endroits.{" "}
              {(!bank.convictions.length || !bank.stories.length) && <button type="button" className="underline underline-offset-4" onClick={() => go("profile")}>Compléter mes Motivations</button>}
            </Notice>
          )}
        </>
      )}
    </Card>
  );
}

function StudioSetup({ app, offer, type, onDone, onCancel }) {
  const T = useT();
  const { generateDocs, busy, genStatus, setOfferAdText, patchOfferNow, profile, go } = useApp();
  const first = !Object.keys(app.docs || {}).length;
  const spont = offer?.spontaneous;
  const [prefs, setPrefs] = useState({ ...DEFAULT_DOC_PREFS, ...(app.docPrefs || {}) });
  const [types, setTypes] = useState(first ? (spont === "base" ? ["cv"] : spont ? ["cv", "letter", "linkedin", "email"] : DOC_TYPES.map((d) => d.id)) : [type]);
  const [tgt, setTgt] = useState({ title: offer?.title || "", company: offer?.company || "", contactName: offer?.contactName || "", location: offer?.location || "" });
  const commitTgt = () => {
    const patch = {};
    for (const k of Object.keys(tgt)) { const v = str(tgt[k]); if ((v || null) !== (offer?.[k] || null)) patch[k] = v; }
    if (patch.title === null) delete patch.title;
    if (Object.keys(patch).length) patchOfferNow(offer.id, patch);
  };
  const [instruction, setInstruction] = useState("");
  const [ad, setAd] = useState(adTextOf(offer));
  const loading = !!busy[`dossier:${app.id}`];
  const toggle = (t) => setTypes((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]));
  const P2 = (k, v) => setPrefs((p) => ({ ...p, [k]: v }));
  const weakProfile = !profile.name || (profile.achievements || []).some((a) => /\[à compléter/i.test(a)) || !(profile.cvText || "").trim();
  const run = async () => {
    if (spont) commitTgt();
    if ((ad.trim() || spont) && ad.trim() !== adTextOf(offer)) setOfferAdText(offer.id, ad);
    const ok = await generateDocs(app.id, types, instruction.trim(), prefs);
    if (ok) onDone?.();
  };
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {spont ? (
          <Card className="p-6 lg:col-span-3 space-y-4">
            <div>
              <div className="text-lg font-medium tracking-tight">{SPONT_LABEL[spont]}</div>
              <p className={`text-sm mt-1 ${T.muted}`}>Aucune offre : l'IA déduit les attentes du rôle visé et les mots-clés habituels des annonces belges, puis les confronte à votre profil. {spont === "base" ? "Le document reste réutilisable : aucune entreprise n'est citée." : "Le contexte ci-dessous est la seule source d'information sur l'entreprise : rien n'est inventé."}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Rôle visé"><Input value={tgt.title} onChange={(e) => setTgt((x) => ({ ...x, title: e.target.value }))} onBlur={commitTgt} placeholder="Ex. Head of Digital" /></Field>
              {spont !== "base" && <Field label="Entreprise ciblée"><Input value={tgt.company} onChange={(e) => setTgt((x) => ({ ...x, company: e.target.value }))} onBlur={commitTgt} /></Field>}
              {spont !== "base" && <Field label="Interlocuteur (facultatif)"><Input value={tgt.contactName} onChange={(e) => setTgt((x) => ({ ...x, contactName: e.target.value }))} onBlur={commitTgt} placeholder="Ex. Mme Anne Dupont, CIO" /></Field>}
              <Field label="Lieu (facultatif)"><Input value={tgt.location} onChange={(e) => setTgt((x) => ({ ...x, location: e.target.value }))} onBlur={commitTgt} /></Field>
            </div>
            <Field label={spont === "base" ? "Contexte (facultatif)" : "Pourquoi cette entreprise ? (recommandé)"} hint={spont === "base" ? "Secteurs ou types d'organisations visés, ce que vous voulez mettre en avant." : "Activité, projets, actualité, enjeux digitaux, valeurs, lien avec vous."}>
              <Textarea rows={10} value={ad} onChange={(e) => setAd(e.target.value)} onBlur={() => { if (ad.trim() !== adTextOf(offer)) setOfferAdText(offer.id, ad); }} />
            </Field>
          </Card>
        ) : (
        <Card className="p-6 lg:col-span-3 space-y-4">
          <div>
            <div className="text-lg font-medium tracking-tight">Annonce source</div>
            <p className={`text-sm mt-1 ${T.muted}`}>L'IA en extrait l'intitulé exact, 20 à 35 mots-clés ATS et les exigences clés, puis les confronte à votre profil avant d'écrire. Plus le texte est complet, meilleure est la couverture.</p>
          </div>
          {!offer?.fullText && <Notice tone="warn" icon={AlertTriangle}>Seul un résumé de l'annonce est enregistré. Collez le texte complet (missions, profil, compétences, conditions).</Notice>}
          <Textarea rows={18} value={ad} onChange={(e) => setAd(e.target.value)} onBlur={() => { if (ad.trim() && ad.trim() !== adTextOf(offer)) setOfferAdText(offer.id, ad); }} aria-label="Texte complet de l'annonce" placeholder="Collez ici l'annonce complète…" />
          <div className={`text-xs ${T.faint}`}>{ad.length} caractères{offer?.sources?.[0]?.url ? <> · <ExtLink href={offer.sources[0].url}>ouvrir l'annonce</ExtLink></> : null}</div>
        </Card>
        )}
        <AppMotivationCard app={app} offer={offer} types={types} />
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6 space-y-4">
            <div className="text-lg font-medium tracking-tight">Réglages</div>
            <FieldBox label="Documents à générer">
              <div className="flex flex-wrap gap-1.5">
                {DOC_TYPES.map((d) => (
                  <button key={d.id} type="button" aria-pressed={types.includes(d.id)} onClick={() => toggle(d.id)} className={`text-xs rounded-full px-3 py-1.5 font-medium transition-colors ${types.includes(d.id) ? "bg-indigo-600 text-white" : `${T.chip} ${T.subHover}`} ${T.ring}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </FieldBox>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Langue">
                <Select value={prefs.language} onChange={(e) => P2("language", e.target.value)} className="w-full">
                  <option value="auto">{spont ? "Celle choisie pour la cible" : "Celle de l'annonce"}</option><option value="fr">Français</option><option value="nl">Néerlandais</option><option value="en">Anglais</option><option value="de">Allemand</option>
                </Select>
              </Field>
              <Field label="Ton">
                <Select value={prefs.tone} onChange={(e) => P2("tone", e.target.value)} className="w-full">
                  <option value="sobre">Sobre et factuel</option><option value="direct">Direct</option><option value="chaleureux">Chaleureux</option>
                </Select>
              </Field>
              <Field label="Profil du CV rédigé">
                <Select value={prefs.voice} onChange={(e) => P2("voice", e.target.value)} className="w-full">
                  <option value="nominal">Sans « je » (style CV)</option><option value="je">À la 1re personne</option>
                </Select>
              </Field>
              <Field label="Longueur du CV">
                <Select value={prefs.cvLength} onChange={(e) => P2("cvLength", e.target.value)} className="w-full">
                  <option value="2">1 à 2 pages</option><option value="1">1 page</option>
                </Select>
              </Field>
            </div>
            <Field label="Consigne (facultatif)">
              <Textarea rows={3} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Ex. mettre en avant le pilotage d'équipe et l'automatisation ; citer le projet de migration CRM…" />
            </Field>
            {weakProfile && (
              <Notice tone="warn" icon={Info}>
                Votre profil est la seule source de faits : complétez nom, réalisations chiffrées et CV complet pour un résultat précis.{" "}
                <button type="button" className="underline underline-offset-4" onClick={() => { onCancel?.(true); go("profile"); }}>Compléter le profil</button>
              </Notice>
            )}
            <div className="flex flex-wrap gap-2">
              <Btn variant="primary" size="lg" icon={Sparkles} loading={loading} disabled={!types.length || (spont ? !tgt.title.trim() : ad.trim().length < 40)} onClick={run}>{first ? "Générer le dossier" : "Générer une nouvelle version"}</Btn>
              {onCancel && !first && <Btn variant="ghost" size="lg" onClick={() => onCancel()} disabled={loading}>Annuler</Btn>}
            </div>
          </Card>
          {loading && <GenSteps st={genStatus[app.id]} />}
          {!loading && (
            <div className={`text-xs space-y-1 ${T.muted}`}>
              <div className="flex gap-2"><Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${T.accentText}`} aria-hidden="true" />Rédaction en 3 étapes : analyse {spont ? "du rôle visé" : "de l'annonce"}, rédaction, contrôle qualité avec corrections ciblées.</div>
              <div className="flex gap-2"><Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${T.accentText}`} aria-hidden="true" />Votre fonction réelle sous votre nom ; le poste visé cité comme objectif, jamais comme acquis.</div>
              <div className="flex gap-2"><Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${T.accentText}`} aria-hidden="true" />Aucun chiffre inventé : les manques sont marqués [à compléter].</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Studio ── */
function StudioBar({ offer, type, setType, onClose, children }) {
  const T = useT();
  return (
    <header className={`flex items-center gap-2 px-3 sm:px-4 h-14 border-b shrink-0 overflow-x-auto ${T.line}`}>
      <IconBtn icon={X} label="Fermer le studio (Échap)" onClick={onClose} className="shrink-0" />
      <div className="min-w-0 hidden lg:block" style={{ maxWidth: 210 }}>
        <div className="text-sm font-medium truncate">{offer?.title || "Candidature"}</div>
        <div className={`text-xs truncate ${T.muted}`}>{offer?.spontaneous === "base" ? "CV de base · sans entreprise" : offer?.spontaneous ? `${show(offer.company)} · spontanée` : show(offer?.company)}</div>
      </div>
      <div className="shrink-0"><Tabs compact value={type} onChange={setType} tabs={[{ id: "cv", label: "CV" }, { id: "letter", label: "Lettre" }]} /></div>
      {children}
    </header>
  );
}

function DocStudio({ appId, type, setType, onClose }) {
  const T = useT();
  const { allApps: apps, offers } = useApp();
  const ref = useRef(null);
  const flushRef = useRef(null);
  const closeRef = useRef(null);
  closeRef.current = () => { flushRef.current?.(); onClose(); };
  useFocusTrap(true, ref, () => closeRef.current());
  /* Disposition partagée entre CV et lettre (le changement de document ne la réinitialise pas). */
  const [ui, setUi] = useState(() => ({ layout: "split", pane: "edit", tab: "checks", panelMode: "optim", zoomMode: "fit", panelOpen: typeof window !== "undefined" && !!window.matchMedia?.("(min-width: 1536px)").matches }));
  const app = apps.find((a) => a.id === appId);
  const offer = offers.find((o) => o.id === app?.offerId);
  const close = () => closeRef.current();
  if (!app || !offer) {
    return (
      <div ref={ref} className={`fixed inset-0 z-50 flex flex-col ${T.app}`} role="dialog" aria-modal="true" aria-label="Studio CV et lettre">
        <StudioBar offer={offer} type={type} setType={setType} onClose={close} />
        <Empty icon={AlertTriangle} title="Candidature ou offre introuvable" text="Elle a peut-être été supprimée." action={<Btn onClick={close}>Fermer</Btn>} />
      </div>
    );
  }
  const has = (app.docs?.[type] || []).length > 0;
  return (
    <div ref={ref} className={`fixed inset-0 z-50 flex flex-col ${T.app}`} role="dialog" aria-modal="true" aria-label="Studio CV et lettre" style={{ fontFamily: FONT }}>
      {has
        ? <StudioWorkspace key={`${app.id}-${type}`} app={app} offer={offer} type={type} setType={setType} onClose={close} flushRef={flushRef} ui={ui} setUi={setUi} />
        : (
          <>
            <StudioBar offer={offer} type={type} setType={setType} onClose={close} />
            <StudioSetup app={app} offer={offer} type={type} onCancel={(leave) => { if (leave) onClose(); else setType(type === "cv" ? "letter" : "cv"); }} />
          </>
        )}
    </div>
  );
}

function StudioWorkspace({ app, offer, type, setType, onClose, flushRef, ui, setUi }) {
  const T = useT();
  const { saveDocVersion, saveDocDraft, settings, profile, busy, docAI, toast, declareSkill, genStatus, briefs, media, patchApp, translateDoc } = useApp();
  const wide = useMedia("(min-width: 1024px)");
  const versions = app.docs?.[type] || [];
  const [idx, setIdx] = useState(versions.length - 1);
  useEffect(() => { setIdx(versions.length - 1); }, [versions.length]);
  const v = versions[clamp(idx, 0, versions.length - 1)];
  const lang = v.language || app.docLanguage || offer?.language || "fr";
  const prefs = { ...DEFAULT_DOC_PREFS, ...(app.docPrefs || {}) };
  const baseline = useMemo(() => normalizeDoc(v.text, type, lang), [v.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickDraft = () => { const d = app.drafts?.[type]; return d && d.baseId === v.id && d.text !== baseline ? d : null; };
  const [model, setModel] = useState(() => docToModel(pickDraft()?.text ?? baseline, type));
  const [accent, setAccent] = useState(() => cleanHex(pickDraft()?.accent ?? v.accent));
  const [restoredAt, setRestoredAt] = useState(() => pickDraft()?.at || null);
  const text = useMemo(() => modelToDoc(model, type, lang), [model, type, lang]);
  const dirty = text !== baseline || accent !== cleanHex(v.accent);

  /* Design (modèle, couleurs, colonnes, photo) : propre à la candidature, commun au CV et à la lettre. L'accent reste celui de la version. */
  const [designOwn, setDesignOwn] = useState(() => app.design || null);
  const design = useMemo(() => designWithAccent({ design: designOwn }, settings, accent), [designOwn, settings.designDefault, accent]); // eslint-disable-line react-hooks/exhaustive-deps
  const setDesign = (d) => {
    if (cleanHex(d.colors?.accent) !== cleanHex(accent)) setAccent(cleanHex(d.colors.accent));
    setDesignOwn(d);
  };
  const designSaved = useRef(app.design || null);
  const flushDesign = () => { if (designOwn && designOwn !== designSaved.current) { designSaved.current = designOwn; patchApp(app.id, (a) => ({ ...a, design: designOwn })); } };
  useEffect(() => { const t = setTimeout(flushDesign, 600); return () => clearTimeout(t); }, [designOwn]); // eslint-disable-line react-hooks/exhaustive-deps
  const photo = media?.photo || null;
  const [photoOpen, setPhotoOpen] = useState(false);
  const dModel = useMemo(() => designModel(text, type), [text, type]);

  /* Historique (annuler / rétablir) : un instantané après chaque pause de frappe ou action de l'IA. */
  const hist = useRef({ list: [text], pos: 0 });
  const [, setHistTick] = useState(0);
  useEffect(() => {
    const h = hist.current;
    if (h.list[h.pos] === text) return undefined;
    const t = setTimeout(() => {
      if (h.list[h.pos] === text) return;
      h.list = [...h.list.slice(0, h.pos + 1), text].slice(-80);
      h.pos = h.list.length - 1;
      setHistTick((x) => x + 1);
    }, 700);
    return () => clearTimeout(t);
  }, [text]);
  const pushNow = () => { const h = hist.current; if (h.list[h.pos] !== text) { h.list = [...h.list.slice(0, h.pos + 1), text]; h.pos = h.list.length - 1; } };
  const replaceText = (nt) => {
    pushNow();
    const m = docToModel(nt, type);
    const norm = modelToDoc(m, type, lang);
    const h = hist.current;
    h.list = [...h.list.slice(0, h.pos + 1), norm].slice(-80);
    h.pos = h.list.length - 1;
    setModel(m);
    setHistTick((x) => x + 1);
  };
  const undo = () => { pushNow(); const h = hist.current; if (h.pos > 0) { h.pos--; setModel(docToModel(h.list[h.pos], type)); setHistTick((x) => x + 1); } };
  const redo = () => { const h = hist.current; if (h.pos < h.list.length - 1) { h.pos++; setModel(docToModel(h.list[h.pos], type)); setHistTick((x) => x + 1); } };
  const canUndo = hist.current.pos > 0 || hist.current.list[hist.current.pos] !== text;
  const canRedo = hist.current.pos < hist.current.list.length - 1;

  /* Changement de version (sélecteur, nouvelle génération) : recharge, sauf si le texte est déjà celui-là (enregistrement). */
  const lastV = useRef(v.id);
  useEffect(() => {
    if (lastV.current === v.id) return;
    lastV.current = v.id;
    setProposals([]); setSecProp(null); setReview(null);
    if (baseline === text) return;
    const d = pickDraft();
    setModel(docToModel(d?.text ?? baseline, type));
    setAccent(cleanHex(d?.accent ?? v.accent));
    setRestoredAt(d?.at || null);
    hist.current = { list: [d?.text ?? baseline], pos: 0 };
  }, [v.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Brouillon enregistré automatiquement (rien n'est perdu en fermant le studio). */
  useEffect(() => {
    const t = setTimeout(() => {
      const d = app.drafts?.[type];
      if (dirty) { if (!d || d.text !== text || d.accent !== accent || d.baseId !== v.id) saveDocDraft(app.id, type, { text, accent, baseId: v.id }); }
      else if (d && d.baseId === v.id) saveDocDraft(app.id, type, null);
    }, 1200);
    return () => clearTimeout(t);
  }, [text, accent, dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  flushRef.current = () => { flushDesign(); if (dirty) saveDocDraft(app.id, type, { text, accent, baseId: v.id }); };

  const save = () => {
    if (!dirty) return;
    saveDocVersion(app.id, type, text, undefined, { accent, accentSource: accent !== cleanHex(v.accent) ? "choisie" : v.accentSource, language: lang, format: "markup" });
    setRestoredAt(null);
    toast("Version enregistrée", "ok");
  };
  const discardDraft = () => { setModel(docToModel(baseline, type)); setAccent(cleanHex(v.accent)); setRestoredAt(null); saveDocDraft(app.id, type, null); };

  /* Disposition */
  const uiSet = (k) => (v) => setUi((u) => ({ ...u, [k]: typeof v === "function" ? v(u[k]) : v }));
  const { layout, pane, panelOpen, tab, zoomMode } = ui;
  const setLayout = uiSet("layout"), setPane = uiSet("pane"), setPanelOpen = uiSet("panelOpen"), setTab = uiSet("tab"), setZoomMode = uiSet("zoomMode");
  const showEditor = wide ? layout !== "preview" : pane === "edit";
  const showPreview = wide ? layout !== "edit" : pane === "preview";
  const showPanel = wide ? panelOpen : pane === "panel" || pane === "design";
  const panelMode = wide ? ui.panelMode || "optim" : pane === "design" ? "design" : "optim";
  const togglePanel = (mode) => setUi((u) => ({ ...u, panelOpen: !(u.panelOpen && (u.panelMode || "optim") === mode), panelMode: mode }));
  const openDesign = () => { if (wide) setUi((u) => ({ ...u, panelOpen: true, panelMode: "design" })); else setPane("design"); };

  /* Aperçu : zoom ajusté à la largeur */
  const [fitZoom, setFitZoom] = useState(0.8);
  const prevRef = useRef(null);
  useEffect(() => {
    const el = prevRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setFitZoom(clamp((el.clientWidth - 48) / ((PAGE_SIZES[design.page] || PAGE_SIZES.a4)[0] * MM), 0.3, 1.2)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [showPreview, design.page]);
  const zoom = zoomMode === "fit" ? fitZoom : Number(zoomMode);
  const [pages, setPages] = useState(null);

  /* Contrôle qualité en direct */
  const report = useMemo(
    () => analyzeDoc(text, type, lintCtx({ offer, analysis: app.analysis, prefs, lang, settings, profile, pages, fallbackKeywords: v.keywords, cvText: type === "letter" ? latestCvText(app) : "", app, briefs })),
    [text, type, pages, app.analysis, app.motivation, briefs, prefs.voice, profile.headline, profile.motivation, lang, type === "letter" ? latestCvText(app) : ""], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const missing = report.kw.filter((k) => k.status !== "absent" && !k.found);

  /* Navigation éditeur ⇄ aperçu */
  const [flash, setFlash] = useState(null);
  const goTo = (sec) => {
    if (sec === undefined || sec === null) return;
    if (!wide) setPane("edit"); else if (layout === "preview") setLayout("split");
    const id = sec === "head" ? "studio-sec-head" : sec === "sign" ? "studio-sec-sign" : `studio-sec-${sec}`;
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
    setFlash(sec);
    setTimeout(() => setFlash((f) => (f === sec ? null : f)), 1600);
  };

  /* Modèle */
  const setHead = (patch) => setModel((m) => ({ ...m, ...patch }));
  const setSection = (id, s) => setModel((m) => ({ ...m, sections: m.sections.map((x) => (x.id === id ? s : x)) }));
  const moveSection = (i, d) => setModel((m) => ({ ...m, sections: moveIn(m.sections, i, d) }));
  const reorderSection = (from, to) => { pushNow(); setModel((m) => { const l = [...m.sections]; const [s] = l.splice(from, 1); l.splice(to, 0, s); return { ...m, sections: l }; }); };
  const removeSection = (id) => setModel((m) => ({ ...m, sections: m.sections.filter((x) => x.id !== id) }));
  const addSection = (title, kind) => { const s = newSection(title, kind); setModel((m) => ({ ...m, sections: [...m.sections, s] })); setTimeout(() => goTo(model.sections.length), 60); };

  /* IA : propositions à valider */
  const [proposals, setProposals] = useState([]);
  const [review, setReview] = useState(null);
  const [secProp, setSecProp] = useState(null);
  const [secBusy, setSecBusy] = useState(null);
  const [hlOpts, setHlOpts] = useState([]);
  const addProposals = (edits, source) => {
    const list = (Array.isArray(edits) ? edits : [])
      .filter((e) => e && typeof e.before === "string" && typeof e.after === "string" && e.before.trim() && e.before !== e.after && !touchesLocked(e.before, lockedOf(profile)))
      .map((e) => ({ id: uid("p"), before: e.before, after: e.after, reason: str(e.reason), severity: ["haute", "moyenne", "basse"].includes(e.severity) ? e.severity : null, source, status: "pending" }));
    setProposals((l) => [...list, ...l.filter((x) => x.status === "pending")]);
    return list.length;
  };
  const fix = async (issues, source = "contrôle") => {
    const d = await docAI(app.id, "fix", { kind: type, text, issues });
    if (!d) return;
    const n = addProposals(d.edits, source);
    if (n) { setTab("ai"); if (!wide) setPane("panel"); else setPanelOpen(true); }
    toast(n ? `${n} proposition(s) à valider` : "Aucune correction proposée", n ? "ok" : "neutral");
  };
  const integrate = (kws) => fix(kws.map((k) => ({ title: `Intégrer le mot-clé « ${k.term} »`, detail: k.evidence ? `preuve dans le profil : ${k.evidence}` : "justifié par le profil" })), "mots-clés");
  const runReview = async () => {
    const d = await docAI(app.id, "review", { kind: type, text });
    if (!d) return;
    setReview({ verdict: str(d.verdict), score: Number.isFinite(Number(d.score)) && d.score !== null ? clamp(Math.round(Number(d.score)), 0, 100) : null, strengths: (Array.isArray(d.strengths) ? d.strengths : []).map(String).slice(0, 4) });
    const n = addProposals(d.edits, "relecture");
    toast(`Relecture terminée${n ? ` · ${n} proposition(s)` : ""}`, "ok");
  };
  const applyProposal = (p) => {
    const nt = applyEdit(text, p.before, p.after);
    if (nt === null) { toast("Passage introuvable : le texte a changé depuis la proposition.", "warn"); return; }
    replaceText(nt);
    setProposals((l) => l.map((x) => (x.id === p.id ? { ...x, status: "applied" } : x)));
  };
  const applyAll = () => {
    let t = text;
    const ok = new Set();
    for (const p of proposals.filter((x) => x.status === "pending")) { const nt = applyEdit(t, p.before, p.after); if (nt !== null) { t = nt; ok.add(p.id); } }
    if (ok.size) replaceText(t);
    setProposals((l) => l.map((x) => (x.status === "pending" && ok.has(x.id) ? { ...x, status: "applied" } : x)));
    toast(`${ok.size} correction(s) appliquée(s)${ok.size < proposals.filter((x) => x.status === "pending").length ? " · certaines n'ont plus de correspondance" : ""}`, "ok");
  };
  const improveSection = async (s, goal, custom) => {
    const body = sectionToLines(s, lang).join("\n").trim();
    setSecBusy(s.id);
    try {
      const d = await docAI(app.id, "section", { kind: type, text, title: s.title, body, goal, custom, missing, lang });
      const nb = String(d?.body || "").replace(/^```\w*\n?|```\s*$/g, "").split("\n").filter((l) => !/^##\s/.test(l.trim())).join("\n").trim();
      if (nb) setSecProp({ secId: s.id, body: nb, before: body, note: str(d.note) });
    } finally { setSecBusy(null); }
  };
  const acceptSec = () => {
    pushNow();
    setModel((m) => ({ ...m, sections: m.sections.map((x) => (x.id === secProp.secId ? { ...sectionFromLines(x.title, secProp.body.split("\n")), id: x.id } : x)) }));
    setSecProp(null);
  };
  const headlineFix = app.analysis?.positioning?.headline || [profile.headline, (profile.skills || []).slice(0, 3).join(" · ")].filter(Boolean).join(" | ");
  const proposeHeadlines = async () => {
    const d = await docAI(app.id, "headlines", { lang });
    const opts = (Array.isArray(d?.options) ? d.options : []).map((o) => ({ headline: str(o?.headline), angle: str(o?.angle) })).filter((o) => o.headline);
    setHlOpts(opts);
    if (!opts.length && d) toast("Aucune proposition reçue", "neutral");
  };

  /* PDF */
  const [pdfBusy, setPdfBusy] = useState(false);
  const docMeta = () => ({
    title: [type === "cv" ? "CV" : "Lettre de motivation", profile.name, offer?.title, offer?.company].filter(Boolean).join(" - "),
    author: profile.name, subject: type === "cv" ? "Curriculum vitae" : "Lettre de motivation",
    keywords: (app.analysis?.keywords || v.keywords || []).map((k) => (typeof k === "string" ? k : k?.term)).filter(Boolean).slice(0, 30),
  });
  const fileBase = () => `${type === "cv" ? "CV" : "Lettre"}_${slugFile(profile.name || "candidat")}_${slugFile(offer?.company || offer?.title)}_${lang.toUpperCase()}`;
  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const meta = docMeta();
      const data = await buildPdf([{ layout: layoutDocument(designModel(text, type), design, { photo, lang }), photo, title: meta.title }], meta);
      const r = await saveFile(`${fileBase()}.pdf`, data, "application/pdf");
      if (r === "saved") toast(report.blockers ? "PDF prêt — attention, des points restent à corriger" : "PDF prêt", report.blockers ? "warn" : "ok");
    } catch (e) {
      toast(`PDF impossible : ${e.message}`, "danger");
    } finally { setPdfBusy(false); }
  };
  const downloadWord = async () => {
    try {
      const meta = docMeta();
      const data = buildDocx([{ text, kind: type, lang, design }], { photo, ...meta, mode: "design" });
      const r = await saveFile(`${fileBase()}.docx`, data, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      if (r === "saved") toast("Document Word prêt (styles Titre lus par les ATS)", "ok");
    } catch (e) {
      toast(`Word impossible : ${e.message}`, "danger");
    }
  };
  const [exportOpen, setExportOpen] = useState(false);
  /* Langues : bascule vers la dernière version d'une langue, ou traduction de la version affichée (nouvelle version). */
  const langsHere = docLangs(app, offer, type);
  const trBusy = DOC_LANGS.find((l) => busy[`tr:${app.id}:${type}:${l}`]);
  const switchLang = async (l) => {
    if (!l || l === lang) return;
    if (langsHere.includes(l)) { const lv = latestDoc(app, offer, type, l); setIdx(versions.findIndex((x) => x.id === lv.id)); return; }
    if (dirty) save();
    const nv = await translateDoc(app.id, type, lang, l, text);
    if (nv) toast(`Version ${LANG_FLAG[l]} prête : relisez-la avant l'envoi`, "ok");
  };

  /* Raccourcis : ⌘/Ctrl+S enregistre, ⌘/Ctrl+Z hors champ annule */
  const keys = useRef({});
  keys.current = { save, undo, redo };
  useEffect(() => {
    const h = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "s") { e.preventDefault(); keys.current.save(); return; }
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return;
      if (k === "z" && !e.shiftKey) { e.preventDefault(); keys.current.undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); keys.current.redo(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const [setupOpen, setSetupOpen] = useState(false);
  const gen = genStatus[app.id];
  const isMarkup = v.format === "markup";
  const api = {
    goTo, fix, integrate, proposals, review, runReview, applyProposal, applyAll, tab, setTab, tips: v.tips,
    ignoreProposal: (id) => setProposals((l) => l.filter((x) => x.id !== id)),
    ignoreAll: () => setProposals((l) => l.filter((x) => x.status !== "pending")),
    declare: (term) => declareSkill(app.id, term),
    busyFix: !!busy[`docai:${app.id}:fix`], busyReview: !!busy[`docai:${app.id}:review`],
    headlineFix: type === "cv" ? headlineFix : null,
    applyHeadlineFix: () => { pushNow(); setHead({ headline: headlineFix }); },
  };
  const presetTitles = PRESETS[lang] || PRESETS.fr;
  const outline = [{ sec: "head", label: "En-tête" }, ...model.sections.map((s, i) => ({ sec: i, label: s.title || "Introduction" }))];

  return (
    <>
      <StudioBar offer={offer} type={type} setType={(t) => { flushRef.current?.(); setType(t); }} onClose={onClose}>
        <Select value={clamp(idx, 0, versions.length - 1)} onChange={(e) => setIdx(Number(e.target.value))} aria-label="Version" className="h-8 text-xs hidden sm:block shrink-0" style={{ maxWidth: 190 }}>
          {versions.map((x, i) => <option key={x.id} value={i}>v{i + 1} · {LANG_FLAG[docLangOf(app, offer, x)] || ""} · {x.origin} · {fmtDate(x.createdAt, { time: true })}</option>)}
        </Select>
        <Select value={trBusy ? `tr:${trBusy}` : lang} onChange={(e) => switchLang(e.target.value)} disabled={!!trBusy} aria-label="Langue du document" className="h-8 text-xs shrink-0" style={{ maxWidth: 132 }} title="Changer de langue ou traduire">
          {trBusy && <option value={`tr:${trBusy}`}>Traduction {LANG_FLAG[trBusy]}…</option>}
          {DOC_LANGS.filter((l) => langsHere.includes(l) || l === lang).map((l) => <option key={l} value={l}>{LANG_FLAG[l]} · {LANG_NAME[l]}</option>)}
          {DOC_LANGS.filter((l) => !langsHere.includes(l) && l !== lang).map((l) => <option key={l} value={l}>Traduire en {LANG_NAME[l]}…</option>)}
        </Select>
        <span className="hidden 2xl:inline-flex shrink-0 whitespace-nowrap">{dirty ? <Chip tone="warn">brouillon auto-enregistré</Chip> : <Chip tone="ok">version enregistrée</Chip>}</span>
        <div className="flex-1" />
        <span className="hidden sm:inline-flex shrink-0">
          <MiniBtn icon={Undo2} label="Annuler (⌘Z)" onClick={undo} disabled={!canUndo} />
          <MiniBtn icon={Redo2} label="Rétablir (⇧⌘Z)" onClick={redo} disabled={!canRedo} />
        </span>
        {wide && <div className="shrink-0"><Tabs compact value={layout} onChange={setLayout} tabs={[{ id: "edit", label: "Édition" }, { id: "split", label: "Côte à côte" }, { id: "preview", label: "Aperçu" }]} /></div>}
        <Btn size="sm" variant="ghost" icon={RefreshCw} onClick={() => setSetupOpen(true)} aria-label="Régénérer" title="Nouvelle version générée par l'IA"><span className="hidden 2xl:inline">Régénérer</span></Btn>
        <Btn size="sm" variant={dirty ? "primary" : "soft"} icon={Save} disabled={!dirty} onClick={save} aria-label="Enregistrer une version (⌘S)" title="Enregistrer une version (⌘S)"><span className="hidden lg:inline">Enregistrer</span></Btn>
        <Btn size="sm" icon={Download} loading={pdfBusy} onClick={downloadPdf} aria-label="Télécharger le PDF"><span className="hidden lg:inline">PDF</span></Btn>
        <Btn size="sm" variant="ghost" icon={FileDown} onClick={downloadWord} aria-label="Télécharger en Word (.docx)" title="Word (.docx) modifiable"><span className="hidden 2xl:inline">Word</span></Btn>
        <Btn size="sm" variant="ghost" icon={Languages} onClick={() => setExportOpen(true)} aria-label="Exporter le dossier (langues, PDF/Word, fusion)" title="CV + lettre, plusieurs langues, PDF ou Word, fichier unique ou ZIP"><span className="hidden 2xl:inline">Exporter</span></Btn>
        {wide && <button
          type="button"
          onClick={() => togglePanel("design")}
          aria-pressed={panelOpen && panelMode === "design"}
          title="Design : modèles, couleurs, colonnes, marges, photo"
          className={`shrink-0 inline-flex items-center gap-1.5 h-8 rounded-xl px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${panelOpen && panelMode === "design" ? T.accentSoft : T.btnSoft} ${T.ring}`}
        >
          <Palette className="w-3.5 h-3.5" aria-hidden="true" /><span className="hidden 2xl:inline">Design</span>
        </button>}
        {wide && <button
          type="button"
          onClick={() => togglePanel("optim")}
          aria-pressed={panelOpen && panelMode === "optim"}
          title={panelOpen && panelMode === "optim" ? "Masquer le panneau d'optimisation" : "Afficher le panneau d'optimisation"}
          className={`shrink-0 inline-flex items-center gap-1.5 h-8 rounded-xl px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${panelOpen && panelMode === "optim" ? T.accentSoft : T.btnSoft} ${T.ring}`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="tabular-nums">{report.scores.total}/100</span>
          {report.blockers > 0 && <span className="rounded-full px-1.5 bg-rose-500 text-white tabular-nums">{report.blockers}</span>}
        </button>}
      </StudioBar>
      {gen && !setupOpen && <div className={`px-4 py-2 text-xs flex items-center gap-2 ${T.accentSoft}`}><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />{gen.label}</div>}

      <div className="flex-1 flex min-h-0 relative">
        {showEditor && (
          <div className="min-w-0 overflow-y-auto" style={wide && layout === "split" ? { flex: "1 1 0", minWidth: 380, maxWidth: 760 } : { flex: "1 1 auto" }}>
            <div className={`sticky top-0 z-10 px-4 sm:px-6 py-2 border-b ${T.line}`} style={T.glass}>
              <div className="flex gap-1 overflow-x-auto" role="navigation" aria-label="Sections du document">
                {outline.map((o) => (
                  <button key={String(o.sec)} type="button" onClick={() => goTo(o.sec)} className={`shrink-0 text-xs rounded-full px-2.5 py-1 whitespace-nowrap ${flash === o.sec ? T.accentSoft : `${T.muted} ${T.subHover}`} ${T.ring}`}>{o.label}</button>
                ))}
              </div>
            </div>
            <div className="mx-auto px-4 sm:px-6 py-6 space-y-4" style={{ maxWidth: wide && layout === "edit" ? 880 : 780 }}>
              {restoredAt && (
                <Notice tone="accent" icon={History}>
                  Brouillon non enregistré restauré ({relTime(restoredAt)}).{" "}
                  <button type="button" className="underline underline-offset-4" onClick={discardDraft}>Revenir à la version enregistrée</button>
                </Notice>
              )}
              {!isMarkup && <Notice tone="warn" icon={Info}>Ancien format de document : régénérez-le pour profiter de la mise en page, de l'analyse ATS et des contrôles.</Notice>}
              <HeaderCard model={model} set={setHead} kind={type} lang={lang} analysis={app.analysis} onHeadlines={proposeHeadlines} hlBusy={!!busy[`docai:${app.id}:headlines`]} hlOpts={hlOpts} flash={flash === "head"} />
              {model.sections.map((s, i) => (
                <SectionCard
                  key={s.id} s={s} idx={i} count={model.sections.length} kind={type}
                  onChange={(ns) => setSection(s.id, ns)}
                  onMove={(d) => moveSection(i, d)}
                  onRemove={() => { pushNow(); removeSection(s.id); }}
                  onAI={(goal, custom) => improveSection(s, goal, custom)}
                  aiBusy={secBusy === s.id}
                  proposal={secProp?.secId === s.id ? secProp : null}
                  onAccept={acceptSec}
                  onReject={() => setSecProp(null)}
                  flash={flash === i}
                  missingCount={missing.length}
                  spont={!!offer?.spontaneous}
                />
              ))}
              {type === "cv" ? (
                <div className={`rounded-3xl p-4 border border-dashed ${T.line}`}>
                  <div className={`text-xs font-medium mb-2 ${T.muted}`}>Ajouter une section</div>
                  <div className="flex flex-wrap gap-1.5">
                    {presetTitles.map((t, i) => <Btn key={t} size="sm" variant="soft" icon={Plus} onClick={() => addSection(t, PRESETS.kinds[i])}>{t}</Btn>)}
                  </div>
                </div>
              ) : (
                <section id="studio-sec-sign" className={`rounded-3xl p-4 sm:p-5 ${T.surface}`} style={{ ...T.shadow, scrollMarginTop: 64 }}>
                  <Field label="Signature"><Input value={model.sign} onChange={(e) => setHead({ sign: e.target.value })} placeholder="Prénom Nom" /></Field>
                </section>
              )}
              <div className="h-16" aria-hidden="true" />
            </div>
          </div>
        )}

        {showPreview && (
          <div ref={prevRef} className={`min-w-0 overflow-auto ${T.dark ? "bg-stone-900" : "bg-stone-200"}`} style={{ flex: "1.25 1 0" }}>
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2" style={T.glass}>
              <Select value={zoomMode} onChange={(e) => setZoomMode(e.target.value)} aria-label="Zoom" className="h-8 text-xs">
                <option value="fit">Ajuster</option><option value="0.75">75 %</option><option value="1">100 %</option><option value="1.25">125 %</option>
              </Select>
              <Select value={design.template} onChange={(e) => setDesign(designFromTemplate(e.target.value, { layout: design.layout, accent, page: design.page, photoShow: design.photo.show }))} aria-label="Modèle" className="h-8 text-xs">
                {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                {!TEMPLATE_BY_ID[design.template] && <option value={design.template}>Personnalisé</option>}
              </Select>
              <label className={`inline-flex items-center gap-1.5 text-xs ${T.muted}`}>
                <Palette className="w-4 h-4" aria-hidden="true" /> Couleur
                <input type="color" value={cleanHex(accent)} onChange={(e) => setAccent(e.target.value)} aria-label="Couleur d'accent" style={{ width: 28, height: 22, border: "none", background: "transparent" }} />
              </label>
              <button type="button" onClick={openDesign} className={`text-xs underline underline-offset-4 ${T.muted} ${T.ring} rounded`}>Plus de réglages</button>
              {v.accentSource && accent === cleanHex(v.accent) && <span className={`text-xs ${T.faint}`}>({v.accentSource})</span>}
              <span className="flex-1" />
              <Chip tone={pages && pages > (type === "cv" ? 2 : 1) ? "warn" : "neutral"}>{pages || "…"} page{pages > 1 ? "s" : ""}</Chip>
              <span className={`text-xs tabular-nums ${T.faint}`}>{report.words} mots</span>
              <CopyBtn text={docPlainText(text)} label="Copier le texte" />
            </div>
            <div className="px-4 py-6">
              <DesignPages text={text} kind={type} design={design} photo={photo} lang={lang} zoom={zoom} onPages={setPages} onPick={goTo} activeSec={flash} />
              <p className={`text-xs text-center mt-4 ${T.faint}`}>Cliquez sur un passage pour le modifier. Aperçu identique au PDF et au Word (mêmes positions, texte sélectionnable, lisible par les ATS).</p>
            </div>
          </div>
        )}

        {showPanel && (
          <aside className={`shrink-0 overflow-y-auto ${wide ? `border-l ${T.line}` : "flex-1"} ${T.app}`} style={wide ? { width: 400 } : undefined} aria-label={panelMode === "design" ? "Design du document" : "Optimisation du document"}>
            {panelMode === "design" ? (
              <div className="px-5 py-2">
                <DesignPanel
                  design={design} setDesign={setDesign} kind={type}
                  accentSuggested={cleanHex(v.accent) !== cleanHex(accent) ? cleanHex(v.accent) : null}
                  onPhoto={() => setPhotoOpen(true)} hasPhoto={!!photo?.src}
                  sections={dModel.sections} onReorder={dModel.sections.length === model.sections.length ? reorderSection : null}
                />
              </div>
            ) : <OptimPanel app={app} offer={offer} type={type} report={report} pages={pages} text={text} api={api} />}
          </aside>
        )}

        {exportOpen && <ExportModal app={app} offer={offer} current={{ type, lang, text, accent }} onClose={() => setExportOpen(false)} />}
        <PhotoEditor open={photoOpen} onClose={(shape) => { setPhotoOpen(false); if (shape) setDesign({ ...design, photo: { ...design.photo, show: true, shape } }); }} />
        {setupOpen && (
          <div className={`absolute inset-0 z-20 flex flex-col ${T.app}`}>
            <StudioSetup app={app} offer={offer} type={type} onDone={() => setSetupOpen(false)} onCancel={(leave) => { setSetupOpen(false); if (leave) onClose(); }} />
          </div>
        )}
      </div>

      {!wide && (
        <nav className={`shrink-0 border-t px-3 py-2 flex justify-center ${T.line}`} aria-label="Vue du studio">
          <Tabs value={pane} onChange={setPane} tabs={[{ id: "edit", label: "Éditer" }, { id: "preview", label: "Aperçu" }, { id: "design", label: "Design" }, { id: "panel", label: "Optimiser", count: report.blockers || undefined }]} />
        </nav>
      )}
    </>
  );
}

/* Carte de document dans la fiche candidature : vignette, score, accès au studio. */
function StudioDocCard({ app, offer, type }) {
  const T = useT();
  const { openStudio, settings, profile, genStatus, briefs, media } = useApp();
  const versions = app.docs?.[type] || [];
  const v = versions[versions.length - 1];
  const draft = app.drafts?.[type];
  const useDraft = v && draft && draft.baseId === v.id;
  const text = useDraft ? draft.text : v?.text;
  const lang = v?.language || app.docLanguage || offer?.language || "fr";
  const rep = useMemo(
    () => (v ? analyzeDoc(text, type, lintCtx({ offer, analysis: app.analysis, prefs: { ...DEFAULT_DOC_PREFS, ...(app.docPrefs || {}) }, lang, settings, profile, fallbackKeywords: v.keywords, cvText: type === "letter" ? latestCvText(app) : "", app, briefs })) : null),
    [text, app.analysis, type], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const z = 0.15;
  const design = useMemo(() => designWithAccent(app, settings, useDraft ? draft.accent : v?.accent), [app.design, settings.designDefault, useDraft, draft?.accent, v?.accent]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card className="p-4 flex gap-3">
      <button type="button" onClick={() => openStudio(app.id, type)} className={`shrink-0 rounded-lg overflow-hidden ${T.ring}`} aria-label={`Ouvrir ${DOC_LABEL[type]} dans le studio`} style={{ width: 210 * MM * z, height: 297 * MM * z, background: v ? "transparent" : undefined }}>
        {v ? (
          <div style={{ pointerEvents: "none" }}><DesignPages text={text} kind={type} design={design} photo={media?.photo} lang={lang} zoom={z} maxPages={1} /></div>
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${T.sub}`}><FileText className={`w-6 h-6 ${T.faint}`} aria-hidden="true" /></div>
        )}
      </button>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="text-sm font-medium">{type === "cv" ? "CV" : "Lettre de motivation"}</div>
        {v ? <div className={`text-xs ${T.muted}`}>v{versions.length} · {fmtDate(v.createdAt)}{useDraft ? " · brouillon en cours" : ""}</div> : <div className={`text-xs ${T.faint}`}>{genStatus[app.id] ? genStatus[app.id].label : "Pas encore généré"}</div>}
        {rep && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Chip tone={rep.scores.total >= 80 ? "accent" : rep.scores.total >= 60 ? "warn" : "danger"}>{rep.scores.total}/100</Chip>
            {rep.blockers ? <Chip tone="danger">{rep.blockers} à corriger</Chip> : <Chip tone="ok">prêt</Chip>}
            {rep.kwPct !== null && <Chip>ATS {rep.kwPct} %</Chip>}
          </div>
        )}
        <div className="mt-auto pt-3">
          <Btn size="sm" variant="primary" icon={Maximize2} onClick={() => openStudio(app.id, type)}>{v ? "Ouvrir" : "Créer"}</Btn>
        </div>
      </div>
    </Card>
  );
}

function FollowUpItem({ app, offer, fu, compact }) {
  const T = useT();
  const { draftFollowUp, setFollowUp, completeFollowUp, createGmailDraft, createCalendarEvent, calTitle, busy, contacts, openApp } = useApp();
  const [subject, setSubject] = useState(fu.draft?.subject || "");
  const [body, setBody] = useState(fu.draft?.body || "");
  useEffect(() => { setSubject(fu.draft?.subject || ""); setBody(fu.draft?.body || ""); }, [fu.draft?.createdAt]);
  const d = daysFromToday(fu.due);
  const to = contacts.find((c) => (app.contactIds || []).includes(c.id) && c.email)?.email || "";
  const loading = busy[`fu:${fu.id}`];
  const persist = () => setFollowUp(app.id, fu.id, { draft: { ...(fu.draft || {}), subject, body, createdAt: fu.draft?.createdAt || nowISO() } });
  const reminderStart = (() => { const x = new Date(fu.due); x.setHours(9, 0, 0, 0); return x.toISOString(); })();
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{FU_KINDS[fu.kind]}</span>
            <Chip tone={fu.status !== "pending" ? "neutral" : d < 0 ? "danger" : d === 0 ? "warn" : "neutral"}>
              {fu.status === "pending" ? `${relDay(fu.due)} · ${fmtDate(fu.due)}` : fu.status === "done" ? "effectuée" : fu.status === "skipped" ? "ignorée" : "annulée"}
            </Chip>
            {app.demo && <Chip>exemple</Chip>}
          </div>
          {!compact && (
            <button type="button" onClick={() => openApp(app.id, "followups")} className={`text-xs mt-1 hover:underline underline-offset-4 ${T.muted} ${T.ring} rounded`}>
              {offer?.title || "Candidature"} · {show(offer?.company)}
            </button>
          )}
        </div>
        {fu.status === "pending" && (
          <div className="flex flex-wrap gap-1">
            <Btn size="sm" variant="ghost" icon={CalendarPlus} loading={busy.gcal} onClick={() => createCalendarEvent({ title: calTitle(FU_KINDS[fu.kind], offer?.company), start: reminderStart, end: new Date(new Date(reminderStart).getTime() + 15 * 6e4).toISOString(), description: `${FU_KINDS[fu.kind]} — ${offer?.title || ""} (${offer?.company || NC})`, appId: app.id, reminder: 10 })}>Rappel</Btn>
            <Btn size="sm" variant="ghost" icon={Check} onClick={() => completeFollowUp(app.id, fu.id, "done")}>Fait</Btn>
            <Btn size="sm" variant="ghost" icon={X} onClick={() => completeFollowUp(app.id, fu.id, "skipped")}>Ignorer</Btn>
          </div>
        )}
      </div>
      {fu.status === "pending" && (
        <div className="mt-4 space-y-3">
          {!fu.draft && !loading && <Btn size="sm" icon={Sparkles} onClick={() => draftFollowUp(app.id, fu.id)}>Rédiger avec l'IA</Btn>}
          {loading && <Skeleton lines={3} />}
          {fu.draft && !loading && (
            <>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={persist} aria-label="Objet" />
              <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} onBlur={persist} aria-label="Message" />
              <div className="flex flex-wrap gap-2">
                <Btn size="sm" variant="primary" icon={Mail} loading={busy["gmail-draft"]} onClick={() => { persist(); createGmailDraft({ to, subject, body, appId: app.id }); }}>Brouillon Gmail</Btn>
                <CopyBtn text={`Objet : ${subject}\n\n${body}`} />
                <Btn size="sm" variant="ghost" icon={RefreshCw} onClick={() => draftFollowUp(app.id, fu.id)}>Régénérer</Btn>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function AppFollowUps({ app, offer }) {
  const T = useT();
  const { addFollowUp } = useApp();
  const [due, setDue] = useState(addDays(nowISO(), 7).slice(0, 10));
  const list = [...(app.followUps || [])].sort((a, b) => new Date(a.due) - new Date(b.due));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Planifier une relance supplémentaire"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        <Btn icon={Plus} onClick={() => addFollowUp(app.id, new Date(`${due}T09:00:00`).toISOString())}>Ajouter</Btn>
      </div>
      {list.length === 0 ? <p className={`text-sm ${T.faint}`}>Les relances sont créées automatiquement lorsque la candidature passe à « Envoyée » (et le remerciement après un entretien).</p> : list.map((fu) => <FollowUpItem key={fu.id} app={app} offer={offer} fu={fu} compact />)}
    </div>
  );
}

function PrepPanel({ app, offer }) {
  const T = useT();
  const { prepareInterview, busy } = useApp();
  const p = app.prep;
  const loading = busy[`prep:${app.id}`];
  if (!p) {
    return (
      <Card className="p-6">
        {loading ? <Skeleton lines={8} /> : (
          <Empty
            icon={Sparkles}
            title="Préparer l'entretien"
            text="Fiche entreprise sourcée (recherche web), questions probables, vos exemples STAR, questions à poser et points de négociation."
            action={<Btn variant="primary" icon={Search} onClick={() => prepareInterview(app.id)}>Générer la fiche</Btn>}
          />
        )}
      </Card>
    );
  }
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs ${T.faint}`}>Générée {relTime(p.createdAt)}</span>
        <Btn size="sm" icon={RefreshCw} loading={loading} onClick={() => prepareInterview(app.id)}>Régénérer</Btn>
      </div>
      <section>
        <SectionTitle>{offer?.company || "Entreprise"}</SectionTitle>
        {p.summary && <p className="text-sm mb-3">{p.summary}</p>}
        <ul className="space-y-2">
          {p.facts.map((f, i) => (
            <li key={i} className="text-sm">
              {f.text}{" "}
              {f.sourceUrl ? <ExtLink href={f.sourceUrl} className="text-xs">{hostOf(f.sourceUrl)}</ExtLink> : <Chip tone="warn">sans source</Chip>}
              {f.sourceUrl && !f.verified && <Chip tone="warn" className="ml-1">source à vérifier</Chip>}
            </li>
          ))}
        </ul>
        {p.news?.length > 0 && (
          <div className="mt-4">
            <div className={`text-xs mb-2 ${T.faint}`}>Actualité</div>
            <ul className="space-y-1">{p.news.map((n, i) => <li key={i} className="text-sm">{n.date ? `${fmtDate(n.date)} · ` : ""}{n.sourceUrl ? <ExtLink href={n.sourceUrl}>{n.title}</ExtLink> : n.title}</li>)}</ul>
          </div>
        )}
      </section>
      <section>
        <SectionTitle>Questions probables</SectionTitle>
        <ul className="space-y-3">{p.likelyQuestions.map((q, i) => <li key={i}><div className="text-sm font-medium">{q.question}</div>{q.angle && <div className={`text-xs ${T.muted}`}>{q.angle}</div>}</li>)}</ul>
      </section>
      <section>
        <SectionTitle>Mes exemples STAR</SectionTitle>
        <div className="space-y-3">
          {p.star.map((s, i) => (
            <div key={i} className={`rounded-2xl p-4 ${T.sub}`}>
              <div className="text-sm font-medium mb-2">{s.theme}</div>
              <dl className="grid grid-cols-1 gap-1 text-sm">
                {[["S", s.situation], ["T", s.task], ["A", s.action], ["R", s.result]].map(([k, v]) => (
                  <div key={k} className="flex gap-3"><dt className={`w-4 font-semibold ${T.accentText}`}>{k}</dt><dd className="flex-1">{v}</dd></div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <BulletList title="Questions à poser" items={p.questionsToAsk} icon={HelpCircle} />
        <BulletList title="Points de négociation" items={p.negotiation.map((n) => `${n.point} — ${n.argument}`)} icon={Target} />
      </section>
      <section>
        <SectionTitle>Repère salarial</SectionTitle>
        {p.salaryBenchmark ? (
          <p className="text-sm">{p.salaryBenchmark.range} {p.salaryBenchmark.sourceUrl && <ExtLink href={p.salaryBenchmark.sourceUrl} className="text-xs">source</ExtLink>}</p>
        ) : <p className={`text-sm ${T.faint}`}>{NC} — aucune source publique chiffrée trouvée.</p>}
      </section>
    </div>
  );
}

function AppContacts({ app }) {
  const T = useT();
  const { contacts, toggleAppContact, go } = useApp();
  return (
    <div className="space-y-3">
      {contacts.length === 0 ? (
        <Empty icon={Users} title="Aucun contact" action={<Btn onClick={() => go("contacts")}>Ajouter un contact</Btn>} />
      ) : contacts.map((c) => (
        <label key={c.id} className={`flex items-center gap-3 rounded-2xl p-3 cursor-pointer ${T.subHover}`}>
          <input type="checkbox" checked={(app.contactIds || []).includes(c.id)} onChange={() => toggleAppContact(app.id, c.id)} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium">{c.name}{c.demo && <Chip className="ml-2">exemple</Chip>}</span>
            <span className={`block text-xs ${T.muted}`}>{CONTACT_TYPES[c.type]} · {c.role || NC} · {c.company || NC}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   14. ASSISTANT CANDIDATURE
   ════════════════════════════════════════════════════════════════════════ */

/* Ch.7 · Mesures : ce que la lettre utilise, recouvrement avec le CV, corrections manuelles par document (doit baisser), étape atteinte. */
function docMeasures(app) {
  const pick = (t) => {
    const list = app.docs?.[t] || [];
    const ia = [...list].reverse().find((v) => v.origin === "IA");
    const ed = [...list].reverse().find((v) => v.origin === "édition" && v.edits && (!ia || v.edits.baseId === ia.id));
    return { ia, pct: ed ? ed.edits.pct : ia ? null : undefined };
  };
  const cv = pick("cv"), letter = pick("letter");
  const lm = letter.ia?.metrics || (letter.ia ? letterMetrics(letter.ia.text, cv.ia?.text || "") : null);
  return { at: (letter.ia || cv.ia)?.createdAt || null, cvPct: cv.pct, letterPct: letter.pct, overlap: lm?.overlap ?? null, numbers: lm?.numbers ?? null, used: letter.ia?.used || null, reached: app.reached ?? STAGE_INDEX[app.stage] };
}
function QualityStats() {
  const T = useT();
  const { allApps, offers } = useApp();
  const rows = (allApps || []).filter((a) => a.docs?.cv?.length || a.docs?.letter?.length).map((a) => ({ a, o: offers.find((o) => o.id === a.offerId), m: docMeasures(a) })).filter((r) => r.m.at).sort((x, y) => new Date(x.m.at) - new Date(y.m.at));
  if (!rows.length) return null;
  const edited = rows.map((r) => [r.m.cvPct, r.m.letterPct].filter((x) => typeof x === "number")).filter((l) => l.length).map((l) => l.reduce((n, x) => n + x, 0) / l.length);
  const half = Math.floor(edited.length / 2);
  const avg = (l) => (l.length ? Math.round(l.reduce((n, x) => n + x, 0) / l.length) : null);
  const early = avg(edited.slice(0, half)), late = avg(edited.slice(half));
  const pctCell = (x) => (typeof x === "number" ? `${x} %` : x === null ? "non retouché" : "—");
  return (
    <Card className="p-6 lg:col-span-3">
      <SectionTitle action={edited.length >= 4 && early !== null && late !== null ? <Chip tone={late <= early ? "ok" : "warn"}>corrections : {early} % → {late} %</Chip> : null}>Mesures des dossiers</SectionTitle>
      <p className={`text-xs mb-3 ${T.muted}`}>Corrections manuelles = part des mots modifiés entre la version IA et votre version enregistrée (doit baisser au fil des candidatures). Recouvrement = part de la lettre déjà présente dans le CV (cible ≤ 15 %).</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className={`text-left ${T.muted}`}><th className="py-1 pr-3 font-medium">Candidature</th><th className="pr-3 font-medium">Généré</th><th className="pr-3 font-medium">Corrections CV</th><th className="pr-3 font-medium">Corrections lettre</th><th className="pr-3 font-medium">Recouvrement</th><th className="pr-3 font-medium">Chiffres</th><th className="pr-3 font-medium">Lettre utilise</th><th className="font-medium">Étape atteinte</th></tr></thead>
          <tbody>
            {rows.slice(-15).reverse().map(({ a, o, m }) => (
              <tr key={a.id} className={`border-t ${T.line}`}>
                <td className="py-1.5 pr-3">{o?.title || "—"}<span className={T.faint}> · {show(o?.company)}</span></td>
                <td className="pr-3 tabular-nums">{fmtDate(m.at)}</td>
                <td className="pr-3 tabular-nums">{pctCell(m.cvPct)}</td>
                <td className="pr-3 tabular-nums">{pctCell(m.letterPct)}</td>
                <td className={`pr-3 tabular-nums ${m.overlap > 30 ? "text-rose-600" : m.overlap > 15 ? "text-amber-600" : ""}`}>{m.overlap === null ? "—" : `${m.overlap} %`}</td>
                <td className={`pr-3 tabular-nums ${m.numbers > 2 ? "text-amber-600" : ""}`}>{m.numbers ?? "—"}</td>
                <td className="pr-3">{m.used ? [m.used.companyFacts?.length ? `${m.used.companyFacts.length} fait(s)` : "0 fait", m.used.convictionId ? "conviction" : null, m.used.storyId ? "histoire" : null].filter(Boolean).join(" · ") : "—"}</td>
                <td>{STAGES[m.reached]?.label || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AssistantView() {
  const T = useT();
  const { apps, allApps, offers, settings, openApp, openStudio, addToPipeline, go, setSpontOpen } = useApp();
  const inPrep = apps.filter((a) => ["new", "retained", "prep"].includes(a.stage));
  const baseDocs = allApps.filter((a) => a.kind === "base");
  const candidates = offers.filter((o) => o.status === "new" && o.score?.value >= settings.threshold).sort((a, b) => b.score.value - a.score.value).slice(0, 6);
  const offerOf = (a) => offers.find((o) => o.id === a.offerId);
  return (
    <div>
      <PageHeader
        title="Assistant candidature"
        subtitle="L'IA prépare, vous validez. Aucun document n'est envoyé en votre nom."
        actions={<Btn variant="primary" icon={Plus} onClick={() => setSpontOpen(true)}>CV ou lettre sans offre</Btn>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-2">
          <SectionTitle>Candidatures à préparer</SectionTitle>
          {inPrep.length === 0 ? (
            <Empty icon={Sparkles} title="Rien en préparation" text="Retenez une offre, ou partez d'un rôle visé sans offre (candidature spontanée, CV de base)." action={<div className="flex flex-wrap justify-center gap-2"><Btn variant="primary" icon={Plus} onClick={() => setSpontOpen(true)}>CV ou lettre sans offre</Btn><Btn onClick={() => go("offers")}>Voir les offres</Btn></div>} />
          ) : (
            <ul className="space-y-2">
              {inPrep.map((a) => {
                const o = offerOf(a);
                const n = Object.keys(a.docs || {}).length;
                return (
                  <li key={a.id} className={`flex flex-wrap items-center gap-3 rounded-2xl p-4 ${T.sub}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{o?.title}{a.demo && <Chip className="ml-2">exemple</Chip>}{o?.spontaneous && <Chip tone="accent" className="ml-2">spontanée</Chip>}</div>
                      <div className={`text-xs ${T.muted}`}>{show(o?.company)} · {STAGE_LABEL[a.stage]} · {n}/{DOC_TYPES.length} documents</div>
                      <div className={`mt-2 h-1 rounded-full overflow-hidden ${T.dark ? "bg-stone-700" : "bg-stone-200"}`}><div className="h-full bg-indigo-600" style={{ width: `${(n / DOC_TYPES.length) * 100}%` }} /></div>
                    </div>
                    {n > 0 && <Btn variant="ghost" onClick={() => openApp(a.id, "docs")}>Dossier</Btn>}
                    <Btn variant="primary" icon={n ? Maximize2 : Sparkles} onClick={() => openStudio(a.id, "cv")}>{n ? "Studio CV & lettre" : "Préparer"}</Btn>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card className="p-6">
          <SectionTitle>Ce que l'assistant fait — et ne fait pas</SectionTitle>
          <ul className="space-y-3 text-sm">
            {[
              [true, "Analyse de l'annonce : intitulé exact, 20 à 35 mots-clés ATS, exigences et preuves de votre profil"],
              [true, "CV et lettre rédigés en 3 étapes (analyse, rédaction, contrôle qualité) dans la langue de l'annonce"],
              [true, "Studio plein écran : éditeur par sections, aperçu A4 fidèle au PDF, score et corrections à valider"],
              [true, "Candidatures spontanées et CV de base, sans offre : partez d'un rôle visé"],
              [true, "Message LinkedIn, réponses au formulaire, e-mail et brouillon Gmail (jamais envoyé)"],
              [false, "Soumettre un formulaire sur le site de l'employeur ou d'un job board"],
              [false, "Envoyer un e-mail ou un message LinkedIn à votre place"],
              [false, "Inventer des réalisations ou des chiffres : les manques sont marqués [à compléter]"],
            ].map(([ok, t]) => (
              <li key={t} className="flex gap-2">{ok ? <Check className={`w-4 h-4 mt-0.5 shrink-0 ${T.accentText}`} aria-label="Oui" /> : <X className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" aria-label="Non" />}<span>{t}</span></li>
            ))}
          </ul>
        </Card>
        <Card className="p-6 lg:col-span-3">
          <SectionTitle action={<Btn size="sm" variant="ghost" icon={Plus} onClick={() => setSpontOpen(true)}>Nouveau</Btn>}>Sans offre : candidatures spontanées et CV de base</SectionTitle>
          <p className={`text-sm mb-4 ${T.muted}`}>Partez d'un rôle visé, avec ou sans entreprise ciblée. Les candidatures spontanées rejoignent le pipeline (relances, contacts) ; les CV de base restent ici, prêts à être déclinés.</p>
          {baseDocs.length === 0 ? <p className={`text-sm ${T.faint}`}>Aucun CV de base pour l'instant.</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {baseDocs.map((a) => {
                const o = offerOf(a);
                const n = Object.keys(a.docs || {}).length;
                return (
                  <div key={a.id} className={`flex items-center gap-3 rounded-2xl p-4 ${T.sub}`}>
                    <FileText className={`w-5 h-5 shrink-0 ${T.muted}`} aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{o?.title || "CV de base"}</div>
                      <div className={`text-xs truncate ${T.muted}`}>CV de base · {n ? `${n} document(s) · ${fmtDate(a.updatedAt)}` : "pas encore généré"}</div>
                    </div>
                    <Btn size="sm" variant="ghost" onClick={() => openApp(a.id, "docs")}>Fiche</Btn>
                    <Btn size="sm" variant="primary" icon={Maximize2} onClick={() => openStudio(a.id, "cv")}>Studio</Btn>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card className="p-6 lg:col-span-3">
          <SectionTitle>Offres au-dessus du seuil, pas encore retenues</SectionTitle>
          {candidates.length === 0 ? <p className={`text-sm ${T.faint}`}>Aucune pour l'instant.</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {candidates.map((o) => (
                <div key={o.id} className={`flex items-center gap-3 rounded-2xl p-4 ${T.sub}`}>
                  <ScorePill score={o.score} threshold={settings.threshold} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{o.title}</div>
                    <div className={`text-xs truncate ${T.muted}`}>{show(o.company)}</div>
                  </div>
                  <Btn size="sm" onClick={() => { const id = addToPipeline(o.id, "retained"); openApp(id, "docs"); }}>Retenir</Btn>
                </div>
              ))}
            </div>
          )}
        </Card>
        <QualityStats />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   15. RELANCES & AGENDA
   ════════════════════════════════════════════════════════════════════════ */

function FollowupsView() {
  const T = useT();
  const { apps, offers, settings, setSettings, openApp, checkReplies, busy } = useApp();
  const [showDone, setShowDone] = useState(false);
  const offerOf = (a) => offers.find((o) => o.id === a.offerId);
  const all = apps.flatMap((a) => (a.followUps || []).map((fu) => ({ app: a, fu })));
  const pending = all.filter((x) => x.fu.status === "pending").sort((a, b) => new Date(a.fu.due) - new Date(b.fu.due));
  const groups = [
    ["En retard", pending.filter((x) => daysFromToday(x.fu.due) < 0)],
    ["Aujourd'hui", pending.filter((x) => daysFromToday(x.fu.due) === 0)],
    ["7 prochains jours", pending.filter((x) => { const d = daysFromToday(x.fu.due); return d > 0 && d <= 7; })],
    ["Plus tard", pending.filter((x) => daysFromToday(x.fu.due) > 7)],
  ];
  const interviews = apps.flatMap((a) => (a.interviews || []).map((i) => ({ app: a, i }))).filter((x) => new Date(x.i.at) >= startOfDay(new Date())).sort((a, b) => new Date(a.i.at) - new Date(b.i.at));
  const rules = settings.followUp;
  const setRules = (patch) => setSettings((s) => ({ ...s, followUp: { ...s.followUp, ...patch } }));
  return (
    <div>
      <PageHeader
        title="Relances & agenda"
        subtitle={`L'IA rédige chaque relance en brouillon ; vous relisez, puis créez le brouillon Gmail et le rappel d'agenda. Réponses vérifiées ${relTime(settings.lastReplyCheckAt)}.`}
        actions={<Btn icon={MailCheck} loading={busy.replies} onClick={checkReplies}>Vérifier les réponses (Gmail)</Btn>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-8">
          {pending.length === 0 && <Card><Empty icon={BellRing} title="Aucune relance en attente" text="Elles apparaîtront quand une candidature passera à « Envoyée »." /></Card>}
          {groups.map(([label, list]) => list.length > 0 && (
            <section key={label}>
              <SectionTitle>{label} · {list.length}</SectionTitle>
              <div className="space-y-3">{list.map(({ app, fu }) => <FollowUpItem key={fu.id} app={app} offer={offerOf(app)} fu={fu} />)}</div>
            </section>
          ))}
          <div>
            <Btn variant="ghost" size="sm" onClick={() => setShowDone(!showDone)}>{showDone ? "Masquer" : "Afficher"} l'historique</Btn>
            {showDone && (
              <ul className={`mt-3 divide-y ${T.divide}`}>
                {all.filter((x) => x.fu.status !== "pending").map(({ app, fu }) => (
                  <li key={fu.id} className="py-2 text-sm flex justify-between gap-3">
                    <span>{FU_KINDS[fu.kind]} · {offerOf(app)?.company || NC}</span>
                    <span className={T.faint}>{fu.status === "done" ? "effectuée" : fu.status === "skipped" ? "ignorée" : "annulée"} · {fmtDate(fu.doneAt || fu.due)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <Card className="p-6">
            <SectionTitle>Entretiens à venir</SectionTitle>
            {interviews.length === 0 ? <p className={`text-sm ${T.faint}`}>Aucun.</p> : (
              <ul className="space-y-2">
                {interviews.map(({ app, i }) => (
                  <li key={i.id}>
                    <button type="button" onClick={() => openApp(app.id, "prep")} className={`w-full text-left rounded-2xl p-3 ${T.subHover} ${T.ring}`}>
                      <div className="text-sm font-medium">{fmtDate(i.at, { time: true })}</div>
                      <div className={`text-xs ${T.muted}`}>{offerOf(app)?.company || NC} · {i.type} · {app.prep ? "fiche prête" : "à préparer"}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-6">
            <SectionTitle>Règles de relance</SectionTitle>
            <div className="space-y-4">
              <Field label="Après envoi (jours)" hint="Ex. 7, 14 — appliqué aux prochaines candidatures envoyées">
                <Input value={rules.afterSend.join(", ")} onChange={(e) => setRules({ afterSend: e.target.value.split(/[,; ]+/).map(Number).filter((n) => n > 0 && n < 120) })} />
              </Field>
              <Field label="Remerciement après entretien (jours)">
                <Input type="number" min={0} max={14} value={rules.afterInterview} onChange={(e) => setRules({ afterInterview: clamp(Number(e.target.value) || 0, 0, 14) })} />
              </Field>
              <Toggle checked={settings.discreetCalendarTitles} onChange={(v) => setSettings((s) => ({ ...s, discreetCalendarTitles: v }))} label="Titres d'agenda neutres" description="« Perso · Entretien » au lieu du nom de l'entreprise (utile si votre agenda est partagé)." />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   16. CONTACTS
   ════════════════════════════════════════════════════════════════════════ */

const EMPTY_CONTACT = { name: "", role: "", company: "", type: "recruiter", email: "", linkedin: "", phone: "", notes: "" };

function ContactsView() {
  const T = useT();
  const { contacts, apps, offers, saveContact, deleteContact, openApp } = useApp();
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const list = contacts.filter((c) => (!type || c.type === type) && (!q || normText(`${c.name} ${c.company} ${c.role}`).includes(normText(q))));
  const linkedApps = (cid) => apps.filter((a) => (a.contactIds || []).includes(cid));
  return (
    <div>
      <PageHeader title="Contacts" subtitle="Recruteurs, cabinets, hiring managers et personnes de votre réseau liées à une entreprise." actions={<Btn variant="primary" icon={Plus} onClick={() => setEdit({ ...EMPTY_CONTACT })}>Nouveau contact</Btn>} />
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher un contact" className="sm:max-w-xs" />
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type de contact">
          <option value="">Tous les types</option>
          {Object.entries(CONTACT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      {list.length === 0 ? <Card><Empty icon={Users} title="Aucun contact" text="Ajoutez les personnes rencontrées : elles pourront être liées aux candidatures et servir de destinataires aux brouillons." /></Card> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-medium">{c.name}</div>
                  <div className={`text-sm ${T.muted}`}>{c.role || NC} · {c.company || NC}</div>
                </div>
                <div className="flex gap-1">
                  <Chip>{CONTACT_TYPES[c.type]}</Chip>
                  {c.demo && <Chip>exemple</Chip>}
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                {c.email && <div className="flex items-center gap-2"><Mail className={`w-3.5 h-3.5 ${T.faint}`} aria-hidden="true" /><a className={`hover:underline ${T.ring} rounded`} href={`mailto:${c.email}`}>{c.email}</a></div>}
                {c.linkedin && <div className="flex items-center gap-2"><Linkedin className={`w-3.5 h-3.5 ${T.faint}`} aria-hidden="true" /><ExtLink href={c.linkedin}>Profil LinkedIn</ExtLink></div>}
                {c.phone && <div className={T.muted}>{c.phone}</div>}
                {c.notes && <p className={`text-xs mt-2 ${T.muted}`}>{c.notes}</p>}
              </div>
              {linkedApps(c.id).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {linkedApps(c.id).map((a) => (
                    <button key={a.id} type="button" onClick={() => openApp(a.id, "contacts")} className={`text-xs rounded-full px-2.5 py-0.5 ${T.chip} ${T.ring}`}>
                      {offers.find((o) => o.id === a.offerId)?.company || "candidature"}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <Btn size="sm" variant="ghost" onClick={() => setEdit({ ...c })}>Modifier</Btn>
                <Btn size="sm" variant="ghost" icon={Trash2} onClick={() => deleteContact(c.id)}>Supprimer</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Modifier le contact" : "Nouveau contact"} footer={<><Btn variant="ghost" onClick={() => setEdit(null)}>Annuler</Btn><Btn variant="primary" disabled={!edit?.name?.trim()} onClick={() => { saveContact(edit); setEdit(null); }}>Enregistrer</Btn></>}>
        {edit && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nom *"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} data-autofocus /></Field>
            <Field label="Type"><Select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })} className="w-full">{Object.entries(CONTACT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Fonction"><Input value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} /></Field>
            <Field label="Entreprise / cabinet"><Input value={edit.company} onChange={(e) => setEdit({ ...edit, company: e.target.value })} /></Field>
            <Field label="E-mail"><Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Téléphone"><Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="URL LinkedIn" className="sm:col-span-2"><Input value={edit.linkedin} onChange={(e) => setEdit({ ...edit, linkedin: e.target.value })} /></Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea rows={3} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   17. SOURCES & COLLECTE
   ════════════════════════════════════════════════════════════════════════ */

function SourcesView() {
  const T = useT();
  const { sources, setSources, patchSource, runWatch, importGmail, busy, settings, setSettings, setManualOpen, importOffersJSON, veille } = useApp();
  const vst = veille?.status;
  const VSTATE = { requested: "demandée", running: "en cours", done: "terminée", error: "en erreur" };
  const [form, setForm] = useState({ name: "", kind: "company", url: "" });
  const [jsonText, setJsonText] = useState("");
  const jsonFile = useRef(null);
  const readJsonFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => importOffersJSON(String(r.result));
    r.readAsText(f);
    e.target.value = "";
  };
  const kinds = ["board", "public", "agency", "company", "custom", "email"];
  const addSource = () => {
    const name = form.name.trim();
    if (!name) return;
    const raw = form.url.trim();
    const host = hostOf(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
    if (!host) return;
    setSources((l) => [...l, {
      id: uid("src"), name, kind: form.kind, enabled: true,
      domains: [host], careersUrl: form.kind === "company" ? (/^https?:\/\//.test(raw) ? raw : `https://${raw}`) : null,
      lastRunAt: null, lastCount: null, lastError: null, lastNote: null, note: null,
    }]);
    setForm({ name: "", kind: form.kind, url: "" });
  };
  const enabledCount = sources.filter((s) => s.enabled && s.kind !== "email").length;
  return (
    <div>
      <PageHeader
        title="Sources & collecte"
        subtitle={`${enabledCount} source(s) web active(s) · dernière veille ${relTime(settings.lastWatchAt)}`}
        actions={<Btn variant="primary" icon={Play} loading={busy.watch} onClick={() => runWatch()}>Lancer la veille</Btn>}
      />
      {RT.mode === "published" && (
        <Card className="p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><Radio className={`w-4 h-4 ${T.muted}`} aria-hidden="true" /><span className="font-medium">Veille planifiée</span>{veille?.routine ? <Chip tone="ok">active</Chip> : <Chip tone="warn">non reliée</Chip>}</div>
              <p className={`text-sm mt-1 ${T.muted}`}>
                {veille?.routine
                  ? `Un assistant Claude fait la recherche web ${veille.routine.scheduleLabel || "selon le planning"} et à chaque clic sur « Lancer la veille », puis dépose les offres ici. Il ne reçoit que vos critères et vos sources, jamais votre profil.`
                  : "La recherche web n'est pas possible depuis la page elle-même : elle passe par un assistant planifié qui n'est pas encore relié."}
              </p>
              {vst && (
                <p className={`text-xs mt-2 ${vst.state === "error" ? "text-rose-600" : T.faint}`}>
                  Dernière exécution {VSTATE[vst.state] || vst.state}
                  {vst.finishedAt ? ` ${relTime(vst.finishedAt)}` : vst.requestedAt ? ` ${relTime(vst.requestedAt)}` : ""}
                  {typeof vst.count === "number" ? ` · ${vst.count} offre(s)` : ""}
                  {vst.message ? ` · ${vst.message}` : ""}
                </p>
              )}
            </div>
            <Btn variant="primary" icon={Play} loading={busy.watch} disabled={!veille?.routine} onClick={() => runWatch()}>Lancer maintenant</Btn>
          </div>
        </Card>
      )}
      <Notice icon={Info} className="mb-6">
        La collecte passe par la recherche web de l'IA (restreinte au domaine de chaque source), jamais par un accès direct aux sites, bloqué depuis l'artefact. Conséquences : seules les annonces indexées par le moteur remontent, avec parfois quelques jours de décalage. Chaque offre garde son URL et sa date de collecte ; une URL absente des résultats bruts est marquée « à vérifier ».
      </Notice>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1"><Mail className={`w-4 h-4 ${T.muted}`} aria-hidden="true" /><span className="font-medium">Alertes e-mail (Gmail)</span></div>
          <p className={`text-sm mb-4 ${T.muted}`}>Lit vos alertes LinkedIn, Indeed, Jobat, StepStone… et en extrait les offres. Lecture seule : les outils Gmail autorisés sont limités à la recherche et à la lecture.</p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Période">
              <Select value={settings.gmailDays} onChange={(e) => setSettings((s) => ({ ...s, gmailDays: Number(e.target.value) }))}>
                {[3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} derniers jours</option>)}
              </Select>
            </Field>
            <Btn icon={Inbox} loading={busy.gmail} onClick={() => importGmail(settings.gmailDays)}>Importer</Btn>
          </div>
          <p className={`text-xs mt-3 ${T.faint}`}>Dernier import : {relTime(settings.lastGmailImportAt)}</p>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1"><Clipboard className={`w-4 h-4 ${T.muted}`} aria-hidden="true" /><span className="font-medium">Import manuel</span></div>
          <p className={`text-sm mb-4 ${T.muted}`}>Collez une URL ou le texte d'une annonce (y compris LinkedIn) : l'IA la structure, la déduplique et la score.</p>
          <Btn icon={Plus} onClick={() => setManualOpen(true)}>Importer une annonce</Btn>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1"><RefreshCw className={`w-4 h-4 ${T.muted}`} aria-hidden="true" /><span className="font-medium">Automatisation à l'ouverture</span></div>
          <p className={`text-sm mb-2 ${T.muted}`}>Un artefact ne tourne pas en arrière-plan : ces options lancent la collecte à l'ouverture si la dernière date de plus de l'intervalle choisi. Lecture seule, rien n'est envoyé.</p>
          <Toggle checked={settings.autoWatch} onChange={(v) => setSettings((s) => ({ ...s, autoWatch: v }))} label="Lancer la veille web" description="Consomme des appels API à chaque déclenchement." />
          <Toggle checked={settings.autoGmail} onChange={(v) => setSettings((s) => ({ ...s, autoGmail: v }))} label="Importer les alertes Gmail" />
          <Field label="Intervalle minimum" className="mt-2">
            <Select value={settings.autoWatchHours} onChange={(e) => setSettings((s) => ({ ...s, autoWatchHours: Number(e.target.value) }))}>
              {[12, 24, 48, 72].map((h) => <option key={h} value={h}>{h} h</option>)}
            </Select>
          </Field>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1"><Upload className={`w-4 h-4 ${T.muted}`} aria-hidden="true" /><span className="font-medium">Importer des offres (JSON)</span></div>
          <p className={`text-sm mb-3 ${T.muted}`}>Pour une veille produite ailleurs (tâche planifiée, export). Format : tableau d'offres ou <code>{"{\"offers\": [...]}"}</code>, champs title, url obligatoires ; company, location, description… facultatifs. Dédoublonnage et scoring automatiques.</p>
          <Textarea rows={3} value={jsonText} onChange={(e) => setJsonText(e.target.value)} placeholder='[{"title":"…","company":"…","url":"https://…","sourceName":"…"}]' aria-label="Offres JSON" />
          <div className="flex flex-wrap gap-2 mt-2">
            <Btn size="sm" disabled={!jsonText.trim()} loading={busy["json-import"]} onClick={async () => { if (await importOffersJSON(jsonText)) setJsonText(""); }}>Importer le JSON collé</Btn>
            <Btn size="sm" variant="ghost" icon={Upload} onClick={() => jsonFile.current?.click()}>Choisir un fichier</Btn>
            <input ref={jsonFile} type="file" accept="application/json,.json" className="hidden" onChange={readJsonFile} aria-label="Fichier d'offres JSON" />
          </div>
        </Card>
      </div>

      {kinds.map((k) => {
        const list = sources.filter((s) => s.kind === k);
        if (!list.length) return null;
        return (
          <section key={k} className="mb-8">
            <SectionTitle>{SOURCE_KIND_LABEL[k]}</SectionTitle>
            <Card className="p-2">
              <ul className={`divide-y ${T.divide}`}>
                {list.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-48">
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className={`text-xs ${T.muted}`}>{s.careersUrl ? <ExtLink href={s.careersUrl}>{hostOf(s.careersUrl)}</ExtLink> : (s.domains || []).join(", ")}</div>
                      {s.note && <div className={`text-xs mt-1 ${T.muted}`}>{s.note}</div>}
                      {s.lastError && <div className="text-xs mt-1 text-rose-600">Erreur : {s.lastError}</div>}
                      {s.lastNote && !s.lastError && <div className={`text-xs mt-1 ${T.faint}`}>{s.lastNote}</div>}
                    </div>
                    <div className={`text-xs w-40 ${T.faint}`}>
                      {s.lastRunAt ? <>{relTime(s.lastRunAt)} · <span className="tabular-nums">{s.lastCount ?? 0}</span> offre(s)</> : "jamais collectée"}
                    </div>
                    {s.kind !== "email" && <Btn size="sm" variant="ghost" icon={Play} disabled={busy.watch} onClick={() => runWatch({ sourceIds: [s.id] })}>Lancer</Btn>}
                    {s.kind !== "email" && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={s.enabled}
                        aria-label={`Activer ${s.name}`}
                        onClick={() => patchSource(s.id, { enabled: !s.enabled })}
                        className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${s.enabled ? "bg-indigo-600" : T.dark ? "bg-stone-700" : "bg-stone-300"} ${T.ring}`}
                      >
                        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${s.enabled ? "translate-x-4" : ""}`} />
                      </button>
                    )}
                    {!s.id.startsWith("src_default") && <IconBtn icon={Trash2} label={`Supprimer ${s.name}`} onClick={() => setSources((l) => l.filter((x) => x.id !== s.id))} />}
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        );
      })}

      <Card className="p-6">
        <SectionTitle>Ajouter une source ou une entreprise cible</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <Field label="Nom"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex. Proximus" /></Field>
          <Field label="Type">
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="w-full">
              <option value="company">Entreprise cible (page carrières)</option>
              <option value="board">Site d'emploi</option>
              <option value="agency">Cabinet de recrutement</option>
              <option value="public">Secteur public / fédération</option>
              <option value="custom">Autre</option>
            </Select>
          </Field>
          <Field label={form.kind === "company" ? "URL de la page carrières" : "Domaine"}><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder={form.kind === "company" ? "https://entreprise.be/carrieres" : "exemple.be"} /></Field>
          <Btn icon={Plus} onClick={addSource} disabled={!form.name.trim() || !form.url.trim()}>Ajouter</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   18. PROFIL & CRITÈRES (versionnés)
   ════════════════════════════════════════════════════════════════════════ */

function diffCriteria(prev, next) {
  if (!prev) return ["Version initiale"];
  const out = [];
  const lists = { roles: "Postes", zones: "Zones", mustHave: "Indispensables", exclusions: "Exclusions", redFlags: "Signaux d'alerte" };
  Object.entries(lists).forEach(([k, label]) => {
    const a = prev[k] || [], b = next[k] || [];
    b.filter((x) => !a.includes(x)).forEach((x) => out.push(`+ ${label} : ${x}`));
    a.filter((x) => !b.includes(x)).forEach((x) => out.push(`− ${label} : ${x}`));
  });
  const wa = Object.fromEntries((prev.wishes || []).map((w) => [w.label, w.weight]));
  const wb = Object.fromEntries((next.wishes || []).map((w) => [w.label, w.weight]));
  Object.keys(wb).forEach((l) => { if (!(l in wa)) out.push(`+ Souhaité : ${l} (×${wb[l]})`); else if (wa[l] !== wb[l]) out.push(`~ Poids « ${l} » : ${wa[l]} → ${wb[l]}`); });
  Object.keys(wa).forEach((l) => { if (!(l in wb)) out.push(`− Souhaité : ${l}`); });
  ["fr", "nl", "en"].forEach((l) => {
    const a = prev.keywords?.[l] || [], b = next.keywords?.[l] || [];
    const add = b.filter((x) => !a.includes(x)).length, rem = a.filter((x) => !b.includes(x)).length;
    if (add || rem) out.push(`~ Mots-clés ${l.toUpperCase()} : +${add} / −${rem}`);
  });
  if (prev.maxCommute !== next.maxCommute) out.push(`~ Trajet max : ${prev.maxCommute} → ${next.maxCommute} min`);
  if (prev.remote !== next.remote) out.push(`~ Télétravail : ${prev.remote} → ${next.remote}`);
  return out.length ? out : ["Aucun changement"];
}
const criteriaBody = (v) => { if (!v) return null; const { id, label, createdAt, ...b } = v; return b; };

function ListEditor({ items, onChange, placeholder }) {
  const T = useT();
  const [text, setText] = useState("");
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <Input value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`${placeholder} ${i + 1}`} />
          <IconBtn icon={X} label="Retirer" onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { onChange([...items, text.trim()]); setText(""); } }} />
        <IconBtn icon={Plus} label="Ajouter" onClick={() => { if (text.trim()) { onChange([...items, text.trim()]); setText(""); } }} className={T.btnSoft} />
      </div>
    </div>
  );
}

function ProfileView() {
  const [tab, setTab] = useState("criteria");
  const { criteria } = useApp();
  return (
    <div>
      <PageHeader title="Profil & critères" subtitle={`Version active : ${activeVersion(criteria)?.label}`} />
      <div className="mb-6"><Tabs value={tab} onChange={setTab} tabs={[{ id: "criteria", label: "Critères" }, { id: "profile", label: "Profil" }, { id: "motivations", label: "Motivations" }, { id: "rules", label: "Règles d'écriture" }, { id: "history", label: "Historique", count: criteria.versions.length }]} /></div>
      {tab === "criteria" && <CriteriaEditor />}
      {tab === "profile" && <ProfileEditor />}
      {tab === "motivations" && <MotivationEditor />}
      {tab === "rules" && <WritingRulesEditor />}
      {tab === "history" && <CriteriaHistory />}
    </div>
  );
}

function CriteriaEditor() {
  const T = useT();
  const { criteria, setCriteria, saveCriteriaVersion, generateKeywords, busy, settings } = useApp();
  const d = criteria.draft;
  const set = (k, v) => setCriteria((c) => ({ ...c, draft: { ...c.draft, [k]: v } }));
  const dirty = JSON.stringify(d) !== JSON.stringify(criteriaBody(activeVersion(criteria)));
  const [label, setLabel] = useState("");
  return (
    <div className="space-y-4">
      {dirty && (
        <Card className="p-4 flex flex-col md:flex-row md:items-end gap-3" style={{ position: "sticky", top: 64, zIndex: 5 }}>
          <div className="flex-1">
            <div className="text-sm font-medium">Modifications non enregistrées</div>
            <div className={`text-xs ${T.muted}`}>{settings.autoRescore ? "À l'enregistrement, les offres seront automatiquement re-scorées." : "Le recalcul automatique est désactivé (Confidentialité & données)."}</div>
          </div>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`Nom de version (v${criteria.versions.length + 1})`} aria-label="Nom de la version" className="md:max-w-xs" />
          <Btn variant="primary" icon={Save} onClick={() => { saveCriteriaVersion(label.trim()); setLabel(""); }}>Enregistrer la version</Btn>
          <Btn variant="ghost" onClick={() => setCriteria((c) => ({ ...c, draft: deepClone(criteriaBody(activeVersion(c))) }))}>Annuler</Btn>
        </Card>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6 space-y-5">
          <SectionTitle>Cible</SectionTitle>
          <Field label="Postes visés"><ChipInput values={d.roles} onChange={(v) => set("roles", v)} placeholder="Ajouter un intitulé…" /></Field>
          <Field label="Zones"><ChipInput values={d.zones} onChange={(v) => set("zones", v)} placeholder="Ajouter une zone…" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Trajet max depuis Ohain (min)"><Input type="number" min={10} max={180} value={d.maxCommute} onChange={(e) => set("maxCommute", Number(e.target.value))} /></Field>
            <Field label="Télétravail">
              <Select value={d.remote} onChange={(e) => set("remote", e.target.value)} className="w-full">
                {["Hybride", "Télétravail majoritaire", "Indifférent", "Sur site accepté"].map((x) => <option key={x}>{x}</option>)}
              </Select>
            </Field>
          </div>
        </Card>
        <Card className="p-6 space-y-5">
          <SectionTitle action={<Btn size="sm" variant="ghost" icon={Wand2} loading={busy.keywords} onClick={generateKeywords}>Synonymes & traductions</Btn>}>Mots-clés FR / NL / EN</SectionTitle>
          {["fr", "nl", "en"].map((l) => (
            <Field key={l} label={l.toUpperCase()}><ChipInput values={d.keywords[l] || []} onChange={(v) => set("keywords", { ...d.keywords, [l]: v })} placeholder="Ajouter…" /></Field>
          ))}
        </Card>
        <Card className="p-6">
          <SectionTitle>Indispensables</SectionTitle>
          <ListEditor items={d.mustHave} onChange={(v) => set("mustHave", v)} placeholder="Nouveau critère indispensable" />
        </Card>
        <Card className="p-6">
          <SectionTitle>Souhaités (pondération 1 à 5)</SectionTitle>
          <div className="space-y-2">
            {d.wishes.map((w, i) => (
              <div key={w.id} className="flex gap-2">
                <Input value={w.label} onChange={(e) => set("wishes", d.wishes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label={`Souhait ${i + 1}`} />
                <Select value={w.weight} onChange={(e) => set("wishes", d.wishes.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))} aria-label="Poids">
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>×{n}</option>)}
                </Select>
                <IconBtn icon={X} label="Retirer" onClick={() => set("wishes", d.wishes.filter((_, j) => j !== i))} />
              </div>
            ))}
            <Btn size="sm" variant="ghost" icon={Plus} onClick={() => set("wishes", [...d.wishes, { id: uid("w"), label: "", weight: 3 }])}>Ajouter un souhait</Btn>
          </div>
        </Card>
        <Card className="p-6">
          <SectionTitle>Exclusions</SectionTitle>
          <ListEditor items={d.exclusions} onChange={(v) => set("exclusions", v)} placeholder="Nouvelle exclusion" />
        </Card>
        <Card className="p-6">
          <SectionTitle>Signaux d'alerte à détecter</SectionTitle>
          <ListEditor items={d.redFlags} onChange={(v) => set("redFlags", v)} placeholder="Nouveau signal" />
        </Card>
      </div>
    </div>
  );
}

/* ── Motivations : le « pourquoi » (lettre, messages, entretien ; jamais le CV) ── */
function MotivationEditor() {
  const T = useT();
  const { profile, setProfile, draftMotivation, busy, toast } = useApp();
  const m = motivOf(profile);
  const setM = (patch) => setProfile((p) => ({ ...p, motivation: { ...motivOf(p), ...patch } }));
  /* Réponses conservées dans le profil (champ facultatif), pour reprendre l'entretien plus tard. */
  const answers = profile.motivationAnswers && typeof profile.motivationAnswers === "object" ? profile.motivationAnswers : {};
  const setAnswer = (id, a) => setProfile((p) => ({ ...p, motivationAnswers: { ...(p.motivationAnswers || {}), [id]: a } }));
  const [extra, setExtra] = useState([]);
  const questions = [...MOTIV_QUESTIONS, ...extra];
  const [step, setStep] = useState(0);
  const q = questions[Math.min(step, questions.length - 1)];
  const [prop, setProp] = useState(null);
  const [pick, setPick] = useState({});
  const answered = questions.filter((x) => str(answers[x.id])).length;
  const runDraft = async () => {
    const r = await draftMotivation(questions.map((x) => ({ field: x.field, q: x.q, a: answers[x.id] || "" })));
    if (!r) return;
    setProp(r);
    setPick({ ...Object.fromEntries(MOTIV_TEXT_FIELDS.map((f) => [f.id, !!r[f.id]])), convictions: r.convictions.length > 0, stories: r.stories.length > 0, sectors: r.sectors.length > 0 });
    if (r.followUps.length) {
      const fu = r.followUps.map((f, i) => ({ id: `fu-${Date.now().toString(36)}-${i}`, field: f.field, q: f.q, followUp: true }));
      setExtra((l) => [...l, ...fu]);
    }
  };
  const apply = () => {
    const cur = motivOf(profile);
    const patch = {};
    for (const f of MOTIV_TEXT_FIELDS) if (pick[f.id] && prop[f.id]) patch[f.id] = prop[f.id];
    const nid = (pre, list) => { let i = list.length + 1; while (list.some((x) => x.id === `${pre}${i}`)) i++; return `${pre}${i}`; };
    if (pick.convictions) { const l = [...cur.convictions]; prop.convictions.forEach((t) => { if (!l.some((c) => normText(c.text) === normText(t))) l.push({ id: nid("c", l), text: t }); }); patch.convictions = l; }
    if (pick.stories) { const l = [...cur.stories]; prop.stories.forEach((st) => l.push({ id: nid("s", l), ...st })); patch.stories = l; }
    if (pick.sectors) patch.sectors = [...new Set([...cur.sectors, ...prop.sectors])];
    setM(patch);
    setProp(null);
    toast("Motivations mises à jour", "ok");
  };
  const upConv = (id, text) => setM({ convictions: m.convictions.map((c) => (c.id === id ? { ...c, text } : c)) });
  const upStory = (id, k, v) => setM({ stories: m.stories.map((x) => (x.id === id ? { ...x, [k]: v } : x)) });
  const newId = (pre, list) => { let i = list.length + 1; while (list.some((x) => x.id === `${pre}${i}`)) i++; return `${pre}${i}`; };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-6 space-y-4 lg:col-span-2">
        <SectionTitle>Pourquoi cet onglet</SectionTitle>
        <p className={`text-sm ${T.muted}`}>Le CV prouve, la lettre explique. Ce que vous écrivez ici nourrit la lettre, le message LinkedIn, la réponse « Pourquoi nous ? » et la préparation d'entretien. Jamais le CV. L'IA reformule vos mots, elle n'ajoute rien : sans matière, elle écrit [à compléter].</p>
      </Card>

      <Card className="p-6 space-y-4 lg:col-span-2">
        <SectionTitle action={<span className={`text-xs ${T.muted}`}>{answered}/{questions.length} réponses</span>}>Entretien de motivation (IA)</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {questions.map((x, i) => (
            <button key={x.id} type="button" onClick={() => setStep(i)} aria-current={i === step} className={`w-8 h-8 rounded-full text-xs font-medium ${i === step ? "bg-indigo-600 text-white" : str(answers[x.id]) ? T.accentSoft : T.chip} ${T.ring}`} title={x.q}>{x.followUp ? "+" : i + 1}</button>
          ))}
        </div>
        <div>
          <div className="text-sm font-medium">{q.followUp ? "Relance : " : `${step + 1}. `}{q.q}</div>
          <Textarea rows={6} className="mt-2" value={answers[q.id] || ""} onChange={(e) => setAnswer(q.id, e.target.value)} placeholder="Répondez librement, comme à l'oral. Les faits et les chiffres que vous donnez sont repris tels quels." aria-label={q.q} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" icon={ChevronLeft} disabled={step === 0} onClick={() => setStep((n) => n - 1)}>Précédente</Btn>
          <Btn variant="soft" icon={ChevronRight} disabled={step >= questions.length - 1} onClick={() => setStep((n) => n + 1)}>Suivante</Btn>
          <Btn variant="primary" icon={Wand2} loading={busy["motiv-draft"]} disabled={answered < 3} onClick={runDraft}>Ranger mes réponses dans la fiche</Btn>
        </div>
        {prop && (
          <div className={`rounded-2xl p-4 space-y-3 ${T.sub}`}>
            <div className="text-sm font-medium">Proposition (reformulation de vos réponses)</div>
            {prop.inventedNumbers.length > 0 && <Notice tone="warn" icon={AlertTriangle}>Chiffres absents de vos réponses : {prop.inventedNumbers.join(", ")}. Décochez ou corrigez après reprise.</Notice>}
            {[...MOTIV_TEXT_FIELDS.map((f) => [f.id, f.label, prop[f.id]]), ["convictions", "Convictions (ajoutées)", prop.convictions.join(" · ")], ["stories", "Histoires (ajoutées)", prop.stories.map((x) => x.title || x.situation.slice(0, 50)).join(" · ")], ["sectors", "Secteurs (ajoutés)", prop.sectors.join(" · ")]].map(([id, label, val]) => (
              <label key={id} className={`flex gap-3 items-start text-sm ${val ? "" : "opacity-50"}`}>
                <input type="checkbox" className="mt-1" disabled={!val} checked={!!pick[id] && !!val} onChange={(e) => setPick({ ...pick, [id]: e.target.checked })} />
                <span className="min-w-0"><span className="font-medium">{label}</span><span className={`block text-xs ${T.muted}`}>{val || "rien dans vos réponses"}</span></span>
              </label>
            ))}
            {prop.followUps.length > 0 && <p className={`text-xs ${T.muted}`}>{prop.followUps.length} question(s) de relance ajoutée(s) à l'entretien (« + ») pour préciser des réponses trop vagues.</p>}
            <div className="flex gap-2">
              <Btn variant="primary" icon={Check} onClick={apply} disabled={!Object.values(pick).some(Boolean)}>Reprendre la sélection</Btn>
              <Btn variant="ghost" onClick={() => setProp(null)}>Ignorer</Btn>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <SectionTitle>Votre « pourquoi »</SectionTitle>
        {MOTIV_TEXT_FIELDS.map((f) => (
          <Field key={f.id} label={f.label} hint={f.hint}><Textarea rows={3} value={m[f.id]} onChange={(e) => setM({ [f.id]: e.target.value })} /></Field>
        ))}
        <Field label="Secteurs et organisations qui vous attirent"><ChipInput values={m.sectors} onChange={(v) => setM({ sectors: v })} placeholder="Ajouter…" /></Field>
      </Card>

      <div className="space-y-4">
        <Card className="p-6 space-y-3">
          <SectionTitle action={<Btn size="sm" variant="ghost" icon={Plus} onClick={() => setM({ convictions: [...m.convictions, { id: newId("c", m.convictions), text: "Nouvelle conviction" }] })}>Ajouter</Btn>}>Convictions</SectionTitle>
          {!m.convictions.length && <p className={`text-xs ${T.faint}`}>Une phrase par conviction, telle que vous la défendriez en entretien.</p>}
          {m.convictions.map((c) => (
            <div key={c.id} className="flex gap-2 items-start">
              <Chip>{c.id}</Chip>
              <Textarea rows={2} value={c.text} onChange={(e) => upConv(c.id, e.target.value)} aria-label={`Conviction ${c.id}`} />
              <IconBtn icon={X} label="Retirer" onClick={() => setM({ convictions: m.convictions.filter((x) => x.id !== c.id) })} />
            </div>
          ))}
        </Card>
        <Card className="p-6 space-y-3">
          <SectionTitle action={<Btn size="sm" variant="ghost" icon={Plus} onClick={() => setM({ stories: [...m.stories, { id: newId("s", m.stories), title: "Nouvelle histoire", situation: "", action: "", result: "", lesson: "" }] })}>Ajouter</Btn>}>Banque d'histoires</SectionTitle>
          {!m.stories.length && <p className={`text-xs ${T.faint}`}>2 à 5 histoires racontables : la lettre en raconte une, l'entretien s'en sert pour les réponses STAR.</p>}
          {m.stories.map((x) => (
            <div key={x.id} className={`rounded-2xl p-3 space-y-2 ${T.sub}`}>
              <div className="flex gap-2 items-center">
                <Chip>{x.id}</Chip>
                <Input value={x.title} onChange={(e) => upStory(x.id, "title", e.target.value)} aria-label="Titre" className="h-8" />
                <IconBtn icon={Trash2} label="Retirer" onClick={() => setM({ stories: m.stories.filter((y) => y.id !== x.id) })} />
              </div>
              {[["situation", "Situation"], ["action", "Ce que vous avez fait"], ["result", "Ce que ça a changé"], ["lesson", "Ce que vous en retenez"]].map(([k, l]) => (
                <Field key={k} label={l}><Textarea rows={2} value={x[k]} onChange={(e) => upStory(x.id, k, e.target.value)} /></Field>
              ))}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* ── Règles d'écriture (6a) : injectées dans toutes les rédactions ; prioritaires sur le style, jamais sur la vérité ── */
function WritingRulesEditor() {
  const T = useT();
  const { profile, setProfile, learnRules, busy } = useApp();
  const rules = writingRulesOf(profile);
  const learning = learningOf(profile);
  const pending = pendingLearnDocs(profile);
  const save = (l) => setProfile((p) => ({ ...p, writingRules: l }));
  const up = (id, patch) => save(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const newId = () => { let i = rules.length + 1; while (rules.some((r) => r.id === `r${i}`)) i++; return `r${i}`; };
  return (
    <div className="space-y-4 max-w-4xl">
      <Card className="p-6 space-y-2">
        <SectionTitle action={<Btn size="sm" variant="ghost" icon={Plus} onClick={() => save([...rules, { id: newId(), text: "Nouvelle règle", active: true, origin: "manuelle" }])}>Ajouter</Btn>}>Règles d'écriture</SectionTitle>
        <p className={`text-sm ${T.muted}`}>Injectées dans le CV, la lettre, les messages, les corrections, la relecture et la préparation d'entretien. Elles priment sur les consignes de style, jamais sur la vérité : une preuve absente de votre profil reste [à compléter]. Les règles « départ » sont à valider : modifiez-les ou désactivez-les.</p>
      </Card>
      <Card className="p-6 space-y-2">
        <SectionTitle>Apprendre de mes corrections</SectionTitle>
        <p className={`text-sm ${T.muted}`}>Chaque fois que vous enregistrez un CV ou une lettre retouché à la main, l'écart avec la version IA est mémorisé ({learning.edits.length} correction(s) en mémoire). À partir de 3 documents corrigés, l'IA propose les règles que vous appliquez de façon récurrente. Elles arrivent <strong>inactives</strong> : rien n'est activé sans vous.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={pending >= 3 ? "ok" : "neutral"}>{pending} document(s) corrigé(s) depuis le dernier apprentissage</Chip>
          {learning.lastLearnAt && <span className={`text-xs ${T.faint}`}>dernier : {fmtDate(learning.lastLearnAt)}</span>}
          <Btn size="sm" variant="primary" icon={Wand2} loading={busy["learn-rules"]} disabled={pending < 3} onClick={learnRules}>Proposer des règles</Btn>
        </div>
      </Card>
      {rules.map((r) => (
        <Card key={r.id} className="p-4">
          <div className="flex gap-3 items-start">
            <input type="checkbox" className="mt-2" checked={!!r.active} onChange={(e) => up(r.id, { active: e.target.checked })} aria-label="Règle active" />
            <div className="flex-1 min-w-0 space-y-1">
              <Textarea rows={2} value={r.text} onChange={(e) => up(r.id, { text: e.target.value })} aria-label={`Règle ${r.id}`} />
              <div className="flex flex-wrap gap-1.5 items-center">
                <Chip tone={r.active ? "ok" : r.origin === "apprise" ? "warn" : "neutral"}>{r.active ? "active" : r.origin === "apprise" ? "à valider" : "inactive"}</Chip>
                <Chip>{r.origin || "manuelle"}</Chip>
                {r.evidence && <span className={`text-xs ${T.muted}`}>Observé : {r.evidence}</span>}
              </div>
            </div>
            <IconBtn icon={Trash2} label="Supprimer" onClick={() => save(rules.filter((x) => x.id !== r.id))} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function ProfileEditor() {
  const T = useT();
  const { profile, setProfile } = useApp();
  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-6 space-y-4">
        <SectionTitle>Identité & résumé</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom et nom"><Input value={profile.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Poste actuel"><Input value={profile.headline} onChange={(e) => set("headline", e.target.value)} /></Field>
        </div>
        <Field label="Domicile"><Input value={profile.home} onChange={(e) => set("home", e.target.value)} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="E-mail (pour le CV)"><Input type="email" value={profile.email || ""} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Téléphone"><Input value={profile.phone || ""} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="URL LinkedIn"><Input value={profile.linkedinUrl || ""} onChange={(e) => set("linkedinUrl", e.target.value)} /></Field>
        </div>
        <Field label="Résumé"><Textarea rows={5} value={profile.summary} onChange={(e) => set("summary", e.target.value)} /></Field>
        <Field label="Compétences"><ChipInput values={profile.skills} onChange={(v) => set("skills", v)} placeholder="Ajouter une compétence…" /></Field>
        <Field label="Langues" hint="Format : langue (niveau), séparées par des virgules">
          <Input
            value={profile.languages.map((l) => `${l.lang} (${l.level})`).join(", ")}
            onChange={(e) => set("languages", e.target.value.split(",").map((s) => s.trim()).filter(Boolean).map((s) => { const m = s.match(/^(.*?)\s*\((.*)\)\s*$/); return m ? { lang: m[1], level: m[2] } : { lang: s, level: NC }; }))}
          />
        </Field>
      </Card>
      <Card className="p-6 space-y-4">
        <SectionTitle>Réalisations chiffrées</SectionTitle>
        <p className={`text-xs ${T.muted}`}>Base factuelle de tous les documents générés : l'IA n'invente aucun chiffre, elle marque les manques « [à compléter] ».</p>
        <ListEditor items={profile.achievements} onChange={(v) => set("achievements", v)} placeholder="Ex. Réduction de 30 % du temps de traitement des adhésions…" />
      </Card>
      <Card className="p-6 space-y-4">
        <SectionTitle>Formation</SectionTitle>
        <ListEditor items={profile.education || []} onChange={(v) => set("education", v)} placeholder="Ex. Master en … | Université | Année" />
      </Card>
      <Card className="p-6 space-y-4">
        <SectionTitle>Certifications</SectionTitle>
        <ListEditor items={profile.certifications || []} onChange={(v) => set("certifications", v)} placeholder="Ex. Microsoft Certified: Power Platform Functional Consultant" />
      </Card>
      <Card className="p-6 space-y-4 lg:col-span-2">
        <SectionTitle action={<Btn size="sm" variant="ghost" icon={Plus} onClick={() => set("experiences", [...profile.experiences, { id: uid("exp"), role: "", org: "", period: "", highlights: "" }])}>Ajouter</Btn>}>Expériences clés</SectionTitle>
        {profile.experiences.map((x, i) => {
          const up = (k, v) => set("experiences", profile.experiences.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
          return (
            <div key={x.id} className={`rounded-2xl p-4 space-y-3 ${T.sub}`}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Fonction"><Input value={x.role} onChange={(e) => up("role", e.target.value)} /></Field>
                <Field label="Organisation"><Input value={x.org} onChange={(e) => up("org", e.target.value)} /></Field>
                <Field label="Période"><Input value={x.period} onChange={(e) => up("period", e.target.value)} /></Field>
              </div>
              <Field label="Points saillants"><Textarea rows={3} value={x.highlights} onChange={(e) => up("highlights", e.target.value)} /></Field>
              <Btn size="sm" variant="ghost" icon={Trash2} onClick={() => set("experiences", profile.experiences.filter((_, j) => j !== i))}>Retirer</Btn>
            </div>
          );
        })}
      </Card>
      <Card className="p-6 lg:col-span-2">
        <SectionTitle>CV complet (texte collé)</SectionTitle>
        <Textarea rows={14} value={profile.cvText} onChange={(e) => set("cvText", e.target.value)} placeholder="Collez ici votre CV en texte brut. Il sert de base aux CV adaptés, lettres et exemples STAR." />
      </Card>
    </div>
  );
}

function CriteriaHistory() {
  const T = useT();
  const { criteria, restoreVersion, runWatch, busy, offers } = useApp();
  const versions = criteria.versions;
  const active = activeVersion(criteria)?.id;
  return (
    <div className="space-y-3">
      {[...versions].reverse().map((v) => {
        const i = versions.findIndex((x) => x.id === v.id);
        const diff = diffCriteria(criteriaBody(versions[i - 1]), criteriaBody(v));
        const scored = offers.filter((o) => o.score?.criteriaVersionId === v.id).length;
        return (
          <Card key={v.id} className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <History className={`w-4 h-4 ${T.muted}`} aria-hidden="true" />
                  <span className="font-medium">{v.label}</span>
                  {v.id === active && <Chip tone="accent">active</Chip>}
                </div>
                <div className={`text-xs mt-1 ${T.faint}`}>{fmtDate(v.createdAt, { time: true })} · {scored} offre(s) scorée(s) avec cette version</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Btn size="sm" icon={Play} loading={busy.watch} onClick={() => runWatch({ version: v })}>Relancer la veille avec cette version</Btn>
                {v.id !== active && <Btn size="sm" variant="ghost" icon={RotateCcw} onClick={() => restoreVersion(v.id)}>Restaurer</Btn>}
              </div>
            </div>
            <ul className={`mt-4 space-y-1 text-sm ${T.muted}`}>
              {diff.slice(0, 12).map((l, k) => <li key={k} className="tabular-nums">{l}</li>)}
              {diff.length > 12 && <li className={T.faint}>… {diff.length - 12} autre(s) changement(s)</li>}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   19. CONFIDENTIALITÉ & DONNÉES
   ════════════════════════════════════════════════════════════════════════ */

function PrivacyView() {
  const T = useT();
  const { settings, setSettings, exportPayload, importPayload, resetAll, clearDemo, loadDemo, hasDemo, toast, offers, apps, contacts } = useApp();
  const [showJson, setShowJson] = useState(false);
  const [paste, setPaste] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");
  const [test, setTest] = useState(null);
  const fileRef = useRef(null);
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const json = useMemo(() => (showJson ? JSON.stringify(exportPayload(), null, 2) : ""), [showJson]); // eslint-disable-line react-hooks/exhaustive-deps

  const download = async () => {
    const filename = `radar-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    if (RT.mode === "published") {
      if (!RT.downloads) { setShowJson(true); toast("Téléchargement indisponible ici : copiez le JSON affiché.", "warn"); return; }
      try {
        await RT.downloads.save({ filename, data: JSON.stringify(exportPayload(), null, 2) });
        toast("Sauvegarde proposée au téléchargement", "ok");
      } catch (e) {
        if (e?.code !== "declined" && e?.code !== "cancelled") { setShowJson(true); toast("Téléchargement impossible : copiez le JSON affiché.", "warn"); }
      }
      return;
    }
    try {
      const blob = new Blob([JSON.stringify(exportPayload(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `radar-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast("Sauvegarde téléchargée. Si rien ne se passe, utilisez « Afficher le JSON ».", "ok");
    } catch (e) {
      setShowJson(true);
      toast(`Téléchargement bloqué (${e.message}) : copiez le JSON affiché.`, "warn");
    }
  };
  const doImport = (text) => {
    try { importPayload(JSON.parse(text)); setPaste(""); }
    catch (e) { toast(`Import impossible : ${e.message}`, "danger"); }
  };
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => doImport(String(r.result));
    r.onerror = () => toast("Lecture du fichier impossible", "danger");
    r.readAsText(f);
    e.target.value = "";
  };
  const testApi = async () => {
    setTest({ state: "loading" });
    try {
      const r = await callClaude(settings, { system: "Réponds uniquement {\"ok\":true}.", prompt: "Test de connexion.", maxTokens: 50 });
      setTest({ state: "ok", text: `API joignable · modèle ${r.model}` });
    } catch (e) {
      setTest({ state: "error", text: e.message });
    }
  };

  return (
    <div>
      <PageHeader title="Confidentialité & données" subtitle="Rien n'est envoyé sans votre action explicite. Vos données restent dans le stockage de l'artefact." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <SectionTitle>Discrétion</SectionTitle>
          <Toggle checked={settings.discreet} onChange={(v) => set("discreet", v)} label="Mode discret" description="Chaque brouillon Gmail ou événement d'agenda affiche un aperçu et demande confirmation." />
          <Toggle checked={settings.discreetCalendarTitles} onChange={(v) => set("discreetCalendarTitles", v)} label="Titres d'agenda neutres" description="« Perso · Entretien » plutôt que le nom de l'entreprise." />
          <Field label="Employeur actuel (déclenche un avertissement s'il apparaît dans un document)" className="mt-4">
            <ChipInput values={settings.employerNames} onChange={(v) => set("employerNames", v)} placeholder="Nom, sigle…" />
          </Field>
          <div className={`mt-6 rounded-2xl p-4 text-sm ${T.sub}`}>
            <div className="font-medium mb-2">Ce qui quitte cet écran</div>
            <ul className={`space-y-1.5 ${T.muted}`}>
              <li>• Vers l'API Claude : profil, critères et offres nécessaires à chaque analyse demandée.</li>
              <li>• Vers la recherche web : des requêtes génériques (intitulés, zones) — jamais votre nom.</li>
              <li>• Vers Gmail : lecture des alertes emploi (à l'import) et création de brouillons (sur confirmation).</li>
              <li>• Vers Google Calendar : les événements que vous confirmez.</li>
              <li>• Rien n'est jamais envoyé à un recruteur ni publié.</li>
            </ul>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle>Scoring</SectionTitle>
          <Field label={`Seuil d'intérêt : ${settings.threshold}`}>
            <input type="range" min={40} max={95} step={5} value={settings.threshold} onChange={(e) => set("threshold", Number(e.target.value))} className="w-full" aria-label="Seuil d'intérêt" />
          </Field>
          <Toggle checked={settings.autoRescore} onChange={(v) => set("autoRescore", v)} label="Recalcul automatique" description="Re-score les 40 offres les plus récentes quand une nouvelle version de critères est enregistrée." />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Field label="Fraîcheur des annonces (jours)"><Input type="number" min={3} max={90} value={settings.lookbackDays} onChange={(e) => set("lookbackDays", clamp(Number(e.target.value) || 30, 3, 90))} /></Field>
            <Field label="Offres max par source"><Input type="number" min={3} max={20} value={settings.maxPerSource} onChange={(e) => set("maxPerSource", clamp(Number(e.target.value) || 10, 3, 20))} /></Field>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle action={<Btn size="sm" variant="ghost" icon={Gauge} onClick={testApi} loading={test?.state === "loading"}>Tester l'API</Btn>}>IA & connecteurs</SectionTitle>
          {RT.mode === "published" && (
            <Notice icon={Info} className="mb-4">
              Version publiée : l'IA passe par votre compte claude.ai (une autorisation est demandée au premier appel) et Gmail / Google Calendar par vos connecteurs claude.ai. Les réglages de modèle et d'URL ci-dessous ne s'appliquent qu'à la version « chat ». La veille web n'est disponible que dans cette dernière.
            </Notice>
          )}
          {test && test.state !== "loading" && <Notice tone={test.state === "ok" ? "ok" : "danger"} className="mb-4">{test.text}</Notice>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Modèle"><Input value={settings.model} onChange={(e) => set("model", e.target.value.trim())} /></Field>
            <Field label="Modèle de repli"><Input value={settings.fallbackModel} onChange={(e) => set("fallbackModel", e.target.value.trim())} /></Field>
          </div>
          <Field label="URL MCP Gmail" className="mt-3"><Input value={settings.mcp.gmail} onChange={(e) => set("mcp", { ...settings.mcp, gmail: e.target.value.trim() })} /></Field>
          <Field label="URL MCP Google Calendar" className="mt-3"><Input value={settings.mcp.gcal} onChange={(e) => set("mcp", { ...settings.mcp, gcal: e.target.value.trim() })} /></Field>
          <Field label="Format de connexion MCP" className="mt-3" hint="« Auto » essaie le format des artefacts claude.ai puis le format API récent.">
            <Select value={settings.mcpMode} onChange={(e) => set("mcpMode", e.target.value)} className="w-full">
              <option value="auto">Auto</option>
              <option value="legacy">mcp_servers seul</option>
              <option value="toolset">mcp_servers + mcp_toolset</option>
            </Select>
          </Field>
          <Toggle checked={settings.restrictTools} onChange={(v) => set("restrictTools", v)} label="Restreindre les outils MCP (recommandé)" description="Seuls les outils listés ci-dessous sont exposés à l'IA : l'envoi d'e-mail est techniquement impossible." />
          {settings.restrictTools && (
            <div className="space-y-3 mt-2">
              {[["gmailRead", "Gmail — import (lecture)"], ["gmailDraft", "Gmail — brouillons"], ["gcal", "Google Calendar"]].map(([k, l]) => (
                <Field key={k} label={l}><ChipInput values={settings.mcpTools[k]} onChange={(v) => set("mcpTools", { ...settings.mcpTools, [k]: v })} placeholder="nom_d_outil" /></Field>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <SectionTitle>Sauvegarde & données</SectionTitle>
          <p className={`text-sm mb-4 ${T.muted}`}>{offers.length} offre(s) · {apps.length} candidature(s) · {contacts.length} contact(s)</p>
          <div className="flex flex-wrap gap-2">
            <Btn icon={Download} onClick={download}>Exporter (JSON)</Btn>
            <Btn variant="ghost" onClick={() => setShowJson(!showJson)}>{showJson ? "Masquer" : "Afficher"} le JSON</Btn>
            <Btn icon={Upload} onClick={() => fileRef.current?.click()}>Importer un fichier</Btn>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} aria-label="Fichier de sauvegarde" />
          </div>
          {showJson && (
            <div className="mt-4">
              <div className="flex justify-end mb-1"><CopyBtn text={json} /></div>
              <Textarea readOnly rows={8} value={json} aria-label="Sauvegarde JSON" className="text-xs" />
            </div>
          )}
          <Field label="…ou coller une sauvegarde JSON" className="mt-4">
            <Textarea rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder='{"app":"radar-emploi", …}' />
          </Field>
          <Btn className="mt-2" size="sm" disabled={!paste.trim()} onClick={() => doImport(paste)}>Importer le JSON collé</Btn>

          <div className={`mt-6 pt-6 border-t ${T.line} flex flex-wrap gap-2`}>
            {hasDemo ? <Btn icon={Trash2} onClick={clearDemo}>Supprimer les données d'exemple</Btn> : <Btn variant="ghost" onClick={loadDemo}>Recharger les exemples</Btn>}
            <Btn variant="danger" icon={RotateCcw} onClick={() => setResetOpen(true)}>Réinitialiser</Btn>
          </div>
        </Card>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Réinitialiser la plateforme"
        footer={<><Btn variant="ghost" onClick={() => setResetOpen(false)}>Annuler</Btn><Btn variant="danger" disabled={resetText !== "EFFACER"} onClick={async () => { await resetAll(); setResetOpen(false); setResetText(""); }}>Tout effacer</Btn></>}
      >
        <p className="text-sm mb-4">Toutes les offres, candidatures, contacts, versions de critères et réglages seront supprimés. Exportez une sauvegarde avant. Tapez <strong>EFFACER</strong> pour confirmer.</p>
        <Input value={resetText} onChange={(e) => setResetText(e.target.value)} aria-label="Confirmation" data-autofocus />
      </Modal>
    </div>
  );
}
