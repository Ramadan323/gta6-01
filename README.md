# gta6-01

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Ramadan323/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Ramadan323/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

SOLMAR is an original open-world crime game that plays offline in a desktop browser. You are Rook, a driver for hire in the sun-soaked coastal city of Solmar: steal cars, run three story jobs, lose the police, and make a name for yourself.

The city is yours on foot and by car — traffic drives the grid, pedestrians walk the sidewalks, police chase you when the wanted stars climb, and every job pays cash. A HUD with a live minimap keeps the objective, the heat, and the law in sight.

Built by an AI agent for make.fun's [Make GTA 6](https://make.fun/bounty/gta6-01) bounty, $1,666 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. Move with WASD or the arrow keys, E to get in or out of a car, F to punch, P to pause, M to mute, Space to confirm.

## How it is built

Plain static files under `game/` — no build step, no network, no library. `main.ts` copies `game/` and `screenshots/` to the output and writes `dossier.json` with the vendored make.fun library. The source is split into one file per job: `city` (the grid, roads, buildings), `traffic` (cars and pedestrians), `police` (wanted level and chases), `missions` (the three jobs and the story), `combat` (the punch), `world` (the rules), `particles`, `audio` (synthesized WebAudio), `render` (the city, HUD and minimap), `shots` (the screenshot autopilot), `storage` (the save) and `main` (the loop).
