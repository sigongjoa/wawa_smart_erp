import { test, expect } from '@playwright/test';

/**
 * 학부모 리포트 이미지 업로드 및 공유 링크 실제 테스트
 * - PNG 이미지 업로드
 * - 공유 링크로 이미지 조회 가능한지 확인
 */

const API_URL = 'http://localhost:8787';

test.describe.serial('🖼️ 리포트 이미지 업로드 및 공유 링크 테스트', () => {
  let adminToken: string;
  let uploadedImageUrl: string;
  let filePath: string;

  test('1. 관리자 로그인', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        name: '김상현',
        pin: '1234',
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    adminToken = data.data.accessToken;
    console.log('✅ 로그인 성공');
  });

  test('2. 테스트 PNG 이미지 업로드', async ({ request }) => {
    // 1x1 픽셀 흰색 PNG (Base64로 하드코딩)
    const testPNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/8BQAwAI/AL+nBIWpQAAAABJRU5ErkJggg==';

    const uploadResponse = await request.post(`${API_URL}/api/report/upload-image`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        imageBase64: testPNG,
        studentName: '강은서',
        yearMonth: '2026-04',
      },
    });

    console.log(`업로드 응답 상태: ${uploadResponse.status()}`);
    const uploadData = await uploadResponse.json();
    console.log('업로드 응답:', JSON.stringify(uploadData, null, 2));

    expect(uploadResponse.status()).toBe(201);
    expect(uploadData.data?.shareUrl).toBeTruthy();
    expect(uploadData.data?.imageUrl).toBeTruthy();
    expect(uploadData.data?.filePath).toBeTruthy();

    uploadedImageUrl = uploadData.data.imageUrl;
    filePath = uploadData.data.filePath;

    console.log(`✅ 이미지 업로드 성공`);
    console.log(`   URL: ${uploadedImageUrl}`);
    console.log(`   Path: ${filePath}`);
  });

  test('3. 업로드된 이미지 공개 접근 테스트 (인증 없이)', async ({ request }) => {
    expect(uploadedImageUrl).toBeTruthy();

    // 인증 없이 접근 (학부모가 링크를 클릭)
    const getResponse = await request.get(uploadedImageUrl);

    console.log(`\n공개 링크 접근:`);
    console.log(`  URL: ${uploadedImageUrl}`);
    console.log(`  상태: ${getResponse.status()}`);
    console.log(`  Content-Type: ${getResponse.headers()['content-type']}`);
    console.log(`  크기: ${getResponse.headers()['content-length']} bytes`);

    expect(getResponse.status()).toBe(200);
    expect(getResponse.headers()['content-type']).toContain('image/png');

    console.log(`✅ 이미지 공개 접근 성공!`);
    console.log(`   학부모가 이 링크로 바로 이미지 볼 수 있습니다:`);
    console.log(`   ${uploadedImageUrl}`);
  });

  test('4. 직접 경로로도 접근 가능한지 확인', async ({ request }) => {
    expect(filePath).toBeTruthy();

    // /api/report/image/{filePath} 형식으로 직접 접근
    const directUrl = `${API_URL}/api/report/image/${filePath}`;
    const getResponse = await request.get(directUrl);

    console.log(`\n직접 경로 접근:`);
    console.log(`  URL: ${directUrl}`);
    console.log(`  상태: ${getResponse.status()}`);

    expect(getResponse.status()).toBe(200);
    expect(getResponse.headers()['content-type']).toContain('image/png');

    console.log(`✅ 직접 경로 접근도 성공!`);
  });

  test('5. 이미지 삭제 테스트', async ({ request }) => {
    expect(filePath).toBeTruthy();

    // 인증 필요 (관리자만)
    const deleteResponse = await request.delete(
      `${API_URL}/api/report/image/${filePath}`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      }
    );

    console.log(`\n이미지 삭제:`);
    console.log(`  상태: ${deleteResponse.status()}`);

    expect(deleteResponse.status()).toBe(200);

    console.log(`✅ 이미지 삭제 성공`);
  });

  test('6. 삭제된 이미지 접근 테스트 (404)', async ({ request }) => {
    expect(filePath).toBeTruthy();
    expect(uploadedImageUrl).toBeTruthy();

    // 삭제 후 접근 시도
    const getResponse = await request.get(uploadedImageUrl);

    console.log(`\n삭제된 이미지 접근:`);
    console.log(`  상태: ${getResponse.status()}`);

    expect(getResponse.status()).toBe(404);

    console.log(`✅ 정상적으로 404 반환됨`);
  });
});

