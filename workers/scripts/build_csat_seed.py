"""Final clean: filter to entries whose meaning contains Korean characters; dedupe; rank."""
import fitz, re, json, pathlib, collections

ENG_RE_FULL = re.compile(r"^[A-Za-z][A-Za-z'\- ]*[A-Za-z]$")
ENG_TOKEN_RE = re.compile(r"^[A-Za-z][A-Za-z'\-]*[A-Za-z]?$")
KO_RE = re.compile(r"[가-힣]")
PDFS = [
    ("/tmp/csat_vocab/megastudy_2025_susung.pdf", "수능2025"),
    ("/tmp/csat_vocab/megastudy_23mar.pdf",       "모의2023-3"),
]
HEADER_BLOCK = {"단어","뜻","메가스터디","대표강사","김","동","영","수능","기출","영단어","모음","고3","모의고사","월","3월","23년","2025"}

def is_eng_run(t):
    parts = t.split()
    return all(ENG_TOKEN_RE.match(p) for p in parts) and not KO_RE.search(t)

entries = []
for path, src in PDFS:
    doc = fitz.open(path)
    for page in doc:
        words = page.get_text("words")
        lines = collections.defaultdict(list)
        for w in words:
            x0,y0,x1,y1,txt,*_ = w
            if not txt.strip(): continue
            if txt.strip() in HEADER_BLOCK: continue
            lines[round(y0/2)*2].append((x0,x1,txt))
        for y, spans in sorted(lines.items()):
            spans.sort(key=lambda t: t[0])
            runs, cur, prev_x1 = [], [], None
            for x0,x1,txt in spans:
                if prev_x1 is not None and x0 - prev_x1 > 12:
                    if cur: runs.append(cur)
                    cur = []
                cur.append((x0,x1,txt))
                prev_x1 = x1
            if cur: runs.append(cur)
            run_texts = [" ".join(t for _,_,t in r).strip() for r in runs]
            if not run_texts: continue
            joined = " ".join(run_texts)
            if any(h in joined for h in ["대표강사","메가스터디","고3 모의고사","수능 기출"]):
                continue
            classes = []
            for txt in run_texts:
                if is_eng_run(txt):
                    classes.append("eng")
                elif KO_RE.search(txt):
                    classes.append("kor")
                else:
                    classes.append("mixed")  # like "v. 가정하다" mixed
            # take pair: eng followed by non-eng (kor or mixed-with-korean)
            i = 0
            while i < len(run_texts):
                if classes[i] == "eng" and i+1 < len(run_texts) and classes[i+1] != "eng" and KO_RE.search(run_texts[i+1]):
                    entries.append((run_texts[i], run_texts[i+1], src))
                    i += 2
                else:
                    i += 1
    doc.close()

seen = {}
for w, m, src in entries:
    w, m = w.strip(), m.strip()
    if not w or not m: continue
    if not ENG_RE_FULL.match(w): continue
    if w.lower() in {"단어","뜻"}: continue
    if not KO_RE.search(m): continue           # must have Korean
    if len(m) > 80: m = m[:80]                 # cap absurdly long meanings
    k = w.lower()
    if k in seen:
        if len(seen[k][1]) < len(m):
            seen[k] = (w, m, src)
    else:
        seen[k] = (w, m, src)

counts = collections.Counter()
for path, _ in PDFS:
    doc = fitz.open(path)
    for page in doc:
        for tok in re.findall(r"[A-Za-z][A-Za-z'\-]+[A-Za-z]", page.get_text()):
            counts[tok.lower()] += 1
    doc.close()

# infer pos from meaning prefix
def infer_pos(m):
    if re.match(r"^v\.\s", m): return "verb"
    if re.match(r"^n\.\s", m): return "noun"
    if re.match(r"^a\.\s", m): return "adj"
    if re.match(r"^adv\.\s", m): return "adv"
    if re.match(r"^prep\.\s", m): return "prep"
    if re.match(r"^conj\.\s", m): return "conj"
    if re.search(r"하다|되다", m): return "verb"
    if re.search(r"적인$|적$|있는|어진", m): return "adj"
    return "noun"

records = []
for k, (w, m, src) in seen.items():
    first = k.split()[0]
    pos = infer_pos(m)
    records.append({
        "english": w, "korean": m,
        "pos": pos,
        "freq": counts.get(first, 0),
        "source": src,
    })

records.sort(key=lambda r: (-r["freq"], r["english"].lower()))
n = len(records)
for i, r in enumerate(records, 1):
    r["rank"] = i
    r["tier"] = 1 if i <= max(1, n//3) else (2 if i <= 2*n//3 else 3)

# stats
pos_dist = collections.Counter(r["pos"] for r in records)
tier_dist = collections.Counter(r["tier"] for r in records)
print(f"TOTAL: {n}")
print(f"pos dist: {dict(pos_dist)}")
print(f"tier dist: {dict(tier_dist)}")
print("\nfirst 12:")
for r in records[:12]:
    print(f"  {r['rank']:>4d} t{r['tier']} [{r['pos']}] {r['english']:<26s} {r['korean']}")
print("\nlast 5:")
for r in records[-5:]:
    print(f"  {r['rank']:>4d} t{r['tier']} [{r['pos']}] {r['english']:<26s} {r['korean']}")

out_path = pathlib.Path("/mnt/g/vine_academy/wawa_smart_erp/workers/seeds/csat_vocab_v1.json")
out_path.write_text(json.dumps({
    "catalog_id": "csat-megastudy-2025",
    "title": "수능 영단어 (메가스터디 무료 PDF)",
    "source": "megastudy-2025-susung+23mar",
    "license": "학원 내부 학습용 — 메가스터디 김동영 강사 무료 배포 PDF 기반",
    "word_count": n,
    "words": records,
}, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\nwrote {out_path}: {n} entries")
