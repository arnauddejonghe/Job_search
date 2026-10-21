# Radar — veille emploi & pilotage de candidatures

Artefact React en un seul fichier : [`radar-emploi.jsx`](radar-emploi.jsx).
L'IA collecte, score et prépare ; vous validez tout ce qui sort en votre nom.

Audit, benchmark, solutions et arbitrages de la version 3 : [`docs/AUDIT-v3.md`](docs/AUDIT-v3.md).

## Nouveautés v3

| Domaine | Ce qui change |
|---|---|
| **Studio CV & lettre** | Éditeur plein écran : contenu, structure et qualité à gauche, pages A4 au centre, design à droite. 7 modèles (Classique ATS, Moderne, Exécutif, Minimal, Compact, Créatif, Élégant) réglables en direct : polices des titres et du texte, taille, interligne, taille du nom et des titres, casse et espacement des lettres, marges par côté, fond de colonne et bandeau **bord à bord**, espacements, couleurs (accent, texte, filets, colonne, bandeau), style et **épaisseur des traits**, puces, **icônes** des coordonnées et des sections, dates à droite, compétences en étiquettes, une ou deux colonnes, format A4 ou Letter. |
| **Édition directe** | Clic sur un bloc de l'aperçu pour l'éditer sur place (déplacer, dupliquer, supprimer). Survol d'une section : monter, descendre, **changer de colonne**, masquer. Glisser-déposer des sections dans l'onglet Structure. Annuler / rétablir (Ctrl+Z, Ctrl+Maj+Z), Ctrl+S. |
| **Photo** | Import, recadrage (glisser, zoom, rotation), formes cercle, arrondi, carré et hexagone, bordure (épaisseur, couleur), taille, position (en-tête ou colonne). Stockée localement, jamais envoyée à l'IA. |
| **Ce que l'on voit est ce qui part** | Un seul moteur de mise en page (positions en mm) produit l'aperçu SVG, le **PDF vectoriel** (texte sélectionnable, lisible par les ATS) et le **Word .docx natif** (styles Titre 1 / Titre 2, colonnes en tableau, photo dans sa forme). |
| **Multilingue** | Traduction des CV et lettres en **FR / NL / EN / DE** (structure, faits et chiffres conservés, formules belges). Une version par langue, éditable dans le Studio. |
| **Export** | Documents × langues × formats (PDF, Word, ou les deux). Regroupement : un fichier par langue (CV + lettre), **tout fusionné** en un seul fichier (signets PDF), ou fichiers séparés livrés en **ZIP**. Word « fidèle au design » ou « ATS 1 colonne ». Les traductions manquantes sont générées à la demande. |
| **Qualité** | Score local, sans token : coordonnées, accroche, quantification, verbes d'action, clichés FR/NL/EN/DE, première personne, longueur, dates, sections, éléments à compléter, lisibilité, photo et anglais, correspondance aux mots-clés de l'annonce (mots entiers). |
| **Pipeline et Gmail** | Vérification **automatique à l'ouverture** (intervalle réglable) et bouton « Vérifier maintenant » dans le pipeline. Recherche **incrémentale** depuis la dernière vérification, requête Gmail construite par l'application (entreprises suivies, contacts, expéditeurs ATS). Détecte réponses, **accusés de réception des ATS** et de LinkedIn ou Indeed (la candidature passe en « Envoyée » à la vraie date), invitations, tests, offres, refus, et les **candidatures envoyées hors de Radar** (ajout au pipeline en un clic). Les e-mails en attente restent dans une boîte à valider. Onglet « E-mails » par candidature avec lien vers le fil Gmail, badges sur les cartes, alerte **« sans nouvelles depuis N jours »** et issue « Sans réponse ». |
| **Clarté des offres** | Fiche « décision d'abord » : verdict calculé (Postuler, À creuser, Passer), résumé en français quelle que soit la langue de l'annonce, faits normalisés (contrat, jours de télétravail, fourchette salariale, langues exigées, équipe, rattachement, séniorité), ce qui n'est pas précisé, principales forces, écarts et alertes. Onglets Analyse, Annonce (missions, exigences, atouts) et Sources. Filtre par verdict, résumé dans la liste, **comparateur** de 2 à 4 offres. |
| **Entretien** | Entraînement : réponse écrite à une question probable, note sur 5, structure STAR, forces, améliorations, réponse améliorée sans faits inventés. |
| **IA plus sobre** | Routage par tâche : profond (Opus 5.5 : scoring, CV, recherche web), équilibré (Sonnet 5.5 : traduction, Gmail, relances, entraînement), rapide (Haiku 5.5 : priorisation, synonymes, doublons, réparation JSON). Effort bas sur les tâches simples. **Cache de prompt** du profil et des critères entre les lots de scoring (premier lot seul, les suivants relisent le cache). **Re-pondération locale** : si seuls les poids des souhaits changent, aucun appel IA. Consommation de la session affichée. |
| **Correctifs** | Notes employeur incluses dans l'export, l'import et la réinitialisation ; chargement des données en parallèle ; allègement des offres écartées anciennes ; domicile du profil utilisé dans les prompts ; caractères hors Windows-1252 translittérés dans le PDF (Dvořák → Dvorak). |

## Utilisation

1. Dans claude.ai, créez un artefact React et collez le contenu de `radar-emploi.jsx`.
2. Activez les connecteurs **Gmail** et **Google Calendar** pour l'artefact (import des alertes, surveillance des réponses, brouillons, rappels).
3. Au premier lancement, des données **« exemple »** sont affichées, dont un CV et une lettre ouvrables dans le Studio. Supprimez-les dans *Confidentialité & données*.
4. Renseignez *Profil & critères* (CV collé, réalisations chiffrées), puis cliquez sur **Lancer la veille** ou utilisez `⌘K` / `Ctrl+K`.

### Deux façons de l'utiliser

| | Page publiée (lien claude.ai/artifact) | Artefact dans une conversation claude.ai |
|---|---|---|
| Sauvegarde | Espace privé de la page (capacité `db`, visible de vous seul) | `window.storage` |
| IA | Votre compte claude.ai (capacité `sample`, autorisation au premier appel ; claude.ai choisit le modèle) | API Claude depuis l'artefact, avec routage des modèles |
| Gmail / Agenda | Vos connecteurs claude.ai (capacité `mcp` : lecture Gmail, brouillons, création d'événements) | Serveurs MCP dans l'appel API |
| Téléchargements (PDF, Word, ZIP) | Capacité `downloads` | Lien de téléchargement du navigateur |
| Veille web | Par la **Routine « Radar – veille emploi »** : du lundi au vendredi à 7 h 47 et à chaque clic sur « Lancer la veille » (connecteur Claude Code Remote). Un assistant Claude cherche sur le web avec vos critères et vos sources (jamais votre profil), puis dépose les offres dans `veille_inbox` ; la page les importe et les dédoublonne | Disponible (`web_search`) |

Le même fichier détecte l'environnement au chargement.

Dans la page publiée, la base partagée contient `veille/config` (critères et sources, écrit par la page), `veille/routine` (identifiant de la Routine), `veille/status` (état de la dernière exécution) et `veille_inbox/run-*` (offres déposées, purgées après 14 jours). Vos données personnelles restent sous `data/users/<vous>/`, privé.

## Architecture

| Module | Rôle |
|---|---|
| Profil & critères | Profil, CV texte, critères à 3 niveaux (indispensables, souhaités pondérés 1-5, exclusions), signaux d'alerte, mots-clés FR/NL/EN. Critères **versionnés** : diff entre versions, restauration, veille relancée avec une ancienne version. Un changement de poids seul est recalculé localement. |
| Sources & collecte | 15 sources pré-configurées (jobs boards, services publics, cabinets) et 44 grands employeurs belges, entreprises cibles, import des alertes Gmail, import manuel (URL ou texte), import d'offres JSON. Normalisation, dédoublonnage local et **détection IA des doublons** avec fusion validée et annulable, horodatage par source. |
| Scoring IA | Score 0-100, décomposition par critère, points forts, écarts, questions, drapeaux rouges avec preuve textuelle, niveau de confiance, résumé en français, faits normalisés, exigences et missions. Plafonds appliqués côté client (indispensable manquant ≤ 45, exclusion ≤ 20). Verdict calculé localement. |
| Vue d'ensemble | KPIs, « À faire aujourd'hui » (relances dues, entretiens, e-mails à valider, candidatures sans nouvelles ; repriorisable par l'IA), meilleures offres, entonnoir, volume par source, score moyen par semaine. |
| Offres | Liste filtrable (verdict, score, trajet, source, statut), tri rapide au clavier, fiche « décision d'abord » à onglets, notes employeur, comparateur. |
| Pipeline | Kanban en 8 colonnes, glisser-déposer, clôture avec issue (dont « Sans réponse ») et motif, journal horodaté, **surveillance Gmail** et signaux e-mail sur les cartes. |
| Assistant candidature & **Studio** | CV et lettre mis en page (Studio), message LinkedIn (≤ 300 caractères), réponses au formulaire, e-mail → brouillon Gmail. Chaque document est éditable, régénérable avec consigne, versionné par langue, traduisible et exportable. |
| Relances & agenda | Règles J+7 / J+14 après envoi et J+2 après entretien (paramétrables). Rédaction IA, brouillon Gmail, rappel dans l'agenda. Fiche de préparation d'entretien sourcée (web_search), STAR, questions, négociation, **entraînement**. |
| Contacts | Recruteurs, cabinets, hiring managers et réseau, liés aux candidatures (destinataires des brouillons, signaux pour la surveillance Gmail). |
| Confidentialité & données | Mode discret (aperçu + confirmation avant toute écriture Google), alerte si l'employeur actuel est cité, titres d'agenda neutres, écran masquable, routage des modèles, cache, effort, consommation, export/import JSON, allègement, réinitialisation. |

### Moteur de documents

```
balisage léger ──parseDoc──▶ blocs (lignes sources l0..l1) ──docModel──▶ en-tête + sections (clés canoniques FR/NL/EN/DE)
                                                                        │
                                       design (gabarit + réglages + ordre/colonnes/masquage)
                                                                        ▼
                                                     layoutDocument : pages, opérations en mm, zones cliquables
                                                      ├─ PageSvg  → aperçu et vignettes
                                                      ├─ buildPdf → jsPDF (Helvetica / Times / Courier, photo découpée en vectoriel, signets)
                                                      └─ buildDocx → OOXML natif (indépendant de la mise en page, même design)
```

La mesure du texte utilise le canvas avec des polices métriquement compatibles (Arial ≈ Helvetica, Times New Roman ≈ Times), ce qui fait coïncider coupures de ligne et de page entre l'aperçu et le PDF. Le .docx et le ZIP sont écrits sans bibliothèque (ZIP « stocké »).

### Modèle de données (`window.storage`, une clé par collection)

```
radar:settings  { theme, threshold, autoRescore, discreet, employerNames[], model, fallbackModel, modelBalanced, modelFast, routing, promptCache, effortTuning,
                  mcp{gmail,gcal}, restrictTools, mcpTools{…}, followUp{afterSend[], afterInterview}, autoReplies, autoRepliesHours, ghostDays,
                  lastWatchAt, lastReplyCheckAt, lastReplyWindowAt, seenUntracked[], designDefault, … }
radar:profile   { name, headline, home, summary, skills[], experiences[{role,org,period,highlights}], achievements[], languages[], education[], certifications[], cvText }
radar:criteria  { draft{…}, versions[{id,label,createdAt, roles[], zones[], maxCommute, remote, mustHave[], wishes[{label,weight}], exclusions[], redFlags[], keywords{fr,nl,en}}] }
radar:sources   [{ id, name, kind, domains[], careersUrl, enabled, lastRunAt, lastCount, lastError }]
radar:offers    [{ id, title, company, location, commute{minutes,basis}, contract, seniority, salary, remote, language, publishedAt, description, collectedAt,
                   sources[{name,url,collectedAt,via,verified}], status,
                   score{value,confidence,breakdown[],tldr,facts{contract,remoteDays,salaryMin,salaryMax,salaryPeriod,languages[],teamSize,reportsTo,seniority},
                         must[],nice[],missions[],local,…,criteriaVersionId}, demo }]
radar:apps      [{ id, offerId, stage, reached, sentAt, closed{outcome,reason}, docLanguage,
                   docs{cv|letter|linkedin|answers|email: [versions{text,lang,format,origin,accent,keywords[],tips[],…}]},
                   design{template, font, size, margin{t,r,b,l}, colors{…}, photo{show,shape,size,border,borderColor}, layout{order[],side[],hidden[]}, …},
                   emails[{date,from,subject,kind,summary,threadId}], seenReplies[], practice[{question,answer,feedback}],
                   interviews[], followUps[{kind,due,status,draft}], prep{…}, contactIds[], log[{at,type,text}], demo }]
radar:contacts  [{ id, name, role, company, type, email, linkedin, phone, notes, demo }]
radar:ratings   { <entreprise>: { rating, reviews, source, url, note, seenAt } }
radar:media     { photo: { src (JPEG recadré), original, crop{zoom,x,y,rot}, updatedAt } }
radar:inbox     { replies[…], untracked[…] }   // e-mails détectés en attente de validation
```

Les champs inconnus valent `null` et s'affichent « non communiqué ».

### Prompts internes (objet `P` dans le fichier)

Tous imposent une réponse **JSON stricte**, parsée puis réparée une fois si besoin (un second appel rapide sans outil convertit le texte en JSON).

| Prompt | Niveau | Outils | Sortie |
|---|---|---|---|
| `search` | profond | `web_search` restreint aux domaines de la source | `{offers[], notes}` |
| `gmail` | équilibré | MCP Gmail, lecture | `{offers[], messagesRead}` |
| `structure` | équilibré | `web_search` si seule une URL est fournie | `{found, offer}` |
| `scoreContext` + `score` | profond, effort moyen, **contexte en cache** | aucun (lots de 5 offres) | `{scores[{id, score, confidence, tldr, facts, must, nice, missions, breakdown[], strengths, gaps, questions, redFlags}]}` |
| `cvPro` | profond | aucun | `{language, accent, keywords, cv, letter, tips}` |
| `dossier` | équilibré | aucun | `{linkedin, answers, email}` |
| `translate` | équilibré, effort bas | aucun | `{text}` (même balisage) |
| `followUp` | équilibré, effort bas | aucun | `{subject, body}` |
| `prep` | profond | `web_search` | `{company{facts[{text,sourceUrl}]}, likelyQuestions, star, questionsToAsk, negotiation, salaryBenchmark}` |
| `practice` | équilibré | aucun | `{score, star, strengths, improvements, improved, seconds}` |
| `replies` | équilibré | MCP Gmail, lecture | `{replies[{appId, threadId, kind, proposedStage, interviewAt…}], untracked[…]}` |
| `gmailDraft`, `calendarEvent` | équilibré, effort bas | MCP (brouillon, événement) | `{created, …}` |
| `dedupe`, `keywords`, `today` | rapide, effort bas | aucun | groupes de doublons ; synonymes FR/NL/EN ; ordre de priorité |

Garde-fous : une URL d'offre absente des résultats de recherche **et** hors du domaine de la source est écartée. Un brouillon ou un événement n'est déclaré créé que si l'outil MCP a réellement été appelé. Les sources des faits d'entreprise sont vérifiées contre les résultats web. Un e-mail dont l'objet n'apparaît pas dans les e-mails réellement lus est marqué « à vérifier » ; un identifiant de fil absent des résultats est ignoré ; un e-mail déjà traité n'est jamais reproposé. Deux offres déjà présentes dans le pipeline ne sont jamais fusionnées. Si le proxy des artefacts refuse `cache_control` ou `output_config`, ces champs sont retirés pour la session, sans erreur visible.

## Automatisé, manuel, et pourquoi

**Automatisé**
- Recherche multi-sources via `web_search`, normalisation, estimation du trajet depuis le domicile, dédoublonnage et fusion des sources.
- Extraction des offres depuis les alertes e-mail Gmail.
- Scoring expliqué, faits normalisés, verdict, recalcul quand les critères changent (local si seuls les poids changent), priorisation du jour.
- Surveillance Gmail du pipeline à l'ouverture (lecture seule, incrémentale).
- Rédaction de tout le dossier, des traductions, des relances, de la fiche d'entretien et de l'évaluation des réponses d'entraînement.
- Mise en page, contrôle qualité et export PDF / Word / ZIP.
- Création de brouillons Gmail et d'événements Google Calendar, **après votre clic** (et confirmation en mode discret).

**Manuel, par conception ou par contrainte**
- **Envoi** des e-mails et des messages LinkedIn : jamais automatique. Les outils MCP exposés sont restreints à la lecture et à la création de brouillons.
- **Soumission des formulaires** sur les sites employeurs et job boards : impossible depuis l'artefact (sites tiers, authentification). L'interface fournit le lien direct et le dossier exporté.
- **Effet des e-mails détectés** : chaque réponse ou candidature non suivie est proposée avec une action (envoyée, entretien, offre, refus, ajout au pipeline) appliquée seulement après validation : une mauvaise interprétation ne doit pas clôturer une candidature.
- **LinkedIn** : pas de collecte directe (scraping interdit). Les offres arrivent par les alertes e-mail ou par import manuel du texte.
- **Accès direct aux sites d'emploi** : bloqué depuis l'artefact. La collecte dépend de l'indexation du moteur de recherche, d'où un décalage de quelques jours possible.
- **Veille planifiée** : un artefact ne tourne pas en arrière-plan. En page publiée, la Routine planifiée s'en charge ; dans une conversation, la veille se lance à la main ou à l'ouverture.
- **Temps de trajet** : ordre de grandeur (table locale ou estimation IA), pas un calcul d'itinéraire.

## Historique

**Version 2** : veille sans intervention (lancement à l'ouverture, import JSON), déduplication sémantique assistée par l'IA, suivi des réponses dans Gmail.

**Version 3** : Studio CV & lettre, photo, export PDF / Word multilingue et fusionné, score qualité, surveillance Gmail automatique et incrémentale, clarté des offres et comparateur, entraînement à l'entretien, routage des modèles, cache et re-pondération locale (détail dans [`docs/AUDIT-v3.md`](docs/AUDIT-v3.md)).

## Prochaines améliorations envisagées

1. **Calibration du scoring** à partir de vos décisions (offres retenues ou écartées) : proposition d'ajustement des poids, versionnée.
2. **Statistiques par source et par critère** : taux de réponse, score moyen et délai de réponse par source, pour concentrer la veille sur ce qui rapporte.
3. **Polices intégrées au PDF** (Inter, Roboto…) si l'environnement autorise leur téléchargement, et interface multilingue si l'outil est partagé.
