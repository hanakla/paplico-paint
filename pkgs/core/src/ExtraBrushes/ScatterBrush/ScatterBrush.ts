import { BrushContext, BrushLayoutData, IBrush, StrokingHelper } from '@/index'
import * as Textures from './textures/index'
import { PaplicoAbortError } from '@/Errors'
import { mergeToNew } from '@/utils/object'
import {
  AddEquation,
  CanvasTexture,
  Color,
  CustomBlending,
  Group,
  InstancedMesh,
  Matrix4 as ThreeMatrix4,
  MeshBasicMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  Scene,
} from 'three'
import ScatterBrushWorker from './ScatterBrush-worker?worker&inline'
import {
  type GetPointWorkerResponse,
  type Payload,
  type WorkerResponse,
} from './ScatterBrush-worker'
import { ColorRGBA } from '@/Document'

const _mat4 = new ThreeMatrix4()

const generateId = () => (Date.now() + Math.random()).toString(36)

export declare namespace ScatterBrush {
  export type SpecificSetting = Partial<{
    texture: keyof typeof Textures
    divisions: number
    scatterRange: number
    /** Adjust rate particle to path curve (0..1) */
    rotationAdjust: number
    /** 0..1 */
    randomRotation: number
    /** 0..1, each particle scale randomize range */
    randomScale: number
    /** Influence of stroke in / out weight. 0..1 */
    inOutInfluence: number
    /** In / out length */
    inOutLength: number
    /** 0..1 */
    pressureInfluence: number
    /** 0..1 */
    noiseInfluence: number
  }>
}

export class ScatterBrush implements IBrush {
  static id = '@paplico/core/extras/scatter-brush'

  public get id() {
    return ScatterBrush.id
  }

  public getInitialSpecificConfig(): ScatterBrush.SpecificSetting {
    return {
      texture: 'pencil',
      divisions: 1000,
      scatterRange: 0.5,
      rotationAdjust: 1,
      randomRotation: 0,
      randomScale: 0,
      inOutInfluence: 1,
      inOutLength: 100,
      pressureInfluence: 0.8,
      noiseInfluence: 0,
    }
  }

  protected worker: Worker | null = null
  protected textures: { [name: string]: ImageBitmap } = {}
  protected materials: { [name: string]: MeshBasicMaterial } = {}

  public async initialize(context: {}): Promise<void> {
    this.worker = await this.createWorker()

    await Promise.all(
      Object.entries(Textures).map(async ([name, url]) => {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = (e) => reject(e)
          img.src = url
        })

        // const c = CanvasFactory.createCanvas()
        // const ctx = c.getContext('2d')!
        // c.width = img.width
        // c.height = img.height
        // ctx.drawImage(img, 0, 0)

        // const data = ctx.getImageData(0, 0, c.width, c.height)
        // for (let i = 0; i < data.data.length; i += 4) {
        //   data.data[i + 3] = data.data[i]
        // }
        // ctx.putImageData(data, 0, 0)

        const texture = new CanvasTexture(img)
        this.materials[name] = new MeshBasicMaterial({
          color: 0xffffff,

          premultipliedAlpha: true,
          transparent: true,
          alphaMap: texture,

          blending: CustomBlending,
          blendSrc: OneFactor,
          blendDst: OneMinusSrcAlphaFactor,
          blendSrcAlpha: OneFactor,
          blendDstAlpha: OneMinusSrcAlphaFactor,
          blendEquation: AddEquation,
        })

        // this.materials[name] = new ShaderMaterial({
        //   uniforms: {
        //     texture: { value: texture },
        //     // color: { value: new Color(0xffffff) },
        //   },
        //   vertexShader: VS,
        //   fragmentShader: FS,
        //   vertexColors: true,
        //   depthTest: true,
        // })

        // this.textures[name] = await createImageBitmap(data)
      }),
    )
  }

  protected async renderWithWorker({
    abort,
    abortIfNeeded,
    context: ctx,
    path: inputPath,
    transform,
    ink,
    brushSetting: { size, color, opacity, specific },
    threeRenderer,
    threeCamera,
    destSize,
    phase,
  }: BrushContext<ScatterBrush.SpecificSetting>): Promise<BrushLayoutData> {
    const sp = mergeToNew(this.getInitialSpecificConfig(), specific)
    const baseColor: ColorRGBA = { ...color, a: opacity }
    const _color = new Color()

    const bbox: BrushLayoutData['bbox'] = {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    }

    for (const path of inputPath) {
      abortIfNeeded()

      // const { points, closed } = path
      const id = generateId()

      let res
      try {
        res = await new Promise<GetPointWorkerResponse>((r, reject) => {
          const receiver = (e: MessageEvent<WorkerResponse>) => {
            if (e.data.type === 'aborted' && e.data.id === id) {
              reject(new PaplicoAbortError())
            }

            if (e.data.type !== 'getPoints' || e.data.id !== id) return

            r(e.data)
            this.worker!.removeEventListener('message', receiver)
          }

          const onAbort = () => {
            this.worker!.postMessage({
              type: 'aborted',
              id
            } as const satisfies Payload)
          }

          abort.addEventListener('abort', onAbort, { once: true })
          this.worker!.addEventListener('message', receiver)

          this.worker!.postMessage({
            id,
            type: 'getPoints',
            path,
            // closed,
            brushSize: size,
            destSize,
            scatterRange: sp.scatterRange ?? 0,
            inOutInfluence: sp.inOutInfluence ?? 0,
            inOutLength: sp.inOutLength ?? 0,
            scatterScale: 1,
          } satisfies Payload)
        })
      } catch (e) {
        // console.info(e)
        throw e
      }

      if (res.matrices == null) return { bbox }
      // console.log({ res })

      const scene = new Scene()
      const material = this.materials[sp.texture]
      // material.color.set(new Color(color.r, color.g, color.b))
      material.needsUpdate = true

      const group = new Group()
      const geometry = new PlaneGeometry(1, 1)
      const mesh = new InstancedMesh(geometry, material, res.matrices.length)

      mesh.matrixAutoUpdate = false
      mesh.instanceMatrix.needsUpdate = false

      ctx.fillStyle = 'rgb(0,255,255)'
      for (let i = 0, l = res.matrices.length; i < l; i++) {
        // render circle at res.position[i]
        // ctx.beginPath()

        // ctx.arc(
        //   res._internals.positions[i][0],
        //   res._internals.positions[i][1],
        //   1,
        //   0,
        //   Math.PI * 2,
        // )
        // ctx.closePath()
        // ctx.fill()

        _mat4.fromArray(res.matrices[i])
        mesh.setMatrixAt(i, _mat4)
        mesh.setColorAt(
          i,
          StrokingHelper.rgbToThreeRGB(
            // ink.getColor({
            //   pointIndex: i,
            //   points: path.points,
            //   pointAtLength: res.lengths[i],
            //   totalLength: res.totalLength,
            //   baseColor
            // }),
            {
              r: i / l,
              g: 1 - i / l,
              b: 0,
            },
            _color,
          ),
        )
      }

      if (res.bbox) {
        bbox.left = Math.min(bbox.left, res.bbox.left)
        bbox.top = Math.min(bbox.top, res.bbox.top)
        bbox.right = Math.max(bbox.right, res.bbox.right)
        bbox.bottom = Math.max(bbox.bottom, res.bbox.bottom)
      }

      group.add(mesh)
      group.scale.set(transform.scale.x, transform.scale.y, 1)
      group.position.set(transform.translate.x, -transform.translate.y, 0)
      // group.rotation.set(transform.rotate)

      scene.add(group)
      threeRenderer.render(scene, threeCamera)
      ctx.drawImage(threeRenderer.domElement, 0, 0)
    }

    return {
      bbox: {
        left: bbox.left - destSize.width / 2,
        top: bbox.top - destSize.height / 2,
        right: bbox.right + destSize.width / 2,
        bottom: bbox.bottom + destSize.height / 2,
      },
    }
  }

  public async render(
    ctx: BrushContext<ScatterBrush.SpecificSetting>,
  ): Promise<BrushLayoutData> {
    return this.renderWithWorker(ctx)
    // const interX = interpolateMapObject(points, (idx, arr) => arr[idx].x)
    // const interY = interpolateMapObject(points, (idx, arr) => arr[idx].y)
    // let idx = 0
    // for (let len = 0; len <= totalLen; len += step) {
    //   const t = len / totalLen
    //   const [x, y] = [interX(t), interY(t)]
    //   const rad = StrokingHelper.getRadianFromTangent(
    //     { x, y },
    //     { x: interX(t + 0.01), y: interY(t + 0.01) }
    //   )
    //   const ypos = y / destSize.height
    //   const matt4 = new Matrix4()
    //     .translate(
    //       x - destSize.width / 2,
    //       (1 - ypos) * destSize.height - destSize.height / 2,
    //       0
    //     )
    //     .rotateZ(rad)
    //   _mat4.fromArray(matt4.toArray())
    //   mesh.setMatrixAt(idx, _mat4)
    //   idx++
    //   bbox.left = Math.min(bbox.left, x)
    //   bbox.top = Math.min(bbox.top, y)
    //   bbox.right = Math.max(bbox.right, x)
    //   bbox.bottom = Math.max(bbox.bottom, y)
    // }
    //   group.add(mesh)
    //   group.scale.set(transform.scale.x, transform.scale.y, 1)
    //   group.position.set(transform.translate.x, -transform.translate.y, 0)
    //   // group.rotation.set(transform.rotate)
    //   scene.add(group)
    //   threeRenderer.render(scene, threeCamera)
    //   ctx.drawImage(threeRenderer.domElement, 0, 0)
    // }
    // return {
    //   bbox: {
    //     left: bbox.left - destSize.width / 2,
    //     top: bbox.top - destSize.height / 2,
    //     right: bbox.right + destSize.width / 2,
    //     bottom: bbox.bottom + destSize.height / 2,
    //   },
    // }
  }

  protected async createWorker() {
    const worker = new ScatterBrushWorker()

    return await new Promise<Worker>((r, rj) => {
      const listener = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.type !== 'warming') return
        r(worker)
      }

      const onError = (e: ErrorEvent) => {
        rj(new Error(e.message, { cause: e }))
      }

      worker.addEventListener('error', onError, { once: true })
      worker.addEventListener('message', listener, { once: true })
      worker.postMessage({ type: 'warming' })
    })
  }
}

// export const ScatterBrush = createCustomBrush(

//

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest!

  describe('ScatterBrush', () => {
    it('Should convert pixel point to gl point', () => {
      const height = 200
      ;[
        [0, 100],
        [100, 0],
        [200, -100],
      ].forEach(([y, mapped]) => {
        const pos = y / height
        const result = (1 - pos) * height - height / 2
        expect(result).toBe(mapped)
      })
    })
  })
}
