# Radar — veille emploi & pilotage de candidatures

Artefact React en un seul fichier : [`radar-emploi.jsx`](radar-emploi.jsx).
L'IA collecte, score et prépare ; vous validez tout ce qui sort en votre nom.

## Utilisation

1. Dans claude.ai, créez un artefact React et collez le contenu de `radar-emploi.jsx`.
2. Activez les connecteurs **Gmail** et **Google Calendar** pour l'artefact (import des alertes, brouillons, rappels).
3. Au premier lancement, des données **« exemple »** sont affichées. Supprimez-les dans *Confidentialité & données*.
4. Renseignez *Profil & critères* (CV collé, réalisations chiffrées), puis cliquez sur **Lancer la veille** ou utilisez `⌘K` / `Ctrl+K`.

### Deux façons de l'utiliser

| | Page publiée (lien claude.ai/artifact) | Artefact dans une conversation claude.ai |
|---|---|---|
| Sauvegarde | Espace privé de la page (capacité `db`, visible de vous seul) | `window.storage` |
| IA | Votre compte claude.ai (capacité `sample`, autorisation au premier appel) | API Claude depuis l'artefact |
| Gmail / Agenda | Vos connecteurs claude.ai (capacité `mcp` : lecture Gmail, brouillons, création d'événements) | Serveurs MCP dans l'appel API |
| Veille web | Par la **Routine « Radar – veille emploi »** : du lundi au vendredi à 7 h 47 et à chaque clic sur « Lancer la veille » (connecteur Claude Code Remote). Un assistant Claude cherche sur le web avec vos critères et vos sources (jamais votre profil), puis dépose les offres dans `veille_inbox` ; la page les importe et les dédoublonne | Disponible (`web_search`) |

Le même fichier détecte l'environnement au chargement.

Dans la page publiée, la base partagée contient `veille/config` (critères et sources, écrit par la page), `veille/routine` (identifiant de la Routine), `veille/status` (état de la dernière exécution) et `veille_inbox/run-*` (offres déposées, purgées après 14 jours). Vos données personnelles restent sous `data/users/<vous>/`, privé.

## Architecture

| Module | Rôle |
|---|---|
| Profil & critères | Profil, CV texte, critères à 3 niveaux (indispensables, souhaités pondérés 1-5, exclusions), signaux d'alerte, mots-clés FR/NL/EN. Critères **versionnés** : diff entre versions, restauration, veille relancée avec une ancienne version. |
| Sources & collecte | 15 sources pré-configurées (jobs boards, services publics, cabinets), entreprises cibles, import des alertes Gmail, import manuel (URL ou texte), **import d'offres JSON** (veille produite ailleurs). Normalisation, dédoublonnage local (URL canonique ou entreprise + intitulé proches), **détection IA des doublons** (employeur anonymisé, intitulé traduit ou reformulé) avec fusion validée et **annulable**, horodatage par source. Option de **veille automatique à l'ouverture** si la dernière collecte est ancienne (désactivée par défaut). |
| Scoring IA | Score 0-100, décomposition par critère, points forts, écarts, questions, drapeaux rouges avec preuve textuelle, niveau de confiance. Plafonds appliqués côté client (indispensable manquant ≤ 45, exclusion ≤ 20). Recalcul automatique quand une nouvelle version de critères est enregistrée. |
| Vue d'ensemble | KPIs, « À faire aujourd'hui » (repriorisable par l'IA), meilleures offres, entonnoir, volume par source, score moyen par semaine. |
| Pipeline | Kanban en 8 colonnes, glisser-déposer (ou sélecteur d'étape au clavier), clôture avec issue et motif, journal horodaté. |
| Assistant candidature | **Studio CV & lettre plein écran** (voir ci-dessous), message LinkedIn (≤ 300 caractères), réponses au formulaire, e-mail → brouillon Gmail. Chaque document est éditable, régénérable (avec consigne) et versionné. |
| Relances & agenda | Règles J+7 / J+14 après envoi et J+2 après entretien (paramétrables). Rédaction IA, brouillon Gmail, rappel dans l'agenda. **Détection des réponses des recruteurs dans Gmail** (lecture seule) : chaque réponse est proposée avec une action (journal, entretien, offre, refus) à valider ; les relances devenues inutiles sont annulées. Fiche de préparation d'entretien sourcée (web_search), STAR, questions, négociation. |
| Contacts | Recruteurs, cabinets, hiring managers et réseau, liés aux candidatures (destinataires des brouillons). |
| Confidentialité & données | Mode discret (aperçu + confirmation avant toute écriture Google), alerte si l'employeur actuel est cité, titres d'agenda neutres, écran masquable, export/import JSON, réinitialisation. |

### Studio CV & lettre

Ouvert depuis la fiche candidature (onglet *Dossier*), l'Assistant, la palette `⌘K` ou « À faire aujourd'hui ». Il occupe tout l'écran.

| Zone | Rôle |
|---|---|
| Éditeur structuré | En-tête (nom, **ligne de positionnement** sous le nom, coordonnées ; destinataire, lieu et date pour la lettre), puis une carte par section : paragraphes, puces, postes (Fonction · Organisation · Lieu · Période + puces), libellés (« Compétences : … »). Entrée crée la puce suivante, un collage multiligne est découpé, outils flottants pour monter / descendre / supprimer. Sections ajoutables (Profil, Réalisations clés, Certifications…). |
| Aperçu A4 | Mêmes métriques que le PDF (Helvetica, tailles en points, marges en mm, pagination par blocs sans titre orphelin). Nombre de pages en direct, zoom, couleur d'accent. Un clic sur un passage ouvre la section correspondante dans l'éditeur. Les « [à compléter] » sont surlignés. |
| Optimisation | Score /100 (mots-clés ATS, impact ou pertinence, lisibilité) et statut « prêt à envoyer ». **Contrôles** instantanés et sans IA : titre sous le nom qui annonce le poste visé, profil rédigé comme si le poste était déjà occupé, intitulé exact absent, pronoms, clichés, affirmations non prouvées, puces sans chiffre ou à formule faible, répétitions, longueur, pages, sections manquantes, coordonnées, employeur actuel cité ; pour la lettre : objet, entreprise citée, demande d'entretien, phrases en « Je ». **Mots-clés** : couverture pondérée par importance, variantes tolérées (pluriel, accents, tirets, acronymes), section où chaque terme apparaît, « Intégrer » ou « Je l'ai » (ajout au profil). **IA** : relecture recruteur et corrections ciblées présentées en avant / après, appliquées une à une ou toutes. **Annonce** : texte complet modifiable et analyse (exigences, preuves, écarts). |
| Versions | Brouillon enregistré automatiquement (rien n'est perdu en fermant), annuler / rétablir, `⌘S` pour enregistrer une version, régénération avec réglages (langue, ton, profil avec ou sans « je », 1 ou 2 pages, consigne). |

Mise en page : *Édition*, *Côte à côte* ou *Aperçu* ; le panneau d'optimisation s'ouvre depuis le score dans la barre. Sur mobile, trois onglets (Éditer, Aperçu, Optimiser).

**Sans offre : candidature spontanée ou CV de base**

Bouton « CV ou lettre sans offre » (Assistant), « Candidature spontanée » (Pipeline) ou `⌘K`. On part d'un **rôle visé** :
- *Candidature spontanée* : entreprise ciblée, site, interlocuteur et contexte facultatifs (« pourquoi cette entreprise », seule source de faits sur elle). Elle entre dans le pipeline (étape « En préparation », badge « spontanée ») avec relances et contacts. Documents par défaut : CV, lettre, message LinkedIn, e-mail.
- *CV de base* : aucun employeur cité, document réutilisable (cabinet, LinkedIn, point de départ). Rangé dans l'Assistant, hors pipeline.

L'analyse (`targetAnalysis`) déduit l'intitulé courant du rôle, 20 à 30 mots-clés habituels des annonces belges et les attentes du rôle, confrontés au profil. La lettre spontanée est plus courte (200 à 300 mots), ne mentionne jamais d'annonce et demande un échange de 20 à 30 minutes ; en mode CV de base, elle devient un modèle avec emplacements « [à compléter] ». Ces cibles sont exclues de la veille, du scoring, du dédoublonnage et des statistiques d'offres.

**Génération en trois étapes**

1. **Analyse de l'annonce** (`adAnalysis`), sur le texte complet collé ou importé (`offer.fullText`, à défaut le résumé) : intitulé exact et équivalents, 20 à 35 mots-clés ATS classés (catégorie, importance 1-3, variantes) et confrontés au profil (prouvé, transférable, absent, avec la preuve), exigences clés, angle de l'employeur, ligne de positionnement proposée, écarts. Mise en cache tant que l'annonce et le profil ne changent pas.
2. **Rédaction** du CV et de la lettre en parallèle (`cvWrite`, `letterWrite`) à partir de cette matrice : sous le nom, la fonction **réelle** et 2-3 expertises (jamais l'intitulé visé comme s'il était occupé) ; profil en trois temps (qui je suis aujourd'hui, preuves, le poste visé cité comme **objectif**) ; poste actuel au présent, postes passés au passé ; chaque mot-clé prouvé ou transférable d'importance 2-3 placé dans une phrase où il est démontré, pas seulement dans une liste ; aucun mot-clé « absent ».
3. **Contrôle qualité** local puis **corrections ciblées** (`fixDoc`) sur les points détectés : remplacements courts dont le texte d'origine doit exister à l'identique, sinon ignorés.

### Modèle de données (`window.storage`, une clé par collection)

```
radar:settings  { theme, threshold, autoRescore, discreet, employerNames[], model, mcp{gmail,gcal}, restrictTools, mcpTools{…}, followUp{afterSend[], afterInterview}, lastWatchAt, … }
radar:profile   { name, headline, home, summary, skills[], experiences[{role,org,period,highlights}], achievements[], languages[], cvText }
radar:criteria  { draft{…}, versions[{id,label,createdAt, roles[], zones[], maxCommute, remote, mustHave[], wishes[{label,weight}], exclusions[], redFlags[], keywords{fr,nl,en}}] }
radar:sources   [{ id, name, kind, domains[], careersUrl, enabled, lastRunAt, lastCount, lastError }]
radar:offers    [{ id, title, company, location, commute{minutes,basis}, contract, seniority, salary, remote, language, publishedAt,
                   description, fullText, spontaneous ("company" | "base" | absent), contactName, collectedAt, sources[{name,url,collectedAt,via,verified}], status, score{value,confidence,breakdown[],…,criteriaVersionId}, demo }]
radar:apps      [{ id, offerId, kind ("spontaneous" | "base" | absent), stage, reached, sentAt, closed{outcome,reason}, docs{cv|letter|linkedin|answers|email: [versions]},
                   analysis{jobTitle, titleVariants[], keywords[{term,category,importance,variants[],status,evidence}], requirements[], angle, positioning{…}, gaps[], sig},
                   drafts{cv|letter: {text, accent, baseId, at}}, docPrefs{language,tone,voice,cvLength},
                   interviews[], followUps[{kind,due,status,draft}], prep{…}, contactIds[], log[{at,type,text}], demo }]
radar:contacts  [{ id, name, role, company, type, email, linkedin, phone, notes, demo }]
```

Les champs inconnus valent `null` et s'affichent « non communiqué ».

### Prompts internes (objet `P` dans le fichier)

Tous imposent une réponse **JSON stricte**, parsée puis réparée une fois si besoin (un second appel sans outil convertit le texte en JSON).

| Prompt | Outils | Sortie |
|---|---|---|
| `search` | `web_search` restreint aux domaines de la source (`allowed_domains`) | `{offers[], notes}` |
| `gmail` | MCP Gmail, outils de lecture uniquement | `{offers[], messagesRead}` |
| `structure` | `web_search` si seule une URL est fournie | `{found, offer}` |
| `score` | aucun (lots de 4 offres) | `{scores[{id, score, confidence, breakdown[], strengths, gaps, questions, redFlags}]}` |
| `adAnalysis`, `targetAnalysis` (sans offre) | aucun | `{jobTitle, titleVariants, language, keywords[], requirements[], angle, companyFacts, positioning, gaps}` |
| `cvWrite`, `letterWrite` / `letterSpontaneous` | aucun | `{cv, accent, accentSource, tips}` ; `{letter}` (balisage léger) |
| `fixDoc`, `review` | aucun | `{edits[{before, after, reason}]}` ; `{verdict, score, strengths, edits[]}` |
| `improveSection`, `headlines` | aucun | `{body, note}` ; `{options[{headline, angle}]}` |
| `dossier` | aucun | `{language, linkedin, answers, email}` |
| `followUp` | aucun | `{subject, body}` |
| `prep` | `web_search` | `{company{facts[{text,sourceUrl}]}, likelyQuestions, star, questionsToAsk, negotiation, salaryBenchmark}` |
| `gmailDraft` | MCP Gmail, `create_draft` uniquement | `{created, draftId}` |
| `calendarEvent` | MCP Calendar, `create_event` / `list_calendars` | `{created, eventId}` |
| `dedupe` | aucun (lots de 60 offres) | `{groups[{ids, confidence, reason}]}` |
| `replies` | MCP Gmail, outils de lecture uniquement | `{replies[{appId, date, from, subject, kind, summary, proposedStage, interviewAt}]}` |
| `keywords`, `today` | aucun | synonymes FR/NL/EN ; ordre de priorité |

Garde-fous : une URL d'offre absente des résultats de recherche **et** hors du domaine de la source est écartée ; les autres sont marquées « URL vérifiée » ou « à vérifier ». Un brouillon ou un événement n'est déclaré créé que si l'outil MCP a réellement été appelé. Les sources des faits d'entreprise sont vérifiées contre les résultats web. Une réponse de recruteur dont l'objet n'apparaît pas dans les e-mails réellement lus est marquée « à vérifier » ; une réponse déjà traitée n'est jamais reproposée. Deux offres déjà présentes dans le pipeline ne sont jamais fusionnées.

## Automatisé, manuel, et pourquoi

**Automatisé**
- Recherche multi-sources via `web_search`, normalisation, estimation du trajet depuis Ohain, dédoublonnage et fusion des sources.
- Extraction des offres depuis les alertes e-mail Gmail.
- Scoring expliqué, recalcul quand les critères changent, priorisation du jour.
- Analyse de l'annonce, rédaction du dossier en trois étapes, contrôle qualité continu, relances et fiche d'entretien.
- Création de brouillons Gmail et d'événements Google Calendar, **après votre clic** (et confirmation en mode discret).
- Planification des relances selon les règles.

**Manuel, par conception ou par contrainte**
- **Envoi** des e-mails et des messages LinkedIn : jamais automatique. Les outils MCP exposés sont restreints à la lecture et à la création de brouillons.
- **Soumission des formulaires** sur les sites employeurs et job boards : impossible depuis l'artefact (sites tiers, authentification). L'interface fournit le lien direct et le dossier prêt à copier.
- **LinkedIn** : pas de collecte directe (scraping interdit). Les offres arrivent par les alertes e-mail ou par import manuel du texte.
- **Accès direct aux sites d'emploi** : bloqué depuis l'artefact. La collecte dépend de l'indexation du moteur de recherche, donc un décalage de quelques jours est possible. Le texte collé reste la voie la plus fiable.
- **Veille planifiée** : un artefact ne tourne pas en arrière-plan. La veille se lance à la main, ou automatiquement à l'ouverture si l'option est activée. Une veille produite ailleurs (tâche planifiée) peut être importée en JSON.
- **Réponses des recruteurs** : détectées automatiquement, mais appliquées seulement après votre validation (une mauvaise interprétation ne doit pas clôturer une candidature).
- **Temps de trajet** : ordre de grandeur (table locale ou estimation IA), pas un calcul d'itinéraire.

## Réalisé en version 2

1. **Veille sans intervention** : lancement automatique à l'ouverture (option) et import d'offres JSON produites par une tâche planifiée externe.
2. **Déduplication sémantique assistée par l'IA** : propositions de fusion avec niveau de confiance, validation groupe par groupe, historique et annulation depuis la fiche de l'offre.
3. **Suivi des réponses dans Gmail** : lecture seule, rattachement à la candidature, action proposée (entretien avec date extraite, offre, refus) appliquée après validation, relances annulées.

## Trois améliorations prioritaires pour la version suivante

1. **Routine quotidienne hors artefact** qui produit le fichier JSON de veille (et le dépose dans Drive ou Gmail) pour une collecte réellement autonome.
2. **Calibration du scoring** à partir de vos décisions (offres retenues ou écartées) : proposition d'ajustement des poids des critères, versionnée comme le reste.
3. **Statistiques par source et par critère** : taux de réponse et score moyen par source, critères les plus discriminants, pour concentrer la veille sur ce qui rapporte.
