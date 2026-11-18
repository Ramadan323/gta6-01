// Traffic and pedestrians. Traffic cars drive on the roads in lanes, turn at intersections,
// and slow down for the car ahead. Pedestrians walk the sidewalks and turn at corners.
// Parked cars sit at the curb and can be stolen. None of this draws anything.

import { CAR, CITY, PARKED, PEDS, TRAFFIC, WORLD } from './config.js';
import { pick, range } from './random.js';

const CAR_COLORS = ['#4fc3f7', '#f2c94c', '#e8e4d8', '#7ee787', '#e5534b', '#c98ad6', '#f2a35e'];
const PED_COLORS = ['#e8e4d8', '#f2c94c', '#7ee787', '#c98ad6', '#f2a35e', '#e5534b'];

function carAhead(cars, self) {
  let best = null;
  for (const other of cars) {
    if (other === self || !other.active || other.axis !== self.axis || other.dir !== self.dir) continue;
    if (Math.abs(other.lane - self.lane) > 20) continue;
    // Distance ahead in the direction of travel, whatever way the car faces.
    const along = self.axis === 'x' ? (other.x - self.x) * self.dir : (other.y - self.y) * self.dir;
    if (along > 0 && along < TRAFFIC.followGap && (best === null || along < best)) best = along;
  }
  return best;
}

export function createTraffic(city, random) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    cars.push({ active: true, x: 0, y: 0, angle: 0, axis: 'x', dir: 1, lane: 0, speed: 0, color: pick(random, CAR_COLORS), parked: false });
  }
  const parked = [];
  for (let i = 0; i < PARKED.count; i += 1) {
    parked.push({ active: true, x: 0, y: 0, angle: 0, color: pick(random, CAR_COLORS) });
  }
  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    peds.push({ active: true, x: 0, y: 0, angle: 0, axis: 'x', dir: 1, side: 1, speed: 0, color: pick(random, PED_COLORS), down: 0, flee: 0 });
  }

  function placeCar(car) {
    const p = city.randomRoadPoint();
    car.x = p.x;
    car.y = p.y;
    // Drive along the street the point sits on, in the right-hand lane.
    const onV = CITY.vStreets.some((sx) => Math.abs(p.x - sx) <= CITY.roadHalf);
    if (onV) {
      car.axis = 'y';
      car.dir = p.x < nearestV(p.x) ? 1 : -1;
      car.lane = p.x;
      car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.axis = 'x';
      car.dir = p.y < nearestH(p.y) ? -1 : 1;
      car.lane = p.y;
      car.angle = car.dir === 1 ? 0 : Math.PI;
    }
    car.speed = TRAFFIC.speed + range(random, -TRAFFIC.speedJitter, TRAFFIC.speedJitter);
  }

  function nearestV(x) {
    let best = CITY.vStreets[0];
    for (const sx of CITY.vStreets) if (Math.abs(sx - x) < Math.abs(best - x)) best = sx;
    return best;
  }

  function nearestH(y) {
    let best = CITY.hStreets[0];
    for (const sy of CITY.hStreets) if (Math.abs(sy - y) < Math.abs(best - y)) best = sy;
    return best;
  }

  function placeParked(car) {
    const vertical = random() < 0.5;
    if (vertical) {
      const sx = pick(random, CITY.vStreets);
      car.x = sx + (random() < 0.5 ? -40 : 40);
      car.y = range(random, 120, WORLD.height - 240);
      car.angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const sy = pick(random, CITY.hStreets);
      car.x = range(random, 120, WORLD.width - 120);
      car.y = sy + (random() < 0.5 ? -40 : 40);
      car.angle = random() < 0.5 ? 0 : Math.PI;
    }
    car.color = pick(random, CAR_COLORS);
  }

  function placePed(ped) {
    const p = city.randomSidewalkPoint();
    ped.x = p.x;
    ped.y = p.y;
    const onV = CITY.vStreets.some((sx) => Math.abs(p.x - sx) <= CITY.walkHalf);
    if (onV) {
      ped.axis = 'y';
      ped.side = p.x < nearestV(p.x) ? -1 : 1;
      ped.dir = random() < 0.5 ? 1 : -1;
      ped.angle = ped.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      ped.axis = 'x';
      ped.side = p.y < nearestH(p.y) ? -1 : 1;
      ped.dir = random() < 0.5 ? 1 : -1;
      ped.angle = ped.dir === 1 ? 0 : Math.PI;
    }
    ped.speed = PEDS.speed + range(random, -PEDS.speedJitter, PEDS.speedJitter);
    ped.down = 0;
    ped.flee = 0;
  }

  function reset() {
    for (const car of cars) placeCar(car);
    for (const car of parked) placeParked(car);
    for (const ped of peds) placePed(ped);
  }

  function stepCar(car, dt) {
    if (!car.active) return;
    // Slow for the car ahead in the same lane.
    const ahead = carAhead(cars, car);
    const target = ahead === null ? car.speed : Math.max(0, car.speed - (TRAFFIC.followGap - ahead) * 2);
    const v = target;
    if (car.axis === 'x') car.x += car.dir * v * dt;
    else car.y += car.dir * v * dt;
    // Off the map: respawn on the opposite side.
    if (car.x < -60 || car.x > WORLD.width + 60 || car.y < -60 || car.y > WORLD.height + 60) {
      placeCar(car);
      return;
    }
    // At an intersection, sometimes turn onto the crossing street.
    const atV = CITY.vStreets.some((sx) => Math.abs(car.x - sx) < 6);
    const atH = CITY.hStreets.some((sy) => Math.abs(car.y - sy) < 6);
    if (atV && atH && random() < TRAFFIC.turnChance * dt * 10) {
      if (car.axis === 'x') {
        const sx = nearestV(car.x);
        car.axis = 'y';
        car.dir = random() < 0.5 ? 1 : -1;
        car.lane = sx + (car.dir === 1 ? -24 : 24);
        car.x = car.lane;
        car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        const sy = nearestH(car.y);
        car.axis = 'x';
        car.dir = random() < 0.5 ? 1 : -1;
        car.lane = sy + (car.dir === 1 ? 24 : -24);
        car.y = car.lane;
        car.angle = car.dir === 1 ? 0 : Math.PI;
      }
    }
  }

  function stepPed(ped, dt) {
    if (!ped.active) return;
    if (ped.down > 0) {
      ped.down -= dt;
      return;
    }
    const speed = ped.flee > 0 ? ped.speed * 2.2 : ped.speed;
    if (ped.flee > 0) ped.flee -= dt;
    if (ped.axis === 'x') ped.x += ped.dir * speed * dt;
    else ped.y += ped.dir * speed * dt;
    if (ped.x < 30 || ped.x > WORLD.width - 30 || ped.y < 30 || ped.y > WORLD.height - 210) {
      placePed(ped);
      return;
    }
    const atV = CITY.vStreets.some((sx) => Math.abs(ped.x - sx) < 8);
    const atH = CITY.hStreets.some((sy) => Math.abs(ped.y - sy) < 8);
    if (atV && atH && random() < 0.02) {
      if (ped.axis === 'x') {
        ped.axis = 'y';
        ped.dir = random() < 0.5 ? 1 : -1;
        ped.angle = ped.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        ped.axis = 'x';
        ped.dir = random() < 0.5 ? 1 : -1;
        ped.angle = ped.dir === 1 ? 0 : Math.PI;
      }
    }
  }

  function step(dt) {
    for (const car of cars) stepCar(car, dt);
    for (const ped of peds) stepPed(ped, dt);
  }

  /** Knock a pedestrian down for a few seconds; they flee when they get up. */
  function knockDown(ped) {
    ped.down = 2.5;
    ped.flee = 6;
  }

  reset();
  return { cars, parked, peds, reset, step, knockDown };
}
