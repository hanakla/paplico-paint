import fastRandom from 'fast-random'
import { BrushContext, IBrush } from '../engine/IBrush'
import {
  InstancedMesh,
  MathUtils,
  MeshBasicMaterial,
  PlaneBufferGeometry,
  Scene,
  ImageBitmapLoader,
  Vector2,
  Path as ThreePath,
  Object3D,
  Color,
  CanvasTexture,
  InstancedBufferAttribute,
} from 'three'
import { lerp, radToDeg } from '../SilkMath'
import * as Textures from './ScatterTexture/assets'
import { mergeToNew } from '../utils'
import { logImage } from '../DebugHelper'

const _object = new Object3D()
const _translate2d = new Vector2()

export declare namespace ScatterBrush {
  export type SpecificSetting = {
    texture: keyof typeof Textures
    divisions: number
    scatterRange: number
    /** 0..1 */
    randomRotation: number
    /** Influence of stroke fade. 0..1 */
    fadeWeight: number
    /** Influence of stroke in / out weight. 0..1 */
    inOutInfluence: number
    /** 0..1 */
    pressureInfluence: number
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

  public getInitialSpecificConfig(): ScatterBrush.SpecificSetting {
    return {
      texture: 'fadeBrush',
      divisions: 1000,
      scatterRange: 0.5,
      randomRotation: 0,
      fadeWeight: 1,
      inOutInfluence: 0,
      pressureInfluence: 0.8,
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

        await logImage(bitmap, `ScatterBrush-${key}`)

        const texture = new CanvasTexture(bitmap)

        this.materials[key] = new MeshBasicMaterial({
          // map: texture,
          // color: 0xffffff,

          transparent: true,
          alphaMap: texture,
        })

        //     this.materials[key] = new RawShaderMaterial({
        //       // map: texture,
        //       // color: 0xffffff,
        //       uniforms: {
        //         texture: { value: texture },
        //       },
        //       depthTest: true,
        //       depthWrite: true,
        //       vertexShader: `
        //         precision mediump float;

        //         uniform mat4 modelViewMatrix;
        //         uniform mat4 projectionMatrix;

        //         attribute vec3 position;
        //         attribute vec2 uv;

        //         varying vec2 vUv;

        //         void main() {
        //           vUv = uv;
        //           gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        //         }
        //       `,
        //       fragmentShader: `
        //         precision mediump float;

        //         // uniform sampler2D texture;
        //         // uniform mat4 viewMatrix;

        //         // varying vec4 vColor;
        //         // varying vec2 vUv;

        //         void main(void) {
        //           // vec3 color = texture2D(texture, vUv).rgb;
        //           // gl_FragColor = vec4(color, color.r);

        //           gl_FragColor = vec4(.0, .0, .0, 1);
        //         }
        //       `,

        //       // transparent: true,
        //       // alphaMap: texture,
        //     })
        //   })
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
  }: BrushContext<ScatterBrush.SpecificSetting>) {
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
    material.needsUpdate = true
    material.color.set(new Color(color.r, color.g, color.b))

    // material.onBeforeCompile = (shader) => {
    //   console.log({ shader })
    // }

    const counts = Math.ceil(path.getLength() * specific.divisions)
    const opacities = new Float32Array(counts)
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
        frac <= .15 ? MathUtils.lerp(1 - specific.inOutInfluence, 1, Math.min(frac, .15) / .15)
        : frac >= (1 - .15) ? MathUtils.lerp(1 - specific.inOutInfluence, 1, Math.min(1 - frac, 0.15) / 0.15)
        : 1

      const pressureWeight =
        0.2 +
        0.8 * (1 - specific.pressureInfluence) +
        inputPath.getPressureAt(frac) * 0.8 * specific.pressureInfluence

      // fade(1) * influence(1) = 1 入り抜き影響済みの太さ
      // fade(1) * influence(0) = 0 入り抜き影響済みの太さ
      // (size * pressure) * (fade * influence)
      // (fade * influence) = 0 のときにsize * pressureになってほしいな(こなみ)
      // (fade * influence) = 0
      // 打ち消し式: (fade * influence) + 1 = 1

      _object.scale.set(
        brushSetting.size * pressureWeight * fadeWeight,
        brushSetting.size * pressureWeight * fadeWeight,
        1
      )

      const tangent = path.getTangent(frac).normalize()
      const angle = Math.atan2(tangent.x, tangent.y)

      _object.rotation.z =
        radToDeg(Math.floor(angle)) +
        -1 +
        seed.nextFloat() * 360 * specific.randomRotation

      _object.translateX(
        lerp(-specific.scatterRange, specific.scatterRange, Math.cos(angle))
      )
      _object.translateY(
        lerp(-specific.scatterRange, specific.scatterRange, Math.sin(angle))
      )

      _object.updateMatrix()

      mesh.setMatrixAt(idx, _object.matrix)
      opacities[idx] = fadeWeight
    }

    this.geometry.setAttribute(
      'opacities',
      new InstancedBufferAttribute(opacities, 1)
    )
    this.geometry.attributes.opacities.needsUpdate = true
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
