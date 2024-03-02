import { BufferGeometry } from './Geometry/BufferGeometry'

export function createPlaneGeometry(
  width: number,
  height: number,
): BufferGeometry {
  const hw = width / 2
  const hh = height / 2

  return new BufferGeometry(
    // prettier-ignore
    [
      -hw, -hh, 0,
      hw, -hh, 0,
      hw, hh, 0,

      hw, hh, 0,
      -hw, hh, 0,
      -hw, -hh, 0,
    ],
    [0, 1, 2, 2, 3, 0],
  )
}
