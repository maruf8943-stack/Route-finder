// ── Config ────────────────────────────────────────────────────────────────────
const API_URL      = "http://127.0.0.1:5000";

// ── Default graph data (mirrors backend) ──────────────────────────────────────
let GRAPH = {
  A: {B:6, E:4},
  B: {A:6, C:3, E:2},
  C: {B:3, D:5, F:4},
  D: {C:5, F:3, G:6},
  E: {A:4, B:2, F:5},
  F: {C:4, D:3, E:5, G:4, I:7},
  G: {D:6, F:4, H:3, I:5},
  H: {G:3, J:4},
  I: {F:7, G:5, J:6},
  J: {H:4, I:6},
};

let NODE_POS = {
  A: {x:93,  y:383},
  B: {x:163, y:143},
  C: {x:273, y:113},
  D: {x:383, y:153},
  E: {x:263, y:273},
  F: {x:403, y:273},
  G: {x:543, y:253},
  H: {x:673, y:193},
  I: {x:623, y:363},
  J: {x:783, y:113},
};

let EDGES = buildEdgeList(GRAPH);

function buildEdgeList(g) {
  const seen = new Set(), list = [];
  for (const [a, nbrs] of Object.entries(g)) {
    for (const [b, w] of Object.entries(nbrs)) {
      const key = [a,b].sort().join('|');
      if (!seen.has(key)) { seen.add(key); list.push([a,b,w]); }
    }
  }
  return list;
}

// ── State ────────────────────────────────────────────────────────────────────
let selectedAlgo = 'bfs';
let startNode    = null;
let endNode      = null;
let isRunning    = false;

// Step mode
let stepVisited  = [];
let stepPath     = [];
let stepResult   = null;
let stepIndex    = 0;
let stepPhase    = 'idle'; // 'visited' | 'path' | 'done'

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'history') loadHistory();
    if (btn.dataset.tab === 'compare') populateCmpSelects();
  });
});

// ── Draw graph ────────────────────────────────────────────────────────────────
function buildGraph() {
  drawEdges();
  buildNodes();
  setupNodeClicks();
}

function drawEdges() {
  const svg = document.getElementById('edgeSvg');
  svg.innerHTML = '';
  EDGES.forEach(([a,b,cost]) => {
    const p1 = NODE_POS[a], p2 = NODE_POS[b];
    const mx = (p1.x+p2.x)/2, my = (p1.y+p2.y)/2;

    const line = svgEl('line');
    line.setAttribute('x1',p1.x); line.setAttribute('y1',p1.y);
    line.setAttribute('x2',p2.x); line.setAttribute('y2',p2.y);
    line.classList.add('edge-line');
    svg.appendChild(line);

    const txt = svgEl('text');
    txt.setAttribute('x',mx); txt.setAttribute('y',my-5);
    txt.setAttribute('text-anchor','middle');
    txt.classList.add('edge-cost');
    txt.textContent = cost;
    svg.appendChild(txt);
  });
}

function svgEl(tag) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

function buildNodes() {
  const layer = document.getElementById('nodesLayer');
  layer.innerHTML = '';
  for (const [name, pos] of Object.entries(NODE_POS)) {
    const el = document.createElement('div');
    el.className = 'map-node';
    el.dataset.node = name;
    el.style.left = (pos.x - 23) + 'px';
    el.style.top  = (pos.y - 23) + 'px';
    el.innerHTML = `<span class="heuristic" id="h-${name}">h:0</span>
                    <span class="node-name">${name}</span>`;
    layer.appendChild(el);
  }
}

function setupNodeClicks() {
  document.querySelectorAll('.map-node').forEach(el => {
    el.addEventListener('click', () => {
      if (isRunning) return;
      const name = el.dataset.node;
      if (!startNode) {
        startNode = name;
        el.classList.add('selected-start');
        document.getElementById('startName').textContent = name;
        setStatus('Now click a destination node.');
      } else if (!endNode && name !== startNode) {
        endNode = name;
        el.classList.add('selected-end');
        document.getElementById('endName').textContent = name;
        setStatus('Ready! Click ▶ Run or ⏭ Step.');
      } else {
        resetAll();
      }
    });
  });
}

// ── Algo button selection ─────────────────────────────────────────────────────
document.querySelectorAll('.algo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.algo-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedAlgo = btn.dataset.algo;
    // Show/hide heuristic selector
    const hg = document.getElementById('heur-group');
    hg.style.display = ['astar','greedy'].includes(selectedAlgo) ? '' : 'none';
  });
});
document.getElementById('heur-group').style.display = 'none';

// ── Speed slider ──────────────────────────────────────────────────────────────
const speedRange = document.getElementById('speedRange');
const speedValue = document.getElementById('speedValue');
speedRange.addEventListener('input', () => speedValue.textContent = speedRange.value + ' ms');

// ── Run button ────────────────────────────────────────────────────────────────
document.getElementById('runBtn').addEventListener('click', async () => {
  if (!startNode || !endNode) { alert('Select Start and Destination first.'); return; }
  if (isRunning) return;
  isRunning = true;
  clearVisuals(); clearResults();
  setStatus('Running ' + selectedAlgo.toUpperCase() + '...');
  document.getElementById('algoName').textContent = selectedAlgo.toUpperCase();

  const result = await fetchSearch(selectedAlgo, startNode, endNode);
  if (!result) { isRunning = false; return; }

  const delay = +speedRange.value;
  await animateVisited(result.visited, delay);
  await animatePath(result.path, delay);
  showResults(result);
  showAllPaths(result);
  isRunning = false;
});

// ── Step button ───────────────────────────────────────────────────────────────
document.getElementById('stepBtn').addEventListener('click', async () => {
  if (!startNode || !endNode) { alert('Select Start and Destination first.'); return; }
  if (isRunning) return;

  if (stepPhase === 'idle' || stepPhase === 'done') {
    // Fetch fresh result
    clearVisuals(); clearResults();
    const result = await fetchSearch(selectedAlgo, startNode, endNode);
    if (!result) return;
    stepResult  = result;
    stepVisited = result.visited || [];
    stepPath    = result.path    || [];
    stepIndex   = 0;
    stepPhase   = 'visited';
    document.getElementById('algoName').textContent = selectedAlgo.toUpperCase();
  }

  if (stepPhase === 'visited') {
    if (stepIndex < stepVisited.length) {
      const name = stepVisited[stepIndex++];
      const el   = nodeEl(name);
      if (el) el.classList.add('visiting');
      setStatus(`Visiting: ${name} (${stepIndex}/${stepVisited.length})`);
    }
    if (stepIndex >= stepVisited.length) stepPhase = 'path', stepIndex = 0;
  } else if (stepPhase === 'path') {
    if (stepIndex < stepPath.length) {
      const name = stepPath[stepIndex++];
      const el   = nodeEl(name);
      if (el) { el.classList.remove('visiting'); el.classList.add('in-path'); }
      // Draw partial route
      const partial = stepPath.slice(0, stepIndex);
      drawPartialRoute(partial);
      setStatus(`Path: ${partial.join(' → ')}`);
    }
    if (stepIndex >= stepPath.length) {
      stepPhase = 'done';
      showResults(stepResult);
      showAllPaths(stepResult);
    }
  }
});

function drawPartialRoute(path) {
  if (!path.length) return;
  const pts = path.map(n => `${NODE_POS[n].x},${NODE_POS[n].y}`).join(' L ');
  const rp  = document.getElementById('routePath');
  rp.setAttribute('d', 'M ' + pts);
  rp.classList.add('drawn');
}

// ── Reset ────────────────────────────────────────────────────────────────────
document.getElementById('resetBtn').addEventListener('click', resetAll);

function resetAll() {
  isRunning = stepPhase = 'idle';
  startNode = endNode = null;
  stepIndex = 0;
  document.getElementById('startName').textContent = '—';
  document.getElementById('endName').textContent   = '—';
  setStatus('Click a node to set Start, then another for Destination.');
  clearVisuals(); clearResults();
  document.querySelectorAll('.map-node').forEach(el =>
    el.classList.remove('selected-start','selected-end','visiting','in-path')
  );
  document.querySelectorAll('.heuristic').forEach(el => el.textContent = 'h:0');
  document.getElementById('allPathsPanel').style.display = 'none';
}

// ── API fetch helper ─────────────────────────────────────────────────────────
async function fetchSearch(algo, start, goal, customGraph, customPos) {
  const heur = document.getElementById('heurSelect')?.value || 'euclidean';
  const body = {algo, start, goal, heuristic: heur};
  if (customGraph) body.graph    = customGraph;
  if (customPos)   body.node_pos = customPos;
  try {
    const res = await fetch(API_URL + '/search', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch(e) {
    alert('❌ Cannot connect to backend.\nRun:  python app.py');
    return null;
  }
}

// ── Animation helpers ─────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function animateVisited(visited, delay) {
  for (const name of visited) {
    const el = nodeEl(name);
    if (el) el.classList.add('visiting');
    await sleep(delay);
  }
}

async function animatePath(path, delay) {
  if (!path?.length) return;
  for (const name of path) {
    const el = nodeEl(name);
    if (el) { el.classList.remove('visiting'); el.classList.add('in-path'); }
    drawPartialRoute(path.slice(0, path.indexOf(name)+1));
    await sleep(delay / 2);
  }
}

function clearVisuals() {
  const rp = document.getElementById('routePath');
  rp.setAttribute('d',''); rp.classList.remove('drawn');
  document.querySelectorAll('.map-node').forEach(el =>
    el.classList.remove('visiting','in-path')
  );
}

// ── Results ──────────────────────────────────────────────────────────────────
function showResults(r) {
  setText('visitedOrder',  r.visited?.join(' → ') || '—');
  setText('visitedNodes',  r.visited?.length       || '—');
  setText('pathNodes',     r.path?.length ? r.path.join(' → ') : 'No path found');
  setText('pathCost',      r.cost  ?? '—');
  setText('elapsedMs',     r.elapsed_ms !== undefined ? r.elapsed_ms + ' ms' : '—');

  setStatus(r.path?.length ? '✅ Path found!' : '❌ No path found.');

  if (r.heuristics) {
    setText('heuristicValue', r.heuristics[startNode] ?? '—');
    Object.entries(r.heuristics).forEach(([n,h]) => {
      const el = document.getElementById('h-'+n);
      if (el) el.textContent = 'h:'+h;
    });
    if (r.node_details) {
      const details = Object.entries(r.node_details)
        .map(([n,v]) => `${n}(g:${v.g} h:${v.h} f:${v.f})`).join(' | ');
      setText('astarDetails', details);
    }
  } else {
    setText('heuristicValue', '—');
    setText('astarDetails', '—');
  }
}

function showAllPaths(r) {
  const panel = document.getElementById('allPathsPanel');
  const list  = document.getElementById('allPathsList');
  if (r.all_paths && r.all_paths.length > 1) {
    panel.style.display = '';
    list.innerHTML = r.all_paths.map((p,i) =>
      `<span class="path-pill">Path ${i+1}: ${p.join('→')}</span>`
    ).join('');
  } else {
    panel.style.display = 'none';
  }
}

function clearResults() {
  ['algoName','visitedOrder','visitedNodes','pathNodes','pathCost','elapsedMs','heuristicValue','astarDetails']
    .forEach(id => setText(id, '—'));
}

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}
function setStatus(txt) {
  const el = document.getElementById('statusText');
  if (el) el.textContent = txt;
}
function nodeEl(name) {
  return document.querySelector(`.map-node[data-node="${name}"]`);
}

// ── Compare Tab ──────────────────────────────────────────────────────────────
function populateCmpSelects() {
  const nodes = Object.keys(GRAPH);
  ['cmpStart','cmpEnd'].forEach((id,i) => {
    const sel = document.getElementById(id);
    sel.innerHTML = nodes.map(n => `<option value="${n}"${(i===0&&n==='A')||(i===1&&n==='J')?' selected':''}>${n}</option>`).join('');
  });
}

document.getElementById('compareBtn').addEventListener('click', async () => {
  const start = document.getElementById('cmpStart').value;
  const end   = document.getElementById('cmpEnd').value;
  if (start === end) { alert('Start and End must differ.'); return; }

  try {
    const res = await fetch(API_URL + '/compare', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({start, goal: end})
    });
    const data = await res.json();
    renderCompareTable(data);
    renderCompareChart(data);
  } catch(e) {
    alert('❌ Backend not reachable.');
  }
});

function renderCompareTable(data) {
  const algos   = Object.keys(data);
  const minCost = Math.min(...algos.map(a => data[a].cost || Infinity));
  const minVis  = Math.min(...algos.map(a => data[a].visited));

  let html = `<table><thead><tr>
    <th>Algorithm</th><th>Path</th><th>Cost</th>
    <th>Nodes Visited</th><th>Path Length</th><th>Time (ms)</th>
  </tr></thead><tbody>`;

  for (const a of algos) {
    const d = data[a];
    const bestCost = d.cost === minCost ? ' best' : '';
    const bestVis  = d.visited === minVis ? ' best' : '';
    html += `<tr>
      <td><strong>${a.toUpperCase()}</strong></td>
      <td>${d.path.join(' → ') || 'No path'}</td>
      <td class="${bestCost}">${d.cost}</td>
      <td class="${bestVis}">${d.visited}</td>
      <td>${d.path_length}</td>
      <td>${d.elapsed_ms}</td>
    </tr>`;
  }
  html += '</tbody></table>';
  document.getElementById('compareTable').innerHTML = html;
}

function renderCompareChart(data) {
  const canvas = document.getElementById('compareChart');
  const ctx    = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const algos  = Object.keys(data);
  const costs   = algos.map(a => data[a].cost);
  const visited = algos.map(a => data[a].visited);

  const W = canvas.offsetWidth || 700, H = 260;
  canvas.width = W; canvas.height = H;

  const barW  = Math.min(50, (W - 80) / algos.length / 2 - 8);
  const gap   = (W - 80) / algos.length;
  const maxC  = Math.max(...costs,  1);
  const maxV  = Math.max(...visited,1);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0,0,W,H);

  algos.forEach((a,i) => {
    const x   = 40 + i * gap + gap/2;
    const cH  = (costs[i]   / maxC) * (H-60);
    const vH  = (visited[i] / maxV) * (H-60);

    // Cost bar
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(x - barW - 2, H-40-cH, barW, cH);

    // Visited bar
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(x + 2, H-40-vH, barW, vH);

    // Labels
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 12px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText(a.toUpperCase(), x, H-20);

    ctx.fillStyle = '#1d4ed8';
    ctx.font = '11px Segoe UI';
    ctx.fillText(costs[i], x-barW/2-2, H-42-cH);

    ctx.fillStyle = '#15803d';
    ctx.fillText(visited[i], x+barW/2+2, H-42-vH);
  });

  // Legend
  ctx.fillStyle = '#2563eb'; ctx.fillRect(10,10,14,14);
  ctx.fillStyle = '#374151'; ctx.font='12px Segoe UI'; ctx.textAlign='left';
  ctx.fillText('Cost', 28, 22);
  ctx.fillStyle = '#16a34a'; ctx.fillRect(80,10,14,14);
  ctx.fillStyle = '#374151'; ctx.fillText('Nodes Visited', 98, 22);
}

// ── Custom Graph Tab ──────────────────────────────────────────────────────────
function loadDefaultJson() {
  const pos = {};
  Object.entries(NODE_POS).forEach(([k,v]) => pos[k] = [v.x, v.y]);
  const obj = {
    graph: Object.fromEntries(Object.entries(GRAPH).map(([k,v])=>[k,v])),
    node_pos: pos
  };
  document.getElementById('graphJson').value = JSON.stringify(obj, null, 2);
}

document.getElementById('validateBtn').addEventListener('click', async () => {
  const msg  = document.getElementById('validateMsg');
  let parsed;
  try { parsed = JSON.parse(document.getElementById('graphJson').value); }
  catch(e) { showValidateMsg('❌ JSON parse error: '+e.message, false); return; }
  try {
    const res = await fetch(API_URL+'/validate_graph', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(parsed)
    });
    const data = await res.json();
    if (data.valid) showValidateMsg('✅ Graph is valid!', true);
    else showValidateMsg('❌ Errors: '+data.errors.join(' | '), false);
  } catch(e) { showValidateMsg('❌ Backend not reachable.', false); }
});

document.getElementById('applyBtn').addEventListener('click', () => {
  let parsed;
  try { parsed = JSON.parse(document.getElementById('graphJson').value); }
  catch(e) { showValidateMsg('❌ Invalid JSON.', false); return; }

  GRAPH    = parsed.graph;
  NODE_POS = {};
  Object.entries(parsed.node_pos).forEach(([k,v]) => {
    NODE_POS[k] = {x: v[0], y: v[1]};
  });
  EDGES = buildEdgeList(GRAPH);
  buildGraph();
  resetAll();
  populateCmpSelects();
  showValidateMsg('✅ Custom graph applied!', true);
  // Switch to visualizer
  document.querySelector('[data-tab="visualize"]').click();
});

document.getElementById('restoreBtn').addEventListener('click', () => {
  loadDefaultJson();
  showValidateMsg('↺ Default graph loaded (click Apply to use it).', true);
});

function showValidateMsg(text, ok) {
  const el = document.getElementById('validateMsg');
  el.textContent = text;
  el.className   = 'validate-msg ' + (ok ? 'ok' : 'error');
}

// ── History Tab ───────────────────────────────────────────────────────────────
async function loadHistory() {
  try {
    const res  = await fetch(API_URL + '/history');
    const data = await res.json();
    renderHistory(data);
  } catch(e) {
    document.getElementById('historyTable').innerHTML = '<p style="color:#888">Backend not reachable.</p>';
  }
}

function renderHistory(data) {
  if (!data.length) {
    document.getElementById('historyTable').innerHTML = '<p style="color:#888">No searches yet.</p>';
    return;
  }
  let html = `<table><thead><tr>
    <th>#</th><th>Algorithm</th><th>Start</th><th>Goal</th>
    <th>Path</th><th>Cost</th><th>Visited</th><th>Time (ms)</th>
  </tr></thead><tbody>`;
  data.forEach((d,i) => {
    html += `<tr>
      <td>${i+1}</td>
      <td><strong>${d.algo.toUpperCase()}</strong></td>
      <td>${d.start}</td><td>${d.goal}</td>
      <td>${d.path.join(' → ') || '—'}</td>
      <td>${d.cost}</td><td>${d.visited}</td><td>${d.elapsed_ms}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('historyTable').innerHTML = html;
}

document.getElementById('clearHistBtn').addEventListener('click', async () => {
  // Just reload an empty local array (no backend clear endpoint needed)
  document.getElementById('historyTable').innerHTML = '<p style="color:#888">History cleared (reload page).</p>';
});

// ── Init ──────────────────────────────────────────────────────────────────────
buildGraph();
loadDefaultJson();
populateCmpSelects();
