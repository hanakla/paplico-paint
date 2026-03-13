import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type BrushSettings,
  StrokeRenderer,
} from './appearances/stroke-renderer';

// WebGPU関連のモック
const mockDevice = {
  createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
  createShaderModule: vi.fn(),
  createRenderPipeline: vi.fn(),
  createComputePipeline: vi.fn(),
  createSampler: vi.fn(),
  queue: { writeBuffer: vi.fn() },
} as any;

// navigator.gpu のモック
Object.defineProperty(global.navigator, 'gpu', {
  value: {
    getPreferredCanvasFormat: vi.fn(() => 'bgra8unorm'),
  },
  writable: true,
});

describe('StrokeRenderer ブラシ設定', () => {
  let strokeRenderer: StrokeRenderer;

  beforeEach(() => {
    vi.clearAllMocks();
    strokeRenderer = new StrokeRenderer(mockDevice);
  });

  it('デフォルトのブラシ設定が正しく設定される', () => {
    const defaultSettings = strokeRenderer.getBrushSettings();

    expect(defaultSettings.texture).toBe('pencil');
    expect(defaultSettings.scatterConfig?.spread).toBe(0.5);
    expect(defaultSettings.rotationAdjust).toBe(1);
    expect(defaultSettings.randomRotation).toBe(0);
    expect(defaultSettings.randomScale).toBe(0);
    expect(defaultSettings.inOutInfluence).toBe(1);
    expect(defaultSettings.inOutLength).toBe(100);
    expect(defaultSettings.divisions).toBe(1000);
    expect(defaultSettings.pressureInfluence).toBe(0.8);
    expect(defaultSettings.noiseInfluence).toBe(0);
  });

  it('カスタムブラシ設定が正しく適用される', () => {
    const customSettings: BrushSettings = {
      texture: 'airbrush',
      scatterConfig: {
        spread: 1.5,
        count: 5,
        sizeVariation: 0.2,
        opacityVariation: 0.1,
      },
      rotationAdjust: 0.8,
      randomRotation: 0.3,
      randomScale: 0.2,
      inOutInfluence: 0.7,
      inOutLength: 50,
      divisions: 1500,
      pressureInfluence: 0.9,
      noiseInfluence: 0.1,
    };

    strokeRenderer.setBrushSettings(customSettings);
    const appliedSettings = strokeRenderer.getBrushSettings();

    expect(appliedSettings.texture).toBe('airbrush');
    expect(appliedSettings.scatterConfig?.spread).toBe(1.5);
    expect(appliedSettings.rotationAdjust).toBe(0.8);
    expect(appliedSettings.randomRotation).toBe(0.3);
    expect(appliedSettings.randomScale).toBe(0.2);
    expect(appliedSettings.inOutInfluence).toBe(0.7);
    expect(appliedSettings.inOutLength).toBe(50);
    expect(appliedSettings.divisions).toBe(1500);
    expect(appliedSettings.pressureInfluence).toBe(0.9);
    expect(appliedSettings.noiseInfluence).toBe(0.1);
  });

  it('一部の設定だけを変更できる', () => {
    const partialSettings: Partial<BrushSettings> = {
      texture: 'airbrush',
      scatterConfig: {
        spread: 2.0,
        count: 10,
        sizeVariation: 0.3,
        opacityVariation: 0.2,
      },
    };

    strokeRenderer.setBrushSettings(partialSettings);
    const appliedSettings = strokeRenderer.getBrushSettings();

    expect(appliedSettings.texture).toBe('airbrush');
    expect(appliedSettings.scatterConfig?.spread).toBe(2.0);
    // デフォルトの値が維持される
    expect(appliedSettings.rotationAdjust).toBe(1);
    expect(appliedSettings.randomRotation).toBe(0);
  });

  it('GPU機能の利用可能性をチェックできる', () => {
    expect(strokeRenderer.isGPUComputeAvailable).toBe(false); // パイプライン未初期化のため
  });
});
