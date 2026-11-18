// Drawing only: the city, the cars, the people, the player, the HUD with its minimap, and
// the screens. The 1280x720 view follows the player through the city; the margin is filled
// with the backdrop colour. Flat shapes and canvas text, no images, no network.

import { CAR, CITY, FIELD, FONT, PALETTE, PLAYER, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 32, bottom: 72 };
const MINIMAP = { x: FIELD.width - 224, y: FIELD.height - 174, w: 200, h: 150 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas, city, traffic, police, missions, particles) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const cashLabel = cachedLabel('Cash $');
  const bestLabel = cachedLabel('Best $');
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    // Only override the baseline when the caller names one; drawHud sets 'top' once
    // and drawPanel sets 'alphabetic' once, and the calls below rely on that sticking.
    if (baseline) context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function inView(x, y, margin) {
    return x > -margin && x < FIELD.width + margin && y > -margin && y < FIELD.height + margin;
  }

  function drawCar(x, y, angle, color, isPolice, flash) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = '#11161d';
    context.fillRect(-CAR.length / 2 - 2, -CAR.width / 2 - 2, CAR.length + 4, CAR.width + 4);
    context.fillStyle = color;
    context.fillRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width);
    context.fillStyle = '#9fc4d8';
    context.fillRect(-6, -CAR.width / 2 + 3, 14, CAR.width - 6);
    context.fillStyle = '#2c3038';
    context.fillRect(CAR.length / 2 - 12, -CAR.width / 2 + 2, 6, 4);
    context.fillRect(CAR.length / 2 - 12, CAR.width / 2 - 6, 6, 4);
    if (isPolice) {
      const on = Math.floor(flash * 6) % 2 === 0;
      context.fillStyle = on ? PALETTE.policeLight : PALETTE.policeLightB;
      context.fillRect(-4, -6, 8, 12);
    }
    context.restore();
  }

  function drawPed(x, y, angle, color, down) {
    context.save();
    context.translate(x, y);
    if (down > 0) {
      context.rotate(Math.PI / 2);
      context.fillStyle = color;
      context.fillRect(-8, -5, 16, 10);
    } else {
      context.rotate(angle);
      context.fillStyle = color;
      context.beginPath();
      context.arc(0, 0, 8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#11161d';
      context.beginPath();
      context.arc(3, 0, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawCity(cam) {
    // Ground.
    context.fillStyle = PALETTE.grass;
    context.fillRect(cam.x, cam.y, FIELD.width, FIELD.height);
    // Beach and water along the south edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(cam.x, CITY.beachTop - cam.y, FIELD.width, WORLD.height - CITY.beachTop);
    context.fillStyle = PALETTE.water;
    context.fillRect(cam.x, CITY.waterTop - cam.y, FIELD.width, WORLD.height - CITY.waterTop);
    context.fillStyle = PALETTE.waterDeep;
    for (let i = 0; i < 5; i += 1) {
      const wy = CITY.waterTop + 24 + i * 18;
      context.fillRect(cam.x + ((i * 173) % 400), wy - cam.y, 120, 3);
    }
    // Sidewalks, then roads, then lane dashes.
    for (const sx of CITY.vStreets) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(sx - CITY.walkHalf - cam.x, -cam.y, CITY.walkHalf * 2, CITY.hStreets[CITY.hStreets.length - 1] + CITY.walkHalf);
      context.fillStyle = PALETTE.road;
      context.fillRect(sx - CITY.roadHalf - cam.x, -cam.y, CITY.roadHalf * 2, CITY.hStreets[CITY.hStreets.length - 1] + CITY.walkHalf);
    }
    for (const sy of CITY.hStreets) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(-cam.x, sy - CITY.walkHalf - cam.y, CITY.vStreets[CITY.vStreets.length - 1] + CITY.walkHalf, CITY.walkHalf * 2);
      context.fillStyle = PALETTE.road;
      context.fillRect(-cam.x, sy - CITY.roadHalf - cam.y, CITY.vStreets[CITY.vStreets.length - 1] + CITY.walkHalf, CITY.roadHalf * 2);
    }
    context.fillStyle = PALETTE.lane;
    for (const sx of CITY.vStreets) {
      for (let y = 0; y < CITY.hStreets[CITY.hStreets.length - 1]; y += 44) {
        context.fillRect(sx - 2 - cam.x, y - cam.y, 4, 22);
      }
    }
    for (const sy of CITY.hStreets) {
      for (let x = 0; x < CITY.vStreets[CITY.vStreets.length - 1]; x += 44) {
        context.fillRect(x - cam.x, sy - 2 - cam.y, 22, 4);
      }
    }
    // Parks.
    for (const park of city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x - cam.x, park.y - cam.y, park.w, park.h);
      context.fillStyle = '#4a7d3a';
      for (let i = 0; i < 4; i += 1) {
        context.beginPath();
        context.arc(park.x + park.w * (0.2 + i * 0.2) - cam.x, park.y + park.h * 0.5 - cam.y, 12, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Buildings: roof, darker edge, a lighter roof inset.
    for (const b of city.buildings) {
      if (!inView(b.x + b.w / 2 - cam.x, b.y + b.h / 2 - cam.y, Math.max(b.w, b.h))) continue;
      context.fillStyle = PALETTE.buildingRoof;
      context.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 6 - cam.x, b.y + 6 - cam.y, b.w - 12, b.h - 12);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(b.x + 12 - cam.x, b.y + 12 - cam.y, b.w - 24, 8);
    }
  }

  function drawMarker(cam, target, time) {
    if (!target) return;
    const pulse = 1 + Math.sin(time * 5) * 0.15;
    const x = target.x - cam.x;
    const y = target.y - cam.y;
    if (inView(x, y, 60)) {
      context.strokeStyle = PALETTE.marker;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(x, y, 26 * pulse, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(x, y, 7, 0, Math.PI * 2);
      context.fill();
      return;
    }
    // Off-screen: an arrow at the edge pointing toward it.
    const dx = target.x - (cam.x + FIELD.width / 2);
    const dy = target.y - (cam.y + FIELD.height / 2);
    const angle = Math.atan2(dy, dx);
    const ex = FIELD.width / 2 + Math.cos(angle) * (FIELD.width / 2 - 40);
    const ey = FIELD.height / 2 + Math.sin(angle) * (FIELD.height / 2 - 40);
    context.save();
    context.translate(ex, ey);
    context.rotate(angle);
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.moveTo(18, 0);
    context.lineTo(-12, -12);
    context.lineTo(-12, 12);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawWorld(state, cam, time) {
    drawCity(cam);
    const target = missions.target();
    drawMarker(cam, target, time);
    // The package, while its step is current.
    for (const p of state.pickups) {
      if (!p.active) continue;
      const x = p.x - cam.x;
      const y = p.y - cam.y;
      if (!inView(x, y, 40)) continue;
      if (p.kind === 'package') {
        context.fillStyle = '#f2c94c';
        context.fillRect(x - 10, y - 10, 20, 20);
        context.fillStyle = '#8a6a2f';
        context.fillRect(x - 10, y - 2, 20, 4);
      } else {
        context.fillStyle = PALETTE.cash;
        context.beginPath();
        context.arc(x, y, 7, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#1c5a2e';
        text('$', x, y + 5, 12, '#1c5a2e', 'center');
      }
    }
    for (const car of traffic.parked) {
      if (!car.active) continue;
      const x = car.x - cam.x;
      const y = car.y - cam.y;
      if (inView(x, y, 60)) drawCar(x, y, car.angle, car.color, false, 0);
    }
    for (const car of traffic.cars) {
      if (!car.active) continue;
      const x = car.x - cam.x;
      const y = car.y - cam.y;
      if (inView(x, y, 60)) drawCar(x, y, car.angle, car.color, false, 0);
    }
    for (const ped of traffic.peds) {
      if (!ped.active) continue;
      const x = ped.x - cam.x;
      const y = ped.y - cam.y;
      if (inView(x, y, 40)) drawPed(x, y, ped.angle, ped.color, ped.down);
    }
    for (const car of police.cars) {
      if (!car.active) continue;
      const x = car.x - cam.x;
      const y = car.y - cam.y;
      if (inView(x, y, 60)) drawCar(x, y, car.angle, car.color, true, car.flash);
    }
    // The player: their car, or on foot.
    const player = state.player;
    if (player.inCar && state.myCar.active) {
      const x = state.myCar.x - cam.x;
      const y = state.myCar.y - cam.y;
      drawCar(x, y, state.myCar.angle, state.myCar.color, false, 0);
    } else {
      const x = player.x - cam.x;
      const y = player.y - cam.y;
      if (player.invulnerable === 0 || Math.floor(player.invulnerable * 10) % 2 === 1) {
        context.save();
        context.translate(x, y);
        context.rotate(player.angle);
        context.fillStyle = PALETTE.player;
        context.beginPath();
        context.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#11161d';
        context.beginPath();
        context.arc(6, 0, 4, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
    }
    // Particles and floating text.
    for (const p of particles.pool) {
      if (!p.active) continue;
      const x = p.x - cam.x;
      const y = p.y - cam.y;
      if (!inView(x, y, 20)) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(x, y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    for (const t of particles.texts) {
      if (!t.active) continue;
      const x = t.x - cam.x;
      const y = t.y - cam.y;
      context.globalAlpha = Math.max(0, t.life);
      text(t.text, x, y, 18, PALETTE.cash, 'center');
    }
    context.globalAlpha = 1;
  }

  function drawMinimap(state, time) {
    const sx = MINIMAP.w / WORLD.width;
    const sy = MINIMAP.h / WORLD.height;
    context.fillStyle = 'rgba(13,21,32,0.88)';
    context.fillRect(MINIMAP.x - 4, MINIMAP.y - 4, MINIMAP.w + 8, MINIMAP.h + 8);
    context.fillStyle = '#20262f';
    context.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    context.strokeStyle = '#4a5568';
    context.lineWidth = 1;
    for (const vx of CITY.vStreets) {
      context.beginPath();
      context.moveTo(MINIMAP.x + vx * sx, MINIMAP.y);
      context.lineTo(MINIMAP.x + vx * sx, MINIMAP.y + MINIMAP.h);
      context.stroke();
    }
    for (const hy of CITY.hStreets) {
      context.beginPath();
      context.moveTo(MINIMAP.x, MINIMAP.y + hy * sy);
      context.lineTo(MINIMAP.x + MINIMAP.w, MINIMAP.y + hy * sy);
      context.stroke();
    }
    context.fillStyle = '#2f7fb8';
    context.fillRect(MINIMAP.x, MINIMAP.y + CITY.waterTop * sy, MINIMAP.w, MINIMAP.h - CITY.waterTop * sy);
    const target = missions.target();
    if (target) {
      const pulse = 3 + Math.sin(time * 5) * 1.5;
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(MINIMAP.x + target.x * sx, MINIMAP.y + target.y * sy, pulse, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of police.cars) {
      if (!car.active) continue;
      context.fillStyle = Math.floor(car.flash * 6) % 2 === 0 ? PALETTE.policeLight : PALETTE.policeLightB;
      context.beginPath();
      context.arc(MINIMAP.x + car.x * sx, MINIMAP.y + car.y * sy, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    const player = state.player;
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(MINIMAP.x + player.x * sx, MINIMAP.y + player.y * sy, 4, 0, Math.PI * 2);
    context.fill();
  }

  function drawHud(state, muted, time) {
    const player = state.player;
    context.textBaseline = 'top';
    text(cashLabel(state.cash), 24, 18, 26, PALETTE.cash, 'left');
    text(`Missions ${missions.index}/3`, 24, 50, 18, PALETTE.text, 'left');
    // Health bar.
    context.fillStyle = '#1c2733';
    context.fillRect(24, 78, 160, 14);
    context.fillStyle = player.health > 30 ? PALETTE.health : PALETTE.healthLow;
    context.fillRect(24, 78, 160 * Math.max(0, player.health / 100), 14);
    text('Health', 190, 76, 16, PALETTE.text, 'left');
    // Wanted stars, top right.
    const wanted = police.wanted;
    for (let i = 0; i < 5; i += 1) {
      text('★', FIELD.width - 24 - i * 30, 16, 28, i < wanted ? PALETTE.star : PALETTE.starEmpty, 'right');
    }
    text('WANTED', FIELD.width - 24, 50, 14, PALETTE.muted, 'right');
    // Objective, top centre: the panel is sized from the text itself, so it never clips.
    const objective = missions.objectiveText();
    context.font = `18px ${FONT}`;
    const ow = Math.min(FIELD.width - 320, 24 + context.measureText(objective).width);
    context.fillStyle = 'rgba(13,21,32,0.72)';
    context.fillRect(FIELD.width / 2 - ow / 2, 12, ow, 34);
    text(objective, FIELD.width / 2, 20, 18, PALETTE.text, 'center');
    // Car speed and ride health, bottom centre-right, ending before the minimap.
    if (player.inCar && state.myCar.active) {
      const kmh = Math.round(Math.abs(state.myCar.speed) * 0.18);
      text(`${kmh} km/h`, FIELD.width - 250, FIELD.height - 52, 26, PALETTE.text, 'right');
      context.fillStyle = '#1c2733';
      context.fillRect(FIELD.width - 410, FIELD.height - 22, 160, 10);
      context.fillStyle = state.myCar.health > 30 ? PALETTE.health : PALETTE.healthLow;
      context.fillRect(FIELD.width - 410, FIELD.height - 22, 160 * Math.max(0, state.myCar.health / 100), 10);
      text('Ride', FIELD.width - 420, FIELD.height - 26, 14, PALETTE.text, 'right');
    }
    if (muted) text('Muted (M)', 24, FIELD.height - 30, 16, PALETTE.muted, 'left');
    else text('M mute · P pause', 24, FIELD.height - 30, 16, PALETTE.muted, 'left');
    if (state.toastTimer > 0) {
      context.fillStyle = 'rgba(13,21,32,0.85)';
      const tw = 20 + state.toast.length * 9;
      context.fillRect(FIELD.width / 2 - tw / 2, 60, tw, 34);
      text(state.toast, FIELD.width / 2, 68, 20, PALETTE.marker, 'center');
    }
    drawMinimap(state, time);
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 76, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.marker, 'center');
  }

  function draw(state, screen, save, muted, time) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const player = state.player;
    let camX = Math.max(0, Math.min(WORLD.width - FIELD.width, player.x - FIELD.width / 2));
    let camY = Math.max(0, Math.min(WORLD.height - FIELD.height, player.y - FIELD.height / 2));
    if (state.shake > 0) {
      camX += (Math.random() - 0.5) * state.shake * 22;
      camY += (Math.random() - 0.5) * state.shake * 22;
    }
    const cam = { x: camX, y: camY };
    drawWorld(state, cam, time);
    if (screen === SCREEN_TITLE) {
      const lines = [
        'Solmar. Sun, sea, and everyone else\'s car.',
        'You are Rook, a driver for hire. Three jobs stand between',
        'you and a name in this city. Steal a ride, run the jobs,',
        'lose the heat — and try not to get busted.',
        '',
        'Move WASD / arrows · E get in or out of a car · F punch',
        'P pause · M mute · Space confirm',
        '',
        `Best cash $${save.bestCash} · Jobs done ${save.missionsDone}/3`,
      ];
      drawPanel('SOLMAR', lines, 'Press Space or click to start');
      return;
    }
    drawHud(state, muted, time);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for no one. Except now.'], 'Press P to keep driving');
    } else if (screen === SCREEN_OVER) {
      const over = state.over === 'busted' ? 'BUSTED' : 'WASTED';
      const lines = [
        over === 'BUSTED' ? 'The Solmar police finally caught up with Rook.' : 'Rook pushed it too far in Solmar.',
        '',
        `Cash made $${state.cash} · Jobs done ${missions.index}/3`,
        `Survived ${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')} · Best cash ${bestLabel(save.bestCash)}`,
      ];
      drawPanel(over, lines, 'Press Space or click to run it back');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
