/**
 * Radar — plateforme personnelle de veille emploi & pilotage de candidatures.
 * Artefact React (fichier unique) · Tailwind (classes de base) · lucide-react · recharts.
 * Persistance : window.storage (jamais localStorage).
 * IA : API Claude appelée depuis l'artefact (web_search + serveurs MCP Gmail / Google Calendar).
 * Principe : l'IA prépare, l'utilisateur valide. Rien n'est envoyé sans action explicite.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback, useContext, createContext } from "react";
import {
  LayoutDashboard, Briefcase, Columns, Sparkles, BellRing, Users, Radio, User, ShieldCheck, Search,
  Command, Play, Loader2, Plus, X, ChevronRight, ChevronsLeft, ChevronsRight, ExternalLink, Mail,
  CalendarPlus, Copy, Check, Trash2, Download, Upload, RotateCcw, Moon, Sun, Monitor, AlertTriangle,
  Info, Clock, Menu, History, FileText, RefreshCw, Building2, Inbox,
  Clipboard, Wand2, Flag, HelpCircle, Eye, EyeOff, Save, Target, Gauge, ArrowRight, CheckCircle2, Linkedin, TrendingUp, Pencil, Phone, GitMerge, Undo2, MailCheck, Palette, ChevronLeft, Filter, Link2, CalendarClock, CalendarDays, Unlink,
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
};

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
    const hi = list.findIndex((o) => sameOffer(o, inc));
    if (hi >= 0) {
      const hit = { ...list[hi] };
      list[hi] = hit;
      const srcs = [...(hit.sources || [])];
      for (const s of inc.sources) if (!srcs.some((x) => canonicalUrl(x.url) === canonicalUrl(s.url) && x.name === s.name)) srcs.push(s);
      for (const k of FILLABLE) if ((hit[k] === null || hit[k] === undefined || hit[k] === "") && inc[k]) hit[k] = inc[k];
      if (hit.publishedApprox && inc.publishedAt && !inc.publishedApprox) { hit.publishedAt = inc.publishedAt; delete hit.publishedApprox; }
      if (inc.description && (!hit.description || inc.description.length > hit.description.length)) hit.description = inc.description;
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
    if (list[i].demo) continue;
    for (let j = i + 1; j < n; j++) {
      if (list[j].demo || find(i) === find(j) || !sameOffer(list[i], list[j])) continue;
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
const isActiveOffer = (o) => !INACTIVE.includes(o.status);
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
  if (!rules?.enabled || !o || o.demo || o.userKept || !["new"].includes(o.status)) return null;
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

/* ── Documents « prêts à envoyer » : balisage léger → aperçu, texte ATS et PDF ──
   # Nom · > accroche (CV) ou destinataire (lettre) · @ coordonnées · = date · ## section / objet
   ### Poste | Organisation | Lieu | Période · - puce · **Libellé :** valeur · ~ signature · ligne vide = paragraphe */
function parseDoc(text) {
  const blocks = [];
  let para = [];
  const flush = () => { if (para.length) { blocks.push({ t: "para", text: para.join(" ") }); para = []; } };
  for (const raw of String(text || "").split("\n")) {
    const l = raw.trim();
    let m;
    if (!l) { flush(); continue; }
    if (l.startsWith("### ")) { flush(); blocks.push({ t: "h3", text: l.slice(4) }); }
    else if (l.startsWith("## ")) { flush(); blocks.push({ t: "h2", text: l.slice(3) }); }
    else if (l.startsWith("# ")) { flush(); blocks.push({ t: "name", text: l.slice(2) }); }
    else if (/^[-•*] /.test(l)) { flush(); blocks.push({ t: "bullet", text: l.slice(2) }); }
    else if (l.startsWith("> ")) { flush(); blocks.push({ t: "quote", text: l.slice(2) }); }
    else if (l.startsWith("@ ")) { flush(); blocks.push({ t: "contact", text: l.slice(2) }); }
    else if (l.startsWith("= ")) { flush(); blocks.push({ t: "date", text: l.slice(2) }); }
    else if (l.startsWith("~ ")) { flush(); blocks.push({ t: "sign", text: l.slice(2) }); }
    else if ((m = l.match(/^\*\*(.+?)\*\*\s*(.*)$/))) { flush(); blocks.push({ t: "kv", label: m[1], text: m[2] }); }
    else para.push(l);
  }
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
function keywordCoverage(text, terms) {
  const hay = ` ${normText(text)} `;
  const list = (terms || []).filter(Boolean);
  const covered = list.filter((t) => hay.includes(` ${normText(t)} `) || hay.includes(normText(t)));
  return { covered, missing: list.filter((t) => !covered.includes(t)), pct: list.length ? Math.round((covered.length / list.length) * 100) : null };
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
const pdfSafe = (t) => String(t || "")
  .replace(/[\u2018\u2019\u201A\u2032]/g, "'").replace(/[\u201C\u201D\u201E\u2033]/g, '"')
  .replace(/[\u2013\u2014\u2212]/g, "-").replace(/\u2026/g, "...").replace(/\u20AC/g, "EUR")
  .replace(/\u0153/g, "oe").replace(/\u0152/g, "OE").replace(/[\u00A0\u202F\u2009]/g, " ").replace(/[\u2022\u25CF\u25AA]/g, "-")
  .replace(/[^\x00-\xFF]/g, "");

async function buildDocPdf(text, { accent, kind, title, keywords, author }) {
  const { jsPDF } = await loadJsPDF();
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: pdfSafe(title), subject: kind === "cv" ? "Curriculum vitae" : "Lettre de motivation", author: pdfSafe(author || ""), keywords: pdfSafe((keywords || []).join(", ")), creator: "Radar" });
  const A = hexRgb(accent);
  const M = 18, W = 210 - 2 * M, BOTTOM = 297 - 16;
  let y = 18;
  const lh = (size) => size * 0.3528 * 1.38;
  const ensure = (h) => { if (y + h > BOTTOM) { doc.addPage(); y = 18; } };
  const font = (size, style = "normal", color = [45, 45, 45]) => { doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color); };
  const write = (txt, { size = 10, style = "normal", color = [45, 45, 45], indent = 0, after = 1.4, align } = {}) => {
    font(size, style, color);
    const lines = doc.splitTextToSize(pdfSafe(txt), W - indent);
    for (const line of lines) {
      ensure(lh(size));
      if (align === "right") doc.text(line, M + W, y + lh(size) * 0.78, { align: "right" });
      else doc.text(line, M + indent, y + lh(size) * 0.78);
      y += lh(size);
    }
    y += after;
  };
  const blocks = parseDoc(text);
  let seenName = false;
  for (const b of blocks) {
    if (b.t === "name") { seenName = true; write(b.text, { size: kind === "cv" ? 22 : 16, style: "bold", color: A, after: 0.6 }); }
    else if (b.t === "quote") {
      if (kind === "cv") write(b.text, { size: 12, color: [70, 70, 70], after: 1 });
      else write(b.text, { size: 10, after: 0.2 });
    }
    else if (b.t === "contact") {
      write(b.text, { size: 9, color: [110, 110, 110], after: 1.6 });
      if (seenName) { doc.setDrawColor(...A); doc.setLineWidth(0.7); doc.line(M, y, M + W, y); y += 5; }
    }
    else if (b.t === "date") { y += 2; write(b.text, { size: 10, color: [90, 90, 90], align: "right", after: 3 }); }
    else if (b.t === "h2") {
      if (kind === "cv") {
        ensure(16); y += 2.5;
        write(b.text.toUpperCase(), { size: 10.5, style: "bold", color: A, after: 0.4 });
        doc.setDrawColor(215, 215, 215); doc.setLineWidth(0.25); doc.line(M, y, M + W, y); y += 2.6;
      } else { y += 2; write(b.text, { size: 10.5, style: "bold", color: [30, 30, 30], after: 3 }); }
    }
    else if (b.t === "h3") {
      const parts = b.text.split("|").map((x) => x.trim()).filter(Boolean);
      ensure(12); y += 0.8;
      write(parts[0] || "", { size: 10.5, style: "bold", color: [25, 25, 25], after: 0.2 });
      if (parts.length > 1) write(parts.slice(1).join("  ·  "), { size: 9, color: [115, 115, 115], after: 1 });
    }
    else if (b.t === "bullet") {
      ensure(lh(10));
      doc.setFillColor(...A); doc.circle(M + 1.3, y + lh(10) * 0.5, 0.65, "F");
      write(b.text, { indent: 4.5, after: 0.7 });
    }
    else if (b.t === "kv") {
      font(10, "bold", [30, 30, 30]);
      const label = `${pdfSafe(b.label)} `;
      const lw = doc.getTextWidth(label);
      font(10);
      const first = doc.splitTextToSize(pdfSafe(b.text), W - lw);
      ensure(lh(10));
      font(10, "bold", [30, 30, 30]); doc.text(label, M, y + lh(10) * 0.78);
      font(10); doc.text(first[0] || "", M + lw, y + lh(10) * 0.78);
      y += lh(10);
      const rest = first.slice(1).join(" ");
      if (rest) write(rest, { after: 0.9 }); else y += 0.9;
    }
    else if (b.t === "sign") { y += 4; write(b.text, { style: "bold", after: 1 }); }
    else write(b.text, { after: kind === "cv" ? 1.8 : 3.2 });
  }
  const pages = doc.getNumberOfPages();
  if (pages > 1) for (let i = 1; i <= pages; i++) { doc.setPage(i); font(8, "normal", [150, 150, 150]); doc.text(`${i} / ${pages}`, M + W, 297 - 9, { align: "right" }); }
  return doc.output("arraybuffer");
}

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

const activeVersion = (criteria) => criteria?.versions?.[criteria.versions.length - 1] || null;
const isStale = (offer, versionId) => !offer.score || offer.score.criteriaVersionId !== versionId || (!offer.demo && offer.score.method !== 2);
const offerLang = (o) => o?.language || "fr";
const LANG_NAME = { fr: "français", nl: "néerlandais", en: "anglais" };

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
    const r = await RT.sample(`${system}\n\n${prompt}${note}`, tools.length ? { tools } : {});
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

const P = {
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

  dossier(offer, profile, types, instruction) {
    const lang = offer.language ? LANG_NAME[offer.language] : "celle de l'annonce (détecte-la)";
    return `Mission : préparer des documents de candidature pour l'offre ci-dessous. Le candidat relira, modifiera et validera tout : rien n'est envoyé automatiquement.

OFFRE
Intitulé : ${offer.title}
Entreprise : ${show(offer.company)}
Lieu : ${show(offer.location)}
Contrat : ${show(offer.contract)} · Télétravail : ${show(offer.remote)}
Annonce (résumé) : ${show(offer.description)}
URL : ${show(offer.sources?.[0]?.url)}

PROFIL
${profileDigest(profile, true)}

DOCUMENTS DEMANDÉS : ${types.join(", ")}

CONSIGNES
- Langue : ${lang}.
- Ton naturel, précis, orienté résultats ; phrases courtes. Aucun cliché ni superlatif (« passionné », « dynamique », « force de proposition », « je me permets », « n'hésitez pas », « fort de », « motivé et rigoureux », « challenge »…).
- N'utilise que des faits présents dans le profil. Aucun chiffre inventé. Si un élément utile manque, écris [à compléter : …].
- Discrétion : le candidat est en poste. Désigne l'employeur actuel de façon générique (« une fédération patronale belge ») plutôt que par son nom.
- cv : CV adapté en texte brut (titre, accroche de 3 lignes, expériences réordonnées selon le poste, compétences), plus 4 à 6 points clés à mettre en avant.
- letter : 250 à 350 mots, 3 ou 4 paragraphes, lien concret entre les réalisations et les missions.
- linkedin : 300 caractères maximum, adressé au recruteur ou au hiring manager, personnalisé.
- answers : 5 à 7 questions probables du formulaire (motivation, prétentions salariales formulées sans chiffre inventé, préavis, disponibilité, télétravail, langues…) avec réponses.
- email : objet et corps courts (120 mots max) mentionnant CV et lettre en pièces jointes.
${instruction ? `- Instruction spécifique de l'utilisateur : ${instruction}` : ""}

Réponds uniquement avec ce JSON (n'inclus que les documents demandés) :
{"language":"fr|nl|en","cv":{"text":"","highlights":[]},"letter":{"text":""},"linkedin":{"text":""},"answers":{"items":[{"question":"","answer":""}]},"email":{"subject":"","body":""}}`;
  },

  cvPro(offer, profile, parts, instruction) {
    const lang = offer.language ? LANG_NAME[offer.language] : "celle de l'annonce (détecte-la)";
    const contact = [profile.home, profile.email, profile.phone, profile.linkedinUrl].filter(Boolean).join(" | ") || "[à compléter : coordonnées]";
    return `Mission : produire des documents de candidature PRÊTS À ENVOYER pour l'offre ci-dessous, optimisés à la fois pour les logiciels de tri (ATS) et pour un recruteur humain qui reçoit des centaines de candidatures. Le candidat relira tout avant envoi.

OFFRE
Intitulé : ${offer.title}
Entreprise : ${show(offer.company)}
Lieu : ${show(offer.location)} · Contrat : ${show(offer.contract)} · Télétravail : ${show(offer.remote)}
Annonce : ${show(offer.description)}

PROFIL
Nom : ${profile.name || "[à compléter : prénom nom]"}
Coordonnées : ${contact}
${profileDigest(profile, true)}
Formation : ${(profile.education || []).join(" ; ") || "[à compléter]"}
Certifications : ${(profile.certifications || []).join(" ; ") || "aucune renseignée"}

DOCUMENTS À PRODUIRE : ${parts.join(", ")}

RÈGLES DE FOND
- Langue : ${lang}. Titres de sections standard dans cette langue (FR : Profil, Réalisations clés, Expérience professionnelle, Compétences, Langues, Formation, Certifications ; NL : Profiel, Belangrijkste realisaties, Werkervaring, Vaardigheden, Talen, Opleiding ; EN : Profile, Key achievements, Professional experience, Skills, Languages, Education).
- Vérité absolue : uniquement des faits du profil. Aucun chiffre, diplôme, outil ou résultat inventé. Manque → [à compléter : …].
- ATS : reprends mot pour mot les termes de l'annonce quand le profil les justifie (intitulé, compétences, outils, méthodes), avec acronyme et forme longue (ex. « CRM (Customer Relationship Management) »). Mise en page à une colonne, aucun tableau. L'accroche reprend l'intitulé exact du poste.
- Humain : proposition de valeur claire en 2 lignes pour CETTE entreprise ; 3 réalisations chiffrées en tête ; puces « verbe d'action + périmètre + résultat » ; zéro cliché ni superlatif ; phrases courtes.
- Différenciation : relie explicitement 2 ou 3 exigences de l'annonce à des preuves du profil ; dans la lettre, ouvre sur un élément précis de l'annonce ou du contexte de l'entreprise (seulement ce que l'annonce dit, ou un fait public certain), jamais sur « je me permets de… ».
- Organisation actuelle : reprends exactement le libellé du profil dans le CV ; dans la lettre, désigne-la de façon générique.
- Longueur : CV 1 à 2 pages (550 à 800 mots), lettre 230 à 320 mots.
${instruction ? `- Consigne de l'utilisateur : ${instruction}` : ""}

FORMAT DES DOCUMENTS (balisage léger, une instruction par ligne)
CV :
# Prénom Nom
> Accroche reprenant l'intitulé du poste — proposition de valeur
@ ${contact}
## Profil
paragraphe de 3-4 lignes
## Réalisations clés
- réalisation chiffrée
## Expérience professionnelle
### Fonction | Organisation | Lieu | Période
- puce
## Compétences
**Groupe :** élément, élément, élément
## Langues
**Français :** niveau
## Formation
### Diplôme | École | Année
Lettre :
# Prénom Nom
@ coordonnées
= Lieu, le JJ mois AAAA
> Destinataire (service recrutement / nom si connu)
> Entreprise
## Objet : candidature au poste de …
paragraphes séparés par une ligne vide (accroche, preuves, valeur pour l'entreprise, conclusion avec appel à l'entretien)
~ Prénom Nom

COULEUR : accent = la couleur principale de la charte de l'entreprise en hexadécimal SEULEMENT si tu la connais avec certitude, sinon null.

Réponds uniquement avec ce JSON (n'inclus que les documents demandés) :
{"language":"fr|nl|en","accent":"#RRGGBB ou null","accentSource":"charte connue | null","keywords":{"fromAd":["15 à 25 termes exacts de l'annonce"],"missingInProfile":["termes de l'annonce que le profil ne permet pas de justifier"]},"cv":"<balisage>","letter":"<balisage>","tips":["3 conseils concrets pour sortir du lot sur CETTE offre"]}`;
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

  prep(offer, profile) {
    return `Date du jour : ${todayStr()}.
Mission : préparer un entretien pour le poste « ${offer.title} » chez « ${show(offer.company)} ».
Annonce : ${show(offer.description)}

PROFIL
${profileDigest(profile, true)}

1. Utilise web_search pour documenter l'entreprise (activité, taille, organisation, actualité des 12 derniers mois, culture, avis publics). Chaque fait doit citer l'URL de sa source. Si une information n'est pas trouvée, ne la mentionne pas.
2. Questions probables pour ce poste, avec l'angle attendu.
3. Exemples STAR construits UNIQUEMENT à partir du profil ; si un élément manque, écris [à compléter].
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

function Drawer({ open, onClose, title, subtitle, children, headerExtra }) {
  const T = useT();
  const ref = useRef(null);
  useFocusTrap(open, ref, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0" style={{ background: "rgba(12,10,9,0.25)" }} onClick={onClose} />
      <aside ref={ref} className={`absolute right-0 top-0 h-full w-full sm:max-w-2xl flex flex-col ${T.app}`} style={T.shadow}>
        <div className={`flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b ${T.line}`}>
          <div className="min-w-0">
            <h2 className="text-xl font-light tracking-tight leading-snug">{title}</h2>
            {subtitle && <div className={`text-sm mt-1 ${T.muted}`}>{subtitle}</div>}
            {headerExtra}
          </div>
          <IconBtn icon={X} label="Fermer" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </aside>
    </div>
  );
}

function Tabs({ tabs, value, onChange }) {
  const T = useT();
  return (
    <div role="tablist" className={`inline-flex flex-wrap gap-1 p-1 rounded-2xl ${T.sub}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`px-3 h-8 rounded-xl text-sm transition-colors duration-150 ${value === t.id ? `${T.navActive} font-medium` : T.muted} ${T.ring}`}
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
  const [veille, setVeille] = useState({ routine: null, status: null, configSig: null, configLoaded: false });
  const veilleRef = useRef(veille);
  veilleRef.current = veille;

  const prefersDark = usePrefersDark();
  const dark = settings.theme === "dark" || (settings.theme === "system" && prefersDark);
  const T = dark ? THEMES.dark : THEMES.light;

  /* Référence toujours à jour pour les traitements asynchrones longs. */
  const R = useRef({});
  R.current = { settings, profile, criteria, sources, offers, apps, contacts, ratings };
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
    const targets = R.current.offers.filter((o) => ids.includes(o.id));
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
    return offers.filter((o) => !o.demo && ["new", "pipeline"].includes(o.status) && isStale(o, vid)).map((o) => o.id);
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
        .filter((o) => !o.demo && ["new", "pipeline"].includes(o.status) && isStale(o, vid) && !a.failed.has(o.id))
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
    .filter((o) => ids.includes(o.id) && (o.sources || []).some((x) => x.url))
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
      .filter((o) => !o.demo && ["new", "pipeline"].includes(o.status) && due(o) && (o.sources || []).some((x) => x.url))
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
  const generateDocs = (appId, types, instruction) => withBusy(`dossier:${appId}`, async () => {
    const { settings: s, profile: p } = R.current;
    const app = R.current.apps.find((a) => a.id === appId);
    const offer = R.current.offers.find((o) => o.id === app?.offerId);
    if (!app || !offer) throw new Error("Candidature introuvable.");
    const proParts = types.filter((t) => t === "cv" || t === "letter");
    const otherParts = types.filter((t) => !proParts.includes(t));
    const [pro, rest] = await Promise.all([
      proParts.length ? askJSON(s, { system: SYSTEM_BASE, prompt: P.cvPro(offer, p, proParts, instruction), maxTokens: 16000 }) : null,
      otherParts.length ? askJSON(s, { system: SYSTEM_BASE, prompt: P.dossier(offer, p, otherParts, instruction), maxTokens: 12000 }) : null,
    ]);
    const data = { ...(rest?.data || {}), language: pro?.data?.language || rest?.data?.language };
    const versions = {};
    if (pro?.data) {
      const d = pro.data;
      const accent = cleanHex(d.accent, null);
      const common = { accent, accentSource: accent ? str(d.accentSource) || "suggérée" : null, keywords: (d.keywords?.fromAd || []).map(String).slice(0, 30), missingInProfile: (d.keywords?.missingInProfile || []).map(String), tips: (d.tips || []).map(String) };
      for (const t of proParts) {
        const txt = typeof d[t] === "string" ? d[t].trim() : "";
        if (txt) versions[t] = { text: txt, format: "markup", ...common, id: uid("doc"), createdAt: nowISO(), origin: "IA", instruction: str(instruction) };
      }
    }
    for (const t of otherParts) {
      const d = data?.[t];
      if (!d) continue;
      let v;
      if (t === "answers") v = { text: (d.items || []).map((x) => `Q. ${x.question}\n${x.answer}`).join("\n\n") };
      else if (t === "email") v = { subject: d.subject || "", text: d.body || "" };
      else if (t === "cv") v = { text: d.text || "", highlights: (d.highlights || []).map(String) };
      else v = { text: d.text || "" };
      if (!v.text) continue;
      versions[t] = { ...v, id: uid("doc"), createdAt: nowISO(), origin: "IA", instruction: str(instruction) };
    }
    if (!Object.keys(versions).length) throw new Error("Aucun document reçu de l'IA.");
    patchApp(appId, (a) => {
      const docs = { ...(a.docs || {}) };
      for (const [t, v] of Object.entries(versions)) docs[t] = [...(docs[t] || []), v];
      const n = { ...a, docs, docLanguage: data.language || a.docLanguage };
      if (["new", "retained"].includes(a.stage)) n.stage = "prep";
      return addLogEntry(n, "doc", `Généré : ${Object.keys(versions).map((t) => DOC_LABEL[t]).join(", ")}`);
    });
    toast("Documents prêts à relire", "ok");
  });

  const saveDocVersion = (appId, type, text, subject, extra = {}) => patchApp(appId, (a) => {
    const prev = a.docs?.[type]?.slice(-1)[0];
    const { id: _i, createdAt: _c, origin: _o, instruction: _n, ...keep } = prev || {};
    const v = { ...keep, ...extra, id: uid("doc"), text, subject, createdAt: nowISO(), origin: "édition" };
    return addLogEntry({ ...a, docs: { ...a.docs, [type]: [...(a.docs?.[type] || []), v] } }, "doc", `${DOC_LABEL[type]} : nouvelle version (édition manuelle)`);
  });

  /* ── Relances ───────────────────────────────────────────────────── */
  const setFollowUp = (appId, fuId, patch) => patchApp(appId, (a) => ({ ...a, followUps: (a.followUps || []).map((f) => (f.id === fuId ? { ...f, ...patch } : f)) }));
  const draftFollowUp = (appId, fuId) => withBusy(`fu:${fuId}`, async () => {
    const { settings: s, profile: p, apps: A, offers: O, contacts: C } = R.current;
    const app = A.find((a) => a.id === appId);
    const fu = app?.followUps.find((f) => f.id === fuId);
    const offer = O.find((o) => o.id === app?.offerId);
    const contact = C.find((c) => app?.contactIds?.includes(c.id));
    const { data } = await askJSON(s, { system: SYSTEM_BASE, prompt: P.followUp(app, offer, fu, p, contact), maxTokens: 3000 });
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
    const res = await askJSON(s, { system: SYSTEM_BASE, prompt: P.prep(offer, p), web: { maxUses: 6 }, maxTokens: 14000 });
    const d = res.data || {};
    const seen = (u) => !!u && res.urls.some((x) => canonicalUrl(x) === canonicalUrl(u));
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
    apps.forEach((a) => {
      const o = offerOf(a);
      const name = `${o?.title || "Poste"} · ${o?.company || NC}`;
      (a.followUps || []).filter((f) => f.status === "pending" && daysFromToday(f.due) <= 0).forEach((f) => {
        items.push({ id: `fu:${f.id}`, label: `${FU_KINDS[f.kind]} due`, detail: name, due: f.due, weight: 1, go: () => setView("followups"), demo: a.demo });
      });
      (a.interviews || []).filter((i) => { const d = daysFromToday(i.at); return d >= 0 && d <= 3; }).forEach((i) => {
        items.push({ id: `itv:${i.id}`, label: a.prep ? `Entretien ${relDay(i.at)}` : `Préparer l'entretien (${relDay(i.at)})`, detail: name, due: i.at, weight: 1, go: () => openApp(a.id, "prep"), demo: a.demo });
      });
      if (a.stage === "retained" && !Object.keys(a.docs || {}).length) items.push({ id: `doc:${a.id}`, label: "Préparer le dossier de candidature", detail: name, weight: 2, go: () => openApp(a.id, "docs"), demo: a.demo });
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
  const exportPayload = () => ({ app: "radar-emploi", version: DATA_VERSION, exportedAt: nowISO(), settings, profile, criteria, sources, offers, apps, contacts });
  const importPayload = (obj) => {
    if (!obj || obj.app !== "radar-emploi") throw new Error("Fichier non reconnu (sauvegarde Radar attendue).");
    setSettings({ ...DEFAULT_SETTINGS, ...(obj.settings || {}), mcp: { ...DEFAULT_SETTINGS.mcp, ...(obj.settings?.mcp || {}) }, mcpTools: { ...DEFAULT_SETTINGS.mcpTools, ...(obj.settings?.mcpTools || {}) }, followUp: { ...DEFAULT_SETTINGS.followUp, ...(obj.settings?.followUp || {}) } });
    setProfile({ ...DEFAULT_PROFILE, ...(obj.profile || {}) });
    setCriteria(obj.criteria?.versions?.length ? obj.criteria : makeCriteriaState());
    setSources(obj.sources || DEFAULT_SOURCES);
    setOffers(obj.offers || []);
    setApps(obj.apps || []);
    setContacts(obj.contacts || []);
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

  const dueCount = useMemo(() => apps.reduce((n, a) => n + (a.followUps || []).filter((f) => f.status === "pending" && daysFromToday(f.due) <= 0).length, 0), [apps]);
  const unreadCount = useMemo(() => offers.filter((o) => o.status === "new" && !o.seenAt && !o.demo).length, [offers]);

  const ctx = {
    T, settings, setSettings, profile, setProfile, criteria, setCriteria, sources, setSources, offers, setOffers, apps, contacts,
    busy, progress, toast, go, view, openOffer, openApp, staleIds, todayItems, todayAI, hasDemo, offerPreset, setOfferPreset,
    runWatch, importGmail, importManual, scoreOffers, rescoreStale, saveCriteriaVersion, restoreVersion, generateKeywords,
    addToPipeline, moveApp, requestMove, addInterview, patchApp, logApp, patchOffer, patchSource,
    createGmailDraft, createCalendarEvent, calTitle, generateDocs, saveDocVersion,
    setFollowUp, draftFollowUp, completeFollowUp, addFollowUp, prepareInterview,
    saveContact, deleteContact, toggleAppContact, prioritizeToday,
    exportPayload, importPayload, resetAll, clearDemo, loadDemo, setManualOpen, setConfirm, storageState, saveState,
    openStageDialog: (appId) => setStageDialog({ appId, stage: "interview" }),
    importOffersJSON, detectDuplicates, undoMerge, checkReplies, veille,
    ratings, requestRatings, offerQueue, setOfferQueue, triageOffer, nextOfferId, setOfferSel,
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
          <ManualImportModal open={manualOpen} onClose={() => setManualOpen(false)} />
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

          <div className="fixed bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 items-end" style={{ zIndex: 80 }} aria-live="polite" role="status">
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
          return { group: "Préparer candidature", label: `Préparer : ${o?.title || "poste"}`, hint: o?.company || "", icon: Sparkles, run: run(() => app.openApp(a.id, "docs")) };
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
    offers.forEach((o) => [...new Set((o.sources || []).map((s) => s.name))].forEach((n) => { m[n] = (m[n] || 0) + 1; }));
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
    const arr = offers.filter((o) => new Date(o.collectedAt) > ref && !o.demo);
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

  const since = visitPrev || addDays(nowISO(), -3);
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
  const counts = useMemo(() => Object.fromEntries(OFFER_TABS.map((t) => [t.id, offers.filter(inTab[t.id]).length])), [offers, inTab]);

  const sourceNames = useMemo(() => [...new Set(offers.flatMap((o) => (o.sources || []).map((s) => s.name)))].sort(), [offers]);
  const vid = activeVersion(criteria)?.id;
  const list = useMemo(() => {
    const nq = normText(f.q);
    const l = offers.filter((o) => {
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
  }, [offers, f, inTab]);
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
  const { apps, offers, settings, requestMove, openApp, go } = useApp();
  const [over, setOver] = useState(null);
  const [showClosed, setShowClosed] = useState(true);
  const offerOf = (a) => offers.find((o) => o.id === a.offerId);
  const cols = STAGES.filter((s) => showClosed || s.id !== "closed");
  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle="Glissez une carte pour changer d'étape, ou ouvrez-la pour la déplacer au clavier."
        actions={<><Btn variant="ghost" onClick={() => setShowClosed(!showClosed)}>{showClosed ? "Masquer" : "Afficher"} les clôturées</Btn><Btn icon={Briefcase} onClick={() => go("offers")}>Ajouter depuis les offres</Btn></>}
      />
      {apps.length === 0 ? (
        <Card><Empty icon={Columns} title="Pipeline vide" text="Retenez une offre pour démarrer une candidature." action={<Btn variant="primary" onClick={() => go("offers")}>Voir les offres</Btn>} /></Card>
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
  const { apps, offers, requestMove, openOffer } = useApp();
  const app = apps.find((a) => a.id === id);
  const offer = offers.find((o) => o.id === app?.offerId);
  if (!app) return null;
  const fuPending = (app.followUps || []).filter((f) => f.status === "pending").length;
  return (
    <Drawer
      open
      onClose={onClose}
      title={offer?.title || "Candidature"}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <span>{show(offer?.company)}</span>
          {offer?.sources?.find((x) => x.url) && (
            <a href={offer.sources.find((x) => x.url).url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 text-xs font-semibold ${T.accentText} hover:underline underline-offset-4 rounded ${T.ring}`}>Voir l'offre <ExternalLink className="w-3 h-3" aria-hidden="true" /></a>
          )}
          {offer && <button type="button" className={`text-xs underline underline-offset-4 ${T.muted} ${T.ring} rounded`} onClick={() => { onClose(); openOffer(offer.id); }}>fiche Radar</button>}
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
          <span className={`block text-xs font-medium mb-1.5 ${T.muted}`}>Annonce</span>
          <div className="text-sm break-all">{offer?.sources?.[0]?.url ? <ExtLink href={offer.sources[0].url}>Ouvrir l'annonce</ExtLink> : <span className={T.faint}>URL {NC}</span>}</div>
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

function DossierPanel({ app, offer }) {
  const T = useT();
  const { generateDocs, busy } = useApp();
  const [type, setType] = useState("cv");
  const [instruction, setInstruction] = useState("");
  const docs = app.docs || {};
  const has = Object.keys(docs).length > 0;
  const loading = busy[`dossier:${app.id}`];
  const all = DOC_TYPES.filter((d) => docs[d.id]?.length).map((d) => {
    const v = docs[d.id].slice(-1)[0];
    return `### ${d.label}\n${v.subject ? `Objet : ${v.subject}\n` : ""}${v.text}`;
  }).join("\n\n");
  return (
    <div className="space-y-6">
      <Notice icon={Info}>
        La soumission automatique sur le site de l'employeur n'est pas possible depuis cet artefact (formulaires tiers, authentification). Ouvrez l'annonce et copiez les éléments du dossier.{" "}
        {offer?.sources?.[0]?.url && <ExtLink href={offer.sources[0].url}>Ouvrir l'annonce</ExtLink>}
      </Notice>
      {!has ? (
        <Card className="p-6">
          {loading ? <Skeleton lines={6} /> : (
            <>
              <div className="text-base font-medium">Générer le dossier complet</div>
              <p className={`text-sm mt-1 mb-4 ${T.muted}`}>CV et lettre prêts à envoyer (mis en page aux couleurs de l'entreprise, mots-clés de l'annonce pour les ATS, PDF texte), message LinkedIn, réponses probables au formulaire et e-mail, dans la langue de l'annonce ({offer?.language ? LANG_NAME[offer.language] : "détectée"}). Tout est éditable et versionné.</p>
              <Field label="Consigne facultative"><Input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Ex. insister sur l'automatisation, ton plus direct…" /></Field>
              <Btn className="mt-4" variant="primary" icon={Sparkles} onClick={() => generateDocs(app.id, DOC_TYPES.map((d) => d.id), instruction)}>Générer</Btn>
            </>
          )}
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="overflow-x-auto"><Tabs value={type} onChange={setType} tabs={DOC_TYPES.map((d) => ({ id: d.id, label: d.label, count: docs[d.id]?.length || undefined }))} /></div>
            <CopyBtn text={all} label="Copier tout le dossier" />
          </div>
          <DocEditor key={`${app.id}-${type}`} app={app} type={type} />
        </>
      )}
    </div>
  );
}

/* Aperçu « papier » : toujours sur fond blanc, comme le PDF. */
function DocPaper({ text, accent, kind }) {
  const A = cleanHex(accent);
  const blocks = parseDoc(text);
  let seenContact = false;
  return (
    <div className="rounded-2xl overflow-x-auto" style={{ background: "#ffffff", color: "#2d2d2d", border: "1px solid #e7e5e4", boxShadow: "0 12px 32px -18px rgba(0,0,0,.25)" }}>
      <div style={{ padding: "32px 34px", fontFamily: '"Inter", Helvetica, Arial, sans-serif', fontSize: 12.5, lineHeight: 1.5, minWidth: 320 }}>
        {blocks.map((b, i) => {
          if (b.t === "name") return <div key={i} style={{ color: A, fontSize: kind === "cv" ? 26 : 19, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.15 }}>{b.text}</div>;
          if (b.t === "quote") return kind === "cv"
            ? <div key={i} style={{ fontSize: 14, color: "#4a4a4a", marginTop: 4 }}>{b.text}</div>
            : <div key={i} style={{ marginTop: 2 }}>{b.text}</div>;
          if (b.t === "contact") { seenContact = true; return <div key={i} style={{ fontSize: 11, color: "#6b6b6b", marginTop: 4, paddingBottom: 12, borderBottom: `2px solid ${A}`, marginBottom: 14 }}>{b.text}</div>; }
          if (b.t === "date") return <div key={i} style={{ textAlign: "right", color: "#5a5a5a", margin: "8px 0 14px" }}>{b.text}</div>;
          if (b.t === "h2") return kind === "cv"
            ? <div key={i} style={{ color: A, fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", margin: "16px 0 6px", paddingBottom: 4, borderBottom: "1px solid #e5e5e5" }}>{b.text}</div>
            : <div key={i} style={{ fontWeight: 700, margin: "14px 0 12px" }}>{b.text}</div>;
          if (b.t === "h3") {
            const parts = b.text.split("|").map((x) => x.trim()).filter(Boolean);
            return <div key={i} style={{ marginTop: 8 }}><div style={{ fontWeight: 700, color: "#1f1f1f" }}>{parts[0]}</div>{parts.length > 1 && <div style={{ fontSize: 11, color: "#777" }}>{parts.slice(1).join("  ·  ")}</div>}</div>;
          }
          if (b.t === "bullet") return <div key={i} style={{ display: "flex", gap: 8, marginTop: 3 }}><span style={{ width: 5, height: 5, borderRadius: 9, background: A, marginTop: 7, flexShrink: 0 }} /><span>{b.text}</span></div>;
          if (b.t === "kv") return <div key={i} style={{ marginTop: 3 }}><strong style={{ color: "#1f1f1f" }}>{b.label}</strong> {b.text}</div>;
          if (b.t === "sign") return <div key={i} style={{ marginTop: 18, fontWeight: 700 }}>{b.text}</div>;
          return <p key={i} style={{ margin: kind === "cv" ? "4px 0" : "0 0 12px", textAlign: kind === "cv" ? "left" : "justify" }}>{b.text}</p>;
        })}
        {!seenContact && kind === "cv" && blocks.length > 0 && <div style={{ fontSize: 11, color: "#b45309", marginTop: 12 }}>Coordonnées absentes : ajoutez une ligne « @ … » ou complétez votre profil.</div>}
      </div>
    </div>
  );
}

const slugFile = (x) => normText(x || "").replace(/\s+/g, "-").slice(0, 40) || "document";

function ProDocTools({ app, type, v, text, setText, accent, setAccent, dirty, onSave }) {
  const T = useT();
  const { offers, profile, toast } = useApp();
  const [mode, setMode] = useState("preview");
  const [pdfBusy, setPdfBusy] = useState(false);
  const offer = offers.find((o) => o.id === app.offerId);
  const cov = useMemo(() => keywordCoverage(text, v.keywords), [text, v.keywords]);
  const placeholders = (text.match(/\[à compléter/gi) || []).length;
  const words = docPlainText(text).split(/\s+/).filter(Boolean).length;
  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const data = await buildDocPdf(text, { accent, kind: type, title: [type === "cv" ? "CV" : "Lettre de motivation", profile.name, offer?.title, offer?.company].filter(Boolean).join(" - "), keywords: v.keywords, author: profile.name });
      const r = await saveFile(`${type === "cv" ? "CV" : "Lettre"}_${slugFile(profile.name || "candidat")}_${slugFile(offer?.company || offer?.title)}.pdf`, data, "application/pdf");
      if (r === "saved") toast("PDF prêt", "ok");
    } catch (e) {
      toast(`PDF impossible : ${e.message}`, "danger");
    } finally { setPdfBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={mode} onChange={setMode} tabs={[{ id: "preview", label: "Aperçu" }, { id: "edit", label: "Modifier le texte" }]} />
        <label className={`inline-flex items-center gap-2 text-xs ${T.muted}`}>
          <Palette className="w-4 h-4" aria-hidden="true" /> Couleur
          <input type="color" value={cleanHex(accent)} onChange={(e) => setAccent(e.target.value)} aria-label="Couleur d'accent" style={{ width: 32, height: 24, border: "none", background: "transparent" }} />
        </label>
        {v.accentSource && <span className={`text-xs ${T.faint}`}>({v.accentSource})</span>}
        <span className={`text-xs tabular-nums ${T.faint}`}>{words} mots</span>
      </div>
      {mode === "preview" ? <DocPaper text={text} accent={accent} kind={type} /> : (
        <>
          <Textarea rows={22} value={text} onChange={(e) => setText(e.target.value)} aria-label={DOC_LABEL[type]} style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5 }} />
          <p className={`text-xs ${T.faint}`}># nom · &gt; accroche ou destinataire · @ coordonnées · = date · ## section · ### Poste | Organisation | Lieu | Période · - puce · **Libellé :** valeur · ~ signature</p>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Btn variant={dirty ? "primary" : "soft"} icon={Save} disabled={!dirty} onClick={onSave}>Enregistrer une version</Btn>
        <Btn icon={Download} loading={pdfBusy} onClick={downloadPdf}>Télécharger le PDF</Btn>
        <CopyBtn text={docPlainText(text)} label="Copier le texte (formulaires, ATS)" size="md" />
      </div>
      {type === "cv" && (
        <div className={`rounded-2xl p-4 space-y-3 ${T.sub}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">Analyse ATS</div>
            {cov.pct !== null && <Chip tone={cov.pct >= 75 ? "ok" : cov.pct >= 50 ? "warn" : "danger"}>{cov.pct} % des mots-clés de l'annonce</Chip>}
          </div>
          {cov.covered.length > 0 && <div className="flex flex-wrap gap-1.5">{cov.covered.map((k) => <Chip key={k} tone="ok">{k}</Chip>)}</div>}
          {cov.missing.length > 0 && (
            <div>
              <div className={`text-xs mb-1 ${T.muted}`}>Absents du CV — ajoutez-les seulement si c'est vrai :</div>
              <div className="flex flex-wrap gap-1.5">{cov.missing.map((k) => <Chip key={k} tone="warn">{k}</Chip>)}</div>
            </div>
          )}
          {v.missingInProfile?.length > 0 && <p className={`text-xs ${T.muted}`}>Exigences non couvertes par votre profil : {v.missingInProfile.join(", ")}. À préparer pour l'entretien.</p>}
          <ul className={`text-xs space-y-1 ${T.muted}`}>
            <li>{placeholders ? `⚠ ${placeholders} élément(s) [à compléter] avant envoi.` : "✓ Aucun élément à compléter."}</li>
            <li>✓ Une colonne, titres standard, texte sélectionnable dans le PDF : lisible par les ATS.</li>
            <li>{words > 900 ? "⚠ Plus de 900 mots : visez 2 pages maximum." : "✓ Longueur adaptée (1 à 2 pages)."}</li>
          </ul>
        </div>
      )}
      {v.tips?.length > 0 && (
        <div className={`rounded-2xl p-4 ${T.accentSoft}`}>
          <div className="text-sm font-medium mb-1">Pour sortir du lot sur cette offre</div>
          <ul className="text-sm space-y-1">{v.tips.map((t, i) => <li key={i}>• {t}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function DocEditor({ app, type }) {
  const T = useT();
  const { saveDocVersion, generateDocs, busy, settings, createGmailDraft, contacts } = useApp();
  const versions = app.docs?.[type] || [];
  const [idx, setIdx] = useState(versions.length - 1);
  const v = versions[idx];
  const [text, setText] = useState(v?.text || "");
  const [subject, setSubject] = useState(v?.subject || "");
  const [instr, setInstr] = useState("");
  const linked = contacts.filter((c) => (app.contactIds || []).includes(c.id) && c.email);
  const [to, setTo] = useState(linked[0]?.email || "");
  useEffect(() => { setIdx(versions.length - 1); }, [versions.length]);
  const isPro = (type === "cv" || type === "letter") && v?.format === "markup";
  const [accent, setAccent] = useState(cleanHex(v?.accent));
  useEffect(() => { setText(v?.text || ""); setSubject(v?.subject || ""); setAccent(cleanHex(v?.accent)); }, [v?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const loading = busy[`dossier:${app.id}`];
  const dirty = v && (text !== v.text || (type === "email" && subject !== (v.subject || "")) || (isPro && accent !== cleanHex(v.accent)));
  const warn = mentionsEmployer(`${subject}\n${text}`, settings.employerNames);

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
      {isPro && !loading && (
        <ProDocTools app={app} type={type} v={v} text={text} setText={setText} accent={accent} setAccent={setAccent} dirty={dirty}
          onSave={() => saveDocVersion(app.id, type, text, undefined, { accent, accentSource: accent !== cleanHex(v.accent) ? "choisie" : v.accentSource })} />
      )}
      {(type === "cv" || type === "letter") && !isPro && <Notice icon={Info}>Ancien format : régénérez ce document pour obtenir la version mise en page (aperçu, analyse ATS et PDF).</Notice>}
      {type === "cv" && !isPro && v.highlights?.length > 0 && (
        <div className={`rounded-2xl p-4 ${T.sub}`}>
          <div className={`text-xs font-medium mb-2 ${T.muted}`}>Points clés à mettre en avant</div>
          <ul className="space-y-1 text-sm">{v.highlights.map((h, i) => <li key={i} className="flex gap-2"><Check className={`w-3.5 h-3.5 mt-1 shrink-0 ${T.accentText}`} aria-hidden="true" />{h}</li>)}</ul>
        </div>
      )}
      {type === "email" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Objet"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
          <Field label="Destinataire" hint={linked.length ? "Contacts liés à cette candidature" : "Aucun contact lié : laissez vide et complétez dans Gmail"}>
            <Input value={to} onChange={(e) => setTo(e.target.value)} list={`to-${app.id}`} placeholder="recruteur@exemple.be" />
            <datalist id={`to-${app.id}`}>{linked.map((c) => <option key={c.id} value={c.email}>{c.name}</option>)}</datalist>
          </Field>
        </div>
      )}
      {loading ? <Card className="p-6"><Skeleton lines={8} /></Card> : !isPro && (
        <Textarea rows={type === "linkedin" ? 5 : 16} value={text} onChange={(e) => setText(e.target.value)} aria-label={DOC_LABEL[type]} style={{ fontFamily: FONT }} />
      )}
      {type === "linkedin" && (
        <p className={`text-xs ${text.length > 300 ? "text-rose-600" : T.faint}`}>{text.length} / 300 caractères (limite d'une invitation). Envoi manuel depuis LinkedIn : aucune automatisation possible.</p>
      )}
      {!isPro && <div className="flex flex-wrap gap-2">
        <Btn variant={dirty ? "primary" : "soft"} icon={Save} disabled={!dirty} onClick={() => saveDocVersion(app.id, type, text, type === "email" ? subject : undefined)}>Enregistrer une version</Btn>
        <CopyBtn text={type === "email" ? `Objet : ${subject}\n\n${text}` : text} size="md" />
        {type === "email" && <Btn icon={Mail} loading={busy["gmail-draft"]} onClick={() => createGmailDraft({ to, subject, body: text, appId: app.id })}>Créer le brouillon Gmail</Btn>}
      </div>}
      <div className={`flex flex-col sm:flex-row gap-2 pt-4 border-t ${T.line}`}>
        <Input value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="Consigne de régénération (facultatif) : plus court, plus orienté résultats…" aria-label="Consigne de régénération" />
        <Btn icon={RefreshCw} loading={loading} onClick={() => generateDocs(app.id, [type], instr)}>Régénérer</Btn>
      </div>
    </div>
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

function AssistantView() {
  const T = useT();
  const { apps, offers, settings, openApp, addToPipeline, go } = useApp();
  const inPrep = apps.filter((a) => ["new", "retained", "prep"].includes(a.stage));
  const candidates = offers.filter((o) => o.status === "new" && o.score?.value >= settings.threshold).sort((a, b) => b.score.value - a.score.value).slice(0, 6);
  const offerOf = (a) => offers.find((o) => o.id === a.offerId);
  return (
    <div>
      <PageHeader title="Assistant candidature" subtitle="L'IA prépare, vous validez. Aucun document n'est envoyé en votre nom." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-2">
          <SectionTitle>Candidatures à préparer</SectionTitle>
          {inPrep.length === 0 ? (
            <Empty icon={Sparkles} title="Rien en préparation" text="Retenez une offre pour générer son dossier." action={<Btn onClick={() => go("offers")}>Voir les offres</Btn>} />
          ) : (
            <ul className="space-y-2">
              {inPrep.map((a) => {
                const o = offerOf(a);
                const n = Object.keys(a.docs || {}).length;
                return (
                  <li key={a.id} className={`flex flex-wrap items-center gap-3 rounded-2xl p-4 ${T.sub}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{o?.title}{a.demo && <Chip className="ml-2">exemple</Chip>}</div>
                      <div className={`text-xs ${T.muted}`}>{show(o?.company)} · {STAGE_LABEL[a.stage]} · {n}/{DOC_TYPES.length} documents</div>
                      <div className={`mt-2 h-1 rounded-full overflow-hidden ${T.dark ? "bg-stone-700" : "bg-stone-200"}`}><div className="h-full bg-indigo-600" style={{ width: `${(n / DOC_TYPES.length) * 100}%` }} /></div>
                    </div>
                    <Btn variant={n ? "soft" : "primary"} icon={Sparkles} onClick={() => openApp(a.id, "docs")}>{n ? "Ouvrir le dossier" : "Préparer"}</Btn>
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
              [true, "CV adapté, lettre, message LinkedIn, réponses au formulaire, e-mail — dans la langue de l'annonce"],
              [true, "Brouillon Gmail (jamais envoyé) et rappels Google Calendar, après confirmation"],
              [true, "Versions éditables et régénérables, alerte si l'employeur actuel est cité"],
              [false, "Soumettre un formulaire sur le site de l'employeur ou d'un job board"],
              [false, "Envoyer un e-mail ou un message LinkedIn à votre place"],
              [false, "Inventer des réalisations ou des chiffres : les manques sont marqués [à compléter]"],
            ].map(([ok, t]) => (
              <li key={t} className="flex gap-2">{ok ? <Check className={`w-4 h-4 mt-0.5 shrink-0 ${T.accentText}`} aria-label="Oui" /> : <X className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" aria-label="Non" />}<span>{t}</span></li>
            ))}
          </ul>
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
      <div className="mb-6"><Tabs value={tab} onChange={setTab} tabs={[{ id: "criteria", label: "Critères" }, { id: "profile", label: "Profil" }, { id: "history", label: "Historique", count: criteria.versions.length }]} /></div>
      {tab === "criteria" && <CriteriaEditor />}
      {tab === "profile" && <ProfileEditor />}
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
