import { useState, useMemo } from 'react';
import { includesHangul } from '../utils/hangulUtils';

/**
 * Hook for unified search with Chosung support.
 * 
 * @param items List of items to search
 * @param keys The key or array of keys in the item to search against
 */
export function useSearch<T>(items: T[], keys: keyof T | (keyof T)[]) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredItems = useMemo(() => {
        if (!searchTerm.trim()) return items;

        const keyList = Array.isArray(keys) ? keys : [keys];

        return items.filter(item => {
            return keyList.some(key => {
                const value = item[key];
                if (typeof value === 'string') {
                    return includesHangul(value, searchTerm);
                }
                return false;
            });
        });
    }, [items, searchTerm, keys]);

    return {
        searchTerm,
        setSearchTerm,
        filteredItems,
        isEmpty: filteredItems.length === 0,
        totalCount: items.length,
        filteredCount: filteredItems.length
    };
}
