import { expect, it } from 'vitest';
import type { Roll } from '../../src/physics/types.ts';

it.each([
  [42, '16fc80f26a238db3071b3735a87ffa35bd2a6bbc0b2bf59aba6bb7c9422d7c58'],
  [3602705804, '6e309f14a51865e96631be3fead8e665e1b13e7d09baf512c06a55ab39b474c8'],
  [4248905315, '9199e93002a14f8ef7a65f28643baa775afae2e6a8af506f21608a5c7c646cd8'],
] as const)('matches the Node-generated seed %i trajectory inside a real browser worker', async (seed, expected) => {
  // SHA-256 of JSON.stringify(await simulate({ seed: 42, ids: [0, 1, 2, 3, 4, 5] })) on Node 24.
  // Regenerate deliberately when the recorded engine/launch version changes.
  const worker = new Worker(new URL('../../src/physics/browser-worker.ts', import.meta.url), { type: 'module' });
  try {
    const roll = await new Promise<Roll>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<{ roll?: Roll; error?: string }>) => {
        if (data.roll) resolve(data.roll); else reject(new Error(data.error ?? 'No roll returned.'));
      };
      worker.onerror = reject;
      worker.postMessage({ seed, ids: [0, 1, 2, 3, 4, 5] });
    });
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(roll)));
    const actual = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    expect(roll.engine).toBe('rapier-0.21.0/launch-3');
    expect(actual).toBe(expected);
  } finally { worker.terminate(); }
});
