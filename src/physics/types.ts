import type { Face } from '../game/scoring.ts';

export interface Vec3 { readonly x: number; readonly y: number; readonly z: number }
export interface Quat extends Vec3 { readonly w: number }
export interface Pose { readonly id: number; readonly position: Vec3; readonly rotation: Quat }
export interface Frame { readonly step: number; readonly poses: readonly Pose[] }
export interface RollRequest { readonly seed: number; readonly ids: readonly number[] }
export interface Roll {
  readonly seed: number;
  readonly engine: string;
  readonly dt: number;
  readonly steps: number;
  readonly frames: readonly Frame[];
  readonly dice: readonly { readonly id: number; readonly value: Face }[];
  readonly settled: boolean;
  readonly nudges: number;
}
export const FACE_NORMALS: readonly { readonly value: Face; readonly normal: Vec3 }[] = [
  { value: 1, normal: { x: 0, y: 1, z: 0 } }, { value: 6, normal: { x: 0, y: -1, z: 0 } },
  { value: 2, normal: { x: 1, y: 0, z: 0 } }, { value: 5, normal: { x: -1, y: 0, z: 0 } },
  { value: 3, normal: { x: 0, y: 0, z: 1 } }, { value: 4, normal: { x: 0, y: 0, z: -1 } },
];
