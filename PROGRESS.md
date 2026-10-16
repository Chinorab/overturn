# Overturn — avancement

Dernière mise à jour : 2026-10-16

## Objectif
Assistant web qui aide un Américain à comprendre et contester un refus d'assurance santé ou une
facture médicale erronée (règles fédérales + CA/NY/TX), tout en anglais. Soumis au LexHack 2026
le 19/09. Prochaine cible : **soumission Nebius sur ce même produit, deadline 2026-10-30.**

## Étape en cours
Jeu d'évaluation de l'extraction (`eval/`) : **12 premiers cas mesurés** le 2026-10-16 (Opus 5,
0,77 $) → 99,2 % des champs justes, 12/12 pièges déjoués, 238/238 citations présentes sur la page,
2 hallucinations (montant « autorisé » déduit à 0 sur des lettres qui n'en donnent pas, confiance 0,3).
Corrigé le jour même par une règle de prompt (`amount_allowed` seulement s'il est imprimé) : re-mesure
des 12 cas (`--label allowed-rule`, 0,77 $) → **100 %, 0 hallucination**, EOB toujours justes.
Ensuite : réécriture des lettres par Adaption Labs (lot du Grand Prize) puis comparaison des scores.

## Fait
- [x] Feature 001 (LexHack) — extraction, explication, règles par État, lettre d'appel ;
      spec `specs/001-denial-appeal-assistant/`, soumise sur Devpost le 2026-09-19.
- [x] Extension Alexa+ / MCP (hackathon Amazon) **abandonnée le 2026-10-01** et archivée sur la
      branche `archive/alexa-mcp` (44 commits, sur GitHub). Jamais fusionnée dans `main`.
      Aucune ressource AWS ni compte tiers n'a été créé.
- [x] Couche fournisseur du modèle (`444d37f`) — `lib/ai/provider.ts`, `providers/anthropic.ts`
      (défaut), `providers/fake.ts` (golden samples, pour les tests). Portée depuis l'archive sans
      ce qui ne servait qu'à Alexa. 126 tests verts.
- [x] `.env.example` enfin versionné (`444d37f`) — il n'avait jamais été dans le dépôt alors que
      le README dit de le copier. Liste exactement les variables que le code lit.
- [x] CI réparée (`bd4eaff`) — rouge depuis le 19/09 ; verte de bout en bout le 2026-10-01
      (gitleaks, typecheck, lint, tests, build, e2e).
- [x] Jeu d'évaluation de l'extraction (2026-10-16) — `scripts/eval/` : générateur déterministe
      de 60 lettres/EOB dont la vérité est connue par construction (12 pièges), scoring en 4 verdicts
      (correct / manqué / halluciné / faux) + vérification des citations, runner qui refuse de
      dépenser sans `--yes`, aller-retour Adaption Labs qui rejette toute réécriture perdant ou
      inventant un fait. Doc : `eval/README.md`. 142 tests verts.

## Reste à faire
- [ ] Les 48 cas restants (~3,10 $ en Opus 5, avec `--label allowed-rule`) — sur accord de l'utilisateur.
- [ ] Réécrire `eval/adaption/blocks.csv` avec Adaptive Data (consigne dans `eval/README.md`),
      `pnpm eval:adaption import`, puis comparer les scores sur `eval/cases-adapted`.
- [ ] Provider Nebius `lib/ai/providers/nebius.ts` : client OpenAI-compatible sur
      `NEBIUS_BASE_URL`, `response_format: json_schema` (d'où le champ `schemaName` de la
      requête), modèles Nano-30B (extraction) / Super-120B (rédaction). Nemotron ne lit que du
      texte : PDF → texte, image → `UnsupportedInputError` sauf modèle vision. Puis brancher le
      `case "nebius"` dans `getProvider()` et documenter les variables dans `.env.example`.
      Détails d'origine : tâche T033 de `specs/002-…/tasks.md` sur `archive/alexa-mcp`.
- [ ] Test de parité Nebius / Anthropic sur les six samples texte.
- [ ] Page Devpost + vidéo Nebius (deadline 2026-10-30).

## Décisions prises
- Alexa+ abandonné (2026-10-01) ; rien supprimé : tout est sur `archive/alexa-mcp`.
- Le futur projet Nebius, c'est **Overturn** (pas Argus).
- La couche fournisseur n'a qu'une méthode, `structured()` : `chatWithTools` ne servait qu'au
  simulateur Alexa et aurait obligé Nebius à implémenter l'appel d'outils pour rien.
- `fake` n'est jamais un repli de production : il se choisit explicitement.

## Commandes utiles
- Eval : `pnpm eval:generate` · `pnpm gen:samples eval/cases` · `pnpm eval:run` (à blanc) ·
  `pnpm eval:run --yes` (dépense) · `pnpm eval:adaption export|import <fichier>`
- Lancer : `pnpm dev` (http://localhost:3000) — les samples marchent sans clé API
- Tester : `pnpm test` · `pnpm test:e2e` · `pnpm typecheck` (après `pnpm exec next typegen`
  sur un clone neuf) · `pnpm lint` · `pnpm build`
- Modèle : `OVERTURN_LLM_PROVIDER=anthropic|fake` dans `.env.local`

## Pièges rencontrés
- `next-env.d.ts` est ignoré par Git : sur un clone neuf, le typecheck échoue sur les imports
  `*.png` tant que `next typegen` (ou `next dev`/`build`) n'a pas tourné. La CI le fait.
- `.env*` dans `.gitignore` avalait `.env.example` → exception `!.env.example`.
- Les tests unitaires ne tournent pas sous `--conditions=react-server` : `server-only` est
  aliasé vers `tests/stubs/server-only.ts` dans `vitest.config.mts`.
- Windows : `write_text` de Python convertit LF en CRLF (passer par `write_bytes`) ; un heredoc
  bash corrompt les échappements comme `\b` (passer par un fichier script).
- Un test qui passe du premier coup ne prouve rien : remettre le bug et vérifier qu'il casse.
