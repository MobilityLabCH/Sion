# CLAUDE.md — Sion Mobility Pricing Simulator

This file provides guidance for AI assistants working on this codebase.

## Project Overview

**Sion Mobility Pricing Simulator** is a full-stack decision support tool for the City of Sion, Valais, Switzerland. It allows city planners to model the impact of parking and public transport pricing changes on modal shift (car → alternatives). The tool uses a softmax-based multinomial logit model and integrates Cloudflare Workers AI for contextual insights.

**Tech stack:** TypeScript monorepo — React 18 + Vite (frontend) on Cloudflare Pages, Cloudflare Workers (backend API).

Documentation and UI text are primarily in **French**.

---

## Repository Structure

```
Sion/
├── apps/
│   ├── web/                   # React + Vite frontend (Cloudflare Pages)
│   │   └── src/
│   │       ├── pages/         # Route-level components (6 pages)
│   │       ├── components/    # Reusable UI components
│   │       ├── hooks/         # React Context state (store.tsx)
│   │       └── lib/api.ts     # HTTP client for backend
│   └── worker/                # Cloudflare Worker backend API
│       └── src/
│           ├── index.ts       # HTTP routing entrypoint
│           ├── simulator.ts   # Core simulation engine (softmax model)
│           ├── ai.ts          # Workers AI integration + deterministic fallback
│           ├── report.ts      # Markdown/HTML report generation
│           ├── types.ts       # Shared type definitions
│           └── data/          # Bundled JSON mock data (zones, parking, tp, personas)
├── data/                      # Source data files (same content as worker/src/data/)
├── docs/
│   ├── methodology.md         # Simulation model details
│   ├── roadmap.md             # Feature roadmap V0.1 → V3.0
│   └── data-sources.md        # Data origin and calibration notes
├── README.md                  # Full project documentation (French)
├── DEPLOY.md                  # Cloudflare deployment guide (French)
└── deploy.sh                  # Deployment automation script
```

---

## Development Workflows

### Prerequisites

- Node.js (v18+)
- npm (v9+)
- Wrangler CLI (`npm install -g wrangler`) for Cloudflare Workers

### Local Development

```bash
# Install all dependencies (from repo root)
npm install

# Start both frontend (:5173) and Worker dev server (:8787) concurrently
npm run dev

# Start frontend only
npm run dev:web

# Start Worker only
npm run dev:worker
```

The Vite dev server automatically proxies `/api/*` requests to `http://localhost:8787`, so the frontend talks to the local Worker during development.

**Note:** Cloudflare Workers AI (Llama 3.1) is **not available locally**. When running `wrangler dev`, AI endpoints fall back to deterministic text generation. This is expected behavior.

### Building

```bash
# Build frontend for production (TypeScript check + Vite bundle)
npm run build:web

# Worker is deployed directly (no separate build step needed)
```

### Running Tests

```bash
# Run Worker unit tests (Vitest)
npm run test:worker

# Watch mode
cd apps/worker && npm run test:watch
```

Tests are located at `apps/worker/src/simulator.test.ts` and cover:
1. **softmax coherence** — probabilities sum to 1, ordering correctness
2. **Simulation with pricing** — higher parking price reduces car share
3. **Alternative measures** — carpooling/TAD impact on shift index

### Deployment

```bash
# Deploy Worker to Cloudflare
npm run deploy:worker

# Deploy frontend to Cloudflare Pages
npm run deploy:web

# Combined deployment (runs both)
./deploy.sh
```

**Required before deploying:**
- Set `TOMTOM_API_KEY` as a Cloudflare Workers secret: `wrangler secret put TOMTOM_API_KEY`
- Configure `VITE_API_URL` environment variable on Cloudflare Pages to point to the deployed Worker URL

---

## Architecture

### Frontend State (apps/web/src/hooks/store.tsx)

Global state is managed via **React Context API**. The store holds:

| Field | Type | Description |
|-------|------|-------------|
| `scenario` | `ScenarioConfig` | Current pricing parameters (parking cost, TP discount, measures) |
| `results` | `SimulationResults` | Zone results + persona impacts from `/api/simulate` |
| `insights` | `InsightsResponse` | AI-generated bullets, risks, communication draft |
| `actions` | `ActionsResponse` | 3-horizon action plan |
| `trafficData` | `TrafficData` | TomTom real-time traffic |

Do not introduce Redux, Zustand, or other state libraries — React Context is intentionally sufficient for this scope.

### API Routes (apps/worker/src/index.ts)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/health` | Service status + binding availability |
| GET | `/api/data` | Zones, parking, TP, personas (initial load) |
| POST | `/api/simulate` | Run softmax simulation engine |
| POST | `/api/insights` | Generate AI analysis (Llama 3.1 or fallback) |
| POST | `/api/actions` | Generate 3-horizon action plan |
| POST | `/api/report` | Export Markdown + HTML report |
| GET | `/api/traffic/flow` | Proxy to TomTom Traffic Flow API |

All routes return JSON. CORS is set to `Access-Control-Allow-Origin: *`.

### Simulation Engine (apps/worker/src/simulator.ts)

The engine is a **deterministic multinomial logit (softmax) choice model**:

1. **Cost computation** (`computeTripCosts`) — calculates generalised cost per mode (car, TP, carpooling, TAD, taxi-bons) incorporating pricing parameters, time value, friction, and persona attributes.
2. **Softmax conversion** (`softmax`) — converts costs to probabilities using temperature `0.6`. Lower cost = higher probability.
3. **Mode split** (`computeModeSplit`) — applies softmax + preference adjustments (schedule rigidity, car dependency).
4. **Orchestration** (`runSimulation`) — iterates over all zone × persona combinations, computes elasticity scores, shift index, equity flags.

**Key output metrics:**
- `globalShiftIndex` — percentage of car trips switching to alternatives (0–100)
- `elasticityScore` — zone-level sensitivity to pricing (0–100)
- `category` — zone classification: `vert` (elastic), `orange` (moderate), `rouge` (inelastic)
- `equityRisk` — boolean flag for personas with low income + cost increase + no alternatives

When modifying the simulator, ensure the three unit tests in `simulator.test.ts` still pass.

### AI Integration (apps/worker/src/ai.ts)

- **Model:** `@cf/meta/llama-3.1-8b-instruct` via Cloudflare Workers AI binding
- **Fallback:** Fully deterministic text generation (no AI dependency at runtime)
- Three prompt builders: `buildInsightsPrompt`, `buildActionsPrompt`, `buildImprovementsPrompt`
- AI is optional; all endpoints function correctly without it

### Data Layer (apps/worker/src/data/)

Data is bundled into the Worker binary. There is **no database** in the MVP:

| File | Contents |
|------|----------|
| `zones.json` | 8 zone definitions with GeoJSON polygons (Sion city center → periphery) |
| `parking.json` | Capacity, base pricing, peak/off-peak multipliers, friction index per zone |
| `tp.json` | TP accessibility, travel time, service frequency, ticket price, discount potential |
| `personas.json` | 12 user archetypes with value-of-time, price sensitivity, schedule rigidity, car dependency, income level |

Data changes require a Worker re-deployment. Future roadmap (V1.1) adds a data upload API.

---

## Key Conventions

### TypeScript

- **Strict mode is enabled** in all `tsconfig.json` files — do not disable it.
- Types are defined inline in `types.ts` files (frontend and Worker each have their own). There is no shared package yet — keep them in sync when editing shared types.
- Use `zod` for runtime validation at API boundaries (already used in existing code).

### Styling

- **Tailwind CSS only** — no CSS-in-JS, no SCSS. Use utility classes.
- Zone elasticity categories map to colour conventions used throughout the UI: `vert` (green), `orange`, `rouge` (red).
- `CategoryPill.tsx` and `ZoneMap.tsx` both depend on these colour conventions — keep them consistent.

### Component Patterns

- Pages are route-level components in `apps/web/src/pages/`. Each page consumes state from the store hook.
- Reusable primitives live in `apps/web/src/components/`. They should be stateless and receive props.
- Use `SliderField` for any numeric pricing input. Use `ToggleField` for boolean measures.

### Language

- All user-visible text is in **French**. Maintain this when adding or modifying UI text, error messages, and AI prompts.
- Code (variable names, comments) can be in English or French — be consistent with the surrounding file.

### Testing

- Unit tests cover the simulation engine only. When changing `simulator.ts`, update `simulator.test.ts`.
- There are no integration or e2e tests yet (planned in roadmap V1.1/V1.2).
- Run `npm run test:worker` before committing changes to the Worker.

### No Linting / Formatting Config

There is no ESLint or Prettier configuration. Follow the style of the surrounding code:
- 2-space indentation
- Single quotes for strings in TypeScript
- Trailing commas in multi-line arrays/objects

---

## Cloudflare Infrastructure

### Bindings (wrangler.toml)

| Binding | Type | Notes |
|---------|------|-------|
| `AI` | Workers AI | Llama 3.1 8B Instruct, optional |
| `TOMTOM_API_KEY` | Secret | TomTom Traffic Flow API key |
| `ENVIRONMENT` | Variable | `"production"` or `"development"` |
| `TOMTOM_BBOX` | Variable | `"7.33,46.20,7.40,46.25"` (Sion bounding box) |

A KV namespace is prepared but commented out (for future scenario persistence).

### Environments

- **Local:** `wrangler dev --port 8787` — uses `nodejs_compat` flag, no real AI
- **Production:** Cloudflare Workers (global edge), Cloudflare Pages (CDN)

---

## Roadmap Context

When implementing features, be aware of the planned evolution:

| Version | Key Changes |
|---------|-------------|
| V1.1 | Real data import API, multi-scenario comparison, GitHub Actions CI/CD, KV persistence |
| V1.2 | Model calibration with real data, bicycle mode, trip history, WCAG AA accessibility |
| V2.0 | Cloudflare D1 (SQLite) migration, multi-tenant (other Swiss cities), advanced logit |
| V3.0 | Post-deployment tracking, public API, multilingual, federation integration |

Do not introduce breaking changes to the JSON data structures or API contracts without considering these upcoming migrations.

---

## Common Tasks

### Adding a new pricing parameter

1. Add field to `ScenarioConfig` type in `apps/worker/src/types.ts` **and** `apps/web/src/types.ts`
2. Add cost calculation logic in `simulator.ts` → `computeTripCosts()`
3. Add a `SliderField` or `ToggleField` in `ScenarioBuilder.tsx`
4. Update the AI prompts in `ai.ts` if the parameter should be reflected in insights
5. Run `npm run test:worker` to verify no regressions

### Adding a new zone

1. Add zone entry to `data/zones.json` and `apps/worker/src/data/zones.json`
2. Add corresponding entries to `parking.json` and `tp.json`
3. Redeploy Worker (`npm run deploy:worker`)

### Adding a new API endpoint

1. Add route handler in `apps/worker/src/index.ts`
2. Add corresponding method in `apps/web/src/lib/api.ts`
3. Update global state in `apps/web/src/hooks/store.tsx` if needed

### Updating mock personas

Edit `apps/worker/src/data/personas.json` (and `data/personas.json` for consistency). Each persona requires: `id`, `label`, `valueOfTime`, `priceSensitivity`, `scheduleRigidity`, `carDependency`, `incomeLevel`.
