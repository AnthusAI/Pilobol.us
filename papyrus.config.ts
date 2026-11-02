import { defineSite } from "@anthusai/papyrus/define-site";
import type { SiteBrand } from "@anthusai/papyrus/lib/site-brand";
import type { ThemePackTokens } from "@anthusai/papyrus/lib/site-stack";

const pilobolUsThemePackTokens: ThemePackTokens = {
  ink: "#211d17",
  muted: "#6b6153",
  paper: "#f1ead9",
  card: "#fbf6ea",
  line: "#d7cbb2",
  moss: "#3f5d43",
  ochre: "#a35a2a",
  quote: "#4a3548",
  tip: "#4f6b3a",
  caution: "#8a3324",
  stage: "#ddd4bf",
  dark: {
    ink: "#dfded0",
    muted: "#8b9184",
    paper: "#14170f",
    card: "#1c2117",
    line: "#333b2a",
    moss: "#b7d18a",
    ochre: "#d0895a",
    quote: "#b7a3c4",
    tip: "#9fce7a",
    caution: "#d17e6e",
    stage: "#0d0f0a",
  },
};

const pilobolUsBrand: SiteBrand = {
  id: "pilobol-us",
  appTitle: "Pilobolus",
  appDescription: "Pilobolus publication on Papyrus (Pilobol.us).",
  mastheadTitle: "PILOBOL.US",
  mastheadSubtitle: "Field notes",
  backToHomeLabel: "Back to Pilobolus",
  articleTitleSuffix: "Pilobolus",
  placeholderByline: "Pilobolus",
  defaultPresentation: "magazine",
  textFont: 'ui-sans-serif, system-ui, "Plus Jakarta Sans", sans-serif',
  mastheadWordSplit: false,
  mastheadDateFormat: "formatted",
  mastheadSource: "brand",
  sectionLinkStrategy: "route",
  kanbusTheme: "refined-newsprint",
  themePack: "pilobol-us",
  themeTokens: pilobolUsThemePackTokens,
  renderer: { kind: "markus" },
  hosting: { kind: "amplify-ssr" },
  readerDeployment: {
    kind: "amplify-static",
    repository: "https://github.com/AnthusAI/Pilobol.us",
    domain: "pilobol.us",
  },
  rootRoute: { kind: "newsroom" },
  newsroomBasePath: "",
  opsChrome: "app",
  corpusKey: "pilobol-us",
  steeringConfigPath: "corpora/pilobol-us-steering.yml",
  newsroomSectionsConfigPath: "corpora/pilobol-us-newsroom-sections.yml",
  analysisProfilesPath: "corpora/pilobol-us-analysis-profiles.yml",
  publicationName: "Pilobolus",
};

// OAuth return URLs for the Cognito web client. When `auth.redirectUrls` is set the backend uses it as the whole
// list (it does not merge `PAPYRUS_OAUTH_REDIRECT_URLS`), so this builds the list from fixed hosts plus what the
// Amplify branch provides, and no Amplify app id is written in Git:
//   - the fixed local and public hosts below;
//   - every entry of the branch variable PAPYRUS_OAUTH_REDIRECT_URLS (an origin, or origin/newsroom, also gets both /newsroom and /);
//   - PAPYRUS_SITE_ORIGIN, the branch's own public origin;
//   - the default Amplify hosts of the owning app, from PAPYRUS_AMPLIFY_APP_ID (else AWS_APP_ID in an Amplify build).
function siteRedirectUrls(): string[] {
  const urls: string[] = [];
  const add = (value: string) => {
    const url = value.trim();
    if (url && !urls.includes(url)) urls.push(url);
  };
  const addOrigin = (origin: string) => {
    const base = origin.trim().replace(/\/+$/, "");
    if (!base) return;
    add(`${base}/newsroom`);
    add(`${base}/`);
  };
  const addEntry = (entry: string) => {
    const url = entry.trim();
    if (!url) return;
    let bare = false;
    try {
      const path = new URL(url).pathname.replace(/\/+$/, "");
      bare = path === "" || path === "/newsroom";
    } catch {
      // Unparseable entries pass through unchanged.
    }
    if (bare) addOrigin(url);
    else add(url);
  };
  addOrigin("http://localhost:3001");
  addOrigin("https://newsroom.pilobol.us");
  addOrigin("https://staging.pilobol.us");
  for (const entry of (process.env.PAPYRUS_OAUTH_REDIRECT_URLS ?? "").split(",")) addEntry(entry);
  addEntry(process.env.PAPYRUS_SITE_ORIGIN ?? "");
  const appId = (process.env.PAPYRUS_AMPLIFY_APP_ID ?? process.env.AWS_APP_ID ?? "").trim();
  if (appId) {
    addOrigin(`https://main.${appId}.amplifyapp.com`);
    addOrigin(`https://staging.${appId}.amplifyapp.com`);
  }
  return urls;
}

export default defineSite({
  brands: [pilobolUsBrand],
  defaultBrand: "pilobol-us",
  backend: {
    brandId: "pilobol-us",
    plugins: [
      {
        // "Alexa, open Pilobolus". The deploy creates and updates the skill (PPY-704ae1); linking an account is optional.
        name: "alexa",
        invocationName: "pilobolus newsroom",
        skillName: "Pilobolus",
        siteId: "pilobol-us",
        siteOrigin: "https://pilobol.us",
        accountLinking: true,
        amazonVendorId: "M3S89C9SRMQZ89",
      },
    ],
    auth: {
      cognitoDomainPrefix: "papyrus-pilobol-us-cms",
      applyCognitoDomainPrefix: true,
      redirectUrls: siteRedirectUrls(),
    },
    publication: {
      kind: "s3-projection",
      staticDir: "web",
    },
    stagingBuild: { enabled: true },
    features: {
      consoleResponder: false,
      inboundEmail: false,
      slack: false,
      storageBackups: false,
    },
  },
});
