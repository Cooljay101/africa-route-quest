/* Africa Route Quest — game logic */
(function () {
  'use strict';
  const D = window.GAME_DATA;
  const M = window.ARQMap;

  const TEAM_COLOURS = [
    { name: 'Red', hex: '#e11d48' }, { name: 'Blue', hex: '#2563eb' }, { name: 'Green', hex: '#16a34a' },
    { name: 'Purple', hex: '#9333ea' }, { name: 'Orange', hex: '#ea580c' }, { name: 'Teal', hex: '#0d9488' }
  ];
  const DEFAULT_NAMES = ['Lions', 'Elephants', 'Rhinos', 'Leopards'];
  const DEFAULT_HUBS = ['capetown', 'cairo', 'dakar', 'nairobi'];
  const CHALLENGES_PER_TEAM = 6;
  const LOC_POINTS = 2, STEAL_POINTS = 1, CLAIM_POINTS = 2;
  const TIEBREAK_MAX_ROUNDS = 5;
  const TYPES = {
    ocean: { label: 'Ocean & Map', icon: '🌊', cls: 't-ocean' },
    location: { label: 'Location', icon: '📍', cls: 't-location' },
    challenge: { label: 'Challenge', icon: '⚡', cls: 't-challenge' },
    route: { label: 'Route Claim', icon: '🛤️', cls: 't-route' },
    move: { label: 'Move', icon: '🎲', cls: 't-move' },
    tiebreak: { label: 'Sudden Death', icon: '🏁', cls: 't-tiebreak' }
  };
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  const $ = (id) => document.getElementById(id);
  const hubById = new Map(D.hubs.map((x) => [x.id, x]));
  const hubName = (id) => hubById.get(id).city;
  const routeBetween = (a, b) => D.routes.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  const neighboursOf = (id) => D.routes.filter((r) => r.a === id || r.b === id).map((r) => (r.a === id ? r.b : r.a));
  const routeName = (r) => `${hubName(r.a)} – ${hubName(r.b)}`;
  const accepted = (c) => c.capitals || [c.capital];
  const pts = (n) => `${n} point${n === 1 ? '' : 's'}`;
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const listText = (arr) => (arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]);

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  /* ================= Speech ================= */
  const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  function speak(text) {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((x) => /en[-_]ZA/i.test(x.lang)) || voices.find((x) => /en[-_]GB/i.test(x.lang)) || voices.find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v;
    u.lang = v ? v.lang : 'en-ZA';
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
  }
  const stopSpeech = () => { if (canSpeak) window.speechSynthesis.cancel(); };
  const readBtn = (text) => (canSpeak ? h('button', { class: 'btn', onclick: () => speak(typeof text === 'function' ? text() : text), title: 'Read this card aloud' }, '🔊 Read aloud') : null);

  /* ================= Modal & toast ================= */
  let modalOpen = false;
  function showModal(...kids) {
    const box = $('modalBox');
    box.replaceChildren(...kids.filter(Boolean));
    $('modal').classList.remove('hidden');
    modalOpen = true;
    const first = box.querySelector('button');
    if (first) first.focus();
  }
  function closeModal() { $('modal').classList.add('hidden'); $('modalBox').replaceChildren(); modalOpen = false; }
  let toastTimer;
  function toast(msg, ms) {
    const t = $('toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 2800);
  }
  function confirmReminder(onOk) {
    showModal(
      h('div', { class: 'modal-ico', 'aria-hidden': 'true' }, '🔎'),
      h('h2', null, 'Check the map first!'),
      h('p', null, "Someone who didn't choose the answer must explain it."),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn btn-good btn-xl', onclick: () => { closeModal(); onOk(); } }, "✅ We've checked — submit"),
        h('button', { class: 'btn btn-xl', onclick: closeModal }, '↩ Go back'))
    );
  }
  function passDevice(teamIdx, title, onReady) {
    const t = S.teams[teamIdx];
    showModal(
      h('div', { class: 'modal-ico', 'aria-hidden': 'true' }, '📲'),
      h('p', null, title || 'Pass the device to'),
      h('div', { class: 'pass-team', style: `--team:${t.colour}` }, t.name),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn btn-primary btn-xl', onclick: () => { closeModal(); onReady(); } }, "We're ready! ➜"))
    );
  }

  /* ================= Screens ================= */
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }

  /* ================= Setup ================= */
  const setup = {
    n: 2, minutes: 25,
    teams: [0, 1, 2, 3].map((i) => ({ name: DEFAULT_NAMES[i], colour: TEAM_COLOURS[i].hex, hub: DEFAULT_HUBS[i] }))
  };

  function renderSetup() {
    document.querySelectorAll('#teamCount .seg-btn').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.n === setup.n)));
    document.querySelectorAll('#timerChoice .seg-btn').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.min === setup.minutes)));
    const rows = setup.teams.slice(0, setup.n).map((t, i) => {
      const nameId = `teamName${i}`, hubId = `teamHub${i}`;
      return h('div', { class: 'team-row', style: `--team:${t.colour}` },
        h('div', null,
          h('label', { for: nameId }, `Team ${i + 1} name`),
          h('input', { type: 'text', id: nameId, value: t.name, maxlength: '18', autocomplete: 'off',
            oninput: (e) => { t.name = e.target.value; } })),
        h('div', null,
          h('label', null, 'Colour'),
          h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': `Team ${i + 1} colour` },
            TEAM_COLOURS.map((c) => h('button', {
              class: 'swatch', style: `background:${c.hex}`, role: 'radio', 'aria-label': c.name, title: c.name,
              'aria-checked': String(t.colour === c.hex),
              onclick: () => {
                // if another team has this colour, swap with them so colours stay unique
                const other = setup.teams.slice(0, setup.n).find((o) => o !== t && o.colour === c.hex);
                if (other) other.colour = t.colour;
                t.colour = c.hex; renderSetup();
              }
            })))),
        h('div', null,
          h('label', { for: hubId }, 'Starting hub'),
          h('select', { id: hubId, onchange: (e) => { t.hub = e.target.value; } },
            D.hubs.map((x) => h('option', { value: x.id, selected: x.id === t.hub }, `${x.city} (${x.country === 'Democratic Republic of the Congo' ? 'DR Congo' : x.country})`))))
      );
    });
    $('teamRows').replaceChildren(...rows);
    $('setupError').textContent = '';
  }

  function startGame() {
    const teams = setup.teams.slice(0, setup.n);
    const names = teams.map((t) => t.name.trim());
    if (names.some((n) => !n)) { $('setupError').textContent = 'Please give every team a name.'; return; }
    if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) { $('setupError').textContent = 'Each team needs a different name.'; return; }
    S = {
      teams: teams.map((t, i) => ({ id: i, name: names[i], colour: t.colour, hub: t.hub, score: 0, challenges: 0, claims: 0 })),
      cur: 0, phase: 'idle', turn: null, claimed: {}, over: false,
      locDeck: shuffle(D.countries), chDeck: shuffle(D.challengeCards),
      timer: { total: setup.minutes * 60000, remaining: setup.minutes * 60000, running: false, last: 0 },
      tb: null
    };
    show('screen-game');
    $('btnPause').disabled = false;
    $('btnEndGame').disabled = false;
    M.clearMarks(); M.resetZoom();
    renderAll();
    startTimer();
    passDevice(0, 'First up! Pass the device to', startTurn);
  }

  /* ================= Timer ================= */
  let timerId = null;
  function startTimer() {
    clearInterval(timerId);
    S.timer.running = true; S.timer.last = Date.now();
    timerId = setInterval(tick, 250);
    renderTimer();
  }
  function tick() {
    if (!S || S.over || !S.timer.running) return;
    const now = Date.now();
    S.timer.remaining -= now - S.timer.last; S.timer.last = now;
    if (S.timer.remaining <= 0) { S.timer.remaining = 0; renderTimer(); timeUp(); return; }
    renderTimer();
  }
  function renderTimer() {
    const el = $('timer');
    if (S.tb) { el.textContent = 'Tiebreak'; el.className = 'timer paused'; return; }
    const s = Math.ceil(S.timer.remaining / 1000);
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    el.className = 'timer' + (!S.timer.running ? ' paused' : s <= 60 ? ' low' : '');
    $('btnPause').textContent = S.timer.running ? '⏸ Pause' : '▶ Resume';
  }
  function togglePause() {
    if (!S || S.over || S.tb) return;
    S.timer.running = !S.timer.running;
    S.timer.last = Date.now();
    renderTimer();
    toast(S.timer.running ? 'Timer running ▶' : 'Timer paused ⏸');
  }
  function timeUp() {
    clearInterval(timerId);
    S.over = true;
    M.setMode('none'); stopSpeech();
    showModal(
      h('div', { class: 'modal-ico', 'aria-hidden': 'true' }, '⏰'),
      h('h2', null, "Time's up!"),
      h('p', null, "Great travelling, everyone. Let's see the final scores."),
      h('div', { class: 'modal-actions' }, h('button', { class: 'btn btn-primary btn-xl', onclick: () => { closeModal(); endGame('time'); } }, 'See results 🏆'))
    );
  }

  /* ================= Game state ================= */
  let S = null;
  const team = (i) => S.teams[i == null ? S.cur : i];
  function drawLocation() {
    if (!S.locDeck.length) S.locDeck = shuffle(D.countries);
    return S.locDeck.pop();
  }
  function drawChallenge() {
    if (!S.chDeck.length) S.chDeck = shuffle(D.challengeCards);
    return S.chDeck.pop();
  }
  function capitalOptions(c) {
    const ok = accepted(c);
    const correct = ok[Math.floor(Math.random() * ok.length)];
    const tricks = shuffle(c.tricks || []).slice(0, 2);
    const regional = shuffle(D.countries.filter((o) => o !== c && o.region === c.region).map((o) => o.capital));
    const others = shuffle(D.countries.filter((o) => o !== c).map((o) => o.capital));
    const opts = [correct];
    for (const x of [...tricks, ...regional, ...others]) {
      if (opts.length >= 4) break;
      if (!opts.includes(x) && !ok.includes(x)) opts.push(x);
    }
    return shuffle(opts);
  }
  function nextActiveTeam(from) {
    for (let i = 1; i <= S.teams.length; i++) {
      const idx = (from + i) % S.teams.length;
      if (S.teams[idx].challenges < CHALLENGES_PER_TEAM) return idx;
    }
    return -1;
  }
  const allDone = () => S.teams.every((t) => t.challenges >= CHALLENGES_PER_TEAM);

  /* ================= Turn: 1. Location card ================= */
  function startTurn() {
    if (S.over) return;
    S.turn = { path: [], hubsVisited: [team().hub], lastRoute: null, loc: null, roll: null, movesLeft: 0, moved: 0, ch: null, claim: null };
    const c = drawLocation();
    S.turn.loc = { country: c, options: capitalOptions(c), answerer: S.cur, steal: false, sel: null, cap: null, result: null };
    S.phase = 'loc';
    M.clearMarks();
    M.setMode('country');
    renderAll();
  }

  function locCard() {
    const L = S.turn.loc, ans = team(L.answerer), done = !!L.result;
    const c = L.country;
    const picked = L.sel
      ? (M.namesVisible() ? `You picked: ${L.sel}` : 'You picked a country (shown in yellow). Tap another one to change it.')
      : 'Tap a country on the map…';
    const okCaps = accepted(c);
    const body = [
      h('div', { class: 'who', style: `--team:${ans.colour}` }, h('span', { class: 'dot' }), `${ans.name} answering`),
      L.steal && !done ? h('div', { class: 'steal-banner' }, `🔁 Steal chance! ${ans.name}, get it right for ${pts(STEAL_POINTS)}.`) : null,
      h('div', null, 'Find this country on the map:'),
      h('div', { class: 'big-target' }, c.name),
      h('div', { class: 'step' }, '1. Tap it on the map'),
      h('div', { class: 'pick-status' + (L.sel ? ' done' : '') }, done ? `Picked: ${L.result.sel || '— (passed)'}` : picked),
      h('div', { class: 'step' }, '2. Choose its capital city'),
      h('div', { class: 'options two' }, L.options.map((o) => {
        let state = '';
        if (done) state = okCaps.includes(o) ? 'right' : (o === L.result.cap ? 'wrong' : '');
        return h('button', {
          class: `btn opt ${state}`, 'aria-pressed': String(L.cap === o), disabled: done,
          onclick: () => { L.cap = o; renderCard(); }
        }, h('span', { class: 'mark', 'aria-hidden': 'true' }, L.cap === o ? '✓' : ''), o);
      }))
    ];
    if (!done) {
      body.push(h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-primary grow', disabled: !(L.sel && L.cap), onclick: () => confirmReminder(evaluateLoc) }, 'Submit answer'),
        h('button', { class: 'btn', onclick: passLoc, title: 'Pass — no points lost' }, 'Pass'),
        readBtn(() => `Location card. Find ${c.name} on the map. Then choose its capital city: ${L.options.join(', ')}.`)));
    } else {
      const r = L.result;
      const capText = okCaps.length > 1 ? `capitals: ${listText(okCaps)}` : `capital: ${c.capital}`;
      const explain = c.note || `${c.capital} is the capital of ${c.name}. ${c.name} is ${c.landlocked ? 'landlocked — it has no coastline' : c.island ? 'an island country, so it is coastal' : 'coastal — it has a coastline'}.`;
      let title;
      if (r.correct) title = `✔ Correct! +${pts(r.points)} for ${team(r.by).name}`;
      else if (r.passed) title = 'Passed — no points lost';
      else title = '✘ Not this time';
      const detail = [];
      if (!r.correct && r.sel && r.sel !== c.name) detail.push(`The country you tapped was ${r.sel}.`);
      if (!r.correct && r.cap && !okCaps.includes(r.cap)) detail.push(`${r.cap} is not the capital of ${c.name}.`);
      body.push(h('div', { class: `feedback ${r.correct ? 'good' : r.passed ? 'info' : 'bad'}` },
        h('div', { class: 'fb-title' }, title),
        h('div', { class: 'fb-answer' }, `Answer: ${c.name} — ${capText}`),
        detail.length ? h('div', null, detail.join(' ')) : null,
        h('div', null, explain)));
      body.push(h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-primary grow', onclick: beginRoll }, 'Next: roll the die 🎲'),
        readBtn(() => `${title}. ${c.name}, ${capText}. ${explain}`)));
    }
    return card('location', L.steal && !done ? `Steal · ${pts(STEAL_POINTS)}` : pts(LOC_POINTS), body);
  }

  function evaluateLoc() {
    const L = S.turn.loc;
    const ok = L.sel === L.country.name && accepted(L.country).includes(L.cap);
    if (ok) {
      const p = L.steal ? STEAL_POINTS : LOC_POINTS;
      team(L.answerer).score += p;
      finishLoc({ correct: true, points: p, by: L.answerer, sel: L.sel, cap: L.cap });
    } else if (!L.steal && S.teams.length > 1) {
      startSteal(`Not quite! The answer stays hidden — ${team((S.cur + 1) % S.teams.length).name} can steal for ${pts(STEAL_POINTS)}.`, { sel: L.sel, cap: L.cap });
    } else {
      finishLoc({ correct: false, sel: L.sel, cap: L.cap });
    }
  }
  function passLoc() {
    const L = S.turn.loc;
    if (!L.steal) startSteal(`${team(L.answerer).name} passed. ${team((S.cur + 1) % S.teams.length).name} can steal for ${pts(STEAL_POINTS)}!`, {});
    else finishLoc({ correct: false, passed: true, sel: L.sel, cap: L.cap, stealPass: true });
  }
  function startSteal(msg, first) {
    const L = S.turn.loc;
    L.first = first;
    L.steal = true;
    L.answerer = (S.cur + 1) % S.teams.length;
    L.sel = null; L.cap = null;
    M.clearMarks();
    const t = team(L.answerer);
    showModal(
      h('div', { class: 'modal-ico', 'aria-hidden': 'true' }, '🔁'),
      h('h2', null, 'Steal chance!'),
      h('p', null, msg),
      h('div', { class: 'pass-team', style: `--team:${t.colour}` }, t.name),
      h('div', { class: 'modal-actions' }, h('button', { class: 'btn btn-primary btn-xl', onclick: closeModal }, "Let's steal! ➜")));
    renderAll();
  }
  function finishLoc(result) {
    const L = S.turn.loc;
    // if the steal team passed, show the original team's wrong pick on the map
    if (result.stealPass && L.first) { result.sel = result.sel || L.first.sel; }
    L.result = result;
    S.phase = 'loc-result';
    M.setMode('none');
    M.reveal([L.country.name], result.sel);
    M.flashCapital(L.country.name);
    renderAll();
  }

  /* ================= Turn: 2. Roll & move ================= */
  function beginRoll() {
    S.phase = 'roll';
    M.clearMarks();
    renderAll();
  }
  function dieEl(v, rolling) {
    return h('div', { class: 'die' + (rolling ? ' rolling' : ''), role: 'img', 'aria-label': v ? `Die shows ${v}` : 'Die' },
      [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => h('span', { class: 'pip' + ((PIPS[v] || []).includes(i) ? ' on' : '') })));
  }
  const movesFor = (v) => (v <= 2 ? 1 : v <= 4 ? 2 : 3);
  const ruleEl = () => h('div', { class: 'move-rule' }, h('b', null, '1–2'), ' = 1 route · ', h('b', null, '3–4'), ' = up to 2 · ', h('b', null, '5–6'), ' = up to 3');

  function rollCard() {
    const t = team();
    const T = S.turn;
    return card('move', null, [
      h('div', { class: 'who', style: `--team:${t.colour}` }, h('span', { class: 'dot' }), `${t.name} at ${hubName(t.hub)}`),
      h('div', { class: 'q' }, 'Roll the die to travel!'),
      h('div', { class: 'die-zone' }, h('div', { id: 'dieSlot' }, dieEl(T.roll || 1, false)), ruleEl()),
      h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-primary btn-xl grow', id: 'btnRoll', onclick: rollDie }, '🎲 Roll the die'),
        readBtn('Roll the die. One or two: move one route. Three or four: move up to two routes. Five or six: move up to three routes.'))
    ]);
  }
  function rollDie() {
    const T = S.turn;
    if (T.rolling || T.roll) return;
    T.rolling = true;
    const btn = $('btnRoll'); if (btn) btn.disabled = true;
    const slot = $('dieSlot');
    const final = 1 + Math.floor(Math.random() * 6);
    let n = 0;
    const spin = setInterval(() => {
      n++;
      slot.replaceChildren(dieEl(1 + Math.floor(Math.random() * 6), true));
      if (n >= 11) {
        clearInterval(spin);
        T.rolling = false;
        if (S.over || S.turn !== T) return;
        T.roll = final;
        T.movesLeft = movesFor(final);
        S.phase = 'move';
        M.setMode('hub');
        renderAll();
      }
    }, 85);
  }
  function moveCard() {
    const t = team(), T = S.turn;
    const max = movesFor(T.roll);
    const exact = max === 1;
    return card('move', null, [
      h('div', { class: 'who', style: `--team:${t.colour}` }, h('span', { class: 'dot' }), `${t.name} at ${hubName(t.hub)}`),
      h('div', { class: 'die-zone' }, dieEl(T.roll, false),
        h('div', null,
          h('div', { class: 'moves-left' }, `You rolled ${T.roll}: move ${exact ? '1 route' : `up to ${max} routes`}`),
          h('div', { class: 'move-rule' }, `Routes left: ${T.movesLeft}`))),
      T.movesLeft > 0
        ? h('div', { class: 'pick-status' }, `Tap a glowing hub joined to ${hubName(t.hub)} by a route line.`)
        : h('div', { class: 'pick-status done' }, `Arrived at ${hubName(t.hub)}!`),
      T.hubsVisited.length > 1 ? h('p', { class: 'small-note' }, 'Your trip: ' + T.hubsVisited.map(hubName).join(' → ')) : null,
      h('div', { class: 'card-actions' },
        T.moved > 0 && T.movesLeft > 0 ? h('button', { class: 'btn btn-primary grow', onclick: stopMoving }, `Stop here at ${hubName(t.hub)}`) : null,
        readBtn(() => `You rolled ${T.roll}. Move ${exact ? 'one route' : `up to ${max} routes`}. Tap a glowing hub joined to ${hubName(t.hub)}.`))
    ]);
  }
  function onHub(id) {
    if (S.phase !== 'move' || modalOpen) return;
    const t = team(), T = S.turn;
    if (T.movesLeft <= 0) return;
    if (id === t.hub) { toast(`You're already in ${hubName(id)}. Tap a glowing hub to move.`); return; }
    const r = routeBetween(t.hub, id);
    if (!r) {
      toast(`Oops! There's no direct route from ${hubName(t.hub)} to ${hubName(id)}. Follow a line to a glowing hub.`, 3600);
      return;
    }
    t.hub = id;
    T.path.push(r.id); T.hubsVisited.push(id); T.lastRoute = r.id;
    T.movesLeft--; T.moved++;
    if (T.movesLeft === 0) {
      S.phase = 'arrived';
      M.setMode('none');
      renderAll();
      setTimeout(() => { if (!S.over && S.phase === 'arrived') beginChallenge(); }, 900);
    } else renderAll();
  }
  function stopMoving() {
    if (S.phase !== 'move' || S.turn.moved < 1) return;
    beginChallenge();
  }

  /* ================= Turn: 3. Challenge card ================= */
  function beginChallenge() {
    const cardData = drawChallenge();
    S.turn.ch = { card: cardData, options: cardData.kind === 'mc' ? (cardData.keepOrder ? cardData.options.slice() : shuffle(cardData.options)) : null, sel: null, result: null };
    S.phase = 'challenge';
    M.clearMarks();
    M.setMode(cardData.kind === 'map' ? 'country' : 'none');
    renderAll();
  }
  function challengeCard() {
    const t = team(), C = S.turn.ch, cd = C.card, done = !!C.result;
    const answers = cd.kind === 'map' ? cd.answer : [cd.answer];
    const body = [
      h('div', { class: 'who', style: `--team:${t.colour}` }, h('span', { class: 'dot' }),
        `${t.name} at ${hubName(t.hub)} · card ${Math.min(t.challenges + (done ? 0 : 1), CHALLENGES_PER_TEAM)} of ${CHALLENGES_PER_TEAM}`),
      h('div', { class: 'q' }, cd.q)
    ];
    if (cd.kind === 'mc') {
      const two = C.options.length === 2 || C.options.every((o) => o.length < 16);
      body.push(h('div', { class: 'options' + (two ? ' two' : '') }, C.options.map((o) => {
        let state = '';
        if (done) state = o === cd.answer ? 'right' : (o === C.result.sel ? 'wrong' : '');
        return h('button', { class: `btn opt ${state}`, 'aria-pressed': String(C.sel === o), disabled: done, onclick: () => { C.sel = o; renderCard(); } },
          h('span', { class: 'mark', 'aria-hidden': 'true' }, C.sel === o ? '✓' : ''), o);
      })));
    } else {
      const picked = C.sel ? (M.namesVisible() ? `You picked: ${C.sel}` : 'You picked a country (shown in yellow). Tap another one to change it.') : 'Tap a country on the map…';
      body.push(h('div', { class: 'pick-status' + (C.sel ? ' done' : '') }, done ? `Picked: ${C.result.sel || '— (passed)'}` : picked));
    }
    if (!done) {
      body.push(h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-primary grow', disabled: !C.sel, onclick: () => confirmReminder(evaluateChallenge) }, 'Submit answer'),
        h('button', { class: 'btn', onclick: () => finishChallenge({ correct: false, passed: true, sel: null }), title: 'Pass — no points lost' }, 'Pass'),
        readBtn(() => cd.q + (cd.kind === 'mc' ? ' The options are: ' + C.options.join('; ') + '.' : ' Tap your answer on the map.'))));
    } else {
      const r = C.result;
      const title = r.correct ? `✔ Correct! +${pts(cd.points)}` : r.passed ? 'Passed — no points lost' : '✘ Not quite';
      const ansText = answers.length > 1 ? `Right answers: ${listText(answers)}` : `Answer: ${answers[0]}`;
      body.push(h('div', { class: `feedback ${r.correct ? 'good' : r.passed ? 'info' : 'bad'}` },
        h('div', { class: 'fb-title' }, title),
        h('div', { class: 'fb-answer' }, ansText),
        h('div', null, cd.explain)));
      const lr = S.turn.lastRoute && D.routes.find((x) => x.id === S.turn.lastRoute);
      const owner = lr && S.claimed[lr.id] != null ? S.teams[S.claimed[lr.id]] : null;
      if (owner) body.push(h('p', { class: 'small-note' }, `The ${routeName(lr)} route already belongs to ${owner.name}.`));
      body.push(h('div', { class: 'card-actions' },
        lr && !owner
          ? h('button', { class: 'btn btn-primary grow', onclick: offerClaim }, 'Next: claim your route 🛤️')
          : h('button', { class: 'btn btn-primary grow', onclick: endTurn }, 'End turn ➜'),
        readBtn(() => `${title}. ${ansText}. ${cd.explain}`)));
    }
    return card(cd.type, pts(cd.points), body);
  }
  function evaluateChallenge() {
    const C = S.turn.ch, cd = C.card;
    const correct = cd.kind === 'map' ? cd.answer.includes(C.sel) : C.sel === cd.answer;
    finishChallenge({ correct, sel: C.sel });
  }
  function finishChallenge(result) {
    const C = S.turn.ch, cd = C.card, t = team();
    if (C.result) return;
    if (result.correct) t.score += cd.points;
    t.challenges++;
    C.result = result;
    S.phase = 'challenge-result';
    M.setMode('none');
    if (cd.kind === 'map') M.reveal(cd.answer, result.sel);
    renderAll();
  }

  /* ================= Turn: 4. Claim the route ================= */
  function offerClaim() {
    const r = D.routes.find((x) => x.id === S.turn.lastRoute);
    S.turn.claim = { route: r, countries: shuffle([...r.countries, ...r.wrongCountries]), borders: shuffle([...r.borders, ...r.wrongBorders]), selC: [], selB: [], result: null, started: false };
    S.phase = 'claim';
    M.clearMarks();
    renderAll();
  }
  function claimCard() {
    const t = team(), K = S.turn.claim, r = K.route, done = !!K.result;
    const body = [h('div', { class: 'who', style: `--team:${t.colour}` }, h('span', { class: 'dot' }), `${t.name} · bonus round`)];
    if (!K.started) {
      body.push(
        h('div', { class: 'q' }, `Claim the ${routeName(r)} route?`),
        h('p', null, `Name the two countries it connects and the border(s) it crosses. Get it all right for ${pts(CLAIM_POINTS)} and the route turns your colour!`),
        h('div', { class: 'card-actions' },
          h('button', { class: 'btn btn-primary grow', onclick: () => { K.started = true; renderCard(); } }, 'Yes, try to claim it!'),
          h('button', { class: 'btn', onclick: endTurn }, 'Skip — end turn'),
          readBtn(`Claim the ${routeName(r)} route? Name the two countries it connects and the borders it crosses, for two bonus points.`)));
      return card('route', `+${pts(CLAIM_POINTS)}`, body);
    }
    const toggle = (list, val) => { const i = list.indexOf(val); if (i >= 0) list.splice(i, 1); else list.push(val); renderCard(); };
    const optBtn = (val, list, rightList) => {
      let state = '';
      if (done) state = rightList.includes(val) ? 'right' : (list.includes(val) ? 'wrong' : '');
      return h('button', { class: `btn opt ${state}`, 'aria-pressed': String(list.includes(val)), disabled: done, onclick: () => toggle(list, val) },
        h('span', { class: 'mark', 'aria-hidden': 'true' }, list.includes(val) ? '✓' : ''), val);
    };
    body.push(
      h('div', { class: 'q' }, `Route: ${routeName(r)}`),
      h('div', { class: 'step' }, 'A. Which TWO countries does it connect? (start and end)'),
      h('div', { class: 'options two' }, K.countries.map((c) => optBtn(c, K.selC, r.countries))),
      h('div', { class: 'step' }, 'B. Which border(s) does it cross? Tick all that are right.'),
      h('div', { class: 'options' }, K.borders.map((b) => optBtn(b, K.selB, r.borders))));
    if (!done) {
      body.push(h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-primary grow', disabled: !(K.selC.length === 2 && K.selB.length >= 1), onclick: () => confirmReminder(evaluateClaim) },
          K.selC.length === 2 ? 'Submit claim' : `Pick 2 countries (${K.selC.length}/2)`),
        h('button', { class: 'btn', onclick: () => finishClaim(false, true), title: 'Pass — no points lost' }, 'Pass'),
        readBtn(() => `Route ${routeName(r)}. Which two countries does it connect? Choices: ${K.countries.join(', ')}. Which borders does it cross? Choices: ${K.borders.join('; ')}.`)));
    } else {
      const ok = K.result.correct;
      const explain = [`The ${routeName(r)} route connects ${listText(r.countries)}.`,
        r.via.length ? `On the way it passes through ${listText(r.via)}, so it crosses ${r.borders.length} borders: ${listText(r.borders)}.` : `It crosses the ${r.borders[0]} border.`,
        r.note || ''].join(' ');
      const title = ok ? `✔ Route claimed! +${pts(CLAIM_POINTS)}` : K.result.passed ? 'Passed — no points lost' : '✘ Not quite — the route stays open';
      body.push(h('div', { class: `feedback ${ok ? 'good' : K.result.passed ? 'info' : 'bad'}` },
        h('div', { class: 'fb-title' }, title), h('div', null, explain)));
      body.push(h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-primary grow', onclick: endTurn }, 'End turn ➜'),
        readBtn(() => `${title}. ${explain}`)));
    }
    return card('route', `+${pts(CLAIM_POINTS)}`, body);
  }
  function evaluateClaim() {
    const K = S.turn.claim, r = K.route;
    const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
    finishClaim(same(K.selC, r.countries) && same(K.selB, r.borders), false);
  }
  function finishClaim(correct, passed) {
    const K = S.turn.claim;
    if (K.result) return;
    K.result = { correct, passed };
    if (correct) { S.claimed[K.route.id] = S.cur; team().score += CLAIM_POINTS; team().claims++; }
    renderAll();
  }

  /* ================= End of turn / game ================= */
  function endTurn() {
    if (S.over) return;
    M.clearMarks(); M.setMode('none'); stopSpeech();
    if (allDone()) { S.over = true; clearInterval(timerId); endGame('done'); return; }
    S.cur = nextActiveTeam(S.cur);
    S.phase = 'waiting';
    renderAll();
    passDevice(S.cur, null, startTurn);
  }

  function confirmEndGame() {
    if (!S || S.over) return;
    showModal(
      h('div', { class: 'modal-ico', 'aria-hidden': 'true' }, '🏁'),
      h('h2', null, 'End the game now?'),
      h('p', null, 'The team with the most points wins.'),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn btn-primary btn-xl', onclick: () => { closeModal(); S.over = true; clearInterval(timerId); endGame('teacher'); } }, 'Yes, end the game'),
        h('button', { class: 'btn btn-xl', onclick: closeModal }, 'Keep playing')));
  }

  function endGame(reason) {
    S.over = true;
    clearInterval(timerId);
    M.setMode('none'); stopSpeech();
    if (reason) S.endReason = reason;
    renderEnd();
    show('screen-end');
  }

  function renderEnd() {
    const sorted = S.teams.slice().sort((a, b) => b.score - a.score);
    const top = sorted[0].score;
    const tied = sorted.filter((t) => t.score === top);
    const reasonText = { time: "⏰ Time's up!", done: '✅ Every team has answered 6 challenge cards!', teacher: '🏁 The teacher ended the game.' }[S.endReason] || '';
    const kids = [h('div', { class: 'end-reason' }, reasonText)];
    let winners = null;
    if (S.tb && S.tb.winner != null) winners = [S.teams[S.tb.winner]];
    else if (S.tb && S.tb.shared) winners = S.tb.shared.map((i) => S.teams[i]);
    else if (tied.length === 1) winners = tied;

    if (winners && winners.length === 1) {
      kids.push(h('h1', null, '🏆 We have a winner!'),
        h('div', { class: 'winner', style: `--team:${winners[0].colour}` }, winners[0].name),
        S.tb ? h('p', null, `${winners[0].name} won the sudden-death tiebreaker!`) : null);
    } else if (winners) {
      kids.push(h('h1', null, '🤝 Shared victory!'),
        h('div', { class: 'winner' }, listText(winners.map((t) => t.name))),
        h('p', null, `After ${TIEBREAK_MAX_ROUNDS} sudden-death rounds these teams are still level — well played!`));
    } else {
      kids.push(h('h1', null, "It's a tie!"),
        h('div', { class: 'tie-box' },
          h('p', null, `${listText(tied.map((t) => t.name))} are level on ${pts(top)}.`),
          h('p', null, 'Tiebreaker: each tied team answers one map question. Sudden death — get it right to win!'),
          h('button', { class: 'btn btn-primary btn-xl', onclick: () => startTiebreak(tied.map((t) => t.id)) }, 'Start the tiebreaker 🏁')));
    }
    let rank = 0, prev = null;
    const medals = ['🥇', '🥈', '🥉'];
    kids.push(h('div', { class: 'ranking' }, sorted.map((t, i) => {
      if (t.score !== prev) { rank = i; prev = t.score; }
      return h('div', { class: 'rank-row', style: `--team:${t.colour}` },
        h('div', { class: 'rank-pos' }, medals[rank] || `${rank + 1}`),
        h('div', { class: 'rank-name' }, t.name, h('small', null, `${t.challenges}/${CHALLENGES_PER_TEAM} challenge cards · ${t.claims} route${t.claims === 1 ? '' : 's'} claimed`)),
        h('div', { class: 'rank-pts' }, t.score));
    })));
    kids.push(h('div', { class: 'end-actions' },
      h('button', { class: 'btn btn-primary btn-xl', onclick: startGame }, '🔁 Play again'),
      h('button', { class: 'btn btn-xl', onclick: () => { show('screen-setup'); renderSetup(); } }, '👥 New teams')));
    $('endWrap').replaceChildren(...kids.filter(Boolean));
  }

  /* ================= Tiebreaker (sudden death) ================= */
  function startTiebreak(ids) {
    S.tb = { contenders: ids.slice(), round: 1, queue: ids.slice(), results: {}, current: null, winner: null, shared: null };
    show('screen-game');
    $('btnPause').disabled = true;
    $('btnEndGame').disabled = true;
    renderTimer();
    M.clearMarks(); M.resetZoom();
    nextTiebreakTurn();
  }
  function nextTiebreakTurn() {
    const TB = S.tb;
    if (!TB.queue.length) { resolveTiebreakRound(); return; }
    const idx = TB.queue.shift();
    S.cur = idx;
    TB.current = { team: idx, country: drawLocation(), sel: null, result: null };
    S.phase = 'waiting';
    M.clearMarks(); M.setMode('none');
    renderAll();
    passDevice(idx, `Tiebreaker round ${TB.round}! Pass the device to`, () => {
      S.phase = 'tiebreak';
      M.setMode('country');
      renderAll();
    });
  }
  function tiebreakCard() {
    const TB = S.tb, X = TB.current, t = team(X.team), done = !!X.result;
    const body = [
      h('div', { class: 'who', style: `--team:${t.colour}` }, h('span', { class: 'dot' }), `${t.name} · round ${TB.round}`),
      h('div', null, 'Tap this country on the map:'),
      h('div', { class: 'big-target' }, X.country.name),
      h('div', { class: 'pick-status' + (X.sel ? ' done' : '') },
        done ? `Picked: ${X.result.sel || '— (passed)'}` : X.sel ? (M.namesVisible() ? `You picked: ${X.sel}` : 'You picked a country (shown in yellow).') : 'Tap a country on the map…')
    ];
    if (!done) {
      body.push(h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-primary grow', disabled: !X.sel, onclick: () => confirmReminder(() => finishTiebreak(X.sel === X.country.name)) }, 'Submit answer'),
        h('button', { class: 'btn', onclick: () => finishTiebreak(false, true) }, 'Pass'),
        readBtn(`Sudden death. Tap ${X.country.name} on the map.`)));
    } else {
      const ok = X.result.correct;
      body.push(h('div', { class: `feedback ${ok ? 'good' : 'bad'}` },
        h('div', { class: 'fb-title' }, ok ? '✔ Correct!' : X.result.passed ? 'Passed' : '✘ Not quite'),
        h('div', { class: 'fb-answer' }, `Answer: ${X.country.name}`),
        h('div', null, X.country.landlocked ? `${X.country.name} is landlocked. Its capital is ${X.country.capital}.` : `${X.country.name} is coastal. Its capital is ${accepted(X.country).join(', ')}.`)));
      body.push(h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-primary grow', onclick: nextTiebreakTurn }, TB.queue.length ? 'Next team ➜' : 'See who wins ➜')));
    }
    return card('tiebreak', `Round ${TB.round}`, body);
  }
  function finishTiebreak(correct, passed) {
    const TB = S.tb, X = TB.current;
    if (X.result) return;
    X.result = { correct, passed, sel: X.sel };
    TB.results[X.team] = correct;
    M.setMode('none');
    M.reveal([X.country.name], X.sel);
    S.phase = 'tiebreak-result';
    renderAll();
  }
  function resolveTiebreakRound() {
    const TB = S.tb;
    const right = TB.contenders.filter((i) => TB.results[i]);
    M.clearMarks();
    if (right.length === 1) { TB.winner = right[0]; renderEnd(); show('screen-end'); return; }
    if (TB.round >= TIEBREAK_MAX_ROUNDS) { TB.shared = right.length ? right : TB.contenders.slice(); renderEnd(); show('screen-end'); return; }
    if (right.length > 1) TB.contenders = right;
    TB.round++;
    TB.results = {};
    TB.queue = TB.contenders.slice();
    showModal(
      h('div', { class: 'modal-ico', 'aria-hidden': 'true' }, '😮'),
      h('h2', null, 'Still tied!'),
      h('p', null, `${right.length ? 'More than one team got it right.' : 'Nobody got it right.'} On to round ${TB.round}: ${listText(TB.contenders.map((i) => S.teams[i].name))}.`),
      h('div', { class: 'modal-actions' }, h('button', { class: 'btn btn-primary btn-xl', onclick: () => { closeModal(); nextTiebreakTurn(); } }, 'Next round ➜')));
  }

  /* ================= Rendering ================= */
  function card(typeKey, rightLabel, bodyKids) {
    const T = TYPES[typeKey];
    return h('div', { class: `card ${T.cls}` },
      h('div', { class: 'card-head' },
        h('div', { class: 'card-type' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, T.icon), T.label),
        rightLabel ? h('div', { class: 'card-pts' }, rightLabel) : null),
      h('div', { class: 'card-body' }, bodyKids));
  }

  function renderScoreboard() {
    $('scoreboard').replaceChildren(...S.teams.map((t, i) => h('div', { class: 'score-row' + (i === S.cur ? ' current' : ''), style: `--team:${t.colour}` },
      h('div', { class: 'sw' }),
      h('div', { class: 'score-name' }, t.name, h('small', null, `📍 ${hubName(t.hub)}`)),
      h('div', { class: 'score-ch', title: 'Challenge cards answered' }, `Cards ${t.challenges}/${CHALLENGES_PER_TEAM}`),
      h('div', { class: 'score-pts', 'aria-label': `${t.score} points` }, t.score))));
    const chip = $('turnChip');
    chip.style.setProperty('--team', team().colour);
    chip.textContent = S.tb ? `🏁 Tiebreaker: ${team().name}` : `Turn: ${team().name}`;
  }

  function renderCard() {
    let el = null;
    switch (S.phase) {
      case 'loc': case 'loc-result': el = locCard(); break;
      case 'roll': el = rollCard(); break;
      case 'move': case 'arrived': el = moveCard(); break;
      case 'challenge': case 'challenge-result': el = challengeCard(); break;
      case 'claim': el = claimCard(); break;
      case 'tiebreak': case 'tiebreak-result': el = tiebreakCard(); break;
      default: el = h('div', { class: 'card t-move' }, h('div', { class: 'card-body' }, h('p', null, 'Get ready…')));
    }
    $('cardArea').replaceChildren(el);
    renderHint();
  }

  let hintTimer, lastHint = '';
  function renderHint() {
    const hint = $('mapHint');
    const askCountry = ['loc', 'tiebreak'].includes(S.phase) || (S.phase === 'challenge' && S.turn.ch.card.kind === 'map');
    // hide names while a team is hunting for a country (unless the teacher turned labels on)
    M.setHideNames(askCountry);
    let text = '';
    if (askCountry) text = '👆 Tap a country on the map';
    else if (S.phase === 'move' && S.turn.movesLeft > 0) text = `👆 Tap a glowing hub joined to ${hubName(team().hub)}`;
    if (!text) { hint.classList.add('hidden'); lastHint = ''; return; }
    if (text === lastHint) return;
    // show the hint briefly so it doesn't cover the map for long
    lastHint = text;
    hint.textContent = text; hint.classList.remove('hidden');
    clearTimeout(hintTimer); hintTimer = setTimeout(() => hint.classList.add('hidden'), 4000);
  }

  function renderMap() {
    const colours = {};
    Object.entries(S.claimed).forEach(([id, ti]) => { colours[id] = S.teams[ti].colour; });
    const moving = S.phase === 'move' || S.phase === 'arrived';
    const t = team();
    const reach = S.phase === 'move' && S.turn.movesLeft > 0 ? neighboursOf(t.hub) : [];
    M.renderRoutes(colours, {
      travelled: S.turn && moving ? S.turn.path : (S.phase === 'claim' && S.turn.claim ? [S.turn.claim.route.id] : []),
      options: reach.map((id) => routeBetween(t.hub, id).id),
      colour: t.colour
    });
    M.highlightHubs(reach, moving ? t.hub : null, t.colour);
    M.renderCounters(S.teams);
  }

  function renderAll() {
    renderScoreboard();
    renderMap();
    renderCard();
    renderTimer();
  }

  /* ================= Map callbacks ================= */
  function onCountry(c) {
    if (modalOpen) return;
    if (S.phase === 'loc') { S.turn.loc.sel = c.name; }
    else if (S.phase === 'challenge' && S.turn.ch.card.kind === 'map') { S.turn.ch.sel = c.name; }
    else if (S.phase === 'tiebreak') { S.tb.current.sel = c.name; }
    else return;
    M.select(c.name);
    renderCard();
  }

  /* ================= Boot ================= */
  function boot() {
    const res = M.init({
      country: onCountry,
      hub: onHub,
      water: () => toast("That's the sea! Tap on a country."),
      disputed: () => toast("Western Sahara is a disputed territory, so it isn't one of the 54 countries in this game.", 3800)
    });
    if (res.missing.length) {
      const w = $('dataWarning');
      w.textContent = `Data check: these countries were not found on the map file: ${res.missing.join(', ')}. Check the "topo" names in data/questions.js.`;
      w.classList.remove('hidden');
      console.warn('Africa Route Quest data check — missing on map:', res.missing);
    }

    $('btnToSetup').onclick = () => { show('screen-setup'); renderSetup(); };
    $('btnBackTitle').onclick = () => show('screen-title');
    $('btnStartGame').onclick = startGame;
    document.querySelectorAll('#teamCount .seg-btn').forEach((b) => { b.onclick = () => { setup.n = +b.dataset.n; renderSetup(); }; });
    document.querySelectorAll('#timerChoice .seg-btn').forEach((b) => { b.onclick = () => { setup.minutes = +b.dataset.min; renderSetup(); }; });
    $('btnPause').onclick = togglePause;
    $('btnEndGame').onclick = confirmEndGame;
    const toggleBtn = (id, fn) => {
      const b = $(id);
      b.onclick = () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); fn(on); if (S && S.phase) renderCard(); };
    };
    toggleBtn('btnLabels', (on) => M.setLabels(on));
    toggleBtn('btnTips', (on) => M.setTooltips(on));
    toggleBtn('btnWorld', (on) => $('inset').classList.toggle('hidden', !on));
    if (window.matchMedia('(max-width: 700px)').matches) { $('btnWorld').setAttribute('aria-pressed', 'false'); $('inset').classList.add('hidden'); }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalOpen && $('modalBox').querySelector('button:last-child')?.textContent.includes('Go back')) closeModal(); });
    if (canSpeak) window.speechSynthesis.getVoices();
  }

  // Read-only hook used for automated play-testing
  window.ARQ = { get state() { return S; }, data: D };

  boot();
})();
