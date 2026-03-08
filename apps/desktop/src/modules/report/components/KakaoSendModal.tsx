import { useState, useEffect } from 'react';
import type { MonthlyReport, Student } from '../../../types';
import {
  isLoggedIn,
  kakaoLogin,
  kakaoLogout,
  getKakaoFriends,
  sendMessageToFriend,
  type KakaoFriend,
} from '../../../services/kakao';
import { useToastStore } from '../../../stores/toastStore';

interface KakaoSendModalProps {
  report: MonthlyReport;
  student: Student;
  onClose: () => void;
  onSent: () => void;
}

function buildMessage(report: MonthlyReport, student: Student): string {
  const [year, month] = report.yearMonth.split('-');
  const scoreLines = report.scores
    .map(s => `• ${s.subject}: ${s.score}점`)
    .join('\n');

  return [
    `[와와학원] 월말평가 결과 안내`,
    ``,
    `학생: ${student.name} (${student.grade})`,
    `기간: ${year}년 ${parseInt(month)}월`,
    ``,
    `📚 과목별 성적`,
    scoreLines,
    report.totalComment ? `\n💬 총평\n${report.totalComment}` : '',
  ]
    .join('\n')
    .trim();
}

export default function KakaoSendModal({ report, student, onClose, onSent }: KakaoSendModalProps) {
  const { addToast } = useToastStore();
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [friends, setFriends] = useState<KakaoFriend[]>([]);
  const [selectedUuid, setSelectedUuid] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'login' | 'select' | 'preview'>('login');

  const message = buildMessage(report, student);

  useEffect(() => {
    if (loggedIn) {
      loadFriends();
    }
  }, [loggedIn]);

  const loadFriends = async () => {
    setLoading(true);
    const list = await getKakaoFriends();
    setFriends(list);
    setLoading(false);
    setStep('select');
  };

  const handleLogin = async () => {
    setLoading(true);
    const ok = await kakaoLogin();
    setLoading(false);
    if (ok) {
      setLoggedIn(true);
    } else {
      addToast('카카오 로그인에 실패했습니다.', 'error');
    }
  };

  const handleLogout = () => {
    kakaoLogout();
    setLoggedIn(false);
    setFriends([]);
    setStep('login');
  };

  const handleSend = async () => {
    if (!selectedUuid) return;
    setLoading(true);
    const ok = await sendMessageToFriend(selectedUuid, message);
    setLoading(false);
    if (ok) {
      addToast(`${student.name} 월말평가 결과를 카카오톡으로 전송했습니다.`, 'success');
      onSent();
      onClose();
    } else {
      addToast('전송에 실패했습니다. 다시 시도해주세요.', 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '480px', width: '100%' }}
      >
        <div className="modal-header">
          <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>💬</span>
            카카오톡 전송 — {student.name}
          </h3>
          <button className="modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 메시지 미리보기 */}
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>전송 내용 미리보기</p>
            <textarea
              readOnly
              rows={10}
              value={message}
              style={{
                width: '100%',
                fontFamily: 'monospace',
                fontSize: '13px',
                background: '#fffde7',
                border: '1px solid #f9a825',
                borderRadius: '8px',
                padding: '10px',
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Step: 로그인 */}
          {step === 'login' && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                친구에게 보내려면 카카오 로그인이 필요합니다.
              </p>
              <button
                className="btn"
                style={{ background: '#FEE500', color: '#3C1E1E', fontWeight: 700, gap: '8px' }}
                onClick={handleLogin}
                disabled={loading}
              >
                {loading ? '로그인 중...' : '카카오 로그인'}
              </button>
            </div>
          )}

          {/* Step: 친구 선택 */}
          {step === 'select' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  받을 친구를 선택하세요
                </p>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '12px', color: 'var(--text-muted)' }}
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </div>

              {loading ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>친구 목록 불러오는 중...</p>
              ) : friends.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '14px' }}>
                  친구 목록이 없습니다.<br/>
                  <span style={{ fontSize: '12px' }}>앱 테스터로 등록된 카카오 계정이 필요합니다.</span>
                </p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  {friends.map(f => (
                    <li
                      key={f.uuid}
                      onClick={() => setSelectedUuid(f.uuid)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 14px',
                        cursor: 'pointer',
                        background: selectedUuid === f.uuid ? 'var(--primary-light, #eef2ff)' : 'transparent',
                        borderBottom: '1px solid var(--border-light)',
                      }}
                    >
                      {f.profile_thumbnail_image ? (
                        <img
                          src={f.profile_thumbnail_image}
                          alt=""
                          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#FEE500', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700 }}>
                          {f.profile_nickname[0]}
                        </div>
                      )}
                      <span style={{ fontSize: '14px', fontWeight: selectedUuid === f.uuid ? 600 : 400 }}>
                        {f.profile_nickname}
                      </span>
                      {selectedUuid === f.uuid && (
                        <span className="material-symbols-outlined" style={{ marginLeft: 'auto', color: 'var(--primary)', fontSize: '18px' }}>check_circle</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>취소</button>
          {step === 'select' && (
            <button
              className="btn btn-primary"
              onClick={handleSend}
              disabled={!selectedUuid || loading}
            >
              {loading ? '전송 중...' : '카카오톡 전송'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
