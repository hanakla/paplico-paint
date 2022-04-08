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
  Vector2,
  Path as ThreePath,
  DynamicDrawUsage,
  Object3D,
  Color,
  ShaderMaterial,
  Vector3,
} from 'three'
// import { BRUSH1 } from './test_brushes'
import { lerp } from '../SilkMath'
import * as Textures from './ScatterTexture/assets'
import { mergeToNew } from '../utils'

const _object = new Object3D()
const _translate2d = new Vector2()

export declare namespace ScatterBrush {
  export type ScatterSetting = {
    texture: keyof typeof Textures
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
    return { texture: 'pencil' }
  }

  public async initialize() {
    this.scene = new Scene()

    await Promise.all(
      Object.keys(Textures).map(async (key) => {
        const texture = await new Promise<Texture>((resolve, reject) =>
          new TextureLoader().load(
            (Textures as any)[key as any],
            resolve,
            undefined,
            reject
          )
        )

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

    const counts = Math.ceil(path.getLength() * 1000)
    const mesh = new InstancedMesh(this.geometry, material, counts)
    this.scene.add(mesh)

    const seed = fastRandom(inputPath.randomSeed)
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
      _object.scale.set(brushSetting.size, brushSetting.size, 1)
      _object.rotation.z = seed.nextFloat() * 360

      const tangent = path.getTangentAt(frac).normalize()
      const angle = Math.atan2(tangent.x, tangent.y)

      _object.translateX(lerp(-0.5, 0.5, Math.cos(angle)))
      _object.translateY(lerp(-0.5, 0.5, Math.sin(angle)))

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
