/// <reference types="@cloudflare/workers-types" />

interface Env {
  STELLAR_TOML_MAX_AGE: string;
  STELLAR_TOML_STALE_WHILE_REVALIDATE: string;
  DEFAULT_MAX_AGE: string;
  DEFAULT_STALE_WHILE_REVALIDATE: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function cacheControlFor(pathname: string, env: Env): string {
  if (pathname.endsWith("/stellar.toml")) {
    const maxAge = parseInt(env.STELLAR_TOML_MAX_AGE, 10) || 3600;
    const stale = parseInt(env.STELLAR_TOML_STALE_WHILE_REVALIDATE, 10) || 86400;
    return `public, max-age=${maxAge}, stale-while-revalidate=${stale}`;
  }
  const maxAge = parseInt(env.DEFAULT_MAX_AGE, 10) || 300;
  const stale = parseInt(env.DEFAULT_STALE_WHILE_REVALIDATE, 10) || 3600;
  return `public, max-age=${maxAge}, stale-while-revalidate=${stale}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const cache = caches.default;

    const cached = await cache.match(request);
    if (cached) {
      const res = new Response(cached.body, cached);
      res.headers.set("cf-cache-status", "HIT");
      for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
      return res;
    }

    const origin = await fetch(request);
    if (!origin.ok) return origin;

    const res = new Response(origin.body, origin);
    res.headers.set("Cache-Control", cacheControlFor(url.pathname, env));
    res.headers.set("cf-cache-status", "MISS");
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);

    await cache.put(request, res.clone());
    return res;
  },
} satisfies ExportedHandler<Env>;
