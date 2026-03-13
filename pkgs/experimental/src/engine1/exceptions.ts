export const ErrorCode = {
  WebGPUDeviceNotAvailable: 'WEBGPU_DEVICE_NOT_AVAILABLE',
  EngineAppearanceError: 'ENGINE_APPEARANCE_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ErrorMessages = {
  [ErrorCode.WebGPUDeviceNotAvailable]: 'WebGPU device is not available.',
  [ErrorCode.EngineAppearanceError]: 'Cause Error in Appearance Processing',
} satisfies Record<ErrorCode, string>;

class PaplicoError extends Error {
  constructor(
    message: string,
    options?: ErrorOptions & { paplicoCode?: ErrorCode },
  ) {
    super(message, options);
    this.name = 'PaplicoError';
  }
}

export class EngineError extends PaplicoError {
  constructor(code: ErrorCode, options?: ErrorOptions) {
    super(`EngineError: ${ErrorMessages[code]}`, {
      ...options,
      paplicoCode: code,
    });
    this.name = 'EngineError';
  }
}

export class AppearanceError extends PaplicoError {
  constructor(message: string, options?: ErrorOptions) {
    super(
      `AppearanceError: ${ErrorMessages[ErrorCode.EngineAppearanceError]}: ${message}`,
      {
        ...options,
        cause: message,
      },
    );
    this.name = 'AppearanceError';
  }
}
