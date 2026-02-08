export interface ApiResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code?: string;
        message: string;
        details?: Record<string, unknown>;
    };
}
