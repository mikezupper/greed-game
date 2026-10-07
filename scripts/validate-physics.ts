import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { gzipSync } from 'node:zlib';
import { simulate, ENGINE } from '../src/physics/simulate.ts';
import { randomSource } from '../src/physics/random.ts';

const rollsPerCount = Number(process.argv[2] ?? 1000);
if (!Number.isInteger(rollsPerCount) || rollsPerCount < 10) throw new Error('Use at least 10 rolls per dice count.');
const sampleSeed = Number(process.argv[3] ?? 0x7342ab19);
if (!Number.isInteger(sampleSeed) || sampleSeed < 0 || sampleSeed > 0xffffffff) throw new Error('Sample seed must be uint32.');
const reportName = process.argv[4] ?? 'physics-report.json';
if (!/^[a-z-]+\.json$/.test(reportName)) throw new Error('Use a simple JSON report filename.');
const random = randomSource(sampleSeed);
const groups = [];
const percentile = (xs: number[], p: number) => xs.sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)] ?? 0;
const chiSquare = (counts: number[]) => { const expected = counts.reduce((a, b) => a + b, 0) / 6; return counts.reduce((sum, n) => sum + (n - expected) ** 2 / expected, 0); };
const independence = (matrix: number[]) => {
  const rows = Array.from({ length: 6 }, (_, r) => matrix.slice(r * 6, r * 6 + 6).reduce((a, b) => a + b, 0));
  const cols = Array.from({ length: 6 }, (_, c) => matrix.filter((_, i) => i % 6 === c).reduce((a, b) => a + b, 0));
  const total = rows.reduce((a, b) => a + b, 0);
  return matrix.reduce((sum, count, i) => { const expected = (rows[Math.floor(i / 6)] ?? 0) * (cols[i % 6] ?? 0) / total;
    return sum + (expected > 0 ? (count - expected) ** 2 / expected : 0); }, 0);
};
await simulate({ seed: 42, ids: [0, 1, 2, 3, 4, 5] });
for (let count = 1; count <= 6; count++) {
  const faces = [0, 0, 0, 0, 0, 0], perPosition = Array.from({ length: count }, () => [0, 0, 0, 0, 0, 0]);
  const times: number[] = [], durations: number[] = [], payloads: number[] = [], compressed: number[] = [], failures: number[] = [];
  let nudgedRolls = 0;
  let equalPairs = 0, pairs = 0;
  const joint = Array<number>(36).fill(0), serial = Array<number>(36).fill(0); let previous: number | undefined;
  for (let i = 0; i < rollsPerCount; i++) {
    const seed = Math.floor(random() * 4294967296);
    const start = performance.now();
    const roll = await simulate({ seed, ids: Array.from({ length: count }, (_, id) => id) });
    times.push(performance.now() - start); durations.push(roll.steps * roll.dt);
    payloads.push(Buffer.byteLength(JSON.stringify(roll)));
    compressed.push(gzipSync(JSON.stringify(roll)).length);
    if (roll.nudges > 0) nudgedRolls++;
    if (!roll.settled) { failures.push(seed); previous = undefined; }
    else for (const [position, d] of roll.dice.entries()) {
      faces[d.value - 1] = (faces[d.value - 1] ?? 0) + 1;
      const histogram = perPosition[position];
      if (histogram) histogram[d.value - 1] = (histogram[d.value - 1] ?? 0) + 1;
      if (position === 0) {
        if (previous !== undefined) { const at = (previous - 1) * 6 + d.value - 1; serial[at] = (serial[at] ?? 0) + 1; }
        previous = d.value;
      }
      for (const other of roll.dice.slice(position + 1)) { pairs++; if (other.value === d.value) equalPairs++;
        const at = (d.value - 1) * 6 + other.value - 1; joint[at] = (joint[at] ?? 0) + 1;
      }
    }
  }
  const result = { count, rolls: rollsPerCount, faces, chiSquare: chiSquare(faces), positionChiSquare: perPosition.map(chiSquare),
    settled: rollsPerCount - failures.length, failureSeeds: failures, nudgedRolls, equalPairRate: pairs ? equalPairs / pairs : null,
    jointMatrix: joint, jointIndependenceChiSquare: pairs ? independence(joint) : null,
    firstDieSerialMatrix: serial, serialIndependenceChiSquare: independence(serial),
    computationMs: { p50: percentile(times, 0.5), p95: percentile(times, 0.95), max: Math.max(...times) },
    visualSecondsP95: percentile(durations, 0.95), jsonBytesP95: percentile(payloads, 0.95), gzipBytesP95: percentile(compressed, 0.95) };
  groups.push(result); console.log(JSON.stringify(result));
}
const a = await simulate({ seed: 42, ids: [0, 1, 2, 3, 4, 5] });
const b = await simulate({ seed: 42, ids: [0, 1, 2, 3, 4, 5] });
const report = { measuredAt: new Date().toISOString(), engine: ENGINE, sampleSeed, node: process.version, cpu: cpus()[0]?.model,
  identicalReplay: JSON.stringify(a) === JSON.stringify(b), groups,
  interpretation: 'Seeded diagnostic, not proof of fair dice. Chi-square has 5 df; 20.515 is the unadjusted 0.1% threshold. Position tests and counts require multiple-comparison care. Repeat on other hardware and test serial dependence before launch.' };
mkdirSync('docs/generated', { recursive: true });
writeFileSync(`docs/generated/${reportName}`, JSON.stringify(report, null, 2) + '\n');
if (!report.identicalReplay) process.exitCode = 1;
