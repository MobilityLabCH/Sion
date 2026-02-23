// Sion Mobility Pricing Simulator — Cloudflare Worker
// Version: 2025-02 · MobilityLab Sion
//
// Routes:
//   GET  /api/health          → statut du service
//   GET  /api/data            → données de référence
//   POST /api/simulate        → simulation
//   GET  /api/traffic/flow    → TomTom Traffic Flow (requiert TOMTOM_API_KEY secret)
//
// Secrets Cloudflare (Dashboard → Workers → Settings → Secrets):
//   TOMTOM_API_KEY  = votre clé my.tomtom.com (PAS l'ID de clé, la clé elle-même)
//
// Variables (wrangler.toml [vars]):
//   ENVIRONMENT = "production"
//   TOMTOM_BBOX = "7.33,46.20,7.40,46.25"

// ─── CORS helpers ────────────────────────────────────────────────────────────
function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
function err(msg, status = 400) { return json({ error: msg }, status); }

// ─── Main handler ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url      = new URL(request.url);
    const path     = url.pathname;
    const method   = request.method.toUpperCase();

    // Preflight CORS
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // ── GET /api/health ────────────────────────────────────────────────────
    if (path === "/api/health" && method === "GET") {
      return json({
        status:      "ok",
        version:     "2.0.0",
        environment: env.ENVIRONMENT ?? "unknown",
        tomtom:      !!env.TOMTOM_API_KEY,
        timestamp:   new Date().toISOString(),
      });
    }

    // ── GET /api/traffic/flow ──────────────────────────────────────────────
    // TomTom Traffic Flow API — proxy sécurisé
    // La clé API reste côté serveur, jamais exposée au client
    //
    // Source: TomTom Traffic Flow API v4
    // Endpoint: https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json
    // Point: centre de Sion (46.2333, 7.3595)
    // Mise à jour: toutes les 2 minutes côté TomTom
    //
    // IMPORTANT: TOMTOM_API_KEY doit être défini dans Cloudflare Dashboard
    // Dashboard → Workers & Pages → sion → Settings → Variables → Secrets
    // La valeur = la CLÉ API (ex: "5wwQxxx..."), PAS l'ID de clé (UUID)
    if (path === "/api/traffic/flow" && method === "GET") {
      if (!env.TOMTOM_API_KEY) {
        return json({
          error: "TOMTOM_API_KEY non configuré",
          help: "Ajouter le secret dans Cloudflare Dashboard → Workers → sion → Settings → Variables → Secrets",
          docs: "https://developer.tomtom.com/traffic-api/documentation"
        }, 503);
      }

      // Centre Sion: 46.2333°N, 7.3595°E
      // Zone couverte: bbox 7.33,46.20 → 7.40,46.25
      const tomtomUrl = [
        "https://api.tomtom.com/traffic/services/4",
        "/flowSegmentData/absolute/10/json",
        `?point=46.2333,7.3595`,
        `&unit=KMPH`,
        `&thickness=2`,
        `&openLr=false`,
        `&key=${env.TOMTOM_API_KEY}`
      ].join("");

      try {
        const resp = await fetch(tomtomUrl, {
          headers: { "User-Agent": "MobilityLab-Sion/2.0" },
          cf: { cacheTtl: 120 }   // Cache 2 min dans Cloudflare edge
        });

        if (!resp.ok) {
          const errText = await resp.text();
          return json({
            error: `TomTom API erreur ${resp.status}`,
            detail: errText.substring(0, 200),
            tip: resp.status === 403 
              ? "Vérifier que la clé API est correcte (pas l'ID de clé UUID)"
              : "Voir https://developer.tomtom.com/traffic-api"
          }, resp.status);
        }

        const data = await resp.json();
        const seg  = data.flowSegmentData;

        if (!seg) {
          return json({ error: "Pas de données TomTom pour ce point", raw: data }, 404);
        }

        const congestionIdx = seg.freeFlowSpeed > 0
          ? Math.round((1 - seg.currentSpeed / seg.freeFlowSpeed) * 100)
          : 0;

        return json({
          source:        "TomTom Traffic Flow API v4",
          timestamp:     new Date().toISOString(),
          point:         "46.2333, 7.3595",
          area:          "Sion centre (Grand-Pont)",
          currentSpeed:  seg.currentSpeed,       // km/h vitesse actuelle
          freeFlowSpeed: seg.freeFlowSpeed,      // km/h vitesse fluide
          confidence:    seg.confidence,         // 0–1 fiabilité
          congestionIdx,                         // 0=fluide, 100=embouteillage
          severity:      congestionIdx < 20 ? "fluide"
                       : congestionIdx < 50 ? "modéré"
                       : congestionIdx < 75 ? "dense"
                       : "bloqué",
          note:          "OD Sion estimés — calibration TomTom Move recommandée",
        });

      } catch (e) {
        return json({
          error:  "Erreur fetch TomTom",
          detail: e.message,
        }, 500);
      }
    }

    // ── Home page ──────────────────────────────────────────────────────────
    if (path === "/" || path === "") {
      return new Response(
        `<!DOCTYPE html><html lang="fr"><head><title>Sion Mobility API</title>
        <meta charset="utf-8"/>
        <style>body{font-family:system-ui;padding:2rem;max-width:600px;margin:0 auto;background:#111;color:#eee}
        code{background:#222;padding:2px 6px;border-radius:4px;color:#86efac}
        a{color:#60a5fa}</style></head>
        <body>
          <h1>🚀 MobilityLab Sion — API</h1>
          <p>Service opérationnel · v2.0.0</p>
          <h2>Routes</h2>
          <ul>
            <li><a href="/api/health">GET /api/health</a> — statut</li>
            <li><a href="/api/traffic/flow">GET /api/traffic/flow</a> — TomTom Traffic (requiert clé)</li>
          </ul>
          <p style="color:#666;font-size:.85rem">
            TomTom configuré: <code>${!!env.TOMTOM_API_KEY}</code>
          </p>
        </body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders() } }
      );
    }

    return json({ error: "Route inconnue", path }, 404);
  },
};
