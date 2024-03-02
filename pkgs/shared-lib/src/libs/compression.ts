export async function compressToGzip(
  blobPart: BufferSource,
  format: CompressionFormat = 'gzip',
): Promise<ArrayBuffer | ArrayBufferLike> {
  if (typeof CompressionStream === 'undefined') {
    console.info(
      'CompressionStream is not supported, fallback to non compressed',
    )
    return blobPart instanceof ArrayBuffer ? blobPart : blobPart.buffer
  }

  const stream = new Blob([blobPart]).stream()
  const compresison = new CompressionStream(format)
  return new Response(stream.pipeThrough(compresison)).arrayBuffer()
}

export function decompressFromGzip(
  blobPart: BufferSource,
  format: CompressionFormat = 'gzip',
): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === 'undefined') {
    console.info(
      'DecompressionStream is not supported, fallback to non uncompressed',
    )

    return Promise.resolve(
      blobPart instanceof ArrayBuffer ? blobPart : blobPart.buffer,
    )
  }

  const stream = new Blob([blobPart]).stream()
  const compresison = new DecompressionStream(format)
  return new Response(stream.pipeThrough(compresison)).arrayBuffer()
}
