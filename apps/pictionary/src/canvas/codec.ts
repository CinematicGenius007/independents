import type { CanvasOp, InkCodec, InkFrame } from './types'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()
const LOG_MAGIC = [0x49, 0x4e, 0x4b, 0x31] as const // INK1

class Writer {
  private bytes: number[] = []

  u8(value: number): void {
    this.bytes.push(value & 0xff)
  }

  u16(value: number): void {
    this.u8(value)
    this.u8(value >>> 8)
  }

  u32(value: number): void {
    this.u16(value)
    this.u16(value >>> 16)
  }

  raw(bytes: ArrayLike<number>): void {
    for (let i = 0; i < bytes.length; i++) this.u8(bytes[i])
  }

  string(value: string): void {
    const bytes = textEncoder.encode(value)
    if (bytes.length > 0xffff) throw new Error('Ink codec: string is too long')
    this.u16(bytes.length)
    this.raw(bytes)
  }

  color(value: string): void {
    const match = /^#([0-9a-f]{6})$/i.exec(value)
    if (!match) throw new Error(`Ink codec: invalid color "${value}"`)
    const rgb = Number.parseInt(match[1], 16)
    this.u8(rgb >>> 16)
    this.u8(rgb >>> 8)
    this.u8(rgb)
  }

  points(points: Int16Array): void {
    if (points.length % 2 !== 0) throw new Error('Ink codec: point array must contain x/y pairs')
    this.u32(points.length)
    for (const point of points) this.u16(point)
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.bytes)
  }
}

class Reader {
  private offset = 0
  private readonly bytes: Uint8Array

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
  }

  private require(length: number): void {
    if (this.offset + length > this.bytes.length) throw new Error('Ink codec: truncated payload')
  }

  u8(): number {
    this.require(1)
    return this.bytes[this.offset++]
  }

  u16(): number {
    const value = this.u8() | (this.u8() << 8)
    return value >>> 0
  }

  u32(): number {
    const value = this.u16() | (this.u16() << 16)
    return value >>> 0
  }

  raw(length: number): Uint8Array {
    this.require(length)
    const value = this.bytes.slice(this.offset, this.offset + length)
    this.offset += length
    return value
  }

  string(): string {
    return textDecoder.decode(this.raw(this.u16()))
  }

  color(): string {
    return `#${[this.u8(), this.u8(), this.u8()]
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()}`
  }

  points(): Int16Array {
    const length = this.u32()
    if (length % 2 !== 0) throw new Error('Ink codec: point array must contain x/y pairs')
    const points = new Int16Array(length)
    for (let i = 0; i < length; i++) points[i] = this.u16()
    return points
  }

  done(): boolean {
    return this.offset === this.bytes.length
  }
}

function writeOp(writer: Writer, op: CanvasOp): void {
  writer.u8(op.t === 'stroke' ? 1 : op.t === 'fill' ? 2 : 3)
  writer.u32(op.id)
  writer.string(op.by)
  if (op.t === 'stroke') {
    writer.u8(op.tool === 'pencil' ? 1 : 2)
    writer.color(op.color)
    writer.u8(op.size)
    writer.points(op.pts)
  } else if (op.t === 'fill') {
    writer.u16(op.x)
    writer.u16(op.y)
    writer.color(op.color)
  }
}

function readOp(reader: Reader): CanvasOp {
  const tag = reader.u8()
  const id = reader.u32()
  const by = reader.string()
  if (tag === 1) {
    const toolTag = reader.u8()
    if (toolTag !== 1 && toolTag !== 2) throw new Error(`Ink codec: unknown stroke tool ${toolTag}`)
    return {
      t: 'stroke',
      id,
      by,
      tool: toolTag === 1 ? 'pencil' : 'eraser',
      color: reader.color(),
      size: reader.u8(),
      pts: reader.points(),
    }
  }
  if (tag === 2) {
    return { t: 'fill', id, by, x: reader.u16(), y: reader.u16(), color: reader.color() }
  }
  if (tag === 3) return { t: 'clear', id, by }
  throw new Error(`Ink codec: unknown op tag ${tag}`)
}

function finishRead<T>(reader: Reader, value: T): T {
  if (!reader.done()) throw new Error('Ink codec: trailing bytes')
  return value
}

export const inkCodec: InkCodec = {
  encodeFrame(frame): Uint8Array {
    const writer = new Writer()
    switch (frame.f) {
      case 'begin':
        writer.u8(1)
        writer.u32(frame.id)
        writer.u8(frame.tool === 'pencil' ? 1 : 2)
        writer.color(frame.color)
        writer.u8(frame.size)
        writer.points(frame.pts)
        break
      case 'append':
        writer.u8(2)
        writer.u32(frame.id)
        writer.points(frame.pts)
        break
      case 'end':
        writer.u8(3)
        writer.u32(frame.id)
        break
      case 'op':
        writer.u8(4)
        writeOp(writer, frame.op)
        break
      case 'undo':
        writer.u8(5)
        writer.u32(frame.id)
        break
      case 'clear':
        writer.u8(6)
        break
    }
    return writer.finish()
  },

  decodeFrame(bytes): InkFrame {
    const reader = new Reader(bytes)
    const tag = reader.u8()
    if (tag === 1) {
      const id = reader.u32()
      const toolTag = reader.u8()
      if (toolTag !== 1 && toolTag !== 2) throw new Error(`Ink codec: unknown stroke tool ${toolTag}`)
      return finishRead(reader, {
        f: 'begin',
        id,
        tool: toolTag === 1 ? 'pencil' : 'eraser',
        color: reader.color(),
        size: reader.u8(),
        pts: reader.points(),
      })
    }
    if (tag === 2) {
      return finishRead(reader, { f: 'append', id: reader.u32(), pts: reader.points() })
    }
    if (tag === 3) return finishRead(reader, { f: 'end', id: reader.u32() })
    if (tag === 4) return finishRead(reader, { f: 'op', op: readOp(reader) })
    if (tag === 5) return finishRead(reader, { f: 'undo', id: reader.u32() })
    if (tag === 6) return finishRead(reader, { f: 'clear' })
    throw new Error(`Ink codec: unknown frame tag ${tag}`)
  },

  encodeLog(ops): Uint8Array {
    const writer = new Writer()
    writer.raw(LOG_MAGIC)
    writer.u32(ops.length)
    for (const op of ops) writeOp(writer, op)
    return writer.finish()
  },

  decodeLog(bytes): CanvasOp[] {
    const reader = new Reader(bytes)
    for (const expected of LOG_MAGIC) {
      if (reader.u8() !== expected) throw new Error('Ink codec: invalid log header')
    }
    const count = reader.u32()
    const ops: CanvasOp[] = []
    for (let i = 0; i < count; i++) ops.push(readOp(reader))
    return finishRead(reader, ops)
  },
}
