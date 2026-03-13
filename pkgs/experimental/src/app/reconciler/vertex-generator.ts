import type { VectorPath } from '@/engine/document/path';
import type { RGBAColor } from '@/engine/document/types';

/**
 * Generate vertices from a VectorPath for WebGPU rendering
 * Uses simple triangulation for closed paths
 */
export function generateVerticesFromPath(
  path: VectorPath,
  color: RGBAColor,
  transform?: { x: number; y: number }
): Float32Array {
  const vertices: number[] = [];
  const offset = transform || { x: 0, y: 0 };

  if (!path.points || path.points.length < 3) {
    return new Float32Array(0);
  }

  if (path.closed) {
    // Simple triangulation using fan method from first point
    const firstPoint = path.points[0];
    
    for (let i = 1; i < path.points.length - 1; i++) {
      const point2 = path.points[i];
      const point3 = path.points[i + 1];
      
      // First vertex
      vertices.push(
        firstPoint.x + offset.x,
        firstPoint.y + offset.y,
        color.r,
        color.g,
        color.b,
        color.a
      );
      
      // Second vertex
      vertices.push(
        point2.x + offset.x,
        point2.y + offset.y,
        color.r,
        color.g,
        color.b,
        color.a
      );
      
      // Third vertex
      vertices.push(
        point3.x + offset.x,
        point3.y + offset.y,
        color.r,
        color.g,
        color.b,
        color.a
      );
    }
  } else {
    // For open paths, create a line strip (not implemented yet)
    // Would need different rendering approach
    console.warn('Open paths not yet supported for WebGPU rendering');
  }

  return new Float32Array(vertices);
}

/**
 * Generate vertices for a rectangle
 */
export function generateRectangleVertices(
  x: number,
  y: number,
  width: number,
  height: number,
  color: RGBAColor
): Float32Array {
  const vertices = new Float32Array([
    // First triangle
    x, y, color.r, color.g, color.b, color.a,
    x + width, y, color.r, color.g, color.b, color.a,
    x, y + height, color.r, color.g, color.b, color.a,
    
    // Second triangle
    x + width, y, color.r, color.g, color.b, color.a,
    x + width, y + height, color.r, color.g, color.b, color.a,
    x, y + height, color.r, color.g, color.b, color.a,
  ]);
  
  return vertices;
}

/**
 * Generate vertices for a circle
 */
export function generateCircleVertices(
  centerX: number,
  centerY: number,
  radius: number,
  segments: number = 32,
  color: RGBAColor
): Float32Array {
  const vertices: number[] = [];
  
  for (let i = 0; i < segments; i++) {
    const angle1 = (i / segments) * Math.PI * 2;
    const angle2 = ((i + 1) / segments) * Math.PI * 2;
    
    // Center point
    vertices.push(centerX, centerY, color.r, color.g, color.b, color.a);
    
    // First outer point
    vertices.push(
      centerX + Math.cos(angle1) * radius,
      centerY + Math.sin(angle1) * radius,
      color.r, color.g, color.b, color.a
    );
    
    // Second outer point
    vertices.push(
      centerX + Math.cos(angle2) * radius,
      centerY + Math.sin(angle2) * radius,
      color.r, color.g, color.b, color.a
    );
  }
  
  return new Float32Array(vertices);
}

/**
 * Convert canvas coordinates to WebGPU NDC (Normalized Device Coordinates)
 */
export function canvasToNDC(x: number, y: number, canvasWidth: number, canvasHeight: number): { x: number; y: number } {
  return {
    x: (x / canvasWidth) * 2 - 1,
    y: -((y / canvasHeight) * 2 - 1), // Flip Y axis
  };
}

/**
 * Create transformation matrix for 2D rendering
 */
export function create2DTransformMatrix(
  x: number,
  y: number,
  rotation: number,
  scaleX: number,
  scaleY: number,
  canvasWidth: number,
  canvasHeight: number
): Float32Array {
  // Convert to NDC
  const ndcPos = canvasToNDC(x, y, canvasWidth, canvasHeight);
  
  // Create transformation matrix
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  
  // Column-major order for WebGPU
  return new Float32Array([
    scaleX * cos, scaleX * sin, 0, 0,
    -scaleY * sin, scaleY * cos, 0, 0,
    0, 0, 1, 0,
    ndcPos.x, ndcPos.y, 0, 1,
  ]);
}