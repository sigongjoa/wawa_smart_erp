import { describe, it, expect } from 'vitest';
import { getChosung, isChosungOnly, includesHangul } from '../hangulUtils';

describe('hangulUtils', () => {
    describe('getChosung', () => {
        it('should extract chosung correctly', () => {
            expect(getChosung('서재용')).toBe('ㅅㅈㅇ');
            expect(getChosung('강남')).toBe('ㄱㄴ');
            expect(getChosung('홍길동')).toBe('ㅎㄱㄷ');
            expect(getChosung('React')).toBe('React');
        });
    });

    describe('isChosungOnly', () => {
        it('should detect chosung strings', () => {
            expect(isChosungOnly('ㅅㅈㅇ')).toBe(true);
            expect(isChosungOnly('ㄱㄴㄷ')).toBe(true);
            expect(isChosungOnly('서재용')).toBe(false);
            expect(isChosungOnly('abc')).toBe(false);
        });
    });

    describe('includesHangul', () => {
        it('should match full text', () => {
            expect(includesHangul('서재용', '서재')).toBe(true);
            expect(includesHangul('서재용', '재용')).toBe(true);
        });

        it('should match chosung', () => {
            expect(includesHangul('서재용', 'ㅅㅈㅇ')).toBe(true);
            expect(includesHangul('서재용', 'ㅅㅈ')).toBe(true);
            expect(includesHangul('서재용', 'ㅈㅇ')).toBe(true);
        });

        it('should not match incorrect chosung', () => {
            expect(includesHangul('서재용', 'ㄱㄴ')).toBe(false);
        });
    });
});
