# Pilobol.us

*A fungus among us.* The Pilobolus publication: strange, checkable stories about AI and machine-learning systems slowly taking over ordinary life. Live at [pilobol.us](https://pilobol.us). It is pre-production.

## What this repository is

This repository is one publication built on Papyrus. It holds the site settings and look (`web/`), the Papyrus site registration and infrastructure description (`papyrus.config.ts`, `infra/site.json`), the pre-publication working board (Kanbus project `PILO`, `project/`, `stories/`), the local knowledge pod (`project/wiki/`, `corpora/`) and the voice guide (`content/VOICE.md`). Published articles live in the Papyrus CMS, not in Git.

| Repository | Role |
| --- | --- |
| [Papyrus](https://github.com/AnthusAI/Papyrus) | The engine: `@anthusai/papyrus` (npm) and `papyrus-newsroom` (PyPI), released in lockstep. This site pins an exact version. |
| This repository | The Pilobolus site, board and local knowledge pod. |
| [Markus](https://github.com/AnthusAI/Markus) | The Markdown dialect and renderer the articles use. |
| [Biblicus](https://github.com/AnthusAI/Biblicus) | The corpus and knowledge-base engine under the local pod. |
| [Tactus](https://github.com/AnthusAI/Tactus) | The procedure language the newsroom procedures use. |
| [Cyclotron](https://github.com/AnthusAI/Cyclotron) | The relevance engine used for include and exclude decisions; configured in the Papyrus backend, not here. |
| [Auritus](https://github.com/AnthusAI/Auritus) | The narration player embedded on every article. |
| [Prospectus](https://github.com/AnthusAI/Prospectus) | A separate product; this site only shares the Amplify and account conventions (its accounts API is referenced in `infra/site.json`). |

Engine rules for every Papyrus site are in the Papyrus [AGENTS.md](https://github.com/AnthusAI/Papyrus/blob/main/AGENTS.md); its docs index is [docs/README.md](https://github.com/AnthusAI/Papyrus/blob/main/docs/README.md).

## Where it runs

| Thing | Value |
| --- | --- |
| AWS account | `papyrus-production`, `712236451410`, `us-east-1` |
| Public site | `https://pilobol.us` (apex only, no www). Static pages in the versioned S3 site bucket, served by CloudFront distribution `E2GKJ877IAH2I8` (stack `papyrus-edge-pilobol-us`). |
| Newsroom (CMS) | `https://newsroom.pilobol.us/` (the newsroom is at the root; `/newsroom/*` redirects to `/*`). Served by CloudFront distribution `E205M49121L1RG` (stack `papyrus-edge-pilobol-us-cms`) in front of the Amplify app, because Amplify's own domain association for this host is `FAILED` (cross-account approval needed). |
| Amplify app | `d1eiwl0gedkmnj` (`pilobol-us-cms`, Gen 2 backend, repository `AnthusAI/Pilobol.us`). Branch `main` is production (auto-build off), branch `staging` is beta (auto-build on, previews drafts). |
| CDK stack | `amplify-app-shell-pilobol-us-cms`, described by `infra/site.json`. |
| Retired | The Amplify reader apps and the old CMS app (`d11eu9hbs2mipk`, the id the repo used to list) no longer exist in this account. Do not use their ids. |
| Analytics | Google Analytics 4 (`G-31SC26SDGX`) with Consent Mode v2 and a cookie banner; privacy link `https://anth.us/privacy/`. |

## Quick start

Prerequisites: Node 22 and npm, Python 3.12, and `aws sso login` for anything that touches AWS (`AWS_PROFILE=papyrus-production`).

```bash
npm ci
echo '{}' > amplify_outputs.json     # stub; git-ignored; enough for type checking
npx papyrus-app sync && npx tsc --noEmit
python3 -m unittest discover -s tests
```

These are the CI steps. For the Python `papyrus` CLI and a local build of the whole site from published content (no AWS credentials needed, the three variables are public values):

```bash
pip install "papyrus-newsroom[markus]==5.60.0"      # the pin in infra/site.json
export PAPYRUS_GRAPHQL_ENDPOINT=... PAPYRUS_IDENTITY_POOL_ID=... PAPYRUS_MEDIA_BUCKET=...
papyrus ops content export-published --auth guest --out content-export --clean
papyrus ops content project --all --from-dir content-export --static-dir web --out dist
```

`npm run dev` (port 3001) runs the CMS app and needs a generated `amplify_outputs.json`. The board uses the pinned Kanbus (`kanbus-version`): `pip install "kanbus==$(cat kanbus-version)"`, then `KANBUS_REALTIME_BROKER=off kbs list`.

## How a change reaches production

1. Branch from `main`, open a pull request to `main`. (`develop` exists but is far behind; do not use it.)
2. The `CI and deploy` workflow (`.github/workflows/deploy.yml`) runs `npm ci`, `papyrus-app sync`, `tsc --noEmit` and the Python unit tests.
3. On a green push to `main`, the same workflow calls `AnthusAI/Papyrus/.github/workflows/amplify-deploy.yml`, which assumes the GitHub OIDC role `pilobol-us-github-deploy` (no stored keys) and starts an Amplify RELEASE job for the merged commit on app `d1eiwl0gedkmnj`.
4. The Amplify build (`amplify.yml`) runs `npx ampx pipeline-deploy` (backend), then builds the Next app. `npm ci` also runs `papyrus-infra deploy` for this app and branch only. The backend deploy re-renders the site.

Articles do not go through Git. Saving or publishing in the newsroom renders the affected pages onto pilobol.us within seconds. Engine upgrades go through the pin: edit the exact version in `package.json` and `infra/site.json` together, run `npm install`, merge. Papyrus releases through semantic-release (`feat:` and `fix:` release; `chore:` and `docs:` do not). Details: Papyrus [releasing](https://github.com/AnthusAI/Papyrus/blob/main/docs/releasing.md) and [site hosting](https://github.com/AnthusAI/Papyrus/blob/main/docs/site-hosting.md).

## Where to read next

[AGENTS.md](AGENTS.md) is the operating manual (map, tasks, hard rules, editorial rules, current state). The voice guide is [content/VOICE.md](content/VOICE.md).

## License

Everything in this repository, writing and code alike, is licensed under the [MIT License](LICENSE).
