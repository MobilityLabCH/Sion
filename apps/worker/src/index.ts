// Sion Mobility Pricing Simulator — Cloudflare Worker
// Version: 3.0.0 · MobilityLab Sion

import { runSimulation } from './simulator.js';
import { generateInsights, generateActions } from './ai.js';
import { generateMarkdownReport, generateHTMLReport } from './report.js';
import parkingRaw from './data/parking.json';
import tpRaw from './data/tp.json';
import personasRaw from './data/personas.json';
import zonesRaw from './data/zones.json';

const parkingData = parkingRaw as any[];
const tpData = tpRaw as any[];
const personasData = personasRaw as any[];
const zonesData = zonesRaw as any;

// ─── Env ───────────────────────────────────────────────────────────────────────
export interface Env {
  AI?: any;
  KV?: KVNamespace;
  ENVIRONMENT?: string;
  TOMTOM_API_KEY?: string;
  TOMTOM_BBOX?: string;
}

// ─── CORS ──────────────────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
    },
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
  return fetch(url, {
    headers: { 'User-Agent': 'MobilityLab-Sion/3.0' },
    cf: { cacheTtl: 120 },
  });
}

// ─── Main handler ──────────────────────────────────────────────────────────────
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname: path } = new URL(req.url);
    const method = req.method.toUpperCase();

    // Préflight CORS
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // GET /api/health
    if (path === '/api/health' && method === 'GET') {
      return json({
        status: 'ok',
        version: '3.0.0',
        environment: env.ENVIRONMENT ?? 'unknown',
        ai: !!env.AI,
        kv: !!env.KV,
        tomtom: !!env.TOMTOM_API_KEY,
        timestamp: new Date().toISOString(),
      });
    }

    // GET /api/data
    if (path === '/api/data' && method === 'GET') {
      return json({
        zones: zonesData,
        parking: parkingData,
        tp: tpData,
        personas: personasData,
        meta: {
          source: 'sion.ch · MobilityLab Sion 2024-2025',
          tomtomLive: !!env.TOMTOM_API_KEY,
        },
      });
    }

    // POST /api/simulate
    if (path === '/api/simulate' && method === 'POST') {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }

      const scenario = body?.scenario;
      if (!scenario) return json({ error: 'Missing scenario' }, 400);

      try {
        const results = runSimulation(scenario, parkingData, tpData, personasData);

        // Optionnel: enrichissement TomTom
        let trafficData: any = null;
        if (env.TOMTOM_API_KEY) {
          try {
            const tr = await fetchTomTom(env);
            if (tr.ok) {
              const td = (await tr.json()) as any;
              const seg = td?.flowSegmentData;
              if (seg) {
                const ci =
                  seg.freeFlowSpeed > 0
                    ? Math.max(0, Math.round((1 - seg.currentSpeed / seg.freeFlowSpeed) * 100))
                    : 0;

                trafficData = {
                  connected: true,
                  source: 'TomTom Traffic Flow API v4',
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
          } catch {
            /* silencieux */
          }
        }

        return json({ scenario, results, trafficData });
      } catch (e: any) {
        return json({ error: 'Simulation error', detail: e?.message }, 500);
      }
    }

    // POST /api/insights
    if (path === '/api/insights' && method === 'POST') {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }
      const { scenario, results, includeImprovements = false } = body ?? {};
      if (!scenario || !results) return json({ error: 'Missing scenario or results' }, 400);

      try {
        const insights = await generateInsights(scenario, results, env as any, includeImprovements);
        return json(insights);
      } catch (e: any) {
        return json({ error: 'Insights error', detail: e?.message }, 500);
      }
    }

    // POST /api/actions
    if (path === '/api/actions' && method === 'POST') {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }
      const { scenario, results } = body ?? {};
      if (!scenario || !results) return json({ error: 'Missing scenario or results' }, 400);

      try {
        const actions = await generateActions(scenario, results, env as any);
        return json(actions);
      } catch (e: any) {
        return json({ error: 'Actions error', detail: e?.message }, 500);
      }
    }

    // POST /api/report
    if (path === '/api/report' && method === 'POST') {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }
      const { scenario, results, insights, actions } = body ?? {};
      if (!scenario || !results || !insights || !actions) return json({ error: 'Missing fields' }, 400);

      try {
        const markdown = generateMarkdownReport(scenario, results, insights, actions);
        const htmlPrintable = generateHTMLReport(markdown);
        return json({ markdown, htmlPrintable });
      } catch (e: any) {
        return json({ error: 'Report error', detail: e?.message }, 500);
      }
    }

    // GET /api/traffic/flow
    if (path === '/api/traffic/flow' && method === 'GET') {
      if (!env.TOMTOM_API_KEY) {
        return json(
          {
            connected: false,
            error: 'TOMTOM_API_KEY non configuré dans le Worker',
          },
          503
        );
      }

      try {
        const resp = await fetchTomTom(env);

        if (!resp.ok) {
          const txt = await resp.text();
          return json(
            {
              connected: false,
              error: `TomTom HTTP ${resp.status}`,
              detail: txt.substring(0, 300),
            },
            resp.status
          );
        }

        const data = (await resp.json()) as any;
        const seg = data?.flowSegmentData;
        if (!seg) return json({ connected: false, error: 'Pas de données TomTom', raw: data }, 404);

        const ci =
          seg.freeFlowSpeed > 0
            ? Math.max(0, Math.round((1 - seg.currentSpeed / seg.freeFlowSpeed) * 100))
            : 0;

        return json({
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
        return json({ connected: false, error: 'Erreur réseau TomTom', detail: e?.message }, 500);
      }
    }

    // Home
    if (path === '/' || path === '') {
      return new Response('OK', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() },
      });
    }

    return json({ error: 'Route inconnue', path, method }, 404);
  },
};
