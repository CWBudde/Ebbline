# Ebbline

A browser strategy game: a survey crew lands on a dead colony world where silt, a dense reactive
fluid, wells up from vents and floods the lowlands. Build a power grid outward from the lander,
push the silt back and cap every vent.

## Development

Requires Node 24 and pnpm (the version pinned in `package.json`, for example through corepack).

```sh
pnpm install
pnpm run dev     # Vite dev server
pnpm run check   # typecheck, lint, tests, production build
pnpm run e2e     # Playwright against the production build
```

- `engine/` holds the simulation: pure TypeScript, deterministic, no DOM and no Node.
- `app/` is the browser front end: Vite, PixiJS for the map, Preact for the DOM UI.

## Origin

This repository began as a fork of [OpenCreeper](https://github.com/alexanderzeillinger/OpenCreeper)
by Alexander Zeillinger, a 2012/13 Dart game. Ebbline is a new game written from scratch; none of the
old code or assets remain. The old tree is kept under the git tag `legacy-dart`.

## License

MIT, see `LICENSE`.
