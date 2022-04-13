import fastRandom from 'fast-random'
import { BrushContext, IBrush } from '../engine/IBrush'
import {
  InstancedMesh,
  MathUtils,
  MeshBasicMaterial,
  PlaneBufferGeometry,
  Scene,
  Texture,
  TextureLoader,
  ImageBitmapLoader,
  Vector2,
  Path as ThreePath,
  Object3D,
  Color,
  CanvasTexture,
} from 'three'
import { lerp } from '../SilkMath'
import * as Textures from './ScatterTexture/assets'
import { mergeToNew } from '../utils'

const _object = new Object3D()
const _translate2d = new Vector2()

export declare namespace ScatterBrush {
  export type ScatterSetting = {
    texture: keyof typeof Textures
    divisions: number
    scatterRange: number
    fadeForce: number
  }
}

export class ScatterBrush implements IBrush {
  public static readonly id = '@silk-paint/scatter-brush'

  public get id() {
    return ScatterBrush.id
  }

  private scene!: Scene
  // private material!: MeshBasicMaterial
  private geometry!: PlaneBufferGeometry
  private materials: Record<string, MeshBasicMaterial> = {}

  public getInitialSpecificConfig(): ScatterBrush.ScatterSetting {
    return {
      texture: 'pencil',
      divisions: 1000,
      scatterRange: 0.5,
      fadeForce: 1,
    }
  }

  public async initialize() {
    this.scene = new Scene()

    await Promise.all(
      Object.keys(Textures).map(async (key) => {
        const bitmap = await new Promise<ImageBitmap>((resolve, reject) =>
          new ImageBitmapLoader().load(
            (Textures as any)[key as any],
            resolve,
            undefined,
            reject
          )
        )

        const texture = new CanvasTexture(bitmap)

        this.materials[key] = new MeshBasicMaterial({
          // map: texture,
          // color: 0xffffff,
          transparent: true,
          alphaMap: texture,
        })
      })
    )

    this.geometry = new PlaneBufferGeometry(1, 1)
  }

  public render({
    context: ctx,
    threeRenderer: renderer,
    threeCamera: camera,
    path: inputPath,
    ink,
    brushSetting,
    destSize,
  }: BrushContext<ScatterBrush.ScatterSetting>) {
    const specific = mergeToNew(
      this.getInitialSpecificConfig(),
      brushSetting.specific
    )
    const { color } = brushSetting

    const path = new ThreePath()
    const [start] = inputPath.points

    path.moveTo(start.x / destSize.width, start.y / destSize.height)

    inputPath.mapPoints(
      (point, prev) => {
        // console.log({ point })
        path.bezierCurveTo(
          (prev?.out?.x ?? prev!.x) / destSize.width,
          (prev?.out?.y ?? prev!.y) / destSize.height,
          (point.in?.x ?? point.x) / destSize.width,
          (point.in?.y ?? point.y) / destSize.height,
          point.x / destSize.width,
          point.y / destSize.height
        )
      },
      { startOffset: 1 }
    )

    if (inputPath.closed) {
      path.lineTo(start.x, start.y)
    }

    const material = this.materials[specific.texture]
    material.color.set(new Color(color.r, color.g, color.b))

    const counts = Math.ceil(path.getLength() * specific.divisions)
    const mesh = new InstancedMesh(this.geometry, material, counts)
    this.scene.add(mesh)

    const seed = fastRandom(inputPath.randomSeed)
    // const totalLength = inputPath.getTotalLength()
    for (let idx = 0; idx < counts; idx++) {
      const frac = idx / counts

      path.getPoint(frac, _translate2d)

      _object.position.set(
        MathUtils.lerp(-destSize.width / 2, destSize.width / 2, _translate2d.x),
        MathUtils.lerp(
          destSize.height / 2,
          -destSize.height / 2,
          _translate2d.y
        ),
        0
      )

      // prettier-ignore
      const fadeWeight =
        frac <= .15 ? MathUtils.lerp(0, 1, Math.min(frac, .15) / .15)
        : frac >= (1 - .15) ? MathUtils.lerp(0, 1, Math.min(1 - frac, 0.15) / 0.15)
        : 1
      const pressureWeight = 0.2 + inputPath.getPressureAt(frac) * 0.8

      _object.scale.set(
        brushSetting.size * pressureWeight * fadeWeight,
        brushSetting.size * pressureWeight * fadeWeight,
        1
      )

      _object.rotation.z = seed.nextFloat() * 360

      const tangent = path.getTangentAt(frac).normalize()
      const angle = Math.atan2(tangent.x, tangent.y)

      _object.translateX(
        lerp(-specific.scatterRange, specific.scatterRange, Math.cos(angle))
      )
      _object.translateY(
        lerp(-specific.scatterRange, specific.scatterRange, Math.sin(angle))
      )

      _object.updateMatrix()

      mesh.setMatrixAt(idx, _object.matrix)
    }

    renderer.render(this.scene, camera)

    ctx.globalAlpha = brushSetting.opacity
    ctx.drawImage(renderer.domElement, 0, 0)

    this.scene.remove(mesh)
  }
}

// SEE: https://jsfiddle.net/ys5wap0b/
const VERTEX_SHADER = `
varying vec2 vUv;

attribute vec3 instanceColor;
varying vec3 vInstanceColor;


void main() {
  vec3 transformed = vec3( position );
  vec4 mvPosition = vec4( transformed, 1.0 );
  // # c'est ca
  #ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
  #endif
  vInstanceColor = instanceColor;

  vec4 modelViewPosition = modelViewMatrix * mvPosition;

  vUv = uv;
  gl_Position = projectionMatrix * modelViewPosition;
}
`
