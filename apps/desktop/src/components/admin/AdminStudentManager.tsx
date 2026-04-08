import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useReportStore } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import { useSearch } from '../../hooks/useSearch';
import { createStudent, updateStudent, deleteStudent, fetchEnrollmentsByStudent, updateStudentEnrollments } from '../../services/notion';
import type { Student, GradeType, Teacher } from '../../types';
import StudentModal from './StudentModal';

const gradeClassMap: Record<string, string> = {
  '초1': 'm1', '초2': 'm1', '초3': 'm1', '초4': 'm2', '초5': 'm2', '초6': 'm2',
  '중1': 'm1', '중2': 'm2', '중3': 'm3',
  '고1': 'h1', '고2': 'h2', '고3': 'h3',
  '검정고시': 'etc',
};

const ITEMS_PER_PAGE = 20;

export default function AdminStudentManager() {
  const { students, fetchStudents } = useAppStore();
  const { teachers, setTeachers } = useReportStore();
  const { addToast } = useToastStore();

  const [filters, setFilters] = useState({
    grade: '전체',
    status: '전체',
    subject: '전체',
  });

  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    if (teachers.length === 0) {
      import('../../services/notion').then(mod => {
        mod.fetchTeachers().then(setTeachers);
      });
    }
  }, [teachers.length, setTeachers]);

  const baseFilteredStudents = useMemo(() => {
    return students.filter(student => {
      if (filters.grade !== '전체' && student.grade !== filters.grade) return false;
      if (filters.status !== '전체' && (filters.status === '활성' ? student.status !== 'active' : student.status === 'active')) return false;
      if (filters.subject !== '전체') {
        const hasSubject = student.subjects.includes(filters.subject) || student.subject === filters.subject;
        if (!hasSubject) return false;
      }
      return true;
    });
  }, [students, filters]);

  const { searchTerm, setSearchTerm, filteredItems: filteredStudents } = useSearch(baseFilteredStudents, 'name');

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const stats = useMemo(() => ({
    total: students.length,
    active: students.filter(s => s.status === 'active').length,
    inactive: students.filter(s => s.status !== 'active').length,
  }), [students]);

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      const result = await deleteStudent(deleteConfirm.id);
      if (result.success) {
        addToast('학생이 삭제되었습니다.', 'success');
        fetchStudents();
      } else {
        addToast('삭제 실패: ' + result.error?.message, 'error');
      }
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handleSave = async (data: any, enrollments: any[]) => {
    setIsSaving(true);
    try {
      let result;
      let finalStudentId = editingStudent?.id;

      if (editingStudent) {
        result = await updateStudent(editingStudent.id, data);
      } else {
        result = await createStudent(data);
        if (result.success && result.data) {
          finalStudentId = result.data.id;
        }
      }

      if (result.success) {
        if (finalStudentId) {
          const enrollResult = await updateStudentEnrollments(finalStudentId, enrollments);
          if (!enrollResult.success) {
            addToast('학생 정보는 저장되었으나, 수강 일정 저장에 실패했습니다.', 'warning');
          } else {
            addToast(editingStudent ? '학생 정보가 수정되었습니다.' : '새 학생이 등록되었습니다.', 'success');
          }
        }

        fetchStudents();
        setIsModalOpen(false);
        setEditingStudent(null);
      } else {
        addToast('저장 실패: ' + result.error?.message, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      {/* Filter Bar */}
      <style>{`
        @media (max-width: 768px) {
          .filter-bar {
            flex-wrap: wrap !important;
          }
          .filter-bar select {
            flex: 1 !important;
            min-width: 100px !important;
          }
          .filter-bar .search-bar {
            max-width: 100% !important;
            width: 100% !important;
            flex-basis: 100% !important;
          }
          .filter-bar > div:nth-child(2) {
            display: none !important;
          }
        }
      `}</style>
      <div className="filter-bar" style={{ gap: '8px', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: '1 1 auto', minWidth: '200px', maxWidth: '300px' }}>
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            placeholder="이름 검색 (초성 검색 가능)"
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px', display: 'flex' }}></div>

        <select
          className="form-select"
          value={filters.grade}
          onChange={(e) => handleFilterChange({ ...filters, grade: e.target.value })}
          style={{ flex: '0 1 120px', minWidth: '100px' }}
        >
          <option value="전체">모든 학년</option>
          <option value="초1">초1</option><option value="초2">초2</option><option value="초3">초3</option>
          <option value="초4">초4</option><option value="초5">초5</option><option value="초6">초6</option>
          <option value="중1">중1</option><option value="중2">중2</option><option value="중3">중3</option>
          <option value="고1">고1</option><option value="고2">고2</option><option value="고3">고3</option>
          <option value="검정고시">검정고시</option>
        </select>

        <select
          className="form-select"
          value={filters.status}
          onChange={(e) => handleFilterChange({ ...filters, status: e.target.value })}
          style={{ flex: '0 1 120px', minWidth: '100px' }}
        >
          <option value="전체">모든 상태</option>
          <option value="활성">활성</option>
          <option value="비활성">비활성</option>
        </select>

        <select
          className="form-select"
          value={filters.subject}
          onChange={(e) => handleFilterChange({ ...filters, subject: e.target.value })}
          style={{ flex: '0 1 120px', minWidth: '100px' }}
        >
          <option value="전체">모든 과목</option>
          <option value="국어">국어</option>
          <option value="영어">영어</option>
          <option value="수학">수학</option>
          <option value="과학">과학</option>
          <option value="화학">화학</option>
          <option value="생물">생물</option>
          <option value="사회">사회</option>
        </select>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            handleFilterChange({ grade: '전체', status: '전체', subject: '전체' });
            setSearchTerm('');
          }}
          style={{ marginLeft: 'auto', flex: '0 1 auto' }}
        >
          초기화
        </button>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditingStudent(null);
            setIsModalOpen(true);
          }}
          style={{ flex: '0 1 auto' }}
        >
          <span className="material-symbols-outlined">add</span>
          학생 추가
        </button>
      </div>

      {/* Stats Table Header */}
      <style>{`
        @media (max-width: 640px) {
          .data-table {
            font-size: 13px;
          }
          .data-table th {
            padding: 8px 4px !important;
            font-size: 12px;
          }
          .data-table td {
            padding: 8px 4px !important;
            font-size: 13px;
          }
          .data-table th:nth-child(4),
          .data-table th:nth-child(5),
          .data-table td:nth-child(4),
          .data-table td:nth-child(5) {
            display: none;
          }
          .data-table th,
          .data-table td {
            width: auto !important;
          }
        }
      `}</style>
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '70px', flex: '0 0 70px' }}>학년</th>
              <th style={{ width: '100px', flex: '0 0 100px' }}>이름</th>
              <th style={{ flex: '1 1 auto' }}>수강과목</th>
              <th style={{ width: '100px', flex: '0 0 100px' }}>학부모</th>
              <th style={{ width: '120px', flex: '0 0 120px' }}>연락처</th>
              <th style={{ width: '70px', flex: '0 0 70px', textAlign: 'center' }}>상태</th>
              <th style={{ width: '80px', flex: '0 0 80px', textAlign: 'center' }}>액션</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              paginatedStudents.map(student => (
                <tr key={student.id}>
                  <td><span className={`grade-badge ${gradeClassMap[student.grade] || 'etc'}`}>{student.grade}</span></td>
                  <td style={{ fontWeight: 600 }}>{student.name}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {student.subjects && student.subjects.length > 0 ? (
                        student.subjects.map(sub => <span key={sub} className="subject-badge">{sub}</span>)
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>-</span>
                      )}
                    </div>
                  </td>
                  <td>{student.parentName || '-'}</td>
                  <td>{student.parentPhone || '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {student.status === 'active' ? (
                      <span style={{ color: 'var(--success)', fontSize: '12px', fontWeight: 600 }}>● 활성</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>○ 비활성</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button className="btn-icon" onClick={() => { setEditingStudent(student); setIsModalOpen(true); }} title="수정">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                      </button>
                      <button className="btn-icon" onClick={() => handleDeleteClick(student.id, student.name)} title="삭제">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--danger)' }}>delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Stats & Pagination */}
      <style>{`
        @media (max-width: 640px) {
          .pagination-stats {
            flex-direction: column !important;
            gap: 12px !important;
            align-items: flex-start !important;
          }
          .pagination-stats-text {
            display: none !important;
          }
          .pagination-stats-text:first-child {
            display: inline !important;
          }
          .pagination-controls {
            flex-wrap: wrap !important;
            gap: 4px !important;
          }
          .pagination-page-buttons {
            display: none !important;
          }
        }
      `}</style>
      <div className="pagination-stats" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <span className="pagination-stats-text">총 <strong>{stats.total}</strong>명</span>
          <span className="pagination-stats-text" style={{ display: 'none' }}>활성 <strong>{stats.active}</strong>명</span>
          <span className="pagination-stats-text" style={{ display: 'none' }}>비활성 <strong>{stats.inactive}</strong>명</span>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="pagination-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ opacity: page === 1 ? 0.5 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
              aria-label="이전 페이지"
            >
              이전
            </button>

            <div className="pagination-page-buttons" style={{ display: 'flex', gap: '4px' }}>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = page > 3 ? page - 2 + i : i + 1;
                return pageNum <= totalPages ? (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      background: pageNum === page ? 'var(--primary)' : 'var(--surface)',
                      color: pageNum === page ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: pageNum === page ? 600 : 400,
                    }}
                    aria-current={pageNum === page ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                ) : null;
              })}
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ opacity: page === totalPages ? 0.5 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
              aria-label="다음 페이지"
            >
              다음
            </button>

            <span style={{ marginLeft: '8px', fontSize: '12px', whiteSpace: 'nowrap' }}>
              {page}/{totalPages}
            </span>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <DeleteConfirmModal
          name={deleteConfirm.name}
          isDeleting={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {isModalOpen && (
        <StudentModal
          student={editingStudent}
          teachers={teachers}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSave}
        />
      )}
    </div>
  );
}

function DeleteConfirmModal({
  name,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  name: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    setTimeout(() => {
      const confirmBtn = modalRef.current?.querySelector('button[data-confirm]') as HTMLElement;
      confirmBtn?.focus();
    }, 0);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        ref={modalRef}
        className="modal-content"
        style={{ maxWidth: '400px', width: '90%' }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
      >
        <div className="modal-header">
          <h2 id="confirm-title" className="modal-title" style={{ color: 'var(--danger)' }}>
            학생 삭제
          </h2>
        </div>

        <div className="modal-body">
          <p id="confirm-desc" style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            <strong>{name}</strong> 학생을 삭제하시겠습니까?
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            이 작업은 되돌릴 수 없습니다.
          </p>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isDeleting}
          >
            취소
          </button>
          <button
            data-confirm
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              background: isDeleting ? 'var(--danger-light)' : 'var(--danger)',
              color: 'white',
              border: 'none',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
            }}
          >
            {isDeleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}
