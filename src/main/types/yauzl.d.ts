declare module 'yauzl' {
  import type { EventEmitter } from 'events'

  export interface Entry {
    fileName: string
    compressedSize: number
    uncompressedSize: number
    crc32: number
  }

  export interface ZipFile extends EventEmitter {
    readEntry(): void
    close(): void
    on(event: 'entry', listener: (entry: Entry) => void): this
    on(event: 'end', listener: () => void): this
    on(event: 'error', listener: (err: Error) => void): this
  }

  export interface Options {
    lazyEntries?: boolean
    autoClose?: boolean
    validateEntrySizes?: boolean
  }

  export function open(
    path: string,
    options: Options,
    callback: (err: Error | null, zipfile?: ZipFile) => void
  ): void
}
