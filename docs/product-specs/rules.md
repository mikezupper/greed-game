# Greed rules

The supplied [rulebook](../references/original-game-rules.md) is the starting source.
This document records the intended product rules and the explicit variants adopted
while scaffolding. Do not silently replace them with another Farkle variant.

## Implemented turn rules

- Six d6, 2–8 players, clockwise turns.
- After a roll, select at least one scoring die or combination. Every selected die must score.
- Commit one selection from that roll, then bank or roll the remainder. A selection may
  leave scoring dice behind; combining dice from different rolls is forbidden.
- A roll with no scoring subset is a bust. Lose all unbanked points and pass the turn.
- Scoring all six dice gives hot dice; bank or roll all six while retaining turn points.
- A player with no banked score needs 500 in one turn to bank. Afterwards any scoring turn may bank.

| Selection | Points |
| --- | --- |
| Single 1 / 5 | 100 / 50 |
| Three 1s | 1,000 |
| Three 2s–6s | face × 100 |
| Four / five / six of a kind | 1,000 / 2,000 / 3,000 |
| Six-dice straight | 1,500 |
| Three distinct pairs | 1,500 |
| Two distinct triplets | 2,500 |

Whole-selection six-dice patterns take precedence. Otherwise each face count forms
one group. In particular, selecting four ones scores **1,000**, not a triplet plus a
single for 1,100. Selecting only three is legal. A Keep action ends selection for that
roll, so the fourth one cannot subsequently be committed from the same roll.

## Match and room rules

Before the first turn, each player rolls one die; the highest starts, with tied leaders
rerolling. When a player banks at least 10,000, each other player gets exactly one final
turn. Compare scores after those turns. Tied leaders enter sudden-death rounds with
equal turns; decide the winner after a complete round, never midway through one.

Online room defaults: guests, invite links, ready lobby, host starts, late arrivals
spectate, returning players reclaim their seats. The optional decision clock defaults
to 60 seconds when enabled. After a 30-second disconnect grace period, timeout policy
banks committed points when legal; otherwise forfeits the unbanked turn. These policies
are enforced by the room server. Ready/start and rematch are host actions; all seated
players must be connected and ready to start. Explicit leave removes a lobby seat;
during a match it ends that turn under the same bank-or-forfeit policy and retains the
seat for reconnect/rematch.
The most recently connected tab controls a seat; older tabs receive a replacement notice.
An abandoned room expires after 24 hours; an empty live room is unloaded after five minutes.

Physics recovery keeps the original seed and simulation; failed infrastructure retries
the saved launch rather than sampling a new outcome. Dice playback lasts at most four
seconds, with decisions disabled until it ends. The decision clock starts after playback.

## Strategy accuracy

The supplied strategy prose reverses the one- and two-dice bust percentages. Correct
independent fair-dice probabilities under these rules are 66.667%, 44.444%, 27.778%,
15.741%, 7.716%, and 2.315% for 1–6 dice. Derive hints from the engine. These probabilities
assume fair independent faces; physical simulation still needs statistical validation.
