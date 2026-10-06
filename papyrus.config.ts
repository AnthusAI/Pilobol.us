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
  themePack: "pilobol-us",
  themeTokens: pilobolUsThemePackTokens,
  renderer: { kind: "markus" },
  hosting: { kind: "amplify-ssr" },
  readerDeployment: {
    kind: "amplify-static",
    repository: "https://github.com/AnthusAI/Pilobol.us",
    domain: "pilobol.us",
  },
  rootRoute: { kind: "redirect", destination: "/newsroom" },
  newsroomBasePath: "/newsroom",
  opsChrome: "app",
  corpusKey: "pilobol-us",
  steeringConfigPath: "corpora/pilobol-us-steering.yml",
  newsroomSectionsConfigPath: "corpora/pilobol-us-newsroom-sections.yml",
  analysisProfilesPath: "corpora/pilobol-us-analysis-profiles.yml",
  publicationName: "Pilobolus",
};

export default defineSite({
  brands: [pilobolUsBrand],
  defaultBrand: "pilobol-us",
  backend: {
    brandId: "pilobol-us",
    auth: {
      cognitoDomainPrefix: "papyrus-pilobol-us-cms",
      redirectUrls: [
        "http://localhost:3001/newsroom",
        "https://main.dv0pdx67fk80m.amplifyapp.com/newsroom",
        "http://localhost:3001/",
        "https://main.dv0pdx67fk80m.amplifyapp.com/",
      ],
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
