import { Matrix4 } from '@/Math'
import { Matrix4 as ThreeMatrix4 } from 'three'

describe('Matrix4', () => {
  it('Should match to three.js Matrix4', () => {
    const mat4 = new Matrix4()
    const threeMat4 = new ThreeMatrix4()

    mat4.translate(1, 2, 3)
    threeMat4.makeTranslation(1, 2, 3)

    expect(mat4.toArray()).toEqual(threeMat4.toArray())
  })
})
