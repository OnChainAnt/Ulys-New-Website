# Ulys — New Website

A modern marketing site for Ulys, built as a **static site** (plain HTML / CSS / vanilla JS — no build step, no framework). Dark + light themes, an animated WebGL background, and an AI‑command‑bar hero.

## Run locally

No install needed — it's static files. Serve the folder with any static server:

```bash
# option A: Python (built in on macOS)
python3 -m http.server 4599

# option B: Node
npx serve -l 4599
```

Then open <http://localhost:4599>.

> Open it through a server (not `file://`) — the shared nav/footer and the Contentful pages are injected/fetched with JS and need an HTTP origin.

## Project structure

```
index.html              Homepage (hero, feature sections, showcase, FAQ, CTA)
about.html              Company / about
terms-of-service.html   Legal — Terms of Service
privacy-policy.html     Legal — Privacy Policy
trademark-disclaimer.html  Legal — Trademark Disclaimer
crypto-glossary.html    Glossary  (content comes from Contentful — see below)
news.html               News      (content comes from Contentful — see below)

styles.css              All styling + light/dark theme tokens
app.js                  Homepage interactions: typewriter command bar, scroll
                        reveals, nav condense, theme toggle, and the LightRays
                        WebGL background (vanilla port of React Bits LightRays)
partials.js             Shared <nav> + <footer>, injected into every sub‑page
cms.js                  Contentful fetch/render for glossary + news
assets/                 SVG product mockups (Fund / Portfolio / Gainers / Earn)
```

## Theming

- Light/dark toggle lives in the nav; preference is saved to `localStorage`.
- Dark mode: white light‑rays. Light mode: the same rays recolored to a soft
  rainbow. A no‑flash init script in each page's `<head>` applies the saved theme
  before first paint.

## Contentful (glossary + news) — action needed

`crypto-glossary.html` and `news.html` are wired to render from Contentful via
`cms.js`, but the credentials/content model still need to be filled in:

- Space ID, Content Delivery API token, environment (`master`)
- Content type IDs + field IDs for the glossary term and news article types

Add these to `cms.js` (keep the **read‑only Delivery** token only — never commit a
Content Management token). Until then, those two pages show an empty/loading state.

## Notes

- Cache‑busting: CSS/JS are referenced with `?v=N` query strings — bump on change.
- The legal + about pages were generated from the current ulys.ai content.
