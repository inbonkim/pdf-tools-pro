import { PDFDocument, PDFRawStream, PDFName, PDFNumber } from 'pdf-lib';

// Initialize Lucide icons
lucide.createIcons();

// --- Elements ---
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
const resetText = document.getElementById('reset-text');

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

// --- Initialization ---
initSortable();

// --- Event Listeners ---
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
    ranges.push({ from: lastTo + 1, to: lastTo + 1 });
    renderRanges();
};

function updateUIForTab() {
    if (activeTab === 'compress') {
        mainTitle.textContent = 'PDF Shrink';
        mainSubtitle.textContent = 'Secure & Efficient Batch PDF Compression';
        dropIcon.setAttribute('data-lucide', 'files');
        dropText.textContent = 'Drag & drop up to 10 PDF files here';
        mergeHint.style.display = 'none';
    } else if (activeTab === 'merge') {
        mainTitle.textContent = 'PDF Merge';
        mainSubtitle.textContent = 'Combine multiple PDF files easily and safely';
        dropIcon.setAttribute('data-lucide', 'layers');
        dropText.textContent = 'Drag & drop PDF files to combine';
        mergeHint.style.display = 'flex';
    } else {
        mainTitle.textContent = 'PDF Split';
        mainSubtitle.textContent = 'Split pages or extract specific ranges from PDF';
        dropIcon.setAttribute('data-lucide', 'scissors');
        dropText.textContent = 'Drag & drop a PDF file to split';
        mergeHint.style.display = 'none';
    }
    lucide.createIcons();
}

dropZone.onclick = () => fileInput.click();
[addMoreBtn, addMoreMergeBtn].forEach(b => b.onclick = () => fileInput.click());

dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('active'); };
dropZone.ondragleave = () => dropZone.classList.remove('active');
dropZone.ondrop = (e) => { e.preventDefault(); dropZone.classList.remove('active'); handleFiles(e.dataTransfer.files); };
fileInput.onchange = (e) => handleFiles(e.target.files);

async function handleFiles(files) {
    const newFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    if (activeTab === 'split' && (selectedFiles.length + newFiles.length > 1)) {
        alert('Split supports only one file at a time.'); return;
    }
    for (const file of newFiles) {
        if (selectedFiles.length >= 10) { alert('Maximum 10 files allowed.'); break; }
        selectedFiles.push({ file, id: Math.random().toString(36).substr(2, 9) });
    }
    if (selectedFiles.length > 0) {
        uploadSection.style.display = 'none';
        statusArea.style.display = 'block';
        modeSelection.style.display = activeTab === 'compress' ? 'block' : 'none';
        mergeAction.style.display = activeTab === 'merge' ? 'block' : 'none';
        splitAction.style.display = activeTab === 'split' ? 'block' : 'none';
        resultDashboard.style.display = 'none';
        fileListContainer.style.display = 'block';
        
        if (activeTab === 'split') {
            const pdf = await PDFDocument.load(await selectedFiles[0].file.arrayBuffer());
            const count = pdf.getPageCount();
            ranges = [{ from: 1, to: count }];
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
                <div class="drag-handle" style="display: ${activeTab === 'merge' ? 'block' : 'none'}"><i data-lucide="grip-vertical"></i></div>
                <i data-lucide="file-text" style="color: var(--primary);"></i>
                <span class="file-list-name">${item.file.name}</span>
                <span class="file-list-size">${formatBytes(item.file.size)}</span>
            </div>
            <button class="cancel-item-btn" data-id="${item.id}"><i data-lucide="x-circle"></i></button>`;
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
            <span style="color: var(--text-muted);">to</span>
            <input type="number" class="range-field to-input" value="${range.to}" min="1">
            <button class="btn-icon-only remove-range-btn" style="display: ${ranges.length > 1 ? 'block' : 'none'}">
                <i data-lucide="trash-2" size="18"></i>
            </button>
        `;
        row.querySelector('.from-input').onchange = (e) => ranges[idx].from = parseInt(e.target.value);
        row.querySelector('.to-input').onchange = (e) => ranges[idx].to = parseInt(e.target.value);
        row.querySelector('.remove-range-btn').onclick = () => { ranges.splice(idx, 1); renderRanges(); };
        rangeListContainer.appendChild(row);
    });
    lucide.createIcons();
}

function initSortable() {
    Sortable.create(fileListContainer, { animation: 150, handle: '.drag-handle', ghostClass: 'sortable-ghost',
        onEnd: () => { selectedFiles = sortable.toArray().map(id => selectedFiles.find(item => item.id === id)); }
    });
}

// Logic: Compress
compressBtn.onclick = async () => {
    processingOverlay.style.display = 'flex'; modeSelection.style.display = 'none'; compressedResults = [];
    for (let b = 0; b < selectedFiles.length; b++) {
        const file = selectedFiles[b].file;
        batchProgressText.textContent = `Batch Compressing (${b + 1}/${selectedFiles.length})`;
        const blob = await compressSinglePDF(file, (msg, prog) => { processingStatus.textContent = msg; progressBar.style.width = `${prog}%`; });
        let suffix = currentMode === 'extreme' ? '_SS' : currentMode === 'recommended' ? '_S' : '_N';
        compressedResults.push({ blob, name: file.name.replace(/\.[^/.]+$/, "") + suffix + ".pdf", originalSize: file.size });
    }
    showBatchResults();
};

// Logic: Merge
mergeBtn.onclick = async () => {
    mergeAction.style.display = 'none'; processingOverlay.style.display = 'flex'; batchProgressText.textContent = 'Merging PDFs...';
    try {
        const mergedPdf = await PDFDocument.create();
        for (let i = 0; i < selectedFiles.length; i++) {
            const pdf = await PDFDocument.load(await selectedFiles[i].file.arrayBuffer());
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(p => mergedPdf.addPage(p));
            progressBar.style.width = `${((i+1) / selectedFiles.length) * 100}%`;
        }
        finalBlob = new Blob([await mergedPdf.save()], { type: 'application/pdf' });
        showSingleResult('Merge Completed!', 'Your merged file is ready', 'merged_document.pdf');
    } catch (err) { alert('Merge error'); resetToUpload(); }
};

// Logic: Split
splitBtn.onclick = async () => {
    splitAction.style.display = 'none'; processingOverlay.style.display = 'flex'; batchProgressText.textContent = 'Splitting PDF...';
    try {
        const file = selectedFiles[0].file;
        const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
        const totalPages = pdfDoc.getPageCount();
        const zip = new JSZip();
        
        if (splitType === 'pages') {
            for (let i = 0; i < totalPages; i++) {
                processingStatus.textContent = `Extracting page (${i+1}/${totalPages})`;
                progressBar.style.width = `${(i / totalPages) * 100}%`;
                const newDoc = await PDFDocument.create();
                const [p] = await newDoc.copyPages(pdfDoc, [i]); newDoc.addPage(p);
                zip.file(`page_${i+1}.pdf`, await newDoc.save());
            }
        } else {
            for (let i = 0; i < ranges.length; i++) {
                const r = ranges[i];
                const from = Math.max(0, (r.from || 1) - 1);
                const to = Math.min(totalPages - 1, (r.to || 1) - 1);
                const pageIndices = []; for (let p = from; p <= to; p++) pageIndices.push(p);
                
                const rangeDoc = await PDFDocument.create();
                const pages = await rangeDoc.copyPages(pdfDoc, pageIndices);
                pages.forEach(pg => rangeDoc.addPage(pg));
                zip.file(`range_${i+1}_${r.from}-${r.to}.pdf`, await rangeDoc.save());
                progressBar.style.width = `${((i + 1) / ranges.length) * 100}%`;
            }
        }
        finalBlob = await zip.generateAsync({ type: 'blob' });
        showSingleResult('Split Completed!', 'Split pages are ready in a ZIP archive', 'split_package.zip');
    } catch (err) { alert('Split failed! Please check ranges.'); resetToUpload(); }
};

function showBatchResults() {
    processingOverlay.style.display = 'none'; resultDashboard.style.display = 'block'; fileListContainer.style.display = 'none';
    resultListContainer.style.display = 'block'; singleResult.style.display = 'none';
    resultBadge.textContent = 'Compression Done!'; downloadText.textContent = 'Download All (ZIP)';
    resultListContainer.innerHTML = '';
    compressedResults.forEach(item => {
        const card = createResultCard(item.name, `${formatBytes(item.blob.size)}`, item.blob);
        resultListContainer.appendChild(card);
    });
    lucide.createIcons();
}

function showSingleResult(badge, title, name) {
    processingOverlay.style.display = 'none'; resultDashboard.style.display = 'block'; fileListContainer.style.display = 'none';
    resultListContainer.style.display = 'none'; singleResult.style.display = 'block';
    resultBadge.textContent = badge; resultTitle.textContent = title; mergedName.textContent = name;
    mergedStats.textContent = formatBytes(finalBlob.size); downloadText.textContent = 'Download Now';
    lucide.createIcons();
}

function createResultCard(name, stats, blob) {
    const card = document.createElement('div');
    card.className = 'result-list-item';
    card.innerHTML = `<div class="result-list-icon"><i data-lucide="check"></i></div>
        <div class="result-list-info"><span class="result-list-name">${name}</span><span class="result-list-stats">${stats}</span></div>
        <button class="individual-download-btn"><i data-lucide="download"></i></button>`;
    card.querySelector('button').onclick = () => downloadFile(blob, name);
    return card;
}

mainDownloadBtn.onclick = async () => {
    if (activeTab === 'compress') {
        const zip = new JSZip();
        compressedResults.forEach(item => zip.file(item.name, item.blob));
        saveAsFile(await zip.generateAsync({type:'blob'}), `shrunk_${Date.now()}.zip`, 'application/zip', '.zip');
    } else {
        const isZip = (activeTab === 'split');
        const ext = isZip ? '.zip' : '.pdf';
        const mime = isZip ? 'application/zip' : 'application/pdf';
        saveAsFile(finalBlob, (activeTab==='split'?'split_':'merged_')+Date.now()+ext, mime, ext);
    }
};

async function saveAsFile(blob, suggestedName, mimeType, extension) {
    if ('showSaveFilePicker' in window) {
        try {
            const h = await window.showSaveFilePicker({ suggestedName, types: [{ accept: { [mimeType]: [extension] } }] });
            const w = await h.createWritable(); await w.write(blob); await w.close();
        } catch {}
    } else { downloadFile(blob, suggestedName); }
}

function downloadFile(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

resetBtn.addEventListener('click', () => resetToUpload());

function resetToUpload() {
    uploadSection.style.display = 'block'; statusArea.style.display = 'none'; resultDashboard.style.display = 'none';
    fileInput.value = ''; selectedFiles = []; compressedResults = []; finalBlob = null;
    renderFileList();
}

const modeCards = document.querySelectorAll('.mode-card');
modeCards.forEach(card => card.addEventListener('click', () => {
    modeCards.forEach(c => c.classList.remove('selected')); card.classList.add('selected'); currentMode = card.dataset.mode;
}));

async function compressSinglePDF(file, updateProgress) {
    const pdf = await PDFDocument.load(await file.arrayBuffer());
    const context = pdf.context;
    const items = [];
    for (const [ref, obj] of context.enumerateIndirectObjects()) {
        if (obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) items.push({ ref, obj });
    }
    const q = currentMode === 'extreme' ? 0.3 : currentMode === 'recommended' ? 0.6 : 0.85;
    const s = currentMode === 'extreme' ? 0.4 : currentMode === 'recommended' ? 0.6 : 0.9;
    for (let i = 0; i < items.length; i++) {
        updateProgress(`Processing images (${i+1}/${items.length})`, 10 + (i / items.length * 80));
        const res = await compressImageStream(items[i].obj, q, s);
        if (res) {
            const d = items[i].obj.dict.clone();
            d.set(PDFName.of('Width'), PDFNumber.of(res.width)); d.set(PDFName.of('Height'), PDFNumber.of(res.height));
            d.set(PDFName.of('Filter'), PDFName.of('DCTDecode')); d.delete(PDFName.of('DecodeParms')); d.delete(PDFName.of('SMask'));
            context.assign(items[i].ref, PDFRawStream.of(d, res.bytes));
        }
    }
    return new Blob([await pdf.save({ useObjectStreams: true, addDefaultPage: false })], { type: 'application/pdf' });
}

async function compressImageStream(stream, quality, scale) {
    const w = stream.dict.get(PDFName.of('Width'))?.numberValue;
    if (!w || w < 10) return null;
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            const nw = Math.floor(w * scale), nh = Math.floor((stream.dict.get(PDFName.of('Height'))?.numberValue || 0) * scale);
            c.width = nw; c.height = nh;
            c.getContext('2d').drawImage(img, 0, 0, nw, nh);
            c.toBlob(b => b.arrayBuffer().then(buf => resolve({ bytes: new Uint8Array(buf), width: nw, height: nh })), 'image/jpeg', quality);
        };
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(new Blob([stream.contents]));
    });
}

function formatBytes(bytes, d = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(d)) + ' ' + ['Bytes', 'KB', 'MB', 'GB', 'TB'][i];
}
