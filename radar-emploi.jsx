/**
 * Radar — plateforme personnelle de veille emploi & pilotage de candidatures.
 * Artefact React (fichier unique) · Tailwind (classes de base) · lucide-react · recharts.
 * Persistance : window.storage (jamais localStorage).
 * IA : API Claude appelée depuis l'artefact (web_search + serveurs MCP Gmail / Google Calendar).
 * Principe : l'IA prépare, l'utilisateur valide. Rien n'est envoyé sans action explicite.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback, useContext, createContext, useDeferredValue } from "react";
import {
  LayoutDashboard, Briefcase, Columns, Sparkles, BellRing, Users, Radio, User, ShieldCheck, Search,
  Command, Play, Loader2, Plus, X, ChevronRight, ChevronsLeft, ChevronsRight, ExternalLink, Mail,
  CalendarPlus, Copy, Check, Trash2, Download, Upload, RotateCcw, Moon, Sun, Monitor, AlertTriangle,
  Info, MapPin, Clock, List, LayoutList, Menu, History, FileText, RefreshCw, Building2, Inbox,
  Clipboard, Wand2, Flag, HelpCircle, Eye, EyeOff, Save, Target, Gauge, ArrowRight, CheckCircle2, Linkedin, TrendingUp, Pencil, Phone, GitMerge, Undo2, MailCheck, Star, Palette, ChevronLeft,
  RotateCw, Crop, GripVertical, ArrowUp, ArrowDown, ArrowLeftRight, Languages, FileDown, Redo2, ZoomIn, ZoomOut, Archive,
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
  media: "radar:media",
  inbox: "radar:inbox",
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
  { id: "noresponse", label: "Sans réponse" },
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
  confirmation_candidature: "Candidature confirmée",
  accuse_reception: "Accusé de réception",
  test_evaluation: "Test / évaluation",
  invitation_entretien: "Invitation à un entretien",
  refus: "Refus",
  demande_info: "Demande d'information",
  offre: "Offre",
  autre: "Autre",
};
const CONTACT_TYPES = { recruiter: "Recruteur", agency: "Cabinet", hiring: "Hiring manager", network: "Réseau" };
/* Expéditeurs des logiciels de recrutement (accusés de réception, invitations) et confirmations des job boards. */
const ATS_SENDERS = ["myworkday.com", "workday.com", "smartrecruiters.com", "greenhouse.io", "lever.co", "teamtailor.com", "recruitee.com", "successfactors.com", "successfactors.eu", "taleo.net", "icims.com", "personio.de", "workablemail.com", "jobvite.com", "bamboohr.com", "softgarden.io", "join.com", "homerun.co", "cornerstoneondemand.com", "jobs-noreply@linkedin.com", "indeedapply.com", "indeed.com"];
/* Silence d'une candidature envoyée : jours depuis le dernier signal (envoi, e-mail reçu, appel, entretien). */
function silenceDays(a) {
  if (!a || !["sent", "followup"].includes(a.stage) || !a.sentAt) return null;
  const last = [a.sentAt, ...(a.emails || []).map((m) => m.date || m.at), ...(a.log || []).filter((l) => ["email", "call", "interview"].includes(l.type)).map((l) => l.at)]
    .map((d) => new Date(d).getTime()).filter(Number.isFinite).reduce((m, x) => Math.max(m, x), 0);
  return last ? Math.floor((Date.now() - last) / 864e5) : null;
}
const lastEmail = (a) => [...(a?.emails || [])].sort((x, y) => new Date(y.date || y.at) - new Date(x.date || x.at))[0] || null;
const gmailLink = (m) => (m?.threadId ? `https://mail.google.com/mail/u/0/#all/${m.threadId}` : m?.subject ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`subject:"${m.subject}"`)}` : null);

const DEFAULT_SETTINGS = {
  theme: "system",
  threshold: 70,
  autoRescore: true,
  discreet: true,
  discreetCalendarTitles: true,
  employerNames: ["FEB", "VBO", "Fédération des Entreprises de Belgique", "Verbond van Belgische Ondernemingen"],
  model: "claude-opus-5-5",
  fallbackModel: "claude-sonnet-5-5",
  modelBalanced: "claude-sonnet-5-5",
  modelFast: "claude-haiku-5-5",
  routing: true,
  effortTuning: true,
  promptCache: true,
  designDefault: null,
  autoReplies: true,
  autoRepliesHours: 12,
  ghostDays: 21,
  seenUntracked: [],
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
  lastReplyWindowAt: null,
  autoWatch: false,
  autoWatchHours: 24,
  autoGmail: false,
  importedRuns: [],
  sourcesPack: 2,
  autoNext: true,
  hideOlderThan: 45,
  sidebarCollapsed: false,
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

/* Déduplication : même URL canonique, ou même entreprise + intitulés très proches. */
function sameOffer(a, b) {
  const ua = (a.sources || []).map((s) => canonicalUrl(s.url)).filter(Boolean);
  const ub = (b.sources || []).map((s) => canonicalUrl(s.url)).filter(Boolean);
  if (ua.some((u) => ub.includes(u))) return true;
  const ca = companyKey(a.company), cb = companyKey(b.company);
  if (!ca || !cb) return false;
  const sameCo = ca === cb || (ca.length > 3 && cb.length > 3 && (ca.includes(cb) || cb.includes(ca)));
  return sameCo && jaccard(tokens(a.title), tokens(b.title)) >= 0.6;
}
const FILLABLE = ["company", "location", "commute", "contract", "seniority", "salary", "remote", "language", "publishedAt"];
function mergeOffers(existing, incoming) {
  const list = existing.map((o) => ({ ...o }));
  const added = [], merged = [];
  for (const inc of incoming) {
    const hit = list.find((o) => sameOffer(o, inc));
    if (hit) {
      const srcs = [...(hit.sources || [])];
      for (const s of inc.sources) if (!srcs.some((x) => canonicalUrl(x.url) === canonicalUrl(s.url) && x.name === s.name)) srcs.push(s);
      for (const k of FILLABLE) if ((hit[k] === null || hit[k] === undefined || hit[k] === "") && inc[k]) hit[k] = inc[k];
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
    publishedAt: str(raw.publishedAt),
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
  };
  return { ...body, sig: JSON.stringify(body) };
}

/* Une offre « active » : ni écartée, ni expirée, ni liée à une candidature clôturée. */
const INACTIVE = ["dismissed", "expired", "closed"];
const isActiveOffer = (o) => !INACTIVE.includes(o.status);
const isOldOffer = (o, days) => {
  if (!days || o.status === "pipeline") return false;
  const ref = o.publishedAt && !isNaN(new Date(o.publishedAt)) ? o.publishedAt : o.lastSeenAt || o.collectedAt;
  return Date.now() - new Date(ref).getTime() > days * 864e5;
};
const ratingKey = (company) => companyKey(company || "").replace(/\s+/g, "-").slice(0, 120);
const fmtRating = (r) => (r && typeof r.rating === "number" ? r.rating.toFixed(1).replace(".", ",") : null);

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
function keywordCoverage(text, terms) {
  const hay = ` ${normText(text)} `;
  const list = (terms || []).filter(Boolean);
  // Correspondance sur mots entiers : « IT » n'est plus compté présent dans « digital ».
  const covered = list.filter((t) => { const n = normText(t); return n && hay.includes(` ${n} `); });
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
/* Les polices PDF standard couvrent le jeu Windows-1252 (€, œ, ’, “ ”, – …). Hors de ce jeu, on retire
   les accents (Dvořák → Dvorak) au lieu de supprimer la lettre. */
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const TRANSLIT = { "\u0141": "L", "\u0142": "l", "\u0110": "D", "\u0111": "d", "\u0131": "i", "\u2192": "->", "\u2713": "v" };
const pdfSafe = (t) => String(t || "")
  .replace(/[\u00A0\u202F\u2009]/g, " ").replace(/\u2212/g, "-").replace(/\u2032/g, "'").replace(/\u2033/g, '"')
  .replace(/[^\x00-\xFF]/g, (ch) => (CP1252_EXTRA.includes(ch) ? ch : TRANSLIT[ch] ?? ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x00-\xFF]/g, "")));

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
function docModel(text, kind) {
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
const PT = 0.3528; // mm par point typographique
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
/* Design effectif d'une candidature : celui de la candidature, sinon le style par défaut, sinon le gabarit ATS
   teinté de la couleur de charte proposée par l'IA. */
function resolveDesign(app, settings, accent) {
  if (app?.design) return mergeDesign(DESIGN_BASE, app.design);
  const base = settings?.designDefault ? mergeDesign(DESIGN_BASE, settings.designDefault) : designFromTemplate("ats");
  const a = cleanHex(accent, null);
  return a ? { ...base, colors: { ...base.colors, accent: a, ...(base.colors.band === base.colors.accent ? { band: a } : {}), ...(base.colors.rule === base.colors.accent ? { rule: a } : {}) } } : base;
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
  return r * f.size * PT + (f.cs ? f.cs * Math.max(0, s.length - 1) : 0);
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
  const lh = (size) => size * PT * D.lineHeight;
  const base = (size) => (lh(size) - size * PT) / 2 + size * PT * 0.8;
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
    else if (D.bullet === "arrow") o.push({ t: "text", x: x - 0.4, y: cy + f.size * PT * 0.32, s: "›", font: f.font, bold: true, italic: false, size: f.size * 1.15, color, anchor: "start", cs: 0 });
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
    const f = { font: D.headingFont, bold: true, size: D.size * D.headingSize, color: P.accent, cs: D.headingCase === "upper" ? D.headingSpacing * PT : 0 };
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
    if (icName) { const s = f.size * PT * 1.15; icon(fl.p, icName, x, fl.y + (hh - s) / 2, s, P.accent); x += s + 1.8; }
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
      const is = D.icons ? f.size * PT * 1.15 : 0;
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
        const rulePt = Math.max(2, Math.round((D.rule / PT) * 8));
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
    const m = docModel(it.text, it.kind);
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
          const ic = !ats && D.icons ? drawing(mediaRel(`ic_${x.icon}_${icCol}`, `ic_${x.icon}_${hexW(icCol)}.png`, dataUrlBytes(iconPng(x.icon, icCol))), D.size * 0.88 * PT * 1.15, D.size * 0.88 * PT * 1.15) + run(" ", { size: D.size * 0.88 }) : "";
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
        body.push(p("", { after: 1, border: !ats && D.rule > 0 ? `<w:pBdr><w:bottom w:val="single" w:sz="${Math.max(4, Math.round((Math.max(D.rule, 0.5) / PT) * 8))}" w:space="1" w:color="${hexW(C.accent)}"/></w:pBdr>` : "" }));
      } else {
        if (photoRun) body.push(p(photoRun, { align: "center", after: 2 }));
        body.push(headParas(align, false));
        if (!center && !ats && D.rule > 0) body.push(p("", { after: 1, border: `<w:pBdr><w:bottom w:val="single" w:sz="${Math.max(4, Math.round((Math.max(D.rule, 0.5) / PT) * 8))}" w:space="1" w:color="${hexW(C.accent)}"/></w:pBdr>` }));
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

/* ── Qualité du document : contrôles locaux, 0 token (inspirés de Rezi, Enhancv, Jobscan) ── */
const CLICHES = {
  fr: ["passionné", "passionnée", "dynamique", "force de proposition", "motivé", "motivée", "rigoureux", "rigoureuse", "je me permets", "n'hésitez pas", "fort de", "forte de", "polyvalent", "esprit d'équipe", "sens du relationnel", "proactif", "proactive", "synergie", "challenge"],
  nl: ["gepassioneerd", "dynamisch", "gemotiveerd", "teamplayer", "proactief", "stressbestendig", "hierbij solliciteer ik", "leergierig", "flexibel ingesteld"],
  en: ["passionate", "dynamic", "hardworking", "hard-working", "team player", "detail-oriented", "go-getter", "synergy", "results-driven", "self-starter", "i am writing to apply", "highly motivated"],
  de: ["dynamisch", "motiviert", "teamfähig", "belastbar", "leidenschaftlich", "hiermit bewerbe ich mich", "zielstrebig"],
};
const WEAK_STARTS = {
  fr: ["responsable de", "en charge de", "chargé de", "chargée de", "participation à", "participation au", "aide à", "travail sur"],
  nl: ["verantwoordelijk voor", "betrokken bij", "hulp bij", "werken aan"],
  en: ["responsible for", "worked on", "helped", "duties included", "involved in", "tasked with"],
  de: ["verantwortlich für", "zuständig für", "mitarbeit bei", "beteiligt an"],
};
const FIRST_PERSON = { fr: /(^|\s)(je|j'|moi|mon|ma|mes)\s/i, nl: /(^|\s)(ik|mijn)\s/i, en: /(^|\s)(I|my|me)\s/, de: /(^|\s)(ich|mein|meine)\s/i };
function docQuality(text, { kind = "cv", lang = "fr", keywords = [], kwLang, design } = {}) {
  const model = docModel(text, kind);
  const blocks = model.blocks;
  const plain = docPlainText(text);
  const words = plain.split(/\s+/).filter(Boolean).length;
  const low = ` ${plain.toLowerCase()} `;
  const checks = [];
  const add = (id, ok, w, label, detail, tone) => checks.push({ id, ok, w, label, detail, tone: ok ? "ok" : tone || "warn" });
  const ph = (text.match(/\[(à compléter|aan te vullen|to complete|zu ergänzen)/gi) || []).length;
  const cl = (CLICHES[lang] || CLICHES.fr).filter((c) => low.includes(` ${c} `) || low.includes(` ${c},`) || low.includes(` ${c}.`));
  if (kind === "cv") {
    const m = model;
    const contact = contactItems(m.head).map((x) => x.icon);
    const bullets = blocks.filter((b) => b.t === "bullet");
    const quant = bullets.filter((b) => /\d|%|€|\bk€|x\d/.test(b.text));
    const weak = bullets.filter((b) => (WEAK_STARTS[lang] || WEAK_STARTS.fr).some((w) => normText(b.text).startsWith(normText(w))));
    const long = bullets.filter((b) => b.text.split(/\s+/).length > 32);
    const prof = m.sections.find((s) => baseKey(s.key) === "profile");
    const profWords = prof ? prof.blocks.map((b) => b.text).join(" ").split(/\s+/).filter(Boolean).length : 0;
    const entries = blocks.filter((b) => b.t === "h3" && m.sections.some((s) => baseKey(s.key) === "experience" && s.blocks.includes(b)));
    const dated = entries.filter((b) => /\d{4}/.test(b.text));
    const keys = new Set(m.sections.map((s) => baseKey(s.key)));
    const fp = [...(prof?.blocks || []), ...bullets].filter((b) => FIRST_PERSON[lang]?.test(` ${b.text} `));
    add("contact", contact.includes("mail") && contact.includes("phone"), 10, "Coordonnées complètes", contact.includes("mail") && contact.includes("phone") ? `${contact.length} élément(s)${contact.includes("linkedin") ? ", LinkedIn inclus" : " · ajoutez LinkedIn"}` : "Ajoutez e-mail et téléphone sur la ligne « @ ».", "danger");
    add("headline", m.head.headline.length > 0, 5, "Accroche sous le nom", m.head.headline.length ? "Présente" : "Ajoutez une ligne « > » qui reprend l'intitulé du poste.");
    add("profile", profWords >= 30 && profWords <= 100, 7, "Profil de 30 à 100 mots", prof ? `${profWords} mots` : "Section Profil absente");
    add("quant", quant.length >= 3, 12, "Au moins 3 résultats chiffrés", `${quant.length} puce(s) chiffrée(s) sur ${bullets.length}`, "danger");
    add("quantShare", bullets.length > 0 && quant.length / bullets.length >= 0.4, 7, "40 % des puces quantifiées", bullets.length ? `${Math.round((quant.length / bullets.length) * 100)} %` : "Aucune puce");
    add("weak", weak.length === 0, 7, "Verbes d'action plutôt que « responsable de »", weak.length ? `À reformuler : ${weak.slice(0, 2).map((b) => `« ${b.text.slice(0, 40)}… »`).join(", ")}` : "Aucune formulation passive détectée");
    add("cliche", cl.length === 0, 7, "Aucun cliché", cl.length ? `À remplacer par une preuve : ${cl.slice(0, 4).join(", ")}` : "Aucun");
    add("fp", fp.length === 0, 4, "Pas de première personne", fp.length ? `${fp.length} occurrence(s) à vérifier` : "Style nominal respecté");
    add("long", long.length === 0, 5, "Puces de 2 lignes maximum", long.length ? `${long.length} puce(s) de plus de 32 mots` : "OK");
    add("length", words >= 380 && words <= 850, 7, "Longueur 1 à 2 pages", `${words} mots${words > 850 ? " : resserrez" : words < 380 ? " : étoffez avec des résultats" : ""}`);
    add("dates", entries.length > 0 && dated.length === entries.length, 6, "Dates sur chaque expérience", entries.length ? `${dated.length}/${entries.length} datée(s)` : "Aucune expérience détaillée (### …)");
    add("sections", ["experience", "skills", "education"].every((k) => keys.has(k)), 6, "Sections Expérience, Compétences, Formation", ["experience", "skills", "education"].filter((k) => !keys.has(k)).map((k) => `manque : ${SECTION_TITLES.fr[k]}`).join(", ") || "Toutes présentes");
  } else {
    const L = model.letter;
    const paras = L.body.filter((b) => b.t === "para");
    add("subject", !!L.subject, 8, "Objet explicite", L.subject ? L.subject.text.slice(0, 60) : "Ajoutez une ligne « ## Objet : … »");
    add("length", words >= 200 && words <= 380, 10, "Longueur 200 à 380 mots", `${words} mots`);
    add("paras", paras.length >= 3 && paras.length <= 5, 7, "3 à 5 paragraphes", `${paras.length} paragraphe(s)`);
    add("cliche", cl.length === 0, 10, "Aucun cliché", cl.length ? `À remplacer : ${cl.slice(0, 4).join(", ")}` : "Aucun");
    add("opening", !/^(je me permets|hierbij|i am writing|hiermit)/i.test(paras[1]?.text || paras[0]?.text || ""), 6, "Accroche spécifique (pas « je me permets »)", "Ouvrez sur un élément précis de l'annonce.");
    add("proof", /\d/.test(paras.map((x) => x.text).join(" ")), 8, "Au moins une preuve chiffrée", /\d/.test(paras.map((x) => x.text).join(" ")) ? "Présente" : "Ajoutez un résultat mesurable.");
    add("sign", !!L.sign, 4, "Signature", L.sign ? "Présente" : "Ajoutez « ~ Prénom Nom ».");
  }
  add("placeholders", ph === 0, 10, "Aucun élément à compléter", ph ? `${ph} élément(s) entre crochets à remplir avant envoi` : "Prêt", "danger");
  if (keywords?.length) {
    const sameLang = !kwLang || kwLang === lang;
    const cov = keywordCoverage(text, keywords);
    if (sameLang) add("keywords", cov.pct >= 70, 10, "Mots-clés de l'annonce (≥ 70 %)", `${cov.pct} % couverts${cov.missing.length ? ` · absents : ${cov.missing.slice(0, 5).join(", ")}` : ""}`);
  }
  if (design) {
    const D = mergeDesign(DESIGN_BASE, design);
    add("readable", D.size >= 9 && Math.min(D.margin.l, D.margin.r) >= 10, 4, "Lisibilité (police ≥ 9 pt, marges latérales ≥ 10 mm)", `${D.size} pt · marges ${D.margin.l}/${D.margin.r} mm`);
    if (kind === "cv" && D.photo.show && lang === "en") add("photo", false, 2, "Photo et candidature en anglais", "Déconseillée pour les recruteurs anglo-saxons : masquez-la pour cette langue.", "warn");
    if (kind === "cv" && Number(D.columns) === 2) checks.push({ id: "cols", ok: true, w: 0, label: "Mise en page 2 colonnes", detail: "Lue par les ATS récents. Pour un portail ancien, exportez en Word « ATS 1 colonne ».", tone: "info" });
  }
  const tot = checks.reduce((n, c) => n + c.w, 0);
  const got = checks.reduce((n, c) => n + (c.ok ? c.w : 0), 0);
  return { score: tot ? Math.round((got / tot) * 100) : 0, checks, words };
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
const isStale = (offer, versionId) => !offer.score || offer.score.criteriaVersionId !== versionId;
const offerLang = (o) => o?.language || "fr";
const LANG_NAME = { fr: "français", nl: "néerlandais", en: "anglais", de: "allemand" };
const LANG_FLAG = { fr: "FR", nl: "NL", en: "EN", de: "DE" };
/* Versions de documents par langue : une version sans langue (v2) vaut la langue du dossier. */
const docLangOf = (app, offer, v) => v?.lang || app?.docLanguage || offerLang(offer);
const docVersions = (app, offer, type, lang) => (app?.docs?.[type] || []).filter((v) => docLangOf(app, offer, v) === lang);
const latestDoc = (app, offer, type, lang) => docVersions(app, offer, type, lang).slice(-1)[0] || null;
const docLangs = (app, offer, type) => [...new Set((app?.docs?.[type] || []).filter((v) => v.format === "markup").map((v) => docLangOf(app, offer, v)))];

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

/* Données publiées : un document par tranche de 180 Ko (limite 256 Kio par document), sous data/users/<id>/ (privé). */
const DB_CHUNK = 180000;
const dbQueues = {};
const dbDoc = (name) => RT.db.doc(`data/users/${RT.uid}/${name}`);
const dbName = (key) => key.replace(/[^a-z0-9]/gi, "_");
const dbStore = {
  async get(key) {
    const k = dbName(key);
    const meta = await dbDoc(`${k}__meta`).get();
    if (!meta.exists) return null;
    const n = Number(meta.data()?.n) || 0;
    const parts = await Promise.all(Array.from({ length: n }, (_, i) => dbDoc(`${k}__${i}`).get()));
    return JSON.parse(parts.map((x) => String(x.data()?.c ?? "")).join(""));
  },
  set(key, value) {
    const k = dbName(key);
    const run = async () => {
      const str = JSON.stringify(value);
      const chunks = [];
      for (let i = 0; i < str.length; i += DB_CHUNK) chunks.push(str.slice(i, i + DB_CHUNK));
      if (!chunks.length) chunks.push("");
      const prev = await dbDoc(`${k}__meta`).get();
      const prevN = prev.exists ? Number(prev.data()?.n) || 0 : 0;
      for (let i = 0; i < chunks.length; i++) await dbDoc(`${k}__${i}`).set({ c: chunks[i] });
      await dbDoc(`${k}__meta`).set({ n: chunks.length, at: nowISO() });
      for (let i = chunks.length; i < prevN; i++) await dbDoc(`${k}__${i}`).delete().catch(() => {});
    };
    dbQueues[k] = (dbQueues[k] || Promise.resolve()).catch(() => {}).then(run);
    return dbQueues[k];
  },
  async remove(key) {
    const k = dbName(key);
    const meta = await dbDoc(`${k}__meta`).get().catch(() => null);
    const n = meta?.exists ? Number(meta.data()?.n) || 0 : 0;
    for (let i = 0; i < n; i++) await dbDoc(`${k}__${i}`).delete().catch(() => {});
    await dbDoc(`${k}__meta`).delete().catch(() => {});
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
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  },
  async set(key, value) {
    if (RT.mode === "published") return dbStore.set(key, value);
    await window.storage.set(key, JSON.stringify(value));
  },
  async remove(key) {
    if (RT.mode === "published") return dbStore.remove(key);
    try { await window.storage.delete(key); } catch { /* clé absente */ }
  },
};

/* ════════════════════════════════════════════════════════════════════════
   4. COUCHE IA — API Claude (web_search, MCP Gmail / Google Calendar)
   ════════════════════════════════════════════════════════════════════════ */

let WORKING_VARIANT = null; // mémorise ce que l'API accepte : outil web, format MCP, cache de prompt, effort
const MODEL_IDX = {}; // modèle retenu par niveau (profond, équilibré, rapide) après un éventuel repli
/* Consommation de la session (version « chat ») : affichée dans Confidentialité & données. */
const USAGE = { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, byTier: {} };
const usageListeners = new Set();
function addUsage(tier, u) {
  if (!u) return;
  USAGE.calls += 1;
  USAGE.input += u.input_tokens || 0;
  USAGE.output += u.output_tokens || 0;
  USAGE.cacheRead += u.cache_read_input_tokens || 0;
  USAGE.cacheWrite += u.cache_creation_input_tokens || 0;
  const t = (USAGE.byTier[tier] = USAGE.byTier[tier] || { calls: 0, input: 0, output: 0 });
  t.calls += 1; t.input += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0); t.output += u.output_tokens || 0;
  usageListeners.forEach((f) => f({ ...USAGE }));
}
const TIER_LABEL = { deep: "profond", balanced: "équilibré", fast: "rapide" };
const tierModels = (s, tier) => [...new Set((tier === "fast" ? [s.modelFast, s.modelBalanced, s.model] : tier === "balanced" ? [s.modelBalanced, s.model] : [s.model, s.fallbackModel]).filter(Boolean))];

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
  // Contexte stable (profil, critères, barème) placé en fin de system avec un point de cache : les lots suivants le relisent à 5 %.
  const system = o.context
    ? (v.cache === false ? `${o.system}\n\n${o.context}` : [{ type: "text", text: o.system }, { type: "text", text: o.context, cache_control: { type: "ephemeral" } }])
    : o.system;

  const messages = [{ role: "user", content: o.prompt }];
  const acc = { text: [], urls: new Set(), toolText: [], toolCalls: [], toolErrors: [] };
  for (let turn = 0; turn < 5; turn++) {
    const body = { model, max_tokens: o.maxTokens, system, messages };
    if (o.effort && v.effort !== false) body.output_config = { effort: o.effort };
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
    addUsage(o.tier, data.usage);
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

async function callSample(settings, { system, prompt, web, mcp = [], context }) {
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
    const r = await RT.sample(`${system}${context ? `\n\n${context}` : ""}\n\n${prompt}${note}`, tools.length ? { tools } : {});
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

/* Niveaux : « deep » (Opus : scoring, CV, recherche web), « balanced » (Sonnet : traduction, Gmail, relances),
   « fast » (Haiku : priorisation, synonymes, doublons, réparation JSON). Effort bas sur les tâches légères. */
async function callClaudeApi(settings, { system, prompt, web = null, mcp = [], maxTokens = 12000, tier = "deep", effort, context }) {
  const t = settings.routing === false ? "deep" : tier;
  const o = {
    system, prompt, web, mcp, maxTokens, context, tier: t,
    effort: settings.effortTuning === false ? null : effort,
    models: tierModels(settings, t),
    webTypes: ["web_search_20260209", "web_search_20250305"],
    mcpModes: settings.mcpMode === "auto" ? ["legacy", "toolset"] : [settings.mcpMode],
  };
  if (settings.promptCache === false && context) { o.context = null; o.system = `${system}\n\n${context}`; }
  let v = { w: 0, p: 0, ...(WORKING_VARIANT || {}), m: MODEL_IDX[t] || 0 };
  let lastErr;
  for (let attempt = 0; attempt < 9; attempt++) {
    try {
      const res = await runConversation(settings, v, o);
      const { m, ...shared } = v;
      WORKING_VARIANT = shared;
      MODEL_IDX[t] = m;
      return res;
    } catch (e) {
      lastErr = e;
      const msg = (e.message || "").toLowerCase();
      if (e.status === 400 || e.status === 404) {
        if (o.context && v.cache !== false && /cache_control|cache/.test(msg)) { v = { ...v, cache: false }; continue; }
        if (o.effort && v.effort !== false && /output_config|effort/.test(msg)) { v = { ...v, effort: false }; continue; }
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
        tier: "fast",
        effort: "low",
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
let HOME_LABEL = "Ohain (Brabant wallon)"; // suit le domicile du profil (mis à jour par l'application)

function criteriaDigest(c) {
  return [
    `Postes visés : ${c.roles.join(" ; ")}`,
    `Zones : ${c.zones.join(", ")} — trajet max ${c.maxCommute} min depuis ${HOME_LABEL}`,
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

const OFFER_SCHEMA = `{"title":"","company":null,"location":null,"contract":null,"seniority":null,"salary":null,"remote":null,"language":"fr|nl|en","publishedAt":"YYYY-MM-DD ou null","url":"","description":"","commuteMinutes":null}`;

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
- description : résumé factuel (missions, profil, conditions) en 600 caractères max, sans extrapoler.
- commuteMinutes : estimation du trajet en voiture hors heures de pointe depuis ${HOME_LABEL}, null si le lieu est inconnu.

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
- Garde les offres de niveau management / digital / IT / CRM / transformation / opérations ; ignore stages, postes juniors et métiers sans rapport.
- description : ce que l'e-mail dit de l'offre (souvent court), sans extrapoler.

Réponds uniquement avec ce JSON :
{"offers":[{"title":"","company":null,"location":null,"contract":null,"seniority":null,"salary":null,"remote":null,"language":"fr|nl|en","publishedAt":null,"url":"","description":"","commuteMinutes":null,"sourceName":"LinkedIn|Indeed|Jobat|…","emailSubject":""}],"messagesRead":0,"notes":""}`;
  },

  structure({ text, url }) {
    return `Date du jour : ${todayStr()}.
Mission : structurer une annonce d'emploi fournie par l'utilisateur.
${url ? `URL fournie : ${url}\n` : ""}${text ? `Texte de l'annonce :\n<<<\n${text.slice(0, 20000)}\n>>>\n` : ""}
${url && !text ? `Utilise web_search pour retrouver CETTE annonce précise (intitulé, entreprise, contenu). Si tu ne la retrouves pas avec certitude, réponds {"found":false,"reason":"…"}.` : "Base-toi uniquement sur le texte fourni."}
Règles : aucun champ inventé (null si absent) ; ${url ? "garde l'URL fournie telle quelle" : "url = null si aucune URL n'apparaît dans le texte"} ; description = résumé factuel de 1 200 caractères max (missions, profil, conditions) ; commuteMinutes = trajet voiture estimé depuis ${HOME_LABEL} ou null.
Réponds uniquement avec ce JSON :
{"found":true,"offer":${OFFER_SCHEMA}}`;
  },

  /* Partie stable du scoring (profil, critères, barème) : mise en cache entre les lots. */
  scoreContext(profile, c, versionLabel) {
    return `Mission : évaluer l'adéquation de chaque offre avec le profil et les critères du candidat. Sois factuel, sobre, sans complaisance.

PROFIL
${profileDigest(profile)}

CRITÈRES (version « ${versionLabel} »)
${criteriaDigest(c)}

BARÈME
- breakdown : une ligne par critère indispensable, souhaité, exclusion et signal d'alerte, en reprenant EXACTEMENT le libellé du critère.
  · indispensable / souhaité : match 0-100 = degré de satisfaction.
  · exclusion / alerte : match 0-100 = degré de PRÉSENCE (100 = clairement présent dans l'annonce).
  · note : 15 mots max, factuelle, qui s'appuie sur l'annonce. Information absente → match 50 et note « non précisé ».
- score 0-100 : moyenne pondérée des souhaités, ajustée par le reste. Plafond 45 si un indispensable est clairement non rempli ; plafond 20 si une exclusion est clairement présente.
- confidence : "haute" si missions, lieu et conditions sont détaillés ; "moyenne" si partiel ; "faible" si l'annonce est pauvre (moins de ~3 phrases utiles ou champs clés absents).
- redFlags : uniquement avec une preuve textuelle courte tirée de l'annonce (type : stress, turnover, role_flou, autre).
- questions : points à clarifier avec le recruteur.

CLARTÉ (uniquement ce que dit l'annonce, sinon null ou liste vide)
- tldr : une phrase EN FRANÇAIS de 25 mots max qui dit ce qu'est vraiment le poste, quelle que soit la langue de l'annonce.
- facts : contract (CDI | CDD | Freelance | Intérim | Stage | Autre), remoteDays (jours de télétravail par semaine, nombre), salaryMin / salaryMax (nombres, en euros), salaryPeriod (an | mois), languages (codes fr, nl, en, de exigés), teamSize (nombre de personnes à manager), reportsTo (rattachement), seniority (Junior | Médior | Senior | Manager | Direction).
- must : exigences indispensables de l'annonce (5 max, 8 mots chacune) ; nice : atouts souhaités (5 max) ; missions : missions principales (5 max, 10 mots chacune). En français.

Réponds uniquement avec ce JSON :
{"scores":[{"id":"","score":0,"confidence":"haute|moyenne|faible","confidenceReason":"","summary":"2 phrases max","tldr":"","facts":{"contract":null,"remoteDays":null,"salaryMin":null,"salaryMax":null,"salaryPeriod":null,"languages":[],"teamSize":null,"reportsTo":null,"seniority":null},"must":[],"nice":[],"missions":[],"breakdown":[{"criterion":"","kind":"indispensable|souhaité|exclusion|alerte","weight":1,"match":0,"note":""}],"strengths":[],"gaps":[],"questions":[],"redFlags":[{"type":"stress|turnover|role_flou|autre","evidence":""}]}]}`;
  },

  score(offers) {
    const compact = offers.map((o) => ({
      id: o.id, title: o.title, company: o.company, location: o.location,
      commuteMinutes: o.commute?.minutes ?? null, contract: o.contract, seniority: o.seniority,
      salary: o.salary, remote: o.remote, language: o.language, description: o.description,
    }));
    return `OFFRES À ÉVALUER\n${JSON.stringify(compact)}`;
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

  replies(items, { after, query }) {
    return `Date du jour : ${todayStr()}.
Mission : surveiller la boîte Gmail pour le pipeline de candidatures ci-dessous. LECTURE SEULE.
CANDIDATURES SUIVIES
${JSON.stringify(items)}

MÉTHODE
1. Lance cette recherche Gmail (ajuste-la si elle ne renvoie rien) : ${query}
   Ne regarde que les e-mails reçus après le ${after} (vérification incrémentale).
2. Ouvre uniquement les fils pertinents (25 au maximum) : réponses d'entreprises ou de cabinets, accusés de réception de logiciels de recrutement (Workday, SmartRecruiters, Greenhouse, Lever, Teamtailor, Recruitee, SuccessFactors, Taleo, iCIMS, Personio, Workable…), confirmations « candidature envoyée » de LinkedIn ou Indeed, invitations, tests, refus, offres.
3. Ignore les alertes emploi automatiques et les newsletters. N'envoie, ne supprime, n'archive, ne marque et ne modifie aucun message.

RÈGLES
- Ne rapporte qu'un e-mail réellement lu. subject = objet exact. threadId = identifiant du fil tel que renvoyé par l'outil, sinon null.
- Rattache un e-mail à une candidature (appId) seulement si l'entreprise, le cabinet, le poste ou le contact correspondent clairement.
- kind : confirmation_candidature | accuse_reception | invitation_entretien | test_evaluation | demande_info | refus | offre | autre.
- proposedStage : "sent" pour une confirmation de candidature envoyée, "interview" pour une invitation, "closed" pour un refus, "offer" pour une offre, sinon null.
- interviewAt : date et heure proposées (YYYY-MM-DDTHH:mm), sinon null.
- untracked : confirmations de candidature ou réponses de recruteurs qui ne correspondent à AUCUNE candidature suivie (candidature envoyée hors de l'outil).
Réponds uniquement {"replies":[{"appId":"","threadId":null,"date":"YYYY-MM-DD","from":"","subject":"","kind":"","summary":"25 mots max","proposedStage":null,"interviewAt":null}],"untracked":[{"company":"","title":"","threadId":null,"date":"YYYY-MM-DD","from":"","subject":"","kind":"confirmation_candidature|invitation_entretien|refus|autre","summary":""}],"messagesRead":0}`;
  },

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

  practice(question, answer, offer, profile) {
    return `Mission : évaluer la réponse écrite d'un candidat à une question d'entretien, comme un recruteur exigeant et bienveillant.
Poste : ${offer?.title || "non communiqué"} chez ${show(offer?.company)}.
Profil (seule source de faits) : ${profile.summary} Réalisations : ${(profile.achievements || []).join(" ; ")}

QUESTION : ${question}
RÉPONSE DU CANDIDAT :
<<<
${answer}
>>>

Règles : note de 1 à 5 ; indique les éléments STAR présents (situation, tâche, action, résultat) ; 3 forces et 3 améliorations concrètes maximum ; réponse améliorée de 180 mots maximum, dans la langue de la réponse, qui n'utilise que les faits de la réponse et du profil (chiffre manquant → [à compléter]) ; durée orale estimée en secondes (130 mots par minute).
Réponds uniquement {"score":1,"star":{"situation":false,"task":false,"action":false,"result":false},"strengths":[],"improvements":[],"improved":"","seconds":0}`;
  },

  today(items) {
    return `Voici les actions candidates d'une recherche d'emploi discrète (JSON). Classe-les par priorité pour aujourd'hui selon les échéances, le score des offres et l'avancement des candidatures. Pour chacune, une raison de 12 mots max. N'ajoute aucune action.
${JSON.stringify(items.map(({ id, label, detail, due }) => ({ id, label, detail, due })))}
Réponds uniquement {"ordered":[{"id":"","priority":1,"reason":""}]} (priorité 1 = urgent, 3 = peut attendre).`;
  },
};

/* Faits normalisés extraits au scoring : nombres et listes propres, null si absents. */
function normFacts(f) {
  if (!f || typeof f !== "object") return null;
  const num = (v) => { const n = Number(String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };
  const contract = str(f.contract);
  return {
    contract: contract && /^(CDI|CDD|Freelance|Intérim|Stage|Autre)$/i.test(contract) ? contract : contract,
    remoteDays: f.remoteDays === 0 ? 0 : num(f.remoteDays) !== null && num(f.remoteDays) <= 5 ? num(f.remoteDays) : null,
    salaryMin: num(f.salaryMin), salaryMax: num(f.salaryMax),
    salaryPeriod: /mois|month|maand/i.test(f.salaryPeriod || "") ? "mois" : f.salaryMin || f.salaryMax ? "an" : null,
    languages: (Array.isArray(f.languages) ? f.languages : []).map((l) => String(l).toLowerCase().slice(0, 2)).filter((l) => DOC_LANGS.includes(l)),
    teamSize: num(f.teamSize), reportsTo: str(f.reportsTo), seniority: str(f.seniority),
  };
}
const fmtK = (n) => (n >= 1000 ? `${Math.round(n / 100) / 10}`.replace(".", ",") + " k" : String(n));
function fmtSalary(f, raw) {
  if (f && (f.salaryMin || f.salaryMax)) {
    const range = f.salaryMin && f.salaryMax && f.salaryMin !== f.salaryMax ? `${fmtK(f.salaryMin)} – ${fmtK(f.salaryMax)}` : fmtK(f.salaryMin || f.salaryMax);
    return `${range} € / ${f.salaryPeriod || "an"}`;
  }
  return raw || null;
}
/* Verdict calculé localement (cohérent avec le score, gratuit) : Postuler, À creuser, Passer. */
function offerVerdict(o, threshold) {
  const s = o?.score;
  if (!s) return null;
  if (s.caps?.length || s.value < 50) return { id: "skip", label: "Passer", tone: "neutral" };
  if (s.value >= threshold && s.confidence !== "faible" && !(s.redFlags || []).length) return { id: "apply", label: "Postuler", tone: "ok" };
  return { id: "dig", label: "À creuser", tone: "warn" };
}

/* Score final : score IA borné par les règles dures, pour qu'il reste cohérent avec sa décomposition. */
function finalizeScore(s, versionId) {
  const bd = Array.isArray(s.breakdown) ? s.breakdown : [];
  let score = clamp(Math.round(Number(s.score) || 0), 0, 100);
  const caps = [];
  if (bd.some((b) => b.kind === "indispensable" && Number(b.match) < 30)) { score = Math.min(score, 45); caps.push("indispensable non rempli"); }
  if (bd.some((b) => b.kind === "exclusion" && Number(b.match) >= 70)) { score = Math.min(score, 20); caps.push("exclusion touchée"); }
  return {
    value: score,
    confidence: ["haute", "moyenne", "faible"].includes(s.confidence) ? s.confidence : "moyenne",
    confidenceReason: str(s.confidenceReason),
    summary: str(s.summary),
    breakdown: bd.map((b) => ({ criterion: String(b.criterion || ""), kind: b.kind || "souhaité", weight: Number(b.weight) || null, match: clamp(Number(b.match) || 0, 0, 100), note: str(b.note) })),
    strengths: (s.strengths || []).map(String),
    gaps: (s.gaps || []).map(String),
    questions: (s.questions || []).map(String),
    redFlags: (s.redFlags || []).filter((r) => r && r.evidence).map((r) => ({ type: r.type || "autre", evidence: String(r.evidence) })),
    tldr: str(s.tldr),
    facts: normFacts(s.facts),
    must: (s.must || []).map(String).filter(Boolean).slice(0, 6),
    nice: (s.nice || []).map(String).filter(Boolean).slice(0, 6),
    missions: (s.missions || []).map(String).filter(Boolean).slice(0, 6),
    caps,
    criteriaVersionId: versionId,
    scoredAt: nowISO(),
  };
}

/* Re-pondération locale : si seule la pondération des souhaités change, le score est recalculé sans appel IA. */
function onlyWeightsChanged(prev, next) {
  if (!prev || !next) return false;
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  if (!["roles", "zones", "maxCommute", "remote", "mustHave", "exclusions", "redFlags", "keywords"].every((k) => same(prev[k], next[k]))) return false;
  const lab = (c) => (c.wishes || []).map((w) => w.label), wt = (c) => (c.wishes || []).map((w) => w.weight);
  return same(lab(prev), lab(next)) && !same(wt(prev), wt(next));
}
function reweightScore(score, prevWishes, nextWishes, versionId) {
  const rows = (score?.breakdown || []).filter((b) => b.kind === "souhaité");
  const find = (label) => rows.find((r) => normText(r.criterion) === normText(label)) || rows.find((r) => jaccard(tokens(r.criterion), tokens(label)) >= 0.5);
  // Un souhait absent de la décomposition vaut 50 (« non précisé »), comme dans le barème IA ; au moins la moitié doit correspondre.
  const pairs = nextWishes.map((w) => ({ w, r: find(w.label) || { match: 50, missing: true }, old: prevWishes.find((x) => x.label === w.label)?.weight || w.weight }));
  if (!pairs.length || pairs.filter((x) => x.r.missing).length > pairs.length / 2) return null;
  const avg = (useOld) => {
    const tot = pairs.reduce((n, x) => n + (useOld ? x.old : x.w.weight), 0);
    return tot ? pairs.reduce((n, x) => n + x.r.match * (useOld ? x.old : x.w.weight), 0) / tot : 0;
  };
  let value = clamp(Math.round(score.value + avg(false) - avg(true)), 0, 100);
  if (score.caps?.includes("indispensable non rempli")) value = Math.min(value, 45);
  if (score.caps?.includes("exclusion touchée")) value = Math.min(value, 20);
  return { ...score, value, breakdown: score.breakdown.map((b) => { const x = pairs.find((q) => q.r === b); return x ? { ...b, weight: x.w.weight } : b; }), criteriaVersionId: versionId, local: true, scoredAt: nowISO() };
}

/* ════════════════════════════════════════════════════════════════════════
   6. DONNÉES DE DÉMONSTRATION (étiquetées « exemple », supprimables en un clic)
   ════════════════════════════════════════════════════════════════════════ */

function makeCriteriaState(body = DEFAULT_CRITERIA_BODY) {
  const v = { id: uid("crit"), label: "v1 — critères initiaux", createdAt: nowISO(), ...deepClone(body) };
  return { draft: deepClone(body), versions: [v] };
}

const DEMO_KEYWORDS = ["transformation digitale", "CRM", "Dynamics 365", "automatisation", "management", "feuille de route", "gouvernance", "Power Automate", "KPI", "SAP"];
const DEMO_CV = `# Alex Martin (exemple)
> Digital Transformation Manager — CRM, automatisation et pilotage d'équipe
@ Ohain, Belgique | alex.martin@exemple.be | +32 470 00 00 00 | linkedin.com/in/exemple
## Profil
Manager de la transformation digitale dans une fédération patronale belge. Responsable du CRM Dynamics 365 et d'une équipe de 4 personnes. Pilote la digitalisation et l'automatisation des processus, du cadrage au déploiement, avec un suivi par KPI et une gouvernance claire.
## Réalisations clés
- Réduction de 35 % du délai de traitement des adhésions grâce à 12 flux Power Automate (exemple)
- Migration de 48 000 contacts vers Dynamics 365 sans perte de données, en 4 mois (exemple)
- Adoption du CRM portée de 52 % à 88 % en un an par la formation et des tableaux de bord (exemple)
## Expérience professionnelle
### Business Improvement Manager | Fédération patronale belge | Bruxelles | 2019 – aujourd'hui
- Pilotage de la feuille de route digitale et de son budget (exemple)
- Management d'une équipe de 4 : priorisation, montée en compétences, rituels agiles
- Automatisation de 20 processus métier avec Power Automate et Make (exemple)
### Chef de projet CRM | Entreprise de services | Wavre | 2015 – 2019
- Déploiement d'un CRM pour 120 utilisateurs, en 3 vagues (exemple)
- Conception des rapports Power BI de suivi commercial
## Compétences
**CRM :** Dynamics 365, Dataverse, Customer Insights
**Automatisation :** Power Automate, Make, API REST
**Management :** équipe de 4, gestion de projets ICT, conduite du changement
## Langues
**Français :** langue maternelle
**Néerlandais :** courant
**Anglais :** courant
## Formation
### Master en sciences de gestion | Université (exemple) | 2012
## Certifications
- Microsoft Certified: Power Platform Functional Consultant (exemple)`;
const DEMO_LETTER = `# Alex Martin (exemple)
@ Ohain, Belgique | alex.martin@exemple.be | +32 470 00 00 00
= Ohain, le 21 octobre 2026
> Service recrutement
> Exemple Logistics SA
## Objet : candidature au poste de Digital Transformation Manager
Madame, Monsieur,

Votre annonce met l'accent sur la gouvernance du CRM et l'automatisation des processus : ce sont précisément les deux chantiers que je pilote depuis cinq ans dans une fédération patronale belge.

J'y ai réduit de 35 % le délai de traitement des adhésions en automatisant 12 flux, et porté l'adoption du CRM de 52 % à 88 % en un an. Je dirige une équipe de 4 personnes, avec des priorités claires et un suivi par indicateurs.

Chez Exemple Logistics, je mettrais cette méthode au service de votre feuille de route digitale : cadrer, livrer par étapes, mesurer.

Je me tiens à votre disposition pour un entretien.

~ Alex Martin`;

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
  const demoDoc = (text) => ({ id: uid("doc"), text, format: "markup", lang: "fr", accent: "#0f766e", accentSource: "exemple", keywords: DEMO_KEYWORDS, missingInProfile: ["SAP (exemple)"], tips: ["Exemple : chiffrez l'impact sur les délais logistiques.", "Exemple : citez un projet de gouvernance de données."], createdAt: addDays(t, -10), origin: "IA" });
  const apps = [
    {
      id: "demo_app_1", offerId: "demo_off_1", stage: "sent", demo: true, createdAt: addDays(t, -12), updatedAt: sentAt, sentAt,
      closed: null, docs: { cv: [demoDoc(DEMO_CV)], letter: [demoDoc(DEMO_LETTER)] }, docLanguage: "fr", design: designFromTemplate("modern", { accent: "#0f766e" }),
      prep: null, contactIds: ["demo_ct_1"], interviews: [],
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
      emails: [{ id: "demo_mail_1", date: addDays(t, -2).slice(0, 10), from: "rh@exemple-mutualite.be", subject: "Invitation à un premier entretien (exemple)", kind: "invitation_entretien", summary: "Proposition d'un entretien RH en visioconférence (exemple).", threadId: null, at: addDays(t, -2) }],
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

function IconBtn({ icon: Icon, label, onClick, className = "", active, small, ...rest }) {
  const T = useT();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      {...rest}
      className={`inline-flex items-center justify-center shrink-0 ${small ? "w-7 h-7 rounded-lg" : "w-9 h-9 rounded-xl"} transition-colors duration-200 disabled:opacity-40 ${active ? T.accentSoft : T.btnGhost} ${T.ring} ${className}`}
    >
      <Icon className={small ? "w-3.5 h-3.5" : "w-4 h-4"} aria-hidden="true" />
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
  const [saveState, setSaveState] = useState("idle");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [criteria, setCriteria] = useState(() => makeCriteriaState());
  const [sources, setSources] = useState(DEFAULT_SOURCES);
  const [offers, setOffers] = useState([]);
  const [apps, setApps] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [ratings, setRatings] = useState({});
  const [media, setMedia] = useState({});
  const [inbox, setInbox] = useState({ replies: [], untracked: [] });
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
  const [replyOpen, setReplyOpen] = useState(false);
  const [studio, setStudio] = useState(null);
  const [exportFor, setExportFor] = useState(null);
  const [compare, setCompare] = useState(null);
  const [veille, setVeille] = useState({ routine: null, status: null, configSig: null, configLoaded: false });
  const veilleRef = useRef(veille);
  veilleRef.current = veille;

  const prefersDark = usePrefersDark();
  const dark = settings.theme === "dark" || (settings.theme === "system" && prefersDark);
  const T = dark ? THEMES.dark : THEMES.light;

  /* Référence toujours à jour pour les traitements asynchrones longs. */
  const R = useRef({});
  R.current = { settings, profile, criteria, sources, offers, apps, contacts, ratings, media, inbox };
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
        // Lecture des collections en parallèle (démarrage plus rapide, surtout en page publiée).
        const out = Object.fromEntries(await Promise.all(Object.entries(KEYS).map(async ([name, key]) => {
          if (existing && !existing.includes(key)) return [name, null];
          try {
            return [name, await storage.get(key)];
          } catch (e) {
            if (existing || RT.mode === "published") throw e; // lecture en échec : on n'écrase rien
            return [name, null]; // sans liste, une erreur signifie le plus souvent « clé absente »
          }
        })));
        const first = Object.values(out).every((v) => v === null || v === undefined);
        if (first) {
          applyDefaults();
        } else {
          const s = out.settings || {};
          setSettings({
            ...DEFAULT_SETTINGS, ...s,
            mcp: { ...DEFAULT_SETTINGS.mcp, ...(s.mcp || {}) },
            mcpTools: { ...DEFAULT_SETTINGS.mcpTools, ...(s.mcpTools || {}) },
            followUp: { ...DEFAULT_SETTINGS.followUp, ...(s.followUp || {}) },
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
          setOffers((out.offers || []).map((o) => (closedOffers.has(o.id) && o.status !== "closed" ? { ...o, status: "closed" } : o)));
          if (out.ratings) setRatings(out.ratings);
          if (out.media) setMedia(out.media);
          if (out.inbox) setInbox({ replies: [], untracked: [], ...out.inbox });
          setApps(out.apps || []);
          setContacts(out.contacts || []);
        }
      } catch (e) {
        setStorageState({ ok: false, readOnly: true, message: `Lecture des données impossible (${e.message}). L'enregistrement est suspendu pour ne rien écraser. Rechargez l'artefact.` });
        applyDefaults();
      } finally {
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
  usePersist(KEYS.media, media, persistOn, setSaveState);
  usePersist(KEYS.inbox, inbox, persistOn, setSaveState);
  useEffect(() => { HOME_LABEL = str(profile.home) || "Ohain (Brabant wallon)"; }, [profile.home]);

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
  const applyIncoming = (incoming) => {
    const { list, added, merged } = mergeOffers(R.current.offers, incoming);
    R.current.offers = list;
    setOffers(list);
    return { added, merged };
  };

  /* ── Scoring ────────────────────────────────────────────────────── */
  const scoreOffers = (ids) => withBusy("score", async () => {
    const { settings: s, profile: p, criteria: c } = R.current;
    const ver = activeVersion(c);
    const targets = R.current.offers.filter((o) => ids.includes(o.id));
    if (!targets.length) return;
    setProgress({ label: "Scoring", done: 0, total: targets.length });
    let ok = 0, failed = 0;
    const context = P.scoreContext(p, ver, ver.label);
    const runBatch = async (batch) => {
      try {
        const { data } = await askJSON(s, { system: SYSTEM_BASE, context, prompt: P.score(batch), maxTokens: 16000, tier: "deep", effort: "medium" });
        const byId = Object.fromEntries((Array.isArray(data?.scores) ? data.scores : []).map((x) => [x.id, x]));
        const got = batch.filter((o) => byId[o.id]).length;
        ok += got;
        failed += batch.length - got;
        setOffers((l) => l.map((o) => (byId[o.id] ? { ...o, score: finalizeScore(byId[o.id], ver.id) } : o)));
      } catch (e) {
        failed += batch.length;
        toast(`Scoring : ${e.message}`, "danger");
      } finally {
        setProgress((pr) => pr && { ...pr, done: Math.min(pr.total, pr.done + batch.length) });
      }
    };
    // Premier lot seul : il écrit le cache du contexte, que les lots suivants (en parallèle) relisent.
    const batches = chunk(targets, 5);
    await runBatch(batches[0]);
    await pool(batches.slice(1), 3, runBatch);
    setProgress(null);
    toast(`${ok} offre(s) scorée(s)${failed ? ` · ${failed} non scorée(s)` : ""}`, failed ? "warn" : "ok");
  });

  const staleIds = useMemo(() => {
    const vid = activeVersion(criteria)?.id;
    return offers.filter((o) => !o.demo && isActiveOffer(o) && isStale(o, vid)).map((o) => o.id);
  }, [offers, criteria]);

  const rescoreStale = () => {
    const vid = activeVersion(R.current.criteria)?.id;
    const ids = R.current.offers
      .filter((o) => !o.demo && isActiveOffer(o) && isStale(o, vid))
      .sort((a, b) => new Date(b.collectedAt) - new Date(a.collectedAt))
      .slice(0, 40)
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
    let merged = 0, errors = 0;
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
        newIds.push(...r.added);
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
    toast(`Veille terminée : ${newIds.length} nouvelle(s) offre(s), ${merged} fusion(s)${errors ? `, ${errors} source(s) en erreur` : ""}`, errors ? "warn" : "ok");
    if (newIds.length) await scoreOffers(newIds);
  });

  const importGmail = (days) => withBusy("gmail", async () => {
    const s = R.current.settings;
    const res = await askJSON(s, {
      system: SYSTEM_BASE,
      prompt: P.gmail(days || s.gmailDays),
      mcp: [{ server: "gmail", allow: s.mcpTools.gmailRead }],
      maxTokens: 16000,
      tier: "balanced",
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
    toast(`Gmail : ${res.data?.messagesRead ?? "?"} e-mail(s) lu(s), ${r.added.length} nouvelle(s) offre(s), ${r.merged.length} fusion(s)`, "ok");
    if (r.added.length) await scoreOffers(r.added);
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
      tier: "balanced",
      effort: "low",
    });
    if (!res.data?.found || !res.data.offer) throw new Error(`Annonce non retrouvée${res.data?.reason ? ` (${res.data.reason})` : ""}. Collez plutôt le texte de l'annonce.`);
    const o = normalizeOffer(
      { ...res.data.offer, url: cleanUrl || res.data.offer.url },
      { sourceName: "Import manuel", via: str(text) ? "texte collé" : "URL + web_search", allowNoUrl: true },
    );
    if (!o) throw new Error("Impossible de structurer cette annonce (intitulé manquant).");
    if (o.sources[0].url) o.sources[0].verified = cleanUrl ? true : (text || "").includes(o.sources[0].url);
    const r = applyIncoming([o]);
    toast(r.added.length ? "Annonce importée et structurée" : "Annonce déjà connue : sources fusionnées", "ok");
    if (r.added.length) await scoreOffers(r.added);
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
    toast(`Import JSON : ${r.added.length} nouvelle(s), ${r.merged.length} fusion(s)${skipped ? `, ${skipped} ignorée(s) (intitulé ou URL manquant)` : ""}`, skipped ? "warn" : "ok");
    if (r.added.length) await scoreOffers(r.added);
    return true;
  });

  /* ── Doublons : détection IA, fusion validée, annulable ──────────── */
  const inPipeline = (oid) => R.current.apps.some((a) => a.offerId === oid);
  const detectDuplicates = () => withBusy("dedupe", async () => {
    const pool0 = R.current.offers
      .filter((o) => !o.demo && isActiveOffer(o))
      .sort((a, b) => companyKey(a.company).localeCompare(companyKey(b.company)) || normText(a.title).localeCompare(normText(b.title)))
      .slice(0, 180);
    if (pool0.length < 2) { toast("Pas assez d'offres pour rechercher des doublons.", "neutral"); return; }
    const known = new Set(pool0.map((o) => o.id));
    const used = new Set();
    const groups = [];
    for (const batch of chunk(pool0, 60)) {
      const { data } = await askJSON(R.current.settings, { system: SYSTEM_BASE, prompt: P.dedupe(batch), maxTokens: 6000, tier: "fast", effort: "low" });
      for (const g of Array.isArray(data?.groups) ? data.groups : []) {
        const ids = [...new Set((g.ids || []).filter((id) => known.has(id) && !used.has(id)))];
        if (ids.length < 2) continue;
        if (ids.filter(inPipeline).length > 1) continue; // deux candidatures distinctes : on ne fusionne pas
        ids.forEach((id) => used.add(id));
        groups.push({ id: uid("dup"), ids, confidence: g.confidence === "haute" ? "haute" : "moyenne", reason: str(g.reason), accept: g.confidence === "haute" });
      }
    }
    if (!groups.length) { toast("Aucun doublon détecté.", "ok"); return; }
    setDupeProposals(groups);
  });

  const mergeGroup = (ids, reason) => {
    const list = R.current.offers;
    const members = ids.map((id) => list.find((o) => o.id === id)).filter(Boolean);
    if (members.length < 2) return false;
    const primary = members.find((o) => inPipeline(o.id))
      || [...members].sort((a, b) => (b.score?.value ?? -1) - (a.score?.value ?? -1) || new Date(a.collectedAt) - new Date(b.collectedAt))[0];
    const absorbed = members.filter((o) => o.id !== primary.id);
    const before = { sources: primary.sources, description: primary.description, ...Object.fromEntries(FILLABLE.map((k) => [k, primary[k]])) };
    const merged = { ...primary, sources: [...(primary.sources || [])] };
    for (const o of absorbed) {
      for (const src of o.sources || []) if (!merged.sources.some((x) => canonicalUrl(x.url) === canonicalUrl(src.url) && x.name === src.name)) merged.sources.push(src);
      for (const k of FILLABLE) if ((merged[k] === null || merged[k] === undefined || merged[k] === "") && o[k]) merged[k] = o[k];
      if (o.description && (!merged.description || o.description.length > merged.description.length)) merged.description = o.description;
    }
    merged.mergeHistory = [...(primary.mergeHistory || []), { id: uid("merge"), at: nowISO(), reason: str(reason), origin: "IA validée", before, absorbed }];
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
    toast(n ? `${n} fusion(s) effectuée(s) — annulables depuis la fiche de l'offre` : "Aucune fusion appliquée", n ? "ok" : "neutral");
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

  /* ── Surveillance Gmail du pipeline : lecture seule, incrémentale, toujours validée ── */
  const replyKey = (r) => `${r.date || ""}|${normText(r.from)}|${normText(r.subject)}`;
  const monitoredApps = () => R.current.apps.filter((a) => !a.demo && a.stage !== "closed" && (a.sentAt || ["prep", "sent", "followup", "interview", "offer"].includes(a.stage)));
  const setInboxNow = (next) => { R.current.inbox = next; setInbox(next); };
  const checkReplies = ({ auto = false } = {}) => withBusy("replies", async () => {
    const { settings: s, offers: O, contacts: C } = R.current;
    const active = monitoredApps();
    if (!active.length) { if (!auto) toast("Aucune candidature à surveiller (préparation, envoyée ou au-delà).", "neutral"); return; }
    // Fenêtre incrémentale : depuis la dernière vérification (1 jour de marge), sans remonter avant la plus ancienne candidature.
    const oldest = active.reduce((m, a) => Math.min(m, new Date(a.sentAt || a.createdAt).getTime()), Date.now());
    const last = s.lastReplyWindowAt ? new Date(s.lastReplyWindowAt).getTime() - 864e5 : 0;
    const after = new Date(Math.max(oldest - 864e5, last, Date.now() - 120 * 864e5)).toISOString().slice(0, 10);
    const items = active.map((a) => {
      const o = O.find((x) => x.id === a.offerId);
      return {
        appId: a.id, title: o?.title || null, company: o?.company || null, stage: a.stage, sentAt: a.sentAt ? a.sentAt.slice(0, 10) : null,
        sites: [...new Set((o?.sources || []).map((x) => hostOf(x.url)).filter(Boolean))],
        contacts: C.filter((c) => (a.contactIds || []).includes(c.id)).map((c) => ({ name: c.name, email: c.email || null, company: c.company || null })),
      };
    });
    const companies = [...new Set(items.map((i) => i.company).filter((c) => c && !/confidenti|non communiqu|anonyme/i.test(c)))].slice(0, 20);
    const emails = [...new Set(items.flatMap((i) => i.contacts.map((c) => c.email)).filter(Boolean))].slice(0, 15);
    const query = `after:${after.replace(/-/g, "/")} -category:promotions (${[
      ...companies.map((c) => `"${c.replace(/"/g, "")}"`),
      ...emails.map((e) => `from:${e}`),
      `from:(${ATS_SENDERS.join(" OR ")})`,
      "subject:(candidature OR application OR sollicitatie OR bewerbung OR entretien OR interview OR gesprek OR sollicitatiegesprek)",
    ].join(" OR ")})`;
    const res = await askJSON(s, { system: SYSTEM_BASE, prompt: P.replies(items, { after, query }), mcp: [{ server: "gmail", allow: s.mcpTools.gmailRead }], maxTokens: 12000, tier: "balanced" });
    if (res.toolCalls.some((n) => /send|trash|delete|modify|label|forward|reply|spam/i.test(n))) toast(`Attention : outil Gmail inattendu appelé (${res.toolCalls.join(", ")}).`, "danger");
    if (!res.toolCalls.length) throw new Error("Gmail n'a pas été consulté : vérifiez que le connecteur Gmail est activé pour cet artefact.");
    const now = nowISO();
    setSettings((x) => ({ ...x, lastReplyCheckAt: now, lastReplyWindowAt: now }));
    const hay = normText(res.toolText);
    const thread = (t) => (str(t) && hay.includes(normText(t)) ? str(t) : null);
    const day = (d) => (str(d) && !isNaN(new Date(d).getTime()) ? String(d).slice(0, 10) : null);
    const seen = new Set([...R.current.apps.flatMap((a) => a.seenReplies || []), ...R.current.inbox.replies.map(replyKey)]);
    const found = (Array.isArray(res.data?.replies) ? res.data.replies : [])
      .filter((r) => r && active.some((a) => a.id === r.appId) && str(r.subject))
      .map((r) => ({
        id: uid("rep"), appId: r.appId, threadId: thread(r.threadId), date: day(r.date), from: str(r.from), subject: str(r.subject),
        kind: REPLY_KINDS[r.kind] ? r.kind : "autre", summary: str(r.summary),
        interviewAt: str(r.interviewAt) && !isNaN(new Date(r.interviewAt).getTime()) ? new Date(r.interviewAt).toISOString() : null,
        action: ["sent", "interview", "closed", "offer"].includes(r.proposedStage) ? r.proposedStage : "log",
        verified: hay.includes(normText(r.subject)), at: now,
      }))
      .filter((r) => !seen.has(replyKey(r)));
    const seenU = new Set([...(s.seenUntracked || []), ...R.current.inbox.untracked.map(replyKey)]);
    const untracked = (Array.isArray(res.data?.untracked) ? res.data.untracked : [])
      .filter((u) => u && str(u.subject) && str(u.company))
      .map((u) => ({ id: uid("unt"), company: str(u.company), title: str(u.title), threadId: thread(u.threadId), date: day(u.date), from: str(u.from), subject: str(u.subject), kind: REPLY_KINDS[u.kind] ? u.kind : "autre", summary: str(u.summary), verified: hay.includes(normText(u.subject)), at: now }))
      .filter((u) => !seenU.has(replyKey(u)));
    setInboxNow({ replies: [...R.current.inbox.replies, ...found], untracked: [...R.current.inbox.untracked, ...untracked] });
    if (found.length || untracked.length) {
      toast(`Gmail : ${found.length} réponse(s)${untracked.length ? ` et ${untracked.length} candidature(s) non suivie(s)` : ""} à valider.`, "ok");
      if (!auto) setReplyOpen(true);
    } else if (!auto) toast(`Aucune nouvelle réponse depuis le ${fmtDate(after)} (${res.data?.messagesRead ?? "?"} e-mail(s) lu(s)).`, "ok");
  });
  const resolveReply = (r, apply) => {
    patchApp(r.appId, (a) => {
      const n = { ...a, seenReplies: [...(a.seenReplies || []), replyKey(r)] };
      if (!apply) return n;
      const mail = { id: uid("mail"), date: r.date, from: r.from, subject: r.subject, kind: r.kind, summary: r.summary, threadId: r.threadId, at: nowISO() };
      return addLogEntry({ ...n, emails: [...(n.emails || []), mail] }, "email", `E-mail reçu (${REPLY_KINDS[r.kind]}) de ${r.from || NC} : « ${r.subject} »${r.summary ? ` — ${r.summary}` : ""}`);
    });
    if (apply) {
      const cur = R.current.apps.find((a) => a.id === r.appId);
      if (r.action === "sent") {
        const sentAt = r.date ? new Date(`${r.date}T09:00:00`).toISOString() : undefined;
        if (cur && STAGE_INDEX[cur.stage] < STAGE_INDEX.sent) moveApp(r.appId, "sent", { sentAt });
        else if (cur && !cur.sentAt && sentAt) patchApp(r.appId, (a) => ({ ...a, sentAt }));
      } else if (r.action === "interview") {
        if (r.interviewAt) addInterview(r.appId, { at: r.interviewAt, type: "À préciser", location: "", notes: `Selon l'e-mail « ${r.subject} »` });
        else moveApp(r.appId, "interview");
      } else if (r.action === "closed") moveApp(r.appId, "closed", { outcome: "refused", reason: r.summary || "Réponse négative reçue par e-mail" });
      else if (r.action === "offer") moveApp(r.appId, "offer");
    }
    setInboxNow({ ...R.current.inbox, replies: R.current.inbox.replies.filter((x) => x.id !== r.id) });
  };
  const resolveUntracked = (u, create) => {
    if (create) {
      const t = nowISO();
      const sentAt = u.date ? new Date(`${u.date}T09:00:00`).toISOString() : t;
      const stage = u.kind === "invitation_entretien" ? "interview" : u.kind === "refus" ? "closed" : "sent";
      const off = {
        id: uid("off"), title: u.title || "Candidature détectée dans Gmail", company: u.company, location: null, commute: null, contract: null, seniority: null, salary: null, remote: null,
        language: null, publishedAt: null, description: u.summary || null, collectedAt: t, lastSeenAt: t, status: stage === "closed" ? "closed" : "pipeline", score: null, demo: false,
        sources: [{ name: "Gmail", url: null, collectedAt: t, via: "surveillance Gmail", verified: null, emailSubject: u.subject }],
      };
      const rules = R.current.settings.followUp;
      const app = {
        id: uid("app"), offerId: off.id, stage, reached: STAGE_INDEX[stage === "closed" ? "sent" : stage], createdAt: t, updatedAt: t, sentAt,
        closed: stage === "closed" ? { outcome: "refused", reason: u.summary, at: t } : null, docs: {}, prep: null, contactIds: [], interviews: [], demo: false,
        followUps: stage === "sent" ? rules.afterSend.map((d, i) => ({ id: uid("fu"), kind: i === 0 ? "relance1" : i === 1 ? "relance2" : "custom", due: addDays(sentAt, d), status: "pending", draft: null })) : [],
        emails: [{ id: uid("mail"), date: u.date, from: u.from, subject: u.subject, kind: u.kind, summary: u.summary, threadId: u.threadId, at: t }],
        log: [{ id: uid("log"), at: t, type: "email", text: `Candidature détectée dans Gmail : « ${u.subject} »` }],
      };
      R.current.offers = [off, ...R.current.offers];
      setOffers((l) => [off, ...l]);
      R.current.apps = [app, ...R.current.apps];
      setApps((l) => [app, ...l]);
      toast(`Ajoutée au pipeline : ${u.company} (${STAGE_LABEL[stage]})`, "ok");
    }
    setSettings((x) => ({ ...x, seenUntracked: [...(x.seenUntracked || []), replyKey(u)].slice(-300) }));
    setInboxNow({ ...R.current.inbox, untracked: R.current.inbox.untracked.filter((x) => x.id !== u.id) });
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
    const res = await askJSON(R.current.settings, { system: SYSTEM_BASE, prompt: P.ratings(list), web: { maxUses: Math.min(10, list.length * 2) }, maxTokens: 6000, tier: "balanced", effort: "low" });
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

  /* ── Tri rapide des offres ──────────────────────────────────────── */
  const nextOfferId = (id) => {
    const q = offerQueue.length ? offerQueue : R.current.offers.filter(isActiveOffer).map((o) => o.id);
    const i = q.indexOf(id);
    return i >= 0 ? q[i + 1] || null : q[0] || null;
  };
  const triageOffer = (id, patch) => {
    const nxt = nextOfferId(id);
    patchOffer(id, patch);
    if (R.current.settings.autoNext && nxt) setOfferSel(nxt);
    else setOfferSel(null);
  };

  /* ── Critères ───────────────────────────────────────────────────── */
  const saveCriteriaVersion = (label) => {
    const c = R.current.criteria;
    const prev = activeVersion(c);
    const v = { id: uid("crit"), label: label || `v${c.versions.length + 1} — ${fmtDate(nowISO())}`, createdAt: nowISO(), ...deepClone(c.draft) };
    const next = { ...c, versions: [...c.versions, v] };
    R.current.criteria = next;
    setCriteria(next);
    toast(`Version enregistrée : ${v.label}`, "ok");
    if (prev && onlyWeightsChanged(criteriaBody(prev), criteriaBody(v))) {
      let n = 0;
      const list = R.current.offers.map((o) => {
        if (o.score?.criteriaVersionId !== prev.id) return o;
        const ns = reweightScore(o.score, prev.wishes || [], v.wishes || [], v.id);
        if (!ns) return o;
        n += 1;
        return { ...o, score: ns };
      });
      R.current.offers = list;
      setOffers(list);
      if (n) toast(`${n} score(s) recalculé(s) localement : seules les pondérations ont changé, aucun appel IA.`, "ok");
    }
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
    const { data } = await askJSON(R.current.settings, { system: SYSTEM_BASE, prompt: P.keywords(R.current.criteria.draft), maxTokens: 3000, tier: "fast", effort: "low" });
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

  const addToPipeline = (oid, stage = "retained") => {
    const existing = R.current.apps.find((a) => a.offerId === oid);
    if (existing) { openApp(existing.id); return existing.id; }
    const app = {
      id: uid("app"), offerId: oid, stage, createdAt: nowISO(), updatedAt: nowISO(), sentAt: null, closed: null,
      docs: {}, prep: null, contactIds: [], interviews: [], followUps: [], demo: false,
      log: [{ id: uid("log"), at: nowISO(), type: "stage", text: `Ajoutée au pipeline : ${STAGE_LABEL[stage]}` }],
    };
    R.current.apps = [app, ...R.current.apps];
    setApps((l) => [app, ...l]);
    patchOffer(oid, { status: "pipeline" });
    toast(`Ajoutée au pipeline (${STAGE_LABEL[stage]})`, "ok");
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
      const res = await askJSON(s, { system: SYSTEM_TOOLS, prompt: P.gmailDraft({ to, subject, body }), mcp: [{ server: "gmail", allow: s.mcpTools.gmailDraft }], maxTokens: 4000, tier: "balanced", effort: "low" });
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
        tier: "balanced",
        effort: "low",
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
  const generateDocs = (appId, types, instruction, langOverride) => withBusy(`dossier:${appId}`, async () => {
    const { settings: s, profile: p } = R.current;
    const app = R.current.apps.find((a) => a.id === appId);
    const offer0 = R.current.offers.find((o) => o.id === app?.offerId);
    if (!app || !offer0) throw new Error("Candidature introuvable.");
    const offer = langOverride ? { ...offer0, language: langOverride } : offer0;
    const proParts = types.filter((t) => t === "cv" || t === "letter");
    const otherParts = types.filter((t) => !proParts.includes(t));
    const [pro, rest] = await Promise.all([
      proParts.length ? askJSON(s, { system: SYSTEM_BASE, prompt: P.cvPro(offer, p, proParts, instruction), maxTokens: 16000, tier: "deep" }) : null,
      otherParts.length ? askJSON(s, { system: SYSTEM_BASE, prompt: P.dossier(offer, p, otherParts, instruction), maxTokens: 12000, tier: "balanced" }) : null,
    ]);
    const data = { ...(rest?.data || {}), language: pro?.data?.language || rest?.data?.language };
    const lang = langOverride || (DOC_LANGS.includes(data.language) ? data.language : offerLang(offer));
    const versions = {};
    if (pro?.data) {
      const d = pro.data;
      const accent = cleanHex(d.accent, null);
      const common = { accent, accentSource: accent ? str(d.accentSource) || "suggérée" : null, keywords: (d.keywords?.fromAd || []).map(String).slice(0, 30), missingInProfile: (d.keywords?.missingInProfile || []).map(String), tips: (d.tips || []).map(String) };
      for (const t of proParts) {
        const txt = typeof d[t] === "string" ? d[t].trim() : "";
        if (txt) versions[t] = { text: txt, format: "markup", lang, ...common, id: uid("doc"), createdAt: nowISO(), origin: "IA", instruction: str(instruction) };
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
      versions[t] = { ...v, lang, id: uid("doc"), createdAt: nowISO(), origin: "IA", instruction: str(instruction) };
    }
    if (!Object.keys(versions).length) throw new Error("Aucun document reçu de l'IA.");
    patchApp(appId, (a) => {
      const docs = { ...(a.docs || {}) };
      for (const [t, v] of Object.entries(versions)) docs[t] = [...(docs[t] || []), v];
      const n = { ...a, docs, docLanguage: a.docLanguage || lang };
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

  /* ── Traduction des documents (structure et faits conservés) ───── */
  const translateDoc = (appId, kind, from, to) => withBusy(`tr:${appId}:${kind}:${to}`, async () => {
    const app = R.current.apps.find((a) => a.id === appId);
    const offer = R.current.offers.find((o) => o.id === app?.offerId);
    const src = latestDoc(app, offer, kind, from);
    if (!src) throw new Error(`Aucune version ${LANG_FLAG[from]} à traduire.`);
    const { data } = await askJSON(R.current.settings, { system: SYSTEM_BASE, prompt: P.translate(src.text, kind, from, to, offer), maxTokens: 12000, tier: "balanced", effort: "low" });
    const text = typeof data?.text === "string" ? data.text.trim() : "";
    if (!text) throw new Error("Traduction vide : réessayez.");
    const { id: _i, createdAt: _c, origin: _o, instruction: _n, ...keep } = src;
    const v = { ...keep, text, lang: to, from, id: uid("doc"), createdAt: nowISO(), origin: "traduction" };
    patchApp(appId, (a) => addLogEntry({ ...a, docs: { ...a.docs, [kind]: [...(a.docs?.[kind] || []), v] } }, "doc", `${DOC_LABEL[kind]} traduit : ${LANG_FLAG[from]} → ${LANG_FLAG[to]}`));
    return v;
  });
  const setAppDesign = (appId, design) => patchApp(appId, (a) => ({ ...a, design }));

  /* ── Entraînement à l'entretien ─────────────────────────────────── */
  const evaluatePractice = (appId, question, answer) => withBusy(`practice:${appId}`, async () => {
    const app = R.current.apps.find((a) => a.id === appId);
    const offer = R.current.offers.find((o) => o.id === app?.offerId);
    const { data } = await askJSON(R.current.settings, { system: SYSTEM_BASE, prompt: P.practice(question, answer, offer, R.current.profile), maxTokens: 5000, tier: "balanced" });
    const fb = {
      score: clamp(Math.round(Number(data?.score) || 1), 1, 5), star: data?.star || {},
      strengths: (data?.strengths || []).map(String).slice(0, 3), improvements: (data?.improvements || []).map(String).slice(0, 3),
      improved: str(data?.improved), seconds: Number(data?.seconds) || Math.round((answer.split(/\s+/).length / 130) * 60),
    };
    patchApp(appId, (a) => ({ ...a, practice: [...(a.practice || []), { id: uid("pr"), at: nowISO(), question, answer, feedback: fb }] }));
    return fb;
  });

  /* ── Relances ───────────────────────────────────────────────────── */
  const setFollowUp = (appId, fuId, patch) => patchApp(appId, (a) => ({ ...a, followUps: (a.followUps || []).map((f) => (f.id === fuId ? { ...f, ...patch } : f)) }));
  const draftFollowUp = (appId, fuId) => withBusy(`fu:${fuId}`, async () => {
    const { settings: s, profile: p, apps: A, offers: O, contacts: C } = R.current;
    const app = A.find((a) => a.id === appId);
    const fu = app?.followUps.find((f) => f.id === fuId);
    const offer = O.find((o) => o.id === app?.offerId);
    const contact = C.find((c) => app?.contactIds?.includes(c.id));
    const { data } = await askJSON(s, { system: SYSTEM_BASE, prompt: P.followUp(app, offer, fu, p, contact), maxTokens: 3000, tier: "balanced", effort: "low" });
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
    const res = await askJSON(s, { system: SYSTEM_BASE, prompt: P.prep(offer, p), web: { maxUses: 6 }, maxTokens: 14000, tier: "deep" });
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
      const silent = silenceDays(a);
      if (silent !== null && silent >= (settings.ghostDays || 21)) items.push({ id: `ghost:${a.id}`, label: `Sans nouvelles depuis ${silent} j : relancer ou clôturer`, detail: name, weight: 2, go: () => openApp(a.id, "track"), demo: a.demo });
    });
    const pendingMail = inbox.replies.length + inbox.untracked.length;
    if (pendingMail) items.push({ id: "inbox", label: `${pendingMail} e-mail(s) détecté(s) à valider`, detail: "Réponses et candidatures trouvées dans Gmail", weight: 1, go: () => setReplyOpen(true) });
    offers
      .filter((o) => o.status === "new" && o.score && o.score.value >= th)
      .sort((a, b) => b.score.value - a.score.value)
      .slice(0, 3)
      .forEach((o) => items.push({ id: `tri:${o.id}`, label: `Trier une offre à ${o.score.value}`, detail: `${o.title} · ${o.company || NC}`, weight: 2, go: () => openOffer(o.id), demo: o.demo }));
    if (staleIds.length) items.push({ id: "stale", label: `Recalculer ${staleIds.length} score(s) obsolète(s)`, detail: "Les critères ont changé", weight: 3, go: () => rescoreStale() });
    if (apps.some((a) => !a.demo && a.sentAt && a.stage !== "closed") && (!settings.lastReplyCheckAt || (Date.now() - new Date(settings.lastReplyCheckAt)) / 36e5 > 48)) items.push({ id: "replies", label: "Vérifier les réponses des recruteurs", detail: `Dernière vérification : ${relTime(settings.lastReplyCheckAt)}`, weight: 2, go: () => checkReplies() });
    if (!settings.lastWatchAt || (Date.now() - new Date(settings.lastWatchAt)) / 36e5 > 24) items.push({ id: "watch", label: "Lancer la veille", detail: `Dernière collecte : ${relTime(settings.lastWatchAt)}`, weight: 3, go: () => runWatch() });
    const order = todayAI?.order || {};
    return items
      .map((it) => ({ ...it, ai: order[it.id] }))
      .sort((a, b) => (a.ai?.priority ?? a.weight) - (b.ai?.priority ?? b.weight) || new Date(a.due || 8.64e15) - new Date(b.due || 8.64e15));
  }, [apps, offers, inbox, settings.threshold, settings.lastWatchAt, settings.lastReplyCheckAt, settings.ghostDays, staleIds, todayAI]); // eslint-disable-line react-hooks/exhaustive-deps

  const prioritizeToday = () => withBusy("today", async () => {
    if (!todayItems.length) return;
    const { data } = await askJSON(R.current.settings, { system: SYSTEM_BASE, prompt: P.today(todayItems), maxTokens: 3000, tier: "fast", effort: "low" });
    const order = {};
    (data?.ordered || []).forEach((x) => { if (x?.id) order[x.id] = { priority: clamp(Number(x.priority) || 2, 1, 3), reason: str(x.reason) }; });
    setTodayAI({ order, at: nowISO() });
    toast("Actions priorisées par l'IA", "ok");
  });

  /* ── Données : export / import / réinitialisation ──────────────── */
  const exportPayload = () => ({ app: "radar-emploi", version: DATA_VERSION, exportedAt: nowISO(), settings, profile, criteria, sources, offers, apps, contacts, ratings, media, inbox });
  const importPayload = (obj) => {
    if (!obj || obj.app !== "radar-emploi") throw new Error("Fichier non reconnu (sauvegarde Radar attendue).");
    setSettings({ ...DEFAULT_SETTINGS, ...(obj.settings || {}), mcp: { ...DEFAULT_SETTINGS.mcp, ...(obj.settings?.mcp || {}) }, mcpTools: { ...DEFAULT_SETTINGS.mcpTools, ...(obj.settings?.mcpTools || {}) }, followUp: { ...DEFAULT_SETTINGS.followUp, ...(obj.settings?.followUp || {}) } });
    setProfile({ ...DEFAULT_PROFILE, ...(obj.profile || {}) });
    setCriteria(obj.criteria?.versions?.length ? obj.criteria : makeCriteriaState());
    setSources(obj.sources || DEFAULT_SOURCES);
    setOffers(obj.offers || []);
    setApps(obj.apps || []);
    setContacts(obj.contacts || []);
    setRatings(obj.ratings || {});
    setMedia(obj.media || {});
    setInbox({ replies: [], untracked: [], ...(obj.inbox || {}) });
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
    setRatings({});
    setMedia({});
    setInbox({ replies: [], untracked: [] });
    setTodayAI(null);
    setOfferQueue([]);
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
  /* Allège les offres écartées ou expirées anciennes (description courte, analyse détaillée retirée). */
  const compactOffers = (days = 90) => {
    const lim = Date.now() - days * 864e5;
    const old = (o) => ["dismissed", "expired"].includes(o.status) && !o.compacted && new Date(o.dismissedAt || o.expiredAt || o.lastSeenAt || o.collectedAt).getTime() < lim;
    const n = R.current.offers.filter(old).length;
    if (!n) { toast(`Aucune offre écartée depuis plus de ${days} jours.`, "neutral"); return; }
    setOffers((l) => l.map((o) => (old(o) ? {
      ...o, description: o.description ? o.description.slice(0, 280) : null, mergeHistory: undefined, compacted: true,
      score: o.score ? { ...o.score, breakdown: [], strengths: [], gaps: [], questions: [], must: [], nice: [], missions: [] } : null,
    } : o)));
    toast(`${n} offre(s) allégée(s)`, "ok");
  };

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
        if (o) o.sources[0].verified = r?.verified === true ? true : null;
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
    if (norm.length || raw.length) toast(`Veille reçue : ${r.added.length} nouvelle(s) offre(s), ${r.merged.length} fusion(s). Scorez-les depuis la vue d'ensemble.`, "ok");
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
  const cfgNow = useMemo(() => veilleConfig(activeVersion(criteria), sources, settings), [criteria, sources, settings.lookbackDays, settings.maxPerSource]); // eslint-disable-line react-hooks/exhaustive-deps
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
      const due = (iso, h) => !iso || (Date.now() - new Date(iso).getTime()) / 36e5 >= h;
      if (s.autoReplies && due(s.lastReplyCheckAt, s.autoRepliesHours || 12) && monitoredApps().length && (RT.mode !== "published" || RT.mcp)) await checkReplies({ auto: true });
      if (s.autoGmail && stale(s.lastGmailImportAt)) await importGmail(s.gmailDays);
      if (s.autoWatch && RT.mode !== "published" && stale(s.lastWatchAt)) { toast("Veille automatique lancée (dernière collecte ancienne)", "neutral"); await runWatch(); }
    }, 1500);
    return () => clearTimeout(t);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (v, preset) => { setView(v); setMobileNav(false); if (preset !== undefined) setOfferPreset(preset); window.scrollTo?.({ top: 0 }); };

  const dueCount = useMemo(() => apps.reduce((n, a) => n + (a.followUps || []).filter((f) => f.status === "pending" && daysFromToday(f.due) <= 0).length, 0), [apps]);
  const newCount = useMemo(() => offers.filter((o) => o.status === "new").length, [offers]);

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
    media, setMedia, inbox, setReplyOpen, resolveUntracked, translateDoc, setAppDesign, evaluatePractice, compactOffers,
    openStudio: (appId, kind = "cv") => setStudio({ appId, kind }), openExport: (appId) => setExportFor(appId), openCompare: (ids) => setCompare(ids),
    monitoredCount: apps.filter((a) => !a.demo && a.stage !== "closed" && (a.sentAt || ["prep", "sent", "followup", "interview", "offer"].includes(a.stage))).length,
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
              <SidebarContent collapsed={collapsed} dueCount={dueCount} newCount={newCount} onToggle={() => setSettings((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }))} />
            </aside>
            {mobileNav && (
              <div className="md:hidden fixed inset-0 z-40">
                <div className="absolute inset-0" style={{ background: "rgba(12,10,9,0.35)" }} onClick={() => setMobileNav(false)} />
                <aside className={`absolute left-0 top-0 h-full w-72 px-3 py-5 flex flex-col ${T.app}`} style={T.shadow} aria-label="Navigation principale">
                  <SidebarContent collapsed={false} dueCount={dueCount} newCount={newCount} onToggle={() => setMobileNav(false)} mobile />
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
                {storageState.message && <Notice tone="warn" icon={AlertTriangle} className="mb-6">{storageState.message}</Notice>}
                {!loaded ? (
                  <div className="space-y-6">
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
          <ReplyReviewModal open={replyOpen} onClose={() => setReplyOpen(false)} inbox={inbox} setInbox={setInbox} onResolve={resolveReply} onResolveUntracked={resolveUntracked} apps={apps} offers={offers} />
          {studio && <Studio key={`${studio.appId}:${studio.kind}`} appId={studio.appId} initialKind={studio.kind} onClose={() => setStudio(null)} />}
          {exportFor && <ExportModal appId={exportFor} onClose={() => setExportFor(null)} />}
          {compare && <CompareModal ids={compare} onClose={() => setCompare(null)} />}
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
      { group: "Actions", label: "Vérifier Gmail (réponses, accusés, candidatures non suivies)", icon: MailCheck, run: run(() => app.checkReplies()) },
      ...(app.inbox.replies.length + app.inbox.untracked.length ? [{ group: "Actions", label: "Valider les e-mails détectés", hint: `${app.inbox.replies.length + app.inbox.untracked.length}`, icon: Inbox, run: run(() => app.setReplyOpen(true)) }] : []),
      { group: "Actions", label: "Détecter les doublons (IA)", icon: GitMerge, run: run(() => app.detectDuplicates()) },
      { group: "Actions", label: "Recalculer les scores obsolètes", hint: `${app.staleIds.length}`, icon: RefreshCw, run: run(() => app.rescoreStale()) },
      { group: "Actions", label: "Prioriser mes actions du jour (IA)", icon: Wand2, run: run(() => { app.go("dashboard"); app.prioritizeToday(); }) },
      { group: "Actions", label: "Exporter une sauvegarde JSON", icon: Download, run: run(() => app.go("privacy")) },
      ...NAV.map((n) => ({ group: "Navigation", label: n.label, icon: n.icon, run: run(() => app.go(n.id)) })),
      ...app.apps
        .filter((a) => (a.docs?.cv || a.docs?.letter || []).length)
        .map((a) => {
          const o = app.offers.find((x) => x.id === a.offerId);
          return { group: "Studio CV & lettre", label: `Studio : ${o?.title || "poste"}`, hint: o?.company || "", icon: Palette, run: run(() => app.openStudio(a.id, "cv")) };
        }),
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
  }, [open, q, app.apps, app.offers, app.staleIds, app.inbox]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const { offers, apps, settings, go, runWatch, busy, todayItems, prioritizeToday, todayAI, openOffer, profile, staleIds, rescoreStale, hasDemo } = useApp();
  const th = settings.threshold;

  const k = useMemo(() => {
    const weekAgo = Date.now() - 7 * 864e5;
    const sent = apps.filter((a) => a.sentAt);
    const responded = sent.filter((a) => ["interview", "offer"].includes(a.stage) || (a.interviews || []).length || (a.stage === "closed" && a.closed?.outcome !== "withdrawn"));
    const upcoming = apps.flatMap((a) => (a.interviews || []).filter((i) => new Date(i.at) >= startOfDay(new Date())));
    return {
      fresh: offers.filter((o) => o.status === "new" && new Date(o.collectedAt).getTime() >= weekAgo).length,
      above: offers.filter((o) => isActiveOffer(o) && o.score?.value >= th).length,
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

  const top = useMemo(() => offers.filter((o) => isActiveOffer(o) && !isOldOffer(o, settings.hideOlderThan) && o.score).sort((a, b) => b.score.value - a.score.value).slice(0, 5), [offers]);
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
        <Kpi label="Nouvelles offres" value={k.fresh} sub="7 derniers jours" icon={Inbox} onClick={() => go("offers", { status: "new" })} />
        <Kpi label={`Au-dessus de ${th}`} value={k.above} sub="score ≥ seuil" icon={Gauge} onClick={() => go("offers", { minScore: th })} />
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

const DEFAULT_FILTERS = { q: "", source: "", minScore: 0, maxCommute: 0, status: "active", sort: "score", hideOld: true, verdict: "" };
const isFresh = (o) => o.status === "new" && Date.now() - new Date(o.collectedAt).getTime() < 48 * 36e5;

function OffersView() {
  const T = useT();
  const { offers, settings, busy, runWatch, setManualOpen, openOffer, offerPreset, setOfferPreset, staleIds, rescoreStale, criteria, detectDuplicates, setOfferQueue, ratings, requestRatings, openCompare } = useApp();
  const [f, setF] = useState(DEFAULT_FILTERS);
  const [dense, setDense] = useState(true);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState([]);
  const togglePick = (id) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : l.length < 4 ? [...l, id] : l));
  useEffect(() => {
    if (offerPreset) { setF({ ...DEFAULT_FILTERS, ...offerPreset }); setOfferPreset(null); }
  }, [offerPreset]); // eslint-disable-line react-hooks/exhaustive-deps

  const sourceNames = useMemo(() => [...new Set(offers.flatMap((o) => (o.sources || []).map((s) => s.name)))].sort(), [offers]);
  const vid = activeVersion(criteria)?.id;
  const list = useMemo(() => {
    const nq = normText(f.q);
    let l = offers.filter((o) => {
      if (f.status === "active" && !isActiveOffer(o)) return false;
      if (f.status === "new" && o.status !== "new") return false;
      if (f.status === "dismissed" && !["dismissed", "expired"].includes(o.status)) return false;
      if (f.status === "closed" && o.status !== "closed") return false;
      if (f.hideOld && ["active", "new"].includes(f.status) && isOldOffer(o, settings.hideOlderThan)) return false;
      if (f.status === "pipeline" && o.status !== "pipeline") return false;
      if (f.source && !(o.sources || []).some((s) => s.name === f.source)) return false;
      if (f.minScore && !(o.score?.value >= f.minScore)) return false;
      if (f.maxCommute && !(o.commute && o.commute.minutes <= f.maxCommute)) return false;
      if (f.verdict && offerVerdict(o, settings.threshold)?.id !== f.verdict) return false;
      if (nq && !normText(`${o.title} ${o.company} ${o.location} ${o.description}`).includes(nq)) return false;
      return true;
    });
    const cmp = {
      score: (a, b) => (b.score?.value ?? -1) - (a.score?.value ?? -1),
      date: (a, b) => new Date(b.publishedAt || b.collectedAt) - new Date(a.publishedAt || a.collectedAt),
      commute: (a, b) => (a.commute?.minutes ?? 999) - (b.commute?.minutes ?? 999),
      source: (a, b) => (a.sources?.[0]?.name || "").localeCompare(b.sources?.[0]?.name || ""),
    }[f.sort];
    return [...l].sort(cmp);
  }, [offers, f, settings.hideOlderThan, settings.threshold]);
  useEffect(() => { setOfferQueue(list.map((o) => o.id)); }, [list]); // eslint-disable-line react-hooks/exhaustive-deps
  const unrated = useMemo(() => [...new Set(list.map((o) => o.company).filter((c) => c && !ratings[ratingKey(c)] && !/confidenti|non communiqu/i.test(c)))], [list, ratings]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "number" || /minScore|maxCommute/.test(k) ? Number(e.target.value) : e.target.value }));

  return (
    <div>
      <PageHeader
        title="Offres"
        subtitle={`${list.length} offre(s) affichée(s) sur ${offers.length} · chaque offre garde ses URL sources et dates de collecte`}
        actions={
          <>
            {staleIds.length > 0 && <Btn icon={RefreshCw} onClick={rescoreStale} loading={busy.score}>Scorer {staleIds.length}</Btn>}
            {unrated.length > 0 && <Btn icon={Star} onClick={() => requestRatings(unrated)} loading={busy.ratings}>Noter {Math.min(25, unrated.length)} employeur(s)</Btn>}
            <Btn icon={GitMerge} onClick={detectDuplicates} loading={busy.dedupe}>Doublons (IA)</Btn>
            {picking && picked.length >= 2 ? <Btn variant="primary" icon={Columns} onClick={() => openCompare(picked)}>Comparer ({picked.length})</Btn> : null}
            <Btn icon={Columns} variant={picking ? "ghost" : "soft"} onClick={() => { setPicking(!picking); setPicked([]); }}>{picking ? "Annuler" : "Comparer"}</Btn>
            <Btn icon={Clipboard} onClick={() => setManualOpen(true)}>Importer une annonce</Btn>
            <Btn variant="primary" icon={Play} onClick={() => runWatch()} loading={busy.watch}>Lancer la veille</Btn>
          </>
        }
      />
      <Card className="p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
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
          <Field label="Verdict">
            <Select value={f.verdict} onChange={set("verdict")} className="w-full">
              <option value="">Tous</option>
              <option value="apply">Postuler</option>
              <option value="dig">À creuser</option>
              <option value="skip">Passer</option>
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
          <Field label="Statut">
            <Select value={f.status} onChange={set("status")} className="w-full">
              <option value="active">Actives</option>
              <option value="new">Nouvelles</option>
              <option value="pipeline">Dans le pipeline</option>
              <option value="dismissed">Écartées / expirées</option>
              <option value="closed">Candidatures clôturées</option>
              <option value="all">Toutes</option>
            </Select>
          </Field>
          <Field label="Tri">
            <div className="flex gap-2">
              <Select value={f.sort} onChange={set("sort")} className="flex-1 min-w-0">
                <option value="score">Score</option>
                <option value="date">Date</option>
                <option value="commute">Trajet</option>
                <option value="source">Source</option>
              </Select>
              <IconBtn icon={dense ? LayoutList : List} label={dense ? "Vue détaillée" : "Vue compacte"} onClick={() => setDense(!dense)} />
            </div>
          </Field>
        </div>
        <label className={`flex items-center gap-2 text-xs mt-3 ${T.muted}`}>
          <input type="checkbox" checked={f.hideOld} onChange={(e) => setF((x) => ({ ...x, hideOld: e.target.checked }))} />
          Masquer les offres de plus de {settings.hideOlderThan} jours (souvent déjà pourvues)
        </label>
      </Card>

      {busy.watch && <Card className="p-6 mb-4"><Skeleton lines={4} /></Card>}
      {list.length === 0 && !busy.watch ? (
        <Card><Empty icon={Search} title="Aucune offre ne correspond" text="Élargissez les filtres, lancez la veille ou importez vos alertes e-mail." action={<Btn onClick={() => setF(DEFAULT_FILTERS)}>Réinitialiser les filtres</Btn>} /></Card>
      ) : dense ? (
        <Card className="p-2">
          <ul className={`divide-y ${T.divide}`}>
            {list.map((o) => {
              const v = offerVerdict(o, settings.threshold);
              const fx = o.score?.facts || {};
              return (
              <li key={o.id} className="flex items-center">
                {picking && <input type="checkbox" className="ml-3 shrink-0" checked={picked.includes(o.id)} disabled={!picked.includes(o.id) && picked.length >= 4} onChange={() => togglePick(o.id)} aria-label={`Comparer ${o.title}`} />}
                <button type="button" onClick={() => openOffer(o.id)} className={`flex-1 min-w-0 flex items-center gap-4 px-3 py-3 rounded-2xl text-left transition-colors duration-150 ${T.subHover} ${T.ring}`}>
                  <ScorePill score={o.score} threshold={settings.threshold} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      {isFresh(o) && <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" title="Nouvelle (moins de 48 h)" aria-label="Nouvelle" />}
                      <span className="text-sm font-medium truncate">{o.title}</span>
                      {v && <Chip tone={v.tone} className="shrink-0">{v.label}</Chip>}
                      {o.demo && <Chip>exemple</Chip>}
                      {o.score?.redFlags?.length > 0 && <Flag className="w-3.5 h-3.5 text-rose-500 shrink-0" aria-label="Drapeau rouge" />}
                      {isStale(o, vid) && o.score && !o.demo && <Chip tone="warn">score obsolète</Chip>}
                    </span>
                    <span className={`flex items-center gap-2 text-xs mt-0.5 ${T.muted}`}><span className="truncate">{show(o.company)} · {show(o.location)}{fx.contract || o.contract ? ` · ${fx.contract || o.contract}` : ""}{fx.remoteDays != null ? ` · ${fx.remoteDays} j télétravail` : ""}{fmtSalary(fx, null) ? ` · ${fmtSalary(fx, null)}` : ""}</span><RatingChip company={o.company} compact /></span>
                    {o.score?.tldr && <span className={`block text-xs mt-0.5 truncate ${T.faint}`}>{o.score.tldr}</span>}
                  </span>
                  <span className={`hidden md:flex items-center gap-1 text-xs w-20 ${T.muted}`}><Clock className="w-3 h-3" aria-hidden="true" />{commuteLabel(o.commute)}</span>
                  <span className={`hidden lg:block text-xs w-32 truncate ${T.muted}`}>{o.sources?.map((s) => s.name).join(", ")}</span>
                  <span className={`hidden sm:block text-xs w-20 text-right tabular-nums ${T.faint}`}>{fmtDate(o.publishedAt || o.collectedAt)}</span>
                </button>
              </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((o) => (
            <Card key={o.id} as="button" type="button" onClick={() => openOffer(o.id)} className={`p-6 text-left transition-transform duration-200 hover:-translate-y-0.5 ${T.ring}`}>
              <div className="flex items-start gap-4">
                <ScorePill score={o.score} threshold={settings.threshold} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-medium leading-snug">{o.title}</div>
                  <div className={`text-sm mt-0.5 ${T.muted}`}>{show(o.company)}</div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {o.demo && <Chip>exemple</Chip>}
                    <Chip><MapPin className="w-3 h-3" aria-hidden="true" />{show(o.location)}</Chip>
                    <Chip><Clock className="w-3 h-3" aria-hidden="true" />{commuteLabel(o.commute)}</Chip>
                    <Chip>{o.score?.facts?.remoteDays != null ? `${o.score.facts.remoteDays} j télétravail` : show(o.remote)}</Chip>
                    {offerVerdict(o, settings.threshold) && <Chip tone={offerVerdict(o, settings.threshold).tone}>{offerVerdict(o, settings.threshold).label}</Chip>}
                    {o.score && <Chip tone={o.score.confidence === "faible" ? "warn" : "neutral"}>confiance {o.score.confidence}</Chip>}
                  </div>
                </div>
              </div>
              {(o.score?.tldr || o.score?.summary) && <p className={`text-sm mt-4 ${T.muted}`}>{o.score.tldr || o.score.summary}</p>}
              {o.score?.redFlags?.length > 0 && (
                <div className="mt-3 text-xs text-rose-600 flex items-start gap-1.5"><Flag className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />{o.score.redFlags[0].evidence}</div>
              )}
              <div className={`mt-4 text-xs ${T.faint}`}>{o.sources?.map((s) => s.name).join(" · ")} · collectée {fmtDate(o.collectedAt)}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function OfferDrawer({ id, onClose }) {
  const T = useT();
  const { offers, settings, setSettings, apps, addToPipeline, patchOffer, scoreOffers, busy, openApp, criteria, undoMerge, offerQueue, triageOffer, nextOfferId, setOfferSel } = useApp();
  const o = offers.find((x) => x.id === id);
  const [tab, setTab] = useState("analysis");
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
    ["Langue", o.language ? LANG_NAME[o.language] : null], ["Publication", o.publishedAt ? fmtDate(o.publishedAt) : null], ["Collecte", fmtDate(o.collectedAt, { time: true })],
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
          <Btn variant="ghost" icon={RotateCcw} onClick={() => patchOffer(o.id, { status: "new" })}>Restaurer</Btn>
        ) : !app && (
          <>
            <Btn variant="ghost" icon={X} onClick={() => triageOffer(o.id, { status: "dismissed", dismissedAt: nowISO() })}>Écarter</Btn>
            <Btn variant="ghost" icon={Clock} onClick={() => triageOffer(o.id, { status: "expired", expiredAt: nowISO() })}>Expirée / pourvue</Btn>
          </>
        )}
        {nextId && <Btn variant="ghost" icon={ArrowRight} onClick={() => setOfferSel(nextId)}>Suivante</Btn>}
        {!o.demo && <Btn variant="ghost" icon={RefreshCw} onClick={() => scoreOffers([o.id])} loading={busy.score}>{s ? "Rescorer" : "Scorer"}</Btn>}
      </div>
      <label className={`flex items-center gap-2 text-xs mb-6 ${T.faint}`}>
        <input type="checkbox" checked={!!settings.autoNext} onChange={(e) => setSettings((x) => ({ ...x, autoNext: e.target.checked }))} />
        Passer automatiquement à l'offre suivante après « Écarter », « Expirée » ou « Ajouter » · flèches ← → pour naviguer
      </label>

      <DecisionCard o={o} stale={stale} />
      <div className="mb-6 overflow-x-auto"><Tabs value={tab} onChange={setTab} tabs={[{ id: "analysis", label: "Analyse" }, { id: "ad", label: "Annonce" }, { id: "sources", label: "Sources", count: o.sources?.length || 0 }]} /></div>

      {tab === "analysis" && (s ? (
        <>
          <section className="mb-8">
            <SectionTitle>Décomposition par critère</SectionTitle>
            {s.local && <p className={`text-xs mb-3 ${T.faint}`}>Score recalculé localement après un changement de pondération (aucun appel IA).</p>}
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
      ) : <Empty icon={Gauge} title="Pas encore scorée" text="Le score explique l'adéquation critère par critère." action={!o.demo && <Btn icon={RefreshCw} loading={busy.score} onClick={() => scoreOffers([o.id])}>Scorer</Btn>} />)}

      {tab === "ad" && (
        <>
          {(s?.missions?.length > 0 || s?.must?.length > 0 || s?.nice?.length > 0) && (
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              <BulletList title="Missions principales" items={s.missions} icon={Briefcase} empty="Non précisées" />
              <div className="space-y-6">
                <BulletList title="Exigences indispensables" items={s.must} icon={Target} empty="Non précisées" />
                <BulletList title="Atouts souhaités" items={s.nice} icon={Plus} empty="Non précisés" />
              </div>
            </section>
          )}
          <section className="mb-8">
            <SectionTitle>Annonce (résumé collecté{o.language && o.language !== "fr" ? `, en ${LANG_NAME[o.language]}` : ""})</SectionTitle>
            <p className={`text-sm leading-relaxed whitespace-pre-line ${o.description ? "" : T.faint}`}>{show(o.description)}</p>
          </section>
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
        </>
      )}

      {tab === "sources" && (
        <>
          {o.mergeHistory?.length > 0 && (
            <section className="mb-8">
              <SectionTitle action={<Btn size="sm" variant="ghost" icon={Undo2} onClick={() => undoMerge(o.id)}>Annuler la dernière fusion</Btn>}>Historique des fusions</SectionTitle>
              <ul className="space-y-2">
                {[...o.mergeHistory].reverse().map((m) => (
                  <li key={m.id} className={`rounded-2xl p-4 text-sm ${T.sub}`}>
                    <div className="flex flex-wrap items-center gap-2"><GitMerge className={`w-3.5 h-3.5 ${T.muted}`} aria-hidden="true" /><span>{fmtDate(m.at, { time: true })}</span><Chip>{m.origin}</Chip></div>
                    {m.reason && <div className={`text-xs mt-1 ${T.muted}`}>{m.reason}</div>}
                    <ul className={`text-xs mt-2 space-y-0.5 ${T.muted}`}>{m.absorbed.map((x) => <li key={x.id}>↳ {x.title} · {show(x.company)} · {(x.sources || []).map((y) => y.name).join(", ")}</li>)}</ul>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
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
        </>
      )}
    </Drawer>
  );
}

/* Synthèse de décision : verdict, résumé en français, faits clés normalisés, raisons principales. */
function DecisionCard({ o, stale }) {
  const T = useT();
  const { settings } = useApp();
  const s = o.score;
  const f = s?.facts || {};
  const v = offerVerdict(o, settings.threshold);
  const facts = [
    [MapPin, "Lieu", o.location ? `${o.location}${o.commute ? ` · ~${o.commute.minutes} min` : ""}` : null],
    [FileText, "Contrat", f.contract || o.contract],
    [Monitor, "Télétravail", f.remoteDays != null ? `${f.remoteDays} j / semaine` : o.remote],
    [TrendingUp, "Salaire", fmtSalary(f, o.salary)],
    [Users, "Équipe", f.teamSize ? `${f.teamSize} personne(s)` : null],
    [Building2, "Rattachement", f.reportsTo],
    [Target, "Séniorité", f.seniority || o.seniority],
    [Languages, "Langues exigées", f.languages?.length ? f.languages.map((l) => LANG_FLAG[l]).join(" · ") : null],
    [Clock, "Publiée", o.publishedAt && !isNaN(new Date(o.publishedAt)) ? `${fmtDate(o.publishedAt)} · ${relDay(o.publishedAt)}` : null],
  ];
  const known = facts.filter(([, , val]) => val);
  const unknown = facts.filter(([, , val]) => !val).map(([, l]) => l.toLowerCase());
  return (
    <section className={`rounded-3xl p-5 mb-6 ${T.sub}`} aria-label="Synthèse de décision">
      <div className="flex items-start gap-4">
        <ScorePill score={s} threshold={settings.threshold} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {v ? <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${v.id === "apply" ? "bg-emerald-600 text-white" : v.id === "dig" ? (T.dark ? "bg-amber-900 text-amber-100" : "bg-amber-100 text-amber-900") : T.chip}`}>{v.label}</span> : <Chip>non scorée</Chip>}
            {s && <Chip tone={s.confidence === "faible" ? "warn" : s.confidence === "haute" ? "ok" : "neutral"}>confiance {s.confidence}</Chip>}
            {stale && !o.demo && s && <Chip tone="warn">critères modifiés depuis</Chip>}
            {s?.caps?.map((c) => <Chip key={c} tone="danger">plafonné : {c}</Chip>)}
          </div>
          {s?.tldr && <p className="text-base font-medium leading-snug mt-2">{s.tldr}</p>}
          {s?.summary && <p className={`text-sm mt-1 ${T.muted}`}>{s.summary}</p>}
          {s?.confidenceReason && <p className={`text-xs mt-1 ${T.faint}`}>{s.confidenceReason}</p>}
        </div>
      </div>
      {known.length > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
          {known.map(([I, l, val]) => (
            <div key={l} className={`rounded-2xl px-3 py-2 ${T.surface}`}>
              <dt className={`flex items-center gap-1.5 text-xs ${T.faint}`}><I className="w-3.5 h-3.5" aria-hidden="true" />{l}</dt>
              <dd className="text-sm mt-0.5">{val}</dd>
            </div>
          ))}
        </dl>
      )}
      {unknown.length > 0 && <p className={`text-xs mt-3 ${T.faint}`}>Non précisé dans l'annonce : {unknown.join(", ")}.</p>}
      {s && (s.strengths?.length > 0 || s.gaps?.length > 0 || s.redFlags?.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-4 text-sm">
          {s.strengths.slice(0, 3).map((x, i) => <div key={`s${i}`} className="flex gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />{x}</div>)}
          {s.gaps.slice(0, 3).map((x, i) => <div key={`g${i}`} className="flex gap-2"><ArrowRight className={`w-4 h-4 mt-0.5 shrink-0 ${T.faint}`} aria-hidden="true" />{x}</div>)}
          {s.redFlags.slice(0, 2).map((r, i) => <div key={`r${i}`} className="flex gap-2 text-rose-600"><Flag className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />{r.evidence}</div>)}
        </div>
      )}
    </section>
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
  const { apps, offers, settings, setSettings, requestMove, openApp, go, checkReplies, busy, inbox, setReplyOpen, monitoredCount } = useApp();
  const [over, setOver] = useState(null);
  const pendingMail = inbox.replies.length + inbox.untracked.length;
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
      <Card className="p-4 mb-6 flex flex-wrap items-center gap-3">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${T.sub}`}><MailCheck className={`w-4 h-4 ${T.muted}`} aria-hidden="true" /></span>
        <div className="flex-1 min-w-48">
          <div className="text-sm font-medium">Surveillance Gmail</div>
          <div className={`text-xs ${T.muted}`}>
            {monitoredCount} candidature(s) suivie(s) · vérifié {relTime(settings.lastReplyCheckAt)} · {settings.autoReplies ? `automatique à l'ouverture, toutes les ${settings.autoRepliesHours} h` : "vérification manuelle"} · accusés ATS, réponses, invitations, refus, candidatures non suivies · lecture seule
          </div>
        </div>
        <label className={`inline-flex items-center gap-2 text-xs ${T.muted}`}><input type="checkbox" checked={!!settings.autoReplies} onChange={(e) => setSettings((x) => ({ ...x, autoReplies: e.target.checked }))} />Auto</label>
        {pendingMail > 0 && <Btn variant="primary" icon={Inbox} onClick={() => setReplyOpen(true)}>{pendingMail} à valider</Btn>}
        <Btn icon={RefreshCw} loading={busy.replies} onClick={() => checkReplies()}>Vérifier maintenant</Btn>
      </Card>
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
                    const le = lastEmail(a);
                    const sil = silenceDays(a);
                    const waiting = inbox.replies.some((r) => r.appId === a.id);
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
                            {waiting && <Chip tone="accent"><Inbox className="w-3 h-3" aria-hidden="true" />e-mail à valider</Chip>}
                            {le && <Chip tone={le.kind === "refus" ? "danger" : ["invitation_entretien", "offre"].includes(le.kind) ? "ok" : "neutral"}><Mail className="w-3 h-3" aria-hidden="true" />{(REPLY_KINDS[le.kind] || "E-mail").toLowerCase()} · {relDay(le.date || le.at)}</Chip>}
                            {sil !== null && sil >= (settings.ghostDays || 21) && <Chip tone="warn">sans nouvelles · {sil} j</Chip>}
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

function ReplyReviewModal({ open, onClose, inbox, setInbox, onResolve, onResolveUntracked, apps, offers }) {
  const T = useT();
  if (!open) return null;
  const replies = inbox.replies || [];
  const untracked = inbox.untracked || [];
  const ACTIONS = { log: "Journaliser seulement", sent: "Marquer « Envoyée » (date de l'e-mail)", interview: "Passer en « Entretien »", offer: "Passer en « Offre »", closed: "Clôturer (refus)" };
  const setAction = (id, action) => setInbox((ib) => ({ ...ib, replies: ib.replies.map((x) => (x.id === id ? { ...x, action } : x)) }));
  return (
    <Modal open wide onClose={onClose} title={`E-mails détectés (${replies.length + untracked.length})`}>
      <p className={`text-sm mb-4 ${T.muted}`}>Lecture seule dans Gmail. Rien n'est appliqué sans votre validation ; les relances en attente sont annulées en cas d'entretien, d'offre ou de refus. Les e-mails non traités restent ici jusqu'à votre décision.</p>
      {!replies.length && !untracked.length && <Empty icon={MailCheck} title="Tout est traité" text="Aucun e-mail en attente de validation." />}
      {replies.length > 0 && (
        <>
          <SectionTitle>Réponses aux candidatures suivies</SectionTitle>
          <ul className="space-y-3 mb-6">
            {replies.map((r) => {
              const app = apps.find((a) => a.id === r.appId);
              const o = offers.find((x) => x.id === app?.offerId);
              return (
                <li key={r.id} className={`rounded-2xl p-4 ${T.sub}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{o?.title || "Candidature"} · {show(o?.company)}</span>
                    <Chip tone={r.kind === "refus" ? "danger" : ["invitation_entretien", "offre", "confirmation_candidature"].includes(r.kind) ? "ok" : "neutral"}>{REPLY_KINDS[r.kind]}</Chip>
                    {!r.verified && <Chip tone="warn">objet non retrouvé dans les e-mails lus — à vérifier</Chip>}
                  </div>
                  <div className={`text-xs mt-1 ${T.muted}`}>{show(r.from)} · {r.date ? fmtDate(r.date) : NC}</div>
                  <div className="text-sm mt-2">« {r.subject} »</div>
                  {r.summary && <div className={`text-sm mt-1 ${T.muted}`}>{r.summary}</div>}
                  {r.interviewAt && <div className="text-xs mt-1">Entretien proposé : {fmtDate(r.interviewAt, { time: true })}</div>}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Select value={r.action} onChange={(e) => setAction(r.id, e.target.value)} aria-label="Action" className="h-8 text-xs">
                      {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                    <Btn size="sm" variant="primary" icon={Check} onClick={() => onResolve(r, true)}>Appliquer</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => onResolve(r, false)}>Ignorer</Btn>
                    {gmailLink(r) && <ExtLink href={gmailLink(r)} className="text-xs">Gmail</ExtLink>}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {untracked.length > 0 && (
        <>
          <SectionTitle>Candidatures envoyées hors de Radar</SectionTitle>
          <ul className="space-y-3">
            {untracked.map((u) => (
              <li key={u.id} className={`rounded-2xl p-4 ${T.sub}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{u.title || "Poste non précisé"} · {u.company}</span>
                  <Chip tone={u.kind === "refus" ? "danger" : "accent"}>{REPLY_KINDS[u.kind] || "E-mail"}</Chip>
                  {!u.verified && <Chip tone="warn">à vérifier</Chip>}
                </div>
                <div className={`text-xs mt-1 ${T.muted}`}>{show(u.from)} · {u.date ? fmtDate(u.date) : NC}</div>
                <div className="text-sm mt-2">« {u.subject} »</div>
                {u.summary && <div className={`text-sm mt-1 ${T.muted}`}>{u.summary}</div>}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Btn size="sm" variant="primary" icon={Plus} onClick={() => onResolveUntracked(u, true)}>Ajouter au pipeline</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => onResolveUntracked(u, false)}>Ignorer</Btn>
                  {gmailLink(u) && <ExtLink href={gmailLink(u)} className="text-xs">Gmail</ExtLink>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
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
            { id: "emails", label: "E-mails", count: (app.emails || []).length || undefined },
            { id: "prep", label: "Entretien" },
            { id: "contacts", label: "Contacts", count: (app.contactIds || []).length || undefined },
          ]}
        />
      </div>
      {tab === "track" && <TrackPanel app={app} offer={offer} />}
      {tab === "docs" && <DossierPanel app={app} offer={offer} />}
      {tab === "followups" && <AppFollowUps app={app} offer={offer} />}
      {tab === "emails" && <EmailsPanel app={app} />}
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
  const [type, setType] = useState("studio");
  const [instruction, setInstruction] = useState("");
  const docs = app.docs || {};
  const has = Object.keys(docs).length > 0;
  const loading = busy[`dossier:${app.id}`];
  const others = DOC_TYPES.filter((d) => d.id !== "cv" && d.id !== "letter");
  const all = DOC_TYPES.filter((d) => docs[d.id]?.length).map((d) => {
    const v = docs[d.id].slice(-1)[0];
    return `### ${d.label}\n${v.subject ? `Objet : ${v.subject}\n` : ""}${d.id === "cv" || d.id === "letter" ? docPlainText(v.text) : v.text}`;
  }).join("\n\n");
  return (
    <div className="space-y-6">
      <Notice icon={Info}>
        La soumission automatique sur le site de l'employeur n'est pas possible depuis cet artefact (formulaires tiers, authentification). Exportez le dossier puis ouvrez l'annonce.{" "}
        {offer?.sources?.find((x) => x.url) && <ExtLink href={offer.sources.find((x) => x.url).url}>Ouvrir l'annonce</ExtLink>}
      </Notice>
      {!has ? (
        <Card className="p-6">
          {loading ? <Skeleton lines={6} /> : (
            <>
              <div className="text-base font-medium">Générer le dossier complet</div>
              <p className={`text-sm mt-1 mb-4 ${T.muted}`}>CV et lettre prêts à envoyer (mots-clés de l'annonce pour les ATS, mise en page réglable dans le Studio, PDF et Word, traduction FR / NL / EN / DE), message LinkedIn, réponses probables au formulaire et e-mail, dans la langue de l'annonce ({offer?.language ? LANG_NAME[offer.language] : "détectée"}). Tout est éditable et versionné.</p>
              <Field label="Consigne facultative"><Input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Ex. insister sur l'automatisation, ton plus direct…" /></Field>
              <Btn className="mt-4" variant="primary" icon={Sparkles} onClick={() => generateDocs(app.id, DOC_TYPES.map((d) => d.id), instruction)}>Générer</Btn>
            </>
          )}
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="overflow-x-auto"><Tabs value={type} onChange={setType} tabs={[{ id: "studio", label: "CV & lettre" }, ...others.map((d) => ({ id: d.id, label: d.label, count: docs[d.id]?.length || undefined }))]} /></div>
            <CopyBtn text={all} label="Copier tout le dossier" />
          </div>
          {type === "studio" ? <StudioCards app={app} offer={offer} /> : <DocEditor key={`${app.id}-${type}`} app={app} type={type} />}
        </>
      )}
    </div>
  );
}

/* Cartes CV et lettre : vignette, langues, qualité, accès au Studio et à l'export. */
function StudioCards({ app, offer }) {
  const T = useT();
  const { settings, media, openStudio, openExport, generateDocs, busy } = useApp();
  const design = resolveDesign(app, settings, (app.docs?.cv || []).slice(-1)[0]?.accent);
  const loading = busy[`dossier:${app.id}`];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[["cv", "CV"], ["letter", "Lettre de motivation"]].map(([kind, label]) => {
          const langs = docLangs(app, offer, kind);
          const lang = langs.includes(app.docLanguage) ? app.docLanguage : langs[0];
          const v = lang ? latestDoc(app, offer, kind, lang) : null;
          const legacy = !v && (app.docs?.[kind] || []).length > 0;
          const q = v ? docQuality(v.text, { kind, lang, keywords: kind === "cv" ? v.keywords : [], kwLang: offer?.language, design }) : null;
          return (
            <Card key={kind} className="p-4 flex gap-4">
              {v ? <button type="button" onClick={() => openStudio(app.id, kind)} className={`shrink-0 rounded-xl ${T.ring}`} aria-label={`Ouvrir ${label} dans le Studio`}><DocThumb text={v.text} kind={kind} design={design} photo={media.photo} lang={lang} width={104} /></button>
                : <div className={`shrink-0 rounded-xl flex items-center justify-center ${T.sub}`} style={{ width: 104, height: 147 }}><FileText className={`w-6 h-6 ${T.faint}`} aria-hidden="true" /></div>}
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="text-sm font-medium">{label}</div>
                {v ? (
                  <>
                    <div className="flex flex-wrap gap-1">{langs.map((l) => <Chip key={l} tone={l === lang ? "accent" : "neutral"}>{LANG_FLAG[l]}</Chip>)}</div>
                    <div className="flex flex-wrap gap-1"><Chip tone={q.score >= 85 ? "ok" : q.score >= 65 ? "warn" : "danger"}>qualité {q.score}</Chip><Chip>{TEMPLATE_BY_ID[design.template]?.label || "Personnalisé"}</Chip></div>
                    <div className="mt-auto"><Btn size="sm" variant="primary" icon={Palette} onClick={() => openStudio(app.id, kind)}>Ouvrir le Studio</Btn></div>
                  </>
                ) : (
                  <>
                    <p className={`text-xs ${T.muted}`}>{legacy ? "Ancien format : régénérez pour la mise en page." : "Pas encore généré."}</p>
                    <div className="mt-auto"><Btn size="sm" icon={Sparkles} loading={loading} onClick={() => generateDocs(app.id, [kind])}>Générer</Btn></div>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <div className={`flex flex-wrap items-center gap-3 rounded-2xl p-4 ${T.sub}`}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Exporter</div>
          <div className={`text-xs ${T.muted}`}>PDF ou Word, une ou plusieurs langues, fichiers séparés ou fusionnés en un seul.</div>
        </div>
        <Btn icon={FileDown} onClick={() => openExport(app.id)} disabled={!docLangs(app, offer, "cv").length && !docLangs(app, offer, "letter").length}>Exporter</Btn>
      </div>
    </div>
  );
}

const slugFile = (x) => normText(x || "").replace(/\s+/g, "-").slice(0, 40) || "document";

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
  useEffect(() => { setText(v?.text || ""); setSubject(v?.subject || ""); }, [v?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const loading = busy[`dossier:${app.id}`];
  const dirty = v && (text !== v.text || (type === "email" && subject !== (v.subject || "")));
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
      {(type === "cv" || type === "letter") && <Notice icon={Info}>Ancien format : régénérez ce document pour l'ouvrir dans le Studio (mise en page, traduction, PDF et Word).</Notice>}
      {type === "cv" && v.highlights?.length > 0 && (
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
      {loading ? <Card className="p-6"><Skeleton lines={8} /></Card> : (
        <Textarea rows={type === "linkedin" ? 5 : 16} value={text} onChange={(e) => setText(e.target.value)} aria-label={DOC_LABEL[type]} style={{ fontFamily: FONT }} />
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
      <div className="space-y-8">
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
        <PracticePanel app={app} offer={offer} />
      </div>
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
      <PracticePanel app={app} offer={offer} />
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
   13b. STUDIO CV & LETTRE — édition visuelle, design en temps réel, export
   ════════════════════════════════════════════════════════════════════════ */

const PX_MM = 3.7795; // pixels CSS par mm à 100 %

/* Une page du moteur de mise en page, en SVG (mêmes coordonnées que le PDF). */
function PageSvg({ page, W, H, photo, idp, interactive, sel, hover, onPick, onHover, accent }) {
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
          return (
            <text key={i} x={o.x} y={o.y} fontFamily={FONT_CSS[o.font]} fontSize={o.size * PT} fontWeight={o.bold ? 700 : 400} fontStyle={o.italic ? "italic" : "normal"} fill={o.color} textAnchor={o.anchor} letterSpacing={o.cs || undefined} style={{ whiteSpace: "pre" }}>
              {o.s}
            </text>
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
      {interactive && page.hits.filter((h) => h.kind === "section").map((h, i) => (
        <rect key={`s${i}`} x={h.x - 1.2} y={h.y - 0.8} width={h.w + 2.4} height={h.h + 1.6} rx={1.5} fill="transparent" stroke={hover === h.src.key ? accent : "transparent"} strokeDasharray="1.2 1" strokeWidth={0.35} onMouseEnter={() => onHover?.(h.src.key)} />
      ))}
      {interactive && page.hits.filter((h) => h.kind === "block").map((h, i) => {
        const on = sel && (h.src.photo ? sel.photo : sel.l0 === h.src.l0);
        return (
          <rect key={`b${i}`} x={h.x} y={h.y} width={h.w} height={h.h} rx={0.8} fill={on ? "rgba(79,70,229,0.08)" : "transparent"} stroke={on ? accent : "transparent"} strokeWidth={0.35} style={{ cursor: "text" }}
            onClick={(e) => { e.stopPropagation(); onPick?.(h); }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.setAttribute("stroke", "rgba(79,70,229,0.45)"); }}
            onMouseLeave={(e) => { if (!on) e.currentTarget.setAttribute("stroke", "transparent"); }} />
        );
      })}
    </svg>
  );
}

/* Vignette d'un document (première page), sans interaction. */
function DocThumb({ text, kind, design, photo, lang, width = 160, className = "" }) {
  const lay = useMemo(() => (text ? layoutDocument(docModel(text, kind), design, { photo, lang }) : null), [text, kind, design, photo, lang]);
  if (!lay) return null;
  return (
    <div className={`rounded-xl overflow-hidden ${className}`} style={{ width, height: (width * lay.H) / lay.W, boxShadow: "0 8px 24px -14px rgba(0,0,0,.35)", border: "1px solid #e7e5e4" }}>
      <PageSvg page={lay.pages[0]} W={lay.W} H={lay.H} photo={photo} idp={`th-${kind}-${lang}-${width}`} />
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
    toast("Photo enregistrée (stockée localement, jamais envoyée à l'IA)", "ok");
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
function DesignPanel({ design, setDesign, accentSuggested, onPhoto, hasPhoto, kind }) {
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
function StructurePanel({ model, design, setDesign, onAddSection, onDeleteSection, lang }) {
  const T = useT();
  const two = Number(design.columns) === 2;
  const arr = arrangeSections(model.sections, design.layout, two);
  const [dragKey, setDragKey] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const L = design.layout || {};
  const sideList = Array.isArray(L.side) ? L.side : model.sections.filter((s) => arr.isSide(s.key)).map((s) => s.key);
  const setLayout = (patch) => setDesign({ ...design, layout: { ...L, order: arr.order, side: sideList, ...patch } });
  const colOf = (k) => (two && sideList.includes(k) ? "side" : "main");
  const moveTo = (key, target, beforeKey) => {
    const order = arr.order.filter((k) => k !== key);
    const i = beforeKey ? order.indexOf(beforeKey) : -1;
    order.splice(i >= 0 ? i : order.length, 0, key);
    const side = target === "side" ? [...new Set([...sideList, key])] : sideList.filter((k) => k !== key);
    setLayout({ order, side });
  };
  const step = (key, dir) => {
    const col = colOf(key);
    const same = arr.order.filter((k) => colOf(k) === col);
    const i = same.indexOf(key), j = i + dir;
    if (j < 0 || j >= same.length) return;
    const order = [...arr.order];
    const a = order.indexOf(same[i]), b = order.indexOf(same[j]);
    [order[a], order[b]] = [order[b], order[a]];
    setLayout({ order });
  };
  const toggleHide = (key) => setLayout({ hidden: arr.hidden.has(key) ? [...arr.hidden].filter((k) => k !== key) : [...arr.hidden, key] });
  const missing = Object.keys(SECTION_TITLES.fr).filter((k) => !model.sections.some((s) => baseKey(s.key) === k));
  const cols = two ? [["main", "Colonne principale"], ["side", "Colonne secondaire"]] : [["main", "Sections"]];
  return (
    <div className="space-y-5">
      <p className={`text-xs ${T.muted}`}>Glissez les sections pour les réordonner{two ? " ou les changer de colonne" : ""}. Survolez une section dans l'aperçu pour la déplacer sur place.</p>
      {cols.map(([col, label]) => {
        const keys = arr.order.filter((k) => colOf(k) === col);
        return (
          <div key={col}
            onDragOver={(e) => { e.preventDefault(); setOverCol(col); }}
            onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
            onDrop={(e) => { e.preventDefault(); setOverCol(null); if (dragKey) moveTo(dragKey, col, null); setDragKey(null); }}
            className={`rounded-2xl p-2 transition-colors duration-150 ${overCol === col ? T.accentSoft : T.sub}`}>
            <div className={`px-2 pb-2 text-xs font-semibold uppercase tracking-wider ${T.faint}`}>{label}</div>
            <ul className="space-y-1">
              {keys.map((k) => {
                const sec = model.sections.find((s) => s.key === k);
                const hidden = arr.hidden.has(k);
                return (
                  <li key={k} draggable
                    onDragStart={(e) => { setDragKey(k); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", k); }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOverCol(null); if (dragKey && dragKey !== k) moveTo(dragKey, col, k); setDragKey(null); }}
                    className={`flex items-center gap-1 rounded-xl pl-1 pr-1 py-1 ${T.surface} ${hidden ? "opacity-50" : ""}`} style={T.shadow}>
                    <GripVertical className={`w-4 h-4 shrink-0 cursor-grab ${T.faint}`} aria-hidden="true" />
                    <span className="flex-1 min-w-0 text-sm truncate">{sectionLabel(sec)}</span>
                    <IconBtn icon={ArrowUp} label="Monter" onClick={() => step(k, -1)} small />
                    <IconBtn icon={ArrowDown} label="Descendre" onClick={() => step(k, 1)} small />
                    {two && <IconBtn icon={ArrowLeftRight} label={col === "side" ? "Vers la colonne principale" : "Vers la colonne secondaire"} onClick={() => moveTo(k, col === "side" ? "main" : "side", null)} small />}
                    <IconBtn icon={hidden ? EyeOff : Eye} label={hidden ? "Afficher" : "Masquer à l'export"} onClick={() => toggleHide(k)} small />
                    {sec?.heading && <IconBtn icon={Trash2} label="Supprimer la section du texte" onClick={() => onDeleteSection(sec)} small />}
                  </li>
                );
              })}
              {!keys.length && <li className={`text-xs text-center py-4 ${T.faint}`}>Déposez une section ici</li>}
            </ul>
          </div>
        );
      })}
      {missing.length > 0 && (
        <div>
          <div className={`text-xs mb-2 ${T.muted}`}>Ajouter une section</div>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((k) => <Btn key={k} size="sm" variant="ghost" icon={Plus} onClick={() => onAddSection(k)}>{(SECTION_TITLES[lang] || SECTION_TITLES.fr)[k]}</Btn>)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Panneau Qualité : score local + mots-clés ── */
function QualityPanel({ q, cov, kwInfo, tips, missingInProfile }) {
  const T = useT();
  const tone = q.score >= 85 ? "#059669" : q.score >= 65 ? "#d97706" : "#e11d48";
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <svg width="64" height="64" viewBox="0 0 36 36" aria-label={`Score qualité ${q.score} sur 100`} role="img">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke={T.dark ? "#292524" : "#e7e5e4"} strokeWidth="3.5" />
          <circle cx="18" cy="18" r="15.5" fill="none" stroke={tone} strokeWidth="3.5" strokeDasharray={`${(q.score / 100) * 97.4} 97.4`} strokeLinecap="round" transform="rotate(-90 18 18)" />
          <text x="18" y="21.5" textAnchor="middle" fontSize="10" fontWeight="600" fill="currentColor">{q.score}</text>
        </svg>
        <div>
          <div className="text-sm font-medium">Score qualité</div>
          <div className={`text-xs ${T.muted}`}>{q.words} mots · calculé localement, sans IA. Visez 85 et plus.</div>
        </div>
      </div>
      <ul className="space-y-2">
        {q.checks.map((c) => (
          <li key={c.id} className="flex gap-2 text-sm">
            {c.tone === "info" ? <Info className={`w-4 h-4 mt-0.5 shrink-0 ${T.muted}`} aria-hidden="true" /> : c.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" aria-label="Conforme" /> : <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${c.tone === "danger" ? "text-rose-500" : "text-amber-500"}`} aria-label="À améliorer" />}
            <span className="min-w-0"><span className="block">{c.label}</span><span className={`block text-xs ${T.muted}`}>{c.detail}</span></span>
          </li>
        ))}
      </ul>
      {cov && cov.pct !== null && (
        <div>
          <SectionTitle>Mots-clés de l'annonce · {cov.pct} %</SectionTitle>
          {kwInfo && <p className={`text-xs mb-2 ${T.muted}`}>{kwInfo}</p>}
          <div className="flex flex-wrap gap-1.5">{cov.covered.map((k) => <Chip key={k} tone="ok">{k}</Chip>)}{cov.missing.map((k) => <Chip key={k} tone="warn">{k}</Chip>)}</div>
          {cov.missing.length > 0 && <p className={`text-xs mt-2 ${T.faint}`}>En orange : absents. Ajoutez-les seulement si c'est vrai.</p>}
        </div>
      )}
      {missingInProfile?.length > 0 && <Notice icon={HelpCircle}>Exigences non couvertes par votre profil : {missingInProfile.join(", ")}. À préparer pour l'entretien.</Notice>}
      {tips?.length > 0 && (
        <div className={`rounded-2xl p-4 ${T.accentSoft}`}>
          <div className="text-sm font-medium mb-1">Pour sortir du lot sur cette offre</div>
          <ul className="text-sm space-y-1">{tips.map((t, i) => <li key={i}>• {t}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

/* Édition d'un bloc à l'emplacement cliqué. */
const BLOCK_PREFIX = { name: "# ", h2: "## ", h3: "### ", bullet: "- ", quote: "> ", contact: "@ ", date: "= ", sign: "~ " };
const BLOCK_LABEL = { name: "Nom", h2: "Titre de section", h3: "Poste | Organisation | Lieu | Période", bullet: "Puces (une par ligne)", quote: "Accroche / destinataire", contact: "Coordonnées (séparées par |)", date: "Lieu et date", sign: "Signature", kv: "**Libellé :** valeurs", para: "Paragraphe" };
const splitLines = (t) => String(t || "").split("\n");
function blockValue(text, b) {
  const ls = splitLines(text).slice(b.l0, b.l1 + 1);
  if (BLOCK_PREFIX[b.t]) return ls.map((l) => l.trim().replace(/^(#{1,3}|[-•*]|>|@|=|~)\s/, "")).join("\n");
  return ls.join("\n");
}
function replaceLines(text, l0, l1, newLines) { const ls = splitLines(text); ls.splice(l0, l1 - l0 + 1, ...newLines); return ls.join("\n"); }
function BlockEditor({ block, text, onChange, onClose, onMove, onDuplicate, onDelete, style }) {
  const T = useT();
  const ref = useRef(null);
  const [val, setVal] = useState(() => blockValue(text, block));
  useEffect(() => { const el = ref.current; if (el) { el.focus(); const n = el.value.length; try { el.setSelectionRange(n, n); } catch { /* ignore */ } } }, [block.l0]);
  useEffect(() => { if (document.activeElement !== ref.current) setVal(blockValue(text, block)); }, [text, block.l0, block.l1]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = (v) => {
    setVal(v);
    const pre = BLOCK_PREFIX[block.t];
    const out = pre ? splitLines(v).map((l) => (l.trim() ? pre + l.trim() : "")).filter((l, i, a) => l || i < a.length - 1) : splitLines(v);
    onChange(out.length ? out : [""]);
  };
  return (
    <div className="absolute rounded-2xl p-3 space-y-2" style={{ ...T.glass, ...T.shadow, zIndex: 5, ...style }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Modifier le bloc">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs ${T.muted}`}>{BLOCK_LABEL[block.t] || "Bloc"}</span>
        <span className="flex gap-0.5">
          <IconBtn icon={ArrowUp} label="Monter le bloc" onClick={() => onMove(-1)} small />
          <IconBtn icon={ArrowDown} label="Descendre le bloc" onClick={() => onMove(1)} small />
          <IconBtn icon={Copy} label="Dupliquer" onClick={onDuplicate} small />
          <IconBtn icon={Trash2} label="Supprimer le bloc" onClick={onDelete} small />
          <IconBtn icon={X} label="Fermer (Échap)" onClick={onClose} small />
        </span>
      </div>
      <textarea ref={ref} value={val} onChange={(e) => commit(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
        rows={Math.min(8, Math.max(2, val.split("\n").length + 1))} className={`w-full rounded-xl px-3 py-2 text-sm leading-relaxed ${T.input} ${T.ring}`} aria-label={BLOCK_LABEL[block.t] || "Texte du bloc"} />
      {block.t === "bullet" && <p className={`text-xs ${T.faint}`}>Entrée = nouvelle puce. Commencez par un verbe d'action et un chiffre.</p>}
    </div>
  );
}

/* ── Studio plein écran ── */
function Studio({ appId, initialKind = "cv", onClose }) {
  const T = useT();
  const { apps, offers, settings, media, saveDocVersion, translateDoc, generateDocs, setAppDesign, busy, toast, openExport } = useApp();
  const app = apps.find((a) => a.id === appId);
  const offer = offers.find((o) => o.id === app?.offerId);
  const ref = useRef(null);
  const center = useRef(null);
  const taRef = useRef(null);
  const [kind, setKind] = useState(initialKind);
  const firstLang = (k) => { const l = docLangs(app, offer, k); return l.includes(app?.docLanguage) ? app.docLanguage : l[0] || offerLang(offer); };
  const [lang, setLang] = useState(() => firstLang(initialKind));
  const key = `${kind}:${lang}`;
  const latest = latestDoc(app, offer, kind, lang);
  const [drafts, setDrafts] = useState({});
  const text = drafts[key] ?? latest?.text ?? "";
  const cvLatest = latestDoc(app, offer, "cv", lang) || (app?.docs?.cv || []).slice(-1)[0];
  const [design, setDesignState] = useState(() => resolveDesign(app, settings, cvLatest?.accent));
  const [sel, setSel] = useState(null);
  const [hover, setHover] = useState(null);
  const [left, setLeft] = useState("content");
  const [mobile, setMobile] = useState("preview");
  const [zoom, setZoom] = useState("fit");
  const [fit, setFit] = useState(0.7);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [instr, setInstr] = useState("");
  const [trOpen, setTrOpen] = useState(false);
  const hist = useRef({ past: [], future: [], at: 0 });
  // Échap : ferme d'abord l'éditeur de bloc ou le menu, puis le Studio (le piège de focus garde la première fonction reçue).
  const escRef = useRef(null);
  escRef.current = () => { if (trOpen) setTrOpen(false); else if (sel) setSel(null); else tryClose(); };
  useFocusTrap(true, ref, () => escRef.current());

  /* Historique (annuler / rétablir) : texte et design. Les frappes rapprochées sont regroupées. */
  const snapshot = () => ({ drafts, design });
  const remember = (coalesce) => {
    const h = hist.current;
    const now = Date.now();
    if (!(coalesce && now - h.at < 900)) { h.past.push(snapshot()); if (h.past.length > 80) h.past.shift(); h.future = []; }
    h.at = now;
  };
  const setText = (v, coalesce = true) => { remember(coalesce); setDrafts((d) => ({ ...d, [key]: v })); };
  const setDesign = (d) => { remember(false); setDesignState(d); };
  const undo = () => { const h = hist.current; const s = h.past.pop(); if (!s) return; h.future.push(snapshot()); setDrafts(s.drafts); setDesignState(s.design); h.at = 0; };
  const redo = () => { const h = hist.current; const s = h.future.pop(); if (!s) return; h.past.push(snapshot()); setDrafts(s.drafts); setDesignState(s.design); h.at = 0; };

  // Le design (commun au CV et à la lettre) est enregistré sur la candidature au fil de l'eau.
  useEffect(() => { const t = setTimeout(() => setAppDesign(appId, design), 400); return () => clearTimeout(t); }, [design]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "s") { e.preventDefault(); save(); return; }
      if (/^(INPUT|TEXTAREA)$/.test(e.target?.tagName)) return;
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    const el = center.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([e]) => setFit(clamp((e.contentRect.width - 48) / (PAGE_SIZES[design.page]?.[0] || 210) / PX_MM, 0.35, 1.6)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [design.page]);

  const deferred = useDeferredValue(text);
  const model = useMemo(() => docModel(deferred, kind), [deferred, kind]);
  const layout = useMemo(() => layoutDocument(model, design, { photo: media.photo, lang }), [model, design, media.photo, lang]);
  const k = zoom === "fit" ? fit : zoom;
  const kw = latest?.keywords || cvLatest?.keywords || [];
  const kwLang = offer?.language || app?.docLanguage;
  const q = useMemo(() => docQuality(deferred, { kind, lang, keywords: kind === "cv" ? kw : [], kwLang, design }), [deferred, kind, lang, design]); // eslint-disable-line react-hooks/exhaustive-deps
  const cov = kind === "cv" && kw.length ? keywordCoverage(deferred, kw) : null;
  const dirtyKeys = Object.keys(drafts).filter((dk) => { const [kk, ll] = dk.split(":"); return drafts[dk] !== (latestDoc(app, offer, kk, ll)?.text ?? ""); });
  const dirty = dirtyKeys.includes(key);
  const langs = docLangs(app, offer, kind);
  const allLangs = [...new Set([...langs, ...dirtyKeys.filter((dk) => dk.startsWith(`${kind}:`)).map((dk) => dk.split(":")[1])])];

  function save() {
    if (!dirty || !text.trim()) return;
    saveDocVersion(appId, kind, text, undefined, { lang, format: "markup" });
    toast(`${kind === "cv" ? "CV" : "Lettre"} ${LANG_FLAG[lang]} enregistré(e) — nouvelle version`, "ok");
  }
  function saveAll() {
    const todo = dirtyKeys.filter((dk) => drafts[dk]?.trim());
    todo.forEach((dk) => { const [kk, ll] = dk.split(":"); saveDocVersion(appId, kk, drafts[dk], undefined, { lang: ll, format: "markup" }); });
    if (todo.length) toast(`${todo.length} document(s) modifié(s) enregistré(s) en nouvelle version`, "ok");
  }
  function tryClose() { saveAll(); onClose(); }
  const switchTo = (nk, nl) => { setSel(null); setKind(nk); setLang(nl ?? (docLangs(app, offer, nk).includes(lang) ? lang : firstLang(nk))); };
  const translate = async (to) => {
    setTrOpen(false);
    if (dirty) save();
    const from = langs.includes(app?.docLanguage) ? app.docLanguage : langs[0] || lang;
    const v = await translateDoc(appId, kind, from, to);
    if (v) { setLang(to); toast(`Traduction ${LANG_FLAG[from]} → ${LANG_FLAG[to]} prête : relisez-la avant l'envoi`, "ok"); }
  };
  const regenerate = async () => {
    if (dirty) save();
    setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });
    await generateDocs(appId, [kind], instr, lang);
    setInstr("");
  };

  /* Clic dans l'aperçu : sélection du bloc (ou de la photo), synchronisation de la zone de texte. */
  const pick = (h) => {
    if (h.src.photo) { setSel({ photo: true }); setPhotoOpen(true); return; }
    const b = model.blocks.find((x) => x.l0 === h.src.l0) || h.src;
    setSel({ ...b, page: layout.pages.findIndex((pg) => pg.hits.includes(h)), hit: h });
    const ta = taRef.current;
    if (ta) {
      const ls = splitLines(text);
      const start = ls.slice(0, b.l0).reduce((n, l) => n + l.length + 1, 0);
      const end = start + ls.slice(b.l0, b.l1 + 1).join("\n").length;
      try { ta.setSelectionRange(start, end); ta.scrollTop = Math.max(0, b.l0 * 19 - 60); } catch { /* zone non visible */ }
    }
  };
  const editBlock = (newLines) => {
    if (!sel || sel.photo) return;
    setText(replaceLines(text, sel.l0, sel.l1, newLines));
    setSel((s) => s && { ...s, l1: s.l0 + newLines.length - 1 });
  };
  const blockAt = (l0) => model.blocks.find((x) => x.l0 === l0);
  const moveBlock = (dir) => {
    const bs = model.blocks;
    const i = bs.findIndex((x) => x.l0 === sel.l0);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= bs.length) return;
    const [a, b] = dir < 0 ? [bs[j], bs[i]] : [bs[i], bs[j]];
    const ls = splitLines(text);
    const A = ls.slice(a.l0, a.l1 + 1), B = ls.slice(b.l0, b.l1 + 1), mid = ls.slice(a.l1 + 1, b.l0);
    const out = [...ls.slice(0, a.l0), ...B, ...mid, ...A, ...ls.slice(b.l1 + 1)];
    setText(out.join("\n"), false);
    const nl0 = dir < 0 ? a.l0 : a.l0 + B.length + mid.length;
    setSel((s) => ({ ...s, l0: nl0, l1: nl0 + (s.l1 - s.l0), hit: null }));
  };
  const duplicateBlock = () => {
    const ls = splitLines(text);
    const chunk = ls.slice(sel.l0, sel.l1 + 1);
    ls.splice(sel.l1 + 1, 0, ...(sel.t === "para" ? ["", ...chunk] : chunk));
    setText(ls.join("\n"), false);
  };
  const deleteBlock = () => { setText(replaceLines(text, sel.l0, sel.l1, []), false); setSel(null); toast("Bloc supprimé — Ctrl+Z pour annuler", "neutral"); };
  const addSection = (k2) => {
    const title = (SECTION_TITLES[lang] || SECTION_TITLES.fr)[k2];
    setText(`${text.replace(/\s+$/, "")}\n\n## ${title}\n${k2 === "skills" || k2 === "languages" ? "**Groupe :** élément, élément" : "- "}`, false);
  };
  const deleteSection = (sec) => {
    const next = model.sections.map((s) => s.heading?.l0).filter((x) => x > sec.heading.l0).sort((a, b) => a - b)[0];
    const ls = splitLines(text);
    ls.splice(sec.heading.l0, (next ?? ls.length) - sec.heading.l0);
    setText(ls.join("\n"), false);
    setSel(null);
    toast(`Section « ${sec.title} » supprimée — Ctrl+Z pour annuler`, "neutral");
  };
  const sectionMove = (key2, dir) => {
    const two = Number(design.columns) === 2;
    const arr = arrangeSections(model.sections, design.layout, two);
    const sideList = Array.isArray(design.layout?.side) ? design.layout.side : model.sections.filter((s) => arr.isSide(s.key)).map((s) => s.key);
    const col = (k3) => (two && sideList.includes(k3) ? "side" : "main");
    if (dir === "swap") {
      setDesign({ ...design, layout: { ...design.layout, order: arr.order, side: col(key2) === "side" ? sideList.filter((x) => x !== key2) : [...sideList, key2] } });
      return;
    }
    if (dir === "hide") { setDesign({ ...design, layout: { ...design.layout, order: arr.order, side: sideList, hidden: [...arr.hidden, key2] } }); setHover(null); return; }
    const same = arr.order.filter((k3) => col(k3) === col(key2) && !arr.hidden.has(k3));
    const i = same.indexOf(key2), j = i + dir;
    if (j < 0 || j >= same.length) return;
    const order = [...arr.order];
    const a = order.indexOf(same[i]), b = order.indexOf(same[j]);
    [order[a], order[b]] = [order[b], order[a]];
    setDesign({ ...design, layout: { ...design.layout, order, side: sideList } });
  };
  const generating = busy[`dossier:${appId}`];
  const translating = DOC_LANGS.find((l) => busy[`tr:${appId}:${kind}:${l}`]);
  const accent = "#4f46e5";
  const selHit = sel && !sel.photo && (() => {
    for (let p = 0; p < layout.pages.length; p++) { const h = layout.pages[p].hits.find((x) => x.kind === "block" && x.src.l0 === sel.l0); if (h) return { p, h }; }
    return null;
  })();

  if (!app) return null;
  const leftPanel = (
    <div className="flex flex-col min-h-0 h-full">
      <div className="px-4 pt-4 pb-3"><Tabs value={left} onChange={setLeft} tabs={[{ id: "content", label: "Contenu" }, ...(kind === "cv" ? [{ id: "structure", label: "Structure" }] : []), { id: "quality", label: "Qualité", count: q.score }]} /></div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
        {left === "content" && (
          <div className="space-y-3">
            {!latest && !text ? (
              <Empty icon={FileText} title={`${kind === "cv" ? "CV" : "Lettre"} ${LANG_FLAG[lang]} pas encore généré(e)`} text="L'IA rédige à partir de votre profil et de l'annonce, sans rien inventer." action={<Btn variant="primary" icon={Sparkles} loading={generating} onClick={regenerate}>Générer</Btn>} />
            ) : (
              <>
                <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} spellCheck lang={DOCX_LANG[lang]} rows={24} aria-label="Texte du document (balisage léger)"
                  className={`w-full rounded-xl px-3 py-2.5 ${T.input} ${T.ring}`} style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, lineHeight: "19px", minHeight: 320 }} />
                <p className={`text-xs ${T.faint}`}># nom · &gt; accroche ou destinataire · @ coordonnées (séparées par |) · = date · ## section · ### Poste | Organisation | Lieu | Période · - puce · **Libellé :** valeur · ~ signature</p>
              </>
            )}
            <div className={`pt-3 border-t ${T.line} space-y-2`}>
              <Input value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="Consigne : plus court, accent sur l'automatisation…" aria-label="Consigne de régénération" />
              <Btn size="sm" icon={RefreshCw} loading={generating} onClick={regenerate}>{latest ? "Régénérer" : "Générer"} en {LANG_FLAG[lang]}</Btn>
            </div>
          </div>
        )}
        {left === "structure" && <StructurePanel model={model} design={design} setDesign={setDesign} onAddSection={addSection} onDeleteSection={deleteSection} lang={lang} />}
        {left === "quality" && <QualityPanel q={q} cov={cov} kwInfo={kwLang && kwLang !== lang ? `Annonce en ${LANG_NAME[kwLang] || kwLang} : analyse pertinente surtout sur la version ${LANG_FLAG[kwLang] || ""}.` : null} tips={latest?.tips || cvLatest?.tips} missingInProfile={kind === "cv" ? latest?.missingInProfile : null} />}
      </div>
    </div>
  );
  const pageW = layout.W * PX_MM * k, pageH = layout.H * PX_MM * k;
  const preview = (
    <div ref={center} className="h-full overflow-auto" style={{ background: T.dark ? "#1c1917" : "#e7e5e4" }} onClick={() => setSel(null)}>
      <div className="flex flex-col items-center gap-6 py-6 px-6" onMouseLeave={() => setHover(null)}>
        {layout.pages.map((pg, i) => {
          const secHit = hover && pg.hits.find((h) => h.kind === "section" && h.src.key === hover);
          return (
            <div key={i} className="relative shrink-0" style={{ width: pageW, height: pageH, boxShadow: "0 18px 40px -24px rgba(0,0,0,.45)" }}>
              <PageSvg page={pg} W={layout.W} H={layout.H} photo={media.photo} idp={`st-${i}`} interactive sel={sel} hover={hover} onPick={pick} onHover={setHover} accent={accent} />
              {secHit && kind === "cv" && (
                <div className="absolute flex gap-0.5 rounded-xl p-0.5" style={{ left: Math.min(pageW - 150, (secHit.x + secHit.w) * PX_MM * k - 150), top: Math.max(0, secHit.y * PX_MM * k - 30), ...T.glass, ...T.shadow }} onClick={(e) => e.stopPropagation()}>
                  <IconBtn icon={ArrowUp} label="Monter la section" onClick={() => sectionMove(hover, -1)} small />
                  <IconBtn icon={ArrowDown} label="Descendre la section" onClick={() => sectionMove(hover, 1)} small />
                  {Number(design.columns) === 2 && <IconBtn icon={ArrowLeftRight} label="Changer de colonne" onClick={() => sectionMove(hover, "swap")} small />}
                  <IconBtn icon={EyeOff} label="Masquer la section" onClick={() => sectionMove(hover, "hide")} small />
                </div>
              )}
              {selHit?.p === i && (
                <BlockEditor key={sel.l0} block={blockAt(sel.l0) || sel} text={text} onChange={editBlock} onClose={() => setSel(null)} onMove={moveBlock} onDuplicate={duplicateBlock} onDelete={deleteBlock}
                  style={{ left: clamp(selHit.h.x * PX_MM * k, 8, Math.max(8, pageW - 340)), top: (selHit.h.y + selHit.h.h) * PX_MM * k + 8, width: Math.min(340, pageW - 16) }} />
              )}
              <span className={`absolute -bottom-5 right-0 text-xs ${T.faint}`}>{i + 1} / {layout.pages.length}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
  return (
    <div ref={ref} className={`fixed inset-0 flex flex-col ${T.app}`} style={{ zIndex: 45 }} role="dialog" aria-modal="true" aria-label="Studio CV et lettre">
      <div className={`flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2 border-b ${T.line}`} style={T.glass}>
        <IconBtn icon={X} label="Fermer le Studio (les modifications sont enregistrées)" onClick={tryClose} />
        <div className="min-w-0 mr-2">
          <div className="text-sm font-medium truncate" style={{ maxWidth: 260 }}>{offer?.title || "Candidature"}</div>
          <div className={`text-xs truncate ${T.muted}`} style={{ maxWidth: 260 }}>{show(offer?.company)}</div>
        </div>
        <Tabs value={kind} onChange={(v) => switchTo(v)} tabs={[{ id: "cv", label: "CV" }, { id: "letter", label: "Lettre" }]} />
        <div className="flex items-center gap-1" role="group" aria-label="Langue du document">
          {allLangs.map((l) => (
            <button key={l} type="button" onClick={() => switchTo(kind, l)} aria-pressed={l === lang} className={`h-8 px-2.5 rounded-xl text-xs font-semibold ${l === lang ? T.accentSoft : T.btnGhost} ${T.ring}`}>
              {LANG_FLAG[l]}{dirtyKeys.includes(`${kind}:${l}`) ? " •" : ""}
            </button>
          ))}
          {!allLangs.includes(lang) && <span className={`h-8 px-2.5 inline-flex items-center rounded-xl text-xs font-semibold ${T.accentSoft}`}>{LANG_FLAG[lang]}</span>}
          <div className="relative">
            <Btn size="sm" variant="ghost" icon={Languages} loading={!!translating} disabled={!langs.length} onClick={() => setTrOpen(!trOpen)}>{translating ? `→ ${LANG_FLAG[translating]}` : "Traduire"}</Btn>
            {trOpen && (
              <div className="absolute mt-1 rounded-2xl p-1 w-56" style={{ ...T.glass, ...T.shadow, zIndex: 6 }}>
                {DOC_LANGS.filter((l) => !langs.includes(l)).map((l) => (
                  <button key={l} type="button" onClick={() => translate(l)} className={`w-full text-left px-3 h-9 rounded-xl text-sm ${T.subHover} ${T.ring}`}>Traduire en {LANG_NAME[l]}</button>
                ))}
                {DOC_LANGS.filter((l) => !langs.includes(l)).map((l) => (
                  <button key={`g${l}`} type="button" onClick={() => { setTrOpen(false); switchTo(kind, l); }} className={`w-full text-left px-3 h-9 rounded-xl text-xs ${T.muted} ${T.subHover} ${T.ring}`}>Rédiger directement en {LANG_NAME[l]}</button>
                ))}
                {DOC_LANGS.every((l) => langs.includes(l)) && <div className={`px-3 py-2 text-xs ${T.faint}`}>Toutes les langues sont disponibles.</div>}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1" />
        <div className="hidden sm:flex items-center gap-1">
          <IconBtn icon={Undo2} label="Annuler (Ctrl+Z)" onClick={undo} disabled={!hist.current.past.length} />
          <IconBtn icon={Redo2} label="Rétablir (Ctrl+Maj+Z)" onClick={redo} disabled={!hist.current.future.length} />
          <IconBtn icon={ZoomOut} label="Zoom arrière" onClick={() => setZoom(clamp(k - 0.1, 0.35, 2))} />
          <button type="button" onClick={() => setZoom("fit")} className={`h-9 px-2 rounded-xl text-xs tabular-nums ${T.btnGhost} ${T.ring}`} aria-label="Ajuster à la largeur">{Math.round(k * 100)} %</button>
          <IconBtn icon={ZoomIn} label="Zoom avant" onClick={() => setZoom(clamp(k + 0.1, 0.35, 2))} />
        </div>
        <Chip tone={q.score >= 85 ? "ok" : q.score >= 65 ? "warn" : "danger"} className="hidden sm:inline-flex">qualité {q.score}</Chip>
        <Chip className="hidden md:inline-flex">{layout.pages.length} page(s)</Chip>
        <Btn variant={dirty ? "primary" : "soft"} icon={Save} disabled={!dirty} onClick={save}>Enregistrer</Btn>
        <Btn icon={FileDown} onClick={() => { saveAll(); openExport(appId); }}>Exporter</Btn>
      </div>
      <div className="flex-1 min-h-0 flex">
        <aside className={`${mobile === "content" ? "flex" : "hidden"} md:flex w-full md:w-80 shrink-0 border-r ${T.line} flex-col min-h-0`} aria-label="Contenu">{leftPanel}</aside>
        <main className={`${mobile === "preview" ? "flex" : "hidden"} md:flex flex-1 min-w-0 flex-col min-h-0`}>{preview}</main>
        <aside className={`${mobile === "design" ? "flex" : "hidden"} md:flex w-full md:w-80 shrink-0 border-l ${T.line} flex-col min-h-0`} aria-label="Design">
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8">
            <DesignPanel design={design} setDesign={setDesign} accentSuggested={cvLatest?.accent} onPhoto={() => setPhotoOpen(true)} hasPhoto={!!media.photo?.src} kind={kind} />
          </div>
        </aside>
      </div>
      <div className={`md:hidden flex border-t ${T.line}`}>
        {[["content", "Contenu", Pencil], ["preview", "Aperçu", Eye], ["design", "Design", Palette]].map(([id, l, I]) => (
          <button key={id} type="button" onClick={() => setMobile(id)} className={`flex-1 h-12 flex flex-col items-center justify-center text-xs ${mobile === id ? T.accentText : T.muted} ${T.ring}`}><I className="w-4 h-4" aria-hidden="true" />{l}</button>
        ))}
      </div>
      <PhotoEditor open={photoOpen} onClose={(shape) => { setPhotoOpen(false); setSel(null); if (shape) setDesign({ ...design, photo: { ...design.photo, show: true, shape } }); }} />
    </div>
  );
}

/* ── Export : documents × langues × formats, fichiers séparés ou fusionnés ── */
function ExportModal({ appId, onClose }) {
  const T = useT();
  const { apps, offers, settings, media, profile, translateDoc, toast } = useApp();
  const app = apps.find((a) => a.id === appId);
  const offer = offers.find((o) => o.id === app?.offerId);
  const avail = { cv: docLangs(app, offer, "cv"), letter: docLangs(app, offer, "letter") };
  const known = [...new Set([...avail.cv, ...avail.letter])];
  const [docs, setDocs] = useState({ cv: avail.cv.length > 0, letter: avail.letter.length > 0 });
  const [langs, setLangs] = useState(() => (known.length ? known : [offerLang(offer)]));
  const [format, setFormat] = useState("pdf");
  const [group, setGroup] = useState("perLang");
  const [order, setOrder] = useState("cvFirst");
  const [wordMode, setWordMode] = useState("design");
  const [run, setRun] = useState(null);
  if (!app) return null;
  const kinds = (order === "cvFirst" ? ["cv", "letter"] : ["letter", "cv"]).filter((k) => docs[k]);
  const missing = kinds.flatMap((k) => langs.filter((l) => !avail[k].includes(l)).map((l) => ({ k, l })));
  const noSource = missing.filter((m) => !avail[m.k].length);
  const design = resolveDesign(app, settings, (app.docs?.cv || []).slice(-1)[0]?.accent);
  const name = profile.name || "candidat";
  const base = (k, ls) => `${k === "both" ? "Dossier" : k === "cv" ? "CV" : "Lettre"}_${slugFile(name)}_${slugFile(offer?.company || offer?.title)}_${ls.map((l) => LANG_FLAG[l]).join("-")}`;
  const nFiles = (() => {
    const per = group === "merged" ? 1 : group === "perLang" ? langs.length : langs.length * kinds.length;
    return per * (format === "both" ? 2 : 1);
  })();
  const go = async () => {
    try {
      const texts = {};
      for (const { k, l } of missing) {
        if (!avail[k].length) continue;
        setRun(`Traduction ${k === "cv" ? "du CV" : "de la lettre"} en ${LANG_NAME[l]}…`);
        const from = avail[k].includes(app.docLanguage) ? app.docLanguage : avail[k][0];
        const v = await translateDoc(appId, k, from, l);
        if (!v) throw new Error(`Traduction ${LANG_FLAG[l]} impossible.`);
        texts[`${k}:${l}`] = v.text;
      }
      setRun("Mise en page…");
      const items = [];
      for (const l of langs) for (const k of kinds) {
        const t = texts[`${k}:${l}`] ?? latestDoc(app, offer, k, l)?.text;
        if (t) items.push({ kind: k, lang: l, text: t, title: `${k === "cv" ? "CV" : "Lettre de motivation"} (${LANG_FLAG[l]})` });
      }
      if (!items.length) throw new Error("Aucun document à exporter.");
      const groups = group === "merged" ? [items] : group === "perLang" ? langs.map((l) => items.filter((i) => i.lang === l)).filter((g) => g.length) : items.map((i) => [i]);
      const kw = (app.docs?.cv || []).slice(-1)[0]?.keywords || [];
      const files = [];
      for (const g of groups) {
        const ks = [...new Set(g.map((i) => i.kind))];
        const fname = base(ks.length > 1 ? "both" : ks[0], [...new Set(g.map((i) => i.lang))]);
        const meta = { title: [ks.length > 1 ? "Dossier de candidature" : g[0].title, name, offer?.title, offer?.company].filter(Boolean).join(" - "), author: profile.name, keywords: kw, subject: offer?.title };
        if (format !== "docx") {
          setRun(`PDF : ${fname}…`);
          const pdf = await buildPdf(g.map((i) => ({ ...i, photo: media.photo, layout: layoutDocument(docModel(i.text, i.kind), design, { photo: media.photo, lang: i.lang }) })), meta);
          files.push({ name: `${fname}.pdf`, data: new Uint8Array(pdf), mime: "application/pdf" });
        }
        if (format !== "pdf") {
          setRun(`Word : ${fname}…`);
          files.push({ name: `${fname}${wordMode === "ats" ? "_ATS" : ""}.docx`, data: buildDocx(g.map((i) => ({ ...i, design })), { photo: media.photo, mode: wordMode, ...meta }), mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
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
      footer={<><Btn variant="ghost" onClick={onClose} disabled={!!run}>Annuler</Btn><Btn variant="primary" icon={FileDown} loading={!!run} disabled={!kinds.length || !langs.length || noSource.length === kinds.length * langs.length} onClick={go}>{missing.length - noSource.length ? `Traduire ${missing.length - noSource.length} et exporter` : `Exporter (${nFiles} fichier${nFiles > 1 ? "s" : ""})`}</Btn></>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div>
            <div className={`text-xs mb-2 ${T.muted}`}>Documents</div>
            <div className="flex flex-wrap gap-2">
              {[["cv", "CV"], ["letter", "Lettre de motivation"]].map(([k, l]) => (
                <label key={k} className={`inline-flex items-center gap-2 rounded-xl px-3 h-9 text-sm ${T.sub}`}><input type="checkbox" checked={docs[k]} onChange={(e) => setDocs({ ...docs, [k]: e.target.checked })} />{l}<span className={`text-xs ${T.faint}`}>{avail[k].map((x) => LANG_FLAG[x]).join(" ") || "—"}</span></label>
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
            {missing.length - noSource.length > 0 && <p className={`text-xs mt-2 ${T.muted}`}>{missing.length - noSource.length} traduction(s) seront générées puis enregistrées comme nouvelles versions (relisez-les ensuite dans le Studio).</p>}
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

/* ── Comparateur d'offres (2 à 4) ── */
function CompareModal({ ids, onClose }) {
  const T = useT();
  const { offers, settings, ratings } = useApp();
  const list = ids.map((id) => offers.find((o) => o.id === id)).filter(Boolean);
  if (!list.length) return null;
  const crits = [...new Set(list.flatMap((o) => (o.score?.breakdown || []).map((b) => b.criterion)))];
  const row = (label, f) => (
    <tr key={label} className={`border-t ${T.line}`}>
      <th scope="row" className={`text-left align-top py-2 pr-3 text-xs font-medium ${T.muted}`} style={{ minWidth: 120 }}>{label}</th>
      {list.map((o) => <td key={o.id} className="align-top py-2 px-2 text-sm">{f(o)}</td>)}
    </tr>
  );
  const facts = (o) => o.score?.facts || {};
  return (
    <Modal open wide onClose={onClose} title={`Comparer ${list.length} offres`}>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead><tr><th />{list.map((o) => <th key={o.id} className="text-left align-bottom px-2 pb-2" style={{ minWidth: 180 }}><div className="text-sm font-medium leading-snug">{o.title}</div><div className={`text-xs font-normal ${T.muted}`}>{show(o.company)}</div></th>)}</tr></thead>
          <tbody>
            {row("Score", (o) => <span className="inline-flex items-center gap-2"><ScorePill score={o.score} threshold={settings.threshold} />{offerVerdict(o, settings.threshold) && <Chip tone={offerVerdict(o, settings.threshold).tone}>{offerVerdict(o, settings.threshold).label}</Chip>}</span>)}
            {row("En bref", (o) => o.score?.tldr || o.score?.summary || <span className={T.faint}>{NC}</span>)}
            {row("Lieu · trajet", (o) => `${show(o.location)} · ${commuteLabel(o.commute)}`)}
            {row("Contrat", (o) => show(facts(o).contract || o.contract))}
            {row("Télétravail", (o) => (facts(o).remoteDays != null ? `${facts(o).remoteDays} j / semaine` : show(o.remote)))}
            {row("Salaire", (o) => show(fmtSalary(facts(o), o.salary)))}
            {row("Équipe", (o) => (facts(o).teamSize ? `${facts(o).teamSize} pers.${facts(o).reportsTo ? ` · ${facts(o).reportsTo}` : ""}` : show(facts(o).reportsTo)))}
            {row("Langues", (o) => (facts(o).languages?.length ? facts(o).languages.map((l) => LANG_FLAG[l]).join(" · ") : show(o.language && LANG_FLAG[o.language])))}
            {row("Note employeur", (o) => fmtRating(ratings[ratingKey(o.company)]) ? `★ ${fmtRating(ratings[ratingKey(o.company)])}` : <span className={T.faint}>{NC}</span>)}
            {crits.map((c) => row(c, (o) => { const b = (o.score?.breakdown || []).find((x) => x.criterion === c); return b ? <div><MatchBar value={b.match} kind={b.kind} /><div className={`text-xs mt-1 ${T.muted}`}>{b.note || b.match}</div></div> : <span className={T.faint}>—</span>; }))}
            {row("Points forts", (o) => <ul className="space-y-1">{(o.score?.strengths || []).slice(0, 4).map((x, i) => <li key={i}>+ {x}</li>)}</ul>)}
            {row("Écarts", (o) => <ul className="space-y-1">{(o.score?.gaps || []).slice(0, 4).map((x, i) => <li key={i}>− {x}</li>)}</ul>)}
            {row("Alertes", (o) => (o.score?.redFlags?.length ? <span className="text-rose-600">{o.score.redFlags.map((r) => r.evidence).join(" · ")}</span> : <span className={T.faint}>aucune</span>))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

/* ── Onglet E-mails d'une candidature ── */
function EmailsPanel({ app }) {
  const T = useT();
  const { checkReplies, busy, settings } = useApp();
  const list = [...(app.emails || [])].sort((a, b) => new Date(b.date || b.at) - new Date(a.date || a.at));
  const silent = silenceDays(app);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs ${T.faint}`}>Gmail vérifié {relTime(settings.lastReplyCheckAt)} · lecture seule</span>
        <Btn size="sm" icon={MailCheck} loading={busy.replies} onClick={() => checkReplies()}>Vérifier maintenant</Btn>
      </div>
      {silent !== null && silent >= (settings.ghostDays || 21) && <Notice tone="warn" icon={Clock}>Sans nouvelles depuis {silent} jours. Relancez une dernière fois ou clôturez avec l'issue « Sans réponse ».</Notice>}
      {!list.length ? <Empty icon={Mail} title="Aucun e-mail rattaché" text="Les réponses validées depuis la surveillance Gmail apparaissent ici, avec un lien vers le fil." /> : (
        <ul className="space-y-2">
          {list.map((m) => (
            <li key={m.id} className={`rounded-2xl p-4 ${T.sub}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={m.kind === "refus" ? "danger" : ["invitation_entretien", "offre", "confirmation_candidature"].includes(m.kind) ? "ok" : "neutral"}>{REPLY_KINDS[m.kind] || "E-mail"}</Chip>
                <span className={`text-xs ${T.muted}`}>{m.date ? fmtDate(m.date) : NC} · {show(m.from)}</span>
              </div>
              <div className="text-sm mt-2">« {m.subject} »</div>
              {m.summary && <div className={`text-sm mt-1 ${T.muted}`}>{m.summary}</div>}
              {gmailLink(m) && <div className="mt-2"><ExtLink href={gmailLink(m)}>Ouvrir dans Gmail</ExtLink></div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Entraînement à l'entretien (évaluation de réponses écrites) ── */
function PracticePanel({ app, offer }) {
  const T = useT();
  const { evaluatePractice, busy } = useApp();
  const qs = (app.prep?.likelyQuestions || []).map((x) => x.question).filter(Boolean);
  const [q, setQ] = useState(qs[0] || "");
  const [a, setA] = useState("");
  const loading = busy[`practice:${app.id}`];
  const hist = [...(app.practice || [])].reverse();
  const words = a.split(/\s+/).filter(Boolean).length;
  return (
    <section className="space-y-4">
      <SectionTitle>Entraînement</SectionTitle>
      <p className={`text-xs ${T.muted}`}>Répondez par écrit comme à l'oral. L'IA note la réponse, vérifie la structure STAR et propose une version améliorée sans inventer de faits.</p>
      {qs.length > 0 && (
        <Select value={qs.includes(q) ? q : ""} onChange={(e) => setQ(e.target.value)} className="w-full" aria-label="Question probable">
          <option value="">Question personnalisée…</option>
          {qs.map((x) => <option key={x} value={x}>{x}</option>)}
        </Select>
      )}
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Question d'entretien" aria-label="Question" />
      <Textarea rows={6} value={a} onChange={(e) => setA(e.target.value)} placeholder="Votre réponse…" aria-label="Votre réponse" />
      <div className="flex flex-wrap items-center gap-3">
        <Btn variant="primary" icon={Sparkles} loading={loading} disabled={!q.trim() || words < 15} onClick={async () => { if (await evaluatePractice(app.id, q.trim(), a.trim())) setA(""); }}>Évaluer ma réponse</Btn>
        <span className={`text-xs tabular-nums ${T.faint}`}>{words} mots · ~{Math.round((words / 130) * 60)} s à l'oral</span>
      </div>
      {hist.map((p) => (
        <div key={p.id} className={`rounded-2xl p-4 space-y-2 ${T.sub}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium flex-1 min-w-0">{p.question}</span>
            <Chip tone={p.feedback.score >= 4 ? "ok" : p.feedback.score >= 3 ? "warn" : "danger"}>{p.feedback.score} / 5</Chip>
          </div>
          <div className="flex flex-wrap gap-1.5">{[["situation", "S"], ["task", "T"], ["action", "A"], ["result", "R"]].map(([k, l]) => <Chip key={k} tone={p.feedback.star?.[k] ? "ok" : "neutral"}>{l}{p.feedback.star?.[k] ? " ✓" : " —"}</Chip>)}<Chip>~{p.feedback.seconds} s</Chip></div>
          {p.feedback.strengths.length > 0 && <ul className="text-sm space-y-0.5">{p.feedback.strengths.map((x, i) => <li key={i}>+ {x}</li>)}</ul>}
          {p.feedback.improvements.length > 0 && <ul className={`text-sm space-y-0.5 ${T.muted}`}>{p.feedback.improvements.map((x, i) => <li key={i}>→ {x}</li>)}</ul>}
          {p.feedback.improved && (
            <details className="text-sm">
              <summary className={`cursor-pointer text-xs ${T.accentText}`}>Version améliorée</summary>
              <p className="mt-2 whitespace-pre-line">{p.feedback.improved}</p>
              <CopyBtn text={p.feedback.improved} />
            </details>
          )}
          <div className={`text-xs ${T.faint}`}>{fmtDate(p.at, { time: true })}</div>
        </div>
      ))}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   14. ASSISTANT CANDIDATURE
   ════════════════════════════════════════════════════════════════════════ */

function AssistantView() {
  const T = useT();
  const { apps, offers, settings, media, openApp, openStudio, openExport, addToPipeline, go } = useApp();
  const active = apps.filter((a) => ["new", "retained", "prep", "sent", "followup", "interview"].includes(a.stage));
  const candidates = offers.filter((o) => o.status === "new" && o.score?.value >= settings.threshold).sort((a, b) => b.score.value - a.score.value).slice(0, 6);
  const offerOf = (a) => offers.find((o) => o.id === a.offerId);
  const def = settings.designDefault ? TEMPLATE_BY_ID[settings.designDefault.template]?.label || "personnalisé" : "Classique ATS";
  return (
    <div>
      <PageHeader title="Assistant candidature" subtitle="L'IA rédige, vous mettez en forme dans le Studio et vous validez. Aucun document n'est envoyé en votre nom." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-2">
          <SectionTitle>Dossiers en cours</SectionTitle>
          {active.length === 0 ? (
            <Empty icon={Sparkles} title="Rien en préparation" text="Retenez une offre pour générer son dossier." action={<Btn onClick={() => go("offers")}>Voir les offres</Btn>} />
          ) : (
            <ul className="space-y-2">
              {active.map((a) => {
                const o = offerOf(a);
                const cvL = docLangs(a, o, "cv"), lL = docLangs(a, o, "letter");
                const lang = cvL.includes(a.docLanguage) ? a.docLanguage : cvL[0];
                const cv = lang ? latestDoc(a, o, "cv", lang) : null;
                const design = resolveDesign(a, settings, cv?.accent);
                const q = cv ? docQuality(cv.text, { kind: "cv", lang, keywords: cv.keywords, kwLang: o?.language, design }) : null;
                return (
                  <li key={a.id} className={`flex flex-wrap items-center gap-4 rounded-2xl p-3 ${T.sub}`}>
                    {cv ? <button type="button" onClick={() => openStudio(a.id, "cv")} className={`rounded-lg ${T.ring}`} aria-label="Ouvrir le CV dans le Studio"><DocThumb text={cv.text} kind="cv" design={design} photo={media.photo} lang={lang} width={56} /></button>
                      : <span className={`rounded-lg flex items-center justify-center ${T.surface}`} style={{ width: 56, height: 79 }}><FileText className={`w-5 h-5 ${T.faint}`} aria-hidden="true" /></span>}
                    <div className="flex-1 min-w-48">
                      <div className="text-sm font-medium">{o?.title}{a.demo && <Chip className="ml-2">exemple</Chip>}</div>
                      <div className={`text-xs ${T.muted}`}>{show(o?.company)} · {STAGE_LABEL[a.stage]}</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {cvL.length > 0 && <Chip>CV {cvL.map((l) => LANG_FLAG[l]).join(" ")}</Chip>}
                        {lL.length > 0 && <Chip>Lettre {lL.map((l) => LANG_FLAG[l]).join(" ")}</Chip>}
                        {q && <Chip tone={q.score >= 85 ? "ok" : q.score >= 65 ? "warn" : "danger"}>qualité {q.score}</Chip>}
                        {!cvL.length && !lL.length && <Chip tone="warn">dossier à générer</Chip>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {cvL.length || lL.length ? <>
                        <Btn size="sm" variant="primary" icon={Palette} onClick={() => openStudio(a.id, cvL.length ? "cv" : "letter")}>Studio</Btn>
                        <Btn size="sm" icon={FileDown} onClick={() => openExport(a.id)}>Exporter</Btn>
                      </> : <Btn size="sm" variant="primary" icon={Sparkles} onClick={() => openApp(a.id, "docs")}>Préparer</Btn>}
                      <Btn size="sm" variant="ghost" onClick={() => openApp(a.id, "docs")}>Dossier</Btn>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card className="p-6">
          <SectionTitle>Studio & export</SectionTitle>
          <ul className="space-y-3 text-sm">
            {[
              [true, "7 modèles réglables en direct : polices, tailles, marges, bord à bord, couleurs, traits, puces, colonnes"],
              [true, "Photo recadrée (cercle, arrondi, carré, hexagone), icônes, sections déplaçables entre colonnes"],
              [true, "Clic sur un bloc de l'aperçu pour l'éditer sur place ; annuler / rétablir"],
              [true, "Traduction FR / NL / EN / DE ; export PDF ou Word, séparé ou fusionné"],
              [true, "Score qualité local et correspondance aux mots-clés de l'annonce"],
              [false, "Envoyer, soumettre un formulaire ou inventer un chiffre : jamais"],
            ].map(([ok, t]) => (
              <li key={t} className="flex gap-2">{ok ? <Check className={`w-4 h-4 mt-0.5 shrink-0 ${T.accentText}`} aria-label="Oui" /> : <X className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" aria-label="Non" />}<span>{t}</span></li>
            ))}
          </ul>
          <p className={`text-xs mt-4 ${T.faint}`}>Style par défaut des nouveaux dossiers : {def}. Il se change depuis le Studio (« Style par défaut »).</p>
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
  const { settings, setSettings, exportPayload, importPayload, resetAll, clearDemo, loadDemo, hasDemo, toast, offers, apps, contacts, compactOffers, media } = useApp();
  const [usage, setUsage] = useState(() => ({ ...USAGE }));
  useEffect(() => { usageListeners.add(setUsage); return () => usageListeners.delete(setUsage); }, []);
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
      const tiers = ["deep", "balanced", "fast"];
      const res = [];
      for (const tier of tiers) {
        const r = await callClaude(settings, { system: "Réponds uniquement {\"ok\":true}.", prompt: "Test de connexion.", maxTokens: 400, tier, effort: "low" });
        res.push(`${TIER_LABEL[tier]} : ${r.model}`);
        if (RT.mode === "published") break;
      }
      setTest({ state: "ok", text: `API joignable · ${res.join(" · ")}` });
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
              <li>• Votre photo reste dans cet espace : elle n'est jamais envoyée à l'IA, seulement intégrée aux PDF et Word que vous exportez.</li>
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
          <SectionTitle className="mt-6">Surveillance du pipeline</SectionTitle>
          <Toggle checked={settings.autoReplies} onChange={(v) => set("autoReplies", v)} label="Vérifier Gmail à l'ouverture" description="Réponses, accusés ATS, invitations, refus et candidatures non suivies. Lecture seule, tout est soumis à validation." />
          <div className="grid grid-cols-2 gap-3 mt-2">
            <Field label="Intervalle minimum">
              <Select value={settings.autoRepliesHours} onChange={(e) => set("autoRepliesHours", Number(e.target.value))} className="w-full">
                {[6, 12, 24, 48].map((h) => <option key={h} value={h}>{h} h</option>)}
              </Select>
            </Field>
            <Field label="Silence avant alerte (jours)"><Input type="number" min={7} max={60} value={settings.ghostDays} onChange={(e) => set("ghostDays", clamp(Number(e.target.value) || 21, 7, 60))} /></Field>
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
            <Field label="Profond (scoring, CV, web)"><Input value={settings.model} onChange={(e) => set("model", e.target.value.trim())} /></Field>
            <Field label="Repli du profond"><Input value={settings.fallbackModel} onChange={(e) => set("fallbackModel", e.target.value.trim())} /></Field>
            <Field label="Équilibré (traduction, Gmail)"><Input value={settings.modelBalanced} onChange={(e) => set("modelBalanced", e.target.value.trim())} /></Field>
            <Field label="Rapide (tri, synonymes)"><Input value={settings.modelFast} onChange={(e) => set("modelFast", e.target.value.trim())} /></Field>
          </div>
          <Toggle checked={settings.routing !== false} onChange={(v) => set("routing", v)} label="Routage par tâche" description="Chaque tâche va au modèle le moins cher qui la réussit. Désactivé : tout passe par le modèle profond." />
          <Toggle checked={settings.promptCache !== false} onChange={(v) => set("promptCache", v)} label="Cache de prompt" description="Profil et critères relus en cache entre les lots de scoring (environ 5 % du prix)." />
          <Toggle checked={settings.effortTuning !== false} onChange={(v) => set("effortTuning", v)} label="Effort adapté" description="Raisonnement court sur les tâches simples : plus rapide, moins de tokens." />
          {usage.calls > 0 && (
            <div className={`rounded-2xl p-4 text-xs mt-2 space-y-1 ${T.sub}`}>
              <div className="font-medium text-sm">Consommation de la session</div>
              <div>{usage.calls} appel(s) · {Math.round((usage.input + usage.cacheRead + usage.cacheWrite) / 1000)} k tokens en entrée (dont {Math.round((usage.cacheRead / Math.max(1, usage.input + usage.cacheRead + usage.cacheWrite)) * 100)} % lus en cache) · {Math.round(usage.output / 1000)} k en sortie</div>
              <div className={T.muted}>{Object.entries(usage.byTier).map(([t, u]) => `${TIER_LABEL[t] || t} : ${u.calls} appel(s)`).join(" · ")}</div>
            </div>
          )}
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
            <Btn variant="ghost" icon={Archive} onClick={() => compactOffers(90)}>Alléger les offres écartées (+ 90 j)</Btn>
            {media.photo && <span className={`self-center text-xs ${T.faint}`}>Photo : ~{Math.round((media.photo.src.length + (media.photo.original || "").length) / 1370)} Ko</span>}
          </div>
          <div className={`mt-3 flex flex-wrap gap-2`}>
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
