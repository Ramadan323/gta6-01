// The city of Solmar: a grid of streets with sidewalks and buildings, a park, and a beach
// along the south edge. Everything is derived from the seed, so the same seed builds the
// same city. The helpers answer the questions the traffic, the pedestrians and the player
// ask every step: is this point a road, a sidewalk, inside a building, in the water?

import { CITY, WORLD } from './config.js';
import { pick, range } from './random.js';

const ROOFS = ['#b08968', '#7d8aa0', '#a08a7d', '#8a9a7d', '#9a7d8a', '#c2a878'];

export function createCity(random) {
  const buildings = [];
  const parks = [];
  // One building (or a park) per block, inset from the street edge.
  for (let vi = 0; vi < CITY.vStreets.length - 1; vi += 1) {
    for (let hi = 0; hi < CITY.hStreets.length - 1; hi += 1) {
      const x0 = CITY.vStreets[vi] + CITY.walkHalf + 14;
      const x1 = CITY.vStreets[vi + 1] - CITY.walkHalf - 14;
      const y0 = CITY.hStreets[hi] + CITY.walkHalf + 14;
      const y1 = CITY.hStreets[hi + 1] - CITY.walkHalf - 14;
      if (random() < 0.18) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const w = range(random, (x1 - x0) * 0.45, (x1 - x0) * 0.8);
      const h = range(random, (y1 - y0) * 0.45, (y1 - y0) * 0.8);
      const x = x0 + range(random, 0, x1 - x0 - w);
      const y = y0 + range(random, 0, y1 - y0 - h);
      buildings.push({ x, y, w, h, roof: pick(random, ROOFS) });
    }
  }
  // The strip below the last street is beach, then water; no buildings there.
  const garage = { x: 1920 - 24, y: 960 - 24, w: 48, h: 48 };
  const safehouse = { x: 320 - 24, y: 320 - 24, w: 48, h: 48 };

  function onRoad(x, y) {
    for (const sx of CITY.vStreets) if (Math.abs(x - sx) <= CITY.roadHalf) return true;
    for (const sy of CITY.hStreets) if (Math.abs(y - sy) <= CITY.roadHalf) return true;
    return false;
  }

  function onSidewalk(x, y) {
    for (const sx of CITY.vStreets) {
      if (Math.abs(x - sx) <= CITY.walkHalf && y >= 0 && y <= CITY.hStreets[CITY.hStreets.length - 1] + CITY.walkHalf) return true;
    }
    for (const sy of CITY.hStreets) {
      if (Math.abs(y - sy) <= CITY.walkHalf && x >= 0 && x <= CITY.vStreets[CITY.vStreets.length - 1] + CITY.walkHalf) return true;
    }
    return false;
  }

  function inWater(x, y) {
    return y >= CITY.waterTop;
  }

  function blocked(x, y, radius) {
    if (x < radius || y < radius || x > WORLD.width - radius || y > WORLD.height - radius) return true;
    if (inWater(x, y)) return true;
    for (const b of buildings) {
      if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return true;
    }
    return false;
  }

  /** A point on a road, picked at random: where traffic and police spawn. */
  function randomRoadPoint() {
    if (random() < 0.5) {
      const sx = pick(random, CITY.vStreets);
      return { x: sx + (random() < 0.5 ? -24 : 24), y: range(random, 40, WORLD.height - 200) };
    }
    const sy = pick(random, CITY.hStreets);
    return { x: range(random, 40, WORLD.width - 40), y: sy + (random() < 0.5 ? -24 : 24) };
  }

  /** A point on a sidewalk, picked at random: where pedestrians walk. */
  function randomSidewalkPoint() {
    if (random() < 0.5) {
      const sx = pick(random, CITY.vStreets);
      return { x: sx + (random() < 0.5 ? -56 : 56), y: range(random, 40, WORLD.height - 200) };
    }
    const sy = pick(random, CITY.hStreets);
    return { x: range(random, 40, WORLD.width - 40), y: sy + (random() < 0.5 ? -56 : 56) };
  }

  /** The nearest street intersection to a point. */
  function nearestIntersection(x, y) {
    let bx = CITY.vStreets[0];
    let by = CITY.hStreets[0];
    for (const sx of CITY.vStreets) if (Math.abs(sx - x) < Math.abs(bx - x)) bx = sx;
    for (const sy of CITY.hStreets) if (Math.abs(sy - y) < Math.abs(by - y)) by = sy;
    return { x: bx, y: by };
  }

  return {
    buildings,
    parks,
    garage,
    safehouse,
    onRoad,
    onSidewalk,
    inWater,
    blocked,
    randomRoadPoint,
    randomSidewalkPoint,
    nearestIntersection,
  };
}
