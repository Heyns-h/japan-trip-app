# japan-trip-app

**Japan in December**: a map of the places we want to see, with December tips, sightseeing
trains and a shared route planner. It reads the private `japan-trip-data` repository through
the GitHub REST API, using a token entered on each device.

**This repository holds no trip data and no secrets.** Only `docs/` is published (GitHub
Pages, "Deploy from a branch", `main` / `/docs`), and the published site is public, so
nothing private (bookings, dates, names) may ever be placed in `docs/`. The photos in
`docs/images/` are public Wikipedia thumbnails, each credited on its card.

## Layout

| Path | Contents |
|---|---|
| `docs/index.html` | The app shell, with a content security policy that allows only this site, `api.github.com` and the Esri map tiles |
| `docs/app.css` | Styles (light and dark) and the self-hosted font faces |
| `docs/js/config.js` | Which repository holds the data (not secret) |
| `docs/js/github.js` | Read and write `places.json` and `plan.json` via the Contents API; demo store for localhost |
| `docs/js/model.js` | Travel legs, plan edits, links: pure functions, no DOM |
| `docs/js/views.js` | HTML for each screen: pure functions, testable without a browser |
| `docs/js/app.js` | State, map, token handling, loading and saving |
| `docs/images/` | Attraction thumbnails, named `<area>--<item>.jpg` |
| `docs/vendor/` | Leaflet 1.9.4 (BSD-2-Clause, licence included) |
| `docs/fonts/` | Shippori Mincho B1, Zen Kaku Gothic New, IBM Plex Mono (Latin subsets, WOFF2) with their SIL Open Font License texts |
| `docs/manifest.webmanifest`, `docs/icons/` | Home-screen install |
| `tests/app.test.mjs` | `npm test`; Node 18 or later, no dependencies |
| `tools/make_demo.mjs` | Copies the data files from a sibling `japan-trip-data` checkout into `docs/demo/` (git-ignored) |
| `tools/make_icons.py` | Regenerates the icons (needs Pillow) |

## How the shared plan works

The plan is `plan.json` in `japan-trip-data`, so everyone with a token sees the same list.
Each change (add, remove, move, clear) is saved as a commit, named after the device's
person ("Plan (Heyns): add Kinkaku-ji"), so the repo history is the plan's history.

Before every save the app re-reads the plan and replays this device's edits on top, so two
people editing at once don't overwrite each other. The app also re-reads the plan when the
tab comes back into view and once a minute.

## Adding places

Edit `places.json` in `japan-trip-data`: add an area, or an item to an area's `items`.
An item's `id` is `<area>:<slug>` and must never change once it's in a plan. For a photo,
add `docs/images/<area>--<slug>.jpg` here and set `image` and `credit` on the item.
Run `npm test` with both repos checked out side by side; it checks ids, coordinates,
image files and hub routes.

## Running locally

```bash
npm run demo
```

Then open `http://localhost:8767/?demo`. Demo mode works only on `localhost`, reads
`docs/demo/` instead of GitHub and keeps the plan in that browser, so no token is needed.

## Each device

1. On GitHub, create a fine-grained token for this device only: repository access
   `japan-trip-data` only, permission **Contents: Read and write**, with an expiry date
   after the trip.
2. Open the app's address, paste the token and your name.
3. Add it to the home screen (Chrome on Android: *Add to Home screen*; Safari on iPhone:
   *Share → Add to Home Screen*).

To cut off a lost device, delete its token on GitHub.
