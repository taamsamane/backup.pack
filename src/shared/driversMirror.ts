/**
 * Official BackupHub driver mirror (re-hosted CLI tools for Driver Manager).
 * @see https://drivers.taam.shop/drivers/
 */
export const DRIVERS_MIRROR_BASE_URL = 'https://drivers.taam.shop/drivers'

export type DriverMirrorPlatform =
  | 'linux-x64'
  | 'linux-arm64'
  | 'darwin-x64'
  | 'darwin-arm64'
  | 'win-x64'

export type DriverMirrorArtifact = {
  toolId: string
  version: string
  platform: DriverMirrorPlatform
  filename: string
  /** Path under the mirror base URL (no leading slash). */
  relativePath: string
}

/** Artifacts currently published on drivers.taam.shop (matches driver-mirror catalog layout). */
export const DRIVER_MIRROR_ARTIFACTS: DriverMirrorArtifact[] = [
  {
    toolId: '7zip',
    version: '25.01',
    platform: 'linux-x64',
    filename: '7z2501-linux-x64.tar.xz',
    relativePath: '7zip/25.01/linux-x64/7z2501-linux-x64.tar.xz'
  },
  {
    toolId: '7zip',
    version: '25.01',
    platform: 'linux-arm64',
    filename: '7z2501-linux-arm64.tar.xz',
    relativePath: '7zip/25.01/linux-arm64/7z2501-linux-arm64.tar.xz'
  },
  {
    toolId: '7zip',
    version: '25.01',
    platform: 'darwin-arm64',
    filename: '7z2501-mac.tar.xz',
    relativePath: '7zip/25.01/darwin-arm64/7z2501-mac.tar.xz'
  },
  {
    toolId: '7zip',
    version: '25.01',
    platform: 'win-x64',
    filename: '7z2501-x64.exe',
    relativePath: '7zip/25.01/win-x64/7z2501-x64.exe'
  },
  {
    toolId: 'mariadb',
    version: '11.4.5',
    platform: 'linux-x64',
    filename: 'mariadb-11.4.5-linux-x64.tar.gz',
    relativePath: 'mariadb/11.4.5/linux-x64/mariadb-11.4.5-linux-x64.tar.gz'
  },
  {
    toolId: 'mariadb',
    version: '11.4.5',
    platform: 'win-x64',
    filename: 'mariadb-11.4.5-win-x64.zip',
    relativePath: 'mariadb/11.4.5/win-x64/mariadb-11.4.5-win-x64.zip'
  },
  {
    toolId: 'mongodb-database-tools',
    version: '100.11.0',
    platform: 'linux-x64',
    filename: 'mongodb-database-tools-linux-x64-100.11.0.tgz',
    relativePath:
      'mongodb-database-tools/100.11.0/linux-x64/mongodb-database-tools-linux-x64-100.11.0.tgz'
  },
  {
    toolId: 'mongodb-database-tools',
    version: '100.11.0',
    platform: 'darwin-x64',
    filename: 'mongodb-database-tools-macos-x64-100.11.0.zip',
    relativePath:
      'mongodb-database-tools/100.11.0/darwin-x64/mongodb-database-tools-macos-x64-100.11.0.zip'
  },
  {
    toolId: 'mongodb-database-tools',
    version: '100.11.0',
    platform: 'darwin-arm64',
    filename: 'mongodb-database-tools-macos-arm64-100.11.0.zip',
    relativePath:
      'mongodb-database-tools/100.11.0/darwin-arm64/mongodb-database-tools-macos-arm64-100.11.0.zip'
  },
  {
    toolId: 'mongodb-database-tools',
    version: '100.11.0',
    platform: 'win-x64',
    filename: 'mongodb-database-tools-windows-x64-100.11.0.zip',
    relativePath:
      'mongodb-database-tools/100.11.0/win-x64/mongodb-database-tools-windows-x64-100.11.0.zip'
  },
  {
    toolId: 'postgresql',
    version: '18.6.1',
    platform: 'linux-x64',
    filename: 'postgresql-18.6.1-linux-x64.tar.gz',
    relativePath: 'postgresql/18.6.1/linux-x64/postgresql-18.6.1-linux-x64.tar.gz'
  },
  {
    toolId: 'postgresql',
    version: '18.6.1',
    platform: 'linux-arm64',
    filename: 'postgresql-18.6.1-linux-arm64.tar.gz',
    relativePath: 'postgresql/18.6.1/linux-arm64/postgresql-18.6.1-linux-arm64.tar.gz'
  },
  {
    toolId: 'postgresql',
    version: '18.6.1',
    platform: 'darwin-x64',
    filename: 'postgresql-18.6.1-darwin-x64.tar.gz',
    relativePath: 'postgresql/18.6.1/darwin-x64/postgresql-18.6.1-darwin-x64.tar.gz'
  },
  {
    toolId: 'postgresql',
    version: '18.6.1',
    platform: 'darwin-arm64',
    filename: 'postgresql-18.6.1-darwin-arm64.tar.gz',
    relativePath: 'postgresql/18.6.1/darwin-arm64/postgresql-18.6.1-darwin-arm64.tar.gz'
  },
  {
    toolId: 'postgresql',
    version: '18.6.1',
    platform: 'win-x64',
    filename: 'postgresql-18.6.1-win-x64.zip',
    relativePath: 'postgresql/18.6.1/win-x64/postgresql-18.6.1-win-x64.zip'
  },
  {
    toolId: 'sqlpackage',
    version: '170.4.83.3',
    platform: 'linux-x64',
    filename: 'sqlpackage-linux-x64.zip',
    relativePath: 'sqlpackage/170.4.83.3/linux-x64/sqlpackage-linux-x64.zip'
  },
  {
    toolId: 'sqlpackage',
    version: '170.4.83.3',
    platform: 'darwin-x64',
    filename: 'sqlpackage-osx-x64.zip',
    relativePath: 'sqlpackage/170.4.83.3/darwin-x64/sqlpackage-osx-x64.zip'
  },
  {
    toolId: 'sqlpackage',
    version: '170.4.83.3',
    platform: 'win-x64',
    filename: 'sqlpackage-win-x64.zip',
    relativePath: 'sqlpackage/170.4.83.3/win-x64/sqlpackage-win-x64.zip'
  }
]

export function driverMirrorUrl(relativePath: string): string {
  const base = DRIVERS_MIRROR_BASE_URL.replace(/\/$/, '')
  const path = relativePath.replace(/^\//, '')
  return `${base}/${path}`
}

export function listDriverMirrorUrls(): Array<DriverMirrorArtifact & { url: string }> {
  return DRIVER_MIRROR_ARTIFACTS.map((artifact) => ({
    ...artifact,
    url: driverMirrorUrl(artifact.relativePath)
  }))
}
