 // ── ESTADO ──────────────────────────────────────────────
const expiryOptions = ['Sin expiración', '1 hora', '1 día', '7 días'];
let expiryIndex = 0;
let pwdVisible = false;

  // ── EDITOR PLACEHOLDER ──────────────────────────────────
const editor = document.getElementById('editor');

editor.addEventListener('input', () => {
    updateCharCount();
    // Placeholder via CSS si está vacío
    if (editor.innerText.trim() === '') {
    editor.innerHTML = '';
    }
});

editor.addEventListener('focus', () => editor.classList.add('focused'));
editor.addEventListener('blur',  () => editor.classList.remove('focused'));

  // Placeholder CSS
const style = document.createElement('style');
style.textContent = `
    #editor:empty::before {
    content: attr(data-placeholder);
    color: #B0B8C4;
    pointer-events: none;
    }
`;
document.head.appendChild(style);

function updateCharCount() {
    const len = editor.innerText.length;
    document.getElementById('charInfo').textContent = `${len} caracter${len !== 1 ? 'es' : ''}`;
}

  // ── FORMATO ─────────────────────────────────────────────
function fmt(command) {
    editor.focus();
    document.execCommand(command, false, null);
    updateFormatButtons();
}

function updateFormatButtons() {
    document.getElementById('btnBold').classList.toggle('active',      document.queryCommandState('bold'));
    document.getElementById('btnItalic').classList.toggle('active',    document.queryCommandState('italic'));
    document.getElementById('btnUnderline').classList.toggle('active', document.queryCommandState('underline'));
}

editor.addEventListener('keyup',   updateFormatButtons);
editor.addEventListener('mouseup', updateFormatButtons);

  // ── CONTRASEÑA ───────────────────────────────────────────
function togglePwd() {
    pwdVisible = !pwdVisible;
    document.getElementById('pillPwd').classList.toggle('active', pwdVisible);
    document.getElementById('pwdRow').classList.toggle('show', pwdVisible);
    if (pwdVisible) document.getElementById('pwdInput').focus();
}

  // ── EXPIRACIÓN ───────────────────────────────────────────
function cycleExpiry() {
    expiryIndex = (expiryIndex + 1) % expiryOptions.length;
    const label = expiryOptions[expiryIndex];
    document.getElementById('pillExpText').textContent = label;
    document.getElementById('pillExp').classList.toggle('active', expiryIndex !== 0);
}

  // ── GUARDAR PASTE ────────────────────────────────────────
function guardarPaste() {
    const content = editor.innerText.trim();
    if (!content) {
    showToast('Escribe algo primero');
    return;
    }

    // Por ahora: copiar al portapapeles y mostrar URL de demo
    navigator.clipboard.writeText(content).then(() => {
    const fakeId  = Math.random().toString(36).substring(2, 9);
    const fakeUrl = `http://sapaste.local/p/${fakeId}`;

    document.getElementById('resultUrl').textContent = fakeUrl;
    document.getElementById('resultBox').classList.add('show');
    showToast('Copiado al clipboard');
    });
}

  // ── COPIAR URL ───────────────────────────────────────────
function copyUrl() {
    const url = document.getElementById('resultUrl').textContent;
    navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = '✓ Copiado';
    btn.classList.add('copied');
    setTimeout(() => {
        btn.textContent = 'Copiar';
        btn.classList.remove('copied');
    }, 2000);
    });
}

  // ── LIMPIAR ──────────────────────────────────────────────
function clearEditor() {
    editor.innerHTML = '';
    document.getElementById('resultBox').classList.remove('show');
    document.getElementById('charInfo').textContent = '0 caracteres';
    editor.focus();
}

  // ── TOAST ────────────────────────────────────────────────
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

  // ── ESTADO CONEXIÓN (placeholder) ───────────────────────
  // Cuando conectes la API real, cambia esto según la respuesta del health check
function setStatus(online) {
    ['statusDot', 'statusDot2'].forEach(id => {
    document.getElementById(id).className = `status-dot${online ? '' : ' off'}`;
    });
    const txt = online ? 'Conectado' : 'Sin conexión';
    document.getElementById('statusText').textContent  = txt;
    document.getElementById('statusText2').textContent = txt;
}

  setStatus(true); // cambiar a false cuando no haya backend