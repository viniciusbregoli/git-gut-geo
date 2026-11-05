# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TypeScript + React + Vite frontend, a small local Node server, SQLite for progress and the fetched deck. Vitest for tests, GitHub Actions CI (lint, tsc, tests). Runs only on the owner's machine.

## Users

One person: the owner, a total GeoGuessr beginner who wants to get very good at No Move / NMPZ play. They train 15 to 20 minutes a day at their own computer, keyboard first, between or before playing real games.

## Product Purpose

git-gut-geo turns the community's country guides into a daily spaced-repetition habit. It shows a real clue (a bollard, a plate, a pole, a road line, a script), asks which country it belongs to, and schedules the next review with FSRS so knowledge sticks. Success is the owner recognising countries from a single frame in real games, measured in the tool by retention per clue type and the share of countries mastered.

## Positioning

Study sites like Plonk It are references you read; this tool makes you recall. It schedules clue reviews by forgetting curve, starts with world-wide eliminators (driving side, script) before country specifics, and escalates answers from multiple choice to clicking the country on a world map, so map knowledge is trained alongside clues. Stage 2 will feed the owner's own game mistakes (which countries they confuse) back into the review queue.

## Operating Context

- Daily review session: due cards plus about 10 new cards, 15 to 20 minutes.
- Card prompt is a clue image (or a fundamentals prompt); answer by keys 1 to 4 while a card is new, by clicking the country on a world map once familiar; the full tip text and source are shown on reveal.
- Per-country browse page to read a guide before or after its cards appear.
- Progress view: today's queue, retention per clue type, world map coloured by country mastery.
- Content is refreshed by a local fetch script; it is never part of the public repo.

## Capabilities and Constraints

- Content source: Plonk It (plonkit.net), licensed CC BY-NC-SA 4.0. Every card shows attribution and a link to its source guide. Fetched text and images live in a gitignored data folder and are never committed or redistributed.
- Cards: a fundamentals deck (driving side, script, about two per country) front-loaded in week one, then one card per Plonk It tip. Country-level ("Identifying X") tips first; region-specific tips unlock per country once its country-level cards mature. Tips tagged `moving info` are excluded. Any card can be suspended.
- Order: by clue type (driving side, scripts, Google car and coverage, plates, bollards, poles, then the rest), most frequent countries first within each type.
- Scheduling: FSRS via ts-fsrs, 90% target retention.
- Keyboard first: single-key actions ignored while typing, Esc to close or go back, a Cmd+K command palette, a `?` shortcut overlay, visible key hints, focus management on overlays.
- Never assists during live games; it is a training tool only.
- Stage 2 (later): import the owner's game history from a GeoAnalyzr export to find confused country pairs and distance lost per country.
- The repository is public; no fetched content in git.

## Evidence on Hand

- Plonk It guide index and per-country embedded data (tips with images, text, clue tags such as bollard, pole, license plates, roadline, language, vegetation, coverage, architecture, landscape).
- No user statistics exist yet; any progress numbers shown before real reviews are synthetic and must be labelled as such.

## Product Principles

1. Recall beats reading: every screen either asks or explains an answer.
2. Eliminate first: broad clues before country trivia.
3. Respect the 15-minute session: the queue is finite and the end of a session is visible.
4. The keyboard is the primary input; the mouse is optional everywhere except the map.
5. Credit the source on every card.

## Accessibility & Inclusion

WCAG AA contrast, full keyboard operation, visible focus, reduced-motion support. Map answers must have a keyboard path (type-ahead country search) in addition to clicking.
