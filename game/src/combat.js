// Combat on foot: a punch. Short range, a short arc in front of the player, a cooldown so
// it cannot be spammed. It knocks a pedestrian down (they drop a few dollars and run when
// they get up) and it draws the law. It does nothing to cars.

import { PLAYER, WANTED } from './config.js';

export function createCombat() {
  let cooldown = 0;

  function step(dt) {
    if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);
  }

  /**
   * Swing. Returns the pedestrian hit, or null. `peds` is the traffic pedestrian list;
   * `player` is {x, y, angle}. Only pedestrians in range and inside the arc count.
   */
  function punch(player, peds) {
    if (cooldown > 0) return null;
    cooldown = PLAYER.punchCooldown;
    let best = null;
    let bestDist = PLAYER.punchRange;
    for (const ped of peds) {
      if (!ped.active || ped.down > 0) continue;
      const dx = ped.x - player.x;
      const dy = ped.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > PLAYER.punchRange + 10) continue;
      let diff = Math.atan2(dy, dx) - player.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > PLAYER.punchArc) continue;
      if (dist < bestDist) {
        bestDist = dist;
        best = ped;
      }
    }
    return best;
  }

  function reset() {
    cooldown = 0;
  }

  return { step, punch, reset, wantedForPunch: WANTED.punch };
}
