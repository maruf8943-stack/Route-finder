from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import heapq
import math
from collections import deque
import time
import os
app = Flask(__name__)
CORS(app)

# ─── Default Graph ─────────────────────────────────────────────────────────────
DEFAULT_GRAPH = {
    "A": {"B": 6, "E": 4},
    "B": {"A": 6, "C": 3, "E": 2},
    "C": {"B": 3, "D": 5, "F": 4},
    "D": {"C": 5, "F": 3, "G": 6},
    "E": {"A": 4, "B": 2, "F": 5},
    "F": {"C": 4, "D": 3, "E": 5, "G": 4, "I": 7},
    "G": {"D": 6, "F": 4, "H": 3, "I": 5},
    "H": {"G": 3, "J": 4},
    "I": {"F": 7, "G": 5, "J": 6},
    "J": {"H": 4, "I": 6},
}

DEFAULT_NODE_POS = {
    "A": (70,  360),
    "B": (140, 120),
    "C": (250, 90),
    "D": (360, 130),
    "E": (240, 250),
    "F": (380, 250),
    "G": (520, 230),
    "H": (650, 170),
    "I": (600, 340),
    "J": (760, 90),
}

# In-memory search history (last 50)
search_history = []


def get_graph_and_pos(custom_graph=None, custom_pos=None):
    graph = custom_graph if custom_graph else DEFAULT_GRAPH
    pos   = custom_pos   if custom_pos   else DEFAULT_NODE_POS
    return graph, pos


def euclidean(pos, a, b):
    ax, ay = pos[a]
    bx, by = pos[b]
    return math.sqrt((ax - bx)**2 + (ay - by)**2)


def manhattan(pos, a, b):
    ax, ay = pos[a]
    bx, by = pos[b]
    return abs(ax - bx) + abs(ay - by)


# ─── BFS ───────────────────────────────────────────────────────────────────────
def bfs(graph, start, goal):
    queue   = deque([(start, [start], 0)])
    visited = []
    seen    = set()
    while queue:
        node, path, cost = queue.popleft()
        if node in seen:
            continue
        seen.add(node)
        visited.append(node)
        if node == goal:
            return {"visited": visited, "path": path, "cost": cost}
        for neighbor, weight in graph.get(node, {}).items():
            if neighbor not in seen:
                queue.append((neighbor, path + [neighbor], cost + weight))
    return {"visited": visited, "path": [], "cost": 0}


# ─── DFS ───────────────────────────────────────────────────────────────────────
def dfs(graph, start, goal):
    stack   = [(start, [start], 0)]
    visited = []
    seen    = set()
    while stack:
        node, path, cost = stack.pop()
        if node in seen:
            continue
        seen.add(node)
        visited.append(node)
        if node == goal:
            return {"visited": visited, "path": path, "cost": cost}
        for neighbor, weight in reversed(list(graph.get(node, {}).items())):
            if neighbor not in seen:
                stack.append((neighbor, path + [neighbor], cost + weight))
    return {"visited": visited, "path": [], "cost": 0}


# ─── A* ────────────────────────────────────────────────────────────────────────
def astar(graph, pos, start, goal, heuristic_fn="euclidean"):
    h_fn = euclidean if heuristic_fn == "euclidean" else manhattan
    h0   = h_fn(pos, start, goal)
    heap = [(h0, 0, start, [start], {start: {"g": 0, "h": round(h0,1), "f": round(h0,1)}})]
    visited = []
    seen    = set()
    while heap:
        f, g, node, path, details = heapq.heappop(heap)
        if node in seen:
            continue
        seen.add(node)
        visited.append(node)
        if node == goal:
            heuristics = {n: h_fn(pos, n, goal) for n in pos}
            return {
                "visited":      visited,
                "path":         path,
                "cost":         round(g, 1),
                "node_details": details,
                "heuristics":   {k: round(v, 1) for k, v in heuristics.items()},
            }
        for neighbor, weight in graph.get(node, {}).items():
            if neighbor not in seen:
                new_g = g + weight
                h     = h_fn(pos, neighbor, goal)
                new_f = new_g + h
                new_details = dict(details)
                new_details[neighbor] = {
                    "g": round(new_g, 1),
                    "h": round(h,     1),
                    "f": round(new_f, 1),
                }
                heapq.heappush(heap, (new_f, new_g, neighbor, path + [neighbor], new_details))
    return {"visited": visited, "path": [], "cost": 0, "node_details": {}, "heuristics": {}}


# ─── Greedy Best-First Search ──────────────────────────────────────────────────
def greedy(graph, pos, start, goal):
    h0   = euclidean(pos, start, goal)
    heap = [(h0, start, [start], 0)]
    visited = []
    seen    = set()
    while heap:
        h, node, path, cost = heapq.heappop(heap)
        if node in seen:
            continue
        seen.add(node)
        visited.append(node)
        if node == goal:
            return {"visited": visited, "path": path, "cost": round(cost, 1)}
        for neighbor, weight in graph.get(node, {}).items():
            if neighbor not in seen:
                hn = euclidean(pos, neighbor, goal)
                heapq.heappush(heap, (hn, neighbor, path + [neighbor], cost + weight))
    return {"visited": visited, "path": [], "cost": 0}


# ─── All Shortest Paths (BFS-based) ────────────────────────────────────────────
def all_shortest_paths(graph, start, goal):
    """Find all paths of minimum cost between start and goal."""
    queue = deque([(start, [start], 0)])
    best  = float('inf')
    paths = []
    visited_order = []
    seen_in_path  = set()

    while queue:
        node, path, cost = queue.popleft()
        if cost > best:
            continue
        if node not in seen_in_path:
            seen_in_path.add(node)
            visited_order.append(node)
        if node == goal:
            if cost < best:
                best  = cost
                paths = [path]
            elif cost == best:
                paths.append(path)
            continue
        for nb, w in graph.get(node, {}).items():
            if nb not in path:  # avoid cycles
                queue.append((nb, path + [nb], cost + w))

    return {
        "visited":   visited_order,
        "path":      paths[0] if paths else [],
        "all_paths": paths,
        "cost":      round(best, 1) if paths else 0,
    }


# ─── API: /search ──────────────────────────────────────────────────────────────
@app.route("/search", methods=["POST"])
def search():
    data   = request.get_json()
    algo   = data.get("algo",  "bfs")
    start  = data.get("start", "A")
    goal   = data.get("goal",  "J")
    heur   = data.get("heuristic", "euclidean")
    custom_graph = data.get("graph",    None)
    custom_pos   = data.get("node_pos", None)

    graph, pos = get_graph_and_pos(custom_graph, custom_pos)

    # Validate nodes
    if start not in graph or goal not in graph:
        return jsonify({"error": f"Node '{start}' or '{goal}' not in graph."}), 400

    t0 = time.perf_counter()

    if algo == "bfs":
        result = bfs(graph, start, goal)
    elif algo == "dfs":
        result = dfs(graph, start, goal)
    elif algo == "astar":
        result = astar(graph, pos, start, goal, heur)
    elif algo == "greedy":
        result = greedy(graph, pos, start, goal)
    elif algo == "allpaths":
        result = all_shortest_paths(graph, start, goal)
    else:
        return jsonify({"error": "Unknown algorithm"}), 400

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 3)
    result["algo"]       = algo
    result["elapsed_ms"] = elapsed_ms

    # Store in history
    entry = {
        "algo":      algo,
        "start":     start,
        "goal":      goal,
        "cost":      result.get("cost", 0),
        "path":      result.get("path", []),
        "visited":   len(result.get("visited", [])),
        "elapsed_ms": elapsed_ms,
    }
    search_history.insert(0, entry)
    if len(search_history) > 50:
        search_history.pop()

    return jsonify(result)


# ─── API: /compare ─────────────────────────────────────────────────────────────
@app.route("/compare", methods=["POST"])
def compare():
    data   = request.get_json()
    start  = data.get("start", "A")
    goal   = data.get("goal",  "J")
    custom_graph = data.get("graph",    None)
    custom_pos   = data.get("node_pos", None)

    graph, pos = get_graph_and_pos(custom_graph, custom_pos)

    if start not in graph or goal not in graph:
        return jsonify({"error": "Invalid nodes"}), 400

    results = {}
    algos   = ["bfs", "dfs", "astar", "greedy"]
    for algo in algos:
        t0 = time.perf_counter()
        if algo == "bfs":
            r = bfs(graph, start, goal)
        elif algo == "dfs":
            r = dfs(graph, start, goal)
        elif algo == "astar":
            r = astar(graph, pos, start, goal)
        elif algo == "greedy":
            r = greedy(graph, pos, start, goal)
        elapsed = round((time.perf_counter() - t0) * 1000, 3)
        results[algo] = {
            "path":        r.get("path", []),
            "cost":        r.get("cost", 0),
            "visited":     len(r.get("visited", [])),
            "elapsed_ms":  elapsed,
            "path_length": len(r.get("path", [])),
        }
    return jsonify(results)


# ─── API: /history ─────────────────────────────────────────────────────────────
@app.route("/history", methods=["GET"])
def history():
    return jsonify(search_history)


# ─── API: /graph ───────────────────────────────────────────────────────────────
@app.route("/graph", methods=["GET"])
def get_graph():
    return jsonify({
        "graph":    DEFAULT_GRAPH,
        "node_pos": {k: list(v) for k, v in DEFAULT_NODE_POS.items()},
    })


# ─── API: /validate_graph ──────────────────────────────────────────────────────
@app.route("/validate_graph", methods=["POST"])
def validate_graph():
    data  = request.get_json()
    graph = data.get("graph", {})
    pos   = data.get("node_pos", {})
    errors = []
    # Check all edge targets exist as nodes
    for node, neighbors in graph.items():
        for nb in neighbors:
            if nb not in graph:
                errors.append(f"Edge {node}→{nb}: node '{nb}' not in graph.")
    # Check positions exist for all nodes
    for node in graph:
        if node not in pos:
            errors.append(f"Node '{node}' has no position.")
    return jsonify({"valid": len(errors) == 0, "errors": errors})


# ─── Serve frontend ────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")




if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
