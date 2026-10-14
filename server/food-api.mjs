import { createServer } from 'node:http';
import { usdaDataTypes } from '../src/data/usdaFoodProvider.ts';

export function createFoodApi({ apiKey, fetcher = fetch, timeoutMs = 10000, maxRequestsPerHour = 500, now = Date.now } = {}) {
  let windowStart = now(); let requests = 0; let blockedUntil = 0;
  return createServer({ requestTimeout: 15000, headersTimeout: 10000 }, async (request, response) => {
    const send = (status, data, headers = {}) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
      response.end(JSON.stringify(data));
    };
    if (request.method !== 'GET') { send(405, { error: 'Method not allowed.' }, { Allow: 'GET' }); return; }
    let url;
    try { url = new URL(request.url, 'http://localhost'); } catch { send(400, { error: 'Invalid request.' }); return; }
    const id = /^\/foods\/([1-9]\d{0,14})$/.exec(url.pathname)?.[1];
    const search = url.pathname === '/foods/search';
    const query = url.searchParams.get('query')?.trim();
    if (!id && !search) { send(404, { error: 'Route not found.' }); return; }
    if (search && (!query || query.length > 120)) { send(400, { error: 'A search of 1-120 characters is required.' }); return; }
    if (!apiKey?.trim()) { send(503, { error: 'USDA access is not configured.' }); return; }
    const time = now();
    if (time - windowStart >= 3600000) { windowStart = time; requests = 0; }
    if (time < blockedUntil || requests >= maxRequestsPerHour) {
      send(429, { error: 'Request limit reached.' }, { 'Retry-After': String(Math.max(1, Math.ceil(((time < blockedUntil ? blockedUntil : windowStart + 3600000) - time) / 1000))) }); return;
    }
    requests++;
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    const disconnect = () => { if (!response.writableEnded) controller.abort(); };
    response.on('close', disconnect);
    try {
      const upstream = await fetcher(`https://api.nal.usda.gov/fdc/v1/${search ? 'foods/search' : `food/${id}`}`, {
        method: search ? 'POST' : 'GET', signal: controller.signal, redirect: 'error',
        headers: { 'X-Api-Key': apiKey, Accept: 'application/json', ...(search ? { 'Content-Type': 'application/json' } : {}) },
        ...(search ? { body: JSON.stringify({ query, pageSize: 20, dataType: usdaDataTypes }) } : {}),
      });
      if (upstream.status === 429) {
        const seconds = Number(upstream.headers.get('Retry-After'));
        const retry = Number.isFinite(seconds) && seconds > 0 ? Math.min(86400, Math.ceil(seconds)) : 3600;
        blockedUntil = now() + retry * 1000;
        send(429, { error: 'USDA request limit reached.' }, { 'Retry-After': String(retry) }); return;
      }
      if (upstream.status === 404) { send(404, { error: 'Food not found.' }); return; }
      if (upstream.status === 401 || upstream.status === 403) { send(403, { error: 'USDA access denied. Check server configuration.' }); return; }
      if (!upstream.ok) { send(502, { error: 'USDA service unavailable.' }); return; }
      const data = await upstream.json();
      send(200, data);
    } catch { if (!response.destroyed) send(controller.signal.aborted ? 504 : 502, { error: controller.signal.aborted ? 'USDA request timed out.' : 'USDA service unavailable.' }); }
    finally { clearTimeout(timer); response.off('close', disconnect); }
  });
}
