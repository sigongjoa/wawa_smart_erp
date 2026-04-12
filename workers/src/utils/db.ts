import { logger } from '@/utils/logger';

export async function executeQuery<T>(
  db: D1Database,
  query: string,
  params?: unknown[]
): Promise<T[]> {
  try {
    const statement = db.prepare(query);
    const boundStatement = params ? statement.bind(...params) : statement;
    const result = await boundStatement.all();
    return (result.results || []) as T[];
  } catch (error) {
    logger.error('Database query error', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function executeFirst<T>(
  db: D1Database,
  query: string,
  params?: unknown[]
): Promise<T | null> {
  try {
    const statement = db.prepare(query);
    const boundStatement = params ? statement.bind(...params) : statement;
    const result = await boundStatement.first();
    return (result || null) as T | null;
  } catch (error) {
    logger.error('Database query error', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function executeInsert(
  db: D1Database,
  query: string,
  params?: unknown[]
): Promise<{ id: string; success: boolean }> {
  try {
    const statement = db.prepare(query);
    const boundStatement = params ? statement.bind(...params) : statement;
    const result = await boundStatement.run();
    return {
      id: result.meta.last_row_id?.toString() || '',
      success: result.success,
    };
  } catch (error) {
    logger.error('Database insert error', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function executeUpdate(
  db: D1Database,
  query: string,
  params?: unknown[]
): Promise<boolean> {
  try {
    const statement = db.prepare(query);
    const boundStatement = params ? statement.bind(...params) : statement;
    const result = await boundStatement.run();
    return result.success;
  } catch (error) {
    logger.error('Database update error', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function executeDelete(
  db: D1Database,
  query: string,
  params?: unknown[]
): Promise<boolean> {
  try {
    const statement = db.prepare(query);
    const boundStatement = params ? statement.bind(...params) : statement;
    const result = await boundStatement.run();
    return result.success;
  } catch (error) {
    logger.error('Database delete error', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// 트랜잭션 실행
export async function executeTransaction<T>(
  db: D1Database,
  callback: (db: D1Database) => Promise<T>
): Promise<T> {
  try {
    await db.prepare('BEGIN TRANSACTION').run();
    const result = await callback(db);
    await db.prepare('COMMIT').run();
    return result;
  } catch (error) {
    await db.prepare('ROLLBACK').run();
    throw error;
  }
}
