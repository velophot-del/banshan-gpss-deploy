import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import { resolveDatabaseConfig } from './runtime.js'

dotenv.config()

export const dbConfig = {
  ...resolveDatabaseConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}

const pool = mysql.createPool(dbConfig)

export async function getConnection() {
  return pool.getConnection()
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const [rows] = await pool.query(sql, params)
  return rows as T[]
}

export async function transaction<T>(callback: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const result = await callback(conn)
    await conn.commit()
    return result
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

export { pool }
