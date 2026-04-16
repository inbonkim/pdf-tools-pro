import { createClient } from '@supabase/supabase-js';
import { PDFDocument, PDFRawStream, PDFName, PDFNumber } from 'pdf-lib';

// --- Supabase 설정 ---
const SUPABASE_URL = 'https://zfsagsxkkudvyvormmqf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0mz9Ac3I7X3TVv2PSYLRSQ_EqFh2rIM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 환경 설정 ---
const PDF_PRO_CONFIG = {
    LIMITS: {
        GUEST: 50 * 1024 * 1024,
        MEMBER: 100 * 1024 * 1024,
        VERIFIED: Infinity
    }
};

let currentUser = null;
let currentProfile = null;

lucide.createIcons();

// --- Elements ---
const authContainer = document.getElementById('auth-container');
const authModal = document.getElementById('auth-modal');
const closeAuthModal = document.getElementById('close-auth-modal');
const modalTabBtns = document.querySelectorAll('.modal-tab-btn');
const loginFormSide = document.getElementById('login-form-side');
const signupFormSide = document.getElementById('signup-form-side');
const navBtns = document.querySelectorAll('.nav-btn');
const navAdminBtn = document.getElementById('nav-admin-btn');
const adminAction = document.getElementById('admin-action');
const adminUserList = document.getElementById('admin-user-list');
const refreshUsersBtn = document.getElementById('refresh-users-btn');
const mainTitle = document.getElementById('main-title');
const mainSubtitle = document.getElementById('main-subtitle');
const dropIcon = document.getElementById('drop-icon');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const statusArea = document.getElementById('status-area');
const uploadSection = document.getElementById('upload-section');
const fileListContainer = document.getElementById('file-list');
const modeSelection = document.getElementById('mode-selection');
const mergeAction = document.getElementById('merge-action');
const splitAction = document.getElementById('split-action');
const processingOverlay = document.getElementById('processing-overlay');
const processingStatus = document.getElementById('processing-status');
const progressBar = document.getElementById('progress-bar');
const batchProgressText = document.getElementById('batch-progress-text');
const resultDashboard = document.getElementById('result-dashboard');
const resultListContainer = document.getElementById('result-list');
const singleResult = document.getElementById('single-result');
const resultBadge = document.getElementById('result-badge');
const resultTitle = document.getElementById('result-title');
const compressBtn = document.getElementById('compress-btn');
const mergeBtn = document.getElementById('merge-btn');
const splitBtn = document.getElementById('split-btn');
const mainDownloadBtn = document.getElementById('main-download-btn');
const downloadText = document.getElementById('download-text');
const resetBtn = document.getElementById('reset-btn-v2');

const splitTabBtns = document.querySelectorAll('.split-tab-btn');
const splitRangeSection = document.getElementById('split-range-section');
const splitPagesSection = document.getElementById('split-pages-section');
const rangeListContainer = document.getElementById('range-list-container');
const addRangeBtn = document.getElementById('add-range-btn');

const debugOverlay = document.getElementById('debug-log-overlay');
const debugContent = document.getElementById('debug-log-content');

let activeTab = 'compress'; 
let splitType = 'range'; 
let selectedFiles = []; 
let compressedResults = []; 
let finalBlob = null;
let currentMode = 'recommended';
let ranges = [{ from: 1, to: 1 }];
let totalPagesInCurrentSplit = 0;

// --- Debug Helper ---
function logDebug(msg, color = "#00ff00") {
    console.log(`[DEBUG] ${msg}`);
    if (debugOverlay && debugContent) {
        debugOverlay.style.display = 'block';
        const logLine = document.createElement('div');
        logLine.style.color = color;
        logLine.textContent = `> ${msg}`;
        debugContent.appendChild(logLine);
        debugOverlay.scrollTop = debugOverlay.scrollHeight;
    }
}

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

let isUpdatingAuth = false;

// --- Auth Handling ---
async function updateAuthUI() {
    if (isUpdatingAuth) return;
    isUpdatingAuth = true;
    
    try {
        logDebug("Syncing Session...");
        const { data: { session }, error: sErr } = await supabase.auth.getSession();
        if (sErr) throw sErr;
        
        currentUser = session?.user || null;
        
        if (currentUser) {
            logDebug(`Session OK: ${currentUser.email}`);
            // Lazy load profile
            supabase.from('pdf_user_profiles').select('*').eq('id', currentUser.id).single()
                .then(({ data: profile }) => {
                    if (profile) {
                        currentProfile = profile;
                        logDebug(`Profile: ${profile.level}`);
                        if (profile.is_admin) navAdminBtn.style.display = 'flex';
                    }
                }).catch(() => {});

            const userName = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
            authContainer.innerHTML = `<div class="user-profile"><span class="user-email">${userName}</span><span class="logout-link" id="logout-btn">Logout</span></div>`;
            const logOutBtn = document.getElementById('logout-btn');
            if (logOutBtn) logOutBtn.onclick = async () => { await supabase.auth.signOut(); window.location.reload(); };
        } else {
            logDebug("Guest Session.");
            authContainer.innerHTML = `<button id="login-trigger-btn" class="auth-btn">Login / Sign Up</button>`;
            navAdminBtn.style.display = 'none';
        }
    } catch (err) {
        logDebug(`Sync Error: ${err.message}`, "#f87171");
    } finally {
        isUpdatingAuth = false;
    }
}

authContainer.addEventListener('click', (e) => {
    if (e.target.id === 'login-trigger-btn') openModal();
});

// Logic: Register
document.getElementById('do-signup-btn').onclick = async (e) => {
    const btn = e.currentTarget;
    const email = document.getElementById('signup-email').value;
    const name = document.getElementById('signup-name').value;
    const country = document.getElementById('signup-country').value;
    const password = document.getElementById('signup-password').value;
    if (!email || !name || !country || !password) return;
    
    btn.disabled = true;
    btn.textContent = "Working...";
    logDebug(`Signing up: ${email}`);

    const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { full_name: name, country: country } }
    });
    
    if (error) {
        logDebug(`Signup Fail: ${error.message}`, "#f87171");
        alert(error.message);
        btn.disabled = false; btn.textContent = "Register Now";
    } else {
        logDebug("Signup Success!");
        alert('Welcome!'); closeModal(); await updateAuthUI();
    }
};

// Logic: Login with Timeout
document.getElementById('do-login-btn').onclick = async (e) => {
    const btn = e.currentTarget;
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    if (!email || !password) return;
    
    btn.disabled = true;
    btn.textContent = "Verifying...";
    logDebug(`Checking: ${email}`);

    // Set a race between login and a 12s timeout
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Request Timeout")), 12000));
    
    try {
        const { data, error } = await Promise.race([
            supabase.auth.signInWithPassword({ email, password }),
            timeoutPromise
        ]);
        
        if (error) {
            logDebug(`Invalid: ${error.message}`, "#f87171");
            alert(error.message);
            btn.disabled = false; btn.textContent = "Log In";
        } else {
            logDebug("Login OK!");
            closeModal();
            await updateAuthUI();
        }
    } catch (err) {
        logDebug(`Error: ${err.message}`, "#f87171");
        alert(err.message === "Request Timeout" ? "Server took too long to respond. Try again." : err.message);
        btn.disabled = false; btn.textContent = "Log In";
    }
};

supabase.auth.onAuthStateChange(() => updateAuthUI());
updateAuthUI();

// Admin / App Logic ...
async function fetchAdminUsers() {
    adminUserList.innerHTML = '<tr><td colspan="4" style="text-align:center">Loading...</td></tr>';
    const { data, error } = await supabase.from('pdf_user_profiles').select('*').order('created_at', { ascending: false });
    if (error) return;
    adminUserList.innerHTML = '';
    data?.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${user.email}</td><td><span class="badge-level level-${user.level}">${user.level}</span></td><td>${user.country || '-'}</td><td><select class="level-selector" data-id="${user.id}"><option value="MEMBER" ${user.level==='MEMBER'?'selected':''}>Member</option><option value="VERIFIED" ${user.level==='VERIFIED'?'selected':''}>Verified</option></select></td>`;
        tr.querySelector('.level-selector').onchange = async (e) => {
            await supabase.from('pdf_user_profiles').update({ level: e.target.value }).eq('id', user.id);
            fetchAdminUsers();
        };
        adminUserList.appendChild(tr);
    });
}
refreshUsersBtn.onclick = fetchAdminUsers;

navBtns.forEach(btn => {
    btn.onclick = () => {
        if (selectedFiles.length > 0 && !confirm('Discard?')) return;
        navBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active');
        activeTab = btn.dataset.tab; updateUIForTab(); resetToUpload();
        if (activeTab === 'admin') fetchAdminUsers();
    };
});

function updateUIForTab() {
    [modeSelection, mergeAction, splitAction, adminAction].forEach(el => el.style.display = 'none');
    if (activeTab === 'compress') { mainTitle.textContent = 'PDF Shrink'; dropIcon.setAttribute('data-lucide', 'shrink'); } 
    else if (activeTab === 'merge') { mainTitle.textContent = 'PDF Merge'; dropIcon.setAttribute('data-lucide', 'layers'); } 
    else if (activeTab === 'split') { mainTitle.textContent = 'PDF Split'; dropIcon.setAttribute('data-lucide', 'scissors'); } 
    else if (activeTab === 'admin') { mainTitle.textContent = 'Admin Board'; adminAction.style.display = 'block'; uploadSection.style.display = 'none'; statusArea.style.display = 'block'; }
    lucide.createIcons();
}

function getUserLevel() { if (!currentUser) return 'GUEST'; return currentProfile?.level || 'MEMBER'; }
function formatBytes(b,d=2){if(b===0) return '0 Bytes'; const k=1024,i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(d))+' '+['B','KB','MB','GB','TB'][i];}

dropZone.onclick = (e) => { if (e.target.id !== 'file-input') { fileInput.value = ''; fileInput.click(); } };
async function handleFiles(files) {
    const level = getUserLevel(); const currentLimit = PDF_PRO_CONFIG.LIMITS[level];
    const newFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    if (activeTab === 'split' && (selectedFiles.length + newFiles.length > 1)) return;
    for (const file of newFiles) {
        if (selectedFiles.length >= 10) break;
        if (file.size > currentLimit) { alert(`Exceeds limit`); continue; }
        selectedFiles.push({ file, id: Math.random().toString(36).substr(2, 9) });
    }
    if (selectedFiles.length > 0) {
        uploadSection.style.display = 'none'; statusArea.style.display = 'block';
        if (activeTab === 'compress') modeSelection.style.display = 'block';
        if (activeTab === 'merge') mergeAction.style.display = 'block';
        if (activeTab === 'split') {
            splitAction.style.display = 'block';
            const pdf = await PDFDocument.load(await selectedFiles[0].file.arrayBuffer(), { ignoreEncryption: true });
            totalPagesInCurrentSplit = pdf.getPageCount(); ranges = [{ from: 1, to: totalPagesInCurrentSplit }];
            renderRanges();
        }
        renderFileList();
    }
}

function renderFileList() {
    fileListContainer.innerHTML = '';
    selectedFiles.forEach(item => {
        const row = document.createElement('div'); row.className = 'file-list-item'; row.dataset.id = item.id;
        row.innerHTML = `<div class="file-list-info"><i data-lucide="file-text" style="color:var(--primary);"></i><div style="flex:1"><div class="file-list-name">${item.file.name}</div><div class="file-list-size">${formatBytes(item.file.size)}</div></div></div><button class="cancel-item-btn" data-id="${item.id}"><i data-lucide="x" size="16"></i></button>`;
        fileListContainer.appendChild(row);
    });
    document.querySelectorAll('.cancel-item-btn').forEach(btn => btn.onclick = () => { selectedFiles = selectedFiles.filter(i => i.id !== btn.dataset.id); if (selectedFiles.length === 0) resetToUpload(); else renderFileList(); });
    lucide.createIcons();
}
function renderRanges() {
    rangeListContainer.innerHTML = '';
    ranges.forEach((range, idx) => {
        const row = document.createElement('div'); row.className = 'range-input-row';
        row.innerHTML = `<span class="range-label">Range ${idx + 1}</span><input type="number" class="range-field from-input" value="${range.from}"><span style="color:var(--text-muted)">to</span><input type="number" class="range-field to-input" value="${range.to}"><button class="remove-range-btn" style="display:${ranges.length>1?'flex':'none'}"><i data-lucide="trash-2"></i></button>`;
        row.querySelector('.from-input').oninput = (e) => ranges[idx].from = parseInt(e.target.value) || 1;
        row.querySelector('.to-input').oninput = (e) => {
            const val = parseInt(e.target.value) || 1; ranges[idx].to = val;
            if (idx + 1 < ranges.length) { ranges[idx + 1].from = val + 1; renderRanges(); }
        };
        row.querySelector('.remove-range-btn').onclick = () => { ranges.splice(idx, 1); renderRanges(); };
        rangeListContainer.appendChild(row);
    });
    lucide.createIcons();
}
function initSortable() { Sortable.create(fileListContainer, { animation: 150, handle: '.file-list-item', onEnd: () => { const ids = Array.from(fileListContainer.querySelectorAll('.file-list-item')).map(el => el.dataset.id); selectedFiles = ids.map(id => selectedFiles.find(item => item.id === id)); } }); }
compressBtn.onclick = async () => { processingOverlay.style.display = 'flex'; modeSelection.style.display = 'none'; compressedResults = []; for (let b = 0; b < selectedFiles.length; b++) { const blob = await compressSinglePDF(selectedFiles[b].file, (msg, prog) => { processingStatus.textContent = msg; progressBar.style.width = `${prog}%`; }); compressedResults.push({ blob, name: selectedFiles[b].file.name.replace(/\.[^/.]+$/, "")+"_S.pdf" }); } showBatchResults(); };
mergeBtn.onclick = async () => { mergeAction.style.display='none'; processingOverlay.style.display='flex'; try { const m = await PDFDocument.create(); for (let i=0; i<selectedFiles.length; i++) { const p = await PDFDocument.load(await selectedFiles[i].file.arrayBuffer(),{ignoreEncryption:true}); const pg = await m.copyPages(p, p.getPageIndices()); pg.forEach(x => m.addPage(x)); } finalBlob = new Blob([await m.save()], {type:'application/pdf'}); showSingleResult('MERGE COMPLETED!', 'Ready', 'merged.pdf'); } catch(e) {alert('Error'); resetToUpload(); } };
splitBtn.onclick = async () => { splitAction.style.display='none'; processingOverlay.style.display='flex'; try { const pDoc = await PDFDocument.load(await selectedFiles[0].file.arrayBuffer(), {ignoreEncryption:true}); const tot = pDoc.getPageCount(); const res = []; if (splitType==='pages') { for(let i=0; i<tot; i++) { const d = await PDFDocument.create(); const [pg] = await d.copyPages(pDoc, [i]); d.addPage(pg); res.push({blob: new Blob([await d.save()], {type:'application/pdf'}), name:`page_${i+1}.pdf`}); } } else { for(let i=0; i<ranges.length; i++) { const r = ranges[i]; const ids = []; for(let p=r.from-1; p<r.to; p++) if(p<tot) ids.push(p); if(ids.length===0) continue; const d = await PDFDocument.create(); const pgs = await d.copyPages(pDoc, ids); pgs.forEach(x => d.addPage(x)); res.push({blob: new Blob([await d.save()], {type:'application/pdf'}), name:`range_${i+1}.pdf`}); } } if(res.length===1) { finalBlob=res[0].blob; showSingleResult('SPLIT!','Ready',res[0].name); } else { const z = new JSZip(); res.forEach(x => z.file(x.name, x.blob)); finalBlob=await z.generateAsync({type:'blob'}); showSingleResult('SPLIT!','ZIP Ready','split.zip'); } } catch(e) {alert('Error'); resetToUpload();} };
function showBatchResults() { processingOverlay.style.display='none'; resultDashboard.style.display='block'; fileListContainer.style.display='none'; resultListContainer.style.display='block'; singleResult.style.display='none'; if(compressedResults.length===1) { finalBlob=compressedResults[0].blob; showSingleResult('DONE','Ready',compressedResults[0].name); return; } resultListContainer.innerHTML = ''; compressedResults.forEach(i => resultListContainer.appendChild(createResultCard(i.name, formatBytes(i.blob.size), i.blob))); lucide.createIcons(); }
function showSingleResult(b,t,n) { processingOverlay.style.display='none'; resultDashboard.style.display='block'; fileListContainer.style.display='none'; resultListContainer.style.display='none'; singleResult.style.display='block'; resultBadge.textContent=b; resultTitle.textContent=t; mergedName.textContent=n; mergedStats.textContent=formatBytes(finalBlob.size); downloadText.textContent=n.endsWith('.zip')?'Download ZIP':'Download PDF'; lucide.createIcons(); }
function createResultCard(n,s,b) { const c = document.createElement('div'); c.className='result-list-item'; c.innerHTML=`<div class="result-list-icon"><i data-lucide="check"></i></div><div class="result-list-info"><div>${n}</div><div>${s}</div></div><button class="individual-download-btn"><i data-lucide="download"></i></button>`; c.querySelector('button').onclick=()=>downloadFile(b,n); return c; }
mainDownloadBtn.onclick = () => saveAsFile(finalBlob, 'processed_'+Date.now()+'.pdf', finalBlob.type, '.pdf');
async function saveAsFile(b,n,m,e) { if('showSaveFilePicker'in window) { try { const h=await window.showSaveFilePicker({suggestedName:n}); const w=await h.createWritable(); await w.write(b); await w.close(); }catch(x){}} else downloadFile(b,n); }
function downloadFile(b,n) { const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=n; document.body.appendChild(a); a.click(); }
resetBtn.onclick = () => resetToUpload();
function resetToUpload() { uploadSection.style.display='block'; statusArea.style.display='none'; resultDashboard.style.display='none'; fileInput.value=''; selectedFiles=[]; compressedResults=[]; finalBlob=null; ranges=[{from:1,to:1}]; renderFileList(); }
const modeCards = document.querySelectorAll('.mode-card'); modeCards.forEach(c => c.onclick=() => { modeCards.forEach(x=>x.classList.remove('selected')); c.classList.add('selected'); currentMode=c.dataset.mode; });
async function compressSinglePDF(f,u) { const p = await PDFDocument.load(await f.arrayBuffer(),{ignoreEncryption:true}); const ctx = p.context; const items = []; for(const[r,o] of ctx.enumerateIndirectObjects()){if(o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype'))===PDFName.of('Image')) items.push({r,o});} const q=currentMode==='extreme'?0.3:0.6; const s=currentMode==='extreme'?0.4:0.7; for(let i=0; i<items.length; i++){u(`Images ${i+1}/${items.length}`, 10+(i/items.length*80)); const res=await compressImageStream(items[i].o,q,s); if(res){const d=items[i].o.dict.clone(); d.set(PDFName.of('Width'),PDFNumber.of(res.width)); d.set(PDFName.of('Height'),PDFNumber.of(res.height)); d.set(PDFName.of('Filter'),PDFName.of('DCTDecode')); d.delete(PDFName.of('DecodeParms')); ctx.assign(items[i].r, PDFRawStream.of(d, res.bytes));}} return new Blob([await p.save()], {type:'application/pdf'}); }
async function compressImageStream(s,q,sc) { const w=s.dict.get(PDFName.of('Width'))?.numberValue; if(!w||w<10) return null; return new Promise(res => { const img=new Image(); img.onload=()=>{const c=document.createElement('canvas'); const nw=Math.floor(w*sc),nh=Math.floor(s.dict.get(PDFName.of('Height')).numberValue*sc); c.width=nw; c.height=nh; c.getContext('2d').drawImage(img,0,0,nw,nh); c.toBlob(b=>b.arrayBuffer().then(buf=>res({bytes:new Uint8Array(buf),width:nw,height:nh})),'image/jpeg',q);}; img.src=URL.createObjectURL(new Blob([s.contents])); }); }
