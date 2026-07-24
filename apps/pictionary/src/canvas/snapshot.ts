import { inkCodec } from './codec'
import { createCanvasHistory, type CanvasHistory } from './history'

const SNAPSHOT_MAGIC = [0x43, 0x4e, 0x53, 0x31] as const // CNS1
const HEADER_BYTES = 20
const UINT32_MAX = 0xffff_ffff

function hasSnapshotMagic(bytes: Uint8Array): boolean {
  return SNAPSHOT_MAGIC.every((value, index) => bytes[index] === value)
}

function assertUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0 || value > UINT32_MAX) {
    throw new Error(`Canvas snapshot: ${label} must be a positive uint32`)
  }
}

/** Serialises a folded RGBA baseline followed by the existing INK1 retained-op log. */
export function encodeCanvasSnapshot(history: CanvasHistory): Uint8Array {
  const { width, height, pixels } = history.baseline
  assertUint32(width, 'width')
  assertUint32(height, 'height')

  const expectedPixelLength = width * height * 4
  if (!Number.isSafeInteger(expectedPixelLength) || pixels.length !== expectedPixelLength) {
    throw new Error('Canvas snapshot: raster dimensions do not match pixel data')
  }

  const log = inkCodec.encodeLog(history.ops)
  if (pixels.length > UINT32_MAX || log.length > UINT32_MAX) {
    throw new Error('Canvas snapshot: payload is too large')
  }

  const bytes = new Uint8Array(HEADER_BYTES + pixels.length + log.length)
  bytes.set(SNAPSHOT_MAGIC, 0)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  view.setUint32(4, width, true)
  view.setUint32(8, height, true)
  view.setUint32(12, pixels.length, true)
  bytes.set(pixels, 16)
  view.setUint32(16 + pixels.length, log.length, true)
  bytes.set(log, HEADER_BYTES + pixels.length)
  return bytes
}

/** Restores a folded baseline and retained ops without replaying already-folded operations. */
export function decodeCanvasSnapshot(bytes: Uint8Array): CanvasHistory {
  if (bytes.length < HEADER_BYTES) throw new Error('Canvas snapshot: truncated payload')
  for (let index = 0; index < SNAPSHOT_MAGIC.length; index++) {
    if (bytes[index] !== SNAPSHOT_MAGIC[index]) {
      throw new Error('Canvas snapshot: invalid header')
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const width = view.getUint32(4, true)
  const height = view.getUint32(8, true)
  const pixelLength = view.getUint32(12, true)
  assertUint32(width, 'width')
  assertUint32(height, 'height')

  const expectedPixelLength = width * height * 4
  if (!Number.isSafeInteger(expectedPixelLength) || pixelLength !== expectedPixelLength) {
    throw new Error('Canvas snapshot: raster dimensions do not match pixel data')
  }

  const logLengthOffset = 16 + pixelLength
  if (logLengthOffset + 4 > bytes.length) throw new Error('Canvas snapshot: truncated payload')
  const logLength = view.getUint32(logLengthOffset, true)
  const end = logLengthOffset + 4 + logLength
  if (end > bytes.length) throw new Error('Canvas snapshot: truncated payload')
  if (end < bytes.length) throw new Error('Canvas snapshot: trailing bytes')

  return {
    baseline: {
      width,
      height,
      pixels: new Uint8ClampedArray(bytes.slice(16, logLengthOffset)),
    },
    ops: inkCodec.decodeLog(bytes.slice(logLengthOffset + 4, end)),
  }
}

/** Uses the compact INK1 log until history has actually folded into a baseline. */
export function encodeHistoryForSync(history: CanvasHistory): Uint8Array {
  const baselineIsBlank = history.baseline.pixels.every((channel) => channel === 255)
  return baselineIsBlank ? inkCodec.encodeLog(history.ops) : encodeCanvasSnapshot(history)
}

/** Accepts either the normal compact log or the folded CNS1 fallback. */
export function decodeHistoryFromSync(bytes: Uint8Array): CanvasHistory {
  if (hasSnapshotMagic(bytes)) return decodeCanvasSnapshot(bytes)
  return { ...createCanvasHistory(), ops: inkCodec.decodeLog(bytes) }
}
