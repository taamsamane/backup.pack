import type {
  AuthMethod,
  ConnectionTestResult,
  ProfileCredentials,
  ProfileOptions,
  ProfileType
} from '../../../shared/profiles'

export type ResolvedProfile = {
  type: ProfileType
  name: string
  host: string | null
  port: number | null
  username: string | null
  authMethod: AuthMethod
  credentials: ProfileCredentials
  options: ProfileOptions
}

export type ConnectionTester = (profile: ResolvedProfile) => Promise<ConnectionTestResult>
