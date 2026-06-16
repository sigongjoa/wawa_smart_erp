-- =============================================
-- "삼각형 내각의 합" 도형 시드 (PoC)
-- 좌표: A(150,40) B(40,220) C(260,220) D(40,40) E(260,40)
-- 자동검증 결과: 6 checks ALL PASS
-- =============================================

INSERT INTO proof_figures (
  id, proof_id, svg_content, coords_json, verify_meta_json, verify_result_json,
  highlight_keys, alt_text, review_status
) VALUES (
  'fig_tas_main',
  'prf_m1_tri_angle_sum',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 260" width="300" height="260">
    <style>
      .tri{fill:none;stroke:#1e40af;stroke-width:2.2}
      .aux{stroke:#9ca3af;stroke-width:1.5;stroke-dasharray:5 3}
      .arc{fill:none;stroke-width:1.6}
      .vlabel{font:bold 14px sans-serif;fill:#111}
      .alabel{font:italic 11px sans-serif}
      .aux-label{font:11px sans-serif;fill:#6b7280}
    </style>
    <line id="line_l" class="aux" x1="20" y1="40" x2="280" y2="40"/>
    <text class="aux-label" x="5" y="44">ℓ</text>
    <polygon id="triangle_abc" class="tri" points="150,40 40,220 260,220"/>
    <line id="line_ad" class="aux" x1="40" y1="40" x2="150" y2="40" stroke="#6b7280" stroke-dasharray="0"/>
    <line id="line_ae" class="aux" x1="150" y1="40" x2="260" y2="40" stroke="#6b7280" stroke-dasharray="0"/>
    <path id="arc_DAB" class="arc" stroke="#dc2626" d="M 120,40 A 30,30 0 0,0 135,56"/>
    <text class="alabel" fill="#dc2626" x="100" y="58">∠DAB</text>
    <path id="arc_BAC" class="arc" stroke="#059669" d="M 135,56 A 24,24 0 0,0 166,56"/>
    <text class="alabel" fill="#059669" x="142" y="76">∠A</text>
    <path id="arc_CAE" class="arc" stroke="#d97706" d="M 166,56 A 30,30 0 0,0 180,40"/>
    <text class="alabel" fill="#d97706" x="175" y="58">∠CAE</text>
    <path id="arc_B" class="arc" stroke="#dc2626" d="M 56,214 A 20,20 0 0,1 72,202"/>
    <text class="alabel" fill="#dc2626" x="60" y="200">∠B</text>
    <path id="arc_C" class="arc" stroke="#d97706" d="M 244,214 A 20,20 0 0,0 228,202"/>
    <text class="alabel" fill="#d97706" x="222" y="200">∠C</text>
    <circle cx="150" cy="40" r="3" fill="#111"/>
    <circle cx="40" cy="220" r="3" fill="#111"/>
    <circle cx="260" cy="220" r="3" fill="#111"/>
    <circle cx="40" cy="40" r="2.5" fill="#6b7280"/>
    <circle cx="260" cy="40" r="2.5" fill="#6b7280"/>
    <text class="vlabel" x="145" y="30">A</text>
    <text class="vlabel" x="26" y="236">B</text>
    <text class="vlabel" x="265" y="236">C</text>
    <text class="aux-label" x="28" y="34">D</text>
    <text class="aux-label" x="265" y="34">E</text>
  </svg>',
  '{"A":[150,40],"B":[40,220],"C":[260,220],"D":[40,40],"E":[260,40]}',
  '{"assertions":[
    {"type":"collinear","points":["D","A","E"]},
    {"type":"parallel","line1":["D","E"],"line2":["B","C"]},
    {"type":"triangle_angle_sum","vertices":["A","B","C"],"expected":180},
    {"type":"alternate_angles","a1":["B","-","ABC"],"a2":["DAB"]},
    {"type":"alternate_angles","a1":["C","-","ACB"],"a2":["EAC"]},
    {"type":"straight_at","vertex":"A","angles":["DAB","BAC","CAE"],"expected":180}
  ]}',
  '{"status":"PASS","checks":[
    {"name":"D,A,E 공선","result":"PASS","detail":"∠DAE=180.000°"},
    {"name":"ℓ ∥ BC","result":"PASS","detail":"slope(DE)=0.000, slope(BC)=0.000"},
    {"name":"∠A+∠B+∠C=180°","result":"PASS","detail":"62.86+58.57+58.57=180.000"},
    {"name":"∠B=∠DAB","result":"PASS","detail":"58.570=58.570"},
    {"name":"∠C=∠EAC","result":"PASS","detail":"58.570=58.570"},
    {"name":"A에서 평각 180°","result":"PASS","detail":"합=180.000°"}
  ],"verified_at":"2026-04-15"}',
  'triangle_abc,line_l,arc_DAB,arc_BAC,arc_CAE,arc_B,arc_C',
  '삼각형 ABC와 꼭짓점 A를 지나고 BC에 평행한 보조선 ℓ. ℓ 위의 두 점 D(왼쪽), E(오른쪽). 엇각 ∠B=∠DAB, ∠C=∠EAC, 그리고 A에서의 평각 ∠DAB+∠BAC+∠CAE=180° 표시됨.',
  'approved'
);
