# Overturn — avancement (hackathon Amazon "Build, Ship, Shape")

Dernière mise à jour : 2026-09-21 (tâches)

## Objectif
Exposer le moteur d'appel Overturn (feature 001, LexHack) comme serveur MCP Streamable HTTP
(spec 2025-11-25, OAuth 2.1 PKCE) et livrer une expérience Alexa+ **simulée** en web app
(voix, une question à la fois, confirmation avant action, lettre par e-mail SES).
Deadline Amazon : 2026-10-23 12:00 PDT. Nebius (même produit) : 2026-10-30.

## Étape en cours
**T011** — handlers des tools de base (`mcp/src/tools/*`) : code et assertions déjà écrits dans
`contracts/tools-basic.md`. Le serveur a maintenant tout ce qu'il leur faut : gate, store,
horloge, compte lié (`sessionAccount`), logger propre.

**T005 reste ouvert** (comptes à créer plus tard) : locataire Auth0 (PKCE + `/userinfo`),
hello-world conteneur sur un PaaS depuis `mcp/Dockerfile`, e-mail Resend avec deux PDF joints.

## Étape précédente
Spec + plan + 39 tâches validés (`specs/002-alexa-voice-mcp/tasks.md`). T001 (constitution v1.1) et T004 (FEEDBACK.md + .env.example) faits le 2026-09-21. **Prochaine action : T002**
(workspace pnpm + `mcp/`) le 2026-09-28, début de la fenêtre hackathon. Ne pas coder avant.

## Fait
- [x] Étape 1 — vérif doc Alexa+ : MCP Toolkit « select partners only » → chemin officiel
      « simulated Alexa+ experience in a web app » retenu (sources dans la spec, section Context)
- [x] Spec 002 + checklist qualité (`specs/002-alexa-voice-mcp/`)
- [x] T002 (2026-09-28) — workspace pnpm (racine + `mcp/`), `mcp/package.json`, `mcp/tsconfig.json`,
      bundler esbuild `mcp/scripts/build.mjs`, scripts racine `mcp:dev|build|start`, `test:mcp*`,
      `test:providers`. Vérifié : `/healthz` répond `{"rules":33}` en dev **et** depuis le bundle
      (le moteur `../lib` se charge via l'alias `@/` sous `--conditions=react-server`), typecheck
      des deux paquets, 114 tests de la feature 001 toujours verts.
- [x] T003 (2026-09-28) — endpoint `/mcp` : `mcp/src/mcp.ts` (identité + instructions du serveur)
      et `mcp/src/sessions.ts` (transport `WebStandardStreamableHTTPServerTransport` stateful,
      registre de sessions, arrêt propre). Vérifié avec un vrai client SDK : `initialize` négocie
      `2025-11-25`, un `Mcp-Session-Id` est émis, deux clients = deux sessions, `DELETE` fait
      retomber le compteur, session inconnue → 404 `-32001`, GET nu → 400 sans créer de session,
      `closeAllSessions()` vide le registre et le listener se ferme. Idem depuis le bundle.
- [x] T006 (2026-09-28) — couture LLM : `lib/ai/provider.ts` (interface `LLMProvider`,
      erreurs neutres `ModelUnavailableError` / `RateLimitedError` / `UnsupportedInputError`,
      `getProvider()` sur `OVERTURN_LLM_PROVIDER`), `providers/anthropic.ts` (l'ancien
      `lib/ai/client.ts`, supprimé) et `providers/fake.ts` (répond depuis les golden samples).
      `extract.ts`, `explain.ts`, `draft.ts` et les deux routes passent par la couture.
      `toModel()` ajouté dans `lib/schemas/extraction.ts` (inverse de `fromModel`) pour que le
      fake réponde dans la forme *modèle* et que la validation stricte tourne pour de vrai.
      127 tests verts (114 → 127), lint 0 erreur, `pnpm build` OK.
- [x] T007 + T008 (2026-09-28) — `lib/voice/{case-code,answers,spoken,readback,rights-speech}.ts`
      extraits des contrats, plus `turn-check.ts` (T019, dont le test de T008 a besoin).
      Tests `tests/voice/{case-code,answers,speech,turn-check}.test.ts` : **258 tests verts**
      au total (127 → 258). Le chunk 0 du sample 02 sort **mot pour mot** comme le transcript
      golden `docs/transcripts/us1-sample02-ca-prior-auth.md` (79 mots) : les templates et les
      transcripts sont d'accord. `vitest.config.mts` inclut désormais `tests/voice/**`.
- [x] T009 (2026-09-28) — `mcp/src/machine.ts` (statuts, `gate()`, questions de confirmation
      figées, séquencement des questions) et `mcp/src/store.ts` (Map unique, horloge injectable,
      TTL 30 min, tombstones 24 h, propriété par session). Câblage écrit en plus du contrat :
      `mcp/src/clock.ts` (`OVERTURN_CLOCK` + route `POST /__test/clock` montée **uniquement**
      quand la variable est posée), `mcp/src/cases.ts` (le store du process), `mcp/src/facts.ts`
      (le contenu d'un dossier, d'après la table Case de data-model.md), et
      `onSessionEnd → store.endSession` dans `server.ts`. `/healthz` publie `cases` (compteurs).
      **299 tests verts** (258 → 299). Vérifié en vrai : un dossier créé dans une session MCP est
      invisible d'une autre session (`wrong_session`) et disparaît au `DELETE /mcp`.
- [x] T010 (2026-09-28) — auth + logs. `mcp/src/auth.ts` **réécrit indépendamment du
      fournisseur** (le contrat était écrit pour Cognito) : issuer, JWKS, userinfo, `aud` et
      `azp`/`client_id` viennent tous de la configuration, les deux orthographes Auth0 et Cognito
      sont acceptées. `mcp/src/log.ts` tel quel. Câblage : 401 + `WWW-Authenticate`
      `resource_metadata`, route RFC 9728, session liée au `sub` qui l'a ouverte (403 sinon),
      `sessionAccount()` qui ne va chercher l'e-mail qu'une fois. **337 tests verts** (299 → 337).
      Vérifié en dev *et depuis le bundle* : 401 sans bearer, 200 avec, en-tête conforme au
      QuickStart Alexa+. Le serveur **refuse de démarrer** sans configuration d'auth.
- [x] `.specify/feature.json` pointe sur 002 ; branche `002-alexa-voice-mcp` créée
- [x] Plan 002 + annexe design vocal + tasks.md (39 tâches, phases M0→M7 + soumission)

## Reste à faire
- [ ] Suivre tasks.md dans l'ordre : T001→T039 (cocher au fur et à mesure)
- [x] Abstraction LLM (`OVERTURN_LLM_PROVIDER=anthropic|nebius|fake`) — provider Nebius : T033
- [~] Serveur MCP : transport, sessions, store, machine, **auth OIDC** faits ; restent les tools (T011-T014) et le test de conformité (T015). `infra/cognito/` conservé mais plus le chemin documenté — Auth0 à configurer en T005.
- [ ] Simulateur Alexa+ web (Web Speech API) + page companion (code 6 car.)
- [ ] Envoi SES + repli lien (templates e-mail + synthèse PDF : `docs/delivery-templates.md`) ; déploiement AWS AgentCore (fallback App Runner) — `infra/README.md` rédigé
- [ ] Dépôt open source du dataset règles (MIT) — README + guide adding-a-state + validate.mjs prêts : `docs/dataset-repo/` (1 résumé TX à raccourcir)
- [ ] README « Built during the hackathon » (sections rédigées : `docs/readme-alexa-sections.md`), FEEDBACK.md, FRICTION_LOG.md au fil de l'eau
- [ ] Vidéo < 3 min (script prêt : `docs/video-script-alexa.md`) + page Devpost (brouillon prêt : `docs/devpost-alexa.md`, placeholders ⟦…⟧ à remplir) (21-22 oct)

## Décisions prises
- Chemin simulé (accès Alexa+ réel fermé aux particuliers) ; serveur conforme au QuickStart
  Alexa+ (401 + OAuth 2.1 PKCE, < 500 ms) pour être branchable sans code le jour où l'accès s'ouvre.
- Abstraction LLM : Anthropic par défaut (démo Amazon), Nemotron/Nebius derrière la même
  interface (soumission Nebius). Le code actuel utilise le SDK Anthropic, pas Nebius.
- **2026-09-28 — pas de compte AWS : le mini-challenge AWS Builder est abandonné.** Le track
  principal (serveur MCP + Alexa+ simulé) n'exige aucun service AWS. Remplacements : hébergement
  du conteneur MCP sur un PaaS (Fly/Railway/Render) au lieu d'AgentCore, OAuth 2.1 PKCE via Auth0
  (qui supporte le dynamic client registration, contrairement à Cognito) au lieu de Cognito,
  e-mail via Resend au lieu de SES, voix via `speechSynthesis` du navigateur au lieu de Polly.
  Le Dockerfile, l'interface d'auth (`MCP_AUTH_MODE`) et les templates d'e-mail sont inchangés :
  seuls les fournisseurs changent. Si un compte AWS est créé plus tard, Bedrock comme troisième
  fournisseur LLM (une variable d'environnement) rouvrirait le mini-challenge.
- Lettre finale : e-mail vers l'adresse du compte lié (jamais dictée), repli lien de
  téléchargement à usage unique — **le lien devient le chemin principal pour les juges**, l'e-mail
  reste le chemin de la vidéo. Zéro stockage.
- Chemin « sans document » (US2) conservé en P2 : démo la plus robuste, aucun appel modèle.
- Vrai Echo via pont communautaire = stretch goal dernière semaine seulement.
- Plan : SDK MCP 1.30 + Hono (`mcp/`), Cognito = serveur OAuth (PKCE), AgentCore Runtime
  (conteneur ARM64, fallback App Runner), SES v2 + lien, Polly TTS + Web Speech STT,
  orchestrateur = client MCP dans Next (`/sim`), companion upload passe par le client (pas le serveur).
- Calendrier : M0 28-29/09 · M1 serveur 30/09-03/10 · M2 simulateur 04-08/10 · M3 sans-doc 09-10/10 ·
  M4 déploiement 11-13/10 · M5 dataset 14-15/10 · M6 Nebius 16-17/10 · M7 polish 18-19/10 ·
  freeze 20/10 20h · vidéo+Devpost 21-22/10 · soumission 23/10 avant 18h Paris.

## Commandes utiles
- Dev web : `pnpm dev` · tests : `pnpm test` · typecheck : `pnpm typecheck`

## Pièges rencontrés
- L'issuer Auth0 **finit par un slash** et la comparaison est une égalité : normaliser les URLs en
  retirant le dernier slash casse tous les jetons (28/09).
- `jose` est une dépendance de `mcp/` : ajoutée en devDependency à la racine pour que les tests
  `tests/mcp/*` la résolvent (28/09).
- `store.close()` / `forget()` ne normalisaient pas la casse alors que `get()` le fait : un
  « discard » en minuscules serait passé sans rien faire, en laissant un dossier vivant avec le
  contenu du document. Corrigé + test (28/09).
- `checkTurn` n'a que cinq `TurnKind` (`normal`, `rights_chunk`, `code_readout`, `closing`,
  `readback_only`) : un `kind` inventé plante avec un TypeError au lieu d'un message clair (28/09).
- ~~Le type `Answers` vit dans `lib/session.tsx`~~ → déplacé vers `lib/schemas/situation.ts`
  en T009, `lib/session.tsx` le ré-exporte (le web app n'a pas bougé).
- `spokenRights` produit 6 chunks pour le sample 02 : c'est de la pagination **à la demande**
  (« Want to hear more ? »), pas un monologue — les transcripts ne lisent que le chunk 0, ou 0+1.
  Vérifié avant de le signaler comme un défaut (28/09).
- Les tests unitaires ne tournent pas sous `--conditions=react-server` : `server-only` est aliasé
  vers `tests/stubs/server-only.ts` dans `vitest.config.mts` (28/09).
- `zodOutputFormat` du SDK Anthropic ne prend **qu'un** argument (pas de nom de schéma) ;
  `schemaName` reste dans la requête pour le fake et pour Nebius (28/09).
- Python `write_text` sur Windows convertit LF en CRLF : passer par `write_bytes`, sinon le
  diff repasse tout le fichier (28/09).
- L'exemple Hono de la docstring du SDK partage **un seul transport** pour `/mcp` : faux en mode
  stateful (une session par transport). Il faut un registre `Map<sessionId, {transport, server}>`
  et lire le corps une fois pour le repasser en `parsedBody` (28/09).
- Un client qui ferme sans envoyer `DELETE` laisse sa session dans le registre : HTTP n'a pas de
  raccroché. Le balayage des sessions inactives est à faire en **T009**, avec l'horloge du store.
- `process.exit()` sous `tsx` déclenche une assertion libuv Windows au teardown (`UV_HANDLE_CLOSING`).
  Sans conséquence : le bundle de prod ne passe pas par tsx (28/09).
- `mcp/tsconfig.json` ne doit inclure que `src/**` : inclure `../lib/**` fait typechecker
  `lib/session.tsx` (React navigateur, `window`) que le serveur n'importe jamais (28/09).
- Le script de build vit dans `mcp/scripts/`, pas dans `scripts/` à la racine : Node résout
  `esbuild` depuis l'emplacement du script, et esbuild est une devDep de `mcp` (28/09).
- Générer du code par heredoc bash corrompt les échappements (`\b` → octet 0x08) : toujours passer par un fichier script Python (22/09).
- Chemin sans document : « I don't know » pour la date arrivait jusqu'à `date-fns` (RangeError) → `syntheticExtraction` renvoie null + validation par le schéma Extraction (22/09).
- `parseYesNo` : un « no » suivi d'une précision (« no, it was scheduled ») était ambigu → règle du token de tête (corrigé 22/09).
- ~~`jose` n'est pas hoisté~~ → réglé en T002 : déclaré dans `mcp/package.json`, résout depuis `mcp/`.
- Le guard `legal advice` matche la phrase d'ouverture obligatoire → `turn-check` doit l'exempter (détail dans `docs/transcripts/README.md`).
- `setup-plan.ps1` résout la feature via la branche git : forcer `$env:SPECIFY_FEATURE_DIRECTORY`.
- Heredoc bash multi-lignes long échoue dans cet environnement → utiliser l'outil Write.
