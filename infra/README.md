# Pilobol.us infrastructure

`site.json` configures the Papyrus Amplify app-shell stack for this publication (the CMS app; the `reader` block describes the retired Amplify reader, kept until it is deleted). The public site is an S3 projection behind the CloudFront stack `papyrus-edge-pilobol-us`; see `Papyrus/docs/site-hosting.md`. `package.json` pins `@anthusai/papyrus` to the same exact version as the repository root.

```bash
npm ci
npx papyrus-infra synth --site site.json
```

Synthesis only prints and writes `cdk.out/`. Deploying is a separate, reviewed step.

## Reader environment (retired reader, local export)

`reader.environment` in `site.json` lists the public values the guest export needs (`PAPYRUS_GRAPHQL_ENDPOINT`, `PAPYRUS_IDENTITY_POOL_ID`, `PAPYRUS_MEDIA_BUCKET`). No CI build uses them any more; they remain for local full builds with `reader/build.py`. `AWS_REGION` is not listed: Amplify reserves the `AWS` prefix and the guest export derives the region from the endpoint.
