// Every tuning number and colour in one place. The view is a fixed 1280x720 logical area;
// the renderer scales it to the window and the camera follows the player through a city
// bigger than the screen, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };
export const WORLD = { width: 2560, height: 1920 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Streets run on a 320px grid. Road is 96 wide, sidewalk reaches 16 further each side. */
export const CITY = {
  grid: 320,
  roadHalf: 48,
  walkHalf: 64,
  vStreets: [320, 640, 960, 1280, 1600, 1920, 2240],
  hStreets: [320, 640, 960, 1280, 1600],
  beachTop: 1760,
  waterTop: 1856,
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 230,
  health: 100,
  punchRange: 34,
  punchArc: 1.1,
  punchCooldown: 0.45,
  invulnerable: 1.0,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  drag: 0.55,
  health: 180,
};

export const TRAFFIC = {
  cars: 10,
  speed: 150,
  speedJitter: 45,
  turnChance: 0.35,
  followGap: 70,
};

export const PEDS = { count: 14, speed: 55, speedJitter: 22 };

export const PARKED = { count: 8 };

export const POLICE = {
  maxCars: 5,
  baseSpeed: 470,
  speedPerStar: 34,
  ramDamage: 10,
  bustHold: 0.5,
  spawnMinDist: 620,
  decaySeconds: 15,
};

export const WANTED = {
  steal: 1,
  hitPed: 1,
  punch: 1,
  hitPolice: 1,
  ramTraffic: 0,
};

export const MISSIONS = [
  {
    id: 'wheels',
    title: 'Hot Wheels',
    story: 'Rook needs wheels. Borrow one. Permanently.',
    reward: 150,
    steps: [
      { type: 'steal', text: 'Steal a car — walk up to one and press E' },
      { type: 'goto', x: 1920, y: 960, text: 'Drive to the garage on Palm Row' },
    ],
  },
  {
    id: 'package',
    title: 'The Package',
    story: 'A friend left a package. Pick it up, drop it off. No questions.',
    reward: 300,
    steps: [
      { type: 'goto', x: 640, y: 1280, text: 'Drive to the pickup on Coral Ave' },
      { type: 'pickup', x: 640, y: 1280, text: 'Pick up the package' },
      { type: 'goto', x: 2240, y: 320, text: 'Deliver it to the north dock' },
    ],
  },
  {
    id: 'heat',
    title: 'Heat Wave',
    story: 'The job went loud. The law is on your tail. Lose them, then vanish.',
    reward: 500,
    steps: [
      { type: 'wanted', stars: 3, text: 'The heat is on — reach 3 stars' },
      { type: 'lose', text: 'Lose the cops — get wanted back to 0' },
      { type: 'goto', x: 320, y: 320, text: 'Reach the safehouse in the old town' },
    ],
  },
];

/** Sun-soaked coastal palette: warm asphalt, sand, sea, bright paint. */
export const PALETTE = {
  backdrop: '#0d1520',
  grass: '#7fae5a',
  sand: '#e8cf96',
  water: '#2f7fb8',
  waterDeep: '#256a9e',
  road: '#3a3f47',
  roadEdge: '#2c3038',
  lane: '#e8d44d',
  sidewalk: '#9aa0a8',
  curb: '#6e747d',
  building: '#b08968',
  buildingRoof: '#8a6a4f',
  buildingAlt: '#7d8aa0',
  park: '#5d9b4a',
  player: '#f2c94c',
  playerCar: '#e5534b',
  trafficCar: '#4fc3f7',
  policeCar: '#1c2733',
  policeLight: '#e5534b',
  policeLightB: '#4f7df7',
  ped: '#e8e4d8',
  marker: '#f2c94c',
  panel: '#141c28',
  panelEdge: '#2c3a4d',
  text: '#f4f1e8',
  muted: '#9aa5b1',
  star: '#f2c94c',
  starEmpty: '#4a5568',
  health: '#57c465',
  healthLow: '#e5534b',
  cash: '#7ee787',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save is kept between visits (this browser only). */
export const SAVE_KEY = 'solmar.save.v1';
