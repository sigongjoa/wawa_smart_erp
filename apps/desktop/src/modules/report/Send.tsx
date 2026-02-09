import { useState } from 'react';
import { useReportStore, useFilteredData } from '../../stores/reportStore';
import { sendReportAlimtalk } from '../../services/alimtalk';

export default function Send() {
  const { reports, students } = useFilteredData();
  const { addSendHistory, currentYearMonth } = useReportStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkSend = async () => {
    if (selectedIds.length === 0) return;
    setIsSending(true);

    for (const id of selectedIds) {
      const report = reports.find(r => r.id === id);
      const student = students.find(s => s.id === report?.studentId);

      if (report && student && student.parentPhone) {
        const result = await sendReportAlimtalk(
          student.parentPhone,
          student.name,
          currentYearMonth,
          report.pdfUrl || 'https://example.com/report.pdf'
        );

        if (result.success) {
          addSendHistory({
            studentId: student.id,
            studentName: student.name,
            reportId: report.id,
            recipientName: student.parentName || '학부모',
            recipientPhone: student.parentPhone,
            recipientType: 'alimtalk',
            sentAt: new Date().toISOString(),
            status: 'success',
            pdfUrl: report.pdfUrl,
          });
        }
      }
    }

    setIsSending(false);
    alert('전송이 완료되었습니다.');
    setSelectedIds([]);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">리포트 전송</h1>
            <p className="page-description">완료된 리포트를 학부모님께 알림톡으로 전송합니다</p>
          </div>
          <div className="page-actions">
            <button
              className="btn btn-primary"
              onClick={handleBulkSend}
              disabled={isSending || selectedIds.length === 0}
            >
              <span className="material-symbols-outlined">send</span>
              {isSending ? '전송 중...' : `${selectedIds.length}건 일괄 전송`}
            </button>
          </div>
        </div>
      </div>

      {/* 검색 필터 바 */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
        <div style={{ flex: 1, maxWidth: '300px', position: 'relative' }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '20px' }}>search</span>
          <input
            type="text"
            placeholder="학생 이름 검색..."
            className="search-input"
            style={{ width: '100%', paddingLeft: '36px' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {searchQuery && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSearchQuery('')}
          >
            초기화
          </button>
        )}
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>선택</th>
              <th>학생명</th>
              <th>학년</th>
              <th>과목수</th>
              <th>상태</th>
              <th>PDF</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {reports.filter(report => {
              if (!searchQuery) return true;
              const student = students.find(s => s.id === report.studentId);
              const query = searchQuery.toLowerCase();
              return report.studentName.toLowerCase().includes(query) ||
                (student?.grade || '').toLowerCase().includes(query);
            }).map(report => {
              const student = students.find(s => s.id === report.studentId);
              return (
                <tr key={report.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(report.id)}
                      onChange={() => toggleSelect(report.id)}
                    />
                  </td>
                  <td style={{ fontWeight: 600 }}>{report.studentName}</td>
                  <td>{student?.grade}</td>
                  <td>{report.scores.length}</td>
                  <td>
                    <span className={`status-badge ${report.status === 'sent' ? 'success' : 'amber'}`}>
                      {report.status === 'sent' ? '전송완료' : '전송대기'}
                    </span>
                  </td>
                  <td>
                    {report.pdfUrl ? (
                      <a href={report.pdfUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>보기</a>
                    ) : '-'}
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => toggleSelect(report.id)}>
                      {selectedIds.includes(report.id) ? '해제' : '선택'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {reports.length === 0 && <div className="empty-state">전송할 리포트가 없습니다.</div>}
      </div>
    </div>
  );
}
