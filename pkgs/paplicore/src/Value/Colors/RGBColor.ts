export type RGBColor = {
  /** 0..1 */
  r: number
  /** 0..1 */
  g: number
  /** 0..1 */
  b: number
}

// export class RGBColor {
//   public static deserialize(obj: any) {
//     return assign(new RGBColor(), { r: obj.r, g: obj.g, b: obj.b })
//   }

//   public static create({ r, g, b }: { r: number; g: number; b: number }) {
//     return assign(new RGBColor(), { r, g, b })
//   }

//   public readonly type = 'RGBColor'

//   /** 0..1 */
//   public readonly r: number = 0
//   /** 0..1 */
//   public readonly g: number = 0
//   /** 0..1 */
//   public readonly b: number = 0

//   public serialize() {
//     return {
//       r: this.r,
//       g: this.g,
//       b: this.b,
//     }
//   }
// }
