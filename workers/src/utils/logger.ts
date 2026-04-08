/**
 * 구조화된 로깅 유틸리티
 * JSON 형식으로 모든 로그를 기록
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogContext {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
  [key: string]: any;
}

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  /**
   * 로그 메시지 생성
   */
  private createLog(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): Record<string, any> {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };
  }

  /**
   * 현재 로그 레벨보다 높은 수준의 로그만 출력
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const log = this.createLog(LogLevel.DEBUG, message, context);
      console.log(JSON.stringify(log));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const log = this.createLog(LogLevel.INFO, message, context);
      console.log(JSON.stringify(log));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const log = this.createLog(LogLevel.WARN, message, context);
      console.warn(JSON.stringify(log));
    }
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const log = this.createLog(LogLevel.ERROR, message, context, error);
      console.error(JSON.stringify(log));
    }
  }

  /**
   * API 요청 로깅
   */
  logRequest(
    method: string,
    path: string,
    userId?: string,
    ipAddress?: string
  ): void {
    this.info('API 요청', {
      method,
      path,
      userId,
      ipAddress,
    });
  }

  /**
   * API 응답 로깅
   */
  logResponse(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    userId?: string
  ): void {
    this.info('API 응답', {
      method,
      path,
      statusCode,
      duration,
      userId,
    });
  }

  /**
   * 데이터베이스 쿼리 로깅
   */
  logQuery(query: string, params?: any[], duration?: number): void {
    this.debug('DB 쿼리', {
      query: query.substring(0, 200), // 길이 제한
      paramCount: params?.length || 0,
      duration,
    });
  }

  /**
   * 데이터 변경 감사 로깅
   */
  logAudit(
    action: string,
    resourceType: string,
    resourceId: string,
    userId: string,
    changes?: Record<string, any>,
    ipAddress?: string
  ): void {
    this.info('감사 로그', {
      action,
      resourceType,
      resourceId,
      userId,
      changes,
      ipAddress,
    });
  }

  /**
   * 보안 이벤트 로깅
   */
  logSecurity(
    event: string,
    severity: 'low' | 'medium' | 'high',
    context?: LogContext
  ): void {
    this.warn(`보안 이벤트: ${event}`, {
      severity,
      ...context,
    });
  }
}

// 싱글톤 인스턴스
export const logger = new Logger(LogLevel.INFO);

export default logger;
