type SuccessResult<T> = readonly [result: T, error: null] & {
  success: true
  result: T
  error: null
}

type FailureResult<T> = readonly [result: null, error: Error] & {
  success: false
  result: null
  error: Error
}
type Result<T> = SuccessResult<T> | FailureResult<T>

interface ResqueOption<T extends ErrorConstructor = any> {
  expects?: T[]
}

interface Resque {
  <T>(proc: () => Promise<T>, option?: ResqueOption): Promise<Result<T>>
  <T>(proc: () => T, option?: ResqueOption): Result<T>
  <T>(
    proc: () => T | Promise<T>,
    option?: ResqueOption,
  ): Promise<Result<T>> | Result<T>
  isFailure(result: Result<any>): result is FailureResult<null>
  isSuccess(result: Result<any>): result is SuccessResult<any>
}

const createResult = (result: any = null, error: any = null): Result<any> =>
  Object.assign([result, error] as const, {
    success: error == null,
    result,
    error,
  })

const isExpectedError = (actual: unknown, expects: any[]) => {
  if (expects.length === 0) return true
  return expects.some((E) => actual instanceof E)
}

export const rescue: Resque = <T extends Promise<any> | any>(
  proc: () => T,
  { expects = [] }: ResqueOption = {},
): any => {
  try {
    const result = proc()

    if (result instanceof Promise) {
      return new Promise<any>((resolve) => {
        result
          .then((r) => {
            resolve(createResult(r))
          })
          .catch((e) => {
            if (!isExpectedError(e, expects)) {
              throw e
            }
            resolve(createResult(null, e))
          })
      })
    }

    return createResult(result)
  } catch (e) {
    if (!isExpectedError(e, expects)) {
      throw e
    }

    return createResult(null, e)
  }
}

rescue.isFailure = (result: Result<any>): result is FailureResult<null> =>
  result.error != null
rescue.isSuccess = (result: Result<any>): result is SuccessResult<any> =>
  result.error == null
