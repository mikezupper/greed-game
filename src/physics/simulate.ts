import RAPIER from '@dimforge/rapier3d-compat';
import { randomSource } from './random.ts';
import { readFace } from './read-face.ts';
import type { Frame, Roll, RollRequest } from './types.ts';

const ready = RAPIER.init();
export const DT = 1 / 60;
export const MAX_STEPS = 1800;
export const ENGINE = 'rapier-0.21.0/launch-3';

export async function simulate(request: RollRequest): Promise<Roll> {
  if (request.ids.length < 1 || request.ids.length > 6 || new Set(request.ids).size !== request.ids.length
    || request.ids.some(id => !Number.isInteger(id) || id < 0 || id > 5)) throw new Error('Invalid dice ids.');
  await ready;
  const random = randomSource(request.seed);
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  try {
    const fixed = (x: number, y: number, z: number, hx: number, hy: number, hz: number) =>
      world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(0.65).setRestitution(0.25));
    fixed(0, -0.2, 0, 5, 0.2, 3.5);
    fixed(-5, 1.6, 0, 0.2, 1.8, 3.7); fixed(5, 1.6, 0, 0.2, 1.8, 3.7);
    fixed(0, 1.6, -3.5, 5.2, 1.8, 0.2); fixed(0, 1.6, 3.5, 5.2, 1.8, 0.2);
    const bodies = request.ids.map((id, i) => {
      // Uniform SO(3) initial orientation, generated once and recorded by the first frame.
      const u = random(), a = random() * Math.PI * 2, b = random() * Math.PI * 2;
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation((i % 3 - 1) * 1.5, 2.5 + random(), (Math.floor(i / 3) - 0.5) * 1.8)
        .setRotation({ x: Math.sqrt(1 - u) * Math.sin(a), y: Math.sqrt(1 - u) * Math.cos(a), z: Math.sqrt(u) * Math.sin(b), w: Math.sqrt(u) * Math.cos(b) })
        .setLinvel((random() - 0.5) * 5, 1 + random() * 2, (random() - 0.5) * 5)
        .setAngvel({ x: (random() - 0.5) * 20, y: (random() - 0.5) * 20, z: (random() - 0.5) * 20 })
        .setLinearDamping(0.25).setAngularDamping(0.3).setCcdEnabled(true));
      world.createCollider(RAPIER.ColliderDesc.roundCuboid(0.43, 0.43, 0.43, 0.07).setDensity(1).setFriction(0.65).setRestitution(0.3), body);
      return { id, body };
    });
    const frames: Frame[] = [];
    const rounded = (n: number) => Math.round(n * 10000) / 10000;
    const capture = (step: number) => frames.push({ step, poses: bodies.map(({ id, body }) => {
      const p = body.translation(), q = body.rotation();
      return { id, position: { x: rounded(p.x), y: rounded(p.y), z: rounded(p.z) }, rotation: { x: rounded(q.x), y: rounded(q.y), z: rounded(q.z), w: rounded(q.w) } };
    }) });
    capture(0);
    let quiet = 0, step = 0, settled = false, nudges = 0;
    for (step = 1; step <= MAX_STEPS; step++) {
      world.step();
      if (step >= 180 && step <= MAX_STEPS - 180 && (step - 180) % 120 === 0) {
        for (const { body } of bodies) {
          const p = body.translation();
          if (readFace(body.rotation()).alignment >= 0.98 && p.y < 0.6) continue;
          // Value-blind recovery: physical impulse, never rotate toward a desired face.
          const strength = step < 540 ? 1 : 1.6;
          body.applyImpulse({ x: -p.x * 0.12, y: 1.4 * strength, z: -p.z * 0.12 }, true);
          body.applyTorqueImpulse({ x: (random() - 0.5) * 0.3 * strength, y: (random() - 0.5) * 0.3 * strength, z: (random() - 0.5) * 0.3 * strength }, true);
          nudges++;
        }
      }
      if (step % 3 === 0) capture(step);
      const still = bodies.every(({ body }) => {
        const v = body.linvel(), w = body.angvel();
        const p = body.translation();
        return v.x ** 2 + v.y ** 2 + v.z ** 2 < 0.0025 && w.x ** 2 + w.y ** 2 + w.z ** 2 < 0.01
          && readFace(body.rotation()).alignment > 0.98 && Math.abs(p.x) < 4.8 && Math.abs(p.z) < 3.3 && p.y < 1;
      });
      quiet = still ? quiet + 1 : 0;
      if (quiet >= 20) { settled = true; break; }
    }
    step = Math.min(step, MAX_STEPS);
    if (frames.at(-1)?.step !== step) capture(step);
    return { seed: request.seed, engine: ENGINE, dt: DT, steps: step, frames,
      dice: bodies.map(({ id, body }) => ({ id, value: readFace(body.rotation()).value })), settled, nudges };
  } finally { world.free(); }
}
