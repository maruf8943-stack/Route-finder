// ─── Config ──────────────────────────────────────────────────────────────────
const API_URL = "/search";

// Node center positions (px) matching index.html layout
const NODE_POS = {
  A: { x: 93,  y: 383 },
  B: { x: 163, y: 143 },
  C: { x: 273, y: 113 },
  D: { x: 383, y: 153 },
  E: { x: 263, y: 273 },
  F: { x: 403, y: 273 },
  G: { x: 543, y: 253 },
  H: { x: 673, y: 193 },
  I: { x: 623, y: 363 },
  J: { x: 783, y: 113 },
};

// Edges with costs
const EDGES = [
  ["A","B",6], ["A","E",4],
  ["B","C",3], ["B","E",2],
  ["C","D",5], ["C","F",4],
  ["D","F",3], ["D","G",6],
  ["E","F",5],
  ["F","G",4], ["F","I",7],
  ["G","H",3], ["G","I",5],
  ["H","J",4],
  ["I","J",6],
];

// ─── State ───────────────────────────────────────────────────────────────────
let selectedAlgo = "bfs";
let startNode    = null;
let endNode      = null;
let isRunning    = false;

// ─── Draw edges on SVG ───────────────────────────────────────────────────────
function drawEdges() {
  const svg = document.getElementById("edgeSvg");
  svg.innerHTML = "";

  EDGES.forEach(([a, b, cost]) => {
    const p1 = NODE_POS[a], p2 = NODE_POS[b];
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", p1.x); line.setAttribute("y1", p1.y);
    line.setAttribute("x2", p2.x); line.setAttribute("y2", p2.y);
    line.classList.add("edge-line");
    svg.appendChild(line);

    const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    txt.setAttribute("x", mx); txt.setAttribute("y", my - 4);
    txt.setAttribute("text-anchor", "middle");
    txt.classList.add("edge-cost");
    txt.textContent = cost;
    svg.appendChild(txt);
  });
}

// ─── Node click handler ───────────────────────────────────────────────────────
function setupNodeClicks() {
  document.querySelectorAll(".map-node").forEach(el => {
    el.addEventListener("click", () => {
      if (isRunning) return;
      const name = el.dataset.node;

      if (!startNode) {
        startNode = name;
        el.classList.add("selected-start");
        document.getElementById("startName").textContent = name;
        document.getElementById("statusText").textContent = "Now click a destination node.";
      } else if (!endNode && name !== startNode) {
        endNode = name;
        el.classList.add("selected-end");
        document.getElementById("endName").textContent = name;
        document.getElementById("statusText").textContent = "Ready! Click Run to start.";
      } else {
        resetAll();
      }
    });
  });
}

// ─── Algorithm buttons ────────────────────────────────────────────────────────
document.querySelectorAll(".algo-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".algo-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedAlgo = btn.dataset.algo;
  });
});

// ─── Speed slider ─────────────────────────────────────────────────────────────
const speedRange = document.getElementById("speedRange");
const speedValue = document.getElementById("speedValue");
speedRange.addEventListener("input", () => {
  speedValue.textContent = speedRange.value + " ms";
});

// ─── Run button ───────────────────────────────────────────────────────────────
document.getElementById("runBtn").addEventListener("click", async () => {
  if (!startNode || !endNode) {
    alert("Please select a start and destination node first.");
    return;
  }
  if (isRunning) return;
  isRunning = true;

  clearVisuals();
  document.getElementById("algoName").textContent     = selectedAlgo.toUpperCase();
  document.getElementById("visitedOrder").textContent = "Running...";
  document.getElementById("statusText").textContent   = "Running " + selectedAlgo.toUpperCase() + "...";

  let result;
  try {
    const res = await fetch(API_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ algo: selectedAlgo, start: startNode, goal: endNode }),
    });
    result = await res.json();
  } catch (e) {
    alert("❌ Cannot connect to Python backend.\nMake sure app.py is running:\n  python app.py");
    isRunning = false;
    return;
  }

  const delay = parseInt(speedRange.value);
  await animateVisited(result.visited, delay);
  await animatePath(result.path, delay);
  showResults(result);
  isRunning = false;
});

// ─── Reset button ────────────────────────────────────────────────────────────
document.getElementById("resetBtn").addEventListener("click", resetAll);

function resetAll() {
  isRunning  = false;
  startNode  = null;
  endNode    = null;
  document.getElementById("startName").textContent = "Not Selected";
  document.getElementById("endName").textContent   = "Not Selected";
  document.getElementById("statusText").textContent = "Click one node for Start, then another for Destination.";
  clearVisuals();
  clearResults();
  document.querySelectorAll(".map-node").forEach(el => {
    el.classList.remove("selected-start","selected-end","visiting","in-path");
  });
  // Reset heuristic labels
  document.querySelectorAll(".heuristic").forEach(el => el.textContent = "h:0");
}

// ─── Animation helpers ────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function animateVisited(visited, delay) {
  for (const name of visited) {
    const el = document.querySelector(`.map-node[data-node="${name}"]`);
    if (el) { el.classList.add("visiting"); }
    await sleep(delay);
  }
}

async function animatePath(path, delay) {
  if (!path || path.length === 0) return;

  // Draw animated SVG path
  const pts = path.map(n => `${NODE_POS[n].x},${NODE_POS[n].y}`).join(" L ");
  const routePath = document.getElementById("routePath");
  routePath.setAttribute("d", "M " + pts);

  // Highlight nodes
  for (const name of path) {
    const el = document.querySelector(`.map-node[data-node="${name}"]`);
    if (el) {
      el.classList.remove("visiting");
      el.classList.add("in-path");
    }
    await sleep(delay / 2);
  }
}

function clearVisuals() {
  document.getElementById("routePath").setAttribute("d", "");
  document.querySelectorAll(".map-node").forEach(el => {
    el.classList.remove("visiting","in-path");
  });
}

// ─── Results panel ────────────────────────────────────────────────────────────
function showResults(r) {
  document.getElementById("visitedOrder").textContent  = r.visited ? r.visited.join(" → ") : "-";
  document.getElementById("visitedNodes").textContent  = r.visited ? r.visited.length : "-";
  document.getElementById("pathNodes").textContent     = r.path && r.path.length ? r.path.join(" → ") : "No path found";
  document.getElementById("pathCost").textContent      = r.cost !== undefined ? r.cost : "-";
  document.getElementById("statusText").textContent    = r.path && r.path.length ? "✅ Path found!" : "❌ No path found.";

  // A* specific
  if (r.heuristics) {
    const start = startNode;
    document.getElementById("heuristicValue").textContent = r.heuristics[start] ?? "-";
    // Update h: labels on nodes
    Object.entries(r.heuristics).forEach(([node, h]) => {
      const el = document.getElementById("h-" + node);
      if (el) el.textContent = "h:" + h;
    });

    if (r.node_details) {
      const details = Object.entries(r.node_details)
        .map(([n, v]) => `${n}(g:${v.g} h:${v.h} f:${v.f})`)
        .join(" | ");
      document.getElementById("astarDetails").textContent = details;
    }
  } else {
    document.getElementById("heuristicValue").textContent = "-";
    document.getElementById("astarDetails").textContent   = "-";
  }
}

function clearResults() {
  ["algoName","visitedOrder","visitedNodes","pathNodes","pathCost","heuristicValue","astarDetails"]
    .forEach(id => document.getElementById(id).textContent = "-");
}

// ─── Init ─────────────────────────────────────────────────────────────────────
drawEdges();
setupNodeClicks();
