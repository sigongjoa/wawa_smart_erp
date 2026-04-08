import { Env, ApiResponse } from '@/types';

export async function executeQuery<T>(
  db: any,
  query: string,
  params?: any[]
): Promise<T[]> {
  try {
    const statement = db.prepare(query);
    const boundStatement = params ? statement.bind(...params) : statement;
    const result = await boundStatement.all();
    return (result.results || []) as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export async function executeFirst<T>(
  db: any,
  query: string,
  params?: any[]
): Promise<T | null> {
  try {
    const statement = db.prepare(query);
    const boundStatement = params ? statement.bind(...params) : statement;
    const result = await boundStatement.first();
    return (result || null) as T | null;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export async function executeInsert(
  db: any,
  query: string,
  params?: any[]
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
    console.error('Database insert error:', error);
    throw error;
  }
}

export async function executeUpdate(
  db: any,
  query: string,
  params?: any[]
): Promise<boolean> {
  try {
    const statement = db.prepare(query);
    const boundStatement = params ? statement.bind(...params) : statement;
    const result = await boundStatement.run();
    return result.success;
  } catch (error) {
    console.error('Database update error:', error);
    throw error;
  }
}

export async function executeDelete(
  db: any,
  query: string,
  params?: any[]
): Promise<boolean> {
  try {
    const statement = db.prepare(query);
    const boundStatement = params ? statement.bind(...params) : statement;
    const result = await boundStatement.run();
    return result.success;
  } catch (error) {
    console.error('Database delete error:', error);
    throw error;
  }
}

// 트랜잭션 실행
export async function executeTransaction(
  db: any,
  callback: (db: any) => Promise<any>
): Promise<any> {
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
