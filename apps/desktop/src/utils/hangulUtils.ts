/**
 * Hangul utility for Chosung extraction and matching.
 */

const CHOSUNG = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

/**
 * Extracts chosung from a Hangul string.
 */
export function getChosung(text: string): string {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i) - 0xAC00;
        if (code > -1 && code < 11172) {
            result += CHOSUNG[Math.floor(Math.floor(code / 28) / 21)];
        } else {
            result += text[i];
        }
    }
    return result;
}

/**
 * Checks if a string consists only of Korean consonants (Chosung).
 */
export function isChosungOnly(text: string): boolean {
    const chosungRegex = /^[ㄱ-ㅎ]+$/;
    return chosungRegex.test(text);
}

/**
 * Comprehensive match: true if text contains search (full-text or chosung).
 */
export function includesHangul(text: string, search: string): boolean {
    const normalizedText = text.toLowerCase();
    const normalizedSearch = search.toLowerCase();

    if (normalizedText.includes(normalizedSearch)) return true;

    if (isChosungOnly(normalizedSearch)) {
        const chosungText = getChosung(normalizedText);
        return chosungText.includes(normalizedSearch);
    }

    return false;
}
