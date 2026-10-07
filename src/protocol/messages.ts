import { z } from 'zod';

export const Name = z.string().trim().min(1).max(24);
export const RoomCode = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/);
const Ids = z.array(z.number().int().min(0).max(5)).min(1).max(6).refine(ids => new Set(ids).size === ids.length).readonly();
export const MoveSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('Roll') }), z.strictObject({ type: z.literal('Keep'), ids: Ids }),
  z.strictObject({ type: z.literal('Bank') }), z.strictObject({ type: z.literal('Next') }),
  z.strictObject({ type: z.literal('Start') }), z.strictObject({ type: z.literal('Rematch') }),
  z.strictObject({ type: z.literal('Ready'), ready: z.boolean() }), z.strictObject({ type: z.literal('Clock'), enabled: z.boolean() }),
  z.strictObject({ type: z.literal('Leave') }), z.strictObject({ type: z.literal('Retry') }),
]);
export const ClientMessage = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('Join'), room: RoomCode, name: Name, token: z.string().min(20).max(64).optional() }),
  z.strictObject({ type: z.literal('Act'), id: z.string().uuid(), revision: z.number().int().nonnegative(), move: MoveSchema }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;
const Vec3 = z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() });
const Quat = Vec3.extend({ w: z.number().finite() });
const Die = z.object({ id: z.number().int().min(0).max(5), value: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]) });
export const RollSchema = z.object({
  seed: z.number().int().nonnegative(), engine: z.string(), dt: z.number().positive(), steps: z.number().int().min(0).max(1800),
  frames: z.array(z.object({ step: z.number().int().nonnegative(), poses: z.array(z.object({ id: z.number().int(), position: Vec3, rotation: Quat })).max(6).readonly() })).max(602).readonly(),
  dice: z.array(Die).max(6).readonly(), settled: z.boolean(), nudges: z.number().int().nonnegative(),
});
export const TableSchema = z.object({
  players: z.array(z.object({ id: z.string(), name: Name, score: z.number().int().nonnegative() })).max(8).readonly(),
  active: z.number().int().min(0).max(7), turn: z.number().int().positive(),
  phase: z.enum(['ready', 'rolling', 'choosing', 'kept', 'bust']), started: z.boolean(), turnScore: z.number().int().nonnegative(),
  remaining: z.array(z.number().int().min(0).max(5)).max(6).readonly(), dice: z.array(Die).max(6).readonly(), kept: z.array(Die).max(6).readonly(), notice: z.string(),
  match: z.object({ stage: z.enum(['lobby', 'opening', 'playing', 'final', 'tiebreak', 'finished']), target: z.number().int().positive(),
    queue: z.array(z.number().int().min(0).max(7)).readonly(), contenders: z.array(z.number().int().min(0).max(7)).readonly(),
    opening: z.array(z.object({ player: z.number().int(), value: z.number().int() })).readonly(), winners: z.array(z.string()).readonly(), round: z.number().int() }),
});
export const LobbySchema = z.object({ host: z.string().nullable(), ready: z.array(z.string()).readonly(), clockSeconds: z.union([z.literal(0), z.literal(60)]),
  deadline: z.number().nullable(), playbackUntil: z.number(), paused: z.boolean(), departed: z.array(z.string()).readonly() });
export const emptyLobby = () => ({ host: null, ready: [], clockSeconds: 0, deadline: null, playbackUntil: 0, paused: false, departed: [] } as z.infer<typeof LobbySchema>);
export const RoomView = z.object({ code: RoomCode, revision: z.number().int().nonnegative(), table: TableSchema,
  online: z.array(z.string()).readonly(), roll: RollSchema.nullable(), lobby: LobbySchema });
export type RoomView = z.infer<typeof RoomView>;
export const ServerMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Welcome'), playerId: z.string().nullable(), token: z.string().nullable() }),
  z.object({ type: z.literal('Snapshot'), view: RoomView, serverTime: z.number().optional() }),
  z.object({ type: z.literal('Rejected'), id: z.string().optional(), message: z.string() }),
  z.object({ type: z.literal('Ack'), id: z.string(), revision: z.number().int() }),
  z.object({ type: z.literal('Replaced') }), z.object({ type: z.literal('Left') }),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;
