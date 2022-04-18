// import { screenMix_func } from '../engine/Shaders'
import { FilterContext, FilterInitContext, IFilter } from '../engine/IFilter'
// import { WebGLContext } from '../engine/WebGLContext'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader'
import { HalftonePass } from './HalfTone/HalftonePass'
import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Scene,
} from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass'

export class HalftoneFilter implements IFilter {
  public static readonly id = '@silk-core/halftone'

  public get id() {
    return HalftoneFilter.id
  }

  public get initialConfig() {
    return {
      shape: 1,
      radius: 20,
      scatter: 0,
    }
  }

  // private program: WebGLContext.ProgramSet | null = null
  // private composer: EffectComposer
  private scene!: Scene

  public async initialize({ gl }: FilterInitContext) {
    this.scene = new Scene()

    // this.scene.add(this.mesh)
  }

  public async render({
    source,
    threeRenderer,
    threeCamera,
    dest,
    // gl,
    size,
    settings,
  }: FilterContext) {
    const geometry = new PlaneGeometry(size.width, size.height)

    const texture = new CanvasTexture(source)
    const mesh = new Mesh(
      geometry,
      new MeshBasicMaterial({ transparent: true, map: texture })
    )
    this.scene.add(mesh)

    const composer = new EffectComposer(threeRenderer)
    composer.addPass(new RenderPass(this.scene, threeCamera))

    composer.addPass(
      new HalftonePass(size.width, size.height, {
        ...settings,
        blending: 1,
        blendingMode: 1,
        disable: false,
      })
    )

    composer.render()
    const ctx = dest.getContext('2d')!
    ctx.clearRect(0, 0, size.width, size.height)
    ctx.drawImage(threeRenderer.domElement, 0, 0)

    this.scene.remove(mesh)
  }
}
