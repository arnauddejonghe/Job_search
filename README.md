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
| Assistant candidature | CV et lettre prêts à envoyer, message LinkedIn (≤ 300 caractères), réponses au formulaire, e-mail → brouillon Gmail. **Éditeur par blocs** (chaque section du CV ou paragraphe de la lettre se modifie, se déplace, se supprime ou se réécrit par l'IA avec une consigne), aperçu côte à côte, annuler / rétablir, police, densité, couleur, photo, nombre de pages réel du PDF. **Versions FR / NL / EN** : langue choisie à la génération (par défaut celle de l'annonce), puis traduction fidèle d'une version (modifications comprises) ou génération directe dans une autre langue. Chaque document est versionné par langue. |
| Relances & agenda | Règles J+7 / J+14 après envoi et J+2 après entretien (paramétrables). Rédaction IA, brouillon Gmail, rappel dans l'agenda. **Détection des réponses des recruteurs dans Gmail** (lecture seule) : chaque réponse est proposée avec une action (journal, entretien, offre, refus) à valider ; les relances devenues inutiles sont annulées. Fiche de préparation d'entretien sourcée (web_search), STAR, questions, négociation. |
| Contacts | Recruteurs, cabinets, hiring managers et réseau, liés aux candidatures (destinataires des brouillons). |
| Confidentialité & données | Mode discret (aperçu + confirmation avant toute écriture Google), alerte si l'employeur actuel est cité, titres d'agenda neutres, écran masquable, export/import JSON, réinitialisation. |

### CV et lettre : règles de rédaction

- **En-tête sans répétition** : la ligne sous le nom est un titre de positionnement (intitulé exact du poste visé + 2 ou 3 domaines), jamais une phrase. La section *Profil* est rédigée **au présent**, à partir du poste réellement occupé ; elle ne reprend ni ce titre ni les réalisations. Une alerte s'affiche si le profil cite l'intitulé visé (risque de laisser croire que vous occupez déjà ce poste).
- **Mots-clés ATS, méthode objective** : l'IA relève dans l'annonce 15 à 25 termes recopiés mot pour mot (intitulé, compétences, outils, méthodes, domaines, langues), classés *exigé* / *souhaité*, avec la preuve tirée du profil. Radar **vérifie** que chaque terme figure dans le texte de l'annonce (sinon il est écarté). Seuls les termes justifiés par le profil sont intégrés : tous dans le CV (une passe d'intégration ciblée est lancée automatiquement s'il en manque), les 6 principaux exigés dans la lettre. Les autres sont listés comme écarts, jamais ajoutés.
- **Langues** : niveau CECR stocké en code (*langue maternelle*, C2 à A1). La section *Langues* du CV est recalculée depuis le profil et libellée dans la langue du document (ex. FR « langue maternelle », « courant (C1) » ; NL « moedertaal », « zeer goed (C1) » ; EN « native », « fluent (C1) »). À la migration, un niveau C2 unique devient *langue maternelle*.
- **Contrôle avant envoi** (sans IA, recalculé à chaque frappe) : éléments [à compléter], **chiffres absents de votre profil** (garde-fou anti-invention : tout pourcentage ou montant du document doit figurer dans vos réalisations, expériences ou CV collé), formules toutes faites (FR/NL/EN), coordonnées, intitulé visé cité dans le profil, longueur, entreprise citée et signature (lettre), nombre de pages.
- **Relecture recruteur (IA)** : note sur 100 et grille (adéquation, preuves, clarté, positionnement, ATS), puis 3 à 6 corrections ciblées, chacune applicable d'un clic au bloc visé et annulable.
- **Comparaison de versions** : différences ligne à ligne avec la version précédente (édition, traduction, régénération).
- **Réalisations du profil** insérables d'un clic dans un bloc du CV.
- **Profil depuis le CV collé** : l'IA structure le CV (poste, résumé, compétences, expériences, réalisations chiffrées, formation, certifications, langues CECR) ; vous cochez les champs à remplacer.
- **Style** : CV en style nominal, sans « je » (« Pilote… », « Dirige… »), poste actuel au présent.
- **Employeur actuel** : nommé par son libellé exact dans la lettre, les messages et les réponses (réglage du profil, activé par défaut). Désactivé, il est désigné de façon générique et une alerte signale toute mention de son nom.
- **Exports** : PDF texte (jsPDF) et **Word (.docx)** généré dans le navigateur, sans bibliothèque externe (XML WordprocessingML + archive ZIP). Le .docx reprend la mise en page (couleur, police, densité, photo), utilise les styles Word natifs (Titre 1 / Titre 2, puces) lisibles par les ATS, et reste modifiable dans Word.
- **Photo** : facultative. Recadrée à l'import (360 px, JPEG), affichée en disque dans l'aperçu et le PDF. Politique par défaut « automatique » : oui pour un CV en français ou en néerlandais (usage belge courant), non en anglais (usage anglo-saxon). Modifiable CV par CV. La photo est une image séparée du texte : sans effet sur la lecture ATS.

### Modèle de données (`window.storage`, une clé par collection)

```
radar:settings  { theme, threshold, autoRescore, discreet, employerNames[], model, mcp{gmail,gcal}, restrictTools, mcpTools{…}, followUp{afterSend[], afterInterview}, lastWatchAt, … }
radar:profile   { name, headline, home, summary, skills[], experiences[{role,org,period,highlights}], achievements[], languages[{lang,code,level}], photo, photoPolicy, nameEmployer, cvText }
radar:criteria  { draft{…}, versions[{id,label,createdAt, roles[], zones[], maxCommute, remote, mustHave[], wishes[{label,weight}], exclusions[], redFlags[], keywords{fr,nl,en}}] }
radar:sources   [{ id, name, kind, domains[], careersUrl, enabled, lastRunAt, lastCount, lastError }]
radar:offers    [{ id, title, company, location, commute{minutes,basis}, contract, seniority, salary, remote, language, publishedAt,
                   description, collectedAt, sources[{name,url,collectedAt,via,verified}], status, score{value,confidence,breakdown[],…,criteriaVersionId}, demo }]
radar:apps      [{ id, offerId, stage, reached, sentAt, closed{outcome,reason}, docs{cv|letter|linkedin|answers|email: [versions]},
                   interviews[], followUps[{kind,due,status,draft}], prep{…}, contactIds[], log[{at,type,text}], demo }]
                 docs.cv|letter[] = { text, format:"markup", lang, design{font,density,photo}, accent, kw[{term,category,importance,justified,evidence,inAd}], keywords[], tips[], origin, … }
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
| `cvPro` | aucun | `{language, accent, keywords[{term,category,importance,justified,evidence}], cv, letter, tips}` |
| `dossier` | aucun | `{language, linkedin, answers, email}` |
| `integrateKeywords`, `rewriteBlock` | aucun | `{markup}` |
| `translateDoc` | aucun | `{text, subject}` |
| `reviewDoc` | aucun | `{score, verdict, criteria[{name,score,comment}], suggestions[{block,issue,instruction}]}` |
| `parseCv` | aucun | `{headline, summary, skills[], experiences[], achievements[], education[], certifications[], languages[]}` |
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

## Réalisé en version 2

1. **Veille sans intervention** : lancement automatique à l'ouverture (option) et import d'offres JSON produites par une tâche planifiée externe.
2. **Déduplication sémantique assistée par l'IA** : propositions de fusion avec niveau de confiance, validation groupe par groupe, historique et annulation depuis la fiche de l'offre.
3. **Suivi des réponses dans Gmail** : lecture seule, rattachement à la candidature, action proposée (entretien avec date extraite, offre, refus) appliquée après validation, relances annulées.

## Trois améliorations prioritaires pour la version suivante

1. **Routine quotidienne hors artefact** qui produit le fichier JSON de veille (et le dépose dans Drive ou Gmail) pour une collecte réellement autonome.
2. **Calibration du scoring** à partir de vos décisions (offres retenues ou écartées) : proposition d'ajustement des poids des critères, versionnée comme le reste.
3. **Statistiques par source et par critère** : taux de réponse et score moyen par source, critères les plus discriminants, pour concentrer la veille sur ce qui rapporte.
