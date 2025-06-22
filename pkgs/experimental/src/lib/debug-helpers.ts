/**
 * デバッグヘルパー関数
 */

export async function saveDebugData({
  filename,
  json,
}: {
  filename: string
  json: any
}): Promise<void> {
  try {
    await fetch('/api/debug/save-json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, data: json }),
    })
  } catch (error) {
    console.error(`Failed to save debug data to ${filename}:`, error)
  }
}

export function resetDebugFlags(): void {
  if (typeof window !== 'undefined') {
    ;(window as any).__strokeRenderDebugSaved = false(
      window as any,
    ).__documentDebugSaved = false
  }
}

export function logStrokeDebug(message: string, data?: any): void {
  const timestamp = new Date().toISOString()
  console.log(`[StrokeDebug ${timestamp}] ${message}`, data)
}
