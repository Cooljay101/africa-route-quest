/*
  Data checker for Africa Route Quest.
  Run from the project folder:   node tools/check-data.js
  It checks that data/questions.js matches the map file and is internally consistent.
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const d3 = require(path.join(root, "vendor/d3.min.js"));
const topojson = require(path.join(root, "vendor/topojson-client.min.js"));

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "data/questions.js"), "utf8"), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(root, "data/countries-50m.js"), "utf8"), sandbox);
const D = sandbox.window.GAME_DATA;
const topo = sandbox.window.WORLD_TOPO;

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const features = topojson.feature(topo, topo.objects.countries).features;
const topoNames = new Map(features.map((f) => [f.properties.name, f]));
const byName = new Map(D.countries.map((c) => [c.name, c]));

// 1. Countries
if (D.countries.length !== 54) err(`Expected 54 countries, found ${D.countries.length}`);
if (byName.size !== D.countries.length) err("Duplicate country names in the countries list");
const landlocked = D.countries.filter((c) => c.landlocked).map((c) => c.name).sort();
const expectedLandlocked = ["Botswana", "Burkina Faso", "Burundi", "Central African Republic", "Chad", "Eswatini",
  "Ethiopia", "Lesotho", "Malawi", "Mali", "Niger", "Rwanda", "South Sudan", "Uganda", "Zambia", "Zimbabwe"].sort();
if (JSON.stringify(landlocked) !== JSON.stringify(expectedLandlocked)) err(`Landlocked list mismatch: ${landlocked.join(", ")}`);
for (const c of D.countries) {
  if (c.island && c.landlocked) err(`${c.name}: an island can't be landlocked`);
  const names = [c.topo || c.name, ...(c.topoAlso || [])];
  for (const n of names) {
    const f = topoNames.get(n);
    if (!f) { err(`${c.name}: map name "${n}" not found in countries-50m`); continue; }
  }
  const main = topoNames.get(c.topo || c.name);
  if (main) {
    const parts = names.map((n) => topoNames.get(n)).filter(Boolean);
    const inside = parts.some((f) => d3.geoContains(f, [c.lon, c.lat]));
    if (!inside) (c.island ? warn : err)(`${c.name}: capital point for ${c.capital} is not inside the country shape${c.island ? " (small island — OK if close)" : ""}`);
  }
  for (const x of c.extraCapitals || []) {
    if (main && !d3.geoContains(main, [x.lon, x.lat])) err(`${c.name}: extra capital ${x.city} not inside the country`);
  }
  for (const t of c.tricks || []) if ((c.capitals || [c.capital]).includes(t)) err(`${c.name}: trick city ${t} is a real capital`);
}

// Which map shapes are in Africa but not in our list (should only be Western Sahara)
const africaTopo = new Set(D.countries.flatMap((c) => [c.topo || c.name, ...(c.topoAlso || [])]));
const africaBox = (f) => { const [[x0, y0], [x1, y1]] = d3.geoBounds(f); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; return cx > -26 && cx < 60 && cy > -36 && cy < 34; };
const unmatched = features.filter((f) => africaBox(f) && !africaTopo.has(f.properties.name)).map((f) => f.properties.name);
console.log("Map shapes in the Africa area not used as game countries:", unmatched.join(", ") || "none");

// 2. Hubs
const hubIds = new Set(D.hubs.map((h) => h.id));
if (D.hubs.length !== 12) err(`Expected 12 hubs, found ${D.hubs.length}`);
for (const h of D.hubs) {
  const c = byName.get(h.country);
  if (!c) { err(`Hub ${h.city}: country ${h.country} not in list`); continue; }
  const accepted = c.capitals || [c.capital];
  if (h.isCapital !== accepted.includes(h.city)) err(`Hub ${h.city}: isCapital=${h.isCapital} but country capitals are ${accepted.join("/")}`);
  if (!d3.geoContains(topoNames.get(c.topo || c.name), [h.lon, h.lat])) warn(`Hub ${h.city} point not inside ${c.name}`);
}

// 3. Routes — check the drawn line really passes through the countries it claims
const allBorders = new Set();
for (const r of D.routes) {
  if (!hubIds.has(r.a) || !hubIds.has(r.b)) err(`Route ${r.id}: unknown hub`);
  const ha = D.hubs.find((h) => h.id === r.a), hb = D.hubs.find((h) => h.id === r.b);
  if (ha && hb && JSON.stringify([ha.country, hb.country]) !== JSON.stringify(r.countries)) err(`Route ${r.id}: countries should be ${ha.country}, ${hb.country}`);
  for (const n of [...r.countries, ...r.via, ...r.wrongCountries]) if (!byName.has(n)) err(`Route ${r.id}: country "${n}" not in list`);
  for (const b of r.wrongBorders) if (r.borders.includes(b)) err(`Route ${r.id}: wrong border "${b}" is also a right answer`);
  for (const n of r.wrongCountries) if (r.countries.includes(n)) err(`Route ${r.id}: wrong country "${n}" is also a right answer`);
  r.borders.forEach((b) => allBorders.add(b));
  // sample the line
  const seq = [];
  for (let i = 0; i < r.path.length - 1; i++) {
    const interp = d3.geoInterpolate(r.path[i], r.path[i + 1]);
    for (let step = 0; step <= 100; step++) {
      const p = interp(step / 100);
      const f = features.find((ff) => africaTopo.has(ff.properties.name) && d3.geoContains(ff, p));
      const name = f ? (D.countries.find((c) => [c.topo || c.name, ...(c.topoAlso || [])].includes(f.properties.name)) || {}).name : "(water/other)";
      if (seq[seq.length - 1] !== name) seq.push(name);
    }
  }
  const land = seq.filter((n) => n !== "(water/other)" && !(r.checkIgnore || []).includes(n)).filter((n, i, arr) => n !== arr[i - 1]);
  const expected = [r.countries[0], ...r.via, r.countries[1]];
  const ok = JSON.stringify(land) === JSON.stringify(expected);
  console.log(`${ok ? "OK  " : "WARN"} ${r.id}: line passes ${seq.join(" → ")}`);
  if (!ok) warn(`Route ${r.id}: drawn line passes ${land.join(" → ")}, expected ${expected.join(" → ")}`);
}

// 4. Challenge cards
const types = { ocean: 0, location: 0, challenge: 0 };
D.challengeCards.forEach((c, i) => {
  const label = `Card ${i + 1} ("${c.q.slice(0, 40)}…")`;
  if (!(c.type in types)) err(`${label}: bad type ${c.type}`); else types[c.type]++;
  if (![1, 2, 3].includes(c.points)) err(`${label}: points must be 1–3`);
  if (!c.explain) err(`${label}: missing explanation`);
  if (c.kind === "mc") {
    if (!Array.isArray(c.options) || !c.options.includes(c.answer)) err(`${label}: answer not in options`);
    if (new Set(c.options).size !== c.options.length) err(`${label}: duplicate options`);
  } else if (c.kind === "map") {
    if (!Array.isArray(c.answer) || !c.answer.length) err(`${label}: map answer must be a list`);
    else for (const n of c.answer) if (!byName.has(n)) err(`${label}: map answer "${n}" not in countries list`);
  } else err(`${label}: kind must be "mc" or "map"`);
});
if (D.challengeCards.length < 40) err(`Need at least 40 challenge cards, found ${D.challengeCards.length}`);
console.log(`\nChallenge cards: ${D.challengeCards.length} (Ocean & Map ${types.ocean}, Location ${types.location}, Challenge ${types.challenge})`);
console.log(`Countries: ${D.countries.length}, landlocked: ${landlocked.length}`);

warnings.forEach((w) => console.log("WARNING:", w));
errors.forEach((e) => console.log("ERROR:", e));
console.log(errors.length ? `\n${errors.length} error(s) found.` : "\nAll checks passed ✔");
process.exit(errors.length ? 1 : 0);
