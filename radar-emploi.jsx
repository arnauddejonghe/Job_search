/**
 * Radar — plateforme personnelle de veille emploi & pilotage de candidatures.
 * Artefact React (fichier unique) · Tailwind (classes de base) · lucide-react · recharts.
 * Persistance : window.storage (jamais localStorage).
 * IA : API Claude appelée depuis l'artefact (web_search + serveurs MCP Gmail / Google Calendar).
 * Principe : l'IA prépare, l'utilisateur valide. Rien n'est envoyé sans action explicite.
 */
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useContext, createContext } from "react";
import {
  LayoutDashboard, Briefcase, Columns, Sparkles, BellRing, Users, Radio, User, ShieldCheck, Search,
  Command, Play, Loader2, Plus, X, ChevronRight, ChevronsLeft, ChevronsRight, ExternalLink, Mail,
  CalendarPlus, Copy, Check, Trash2, Download, Upload, RotateCcw, Moon, Sun, Monitor, AlertTriangle,
  Info, MapPin, Clock, List, LayoutList, Menu, History, FileText, RefreshCw, Building2, Inbox,
  Clipboard, Wand2, Flag, HelpCircle, Eye, EyeOff, Save, Target, Gauge, ArrowRight, CheckCircle2, Linkedin, TrendingUp, Pencil, Phone, GitMerge, Undo2, MailCheck, Star, Palette, ChevronLeft,
  Maximize2, Minimize2, Redo2, ArrowUp, ArrowDown, Lightbulb, SlidersHorizontal, Circle, Minus,
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
  if (missingKw.length) {
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
  const emp = mentionsEmployer(text, ctx.employerNames);
  if (emp.length) add("warn", "fiabilite", "employer", `Employeur actuel cité (${emp.join(", ")})`, "Vous êtes en poste : vérifiez que c'est voulu avant diffusion.", { sec: findSec((h, i) => mentionsEmployer(o.sections[i].lines.join("\n"), ctx.employerNames).length > 0) });

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

  let impact = 70, read = 100;
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
      if (titleForms.length && !titleIn(secHay[prof])) add("warn", "ats", "prof-title", "L'intitulé exact du poste n'apparaît pas dans le profil", `Citez « ${ctx.jobTitle} » comme objectif (« … en tant que ${ctx.jobTitle} ») : les ATS comparent l'intitulé.`, { sec: prof, autoFix: true });
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
    else if (titleForms.length && !titleIn(hayOf(subj))) add("warn", "ats", "subject-title", "L'objet ne reprend pas l'intitulé exact du poste", `Reprenez « ${ctx.jobTitle} ».`, { sec: o.sections.findIndex((s) => s.title === subj), autoFix: true });
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
    const je = lang === "fr" ? (bodyText.match(/(^|[.!?]\s+)(je |j'|j’)/gi) || []).length : lang === "en" ? (bodyText.match(/(^|[.!?]\s+)I /g) || []).length : (bodyText.match(/(^|[.!?]\s+)ik /gi) || []).length;
    if (je > 4) add("info", "style", "je", `${je} phrases commencent par « ${lang === "en" ? "I" : lang === "nl" ? "Ik" : "Je"} »`, "Variez les débuts de phrase (le poste, l'entreprise, un résultat).", { autoFix: true });
    const nums = /\d/.test(bodyText.replace(/\b(19|20)\d{2}\b/g, ""));
    if (!nums) add("info", "impact", "nums", "Aucun résultat chiffré dans la lettre", "Une preuve chiffrée rend la candidature crédible.");
    impact = 100 - (companyIn ? 0 : 25) - (cta ? 0 : 10) - (nums ? 0 : 15) - (subj && (!titleForms.length || titleIn(hayOf(subj))) ? 0 : 15) - Math.max(0, je - 4) * 4 - cl.length * 8;
    if (words < 220) { add("info", "format", "short", `Lettre courte (${words} mots)`, "Visez 260 à 340 mots."); read -= 10; }
    if (words > 420) { add("warn", "format", "long", `Lettre longue (${words} mots)`, "Une page maximum : visez 260 à 340 mots."); read -= 15; }
    if (pages && pages > 1) { add("warn", "format", "pages", `La lettre tient sur ${pages} pages`, "Une page maximum."); read -= 20; }
  }
  read -= reps.length * 4;
  if (!o.contact) read -= 20;
  const ats = kwPct === null ? (titleFound === null ? null : titleFound ? 80 : 50) : Math.round(0.78 * kwPct + (titleFound === false ? 0 : 22));
  const sc = (n) => (n === null ? null : clamp(Math.round(n), 0, 100));
  const scores = { ats: sc(ats), impact: sc(impact), read: sc(read) };
  const parts = [[scores.ats, 0.4], [scores.impact, 0.35], [scores.read, 0.25]].filter(([v]) => v !== null);
  let total = Math.round(parts.reduce((n, [v, w]) => n + v * w, 0) / parts.reduce((n, [, w]) => n + w, 0));
  const blockers = issues.filter((i) => i.level === "block").length;
  if (blockers) total = Math.min(total, 69);
  issues.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  return { kind, issues, kw, kwPct, titleFound, scores: { ...scores, total }, words, blockers };
}

/* Points que la passe de correction automatique traite après génération. */
function autoFixList(rep) {
  const list = rep.issues.filter((i) => i.autoFix).map((i) => ({ title: i.title, detail: i.detail }));
  rep.kw.filter((k) => k.status !== "absent" && !k.found && k.importance >= (rep.kind === "cv" ? 2 : 3)).slice(0, rep.kind === "cv" ? 10 : 5)
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
const pdfSafe = (t) => String(t || "")
  .replace(/[\u2018\u2019\u201A\u2032]/g, "'").replace(/[\u201C\u201D\u201E\u2033]/g, '"')
  .replace(/[\u2013\u2014\u2212]/g, "-").replace(/\u2026/g, "...").replace(/\u20AC/g, "EUR")
  .replace(/\u0153/g, "oe").replace(/\u0152/g, "OE").replace(/[\u00A0\u202F\u2009]/g, " ").replace(/[\u2022\u25CF\u25AA]/g, "-")
  .replace(/[^\x00-\xFF]/g, "");

async function buildDocPdf(text, { accent, kind, title, keywords, author }) {
  const { jsPDF } = await loadJsPDF();
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: pdfSafe(title), subject: kind === "cv" ? "Curriculum vitae" : "Lettre de motivation", author: pdfSafe(author || ""), keywords: pdfSafe((keywords || []).map((k) => (typeof k === "string" ? k : k?.term)).filter(Boolean).join(", ")), creator: "Radar" });
  const A = hexRgb(accent);
  const M = 18, W = 210 - 2 * M, BOTTOM = 297 - 16;
  const cv = kind === "cv";
  let y = 18;
  const lh = (size) => size * 0.3528 * 1.38;
  const ensure = (h) => { if (y + h > BOTTOM && y > 18) { doc.addPage(); y = 18; } };
  const font = (size, style = "normal", color = [45, 45, 45]) => { doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color); };
  const nLines = (txt, size, style = "normal", indent = 0) => { font(size, style); return doc.splitTextToSize(pdfSafe(txt), W - indent).length; };
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
  /* Hauteur d'un bloc (mêmes règles que l'aperçu) : les blocs courts ne sont jamais coupés, les titres restent avec la suite. */
  const height = (b) => {
    if (!b) return 0;
    if (b.t === "para") return nLines(b.text, 10) * lh(10) + (cv ? 1.8 : 3.2);
    if (b.t === "bullet") return nLines(b.text, 10, "normal", 4.5) * lh(10) + 0.7;
    if (b.t === "kv") return nLines(`${b.label} ${b.text}`, 10) * lh(10) + 0.9;
    if (b.t === "h3") { const parts = b.text.split("|").map((x) => x.trim()).filter(Boolean); return 0.8 + nLines(parts[0] || "", 10.5, "bold") * lh(10.5) + 0.2 + (parts.length > 1 ? nLines(parts.slice(1).join("  ·  "), 9) * lh(9) + 1 : 0); }
    if (b.t === "h2") return cv ? 2.5 + lh(10.5) + 0.4 + 2.6 : 2 + nLines(b.text, 10.5, "bold") * lh(10.5) + 3;
    return lh(10) * 2;
  };
  const blocks = layoutBlocks(text, kind);
  blocks.forEach((b, i) => {
    const h = height(b);
    if (b.t === "h2" || b.t === "h3") ensure(h + Math.min(height(blocks[i + 1]), 50));
    else if (["para", "bullet", "kv"].includes(b.t) && h < 50) ensure(h);
    if (b.t === "name") write(b.text, { size: cv ? 22 : 16, style: "bold", color: A, after: 0.6 });
    else if (b.t === "quote") {
      if (cv) write(b.text, { size: 11, color: [70, 70, 70], after: 1.2 });
      else write(b.text, { size: 10, after: 0.2 });
    }
    else if (b.t === "contact") {
      write(b.text, { size: 9, color: [110, 110, 110], after: 1.6 });
      doc.setDrawColor(...A); doc.setLineWidth(0.7); doc.line(M, y, M + W, y); y += 5;
    }
    else if (b.t === "date") { y += 2; write(b.text, { size: 10, color: [90, 90, 90], align: "right", after: 3 }); }
    else if (b.t === "h2") {
      if (cv) {
        y += 2.5;
        write(b.text.toUpperCase(), { size: 10.5, style: "bold", color: A, after: 0.4 });
        doc.setDrawColor(215, 215, 215); doc.setLineWidth(0.25); doc.line(M, y, M + W, y); y += 2.6;
      } else { y += 2; write(b.text, { size: 10.5, style: "bold", color: [30, 30, 30], after: 3 }); }
    }
    else if (b.t === "h3") {
      const parts = b.text.split("|").map((x) => x.trim()).filter(Boolean);
      y += 0.8;
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
    else write(b.text, { after: cv ? 1.8 : 3.2 });
  });
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
const isStale = (offer, versionId) => !offer.score || offer.score.criteriaVersionId !== versionId;
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

const OFFER_SCHEMA = `{"title":"","company":null,"location":null,"contract":null,"seniority":null,"salary":null,"remote":null,"language":"fr|nl|en","publishedAt":"YYYY-MM-DD ou null","url":"","description":"","commuteMinutes":null}`;

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
const longDate = (lang) => new Date().toLocaleDateString({ fr: "fr-BE", nl: "nl-BE", en: "en-GB" }[lang] || "fr-BE", { day: "numeric", month: "long", year: "numeric" });
const adTextOf = (o) => String(o?.fullText || o?.description || "").trim();
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

const lintCtx = ({ offer, analysis, prefs, lang, settings, profile, pages, fallbackKeywords }) => ({
  lang, keywords: analysis?.keywords?.length ? analysis.keywords : fallbackKeywords || [],
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
Règles : aucun champ inventé (null si absent) ; ${url ? "garde l'URL fournie telle quelle" : "url = null si aucune URL n'apparaît dans le texte"} ; description = résumé factuel de 800 caractères max ; commuteMinutes = trajet voiture estimé depuis Ohain ou null.
Réponds uniquement avec ce JSON :
{"found":true,"offer":${OFFER_SCHEMA}}`;
  },

  score(offers, profile, c, versionLabel) {
    const compact = offers.map((o) => ({
      id: o.id, title: o.title, company: o.company, location: o.location,
      commuteMinutes: o.commute?.minutes ?? null, contract: o.contract, seniority: o.seniority,
      salary: o.salary, remote: o.remote, language: o.language, description: o.description,
    }));
    return `Mission : évaluer l'adéquation de chaque offre avec le profil et les critères du candidat. Sois factuel, sobre, sans complaisance.

PROFIL
${profileDigest(profile)}

CRITÈRES (version « ${versionLabel} »)
${criteriaDigest(c)}

OFFRES
${JSON.stringify(compact)}

BARÈME
- breakdown : une ligne par critère indispensable, souhaité, exclusion et signal d'alerte.
  · indispensable / souhaité : match 0-100 = degré de satisfaction.
  · exclusion / alerte : match 0-100 = degré de PRÉSENCE (100 = clairement présent dans l'annonce).
  · note : 15 mots max, factuelle, qui s'appuie sur l'annonce. Information absente → match 50 et note « non précisé ».
- score 0-100 : moyenne pondérée des souhaités, ajustée par le reste. Plafond 45 si un indispensable est clairement non rempli ; plafond 20 si une exclusion est clairement présente.
- confidence : "haute" si missions, lieu et conditions sont détaillés ; "moyenne" si partiel ; "faible" si l'annonce est pauvre (moins de ~3 phrases utiles ou champs clés absents).
- redFlags : uniquement avec une preuve textuelle courte tirée de l'annonce (type : stress, turnover, role_flou, autre).
- questions : points à clarifier avec le recruteur.

Réponds uniquement avec ce JSON :
{"scores":[{"id":"","score":0,"confidence":"haute|moyenne|faible","confidenceReason":"","summary":"2 phrases max","breakdown":[{"criterion":"","kind":"indispensable|souhaité|exclusion|alerte","weight":1,"match":0,"note":""}],"strengths":[],"gaps":[],"questions":[],"redFlags":[{"type":"stress|turnover|role_flou|autre","evidence":""}]}]}`;
  },

  dossier(offer, profile, types, instruction, analysis) {
    const lang = offer.language ? LANG_NAME[offer.language] : "celle de l'annonce (détecte-la)";
    return `Mission : préparer des documents de candidature pour l'offre ci-dessous. Le candidat relira, modifiera et validera tout : rien n'est envoyé automatiquement.

OFFRE
Intitulé : ${offer.title}
Entreprise : ${show(offer.company)}
Lieu : ${show(offer.location)}
Contrat : ${show(offer.contract)} · Télétravail : ${show(offer.remote)}
Annonce : ${adTextOf(offer).slice(0, 6000)}
URL : ${show(offer.sources?.[0]?.url)}
${analysis ? `\nANALYSE DE L'ANNONCE\n${analysisDigest(analysis)}\n` : ""}
PROFIL
${profileDigest(profile, true)}

DOCUMENTS DEMANDÉS : ${types.join(", ")}

CONSIGNES
- Langue : ${lang}.
- Ton naturel, précis, orienté résultats ; phrases courtes. Aucun cliché ni superlatif (« passionné », « dynamique », « force de proposition », « je me permets », « n'hésitez pas », « fort de », « motivé et rigoureux », « challenge »…).
- N'utilise que des faits présents dans le profil. Aucun chiffre inventé. Si un élément utile manque, écris [à compléter : …].
- Le candidat n'occupe PAS encore le poste visé : présente son poste actuel tel qu'il est, et le poste visé comme un objectif.
- Discrétion : le candidat est en poste. Désigne l'employeur actuel de façon générique (« une fédération patronale belge ») plutôt que par son nom.
- linkedin : 300 caractères maximum, adressé au recruteur ou au hiring manager, personnalisé (un élément précis de l'annonce + une preuve).
- answers : 5 à 7 questions probables du formulaire (motivation, prétentions salariales formulées sans chiffre inventé, préavis, disponibilité, télétravail, langues…) avec réponses.
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

  cvWrite(offer, profile, a, prefs, instruction) {
    const lang = LANG_NAME[docLang(offer, prefs, a)] || "celle de l'annonce";
    const contact = profileContact(profile);
    const target = a?.jobTitle || offer.title;
    const voice = prefs.voice === "je"
      ? "à la première personne (« je »), phrases courtes"
      : "sans pronom personnel, style CV (verbes sans sujet ou phrases nominales : « Pilote… », « Responsable du CRM… »)";
    return `Mission : rédiger le CV du candidat, adapté à l'offre ci-dessous et prêt à envoyer après relecture.

OFFRE
Intitulé : ${offer.title} · Entreprise : ${show(offer.company)} · Lieu : ${show(offer.location)}

ANALYSE DE L'ANNONCE (déjà confrontée au profil)
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
   c) la projection : ce qu'il veut apporter, en citant l'intitulé exact « ${target} » comme OBJECTIF (par ex. « … souhaite mettre cette expérience au service de ${show(offer.company)} en tant que ${target} »), jamais comme une fonction déjà exercée.
   Ne décris pas les missions de l'annonce comme si le candidat les exerçait déjà.
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
- Organisation actuelle : reprends exactement le libellé du profil (« ${profile.experiences?.[0]?.org || "…"} »).
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

  letterWrite(offer, profile, a, prefs, instruction) {
    const code = docLang(offer, prefs, a) || "fr";
    const target = a?.jobTitle || offer.title;
    const city = String(profile.home || "").split(/[(,]/)[0].trim() || "[à compléter : ville]";
    const dateLine = code === "fr" ? `${city}, le ${longDate("fr")}` : `${city}, ${longDate(code)}`;
    return `Mission : rédiger la lettre de motivation du candidat pour l'offre ci-dessous, prête à envoyer après relecture.

OFFRE
Intitulé : ${offer.title} · Entreprise : ${show(offer.company)} · Lieu : ${show(offer.location)}

ANALYSE DE L'ANNONCE (déjà confrontée au profil)
${analysisDigest(a, offer)}

PROFIL (seule source de faits)
Nom : ${profile.name || "[à compléter : prénom nom]"}
Coordonnées : ${profileContact(profile)}
${profileBlock(profile)}

CONSIGNES
Langue : ${LANG_NAME[code] || code}. Ton : ${DOC_TONES[prefs.tone] || DOC_TONES.sobre}. Corps de 260 à 340 mots (hors en-tête et signature) : une page.
Corps, paragraphes séparés par une ligne vide :
1. Formule d'appel seule sur sa ligne (FR : « Madame, Monsieur, » sauf destinataire nommé ; NL : « Geachte mevrouw, geachte heer, » ; EN : « Dear Hiring Manager, »).
2. Accroche (2-3 phrases) : un élément précis de l'annonce ou du contexte de l'entreprise (uniquement ce que dit l'annonce), puis qui est le candidat aujourd'hui en une phrase (fonction réelle, périmètre). Jamais « je me permets », « c'est avec un grand intérêt », « suite à votre annonce ».
3. Preuves (4-5 phrases) : 2 ou 3 exigences clés de l'annonce, chacune reliée à une réalisation concrète et chiffrée du profil.
4. Projection (2-3 phrases) : ce que le candidat apportera à ${show(offer.company)} sur les missions du poste, formulé comme une intention (« je souhaite », « je compte »), jamais comme un acquis.
5. Conclusion (1-2 phrases) : disponibilité pour un entretien, sans insistance.
6. Formule de politesse sobre adaptée à la langue (FR : « Je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées. »).
Règles :
- Cite l'entreprise par son nom au moins une fois, et l'intitulé exact « ${target} » dans l'objet et une fois dans le corps.
- Intègre naturellement 6 à 10 mots-clés « prouvés » ou « transférables », sans énumération.
- Au plus 3 phrases commençant par « Je » ; varie les débuts de phrase.
- Discrétion : le candidat est en poste ; désigne son employeur actuel de façon générique (« une fédération patronale belge »), jamais par son nom.
- Exigence non prouvée : ne la mentionne pas, sauf si une compétence voisine permet de la traiter honnêtement en une demi-phrase.
- Aucun cliché ni superlatif. Aucun fait inventé.
${instruction ? `- Consigne du candidat : ${instruction}` : ""}

FORMAT (balisage léger, une instruction par ligne)
# Prénom Nom
@ coordonnées
= ${dateLine}
> Destinataire (service recrutement, ou nom si connu)
> ${show(offer.company)}
## Objet : candidature au poste de ${target}
paragraphes séparés par une ligne vide
~ Prénom Nom

Réponds uniquement avec ce JSON :
{"letter":"<balisage>"}`;
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
Poste visé : ${analysis?.jobTitle || offer.title} chez ${show(offer.company)}
Fonction réelle actuelle du candidat : ${profile.headline || "non renseignée"}
${analysisDigest(analysis, offer)}

PROFIL (faits autorisés)
${profileBlock(profile)}

RÈGLES
- Chaque correction remplace un passage court (une ligne ou une phrase) : "before" = texte exact du document, "after" = nouvelle version, avec le même balisage en début de ligne (« - », « > », « ### »…).
- Pour ajouter un mot-clé, réécris la phrase ou la puce où le profil le démontre ; jamais de liste de mots ajoutée.
- Le candidat n'occupe pas le poste visé : la ligne sous le nom part de sa fonction réelle ; l'intitulé visé ne s'écrit que comme objectif.
- Aucun fait, chiffre ou outil absent du profil. Aucun cliché. Même langue que le document.
- Un point qui ne peut pas être corrigé honnêtement est ignoré.

Réponds uniquement avec ce JSON :
{"edits":[{"before":"","after":"","reason":"10 mots max"}]}`;
  },

  review({ kind, text, analysis, profile, offer }) {
    return `Mission : relire ${kind === "cv" ? "ce CV" : "cette lettre de motivation"} comme un recruteur exigeant qui reçoit 200 candidatures pour le poste « ${analysis?.jobTitle || offer.title} » chez ${show(offer.company)}, puis proposer des corrections ciblées.

DOCUMENT (balisage)
<<<
${text}
>>>

ANALYSE DE L'ANNONCE
${analysisDigest(analysis, offer)}

PROFIL (faits autorisés)
${profileBlock(profile)}

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

POSTE VISÉ : ${analysis?.jobTitle || offer.title} chez ${show(offer.company)}
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
    return `Propose 4 lignes de positionnement à placer sous le nom du candidat, en tête de son CV, pour sa candidature au poste « ${analysis?.jobTitle || offer.title} » chez ${show(offer.company)}.

PROFIL
${profileBlock(profile)}

ANALYSE DE L'ANNONCE
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

  today(items) {
    return `Voici les actions candidates d'une recherche d'emploi discrète (JSON). Classe-les par priorité pour aujourd'hui selon les échéances, le score des offres et l'avancement des candidatures. Pour chacune, une raison de 12 mots max. N'ajoute aucune action.
${JSON.stringify(items.map(({ id, label, detail, due }) => ({ id, label, detail, due })))}
Réponds uniquement {"ordered":[{"id":"","priority":1,"reason":""}]} (priorité 1 = urgent, 3 = peut attendre).`;
  },
};

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
    caps,
    criteriaVersionId: versionId,
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
  const [replyProposals, setReplyProposals] = useState(null);
  const [genStatus, setGenStatus] = useState({});
  const [studio, setStudio] = useState(null);
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
        for (const [name, key] of Object.entries(KEYS)) {
          if (existing && !existing.includes(key)) { out[name] = null; continue; }
          try {
            out[name] = await storage.get(key);
          } catch (e) {
            if (existing || RT.mode === "published") throw e; // lecture en échec : on n'écrase rien
            out[name] = null; // sans liste, une erreur signifie le plus souvent « clé absente »
          }
        }
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
  const setOfferAdText = (offerId, text) => {
    const t = String(text || "").trim().slice(0, 20000) || null;
    R.current.offers = R.current.offers.map((o) => (o.id === offerId ? { ...o, fullText: t } : o));
    patchOffer(offerId, { fullText: t });
  };
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
    await pool(chunk(targets, 4), 2, async (batch) => {
      try {
        const { data } = await askJSON(s, { system: SYSTEM_BASE, prompt: P.score(batch, p, ver, ver.label), maxTokens: 14000 });
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
    });
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
      const { data } = await askJSON(R.current.settings, { system: SYSTEM_BASE, prompt: P.dedupe(batch), maxTokens: 6000 });
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
    if (adText.length < 40) throw new Error("Annonce trop courte pour être analysée : collez son texte complet.");
    const sig = hashStr(`${adText}§${JSON.stringify(p)}`);
    if (!force && app.analysis?.sig === sig) return app.analysis;
    const { data } = await askJSON(s, { system: SYSTEM_BASE, prompt: P.adAnalysis(offer, adText, p), maxTokens: 9000 });
    const analysis = { ...normalizeAnalysis(data, offer), sig, createdAt: nowISO(), fromSummary: !offer.fullText, adChars: adText.length };
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
      setGen(appId, { step: 1, label: "Analyse de l'annonce et confrontation à votre profil…" });
      let analysis = null;
      try { analysis = await analyzeAd(appId); } catch (e) { toast(`Analyse de l'annonce impossible (${e.message}) : rédaction à partir de l'annonce seule.`, "warn"); }
      setGen(appId, { step: 2, label: `Rédaction ${[pro.includes("cv") && "du CV", pro.includes("letter") && "de la lettre", other.length && "des messages"].filter(Boolean).join(", ")}…` });
      const jobs = pro.map((t) => () => askJSON(s, {
        system: SYSTEM_WRITER,
        prompt: t === "cv" ? P.cvWrite(offer, p, analysis, prefs, instruction) : P.letterWrite(offer, p, analysis, prefs, instruction),
        maxTokens: 9000,
      }).then((r) => [t, r.data]));
      if (other.length) jobs.push(() => askJSON(s, { system: SYSTEM_BASE, prompt: P.dossier(offer, p, other, instruction, analysis), maxTokens: 8000 }).then((r) => ["rest", r.data]));
      const settled = await settleLimited(jobs, RT.mode === "published" ? 2 : 3);
      const failed = settled.filter((x) => x.status === "rejected").map((x) => x.reason?.message || String(x.reason));
      const got = Object.fromEntries(settled.filter((x) => x.status === "fulfilled").map((x) => x.value));
      const lang = docLang(offer, prefs, analysis);
      const drafts = {};
      for (const t of pro) {
        const raw = got[t]?.[t];
        if (typeof raw !== "string" || !raw.trim()) continue;
        const accent = t === "cv" ? cleanHex(got.cv?.accent, null) : null;
        drafts[t] = {
          text: normalizeDoc(raw, t, lang), accent,
          accentSource: accent ? str(got.cv?.accentSource) || "suggérée" : null,
          tips: t === "cv" ? (got.cv?.tips || []).map(String).filter(Boolean).slice(0, 4) : [],
        };
      }
      if (Object.keys(drafts).length) {
        setGen(appId, { step: 3, label: "Contrôle qualité et corrections ciblées…" });
        await Promise.all(Object.entries(drafts).map(async ([t, d]) => {
          const rep = analyzeDoc(d.text, t, lintCtx({ offer, analysis, prefs, lang, settings: s, profile: p }));
          const issues = autoFixList(rep);
          d.autoFixed = 0;
          if (!issues.length) return;
          try {
            const r = await askJSON(s, { system: SYSTEM_WRITER, prompt: P.fixDoc({ kind: t, text: d.text, issues, analysis, profile: p, offer }), maxTokens: 5000 });
            let txt = d.text;
            for (const e of Array.isArray(r.data?.edits) ? r.data.edits : []) {
              const nt = applyEdit(txt, e?.before, e?.after);
              if (nt !== null && nt !== txt) { txt = nt; d.autoFixed++; }
            }
            d.text = normalizeDoc(txt, t, lang);
          } catch { /* passe facultative : le document reste utilisable */ }
        }));
      }
      const versions = {};
      const meta = () => ({ id: uid("doc"), createdAt: nowISO(), origin: "IA", instruction: str(instruction), prefs, analysisSig: analysis?.sig || null });
      for (const [t, d] of Object.entries(drafts)) versions[t] = { ...meta(), text: d.text, format: "markup", language: lang, accent: d.accent, accentSource: d.accentSource, tips: d.tips, autoFixed: d.autoFixed };
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
    const args = { ...payload, analysis, profile: p, offer };
    const prompt = { review: P.review, fix: P.fixDoc, section: P.improveSection, headlines: P.headlines }[action];
    if (!prompt) throw new Error("Action inconnue.");
    const { data } = await askJSON(s, { system: SYSTEM_WRITER, prompt: prompt(args), maxTokens: action === "headlines" ? 2500 : 6000 });
    return data || {};
  });

  /* « J'ai cette compétence » : ajoutée au profil et marquée comme prouvée pour cette candidature. */
  const declareSkill = (appId, term) => {
    setProfile((p) => (p.skills.some((x) => normText(x) === normText(term)) ? p : { ...p, skills: [...p.skills, term] }));
    patchApp(appId, (a) => (a.analysis ? { ...a, analysis: { ...a.analysis, keywords: a.analysis.keywords.map((k) => (k.term === term ? { ...k, status: "prouvé", evidence: "déclarée par vous (ajoutée au profil)" } : k)) } } : a));
    toast(`« ${term} » ajouté à vos compétences`, "ok");
  };

  const saveDocVersion = (appId, type, text, subject, extra = {}) => patchApp(appId, (a) => {
    const prev = a.docs?.[type]?.slice(-1)[0];
    const { id: _i, createdAt: _c, origin: _o, instruction: _n, autoFixed: _f, ...keep } = prev || {};
    const v = { ...keep, ...extra, id: uid("doc"), text, subject, createdAt: nowISO(), origin: "édition" };
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
      if (a.stage === "retained" && !Object.keys(a.docs || {}).length) items.push({ id: `doc:${a.id}`, label: "Préparer le dossier de candidature", detail: name, weight: 2, go: () => setStudio({ appId: a.id, type: "cv" }), demo: a.demo });
      if (a.stage === "prep" && daysFromToday(a.updatedAt) <= -3) items.push({ id: `send:${a.id}`, label: "Finaliser et envoyer la candidature", detail: name, weight: 2, go: () => openApp(a.id, "docs"), demo: a.demo });
    });
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
    createGmailDraft, createCalendarEvent, calTitle, generateDocs, saveDocVersion, saveDocDraft, genStatus, runAnalysis, docAI, declareSkill,
    openStudio: (appId, type = "cv") => setStudio({ appId, type }), setOfferAdText,
    setFollowUp, draftFollowUp, completeFollowUp, addFollowUp, prepareInterview,
    saveContact, deleteContact, toggleAppContact, prioritizeToday,
    exportPayload, importPayload, resetAll, clearDemo, loadDemo, setManualOpen, setConfirm, storageState, saveState,
    openStageDialog: (appId) => setStageDialog({ appId, stage: "interview" }),
    importOffersJSON, detectDuplicates, undoMerge, checkReplies, veille,
    ratings, requestRatings, offerQueue, setOfferQueue, triageOffer, nextOfferId, setOfferSel,
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
          {studio && <DocStudio key={studio.appId} appId={studio.appId} type={studio.type} setType={(t) => setStudio((x) => ({ ...x, type: t }))} onClose={() => setStudio(null)} />}
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

const DEFAULT_FILTERS = { q: "", source: "", minScore: 0, maxCommute: 0, status: "active", sort: "score", hideOld: true };

function OffersView() {
  const T = useT();
  const { offers, settings, busy, runWatch, setManualOpen, openOffer, offerPreset, setOfferPreset, staleIds, rescoreStale, criteria, detectDuplicates, setOfferQueue, ratings, requestRatings } = useApp();
  const [f, setF] = useState(DEFAULT_FILTERS);
  const [dense, setDense] = useState(true);
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
  }, [offers, f, settings.hideOlderThan]);
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
            <Btn icon={Clipboard} onClick={() => setManualOpen(true)}>Importer une annonce</Btn>
            <Btn variant="primary" icon={Play} onClick={() => runWatch()} loading={busy.watch}>Lancer la veille</Btn>
          </>
        }
      />
      <Card className="p-4 mb-6">
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
            {list.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => openOffer(o.id)} className={`w-full flex items-center gap-4 px-3 py-3 rounded-2xl text-left transition-colors duration-150 ${T.subHover} ${T.ring}`}>
                  <ScorePill score={o.score} threshold={settings.threshold} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{o.title}</span>
                      {o.demo && <Chip>exemple</Chip>}
                      {o.score?.redFlags?.length > 0 && <Flag className="w-3.5 h-3.5 text-rose-500 shrink-0" aria-label="Drapeau rouge" />}
                      {isStale(o, vid) && o.score && !o.demo && <Chip tone="warn">score obsolète</Chip>}
                    </span>
                    <span className={`flex items-center gap-2 text-xs mt-0.5 ${T.muted}`}><span className="truncate">{show(o.company)} · {show(o.location)}</span><RatingChip company={o.company} compact /></span>
                  </span>
                  <span className={`hidden md:flex items-center gap-1 text-xs w-20 ${T.muted}`}><Clock className="w-3 h-3" aria-hidden="true" />{commuteLabel(o.commute)}</span>
                  <span className={`hidden lg:block text-xs w-32 truncate ${T.muted}`}>{o.sources?.map((s) => s.name).join(", ")}</span>
                  <span className={`hidden sm:block text-xs w-20 text-right tabular-nums ${T.faint}`}>{fmtDate(o.publishedAt || o.collectedAt)}</span>
                </button>
              </li>
            ))}
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
                    <Chip>{show(o.remote)}</Chip>
                    {o.score && <Chip tone={o.score.confidence === "faible" ? "warn" : "neutral"}>confiance {o.score.confidence}</Chip>}
                  </div>
                </div>
              </div>
              {o.score?.summary && <p className={`text-sm mt-4 ${T.muted}`}>{o.score.summary}</p>}
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
                  {s.caps?.map((c) => <Chip key={c} tone="danger">plafonné : {c}</Chip>)}
                </div>
                {s.summary && <p className="text-sm mt-2">{s.summary}</p>}
                {s.confidenceReason && <p className={`text-xs mt-1 ${T.faint}`}>{s.confidenceReason}</p>}
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
      expandable
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

const MSG_TYPES = DOC_TYPES.filter((d) => d.id !== "cv" && d.id !== "letter");

function DossierPanel({ app, offer }) {
  const { generateDocs, busy, genStatus } = useApp();
  const [type, setType] = useState("linkedin");
  const docs = app.docs || {};
  const loading = busy[`dossier:${app.id}`];
  const all = DOC_TYPES.filter((d) => docs[d.id]?.length).map((d) => {
    const v = docs[d.id].slice(-1)[0];
    return `### ${d.label}\n${v.subject ? `Objet : ${v.subject}\n` : ""}${v.format === "markup" ? docPlainText(v.text) : v.text}`;
  }).join("\n\n");
  const msgCount = MSG_TYPES.filter((d) => docs[d.id]?.length).length;
  return (
    <div className="space-y-6">
      <Notice icon={Info}>
        La soumission automatique sur le site de l'employeur n'est pas possible depuis cet artefact (formulaires tiers, authentification). Ouvrez l'annonce et joignez le CV et la lettre en PDF.{" "}
        {offer?.sources?.[0]?.url && <ExtLink href={offer.sources[0].url}>Ouvrir l'annonce</ExtLink>}
      </Notice>
      <section>
        <SectionTitle action={all ? <CopyBtn text={all} label="Copier tout le dossier" /> : null}>CV et lettre — studio plein écran</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StudioDocCard app={app} offer={offer} type="cv" />
          <StudioDocCard app={app} offer={offer} type="letter" />
        </div>
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

/* Aperçu papier : mêmes métriques que le PDF (Helvetica, tailles en points, marges en mm, pagination par blocs). */
const MM = 96 / 25.4, PT = 96 / 72;
const PAPER_FONT = { fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif', color: "#2d2d2d", fontSize: 10 * PT, lineHeight: 1.38, textAlign: "left" };
const PAGE_BODY = 263 * MM;

function Marked({ text }) {
  return String(text || "").split(/(\[à compléter[^\]]*\])/gi).map((x, i) => (/^\[à compléter/i.test(x)
    ? <mark key={i} style={{ background: "#fef3c7", color: "#92400e", borderRadius: 3 }}>{x}</mark>
    : <React.Fragment key={i}>{x}</React.Fragment>));
}

function PaperBlock({ b, kind, A }) {
  const cv = kind === "cv";
  const pad = (before, after) => ({ paddingTop: before * MM, paddingBottom: after * MM });
  const fs = (pt) => ({ fontSize: pt * PT, lineHeight: 1.38 });
  if (b.t === "name") return <div style={{ ...pad(0, 0.6), ...fs(cv ? 22 : 16), fontWeight: 700, color: A }}><Marked text={b.text} /></div>;
  if (b.t === "quote") return cv
    ? <div style={{ ...pad(0, 1.2), ...fs(11), color: "#464646" }}><Marked text={b.text} /></div>
    : <div style={{ ...pad(0, 0.2), ...fs(10) }}><Marked text={b.text} /></div>;
  if (b.t === "contact") return <div style={pad(0, 5)}><div style={{ ...fs(9), color: "#6e6e6e", paddingBottom: 1.6 * MM, borderBottom: `${0.7 * MM}px solid ${A}` }}><Marked text={b.text} /></div></div>;
  if (b.t === "date") return <div style={{ ...pad(2, 3), ...fs(10), color: "#5a5a5a", textAlign: "right" }}><Marked text={b.text} /></div>;
  if (b.t === "h2") return cv
    ? <div style={pad(2.5, 2.6)}><div style={{ ...fs(10.5), fontWeight: 700, color: A, textTransform: "uppercase", paddingBottom: 0.4 * MM, borderBottom: `${0.25 * MM}px solid #d7d7d7` }}>{b.text}</div></div>
    : <div style={{ ...pad(2, 3), ...fs(10.5), fontWeight: 700, color: "#1e1e1e" }}><Marked text={b.text} /></div>;
  if (b.t === "h3") {
    const parts = b.text.split("|").map((x) => x.trim()).filter(Boolean);
    return (
      <div style={pad(0.8, parts.length > 1 ? 1 : 0)}>
        <div style={{ ...fs(10.5), fontWeight: 700, color: "#191919", paddingBottom: 0.2 * MM }}><Marked text={parts[0]} /></div>
        {parts.length > 1 && <div style={{ ...fs(9), color: "#737373" }}><Marked text={parts.slice(1).join("  ·  ")} /></div>}
      </div>
    );
  }
  if (b.t === "bullet") return (
    <div style={{ ...pad(0, 0.7), ...fs(10), paddingLeft: 4.5 * MM, position: "relative" }}>
      <span style={{ position: "absolute", left: 0.65 * MM, top: (10 * PT * 1.38) / 2 - 0.65 * MM, width: 1.3 * MM, height: 1.3 * MM, borderRadius: 9, background: A }} />
      <Marked text={b.text} />
    </div>
  );
  if (b.t === "kv") return <div style={{ ...pad(0, 0.9), ...fs(10) }}><strong style={{ color: "#1e1e1e" }}>{b.label}</strong> <Marked text={b.text} /></div>;
  if (b.t === "sign") return <div style={{ ...pad(4, 1), ...fs(10), fontWeight: 700 }}>{b.text}</div>;
  return <div style={{ ...pad(0, cv ? 1.8 : 3.2), ...fs(10) }}><Marked text={b.text} /></div>;
}

function paginate(hs, blocks) {
  const pages = [[]];
  const KEEP = 50 * MM;
  let y = 0;
  blocks.forEach((b, i) => {
    let need = hs[i];
    if ((b.t === "h2" || b.t === "h3") && i + 1 < blocks.length) need += Math.min(hs[i + 1], KEEP);
    else if (!(["para", "bullet", "kv"].includes(b.t) && hs[i] < KEEP)) need = Math.min(hs[i], 14 * PT * 1.38);
    if (y > 0 && y + need > PAGE_BODY) { pages.push([]); y = 0; }
    pages[pages.length - 1].push(i);
    y += hs[i];
  });
  return pages;
}

function PaperPages({ text, accent, kind, zoom = 1, maxPages, onPages, onPick, activeSec }) {
  const A = cleanHex(accent);
  const blocks = useMemo(() => layoutBlocks(text, kind), [text, kind]);
  const mRef = useRef(null);
  const [layout, setLayout] = useState(null);
  const [hover, setHover] = useState(null);
  useLayoutEffect(() => {
    const el = mRef.current;
    if (!el) return;
    const p = paginate([...el.children].map((c) => c.getBoundingClientRect().height), blocks);
    setLayout({ blocks, pages: p });
    onPages?.(p.length);
  }, [blocks, A]); // eslint-disable-line react-hooks/exhaustive-deps
  /* La pagination n'est utilisée que si elle correspond aux blocs courants (sinon : une page, le temps de la mesure). */
  const pages = layout && layout.blocks === blocks ? layout.pages : null;
  const list = (pages || [blocks.map((_, i) => i)]).slice(0, maxPages || undefined);
  const W = 210 * MM, H = 297 * MM;
  return (
    <>
      <div ref={mRef} aria-hidden="true" style={{ position: "fixed", left: -20000, top: 0, width: 174 * MM, visibility: "hidden", pointerEvents: "none", ...PAPER_FONT }}>
        {blocks.map((b, i) => <PaperBlock key={i} b={b} kind={kind} A={A} />)}
      </div>
      <div className="flex flex-col items-center" style={{ gap: Math.round(28 * zoom) + 4 }}>
        {list.map((pg, pi) => (
          <div key={pi} style={{ width: W * zoom, height: H * zoom, flexShrink: 0 }}>
            <div style={{ width: W, height: H, transform: `scale(${zoom})`, transformOrigin: "top left", background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,.08), 0 18px 40px -22px rgba(0,0,0,.35)", padding: `${18 * MM}px ${18 * MM}px 0`, boxSizing: "border-box", position: "relative", overflow: "hidden", ...PAPER_FONT }}>
              {pg.map((i) => {
                const b = blocks[i];
                const on = onPick && (hover === b.sec || activeSec === b.sec);
                return (
                  <div
                    key={i}
                    onMouseEnter={onPick ? () => setHover(b.sec) : undefined}
                    onMouseLeave={onPick ? () => setHover(null) : undefined}
                    onClick={onPick ? () => onPick(b.sec) : undefined}
                    title={onPick ? "Modifier ce passage" : undefined}
                    style={{ cursor: onPick ? "pointer" : undefined, background: on ? "rgba(79,70,229,0.07)" : undefined, boxShadow: on ? "-8px 0 0 rgba(79,70,229,0.07), 8px 0 0 rgba(79,70,229,0.07)" : undefined }}
                  >
                    <PaperBlock b={b} kind={kind} A={A} />
                  </div>
                );
              })}
              {pages && pages.length > 1 && <div style={{ position: "absolute", right: 18 * MM, top: 288 * MM - 8 * PT, fontSize: 8 * PT, color: "#969696" }}>{pi + 1} / {pages.length}</div>}
            </div>
          </div>
        ))}
      </div>
    </>
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

function SectionCard({ s, idx, count, kind, onChange, onMove, onRemove, onAI, aiBusy, proposal, onAccept, onReject, flash, missingCount }) {
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
            {AI_GOALS.map(([g, l]) => (
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
        <FieldBox label="Objet" hint="Reprenez l'intitulé exact du poste.">
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
        <ScoreBar label="Mots-clés ATS" value={report.scores.ats} hint="Couverture pondérée des mots-clés justifiables + intitulé exact" />
        <ScoreBar label={type === "cv" ? "Impact" : "Pertinence"} value={report.scores.impact} hint={type === "cv" ? "Puces chiffrées, verbes d'action, absence de clichés" : "Entreprise citée, preuves chiffrées, objet, conclusion"} />
        <ScoreBar label="Lisibilité" value={report.scores.read} hint="Longueur, pages, sections, répétitions" />
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
            { id: "ad", label: "Annonce" },
          ]}
        />
      </div>

      {tab === "checks" && (
        <div className="p-4 space-y-5">
          {fixable.length > 0 && (
            <div className={`rounded-2xl p-3 ${T.accentSoft}`}>
              <Btn variant="primary" icon={Wand2} loading={api.busyFix} onClick={() => api.fix(fixable)}>Corriger automatiquement ({fixable.length})</Btn>
              <p className="text-xs mt-2">L'IA propose des remplacements ciblés (titre, mots-clés, style) ; vous validez chacun dans l'onglet IA.</p>
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

      {tab === "ad" && (
        <div className="p-4 space-y-5">
          {analysis ? (
            <>
              <div>
                <div className={`text-xs ${T.muted}`}>Intitulé exact</div>
                <div className="text-sm font-medium">{analysis.jobTitle}</div>
                {analysis.titleVariants?.length > 0 && <div className={`text-xs ${T.faint}`}>Équivalents : {analysis.titleVariants.join(", ")}</div>}
              </div>
              {analysis.angle && <div><SectionTitle>Ce que l'employeur cherche</SectionTitle><p className="text-sm leading-relaxed">{analysis.angle}</p></div>}
              {analysis.positioning?.pitch && <div><SectionTitle>Votre proposition de valeur</SectionTitle><p className="text-sm leading-relaxed">{analysis.positioning.pitch}</p></div>}
              {analysis.requirements?.length > 0 && (
                <div>
                  <SectionTitle>Exigences clés et preuves</SectionTitle>
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
              <p className={`text-xs ${T.faint}`}>Analyse du {fmtDate(analysis.createdAt, { time: true })} · {analysis.fromSummary ? "sur un résumé de l'annonce" : `${analysis.adChars || "?"} caractères d'annonce`}</p>
            </>
          ) : <p className={`text-sm ${T.muted}`}>L'analyse extrait l'intitulé exact, 20 à 35 mots-clés ATS, les exigences clés et les preuves de votre profil. Elle pilote la rédaction et les contrôles.</p>}
          {!offer?.fullText && <Notice tone="warn" icon={AlertTriangle}>Seul un résumé de l'annonce est enregistré : collez le texte complet ci-dessous pour une analyse ATS exhaustive.</Notice>}
          <Field label="Texte complet de l'annonce" hint={`${ad.length} caractères · enregistré sur l'offre`}>
            <Textarea rows={10} value={ad} onChange={(e) => setAd(e.target.value)} onBlur={() => { if (ad.trim() !== adTextOf(offer)) setOfferAdText(offer.id, ad); }} placeholder="Collez ici l'annonce complète (missions, profil, compétences, conditions)…" />
          </Field>
          <Btn variant={analysis ? "soft" : "primary"} icon={RefreshCw} loading={busy[`analysis:${app.id}`]} onClick={async () => { if (ad.trim() !== adTextOf(offer)) setOfferAdText(offer.id, ad); await runAnalysis(app.id); }}>{analysis ? "Relancer l'analyse" : "Analyser l'annonce"}</Btn>
        </div>
      )}
    </div>
  );
}

/* ── Réglages de génération ── */
const GEN_STEPS = ["Analyse de l'annonce", "Rédaction", "Contrôle qualité"];
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

function StudioSetup({ app, offer, type, onDone, onCancel }) {
  const T = useT();
  const { generateDocs, busy, genStatus, setOfferAdText, profile, go } = useApp();
  const first = !Object.keys(app.docs || {}).length;
  const [prefs, setPrefs] = useState({ ...DEFAULT_DOC_PREFS, ...(app.docPrefs || {}) });
  const [types, setTypes] = useState(first ? DOC_TYPES.map((d) => d.id) : [type]);
  const [instruction, setInstruction] = useState("");
  const [ad, setAd] = useState(adTextOf(offer));
  const loading = !!busy[`dossier:${app.id}`];
  const toggle = (t) => setTypes((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]));
  const P2 = (k, v) => setPrefs((p) => ({ ...p, [k]: v }));
  const weakProfile = !profile.name || (profile.achievements || []).some((a) => /\[à compléter/i.test(a)) || !(profile.cvText || "").trim();
  const run = async () => {
    if (ad.trim() && ad.trim() !== adTextOf(offer)) setOfferAdText(offer.id, ad);
    const ok = await generateDocs(app.id, types, instruction.trim(), prefs);
    if (ok) onDone?.();
  };
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="p-6 lg:col-span-3 space-y-4">
          <div>
            <div className="text-lg font-medium tracking-tight">Annonce source</div>
            <p className={`text-sm mt-1 ${T.muted}`}>L'IA en extrait l'intitulé exact, 20 à 35 mots-clés ATS et les exigences clés, puis les confronte à votre profil avant d'écrire. Plus le texte est complet, meilleure est la couverture.</p>
          </div>
          {!offer?.fullText && <Notice tone="warn" icon={AlertTriangle}>Seul un résumé de l'annonce est enregistré. Collez le texte complet (missions, profil, compétences, conditions).</Notice>}
          <Textarea rows={18} value={ad} onChange={(e) => setAd(e.target.value)} onBlur={() => { if (ad.trim() && ad.trim() !== adTextOf(offer)) setOfferAdText(offer.id, ad); }} aria-label="Texte complet de l'annonce" placeholder="Collez ici l'annonce complète…" />
          <div className={`text-xs ${T.faint}`}>{ad.length} caractères{offer?.sources?.[0]?.url ? <> · <ExtLink href={offer.sources[0].url}>ouvrir l'annonce</ExtLink></> : null}</div>
        </Card>
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
                  <option value="auto">Celle de l'annonce</option><option value="fr">Français</option><option value="nl">Néerlandais</option><option value="en">Anglais</option>
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
              <Btn variant="primary" size="lg" icon={Sparkles} loading={loading} disabled={!types.length || ad.trim().length < 40} onClick={run}>{first ? "Générer le dossier" : "Générer une nouvelle version"}</Btn>
              {onCancel && !first && <Btn variant="ghost" size="lg" onClick={() => onCancel()} disabled={loading}>Annuler</Btn>}
            </div>
          </Card>
          {loading && <GenSteps st={genStatus[app.id]} />}
          {!loading && (
            <div className={`text-xs space-y-1 ${T.muted}`}>
              <div className="flex gap-2"><Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${T.accentText}`} aria-hidden="true" />Rédaction en 3 étapes : analyse de l'annonce, rédaction, contrôle qualité avec corrections ciblées.</div>
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
        <div className={`text-xs truncate ${T.muted}`}>{show(offer?.company)}</div>
      </div>
      <div className="shrink-0"><Tabs compact value={type} onChange={setType} tabs={[{ id: "cv", label: "CV" }, { id: "letter", label: "Lettre" }]} /></div>
      {children}
    </header>
  );
}

function DocStudio({ appId, type, setType, onClose }) {
  const T = useT();
  const { apps, offers } = useApp();
  const ref = useRef(null);
  const flushRef = useRef(null);
  const closeRef = useRef(null);
  closeRef.current = () => { flushRef.current?.(); onClose(); };
  useFocusTrap(true, ref, () => closeRef.current());
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
        ? <StudioWorkspace key={`${app.id}-${type}`} app={app} offer={offer} type={type} setType={setType} onClose={close} flushRef={flushRef} />
        : (
          <>
            <StudioBar offer={offer} type={type} setType={setType} onClose={close} />
            <StudioSetup app={app} offer={offer} type={type} onCancel={(leave) => { if (leave) onClose(); else setType(type === "cv" ? "letter" : "cv"); }} />
          </>
        )}
    </div>
  );
}

function StudioWorkspace({ app, offer, type, setType, onClose, flushRef }) {
  const T = useT();
  const { saveDocVersion, saveDocDraft, settings, profile, busy, docAI, toast, declareSkill, genStatus } = useApp();
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
  flushRef.current = () => { if (dirty) saveDocDraft(app.id, type, { text, accent, baseId: v.id }); };

  const save = () => {
    if (!dirty) return;
    saveDocVersion(app.id, type, text, undefined, { accent, accentSource: accent !== cleanHex(v.accent) ? "choisie" : v.accentSource, language: lang, format: "markup" });
    setRestoredAt(null);
    toast("Version enregistrée", "ok");
  };
  const discardDraft = () => { setModel(docToModel(baseline, type)); setAccent(cleanHex(v.accent)); setRestoredAt(null); saveDocDraft(app.id, type, null); };

  /* Disposition */
  const [layout, setLayout] = useState("split");
  const [pane, setPane] = useState("edit");
  const [panelOpen, setPanelOpen] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(min-width: 1536px)").matches);
  const [tab, setTab] = useState("checks");
  const showEditor = wide ? layout !== "preview" : pane === "edit";
  const showPreview = wide ? layout !== "edit" : pane === "preview";
  const showPanel = wide ? panelOpen : pane === "panel";

  /* Aperçu : zoom ajusté à la largeur */
  const [zoomMode, setZoomMode] = useState("fit");
  const [fitZoom, setFitZoom] = useState(0.8);
  const prevRef = useRef(null);
  useEffect(() => {
    const el = prevRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setFitZoom(clamp((el.clientWidth - 48) / (210 * MM), 0.3, 1.2)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [showPreview]);
  const zoom = zoomMode === "fit" ? fitZoom : Number(zoomMode);
  const [pages, setPages] = useState(null);

  /* Contrôle qualité en direct */
  const report = useMemo(
    () => analyzeDoc(text, type, lintCtx({ offer, analysis: app.analysis, prefs, lang, settings, profile, pages, fallbackKeywords: v.keywords })),
    [text, type, pages, app.analysis, prefs.voice, profile.headline, lang], // eslint-disable-line react-hooks/exhaustive-deps
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
      .filter((e) => e && typeof e.before === "string" && typeof e.after === "string" && e.before.trim() && e.before !== e.after)
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
  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const kws = (app.analysis?.keywords || v.keywords || []).map((k) => (typeof k === "string" ? k : k.term));
      const data = await buildDocPdf(text, { accent, kind: type, title: [type === "cv" ? "CV" : "Lettre de motivation", profile.name, offer?.title, offer?.company].filter(Boolean).join(" - "), keywords: kws.slice(0, 30), author: profile.name });
      const r = await saveFile(`${type === "cv" ? "CV" : "Lettre"}_${slugFile(profile.name || "candidat")}_${slugFile(offer?.company || offer?.title)}.pdf`, data, "application/pdf");
      if (r === "saved") toast(report.blockers ? "PDF prêt — attention, des points restent à corriger" : "PDF prêt", report.blockers ? "warn" : "ok");
    } catch (e) {
      toast(`PDF impossible : ${e.message}`, "danger");
    } finally { setPdfBusy(false); }
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
          {versions.map((x, i) => <option key={x.id} value={i}>v{i + 1} · {x.origin} · {fmtDate(x.createdAt, { time: true })}</option>)}
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
        {wide && <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          aria-pressed={panelOpen}
          title={panelOpen ? "Masquer le panneau d'optimisation" : "Afficher le panneau d'optimisation"}
          className={`shrink-0 inline-flex items-center gap-1.5 h-8 rounded-xl px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${panelOpen && wide ? T.accentSoft : T.btnSoft} ${T.ring}`}
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
              <label className={`inline-flex items-center gap-1.5 text-xs ${T.muted}`}>
                <Palette className="w-4 h-4" aria-hidden="true" /> Couleur
                <input type="color" value={cleanHex(accent)} onChange={(e) => setAccent(e.target.value)} aria-label="Couleur d'accent" style={{ width: 28, height: 22, border: "none", background: "transparent" }} />
              </label>
              {v.accentSource && accent === cleanHex(v.accent) && <span className={`text-xs ${T.faint}`}>({v.accentSource})</span>}
              <span className="flex-1" />
              <Chip tone={pages && pages > (type === "cv" ? 2 : 1) ? "warn" : "neutral"}>{pages || "…"} page{pages > 1 ? "s" : ""}</Chip>
              <span className={`text-xs tabular-nums ${T.faint}`}>{report.words} mots</span>
              <CopyBtn text={docPlainText(text)} label="Copier le texte" />
            </div>
            <div className="px-4 py-6">
              <PaperPages text={text} accent={accent} kind={type} zoom={zoom} onPages={setPages} onPick={goTo} activeSec={flash} />
              <p className={`text-xs text-center mt-4 ${T.faint}`}>Cliquez sur un passage pour le modifier. Aperçu fidèle au PDF (texte sélectionnable, lisible par les ATS).</p>
            </div>
          </div>
        )}

        {showPanel && (
          <aside className={`shrink-0 overflow-y-auto ${wide ? `border-l ${T.line}` : "flex-1"} ${T.app}`} style={wide ? { width: 400 } : undefined} aria-label="Optimisation du document">
            <OptimPanel app={app} offer={offer} type={type} report={report} pages={pages} text={text} api={api} />
          </aside>
        )}

        {setupOpen && (
          <div className={`absolute inset-0 z-20 flex flex-col ${T.app}`}>
            <StudioSetup app={app} offer={offer} type={type} onDone={() => setSetupOpen(false)} onCancel={(leave) => { setSetupOpen(false); if (leave) onClose(); }} />
          </div>
        )}
      </div>

      {!wide && (
        <nav className={`shrink-0 border-t px-3 py-2 flex justify-center ${T.line}`} aria-label="Vue du studio">
          <Tabs value={pane} onChange={setPane} tabs={[{ id: "edit", label: "Éditer" }, { id: "preview", label: "Aperçu" }, { id: "panel", label: "Optimiser", count: report.blockers || undefined }]} />
        </nav>
      )}
    </>
  );
}

/* Carte de document dans la fiche candidature : vignette, score, accès au studio. */
function StudioDocCard({ app, offer, type }) {
  const T = useT();
  const { openStudio, settings, profile, genStatus } = useApp();
  const versions = app.docs?.[type] || [];
  const v = versions[versions.length - 1];
  const draft = app.drafts?.[type];
  const useDraft = v && draft && draft.baseId === v.id;
  const text = useDraft ? draft.text : v?.text;
  const lang = v?.language || app.docLanguage || offer?.language || "fr";
  const rep = useMemo(
    () => (v ? analyzeDoc(text, type, lintCtx({ offer, analysis: app.analysis, prefs: { ...DEFAULT_DOC_PREFS, ...(app.docPrefs || {}) }, lang, settings, profile, fallbackKeywords: v.keywords })) : null),
    [text, app.analysis, type], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const z = 0.15;
  return (
    <Card className="p-4 flex gap-3">
      <button type="button" onClick={() => openStudio(app.id, type)} className={`shrink-0 rounded-lg overflow-hidden ${T.ring}`} aria-label={`Ouvrir ${DOC_LABEL[type]} dans le studio`} style={{ width: 210 * MM * z, height: 297 * MM * z, background: v ? "transparent" : undefined }}>
        {v ? (
          <div style={{ pointerEvents: "none" }}><PaperPages text={text} accent={useDraft ? draft.accent : v.accent} kind={type} zoom={z} maxPages={1} /></div>
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

function AssistantView() {
  const T = useT();
  const { apps, offers, settings, openApp, openStudio, addToPipeline, go } = useApp();
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
