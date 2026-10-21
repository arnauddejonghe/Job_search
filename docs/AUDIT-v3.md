# Radar v3 : audit, solutions, critique et arbitrage

Date : 21 octobre 2026 · Périmètre : `radar-emploi.jsx` v2 (5 340 lignes, commit `2db8c84`) · Auteur : revue assistée par Claude

> **Mise à jour.** L'audit a été mené sur la v2. La version en ligne (branche `claude/zen-edison-9drl52`) avait entre-temps ajouté un studio structuré et des contrôles ATS. Les solutions ont donc été **portées sur la version en ligne** sans rien lui retirer : voir la section 9.

## 1. Méthode

- **Lecture intégrale du code v2** : environnement (chat / page publiée), couche IA, prompts, persistance, 9 vues.
- **Benchmark** des outils cités (Final Round AI, Enhancv, Rezi, Jobscan, Resume.io, Zety, Kickresume) et des trackers (Teal, Huntr). Les sources sont surtout des pages éditeurs et des revues tierces, donc à prendre avec prudence. La liste est en fin de document.
- **Grille** : chaque constat a une gravité (🔴 bloquant pour l'objectif, 🟠 important, 🟡 confort), un impact et une piste. Les solutions sont ensuite critiquées, puis arbitrées (développé en v3, reporté ou rejeté).

## 2. Synthèse

| Axe | v2 (/5) | Cible v3 | Constat principal |
|---|:-:|:-:|---|
| Assistant candidature (CV, lettre) | 2 | 5 | Un seul gabarit, seule la couleur se règle, l'aperçu ne correspond pas au PDF, pas de photo, pas de Word |
| Multilingue des documents | 1 | 5 | Une langue par candidature (celle de l'annonce), pas de traduction, pas d'export multi-langues |
| Clarté des offres | 2,5 | 4,5 | L'information de décision est enfouie dans une longue fiche ; il manque des faits normalisés et une comparaison |
| Pipeline et e-mails | 2,5 | 4,5 | Vérification Gmail manuelle, uniquement sur les candidatures marquées « envoyées », relue sur toute la période, sans signal sur les cartes |
| IA : modèles, tokens, latence | 2,5 | 4,5 | Le modèle le plus cher sert pour tout, sans cache de prompt ni réglage d'effort, et chaque changement de pondération provoque un recalcul complet |
| Technique et robustesse | 3,5 | 4,5 | Architecture saine (garde-fous anti-invention, versionnage) ; quelques bugs, chargement séquentiel |
| UX, accessibilité, mobile | 3,5 | 4,5 | Interface soignée et accessible au clavier ; la vue « Assistant » est pauvre et la fiche offre trop longue |
| Confidentialité | 4,5 | 4,5 | Mode discret, outils MCP restreints, rien n'est envoyé : à préserver |

## 3. Benchmark

| Fonction | Enhancv | Rezi | Jobscan | Resume.io / Zety | Kickresume | Final Round AI | Teal / Huntr | **Radar v2** | **Radar v3** |
|---|---|---|---|---|---|---|---|---|---|
| Gabarits de CV | 20+ | Oui | Non | Oui | 35 à 40+ | Oui | Oui | 1 | **7 gabarits, réglables en direct** |
| Réglages de design | Polices, couleurs, fonds, 5 marges | Limités | — | Couleurs, polices | Couleurs, polices | — | Polices (Huntr) | Couleur seule | **Polices, tailles, interligne, marges libres, bord à bord, épaisseur des traits, puces, titres, colonnes, fonds** |
| Blocs déplaçables | Glisser-déposer | — | — | Ordre des sections | — | — | — | Non | **Glisser-déposer, colonne gauche ↔ droite, masquer** |
| Photo | Oui | — | — | Oui | Oui | — | — | Non | **Recadrage, zoom, 4 formes, bordure, position** |
| Icônes | Oui | — | — | Selon gabarit | Selon gabarit | — | — | Non | **Coordonnées et sections, au choix** |
| Score de contenu | 27 contrôles | 23 critères | Taux de correspondance | Contrôle de base | — | — | Score (Teal) | Mots-clés seuls | **Score de qualité local (0 token) + correspondance aux mots-clés** |
| Traduction | — | — | — | — | 8 langues, **sans NL** | — | — | Non | **FR / NL / EN / DE**, conventions belges |
| Export | PDF | PDF, DOCX | — | PDF (DOCX selon offre) | PDF | — | DOCX sans mise en page (Huntr) | PDF | **PDF et Word fidèles, ZIP, fusion multi-langues** |
| Suivi des e-mails | — | — | — | — | — | — | Non confirmé | Manuel | **Automatique, incrémental, avec détection des candidatures envoyées et non suivies, et du ghosting** |
| Entraînement à l'entretien | — | — | — | — | — | Simulations + copilote en direct | — | Fiche de préparation | **Fiche + entraînement avec évaluation STAR** |

Ce qui distingue Radar : la veille et le scoring sont intégrés, l'outil est pensé pour le marché belge (FR/NL, trajet depuis Ohain, employeurs belges), il est discret pour un candidat en poste, il n'invente rien et ne coûte pas d'abonnement.

## 4. Audit détaillé

### A. Assistant candidature

| # | Constat | Gravité | Impact |
|---|---|:-:|---|
| A1 | Un seul rendu : l'en-tête, les titres et les puces sont figés (`buildDocPdf`, `DocPaper`). Seule la couleur d'accent se règle. | 🔴 | Aucune personnalisation au niveau des outils du marché |
| A2 | L'aperçu (police Inter, CSS) diffère du PDF (Helvetica, mise en page jsPDF). Ce qu'on voit n'est pas ce qui part. | 🔴 | Coupures de page et longueurs imprévisibles |
| A3 | Ni photo, ni icônes, ni deux colonnes, ni ordre des sections. | 🔴 | Demande explicite non couverte |
| A4 | Édition en balisage brut dans une zone de texte, sans lien avec l'aperçu. | 🟠 | Peu intuitif, l'inverse d'une expérience « Word / Canva » |
| A5 | Pas d'export Word. | 🟠 | Certains portails et cabinets exigent un .docx |
| A6 | `keywordCoverage` teste aussi les sous-chaînes : « IT » est compté présent dès que « digital » apparaît. | 🟠 | Correspondance surestimée |
| A7 | L'analyse ATS se limite aux mots-clés et à la longueur. Rien sur la quantification, les verbes d'action, les clichés ou la première personne. | 🟠 | Moins exigeant que Rezi ou Enhancv |
| A8 | `pdfSafe` supprime tout caractère hors Latin-1 (« Dvořák » devient « Dvok »). | 🟡 | Rare, mais silencieux |

### B. Clarté des offres

| # | Constat | Gravité | Impact |
|---|---|:-:|---|
| B1 | La fiche offre est un long défilement : score, décomposition, 4 listes, 10 champs, annonce, fusions, sources. La décision (« j'y vais ou pas ») n'est pas résumée. | 🔴 | Lenteur du tri, fatigue |
| B2 | Les champs bruts ne sont pas normalisés : télétravail en texte libre, contrat et salaire non structurés. Les « non communiqué » encombrent l'écran. | 🟠 | Comparaison difficile |
| B3 | Une annonce en NL ou EN se lit dans sa langue d'origine, sans résumé en français. | 🟠 | Lecture plus lente |
| B4 | Aucune comparaison côte à côte de 2 ou 3 offres. | 🟠 | Arbitrage final fait de tête |
| B5 | La liste affiche un score sans verdict. Exigences et missions ne sont pas extraites. | 🟠 | Signal pauvre |

### C. Pipeline et e-mails

| # | Constat | Gravité | Impact |
|---|---|:-:|---|
| C1 | `checkReplies` se lance à la main, et seulement pour les candidatures qui ont une `sentAt`. Une candidature envoyée hors de Radar n'est jamais surveillée. | 🔴 | Demande explicite non couverte |
| C2 | Les accusés de réception des ATS (Workday, SmartRecruiters, Greenhouse, Teamtailor…) et les confirmations LinkedIn Easy Apply sont ignorés. Ils prouvent pourtant l'envoi. | 🔴 | Statuts faux, relances mal datées |
| C3 | Chaque vérification relit toute la période depuis l'envoi, au lieu de partir de la dernière vérification. | 🟠 | Tokens gaspillés, lenteur |
| C4 | Les cartes du pipeline n'affichent aucun signal e-mail (dernier échange, réponse non lue, silence prolongé). | 🟠 | Surveillance impossible d'un coup d'œil |
| C5 | Pas de détection du ghosting (rien depuis N jours) ni d'issue « Sans réponse ». | 🟠 | Pipeline encombré de candidatures mortes |
| C6 | Les e-mails détectés finissent en lignes de journal, sans lien vers le fil Gmail. | 🟡 | Aller-retour manuel |

### D. Multilingue et linguistique

| # | Constat | Gravité | Impact |
|---|---|:-:|---|
| D1 | La langue des documents est imposée par l'annonce, sans traduction. Or la Belgique exige souvent FR et NL, voire EN. | 🔴 | Demande explicite non couverte |
| D2 | Titres de sections, formules de lettre et dates ne sont pas gérés par langue côté rendu. | 🟠 | Incohérences après une édition manuelle |
| D3 | « Ohain » est codé en dur dans les prompts alors que le domicile est modifiable. | 🟡 | Erreur de trajet en cas de déménagement |
| D4 | L'interface est en français uniquement. | 🟡 | Sans objet pour l'utilisateur actuel (voir critique) |

### E. IA : modèles, tokens, latence

| # | Constat | Gravité | Impact |
|---|---|:-:|---|
| E1 | Un seul modèle (Opus 5.5) pour tout, y compris des tâches légères : priorisation du jour, synonymes, doublons, réparation JSON. Haiku 5.5 coûte 40 fois moins en entrée (0,10 $ contre 4 $ par million de tokens). | 🟠 | Coût et latence inutiles |
| E2 | Pas de cache de prompt : profil et critères (environ 1,5 à 3 k tokens) sont renvoyés à chaque lot de scoring. Sur Opus 5.5, une lecture en cache coûte 0,05 fois le prix normal. | 🟠 | Jusqu'à environ 60 % d'entrée économisable sur le scoring |
| E3 | Les lots de scoring partent en parallèle dès le début, donc aucun ne profite du cache des autres. | 🟡 | Cache inopérant même s'il était activé |
| E4 | Un changement de pondération seul relance le scoring IA de 40 offres, alors que le recalcul peut se faire en local à partir de la décomposition existante. | 🟠 | Tokens gaspillés |
| E5 | L'effort de raisonnement n'est pas réglé : `medium` par défaut sur Opus 5.5, même pour une extraction simple. | 🟡 | Latence |
| E6 | Pas de traduction : régénérer un CV dans une autre langue coûterait un appel complet au lieu d'une traduction ciblée. | 🟠 | Coût x3 pour un dossier trilingue |

### F. Technique et robustesse

| # | Constat | Gravité | Impact |
|---|---|:-:|---|
| F1 | Bug : `exportPayload` et `importPayload` oublient `ratings`, donc les notes employeur sont perdues après restauration. | 🟠 | Perte de données |
| F2 | Bug : `resetAll` ne vide pas `ratings` à l'écran. | 🟡 | État incohérent |
| F3 | Chargement séquentiel des 8 collections. En page publiée, chaque lecture fait elle-même plusieurs allers-retours. | 🟠 | Démarrage lent |
| F4 | Les offres écartées gardent indéfiniment leur description et leur décomposition, donc le stockage grossit. | 🟡 | Risque de limite à terme |
| F5 | Fichier unique de 5 300 lignes, imposé par le format artefact. Les sections sont numérotées et cohérentes. | 🟡 | À préserver : moteur de documents isolé dans sa propre section |

### G. UX, accessibilité, mobile

| # | Constat | Gravité | Impact |
|---|---|:-:|---|
| G1 | La vue « Assistant candidature » n'est qu'une liste ; le travail réel se fait dans un tiroir de 672 px, trop étroit pour un éditeur visuel. | 🔴 | Impossible d'offrir une expérience de type Canva |
| G2 | Aucun annuler / rétablir dans l'édition des documents. | 🟠 | Peur de casser |
| G3 | Les points forts sont à préserver : palette ⌘K, focus piégé dans les modales, `aria-*`, thème sombre, tri au clavier. | — | — |

### H. Confidentialité

La photo est une donnée personnelle sensible : elle doit rester locale, n'être jamais envoyée à l'IA et pouvoir être supprimée en un clic. L'import automatique des e-mails doit rester en lecture seule.

## 5. Solutions proposées

| ID | Solution | Couvre | Effort | Gain |
|---|---|---|:-:|:-:|
| S1 | **Moteur de mise en page unique** : un calcul de positions en mm alimente à la fois l'aperçu SVG, le PDF vectoriel et le Word. Ce qu'on voit est exactement ce qui part (pagination comprise). | A1, A2 | L | ★★★ |
| S2 | **Studio plein écran** : contenu, structure et qualité à gauche ; pages A4 au centre (clic sur un bloc pour l'éditer sur place, barre de survol ↑ ↓ ⇄ 👁) ; design à droite ; annuler et rétablir ; raccourcis. | A3, A4, G1, G2 | L | ★★★ |
| S3 | **7 gabarits** (ATS classique, Moderne, Exécutif, Minimal, Compact, Créatif, Élégant), chacun entièrement réglable : polices titres et texte, taille, interligne, marges par côté, bord à bord, espacements, couleurs (accent, texte, fond de colonne, bandeau), style et épaisseur des traits, puces, casse des titres, dates à droite, compétences en étiquettes, icônes. Styles enregistrables comme défaut. | A1, A3 | M | ★★★ |
| S4 | **Photo** : import, recadrage (zoom, glisser, rotation), formes cercle, arrondi, carré et hexagone, bordure (épaisseur et couleur), taille, position (en-tête ou colonne). Stockage local séparé, jamais envoyée à l'IA. | A3, H | M | ★★ |
| S5 | **Export Word natif** (.docx écrit sans bibliothèque) : fidèle au design (colonnes en tableau, photo dans la forme choisie) ou mode ATS sur 1 colonne. | A5 | M | ★★★ |
| S6 | **Traduction FR / NL / EN / DE** des CV et lettres par traduction ciblée (Sonnet 5.5), balisage, faits et chiffres conservés, conventions belges (« Geachte heer, mevrouw »). Une version par langue, éditable. | D1, D2, E6 | M | ★★★ |
| S7 | **Export multi-langues** : choix des documents, des langues, du format (PDF, Word ou les deux) et du regroupement (fichiers séparés en ZIP, un fichier par langue, tout fusionné avec signets PDF). Traductions manquantes générées à la demande. | D1 | M | ★★★ |
| S8 | **Score de qualité local** (0 token) : coordonnées, accroche, quantification, verbes d'action, clichés FR/NL/EN, première personne, longueur, puces trop longues, dates, éléments à compléter, photo selon le marché, correspondance aux mots-clés corrigée. | A6, A7 | S | ★★ |
| S9 | **Surveillance Gmail du pipeline** : vérification automatique à l'ouverture (intervalle réglable) et bouton dans le pipeline ; recherche **incrémentale** depuis la dernière vérification ; détection des accusés ATS et LinkedIn (passage en « Envoyée » avec date réelle), des candidatures **non suivies** (création proposée), des invitations, tests, offres et refus ; onglet « E-mails » avec lien vers le fil Gmail ; badges sur les cartes. Toujours en lecture seule, toujours validé. | C1 à C4, C6 | M | ★★★ |
| S10 | **Ghosting** : badge « sans nouvelles depuis N j », action du jour « relancer ou clôturer », nouvelle issue « Sans réponse ». | C5 | S | ★★ |
| S11 | **Fiche offre « décision d'abord »** : verdict (Postuler, À creuser, Passer), résumé en français quelle que soit la langue de l'annonce, faits clés normalisés (contrat, jours de télétravail, fourchette salariale, langues exigées, taille d'équipe, rattachement), exigences indispensables et souhaitables, missions. Onglets Analyse, Annonce et Sources. | B1, B2, B3, B5 | M | ★★★ |
| S12 | **Comparateur** de 2 à 4 offres côte à côte (faits, critères, forces, écarts, alertes, note employeur). | B4 | S | ★★ |
| S13 | **Routage des modèles** : profond (Opus 5.5) pour le scoring, les CV et la recherche web ; équilibré (Sonnet 5.5) pour la traduction, Gmail, les relances et l'entraînement ; rapide (Haiku 5.5) pour la priorisation, les synonymes, les doublons et la réparation JSON. Effort `low` sur les tâches légères. Réglable. | E1, E5 | S | ★★★ |
| S14 | **Cache de prompt** sur le contexte stable (profil et critères) ; un premier lot de scoring seul, puis les autres en parallèle pour lire le cache. | E2, E3 | S | ★★ |
| S15 | **Re-pondération locale** : si une nouvelle version de critères ne change que des poids, les scores sont recalculés sans appel IA. | E4 | S | ★★ |
| S16 | **Entraînement à l'entretien** : réponse écrite à une question probable, évaluation (note, structure STAR, forces, axes d'amélioration, réponse améliorée sans invention). | Benchmark Final Round | S | ★★ |
| S17 | **Correctifs techniques** : ratings dans l'export, l'import et la réinitialisation ; chargement parallèle ; allègement des offres écartées anciennes ; domicile du profil dans les prompts. | F1 à F4, D3 | S | ★★ |

## 6. Critique des solutions

| ID | Risque ou limite | Alternative étudiée | Décision |
|---|---|---|---|
| S1 | Un moteur maison est un gros morceau. Les mesures de texte (canvas : Arial ≈ Helvetica, Times New Roman ≈ Times) peuvent différer de quelques dixièmes de mm de celles de jsPDF. | (a) `html2canvas` puis PDF image : **rejeté**, le PDF devient une image illisible par les ATS. (b) `window.print()` : bloqué ou aléatoire dans un iframe d'artefact. (c) Bibliothèque PDF avec moteur CSS : trop lourde et pas sur cdnjs. | **Retenu**, avec une marge de sécurité de 1 % sur la largeur des lignes. Polices PDF standard (Helvetica, Times, Courier) : aucun téléchargement, texte sélectionnable. |
| S2 | La direct manipulation complète (texte modifiable caractère par caractère dans l'aperçu) est fragile avec React et SVG. | `contentEditable` sur des lignes SVG : **rejeté**, un paragraphe y est découpé en lignes. | **Retenu** sous forme « clic sur un bloc, éditeur ancré sur le bloc, rendu en direct ». C'est le modèle de Canva (sélection de zone de texte) et il reste robuste. |
| S3 | Plus de réglages donne plus de risques de CV raté ou non lisible par les ATS. | Limiter les réglages, comme les 5 marges prédéfinies d'Enhancv. | **Retenu** avec garde-fous : bornes sur chaque curseur, avertissements du score qualité (2 colonnes, police < 9 pt, marges < 10 mm), réinitialisation au gabarit d'origine. |
| S4 | Une photo est déconseillée pour les candidatures en anglais (marchés anglo-saxons) et peut nourrir un biais. Elle alourdit aussi le stockage (environ 150 Ko). | Pas de photo du tout. | **Retenu** (usage courant en Belgique et en France), masquée par défaut dans le gabarit ATS, avec un avertissement pour l'anglais. Stockée à part, supprimable. |
| S5 | Un .docx écrit à la main peut contenir des erreurs de schéma, et le bord à bord n'existe pas en Word sans marges négatives. | Bibliothèque `docx` : absente de cdnjs, ce qui ajoute une dépendance réseau. | **Retenu** : écrivain OOXML minimal (styles Titre 1 et Titre 2 pour l'ATS, tableau pour les colonnes, photo en forme native `ellipse`, `roundRect` ou `hexagon`), validé par python-docx. Bandeaux en trame de paragraphe dans les marges. |
| S6 | Une traduction automatique peut être maladroite (registre belge, titres de postes). | Régénérer le dossier dans chaque langue (coût x3, et le contenu diverge). | **Retenu** : la traduction garde la structure et les faits, la version reste éditable et le score qualité s'applique par langue. Une consigne impose les intitulés reconnus sur le marché belge. |
| S7 | Un ZIP fait maison, et le navigateur peut bloquer plusieurs téléchargements à la suite. | Téléchargements successifs. | **Retenu** : ZIP en mode « stocké » (sans compression), un seul fichier par export. |
| S8 | Les heuristiques (verbes, clichés) sont imparfaites et produisent des faux positifs. | Analyse par IA (payante à chaque frappe). | **Retenu** en local, avec des formulations prudentes (« à vérifier ») ; l'IA reste disponible via « Régénérer avec consigne ». |
| S9 | La lecture automatique de Gmail consomme des tokens à chaque ouverture et peut mal interpréter un e-mail. | Transfert manuel des e-mails vers une adresse dédiée, comme JobShinobi. | **Retenu** : intervalle minimal (12 h par défaut), recherche incrémentale, requête Gmail construite côté client (domaines ATS, entreprises suivies), aucune action sans validation, outils en lecture seule. |
| S10 | Un faux ghosting est possible si l'échange a eu lieu par téléphone. | — | **Retenu** : simple suggestion, et une note « Appel » dans le journal remet le compteur à zéro. |
| S11 | Extraire des faits normalisés allonge la sortie du scoring (environ 150 tokens par offre). Un verdict IA ferait doublon avec le score. | Verdict généré par l'IA. | **Retenu** : verdict **calculé localement** (score, plafonds, alertes, confiance), donc cohérent et gratuit. Les faits et le résumé FR sont extraits par l'IA dans le même appel que le score, sans appel supplémentaire. |
| S12 | Peu utile au-delà de 4 offres. | — | **Retenu**, limité à 4. |
| S13 | Un modèle plus léger peut dégrader certaines tâches. En page publiée, claude.ai choisit le modèle lui-même. | Tout sur Opus. | **Retenu** : seules les tâches à faible enjeu passent sur Haiku, les modèles restent modifiables, et le repli automatique est conservé. Sans effet en page publiée, ce qui est assumé. |
| S14 | Le proxy des artefacts peut refuser `cache_control` ou `output_config`. | — | **Retenu** avec détection : en cas de 400 citant ces champs, ils sont retirés pour la session, sans erreur visible. |
| S15 | Le score IA n'est pas une formule exacte : le recalcul local peut s'écarter légèrement de ce qu'aurait donné l'IA. | Toujours rappeler l'IA. | **Retenu** uniquement si **seuls les poids changent** ; le score est marqué « recalculé localement ». |
| S16 | Final Round propose un copilote en direct pendant l'entretien, ce qui pose une question d'éthique et est souvent interdit par les employeurs. | Copilote en direct. | **Copilote rejeté** ; seul l'entraînement en amont est retenu. |
| — | **UI multilingue** (NL et EN pour l'interface). | — | **Reporté** : aucun gain pour l'utilisateur actuel. Les documents, eux, sont multilingues. |
| — | **Candidature automatique** (auto-apply façon Final Round ou Jobscan). | — | **Rejeté** : contraire au principe « vous validez tout », risque pour la réputation d'un candidat en poste, et techniquement impossible depuis un artefact. |
| — | **Sorties structurées** (`output_config.format`). | — | **Reporté** : utile, mais la prise en charge par le proxy des artefacts n'est pas garantie et la réparation JSON couvre déjà les rares échecs. |
| — | **Polices intégrées** (Inter, Roboto en TTF dans le PDF). | — | **Reporté** : il faudrait télécharger les polices (CSP incertaine) et le PDF grossirait d'environ 300 Ko. Les polices standard restent nettes et lisibles par les ATS. |

## 7. Arbitrage : contenu de la v3

Toutes les solutions S1 à S17 sont **développées** dans cette version. Le détail des réalisations est dans le README (section « Nouveautés v3 »).

Reporté : UI multilingue, sorties structurées, polices intégrées, glisser-déposer libre d'éléments au millimètre (les blocs se déplacent par section et par colonne, ce qui suffit pour un CV et reste compatible ATS).

## 8. Mesure du succès

| Indicateur | Mesure |
|---|---|
| Temps de tri d'une offre | Moins de 20 s (fiche « décision d'abord » et raccourcis ← →) |
| Dossier trilingue prêt | 1 génération + 2 traductions au lieu de 3 générations, soit environ 40 % de tokens en moins |
| Coût du scoring | Lots 2 et suivants lus en cache ; recalcul local quand seuls les poids changent |
| Statuts de pipeline justes | Accusés ATS détectés : la date d'envoi est réelle, les relances aussi |
| Qualité des CV | Score local ≥ 85 avant envoi, 0 élément « à compléter » |

## 9. Portage sur la version en ligne

La version en ligne couvrait déjà une partie des constats : éditeur structuré par sections avec aperçu cliquable (A4), contrôle qualité local et couverture des mots-clés ATS avec corrections proposées par l'IA (A6, A7, S8), CV maître par langue, puces verrouillées, apprentissage des corrections, brouillons automatiques. Ces fonctions sont conservées telles quelles.

| Solution | Portée | Comment |
|---|---|---|
| S1, S3, S4, S5 | Oui | Le moteur de mise en page remplace l'aperçu HTML : mêmes positions dans l'aperçu SVG, le PDF vectoriel et le Word. Panneau « Design » à côté du panneau d'optimisation, photo (clé `radar:media`), sections déplaçables entre colonnes, design enregistré sur la candidature. L'accent reste celui de la version, proposé par l'IA ou choisi. |
| S2 | Adaptée | L'éditeur structuré en ligne est plus riche que l'édition sur place de la v3 : il est gardé. Un clic dans l'aperçu ouvre la section correspondante. |
| S6, S7 | Oui | Sélecteur de langue dans le studio (bascule ou traduction), export du dossier depuis le studio et la fiche. Allemand ajouté. Les mots-clés ATS ne sont comparés que si la langue du document est celle de l'annonce. |
| S8 | Non | Le contrôle en ligne (`analyzeDoc`) est plus complet que le score v3 : il est conservé. |
| S9, S10 | Oui | Vérification incrémentale, accusés ATS, candidatures hors Radar, boîte persistante (`radar:inbox`), vérification automatique à l'ouverture, onglet « E-mails », signaux sur les cartes, issue « Sans réponse ». |
| S11, S12 | Oui | Carte de décision en tête de la fiche existante, annonce en clair, résumé dans la liste, comparateur depuis la sélection. |
| S13, S14 | Oui | Trois niveaux, effort par tâche. Version publiée : quick, default et complex (complex pour la rédaction finale du CV et de la lettre), sans rejeu d'une réponse identique. Cache sur le préfixe stable du prompt de scoring (API). |
| S15 | Oui | Re-pondération avec la même formule que le score en ligne (taux par identifiant de critère). |
| S16 | Oui | Sous la fiche de préparation, onglet « Entretien ». |
| S17 | En partie | `pdfSafe` (CP1252 et translittération), notes employeur et photo dans la sauvegarde. Le domicile reste Ohain : le calcul de trajet local en dépend. |

## Sources du benchmark

- Enhancv : [site](https://enhancv.com:443), [AI Resume Builder](https://enhancv.com/ai-resume-builder), [fiche Stork](https://www.stork.ai/en/enhancv), [marges](https://enhancv.com/blog/resume-margins/), [avis Resume Genius](https://resumegenius.com/reviews/enhancv-reviews), [tutoriel TalenCat](https://talencat.com/resume-guides/tutorial-enhancv-resume-building)
- Rezi et Jobscan : [Rezi vs Jobscan (Rezi)](https://www.rezi.ai/rezi-vs-jobscan), [Jobscan vs Rezi (Jobscan)](https://www.jobscan.co/blog/jobscan-vs-rezi/), [revue Jobscan 2026](https://blog.theinterviewguys.com/?p=10428), [Tooliverse Jobscan](https://tooliverse.ai/tools/jobscan)
- Kickresume, Zety, Resume.io : [traduction Kickresume](https://www.kickresume.com/en/resume-translation/), [Kickresume vs Zety](https://www.kickresume.com/sk/karierne-centrum/kickresume-vs-zety/), [comparatif Krea 2026](https://www.krea.ai/blog/best-free-resume-builders-and-cv-makers-in-2026)
- Final Round AI : [revue Unite.AI](https://www.unite.ai/final-round-ai-review), [revue Techpoint](https://techpoint.africa/guide/final-round-ai-review/)
- Teal et Huntr : [comparatif JobShinobi](https://jobshinobi.com/compare/huntr-vs-teal-vs-jobshinobi-2026), [guide Happenstance](https://happenstance.ai/guides/best-crm-for-job-search), [notes de version Huntr (DOCX)](https://huntr.co/product-updates/font-customizations-custom-resume-sections-docx-export)
- Tarifs et capacités des modèles Claude : documentation de l'API Claude (Opus 5.5 à 4 $ / 20 $, Sonnet 5.5 à 2 $ / 10 $, Haiku 5.5 à 0,10 $ / 0,50 $ par million de tokens ; lecture en cache à 0,05x sur Opus 5.5 ; cache à partir de 512 tokens sur les modèles récents)
