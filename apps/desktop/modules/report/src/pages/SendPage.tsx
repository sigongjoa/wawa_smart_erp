import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import {
  kakaoLogin,
  kakaoLogout,
  checkKakaoLogin,
  sendKakaoMessageToMe,
  restoreAccessToken,
} from '../services/kakao';
import { uploadReportToCloudinary, getCloudinaryConfig } from '../services/cloudinary';
import { sendReportAlimtalk, validatePhoneNumber, generateAlimtalkPreview } from '../services/alimtalk';

type SendMethod = 'kakao' | 'alimtalk';

export default function SendPage() {
  const navigate = useNavigate();
  const { currentReport, addSendHistory, appSettings } = useReportStore();

  // 카카오 로그인 상태
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 전송 방식
  const [sendMethod, setSendMethod] = useState<SendMethod>('kakao');

  // 알림톡 전송
  const [parentPhone, setParentPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // Cloudinary 업로드
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedPdfUrl, setUploadedPdfUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 전송 상태
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Cloudinary 설정 여부
  const cloudinaryConfig = getCloudinaryConfig();
  const isCloudinaryConfigured = !!cloudinaryConfig.cloudName && !!cloudinaryConfig.apiKey && !!cloudinaryConfig.apiSecret;

  // 페이지 로드시 로그인 상태 확인 (토큰 자동 갱신)
  useEffect(() => {
    const checkLogin = async () => {
      await restoreAccessToken();
      setIsLoggedIn(checkKakaoLogin());
    };
    checkLogin();
  }, []);

  // 전화번호 유효성 검사
  useEffect(() => {
    if (parentPhone) {
      if (!validatePhoneNumber(parentPhone)) {
        setPhoneError('올바른 휴대폰 번호를 입력해주세요. (예: 010-1234-5678)');
      } else {
        setPhoneError('');
      }
    } else {
      setPhoneError('');
    }
  }, [parentPhone]);

  const handleKakaoLogin = async () => {
    setIsLoggingIn(true);
    try {
      const token = await kakaoLogin();
      if (token) {
        setIsLoggedIn(true);
      } else {
        alert('카카오 로그인에 실패했습니다.');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('카카오 로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleKakaoLogout = async () => {
    await kakaoLogout();
    setIsLoggedIn(false);
  };

  // Cloudinary에 PDF 업로드
  const handleUploadToCloudinary = async () => {
    if (!currentReport) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const result = await uploadReportToCloudinary(
        'report-content',
        currentReport.studentName,
        currentReport.yearMonth
      );

      if (result.success && result.url) {
        setUploadedPdfUrl(result.url);
      } else {
        setUploadError(result.error || '업로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  // 카카오톡 나에게 보내기
  const handleSendToMe = async () => {
    if (!currentReport) {
      alert('전송할 리포트가 없습니다.');
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const title = `${currentReport.studentName} - ${currentReport.yearMonth} 월말평가`;
      let description = currentReport.scores
        .map((s) => `${s.subject}: ${s.score}점`)
        .join('\n');

      // PDF URL이 있으면 추가
      if (uploadedPdfUrl) {
        description += `\n\n리포트 확인: ${uploadedPdfUrl}`;
      }

      const success = await sendKakaoMessageToMe(title, description);

      if (success) {
        addSendHistory({
          studentId: currentReport.studentId,
          studentName: currentReport.studentName,
          reportId: currentReport.id,
          recipientName: '나에게 보내기',
          recipientType: 'self',
          sentAt: new Date().toISOString(),
          status: 'success',
          pdfUrl: uploadedPdfUrl || undefined,
        });
        setSendResult({ success: true, message: '카카오톡으로 전송되었습니다!' });
      } else {
        setSendResult({ success: false, message: '전송에 실패했습니다. 다시 로그인해주세요.' });
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('Send error:', error);
      setSendResult({ success: false, message: '전송 중 오류가 발생했습니다.' });
    } finally {
      setSending(false);
    }
  };

  // 알림톡 전송
  const handleSendAlimtalk = async () => {
    if (!currentReport) {
      alert('전송할 리포트가 없습니다.');
      return;
    }

    if (!parentPhone || !validatePhoneNumber(parentPhone)) {
      setPhoneError('올바른 휴대폰 번호를 입력해주세요.');
      return;
    }

    if (!uploadedPdfUrl) {
      alert('먼저 PDF를 Cloudinary에 업로드해주세요.');
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const result = await sendReportAlimtalk(
        parentPhone,
        currentReport.studentName,
        currentReport.yearMonth,
        uploadedPdfUrl,
        appSettings.academyName
      );

      if (result.success) {
        addSendHistory({
          studentId: currentReport.studentId,
          studentName: currentReport.studentName,
          reportId: currentReport.id,
          recipientName: parentPhone,
          recipientPhone: parentPhone,
          recipientType: 'alimtalk',
          sentAt: new Date().toISOString(),
          status: 'success',
          pdfUrl: uploadedPdfUrl,
        });
        setSendResult({ success: true, message: '알림톡이 전송되었습니다!' });
      } else {
        setSendResult({ success: false, message: result.error || '전송에 실패했습니다.' });
      }
    } catch (error) {
      console.error('Alimtalk error:', error);
      setSendResult({ success: false, message: '전송 중 오류가 발생했습니다.' });
    } finally {
      setSending(false);
    }
  };

  if (!currentReport) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>전송할 리포트가 없습니다.</p>
          <button
            onClick={() => navigate('/admin')}
            style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            관리 페이지로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* 헤더 */}
      <header style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>리포트 전송</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => navigate('/preview')}
              style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
            >
              미리보기
            </button>
            <button
              onClick={() => navigate('/admin')}
              style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
            >
              돌아가기
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
          {/* 왼쪽: 리포트 정보 및 업로드 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 리포트 정보 */}
            <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>전송할 리포트</h2>
              <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: '600', fontSize: '18px', color: '#1f2937' }}>{currentReport.studentName}</p>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>{currentReport.yearMonth}</p>
                  </div>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {currentReport.scores.map((s) => (
                    <span
                      key={s.subject}
                      style={{ padding: '4px 12px', backgroundColor: '#ffffff', borderRadius: '9999px', fontSize: '14px', border: '1px solid #e5e7eb' }}
                    >
                      {s.subject}: {s.score}점
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Cloudinary 업로드 */}
            <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>PDF 업로드</h2>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
                알림톡으로 PDF 링크를 전송하려면 먼저 Cloudinary에 업로드해주세요.
              </p>

              {!isCloudinaryConfigured ? (
                <div style={{ backgroundColor: '#fef3c7', borderRadius: '8px', padding: '16px', border: '1px solid #fcd34d' }}>
                  <p style={{ color: '#92400e', fontSize: '14px', marginBottom: '8px' }}>
                    Cloudinary 설정이 필요합니다.
                  </p>
                  <button
                    onClick={() => navigate('/settings')}
                    style={{ color: '#2563eb', fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    설정 페이지로 이동
                  </button>
                </div>
              ) : uploadedPdfUrl ? (
                <div style={{ backgroundColor: '#f0fdf4', borderRadius: '8px', padding: '16px', border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ color: '#16a34a', fontSize: '18px' }}>✓</span>
                    <span style={{ color: '#166534', fontWeight: '500' }}>업로드 완료</span>
                  </div>
                  <a
                    href={uploadedPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#2563eb', fontSize: '13px', wordBreak: 'break-all' }}
                  >
                    {uploadedPdfUrl}
                  </a>
                  <button
                    onClick={() => setUploadedPdfUrl(null)}
                    style={{ display: 'block', marginTop: '12px', color: '#6b7280', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    다시 업로드
                  </button>
                </div>
              ) : (
                <div>
                  {uploadError && (
                    <div style={{ backgroundColor: '#fef2f2', borderRadius: '8px', padding: '12px', marginBottom: '12px', color: '#dc2626', fontSize: '14px' }}>
                      {uploadError}
                    </div>
                  )}
                  <button
                    onClick={handleUploadToCloudinary}
                    disabled={isUploading}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: isUploading ? '#d1d5db' : '#f97316',
                      color: '#ffffff',
                      borderRadius: '8px',
                      fontWeight: '500',
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      border: 'none',
                    }}
                  >
                    {isUploading ? '업로드 중...' : 'Cloudinary에 업로드'}
                  </button>
                </div>
              )}
            </section>

            {/* 전송 방식 선택 */}
            <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>전송 방식</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ flex: 1, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="sendMethod"
                    value="kakao"
                    checked={sendMethod === 'kakao'}
                    onChange={() => setSendMethod('kakao')}
                    style={{ display: 'none' }}
                  />
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      border: `2px solid ${sendMethod === 'kakao' ? '#facc15' : '#e5e7eb'}`,
                      backgroundColor: sendMethod === 'kakao' ? '#fefce8' : '#ffffff',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ fontWeight: '500', marginBottom: '4px' }}>카카오톡</p>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>나에게 테스트</p>
                  </div>
                </label>
                <label style={{ flex: 1, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="sendMethod"
                    value="alimtalk"
                    checked={sendMethod === 'alimtalk'}
                    onChange={() => setSendMethod('alimtalk')}
                    style={{ display: 'none' }}
                  />
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      border: `2px solid ${sendMethod === 'alimtalk' ? '#2563eb' : '#e5e7eb'}`,
                      backgroundColor: sendMethod === 'alimtalk' ? '#eff6ff' : '#ffffff',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ fontWeight: '500', marginBottom: '4px' }}>알림톡</p>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>학부모 전송</p>
                  </div>
                </label>
              </div>
            </section>
          </div>

          {/* 오른쪽: 전송 패널 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 카카오톡 전송 */}
            {sendMethod === 'kakao' && (
              <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>카카오톡 전송</h2>

                {/* 로그인 상태 */}
                {isLoggedIn ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#16a34a' }}>✓</span>
                      <span style={{ color: '#166534', fontSize: '14px' }}>로그인됨</span>
                    </div>
                    <button
                      onClick={handleKakaoLogout}
                      style={{ padding: '4px 8px', fontSize: '13px', color: '#6b7280', cursor: 'pointer', background: 'none', border: 'none' }}
                    >
                      로그아웃
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleKakaoLogin}
                    disabled={isLoggingIn}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: isLoggingIn ? '#fde68a' : '#facc15',
                      color: '#1f2937',
                      borderRadius: '8px',
                      fontWeight: '500',
                      cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                      border: 'none',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    {isLoggingIn ? '로그인 중...' : '카카오 로그인'}
                  </button>
                )}

                {/* 전송 결과 */}
                {sendResult && (
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      backgroundColor: sendResult.success ? '#f0fdf4' : '#fef2f2',
                      color: sendResult.success ? '#166534' : '#991b1b',
                      fontSize: '14px',
                    }}
                  >
                    {sendResult.message}
                  </div>
                )}

                {/* 전송 버튼 */}
                <button
                  onClick={handleSendToMe}
                  disabled={!isLoggedIn || sending}
                  style={{
                    width: '100%',
                    padding: '14px',
                    backgroundColor: isLoggedIn && !sending ? '#2563eb' : '#d1d5db',
                    color: '#ffffff',
                    borderRadius: '8px',
                    fontWeight: '500',
                    fontSize: '16px',
                    cursor: isLoggedIn && !sending ? 'pointer' : 'not-allowed',
                    border: 'none',
                  }}
                >
                  {sending ? '전송 중...' : '나에게 테스트 전송'}
                </button>

                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '12px', textAlign: 'center' }}>
                  카카오톡 "나와의 채팅"으로 메시지가 전송됩니다.
                </p>
              </section>
            )}

            {/* 알림톡 전송 */}
            {sendMethod === 'alimtalk' && (
              <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>알림톡 전송</h2>

                {/* 학부모 전화번호 입력 */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                    학부모 전화번호
                  </label>
                  <input
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${phoneError ? '#fca5a5' : '#d1d5db'}`,
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                  {phoneError && (
                    <p style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>{phoneError}</p>
                  )}
                </div>

                {/* PDF 업로드 필요 안내 */}
                {!uploadedPdfUrl && (
                  <div style={{ backgroundColor: '#fef3c7', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                    <p style={{ color: '#92400e', fontSize: '13px' }}>
                      알림톡 전송을 위해 먼저 PDF를 업로드해주세요.
                    </p>
                  </div>
                )}

                {/* 메시지 미리보기 */}
                {uploadedPdfUrl && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                      메시지 미리보기
                    </label>
                    <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '12px', fontSize: '13px', whiteSpace: 'pre-wrap', color: '#4b5563', border: '1px solid #e5e7eb' }}>
                      {generateAlimtalkPreview(
                        currentReport.studentName,
                        currentReport.yearMonth,
                        uploadedPdfUrl,
                        appSettings.academyName || '학원'
                      )}
                    </div>
                  </div>
                )}

                {/* 전송 결과 */}
                {sendResult && (
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      backgroundColor: sendResult.success ? '#f0fdf4' : '#fef2f2',
                      color: sendResult.success ? '#166534' : '#991b1b',
                      fontSize: '14px',
                    }}
                  >
                    {sendResult.message}
                  </div>
                )}

                {/* 전송 버튼 */}
                <button
                  onClick={handleSendAlimtalk}
                  disabled={!uploadedPdfUrl || !parentPhone || !!phoneError || sending}
                  style={{
                    width: '100%',
                    padding: '14px',
                    backgroundColor: uploadedPdfUrl && parentPhone && !phoneError && !sending ? '#2563eb' : '#d1d5db',
                    color: '#ffffff',
                    borderRadius: '8px',
                    fontWeight: '500',
                    fontSize: '16px',
                    cursor: uploadedPdfUrl && parentPhone && !phoneError && !sending ? 'pointer' : 'not-allowed',
                    border: 'none',
                  }}
                >
                  {sending ? '전송 중...' : '알림톡 전송'}
                </button>

                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '12px', textAlign: 'center' }}>
                  * 현재 Mock 모드입니다. 실제 전송을 위해 카카오 비즈 설정이 필요합니다.
                </p>
              </section>
            )}

            {/* 전송 이력 */}
            <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>전송 이력</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {useReportStore.getState().sendHistories.length === 0 ? (
                  <p style={{ color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>
                    전송 이력이 없습니다.
                  </p>
                ) : (
                  useReportStore.getState().sendHistories.slice(-5).reverse().map((history, index) => (
                    <div
                      key={index}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}
                    >
                      <div>
                        <p style={{ fontWeight: '500', fontSize: '14px', color: '#1f2937' }}>{history.studentName}</p>
                        <p style={{ fontSize: '12px', color: '#6b7280' }}>
                          → {history.recipientType === 'alimtalk' ? `알림톡 (${history.recipientPhone})` : history.recipientName}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span
                          style={{ fontSize: '13px', color: history.status === 'success' ? '#16a34a' : '#dc2626' }}
                        >
                          {history.status === 'success' ? '✓ 전송완료' : '✗ 실패'}
                        </span>
                        <p style={{ fontSize: '11px', color: '#9ca3af' }}>
                          {new Date(history.sentAt).toLocaleString('ko-KR')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
