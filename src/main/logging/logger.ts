import { join } from 'path'
import { app } from 'electron'
import pino, { type Logger } from 'pino'
import type { LogLevel } from '../../shared/settings'

let rootLogger: Logger | null = null
let logsDirectory: string | null = null

export function getLogsDirectory(): string {
  if (!logsDirectory) {
    logsDirectory = join(app.getPath('userData'), 'logs')
  }
  return logsDirectory
}

/**
 * Create the application logger with rotating file transport.
 * Secrets must never be passed into log arguments.
 */
export async function initLogger(level: LogLevel = 'info'): Promise<Logger> {
  if (rootLogger) {
    rootLogger.level = level
    return rootLogger
  }

  const logDir = getLogsDirectory()
  const transport = pino.transport({
    targets: [
      {
        target: 'pino-roll',
        level,
        options: {
          file: join(logDir, 'backuphub.log'),
          frequency: 'daily',
          size: '10m',
          mkdir: true,
          limit: { count: 14 }
        }
      },
      {
        target: 'pino/file',
        level,
        options: { destination: 1 }
      }
    ]
  })

  rootLogger = pino(
    {
      level,
      base: {
        app: 'BackupHub',
        pid: process.pid
      },
      redact: {
        paths: [
          'password',
          'secret',
          'credentials',
          'accessKeyId',
          'secretAccessKey',
          'privateKey',
          'token',
          '*.password',
          '*.secret',
          '*.credentials',
          '*.privateKey'
        ],
        censor: '[Redacted]'
      }
    },
    transport
  )

  rootLogger.info({ logDir }, 'Logger initialized')
  return rootLogger
}

export function getLogger(name?: string): Logger {
  if (!rootLogger) {
    throw new Error('Logger has not been initialized. Call initLogger() first.')
  }
  return name ? rootLogger.child({ module: name }) : rootLogger
}

export function setLogLevel(level: LogLevel): void {
  if (rootLogger) {
    rootLogger.level = level
  }
}
