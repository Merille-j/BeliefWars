# Belief Wars

A tactical stealth-strategy game where a Ghost tries to complete objectives while a Seeker hunts them using probabilistic belief-state tracking.

## Game Overview

**Belief Wars** is a single-player asymmetric game played on a **10×10 grid**. You play against an AI opponent. Roles are assigned randomly each round — you may be the **Ghost** (moving invisibly to complete objectives) or the **Seeker** (using probability-based scanning to locate and lock the Ghost).

### Core Mechanics

- **Belief-State Heatmap**: The Seeker sees a live probability heatmap showing where the Ghost might be. Probability percentages are displayed on every cell. The Ghost manipulates this heatmap using decoys, noise, and false trails.
- **2-Cycle Round Structure**: Each round runs two full cycles of Recon → Manipulation → Objective → AND/OR Events → Collapse before a winner is decided.
- **Ghost wins a round** by completing **3 of 5 objectives** before being locked.
- **Seeker wins a round** by locking the Ghost's exact cell during Collapse.
- **Best-of-3 Match**: First player to win 2 rounds wins the match.
- **Random Role Assignment**: Roles are re-assigned randomly (50/50) at the start of every round — not alternated.
- **AI Opponent**: The AI uses MCTS with spatial clustering and pattern learning (Seeker) or A* pathfinding with belief-map manipulation (Ghost).

### 5-Phase Sequence (×2 per round)

| Phase | Duration | Who Acts | What Happens |
| --- | --- | --- | --- |
| **Recon** | 20s | Both | Observe the heatmap, plan strategy |
| **Manipulation** | 20s | Ghost | Throw decoys, make noise, lay false trails |
| **Objective** | 120s | Ghost | Move adjacently (↑↓←→), complete objectives |
| **AND/OR Events** | 20s | Both | Nondeterministic events (fog, storm, sensor disruption) |
| **Collapse** | 30s | Seeker | Scan zones and lock onto the Ghost |

After Collapse in cycle 1, the sequence restarts from Recon for cycle 2. After Collapse in cycle 2, the round ends.

### Algorithms

1. **Belief-State Diffusion** — probability spreads to neighbouring cells each tick (10% diffusion rate)
2. **AND-OR Search** — contingency planning for nondeterministic events
3. **Monte Carlo Tree Search (MCTS)** — Seeker AI uses spatial clustering, entropy-guided scanning, and scan history to evaluate strategies; also used for human Seeker recommendations
4. **A\* Pathfinding** — Ghost AI navigates using probability-weighted costs, avoiding the Seeker's most-scanned zones
5. **Human Pattern Memory** — AI learns the human's decoy placement, movement corridors, and scan preferences across rounds and adapts its strategy accordingly

## Setup

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/belief-wars/belief-wars.git
cd belief-wars

# Install all dependencies
npm run install:all
```

### Development

```bash
# Run both client and server in development mode
npm run dev
```

- Server runs on `http://localhost:3001`
- Client runs on `http://localhost:5173`

### Production Build

```bash
npm run build
```

## Project Structure

```text
belief-wars/
├── client/                    # React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── components/        # UI components (GameScreen, HeatmapCanvas, etc.)
│   │   ├── hooks/             # useSocket — Socket.IO connection
│   │   ├── store/             # Zustand state management
│   │   ├── types/             # TypeScript types (mirrored from server)
│   │   └── utils/             # colorUtils, gridUtils
│   └── ...
├── server/                    # Node.js + Express + TypeScript backend
│   ├── src/
│   │   ├── algorithms/        # A*, MCTS, AND-OR Search, Belief-State, HumanPatternMemory
│   │   ├── api/               # REST routes + Socket.IO handlers
│   │   ├── core/              # PhaseController, MatchController, EntityManager, etc.
│   │   ├── state/             # GameStateStore, ProbabilityGridStore, RoleAndRoundStore
│   │   └── systems/           # GhostActions, SeekerActions, AIOpponent, EventSystem
│   └── ...
└── package.json               # Monorepo root
```

## Gameplay

### Ghost Role (8 AP Manipulation, 20 AP Objective)

- **Recon Phase**: Observe the heatmap — bright zones are where the Seeker suspects you
- **Manipulation Phase** (8 AP):
  - 🎯 **Throw Decoy** (2 AP) — spike +30% probability at one cell
  - 📢 **Make Noise** (2 AP) — spike +15% across a 5×5 area
  - 👣 **Lay False Trail** (3 AP) — spike +20% along a 3-cell path
- **Objective Phase** (20 AP): Move one step at a time (↑↓←→ only, 1 AP per step). Complete **3 of 5 objectives** to win the round.
- Ghost spawns at a **random position** each round.

### Seeker Role (10 AP per Collapse)

- **Recon Phase**: Review the heatmap, plan scan zones
- **Collapse Phase** (10 AP):
  - 📡 **Scan Zone** (2 AP) — increase probability in a radius-2 area
  - 🔒 **Lock Cell** (4 AP) — attempt to confirm Ghost location; collapses belief state on hit
- **AI Recommendations**: MCTS-powered suggestions ranked by confidence (colour-coded green/yellow/gray)
- Seeker always starts at **(9, 9)** — bottom-right corner.

### Round Structure

Each round consists of **2 full cycles**:

```text
Cycle 1: RECON (20s) → MANIPULATION (20s) → OBJECTIVE (120s) → EVENTS (20s) → COLLAPSE (30s)
Cycle 2: RECON (20s) → MANIPULATION (20s) → OBJECTIVE (120s) → EVENTS (20s) → COLLAPSE (30s)
         └── Round ends here ──────────────────────────────────────────────────────────────┘
```

The round ends early if:

- Seeker locks Ghost → **Seeker wins**

If neither happens after both Collapses:

- Ghost completed ≥3 objectives → **Ghost wins**
- Ghost completed <3 objectives → **Seeker wins** (Ghost failed the mission)

### Match Structure

- Best-of-3 rounds
- Roles re-assigned **randomly** each round (not alternated)
- First to win 2 rounds wins the match

### Round History

After the match ends, the Result Screen shows a full **move-by-move replay** of every round — every human and AI action, grouped by phase, with expandable round cards.

## Configuration

| Parameter | Value |
| --- | --- |
| Grid size | **10×10** |
| Objectives per round | **5** (Ghost needs 3 to win) |
| Cycles per round | **2** |
| Ghost AP per phase | **8 / 20** |
| Seeker AP per Collapse | **10** |
| Scan cost | 2 AP |
| Lock cost | 4 AP |
| Move cost | 1 AP (adjacent only) |
| Decoy magnitude | +30% |
| Noise magnitude | +15% per cell (radius 2) |
| False trail magnitude | +20% per cell |
| Diffusion rate | 10% per tick |
| Phase timers | 20s for Recon/Manipulation/Events, 120s for Objective, 30s for Collapse |
| Ghost start | Random cell |
| Seeker start | (9, 9) |

## License

MIT
