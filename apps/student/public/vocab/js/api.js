// WAWA 통합 — 원본 student.html이 호출하는 API.* 메서드를 우리 Workers 엔드포인트로 어댑트
const API = {
  _token() { return localStorage.getItem('play_token'); },

  async _req(path, options = {}) {
    const token = this._token();
    const { headers: extra, ...rest } = options;
    const res = await fetch(CONFIG.WORKERS_BASE + path, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extra,
      },
      ...rest,
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) {
      localStorage.removeItem('play_token');
      localStorage.removeItem('play_student');
      window.location.href = '/#/login';
      throw new Error('세션 만료');
    }
    if (!res.ok || json?.success === false) {
      throw new Error(json?.error || res.statusText);
    }
    return json?.data ?? json;
  },

  // 단어 ─────────────────────────────────────────────
  async getMyWords(_studentId) {
    return await this._req('/api/play/vocab/words');
  },
  async addWord(_studentId, { english, korean, blank_type }) {
    return await this._req('/api/play/vocab/words', {
      method: 'POST',
      body: JSON.stringify({ english, korean, blank_type }),
    });
  },

  // 문법 ─────────────────────────────────────────────
  async getGrammar() {
    // 원본은 전체를 받아서 student_id로 필터 → 우리 /grammar도 본인+답변된 공개 모두 반환
    return await this._req('/api/play/vocab/grammar');
  },
  async addGrammarQuestion(_studentId, _studentName, question) {
    return await this._req('/api/play/vocab/grammar', {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  },

  // 교재 ─────────────────────────────────────────────
  // 원본의 /students/:id/textbook 는 없음 — textbooks 목록 중 첫 번째를 학생 교재로 사용
  async getStudentTextbook(_studentId) {
    const books = await this._req('/api/play/vocab/textbooks');
    if (!books || !books.length) {
      return { textbook_id: null, message: '교재가 배정되지 않았습니다' };
    }
    const b = books[0];
    return {
      textbook_id: b.id,
      textbook_info: {
        publisher: b.school || '',
        author: '',
        title: b.title,
        total_units: 4,
      },
      school: b.school || '',
      grade: b.grade || '',
      lesson_info: {},
    };
  },
  async getTextbookWords(textbookId, _unit) {
    const words = await this._req(`/api/play/vocab/textbooks/${textbookId}/words`);
    return { words: (words || []).map(w => ({
      id: w.id, english: w.english, korean: w.korean,
      unit: w.unit || '', part_of_speech: '', example: w.sentence || '',
    })) };
  },
  async getTextbookGrammar(_textbookId, _unit) {
    // 교재별 문법은 아직 미구현 — 빈 배열
    return { grammar: [] };
  },

  // 수행평가 ─ 미구현 (Gemini 연동 필요) ──────────────
  async writingHistory(_studentId) { return []; },
  async writingGenerate(_studentId, _problemType) {
    throw new Error('수행평가는 준비 중입니다');
  },
  async writingGrade(_studentId, _sessionId, _answer) {
    throw new Error('수행평가는 준비 중입니다');
  },
};

window.API = API;
