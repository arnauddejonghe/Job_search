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
2. **Rédaction du CV** (`cvWrite`) à partir de cette matrice : sous le nom, la fonction **réelle** et 2-3 expertises (jamais l'intitulé visé comme s'il était occupé) ; profil en trois temps (qui je suis aujourd'hui, preuves, le poste visé cité comme **objectif**) ; poste actuel au présent, postes passés au passé ; chaque mot-clé prouvé ou transférable d'importance 2-3 placé dans une phrase où il est démontré ; aucun mot-clé « absent ». Contrôle qualité et corrections ciblées.
3. **Rédaction de la lettre ensuite, avec le CV en entrée** (`letterCore`) : voir « Lettre ≠ CV » ci-dessous. Contrôle qualité et corrections ciblées (`fixDoc`) : remplacements courts dont le texte d'origine doit exister à l'identique, sinon ignorés.

**Lettre ≠ CV** — règle d'or : le CV prouve, la lettre explique.

- **Trame** (250 à 320 mots ; 220 à 300 en spontanée) : appel · pourquoi vous (un fait propre à l'entreprise relié à une conviction) · pourquoi ce rôle, maintenant · une preuve **racontée** (une histoire de la banque) · méthode · demande d'échange. Au plus 2 chiffres, au plus 1 réalisation commune avec le CV (reformulée), 2 à 4 mots-clés, jamais deux phrases consécutives en « Je ». Test de substitution : toute phrase encore vraie pour un concurrent est réécrite. La sortie `used{}` (faits F1…, conviction, histoire, mots-clés, chiffres, réalisation commune) est conservée sur la version.
- **Contrôle sans IA** : recouvrement de 4-grammes avec le CV (alerte > 15 %, blocage > 30 %), chiffres repris du CV (> 1 = alerte), plus de 2 chiffres, « pourquoi eux » absent ou non étayé, conviction absente, histoire absente, flatterie, enchaînements en « Je ». Plus de pénalité « lettre sans chiffre », plus d'injection de mots-clés dans la lettre.
- **Score de la lettre** : spécificité 35 · complémentarité 25 · impact 20 · lisibilité 20. Deux jauges dans le studio : recouvrement avec le CV et spécificité. La relecture IA reçoit le CV et applique le test de substitution.

**Motivations** (Profil & critères → *Motivations*, champ facultatif `profile.motivation`) : raison d'être, convictions, banque d'histoires, management, méthode, pourquoi maintenant, ce que vous cherchez, secteurs. **Entretien IA** de 10 questions (réponses conservées dans `profile.motivationAnswers`), puis `motivationDraft` range les réponses en **reformulant seulement** (tout chiffre absent des réponses est signalé) et propose 0 à 3 relances. Injecté dans la lettre, les messages (`dossier`), la réponse « Pourquoi nous ? » et la préparation d'entretien. **Jamais dans le CV.**

**Règles d'écriture** (Profil & critères → *Règles d'écriture*, champ facultatif `profile.writingRules`) : injectées dans toutes les rédactions (CV, lettre, messages, corrections, relecture, réécriture de section, lignes de positionnement, relances, préparation d'entretien), prioritaires sur les consignes de style, jamais sur la vérité. Règles de départ à valider : généraliste de la transformation digitale (jamais « responsable CRM »), trilinguisme dans le Profil, master discret, preuves prioritaires, ton humble.

**Pourquoi cette candidature** (carte du studio, avant génération ; champ facultatif `app.motivation`) : faits retenus (`factIds`), pourquoi eux (`whyCompany`), pourquoi ce rôle maintenant (`whyRole`), lien personnel, conviction et histoire choisies dans la banque, et **`employerNamed`** : réglage unique pour le CV et la lettre (nommé par son libellé exact, ou jamais nommé ; dans ce cas toute mention est bloquée au contrôle). Un choix vide s'écrit [à compléter] dans la lettre, ce qui bloque l'envoi.

**Fiches entreprise** (`companyBriefs`, clé `radar:briefs`, une fiche par entreprise, valable **60 jours**) : faits d'une phrase, chacun avec son URL. Trois sources : `web_search` dans l'artefact (`companyBrief` ; un fait dont l'URL n'apparaît pas dans les résultats est écarté), la Routine dans la page publiée (tâche `{"task":"brief"}` à la demande, et file `veille/brief_queue` des candidatures actives à chaque passage → collection `veille_briefs`, même modèle que les notes employeur), ou une source collée avec son URL obligatoire (`briefFromText`). Les faits de l'annonce sont repris avec l'URL de l'annonce. **Un fait sans URL vérifiée est exclu.** La lettre, le message LinkedIn, la réponse « Pourquoi nous ? » et la préparation d'entretien utilisent la fiche ; la préparation réutilise ses faits et l'enrichit de ses propres faits vérifiés. La Routine cherche avec le nom de l'entreprise, jamais celui du candidat.

**Apprentissage des corrections (6b)** : à chaque version enregistrée à la main, l'écart mot à mot avec la dernière version IA (`editDelta`, à partir de `wordDiff`) est mémorisé dans `profile.ruleLearning` (40 dernières corrections, hors données d'exemple). Après au moins 3 documents corrigés, *Règles d'écriture → Proposer des règles* (`learnRules`) propose 0 à 5 règles observées dans au moins 2 documents, avec leurs exemples. Elles arrivent **inactives** : une règle apprise n'est jamais activée seule.

**CV maître par langue (6c)** et **puces verrouillées (6d)** : studio → panneau d'optimisation → onglet *Maître*. Le CV maître (`profile.masterCv.fr|nl|en`) sert de base : l'IA reçoit la consigne de ne modifier que la ligne de positionnement, le Profil, les Réalisations clés, l'ordre des puces de chaque poste et les Compétences, et la page le **garantit** (`enforceMaster` : en-tête, postes, texte des puces, langues et formation repris du maître ; puces inventées écartées). Écarts avec le maître affichés en diff. Une puce verrouillée (`profile.lockedBullets`) est recopiée mot pour mot : restaurée si l'IA la reformule, et toute correction proposée qui la touche est écartée.

**Mesures (7)** : carte *Mesures des dossiers* dans l'Assistant : date de génération, corrections manuelles du CV et de la lettre (part des mots modifiés, doit baisser ; tendance première moitié → seconde moitié), recouvrement lettre / CV, nombre de chiffres, ce que la lettre utilise (`used` : faits, conviction, histoire), étape atteinte.

**Routine** : le prompt de la Routine « Radar – veille emploi » est versionné dans [`routines/radar-veille-emploi.md`](routines/radar-veille-emploi.md).

### Modèle de données (`window.storage`, une clé par collection)

```
radar:settings  { theme, threshold, autoRescore, discreet, employerNames[], model, mcp{gmail,gcal}, restrictTools, mcpTools{…}, followUp{afterSend[], afterInterview}, lastWatchAt, … }
radar:profile   { name, headline, home, summary, skills[], experiences[{role,org,period,highlights}], achievements[], languages[], cvText,
                  motivation?{purpose, convictions[{id,text}], stories[{id,title,situation,action,result,lesson}], management, method, whyNow, lookingFor, sectors[]},
                  motivationAnswers?{q1…}, writingRules?[{id,text,active,origin,evidence}], ruleLearning?{edits[], lastLearnAt},
                  masterCv?{fr|nl|en: {text, at, sourceAppId}}, lockedBullets?[] }
radar:criteria  { draft{…}, versions[{id,label,createdAt, roles[], zones[], maxCommute, remote, mustHave[], wishes[{label,weight}], exclusions[], redFlags[], keywords{fr,nl,en}}] }
radar:sources   [{ id, name, kind, domains[], careersUrl, enabled, lastRunAt, lastCount, lastError }]
radar:offers    [{ id, title, company, location, commute{minutes,basis}, contract, seniority, salary, remote, language, publishedAt, publishedApprox, deadline,
                   description, fullText, spontaneous ("company" | "base" | absent), contactName, collectedAt, seenAt, link{state,evidence,at,method}, autoReason, autoRule, dismissedBy, userKept,
                   sources[{name,url,collectedAt,via,verified}], status, score{method:2,value,wishAvg,mustAvg,fit,confidence,breakdown[{id,…}],caps,criteriaVersionId}, demo }]
radar:apps      [{ id, offerId, kind ("spontaneous" | "base" | absent), stage, reached, sentAt, closed{outcome,reason}, docs{cv|letter|linkedin|answers|email: [versions]},
                   analysis{jobTitle, titleVariants[], keywords[{term,category,importance,variants[],status,evidence}], requirements[], angle, positioning{…}, gaps[], sig},
                   drafts{cv|letter: {text, accent, baseId, at}}, docPrefs{language,tone,voice,cvLength},
                   interviews[], followUps[{kind,due,status,draft}], prep{…}, contactIds[], log[{at,type,text}], demo }]
radar:contacts  [{ id, name, role, company, type, email, linkedin, phone, notes, demo }]
radar:briefs    { <entreprise-normalisée>: { company, summary, facts[{id,text,url,verified,source}], origin, createdAt, expiresAt } }
radar:media     { photo: { src (JPEG recadré), original, crop{zoom,x,y,rot}, updatedAt } | null }   jamais envoyé à l'IA
radar:inbox     { replies[{appId,threadId,date,from,subject,kind,summary,action,interviewAt,verified}], untracked[{company,title,threadId,…}] }   e-mails détectés à valider
app.motivation? { factIds[], whyCompany, whyRole, personalLink, convictionId, storyId, employerNamed }
app.design?     { template, page, font, headingFont, size, lineHeight, margin{t,r,b,l}, colors{…}, columns, side, sideWidth, header, headingStyle, rule, bullet, icons, photo{show,shape,size,border}, layout{side[],hidden[]} }
app.emails?     [{ date, from, subject, kind, summary, threadId }] · app.practice? [{ question, answer, feedback{score,star,strengths,improvements,improved} }]
version de document : language (fr|nl|en|de), translatedFrom?, origin « traduction »
offer.score     + tldr, facts{contract,remoteDays,salaryMin,salaryMax,salaryPeriod,languages[],teamSize,reportsTo,seniority}, must[], nice[], missions[], reweightedAt?
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
| `cvWrite`, puis `letterWrite` → `letterCore` (CV en entrée, offre ou spontanée) | aucun | `{cv, accent, accentSource, tips}` ; `{letter, used{companyFacts, convictionId, storyId, keywords, numbers, sharedWithCv}}` |
| `companyBrief` / `briefFromText` | `web_search` / aucun | `{summary, facts[{text, url}]}` |
| `learnRules` | aucun | `{rules[{text, evidence, docs}]}` |
| `motivationDraft` | aucun | `{purpose, convictions[], stories[], management, method, whyNow, lookingFor, sectors[], followUps[]}` |
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

## Version 4 — studio de design, multilingue, surveillance Gmail, offres claires

Audit, benchmark (Enhancv, Rezi, Jobscan, Resume.io, Zety, Kickresume, Final Round AI) et arbitrage : [`docs/AUDIT-v3.md`](docs/AUDIT-v3.md).

**Studio**
- **Design en temps réel** : 7 modèles (Classique ATS, Moderne, Exécutif, Minimal, Compact, Créatif, Élégant), polices, tailles, interligne, marges par côté, bord à bord, espacements, couleurs (accent, texte, filets, fond de colonne, bandeau), style et épaisseur des traits, puces, icônes des coordonnées et des sections, dates à droite, compétences en étiquettes. Style enregistrable par défaut.
- **Aperçu = PDF = Word** : un seul moteur calcule les positions en millimètres ; l'aperçu SVG, le PDF vectoriel (texte sélectionnable, signets) et le Word natif (styles Titre lus par les ATS) en découlent.
- **Photo** : import, recadrage, zoom, rotation, formes cercle, arrondi, carré, hexagone, bordure. Stockée dans vos données privées, jamais envoyée à l'IA.
- **Sections et colonnes** : glisser-déposer entre colonne principale et secondaire, ordre, masquage à l'export.
- **Langues** : FR, NL, EN, DE. Une version par langue ; « Traduire en … » crée une version traduite (balisage, faits et chiffres conservés, formules belges).
- **Exporter le dossier** : CV et/ou lettre, plusieurs langues, PDF, Word (fidèle ou ATS) ou les deux ; un fichier par langue, tout en un, ou séparés ; ZIP si plusieurs fichiers.

**Pipeline et e-mails**
- Vérification Gmail **incrémentale** (depuis la dernière fenêtre), automatique à l'ouverture toutes les 12 h (réglable), lecture seule, toujours validée.
- Détecte les accusés des logiciels de recrutement (Workday, SmartRecruiters, Greenhouse, Lever, Teamtailor…) et de LinkedIn ou Indeed, les invitations, tests, refus, offres, et les **candidatures envoyées hors de Radar** (ajout au pipeline en un clic).
- Onglet « E-mails » dans la fiche (lien vers le fil), signaux sur les cartes (dernier e-mail, « sans nouvelles · N j »), issue « Sans réponse ».

**Offres**
- Carte de décision : Postuler, À creuser ou Passer (calculé localement), résumé en français, faits clés normalisés (contrat, télétravail, salaire, équipe, rattachement, séniorité, langues exigées), annonce en clair (missions, exigences, atouts).
- Comparateur de 2 à 4 offres ; résumé d'une phrase dans la liste.
- Nouvelle version de critères qui ne change que des poids : scores recalculés sans IA.

**IA**
- Modèle selon la tâche (profond, équilibré, rapide) et effort adapté ; version publiée : niveaux quick, default et complex de claude.ai, complex pour la rédaction finale du CV et de la lettre ; une régénération ne rejoue jamais une réponse en cache.
- Préfixe stable du scoring (profil, critères, grille) mis en cache côté API ; consommation par niveau dans « Confidentialité & données ».
- Entraînement à l'entretien : réponse écrite notée (structure STAR, forces, améliorations, version améliorée sans fait inventé).

## Réalisé en version 2

1. **Veille sans intervention** : lancement automatique à l'ouverture (option) et import d'offres JSON produites par une tâche planifiée externe.
2. **Déduplication sémantique assistée par l'IA** : propositions de fusion avec niveau de confiance, validation groupe par groupe, historique et annulation depuis la fiche de l'offre.
3. **Suivi des réponses dans Gmail** : lecture seule, rattachement à la candidature, action proposée (entretien avec date extraite, offre, refus) appliquée après validation, relances annulées.

## Trois améliorations prioritaires pour la version suivante

1. **Routine quotidienne hors artefact** qui produit le fichier JSON de veille (et le dépose dans Drive ou Gmail) pour une collecte réellement autonome.
2. **Calibration du scoring** à partir de vos décisions (offres retenues ou écartées) : proposition d'ajustement des poids des critères, versionnée comme le reste.
3. **Statistiques par source et par critère** : taux de réponse et score moyen par source, critères les plus discriminants, pour concentrer la veille sur ce qui rapporte.
