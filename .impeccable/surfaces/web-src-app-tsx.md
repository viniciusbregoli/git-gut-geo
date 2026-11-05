---
version: 1
slug: "web-src-app-tsx"
primary_target: "web/src/App.tsx"
related_targets: []
---

# Surface brief: git-gut-geo app (review, browse, progress)

Scope: the whole local web app shell and its three work areas (Review, Browse, Progress). Visitor mode: Operate.

Audience and job: the owner, a GeoGuessr beginner, runs a 15-20 minute daily review session at the desk in the evening, keyboard first. Content: Plonk It tips (image, text, clue tags) plus a fundamentals deck. Constraints: dark primary theme for a dim room (a light theme follows the OS); no gamification (no confetti, mascots, XP, streak guilt); not an admin panel; nothing busy or slow; never imitate GeoGuessr's own look.

Memorable moment: on reveal, the answer country lights up on the night map in city-light dots.

## Direction contract

THESIS: The world is dark and lights up as you learn it; every country's mastery is drawn as city lights seen from orbit. It refuses the category default of a neutral dark flashcard app with one blue accent.

OWN-WORLD: Night-orbit palette: ground #06080E, panel #0D1524, raised #16243A, coastline #2A3B55, text #E6ECF7, muted #8A9BB5, sodium amber #F2B65A (learned), pale light #FFE4AE (mastered, primary emphasis), alert #E25C4B (missed today). Lights are crisp dots, never glows or halos. One family, Hanken Grotesk, tabular numerals; key chips on every action.

STORY: The owner opens the app, sees how many cards are due and how much of the world is lit, answers each clue with 1-4 or by clicking the map, reads the tip on reveal with its Plonk It credit, and ends the session watching new lights appear.

FIRST VIEWPORT: 64px top bar (git-gut-geo, Review/Browse/Progress tabs with R/B/P chips, card count and Cmd+K at right, a 2px amber session-progress line on its bottom edge). Centre: 40px prompt, 16:10 clue plate (~560px wide), credit line, four answer buttons with key chips, Space Reveal hint. Bottom 220px night strip: the world in dark land with thin coastlines, learned countries as amber dot fields, mastered as dense pale dots, a large "11 / 54 countries lit" count at left, legend at right.

FORM: Earth at Night (NASA Black Marble city-lights composites), the top-ranked grounded candidate, chosen by the user over the assigned Topographic Relief at Dusk. seed: none (unavailable)

Signature interaction: lighting a country. On reveal the answer country's dot field fades in over about 200ms on the night strip (instant with reduced motion); the map is also the answer surface for familiar cards.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
