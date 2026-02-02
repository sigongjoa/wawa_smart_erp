# 버튼/모달/데이터 통신 시스템 개선 설계

## 문제 요약

현재 시스템에서 **버튼 클릭 → 모달 표시 → 콜백 실행 → 데이터 통신** 플로우가 정상 작동하지 않는 핵심 원인:

```
┌─────────────────────────────────────────────────────────────┐
│  1. 에러 처리 부재 - API 실패 시 silent failure            │
│  2. 모달 상태 관리 미흡 - 조건부 렌더링만 사용              │
│  3. 콜백 실행 보장 없음 - 비동기 흐름 제어 취약             │
│  4. 사용자 피드백 부재 - 로딩/에러 상태 표시 없음           │
└─────────────────────────────────────────────────────────────┘
```

---

## 핵심 문제점 상세

### 1. API 에러 처리 (notion.ts)

```typescript
// 현재 문제 코드 - 모든 에러를 무시
export const createStudent = async (student) => {
  try {
    const data = await notionFetch('/pages', {...});
    return { ...student, id: data.id };
  } catch {
    return null;  // ❌ 에러 정보 소실
  }
};
```

**영향**: 모달에서 저장 버튼을 눌러도 아무 반응 없음

### 2. 모달 상태 관리 (Students.tsx)

```typescript
// 현재 문제 코드
const handleCreate = async (student) => {
  const newStudent = await createStudent(student);
  if (newStudent) {
    setStudents([...students, newStudent]);
    setIsModalOpen(false);
  }
  // ❌ 실패 시 모달 그대로, 사용자 혼란
};
```

**영향**: 저장 실패해도 모달이 닫히지 않고 피드백 없음

### 3. 버튼 중복 클릭 방지 없음

```typescript
// 현재 - 중복 클릭 가능
<button onClick={handleCreate}>저장</button>

// ❌ 여러 번 클릭하면 여러 번 API 호출
```

---

## 개선 설계

### Phase 1: 에러 처리 시스템 (필수)

#### 1.1 API 응답 타입 정의

```typescript
// types/api.ts
export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

#### 1.2 notion.ts 개선

```typescript
// services/notion.ts
export const createStudent = async (
  student: Omit<Student, 'id'>
): Promise<ApiResult<Student>> => {
  const dbIds = getDbIds();

  if (!dbIds.students) {
    return {
      success: false,
      error: { code: 'NO_DB_ID', message: 'DB ID가 설정되지 않았습니다.' }
    };
  }

  try {
    const data = await notionFetch('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: dbIds.students },
        properties: buildStudentProperties(student)
      })
    });

    return {
      success: true,
      data: { ...student, id: data.id } as Student
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'API_ERROR',
        message: err instanceof Error ? err.message : '알 수 없는 오류'
      }
    };
  }
};
```

### Phase 2: 모달 시스템 개선

#### 2.1 Modal Context 생성

```typescript
// contexts/ModalContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';

interface ModalState {
  isOpen: boolean;
  content: ReactNode | null;
  onClose?: () => void;
}

interface ModalContextType {
  openModal: (content: ReactNode, onClose?: () => void) => void;
  closeModal: () => void;
  isOpen: boolean;
}

const ModalContext = createContext<ModalContextType | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    content: null
  });

  const openModal = (content: ReactNode, onClose?: () => void) => {
    setModal({ isOpen: true, content, onClose });
  };

  const closeModal = () => {
    modal.onClose?.();
    setModal({ isOpen: false, content: null });
  };

  return (
    <ModalContext.Provider value={{ openModal, closeModal, isOpen: modal.isOpen }}>
      {children}
      {modal.isOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeModal();
          }}
        >
          <div className="modal-content">
            {modal.content}
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModal must be used within ModalProvider');
  return context;
};
```

#### 2.2 Modal CSS

```css
/* styles/modal.css */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  animation: modalSlideIn 0.2s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Phase 3: 비동기 상태 관리 훅

#### 3.1 useAsync 훅

```typescript
// hooks/useAsync.ts
import { useState, useCallback } from 'react';
import { ApiResult } from '../types/api';

interface AsyncState<T> {
  isLoading: boolean;
  data: T | null;
  error: string | null;
}

export function useAsync<T, Args extends any[]>(
  asyncFn: (...args: Args) => Promise<ApiResult<T>>
) {
  const [state, setState] = useState<AsyncState<T>>({
    isLoading: false,
    data: null,
    error: null
  });

  const execute = useCallback(async (...args: Args) => {
    setState({ isLoading: true, data: null, error: null });

    const result = await asyncFn(...args);

    if (result.success) {
      setState({ isLoading: false, data: result.data!, error: null });
    } else {
      setState({
        isLoading: false,
        data: null,
        error: result.error?.message || '오류가 발생했습니다.'
      });
    }

    return result;
  }, [asyncFn]);

  const reset = useCallback(() => {
    setState({ isLoading: false, data: null, error: null });
  }, []);

  return { ...state, execute, reset };
}
```

### Phase 4: 개선된 컴포넌트 구현

#### 4.1 Students.tsx 개선

```typescript
// modules/report/Students.tsx
import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { useModal } from '../../contexts/ModalContext';
import { createStudent, updateStudent } from '../../services/notion';
import { useReportStore } from '../../stores/reportStore';
import { StudentModal } from './StudentModal';
import { Toast } from '../../components/Toast';

export function Students() {
  const { students, setStudents } = useReportStore();
  const { openModal, closeModal } = useModal();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { execute: executeCreate, isLoading: isCreating } = useAsync(createStudent);
  const { execute: executeUpdate, isLoading: isUpdating } = useAsync(updateStudent);

  const handleAddClick = () => {
    openModal(
      <StudentModal
        onSubmit={handleCreate}
        onCancel={closeModal}
        isLoading={isCreating}
      />
    );
  };

  const handleCreate = async (studentData: Omit<Student, 'id'>) => {
    const result = await executeCreate(studentData);

    if (result.success && result.data) {
      setStudents([...students, result.data]);
      closeModal();
      setToast({ message: '학생이 추가되었습니다.', type: 'success' });
    } else {
      setToast({
        message: result.error?.message || '학생 추가에 실패했습니다.',
        type: 'error'
      });
      // 모달은 열린 상태 유지 - 사용자가 재시도 가능
    }
  };

  return (
    <div>
      <button
        className="btn btn-primary"
        onClick={handleAddClick}
        disabled={isCreating}
      >
        <span className="material-symbols-outlined">add</span>
        학생 추가
      </button>

      {/* 학생 목록 */}
      <StudentList students={students} onEdit={handleEditClick} />

      {/* Toast 알림 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
```

#### 4.2 StudentModal 개선

```typescript
// modules/report/StudentModal.tsx
import { useState } from 'react';
import { Student } from '../../types';

interface StudentModalProps {
  student?: Student;
  onSubmit: (data: Omit<Student, 'id'>) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function StudentModal({ student, onSubmit, onCancel, isLoading }: StudentModalProps) {
  const [formData, setFormData] = useState({
    name: student?.name || '',
    grade: student?.grade || '',
    parentPhone: student?.parentPhone || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>{student ? '학생 수정' : '학생 추가'}</h2>

      <div className="form-group">
        <label>이름</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          disabled={isLoading}
          required
        />
      </div>

      <div className="form-group">
        <label>학년</label>
        <input
          type="text"
          value={formData.grade}
          onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label>학부모 연락처</label>
        <input
          type="tel"
          value={formData.parentPhone}
          onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
          disabled={isLoading}
        />
      </div>

      <div className="modal-actions">
        <button type="button" onClick={onCancel} disabled={isLoading}>
          취소
        </button>
        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="spinner" />
              저장 중...
            </>
          ) : (
            '저장'
          )}
        </button>
      </div>
    </form>
  );
}
```

#### 4.3 Toast 컴포넌트

```typescript
// components/Toast.tsx
import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className={`toast toast-${type}`}>
      <span className="toast-icon">
        {type === 'success' && '✓'}
        {type === 'error' && '✕'}
        {type === 'info' && 'ℹ'}
      </span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose}>×</button>
    </div>
  );
}
```

---

## 구현 우선순위

```
┌────┬─────────────────────────────────┬──────────┬─────────┐
│ #  │ 작업                            │ 중요도   │ 난이도  │
├────┼─────────────────────────────────┼──────────┼─────────┤
│ 1  │ ApiResult 타입 및 에러 처리     │ ★★★★★  │ ★★☆☆☆ │
│ 2  │ notion.ts 함수들 개선           │ ★★★★★  │ ★★★☆☆ │
│ 3  │ useAsync 훅 구현                │ ★★★★☆  │ ★★☆☆☆ │
│ 4  │ Toast 컴포넌트                  │ ★★★★☆  │ ★☆☆☆☆ │
│ 5  │ ModalContext 구현               │ ★★★☆☆  │ ★★★☆☆ │
│ 6  │ Students.tsx 리팩토링           │ ★★★★☆  │ ★★★☆☆ │
│ 7  │ 기타 페이지 리팩토링            │ ★★★☆☆  │ ★★★★☆ │
└────┴─────────────────────────────────┴──────────┴─────────┘
```

---

## 예상 결과

개선 후 버튼 클릭 플로우:

```
1. 버튼 클릭
   └─→ openModal() 호출
   └─→ 모달 표시 ✓

2. 폼 제출
   └─→ isLoading = true
   └─→ 버튼 disabled ✓
   └─→ "저장 중..." 표시 ✓

3. API 호출
   └─→ 성공 시:
       └─→ 상태 업데이트
       └─→ 모달 닫기
       └─→ Toast "학생이 추가되었습니다." ✓
   └─→ 실패 시:
       └─→ Toast "학생 추가에 실패했습니다: [에러메시지]" ✓
       └─→ 모달 유지 (재시도 가능) ✓
       └─→ 버튼 다시 활성화 ✓
```

---

## 파일 생성/수정 목록

### 새로 생성
- `types/api.ts` - API 응답 타입
- `hooks/useAsync.ts` - 비동기 상태 관리 훅
- `contexts/ModalContext.tsx` - 모달 컨텍스트
- `components/Toast.tsx` - 토스트 알림
- `styles/modal.css` - 모달 스타일

### 수정 필요
- `services/notion.ts` - 에러 처리 개선
- `modules/report/Students.tsx` - 리팩토링
- `modules/report/StudentModal.tsx` - 분리 및 개선
- `modules/report/Send.tsx` - 에러 처리 추가
- `modules/report/Input.tsx` - 패턴 통일
- `App.tsx` - ModalProvider 래핑
