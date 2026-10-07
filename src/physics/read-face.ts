import { FACE_NORMALS, type Quat } from './types.ts';
import type { Face } from '../game/scoring.ts';

/** Rotate local face normals by the body quaternion and compare with world up. */
export function readFace(q: Quat): { readonly value: Face; readonly alignment: number } {
  let best: { value: Face; alignment: number } = { value: 1, alignment: -1 };
  for (const { value, normal: n } of FACE_NORMALS) {
    const y = 2 * (q.x * q.y + q.w * q.z) * n.x
      + (1 - 2 * (q.x * q.x + q.z * q.z)) * n.y
      + 2 * (q.y * q.z - q.w * q.x) * n.z;
    if (y > best.alignment) best = { value, alignment: y };
  }
  return best;
}
