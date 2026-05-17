/**
 * UC-03 — 사진 업로드 helper 테스트
 *
 * R2 PUT 자체는 통합 테스트 대상. 여기서는 순수 helper만:
 *   - key 생성 규칙 (학생별/날짜별 격리)
 *   - 파일 검증 (크기·MIME)
 *   - 7일 후 만료 날짜 계산
 */

import { describe, it, expect } from 'vitest';
import { makePhotoKey, validatePhotoFile, expirationDate, MAX_PHOTO_BYTES } from './photo-upload';

describe('makePhotoKey — R2 객체 키 형식', () => {
  it('students/{id}/photos/{date}/{uuid}.{ext}', () => {
    const key = makePhotoKey({
      student_id: 'iruda-001',
      today: '2026-05-15',
      uuid: 'abc-123',
      filename: 'IMG_1234.jpg',
    });
    expect(key).toBe('students/iruda-001/photos/2026-05-15/abc-123.jpg');
  });

  it('확장자 lowercase 강제', () => {
    const key = makePhotoKey({
      student_id: 'iruda-001',
      today: '2026-05-15',
      uuid: 'abc-123',
      filename: 'IMG.JPG',
    });
    expect(key).toContain('.jpg');
  });

  it('HEIC 그대로 보존 (iOS 카메라)', () => {
    const key = makePhotoKey({
      student_id: 'iruda-001',
      today: '2026-05-15',
      uuid: 'abc-123',
      filename: 'IMG_1234.HEIC',
    });
    expect(key).toContain('.heic');
  });

  it('확장자 없는 파일은 .jpg 기본', () => {
    const key = makePhotoKey({
      student_id: 'iruda-001',
      today: '2026-05-15',
      uuid: 'abc-123',
      filename: 'photo',
    });
    expect(key).toContain('.jpg');
  });

  it('학생 ID 특수문자는 escape', () => {
    // 학생 ID에 ../ 같은 path traversal 시도
    expect(() => makePhotoKey({
      student_id: '../malicious',
      today: '2026-05-15',
      uuid: 'abc-123',
      filename: 'a.jpg',
    })).toThrow(/invalid|escape/i);
  });
});

describe('validatePhotoFile — UC-03 검증', () => {
  it('1MB JPG 통과', () => {
    expect(validatePhotoFile({ size: 1_000_000, mime: 'image/jpeg' })).toMatchObject({
      allowed: true,
    });
  });

  it('5MB 초과 거부', () => {
    const r = validatePhotoFile({ size: 6_000_000, mime: 'image/jpeg' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/크기|5MB|size/i);
  });

  it('정확히 5MB 통과 (경계값)', () => {
    expect(validatePhotoFile({ size: MAX_PHOTO_BYTES, mime: 'image/jpeg' }).allowed).toBe(true);
  });

  it('5MB + 1 byte 거부', () => {
    expect(validatePhotoFile({ size: MAX_PHOTO_BYTES + 1, mime: 'image/jpeg' }).allowed).toBe(false);
  });

  it('PNG 허용', () => {
    expect(validatePhotoFile({ size: 100_000, mime: 'image/png' }).allowed).toBe(true);
  });

  it('HEIC 허용', () => {
    expect(validatePhotoFile({ size: 100_000, mime: 'image/heic' }).allowed).toBe(true);
  });

  it('PDF 거부 (이미지 외 차단)', () => {
    expect(validatePhotoFile({ size: 100_000, mime: 'application/pdf' }).allowed).toBe(false);
  });

  it('빈 파일 거부', () => {
    expect(validatePhotoFile({ size: 0, mime: 'image/jpeg' }).allowed).toBe(false);
  });
});

describe('expirationDate — 7일 후 자동 삭제', () => {
  it('업로드 날짜 + 7일', () => {
    expect(expirationDate('2026-05-15')).toBe('2026-05-22');
  });

  it('월말 넘어가도 정확', () => {
    expect(expirationDate('2026-05-28')).toBe('2026-06-04');
  });
});
