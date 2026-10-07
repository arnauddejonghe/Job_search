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
| Assistant candidature | CV adapté + points clés, lettre, message LinkedIn (≤ 300 caractères), réponses au formulaire, e-mail → brouillon Gmail. Chaque document est éditable, régénérable (avec consigne) et versionné. |
| Relances & agenda | Règles J+7 / J+14 après envoi et J+2 après entretien (paramétrables). Rédaction IA, brouillon Gmail, rappel dans l'agenda. **Détection des réponses des recruteurs dans Gmail** (lecture seule) : chaque réponse est proposée avec une action (journal, entretien, offre, refus) à valider ; les relances devenues inutiles sont annulées. Fiche de préparation d'entretien sourcée (web_search), STAR, questions, négociation. |
| Contacts | Recruteurs, cabinets, hiring managers et réseau, liés aux candidatures (destinataires des brouillons). |
| Confidentialité & données | Mode discret (aperçu + confirmation avant toute écriture Google), alerte si l'employeur actuel est cité, titres d'agenda neutres, écran masquable, export/import JSON, réinitialisation. |

### Modèle de données (`window.storage`, une clé par collection)

```
radar:settings  { theme, threshold, autoRescore, discreet, employerNames[], model, mcp{gmail,gcal}, restrictTools, mcpTools{…}, followUp{afterSend[], afterInterview}, lastWatchAt, … }
radar:profile   { name, headline, home, summary, skills[], experiences[{role,org,period,highlights}], achievements[], languages[], cvText }
radar:criteria  { draft{…}, versions[{id,label,createdAt, roles[], zones[], maxCommute, remote, mustHave[], wishes[{label,weight}], exclusions[], redFlags[], keywords{fr,nl,en}}] }
radar:sources   [{ id, name, kind, domains[], careersUrl, enabled, lastRunAt, lastCount, lastError }]
radar:offers    [{ id, title, company, location, commute{minutes,basis}, contract, seniority, salary, remote, language, publishedAt, publishedApprox, deadline,
                   description, collectedAt, seenAt, link{state,evidence,at,method}, autoReason, autoRule, dismissedBy, userKept,
                   sources[{name,url,collectedAt,via,verified}], status, score{method:2,value,wishAvg,mustAvg,fit,confidence,breakdown[{id,…}],caps,criteriaVersionId}, demo }]
radar:apps      [{ id, offerId, stage, reached, sentAt, closed{outcome,reason}, docs{cv|letter|linkedin|answers|email: [versions]},
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
| `dossier` | aucun | `{language, cv, letter, linkedin, answers, email}` |
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
- Rédaction de tout le dossier, des relances et de la fiche d'entretien.
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

## Version 3 — fiabilité, tri et qualité de la veille

### Données : fin du blocage « Lecture des données impossible »
- **Cause** : en v1, chaque collection était découpée en tranches de 180 000 caractères réécrites sur place. Une écriture interrompue (onglet fermé, quota, deux onglets ouverts) laissait une tranche neuve à côté d'anciennes, d'où `Expected ',' or ']' … position 180000` et l'enregistrement suspendu.
- **Offres** : un document par offre (`data/users/<id>/radar_offers_v2/items/<offerId>`). Seules les offres modifiées sont réécrites (synchronisation par différence).
- **Autres collections** : écriture atomique par génération (`<clé>__<gen>_<i>`), puis bascule du `__meta` avec somme de contrôle, puis suppression de l'ancienne génération.
- **Réparation automatique** : une collection illisible est récupérée élément par élément (197 offres sur 197 récupérées sur les données réelles), une copie brute est conservée et l'enregistrement reprend. Un incident réseau ne bloque plus que le temps de « Réessayer ».

### Tri
- Onglets **À traiter · Non lues · Arrivées (depuis la dernière visite, groupées par jour) · Échéances · Pipeline · Écartées · Expirées · Toutes**, avec compteurs.
- Statut **lu / non lu** (pastille), bandeau « Depuis votre dernière visite » sur la vue d'ensemble.
- **Actions de masse** : sélection multiple (Maj+clic pour une plage, « tout sélectionner » sur le filtre), puis écarter, expirées, remettre à traiter, lues, pipeline, scorer, vérifier les liens, fusionner, supprimer. Chaque action est **annulable**.
- Actions rapides par ligne (retenir, écarter, expirée) et bouton « Lien mort (404) » dans la fiche.

### Règles de tri automatique (modifiables, avec aperçu)
Appliquées à chaque arrivée et à chaque ouverture, aux seules offres « à traiter » (jamais au pipeline ni aux offres restaurées) :
intitulé exclu (junior, stage…), pas de poste de management, hors périmètre (digital / IT / CRM / transformation, complété par les postes visés), date limite dépassée, annonce clôturée, publiée depuis plus de 30 jours, date inconnue et collectée depuis plus de 21 jours, trajet trop long, score < 40. La raison est affichée sur l'offre, qui reste restaurable.

### Scoring systématique
L'IA évalue **chaque critère** de la version active (identifiants M1, W1, X1, A1…) sur une grille fixe ; le score est **calculé par la page**, toujours avec la même formule : 55 % souhaités pondérés + 45 % indispensables, −5 par signal d'alerte (max −15), plafond 45 si un indispensable n'est pas rempli, plafond 20 si une exclusion est présente. Toute offre à traiter est scorée automatiquement dès son arrivée.

### Doublons systématiques
- Local, à chaque ouverture et arrivée : même URL, même identifiant d'annonce (LinkedIn, Indeed, StepStone, Glassdoor, Jobat), ou même entreprise + intitulé nettoyé (sans « (m/f/x) », lieu…). Fusion automatique, annulable.
- IA, après chaque arrivée : confiance haute fusionnée directement (annulable), confiance moyenne à valider.

### Offres mortes, dates de publication et dates limites
- Champs `publishedAt` (date réelle, ou date de l'alerte e-mail marquée « ≈ ») et `deadline` (date limite de candidature) extraits partout ; colonnes, tri, onglet « Échéances » et carte « Dates limites proches ».
- **Routine réécrite** : qualité avant quantité, filtre de pertinence avant dépôt, chaque candidate est ouverte (WebFetch) ou recherchée pour confirmer qu'elle est ouverte ; les annonces clôturées ne sont plus déposées.
- **Vérification des offres suivies** : la page entretient `veille/verify_queue` (40 offres actives au plus) ; à chaque passage la Routine les vérifie et écrit `veille_verify/verify-*`. Les annonces clôturées passent en « Expirées ». Vérification à la demande depuis la sélection ou la fiche.
- Limite : l'environnement de la Routine est en accès réseau « de confiance » ; WebFetch y est refusé pour les sites d'emploi et la vérification se replie sur la recherche web. Ajouter les domaines d'emploi aux domaines autorisés de l'environnement rend la vérification directe.

## Réalisé en version 2

1. **Veille sans intervention** : lancement automatique à l'ouverture (option) et import d'offres JSON produites par une tâche planifiée externe.
2. **Déduplication sémantique assistée par l'IA** : propositions de fusion avec niveau de confiance, validation groupe par groupe, historique et annulation depuis la fiche de l'offre.
3. **Suivi des réponses dans Gmail** : lecture seule, rattachement à la candidature, action proposée (entretien avec date extraite, offre, refus) appliquée après validation, relances annulées.

## Trois améliorations prioritaires pour la version suivante

1. **Routine quotidienne hors artefact** qui produit le fichier JSON de veille (et le dépose dans Drive ou Gmail) pour une collecte réellement autonome.
2. **Calibration du scoring** à partir de vos décisions (offres retenues ou écartées) : proposition d'ajustement des poids des critères, versionnée comme le reste.
3. **Statistiques par source et par critère** : taux de réponse et score moyen par source, critères les plus discriminants, pour concentrer la veille sur ce qui rapporte.
