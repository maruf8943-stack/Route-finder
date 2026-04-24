from flask import Flask, request, jsonify
from flask_cors import CORS
import heapq
import os
app = Flask(__name__)
CORS(app)

# ─── Graph Definition ─────────────────────────────────────────────────────────
# Matches the nodes/edges shown in index.html
GRAPH = {
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

# Node positions (px) from index.html — used for A* heuristic (Euclidean distance)
NODE_POS = {
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

def euclidean(a, b):
    ax, ay = NODE_POS[a]
    bx, by = NODE_POS[b]
    return ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5


# ─── BFS ──────────────────────────────────────────────────────────────────────
def bfs(start, goal):
    from collections import deque
    queue = deque([(start, [start], 0)])   # (current, path, cost)
    visited = []
    seen = set()

    while queue:
        node, path, cost = queue.popleft()
        if node in seen:
            continue
        seen.add(node)
        visited.append(node)

        if node == goal:
            return {"visited": visited, "path": path, "cost": cost}

        for neighbor, weight in GRAPH[node].items():
            if neighbor not in seen:
                queue.append((neighbor, path + [neighbor], cost + weight))

    return {"visited": visited, "path": [], "cost": 0}


# ─── DFS ──────────────────────────────────────────────────────────────────────
def dfs(start, goal):
    stack = [(start, [start], 0)]          # (current, path, cost)
    visited = []
    seen = set()

    while stack:
        node, path, cost = stack.pop()
        if node in seen:
            continue
        seen.add(node)
        visited.append(node)

        if node == goal:
            return {"visited": visited, "path": path, "cost": cost}

        for neighbor, weight in reversed(list(GRAPH[node].items())):
            if neighbor not in seen:
                stack.append((neighbor, path + [neighbor], cost + weight))

    return {"visited": visited, "path": [], "cost": 0}


# ─── A* ───────────────────────────────────────────────────────────────────────
def astar(start, goal):
    # heap entry: (f, g, node, path, node_details)
    h0 = euclidean(start, goal)
    heap = [(h0, 0, start, [start], {start: {"g": 0, "h": round(h0, 1), "f": round(h0, 1)}})]
    visited = []
    seen = set()

    while heap:
        f, g, node, path, details = heapq.heappop(heap)
        if node in seen:
            continue
        seen.add(node)
        visited.append(node)

        if node == goal:
            heuristics = {n: euclidean(n, goal) for n in NODE_POS}
            return {
                "visited": visited,
                "path": path,
                "cost": round(g, 1),
                "node_details": details,
                "heuristics": {k: round(v, 1) for k, v in heuristics.items()},
            }

        for neighbor, weight in GRAPH[node].items():
            if neighbor not in seen:
                new_g = g + weight
                h = euclidean(neighbor, goal)
                new_f = new_g + h
                new_details = dict(details)
                new_details[neighbor] = {
                    "g": round(new_g, 1),
                    "h": round(h, 1),
                    "f": round(new_f, 1),
                }
                heapq.heappush(heap, (new_f, new_g, neighbor, path + [neighbor], new_details))

    return {"visited": visited, "path": [], "cost": 0, "node_details": {}, "heuristics": {}}


# ─── API Route ────────────────────────────────────────────────────────────────
@app.route("/search", methods=["POST"])
def search():
    data = request.get_json()
    algo  = data.get("algo", "bfs")
    start = data.get("start", "A")
    goal  = data.get("goal",  "J")

    if algo == "bfs":
        result = bfs(start, goal)
    elif algo == "dfs":
        result = dfs(start, goal)
    elif algo == "astar":
        result = astar(start, goal)
    else:
        return jsonify({"error": "Unknown algorithm"}), 400

    result["algo"] = algo
    return jsonify(result)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
