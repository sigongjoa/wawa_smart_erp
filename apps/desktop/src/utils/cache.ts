/**
 * IndexedDB 캐싱 시스템
 * 오프라인 지원 및 빠른 로딩을 위한 로컬 캐시
 */

const DB_NAME = 'wawa-smart-erp';
const DB_VERSION = 1;

type StoreName = 'students' | 'classes' | 'exams' | 'grades' | 'reports' | 'attendance';

interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
}

class CacheManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initDB();
  }

  /**
   * IndexedDB 초기화
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        const stores: StoreName[] = ['students', 'classes', 'exams', 'grades', 'reports', 'attendance'];
        for (const store of stores) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'key' });
          }
        }
      };
    });
  }

  /**
   * DB 준비 확인
   */
  private async ensureReady(): Promise<void> {
    await this.initPromise;
    if (!this.db) {
      throw new Error('Database not initialized');
    }
  }

  /**
   * 데이터 저장
   */
  async set<T>(
    store: StoreName,
    key: string,
    data: T,
    ttl?: number
  ): Promise<void> {
    await this.ensureReady();

    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      ttl,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([store], 'readwrite');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * 데이터 조회
   */
  async get<T>(store: StoreName, key: string): Promise<T | null> {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([store], 'readonly');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        // TTL 확인
        if (entry.ttl) {
          const age = Date.now() - entry.timestamp;
          if (age > entry.ttl) {
            // 만료된 데이터 삭제
            this.delete(store, key).catch(console.error);
            resolve(null);
            return;
          }
        }

        resolve(entry.data);
      };
    });
  }

  /**
   * 여러 데이터 조회
   */
  async getAll<T>(store: StoreName): Promise<T[]> {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([store], 'readonly');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entries = request.result as CacheEntry<T>[];
        const now = Date.now();

        // 만료된 데이터 필터링
        const validData = entries.filter((entry) => {
          if (entry.ttl) {
            const age = now - entry.timestamp;
            return age <= entry.ttl;
          }
          return true;
        });

        resolve(validData.map((entry) => entry.data));
      };
    });
  }

  /**
   * 데이터 삭제
   */
  async delete(store: StoreName, key: string): Promise<void> {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([store], 'readwrite');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * 저장소 전체 삭제
   */
  async clear(store: StoreName): Promise<void> {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([store], 'readwrite');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * 모든 저장소 삭제 (로그아웃 시)
   */
  async clearAll(): Promise<void> {
    const stores: StoreName[] = ['students', 'classes', 'exams', 'grades', 'reports', 'attendance'];
    await Promise.all(stores.map((store) => this.clear(store)));
  }
}

// 싱글톤 인스턴스
export const cacheManager = new CacheManager();

export default cacheManager;
