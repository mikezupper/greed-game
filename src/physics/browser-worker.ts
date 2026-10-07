import { simulate } from './simulate.ts';
import type { RollRequest } from './types.ts';

self.onmessage = async ({ data }: MessageEvent<RollRequest>) => {
  try { self.postMessage({ roll: await simulate(data) }); }
  catch { self.postMessage({ error: 'The dice could not settle. Try another roll.' }); }
};
