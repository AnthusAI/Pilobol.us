# Pilobol.us infrastructure

`site.json` configures the Papyrus Amplify app-shell stack (CMS app plus reader app) for this publication. `package.json` pins `@anthusai/papyrus` to the same exact version as the repository root.

```bash
npm ci
npx papyrus-infra synth --site site.json
```

Synthesis only prints and writes `cdk.out/`. Deploying is a separate, reviewed step.

## Reader environment (filled in later)

The reader app build runs `papyrus content export-published --auth guest`, which needs these environment variables on the reader app: `PAPYRUS_GRAPHQL_ENDPOINT`, `PAPYRUS_IDENTITY_POOL_ID`, `PAPYRUS_MEDIA_BUCKET` and `AWS_REGION`. Their values come from the new CMS backend's outputs, which do not exist until the CMS app has deployed, so `reader.environment` is intentionally absent from `site.json` for now. Ticket PPY-97f03c (P3-04) adds it. The backend's `reader` block in `papyrus.config.ts` (`amplifyAppId`) is added then too.
