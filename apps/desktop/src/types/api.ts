export interface ApiResult<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code?: string;
        message: string;
        details?: any;
    };
}
