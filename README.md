![MainVisual](https://user-images.githubusercontent.com/8597982/166625506-ceb7948f-f194-45f5-8c91-821d52d62a2b.png)

# パプリコペイント / Paplico Paint

`Paplico` is painting application / engine on the web.

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

- [`pkgs/silk-core`](pkgs/silk-core) is an package of drawing engine / native UI events handler / drawing state manager.
  - Made with TypeScript / HTML5 Canvas / DOM
- [`pkgs/silk-web`](pkgs/silk-web) is Frontend implementation of silk-core.
  - Made with Next.js
