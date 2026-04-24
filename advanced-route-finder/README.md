# Advanced Route Finder Visualizer

An advanced graph search visualizer built with **Python Flask** (backend) and **Vanilla JS / HTML / CSS** (frontend).

## Features

| Feature | Details |
|---|---|
| **7 Algorithms** | BFS, DFS, Dijkstra, A* (Euclidean & Manhattan), Greedy Best-First, Bidirectional BFS, All Shortest Paths |
| **Step Mode** | Click ⏭ Step to advance the animation one node at a time |
| **Compare Tab** | Run all algorithms at once and compare cost, visited count, path length, execution time with a bar chart |
| **Custom Graph Editor** | Edit graph JSON, validate, and apply custom graphs |
| **Search History** | Last 50 searches stored server-side and viewable in the History tab |
| **Animated Path Drawing** | SVG dash-animation for final route |
| **All-Paths Display** | See every minimum-cost path simultaneously |
| **Heuristic Selection** | Switch between Euclidean and Manhattan distance for A* / Greedy |

## Setup

```bash
pip install -r requirements.txt
python app.py
```

Open browser at: **http://127.0.0.1:5000**

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/search` | POST | Run a single algorithm |
| `/compare` | POST | Run all 6 algorithms and return comparison |
| `/history` | GET | Retrieve last 50 search entries |
| `/graph` | GET | Return default graph definition |
| `/validate_graph` | POST | Validate a custom graph JSON |

## Project Structure

```
advanced-route-finder/
├── app.py              ← Flask backend (7 algorithms)
├── requirements.txt
├── templates/
│   └── index.html      ← Main HTML (served by Flask)
└── static/
    ├── style.css
    └── script.js
```
