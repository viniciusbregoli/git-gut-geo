<img src="assets/icon.svg" width="64" height="64" alt="">

# git-gut-geo

A local, keyboard-first trainer for getting good at GeoGuessr's No Move and NMPZ modes. It turns the community's country guides into a daily spaced-repetition habit: you see a clue (a bollard, a plate, a pole, a road line, a script), name the country, and the scheduler decides when you see it again.

It is a training tool only. It never runs alongside a live game.

## Requirements

- Node.js 24 or newer (it uses the built-in `node:sqlite` module and runs TypeScript directly)
- pnpm 11

## Getting started

```sh
pnpm install
pnpm dev        # API on 127.0.0.1:4317, app on http://localhost:5317
```

`pnpm build && pnpm start` serves the built app and the API together on port 4317.

## Content and licensing

Clue content comes from [Plonk It](https://www.plonkit.net), licensed [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). It is fetched into `data/plonkit/`, which is gitignored: fetched text and images are for personal use and are never committed to this repository. Every card credits its source guide.

```sh
pnpm fetch:plonkit                   # every guide that changed since the last run
pnpm fetch:plonkit --only portugal   # one guide (repeat --only for more)
pnpm fetch:plonkit --force           # re-fetch even if a guide is unchanged
```

The script reads Plonk It's guide index, then each country page's embedded data, one page every 2 seconds and one image every 250 ms (`--page-delay` and `--image-delay` change these). Images come from the same resize endpoint the site's own pages use, and each one takes a few seconds the first time it is rendered, so a first full run takes a long while. Later runs only fetch guides whose update date changed, plus any image that failed before. Set `FIRECRAWL_URL` (for example `http://127.0.0.1:3002`) to retry pages a plain request cannot read through a self-hosted Firecrawl.

Some guide images answer their own question: a caption naming the country, a coverage map, a comparison labelled "US & Canada" and "Europe". Most region tips also carry a small locator map in a corner. `pnpm check:images` sends each downloaded image once to Gemini (`gemini-3.5-flash-lite`, through the Batch API) and caches the verdicts in `data/plonkit/vision.json`. On its next start the server reads them:

- When the giveaway is a small added part (a locator map, a caption, a pasted plate), the card covers it while you answer and uncovers it on the reveal.
- When the whole image gives the answer away (a full map, a labelled comparison), the tip stays out of the deck. It is still in the guide for reading.

```sh
pnpm check:images --dry-run      # how many images are left and the most it would cost
GEMINI_API_KEY=... pnpm check:images             # stops at US$1 by default
GEMINI_API_KEY=... pnpm check:images --max-usd 3 # raise the cap
```

One image costs about US$0.00013 in a batch, so the full set of roughly 6,000 images is under a dollar. The cap counts each image at a higher estimate, so a run stops before spending it. Images already judged are never sent again, unless the prompt changes (`PROMPT_VERSION` in `scripts/plonkit/vision.ts`). A batch can take a few minutes to start.

No fetched Plonk It content is published in this repository.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Runs the API and the Vite dev server |
| `pnpm build` | Builds the frontend into `dist/` |
| `pnpm start` | Serves `dist/` and the API |
| `pnpm fetch:plonkit` | Fetches Plonk It guides and images into `data/plonkit/` |
| `pnpm check:images` | Flags tip images that give their answer away, so they stay out of the deck |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript, for the web and Node projects |
| `pnpm test` | Vitest |
