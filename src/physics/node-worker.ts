import { parentPort } from 'node:worker_threads';
import { simulate } from './simulate.ts';
import type { RollRequest } from './types.ts';

parentPort?.on('message', async ({ job, request }: { job: number; request: RollRequest }) => {
  try { parentPort?.postMessage({ job, roll: await simulate(request) }); }
  catch (error) { parentPort?.postMessage({ job, error: error instanceof Error ? error.message : 'Simulation failed.' }); }
});
