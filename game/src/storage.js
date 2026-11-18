// The save: best cash, missions finished, and total time, kept in localStorage with an
// in-memory fallback for browsers where storage is off. The game loads it on the title
// screen and writes it when a run ends.

import { SAVE_KEY } from './config.js';

export function createStorage() {
  let memory = null;

  function read() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return { bestCash: 0, missionsDone: 0, bestTime: 0, runs: 0 };
      const data = JSON.parse(raw);
      return {
        bestCash: data.bestCash | 0,
        missionsDone: data.missionsDone | 0,
        bestTime: data.bestTime | 0,
        runs: data.runs | 0,
      };
    } catch {
      if (memory) return memory;
      return { bestCash: 0, missionsDone: 0, bestTime: 0, runs: 0 };
    }
  }

  function write(save) {
    memory = save;
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
      // Storage can be off (private windows): the save then lasts this visit only.
    }
  }

  return { read, write };
}
