# Pilobol.us infrastructure

`site.json` configures the Papyrus Amplify app-shell stack (CMS app plus reader app) for this publication. `package.json` pins `@anthusai/papyrus` to the same exact version as the repository root.

```bash
npm ci
npx papyrus-infra synth --site site.json
```

Synthesis only prints and writes `cdk.out/`. Deploying is a separate, reviewed step.

## Reader environment

The reader app build runs `papyrus ops content export-published --auth guest`, which needs `PAPYRUS_GRAPHQL_ENDPOINT`, `PAPYRUS_IDENTITY_POOL_ID` and `PAPYRUS_MEDIA_BUCKET` on the reader app branch. They are public values from the CMS backend's outputs and live in `reader.environment` in `site.json`; the stack update writes them to the reader `main` branch. `AWS_REGION` is not listed: Amplify reserves the `AWS` prefix for its own variables (it supplies `AWS_REGION` in builds) and the guest export derives the region from the endpoint.
