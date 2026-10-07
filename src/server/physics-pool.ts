import { Worker } from 'node:worker_threads';
import type { Roll, RollRequest } from '../physics/types.ts';

/** One bounded simulation worker initially; isolate WASM from sockets and room locks. */
export class PhysicsPool {
  private worker: Worker;
  private sequence = 0;
  private pending = new Map<number, { resolve: (roll: Roll) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private stopped = false;
  constructor() {
    this.worker = this.spawn();
  }
  private spawn(): Worker {
    const worker = new Worker(new URL('../physics/node-worker.ts', import.meta.url));
    worker.on('message', (data: { job: number; roll?: Roll; error?: string }) => {
      if (worker !== this.worker) return;
      const pending = this.pending.get(data.job);
      if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(data.job);
      if (data.roll) pending.resolve(data.roll); else pending.reject(new Error(data.error ?? 'Physics worker failed.'));
    });
    worker.on('error', error => this.restart(worker, error));
    worker.on('exit', () => this.restart(worker, new Error('Physics worker exited.')));
    return worker;
  }
  private restart(worker: Worker, error: Error): void {
    if (this.stopped || worker !== this.worker) return;
    this.fail(error);
    this.worker = this.spawn();
    void worker.terminate();
  }
  private fail(error: Error): void {
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error); }
    this.pending.clear();
  }
  run(request: RollRequest): Promise<Roll> {
    if (this.stopped || this.pending.size >= 16) return Promise.reject(new Error('The dice server is busy. Try again.'));
    const job = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.restart(this.worker, new Error('Physics worker timed out.'));
      }, 5000);
      this.pending.set(job, { resolve, reject, timer }); this.worker.postMessage({ job, request });
    });
  }
  async close(): Promise<void> { this.stopped = true; this.fail(new Error('Server stopped.')); await this.worker.terminate(); }
}
