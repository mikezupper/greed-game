# Physics and playback

The physics module creates a symmetric rounded-cube collider for each active die,
a floor and four walls. It uses gravity, friction, restitution, linear/angular damping,
continuous collision detection and a fixed 1/60-second timestep. Initial orientations
are sampled uniformly over SO(3); a versioned seeded generator supplies launch values.
Live seeds originate from crypto in the local runtime or server.

A die is settled when linear and angular velocity are low, its upward face aligns
above 0.98, and it is within the tray on the floor. All dice must meet these conditions
for 20 consecutive steps. The `rapier-0.21.0/launch-3` model runs for at most 1,800 steps.
From step 180 through 1,620, unresolved dice receive upward/inward impulses and random
torque every 120 steps, with stronger impulses after step 540. Recovery stays in the
same world with the original seed. It is independent of displayed face values, appears
in recorded motion and never rotates a die toward a selected value.

The initial prototype left cocked dice in 18% of six-dice throws. The recovery pass is
measured in [the validation report](validation.md): both current 6,000-throw samples
settled every throw. A still-unresolved simulation returns `settled: false`; the runtime
retains the original pending launch and pauses the match. Retry uses that same launch,
including after a worker failure or server restart. An explicit host reset abandons the
stalled match. The runtime never conditionally samples a fresh outcome.

Record motion every three steps (20 Hz), plus exact start/end steps. Positions and
quaternions are rounded to four decimal places for transmission. Final face values are
read from the unrounded physics quaternion. Three.js interpolates positions and normalized
quaternions and caps visible playback at four seconds. Opposite faces sum to seven;
face normals are shared by drawing and reading. Kept dice remain on a separate shelf,
with canonical face orientations after reload.

The authoritative recording eliminates browser-to-browser physics drift online.
Replaying a seed locally is useful for debugging on the same engine and runtime, but
cross-platform identical launch math is not claimed: JavaScript transcendental functions
can vary. Persist trajectories for user-visible replay. See the official
[Rapier determinism guide](https://rapier.rs/docs/user_guides/javascript/determinism/).

Rapier's compatibility build embeds WASM, making the first local worker large. It is
loaded on first local roll only; online play does not download it. Built assets have
Brotli/gzip variants. Local Chromium worker startup is measured in the UI report;
real mobile hardware and slow-network checks remain release gates. Split the WASM asset
if those measurements show unacceptable startup cost.
