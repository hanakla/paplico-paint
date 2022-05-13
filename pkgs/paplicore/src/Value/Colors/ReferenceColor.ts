import { assign } from '../../utils/object'
import { IColor } from './IColor'

export class ReferenceColor implements IColor {
  public static create({ referenceId }: { referenceId: string }) {
    return assign(new ReferenceColor(), { referenceId })
  }

  public static deserialize(obj: any) {
    return assign(new ReferenceColor(), { referenceId: obj.referenceId })
  }

  public readonly type = 'ReferenceColor'
  public referenceId!: string

  public serialize() {
    return { referenceId: this.referenceId }
  }
}
