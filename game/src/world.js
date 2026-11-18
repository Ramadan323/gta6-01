// The game's rules and state, with no drawing and no browser in it: the player on foot or
// in a car, car physics, collisions, crimes and the wanted level, cash, health, pickups and
// the mission flow. step() advances one fixed step and returns what happened as bit flags,
// so the caller can react without the world knowing about screens or sound.

import { CAR, CITY, PLAYER, POLICE, WANTED, WORLD } from './config.js';

export const EVENT_CRASH = 1;
export const EVENT_HIT = 2;
export const EVENT_PICKUP = 4;
export const EVENT_MISSION = 8;
export const EVENT_STEP = 16;
export const EVENT_BUSTED = 32;
export const EVENT_WASTED = 64;
export const EVENT_STEAL = 128;
export const EVENT_PUNCH = 256;

const STEAL_DIST = 64;
const PICKUP_DIST = 34;
const CAR_HIT_DIST = 30;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function createWorld(random, deps) {
  const { city, traffic, police, missions, combat } = deps;
  const player = { x: 0, y: 0, angle: -Math.PI / 2, health: PLAYER.health, invulnerable: 0, inCar: false, speed: 0 };
  const myCar = { active: false, x: 0, y: 0, angle: 0, speed: 0, health: CAR.health, color: '#e5534b' };
  const pickups = [];
  for (let i = 0; i < 12; i += 1) pickups.push({ active: false, x: 0, y: 0, value: 0, kind: 'cash' });
  const state = {
    player,
    myCar,
    pickups,
    packageCarried: false,
    cash: 0,
    elapsed: 0,
    shake: 0,
    ramCooldown: 0,
    wallCooldown: 0,
    trafficCooldown: 0,
    trafficHitCooldown: 0,
    toast: '',
    toastTimer: 0,
    missionId: null,
    over: null,
  };

  function reset() {
    player.x = 1280;
    player.y = 960;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.health;
    player.invulnerable = 0;
    player.inCar = false;
    player.speed = 0;
    myCar.active = false;
    myCar.health = CAR.health;
    myCar.speed = 0;
    for (const p of pickups) p.active = false;
    state.packageCarried = false;
    state.cash = 0;
    state.elapsed = 0;
    state.shake = 0;
    state.ramCooldown = 0;
    state.wallCooldown = 0;
    state.trafficCooldown = 0;
    state.trafficHitCooldown = 0;
    state.toast = '';
    state.toastTimer = 0;
    state.missionId = null;
    state.over = null;
    traffic.reset();
    police.reset();
    missions.reset();
    combat.reset();
    state.missionId = missions.current() ? missions.current().id : null;
  }

  function freePickup() {
    for (const p of pickups) if (!p.active) return p;
    return null;
  }

  function dropCash(x, y, value) {
    const p = freePickup();
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.value = value;
    p.kind = 'cash';
  }

  function spawnPackage(x, y) {
    const p = freePickup();
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.value = 0;
    p.kind = 'package';
  }

  function setToast(text, seconds) {
    state.toast = text;
    state.toastTimer = seconds;
  }

  function nearestStealable() {
    let best = null;
    let bestDist = STEAL_DIST;
    for (const car of traffic.parked) {
      if (!car.active) continue;
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < bestDist) {
        bestDist = d;
        best = { car, kind: 'parked' };
      }
    }
    for (const car of traffic.cars) {
      if (!car.active) continue;
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < bestDist) {
        bestDist = d;
        best = { car, kind: 'traffic' };
      }
    }
    return best;
  }

  function enterCar(found) {
    myCar.active = true;
    myCar.x = found.car.x;
    myCar.y = found.car.y;
    myCar.angle = found.car.angle;
    myCar.speed = 0;
    myCar.health = CAR.health;
    myCar.color = found.car.color;
    found.car.active = false;
    player.inCar = true;
    player.x = myCar.x;
    player.y = myCar.y;
    player.angle = myCar.angle;
    police.addWanted(WANTED.steal);
  }

  function exitCar() {
    player.inCar = false;
    player.x = myCar.x + Math.cos(myCar.angle + Math.PI / 2) * 34;
    player.y = myCar.y + Math.sin(myCar.angle + Math.PI / 2) * 34;
    player.angle = myCar.angle;
    // The car stays where it is, parked at the curb of the player's life.
    const spot = traffic.parked.find((c) => !c.active);
    if (spot) {
      spot.active = true;
      spot.x = myCar.x;
      spot.y = myCar.y;
      spot.angle = myCar.angle;
      spot.color = myCar.color;
    }
    myCar.active = false;
    myCar.speed = 0;
  }

  function wreckCar() {
    myCar.active = false;
    myCar.speed = 0;
    player.inCar = false;
    player.x = myCar.x + Math.cos(myCar.angle + Math.PI / 2) * 34;
    player.y = myCar.y + Math.sin(myCar.angle + Math.PI / 2) * 34;
    player.angle = myCar.angle;
    state.shake = 0.5;
  }

  function stepCar(dt, axes) {
    const forward = -axes.y; // W/up is forward.
    const steer = axes.x;
    if (forward > 0) myCar.speed += CAR.accel * dt;
    else if (forward < 0) {
      if (myCar.speed > 30) myCar.speed -= CAR.brake * dt;
      else myCar.speed -= CAR.reverseAccel * dt;
    }
    // Drag always pulls toward still.
    myCar.speed -= myCar.speed * CAR.drag * dt;
    myCar.speed = clamp(myCar.speed, -CAR.maxReverse, CAR.maxSpeed);
    // Steering: most effective at moderate speed, but a slow car can still turn
    // tightly (a real car's low-speed turn), so the factor never drops below 0.45.
    const speedRatio = clamp(myCar.speed / CAR.maxSpeed, -1, 1);
    const steerFactor = myCar.speed === 0 ? 0 : Math.max(0.45, Math.abs(speedRatio)) * Math.sign(speedRatio);
    myCar.angle += steer * CAR.steer * steerFactor * dt;
    const nx = myCar.x + Math.cos(myCar.angle) * myCar.speed * dt;
    const ny = myCar.y + Math.sin(myCar.angle) * myCar.speed * dt;
    // Buildings stop the car: check the nose and the tail.
    const noseX = nx + Math.cos(myCar.angle) * (CAR.length / 2);
    const noseY = ny + Math.sin(myCar.angle) * (CAR.length / 2);
    const tailX = nx - Math.cos(myCar.angle) * (CAR.length / 2);
    const tailY = ny - Math.sin(myCar.angle) * (CAR.length / 2);
    if (city.blocked(noseX, noseY, 8) || city.blocked(tailX, tailY, 8) || city.inWater(noseX, noseY)) {
      // A car wedged against a wall would otherwise take damage every frame; the
      // cooldown makes one scrape cost one hit.
      if (Math.abs(myCar.speed) > 120 && state.wallCooldown <= 0) {
        myCar.health -= 5;
        state.shake = Math.max(state.shake, 0.3);
        state.wallCooldown = 0.5;
        return true;
      }
      myCar.speed *= -0.25;
      return false;
    }
    myCar.x = nx;
    myCar.y = ny;
    player.x = myCar.x;
    player.y = myCar.y;
    player.angle = myCar.angle;
    player.speed = myCar.speed;
    return false;
  }

  function stepFoot(dt, axes) {
    const len = Math.hypot(axes.x, axes.y);
    if (len > 0) {
      const nx = axes.x / len;
      const ny = axes.y / len;
      player.angle = Math.atan2(ny, nx);
      const tx = player.x + nx * PLAYER.walkSpeed * dt;
      const ty = player.y + ny * PLAYER.walkSpeed * dt;
      // Move one axis at a time so the player slides along walls.
      if (!city.blocked(tx, player.y, PLAYER.radius)) player.x = tx;
      if (!city.blocked(player.x, ty, PLAYER.radius)) player.y = ty;
      player.x = clamp(player.x, PLAYER.radius, WORLD.width - PLAYER.radius);
      player.y = clamp(player.y, PLAYER.radius, WORLD.height - PLAYER.radius);
    }
    player.speed = len > 0 ? PLAYER.walkSpeed : 0;
  }

  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
    if (state.toastTimer > 0) state.toastTimer -= dt;
    if (state.ramCooldown > 0) state.ramCooldown -= dt;
    if (state.wallCooldown > 0) state.wallCooldown -= dt;
    if (state.trafficCooldown > 0) state.trafficCooldown -= dt;
    if (state.trafficHitCooldown > 0) state.trafficHitCooldown -= dt;
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    combat.step(dt);

    traffic.step(dt);
    const policeInfo = police.step(dt, player, player.inCar, player.inCar ? myCar.speed : 0);

    if (harmless) return events;

    // The package appears while its step is current.
    const mission = missions.current();
    const step = missions.currentStep();
    if (mission && mission.id === 'package' && step && step.type === 'pickup' && !state.packageCarried) {
      const hasPackage = pickups.some((p) => p.active && p.kind === 'package');
      if (!hasPackage) spawnPackage(step.x, step.y);
    }
    // A new job starting: the heat job goes loud at once.
    if (mission && mission.id !== state.missionId) {
      state.missionId = mission.id;
      if (mission.id === 'heat') police.setWanted(3);
    }

    if (player.inCar) {
      if (stepCar(dt, input.axes)) events |= EVENT_CRASH;
    } else stepFoot(dt, input.axes);

    // Enter / exit a car.
    if (input.enter) {
      if (player.inCar) {
        exitCar();
      } else {
        const found = nearestStealable();
        if (found) {
          enterCar(found);
          events |= EVENT_STEAL;
        }
      }
    }

    // Punch on foot.
    if (input.punch && !player.inCar) {
      const hit = combat.punch(player, traffic.peds);
      if (hit) {
        traffic.knockDown(hit);
        dropCash(hit.x, hit.y, 10 + Math.floor(random() * 16));
        police.addWanted(combat.wantedForPunch);
        events |= EVENT_PUNCH;
      }
    }

    // Pickups: cash and the package.
    for (const p of pickups) {
      if (!p.active) continue;
      if (Math.hypot(p.x - player.x, p.y - player.y) < PICKUP_DIST) {
        p.active = false;
        if (p.kind === 'package') {
          state.packageCarried = true;
        } else {
          state.cash += p.value;
        }
        events |= EVENT_PICKUP;
      }
    }

    // Car vs traffic, pedestrians and police.
    if (player.inCar) {
      for (const car of traffic.cars) {
        if (!car.active) continue;
        const d = Math.hypot(car.x - myCar.x, car.y - myCar.y);
        if (d < CAR_HIT_DIST + 14) {
          if (state.trafficCooldown <= 0) {
            myCar.health -= 4;
            state.trafficCooldown = 0.5;
          }
          myCar.speed *= 0.5;
          state.shake = Math.max(state.shake, 0.25);
          events |= EVENT_CRASH;
          // Shove the traffic car aside so the two do not stick.
          car.x += (car.x - myCar.x) * 0.4;
          car.y += (car.y - myCar.y) * 0.4;
        }
      }
      for (const ped of traffic.peds) {
        if (!ped.active || ped.down > 0) continue;
        if (Math.hypot(ped.x - myCar.x, ped.y - myCar.y) < CAR_HIT_DIST) {
          traffic.knockDown(ped);
          police.addWanted(WANTED.hitPed);
          myCar.speed *= 0.85;
          state.shake = Math.max(state.shake, 0.2);
          events |= EVENT_CRASH;
        }
      }
      for (const car of police.cars) {
        if (!car.active) continue;
        if (Math.hypot(car.x - myCar.x, car.y - myCar.y) < CAR_HIT_DIST + 10) {
          // One ram costs one hit: without the cooldown a police car resting
          // against the player's car would drain it in a second.
          if (state.ramCooldown <= 0) {
            myCar.health -= POLICE.ramDamage;
            police.addWanted(WANTED.hitPolice);
            state.ramCooldown = 0.8;
          }
          myCar.speed *= 0.6;
          state.shake = Math.max(state.shake, 0.35);
          events |= EVENT_CRASH;
        }
      }
      if (myCar.health <= 0) {
        wreckCar();
        events |= EVENT_CRASH;
        setToast('Your ride is wrecked', 2.5);
      }
    } else {
      // On foot: traffic can run the player over; police can bust them.
      for (const car of traffic.cars) {
        if (!car.active) continue;
        if (Math.hypot(car.x - player.x, car.y - player.y) < CAR_HIT_DIST && player.invulnerable === 0 && state.trafficHitCooldown <= 0) {
          player.health -= 15;
          player.invulnerable = PLAYER.invulnerable;
          state.trafficHitCooldown = 1.0;
          state.shake = Math.max(state.shake, 0.3);
          events |= EVENT_HIT;
        }
      }
      const bust = police.bustProgress(dt, player, player.inCar);
      if (bust >= 1) {
        state.over = 'busted';
        events |= EVENT_BUSTED;
        return events;
      }
    }

    if (player.health <= 0) {
      state.over = 'wasted';
      events |= EVENT_WASTED;
      return events;
    }

    // Missions.
    const result = missions.check({ hasCar: player.inCar, x: player.x, y: player.y, wanted: police.wanted });
    if (result === 'step') {
      events |= EVENT_STEP;
    } else if (result === 'mission' || result === 'all') {
      const finished = missions.lastMission();
      if (finished) {
        state.cash += finished.reward;
        setToast(`${finished.title} done — $${finished.reward}`, 3);
      }
      events |= EVENT_MISSION;
      if (result === 'all') setToast('Every job in Solmar is done — free roam', 4);
    }

    return events;
  }

  reset();
  return { state, reset, step, dropCash, setToast };
}
