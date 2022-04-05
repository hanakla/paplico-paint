import { rgba } from 'polished'
import simplify from 'simplify-js'
import { BrushContext, IBrush } from '../engine/IBrush'
import {
  InstancedMesh,
  MathUtils,
  Matrix4,
  MeshBasicMaterial,
  PlaneBufferGeometry,
  Scene,
  Texture,
  TextureLoader,
  Vector2,
  Path as ThreePath,
  Vector3,
  Euler,
  Quaternion,
  DynamicDrawUsage,
  Object3D,
  Color,
  StaticDrawUsage,
} from 'three'
import { Path } from 'SilkDOM'

const DOGE =
  'data:image/png;base64,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'

const _object = new Object3D()
const _translate2d = new Vector2()

export class ScatterBrush implements IBrush {
  public static readonly id = '@silk-paint/scatter-brush'

  public get id() {
    return ScatterBrush.id
  }

  private scene!: Scene
  private material!: MeshBasicMaterial
  private geometry!: PlaneBufferGeometry
  private texture!: Texture
  private mesh!: InstancedMesh

  public async initialize() {
    this.scene = new Scene()

    const texture = (this.texture = await new Promise<THREE.Texture>((r) =>
      new TextureLoader().load(DOGE, r)
    ))

    this.material = new MeshBasicMaterial({
      // map: texture,
      // color: 0xffffff,
      transparent: true,
      alphaMap: texture,
    })

    this.geometry = new PlaneBufferGeometry(1, 1)
    this.mesh = new InstancedMesh(this.geometry, this.material, 1)
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
  }

  public render({
    context: ctx,
    threeRenderer: renderer,
    threeCamera: camera,
    stroke,
    ink,
    brushSetting,
    destSize,
  }: BrushContext) {
    this.material.color = new Color(
      brushSetting.color.r,
      brushSetting.color.g,
      brushSetting.color.b
    )
    const path = new ThreePath()
    const [start] = stroke.splinedPath.points

    path.moveTo(start.x / destSize.width, start.y / destSize.height)

    stroke.splinedPath.mapPoints(
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

    const counts = Math.ceil(path.getLength() * 1000)
    const mesh = new InstancedMesh(this.geometry, this.material, counts)
    this.scene.add(mesh)

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
      _object.updateMatrix()

      mesh.setMatrixAt(idx, _object.matrix)
    }

    // console.time('PaL')
    // for (let p = 0, l = counts; p < l; p++) {
    //   const point = stroke.splinedPath.getPointAtLength(p * 10)
    //   console.log(point)

    //   _object.position.set(
    //     MathUtils.lerp(-size.width / 2, size.width / 2, point.x / size.width),
    //     MathUtils.lerp(
    //       size.height / 2,
    //       -size.height / 2,
    //       point.y / size.height
    //     ),
    //     0
    //   )
    //   _object.scale.set(brushSetting.size, brushSetting.size, 1)
    //   _object.updateMatrix()

    //   // _object.matrix.copy(_matrix)
    //   // console.log(_matrix.elements)
    //   mesh.setMatrixAt(p, _object.matrix)
    //   // mesh.setColorAt(1, new Color(Math.random(), Math.random(), Math.random()))
    // }
    // console.timeEnd('PaL')

    // points.forEach((p, i) => {
    //   _object.position.set(
    //     MathUtils.lerp(-size.width / 2, size.width / 2, p.x),
    //     MathUtils.lerp(size.height / 2, -size.height / 2, p.y),
    //     0
    //   )
    //   _object.scale.set(brushSetting.size, brushSetting.size, 1)
    //   _object.updateMatrix()

    //   // _object.matrix.copy(_matrix)
    //   // console.log(_matrix.elements)
    //   mesh.setMatrixAt(i, _object.matrix)
    //   // mesh.setColorAt(1, new Color(Math.random(), Math.random(), Math.random()))
    // })

    // mesh.setMatrixAt(0, new Matrix4().setPosition(0, 0, 0))
    // mesh.setMatrixAt(1, new Matrix4().setPosition(size.width, 0, 0))
    // mesh.setMatrixAt(2, new Matrix4().setPosition(0, size.height, 0))
    // mesh.setMatrixAt(3, new Matrix4().setPosition(size.width, size.height, 0))

    // mesh.setMatrixAt(4, new Matrix4().setPosition(-0.5, 0, 0))
    // mesh.setMatrixAt(5, new Matrix4().setPosition(0.5, 0, 0))
    // mesh.setMatrixAt(6, new Matrix4().setPosition(0, 0.5, 0))
    // mesh.setMatrixAt(7, new Matrix4().setPosition(0.5, 0.5, 0))

    // const material = new THREE.MeshBasicMaterial({ color: 0x000000 })
    // const sphere = new THREE.Line(new SphereGeometry(20), material)
    // sphere.position.set(0, 0, 2)
    // this.scene.add(sphere)

    // .set(
    //   brushSetting.size,
    //   brushSetting.size,
    //   // (this.texture.image.width / size.width) * brushSetting.size,
    //   // (this.texture.image.height / size.height) * brushSetting.size,
    //   10
    // )
    renderer.render(this.scene, camera)
    ctx.drawImage(renderer.domElement, 0, 0)

    this.scene.remove(mesh)
  }
}
