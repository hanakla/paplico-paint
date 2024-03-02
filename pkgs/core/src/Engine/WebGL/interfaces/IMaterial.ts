export interface IMaterial {
  compile(gl: WebGL2RenderingContext): WebGLProgram
  attachUniforms(gl: WebGL2RenderingContext, program: WebGLProgram): void
}
