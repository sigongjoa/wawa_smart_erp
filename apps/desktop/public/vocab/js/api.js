// WAWA ERP 통합 — 원본 admin.html / grade.html / print.html 의 API.* 호출을
// 우리 Workers 엔드포인트로 어댑트
const API = {
  // ERP React 앱은 'auth_access_token'에 저장, 구버전 호환으로 'accessToken'도 체크.
  // 쿠키만 있는 경우도 credentials: 'include'로 보내면 서버가 인증 처리.
  _token() {
    return localStorage.getItem('auth_access_token')
        || localStorage.getItem('accessToken')
        || null;
  },

  async _fetch(path, options = {}) { return this._req(path, options); },

  async _req(path, options = {}) {
    const token = this._token();
    const { headers: extra, ...rest } = options;
    const res = await fetch(CONFIG.WORKERS_BASE + path, {
      credentials: 'include',  // httpOnly 쿠키 사용 — ERP React와 동일한 세션
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extra,
      },
      ...rest,
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) {
      localStorage.removeItem('auth_access_token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      window.location.href = '/#/login';
      throw new Error('세션 만료');
    }
    if (!res.ok || json?.success === false) {
      throw new Error(json?.error || res.statusText);
    }
    return json?.data ?? json;
  },

  // ── 인증 ────────────────────────────────────────────
  // token이 없어도 쿠키 인증이 가능하므로 실제 서버 호출로 확인
  async checkAuth() {
    if (this._token()) return { isAdmin: true };  // 토큰 있으면 빠르게 통과
    try {
      // 쿠키만 있는 경우 — 가벼운 인증 요구 엔드포인트 호출
      await this._req('/api/gacha/students');
      return { isAdmin: true };
    } catch {
      return { isAdmin: false };
    }
  },
  async logout() {
    localStorage.removeItem('auth_access_token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    return { success: true };
  },

  // ── 학생 (gacha_students) ──────────────────────────
  async getStudents() {
    const list = await this._req('/api/gacha/students');
    return (list || []).map(s => ({
      id: s.id, name: s.name,
      school: s.school || null,
      grade: s.grade ? Number(String(s.grade).replace(/[^0-9]/g, '')) || s.grade : null,
      hasPin: !!s.pin_hash || !!s.has_pin || true,
    }));
  },
  async getStudent(id) { return await this._req(`/api/gacha/students/${id}`); },
  async addStudent(name, school, grade) {
    return await this._req('/api/gacha/students', {
      method: 'POST',
      body: JSON.stringify({
        name,
        grade: grade ? `고${grade}` : null,
        pin: '1234',
        school,
      }),
    });
  },
  async updateStudent(id, updates) {
    const body = { ...updates };
    if (body.grade !== undefined && body.grade !== null) body.grade = `고${body.grade}`;
    return await this._req(`/api/gacha/students/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  async deleteStudent(id) {
    return await this._req(`/api/gacha/students/${id}`, { method: 'DELETE' });
  },

  // ── 단어 ────────────────────────────────────────────
  async getMyWords(studentId) {
    return await this._req(`/api/vocab/words?student_id=${encodeURIComponent(studentId)}`);
  },
  async addWord(studentId, wordData) {
    return await this._req('/api/vocab/words', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, ...wordData }),
    });
  },
  async getAllWords(status) {
    const path = status ? `/api/vocab/words?status=${encodeURIComponent(status)}` : '/api/vocab/words';
    return await this._req(path);
  },
  async updateWord(id, updates) {
    return await this._req(`/api/vocab/words/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
  async reviewWord(id, correct) {
    // 원본 /words/:id/review (box up/reset) — 우리는 PATCH로 box 직접 조정
    const word = await this._req(`/api/vocab/words?student_id=`).catch(() => []);
    // 단순화: correct → box +1 (max 5), wrong → box=1
    // 현재 box를 모르니 word_id로 재조회 후 업데이트하기 위해 GET이 필요한데
    // 단일 단어 GET 엔드포인트가 없어서 review_count, wrong_count 만 patch
    // 정확한 box 조정은 print/grade flow를 권장
    const patch = correct
      ? { box: 5 }  // 정답 시 box 올림 (단순화)
      : { box: 1 }; // 오답 시 box 리셋
    return await this._req(`/api/vocab/words/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  async deleteWord(id) {
    return await this._req(`/api/vocab/words/${id}`, { method: 'DELETE' });
  },

  // ── 문법 Q&A ────────────────────────────────────────
  async getGrammar() { return await this._req('/api/vocab/grammar'); },
  async addGrammar(data) {
    return await this._req('/api/vocab/grammar', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateGrammar(id, data) {
    return await this._req(`/api/vocab/grammar/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  async deleteGrammar(id) {
    return await this._req(`/api/vocab/grammar/${id}`, { method: 'DELETE' });
  },
  async aiAnswerGrammar(id) {
    return await this._req(`/api/vocab/grammar/${id}/ai-answer`, { method: 'POST' });
  },

  // ── 시험지 생성 ─────────────────────────────────────
  // 원본은 AI Part1/2/3 생성. 우리는 Part 1 (단어 빈칸)만 가중치 출제로 대체
  async generatePrint(studentIds, _grammarIds = []) {
    const jobs = [];
    for (const sid of studentIds) {
      try {
        const res = await this._req('/api/vocab/print/pick', {
          method: 'POST',
          body: JSON.stringify({ student_id: sid, max_words: 20 }),
        });
        jobs.push({
          studentId: sid,
          studentName: res.student?.name || '학생',
          jobId: res.job_id,
          part1: (res.words || []).map(w => ({
            id: w.id, english: w.english, korean: w.korean,
            blank_type: w.blank_type || 'korean',
          })),
          part2: [],
          part3: [],
        });
      } catch (e) {
        console.warn(`학생 ${sid} 출제 실패: ${e.message}`);
      }
    }
    return { jobs };
  },

  // ── 학교/교재 ──────────────────────────────────────
  async getSchools() { return { schools: {} }; },
  async getStudentTextbook(_studentId) { return { textbook_id: null, message: '미설정' }; },
  async getTextbookWords(_id, _unit) { return { words: [] }; },
  async getTextbookGrammar(_id, _unit) { return { grammar: [] }; },
};

window.API = API;
