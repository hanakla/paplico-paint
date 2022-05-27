![MainVisual](https://user-images.githubusercontent.com/8597982/166625506-ceb7948f-f194-45f5-8c91-821d52d62a2b.png)

# Paplico Paint / パプリコペイント

`Paplico` is Drawing app on the Web.

## Concept

- Paplico is vertor based raster painting app,
  It gives able to non-destructive editing for us.
- Targeted to hyper Vector editing likes Adobe Illustrator
- Fully open sourced, Can Web Developers extension Paplico,
  or make drawing app based on `@paplico/core`

## Development Get Started

Requires Node.js / yarn.

1. `git clone git@github.com:hanakla/paplico-paint.git`
2. `cd paplico-paint`
3. `yarn dev`

Do you understand????

## Application Structure

- [`pkgs/core`](pkgs/core) is an package of drawing engine / native UI events handler / drawing state manager.
  - Made with TypeScript / HTML5 Canvas / DOM
- [`pkgs/web`](pkgs/web) is Frontend implementation of @paplico/core.
  - Made with Next.js
- [`pkgs/desktop`](pkgs/desktop) is Desktop App version of Paplico. (WIP)
- Made with Electron
