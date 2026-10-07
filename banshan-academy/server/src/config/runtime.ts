import path from 'path'

type Environment = Record<string, string | undefined>

export function resolveDatabaseConfig(env: Environment = process.env, includeDatabase = true) {
  const baseConfig: Record<string, string | number> = {
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    charset: 'utf8mb4',
  }

  if (includeDatabase) {
    baseConfig.database = env.DB_NAME || 'banshan'
  }

  if (env.USE_SOCKET === 'true') {
    return {
      socketPath: env.DB_SOCKET_PATH || '/tmp/mysql.sock',
      ...baseConfig,
    }
  }

  return {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT) || 3306,
    ...baseConfig,
  }
}

export function resolveUploadDir(env: Environment = process.env, cwd = process.cwd()) {
  const configuredPath = env.UPLOAD_DIR?.trim() || 'uploads'
  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(cwd, configuredPath)
}
