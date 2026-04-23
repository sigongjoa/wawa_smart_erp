// quiz-engine — P0: 10-problem session, HP, Leitner box movement

export const QUIZ_SIZE = 10;
export const HP_MAX = 3;
export const EXP_PER_CORRECT = 10;
export const COIN_PER_CORRECT = 2;

function pickN(arr, n, rng) {
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(rng(pool.length)) % pool.length;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export function buildQuestion(target, pool, rng = (n) => Math.floor(Math.random() * n)) {
  const distractors = pickN(pool.filter(w => w.id !== target.id && w.meaning !== target.meaning), 3, rng);
  while (distractors.length < 3) {
    distractors.push({ meaning: `__${distractors.length}__` });
  }
  const insertAt = Math.floor(rng(4)) % 4;
  const choices = distractors.map(w => w.meaning);
  choices.splice(insertAt, 0, target.meaning);
  choices.length = 4;
  return {
    wordId: target.id,
    prompt: target.word,
    choices,
    correctIndex: insertAt,
  };
}

export function startQuiz(words, rng = (n) => Math.floor(Math.random() * n)) {
  if (!words || words.length === 0) throw new Error('empty word pool');
  const size = Math.min(QUIZ_SIZE, words.length);
  const picked = pickN(words, size, rng);
  return {
    questions: picked.map(w => buildQuestion(w, words, rng)),
    index: 0,
    hp: HP_MAX,
    correct: 0,
    wrong: 0,
    results: [],
    finished: false,
    startedAt: new Date().toISOString(),
  };
}

export function answer(session, choiceIndex) {
  if (session.finished) return session;
  const q = session.questions[session.index];
  const correct = choiceIndex === q.correctIndex;
  const results = [...session.results, { wordId: q.wordId, correct }];
  const index = session.index + 1;
  const hp = correct ? session.hp : session.hp - 1;
  const finished = hp <= 0 || index >= session.questions.length;
  return {
    ...session,
    results,
    index,
    hp,
    correct: session.correct + (correct ? 1 : 0),
    wrong: session.wrong + (correct ? 0 : 1),
    finished,
  };
}

export function finishQuiz(session, allWords) {
  const byId = new Map(allWords.map(w => [w.id, { ...w }]));
  for (const r of session.results) {
    const w = byId.get(r.wordId);
    if (!w) continue;
    if (r.correct) {
      w.box = Math.min(5, w.box + 1);
    } else {
      w.box = 1;
      w.wrongCount = (w.wrongCount ?? 0) + 1;
    }
  }
  const updatedWords = [...byId.values()];
  const total = session.results.length;
  const correct = session.correct;
  const expGained = correct * EXP_PER_CORRECT;
  const coinGained = correct * COIN_PER_CORRECT;
  const today = new Date().toISOString().slice(0, 10);
  const historyEntry = {
    date: today,
    wordIds: session.results.map(r => r.wordId),
    correct,
    total,
  };
  return {
    updatedWords,
    correct,
    total,
    accuracy: total ? correct / total : 0,
    expGained,
    coinGained,
    historyEntry,
  };
}
