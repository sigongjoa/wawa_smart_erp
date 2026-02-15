import { useState, useRef } from 'react';
import { useReportStore, useFilteredData } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import { saveScore } from '../../services/notion';
import type { DifficultyGrade } from '../../types';
import PageHeader from '../../components/common/PageHeader';

export default function Batch() {
  const { students } = useFilteredData();
  const { currentYearMonth, currentUser } = useReportStore();
  const { addToast } = useToastStore();

  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [omrFile, setOmrFile] = useState<File | null>(null);
  const [results, setResults] = useState<any>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('수학'); // Default
  const [difficulty, setDifficulty] = useState('C');

  const answerInputRef = useRef<HTMLInputElement>(null);
  const omrInputRef = useRef<HTMLInputElement>(null);

  const availableSubjects = ['국어', '영어', '수학', '사회', '과학'];

  const handleGrading = async () => {
    if (!answerFile || !omrFile) {
      addToast('파일을 모두 업로드해주세요.', 'warning');
      return;
    }

    setIsGrading(true);
    const formData = new FormData();
    formData.append('answer_pdf', answerFile);
    formData.append('omr_image', omrFile);

    try {
      const response = await fetch('http://localhost:8000/api/batch-grade', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('채점 서버 오류 발생');
      }

      const data = await response.json();

      const matchedStudents = data.students.map((res: any) => {
        const student = students.find(s => s.name === res.name);
        return {
          ...res,
          matchedStudent: student || null
        };
      });

      setResults({ ...data, students: matchedStudents });
      addToast(`채점 완료: 총 ${data.students.length}명`, 'success');
    } catch (error) {
      console.error(error);
      addToast('채점 중 오류가 발생했습니다. 백엔드 서버가 실행 중인지 확인해주세요.', 'error');
    } finally {
      setIsGrading(false);
    }
  };

  const handleSave = async () => {
    if (!results || !results.students) return;

    setIsSaving(true);
    let successCount = 0;

    const teacherId = currentUser?.teacher?.id || '';

    // Async parallel saving
    const promises = results.students.map(async (s: any) => {
      if (!s.matchedStudent) return false; // Skip unmatched

      const result = await saveScore(
        s.matchedStudent.id,
        s.matchedStudent.name,
        currentYearMonth,
        selectedSubject,
        s.percentage, // Score
        teacherId,
        `일괄 채점 (난이도: ${difficulty})`,
        difficulty as any
      );

      if (result.success) successCount++;
      return result.success;
    });

    await Promise.all(promises);

    addToast(`저장 완료: ${successCount}건`, 'success');
    setIsSaving(false);
    setResults(null);
    setAnswerFile(null);
    setOmrFile(null);
  };

  return (
    <div>
      <PageHeader title="일괄 채점" description="여러 학생의 OMR 카드를 한 번에 채점합니다" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Settings */}
        <div className="card" style={{ gridColumn: '1 / -1', padding: '16px', display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontWeight: 600, fontSize: '14px' }}>과목:</label>
            <select className="form-select" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
              {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontWeight: 600, fontSize: '14px' }}>난이도:</label>
            <select className="form-select" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
              {['A', 'B', 'C', 'D', 'E', 'F'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>1. 정답 파일 업로드</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>PDF 또는 이미지 파일 (jpg, png)</p>
          <input type="file" ref={answerInputRef} style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png,.bmp,.tiff" onChange={e => setAnswerFile(e.target.files?.[0] || null)} />
          <div
            style={{ border: `2px dashed ${answerFile ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '32px', textAlign: 'center', cursor: 'pointer', background: answerFile ? 'var(--primary-light)' : 'transparent' }}
            onClick={() => answerInputRef.current?.click()}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--primary)' }}>
              {answerFile?.name.endsWith('.pdf') ? 'picture_as_pdf' : 'image'}
            </span>
            <div style={{ marginTop: '12px', fontWeight: 500 }}>{answerFile ? answerFile.name : '정답 파일 업로드 (PDF/이미지)'}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>2. OMR 파일 업로드</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>이미지 또는 PDF 파일</p>
          <input type="file" ref={omrInputRef} style={{ display: 'none' }} accept="image/*,.pdf" onChange={e => setOmrFile(e.target.files?.[0] || null)} />
          <div
            style={{ border: `2px dashed ${omrFile ? 'var(--success)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '32px', textAlign: 'center', cursor: 'pointer', background: omrFile ? '#ecfdf5' : 'transparent' }}
            onClick={() => omrInputRef.current?.click()}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--success)' }}>
              {omrFile?.name.endsWith('.pdf') ? 'picture_as_pdf' : 'image'}
            </span>
            <div style={{ marginTop: '12px', fontWeight: 500 }}>{omrFile ? omrFile.name : 'OMR 파일 업로드 (이미지/PDF)'}</div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <button
          className="btn btn-primary"
          style={{ padding: '14px 32px' }}
          onClick={handleGrading}
          disabled={!answerFile || !omrFile || isGrading}
        >
          {isGrading ? <div className="spinner"></div> : <span className="material-symbols-outlined">play_arrow</span>}
          {isGrading ? ' 채점 중...' : ' 일괄 채점 시작'}
        </button>
      </div>

      {results && (
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 600, padding: '16px', borderBottom: '1px solid var(--border)' }}>채점 결과</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>이름 (OMR)</th>
                  <th>매칭된 학생</th>
                  <th>점수</th>
                  <th>정답 수</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {results.students.map((s: any, idx: number) => (
                  <tr key={idx}>
                    <td>{s.name}</td>
                    <td>
                      {s.matchedStudent ? (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>{s.matchedStudent.name}</span>
                      ) : (
                        <span style={{ color: 'var(--danger)' }}>미확인</span>
                      )}
                    </td>
                    <td><strong>{s.percentage}</strong>점</td>
                    <td>{s.correct_count} / {s.total_questions}</td>
                    <td>
                      {s.matchedStudent ? (
                        <span className="badge badge-success">매칭 성공</span>
                      ) : (
                        <span className="badge badge-danger">매칭 실패</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '16px', textAlign: 'right' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
              <span className="material-symbols-outlined">save</span>
              {isSaving ? '저장 중...' : '결과 저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
