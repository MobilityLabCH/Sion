import { z } from 'zod';
import { runSimulation } from './simulator.js';
import { generateInsights, generateActions, type Env } from './ai.js';
import { generateMarkdownReport, generateHTMLReport } from './report.js';
import type { Scenario } from './types.js';

// ─── Import mock data ────────────────────────────────────────────────────────
// Ces données sont bundlées dans le worker
import zonesGeoJSON from '../../../data/zones.json' assert { type: 'json' };
import parkingData from '../../../data/parking.json' assert { type: 'json' };
import tpData from '../../../data/tp.json' assert { type: 'json' };
import personasData from '../../../data/personas.json' assert { type: 'json' };

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const ScenarioSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  centrePeakPriceCHFh: z.number().min(0).max(10),
  centreOffpeakPriceCHFh: z.number().min(0).max(10),
  peripheriePeakPriceCHFh: z.number().min(0).max(5),
  peripherieOffpeakPriceCHFh: z.number().min(0).max(5),
  progressiveSlopeFactor: z.number().min(1).max(3),
  tpOffpeakDiscountPct: z.number().min(0).max(50),
  enableCovoiturage: z.boolean(),
  enableTAD: z.boolean(),
  enableTaxiBons: z.boolean(),
  objective: z.enum(['reduce-peak-car', 'protect-short-stay', 'equity-access']),
});

// ─── CORS headers ────────────────────────────────────────────────────────────

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

// ─── Router ──────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // ─── GET /api/health ───
    if (path === '/api/health' && request.method === 'GET') {
      return jsonResponse({
        status: 'ok',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        ai: !!env.AI,
        kv: !!env.KV,
      });
    }

    // ─── GET /api/data ───
    if (path === '/api/data' && request.method === 'GET') {
      return jsonResponse({
        zones: zonesGeoJSON,
        parking: parkingData,
        tp: tpData,
        personas: personasData,
      });
    }

    // ─── POST /api/simulate ───
    if (path === '/api/simulate' && request.method === 'POST') {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return errorResponse('Corps JSON invalide');
      }

      const parsed = ScenarioSchema.safeParse((body as any)?.scenario ?? body);
      if (!parsed.success) {
        return errorResponse(`Paramètres invalides: ${parsed.error.message}`);
      }

      const scenario: Scenario = parsed.data;
      const results = runSimulation(scenario, parkingData as any, tpData as any, personasData as any);

      // Sauvegarder en KV si disponible
      if (env.KV) {
        try {
          await env.KV.put(
            `scenario:${results.scenarioId}`,
            JSON.stringify({ scenario, results }),
            { expirationTtl: 60 * 60 * 24 * 30 } // 30 jours
          );
        } catch (e) {
          console.error('KV save error:', e);
        }
      }

      return jsonResponse({ scenario, results });
    }

    // ─── POST /api/insights ───
    if (path === '/api/insights' && request.method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return errorResponse('Corps JSON invalide');
      }

      const { scenario, results, includeImprovements } = body;
      if (!scenario || !results) {
        return errorResponse('scenario et results requis');
      }

      const insights = await generateInsights(scenario, results, env, !!includeImprovements);
      return jsonResponse(insights);
    }

    // ─── POST /api/actions ───
    if (path === '/api/actions' && request.method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return errorResponse('Corps JSON invalide');
      }

      const { scenario, results } = body;
      if (!scenario || !results) {
        return errorResponse('scenario et results requis');
      }

      const actions = await generateActions(scenario, results, env);
      return jsonResponse(actions);
    }

    // ─── POST /api/report ───
    if (path === '/api/report' && request.method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return errorResponse('Corps JSON invalide');
      }

      const { scenario, results, insights, actions } = body;
      if (!scenario || !results || !insights || !actions) {
        return errorResponse('scenario, results, insights et actions requis');
      }

      const markdown = generateMarkdownReport(scenario, results, insights, actions);
      const htmlPrintable = generateHTMLReport(markdown, `Rapport – ${scenario.name || 'Simulation'}`);

      return jsonResponse({ markdown, htmlPrintable });
    }

    // ─── GET /api/scenarios (liste depuis KV) ───
    if (path === '/api/scenarios' && request.method === 'GET') {
      if (!env.KV) {
        return jsonResponse({ scenarios: [], note: 'KV non disponible' });
      }
      try {
        const list = await env.KV.list({ prefix: 'scenario:' });
        const scenarios = await Promise.all(
          list.keys.slice(0, 20).map(async (key) => {
            const val = await env.KV.get(key.name, 'json') as any;
            return val ? { id: key.name, name: val.scenario?.name, timestamp: val.results?.timestamp } : null;
          })
        );
        return jsonResponse({ scenarios: scenarios.filter(Boolean) });
      } catch (e) {
        return errorResponse('Erreur KV', 500);
      }
    }

    return errorResponse(`Route inconnue: ${path}`, 404);
  },
};
