export const catchToLog = (fn: () => undefined | void) => {
  try {
    return fn()
  } catch (e) {
    console.error(e)
  }
}
