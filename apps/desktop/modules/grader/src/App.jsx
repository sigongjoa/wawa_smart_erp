import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, BarChart3, Fingerprint, Search, Users, FileUp, X, ChevronDown, ChevronUp, Eye, Cloud, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
    // Mode: 'single' or 'batch'
    const [mode, setMode] = useState('single');

    // Single scan state
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    // Batch grade state
    const [pdfFile, setPdfFile] = useState(null);
    const [omrFile, setOmrFile] = useState(null);
    const [batchResult, setBatchResult] = useState(null);
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [expandedStudent, setExpandedStudent] = useState(null);

    // Notion upload state
    const [isNotionUploading, setIsNotionUploading] = useState(false);
    const [notionResult, setNotionResult] = useState(null);
    const [notionSubject, setNotionSubject] = useState('');
    const [notionExamDate, setNotionExamDate] = useState('');

    // Single scan handler
    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSelectedFile(file);
        setIsUploading(true);
        setResult(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/grade', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Grading failed');

            const data = await response.json();

            const mappedGrades = Object.entries(data.grades).map(([q, details]) => ({
                q: parseInt(q),
                status: details.selected.length > 0 ? "correct" : "none",
                confidence: details.confidence[0] || 0,
                selected: details.selected
            }));

            setResult({
                student: data.student_name || "Unknown Student",
                score: `${mappedGrades.filter(g => g.selected.length > 0).length} / ${mappedGrades.length}`,
                accuracy: "N/A",
                ocr_text: data.text_found.map(t => t.text).join(' '),
                grades: mappedGrades,
                image_url: data.warped_url
            });
        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    // Batch grade handler
    const handleBatchGrade = async () => {
        if (!pdfFile || !omrFile) {
            alert('Please upload both PDF answer key and OMR image.');
            return;
        }

        setIsBatchProcessing(true);
        setBatchResult(null);

        const formData = new FormData();
        formData.append('answer_pdf', pdfFile);
        formData.append('omr_image', omrFile);

        try {
            const response = await fetch('/api/batch-grade', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Batch grading failed');
            }

            const data = await response.json();
            setBatchResult(data);
            // Auto-expand first student if only one
            if (data.students.length === 1) {
                setExpandedStudent(0);
            }
        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
        } finally {
            setIsBatchProcessing(false);
        }
    };

    const clearBatchFiles = () => {
        setPdfFile(null);
        setOmrFile(null);
        setBatchResult(null);
        setExpandedStudent(null);
        setNotionResult(null);
        setNotionSubject('');
        setNotionExamDate('');
    };

    const toggleStudentExpand = (index) => {
        setExpandedStudent(expandedStudent === index ? null : index);
    };

    // Notion upload handler
    const handleNotionUpload = async () => {
        if (!batchResult) {
            alert('채점 결과가 없습니다.');
            return;
        }

        setIsNotionUploading(true);
        setNotionResult(null);

        const formData = new FormData();
        formData.append('batch_id', batchResult.batch_id);
        formData.append('students_json', JSON.stringify(batchResult.students));
        if (notionSubject) formData.append('subject', notionSubject);
        if (notionExamDate) formData.append('exam_date', notionExamDate);

        try {
            const response = await fetch('/api/notion/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Notion 업로드 실패');
            }

            const data = await response.json();
            setNotionResult(data);

            if (data.success && data.uploaded > 0) {
                alert(`Notion에 ${data.uploaded}명의 성적이 업로드되었습니다!`);
            }
        } catch (err) {
            console.error(err);
            alert("Notion 업로드 오류: " + err.message);
            setNotionResult({ success: false, error: err.message });
        } finally {
            setIsNotionUploading(false);
        }
    };

    // Render student card component
    const StudentCard = ({ student, answerKey, index }) => {
        const isExpanded = expandedStudent === index;
        const scoreColor = student.percentage >= 80 ? 'var(--success)' :
            student.percentage >= 60 ? 'var(--warning)' : 'var(--danger)';

        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-card"
                style={{ marginBottom: '1rem', overflow: 'hidden' }}
            >
                {/* Card Header - Always visible */}
                <div
                    onClick={() => toggleStudentExpand(index)}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '1rem',
                        background: isExpanded ? 'rgba(124, 77, 255, 0.1)' : 'transparent',
                        borderRadius: '12px',
                        transition: 'background 0.3s ease'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: scoreColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'black',
                            fontWeight: 700,
                            fontSize: '0.9rem'
                        }}>
                            #{index + 1}
                        </div>
                        <div>
                            <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{student.name}</h4>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {student.score} ({student.percentage}%)
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{
                            background: scoreColor,
                            color: 'black',
                            padding: '6px 16px',
                            borderRadius: '20px',
                            fontSize: '0.9rem',
                            fontWeight: 700
                        }}>
                            {student.percentage}%
                        </span>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            style={{ overflow: 'hidden' }}
                        >
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '1.5rem',
                                padding: '1rem',
                                borderTop: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                {/* Left: OMR Card Image */}
                                <div>
                                    <h5 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Eye size={16} /> OCR 처리된 OMR 카드
                                    </h5>
                                    {student.image_url ? (
                                        <img
                                            src={student.image_url}
                                            alt={`${student.name}'s OMR Card`}
                                            style={{
                                                width: '100%',
                                                maxHeight: '400px',
                                                objectFit: 'contain',
                                                borderRadius: '12px',
                                                border: '2px solid rgba(255,255,255,0.1)',
                                                background: 'rgba(0,0,0,0.3)'
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            padding: '2rem',
                                            textAlign: 'center',
                                            background: 'rgba(0,0,0,0.2)',
                                            borderRadius: '12px',
                                            color: 'var(--text-secondary)'
                                        }}>
                                            이미지 없음
                                        </div>
                                    )}
                                </div>

                                {/* Right: Answer Comparison */}
                                <div>
                                    <h5 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <FileText size={16} /> 답안 비교
                                    </h5>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(55px, 1fr))',
                                        gap: '6px',
                                        maxHeight: '400px',
                                        overflowY: 'auto',
                                        padding: '10px',
                                        background: 'rgba(0,0,0,0.2)',
                                        borderRadius: '12px'
                                    }}>
                                        {answerKey.map((correctAns, qIdx) => {
                                            const studentAns = student.details?.[qIdx + 1]?.selected?.[0];
                                            const isCorrect = studentAns === correctAns;
                                            const hasAnswer = studentAns !== undefined && studentAns !== null;

                                            return (
                                                <div key={qIdx} style={{
                                                    padding: '6px',
                                                    textAlign: 'center',
                                                    background: isCorrect ? 'rgba(0, 230, 118, 0.15)' :
                                                        hasAnswer ? 'rgba(255, 82, 82, 0.15)' : 'rgba(255,255,255,0.03)',
                                                    borderRadius: '8px',
                                                    border: `1px solid ${isCorrect ? 'var(--success)' :
                                                        hasAnswer ? 'var(--danger)' : 'rgba(255,255,255,0.1)'}`
                                                }}>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                                                        Q{qIdx + 1}
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{
                                                            background: hasAnswer ? (isCorrect ? 'var(--success)' : 'var(--danger)') : 'var(--text-secondary)',
                                                            color: 'black',
                                                            borderRadius: '50%',
                                                            width: '20px',
                                                            height: '20px',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 800,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            {hasAnswer ? studentAns : '-'}
                                                        </span>
                                                        {!isCorrect && hasAnswer && (
                                                            <span style={{ fontSize: '0.6rem', color: 'var(--success)' }}>
                                                                →{correctAns}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Score Summary */}
                                    <div style={{
                                        marginTop: '1rem',
                                        padding: '1rem',
                                        background: 'rgba(124, 77, 255, 0.1)',
                                        borderRadius: '12px',
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr 1fr',
                                        gap: '1rem',
                                        textAlign: 'center'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>
                                                {student.correct_count}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>정답</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>
                                                {student.total_questions - student.correct_count}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>오답</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: scoreColor }}>
                                                {student.percentage}%
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>점수</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    };

    return (
        <div className="app-container">
            <header className="header animate-fade">
                <div className="logo">SMART-GRADER <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>by Mathesis</span></div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="status-badge status-valid">System Active</div>
                    <div className="glass-card" style={{ padding: '8px 16px', borderRadius: '12px' }}>
                        Teacher Mode
                    </div>
                </div>
            </header>

            {/* Mode Tabs */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }} className="animate-fade">
                <button
                    onClick={() => setMode('single')}
                    className={`mode-tab ${mode === 'single' ? 'active' : ''}`}
                    style={{
                        padding: '12px 24px',
                        borderRadius: '12px',
                        border: 'none',
                        background: mode === 'single' ? 'var(--accent-primary)' : 'var(--bg-card)',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 600,
                        transition: 'all 0.3s ease'
                    }}
                >
                    <Fingerprint size={18} /> Single Scan
                </button>
                <button
                    onClick={() => setMode('batch')}
                    className={`mode-tab ${mode === 'batch' ? 'active' : ''}`}
                    style={{
                        padding: '12px 24px',
                        borderRadius: '12px',
                        border: 'none',
                        background: mode === 'batch' ? 'var(--accent-primary)' : 'var(--bg-card)',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 600,
                        transition: 'all 0.3s ease'
                    }}
                >
                    <Users size={18} /> Batch Grade
                </button>
            </div>

            <main className="dashboard-grid">
                {mode === 'single' ? (
                    /* Single Scan Mode */
                    <>
                        <section className="animate-fade" style={{ animationDelay: '0.1s' }}>
                            <div className="glass-card" style={{ marginBottom: '2rem' }}>
                                <h3><Upload size={18} style={{ marginRight: 8 }} /> Quick Scan</h3>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                    Drag OMR cards or photos here. No timing marks required.
                                </p>

                                <label className="upload-zone">
                                    <input type="file" hidden onChange={handleUpload} accept="image/*" />
                                    <Fingerprint size={48} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
                                    {isUploading ? (
                                        <div style={{ textAlign: 'center' }}>
                                            <p>AI Engine Scanning...</p>
                                            <div style={{ width: '200px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
                                                <motion.div
                                                    initial={{ x: '-100%' }}
                                                    animate={{ x: '100%' }}
                                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                                    style={{ width: '100%', height: '100%', background: 'var(--accent-primary)' }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <p>{selectedFile ? selectedFile.name : "Click to select a file"}</p>
                                    )}
                                </label>
                            </div>

                            <AnimatePresence>
                                {result && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="glass-card"
                                    >
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
                                            <div className="preview-container">
                                                <h4 style={{ marginBottom: '1rem' }}>Processed OMR Card</h4>
                                                <img
                                                    src={result.image_url}
                                                    alt="Processed OMR"
                                                    style={{ width: '100%', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                                                />
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                                    <div>
                                                        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{result.student}</h2>
                                                        <p style={{ color: 'var(--text-secondary)' }}>Mathesis-Synapse Node: #13-SG</p>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '2rem', color: 'var(--accent-secondary)' }}>{result.score}</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--success)' }}>Accuracy: {result.accuracy}</div>
                                                    </div>
                                                </div>

                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(65px, 1fr))',
                                                    gap: '0.4rem',
                                                    marginBottom: '2rem',
                                                    maxHeight: '300px',
                                                    overflowY: 'auto',
                                                    padding: '10px',
                                                    background: 'rgba(0,0,0,0.2)',
                                                    borderRadius: '12px'
                                                }}>
                                                    {result.grades.map((g, i) => (
                                                        <div key={i} className="glass-card" style={{ padding: '6px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Q{g.q}</div>
                                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                                {g.selected.length > 0 ? (
                                                                    <div style={{ background: 'var(--success)', color: 'black', borderRadius: '50%', width: '18px', height: '18px', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        {g.selected[0] + 1}
                                                                    </div>
                                                                ) : (
                                                                    <Search size={14} color="var(--warning)" />
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '0.5rem', marginTop: '2px', opacity: 0.5 }}>{Math.round(g.confidence * 100)}%</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div>
                                                    <h4><FileText size={16} style={{ marginRight: 6 }} /> AI Insights</h4>
                                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: '1.6', maxHeight: '150px', overflowY: 'auto' }}>
                                                        {result.ocr_text}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </section>

                        <section className="animate-fade" style={{ animationDelay: '0.2s' }}>
                            <div className="glass-card" style={{ height: '100%' }}>
                                <h3><BarChart3 size={18} style={{ marginRight: 8 }} /> Progress</h3>
                                <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    {[
                                        { label: "Average Score", value: "72.4", trend: "+5%" },
                                        { label: "Scanning Speed", value: "0.8s", trend: "Optimal" },
                                        { label: "AI Confidence", value: "99.2%", trend: "Stable" }
                                    ].map((item, idx) => (
                                        <div key={idx}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{item.label}</span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>{item.trend}</span>
                                            </div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{item.value}</div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ marginTop: '3rem', padding: '1rem', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(124, 77, 255, 0.1), rgba(0, 229, 255, 0.1))', border: '1px solid var(--accent-primary)' }}>
                                    <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>Next Step</h4>
                                    <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>Monthly reports will be generated automatically on Saturday.</p>
                                </div>
                            </div>
                        </section>
                    </>
                ) : (
                    /* Batch Grade Mode - Redesigned Layout */
                    <>
                        <section className="animate-fade" style={{ animationDelay: '0.1s', gridColumn: batchResult ? '1 / -1' : 'auto' }}>
                            {/* Upload Section */}
                            {!batchResult && (
                                <div className="glass-card" style={{ marginBottom: '2rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <h3><Users size={18} style={{ marginRight: 8 }} /> Batch Grade</h3>
                                        {(pdfFile || omrFile) && (
                                            <button
                                                onClick={clearBatchFiles}
                                                style={{
                                                    background: 'transparent',
                                                    border: '1px solid var(--danger)',
                                                    color: 'var(--danger)',
                                                    padding: '6px 12px',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    fontSize: '0.8rem'
                                                }}
                                            >
                                                <X size={14} /> Clear
                                            </button>
                                        )}
                                    </div>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                        Upload a PDF with answer key and an image containing multiple OMR cards.
                                    </p>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                        {/* PDF Upload */}
                                        <label className="upload-zone" style={{ height: '150px' }}>
                                            <input
                                                type="file"
                                                hidden
                                                accept=".pdf"
                                                onChange={(e) => setPdfFile(e.target.files[0])}
                                            />
                                            <FileUp size={32} color={pdfFile ? 'var(--success)' : 'var(--accent-primary)'} style={{ marginBottom: '0.5rem' }} />
                                            <p style={{ fontSize: '0.85rem', textAlign: 'center' }}>
                                                {pdfFile ? (
                                                    <span style={{ color: 'var(--success)' }}>{pdfFile.name}</span>
                                                ) : (
                                                    "Answer PDF"
                                                )}
                                            </p>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>PDF with answer key</span>
                                        </label>

                                        {/* OMR Image Upload */}
                                        <label className="upload-zone" style={{ height: '150px' }}>
                                            <input
                                                type="file"
                                                hidden
                                                accept="image/*"
                                                onChange={(e) => setOmrFile(e.target.files[0])}
                                            />
                                            <Fingerprint size={32} color={omrFile ? 'var(--success)' : 'var(--accent-primary)'} style={{ marginBottom: '0.5rem' }} />
                                            <p style={{ fontSize: '0.85rem', textAlign: 'center' }}>
                                                {omrFile ? (
                                                    <span style={{ color: 'var(--success)' }}>{omrFile.name}</span>
                                                ) : (
                                                    "OMR Image"
                                                )}
                                            </p>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Grid of OMR cards</span>
                                        </label>
                                    </div>

                                    <button
                                        onClick={handleBatchGrade}
                                        disabled={!pdfFile || !omrFile || isBatchProcessing}
                                        className="btn-primary"
                                        style={{
                                            width: '100%',
                                            padding: '14px',
                                            fontSize: '1rem',
                                            opacity: (!pdfFile || !omrFile || isBatchProcessing) ? 0.5 : 1,
                                            cursor: (!pdfFile || !omrFile || isBatchProcessing) ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {isBatchProcessing ? (
                                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                                    style={{ width: '18px', height: '18px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }}
                                                />
                                                Processing...
                                            </span>
                                        ) : (
                                            'Start Batch Grading'
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Batch Results - New Layout */}
                            <AnimatePresence>
                                {batchResult && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        {/* Header with Clear Button */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <CheckCircle size={24} color="var(--success)" />
                                                채점 결과
                                                <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
                                                    ({batchResult.students.length}명)
                                                </span>
                                            </h2>
                                            <button
                                                onClick={clearBatchFiles}
                                                style={{
                                                    background: 'var(--accent-primary)',
                                                    border: 'none',
                                                    color: 'white',
                                                    padding: '10px 20px',
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600
                                                }}
                                            >
                                                <X size={16} /> 새로 채점하기
                                            </button>
                                        </div>

                                        {/* Three Column Layout */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '280px 1fr 300px',
                                            gap: '1.5rem',
                                            marginBottom: '2rem'
                                        }}>
                                            {/* Left: Answer Key */}
                                            <div className="glass-card" style={{ padding: '1.25rem' }}>
                                                <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <FileText size={18} color="var(--accent-primary)" />
                                                    정답지 (PDF 추출)
                                                </h4>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                                    총 {batchResult.total_questions}문항
                                                </div>
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(5, 1fr)',
                                                    gap: '6px',
                                                    maxHeight: '500px',
                                                    overflowY: 'auto',
                                                    padding: '4px'
                                                }}>
                                                    {batchResult.answer_key.map((ans, idx) => (
                                                        <div key={idx} style={{
                                                            background: 'rgba(124, 77, 255, 0.2)',
                                                            border: '1px solid var(--accent-primary)',
                                                            borderRadius: '8px',
                                                            padding: '6px',
                                                            textAlign: 'center'
                                                        }}>
                                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                                                                {idx + 1}
                                                            </div>
                                                            <div style={{
                                                                fontSize: '1rem',
                                                                fontWeight: 700,
                                                                color: 'var(--accent-secondary)'
                                                            }}>
                                                                {ans}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* PDF Extraction Info */}
                                                {batchResult.pdf_extraction && (
                                                    <div style={{
                                                        marginTop: '1rem',
                                                        padding: '0.75rem',
                                                        background: 'rgba(0,0,0,0.2)',
                                                        borderRadius: '8px',
                                                        fontSize: '0.75rem'
                                                    }}>
                                                        <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                                            추출 신뢰도: {Math.round(batchResult.pdf_extraction.confidence * 100)}%
                                                        </div>
                                                        {batchResult.pdf_extraction.raw_text_preview && (
                                                            <div style={{
                                                                color: 'var(--text-secondary)',
                                                                maxHeight: '60px',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                opacity: 0.7
                                                            }}>
                                                                {batchResult.pdf_extraction.raw_text_preview.substring(0, 100)}...
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Center: Student Cards */}
                                            <div>
                                                <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Users size={18} color="var(--accent-secondary)" />
                                                    학생별 채점 결과
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                                                        (클릭하여 상세보기)
                                                    </span>
                                                </h4>
                                                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                                    {batchResult.students.map((student, idx) => (
                                                        <StudentCard
                                                            key={idx}
                                                            student={student}
                                                            answerKey={batchResult.answer_key}
                                                            index={idx}
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Right: Statistics */}
                                            <div className="glass-card" style={{ padding: '1.25rem' }}>
                                                <h4 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <BarChart3 size={18} color="var(--success)" />
                                                    통계
                                                </h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                                    {[
                                                        { label: "응시 인원", value: batchResult.statistics.student_count + "명", color: 'var(--accent-primary)' },
                                                        { label: "평균 점수", value: batchResult.statistics.average_score + "%", color: batchResult.statistics.average_score >= 70 ? 'var(--success)' : 'var(--warning)' },
                                                        { label: "최고 점수", value: batchResult.statistics.highest_score + "%", color: 'var(--success)' },
                                                        { label: "최저 점수", value: batchResult.statistics.lowest_score + "%", color: 'var(--danger)' },
                                                        { label: "만점자", value: (batchResult.statistics.perfect_scores || 0) + "명", color: 'var(--accent-secondary)' },
                                                        { label: "과락 (<60%)", value: (batchResult.statistics.failing_scores || 0) + "명", color: 'var(--danger)' }
                                                    ].map((item, idx) => (
                                                        <div key={idx} style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            padding: '0.75rem',
                                                            background: 'rgba(0,0,0,0.2)',
                                                            borderRadius: '10px'
                                                        }}>
                                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.label}</span>
                                                            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: item.color }}>{item.value}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Score Distribution Bar */}
                                                <div style={{ marginTop: '1.5rem' }}>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>점수 분포</div>
                                                    <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                                                        {(() => {
                                                            const total = batchResult.students.length;
                                                            const high = batchResult.students.filter(s => s.percentage >= 80).length;
                                                            const mid = batchResult.students.filter(s => s.percentage >= 60 && s.percentage < 80).length;
                                                            const low = batchResult.students.filter(s => s.percentage < 60).length;
                                                            return (
                                                                <>
                                                                    <div style={{ width: `${(high / total) * 100}%`, background: 'var(--success)' }} title={`80% 이상: ${high}명`} />
                                                                    <div style={{ width: `${(mid / total) * 100}%`, background: 'var(--warning)' }} title={`60-79%: ${mid}명`} />
                                                                    <div style={{ width: `${(low / total) * 100}%`, background: 'var(--danger)' }} title={`60% 미만: ${low}명`} />
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.7rem' }}>
                                                        <span style={{ color: 'var(--success)' }}>우수</span>
                                                        <span style={{ color: 'var(--warning)' }}>보통</span>
                                                        <span style={{ color: 'var(--danger)' }}>미달</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom: Summary Table */}
                                        <div className="glass-card">
                                            <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <CheckCircle size={18} color="var(--success)" />
                                                전체 결과 요약
                                            </h4>
                                            <div style={{ overflowX: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                                                            <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>순위</th>
                                                            <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>이름</th>
                                                            <th style={{ textAlign: 'center', padding: '12px 8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>정답</th>
                                                            <th style={{ textAlign: 'center', padding: '12px 8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>오답</th>
                                                            <th style={{ textAlign: 'center', padding: '12px 8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>점수</th>
                                                            <th style={{ textAlign: 'center', padding: '12px 8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>등급</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[...batchResult.students]
                                                            .sort((a, b) => b.percentage - a.percentage)
                                                            .map((student, idx) => (
                                                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                                    <td style={{ padding: '12px 8px', fontSize: '0.9rem', fontWeight: 700 }}>
                                                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                                                    </td>
                                                                    <td style={{ padding: '12px 8px', fontSize: '0.9rem', fontWeight: 600 }}>{student.name}</td>
                                                                    <td style={{ padding: '12px 8px', fontSize: '0.9rem', textAlign: 'center', color: 'var(--success)' }}>
                                                                        {student.correct_count}
                                                                    </td>
                                                                    <td style={{ padding: '12px 8px', fontSize: '0.9rem', textAlign: 'center', color: 'var(--danger)' }}>
                                                                        {student.total_questions - student.correct_count}
                                                                    </td>
                                                                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                                                        <span style={{
                                                                            background: student.percentage >= 80 ? 'var(--success)' :
                                                                                student.percentage >= 60 ? 'var(--warning)' : 'var(--danger)',
                                                                            color: 'black',
                                                                            padding: '4px 12px',
                                                                            borderRadius: '12px',
                                                                            fontSize: '0.85rem',
                                                                            fontWeight: 700
                                                                        }}>
                                                                            {student.percentage}%
                                                                        </span>
                                                                    </td>
                                                                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                                                        {student.percentage >= 90 ? (
                                                                            <span style={{ color: 'var(--success)', fontWeight: 700 }}>A</span>
                                                                        ) : student.percentage >= 80 ? (
                                                                            <span style={{ color: 'var(--accent-secondary)', fontWeight: 700 }}>B</span>
                                                                        ) : student.percentage >= 70 ? (
                                                                            <span style={{ color: 'var(--warning)', fontWeight: 700 }}>C</span>
                                                                        ) : student.percentage >= 60 ? (
                                                                            <span style={{ color: 'orange', fontWeight: 700 }}>D</span>
                                                                        ) : (
                                                                            <span style={{ color: 'var(--danger)', fontWeight: 700 }}>F</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Notion Upload Section */}
                                        <div className="glass-card" style={{ marginTop: '1.5rem' }}>
                                            <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Cloud size={18} color="var(--accent-secondary)" />
                                                Notion DB 연동
                                            </h4>

                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr auto',
                                                gap: '1rem',
                                                alignItems: 'end',
                                                marginBottom: '1rem'
                                            }}>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                                                        과목 (선택)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={notionSubject}
                                                        onChange={(e) => setNotionSubject(e.target.value)}
                                                        placeholder="예: 수학, 국어"
                                                        style={{
                                                            width: '100%',
                                                            padding: '10px 14px',
                                                            borderRadius: '8px',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            background: 'rgba(0,0,0,0.2)',
                                                            color: 'white',
                                                            fontSize: '0.9rem'
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                                                        시험년월 (선택)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={notionExamDate}
                                                        onChange={(e) => setNotionExamDate(e.target.value)}
                                                        placeholder="예: 2026-02"
                                                        style={{
                                                            width: '100%',
                                                            padding: '10px 14px',
                                                            borderRadius: '8px',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            background: 'rgba(0,0,0,0.2)',
                                                            color: 'white',
                                                            fontSize: '0.9rem'
                                                        }}
                                                    />
                                                </div>
                                                <button
                                                    onClick={handleNotionUpload}
                                                    disabled={isNotionUploading}
                                                    style={{
                                                        padding: '10px 24px',
                                                        borderRadius: '10px',
                                                        border: 'none',
                                                        background: notionResult?.success ? 'var(--success)' : 'linear-gradient(135deg, #4A90A4, #357ABD)',
                                                        color: 'white',
                                                        cursor: isNotionUploading ? 'not-allowed' : 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        fontSize: '0.9rem',
                                                        fontWeight: 600,
                                                        opacity: isNotionUploading ? 0.7 : 1,
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                >
                                                    {isNotionUploading ? (
                                                        <>
                                                            <motion.div
                                                                animate={{ rotate: 360 }}
                                                                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                                                style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }}
                                                            />
                                                            업로드 중...
                                                        </>
                                                    ) : notionResult?.success ? (
                                                        <>
                                                            <CheckCircle size={16} />
                                                            업로드 완료!
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Cloud size={16} />
                                                            Notion 업로드
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            {notionResult && (
                                                <div style={{
                                                    padding: '12px',
                                                    borderRadius: '8px',
                                                    background: notionResult.success ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 82, 82, 0.1)',
                                                    border: `1px solid ${notionResult.success ? 'var(--success)' : 'var(--danger)'}`,
                                                    fontSize: '0.85rem'
                                                }}>
                                                    {notionResult.success ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <CheckCircle size={16} color="var(--success)" />
                                                            <span>
                                                                {notionResult.uploaded}명의 성적이 Notion에 저장되었습니다.
                                                                {notionResult.failed > 0 && ` (${notionResult.failed}명 실패)`}
                                                            </span>
                                                            <a
                                                                href="https://notion.so"
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{
                                                                    marginLeft: 'auto',
                                                                    color: 'var(--accent-secondary)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    textDecoration: 'none'
                                                                }}
                                                            >
                                                                Notion에서 보기 <ExternalLink size={14} />
                                                            </a>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <AlertCircle size={16} color="var(--danger)" />
                                                            <span>업로드 실패: {notionResult.error}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </section>

                        {/* Statistics Panel - Only show when no results */}
                        {!batchResult && (
                            <section className="animate-fade" style={{ animationDelay: '0.2s' }}>
                                <div className="glass-card" style={{ height: '100%' }}>
                                    <h3><BarChart3 size={18} style={{ marginRight: 8 }} /> Statistics</h3>
                                    <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <BarChart3 size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                                        <p>Statistics will appear after batch grading</p>
                                    </div>

                                    <div style={{ marginTop: '2rem', padding: '1rem', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(124, 77, 255, 0.1), rgba(0, 229, 255, 0.1))', border: '1px solid var(--accent-primary)' }}>
                                        <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>Batch Mode</h4>
                                        <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                                            Upload PDF with answers and scan image with multiple OMR cards in grid layout.
                                        </p>
                                    </div>
                                </div>
                            </section>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

export default App;
