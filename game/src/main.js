// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over. Sound
// wires to what the world reports: crashes, pickups, missions, the siren while police
// chase, the engine while driving.
//
// ?seed=N fixes the city's random pattern. ?shot=start|play|chase|mission|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createWorld, EVENT_BUSTED, EVENT_CRASH, EVENT_HIT, EVENT_MISSION, EVENT_PICKUP, EVENT_PUNCH, EVENT_STEAL, EVENT_STEP, EVENT_WASTED } from './world.js';
import { createParticles } from './particles.js';
import { createAudio } from './audio.js';
import { createStorage } from './storage.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const city = createCity(random);
const traffic = createTraffic(city, random);
const police = createPolice(city, random);
const missions = createMissions();
const combat = createCombat();
const world = createWorld(random, { city, traffic, police, missions, combat });
const particles = createParticles();
const audio = createAudio();
const storage = createStorage();
const renderer = createRenderer(canvas, city, traffic, police, missions, particles);

function runShot(name) {
  const scene = stageShot(name, world, { traffic, police, missions });
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.save, false, world.state.elapsed);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = storage.read();
  let accumulator = 0;
  let last = performance.now();
  // One-shot presses, taken once per frame by handleActions and spent by the next step.
  let pendingEnter = false;
  let pendingPunch = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    pendingEnter = false;
    pendingPunch = false;
    screen = SCREEN_PLAY;
    announce('Playing in Solmar. Steal a car, run the jobs, lose the heat.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    const cash = world.state.cash;
    const done = missions.index;
    const elapsed = world.state.elapsed;
    if (cash > save.bestCash) save.bestCash = cash;
    if (done > save.missionsDone) save.missionsDone = done;
    if (elapsed > save.bestTime) save.bestTime = elapsed;
    save.runs += 1;
    storage.write(save);
    audio.busted();
    announce(`${world.state.over === 'busted' ? 'Busted' : 'Wasted'}. Cash $${cash}. Best $${save.bestCash}.`);
  }

  function handleEvents(events) {
    const state = world.state;
    const player = state.player;
    if (events & EVENT_CRASH) {
      audio.crash();
      particles.burst(player.x, player.y, '#f2a35e', 10, 220, 4, 0.5);
    }
    if (events & EVENT_HIT) {
      audio.crash();
      particles.burst(player.x, player.y, '#e5534b', 8, 180, 4, 0.4);
    }
    if (events & EVENT_PICKUP) {
      audio.chime();
      particles.burst(player.x, player.y, '#7ee787', 8, 140, 3, 0.5);
      particles.floatText(player.x, player.y - 20, state.packageCarried && missions.currentStep() && missions.currentStep().type !== 'pickup' ? 'Package!' : '+$');
    }
    if (events & EVENT_STEP) audio.chime();
    if (events & EVENT_MISSION) {
      audio.mission();
      particles.burst(player.x, player.y, '#f2c94c', 16, 260, 4, 0.8);
    }
    if (events & EVENT_STEAL) audio.steal();
    if (events & EVENT_PUNCH) {
      audio.punch();
      particles.burst(player.x + Math.cos(player.angle) * 30, player.y + Math.sin(player.angle) * 30, '#e8e4d8', 6, 160, 3, 0.4);
    }
    if (events & (EVENT_BUSTED | EVENT_WASTED)) endGame();
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.toggleMute();
      announce(audio.muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      audio.unlock();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (actions & ACTION_ENTER) pendingEnter = true;
    if (actions & ACTION_PUNCH) pendingPunch = true;
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { axes: { x: 0, y: 0 }, enter: false, punch: false }, true);
      return;
    }
    const worldInput = {
      axes: input.axes(),
      enter: pendingEnter,
      punch: pendingPunch,
    };
    pendingEnter = false;
    pendingPunch = false;
    const events = world.step(STEP, worldInput, false);
    // Exhaust while the car accelerates.
    const state = world.state;
    if (state.player.inCar && Math.abs(state.myCar.speed) > 80) {
      particles.exhaust(state.myCar.x, state.myCar.y, state.myCar.angle);
    }
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      pendingEnter = false;
      pendingPunch = false;
    }
    // Sound follows the world: engine while driving, siren while the law chases.
    const state = world.state;
    const driving = screen === SCREEN_PLAY && state.player.inCar && state.myCar.active;
    audio.engine(driving ? Math.abs(state.myCar.speed) / 560 : 0);
    audio.siren(screen === SCREEN_PLAY && police.wanted > 0, STEP);
    particles.step(STEP);
    renderer.draw(state, screen, save, audio.muted, state.elapsed);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('SOLMAR. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

// Inspectable live state, for debugging and for the interactive test.
window.__game = { state: world.state, missions, police, traffic, city };
