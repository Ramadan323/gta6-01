// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (walk to a car and steal it, then drive toward a point, reversing when stuck),
// so the frame is what a short game really looks like and the same seed always gives the
// same frame.

import { CITY, STEP } from './config.js';
import { EVENT_BUSTED, EVENT_WASTED } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 18;
const CHASE_SECONDS = 30;
const MISSION_SECONDS = 40;
const END_LIMIT_SECONDS = 600;

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function nearestCar(state, sys) {
  let best = null;
  let bestDist = Infinity;
  for (const car of sys.traffic.parked) {
    if (!car.active) continue;
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  for (const car of sys.traffic.cars) {
    if (!car.active) continue;
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

function nearestPed(state, sys) {
  let best = null;
  let bestDist = Infinity;
  for (const ped of sys.traffic.peds) {
    if (!ped.active || ped.down > 0) continue;
    const d = Math.hypot(ped.x - state.player.x, ped.y - state.player.y);
    if (d < bestDist) {
      bestDist = d;
      best = ped;
    }
  }
  return best;
}

/**
 * A route through the city: breadth-first search over the intersection grid, from the
 * intersection nearest `from` to the one nearest `to`, then the target itself. Driving
 * intersection to intersection keeps the car on the roads instead of through buildings.
 */
function findPath(from, to) {
  function nearestIx(x, y) {
    let bi = 0;
    let bj = 0;
    let bd = Infinity;
    for (let i = 0; i < CITY.vStreets.length; i += 1) {
      for (let j = 0; j < CITY.hStreets.length; j += 1) {
        const d = Math.hypot(CITY.vStreets[i] - x, CITY.hStreets[j] - y);
        if (d < bd) {
          bd = d;
          bi = i;
          bj = j;
        }
      }
    }
    return { i: bi, j: bj };
  }
  const start = nearestIx(from.x, from.y);
  const goal = nearestIx(to.x, to.y);
  const key = (i, j) => i + ',' + j;
  const prev = new Map();
  const queue = [start];
  prev.set(key(start.i, start.j), null);
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.i === goal.i && cur.j === goal.j) break;
    const neighbours = [
      { i: cur.i - 1, j: cur.j },
      { i: cur.i + 1, j: cur.j },
      { i: cur.i, j: cur.j - 1 },
      { i: cur.i, j: cur.j + 1 },
    ];
    for (const n of neighbours) {
      if (n.i < 0 || n.i >= CITY.vStreets.length || n.j < 0 || n.j >= CITY.hStreets.length) continue;
      if (prev.has(key(n.i, n.j))) continue;
      prev.set(key(n.i, n.j), cur);
      queue.push(n);
    }
  }
  if (!prev.has(key(goal.i, goal.j))) return [to];
  const path = [];
  let cur = goal;
  while (cur) {
    path.unshift({ x: CITY.vStreets[cur.i], y: CITY.hStreets[cur.j] });
    cur = prev.get(key(cur.i, cur.j));
  }
  path.push(to);
  return path;
}

/**
 * One autopilot brain per scene: it keeps its own stuck/reverse timers and a route, and
 * returns the input for this step. `target` is a function returning the point to head for.
 */
function createPilot(state, sys, target) {
  let stuckTimer = 0;
  let reverseTimer = 0;
  let waypoints = [];
  let repathTimer = 0;
  let lastTarget = null;

  return function pilot(dt) {
    const player = state.player;
    const input = { axes: { x: 0, y: 0 }, enter: false, punch: false };
    if (!player.inCar) {
      const car = nearestCar(state, sys);
      if (!car) return input;
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < 50) {
        input.enter = true;
        return input;
      }
      input.axes = { x: car.x - player.x, y: car.y - player.y };
      return input;
    }
    const point = target();
    if (!point) return input;
    const car = state.myCar;
    // Recompute the route when the target moved far, the list ran out, or a second passed
    // (a moving target, like a pedestrian, needs a fresh route).
    repathTimer -= dt;
    const moved = !lastTarget || Math.hypot(point.x - lastTarget.x, point.y - lastTarget.y) > 120;
    if (waypoints.length === 0 || moved || repathTimer <= 0) {
      waypoints = findPath({ x: car.x, y: car.y }, point);
      lastTarget = { x: point.x, y: point.y };
      repathTimer = 1.0;
    }
    while (waypoints.length > 0 && Math.hypot(waypoints[0].x - car.x, waypoints[0].y - car.y) < 70) {
      waypoints.shift();
    }
    const wp = waypoints.length > 0 ? waypoints[0] : point;
    if (reverseTimer > 0) {
      reverseTimer -= dt;
      input.axes = { x: -1, y: 1 };
      return input;
    }
    const want = Math.atan2(wp.y - car.y, wp.x - car.x);
    const diff = normAngle(want - car.angle);
    const steer = diff > 0.2 ? 1 : diff < -0.2 ? -1 : 0;
    // Brake hard for a sharp turn until the car is slow, coast for a moderate one, so
    // the car turns tightly on the road instead of swinging onto the sidewalk and into
    // pedestrians. Cap the speed as well: a slower car turns tighter and survives.
    let gas = -1;
    if (Math.abs(diff) > 0.5 && Math.abs(car.speed) > 100) gas = 1;
    else if (Math.abs(car.speed) > 260) gas = 0;
    input.axes = { x: steer, y: gas };
    if (Math.abs(car.speed) < 25 && gas !== 0) {
      stuckTimer += dt;
      if (stuckTimer > 1.2) {
        reverseTimer = 0.9;
        stuckTimer = 0;
      }
    } else {
      stuckTimer = 0;
    }
    return input;
  };
}

function runSteps(world, sys, seconds, pilot, harmless) {
  let events = 0;
  for (let i = 0; i < seconds / STEP; i += 1) {
    const input = pilot ? pilot(STEP) : { axes: { x: 0, y: 0 }, enter: false, punch: false };
    events |= world.step(STEP, input, harmless);
    if (events & (EVENT_BUSTED | EVENT_WASTED)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the save to
 * show. `sys` is { traffic, police, missions }.
 */
export function stageShot(name, world, sys) {
  const state = world.state;
  world.reset();
  if (name !== 'play' && name !== 'chase' && name !== 'mission' && name !== 'end') {
    runSteps(world, sys, START_SECONDS, null, true);
    return { screen: SCREEN_TITLE, save: { bestCash: 0, missionsDone: 0, bestTime: 0, runs: 0 } };
  }
  if (name === 'play') {
    // Steal a car and cruise the city.
    const pilot = createPilot(state, sys, () => ({ x: 1920, y: 960 }));
    runSteps(world, sys, PLAY_SECONDS, pilot, false);
    return { screen: SCREEN_PLAY, save: { bestCash: 0, missionsDone: 0, bestTime: 0, runs: 0 } };
  }
  if (name === 'chase') {
    // Steal a car, run down pedestrians until the heat is on, then outrun the law.
    const pilot = createPilot(state, sys, () => {
      if (sys.police.wanted < 3) {
        const ped = nearestPed(state, sys);
        return ped ? { x: ped.x, y: ped.y } : { x: 1280, y: 960 };
      }
      return { x: 320, y: 320 };
    });
    runSteps(world, sys, CHASE_SECONDS, pilot, false);
    return { screen: SCREEN_PLAY, save: { bestCash: 0, missionsDone: 0, bestTime: 0, runs: 0 } };
  }
  if (name === 'mission') {
    // Finish the first job, then head for the package pickup of the second.
    const pilot = createPilot(state, sys, () => {
      const target = sys.missions.target();
      return target || { x: 640, y: 1280 };
    });
    runSteps(world, sys, MISSION_SECONDS, pilot, false);
    return { screen: SCREEN_PLAY, save: { bestCash: 0, missionsDone: 0, bestTime: 0, runs: 0 } };
  }
  // 'end': a reckless pilot that gets busted or wasted.
  const pilot = createPilot(state, sys, () => {
    const ped = nearestPed(state, sys);
    return ped ? { x: ped.x, y: ped.y } : { x: 1280, y: 960 };
  });
  runSteps(world, sys, END_LIMIT_SECONDS, pilot, false);
  const over = state.over !== null;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, save: { bestCash: state.cash, missionsDone: sys.missions.index, bestTime: 0, runs: 0 } };
}
