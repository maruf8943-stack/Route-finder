from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import heapq, os

app = Flask(__name__, static_folder="static")
CORS(app)

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

NODE_POS = {
    "A": (70,  360), "B": (140, 120), "C": (250, 90),
    "D": (360, 130), "E": (240, 250), "F": (380, 250),
    "G": (520, 230), "H": (650, 170), "I": (600, 340), "J": (760, 90),
}

def euclidean(a, b):
    ax, ay = NODE_POS[a]; bx, by = NODE_POS[b]
    return ((ax-bx)**2 + (ay-by)**2) ** 0.5

def bfs(start, goal):
    from collections import deque
    queue = deque([(start, [start], 0)]); visited = []; seen = set()
    while queue:
        node, path, cost = queue.popleft()
        if node in seen: continue
        seen.add(node); visited.append(node)
        if node == goal: return {"visited": visited, "path": path, "cost": cost}
        for nb, w in GRAPH[node].items():
            if nb not in seen: queue.append((nb, path+[nb], cost+w))
    return {"visited": visited, "path": [], "cost": 0}

def dfs(start, goal):
    stack = [(start, [start], 0)]; visited = []; seen = set()
    while stack:
        node, path, cost = stack.pop()
        if node in seen: continue
        seen.add(node); visited.append(node)
        if node == goal: return {"visited": visited, "path": path, "cost": cost}
        for nb, w in reversed(list(GRAPH[node].items())):
            if nb not in seen: stack.append((nb, path+[nb], cost+w))
    return {"visited": visited, "path": [], "cost": 0}

def astar(start, goal):
    h0 = euclidean(start, goal)
    heap = [(h0, 0, start, [start], {start: {"g":0,"h":round(h0,1),"f":round(h0,1)}})]
    visited = []; seen = set()
    while heap:
        f, g, node, path, details = heapq.heappop(heap)
        if node in seen: continue
        seen.add(node); visited.append(node)
        if node == goal:
            heuristics = {n: euclidean(n, goal) for n in NODE_POS}
            return {"visited": visited, "path": path, "cost": round(g,1),
                    "node_details": details,
                    "heuristics": {k: round(v,1) for k,v in heuristics.items()}}
        for nb, w in GRAPH[node].items():
            if nb not in seen:
                ng = g+w; h = euclidean(nb, goal); nf = ng+h
                nd = dict(details); nd[nb] = {"g":round(ng,1),"h":round(h,1),"f":round(nf,1)}
                heapq.heappush(heap, (nf, ng, nb, path+[nb], nd))
    return {"visited": visited, "path": [], "cost": 0, "node_details": {}, "heuristics": {}}

@app.route("/search", methods=["POST"])
def search():
    data = request.get_json()
    algo = data.get("algo","bfs"); start = data.get("start","A"); goal = data.get("goal","J")
    if algo == "bfs": result = bfs(start, goal)
    elif algo == "dfs": result = dfs(start, goal)
    elif algo == "astar": result = astar(start, goal)
    else: return jsonify({"error": "Unknown algorithm"}), 400
    result["algo"] = algo
    return jsonify(result)

@app.route("/")
def index():
    return send_from_directory("static", "index.html")

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
