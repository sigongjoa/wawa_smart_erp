import { useState, useCallback } from 'react';
import { ApiResult } from '../types/api';

interface AsyncState<T> {
    data: T | null;
    isLoading: boolean;
    error: string | null;
}

export function useAsync<T, Args extends any[]>(
    asyncFn: (...args: Args) => Promise<ApiResult<T>>
) {
    const [state, setState] = useState<AsyncState<T>>({
        data: null,
        isLoading: false,
        error: null,
    });

    const execute = useCallback(
        async (...args: Args): Promise<ApiResult<T>> => {
            setState((prev) => ({ ...prev, isLoading: true, error: null }));
            try {
                const result = await asyncFn(...args);
                if (result.success) {
                    setState({ data: result.data || null, isLoading: false, error: null });
                } else {
                    setState({ data: null, isLoading: false, error: result.error?.message || '알 수 없는 오류가 발생했습니다.' });
                }
                return result;
            } catch (err: any) {
                const errorMessage = err.message || '서버 통신 중 에러가 발생했습니다.';
                setState({ data: null, isLoading: false, error: errorMessage });
                return { success: false, error: { message: errorMessage } };
            }
        },
        [asyncFn]
    );

    return { ...state, execute };
}
