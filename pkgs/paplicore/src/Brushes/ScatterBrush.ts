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
  Vector3,
  Matrix4,
  OneFactor,
  OneMinusSrcAlphaFactor,
  AddEquation,
  CustomBlending,
  Group,
} from 'three'

import { degToRad, lerp, radToDeg } from '../utils/math'
import * as Textures from './ScatterTexture/assets'
import { mergeToNew } from '../utils/object'
import {
  logGroup,
  logGroupEnd,
  logImage,
  logTime,
  logTimeEnd,
  timeSumming,
} from '../DebugHelper'

const _object = new Object3D()
_object.matrixAutoUpdate = false

const _translate2d = new Vector2()
const _mat4 = new Matrix4()

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
  public static readonly id = '@paplico/brushes/scatter-brush'

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
        texture.premultiplyAlpha = true

        this.materials[key] = new MeshBasicMaterial({
          // map: texture,
          color: 0xffffff,

          premultipliedAlpha: true,
          transparent: true,
          alphaMap: texture,

          // depthTest: false,
          // depthWrite: false,

          blending: CustomBlending,
          blendSrc: OneFactor,
          blendDst: OneMinusSrcAlphaFactor,
          blendSrcAlpha: OneFactor,
          blendDstAlpha: OneMinusSrcAlphaFactor,
          blendEquation: AddEquation,

          // blending: NormalBlending,
          // blendSrc: OneFactor,
          // blendSrcAlpha: OneMinusSrcAlphaFactor,
          // blendDst: OneFactor,
          // blendDstAlpha: OneMinusSrcAlphaFactor,
          // blendEquation: AddEquation,
          // blendEquationAlpha: AddEquation,
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
    transform,
    ink,
    brushSetting,
    destSize,
  }: BrushContext<ScatterBrush.SpecificSetting>) {
    const specific = mergeToNew(
      this.getInitialSpecificConfig(),
      brushSetting.specific
    )

    logGroup('ScatterBrush')

    const { color } = brushSetting

    // #region Building path for instancing
    const threePath = new ThreePath()
    threePath.arcLengthDivisions = 10

    const [start] = inputPath.points

    threePath.moveTo(start.x / destSize.width, start.y / destSize.height)

    logTime('Scatter: mapPoints')

    inputPath.mapPoints(
      (point, prev) => {
        threePath.bezierCurveTo(
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

    logTimeEnd('Scatter: mapPoints')

    if (inputPath.closed) {
      threePath.closePath()
    }

    const freezedThreePath = freezeThreePath(threePath)

    // #endregion

    const material = this.materials[specific.texture]
    material.needsUpdate = true
    material.color.set(new Color(color.r, color.g, color.b))

    // material.onBeforeCompile = (shader) => {
    //   console.log({ shader })
    // }

    let counts = Math.ceil(threePath.getLength() * specific.divisions)

    const opacities = new Float32Array(counts)
    const mesh = new InstancedMesh(this.geometry, material, counts)
    const group = new Group()
    // mesh.matrix = new Matrix4().fromArray(matrix)
    // mesh.matrix.makeScale(2, 2, 1)

    const seed = fastRandom(inputPath.randomSeed)
    const pointsReader = inputPath.getSequencialPointsReader()
    const pressureReader = inputPath.getSequencialPressuresReader()
    const tangentReader = inputPath.getSequencialTangentsReader()
    // const totalLength = inputPath.getTotalLength()

    const perf_misc = timeSumming(`misc at will calls ${counts} times`)
    const perf_getPoint = timeSumming(`getPoint at will calls ${counts} times`)
    const perf_pressureAtTime = timeSumming(
      `Pressure at will calls ${counts} times`
    )
    const perf_getTangentByPath = timeSumming(
      `getTangentAtByPath at will calls ${counts} times`
    )
    const perf_setMatrixAt = timeSumming(
      `setMatrixAt at will calls ${counts} times`
    )
    const perf_rand = timeSumming(`devRand at will calls ${counts} times`)
    const perf_render = timeSumming(`Render with ${counts} instances`)

    logTime('Scatter: set atributes')

    const points = []
    for (let idx = 0; idx < counts; idx++) {
      const frac = idx / counts

      // const pos = new Vector3()
      // const quat = new Quaternion()
      // const scale = new Vector3()

      perf_rand.time()
      const randomFloat = seed.nextFloat()
      perf_rand.timeEnd()

      perf_getPoint.time()
      freezedThreePath.sequencialGetPoint(frac, _translate2d)
      perf_getPoint.timeEnd({ frac, index: idx })

      _object.position.set(
        MathUtils.lerp(-destSize.width / 2, destSize.width / 2, _translate2d.x),
        MathUtils.lerp(
          destSize.height / 2,
          -destSize.height / 2,
          _translate2d.y
        ),
        0
      )

      // pos.set(
      //   MathUtils.lerp(-destSize.width / 2, destSize.width / 2, _translate2d.x),
      //   MathUtils.lerp(
      //     destSize.height / 2,
      //     -destSize.height / 2,
      //     _translate2d.y
      //   ),
      //   0
      // )

      // prettier-ignore
      const fadeWeight =
        frac <= .15 ? MathUtils.lerp(1 - specific.inOutInfluence, 1, Math.min(frac, .15) / .15)
        : frac >= (1 - .15) ? MathUtils.lerp(1 - specific.inOutInfluence, 1, Math.min(1 - frac, 0.15) / 0.15)
        : 1

      perf_pressureAtTime.time()
      const pressureWeight =
        0.2 +
        0.8 * (1 - specific.pressureInfluence) +
        pressureReader.getPressureAt(frac) * 0.8 * specific.pressureInfluence
      perf_pressureAtTime.timeEnd({ frac, index: idx })

      // fade(1) * influence(1) = 1 入り抜き影響済みの太さ
      // fade(1) * influence(0) = 0 入り抜き影響済みの太さ
      // (size * pressure) * (fade * influence)
      // (fade * influence) = 0 のときにsize * pressureになってほしいな(こなみ)
      // (fade * influence) = 0
      // 打ち消し式: (fade * influence) + 1 = 1
      // scale.set(
      //   brushSetting.size * pressureWeight * fadeWeight,
      //   brushSetting.size * pressureWeight * fadeWeight,
      //   1
      // )

      _object.scale.set(
        brushSetting.size * pressureWeight * fadeWeight,
        brushSetting.size * pressureWeight * fadeWeight,
        1
      )

      perf_getTangentByPath.time()
      const tangent = tangentReader.getTangentAt(frac)

      perf_getTangentByPath.timeEnd({ frac, idx, counts })

      const angle = Math.atan2(tangent.x, tangent.y)

      _object.rotation.z = degToRad(
        radToDeg(angle) + -1 + randomFloat * 360 * specific.randomRotation
      )
      // quat.z = degToRad(
      //   radToDeg(angle) + -1 + randomFloat * 360 * specific.randomRotation
      // )

      _object.translateX(
        lerp(-specific.scatterRange, specific.scatterRange, Math.cos(angle))
      )
      _object.translateY(
        lerp(-specific.scatterRange, specific.scatterRange, Math.sin(angle))
      )

      perf_misc.time()

      perf_setMatrixAt.time()
      _object.updateMatrix()

      // points.push(_object.position.toArray())

      mesh.setMatrixAt(idx, _object.matrix)
      perf_setMatrixAt.timeEnd()

      // opacities[idx] = fadeWeight
      perf_misc.timeEnd()
    }
    logTimeEnd('Scatter: set atributes')

    perf_getPoint.log()
    perf_getTangentByPath.log()
    perf_pressureAtTime.log()
    perf_rand.log()
    perf_misc.log()
    perf_setMatrixAt.log()

    // this.geometry.setAttribute(
    //   'opacities',
    //   new InstancedBufferAttribute(opacities, 1)
    // )
    // this.geometry.attributes.opacities.needsUpdate = true
    perf_render.time()

    group.scale.set(transform.scale.x, transform.scale.y, 1)
    group.position.set(transform.translate.x, -transform.translate.y, 0)
    group.rotateZ(transform.rotate)
    group.add(mesh)

    // this.scene.add(mesh)
    this.scene.add(group)
    renderer.render(this.scene, camera)

    perf_render.timeEnd()
    perf_render.log()

    ctx.globalAlpha = brushSetting.opacity
    ctx.strokeStyle = 'rgb(255,0,0)'
    ctx.lineWidth = 3
    ctx.strokeRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.drawImage(renderer.domElement, 0, 0)

    // this.scene.remove(mesh)
    this.scene.remove(group)
    logGroupEnd()
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

const freezeThreePath = (path: ThreePath) => {
  const lengthIndex = path.getCurveLengths()

  path.curves.forEach((curve, idx) => {
    curve.arcLengthDivisions = 10

    const lengths = curve.getLengths()
    curve.getLengths = () => lengths

    const length = curve.getLength()
    curve.getLength = () => length
  })

  const pathLength = path.getLength()
  path.getLength = () => pathLength

  // https://github.com/mrdoob/three.js/blob/master/src/extras/core/CurvePath.js#L51
  path.getPoint = (() => {
    return (t: number, target?: THREE.Vector2) => {
      const d = t * path.getLength()
      const near = binarySearch(lengthIndex, d)

      let i = near

      while (i < lengthIndex.length) {
        if (lengthIndex[i] >= d) {
          const diff = lengthIndex[i] - d
          const curve = path.curves[i]

          const segmentLength = curve.getLength()
          const u = segmentLength === 0 ? 0 : 1 - diff / segmentLength

          return curve.getPointAt(u, target)
        }

        i++
      }

      return null
    }
  })()

  // const createSeqGetPointAt = (path: ThreePath) => {
  //   let lastCurveIndex: number

  //   const methods = {
  //     getPoint: (t: number, target?: Vector2) => {
  //       const d = t * path.getLength()
  //       const near = binarySearch(lengthIndex, d)

  //       let i = near

  //       while (i < lengthIndex.length) {
  //         if (lengthIndex[i] >= d) {
  //           const diff = lengthIndex[i] - d
  //           const curve = path.curves[i]

  //           const segmentLength = curve.getLength()
  //           const u = segmentLength === 0 ? 0 : 1 - diff / segmentLength

  //           // return curve.getPointAt(u, target)
  //           return curve.getPoi(u, target)
  //         }

  //         i++
  //       }

  //       return null
  //     },
  //     getPointAt: (u: number, target?: Vector2) => {
  //       const t = getUtoTmapping(u)
  //       return methods.getPoint(t, target)
  //     },
  //   }

  //   return methods
  // }

  return {
    sequencialGetPoint: (() => {
      let lastT = 0
      let lastIndex = 0

      return (t: number, target: THREE.Vector2) => {
        if (t < lastT) throw new Error('t must be greater than lastT')

        const d = t * pathLength
        let i = lastIndex

        while (i < lengthIndex.length) {
          if (lengthIndex[i] >= d) {
            const diff = lengthIndex[i] - d
            const curve = path.curves[i]

            const segmentLength = curve.getLength()
            const u = segmentLength === 0 ? 0 : 1 - diff / segmentLength

            lastT = t
            lastIndex = i
            return curve.getPointAt(u, target)
          }

          i++
        }

        return null
      }
    })(),
    sequencialGetTangent: (() => {
      let lastT = 0

      return (t: number, target?: THREE.Vector2) => {
        if (t < lastT) throw new Error('t must be greater than lastT')

        const delta = 0.0001
        let t1 = lastT - delta
        let t2 = lastT + delta

        // Capping in case of danger

        if (t1 < 0) t1 = 0
        if (t2 > 1) t2 = 1

        const pt1 = path.getPoint(t1)
        const pt2 = path.getPoint(t2)

        const tangent =
          target || (pt1.isVector2 ? new Vector2() : new Vector3())

        tangent.copy(pt2).sub(pt1).normalize()

        lastT = t
        return tangent
      }
    })(),
  }
}

// SEE: https://stackoverflow.com/questions/60343999/binary-search-in-typescript-vs-indexof-how-to-get-performance-properly
function binarySearch(sortedArray: number[], seekElement: number): number {
  let startIndex = 0
  let endIndex: number = sortedArray.length - 1
  let minNearIdx: number = 0

  while (startIndex <= endIndex) {
    const mid = startIndex + Math.floor((endIndex - startIndex) / 2)
    const guess = sortedArray[mid]
    if (guess === seekElement) {
      return mid
    } else if (guess > seekElement) {
      minNearIdx = endIndex = mid - 1
    } else {
      startIndex = mid + 1
    }
  }

  return minNearIdx!
}
