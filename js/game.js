/* Africa Route Quest — game logic */
(function () {
  'use strict';
  const D = window.GAME_DATA;
  const M = window.ARQMap;

  const TEAM_COLOURS = [
    { name: 'Red', hex: '#c0392b' }, { name: 'Blue', hex: '#1f5f99' }, { name: 'Green', hex: '#2e7d4f' },
    { name: 'Gold', hex: '#b77d07' }, { name: 'Berry', hex: '#8e3b6e' }, { name: 'Teal', hex: '#13756e' }
  ];
  const DEFAULT_NAMES = ['Lions', 'Elephants', 'Rhinos', 'Leopards'];
  const DEFAULT_HUBS = ['capetown', 'cairo', 'dakar', 'nairobi'];
  const CHALLENGES_PER_TEAM = 6;
  const LOC_POINTS = 2, STEAL_POINTS = 1, CLAIM_POINTS = 2;
  const TIEBREAK_MAX_ROUNDS = 5;
  const TYPES = {
    ocean: { label: 'Ocean & Map', icon: 'ocean', cls: 't-ocean' },
    location: { label: 'Location', icon: 'pin', cls: 't-location' },
    challenge: { label: 'Challenge', icon: 'bolt', cls: 't-challenge' },
    route: { label: 'Claim the Route', icon: 'route', cls: 't-route' },
    move: { label: 'Travel', icon: 'dice', cls: 't-move' },
    tiebreak: { label: 'Sudden Death', icon: 'flag', cls: 't-tiebreak' }
  };
  const STEPS = ['Location card', 'Roll', 'Move', 'Challenge', 'Claim route'];
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  // Geography words, explained the first time they come up in a game
  const GLOSSARY = [
    { re: /\bcapital/i, word: 'Capital city', text: "the city where a country's leaders and government work." },
    { re: /landlocked/i, word: 'Landlocked', text: "no coastline. The country doesn't touch the sea." },
    { re: /\bcoast(al)?\b/i, word: 'Coastal', text: 'the country touches the sea or the ocean.' },
    { re: /\bborders?\b/i, word: 'Border', text: 'the line where one country ends and the next one starts.' },
    { re: /equator/i, word: 'Equator', text: 'an imaginary line around the middle of the Earth, at 0°.' },
    { re: /latitude/i, word: 'Latitude', text: 'imaginary lines that go around the Earth from east to west. They show how far north or south a place is.' },
    { re: /longitude/i, word: 'Longitude', text: 'imaginary lines that go from the North Pole to the South Pole.' },
    { re: /hemisphere/i, word: 'Hemisphere', text: 'half of the Earth. The Equator splits the Earth into a northern half and a southern half.' },
    { re: /continent/i, word: 'Continent', text: 'one of the 7 very big areas of land on Earth, like Africa or Europe.' },
    { re: /\bisland/i, word: 'Island', text: 'land with water all around it.' },
    { re: /\bstrait\b/i, word: 'Strait', text: 'a narrow strip of sea between two pieces of land.' },
    { re: /\bpoles\b/i, word: 'North and South Poles', text: 'the very top and the very bottom of the Earth.' },
    { re: /\bhubs?\b/i, word: 'Hub', text: 'one of the 12 cities with a pin on the map. Routes join the hubs.' },
    { re: /\broutes?\b/i, word: 'Route', text: 'the path you travel along from one place to another.' },
    { re: /United Nations/, word: 'United Nations (UN)', text: 'a group that almost every country in the world belongs to.' }
  ];

  const GUIDE = [
    { title: 'Make your teams', text: 'Play in 2 to 4 teams. Each team picks a name and a colour.', art:
      `<svg viewBox="0 0 420 220"><g class="g-ink">${[['#c0392b', 'L', 75], ['#1f5f99', 'E', 165], ['#2e7d4f', 'R', 255], ['#b77d07', 'L', 345]].map(([c, l, x], i) =>
        `<circle cx="${x}" cy="${100 + (i % 2) * 14}" r="36" fill="${c}"/><circle cx="${x}" cy="${100 + (i % 2) * 14}" r="25" stroke="#fff8ec" stroke-width="2.5" stroke-dasharray="4 5"/><text x="${x}" y="${112 + (i % 2) * 14}" class="g-text" fill="#fff" stroke="none" text-anchor="middle" font-size="34" style="fill:#fff">${l}</text>`).join('')}</g>
        <text x="210" y="196" class="g-text" text-anchor="middle" font-size="30">2 to 4 teams</text></svg>` },
    { title: 'Find the country', text: 'Tap the country on the map. Then pick its capital city.', art:
      `<svg viewBox="0 0 420 220"><path class="g-land" d="{{AFRICA}}"/>
        <path d="{{KENYA}}" fill="#ffd23f" stroke="#2b2118" stroke-width="2.5"/>
        <g transform="translate({{KENYA_X}},{{KENYA_Y}})"><path d="M0 0c-2-7-11-12-11-20a11 11 0 1 1 22 0c0 8-9 13-11 20z" fill="#c4492d" stroke="#2b2118" stroke-width="3"/><circle cy="-20" r="4" fill="#f3e7cf"/></g>
        <g class="g-ink"><rect x="244" y="40" width="150" height="140" rx="10" fill="#fffaf0"/><path d="M244 72h150" stroke-dasharray="6 6"/>
        <rect x="256" y="86" width="58" height="36" rx="6" fill="#e1f0dc"/><rect x="324" y="86" width="58" height="36" rx="6" fill="#fff"/><rect x="256" y="132" width="58" height="36" rx="6" fill="#fff"/><rect x="324" y="132" width="58" height="36" rx="6" fill="#fff"/>
        <path d="M270 104l8 8 16-16" stroke="#2f7d46" stroke-width="5"/></g><text x="319" y="64" class="g-text" text-anchor="middle" font-size="20">Capital?</text></svg>` },
    { title: 'Roll and move', text: 'Roll the dice. Move your token along the dotted lines to a new city.', art:
      `<svg viewBox="0 0 420 220"><g class="g-ink"><rect x="38" y="62" width="100" height="100" rx="18" fill="#fffdf6" transform="rotate(-8 88 112)"/></g>
        <g fill="#2b2118" transform="rotate(-8 88 112)"><circle cx="64" cy="88" r="8"/><circle cx="112" cy="88" r="8"/><circle cx="88" cy="112" r="8"/><circle cx="64" cy="136" r="8"/><circle cx="112" cy="136" r="8"/></g>
        <path class="g-route" d="M206 172C250 160 250 112 300 104s60-36 72-58"/>
        <path d="M206 172c-2-8-13-14-13-24a13 13 0 1 1 26 0c0 10-11 16-13 24z" fill="#c4492d" stroke="#2b2118" stroke-width="3"/><circle cx="206" cy="148" r="4.5" fill="#f3e7cf"/>
        <path d="M372 52c-2-8-13-14-13-24a13 13 0 1 1 26 0c0 10-11 16-13 24z" fill="#c4492d" stroke="#2b2118" stroke-width="3"/><circle cx="372" cy="28" r="4.5" fill="#f3e7cf"/>
        <circle cx="236" cy="150" r="15" fill="#1f5f99" stroke="#2b2118" stroke-width="3"/></svg>` },
    { title: 'Answer a challenge', text: 'Read the challenge card and pick an answer. Get it right to win points!', art:
      `<svg viewBox="0 0 420 220"><g transform="rotate(-4 200 110)"><path d="M70 50h270v38a14 14 0 0 0 0 28v54H70v-54a14 14 0 0 0 0-28z" fill="#fffaf0" stroke="#2b2118" stroke-width="3"/>
        <path d="M70 50h270v30H70z" fill="#c8701a" stroke="#2b2118" stroke-width="3"/><g class="g-ink"><path d="M92 112h150M92 134h120M92 156h90" stroke-width="6" stroke="#cdb68f"/></g></g>
        <g transform="rotate(-14 318 140)"><circle cx="318" cy="140" r="46" fill="rgba(255,250,240,.7)" stroke="#2f7d46" stroke-width="5"/><circle cx="318" cy="140" r="38" fill="none" stroke="#2f7d46" stroke-width="2"/>
        <text x="318" y="152" class="g-text" text-anchor="middle" font-size="36" style="fill:#2f7d46">+2</text></g></svg>` },
    { title: 'Claim the route', text: 'Name the countries and borders on the route you used. Get it right for 2 bonus points!', art:
      `<svg viewBox="0 0 420 220"><path d="M210 20v180" stroke="#5b4a39" stroke-width="3" stroke-dasharray="10 8" fill="none"/>
        <text x="218" y="40" class="g-text" font-size="18" style="fill:#5b4a39">border</text>
        <path d="M80 150C150 160 170 80 240 90s90 10 110-30" fill="none" stroke="#2e7d4f" stroke-opacity=".35" stroke-width="18" stroke-linecap="round"/>
        <path d="M80 150C150 160 170 80 240 90s90 10 110-30" fill="none" stroke="#2e7d4f" stroke-width="8" stroke-linecap="round" stroke-dasharray="0 16"/>
        <path d="M80 150c-2-8-13-14-13-24a13 13 0 1 1 26 0c0 10-11 16-13 24z" fill="#c4492d" stroke="#2b2118" stroke-width="3"/><circle cx="80" cy="126" r="4.5" fill="#f3e7cf"/>
        <path d="M350 60c-2-8-13-14-13-24a13 13 0 1 1 26 0c0 10-11 16-13 24z" fill="#c4492d" stroke="#2b2118" stroke-width="3"/><circle cx="350" cy="36" r="4.5" fill="#f3e7cf"/>
        <text x="80" y="185" class="g-text" text-anchor="middle" font-size="20">Kenya</text><text x="350" y="92" class="g-text" text-anchor="middle" font-size="20">Uganda</text></svg>` },
    { title: 'Win the game', text: 'The game ends after 6 challenges each, or when the 25-minute timer runs out. Most points wins!', art:
      `<svg viewBox="0 0 420 220"><g class="g-ink"><path d="M150 40h90c2 42-12 75-45 79-33-4-47-37-45-79zM150 58c-26-3-34 10-31 24 4 15 19 22 37 21M240 58c26-3 34 10 31 24-4 15-19 22-37 21M195 119v36M160 192c23-6 47-5 70 0-2-15-12-37-35-38-23 1-33 23-35 38z" fill="#e8b83a"/></g>
        ${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${290 + (i % 3) * 36}" cy="${80 + Math.floor(i / 3) * 40}" r="14" fill="${i < 6 ? '#2e7d4f' : 'none'}" stroke="#2b2118" stroke-width="3"/>`).join('')}
        <text x="326" y="172" class="g-text" text-anchor="middle" font-size="22">6 challenges</text>
        <g class="g-ink"><circle cx="76" cy="110" r="40" fill="#fffaf0"/><path d="M76 84v28l18 12"/></g><text x="76" y="182" class="g-text" text-anchor="middle" font-size="22">25 min</text></svg>` }
  ];

  const $ = (id) => document.getElementById(id);
  const hubById = new Map(D.hubs.map((x) => [x.id, x]));
  const hubName = (id) => hubById.get(id).city;
  const routeBetween = (a, b) => D.routes.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  const neighboursOf = (id) => D.routes.filter((r) => r.a === id || r.b === id).map((r) => (r.a === id ? r.b : r.a));
  const routeName = (r) => `${hubName(r.a)} – ${hubName(r.b)}`;
  const accepted = (c) => c.capitals || [c.capital];
  const pts = (n) => `${n} point${n === 1 ? '' : 's'}`;
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const listText = (arr, word) => (arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ` ${word || 'and'} ` + arr[arr.length - 1]);

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
  function I(name) {
    const t = document.createElement('template');
    t.innerHTML = window.ICON(name);
    return t.content.firstChild;
  }
  function svgArt(markup) {
    if (markup.includes('{{AFRICA}}')) {
      const a = M.africaArt([[30, 14], [215, 206]], 'Kenya');
      const [kx, ky] = a.point([37.9, 0.5]);
      markup = markup.replace('{{AFRICA}}', a.land).replace('{{KENYA}}', a.country).replace('{{KENYA_X}}', kx).replace('{{KENYA_Y}}', ky);
    }
    const t = document.createElement('template');
    t.innerHTML = markup.trim();
    return t.content.firstChild;
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
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }
  const stopSpeech = () => { if (canSpeak) window.speechSynthesis.cancel(); };
  const readBtn = (text) => (canSpeak ? h('button', { class: 'btn', onclick: () => speak(typeof text === 'function' ? text() : text), title: 'Read this card out loud' }, I('speaker'), 'Read aloud') : null);

  /* ================= Modal & toast ================= */
  let modalOpen = false;
  function showModal(kids, wide) {
    const box = $('modalBox');
    box.className = 'modal-box' + (wide ? ' wide' : '');
    box.replaceChildren(...kids.filter(Boolean));
    $('modal').classList.remove('hidden');
    modalOpen = true;
    const first = box.querySelector('button');
    if (first) first.focus();
  }
  function closeModal() { $('modal').classList.add('hidden'); $('modalBox').replaceChildren(); modalOpen = false; }
  const modalIco = (name) => h('div', { class: 'modal-ico', 'aria-hidden': 'true' }, I(name));
  let toastTimer;
  function toast(msg, ms) {
    const t = $('toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 3000);
  }
  function confirmReminder(onOk) {
    showModal([
      modalIco('search'),
      h('h2', null, 'Check the map first!'),
      h('p', null, "Someone who didn't choose the answer must explain it."),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn btn-good btn-xl', onclick: () => { closeModal(); onOk(); } }, I('check'), "We've checked. Submit!"),
        h('button', { class: 'btn btn-xl', onclick: closeModal }, I('arrowL'), 'Go back'))
    ]);
  }
  function passDevice(teamIdx, title, onReady) {
    const t = S.teams[teamIdx];
    showModal([
      modalIco('device'),
      h('h2', null, title || 'Next team!'),
      h('p', null, 'Pass the laptop or tablet to'),
      h('div', { class: 'pass-team', style: `--team:${t.colour}` }, t.name),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn btn-primary btn-xl', onclick: () => { closeModal(); onReady(); } }, "We're ready!", I('arrowR')))
    ]);
  }

  /* ================= Screens ================= */
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }

  /* ================= How to Play guide ================= */
  // container: where to draw; onDone: called by "Let's play!" / Skip
  function renderGuide(container, step, opts) {
    const g = GUIDE[step];
    const last = step === GUIDE.length - 1;
    const go = (n) => renderGuide(container, n, opts);
    container.replaceChildren(h('div', { class: 'guide' },
      h('div', { class: 'guide-top' },
        h('span', { class: 'guide-count' }, `How to play · step ${step + 1} of ${GUIDE.length}`),
        last ? null : h('button', { class: 'link-btn', onclick: opts.onDone }, opts.skipLabel || 'Skip')),
      h('div', { class: 'guide-art' }, svgArt(g.art)),
      h('h2', { class: 'guide-step-title' }, `${step + 1}. ${g.title}`),
      h('p', { class: 'guide-text' }, g.text),
      h('div', { class: 'guide-nav' },
        h('button', { class: 'btn', disabled: step === 0, onclick: () => go(step - 1) }, I('arrowL'), 'Back'),
        h('div', { class: 'dots', 'aria-hidden': 'true' }, GUIDE.map((_, i) => h('span', { class: i === step ? 'on' : i < step ? 'done' : '' }))),
        last
          ? h('button', { class: 'btn btn-primary btn-xl nudge', onclick: opts.onDone }, opts.doneLabel || "Let's play!", I('arrowR'))
          : h('button', { class: 'btn btn-primary btn-lg', onclick: () => go(step + 1) }, 'Next', I('arrowR')))));
  }
  function openGuideScreen() {
    show('screen-guide');
    renderGuide($('guideScreen'), 0, { onDone: () => { show('screen-setup'); renderSetup(); } });
  }
  function openGuideModal() {
    const holder = h('div');
    showModal([holder], true);
    renderGuide(holder, 0, { onDone: closeModal, doneLabel: 'Back to the game', skipLabel: 'Close' });
  }
  function openTeachers() {
    showModal([
      h('h2', null, 'For teachers'),
      h('ul', { class: 'info-list' },
        h('li', null, h('b', null, 'Grade'), h('span', null, 'Grade 6 Social Sciences (Geography): map skills and Africa')),
        h('li', null, h('b', null, 'Time'), h('span', null, '25–35 minutes. You can set the timer to 15, 25 or 35 minutes.')),
        h('li', null, h('b', null, 'Players'), h('span', null, '2–4 teams sharing one device: a projector, laptop or tablet.')),
        h('li', null, h('b', null, 'Set-up'), h('span', null, 'Nothing to install. It keeps working without internet once the page has loaded.'))),
      h('h3', null, 'Learners will be able to:'),
      h('ul', { class: 'outcomes' },
        h('li', null, 'find African countries on a political map of Africa;'),
        h('li', null, 'name the capital cities of African countries;'),
        h('li', null, 'tell the difference between coastal and landlocked countries;'),
        h('li', null, 'name the oceans and seas around Africa, the nearby continents and the Equator;'),
        h('li', null, 'explain what a border is, and name the borders a route crosses;'),
        h('li', null, 'explain why the Equal Earth map shows the size of continents fairly.')),
      h('h3', null, 'Tips'),
      h('ul', { class: 'outcomes' },
        h('li', null, 'Turn ', h('b', null, 'Names'), ' on to make it easier, or ', h('b', null, 'Hints'), ' off to make it harder.'),
        h('li', null, 'Pause the timer at any time to talk about an answer.'),
        h('li', null, 'You can change any question in the file ', h('code', null, 'data/questions.js'), '. The ',
          h('a', { href: 'https://github.com/Cooljay101/africa-route-quest#readme', target: '_blank', rel: 'noopener' }, 'README'), ' shows how.')),
      h('div', { class: 'modal-actions' }, h('button', { class: 'btn btn-primary btn-lg', onclick: closeModal }, 'Close'))
    ], true);
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
          h('span', { class: 'lab' }, 'Colour'),
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
            }, t.colour === c.hex ? I('check') : null)))),
        h('div', null,
          h('label', { for: hubId }, 'Start city'),
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
      tb: null, explained: []
    };
    show('screen-game');
    $('btnPause').disabled = false;
    $('btnEndGame').disabled = false;
    M.clearMarks(); M.resetZoom();
    renderAll();
    startTimer();
    passDevice(0, 'First up!', startTurn);
  }

  /* ================= Word help ================= */
  function wordHelp(text) {
    const found = GLOSSARY.filter((g) => g.re.test(text) && !S.explained.includes(g.word)).slice(0, 2);
    found.forEach((g) => S.explained.push(g.word));
    return found;
  }
  const helpBox = (items) => (items && items.length
    ? h('div', { class: 'wordhelp' }, I('book'), h('div', null, items.map((g) => h('p', null, h('b', null, 'Word help: '), `${g.word} = ${g.text}`))))
    : null);

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
    const b = $('btnPause');
    b.replaceChildren(I(S.timer.running ? 'pause' : 'play'), S.timer.running ? 'Pause' : 'Resume');
  }
  function togglePause() {
    if (!S || S.over || S.tb) return;
    S.timer.running = !S.timer.running;
    S.timer.last = Date.now();
    renderTimer();
    toast(S.timer.running ? 'The timer is running again.' : 'The timer is paused.');
  }
  function timeUp() {
    clearInterval(timerId);
    S.over = true;
    M.setMode('none'); stopSpeech();
    showModal([
      modalIco('clock'),
      h('h2', null, "Time's up!"),
      h('p', null, "Great travelling, everyone! Let's see the scores."),
      h('div', { class: 'modal-actions' }, h('button', { class: 'btn btn-primary btn-xl', onclick: () => { closeModal(); endGame('time'); } }, 'See the scores', I('arrowR')))
    ]);
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
  const countryFact = (c) => c.note || (c.landlocked
    ? `${c.name} is landlocked. That means it does not touch the sea.`
    : c.island ? `${c.name} is an island country. It has sea all around it.`
      : `${c.name} is coastal. That means it touches the sea.`);

  /* ---------- shared result box ---------- */
  function resultBox(kind, title, answer, fact, stamp) {
    return h('div', { class: `result ${kind}${stamp ? ' has-stamp' : ''}` },
      h('div', { class: 'res-title' }, title),
      answer ? h('div', { class: 'res-answer' }, answer) : null,
      fact ? h('p', { class: 'res-fact' }, I('star'), h('span', null, fact)) : null,
      stamp ? h('div', { class: 'stamp', style: `--stamp:${stamp.colour}`, 'aria-hidden': 'true' }, h('b', null, `+${stamp.points}`), h('small', null, stamp.points === 1 ? 'point' : 'points')) : null);
  }
  function optButton(text, pressed, state, disabled, onclick) {
    const mark = state === 'right' ? I('check') : state === 'wrong' ? I('cross') : pressed ? I('check') : null;
    return h('button', { class: `btn opt ${state || ''}`, 'aria-pressed': String(!!pressed), disabled, onclick },
      h('span', { class: 'mark', 'aria-hidden': 'true' }, mark), text);
  }
  const stepTitle = (n, text) => h('div', { class: 'step' }, h('span', { class: 'num' }, n), text);
  const whoLine = (t, text) => h('div', { class: 'who', style: `--team:${t.colour}` }, h('span', { class: 'dot' }), text);

  /* ================= Turn: 1. Location card ================= */
  function startTurn() {
    if (S.over) return;
    S.turn = { path: [], hubsVisited: [team().hub], lastRoute: null, loc: null, roll: null, movesLeft: 0, moved: 0, ch: null, claim: null };
    const c = drawLocation();
    S.turn.loc = { country: c, options: capitalOptions(c), answerer: S.cur, steal: false, sel: null, cap: null, result: null, help: wordHelp('capital city') };
    S.phase = 'loc';
    M.clearMarks();
    M.setMode('country');
    renderAll();
  }

  function locCard() {
    const L = S.turn.loc, ans = team(L.answerer), done = !!L.result;
    const c = L.country;
    const picked = L.sel
      ? (M.namesVisible() ? `You picked: ${L.sel}` : 'You picked a country. It is yellow on the map. Tap another one to change it.')
      : 'Tap a country on the map.';
    const okCaps = accepted(c);
    const body = [
      whoLine(ans, `${ans.name} answering`),
      L.steal && !done ? h('div', { class: 'steal-banner' }, I('steal'), `Steal chance! Get it right for ${pts(STEAL_POINTS)}.`) : null,
      h('div', null, 'Find this country on the map:'),
      h('div', { class: 'big-target' }, c.name),
      done ? null : helpBox(L.help),
      stepTitle(1, 'Tap it on the map'),
      h('div', { class: 'pick-status' + (L.sel ? ' done' : '') }, done ? `You picked: ${L.result.sel || 'nothing (you passed)'}` : picked),
      stepTitle(2, 'Pick its capital city'),
      h('div', { class: 'options two' + (!done && L.sel && !L.cap ? ' nudge-box' : '') }, L.options.map((o) => {
        let state = '';
        if (done) state = okCaps.includes(o) ? 'right' : (o === L.result.cap ? 'wrong' : '');
        return optButton(o, L.cap === o, state, done, () => { L.cap = o; renderCard(); });
      }))
    ];
    if (!done) {
      const ready = L.sel && L.cap;
      body.push(h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-primary grow' + (ready ? ' nudge' : ''), disabled: !ready, onclick: () => confirmReminder(evaluateLoc) }, 'Submit answer'),
        h('button', { class: 'btn', onclick: passLoc, title: 'Pass: you lose no points' }, 'Pass'),
        readBtn(() => `Location card. Find ${c.name} on the map. Then pick its capital city: ${L.options.join(', ')}.`)));
    } else {
      const r = L.result;
      const capText = okCaps.length > 1 ? `Its capitals are ${listText(okCaps)}.` : `Its capital is ${c.capital}.`;
      const fact = countryFact(c);
      const title = r.correct ? `Correct! +${pts(r.points)}${r.by !== S.cur ? ` for ${team(r.by).name}` : ''}` : r.passed ? 'You passed.' : 'Not quite.';
      const answer = `The answer is ${c.name}. ${capText}`;
      body.push(resultBox(r.correct ? 'good' : r.passed ? 'info' : 'bad', title, answer, fact,
        r.correct ? { points: r.points, colour: team(r.by).colour } : null));
      if (!r.correct && r.sel && r.sel !== c.name) body.push(h('p', { class: 'small-note' }, `You tapped ${r.sel}. The right country is green on the map.`));
      body.push(h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-primary grow nudge', onclick: beginRoll }, 'Next: roll the dice', I('arrowR')),
        readBtn(() => `${title} ${answer} ${fact}`)));
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
      startSteal(`Not quite! The answer is still a secret. ${team((S.cur + 1) % S.teams.length).name}, you can steal it for ${pts(STEAL_POINTS)}.`, { sel: L.sel, cap: L.cap });
    } else {
      finishLoc({ correct: false, sel: L.sel, cap: L.cap });
    }
  }
  function passLoc() {
    const L = S.turn.loc;
    if (!L.steal) startSteal(`${team(L.answerer).name} passed. ${team((S.cur + 1) % S.teams.length).name}, you can steal it for ${pts(STEAL_POINTS)}!`, {});
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
    showModal([
      modalIco('steal'),
      h('h2', null, 'Steal chance!'),
      h('p', null, msg),
      h('div', { class: 'pass-team', style: `--team:${t.colour}` }, t.name),
      h('div', { class: 'modal-actions' }, h('button', { class: 'btn btn-primary btn-xl', onclick: closeModal }, "Let's steal!", I('arrowR')))]);
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
    S.turn.rollHelp = wordHelp('route');
    M.clearMarks();
    renderAll();
  }
  function dieEl(v, rolling) {
    return h('div', { class: 'die' + (rolling ? ' rolling' : ''), role: 'img', 'aria-label': v ? `The dice shows ${v}` : 'Dice' },
      [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => h('span', { class: 'pip' + ((PIPS[v] || []).includes(i) ? ' on' : '') })));
  }
  const movesFor = (v) => (v <= 2 ? 1 : v <= 4 ? 2 : 3);
  const ruleEl = () => h('div', { class: 'move-rule' },
    h('span', null, h('b', null, '1–2'), 'move 1 route'),
    h('span', null, h('b', null, '3–4'), 'move up to 2 routes'),
    h('span', null, h('b', null, '5–6'), 'move up to 3 routes'));

  function rollCard() {
    const t = team();
    const T = S.turn;
    return card('move', null, [
      whoLine(t, `${t.name} in ${hubName(t.hub)}`),
      h('div', { class: 'q' }, 'Roll the dice to travel!'),
      helpBox(T.rollHelp),
      h('div', { class: 'die-zone' }, h('div', { id: 'dieSlot' }, dieEl(T.roll || 1, false)), ruleEl()),
      h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-primary btn-xl grow nudge', id: 'btnRoll', onclick: rollDie }, I('dice'), 'Roll the dice'),
        readBtn('Roll the dice. One or two: move one route. Three or four: move up to two routes. Five or six: move up to three routes.'))
    ]);
  }
  function rollDie() {
    const T = S.turn;
    if (T.rolling || T.roll) return;
    T.rolling = true;
    const btn = $('btnRoll'); if (btn) { btn.disabled = true; btn.classList.remove('nudge'); }
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
      whoLine(t, `${t.name} in ${hubName(t.hub)}`),
      h('div', { class: 'die-zone' }, dieEl(T.roll, false),
        h('div', null,
          h('div', { class: 'moves-left' }, `You rolled ${T.roll}!`),
          h('div', null, exact ? 'Move 1 route.' : `Move up to ${max} routes.`),
          h('div', { class: 'small-note' }, `Routes left: ${T.movesLeft}`))),
      T.movesLeft > 0
        ? h('div', { class: 'pick-status' }, `Tap a glowing pin joined to ${hubName(t.hub)} by a dotted line.`)
        : h('div', { class: 'pick-status done' }, `You made it to ${hubName(t.hub)}!`),
      T.hubsVisited.length > 1 ? h('div', { class: 'trip' }, 'Your trip:', T.hubsVisited.map((id, i) => [i ? I('arrowR') : null, h('span', null, hubName(id))])) : null,
      h('div', { class: 'card-actions' },
        T.moved > 0 && T.movesLeft > 0 ? h('button', { class: 'btn btn-primary grow', onclick: stopMoving }, `Stop here in ${hubName(t.hub)}`) : null,
        readBtn(() => `You rolled ${T.roll}. Move ${exact ? 'one route' : `up to ${max} routes`}. Tap a glowing pin joined to ${hubName(t.hub)}.`))
    ]);
  }
  function onHub(id) {
    if (S.phase !== 'move' || modalOpen) return;
    const t = team(), T = S.turn;
    if (T.movesLeft <= 0) return;
    if (id === t.hub) { toast(`You are already in ${hubName(id)}. Tap a glowing pin to move.`); return; }
    const r = routeBetween(t.hub, id);
    if (!r) {
      toast(`Oops! There's no direct route from ${hubName(t.hub)} to ${hubName(id)}. Pick a glowing pin.`, 3600);
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
    S.turn.ch = {
      card: cardData, options: cardData.kind === 'mc' ? (cardData.keepOrder ? cardData.options.slice() : shuffle(cardData.options)) : null, sel: null, result: null,
      help: wordHelp(cardData.q + ' ' + (cardData.options || []).join(' '))
    };
    S.phase = 'challenge';
    M.clearMarks();
    M.setMode(cardData.kind === 'map' ? 'country' : 'none');
    renderAll();
  }
  function challengeCard() {
    const t = team(), C = S.turn.ch, cd = C.card, done = !!C.result;
    const answers = cd.kind === 'map' ? cd.answer : [cd.answer];
    const body = [
      whoLine(t, `${t.name} in ${hubName(t.hub)} · challenge ${Math.min(t.challenges + (done ? 0 : 1), CHALLENGES_PER_TEAM)} of ${CHALLENGES_PER_TEAM}`),
      h('div', { class: 'q' }, cd.q),
      done ? null : helpBox(C.help)
    ];
    if (cd.kind === 'mc') {
      const two = C.options.length === 2 || C.options.every((o) => o.length < 16);
      body.push(h('div', { class: 'options' + (two ? ' two' : '') + (!done && !C.sel ? ' nudge-box' : '') }, C.options.map((o) => {
        let state = '';
        if (done) state = o === cd.answer ? 'right' : (o === C.result.sel ? 'wrong' : '');
        return optButton(o, C.sel === o, state, done, () => { C.sel = o; renderCard(); });
      })));
    } else {
      const picked = C.sel ? (M.namesVisible() ? `You picked: ${C.sel}` : 'You picked a country. It is yellow on the map. Tap another one to change it.') : 'Tap your answer on the map.';
      body.push(h('div', { class: 'pick-status' + (C.sel ? ' done' : '') }, done ? `You picked: ${C.result.sel || 'nothing (you passed)'}` : picked));
    }
    if (!done) {
      body.push(h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-primary grow' + (C.sel ? ' nudge' : ''), disabled: !C.sel, onclick: () => confirmReminder(evaluateChallenge) }, 'Submit answer'),
        h('button', { class: 'btn', onclick: () => finishChallenge({ correct: false, passed: true, sel: null }), title: 'Pass: you lose no points' }, 'Pass'),
        readBtn(() => cd.q + (cd.kind === 'mc' ? ' The answers are: ' + C.options.join('; ') + '.' : ' Tap your answer on the map.'))));
    } else {
      const r = C.result;
      const title = r.correct ? `Correct! +${pts(cd.points)}` : r.passed ? 'You passed.' : 'Not quite.';
      const ansText = answers.length > 1 ? `Right answers: ${listText(answers, 'or')}.` : `The answer is ${answers[0]}.`;
      body.push(resultBox(r.correct ? 'good' : r.passed ? 'info' : 'bad', title, ansText, cd.explain,
        r.correct ? { points: cd.points, colour: t.colour } : null));
      const lr = S.turn.lastRoute && D.routes.find((x) => x.id === S.turn.lastRoute);
      const owner = lr && S.claimed[lr.id] != null ? S.teams[S.claimed[lr.id]] : null;
      if (owner) body.push(h('p', { class: 'small-note' }, `The ${routeName(lr)} route already belongs to ${owner.name}.`));
      body.push(h('div', { class: 'card-actions' },
        lr && !owner
          ? h('button', { class: 'btn btn-primary grow nudge', onclick: offerClaim }, 'Next: claim your route', I('arrowR'))
          : h('button', { class: 'btn btn-primary grow nudge', onclick: endTurn }, 'End turn', I('arrowR')),
        readBtn(() => `${title} ${ansText} ${cd.explain}`)));
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
    S.turn.claim = { route: r, countries: shuffle([...r.countries, ...r.wrongCountries]), borders: shuffle([...r.borders, ...r.wrongBorders]), selC: [], selB: [], result: null, started: false, help: wordHelp('border') };
    S.phase = 'claim';
    M.clearMarks();
    renderAll();
  }
  function claimCard() {
    const t = team(), K = S.turn.claim, r = K.route, done = !!K.result;
    const body = [whoLine(t, `${t.name} · bonus round`)];
    if (!K.started) {
      body.push(
        h('div', { class: 'q' }, `Do you want to claim the ${routeName(r)} route?`),
        h('p', null, `Name the 2 countries it joins and the border(s) it crosses. Get it all right for ${pts(CLAIM_POINTS)}. The route turns your colour!`),
        h('div', { class: 'card-actions' },
          h('button', { class: 'btn btn-primary grow nudge', onclick: () => { K.started = true; renderAll(); } }, 'Yes, try to claim it!'),
          h('button', { class: 'btn', onclick: endTurn }, 'Skip and end turn'),
          readBtn(`Do you want to claim the ${routeName(r)} route? Name the two countries it joins and the borders it crosses, for two bonus points.`)));
      return card('route', `+${pts(CLAIM_POINTS)}`, body);
    }
    const toggle = (list, val) => { const i = list.indexOf(val); if (i >= 0) list.splice(i, 1); else list.push(val); renderAll(); };
    const optBtn = (val, list, rightList) => {
      let state = '';
      if (done) state = rightList.includes(val) ? 'right' : (list.includes(val) ? 'wrong' : '');
      return optButton(val, list.includes(val), state, done, () => toggle(list, val));
    };
    const needC = !done && K.selC.length !== 2;
    body.push(
      h('div', { class: 'q' }, `Route: ${routeName(r)}`),
      done ? null : helpBox(K.help),
      stepTitle('A', 'Which 2 countries does it join? (the start and the end)'),
      h('div', { class: 'options two' + (needC ? ' nudge-box' : '') }, K.countries.map((c) => optBtn(c, K.selC, r.countries))),
      stepTitle('B', 'Which border(s) does it cross? Pick all the right ones.'),
      h('div', { class: 'options' + (!done && !needC && !K.selB.length ? ' nudge-box' : '') }, K.borders.map((b) => optBtn(b, K.selB, r.borders))));
    if (!done) {
      const ready = K.selC.length === 2 && K.selB.length >= 1;
      body.push(h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-primary grow' + (ready ? ' nudge' : ''), disabled: !ready, onclick: () => confirmReminder(evaluateClaim) },
          K.selC.length === 2 ? 'Submit claim' : `Pick 2 countries (${K.selC.length}/2)`),
        h('button', { class: 'btn', onclick: () => finishClaim(false, true), title: 'Pass: you lose no points' }, 'Pass'),
        readBtn(() => `Route ${routeName(r)}. Which two countries does it join? Choices: ${K.countries.join(', ')}. Which borders does it cross? Choices: ${K.borders.join('; ')}.`)));
    } else {
      const ok = K.result.correct;
      const fact = r.via.length
        ? `This route joins ${listText(r.countries)}. On the way it goes through ${listText(r.via)}, so it crosses ${r.borders.length} borders: ${listText(r.borders)}.`
        : `This route joins ${listText(r.countries)}. It crosses the ${r.borders[0]} border.`;
      const title = ok ? `Route claimed! +${pts(CLAIM_POINTS)}` : K.result.passed ? 'You passed.' : 'Not quite. The route is still free.';
      body.push(resultBox(ok ? 'good' : K.result.passed ? 'info' : 'bad', title, null, fact + (r.note ? ' ' + r.note : ''),
        ok ? { points: CLAIM_POINTS, colour: t.colour } : null));
      body.push(h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-primary grow nudge', onclick: endTurn }, 'End turn', I('arrowR')),
        readBtn(() => `${title} ${fact}`)));
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
    showModal([
      modalIco('flag'),
      h('h2', null, 'End the game now?'),
      h('p', null, 'The team with the most points wins.'),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn btn-primary btn-xl', onclick: () => { closeModal(); S.over = true; clearInterval(timerId); endGame('teacher'); } }, 'Yes, end the game'),
        h('button', { class: 'btn btn-xl', onclick: closeModal }, 'Keep playing'))]);
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
    const reasons = {
      time: ['clock', "Time's up!"],
      done: ['check', 'Every team has answered 6 challenge cards!'],
      teacher: ['flag', 'The teacher ended the game.']
    };
    const rs = reasons[S.endReason];
    const kids = [rs ? h('div', { class: 'end-reason' }, I(rs[0]), rs[1]) : null];
    let winners = null;
    if (S.tb && S.tb.winner != null) winners = [S.teams[S.tb.winner]];
    else if (S.tb && S.tb.shared) winners = S.tb.shared.map((i) => S.teams[i]);
    else if (tied.length === 1) winners = tied;

    if (winners && winners.length === 1) {
      kids.push(h('h1', null, 'We have a winner!'),
        h('div', { class: 'winner', style: `--team:${winners[0].colour}` }, winners[0].name),
        S.tb ? h('p', null, `${winners[0].name} won the sudden-death tiebreaker!`) : null);
    } else if (winners) {
      kids.push(h('h1', null, "It's a shared win!"),
        h('div', { class: 'winner' }, listText(winners.map((t) => t.name))),
        h('p', null, `After ${TIEBREAK_MAX_ROUNDS} sudden-death rounds, these teams are still level. Well played!`));
    } else {
      kids.push(h('h1', null, "It's a tie!"),
        h('div', { class: 'tie-box' },
          h('p', null, `${listText(tied.map((t) => t.name))} all have ${pts(top)}.`),
          h('p', null, 'Tiebreaker: each tied team gets one map question. If only one team gets it right, they win!'),
          h('button', { class: 'btn btn-primary btn-xl nudge', onclick: () => startTiebreak(tied.map((t) => t.id)) }, I('flag'), 'Start the tiebreaker')));
    }
    let rank = 0, prev = null;
    kids.push(h('div', { class: 'ranking' }, sorted.map((t, i) => {
      if (t.score !== prev) { rank = i; prev = t.score; }
      return h('div', { class: 'rank-row', style: `--team:${t.colour}` },
        h('div', { class: `rank-pos p${rank + 1}` }, `${rank + 1}`),
        h('div', { class: 'rank-name' }, t.name, h('small', null, `${t.challenges}/${CHALLENGES_PER_TEAM} challenges · ${t.claims} route${t.claims === 1 ? '' : 's'} claimed`)),
        h('div', { class: 'rank-pts', 'aria-label': `${t.score} points` }, t.score));
    })));
    kids.push(h('div', { class: 'end-actions' },
      h('button', { class: 'btn btn-primary btn-xl', onclick: startGame }, I('reset'), 'Play again'),
      h('button', { class: 'btn btn-xl', onclick: () => { show('screen-setup'); renderSetup(); } }, I('teams'), 'New teams')));
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
    passDevice(idx, `Tiebreaker, round ${TB.round}!`, () => {
      S.phase = 'tiebreak';
      M.setMode('country');
      renderAll();
    });
  }
  function tiebreakCard() {
    const TB = S.tb, X = TB.current, t = team(X.team), done = !!X.result;
    const body = [
      whoLine(t, `${t.name} · round ${TB.round}`),
      h('div', null, 'Tap this country on the map:'),
      h('div', { class: 'big-target' }, X.country.name),
      h('div', { class: 'pick-status' + (X.sel ? ' done' : '') },
        done ? `You picked: ${X.result.sel || 'nothing (you passed)'}` : X.sel ? (M.namesVisible() ? `You picked: ${X.sel}` : 'You picked a country. It is yellow on the map.') : 'Tap a country on the map.')
    ];
    if (!done) {
      body.push(h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-primary grow' + (X.sel ? ' nudge' : ''), disabled: !X.sel, onclick: () => confirmReminder(() => finishTiebreak(X.sel === X.country.name)) }, 'Submit answer'),
        h('button', { class: 'btn', onclick: () => finishTiebreak(false, true) }, 'Pass'),
        readBtn(`Sudden death. Tap ${X.country.name} on the map.`)));
    } else {
      const ok = X.result.correct;
      body.push(resultBox(ok ? 'good' : 'bad', ok ? 'Correct!' : X.result.passed ? 'You passed.' : 'Not quite.',
        `The answer is ${X.country.name}.`, countryFact(X.country)));
      body.push(h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-primary grow nudge', onclick: nextTiebreakTurn }, TB.queue.length ? 'Next team' : 'See who wins', I('arrowR'))));
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
    showModal([
      modalIco('flag'),
      h('h2', null, 'Still tied!'),
      h('p', null, `${right.length ? 'More than one team got it right.' : 'Nobody got it right.'} On to round ${TB.round}: ${listText(TB.contenders.map((i) => S.teams[i].name))}.`),
      h('div', { class: 'modal-actions' }, h('button', { class: 'btn btn-primary btn-xl', onclick: () => { closeModal(); nextTiebreakTurn(); } }, 'Next round', I('arrowR')))]);
  }

  /* ================= Rendering ================= */
  function card(typeKey, rightLabel, bodyKids) {
    const T = TYPES[typeKey];
    return h('div', { class: `card ${T.cls}` },
      h('div', { class: 'card-head' },
        h('div', { class: 'card-type' }, I(T.icon), T.label),
        rightLabel ? h('div', { class: 'card-pts' }, rightLabel) : null),
      h('div', { class: 'card-body' }, bodyKids));
  }

  function renderScoreboard() {
    $('scoreboard').replaceChildren(...S.teams.map((t, i) => h('div', { class: 'score-row' + (i === S.cur ? ' current' : ''), style: `--team:${t.colour}` },
      h('div', { class: 'score-name' }, t.name),
      h('div', { class: 'score-pts', 'aria-label': `${t.score} points` }, t.score, h('small', null, 'points')),
      h('div', { class: 'score-meta' },
        h('span', { class: 'score-where' }, I('pin'), hubName(t.hub)),
        h('span', { class: 'stamps', title: 'Challenge cards answered' },
          Array.from({ length: CHALLENGES_PER_TEAM }, (_, j) => h('i', { class: j < t.challenges ? 'on' : '' })),
          h('span', null, `${t.challenges}/${CHALLENGES_PER_TEAM} challenges`))))));
  }

  // The "What to do now" bar: who is playing, and exactly what to do next
  function doNow() {
    const P = S.phase, T = S.turn;
    if (S.tb) {
      const X = S.tb.current;
      if (P === 'tiebreak') return ['search', X.sel ? 'Check the map together, then press Submit.' : `Find ${X.country.name} on the map and tap it!`];
      if (P === 'tiebreak-result') return ['arrowR', S.tb.queue.length ? 'Press Next team.' : 'Press See who wins.'];
      return ['device', 'Pass the device to the next team.'];
    }
    switch (P) {
      case 'loc': {
        const L = T.loc;
        if (!L.sel) return ['search', `${L.steal ? 'Steal! ' : ''}Find ${L.country.name} on the map and tap it!`];
        if (!L.cap) return ['pin', `Now pick the capital city of ${L.country.name}.`];
        return ['check', 'Check the map together, then press Submit.'];
      }
      case 'loc-result': return ['dice', 'Press Next to roll the dice.'];
      case 'roll': return ['dice', 'Roll the dice!'];
      case 'move':
        return ['pin', T.moved ? `Pick a glowing pin to move to, or press Stop here. (${T.movesLeft} left)` : `Pick a glowing pin to move to. (${T.movesLeft} route${T.movesLeft === 1 ? '' : 's'} left)`];
      case 'arrived': return ['flag', `You made it to ${hubName(team().hub)}!`];
      case 'challenge': {
        const C = T.ch;
        if (C.card.kind === 'map') return ['search', C.sel ? 'Check the map together, then press Submit.' : 'Read the card. Then tap your answer on the map!'];
        return C.sel ? ['check', 'Check together, then press Submit.'] : ['ticket', 'Read the challenge card and pick an answer.'];
      }
      case 'challenge-result': {
        const lr = T.lastRoute && S.claimed[T.lastRoute] == null;
        return ['arrowR', lr ? 'Press Next to try to claim your route.' : 'Press End turn.'];
      }
      case 'claim': {
        const K = T.claim;
        if (K.result) return ['arrowR', 'Press End turn.'];
        if (!K.started) return ['route', 'Do you want to claim the route? Pick Yes or Skip.'];
        if (K.selC.length !== 2) return ['route', 'Pick the 2 countries this route joins.'];
        if (!K.selB.length) return ['route', 'Now pick the border(s) it crosses.'];
        return ['check', 'Check together, then press Submit.'];
      }
      default: return ['device', 'Pass the device to the next team.'];
    }
  }
  function stepIndex() {
    switch (S.phase) {
      case 'loc': case 'loc-result': return 0;
      case 'roll': return 1;
      case 'move': case 'arrived': return 2;
      case 'challenge': case 'challenge-result': return 3;
      case 'claim': return 4;
      default: return -1;
    }
  }
  function renderDoBar() {
    const L = S.turn && S.turn.loc;
    const who = S.phase === 'loc' && L ? team(L.answerer) : team();
    const label = S.tb ? 'Tiebreaker' : (S.phase === 'loc' && L && L.steal ? 'Steal chance' : 'Your turn');
    const dt = $('doTeam');
    dt.style.setProperty('--team', who.colour);
    dt.replaceChildren(h('small', null, label), who.name);
    $('doBar').style.setProperty('--team', who.colour);
    const [ic, text] = doNow();
    $('doText').replaceChildren(I(ic), h('span', null, S.tb || S.phase === 'waiting' ? text : `Team ${who.name}: ${text}`));
    const now = stepIndex();
    const tr = $('tracker');
    tr.classList.toggle('hidden', !!S.tb);
    const items = [];
    STEPS.forEach((s, i) => {
      if (i) items.push(h('li', { class: 'sep', 'aria-hidden': 'true' }));
      const state = now < 0 ? '' : i < now ? 'done' : i === now ? 'now' : '';
      items.push(h('li', { class: state, 'aria-current': i === now ? 'step' : null },
        h('span', { class: 'n' }, state === 'done' ? I('check') : String(i + 1)), h('span', { class: 'tx' }, s)));
    });
    tr.replaceChildren(...items);
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
      default: el = h('div', { class: 'card t-move' }, h('div', { class: 'card-head' }, h('div', { class: 'card-type' }, I('device'), 'Get ready')), h('div', { class: 'card-body' }, h('p', null, 'Pass the device to the next team.')));
    }
    $('cardArea').replaceChildren(el);
    const askCountry = ['loc', 'tiebreak'].includes(S.phase) || (S.phase === 'challenge' && S.turn.ch.card.kind === 'map');
    // hide names while a team is hunting for a country (unless the teacher turned Names on)
    M.setHideNames(askCountry);
    const picked = S.phase === 'loc' ? S.turn.loc.sel : S.phase === 'tiebreak' ? S.tb.current.sel : S.phase === 'challenge' ? S.turn.ch.sel : null;
    $('mapWrap').classList.toggle('nudge-map', askCountry && !picked);
    // grey out the map when it isn't part of the current step
    const mapUnused = S.phase === 'roll' || S.phase === 'claim' || (S.phase === 'challenge' && S.turn.ch.card.kind === 'mc') ||
      (S.phase === 'challenge-result' && S.turn.ch.card.kind === 'mc');
    M.setQuiet(mapUnused);
    renderDoBar();
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
    document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = window.ICON(el.dataset.icon); });
    const res = M.init({
      country: onCountry,
      hub: onHub,
      water: () => toast("That's the sea! Tap on a country."),
      disputed: () => toast("Western Sahara is a disputed area. People don't agree on who it belongs to, so it is not one of the 54 countries in this game.", 4200)
    });
    if (res.missing.length) {
      const w = $('dataWarning');
      w.textContent = `Data check: these countries were not found on the map file: ${res.missing.join(', ')}. Check the "topo" names in data/questions.js.`;
      w.classList.remove('hidden');
      console.warn('Africa Route Quest data check — missing on map:', res.missing);
    }

    $('btnStart').onclick = () => { show('screen-setup'); renderSetup(); };
    $('btnHowTo').onclick = openGuideScreen;
    $('btnTeachers').onclick = openTeachers;
    $('btnBackHome').onclick = () => show('screen-home');
    $('btnStartGame').onclick = startGame;
    document.querySelectorAll('#teamCount .seg-btn').forEach((b) => { b.onclick = () => { setup.n = +b.dataset.n; renderSetup(); }; });
    document.querySelectorAll('#timerChoice .seg-btn').forEach((b) => { b.onclick = () => { setup.minutes = +b.dataset.min; renderSetup(); }; });
    $('btnPause').onclick = togglePause;
    $('btnEndGame').onclick = confirmEndGame;
    $('btnHelp').onclick = () => { if (!modalOpen) openGuideModal(); };
    const toggleBtn = (id, fn) => {
      const b = $(id);
      b.onclick = () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); fn(on); if (S && S.phase) renderCard(); };
    };
    toggleBtn('btnLabels', (on) => M.setLabels(on));
    toggleBtn('btnTips', (on) => M.setTooltips(on));
    toggleBtn('btnWorld', (on) => $('inset').classList.toggle('hidden', !on));
    if (window.matchMedia('(max-width: 700px)').matches) { $('btnWorld').setAttribute('aria-pressed', 'false'); $('inset').classList.add('hidden'); }
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !modalOpen) return;
      const btns = [...$('modalBox').querySelectorAll('button')];
      if (btns.some((b) => /Go back|Close|Back to the game/.test(b.textContent))) closeModal();
    });
    if (canSpeak) window.speechSynthesis.getVoices();
  }

  // Read-only hook used for automated play-testing
  window.ARQ = { get state() { return S; }, data: D };

  boot();
})();
