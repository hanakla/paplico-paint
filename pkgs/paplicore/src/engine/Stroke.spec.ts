import { Stroke } from './Stroke'

describe('Stroke', () => {
  it('get path', () => {
    const stroke = new Stroke()
    stroke.points.push(
      [0, 0, 0.2, 0],
      [-10, 10, 0.4, 2],
      [40, 15, 0.9, 4],
      [-20, 20, 0.8, 8],
      [50, 50, 0.2, 16]
    )

    expect(stroke.splinedPath).toMatchInlineSnapshot(`
Path {
  "_cachedBounds": null,
  "_cachedSvgPath": null,
  "_isFreezed": false,
  "closed": false,
  "points": [
    {
      "in": null,
      "out": null,
      "pressure": 0.2,
      "x": 0,
      "y": 0,
    },
    {
      "in": {
        "x": -16.666666666666668,
        "y": 7.5,
      },
      "out": {
        "x": -3.3333333333333335,
        "y": 12.5,
      },
      "pressure": 0.4,
      "x": -10,
      "y": 10,
    },
    {
      "in": {
        "x": 41.666666666666664,
        "y": 13.333333333333334,
      },
      "out": {
        "x": 38.333333333333336,
        "y": 16.666666666666668,
      },
      "pressure": 0.9,
      "x": 40,
      "y": 15,
    },
    {
      "in": {
        "x": -21.666666666666668,
        "y": 14.166666666666666,
      },
      "out": {
        "x": -18.333333333333332,
        "y": 25.833333333333332,
      },
      "pressure": 0.8,
      "x": -20,
      "y": 20,
    },
    {
      "in": {
        "x": 38.333333333333336,
        "y": 45,
      },
      "out": null,
      "pressure": 0.2,
      "x": 50,
      "y": 50,
    },
  ],
  "randomSeed": 2357136044,
}
`)
  })
})
