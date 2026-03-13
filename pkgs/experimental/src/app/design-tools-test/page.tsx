'use client';

import { useEffect, useRef, useState } from 'react';
import * as webgpuUtils from 'webgpu-utils';

// 型定義
interface BaseShape {
  id: string;
  type: 'rectangle' | 'ellipse' | 'text' | 'line' | 'group' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  selected: boolean;
  locked: boolean;
  visible: boolean;
  name: string;
  parentId: string | null;
  clipMask?: boolean;
}

interface Shape extends BaseShape {
  type: 'rectangle' | 'ellipse' | 'line' | 'image';
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius?: number;
  imageUrl?: string;
}

interface TextShape extends BaseShape {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fill: string;
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;
}

interface Group extends BaseShape {
  type: 'group';
  children: string[];
  isClipGroup?: boolean;
}

type ShapeObject = Shape | TextShape | Group;

interface Transform {
  x: number;
  y: number;
  scale: number;
}

type Tool = 'select' | 'rectangle' | 'ellipse' | 'text' | 'line' | 'pan';

type DragMode =
  | 'none'
  | 'move'
  | 'resize-tl'
  | 'resize-tr'
  | 'resize-bl'
  | 'resize-br'
  | 'resize-t'
  | 'resize-r'
  | 'resize-b'
  | 'resize-l';

interface ResizeHandle {
  x: number;
  y: number;
  cursor: string;
  type: DragMode;
}

// Figma風デザインツール（グループ対応版）
export default function FigmaClone() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [device, setDevice] = useState<GPUDevice | null>(null);
  const [context, setContext] = useState<GPUCanvasContext | null>(null);

  // アプリケーション状態（デフォルトLPデザインを初期値に）
  const [shapes, setShapes] = useState<ShapeObject[]>(getSampleData());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [transform, setTransform] = useState<Transform>({
    x: 0,
    y: 0,
    scale: 0.8,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [initialBounds, setInitialBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // WebGPU初期化
  useEffect(() => {
    async function init() {
      if (!navigator.gpu) {
        console.error('WebGPU not supported');
        return;
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return;

      const device = await adapter.requestDevice();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('webgpu');
      if (!context) return;

      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format,
        alphaMode: 'premultiplied',
      });

      setDevice(device);
      setContext(context);
    }

    init();
  }, []);

  // WebGPUレンダリングコード
  const shaderCode = `
    struct VertexOutput {
      @builtin(position) position: vec4<f32>,
      @location(0) uv: vec2<f32>,
    }

    struct Uniforms {
      transform: mat4x4<f32>,
      color: vec4<f32>,
      clipBounds: vec4<f32>, // x, y, width, height
      useClip: f32,
    }

    @group(0) @binding(0) var<uniform> uniforms: Uniforms;

    @vertex
    fn vs_main(@location(0) position: vec2<f32>) -> VertexOutput {
      var output: VertexOutput;
      output.position = uniforms.transform * vec4<f32>(position, 0.0, 1.0);
      output.uv = position;
      return output;
    }

    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
      if (uniforms.useClip > 0.5) {
        let clipX = uniforms.clipBounds.x;
        let clipY = uniforms.clipBounds.y;
        let clipW = uniforms.clipBounds.z;
        let clipH = uniforms.clipBounds.w;

        if (input.uv.x < clipX || input.uv.x > clipX + clipW ||
            input.uv.y < clipY || input.uv.y > clipY + clipH) {
          discard;
        }
      }

      return uniforms.color;
    }
  `;

  // レンダリングパイプライン
  const [pipeline, setPipeline] = useState<GPURenderPipeline | null>(null);
  const [shaderDataDefinitions, setShaderDataDefinitions] = useState<any>(null);

  useEffect(() => {
    if (!device) return;

    // webgpu-utilsを使ってシェーダーデータ定義を作成
    const defs = webgpuUtils.makeShaderDataDefinitions(shaderCode);
    setShaderDataDefinitions(defs);

    const shaderModule = device.createShaderModule({ code: shaderCode });

    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 8,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x2',
              },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });

    setPipeline(pipeline);
  }, [device]);

  // テキストをCanvas2Dで描画
  const drawTextOverlay = () => {
    const canvas = document.getElementById('text-overlay') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    shapes.forEach((shape) => {
      if (shape.type === 'text' && shape.visible) {
        const globalTransform = getGlobalTransform(shape);

        ctx.save();
        ctx.translate(
          (globalTransform.x + transform.x) * transform.scale,
          (globalTransform.y + transform.y) * transform.scale,
        );
        ctx.scale(transform.scale, transform.scale);

        ctx.font = `${shape.fontWeight} ${shape.fontSize}px ${shape.fontFamily}`;
        ctx.fillStyle = shape.fill;
        ctx.globalAlpha = shape.opacity;
        ctx.textAlign = shape.textAlign;
        ctx.textBaseline = 'top';

        const lines = shape.text.split('\n');
        lines.forEach((line, index) => {
          const y = index * shape.fontSize * shape.lineHeight;
          ctx.fillText(
            line,
            shape.textAlign === 'center' ? shape.width / 2 : 0,
            y,
          );
        });

        ctx.restore();
      }
    });
  };

  // グローバル変換を取得
  const getGlobalTransform = (shape: ShapeObject): { x: number; y: number } => {
    let x = shape.x;
    let y = shape.y;
    let currentShape = shape;

    while (currentShape.parentId) {
      const parent = shapes.find((s) => s.id === currentShape.parentId);
      if (parent) {
        x += parent.x;
        y += parent.y;
        currentShape = parent;
      } else {
        break;
      }
    }

    return { x, y };
  };

  // 子要素を取得
  const _getChildren = (parentId: string): ShapeObject[] => {
    return shapes.filter((shape) => shape.parentId === parentId);
  };

  // レンダリング順序を取得
  const getRenderOrder = (): ShapeObject[] => {
    const ordered: ShapeObject[] = [];
    const visited = new Set<string>();

    const visit = (shape: ShapeObject) => {
      if (visited.has(shape.id)) return;
      visited.add(shape.id);

      if (shape.type === 'group') {
        shape.children.forEach((childId) => {
          const child = shapes.find((s) => s.id === childId);
          if (child) visit(child);
        });
      }

      ordered.push(shape);
    };

    shapes.filter((s) => !s.parentId).forEach(visit);
    return ordered;
  };

  // レンダリングループ
  useEffect(() => {
    if (!device || !context || !pipeline || !shaderDataDefinitions) return;

    let animationId: number;

    const render = () => {
      const encoder = device.createCommandEncoder();
      const textureView = context.getCurrentTexture().createView();

      const renderPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            clearValue: { r: 0.95, g: 0.95, b: 0.95, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });

      // レンダリング順序に従って描画
      const renderOrder = getRenderOrder();

      renderOrder.forEach((shape) => {
        if (
          shape.type !== 'text' &&
          shape.type !== 'group' &&
          shape.visible &&
          shaderDataDefinitions
        ) {
          // クリップマスクを探す
          let clipBounds = null;
          if (shape.parentId) {
            const parent = shapes.find((s) => s.id === shape.parentId);
            if (parent?.type === 'group' && parent.isClipGroup) {
              const clip = getGlobalTransform(parent);
              clipBounds = {
                x: clip.x,
                y: clip.y,
                width: parent.width,
                height: parent.height,
              };
            }
          }

          renderShape(
            device,
            renderPass,
            pipeline,
            shape,
            transform,
            clipBounds,
          );
        }
      });

      renderPass.end();
      device.queue.submit([encoder.finish()]);

      // テキストオーバーレイを描画
      drawTextOverlay();

      // 選択ハンドルを描画
      drawSelectionHandles();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [
    device,
    context,
    pipeline,
    shapes,
    transform,
    shaderDataDefinitions, // 選択ハンドルを描画
    drawSelectionHandles, // テキストオーバーレイを描画
    drawTextOverlay,
    getGlobalTransform,
    getRenderOrder,
    renderShape,
  ]);

  // 図形描画関数
  function renderShape(
    device: GPUDevice,
    renderPass: GPURenderPassEncoder,
    pipeline: GPURenderPipeline,
    shape: Shape,
    transform: Transform,
    clipBounds: { x: number; y: number; width: number; height: number } | null,
  ) {
    if (!shaderDataDefinitions) return;

    // 頂点データ作成
    const vertices = createVertices(shape);
    const vertexBuffer = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertices);

    // グローバル座標を取得
    const globalPos = getGlobalTransform(shape);

    // 変換行列作成
    const transformMatrix = createTransformMatrix(
      { ...shape, x: globalPos.x, y: globalPos.y },
      transform,
    );
    const color = hexToRgba(shape.fill, shape.opacity);

    // webgpu-utilsを使ってユニフォームデータを作成
    const uniformValues = webgpuUtils.makeStructuredView(
      shaderDataDefinitions.uniforms.uniforms,
    );

    // transform行列を設定 (mat4x4)
    uniformValues.set({
      transform: transformMatrix,
      color: color,
      clipBounds: [
        clipBounds ? clipBounds.x : 0,
        clipBounds ? clipBounds.y : 0,
        clipBounds ? clipBounds.width : 0,
        clipBounds ? clipBounds.height : 0,
      ],
      useClip: clipBounds ? 1 : 0,
    });

    // ユニフォームバッファ作成
    const uniformBuffer = device.createBuffer({
      size: uniformValues.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: uniformBuffer },
        },
      ],
    });

    renderPass.setPipeline(pipeline);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(vertices.length / 2);
  }

  // 選択ハンドルを描画
  const drawSelectionHandles = () => {
    const canvas = document.getElementById(
      'selection-overlay',
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (selectedIds.length === 0) return;

    // 選択されたオブジェクトの境界ボックスを計算
    const selectedShapes = shapes.filter((s) => selectedIds.includes(s.id));
    if (selectedShapes.length === 0) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    selectedShapes.forEach((shape) => {
      const globalPos = getGlobalTransform(shape);
      minX = Math.min(minX, globalPos.x);
      minY = Math.min(minY, globalPos.y);
      maxX = Math.max(maxX, globalPos.x + shape.width);
      maxY = Math.max(maxY, globalPos.y + shape.height);
    });

    const x = (minX + transform.x) * transform.scale;
    const y = (minY + transform.y) * transform.scale;
    const width = (maxX - minX) * transform.scale;
    const height = (maxY - minY) * transform.scale;

    ctx.save();

    // 選択枠
    ctx.strokeStyle = '#0084ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    // リサイズハンドル
    const handleSize = 8;
    const handles: ResizeHandle[] = [
      {
        x: x - handleSize / 2,
        y: y - handleSize / 2,
        cursor: 'nw-resize',
        type: 'resize-tl',
      },
      {
        x: x + width - handleSize / 2,
        y: y - handleSize / 2,
        cursor: 'ne-resize',
        type: 'resize-tr',
      },
      {
        x: x - handleSize / 2,
        y: y + height - handleSize / 2,
        cursor: 'sw-resize',
        type: 'resize-bl',
      },
      {
        x: x + width - handleSize / 2,
        y: y + height - handleSize / 2,
        cursor: 'se-resize',
        type: 'resize-br',
      },
      {
        x: x + width / 2 - handleSize / 2,
        y: y - handleSize / 2,
        cursor: 'n-resize',
        type: 'resize-t',
      },
      {
        x: x + width - handleSize / 2,
        y: y + height / 2 - handleSize / 2,
        cursor: 'e-resize',
        type: 'resize-r',
      },
      {
        x: x + width / 2 - handleSize / 2,
        y: y + height - handleSize / 2,
        cursor: 's-resize',
        type: 'resize-b',
      },
      {
        x: x - handleSize / 2,
        y: y + height / 2 - handleSize / 2,
        cursor: 'w-resize',
        type: 'resize-l',
      },
    ];

    ctx.fillStyle = '#0084ff';
    handles.forEach((handle) => {
      ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
      ctx.strokeStyle = 'white';
      ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
    });

    ctx.restore();
  };

  // リサイズハンドルのヒットテスト
  const getHandleUnderMouse = (clientX: number, clientY: number): DragMode => {
    if (selectedIds.length === 0) return 'none';

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return 'none';

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const selectedShapes = shapes.filter((s) => selectedIds.includes(s.id));
    if (selectedShapes.length === 0) return 'none';

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    selectedShapes.forEach((shape) => {
      const globalPos = getGlobalTransform(shape);
      minX = Math.min(minX, globalPos.x);
      minY = Math.min(minY, globalPos.y);
      maxX = Math.max(maxX, globalPos.x + shape.width);
      maxY = Math.max(maxY, globalPos.y + shape.height);
    });

    const sx = (minX + transform.x) * transform.scale;
    const sy = (minY + transform.y) * transform.scale;
    const sw = (maxX - minX) * transform.scale;
    const sh = (maxY - minY) * transform.scale;

    const handleSize = 8;

    // 角のハンドル
    if (Math.abs(x - sx) < handleSize && Math.abs(y - sy) < handleSize)
      return 'resize-tl';
    if (Math.abs(x - (sx + sw)) < handleSize && Math.abs(y - sy) < handleSize)
      return 'resize-tr';
    if (Math.abs(x - sx) < handleSize && Math.abs(y - (sy + sh)) < handleSize)
      return 'resize-bl';
    if (
      Math.abs(x - (sx + sw)) < handleSize &&
      Math.abs(y - (sy + sh)) < handleSize
    )
      return 'resize-br';

    // 辺のハンドル
    if (
      Math.abs(x - (sx + sw / 2)) < handleSize &&
      Math.abs(y - sy) < handleSize
    )
      return 'resize-t';
    if (
      Math.abs(x - (sx + sw)) < handleSize &&
      Math.abs(y - (sy + sh / 2)) < handleSize
    )
      return 'resize-r';
    if (
      Math.abs(x - (sx + sw / 2)) < handleSize &&
      Math.abs(y - (sy + sh)) < handleSize
    )
      return 'resize-b';
    if (
      Math.abs(x - sx) < handleSize &&
      Math.abs(y - (sy + sh / 2)) < handleSize
    )
      return 'resize-l';

    // 選択枠内
    if (x >= sx && x <= sx + sw && y >= sy && y <= sy + sh) return 'move';

    return 'none';
  };

  // カーソルを更新
  const updateCursor = (mode: DragMode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cursors: Record<DragMode, string> = {
      none: activeTool === 'pan' ? 'grab' : 'crosshair',
      move: 'move',
      'resize-tl': 'nw-resize',
      'resize-tr': 'ne-resize',
      'resize-bl': 'sw-resize',
      'resize-br': 'se-resize',
      'resize-t': 'n-resize',
      'resize-r': 'e-resize',
      'resize-b': 's-resize',
      'resize-l': 'w-resize',
    };

    canvas.style.cursor = cursors[mode];
  };

  // 頂点データ作成
  function createVertices(shape: Shape): Float32Array {
    switch (shape.type) {
      case 'rectangle': {
        const r = shape.cornerRadius || 0;
        if (r > 0) {
          // 角丸矩形
          const segments = 8;
          const vertices: number[] = [];
          const centerX = shape.width / 2;
          const centerY = shape.height / 2;

          // 中心点
          vertices.push(centerX, centerY);

          // 角丸を含む輪郭
          for (let i = 0; i <= segments * 4; i++) {
            const _angle = (i / (segments * 4)) * Math.PI * 2;
            const cornerIndex = Math.floor(i / segments);
            const cornerAngle = (((i % segments) / segments) * Math.PI) / 2;

            let x, y;
            if (cornerIndex === 0) {
              // 右上
              x = shape.width - r + Math.cos(cornerAngle) * r;
              y = r - Math.sin(cornerAngle) * r;
            } else if (cornerIndex === 1) {
              // 右下
              x = shape.width - r + Math.sin(cornerAngle) * r;
              y = shape.height - r + Math.cos(cornerAngle) * r;
            } else if (cornerIndex === 2) {
              // 左下
              x = r - Math.cos(cornerAngle) * r;
              y = shape.height - r + Math.sin(cornerAngle) * r;
            } else {
              // 左上
              x = r - Math.sin(cornerAngle) * r;
              y = r - Math.cos(cornerAngle) * r;
            }

            vertices.push(centerX, centerY);
            vertices.push(x, y);

            if (i > 0) {
              const prevIndex = (vertices.length - 4) / 2;
              vertices.push(
                vertices[prevIndex * 2],
                vertices[prevIndex * 2 + 1],
              );
            }
          }

          return new Float32Array(vertices);
        } else {
          return new Float32Array([
            0,
            0,
            shape.width,
            0,
            0,
            shape.height,
            shape.width,
            0,
            shape.width,
            shape.height,
            0,
            shape.height,
          ]);
        }
      }
      case 'ellipse': {
        const segments = 32;
        const vertices: number[] = [];
        const centerX = shape.width / 2;
        const centerY = shape.height / 2;

        for (let i = 0; i < segments; i++) {
          const angle1 = (i / segments) * Math.PI * 2;
          const angle2 = ((i + 1) / segments) * Math.PI * 2;

          vertices.push(centerX, centerY);
          vertices.push(
            centerX + (Math.cos(angle1) * shape.width) / 2,
            centerY + (Math.sin(angle1) * shape.height) / 2,
          );
          vertices.push(
            centerX + (Math.cos(angle2) * shape.width) / 2,
            centerY + (Math.sin(angle2) * shape.height) / 2,
          );
        }

        return new Float32Array(vertices);
      }
      default:
        return new Float32Array([]);
    }
  }

  // 変換行列作成
  function createTransformMatrix(
    shape: ShapeObject,
    transform: Transform,
  ): number[] {
    const canvas = canvasRef.current;
    if (!canvas) return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    const scaleX = (2 / canvas.width) * transform.scale;
    const scaleY = (-2 / canvas.height) * transform.scale;
    const translateX = -1 + (shape.x + transform.x) * scaleX;
    const translateY = 1 + (shape.y + transform.y) * scaleY;

    return [
      scaleX,
      0,
      0,
      0,
      0,
      scaleY,
      0,
      0,
      0,
      0,
      1,
      0,
      translateX,
      translateY,
      0,
      1,
    ];
  }

  // 色変換
  function hexToRgba(hex: string, opacity: number): number[] {
    if (hex === 'none') return [0, 0, 0, 0];
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, opacity];
  }

  // マウスイベントハンドラー
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / transform.scale - transform.x;
    const y = (e.clientY - rect.top) / transform.scale - transform.y;

    const handleMode = getHandleUnderMouse(e.clientX, e.clientY);

    if (activeTool === 'select' && handleMode !== 'none') {
      // リサイズまたは移動モード
      setIsDragging(true);
      setDragMode(handleMode);
      setDragStart({ x: e.clientX, y: e.clientY });

      // 選択されたシェイプの初期境界を保存
      const selectedShapes = shapes.filter((s) => selectedIds.includes(s.id));
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      selectedShapes.forEach((shape) => {
        const globalPos = getGlobalTransform(shape);
        minX = Math.min(minX, globalPos.x);
        minY = Math.min(minY, globalPos.y);
        maxX = Math.max(maxX, globalPos.x + shape.width);
        maxY = Math.max(maxY, globalPos.y + shape.height);
      });
      setInitialBounds({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      });
    } else if (activeTool === 'select') {
      setIsDragging(true);
      setDragStart({ x, y });
      setDragMode('none');
      // ヒットテスト（レンダリング順序の逆順で）
      const renderOrder = getRenderOrder();
      let clickedShape: ShapeObject | null = null;

      for (let i = renderOrder.length - 1; i >= 0; i--) {
        const shape = renderOrder[i];
        if (shape.type === 'group') continue;

        const global = getGlobalTransform(shape);
        if (
          x >= global.x &&
          x <= global.x + shape.width &&
          y >= global.y &&
          y <= global.y + shape.height
        ) {
          clickedShape = shape;
          break;
        }
      }

      if (clickedShape) {
        if (e.shiftKey) {
          setSelectedIds((prev) =>
            prev.includes(clickedShape.id)
              ? prev.filter((id) => id !== clickedShape.id)
              : [...prev, clickedShape.id],
          );
        } else {
          setSelectedIds([clickedShape.id]);
        }
      } else {
        setSelectedIds([]);
      }
    } else {
      setIsDragging(true);
      setDragStart({ x, y });
      setDragMode('none');
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / transform.scale - transform.x;
    const y = (e.clientY - rect.top) / transform.scale - transform.y;
    setMousePos({ x, y });

    // カーソル更新
    if (!isDragging && activeTool === 'select') {
      const handleMode = getHandleUnderMouse(e.clientX, e.clientY);
      updateCursor(handleMode);
    }

    if (isDragging && dragMode.startsWith('resize-') && initialBounds) {
      // リサイズ処理
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      const _selectedShapes = shapes.filter((s) => selectedIds.includes(s.id));
      const scaleX = 1 + dx / (initialBounds.width * transform.scale);
      const scaleY = 1 + dy / (initialBounds.height * transform.scale);

      const newBounds = { ...initialBounds };

      switch (dragMode) {
        case 'resize-br':
          newBounds.width = initialBounds.width * Math.max(0.1, scaleX);
          newBounds.height = initialBounds.height * Math.max(0.1, scaleY);
          break;
        case 'resize-bl':
          newBounds.x = initialBounds.x + dx / transform.scale;
          newBounds.width =
            initialBounds.width *
            Math.max(0.1, 1 - dx / (initialBounds.width * transform.scale));
          newBounds.height = initialBounds.height * Math.max(0.1, scaleY);
          break;
        case 'resize-tr':
          newBounds.y = initialBounds.y + dy / transform.scale;
          newBounds.width = initialBounds.width * Math.max(0.1, scaleX);
          newBounds.height =
            initialBounds.height *
            Math.max(0.1, 1 - dy / (initialBounds.height * transform.scale));
          break;
        case 'resize-tl':
          newBounds.x = initialBounds.x + dx / transform.scale;
          newBounds.y = initialBounds.y + dy / transform.scale;
          newBounds.width =
            initialBounds.width *
            Math.max(0.1, 1 - dx / (initialBounds.width * transform.scale));
          newBounds.height =
            initialBounds.height *
            Math.max(0.1, 1 - dy / (initialBounds.height * transform.scale));
          break;
        case 'resize-r':
          newBounds.width = initialBounds.width * Math.max(0.1, scaleX);
          break;
        case 'resize-l':
          newBounds.x = initialBounds.x + dx / transform.scale;
          newBounds.width =
            initialBounds.width *
            Math.max(0.1, 1 - dx / (initialBounds.width * transform.scale));
          break;
        case 'resize-b':
          newBounds.height = initialBounds.height * Math.max(0.1, scaleY);
          break;
        case 'resize-t':
          newBounds.y = initialBounds.y + dy / transform.scale;
          newBounds.height =
            initialBounds.height *
            Math.max(0.1, 1 - dy / (initialBounds.height * transform.scale));
          break;
      }

      // シェイプを更新
      const scaleFactorX = newBounds.width / initialBounds.width;
      const scaleFactorY = newBounds.height / initialBounds.height;

      setShapes((prev) =>
        prev.map((shape) => {
          if (selectedIds.includes(shape.id)) {
            const globalPos = getGlobalTransform(shape);
            const relX = globalPos.x - initialBounds.x;
            const relY = globalPos.y - initialBounds.y;

            return {
              ...shape,
              x: shape.parentId ? shape.x : newBounds.x + relX * scaleFactorX,
              y: shape.parentId ? shape.y : newBounds.y + relY * scaleFactorY,
              width: shape.width * scaleFactorX,
              height: shape.height * scaleFactorY,
            };
          }
          return shape;
        }),
      );
    } else if (isDragging && dragMode === 'move') {
      // 移動処理
      const dx = (e.clientX - dragStart.x) / transform.scale;
      const dy = (e.clientY - dragStart.y) / transform.scale;

      setShapes((prev) =>
        prev.map((shape) =>
          selectedIds.includes(shape.id)
            ? { ...shape, x: shape.x + dx, y: shape.y + dy }
            : shape,
        ),
      );

      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (isDragging) {
      if (activeTool === 'pan') {
        setTransform((prev) => ({
          ...prev,
          x: prev.x + (x - dragStart.x),
          y: prev.y + (y - dragStart.y),
        }));
      } else if (activeTool === 'select' && selectedIds.length > 0) {
        const dx = x - dragStart.x;
        const dy = y - dragStart.y;

        setShapes((prev) =>
          prev.map((shape) =>
            selectedIds.includes(shape.id)
              ? { ...shape, x: shape.x + dx, y: shape.y + dy }
              : shape,
          ),
        );

        setDragStart({ x, y });
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging && activeTool !== 'select' && activeTool !== 'pan') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left) / transform.scale - transform.x;
      const y = (e.clientY - rect.top) / transform.scale - transform.y;

      const newShape: Shape = {
        id: Date.now().toString(),
        type: activeTool === 'rectangle' ? 'rectangle' : 'ellipse',
        x: Math.min(dragStart.x, x),
        y: Math.min(dragStart.y, y),
        width: Math.abs(x - dragStart.x),
        height: Math.abs(y - dragStart.y),
        rotation: 0,
        fill: '#4A90E2',
        stroke: '#000000',
        strokeWidth: 0,
        opacity: 1,
        selected: false,
        locked: false,
        visible: true,
        name: `${activeTool} ${shapes.length + 1}`,
        parentId: null,
      };

      if (newShape.width > 5 && newShape.height > 5) {
        setShapes((prev) => [...prev, newShape]);
        setSelectedIds([newShape.id]);
      }
    }

    setIsDragging(false);
    setDragMode('none');
    updateCursor('none');
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setTransform((prev) => ({
        ...prev,
        scale: Math.max(0.1, Math.min(10, prev.scale * delta)),
      }));
    }
  };

  // グループ作成
  const createGroup = () => {
    if (selectedIds.length < 2) return;

    const selectedShapes = shapes.filter((s) => selectedIds.includes(s.id));
    const bounds = {
      x: Math.min(...selectedShapes.map((s) => s.x)),
      y: Math.min(...selectedShapes.map((s) => s.y)),
      x2: Math.max(...selectedShapes.map((s) => s.x + s.width)),
      y2: Math.max(...selectedShapes.map((s) => s.y + s.height)),
    };

    const group: Group = {
      id: Date.now().toString(),
      type: 'group',
      name: `グループ ${shapes.filter((s) => s.type === 'group').length + 1}`,
      x: bounds.x,
      y: bounds.y,
      width: bounds.x2 - bounds.x,
      height: bounds.y2 - bounds.y,
      rotation: 0,
      opacity: 1,
      selected: false,
      locked: false,
      visible: true,
      parentId: null,
      children: selectedIds,
    };

    setShapes((prev) => [
      ...prev.map((s) =>
        selectedIds.includes(s.id)
          ? { ...s, parentId: group.id, x: s.x - bounds.x, y: s.y - bounds.y }
          : s,
      ),
      group,
    ]);
    setSelectedIds([group.id]);
  };

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        setShapes((prev) =>
          prev.filter((shape) => !selectedIds.includes(shape.id)),
        );
        setSelectedIds([]);
      } else if (e.key === 'g' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        createGroup();
      } else if (e.key === 'v') {
        setActiveTool('select');
      } else if (e.key === 'r') {
        setActiveTool('rectangle');
      } else if (e.key === 'o') {
        setActiveTool('ellipse');
      } else if (e.key === ' ') {
        e.preventDefault();
        setActiveTool('pan');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedIds, createGroup]);

  // レイヤーツリーアイテム
  const LayerItem = ({
    shape,
    depth = 0,
  }: {
    shape: ShapeObject;
    depth?: number;
  }) => {
    const isGroup = shape.type === 'group';
    const children = isGroup
      ? (shape as Group).children
          .map((id) => shapes.find((s) => s.id === id))
          .filter(Boolean)
      : [];

    return (
      <>
        <div
          className={`p-2 rounded cursor-pointer flex items-center gap-2 ${
            selectedIds.includes(shape.id)
              ? 'bg-blue-600'
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
          style={{ marginLeft: `${depth * 20}px` }}
          onClick={() => setSelectedIds([shape.id])}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
            {shape.type === 'rectangle' ? (
              <rect x="2" y="4" width="12" height="8" />
            ) : shape.type === 'ellipse' ? (
              <circle cx="8" cy="8" r="6" />
            ) : shape.type === 'text' ? (
              <text x="8" y="12" textAnchor="middle" fontSize="12">
                T
              </text>
            ) : shape.type === 'group' ? (
              <g>
                <rect x="2" y="2" width="8" height="8" fillOpacity="0.5" />
                <rect x="6" y="6" width="8" height="8" fillOpacity="0.5" />
              </g>
            ) : null}
          </svg>
          <span className="text-white text-sm flex-1">{shape.name}</span>
          {shape.locked && <span className="text-xs">🔒</span>}
          {!shape.visible && <span className="text-xs">👁️</span>}
        </div>
        {children.map(
          (child) =>
            child && (
              <LayerItem key={child.id} shape={child} depth={depth + 1} />
            ),
        )}
      </>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* ツールバー */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTool('select')}
          className={`p-2 rounded ${activeTool === 'select' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          title="選択ツール (V)"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
            <path d="M3 3l7 14v-7h7L3 3z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setActiveTool('rectangle')}
          className={`p-2 rounded ${activeTool === 'rectangle' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          title="矩形ツール (R)"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
            <rect
              x="3"
              y="5"
              width="14"
              height="10"
              fill="none"
              stroke="white"
              strokeWidth="2"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setActiveTool('ellipse')}
          className={`p-2 rounded ${activeTool === 'ellipse' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          title="円ツール (O)"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
            <circle
              cx="10"
              cy="10"
              r="7"
              fill="none"
              stroke="white"
              strokeWidth="2"
            />
          </svg>
        </button>

        <div className="h-6 w-px bg-gray-600 mx-2" />

        <button
          type="button"
          onClick={createGroup}
          disabled={selectedIds.length < 2}
          className={`px-3 py-1 rounded text-sm ${
            selectedIds.length < 2
              ? 'bg-gray-700 text-gray-500'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="グループ化 (Ctrl+G)"
        >
          グループ化
        </button>

        <div className="ml-auto flex items-center gap-2 text-sm text-gray-300">
          <span>ズーム: {Math.round(transform.scale * 100)}%</span>
          <span>
            位置: {Math.round(mousePos.x)}, {Math.round(mousePos.y)}
          </span>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* レイヤーパネル */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
          <h3 className="text-white font-semibold mb-4">レイヤー</h3>
          <div className="space-y-1">
            {shapes
              .filter((s) => !s.parentId)
              .slice()
              .reverse()
              .map((shape) => (
                <LayerItem key={shape.id} shape={shape} />
              ))}
          </div>
        </div>

        {/* キャンバス */}
        <div className="flex-1 relative overflow-hidden bg-gray-700">
          <canvas
            ref={canvasRef}
            width={1200}
            height={800}
            className="absolute inset-0"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            style={{ cursor: activeTool === 'pan' ? 'grab' : 'crosshair' }}
          />
          <canvas
            id="text-overlay"
            width={1200}
            height={800}
            className="absolute inset-0 pointer-events-none"
          />
          <canvas
            id="selection-overlay"
            width={1200}
            height={800}
            className="absolute inset-0 pointer-events-none"
          />
        </div>

        {/* プロパティパネル */}
        <div className="w-64 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
          <h3 className="text-white font-semibold mb-4">プロパティ</h3>
          {selectedIds.length > 0 && (
            <div className="space-y-4">
              {shapes
                .filter((s) => selectedIds.includes(s.id))
                .map((shape) => (
                  <div key={shape.id} className="space-y-2">
                    <input
                      type="text"
                      value={shape.name}
                      onChange={(e) => {
                        setShapes((prev) =>
                          prev.map((s) =>
                            s.id === shape.id
                              ? { ...s, name: e.target.value }
                              : s,
                          ),
                        );
                      }}
                      className="w-full px-2 py-1 bg-gray-700 text-white rounded"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400">X</label>
                        <input
                          type="number"
                          value={Math.round(shape.x)}
                          onChange={(e) => {
                            setShapes((prev) =>
                              prev.map((s) =>
                                s.id === shape.id
                                  ? { ...s, x: Number(e.target.value) }
                                  : s,
                              ),
                            );
                          }}
                          className="w-full px-2 py-1 bg-gray-700 text-white rounded"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Y</label>
                        <input
                          type="number"
                          value={Math.round(shape.y)}
                          onChange={(e) => {
                            setShapes((prev) =>
                              prev.map((s) =>
                                s.id === shape.id
                                  ? { ...s, y: Number(e.target.value) }
                                  : s,
                              ),
                            );
                          }}
                          className="w-full px-2 py-1 bg-gray-700 text-white rounded"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400">幅</label>
                        <input
                          type="number"
                          value={Math.round(shape.width)}
                          onChange={(e) => {
                            setShapes((prev) =>
                              prev.map((s) =>
                                s.id === shape.id
                                  ? { ...s, width: Number(e.target.value) }
                                  : s,
                              ),
                            );
                          }}
                          className="w-full px-2 py-1 bg-gray-700 text-white rounded"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">高さ</label>
                        <input
                          type="number"
                          value={Math.round(shape.height)}
                          onChange={(e) => {
                            setShapes((prev) =>
                              prev.map((s) =>
                                s.id === shape.id
                                  ? { ...s, height: Number(e.target.value) }
                                  : s,
                              ),
                            );
                          }}
                          className="w-full px-2 py-1 bg-gray-700 text-white rounded"
                        />
                      </div>
                    </div>

                    {shape.type !== 'group' && shape.type !== 'text' && (
                      <>
                        <div>
                          <label className="text-xs text-gray-400">
                            塗りつぶし
                          </label>
                          <input
                            type="color"
                            value={shape.fill}
                            onChange={(e) => {
                              setShapes((prev) =>
                                prev.map((s) =>
                                  s.id === shape.id
                                    ? { ...s, fill: e.target.value }
                                    : s,
                                ),
                              );
                            }}
                            className="w-full h-8 bg-gray-700 rounded cursor-pointer"
                          />
                        </div>

                        {shape.type === 'rectangle' && (
                          <div>
                            <label className="text-xs text-gray-400">
                              角丸
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="50"
                              value={shape.cornerRadius || 0}
                              onChange={(e) => {
                                setShapes((prev) =>
                                  prev.map((s) =>
                                    s.id === shape.id
                                      ? {
                                          ...s,
                                          cornerRadius: Number(e.target.value),
                                        }
                                      : s,
                                  ),
                                );
                              }}
                              className="w-full"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {shape.type === 'text' && (
                      <>
                        <div>
                          <label className="text-xs text-gray-400">
                            テキスト
                          </label>
                          <textarea
                            value={shape.text}
                            onChange={(e) => {
                              setShapes((prev) =>
                                prev.map((s) =>
                                  s.id === shape.id
                                    ? { ...s, text: e.target.value }
                                    : s,
                                ),
                              );
                            }}
                            className="w-full px-2 py-1 bg-gray-700 text-white rounded"
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">
                            フォントサイズ
                          </label>
                          <input
                            type="number"
                            value={shape.fontSize}
                            onChange={(e) => {
                              setShapes((prev) =>
                                prev.map((s) =>
                                  s.id === shape.id
                                    ? { ...s, fontSize: Number(e.target.value) }
                                    : s,
                                ),
                              );
                            }}
                            className="w-full px-2 py-1 bg-gray-700 text-white rounded"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="text-xs text-gray-400">不透明度</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={shape.opacity}
                        onChange={(e) => {
                          setShapes((prev) =>
                            prev.map((s) =>
                              s.id === shape.id
                                ? { ...s, opacity: Number(e.target.value) }
                                : s,
                            ),
                          );
                        }}
                        className="w-full"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShapes((prev) =>
                            prev.map((s) =>
                              s.id === shape.id
                                ? { ...s, visible: !s.visible }
                                : s,
                            ),
                          );
                        }}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                      >
                        {shape.visible ? '表示' : '非表示'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShapes((prev) =>
                            prev.map((s) =>
                              s.id === shape.id
                                ? { ...s, locked: !s.locked }
                                : s,
                            ),
                          );
                        }}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                      >
                        {shape.locked ? 'ロック' : 'ロック解除'}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// サンプルLPデータを取得
function getSampleData(): ShapeObject[] {
  const shapes: ShapeObject[] = [];

  // 背景グループ
  const bgGroupId = 'bg-group';
  shapes.push({
    id: bgGroupId,
    type: 'group',
    name: '背景',
    x: 0,
    y: 0,
    width: 1200,
    height: 5000,
    rotation: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: null,
    children: ['bg-gradient'],
  });

  // グラデーション背景
  shapes.push({
    id: 'bg-gradient',
    type: 'rectangle',
    name: '背景グラデーション',
    x: 0,
    y: 0,
    width: 1200,
    height: 5000,
    rotation: 0,
    fill: '#f0f9ff',
    stroke: 'none',
    strokeWidth: 0,
    opacity: 1,
    selected: false,
    locked: true,
    visible: true,
    parentId: bgGroupId,
  });

  // ヒーローセクション
  const heroGroupId = 'hero-group';
  shapes.push({
    id: heroGroupId,
    type: 'group',
    name: 'ヒーローセクション',
    x: 0,
    y: 0,
    width: 1200,
    height: 800,
    rotation: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: null,
    children: [
      'hero-bg',
      'hero-title',
      'hero-subtitle',
      'hero-bottle',
      'hero-cta',
      'hero-cta-text',
    ],
  });

  // ヒーロー背景
  shapes.push({
    id: 'hero-bg',
    type: 'rectangle',
    name: 'ヒーロー背景',
    x: 0,
    y: 0,
    width: 1200,
    height: 800,
    rotation: 0,
    fill: '#1e40af',
    stroke: 'none',
    strokeWidth: 0,
    opacity: 0.05,
    selected: false,
    locked: false,
    visible: true,
    parentId: heroGroupId,
  });

  // メインタイトル
  shapes.push({
    id: 'hero-title',
    type: 'text',
    name: 'メインタイトル',
    text: '純粋な天然水で\n毎日を健康に',
    x: 100,
    y: 200,
    width: 500,
    height: 150,
    rotation: 0,
    fontSize: 56,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'bold',
    fill: '#1e293b',
    textAlign: 'left',
    lineHeight: 1.4,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: heroGroupId,
  });

  // サブタイトル
  shapes.push({
    id: 'hero-subtitle',
    type: 'text',
    name: 'サブタイトル',
    text: '富士山の地下深くから湧き出る\nミネラル豊富な天然水',
    x: 100,
    y: 380,
    width: 400,
    height: 80,
    rotation: 0,
    fontSize: 20,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'normal',
    fill: '#64748b',
    textAlign: 'left',
    lineHeight: 1.6,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: heroGroupId,
  });

  // 商品画像（クリップグループ）
  const bottleClipGroupId = 'bottle-clip-group';
  shapes.push({
    id: bottleClipGroupId,
    type: 'group',
    name: 'ボトル画像（クリップ）',
    x: 650,
    y: 150,
    width: 450,
    height: 500,
    rotation: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: heroGroupId,
    children: ['bottle-shadow', 'bottle-image', 'bottle-highlight'],
    isClipGroup: true,
  });

  // ボトルの影
  shapes.push({
    id: 'bottle-shadow',
    type: 'ellipse',
    name: 'ボトルの影',
    x: 50,
    y: 350,
    width: 250,
    height: 80,
    rotation: 0,
    fill: '#1e293b',
    stroke: 'none',
    strokeWidth: 0,
    opacity: 0.2,
    selected: false,
    locked: false,
    visible: true,
    parentId: bottleClipGroupId,
  });

  // ボトル画像プレースホルダー
  shapes.push({
    id: 'bottle-image',
    type: 'rectangle',
    name: 'ボトル画像',
    x: 50,
    y: 50,
    width: 250,
    height: 400,
    rotation: 0,
    fill: '#60a5fa',
    stroke: '#2563eb',
    strokeWidth: 2,
    cornerRadius: 125,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: bottleClipGroupId,
  });

  // ハイライト
  shapes.push({
    id: 'bottle-highlight',
    type: 'ellipse',
    name: 'ハイライト',
    x: 100,
    y: 100,
    width: 80,
    height: 120,
    rotation: -15,
    fill: '#ffffff',
    stroke: 'none',
    strokeWidth: 0,
    opacity: 0.3,
    selected: false,
    locked: false,
    visible: true,
    parentId: bottleClipGroupId,
  });

  // CTAボタン
  shapes.push({
    id: 'hero-cta',
    type: 'rectangle',
    name: 'CTAボタン',
    x: 100,
    y: 500,
    width: 300,
    height: 60,
    rotation: 0,
    fill: '#2563eb',
    stroke: 'none',
    strokeWidth: 0,
    cornerRadius: 30,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: heroGroupId,
  });

  // CTAボタンテキスト
  shapes.push({
    id: 'hero-cta-text',
    type: 'text',
    name: 'CTAボタンテキスト',
    text: '今すぐ購入する',
    x: 150,
    y: 515,
    width: 200,
    height: 30,
    rotation: 0,
    fontSize: 18,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'bold',
    fill: '#ffffff',
    textAlign: 'center',
    lineHeight: 1.5,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: heroGroupId,
  });

  // 特徴セクション
  const featuresGroupId = 'features-group';
  shapes.push({
    id: featuresGroupId,
    type: 'group',
    name: '特徴セクション',
    x: 0,
    y: 900,
    width: 1200,
    height: 600,
    rotation: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: null,
    children: ['features-title', 'feature-1', 'feature-2', 'feature-3'],
  });

  // 特徴タイトル
  shapes.push({
    id: 'features-title',
    type: 'text',
    name: '特徴タイトル',
    text: '3つの特徴',
    x: 450,
    y: 50,
    width: 300,
    height: 60,
    rotation: 0,
    fontSize: 42,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'bold',
    fill: '#1e293b',
    textAlign: 'center',
    lineHeight: 1.4,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: featuresGroupId,
  });

  // 特徴カード1
  createFeatureCard(
    shapes,
    'feature-1',
    '特徴1',
    100,
    200,
    '#dbeafe',
    '#60a5fa',
    '豊富なミネラル',
    '富士山の地層を通過した\n天然のミネラルが豊富',
    featuresGroupId
  );

  // 特徴カード2
  createFeatureCard(
    shapes,
    'feature-2',
    '特徴2',
    450,
    200,
    '#fce7f3',
    '#ec4899',
    '厳選された水源',
    '富士山の特定の水源から\n厳選して採水',
    featuresGroupId
  );

  // 特徴カード3
  createFeatureCard(
    shapes,
    'feature-3',
    '特徴3',
    800,
    200,
    '#d1fae5',
    '#10b981',
    '徹底した品質管理',
    '最新の設備で安全性を\n徹底的に管理',
    featuresGroupId
  );

  // お客様の声セクション
  const testimonialsGroupId = 'testimonials-group';
  shapes.push({
    id: testimonialsGroupId,
    type: 'group',
    name: 'お客様の声',
    x: 0,
    y: 1600,
    width: 1200,
    height: 700,
    rotation: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: null,
    children: ['testimonials-bg', 'testimonials-title', 'testimonial-1', 'testimonial-2', 'testimonial-3'],
  });

  // お客様の声背景
  shapes.push({
    id: 'testimonials-bg',
    type: 'rectangle',
    name: 'お客様の声背景',
    x: 0,
    y: 0,
    width: 1200,
    height: 700,
    rotation: 0,
    fill: '#f8fafc',
    stroke: 'none',
    strokeWidth: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: testimonialsGroupId,
  });

  // お客様の声タイトル
  shapes.push({
    id: 'testimonials-title',
    type: 'text',
    name: 'お客様の声タイトル',
    text: 'お客様の声',
    x: 450,
    y: 50,
    width: 300,
    height: 60,
    rotation: 0,
    fontSize: 42,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'bold',
    fill: '#1e293b',
    textAlign: 'center',
    lineHeight: 1.4,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: testimonialsGroupId,
  });

  // お客様の声1
  createTestimonial(
    shapes,
    'testimonial-1',
    100,
    200,
    '毎日飲んでいます！\n体調がとても良くなりました。',
    '田中様（40代女性）',
    testimonialsGroupId
  );

  // お客様の声2
  createTestimonial(
    shapes,
    'testimonial-2',
    450,
    200,
    'スポーツの後に最適！\nまろやかで飲みやすいです。',
    '佐藤様（30代男性）',
    testimonialsGroupId
  );

  // お客様の声3
  createTestimonial(
    shapes,
    'testimonial-3',
    800,
    200,
    '子供も安心して飲める\n天然水で大満足です。',
    '鈴木様（50代女性）',
    testimonialsGroupId
  );

  // 料金プランセクション
  const pricingGroupId = 'pricing-group';
  shapes.push({
    id: pricingGroupId,
    type: 'group',
    name: '料金プラン',
    x: 0,
    y: 2400,
    width: 1200,
    height: 800,
    rotation: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: null,
    children: ['pricing-title', 'plan-1', 'plan-2', 'plan-3'],
  });

  // 料金プランタイトル
  shapes.push({
    id: 'pricing-title',
    type: 'text',
    name: '料金プランタイトル',
    text: '料金プラン',
    x: 450,
    y: 50,
    width: 300,
    height: 60,
    rotation: 0,
    fontSize: 42,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'bold',
    fill: '#1e293b',
    textAlign: 'center',
    lineHeight: 1.4,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: pricingGroupId,
  });

  // プラン1
  createPricingPlan(
    shapes,
    'plan-1',
    100,
    200,
    'お試しプラン',
    '￥2,980',
    '/月',
    ['500ml × 12本', '送料無料', '初回特典付き'],
    false,
    pricingGroupId
  );

  // プラン2
  createPricingPlan(
    shapes,
    'plan-2',
    450,
    200,
    'スタンダード',
    '￥4,980',
    '/月',
    ['500ml × 24本', '送料無料', '定期便10%OFF', '特別クーポン付き'],
    true,
    pricingGroupId
  );

  // プラン3
  createPricingPlan(
    shapes,
    'plan-3',
    800,
    200,
    'ファミリープラン',
    '￥8,980',
    '/月',
    ['500ml × 48本', '送料無料', '定期便15%OFF', 'VIP会員特典'],
    false,
    pricingGroupId
  );

  // FAQセクション
  const faqGroupId = 'faq-group';
  shapes.push({
    id: faqGroupId,
    type: 'group',
    name: 'FAQ',
    x: 0,
    y: 3300,
    width: 1200,
    height: 600,
    rotation: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: null,
    children: ['faq-bg', 'faq-title', 'faq-1', 'faq-2', 'faq-3'],
  });

  // FAQ背景
  shapes.push({
    id: 'faq-bg',
    type: 'rectangle',
    name: 'FAQ背景',
    x: 0,
    y: 0,
    width: 1200,
    height: 600,
    rotation: 0,
    fill: '#f8fafc',
    stroke: 'none',
    strokeWidth: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: faqGroupId,
  });

  // FAQタイトル
  shapes.push({
    id: 'faq-title',
    type: 'text',
    name: 'FAQタイトル',
    text: 'よくあるご質問',
    x: 450,
    y: 50,
    width: 300,
    height: 60,
    rotation: 0,
    fontSize: 42,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'bold',
    fill: '#1e293b',
    textAlign: 'center',
    lineHeight: 1.4,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: faqGroupId,
  });

  // FAQ1
  createFAQ(
    shapes,
    'faq-1',
    200,
    180,
    'Q: 賞味期限はどのくらいですか？',
    'A: 未開封の状態で2年間、開封後は1週間以内にお飲みください。',
    faqGroupId
  );

  // FAQ2
  createFAQ(
    shapes,
    'faq-2',
    200,
    300,
    'Q: 配送エリアはどこまでですか？',
    'A: 全国どこでも配送可能です。離島も対応しています。',
    faqGroupId
  );

  // FAQ3
  createFAQ(
    shapes,
    'faq-3',
    200,
    420,
    'Q: 定期購入の解約はできますか？',
    'A: いつでも解約可能です。违約金等は一切ありません。',
    faqGroupId
  );

  // フッターセクション
  const footerGroupId = 'footer-group';
  shapes.push({
    id: footerGroupId,
    type: 'group',
    name: 'フッター',
    x: 0,
    y: 4000,
    width: 1200,
    height: 400,
    rotation: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: null,
    children: ['footer-bg', 'footer-logo', 'footer-links', 'footer-copyright'],
  });

  // フッター背景
  shapes.push({
    id: 'footer-bg',
    type: 'rectangle',
    name: 'フッター背景',
    x: 0,
    y: 0,
    width: 1200,
    height: 400,
    rotation: 0,
    fill: '#1e293b',
    stroke: 'none',
    strokeWidth: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: footerGroupId,
  });

  // フッターロゴ
  shapes.push({
    id: 'footer-logo',
    type: 'text',
    name: 'フッターロゴ',
    text: '純水 Natural Water',
    x: 100,
    y: 50,
    width: 300,
    height: 40,
    rotation: 0,
    fontSize: 24,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'bold',
    fill: '#ffffff',
    textAlign: 'left',
    lineHeight: 1.4,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: footerGroupId,
  });

  // フッターリンク
  shapes.push({
    id: 'footer-links',
    type: 'text',
    name: 'フッターリンク',
    text: '会社概要 | プライバシーポリシー | 利用規約 | お問い合わせ',
    x: 100,
    y: 150,
    width: 600,
    height: 30,
    rotation: 0,
    fontSize: 14,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'normal',
    fill: '#94a3b8',
    textAlign: 'left',
    lineHeight: 1.6,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: footerGroupId,
  });

  // コピーライト
  shapes.push({
    id: 'footer-copyright',
    type: 'text',
    name: 'コピーライト',
    text: '© 2024 Natural Water Co., Ltd. All rights reserved.',
    x: 100,
    y: 300,
    width: 500,
    height: 30,
    rotation: 0,
    fontSize: 12,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'normal',
    fill: '#64748b',
    textAlign: 'left',
    lineHeight: 1.6,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: footerGroupId,
  });

  // 最終CTAセクション
  const finalCTAGroupId = 'final-cta-group';
  shapes.push({
    id: finalCTAGroupId,
    type: 'group',
    name: '最終CTA',
    x: 0,
    y: 4500,
    width: 1200,
    height: 400,
    rotation: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: null,
    children: ['final-cta-bg', 'final-cta-title', 'final-cta-button', 'final-cta-button-text'],
  });

  // 最終CTA背景
  shapes.push({
    id: 'final-cta-bg',
    type: 'rectangle',
    name: '最終CTA背景',
    x: 0,
    y: 0,
    width: 1200,
    height: 400,
    rotation: 0,
    fill: '#dbeafe',
    stroke: 'none',
    strokeWidth: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: finalCTAGroupId,
  });

  // 最終CTAタイトル
  shapes.push({
    id: 'final-cta-title',
    type: 'text',
    name: '最終CTAタイトル',
    text: '今すぐ始めてみませんか？\n初回限定50%OFFキャンペーン実施中！',
    x: 300,
    y: 100,
    width: 600,
    height: 100,
    rotation: 0,
    fontSize: 36,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'bold',
    fill: '#1e293b',
    textAlign: 'center',
    lineHeight: 1.5,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: finalCTAGroupId,
  });

  // 最終CTAボタン
  shapes.push({
    id: 'final-cta-button',
    type: 'rectangle',
    name: '最終CTAボタン',
    x: 400,
    y: 250,
    width: 400,
    height: 80,
    rotation: 0,
    fill: '#2563eb',
    stroke: 'none',
    strokeWidth: 0,
    cornerRadius: 40,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: finalCTAGroupId,
  });

  // 最終CTAボタンテキスト
  shapes.push({
    id: 'final-cta-button-text',
    type: 'text',
    name: '最終CTAボタンテキスト',
    text: '今すぐ購入する',
    x: 500,
    y: 270,
    width: 200,
    height: 40,
    rotation: 0,
    fontSize: 24,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'bold',
    fill: '#ffffff',
    textAlign: 'center',
    lineHeight: 1.5,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: finalCTAGroupId,
  });

  return shapes;
}

// 特徴カードを作成するヘルパー関数
function createFeatureCard(
  shapes: ShapeObject[],
  id: string,
  name: string,
  x: number,
  y: number,
  iconFill: string,
  iconStroke: string,
  title: string,
  description: string,
  parentId: string
) {
  const groupId = id;
  shapes.push({
    id: groupId,
    type: 'group',
    name: name,
    x: x,
    y: y,
    width: 300,
    height: 300,
    rotation: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: parentId,
    children: [`${id}-bg`, `${id}-icon`, `${id}-title`, `${id}-desc`],
  });

  shapes.push({
    id: `${id}-bg`,
    type: 'rectangle',
    name: `${name}背景`,
    x: 0,
    y: 0,
    width: 300,
    height: 300,
    rotation: 0,
    fill: '#ffffff',
    stroke: '#e2e8f0',
    strokeWidth: 1,
    cornerRadius: 20,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: groupId,
  });

  shapes.push({
    id: `${id}-icon`,
    type: 'ellipse',
    name: `${name}アイコン`,
    x: 100,
    y: 30,
    width: 100,
    height: 100,
    rotation: 0,
    fill: iconFill,
    stroke: iconStroke,
    strokeWidth: 2,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: groupId,
  });

  shapes.push({
    id: `${id}-title`,
    type: 'text',
    name: `${name}タイトル`,
    text: title,
    x: 50,
    y: 150,
    width: 200,
    height: 40,
    rotation: 0,
    fontSize: 24,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'bold',
    fill: '#1e293b',
    textAlign: 'center',
    lineHeight: 1.4,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: groupId,
  });

  shapes.push({
    id: `${id}-desc`,
    type: 'text',
    name: `${name}説明`,
    text: description,
    x: 20,
    y: 200,
    width: 260,
    height: 80,
    rotation: 0,
    fontSize: 16,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'normal',
    fill: '#64748b',
    textAlign: 'center',
    lineHeight: 1.6,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: groupId,
  });
}

// お客様の声を作成するヘルパー関数
function createTestimonial(
  shapes: ShapeObject[],
  id: string,
  x: number,
  y: number,
  content: string,
  author: string,
  parentId: string
) {
  const groupId = id;
  shapes.push({
    id: groupId,
    type: 'group',
    name: `お客様の声${id}`,
    x: x,
    y: y,
    width: 300,
    height: 200,
    rotation: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: parentId,
    children: [`${id}-bg`, `${id}-content`, `${id}-author`],
  });

  shapes.push({
    id: `${id}-bg`,
    type: 'rectangle',
    name: `お客様の声背景`,
    x: 0,
    y: 0,
    width: 300,
    height: 200,
    rotation: 0,
    fill: '#ffffff',
    stroke: '#e2e8f0',
    strokeWidth: 1,
    cornerRadius: 16,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: groupId,
  });

  shapes.push({
    id: `${id}-content`,
    type: 'text',
    name: `お客様の声内容`,
    text: content,
    x: 20,
    y: 30,
    width: 260,
    height: 100,
    rotation: 0,
    fontSize: 16,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'normal',
    fill: '#1e293b',
    textAlign: 'center',
    lineHeight: 1.8,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: groupId,
  });

  shapes.push({
    id: `${id}-author`,
    type: 'text',
    name: `お客様の声著者`,
    text: author,
    x: 20,
    y: 140,
    width: 260,
    height: 30,
    rotation: 0,
    fontSize: 14,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'normal',
    fill: '#64748b',
    textAlign: 'center',
    lineHeight: 1.6,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: groupId,
  });
}

// 料金プランを作成するヘルパー関数
function createPricingPlan(
  shapes: ShapeObject[],
  id: string,
  x: number,
  y: number,
  planName: string,
  price: string,
  period: string,
  features: string[],
  isPopular: boolean,
  parentId: string
) {
  const groupId = id;
  shapes.push({
    id: groupId,
    type: 'group',
    name: `料金プラン${planName}`,
    x: x,
    y: y,
    width: 300,
    height: 400,
    rotation: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: parentId,
    children: [
      `${id}-bg`,
      `${id}-name`,
      `${id}-price`,
      `${id}-period`,
      ...features.map((_, i) => `${id}-feature-${i}`),
      `${id}-button`,
      `${id}-button-text`,
      ...(isPopular ? [`${id}-popular`] : []),
    ],
  });

  shapes.push({
    id: `${id}-bg`,
    type: 'rectangle',
    name: `プラン背景`,
    x: 0,
    y: 0,
    width: 300,
    height: 400,
    rotation: 0,
    fill: isPopular ? '#eff6ff' : '#ffffff',
    stroke: isPopular ? '#2563eb' : '#e2e8f0',
    strokeWidth: isPopular ? 2 : 1,
    cornerRadius: 20,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: groupId,
  });

  if (isPopular) {
    shapes.push({
      id: `${id}-popular`,
      type: 'rectangle',
      name: '人気バッジ',
      x: 100,
      y: -15,
      width: 100,
      height: 30,
      rotation: 0,
      fill: '#2563eb',
      stroke: 'none',
      strokeWidth: 0,
      cornerRadius: 15,
      opacity: 1,
      selected: false,
      locked: false,
      visible: true,
      parentId: groupId,
    });

    shapes.push({
      id: `${id}-popular-text`,
      type: 'text',
      name: '人気テキスト',
      text: '人気',
      x: 125,
      y: -10,
      width: 50,
      height: 20,
      rotation: 0,
      fontSize: 14,
      fontFamily: 'Noto Sans JP',
      fontWeight: 'bold',
      fill: '#ffffff',
      textAlign: 'center',
      lineHeight: 1.4,
      opacity: 1,
      selected: false,
      locked: false,
      visible: true,
      parentId: groupId,
    });
  }

  shapes.push({
    id: `${id}-name`,
    type: 'text',
    name: `プラン名`,
    text: planName,
    x: 50,
    y: 30,
    width: 200,
    height: 40,
    rotation: 0,
    fontSize: 24,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'bold',
    fill: '#1e293b',
    textAlign: 'center',
    lineHeight: 1.4,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: groupId,
  });

  shapes.push({
    id: `${id}-price`,
    type: 'text',
    name: `価格`,
    text: price,
    x: 50,
    y: 80,
    width: 200,
    height: 50,
    rotation: 0,
    fontSize: 36,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'bold',
    fill: '#2563eb',
    textAlign: 'center',
    lineHeight: 1.4,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: groupId,
  });

  shapes.push({
    id: `${id}-period`,
    type: 'text',
    name: `期間`,
    text: period,
    x: 50,
    y: 130,
    width: 200,
    height: 20,
    rotation: 0,
    fontSize: 14,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'normal',
    fill: '#64748b',
    textAlign: 'center',
    lineHeight: 1.4,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: groupId,
  });

  features.forEach((feature, i) => {
    shapes.push({
      id: `${id}-feature-${i}`,
      type: 'text',
      name: `特徴${i + 1}`,
      text: `✓ ${feature}`,
      x: 30,
      y: 180 + i * 30,
      width: 240,
      height: 25,
      rotation: 0,
      fontSize: 14,
      fontFamily: 'Noto Sans JP',
      fontWeight: 'normal',
      fill: '#1e293b',
      textAlign: 'left',
      lineHeight: 1.6,
      opacity: 1,
      selected: false,
      locked: false,
      visible: true,
      parentId: groupId,
    });
  });

  shapes.push({
    id: `${id}-button`,
    type: 'rectangle',
    name: `選択ボタン`,
    x: 50,
    y: 320,
    width: 200,
    height: 50,
    rotation: 0,
    fill: isPopular ? '#2563eb' : '#ffffff',
    stroke: isPopular ? 'none' : '#2563eb',
    strokeWidth: isPopular ? 0 : 2,
    cornerRadius: 25,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: groupId,
  });

  shapes.push({
    id: `${id}-button-text`,
    type: 'text',
    name: `ボタンテキスト`,
    text: '選択する',
    x: 100,
    y: 335,
    width: 100,
    height: 20,
    rotation: 0,
    fontSize: 16,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'bold',
    fill: isPopular ? '#ffffff' : '#2563eb',
    textAlign: 'center',
    lineHeight: 1.4,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: groupId,
  });
}

// FAQを作成するヘルパー関数
function createFAQ(
  shapes: ShapeObject[],
  id: string,
  x: number,
  y: number,
  question: string,
  answer: string,
  parentId: string
) {
  const groupId = id;
  shapes.push({
    id: groupId,
    type: 'group',
    name: `FAQ${id}`,
    x: x,
    y: y,
    width: 800,
    height: 100,
    rotation: 0,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: parentId,
    children: [`${id}-bg`, `${id}-q`, `${id}-a`],
  });

  shapes.push({
    id: `${id}-bg`,
    type: 'rectangle',
    name: `FAQ背景`,
    x: 0,
    y: 0,
    width: 800,
    height: 100,
    rotation: 0,
    fill: '#ffffff',
    stroke: '#e2e8f0',
    strokeWidth: 1,
    cornerRadius: 12,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: groupId,
  });

  shapes.push({
    id: `${id}-q`,
    type: 'text',
    name: `質問`,
    text: question,
    x: 20,
    y: 20,
    width: 760,
    height: 30,
    rotation: 0,
    fontSize: 16,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'bold',
    fill: '#1e293b',
    textAlign: 'left',
    lineHeight: 1.6,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: groupId,
  });

  shapes.push({
    id: `${id}-a`,
    type: 'text',
    name: `回答`,
    text: answer,
    x: 20,
    y: 55,
    width: 760,
    height: 30,
    rotation: 0,
    fontSize: 14,
    fontFamily: 'Noto Sans JP',
    fontWeight: 'normal',
    fill: '#64748b',
    textAlign: 'left',
    lineHeight: 1.6,
    opacity: 1,
    selected: false,
    locked: false,
    visible: true,
    parentId: groupId,
  });
}

