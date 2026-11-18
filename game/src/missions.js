// Missions and the story. Three short jobs for Rook, a driver for hire in Solmar. Each job
// is a list of steps; a step is done when the player reaches its point, steals a car, picks
// something up, or the wanted level moves the way the step asks. Finishing a job pays cash
// and moves the story on; after the last job the city is free roam.

import { MISSIONS } from './config.js';

export function createMissions() {
  let index = 0;
  let stepIndex = 0;
  let done = false;

  function current() {
    if (done) return null;
    return MISSIONS[index];
  }

  function currentStep() {
    const mission = current();
    if (!mission) return null;
    return mission.steps[stepIndex];
  }

  /** The point the player should head for now, or null when the step has no point. */
  function target() {
    const step = currentStep();
    if (!step || step.x === undefined) return null;
    return { x: step.x, y: step.y };
  }

  /** One line for the HUD: the job, the step, and the reward. */
  function objectiveText() {
    const mission = current();
    if (!mission) return 'Free roam — every job in Solmar is done';
    const step = mission.steps[stepIndex];
    return `${mission.title}: ${step.text}`;
  }

  /**
   * Check the step against the world. Returns 'step' when a step finished, 'mission' when a
   * job finished, 'all' when the last job finished, or null. `info` carries what the world
   * knows: hasCar, the player's position, the wanted level, and whether a pickup was taken.
   */
  function check(info) {
    const mission = current();
    if (!mission) return null;
    const step = mission.steps[stepIndex];
    let finished = false;
    if (step.type === 'steal') finished = info.hasCar;
    else if (step.type === 'goto' || step.type === 'pickup') {
      finished = Math.hypot(info.x - step.x, info.y - step.y) < 70;
    } else if (step.type === 'wanted') finished = info.wanted >= step.stars;
    else if (step.type === 'lose') finished = info.wanted === 0;
    if (!finished) return null;
    stepIndex += 1;
    if (stepIndex < mission.steps.length) return 'step';
    const reward = mission.reward;
    index += 1;
    stepIndex = 0;
    if (index >= MISSIONS.length) {
      done = true;
      return 'all';
    }
    return 'mission';
  }

  function rewardOf(missionId) {
    const mission = MISSIONS.find((m) => m.id === missionId);
    return mission ? mission.reward : 0;
  }

  /** The job just finished (for the payout), or null. */
  function lastMission() {
    if (index === 0) return null;
    return MISSIONS[index - 1];
  }

  function reset() {
    index = 0;
    stepIndex = 0;
    done = false;
  }

  return {
    get index() {
      return index;
    },
    get done() {
      return done;
    },
    current,
    currentStep,
    target,
    objectiveText,
    check,
    rewardOf,
    lastMission,
    reset,
  };
}
