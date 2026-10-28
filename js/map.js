/* Africa Route Quest — map drawing (D3, Equal Earth projection) */
(function () {
  'use strict';
  const D = window.GAME_DATA;
  const TOPO = window.WORLD_TOPO;
  const W = 1000, H = 920;
  const PALETTE = ['#ffd3a1', '#c6ebbd', '#bcdcff', '#f7c5dd', '#fff0a0', '#d8ccfb'];
  const SMALL_AREA = 70; // countries smaller than this (px² at zoom 1) get a round tap target
  // Where each hub's name sits so the labels don't overlap
  const HUB_LABEL = {
    cairo: 'above', algiers: 'above', dakar: 'left', lagos: 'below', kinshasa: 'left', nairobi: 'right',
    addis: 'right', kampala: 'left', dodoma: 'below', lusaka: 'below', gaborone: 'right', capetown: 'below'
  };

  const api = {};
  let svg, root, zoom, projection, geoPath, wrap, tip, tipTimer;
  let k = 1, mode = 'none', handlers = {}, zoomEndTimer;
  let labelsOn = false, tipsOn = true, hideNames = false;
  const countryByTopo = new Map();     // map-file name -> country record
  const elsByCountry = new Map();      // country name -> [svg elements]
  const capByCountry = new Map();      // country name -> [star elements]
  const hubXY = new Map();             // hub id -> [x, y]
  let routeLayer, hubLayer, counterLayer;

  api.namesVisible = () => labelsOn || (tipsOn && !hideNames);

  api.init = function (opts) {
    handlers = opts;
    wrap = document.getElementById('mapWrap');
    tip = document.getElementById('tooltip');

    D.countries.forEach((c) => {
      countryByTopo.set(c.topo || c.name, c);
      (c.topoAlso || []).forEach((n) => countryByTopo.set(n, c));
    });

    const geoms = TOPO.objects.countries.geometries;
    const features = topojson.feature(TOPO, TOPO.objects.countries).features;
    const neighbours = topojson.neighbors(geoms);
    const found = new Set();
    features.forEach((f) => { const c = countryByTopo.get(f.properties.name); if (c) found.add(c.name); });
    const missing = D.countries.filter((c) => !found.has(c.name)).map((c) => c.name);

    projection = d3.geoEqualEarth().fitExtent([[10, 10], [W - 10, H - 10]],
      { type: 'MultiPoint', coordinates: [[-27, 44], [63, 44], [-27, -39.5], [63, -39.5]] });
    geoPath = d3.geoPath(projection);

    svg = d3.select('#mainMap').attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet');
    svg.classed('labels-off', true);
    root = svg.append('g').attr('class', 'zoom-root');
    root.append('rect').attr('class', 'ocean-bg').attr('x', -W).attr('y', -H).attr('width', W * 3).attr('height', H * 3)
      .on('click', () => { if (mode === 'country' && handlers.water) handlers.water(); });

    // Proper map colouring: neighbouring African countries get different colours
    const colourOf = new Map();
    features.forEach((f, i) => {
      if (!countryByTopo.has(f.properties.name)) return;
      const used = new Set(neighbours[i].map((j) => colourOf.get(j)));
      let ci = 0; while (used.has(ci)) ci++;
      colourOf.set(i, ci % PALETTE.length);
    });

    const gCountries = root.append('g');
    const smallOnes = [];
    features.forEach((f, i) => {
      const name = f.properties.name;
      const c = countryByTopo.get(name);
      const p = gCountries.append('path').attr('d', geoPath(f)).attr('class', 'country');
      if (c) {
        p.classed('af', true).attr('fill', PALETTE[colourOf.get(i)]).attr('data-name', c.name).datum(c);
        addEl(c.name, p.node());
        bindCountry(p, c);
        if (geoPath.area(f) < SMALL_AREA && !smallOnes.includes(c)) smallOnes.push(c);
      } else if (name === 'W. Sahara') {
        p.classed('af disputed', true)
          .on('pointermove', (e) => showTip(e, 'Western Sahara (disputed territory)'))
          .on('pointerleave', hideTip)
          .on('click', () => { if (mode === 'country' && handlers.disputed) handlers.disputed(); });
      } else {
        p.classed('other', true);
      }
    });

    // Equator
    const eq = d3.range(-40, 81, 2).map((lon) => [lon, 0]);
    root.append('path').attr('class', 'equator').attr('d', geoPath({ type: 'LineString', coordinates: eq }));

    // Seas, oceans, neighbouring continents
    const gText = root.append('g');
    const place = (cls, text, lonlat, size) => {
      const [x, y] = projection(lonlat);
      const g = gText.append('g').attr('transform', `translate(${x},${y})`).append('g').attr('class', 'sc');
      g.append('text').attr('class', cls).attr('font-size', size).text(text);
    };
    place('sea-label', 'ATLANTIC OCEAN', [-16, -12], 18);
    place('sea-label', 'INDIAN OCEAN', [55, -30], 18);
    place('sea-label', 'MEDITERRANEAN SEA', [18, 34.6], 14);
    place('sea-label', 'Red Sea', [39.2, 19.5], 11);
    place('sea-label', 'Gulf of Guinea', [3, 2.2], 11);
    place('cont-label', 'EUROPE', [14, 42.5], 18);
    place('cont-label', 'ASIA', [47, 16.5], 20);
    place('eq-label', 'Equator 0°', [-24, 0.9], 13);

    // Round tap targets for very small countries (mostly islands)
    const gIslands = root.append('g');
    smallOnes.forEach((c) => {
      const [x, y] = projection([c.lon, c.lat]);
      const g = gIslands.append('g').attr('transform', `translate(${x},${y})`).append('g').attr('class', 'sc');
      const circ = g.append('circle').attr('class', 'island-hit').attr('r', 15).attr('data-name', c.name).datum(c);
      addEl(c.name, circ.node());
      bindCountry(circ, c);
    });

    // Routes
    routeLayer = root.append('g');

    // Capital stars
    const gCaps = root.append('g');
    const star = d3.symbol().type(d3.symbolStar).size(75)();
    const gLabels = root.append('g').attr('class', 'country-labels');
    D.countries.forEach((c) => {
      const caps = [{ city: c.capital, lat: c.lat, lon: c.lon }, ...(c.extraCapitals || [])];
      caps.forEach((cap) => {
        const [x, y] = projection([cap.lon, cap.lat]);
        const s = gCaps.append('g').attr('transform', `translate(${x},${y})`).append('g').attr('class', 'sc')
          .append('path').attr('class', 'cap-star').attr('d', star);
        if (!capByCountry.has(c.name)) capByCountry.set(c.name, []);
        capByCountry.get(c.name).push(s.node());
        gLabels.append('g').attr('transform', `translate(${x},${y})`).append('g').attr('class', 'sc')
          .append('text').attr('class', 'label cap-label').attr('y', 13).text(cap.city);
      });
    });

    // Country name labels (shown with the Labels toggle)
    D.countries.forEach((c) => {
      const fs = features.filter((f) => countryByTopo.get(f.properties.name) === c);
      if (!fs.length) return;
      let xy;
      const main = fs.reduce((a, b) => (geoPath.area(b) > geoPath.area(a) ? b : a));
      if (geoPath.area(main) < SMALL_AREA * 3) {
        const [x, y] = projection([c.lon, c.lat]); xy = [x, y - 22];
      } else {
        // label at the centre of the largest piece of the country
        const poly = main.geometry.type === 'MultiPolygon'
          ? { type: 'Polygon', coordinates: main.geometry.coordinates.reduce((a, b) => (d3.geoArea({ type: 'Polygon', coordinates: b }) > d3.geoArea({ type: 'Polygon', coordinates: a }) ? b : a)) }
          : main.geometry;
        xy = geoPath.centroid(poly);
      }
      const short = { 'Democratic Republic of the Congo': 'DR Congo', 'Republic of the Congo': 'Rep. of Congo', 'Central African Republic': 'Central African Rep.', 'São Tomé and Príncipe': 'São Tomé & Príncipe' }[c.name] || c.name;
      gLabels.append('g').attr('transform', `translate(${xy[0]},${xy[1]})`).append('g').attr('class', 'sc')
        .append('text').attr('class', 'label').attr('font-size', 11.5).attr('dy', '-0.2em').text(short);
    });

    // Hubs
    hubLayer = root.append('g');
    D.hubs.forEach((h) => {
      const [x, y] = projection([h.lon, h.lat]);
      hubXY.set(h.id, [x, y]);
      const g = hubLayer.append('g').attr('class', 'hub').attr('data-id', h.id).attr('transform', `translate(${x},${y})`);
      const s = g.append('g').attr('class', 'sc');
      s.append('circle').attr('class', 'hub-ring').attr('r', 24);
      s.append('circle').attr('class', 'hub-dot').attr('r', 15);
      s.append('circle').attr('class', 'hub-inner').attr('r', 4.5);
      s.append('circle').attr('r', 28).attr('fill', 'transparent'); // bigger tap area
      const pos = HUB_LABEL[h.id] || 'below';
      const t = s.append('text').attr('class', 'hub-label').text(h.city);
      if (pos === 'below') t.attr('y', 36);
      if (pos === 'above') t.attr('y', -24);
      if (pos === 'left') t.attr('x', -24).attr('y', 5).attr('text-anchor', 'end');
      if (pos === 'right') t.attr('x', 24).attr('y', 5).attr('text-anchor', 'start');
      g.on('click', (e) => { e.stopPropagation(); if (mode === 'hub' && handlers.hub) handlers.hub(h.id); })
        .on('pointermove', (e) => showTip(e, h.city + ' hub — ' + (h.hubNote || h.country)))
        .on('pointerleave', hideTip);
    });
    counterLayer = root.append('g');

    // Zoom & pan
    zoom = d3.zoom().scaleExtent([1, 12]).translateExtent([[-80, -80], [W + 80, H + 80]])
      .on('zoom', (e) => {
        root.attr('transform', e.transform);
        k = e.transform.k;
        root.style('--k', k);
        svg.selectAll('.sc').attr('transform', `scale(${1 / k})`);
        counterLayer.classed('zooming', true);
        clearTimeout(zoomEndTimer); zoomEndTimer = setTimeout(() => counterLayer.classed('zooming', false), 150);
        api.renderCounters(lastTeams);
      });
    svg.call(zoom).on('dblclick.zoom', null);
    document.getElementById('zoomIn').onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1.6);
    document.getElementById('zoomOut').onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.6);
    document.getElementById('zoomReset').onclick = () => api.resetZoom();

    drawWorld(features);
    return { missing };
  };

  function addEl(name, el) {
    if (!elsByCountry.has(name)) elsByCountry.set(name, []);
    elsByCountry.get(name).push(el);
  }

  function bindCountry(sel, c) {
    sel.on('pointermove', (e) => { if (api.namesVisible()) showTip(e, c.name); else hideTip(); })
      .on('pointerleave', hideTip)
      .on('pointerdown', (e) => {
        if (e.pointerType === 'touch' && api.namesVisible()) {
          showTip(e, c.name);
          clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 1600);
        }
      })
      .on('click', (e) => { e.stopPropagation(); if (mode === 'country' && handlers.country) handlers.country(c); });
  }

  function showTip(e, text) {
    const r = wrap.getBoundingClientRect();
    tip.textContent = text;
    tip.style.left = (e.clientX - r.left) + 'px';
    tip.style.top = (e.clientY - r.top) + 'px';
    tip.classList.remove('hidden');
  }
  function hideTip() { tip.classList.add('hidden'); }

  function drawWorld(features) {
    const ws = d3.select('#worldMap');
    const VW = 360, VH = 180;
    ws.attr('viewBox', `0 0 ${VW} ${VH}`);
    const proj = d3.geoEqualEarth().fitExtent([[3, 3], [VW - 3, VH - 3]], { type: 'Sphere' });
    const p = d3.geoPath(proj);
    ws.append('path').attr('class', 'w-sphere').attr('d', p({ type: 'Sphere' }));
    ws.append('g').selectAll('path').data(features.filter((f) => f.properties.name !== 'Antarctica')).join('path')
      .attr('class', (f) => (countryByTopo.has(f.properties.name) || f.properties.name === 'W. Sahara' ? 'w-land w-africa' : 'w-land'))
      .attr('d', p);
    ws.append('path').attr('class', 'w-eq').attr('d', p({ type: 'LineString', coordinates: d3.range(-180, 181, 5).map((x) => [x, 0]) }));
    const lab = (text, ll, cls) => { const [x, y] = proj(ll); ws.append('text').attr('class', 'w-label ' + (cls || '')).attr('x', x).attr('y', y).text(text); };
    const lab2 = (a, b, ll) => { const [x, y] = proj(ll); const t = ws.append('text').attr('class', 'w-label sea').attr('x', x).attr('y', y); t.append('tspan').attr('x', x).text(a); t.append('tspan').attr('x', x).attr('dy', '1.05em').text(b); };
    lab('AFRICA', [20, 12], 'af');
    lab('EUROPE', [30, 55]);
    lab('ASIA', [92, 46]);
    lab('N. AMERICA', [-104, 40]);
    lab('S. AMERICA', [-74, -13]);
    lab('AUSTRALIA', [134, -25]);
    lab2('Atlantic', 'Ocean', [-14, -11]);
    lab2('Indian', 'Ocean', [72, -15]);
    lab2('Pacific', 'Ocean', [-140, -12]);
    // the Mediterranean is tiny at this size, so its label sits over the Atlantic with a pointer line
    const [mx, my] = proj([15, 35.5]), [tx, ty] = proj([-60, 60]);
    ws.append('line').attr('x1', tx + 14).attr('y1', ty + 2).attr('x2', mx).attr('y2', my).attr('stroke', '#245f8f').attr('stroke-width', .8);
    ws.append('circle').attr('cx', mx).attr('cy', my).attr('r', 1.6).attr('fill', '#245f8f');
    lab('Mediterranean Sea', [-60, 60], 'sea');
    lab('Equator', [-178, -2.5], 'eq');
  }

  api.setMode = function (m) {
    mode = m;
    svg.classed('mode-hub', m === 'hub').classed('mode-country', m === 'country');
    if (m !== 'country') hideTip();
  };
  api.setLabels = function (on) { labelsOn = on; svg.classed('labels-off', !on); };
  api.setTooltips = function (on) { tipsOn = on; if (!on) hideTip(); };
  api.setHideNames = function (on) { hideNames = on; if (on) hideTip(); };
  api.resetZoom = () => svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);

  api.select = function (name) {
    svg.selectAll('.selected').classed('selected', false);
    (elsByCountry.get(name) || []).forEach((el) => el.classList.add('selected'));
  };
  api.reveal = function (goodNames, badName) {
    api.select(null);
    goodNames.forEach((n) => (elsByCountry.get(n) || []).forEach((el) => el.classList.add('reveal-good')));
    if (badName && !goodNames.includes(badName)) (elsByCountry.get(badName) || []).forEach((el) => el.classList.add('reveal-bad'));
  };
  api.flashCapital = function (name) {
    (capByCountry.get(name) || []).forEach((el) => el.classList.add('flash'));
  };
  api.clearMarks = function () {
    svg.selectAll('.selected,.reveal-good,.reveal-bad,.flash').classed('selected reveal-good reveal-bad flash', false);
  };

  /* routes: claimed = {routeId: colour}; opts = {travelled: [ids], options: [ids], colour} */
  api.renderRoutes = function (claimed, opts) {
    opts = opts || {};
    routeLayer.selectAll('*').remove();
    D.routes.forEach((r) => {
      const d = geoPath({ type: 'LineString', coordinates: r.path });
      routeLayer.append('path').attr('class', 'route-case').attr('d', d);
    });
    D.routes.forEach((r) => {
      const d = geoPath({ type: 'LineString', coordinates: r.path });
      const p = routeLayer.append('path').attr('class', 'route').attr('d', d).attr('data-id', r.id);
      if (claimed[r.id]) p.classed('claimed', true).style('stroke', claimed[r.id]);
      if ((opts.options || []).includes(r.id)) p.classed('option', true).style('--team', opts.colour);
      if ((opts.travelled || []).includes(r.id)) {
        routeLayer.append('path').attr('class', 'route travelled').attr('d', d).style('stroke', '#fff');
      }
    });
  };

  api.highlightHubs = function (reachable, hereId, colour) {
    hubLayer.selectAll('.hub').each(function () {
      const id = this.getAttribute('data-id');
      this.classList.toggle('reachable', reachable.includes(id));
      this.classList.toggle('here', id === hereId);
      this.style.setProperty('--team', colour || '#ff8a00');
    });
  };

  let lastTeams = [];
  api.renderCounters = function (teams) {
    lastTeams = teams || [];
    const sel = counterLayer.selectAll('g.counter').data(lastTeams, (t) => t.id);
    sel.exit().remove();
    const enter = sel.enter().append('g').attr('class', 'counter');
    enter.append('circle').attr('r', 11);
    enter.append('text');
    const all = enter.merge(sel);
    all.select('circle').attr('fill', (t) => t.colour);
    all.select('text').text((t) => t.name.trim().charAt(0).toUpperCase() || '?');
    all.each(function (t) {
      // spread teams that share a hub around it
      const same = lastTeams.filter((o) => o.hub === t.hub);
      const idx = same.indexOf(t);
      const base = { below: -Math.PI / 2, above: Math.PI / 2, left: 0, right: Math.PI }[HUB_LABEL[t.hub] || 'below'];
      const ang = base + (idx - (same.length - 1) / 2) * 0.8;
      const [hx, hy] = hubXY.get(t.hub);
      const x = hx + (Math.cos(ang) * 27) / k, y = hy + (Math.sin(ang) * 27) / k;
      this.style.transform = `translate(${x}px, ${y}px) scale(${1 / k})`;
    });
  };

  window.ARQMap = api;
})();
