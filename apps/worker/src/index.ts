export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);

    // 🏠 Page d'accueil
    if (url.pathname === "/") {
      return new Response(
        `
        <html>
          <head>
            <title>Sion API</title>
            <meta charset="utf-8" />
          </head>
          <body style="font-family: sans-serif; padding: 2rem">
            <h1>🚀 Sion Worker API</h1>
            <p>Le service est opérationnel.</p>
            <ul>
              <li><a href="/api/health">/api/health</a></li>
            </ul>
          </body>
        </html>
        `,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // autres routes API ici…

    return new Response(
      JSON.stringify({ error: `Route inconnue: ${url.pathname}` }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
};
