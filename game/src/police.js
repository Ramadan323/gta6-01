// The wanted level and the police. Wanted rises when the player commits a crime and falls
// when they lay low; police cars spawn to match it and chase the player, ramming their car
// and, on foot, holding them until they are busted. None of this draws anything.

import { CAR, POLICE } from './config.js';

const POLICE_COLORS = ['#1c2733', '#243447', '#1c2733', '#2c3e50', '#1c2733'];

export function createPolice(city, random) {
  const cars = [];
  for (let i = 0; i < POLICE.maxCars; i += 1) {
    cars.push({ active: false, x: 0, y: 0, angle: 0, speed: 0, color: POLICE_COLORS[i], flash: 0 });
  }
  let wanted = 0;
  let decayTimer = POLICE.decaySeconds;
  let bustHold = 0;

  function spawnAt(car, x, y) {
    const p = city.randomRoadPoint();
    // Far enough away that the siren arrives before the car does.
    if (Math.hypot(p.x - x, p.y - y) < POLICE.spawnMinDist) return false;
    car.active = true;
    car.x = p.x;
    car.y = p.y;
    car.angle = Math.atan2(y - p.y, x - p.x);
    car.speed = 0;
    return true;
  }

  function sync(x, y) {
    let active = 0;
    for (const car of cars) if (car.active) active += 1;
    while (active < wanted) {
      const car = cars.find((c) => !c.active);
      if (!car) break;
      if (spawnAt(car, x, y)) active += 1;
      else break;
    }
    while (active > wanted) {
      const car = cars.find((c) => c.active);
      if (!car) break;
      car.active = false;
      active -= 1;
    }
  }

  function addWanted(n) {
    wanted = Math.min(5, wanted + n);
    decayTimer = POLICE.decaySeconds;
  }

  function setWanted(n) {
    wanted = Math.min(5, Math.max(0, n));
    decayTimer = POLICE.decaySeconds;
  }

  function step(dt, player, inCar, carSpeed) {
    sync(player.x, player.y);
    const maxSpeed = POLICE.baseSpeed + POLICE.speedPerStar * wanted;
    let chasing = false;
    for (const car of cars) {
      if (!car.active) continue;
      chasing = true;
      car.flash += dt;
      // Steer toward the player, faster when the player is fast.
      const want = Math.atan2(player.y - car.y, player.x - car.x);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const target = Math.min(maxSpeed, 200 + Math.abs(carSpeed) * 0.9 + wanted * 30);
      car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // Police stay on the roads: if they leave the map, respawn them on a road.
      if (car.x < 20 || car.x > 2540 || car.y < 20 || car.y > 1900) {
        car.active = false;
      }
    }
    // Wanted decays only while no police car is close enough to keep the heat on.
    let near = false;
    for (const car of cars) {
      if (car.active && Math.hypot(car.x - player.x, car.y - player.y) < 420) {
        near = true;
        break;
      }
    }
    if (wanted > 0 && !near) {
      decayTimer -= dt;
      if (decayTimer <= 0) {
        wanted -= 1;
        decayTimer = POLICE.decaySeconds;
      }
    } else {
      decayTimer = POLICE.decaySeconds;
    }
    return { chasing, wanted };
  }

  /** On foot, a police car touching the player starts the bust; hold it to finish. */
  function bustProgress(dt, player, inCar) {
    if (inCar || wanted === 0) {
      bustHold = 0;
      return 0;
    }
    let touching = false;
    for (const car of cars) {
      if (!car.active) continue;
      if (Math.hypot(car.x - player.x, car.y - player.y) < CAR.length * 0.6) {
        touching = true;
        break;
      }
    }
    if (touching) bustHold += dt;
    else bustHold = 0;
    return bustHold / POLICE.bustHold;
  }

  function reset() {
    for (const car of cars) car.active = false;
    wanted = 0;
    decayTimer = POLICE.decaySeconds;
    bustHold = 0;
  }

  return {
    cars,
    get wanted() {
      return wanted;
    },
    addWanted,
    setWanted,
    step,
    bustProgress,
    reset,
  };
}
