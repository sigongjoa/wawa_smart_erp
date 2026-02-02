import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import { sendReportAlimtalk, validatePhoneNumber } from '../services/alimtalk';

interface StudentSendInfo {
  reportId: string;
  studentId: string;
  studentName: string;
  yearMonth: string;
  pdfUrl: string | null;
  parentPhone: string;
  status: 'pending' | 'sending' | 'success' | 'error';
  errorMessage?: string;
}

export default function BulkSendPage() {
  const navigate = useNavigate();
  const { reports, currentYearMonth, appSettings, addSendHistory } = useReportStore();

  // 현재 월의 리포트만 필터
  const currentMonthReports = reports.filter(r => r.yearMonth === currentYearMonth);

  // 학생별 전송 정보
  const [sendList, setSendList] = useState<StudentSendInfo[]>(
    currentMonthReports.map(r => ({
      reportId: r.id,
      studentId: r.studentId,
      studentName: r.studentName,
      yearMonth: r.yearMonth,
      pdfUrl: r.pdfUrl || null,
      parentPhone: '',
      status: 'pending',
    }))
  );

  const [sending, setSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 전화번호 업데이트
  const updatePhone = (reportId: string, phone: string) => {
    setSendList(prev =>
      prev.map(item =>
        item.reportId === reportId ? { ...item, parentPhone: phone } : item
      )
    );
  };

  // 선택 토글
  const toggleSelect = (reportId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reportId)) {
        newSet.delete(reportId);
      } else {
        newSet.add(reportId);
      }
      return newSet;
    });
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedIds.size === sendList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sendList.map(s => s.reportId)));
    }
  };

  // PDF 업로드된 것만 선택
  const selectUploaded = () => {
    setSelectedIds(new Set(sendList.filter(s => s.pdfUrl).map(s => s.reportId)));
  };

  // 일괄 전송
  const handleBulkSend = async () => {
    const toSend = sendList.filter(s =>
      selectedIds.has(s.reportId) &&
      s.pdfUrl &&
      s.parentPhone &&
      validatePhoneNumber(s.parentPhone)
    );

    if (toSend.length === 0) {
      alert('전송할 항목이 없습니다. PDF가 업로드되고 전화번호가 입력된 항목을 선택해주세요.');
      return;
    }

    setSending(true);

    for (const item of toSend) {
      // 상태 업데이트: sending
      setSendList(prev =>
        prev.map(s => s.reportId === item.reportId ? { ...s, status: 'sending' } : s)
      );

      try {
        const result = await sendReportAlimtalk(
          item.parentPhone,
          item.studentName,
          item.yearMonth,
          item.pdfUrl!,
          appSettings.academyName
        );

        if (result.success) {
          setSendList(prev =>
            prev.map(s => s.reportId === item.reportId ? { ...s, status: 'success' } : s)
          );

          addSendHistory({
            studentId: item.studentId,
            studentName: item.studentName,
            reportId: item.reportId,
            recipientName: item.parentPhone,
            recipientPhone: item.parentPhone,
            recipientType: 'alimtalk',
            sentAt: new Date().toISOString(),
            status: 'success',
            pdfUrl: item.pdfUrl!,
          });
        } else {
          setSendList(prev =>
            prev.map(s => s.reportId === item.reportId
              ? { ...s, status: 'error', errorMessage: result.error }
              : s
            )
          );
        }
      } catch (error) {
        setSendList(prev =>
          prev.map(s => s.reportId === item.reportId
            ? { ...s, status: 'error', errorMessage: '전송 실패' }
            : s
          )
        );
      }

      // 요청 간 딜레이
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setSending(false);
  };

  // 통계
  const stats = {
    total: sendList.length,
    uploaded: sendList.filter(s => s.pdfUrl).length,
    selected: selectedIds.size,
    ready: sendList.filter(s =>
      selectedIds.has(s.reportId) &&
      s.pdfUrl &&
      s.parentPhone &&
      validatePhoneNumber(s.parentPhone)
    ).length,
    success: sendList.filter(s => s.status === 'success').length,
    error: sendList.filter(s => s.status === 'error').length,
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* 헤더 */}
      <header style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>일괄 전송</h1>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>{currentYearMonth} 리포트</p>
          </div>
          <button
            onClick={() => navigate('/admin')}
            style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            돌아가기
          </button>
        </div>
      </header>

      {/* 메인 */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        {/* 통계 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>전체 리포트</p>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{stats.total}</p>
          </div>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>PDF 업로드됨</p>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>{stats.uploaded}</p>
          </div>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>선택됨</p>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>{stats.selected}</p>
          </div>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>전송 준비됨</p>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#f97316' }}>{stats.ready}</p>
          </div>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>전송 성공</p>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>{stats.success}</p>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={toggleSelectAll}
            style={{ padding: '8px 16px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}
          >
            {selectedIds.size === sendList.length ? '전체 해제' : '전체 선택'}
          </button>
          <button
            onClick={selectUploaded}
            style={{ padding: '8px 16px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}
          >
            업로드된 것만 선택
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleBulkSend}
            disabled={sending || stats.ready === 0}
            style={{
              padding: '10px 24px',
              backgroundColor: sending || stats.ready === 0 ? '#d1d5db' : '#2563eb',
              color: '#ffffff',
              borderRadius: '8px',
              border: 'none',
              cursor: sending || stats.ready === 0 ? 'not-allowed' : 'pointer',
              fontWeight: '600',
            }}
          >
            {sending ? '전송 중...' : `선택 항목 전송 (${stats.ready}건)`}
          </button>
        </div>

        {/* 알림 */}
        <div style={{ backgroundColor: '#fef3c7', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', border: '1px solid #fcd34d' }}>
          <p style={{ color: '#92400e', fontSize: '13px' }}>
            * 현재 Mock 모드입니다. 실제 알림톡 전송을 위해 카카오 비즈 설정이 필요합니다.
          </p>
        </div>

        {/* 리포트 목록 */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {/* 테이블 헤더 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 200px 150px 120px',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            fontWeight: '600',
            fontSize: '13px',
            color: '#374151',
          }}>
            <div></div>
            <div>학생</div>
            <div>학부모 전화번호</div>
            <div>PDF 상태</div>
            <div>전송 상태</div>
          </div>

          {/* 리스트 */}
          {sendList.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
              {currentYearMonth}에 해당하는 리포트가 없습니다.
            </div>
          ) : (
            sendList.map((item) => (
              <div
                key={item.reportId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 200px 150px 120px',
                  gap: '12px',
                  padding: '12px 16px',
                  borderBottom: '1px solid #e5e7eb',
                  alignItems: 'center',
                  backgroundColor: selectedIds.has(item.reportId) ? '#eff6ff' : '#ffffff',
                }}
              >
                {/* 체크박스 */}
                <div>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.reportId)}
                    onChange={() => toggleSelect(item.reportId)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </div>

                {/* 학생 이름 */}
                <div>
                  <p style={{ fontWeight: '500', color: '#1f2937' }}>{item.studentName}</p>
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>{item.yearMonth}</p>
                </div>

                {/* 전화번호 입력 */}
                <div>
                  <input
                    type="tel"
                    value={item.parentPhone}
                    onChange={(e) => updatePhone(item.reportId, e.target.value)}
                    placeholder="010-1234-5678"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${item.parentPhone && !validatePhoneNumber(item.parentPhone) ? '#fca5a5' : '#d1d5db'}`,
                      fontSize: '14px',
                    }}
                  />
                </div>

                {/* PDF 상태 */}
                <div>
                  {item.pdfUrl ? (
                    <a
                      href={item.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        backgroundColor: '#dcfce7',
                        color: '#16a34a',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        textDecoration: 'none',
                      }}
                    >
                      PDF 확인
                    </a>
                  ) : (
                    <span style={{
                      padding: '4px 10px',
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      borderRadius: '9999px',
                      fontSize: '12px',
                    }}>
                      미업로드
                    </span>
                  )}
                </div>

                {/* 전송 상태 */}
                <div>
                  {item.status === 'pending' && (
                    <span style={{ color: '#6b7280', fontSize: '13px' }}>대기</span>
                  )}
                  {item.status === 'sending' && (
                    <span style={{ color: '#f97316', fontSize: '13px' }}>전송 중...</span>
                  )}
                  {item.status === 'success' && (
                    <span style={{ color: '#16a34a', fontSize: '13px' }}>전송 완료</span>
                  )}
                  {item.status === 'error' && (
                    <span style={{ color: '#dc2626', fontSize: '13px' }} title={item.errorMessage}>
                      실패
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
