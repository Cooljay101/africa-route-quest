# Africa Route Quest — Connect the Continent

A pass-and-play geography game for **Grade 6** learners in South Africa. Two to four teams take turns on **one device** (a laptop, an interactive whiteboard or a tablet). They find countries on a political map of Africa, travel between 12 hubs and claim routes by naming the borders they cross.

It runs entirely in the browser. You don't need to install anything, create an account or have internet once it has loaded.

## How to start

- **Online:** open the game's link (see "Hosting" below).
- **Offline:** download or copy this folder and double-click `index.html`.

## How to play

1. **Set up:** choose 2–4 teams. Give each team a name, a colour and a starting hub, and pick a timer length (25 minutes is the default).
2. **Location card (2 points):** the team gets a country. They tap it on the map, then choose its capital city from 4 options. If they get it wrong (or pass), the **next team can steal for 1 point**. Then the game shows the answer.
3. **Roll the die and move:**
   - 1–2 = move 1 route
   - 3–4 = move up to 2 routes
   - 5–6 = move up to 3 routes

   Tap a glowing hub to travel along a route line. You can only move between hubs that a line joins.
4. **Challenge card (1–3 points):** answer the card drawn at your new hub. There are three kinds of card, each with its own colour and icon:
   - 🌊 **Ocean & Map** (blue)
   - 📍 **Location** (green)
   - ⚡ **Challenge** (orange)
5. **Claim the route (+2 bonus points, optional):** name the two countries the route you just travelled connects and the border(s) it crosses. If you're right, the route turns your colour.
6. **Pass** is on every question. Passing never costs you points.
7. **Before every answer** the game reminds you: *"Check the map first! Someone who didn't choose the answer must explain it."*

**The game ends** when every team has answered **6 challenge cards** or when the **timer runs out**. The highest score wins. If the top scores are tied, the tied teams play a **sudden-death tiebreaker**: each team finds one country on the map, and if exactly one team gets it right, that team wins. If more than one team gets it right, or nobody does, they play another round (up to 5).

### Teacher controls (top bar)

| Button | What it does |
|---|---|
| ⏸ Pause | Pauses or resumes the timer |
| 🏷️ Labels | Shows or hides country and capital names on the map (easier or harder) |
| 💬 Tooltips | Shows a country's name when you hover over it or tap it. To keep "find the country" questions fair, names stay hidden while a team is searching unless Labels is on. |
| 🗺️ World | Shows or hides the small Equal Earth world map |
| End game | Ends the game straight away and shows the scores |
| ＋ / － / ⟲ | Zoom in, zoom out and reset the map. You can also pinch or scroll to zoom and drag to move the map. |

Every card has a **🔊 Read aloud** button that uses the browser's built-in voice.

## Editing the questions

All the content lives in **`data/questions.js`**. You can open it in any plain-text editor (Notepad, TextEdit in plain-text mode, or VS Code). It has four sections:

- `countries`: all 54 African UN member states, with their capital, whether they are landlocked, and notes
- `hubs`: the 12 board hubs
- `routes`: the 15 routes, the countries they connect and the borders they cross
- `challengeCards`: the challenge cards (there are 55)

**To add a multiple-choice card**, copy an existing card and change the text:

```js
{ type: "ocean", points: 2, kind: "mc", q: "Which ocean is east of Madagascar?",
  options: ["Indian Ocean", "Atlantic Ocean", "Pacific Ocean", "Arctic Ocean"], answer: "Indian Ocean",
  explain: "Madagascar is surrounded by the Indian Ocean." },
```

**To add a "tap the map" card**, list the country names that count as correct. Spell them exactly as they appear in the `countries` list:

```js
{ type: "location", points: 2, kind: "map", q: "Tap Namibia on the map.", answer: ["Namibia"],
  explain: "Namibia is on the Atlantic coast, north-west of South Africa." },
```

Rules:
- `type` must be `"ocean"`, `"location"` or `"challenge"`.
- `points` must be 1, 2 or 3.
- For multiple-choice cards, `answer` must match one of the `options` exactly, including capital letters.
- Keep the quotes, commas and brackets.

Save the file, then refresh the game page to see your changes.

### Checking your edits (optional)

If you have [Node.js](https://nodejs.org) installed, run this in the game folder:

```
node tools/check-data.js
```

It checks that every country name matches the map file, that capital stars sit inside their countries, that there are 16 landlocked countries, that every card's answer is valid, and that each route line passes through the countries it says it does. The game also shows a warning on its title screen if a country name in the data doesn't match the map.

## Content notes

- All 54 African UN member states are included. Western Sahara is shown on the map as a disputed territory but is not one of the game's countries.
- **Lagos is a hub but not a capital.** Nigeria's capital is Abuja, and the game says so wherever Lagos appears.
- South Africa has three capitals: Pretoria, Cape Town and Bloemfontein. The game accepts any of them and explains all three.
- Routes are simplified learning routes, not real roads.

## Technical notes

- Plain HTML, CSS and JavaScript. There is no build step, no framework and no server.
- The maps use [D3](https://d3js.org) with the **Equal Earth** projection, drawn from the [world-atlas](https://github.com/topojson/world-atlas) `countries-50m` map data (Natural Earth). The libraries and data are stored in `vendor/` and `data/`, so the game doesn't depend on any CDN. `data/countries-50m.js` is the same map data wrapped as a script so the game also works when you double-click `index.html`.
- Licences: D3 and topojson-client (ISC) are in `vendor/`. world-atlas (ISC) is in `data/`. The Natural Earth map data is public domain.

## Hosting

The game is hosted for free on GitHub Pages. Any change you push to the `main` branch goes live within a minute or two.
