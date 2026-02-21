// DEPLOY TEST 2026-02-21
/**
 * Sion Mobility Pricing Simulator — Worker API
 * Toutes les routes sont définies ici.
 * 
 * Routes disponibles:
 *   GET  /api/health     → statut du service
 *   GET  /api/data       → données de référence (zones, parking, TP, personas)
 *   POST /api/simulate   → lancer une simulation
 *   POST /api/insights   → analyses IA (avec fallback déterministe)
 *   POST /api/actions    → plan d'actions IA (avec fallback)
 *   POST /api/report     → rapport markdown/HTML
 */

import { runSimulation } from './simulator.js';
import { generateInsights, generateActions } from './ai.js';
import { generateMarkdownReport, generateHTMLReport } from './report.js';

// Import des données statiques
import parkingData from '../../../data/parking.json' assert { type: 'json' };
import tpData from '../../../data/tp.json' assert { type: 'json' };
import personasData from '../../../data/personas.json' assert { type: 'json' };
import zonesData from '../../../data/zones.json' assert { type: 'json' };

// ─── Helpers ────────────────────────────────────────────────────────────────

function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// ─── Handler principal ───────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();

    // Preflight CORS
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // ── Page d'accueil ───────────────────────────────────────────────────────
    if (pathname === '/' || pathname === '') {
      return new Response(
        `<html>
          <head><title>Sion API</title><meta charset="utf-8" /></head>
          <body style="font-family: sans-serif; padding: 2rem; max-width: 600px; margin: 0 auto">
            <h1>🚀 Sion Mobility Pricing Simulator — API</h1>
            <p>Le service est opérationnel.</p>
            <h2>Routes disponibles</h2>
            <ul>
              <li><a href="/api/health">GET /api/health</a> — statut</li>
              <li><a href="/api/data">GET /api/data</a> — données de référence</li>
              <li>POST /api/simulate — lancer une simulation</li>
              <li>POST /api/insights — analyses IA</li>
              <li>POST /api/actions — plan d'actions</li>
              <li>POST /api/report — rapport exportable</li>
            </ul>
            <p style="color: #888; font-size: 0.85rem">
              Frontend: déployé sur Cloudflare Pages (sion.pages.dev)
            </p>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders() } }
      );
    }

    // ── GET /api/health ──────────────────────────────────────────────────────
    if (pathname === '/api/health' && method === 'GET') {
      return jsonResponse({
        status: 'ok',
        version: '0.1.0',
        environment: env.ENVIRONMENT ?? 'unknown',
        ai: !!env.AI,
        kv: !!env.KV,
        timestamp: new Date().toISOString(),
      });
    }

    // ── GET /api/data ────────────────────────────────────────────────────────
    if (pathname === '/api/data' && method === 'GET') {
      return jsonResponse({
        zones: zonesData,
        parking: parkingData,
        tp: tpData,
        personas: personasData,
      });
    }

    // ── POST /api/simulate ───────────────────────────────────────────────────
    if (pathname === '/api/simulate' && method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return errorResponse('Body JSON invalide');
      }

      const { scenario } = body;
      if (!scenario) {
        return errorResponse('Champ "scenario" manquant dans le body');
      }

      try {
        const results = runSimulation(
          scenario,
          parkingData as any,
          tpData as any,
          personasData as any
        );
        return jsonResponse({ scenario, results });
      } catch (err: any) {
        console.error('Simulation error:', err);
        return errorResponse(`Erreur simulation: ${err?.message ?? 'inconnue'}`, 500);
      }
    }

    // ── POST /api/insights ───────────────────────────────────────────────────
    if (pathname === '/api/insights' && method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return errorResponse('Body JSON invalide');
      }

      const { scenario, results, includeImprovements = false } = body;
      if (!scenario || !results) {
        return errorResponse('Champs "scenario" et "results" requis');
      }

      try {
        const insights = await generateInsights(scenario, results, env, includeImprovements);
        return jsonResponse(insights);
      } catch (err: any) {
        console.error('Insights error:', err);
        return errorResponse(`Erreur insights: ${err?.message ?? 'inconnue'}`, 500);
      }
    }

    // ── POST /api/actions ────────────────────────────────────────────────────
    if (pathname === '/api/actions' && method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return errorResponse('Body JSON invalide');
      }

      const { scenario, results } = body;
      if (!scenario || !results) {
        return errorResponse('Champs "scenario" et "results" requis');
      }

      try {
        const actions = await generateActions(scenario, results, env);
        return jsonResponse(actions);
      } catch (err: any) {
        console.error('Actions error:', err);
        return errorResponse(`Erreur actions: ${err?.message ?? 'inconnue'}`, 500);
      }
    }

    // ── POST /api/report ─────────────────────────────────────────────────────
    if (pathname === '/api/report' && method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return errorResponse('Body JSON invalide');
      }

      const { scenario, results, insights, actions } = body;
      if (!scenario || !results || !insights || !actions) {
        return errorResponse('Champs "scenario", "results", "insights" et "actions" requis');
      }

      try {
        const markdown = generateMarkdownReport(scenario, results, insights, actions);
        // generateHtmlReport peut ne pas exister encore — fallback gracieux
        const htmlPrintable = typeof generateHtmlReport === 'function'
          ? generateHtmlReport(scenario, results, insights, actions)
          : `<pre>${markdown}</pre>`;
        return jsonResponse({ markdown, htmlPrintable });
      } catch (err: any) {
        console.error('Report error:', err);
        return errorResponse(`Erreur rapport: ${err?.message ?? 'inconnue'}`, 500);
      }
    }

    // ── 404 ──────────────────────────────────────────────────────────────────
    return errorResponse(`Route inconnue: ${method} ${pathname}`, 404);
  },
};
