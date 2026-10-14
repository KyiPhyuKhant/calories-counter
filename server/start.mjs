import { createFoodApi } from './food-api.mjs';

const port = Number(process.env.FOOD_API_PORT ?? 4111);
const host = process.env.FOOD_API_HOST ?? '127.0.0.1';
if (!process.env.USDA_API_KEY?.trim()) throw new Error('Set USDA_API_KEY in the ignored .env.server.local file.');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid FOOD_API_PORT.');
const server = createFoodApi({ apiKey: process.env.USDA_API_KEY });
server.listen(port, host, () => console.log(`Food API listening on ${host}:${port}`));
server.on('error', () => { console.error('Food API could not start. Check the host and port.'); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); server.closeAllConnections(); });
