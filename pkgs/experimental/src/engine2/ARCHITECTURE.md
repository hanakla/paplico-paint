# Paplico Engine 2 Architecture

## Overview

This document outlines the architecture of the new Paplico Engine 2, which is being developed to replace the existing WebGPU engine. The new engine aims to improve performance, maintainability, and extensibility while providing a solid foundation for future features.

## Basics

- **Coordinate system**: The engine uses a X+ is right, Y+ is down coordinate system.
- **Units**: The engine operates in pixels, with 1 unit = 1 pixel, and sub-pixel precision is supported.
- **Rendering**: The engine uses WebGPU for rendering, with a focus on performance and flexibility.
- **Target platforms**: Modern browsers (Chrome, Safari, Firefox, Edge) supporting WebGPU/WebGL2
- **Device support**: 2022+ devices, with full Apple Pencil pressure support

## Core Architecture

### System Components Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    UI Layer (React + valtio)               │
├─────────────────────────────────────────────────────────────┤
│                    Paplico (API Gateway)                   │
├─────────────────────────────────────────────────────────────┤
│              DocumentContext (State Management)            │
├─────────────────────────────────────────────────────────────┤
│               PaintEngine (Core Engine)                    │
├─────────────────────────────────────────────────────────────┤
│                Renderer (GPU Abstraction)                  │
├─────────────────────────────────────────────────────────────┤
│                GPUContext (Hardware Layer)                 │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### Paplico (API Gateway)
- **Role**: Translator between UI and Engine
- **State Management**: valtio-based reactive state for UI consumption
- **Coordinate Conversion**: Screen ↔ World ↔ Artboard coordinate transformations
- **Selection Management**: Object, vertex, and segment selection handling
- **Event Translation**: UI events to engine commands

#### DocumentContext (State Management)
- **Role**: Document state and history management
- **DOM Tree**: Internal hierarchical object representation
- **Command Pattern**: Undo/Redo with 200-step history
- **Diff Detection**: Efficient change detection for cache invalidation
- **Data Persistence**: IndexedDB storage with auto-save

#### PaintEngine (Core Engine)
- **Role**: Central coordination of all drawing operations
- **Builders**: StrokeBuilder, ShapeBuilder, TextBuilder for object creation
- **Resource Management**: Brush, texture, and material management
- **Optimization**: Progressive rendering and adaptive quality

#### Renderer (GPU Abstraction)
- **Role**: Rendering pipeline orchestration
- **Multi-Pass Rendering**: Modular render pass system
- **Instanced Drawing**: Efficient batch rendering for strokes
- **Filter Pipeline**: Per-object and per-layer filter application

## Coordinate System Architecture

### Coordinate Space Hierarchy

```
Screen Coordinates (Browser pixels)
    ↓ devicePixelRatio
Device Coordinates (Physical pixels)
    ↓ ViewportTransform (zoom, pan)
World Coordinates (Infinite canvas space)
    ↓ ArtboardTransform (per-artboard)
Artboard Coordinates (Local artboard space)
```

### Coordinate Specifications

- **World Origin**: (0, 0) at infinite canvas center
- **Artboard Origin**: Top-left corner of each artboard at (0, 0)
- **Precision**: Float32 with sub-pixel accuracy
- **Storage**: Objects stored in artboard-relative coordinates
- **Benefits**: Artboard movement requires no coordinate recalculation

### Coordinate Conversion API

```typescript
interface ViewportManager {
  // Core transformations
  screenToWorld(point: Point): Point
  worldToScreen(point: Point): Point
  worldToArtboard(point: Point, artboardId: string): Point
  artboardToWorld(point: Point, artboardId: string): Point
  
  // Viewport controls
  setZoom(zoom: number): void
  setPan(x: number, y: number): void
  zoomToFit(bounds: Rect): void
}
```

## Data Model Architecture

### Core Data Types

#### ArtObject (Base Class)
```typescript
interface ArtObject {
  id: string
  type: 'stroke' | 'shape' | 'text' | 'image' | 'group'
  artboardId: string
  
  // Common properties
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: BlendMode
  
  // Per-object filters
  filters: Filter[]
  
  // Transformation matrix
  transform?: Matrix3x3
  
  // Rendering flags
  isTemporary?: boolean  // For drawing-in-progress
  
  // Cache management
  cache?: ObjectCache
}
```

#### Specialized Objects
```typescript
interface Stroke extends ArtObject {
  type: 'stroke'
  points: Point[]  // Artboard-relative coordinates
  brushId: string
  color: string
  isOptimized?: boolean
}

interface Shape extends ArtObject {
  type: 'shape'
  shapeType: 'rect' | 'ellipse' | 'polygon'
  geometry: ShapeGeometry
  fill?: Fill
  stroke?: StrokeStyle
}

interface Text extends ArtObject {
  type: 'text'
  content: string
  font: FontStyle
  textAlign: TextAlign
}

interface Group extends ArtObject {
  type: 'group'
  children: ArtObject[]
}
```

#### Document Structure
```typescript
interface Document {
  artboards: Artboard[]
  layers: Layer[]  // Independent layer system
  activeArtboardId: string
}

interface Layer {
  id: string
  name: string
  objects: ArtObject[]  // Unified object storage
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: BlendMode
  filters: Filter[]  // Layer-level filters
}

interface Artboard {
  id: string
  name: string
  x: number      // World coordinates
  y: number
  width: number
  height: number
  backgroundColor: string
}
```

## Rendering Pipeline Architecture

### Render Pass System

The renderer uses a modular pass-based system for maximum flexibility:

```typescript
interface RenderPass {
  name: string
  isEnabled(context: RenderContext): boolean
  execute(context: RenderContext, document: Document): void
}
```

### Standard Render Passes

1. **ClearPass**: Canvas clearing and background preparation
2. **ArtboardPass**: Artboard background rendering
3. **ObjectRenderPass**: Main object rendering (strokes, shapes, text)
4. **LayerCompositePass**: Layer blending and composition
5. **FilterPass**: Filter effect application
6. **OverlayPass**: UI elements (selection boxes, guides)
7. **PresentPass**: Final presentation to screen

### Object Rendering Strategy

#### Instanced Mesh Rendering
- **Approach**: Stamp-based rendering for strokes
- **Geometry**: Basic circle stamps placed along stroke path
- **Density**: Adaptive based on drawing speed and pressure
- **Batching**: Group by brush type for efficient GPU utilization

#### Adaptive Quality System
```typescript
interface QualitySettings {
  strokeDensity: number      // Stamp density multiplier
  filterQuality: 'low' | 'medium' | 'high'
  antialiasing: boolean
  subsampleFactor: number    // For high-DPI displays
}
```

### Performance Optimization

#### Progressive Rendering
- **Drawing Phase**: Low quality, high performance (60fps target)
- **Idle Phase**: High quality upgrade (120fps on ProMotion)
- **Dirty Regions**: Minimal re-rendering of changed areas

#### Cache Management
```typescript
interface CacheManager {
  // Cache types
  strokeCache: Map<string, StrokeCache>
  layerCache: Map<string, LayerCache>
  filterCache: Map<string, FilterCache>
  
  // Memory management
  memoryLimit: number       // 500MB default
  memoryUsage: number
  lruCache: LRUCache<string, CacheEntry>
  
  // Cache operations
  generateStrokeCache(stroke: Stroke): Promise<StrokeCache>
  invalidateCache(objectId: string): void
  optimizeCache(): void
}
```

## Filter System Architecture

### Filter Pipeline

Filters can be applied at multiple levels:
- **Object Level**: Individual object filters
- **Layer Level**: Layer-wide effects
- **Document Level**: Global adjustments

### Filter Types

```typescript
interface Filter {
  id: string
  type: FilterType
  enabled: boolean
  params: FilterParams
}

enum FilterType {
  // Basic filters
  Blur = 'blur',
  Sharpen = 'sharpen',
  
  // Color adjustments
  Brightness = 'brightness',
  Contrast = 'contrast',
  Saturation = 'saturation',
  Hue = 'hue',
  
  // Effects
  Glow = 'glow',
  Shadow = 'shadow',
  
  // Custom
  Custom = 'custom'
}
```

### Filter Application Strategy

```typescript
class FilterProcessor {
  applyObjectFilters(object: ArtObject, context: RenderContext): void {
    if (object.filters.length === 0) return
    
    // Render to temporary texture
    const bounds = object.cache.bounds
    const tempTexture = context.resources.getTempTexture(bounds)
    
    // Apply filter chain
    let currentTexture = this.renderObjectToTexture(object, tempTexture)
    
    for (const filter of object.filters) {
      if (!filter.enabled) continue
      
      const nextTexture = this.applyFilter(filter, currentTexture, bounds)
      context.resources.releaseTexture(currentTexture)
      currentTexture = nextTexture
    }
    
    // Composite back to main canvas
    this.compositeTexture(currentTexture, bounds, object.opacity, object.blendMode)
    context.resources.releaseTexture(currentTexture)
  }
}
```

## State Management Architecture

### Dual-Layer State System

#### UI State (valtio)
```typescript
interface PaplicoState {
  // Tool state
  currentTool: string
  brushSize: number
  color: string
  
  // Document state (mirrored from DocumentContext)
  activeArtboardId: string
  selectedLayerId: string
  layers: LayerInfo[]
  
  // Selection state
  selection: SelectionState
  
  // Viewport state
  zoom: number
  panX: number
  panY: number
  
  // Action availability
  canUndo: boolean
  canRedo: boolean
}
```

#### Engine State (Plain JavaScript)
```typescript
interface DocumentState {
  document: Document
  commandHistory: CommandHistory
  domTree: DOMTree
  caches: CacheRegistry
}
```

### Command Pattern Implementation

```typescript
interface Command {
  name: string
  execute(context: DocumentContext): void
  undo(context: DocumentContext): void
  redo(context: DocumentContext): void
}

class CommandHistory {
  private commands: Command[] = []
  private currentIndex: number = -1
  private maxHistory: number = 200
  
  execute(command: Command): void
  undo(): Command | null
  redo(): Command | null
  canUndo(): boolean
  canRedo(): boolean
}
```

## Change Detection Architecture

### DOMTree System

Internal hierarchical representation for efficient change detection:

```typescript
interface DOMTree {
  root: ArbObjectNode
  
  // Tree operations
  appendChild(parent: ArbObjectNode, child: ArbObjectNode): void
  removeChild(parent: ArbObjectNode, childId: string): void
  updateNode(node: ArbObjectNode, props: any): void
  findNode(id: string): ArbObjectNode
  clone(): DOMTree
}

interface ArbObjectNode {
  id: string
  type: NodeType
  children: ArbObjectNode[]
  props: any  // ArtObject | Layer | Artboard
  cache?: NodeCache
}
```

### Diff Detection System

```typescript
class DiffDetector {
  detect(oldTree: DOMTree, newTree: DOMTree): Diff[]
  
  enum DiffType {
    ADD = 'add',
    REMOVE = 'remove', 
    UPDATE = 'update',
    MOVE = 'move',
    REORDER = 'reorder'
  }
}
```

### Cache Invalidation Strategy

```typescript
interface InvalidationStrategy {
  fullInvalidation: boolean
  partialInvalidations: string[]  // Object IDs
  boundsRecalculation: string[]   // Parent IDs needing bounds update
}
```

## Builder System Architecture

### Object Creation Pipeline

Each object type has a dedicated builder for creation:

```typescript
interface ObjectBuilder<T extends ArtObject> {
  begin(layer: Layer, startPoint: Point): T
  update(params: any): DirtyRegion
  end(): Command
  cancel(): void
}

class StrokeBuilder implements ObjectBuilder<Stroke> {
  private currentStroke: Stroke | null = null
  
  begin(layer: Layer, brush: Brush, worldPoint: Point): Stroke {
    const artboardPoint = this.worldToArtboard(worldPoint)
    this.currentStroke = {
      id: generateId(),
      type: 'stroke',
      artboardId: this.getArtboardId(worldPoint),
      points: [artboardPoint],
      brushId: brush.id,
      color: brush.color,
      isTemporary: true,
      // ... other properties
    }
    
    layer.objects.push(this.currentStroke)
    return this.currentStroke
  }
  
  addPoint(worldPoint: Point): DirtyRegion {
    if (!this.currentStroke) return null
    
    const artboardPoint = this.worldToArtboard(worldPoint)
    this.currentStroke.points.push(artboardPoint)
    
    // Return dirty region for minimal re-rendering
    return this.calculateDirtyRegion(artboardPoint)
  }
  
  end(): Command {
    if (!this.currentStroke) return null
    
    this.currentStroke.isTemporary = false
    
    return new AddStrokeCommand(
      this.currentStroke.layerId,
      this.currentStroke
    )
  }
}
```

## Selection System Architecture

### Multi-Level Selection

The engine supports selection at multiple levels:

1. **Object Selection**: Entire objects (strokes, shapes, text)
2. **Vertex Selection**: Individual points within strokes
3. **Segment Selection**: Line segments between points
4. **Marquee Selection**: Rectangle-based multi-selection

### Selection State Management

```typescript
interface SelectionState {
  mode: 'object' | 'vertex' | 'segment'
  
  // Object selection
  objectIds: string[]
  
  // Vertex selection (strokeId -> vertex indices)
  vertices: Record<string, number[]>
  
  // Segment selection
  segments: Record<string, number[]>
  
  // Marquee selection
  marquee: { start: Point, end: Point } | null
}
```

### Hit Testing System

```typescript
interface HitTestManager {
  hitTest(worldPoint: Point): HitTestResult[]
  hitTestRect(worldRect: Rect): HitTestResult[]
  hitTestStroke(localPoint: Point, stroke: Stroke): boolean
  hitTestVertex(localPoint: Point, stroke: Stroke, tolerance: number): number | null
}
```

## Memory Management Architecture

### Resource Lifecycle

```typescript
class ResourceManager {
  // GPU resources
  private textures: Map<string, GPUTexture> = new Map()
  private buffers: Map<string, GPUBuffer> = new Map()
  private shaders: Map<string, GPUShaderModule> = new Map()
  
  // Memory tracking
  private memoryUsage: number = 0
  private memoryLimit: number = 500 * 1024 * 1024  // 500MB
  
  allocateTexture(size: TextureSize): GPUTexture
  releaseTexture(textureId: string): void
  getMemoryUsage(): MemoryStats
  cleanup(): void
}
```

### Cache Priority System

```typescript
interface CacheEntry {
  id: string
  size: number
  lastAccess: number
  priority: number
  type: 'stroke' | 'layer' | 'filter'
}

class CachePriorityManager {
  calculatePriority(entry: CacheEntry): number {
    let priority = 0
    
    // Visible layer bonus
    if (this.isVisible(entry.id)) priority += 100
    
    // Active artboard bonus
    if (this.isInActiveArtboard(entry.id)) priority += 50
    
    // Recent access bonus
    const timeSinceAccess = Date.now() - entry.lastAccess
    priority += Math.max(0, 10 - timeSinceAccess / 1000)
    
    return priority
  }
}
```

## Extension Points Architecture

### Plugin System Foundation

```typescript
interface PluginAPI {
  // Core extensions
  registerBrush(brush: BrushDefinition): void
  registerFilter(filter: FilterDefinition): void
  registerTool(tool: ToolDefinition): void
  
  // Event hooks
  onStrokeBegin(callback: (stroke: Stroke) => void): void
  onStrokeEnd(callback: (stroke: Stroke) => void): void
  onDocumentChange(callback: (diff: Diff[]) => void): void
  
  // Shader extensions
  registerShader(name: string, code: ShaderCode): void
}
```

### Custom Shader Support

```typescript
interface CustomShader {
  name: string
  vertexShader: string
  fragmentShader: string
  uniforms: Record<string, UniformDefinition>
}

// UNCHI AND DESTROY shader example 💩
const unchiShader: CustomShader = {
  name: 'realisticPoop',
  vertexShader: `
    // Custom vertex shader for realistic poop texture
  `,
  fragmentShader: `
    // Fragment shader implementing advanced poop physics
  `,
  uniforms: {
    poopiness: { type: 'float', default: 1.0 },
    stinkLevel: { type: 'float', default: 0.8 }
  }
}
```

## Performance Characteristics

### Target Performance Metrics

- **Drawing Latency**: < 16ms (60fps) during active drawing
- **Idle Performance**: < 8ms (120fps) when not drawing
- **Memory Usage**: < 500MB for typical projects
- **Stroke Capacity**: 10,000+ strokes with smooth performance
- **Layer Limit**: 100+ layers without degradation

### Optimization Strategies

1. **Instanced Rendering**: Batch similar objects for GPU efficiency
2. **Dirty Region Tracking**: Minimize re-rendering scope
3. **Progressive Quality**: Trade quality for performance during interaction
4. **Cache Hierarchy**: Multi-level caching for different use cases
5. **WebWorker Offloading**: Background processing for non-critical tasks

## Future Considerations

### Planned Extensions

1. **WebGPU Compute Shaders**: Advanced filter processing
2. **Multi-threading**: Web Worker integration for heavy operations
3. **Collaborative Editing**: y.js integration for real-time collaboration
4. **Cloud Synchronization**: Document sync across devices
5. **Advanced Animation**: Timeline-based animation system

### Migration Strategy

The new engine is designed to coexist with the existing engine during transition:

1. **Gradual Migration**: Feature-by-feature replacement
2. **Data Compatibility**: Seamless project file migration
3. **Fallback Support**: Graceful degradation on older hardware
4. **Performance Monitoring**: Real-time performance comparison

---

*This architecture represents the foundation for Paplico Engine 2, designed with the UNCHI AND DESTROY philosophy: break conventions, embrace innovation, and create something truly unique in the digital art space.* 🎨💩🔥
