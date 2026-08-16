# Harmonies Score Tracker

A tiny, no-backend score tracker for the [Harmonies](https://www.libellud.com/en/our-games/harmonies/) board game. Built to sit on the table (or a phone) while you play.

**Live site:** enable GitHub Pages for this repo (Settings → Pages → Deploy from branch → `main` / `/ (root)`) and it'll be served at `https://dpaskov91.github.io/bg-harmonies/`.

## Features

- 2–4 players, with names and a color tag matching the game's landscape colors
- Quick score entry — just type each player's total for the game
- Optional **detailed breakdown** calculator (trees, mountains, fields, river, buildings, animal cards, Nature's Spirit cards) that auto-sums to the total using the base-game scoring formulas
- Live leaderboard: running total, games won, average, and best game
- Session history: every game played this session, expandable to see the breakdown, deletable if you fat-fingered something
- Built-in scoring quick-reference (with a link to the official rules)
- Export/import your session as a JSON file (back it up or hand it to a friend)
- Everything is saved to `localStorage` — no account, no server, no tracking. Data lives only in your browser.

## Local development

It's plain HTML/CSS/JS — no build step. Just serve the folder:

```bash
python3 -m http.server 8000
```

then open `http://localhost:8000`.

## Notes

- Scoring formulas match the Harmonies base game (trees/mountains: 1/3/7 pts for stack size 1/2/3; fields: flat 5 pts per group; river: 2/5/8/11/15 for length 2–6, +4 per token beyond; buildings: flat 5 pts). Mountain adjacency and building-surround conditions are judgment calls you make at the table — the app just adds up what you tell it. Double-check edge cases against the [official rules](https://www.libellud.com/en/resources/harmonies/).
