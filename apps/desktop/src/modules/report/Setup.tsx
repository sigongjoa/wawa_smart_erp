import React, { useState } from 'react';
import { useReportStore } from '../../stores/reportStore';
import { testNotionConnection } from '../../services/notion';

export default function Setup() {
    const { setAppSettings, fetchAllData } = useReportStore();
    const [isDragging, setIsDragging] = useState(false);
    const [isValidating, setIsValidating] = useState(false);

    const handleFileUpload = async (file: File) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (!json.notionApiKey) {
                    throw new Error('Notion API Key가 설정 파일에 없습니다.');
                }

                setIsValidating(true);

                // 1. Test Connection
                const result = await testNotionConnection(json.notionApiKey, {
                    teachers: json.notionTeachersDb,
                    students: json.notionStudentsDb,
                    scores: json.notionScoresDb,
                    exams: json.notionExamsDb,
                    absenceHistory: json.notionAbsenceHistoryDb
                });

                if (!result.success) {
                    throw new Error(result.message || 'Notion 연결에 실패했습니다.');
                }

                // 2. Save settings
                setAppSettings(json);

                // 3. Trigger initial fetch
                await fetchAllData();

            } catch (err: any) {
                alert(`설정 오류: ${err.message}`);
            } finally {
                setIsValidating(false);
            }
        };
        reader.readAsText(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileUpload(file);
    };

    if (isValidating) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
                <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Notion 데이터 연동 중...</h2>
                <p style={{ color: 'var(--text-secondary)' }}>실제 Notion API를 통해 정보를 가져오고 있습니다.</p>
            </div>
        );
    }

    return (
        <div className="setup-container" style={{
            maxWidth: '600px',
            margin: '60px auto',
            animation: 'fadeIn 0.5s ease-out'
        }}>
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    background: 'var(--primary)',
                    borderRadius: 'var(--radius-xl)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    color: 'white',
                    boxShadow: 'var(--shadow-lg)'
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>key</span>
                </div>

                <h1 className="page-title" style={{ fontSize: '24px', marginBottom: '8px' }}>
                    시스템 초기 설정
                </h1>
                <p className="page-description" style={{ marginBottom: '32px' }}>
                    WAWA Smart ERP를 시작하기 위해 설정 파일(.json)을 업로드해주세요.<br />
                    업로드 시 실제 Notion API 연결 여부를 즉시 검증합니다.
                </p>

                <div
                    className={`upload-zone ${isDragging ? 'dragging' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) handleFileUpload(file); }}
                    style={{
                        border: '2px dashed var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '40px 20px',
                        background: isDragging ? 'var(--primary-light)' : 'var(--background)',
                        borderColor: isDragging ? 'var(--primary)' : 'var(--border)',
                        transition: 'all var(--transition-normal)',
                        position: 'relative',
                        cursor: 'pointer'
                    }}
                >
                    <input
                        type="file"
                        accept=".json"
                        onChange={handleFileChange}
                        disabled={isValidating}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                    />
                    <span className="material-symbols-outlined" style={{
                        fontSize: '48px',
                        color: isDragging ? 'var(--primary)' : 'var(--text-muted)',
                        marginBottom: '12px'
                    }}>
                        cloud_upload
                    </span>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        파일 선택 또는 드래그 앤 드롭
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        wawa_config.json
                    </div>
                </div>

                <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => window.location.reload()}>
                        <span className="material-symbols-outlined">refresh</span>
                        다시 시도
                    </button>
                    <button className="btn btn-primary" onClick={() => {
                        const sample = {
                            notionApiKey: "secret_...",
                            notionTeachersDb: "db_id",
                            notionStudentsDb: "db_id",
                            notionScoresDb: "db_id",
                            notionExamsDb: "db_id",
                            notionAbsenceHistoryDb: "db_id",
                            notionEnrollmentDb: "db_id",
                            notionMakeupDb: "db_id"
                        };
                        const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'wawa_config_sample.json';
                        a.click();
                    }}>
                        <span className="material-symbols-outlined">download</span>
                        샘플 다운로드
                    </button>
                </div>
            </div>

            <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                설정된 정보는 브라우저의 로컬 스토리지에 저장되며, 실제 Notion 서버와 통신합니다.
            </p>
        </div>
    );
}
