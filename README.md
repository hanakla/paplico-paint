# Silk

`Silk` is painting application / engine on the web.

## Motivation

ベジエでイケイケな絵を書きたい。  
ラスター系とベクター系が一緒に使えるアプリが欲しい。  

そういう伝わりづらい個人的な欲求で作っている。

## Development Get Started

Requires Node.js / yarn.

1. `git clone git@github.com:hanakla/silk-paint.git`
2. `cd silk-paint`
3. `yarn dev`

Do you understand????

## Application Structure

- `packages/silk-core` is an package of drawing engine / native UI events handler / drawing state manager.
  - Made with TypeScript / HTML5 Canvas / DOM
- `packages/silk-web` is Frontend implementation of silk-core.
  - Made with Next.js
