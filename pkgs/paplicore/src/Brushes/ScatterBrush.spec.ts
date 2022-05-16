import { Matrix4 } from 'math.gl'
import { Object3D } from 'three'
import { degToRad } from '../utils/math'

const deepToBeCloseTo = {
  expect(act: number[]) {
    return {
      toCloseTo: (exp: number[], numDigits: number) => {
        expect(act).toHaveLength(exp.length)
        exp.forEach((el, i) => expect(act[i]).toBeCloseTo(el, numDigits))
      },
    }
  },
}

describe('Transform points', () => {
  it('test', () => {
    const m = new Matrix4()
    const o = new Object3D()

    m.translate([10, 10, 0])
    o.translateX(10)
    o.translateY(10)
    o.updateMatrix()

    deepToBeCloseTo.expect(m.toArray()).toCloseTo(o.matrix.toArray(), 2)

    m.scale([0.5, 0.5, 1])
    o.scale.set(0.5, 0.5, 1)
    o.updateMatrix()

    deepToBeCloseTo.expect(m.toArray()).toCloseTo(o.matrix.toArray(), 2)

    m.rotateZ(degToRad(10))
    o.rotation.z = degToRad(10)
    o.updateMatrix()

    deepToBeCloseTo.expect(m.toArray()).toCloseTo(o.matrix.toArray(), 2)

    console.log(m.toArray())
    console.log(o.matrix.toArray())
  })
})
