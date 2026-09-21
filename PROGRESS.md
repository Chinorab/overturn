# Overturn — avancement (hackathon Amazon "Build, Ship, Shape")

Dernière mise à jour : 2026-09-21 (tâches)

## Objectif
Exposer le moteur d'appel Overturn (feature 001, LexHack) comme serveur MCP Streamable HTTP
(spec 2025-11-25, OAuth 2.1 PKCE) et livrer une expérience Alexa+ **simulée** en web app
(voix, une question à la fois, confirmation avant action, lettre par e-mail SES).
Deadline Amazon : 2026-10-23 12:00 PDT. Nebius (même produit) : 2026-10-30.

## Étape en cours
Spec + plan + 39 tâches validés (`specs/002-alexa-voice-mcp/tasks.md`). T001 (constitution v1.1) et T004 (FEEDBACK.md + .env.example) faits le 2026-09-21. **Prochaine action : T002**
(workspace pnpm + `mcp/`) le 2026-09-28, début de la fenêtre hackathon. Ne pas coder avant.

## Fait
- [x] Étape 1 — vérif doc Alexa+ : MCP Toolkit « select partners only » → chemin officiel
      « simulated Alexa+ experience in a web app » retenu (sources dans la spec, section Context)
- [x] Spec 002 + checklist qualité (`specs/002-alexa-voice-mcp/`)
- [x] `.specify/feature.json` pointe sur 002 ; branche `002-alexa-voice-mcp` créée
- [x] Plan 002 + annexe design vocal + tasks.md (39 tâches, phases M0→M7 + soumission)

## Reste à faire
- [ ] Suivre tasks.md dans l'ordre : T001→T039 (cocher au fur et à mesure)
- [ ] Abstraction LLM (`OVERTURN_LLM_PROVIDER=anthropic|nebius`)
- [ ] Serveur MCP + OAuth PKCE + test de conformité (scripts Cognito prêts : `infra/cognito/` ; `mcp/README.md` rédigé)
- [ ] Simulateur Alexa+ web (Web Speech API) + page companion (code 6 car.)
- [ ] Envoi SES + repli lien ; déploiement AWS AgentCore (fallback App Runner) — `infra/README.md` rédigé
- [ ] Dépôt open source du dataset règles (MIT) — README + guide adding-a-state + validate.mjs prêts : `docs/dataset-repo/` (1 résumé TX à raccourcir)
- [ ] README « Built during the hackathon », FEEDBACK.md, FRICTION_LOG.md au fil de l'eau
- [ ] Vidéo < 3 min (script prêt : `docs/video-script-alexa.md`) + page Devpost (brouillon prêt : `docs/devpost-alexa.md`, placeholders ⟦…⟧ à remplir) (21-22 oct)

## Décisions prises
- Chemin simulé (accès Alexa+ réel fermé aux particuliers) ; serveur conforme au QuickStart
  Alexa+ (401 + OAuth 2.1 PKCE, < 500 ms) pour être branchable sans code le jour où l'accès s'ouvre.
- Abstraction LLM : Anthropic par défaut (démo Amazon), Nemotron/Nebius derrière la même
  interface (soumission Nebius). Le code actuel utilise le SDK Anthropic, pas Nebius.
- Lettre finale : e-mail Amazon SES vers l'adresse du compte lié (jamais dictée), repli lien
  de téléchargement à usage unique. Zéro stockage.
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
- `setup-plan.ps1` résout la feature via la branche git : forcer `$env:SPECIFY_FEATURE_DIRECTORY`.
- Heredoc bash multi-lignes long échoue dans cet environnement → utiliser l'outil Write.
