import { createClient } from '@supabase/supabase-js';
import { PDFDocument, PDFRawStream, PDFName, PDFNumber } from 'pdf-lib';

// --- Supabase 설정 ---
const SUPABASE_URL = 'https://zfsagsxkkudvyvormmqf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0mz9Ac3I7X3TVv2PSYLRSQ_EqFh2rIM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 환경 설정 ---
const PDF_PRO_CONFIG = {
    LIMITS: {
        GUEST: 50 * 1024 * 1024,      // 50MB
        MEMBER: 100 * 1024 * 1024,    // 100MB
        VERIFIED: Infinity            // Unlimited
    }
};

let currentUser = null;

lucide.createIcons();

// --- Auth UI Elements ---
const authContainer = document.getElementById('auth-container');
const authModal = document.getElementById('auth-modal');
const closeAuthModal = document.getElementById('close-auth-modal');
const modalTabBtns = document.querySelectorAll('.modal-tab-btn');
const loginFormSide = document.getElementById('login-form-side');
const signupFormSide = document.getElementById('signup-form-side');

// --- Main Elements ---
const navBtns = document.querySelectorAll('.nav-btn');
const mainTitle = document.getElementById('main-title');
const mainSubtitle = document.getElementById('main-subtitle');
const dropIcon = document.getElementById('drop-icon');
const dropText = document.getElementById('drop-text');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const statusArea = document.getElementById('status-area');
const uploadSection = document.getElementById('upload-section');
const fileListContainer = document.getElementById('file-list');
const mergeHint = document.getElementById('merge-hint');
const modeSelection = document.getElementById('mode-selection');
const mergeAction = document.getElementById('merge-action');
const splitAction = document.getElementById('split-action');
const processingOverlay = document.getElementById('processing-overlay');
const processingStatus = document.getElementById('processing-status');
const batchProgressText = document.getElementById('batch-progress-text');
const progressBar = document.getElementById('progress-bar');
const resultDashboard = document.getElementById('result-dashboard');
const resultListContainer = document.getElementById('result-list');
const singleResult = document.getElementById('single-result');
const resultBadge = document.getElementById('result-badge');
const resultTitle = document.getElementById('result-title');
const compressBtn = document.getElementById('compress-btn');
const mergeBtn = document.getElementById('merge-btn');
const splitBtn = document.getElementById('split-btn');
const addMoreBtn = document.getElementById('add-more-btn');
const addMoreMergeBtn = document.getElementById('add-more-merge-btn');
const mainDownloadBtn = document.getElementById('main-download-btn');
const downloadText = document.getElementById('download-text');
const resetBtn = document.getElementById('reset-btn-v2');
const mergedName = document.getElementById('merged-name');
const mergedStats = document.getElementById('merged-stats');

// Split Specific
const splitTabBtns = document.querySelectorAll('.split-tab-btn');
const splitRangeSection = document.getElementById('split-range-section');
const splitPagesSection = document.getElementById('split-pages-section');
const rangeListContainer = document.getElementById('range-list-container');
const addRangeBtn = document.getElementById('add-range-btn');

// --- State ---
let activeTab = 'compress'; 
let splitType = 'range'; 
let selectedFiles = []; 
let compressedResults = []; 
let finalBlob = null;
let currentMode = 'recommended';
let ranges = [{ from: 1, to: 1 }];
let totalPagesInCurrentSplit = 0;

// --- Auth Modal Control ---
function openModal() { authModal.style.display = 'flex'; }
function closeModal() { authModal.style.display = 'none'; }

closeAuthModal.onclick = closeModal;
authModal.onclick = (e) => { if (e.target === authModal) closeModal(); };

modalTabBtns.forEach(btn => {
    btn.onclick = () => {
        modalTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        loginFormSide.style.display = mode === 'login' ? 'block' : 'none';
        signupFormSide.style.display = mode === 'signup' ? 'block' : 'none';
    };
});

// --- Auth Handling ---
async function updateAuthUI() {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    
    if (user) {
        const userName = user.user_metadata?.full_name || user.email.split('@')[0];
        authContainer.innerHTML = `
            <div class="user-profile">
                <span class="user-email">${userName}</span>
                <span class="logout-link" id="logout-btn">Logout</span>
            </div>
        `;
        document.getElementById('logout-btn').onclick = async () => {
            await supabase.auth.signOut();
            window.location.reload();
        };
    } else {
        authContainer.innerHTML = `<button id="login-trigger-btn" class="auth-btn">Login / Sign Up</button>`;
        document.getElementById('login-trigger-btn').onclick = openModal;
    }
}

// Logic: Do Signup
document.getElementById('do-signup-btn').onclick = async () => {
    const email = document.getElementById('signup-email').value;
    const name = document.getElementById('signup-name').value;
    const country = document.getElementById('signup-country').value;
    
    if (!email || !name || !country) { alert('Please fill in all fields.'); return; }
    
    const { data, error } = await supabase.auth.signUp({
        email,
        options: {
            data: { full_name: name, country: country }
        }
    });
    
    if (error) { alert(error.message); }
    else {
        alert('Verification email sent! Please check your inbox to complete registration.');
        closeModal();
    }
};

// Logic: Do Login
document.getElementById('do-login-btn').onclick = async () => {
    const email = document.getElementById('login-email').value;
    if (!email) { alert('Please enter your email.'); return; }
    
    const { data, error } = await supabase.auth.signInWithOtp({ email });
    
    if (error) { alert(error.message); }
    else {
        alert('Magic link sent! Check your email to login.');
        closeModal();
    }
};

supabase.auth.onAuthStateChange(() => updateAuthUI());
updateAuthUI();

function getUserLevel(user) {
    if (!user) return 'GUEST';
    if (user.email_confirmed_at && user.user_metadata?.verified_member) return 'VERIFIED';
    return 'MEMBER';
}

// --- Initialization ---
initSortable();

// --- Navigation ---
navBtns.forEach(btn => {
    btn.onclick = () => {
        if (selectedFiles.length > 0 && !confirm('All progress will be lost. Continue?')) return;
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        updateUIForTab();
        resetToUpload();
    };
});

splitTabBtns.forEach(btn => {
    btn.onclick = () => {
        splitTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        splitType = btn.dataset.splitType;
        splitRangeSection.style.display = splitType === 'range' ? 'block' : 'none';
        splitPagesSection.style.display = splitType === 'pages' ? 'block' : 'none';
    };
});

addRangeBtn.onclick = () => {
    const lastTo = ranges.length > 0 ? ranges[ranges.length - 1].to : 0;
    ranges.push({ from: lastTo + 1, to: totalPagesInCurrentSplit });
    renderRanges();
};

function updateUIForTab() {
    if (activeTab === 'compress') {
        mainTitle.textContent = 'PDF Shrink';
        mainSubtitle.textContent = 'High Performance Batch Compression';
        dropIcon.setAttribute('data-lucide', 'shrink');
        dropText.textContent = 'Select or drag up to 10 PDF files';
    } else if (activeTab === 'merge') {
        mainTitle.textContent = 'PDF Merge';
        mainSubtitle.textContent = 'Combine multiple PDF files into one';
        dropIcon.setAttribute('data-lucide', 'layers');
        dropText.textContent = 'Select or drag PDF files to combine';
    } else {
        mainTitle.textContent = 'PDF Split';
        mainSubtitle.textContent = 'Extract ranges or split all pages';
        dropIcon.setAttribute('data-lucide', 'scissors');
        dropText.textContent = 'Select or drag one PDF file to split';
    }
    lucide.createIcons();
}

dropZone.onclick = (e) => { if (e.target.id !== 'file-input') { fileInput.value = ''; fileInput.click(); } };

async function handleFiles(files) {
    const level = getUserLevel(currentUser);
    const currentLimit = PDF_PRO_CONFIG.LIMITS[level];
    const newFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    
    if (activeTab === 'split' && (selectedFiles.length + newFiles.length > 1)) {
        alert('Split mode supports one file at a time.'); return;
    }

    for (const file of newFiles) {
        if (selectedFiles.length >= 10) { alert('Limit reached (Max 10 files)'); break; }
        if (file.size > currentLimit) {
            if (level === 'GUEST') alert(`File size exceeds 50MB. Please login to increase the limit to 100MB.`);
            else if (level === 'MEMBER') alert(`File size exceeds 100MB. Verified members get unlimited size.`);
            continue; 
        }
        selectedFiles.push({ file, id: Math.random().toString(36).substr(2, 9) });
    }

    if (selectedFiles.length > 0) {
        uploadSection.style.display = 'none';
        statusArea.style.display = 'block';
        modeSelection.style.display = activeTab === 'compress' ? 'block' : 'none';
        mergeAction.style.display = activeTab === 'merge' ? 'block' : 'none';
        splitAction.style.display = activeTab === 'split' ? 'block' : 'none';
        if (activeTab === 'split') {
            const pdf = await PDFDocument.load(await selectedFiles[0].file.arrayBuffer(), { ignoreEncryption: true });
            totalPagesInCurrentSplit = pdf.getPageCount();
            ranges = [{ from: 1, to: totalPagesInCurrentSplit }];
            renderRanges();
        }
        renderFileList();
    }
}

function renderFileList() {
    fileListContainer.innerHTML = '';
    selectedFiles.forEach(item => {
        const row = document.createElement('div');
        row.className = 'file-list-item';
        row.dataset.id = item.id;
        row.innerHTML = `<div class="file-list-info">
                <i data-lucide="file-text" style="color: var(--primary);"></i>
                <div style="flex:1">
                    <div class="file-list-name">${item.file.name}</div>
                    <div class="file-list-size">${formatBytes(item.file.size)}</div>
                </div>
            </div>
            <button class="cancel-item-btn" data-id="${item.id}"><i data-lucide="x" size="16"></i></button>`;
        fileListContainer.appendChild(row);
    });
    document.querySelectorAll('.cancel-item-btn').forEach(btn => btn.onclick = (e) => {
        e.stopPropagation();
        selectedFiles = selectedFiles.filter(item => item.id !== btn.dataset.id);
        if (selectedFiles.length === 0) resetToUpload(); else renderFileList();
    });
    lucide.createIcons();
}

function renderRanges() {
    rangeListContainer.innerHTML = '';
    ranges.forEach((range, idx) => {
        const row = document.createElement('div');
        row.className = 'range-input-row';
        row.innerHTML = `
            <span class="range-label">Range ${idx + 1}</span>
            <input type="number" class="range-field from-input" value="${range.from}" min="1">
            <span style="color: var(--text-muted); font-weight:700">to</span>
            <input type="number" class="range-field to-input" value="${range.to}" min="1">
            <button class="remove-range-btn" style="display: ${ranges.length > 1 ? 'flex' : 'none'}"><i data-lucide="trash-2" size="20"></i></button>
        `;
        const fromInp = row.querySelector('.from-input');
        const toInp = row.querySelector('.to-input');
        fromInp.oninput = (e) => ranges[idx].from = parseInt(e.target.value) || 1;
        toInp.oninput = (e) => {
            const val = parseInt(e.target.value) || 1;
            ranges[idx].to = val;
            if (idx + 1 < ranges.length) {
                ranges[idx + 1].from = val + 1;
                const nextRow = rangeListContainer.children[idx + 1];
                if (nextRow) nextRow.querySelector('.from-input').value = val + 1;
            }
        };
        row.querySelector('.remove-range-btn').onclick = () => { ranges.splice(idx, 1); renderRanges(); };
        rangeListContainer.appendChild(row);
    });
    lucide.createIcons();
}

function initSortable() {
    Sortable.create(fileListContainer, { animation: 150, handle: '.file-list-item',
        onEnd: () => { 
            const ids = Array.from(fileListContainer.querySelectorAll('.file-list-item')).map(el => el.dataset.id);
            selectedFiles = ids.map(id => selectedFiles.find(item => item.id === id));
        }
    });
}

compressBtn.onclick = async () => {
    processingOverlay.style.display = 'flex'; modeSelection.style.display = 'none'; compressedResults = [];
    for (let b = 0; b < selectedFiles.length; b++) {
        const file = selectedFiles[b].file;
        batchProgressText.textContent = `COMPRESSING (${b + 1}/${selectedFiles.length})`;
        const blob = await compressSinglePDF(file, (msg, prog) => { processingStatus.textContent = msg; progressBar.style.width = `${prog}%`; });
        let suffix = currentMode === 'extreme' ? '_SS' : currentMode === 'recommended' ? '_S' : '_N';
        compressedResults.push({ blob, name: file.name.replace(/\.[^/.]+$/, "") + suffix + ".pdf" });
    }
    showBatchResults();
};

mergeBtn.onclick = async () => {
    mergeAction.style.display = 'none'; processingOverlay.style.display = 'flex'; batchProgressText.textContent = 'MERGING PDFS...';
    try {
        const mergedPdf = await PDFDocument.create();
        for (let i = 0; i < selectedFiles.length; i++) {
            const pdf = await PDFDocument.load(await selectedFiles[i].file.arrayBuffer(), { ignoreEncryption: true });
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(p => mergedPdf.addPage(p));
            progressBar.style.width = `${((i+1) / selectedFiles.length) * 100}%`;
        }
        finalBlob = new Blob([await mergedPdf.save()], { type: 'application/pdf' });
        showSingleResult('MERGE COMPLETED!', 'Your merged file is ready', 'merged_document.pdf');
    } catch (err) { alert('Merge failed.'); resetToUpload(); }
};

splitBtn.onclick = async () => {
    splitAction.style.display = 'none'; processingOverlay.style.display = 'flex'; batchProgressText.textContent = 'SPLITTING PDF...';
    try {
        const file = selectedFiles[0].file;
        const pdfDoc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
        const total = pdfDoc.getPageCount();
        const results = [];
        if (splitType === 'pages') {
            for (let i = 0; i < total; i++) {
                const newDoc = await PDFDocument.create();
                const [p] = await newDoc.copyPages(pdfDoc, [i]);
                newDoc.addPage(p);
                results.push({ blob: new Blob([await newDoc.save()], { type: 'application/pdf' }), name: `page_${i+1}.pdf` });
                progressBar.style.width = `${(i+1)/total*100}%`;
            }
        } else {
            for (let i = 0; i < ranges.length; i++) {
                const r = ranges[i];
                const from = Math.max(1, r.from || 1);
                const to = Math.min(total, r.to || total);
                const idxs = []; for (let p = from - 1; p < to; p++) idxs.push(p);
                if (idxs.length === 0) continue;
                const rDoc = await PDFDocument.create();
                const pages = await rDoc.copyPages(pdfDoc, idxs);
                pages.forEach(pg => rDoc.addPage(pg));
                results.push({ blob: new Blob([await rDoc.save()], { type: 'application/pdf' }), name: `range_${i+1}.pdf` });
            }
        }
        if (results.length === 1) { finalBlob = results[0].blob; showSingleResult('SPLIT COMPLETED!', 'Fragment ready', results[0].name); }
        else { const zip = new JSZip(); results.forEach(res => zip.file(res.name, res.blob)); finalBlob = await zip.generateAsync({type:'blob'}); showSingleResult('SPLIT COMPLETED!', 'Files in ZIP', 'split.zip'); }
    } catch (err) { alert('Split failed.'); resetToUpload(); }
};

function showBatchResults() {
    processingOverlay.style.display = 'none'; resultDashboard.style.display = 'block'; fileListContainer.style.display = 'none';
    resultListContainer.style.display = 'block'; singleResult.style.display = 'none';
    resultBadge.textContent = 'COMPRESS COMPLETED!'; 
    if (compressedResults.length === 1) { finalBlob = compressedResults[0].blob; showSingleResult('COMPRESS COMPLETED!', 'Optimized ready', compressedResults[0].name); return; }
    downloadText.textContent = 'Download All (ZIP)'; resultListContainer.innerHTML = '';
    compressedResults.forEach(item => resultListContainer.appendChild(createResultCard(item.name, formatBytes(item.blob.size), item.blob)));
    lucide.createIcons();
}

function showSingleResult(badge, title, name) {
    processingOverlay.style.display = 'none'; resultDashboard.style.display = 'block'; fileListContainer.style.display = 'none';
    resultListContainer.style.display = 'none'; singleResult.style.display = 'block';
    resultBadge.textContent = badge; resultTitle.textContent = title; mergedName.textContent = name;
    mergedStats.textContent = formatBytes(finalBlob.size); downloadText.textContent = name.endsWith('.zip') ? 'Download ZIP' : 'Download PDF';
    lucide.createIcons();
}

function createResultCard(name, stats, blob) {
    const card = document.createElement('div'); card.className = 'result-list-item';
    card.innerHTML = `<div class="result-list-icon"><i data-lucide="check"></i></div><div class="result-list-info"><div class="result-list-name">${name}</div><div class="result-list-stats">${stats}</div></div><button class="individual-download-btn"><i data-lucide="download"></i></button>`;
    card.querySelector('button').onclick = () => downloadFile(blob, name);
    return card;
}

mainDownloadBtn.onclick = async () => {
    const isZip = finalBlob.type === 'application/zip';
    saveAsFile(finalBlob, 'processed_'+Date.now()+(isZip?'.zip':'.pdf'), finalBlob.type, isZip?'.zip':'.pdf');
};

async function saveAsFile(blob, suggestedName, mimeType, extension) {
    if ('showSaveFilePicker' in window) { try { const h = await window.showSaveFilePicker({ suggestedName, types: [{ accept: { [mimeType]: [extension] } }] }); const w = await h.createWritable(); await w.write(blob); await w.close(); } catch {} }
    else { downloadFile(blob, suggestedName); }
}

function downloadFile(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); }

resetBtn.onclick = () => resetToUpload();

function resetToUpload() {
    uploadSection.style.display = 'block'; statusArea.style.display = 'none'; resultDashboard.style.display = 'none';
    fileInput.value = ''; selectedFiles = []; compressedResults = []; finalBlob = null; ranges = [{ from: 1, to: 1 }];
    renderFileList();
}

const modeCards = document.querySelectorAll('.mode-card');
modeCards.forEach(card => card.addEventListener('click', () => { modeCards.forEach(c => c.classList.remove('selected')); card.classList.add('selected'); currentMode = card.dataset.mode; }));

async function compressSinglePDF(file, updateProgress) {
    const pdf = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const context = pdf.context; const items = [];
    for (const [ref, obj] of context.enumerateIndirectObjects()) { if (obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) items.push({ ref, obj }); }
    const q = currentMode === 'extreme' ? 0.3 : currentMode === 'recommended' ? 0.6 : 0.85;
    const s = currentMode === 'extreme' ? 0.4 : currentMode === 'recommended' ? 0.6 : 0.9;
    for (let i = 0; i < items.length; i++) {
        updateProgress(`Processing images (${i+1}/${items.length})`, 10 + (i / items.length * 80));
        const res = await compressImageStream(items[i].obj, q, s);
        if (res) {
            const d = items[i].obj.dict.clone(); d.set(PDFName.of('Width'), PDFNumber.of(res.width)); d.set(PDFName.of('Height'), PDFNumber.of(res.height));
            d.set(PDFName.of('Filter'), PDFName.of('DCTDecode')); d.delete(PDFName.of('DecodeParms')); d.delete(PDFName.of('SMask'));
            context.assign(items[i].ref, PDFRawStream.of(d, res.bytes));
        }
    }
    return new Blob([await pdf.save()], { type: 'application/pdf' });
}

async function compressImageStream(stream, quality, scale) {
    const w = stream.dict.get(PDFName.of('Width'))?.numberValue; if (!w || w < 10) return null;
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas'); const nw = Math.floor(w * scale), nh = Math.floor((stream.dict.get(PDFName.of('Height'))?.numberValue || 0) * scale);
            c.width = nw; c.height = nh; c.getContext('2d').drawImage(img, 0, 0, nw, nh);
            c.toBlob(b => b.arrayBuffer().then(buf => resolve({ bytes: new Uint8Array(buf), width: nw, height: nh })), 'image/jpeg', quality);
        };
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(new Blob([stream.contents]));
    });
}
function formatBytes(bytes, d = 2) { if (bytes === 0) return '0 Bytes'; const k = 1024, i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(d)) + ' ' + ['Bytes', 'KB', 'MB', 'GB', 'TB'][i]; }
