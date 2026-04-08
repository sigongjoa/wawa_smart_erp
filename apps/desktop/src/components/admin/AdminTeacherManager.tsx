import { useState, useMemo } from 'react';
import { useReportStore } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import type { Teacher } from '../../types';

const SUBJECT_OPTIONS = ['국어', '영어', '수학', '사회', '과학', '화학', '생물', '기타'];

interface TeacherFormData {
  name: string;
  pin: string;
  subjects: string[];
  isAdmin: boolean;
}

export default function AdminTeacherManager() {
  const { currentUser } = useReportStore();
  const { addToast } = useToastStore();

  // 선생님 추가 폼
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<TeacherFormData>({
    name: '',
    pin: '',
    subjects: [],
    isAdmin: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  // 마이그레이션
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{ status: string; count?: number } | null>(null);

  // 선생님 목록 (UI 상에서는 currentUser만 표시, 실제로는 API에서 받음)
  const [teachers, setTeachers] = useState<Teacher[]>(currentUser?.teacher ? [currentUser.teacher] : []);

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.pin.trim()) {
      addToast('필수 입력 항목을 채워주세요.', 'warning');
      return;
    }

    if (formData.pin.length < 4) {
      addToast('PIN은 최소 4자 이상이어야 합니다.', 'warning');
      return;
    }

    if (formData.subjects.length === 0) {
      addToast('최소 하나의 과목을 선택해주세요.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      // API 호출: POST /api/teachers
      const response = await fetch('/api/teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          pin: formData.pin.trim(),
          subjects: formData.subjects,
          isAdmin: formData.isAdmin,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '선생님 추가에 실패했습니다.');
      }

      const newTeacher = await response.json();
      setTeachers([...teachers, newTeacher]);
      addToast(`${formData.name} 선생님이 추가되었습니다.`, 'success');

      // 폼 초기화
      setFormData({ name: '', pin: '', subjects: [], isAdmin: false });
      setShowAddForm(false);
    } catch (error) {
      addToast(error instanceof Error ? error.message : '오류가 발생했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMigrateNotionData = async () => {
    if (!confirm('Notion 데이터를 D1 데이터베이스로 마이그레이션하시겠습니까?\n(기존 데이터를 덮어쓸 수 있습니다)')) {
      return;
    }

    setIsMigrating(true);
    setMigrationProgress({ status: '마이그레이션 시작...' });

    try {
      const response = await fetch('/api/migrate/notion-to-d1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Notion 데이터 마이그레이션에 실패했습니다.');
      }

      const result = await response.json();
      setMigrationProgress({
        status: '마이그레이션 완료!',
        count: result.migratedCount || 0,
      });

      addToast(`${result.migratedCount || 0}명의 데이터가 마이그레이션되었습니다.`, 'success');

      setTimeout(() => {
        setIsMigrating(false);
        setMigrationProgress(null);
      }, 2000);
    } catch (error) {
      addToast(error instanceof Error ? error.message : '오류가 발생했습니다.', 'error');
      setIsMigrating(false);
      setMigrationProgress(null);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="material-symbols-outlined">school</span>선생님 관리
      </h2>

      {/* 선생님 목록 */}
      <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>등록된 선생님</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
            <span className="material-symbols-outlined">add</span>선생님 추가
          </button>
        </div>

        {teachers.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            등록된 선생님이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {teachers.map((teacher) => (
              <div
                key={teacher.id}
                style={{
                  padding: '12px 16px',
                  background: 'var(--background)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {teacher.name}
                    {teacher.isAdmin && <span style={{ marginLeft: '8px', fontSize: '12px', background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '4px' }}>관리자</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    PIN: {(teacher as any).pin || '-'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    과목: {teacher.subjects?.join(', ') || '없음'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 선생님 추가 폼 */}
      {showAddForm && (
        <div className="card" style={{ marginBottom: '24px', padding: '20px', background: 'var(--background)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>새 선생님 추가</h3>
          <form onSubmit={handleAddTeacher}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>
                이름 <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                className="search-input"
                type="text"
                style={{ width: '100%' }}
                placeholder="선생님 이름"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSaving}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>
                PIN (4자 이상) <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                className="search-input"
                type="text"
                style={{ width: '100%' }}
                placeholder="4자 이상의 PIN"
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                disabled={isSaving}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '8px', fontWeight: 500 }}>
                담당 과목 <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {SUBJECT_OPTIONS.map((subject) => (
                  <label key={subject} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.subjects.includes(subject)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, subjects: [...formData.subjects, subject] });
                        } else {
                          setFormData({ ...formData, subjects: formData.subjects.filter((s) => s !== subject) });
                        }
                      }}
                      disabled={isSaving}
                    />
                    <span style={{ fontSize: '13px' }}>{subject}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="isAdmin"
                checked={formData.isAdmin}
                onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                disabled={isSaving}
              />
              <label htmlFor="isAdmin" style={{ fontSize: '13px', cursor: 'pointer' }}>
                관리자 권한 부여
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddForm(false)}
                disabled={isSaving}
              >
                취소
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? '저장 중...' : '추가하기'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notion 마이그레이션 */}
      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined">sync</span>Notion 데이터 마이그레이션
        </h3>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Notion에 저장된 선생님과 학생 데이터를 D1 데이터베이스로 동기화합니다.
        </p>

        {migrationProgress ? (
          <div style={{ padding: '20px', textAlign: 'center', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
            {isMigrating ? (
              <>
                <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 12px', border: '3px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <div style={{ fontWeight: 600 }}>{migrationProgress.status}</div>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--success)', marginBottom: '8px', display: 'block' }}>
                  check_circle
                </span>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{migrationProgress.status}</div>
                {migrationProgress.count !== undefined && (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {migrationProgress.count}명의 데이터가 동기화되었습니다.
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={handleMigrateNotionData}
            disabled={isMigrating}
            style={{ width: '100%' }}
          >
            <span className="material-symbols-outlined">cloud_download</span>
            Notion에서 데이터 불러오기
          </button>
        )}
      </div>
    </div>
  );
}
