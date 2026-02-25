const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
    },
  });
}

export default {
  async fetch(request: Request, env: any, ctx: any) {
    // ✅ Préflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // ... tes routes

    // Exemple:
    if (pathname === "/api/traffic/flow" && request.method === "GET") {
      // ton code TomTom...
      return jsonResponse({ connected: true, /* ... */ });
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};

// Sion Mobility Pricing Simulator — Cloudflare Worker
// Version: 3.0.0 · MobilityLab Sion
//
// ─── Routes ────────────────────────────────────────────────────────────────────
//   GET  /api/health          → statut (AI, TomTom, env)
//   GET  /api/data            → zones GeoJSON + parkings + TP + personas
//   POST /api/simulate        → simulation moteur déterministe
//   POST /api/insights        → analyse AI (Llama 3.1 / fallback)
//   POST /api/actions         → plan d'actions
//   POST /api/report          → rapport markdown exportable
//   GET  /api/traffic/flow    → TomTom Traffic Flow (proxy sécurisé)
//
// ─── Setup TOMTOM_API_KEY ──────────────────────────────────────────────────────
//   ⚠ Deux entités "sion" dans Cloudflare — mettre la clé dans le BON endroit:
//
//   CORRECT  → dash.cloudflare.com → Workers & Pages
//              → "sion" icône ⬡ (Workers) → sion.ericimstepf.workers.dev
//              → Settings → Variables and Secrets → + Add
//              → Type: Secret · Name: TOMTOM_API_KEY · Value: votre_clé
//
//   INCORRECT → "sion" icône △ (Pages) → sion-cet.pages.dev
//               (cette clé ne sera pas utilisée par le Worker)
//
//   Comment obtenir la CLÉ API TomTom (≠ UUID ID):
//     my.tomtom.com → Keys → cliquer "My First API key" → bouton "Copy API Key"

import { runSimulation }                     from './simulator.js';
import { generateInsights, generateActions } from './ai.js';
import { generateMarkdownReport, generateHTMLReport } from './report.js';
import parkingRaw  from './data/parking.json';
import tpRaw       from './data/tp.json';
import personasRaw from './data/personas.json';
import zonesRaw    from './data/zones.json';

const parkingData  = parkingRaw  as any[];
const tpData       = tpRaw       as any[];
const personasData = personasRaw as any[];
const zonesData    = zonesRaw    as any;

// ─── Env ───────────────────────────────────────────────────────────────────────
export interface Env {
  AI?:             any;
  KV?:             KVNamespace;
  ENVIRONMENT?:    string;
  TOMTOM_API_KEY?: string;
  TOMTOM_BBOX?:    string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function cors() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  });
}

async function fetchTomTom(env: Env): Promise<Response> {
  const url = [
    'https://api.tomtom.com/traffic/services/4',
    '/flowSegmentData/absolute/10/json',
    '?point=46.2333,7.3595',
    '&unit=KMPH',
    '&thickness=2',
    '&openLr=false',
    `&key=${env.TOMTOM_API_KEY}`,
  ].join('');
  // @ts-ignore
  return fetch(url, { headers: { 'User-Agent': 'MobilityLab-Sion/3.0' }, cf: { cacheTtl: 120 } });
}

// ─── Main handler ──────────────────────────────────────────────────────────────
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname: path } = new URL(req.url);
    const method = req.method.toUpperCase();

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });

    // GET /api/health ────────────────────────────────────────────────────────────
    if (path === '/api/health' && method === 'GET') {
      return ok({
        status: 'ok', version: '3.0.0',
        environment: env.ENVIRONMENT ?? 'unknown',
        ai: !!env.AI, kv: !!env.KV, tomtom: !!env.TOMTOM_API_KEY,
        timestamp: new Date().toISOString(),
      });
    }

    // GET /api/data ───────────────────────────────────────────────────────────────
    // Toutes les données de référence dont le front React a besoin.
    // ZoneMap.tsx appelle /api/data pour obtenir le GeoJSON des zones.
    if (path === '/api/data' && method === 'GET') {
      return ok({
        zones:    zonesData,
        parking:  parkingData,
        tp:       tpData,
        personas: personasData,
        meta: {
          source:     'sion.ch · MobilityLab Sion 2024-2025',
          tomtomLive: !!env.TOMTOM_API_KEY,
        },
      });
    }

    // POST /api/simulate ─────────────────────────────────────────────────────────
    if (path === '/api/simulate' && method === 'POST') {
      let body: any;
      try { body = await req.json(); } catch { return ok({ error: 'Invalid JSON' }, 400); }
      const scenario = body?.scenario;
      if (!scenario) return ok({ error: 'Missing scenario' }, 400);

      try {
        const results = runSimulation(scenario, parkingData, tpData, personasData);

        // Enrichissement optionnel TomTom live
        let trafficData: any = null;
        if (env.TOMTOM_API_KEY) {
          try {
            const tr = await fetchTomTom(env);
            if (tr.ok) {
              const td = await tr.json() as any;
              const seg = td?.flowSegmentData;
              if (seg) {
                const ci = seg.freeFlowSpeed > 0
                  ? Math.max(0, Math.round((1 - seg.currentSpeed / seg.freeFlowSpeed) * 100))
                  : 0;
                trafficData = {
                  connected: true, source: 'TomTom Traffic Flow API v4',
                  timestamp: new Date().toISOString(),
                  area: 'Sion — Grand-Pont',
                  currentSpeed: seg.currentSpeed,
                  freeFlowSpeed: seg.freeFlowSpeed,
                  confidence: seg.confidence,
                  congestionIdx: ci,
                  severity: ci < 15 ? 'fluide' : ci < 40 ? 'modéré' : ci < 70 ? 'dense' : 'bloqué',
                };
              }
            }
          } catch { /* silencieux */ }
        }

        return ok({ scenario, results, trafficData });
      } catch (e: any) {
        return ok({ error: 'Simulation error', detail: e?.message }, 500);
      }
    }

    // POST /api/insights ─────────────────────────────────────────────────────────
    if (path === '/api/insights' && method === 'POST') {
      let body: any;
      try { body = await req.json(); } catch { return ok({ error: 'Invalid JSON' }, 400); }
      const { scenario, results, includeImprovements = false } = body ?? {};
      if (!scenario || !results) return ok({ error: 'Missing scenario or results' }, 400);
      try {
        const insights = await generateInsights(scenario, results, env as any, includeImprovements);
        return ok(insights);
      } catch (e: any) { return ok({ error: 'Insights error', detail: e?.message }, 500); }
    }

    // POST /api/actions ──────────────────────────────────────────────────────────
    if (path === '/api/actions' && method === 'POST') {
      let body: any;
      try { body = await req.json(); } catch { return ok({ error: 'Invalid JSON' }, 400); }
      const { scenario, results } = body ?? {};
      if (!scenario || !results) return ok({ error: 'Missing scenario or results' }, 400);
      try {
        const actions = await generateActions(scenario, results, env as any);
        return ok(actions);
      } catch (e: any) { return ok({ error: 'Actions error', detail: e?.message }, 500); }
    }

    // POST /api/report ───────────────────────────────────────────────────────────
    if (path === '/api/report' && method === 'POST') {
      let body: any;
      try { body = await req.json(); } catch { return ok({ error: 'Invalid JSON' }, 400); }
      const { scenario, results, insights, actions } = body ?? {};
      if (!scenario || !results || !insights || !actions)
        return ok({ error: 'Missing fields' }, 400);
      try {
        const markdown = generateMarkdownReport(scenario, results, insights, actions);
        const htmlPrintable = generateHTMLReport(markdown);
        return ok({ markdown, htmlPrintable });
      } catch (e: any) { return ok({ error: 'Report error', detail: e?.message }, 500); }
    }

    // GET /api/traffic/flow ───────────────────────────────────────────────────────
    if (path === '/api/traffic/flow' && method === 'GET') {
      if (!env.TOMTOM_API_KEY) {
        return ok({
          connected: false,
          error: 'TOMTOM_API_KEY non configuré dans le Worker',
          solution: 'dash.cloudflare.com → Workers & Pages → sion (⬡ Worker) → Settings → Variables and Secrets → + Add',
          tip: 'La clé est sur my.tomtom.com → Keys → Copy API Key (≠ UUID ID)',
        }, 503);
      }

      try {
        const resp = await fetchTomTom(env);

        if (!resp.ok) {
          const txt = await resp.text();
          return ok({
            connected: false,
            error: `TomTom HTTP ${resp.status}`,
            detail: txt.substring(0, 300),
            tip: resp.status === 403 ? 'Clé invalide — vérifier que c\'est la CLÉ (pas l\'UUID ID)' :
                 resp.status === 429 ? 'Quota dépassé — voir my.tomtom.com → Usage' :
                 'Voir developer.tomtom.com/traffic-api',
          }, resp.status);
        }

        const data = await resp.json() as any;
        const seg = data?.flowSegmentData;
        if (!seg) return ok({ connected: false, error: 'Pas de données TomTom', raw: data }, 404);

        const ci = seg.freeFlowSpeed > 0
          ? Math.max(0, Math.round((1 - seg.currentSpeed / seg.freeFlowSpeed) * 100))
          : 0;

        return ok({
          connected: true,
          source: 'TomTom Traffic Flow API v4',
          timestamp: new Date().toISOString(),
          point: '46.2333, 7.3595',
          area: 'Sion — Route du Grand-Pont',
          currentSpeed: seg.currentSpeed,
          freeFlowSpeed: seg.freeFlowSpeed,
          confidence: seg.confidence,
          congestionIdx: ci,
          severity: ci < 15 ? 'fluide' : ci < 40 ? 'modéré' : ci < 70 ? 'dense' : 'bloqué',
          note: 'Trafic live · OD estimés (calibration TomTom Move recommandée)',
        });

      } catch (e: any) {
        return ok({ connected: false, error: 'Erreur réseau TomTom', detail: e?.message }, 500);
      }
    }

    // Home page ──────────────────────────────────────────────────────────────────
    if (path === '/' || path === '') {
      const badge = (on: boolean, lbl: string) =>
        `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${on?'#166534':'#7c2d12'};color:${on?'#86efac':'#fdba74'}">${on?'✓':'✗'} ${lbl}</span>`;
      const row = (m: string, p: string, d: string) =>
        `<div style="display:flex;gap:.75rem;align-items:baseline;padding:.5rem .75rem;border-radius:6px;margin-bottom:.35rem;background:#1e293b">
          <span style="font-family:monospace;font-size:.75rem;font-weight:700;padding:2px 6px;border-radius:4px;background:${m==='GET'?'#166534':'#1e3a5f'};color:${m==='GET'?'#86efac':'#93c5fd'}">${m}</span>
          <span style="font-family:monospace;color:#e2e8f0;font-size:.85rem">${p}</span>
          <span style="color:#64748b;font-size:.8rem">${d}</span></div>`;
      return new Response(
        `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
        <title>Sion Mobility API v3</title>
        <style>body{font-family:system-ui,sans-serif;padding:2rem;max-width:680px;margin:0 auto;background:#0f172a;color:#e2e8f0}
        h1{color:#60a5fa;font-size:1.5rem}h2{color:#94a3b8;font-size:.85rem;margin:1.5rem 0 .75rem;text-transform:uppercase;letter-spacing:.1em}
        .badges{display:flex;gap:.75rem;flex-wrap:wrap;margin:1rem 0;padding:.75rem;background:#1e293b;border-radius:8px}</style>
        </head><body>
        <h1>🚀 MobilityLab Sion — API v3.0.0</h1>
        <p style="color:#64748b;font-size:.9rem">Cloudflare Worker · MobilityLabCH/Sion</p>
        <div class="badges">
          ${badge(!!env.AI, 'Workers AI')}
          ${badge(!!env.TOMTOM_API_KEY, env.TOMTOM_API_KEY ? 'TomTom clé ✓' : 'TomTom — secret manquant')}
          ${badge(true, env.ENVIRONMENT ?? 'unknown')}
        </div>
        <h2>Routes</h2>
        ${row('GET',  '/api/health',       'Statut service')}
        ${row('GET',  '/api/data',         'Zones GeoJSON + parkings + TP + personas')}
        ${row('POST', '/api/simulate',     'Simulation moteur')}
        ${row('POST', '/api/insights',     'Analyse AI (Llama 3.1)')}
        ${row('POST', '/api/actions',      'Plan d\'actions')}
        ${row('POST', '/api/report',       'Export rapport markdown')}
        ${row('GET',  '/api/traffic/flow', 'TomTom Traffic Flow — Sion centre')}
        </body></html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8', ...cors() } }
      );
    }

    return ok({ error: 'Route inconnue', path, method }, 404);
  },
};
