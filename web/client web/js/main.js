// Configuración
const API_URL = "/api/pastes";
const REQUEST_TIMEOUT_MS = 8000;

let currentPasteId = null;
let isSaved = false;
let confirmCallback = null;
let visibilityMode = "publico";
let currentPassword = null;
let readOnly = false;

// Peticiones HTTP
async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

// Reloj
function startClock() {
    function updateClock() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, "0");
        const m = String(now.getMinutes()).padStart(2, "0");
        const s = String(now.getSeconds()).padStart(2, "0");
        document.getElementById("reloj").innerText = `${h}:${m}:${s}`;
        updateHistoryTimes();
    }
    updateClock();
    setInterval(updateClock, 1000);
}

// Estado guardado
function setSaveStatus(saved) {
    isSaved = saved;
    const badge = document.getElementById("estadoBadge");
    const text = document.getElementById("estadoTexto");

    if (saved) {
        badge.className = "estado-badge guardado";
        text.innerText = "Guardado";
    } else {
        badge.className = "estado-badge sin-guardar";
        text.innerText = "Sin guardar";
    }
}

// Url
function enableUrlButtons(url) {
    document.getElementById("btnCopiarUrl").disabled = false;
    document.getElementById("btnCompartir").disabled = false;

    const shareText = encodeURIComponent("Mira este clipboard: " + url);
    document.getElementById("shareWhatsapp").href = `https://wa.me/?text=${shareText}`;
    document.getElementById("shareGmail").href = `https://mail.google.com/mail/?view=cm&body=${shareText}`;
    document.getElementById("shareTelegram").href = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=Mira este clipboard`;
}

function copyUrl() {
    const urlText = document.getElementById("urlClipboard").innerText.replace("URL: ", "");
    navigator.clipboard.writeText(urlText).then(() => {
        const btn = document.getElementById("btnCopiarUrl");
        btn.innerText = "✓ Copiado";
        btn.classList.add("copiado");
        setTimeout(() => {
            btn.innerText = "Copiar";
            btn.classList.remove("copiado");
        }, 2000);
    });
}

function toggleShare() {
    document.getElementById("compartirDropdown").classList.toggle("abierto");
}

function nativeShare() {
    const urlText = document.getElementById("urlClipboard").innerText.replace("URL: ", "");
    if (navigator.share) {
        navigator.share({ title: "SApaste", text: "Mira este clipboard", url: urlText });
    } else {
        showToast("Tu navegador no soporta compartir nativo", "amarillo");
    }
    document.getElementById("compartirDropdown").classList.remove("abierto");
}

document.addEventListener("click", (e) => {
    const menu = document.getElementById("compartirDropdown");
    if (menu && !e.target.closest(".compartir-menu")) {
        menu.classList.remove("abierto");
    }
});

// Modales
function showModal(title, message, onConfirm) {
    document.getElementById("modalTitulo").innerText = title;
    document.getElementById("modalMensaje").innerText = message;
    document.getElementById("modal-confirmacion").classList.add("visible");
    confirmCallback = onConfirm;

    document.getElementById("btnConfirmar").onclick = () => {
        closeModal();
        onConfirm();
    };
}

function closeModal() {
    document.getElementById("modal-confirmacion").classList.remove("visible");
    confirmCallback = null;
}

function showPasswordModal(title, onConfirm) {
    document.getElementById("modalTitulo").innerText = title;
    document.getElementById("modalMensaje").innerText = "Introduce la contraseña del paste";

    const box = document.querySelector(".modal-box");
    let input = document.getElementById("modal-password-input");
    if (!input) {
        input = document.createElement("input");
        input.type = "password";
        input.id = "modal-password-input";
        input.placeholder = "Contraseña...";
        input.style.cssText = "width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color); background:var(--cuadro-bg); color:var(--texto-color); font-size:14px; margin-bottom:16px;";
        box.insertBefore(input, box.querySelector(".modal-botones"));
    }
    input.value = "";

    document.getElementById("modal-confirmacion").classList.add("visible");

    document.getElementById("btnConfirmar").onclick = () => {
        const pass = input.value.trim();
        if (!pass) {
            showToast("Introduce la contraseña", "amarillo");
            return;
        }
        closeModal();
        input.remove();
        onConfirm(pass);
    };
}

// Notificaciones
function showToast(message, type = "verde") {
    addToHistory(message, type);

    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }

    const icons = { verde: "✓", amarillo: "⚠", rojo: "✕" };

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icono">${icons[type]}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "toastSalida 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Spinner
function showSpinner() {
    document.getElementById("spinner-overlay").classList.add("visible");
}

function hideSpinner() {
    document.getElementById("spinner-overlay").classList.remove("visible");
}

// Editor
function applyStyle(command) {
    document.execCommand(command, false, null);
    document.getElementById("editor").focus();
}

function bold() { applyStyle("bold"); }
function italic() { applyStyle("italic"); }
function underline() { applyStyle("underline"); }
function execCmd(command) { applyStyle(command); }

// Tema
function toggleDarkMode() {
    const body = document.body;
    const btn = document.getElementById("btnDarkMode");
    body.classList.toggle("dark-mode");
    btn.innerText = body.classList.contains("dark-mode") ? "Modo Claro" : "Modo Oscuro";
}

// Guardar paste
async function saveContent() {
    const title = document.getElementById("tituloClipboard").value.trim();

    if (!title) {
        showToast("El título es obligatorio", "amarillo");
        document.getElementById("tituloClipboard").focus();
        return;
    }

    if (!document.getElementById("editor").innerText.trim()) {
        showToast("Escribe algo antes de guardar", "amarillo");
        return;
    }

    if (currentPasteId) {
        await performSave(visibilityMode, currentPassword);
        return;
    }

    openVisibilityModal();
}

function openVisibilityModal() {
    document.getElementById("modal-visibilidad").classList.add("visible");
}

function closeVisibilityModal() {
    document.getElementById("modal-visibilidad").classList.remove("visible");
    document.getElementById("vis-password-input").value = "";
    document.getElementById("vis-password-campo").style.display = "none";
    document.querySelector("input[name='visibilidad'][value='publico']").checked = true;
}

async function confirmSave() {
    const visibility = document.querySelector("input[name='visibilidad']:checked").value;
    const password = document.getElementById("vis-password-input").value.trim();

    if (visibility !== "publico" && !password) {
        showToast("Introduce una contraseña para este modo", "amarillo");
        document.getElementById("vis-password-input").focus();
        return;
    }

    closeVisibilityModal();
    visibilityMode = visibility;
    currentPassword = password || null;
    await performSave(visibility, currentPassword);
}

async function performSave(visibility, password) {
    const content = document.getElementById("editor").innerHTML.trim();
    const title = document.getElementById("tituloClipboard").value.trim();

    showSpinner();
    try {
        const endpoint = currentPasteId ? `${API_URL}/${currentPasteId}` : API_URL;
        const method = currentPasteId ? "PUT" : "POST";

        const res = await fetchWithTimeout(endpoint, {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(password && { "X-Paste-Password": password })
            },
            body: JSON.stringify({ content, title, visibilidad: visibility })
        });

        if (!res.ok) {
            const msg = currentPasteId ? "Contraseña incorrecta o error al guardar" : "Error al guardar el paste";
            showToast(msg, "rojo");
            return;
        }

        const data = await res.json();
        currentPasteId = data.id;

        const urlDiv = document.getElementById("urlClipboard");
        urlDiv.innerText = `URL: ${data.url}`;
        urlDiv.style.color = "var(--texto-color)";

        enableUrlButtons(data.url);
        setSaveStatus(true);
        showToast("Paste guardado correctamente", "verde");
    } catch (err) {
        console.error("Error guardando:", err);
        showToast("No se pudo conectar con la API", "rojo");
    } finally {
        hideSpinner();
    }
}

// Cargar paste
async function loadContent() {
    if (!currentPasteId) {
        showToast("No hay ningún paste activo", "amarillo");
        return;
    }

    showSpinner();
    try {
        const res = await fetchWithTimeout(`${API_URL}/${currentPasteId}`);

        if (!res.ok) {
            showToast("Paste no encontrado", "rojo");
            return;
        }

        const data = await res.json();
        document.getElementById("editor").innerHTML = DOMPurify.sanitize(data.contenido);
        document.getElementById("tituloClipboard").value = data.titulo || "";
        updateCounter();
        setSaveStatus(true);
        showToast("Paste cargado", "verde");
    } catch (err) {
        console.error("Error cargando:", err);
        showToast("No se pudo conectar con la API", "rojo");
    } finally {
        hideSpinner();
    }
}

// Eliminar paste
function deletePaste() {
    if (!currentPasteId) {
        showToast("No hay ningún paste activo", "amarillo");
        return;
    }

    if (visibilityMode !== "publico" && !currentPassword) {
        showPasswordModal("Contraseña para eliminar", async (pass) => {
            currentPassword = pass;
            confirmDelete();
        });
        return;
    }

    confirmDelete();
}

function confirmDelete() {
    showModal(
        "¿Eliminar este clipboard?",
        "Esta acción no se puede deshacer",
        async () => {
            showSpinner();
            try {
                const headers = { "Content-Type": "application/json" };
                if (currentPassword) headers["X-Paste-Password"] = currentPassword;

                const res = await fetchWithTimeout(`${API_URL}/${currentPasteId}`, {
                    method: "DELETE",
                    headers
                });

                if (res.ok) {
                    currentPasteId = null;
                    currentPassword = null;
                    visibilityMode = "publico";
                    readOnly = false;
                    document.getElementById("editor").innerHTML = "";
                    document.getElementById("tituloClipboard").value = "";
                    document.getElementById("urlClipboard").innerText = "URL: (aún no generada)";
                    document.getElementById("urlClipboard").style.color = "#888";
                    document.getElementById("btnCopiarUrl").disabled = true;
                    document.getElementById("btnCompartir").disabled = true;
                    updateCounter();
                    setSaveStatus(false);
                    showToast("Paste eliminado", "verde");
                } else if (res.status === 401) {
                    currentPassword = null;
                    showToast("Contraseña incorrecta", "rojo");
                } else {
                    showToast("No se pudo eliminar el paste", "rojo");
                }
            } catch (err) {
                console.error("Error eliminando:", err);
                showToast("No se pudo conectar con la API", "rojo");
            } finally {
                hideSpinner();
            }
        }
    );
}

// Acceso desde URL
async function loadFromUrl() {
    const path = window.location.pathname;
    if (!path.startsWith("/p/")) return;

    const id = path.split("/p/")[1];
    if (!id) return;

    currentPasteId = id;

    showSpinner();
    try {
        const res = await fetchWithTimeout(`${API_URL}/${id}`);

        if (!res.ok) {
            if (res.status === 401) {
                showLoginScreen(id, false);
                return;
            }
            document.getElementById("urlClipboard").innerText = "URL: Paste no encontrado o expirado";
            showToast("Paste no encontrado o expirado", "rojo");
            return;
        }

        const data = await res.json();
        visibilityMode = data.visibilidad;

        if (data.visibilidad === "invitados") {
            showLoginScreen(id, true);
            return;
        }

        loadDataIntoEditor(data);
    } catch (err) {
        console.error("Error cargando desde URL:", err);
        showToast("No se pudo conectar con la API", "rojo");
    } finally {
        hideSpinner();
    }
}

function showLoginScreen(id, withGuestOption = false) {
    hideSpinner();

    const guestButtonHtml = withGuestOption
        ? `<button type="button" id="btnGuestAccess" style="padding:10px 28px; background:var(--cuadro-bg); color:var(--texto-color); border:1px solid var(--border-color); border-radius:8px; font-size:15px; font-weight:700; cursor:pointer;">Entrar como invitado</button>`
        : "";

    const overlay = document.createElement("div");
    overlay.id = "modal-login";
    overlay.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.4);
        z-index: 9000;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(3px);
    `;

    overlay.innerHTML = `
        <div class="modal-box" style="max-width: 600px; width: 90%;">
            <div style="font-size: 36px; margin-bottom: 12px;">
                <img src="../img/icons/light/login-lock.png" alt="Login lock" class="icono-claro" width="30px">
                <img src="../img/icons/dark/login-lock.png" alt="Login lock" class="icono-oscuro" width="30px">
            </div>
            <h3 style="margin: 0 0 8px;">Paste protegido</h3>
            <p style="color:#888; font-size:14px; margin: 0 0 20px;">
                ${withGuestOption
                    ? "Introduce la contraseña para editar, o entra como invitado para solo ver"
                    : "Introduce la contraseña para acceder"}
            </p>
            <input
                type="password"
                id="login-password"
                placeholder="Contraseña..."
                style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color); background:var(--cuadro-bg); color:var(--texto-color); font-size:14px; margin-bottom:20px;"
            >
            <div class="modal-botones">
                <button type="button" class="btn-cancelar" id="btnCancelLogin">Cancelar</button>
                ${guestButtonHtml}
                <button
                    type="button"
                    id="btnSubmitLogin"
                    style="padding:9px 24px; background:#4a90d9; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">
                    Acceder
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector("#btnCancelLogin").addEventListener("click", () => {
        window.history.back();
    });

    overlay.querySelector("#btnSubmitLogin").addEventListener("click", () => {
        attemptAccess(id);
    });

    const guestBtn = overlay.querySelector("#btnGuestAccess");
    if (guestBtn) {
        guestBtn.addEventListener("click", enterAsGuest);
    }

    overlay.querySelector("#login-password").addEventListener("keydown", (e) => {
        if (e.key === "Enter") attemptAccess(id);
    });
}

async function enterAsGuest() {
    readOnly = true;

    const overlay = document.getElementById("modal-login");
    if (overlay) overlay.remove();

    showSpinner();
    try {
        const res = await fetchWithTimeout(`${API_URL}/${currentPasteId}`);
        if (!res.ok) {
            showToast("No se pudo cargar el paste como invitado", "rojo");
            return;
        }

        const data = await res.json();
        loadDataIntoEditor(data);
        lockEditor();
    } catch (err) {
        console.error("Error entrando como invitado:", err);
        showToast("No se pudo conectar con la API", "rojo");
    } finally {
        hideSpinner();
    }
}

async function attemptAccess(id) {
    const pass = document.getElementById("login-password").value.trim();
    if (!pass) {
        showToast("Introduce la contraseña", "amarillo");
        return;
    }

    showSpinner();
    try {
        const res = await fetchWithTimeout(`${API_URL}/${id}`, {
            headers: { "X-Paste-Password": pass }
        });

        if (!res.ok) {
            showToast("Contraseña incorrecta", "rojo");
            return;
        }

        const data = await res.json();
        currentPassword = pass;
        visibilityMode = data.visibilidad;

        const overlay = document.getElementById("modal-login");
        if (overlay) overlay.remove();

        loadDataIntoEditor(data);
    } catch (err) {
        console.error("Error intentando acceso:", err);
        showToast("No se pudo conectar con la API", "rojo");
    } finally {
        hideSpinner();
    }
}

function lockEditor() {
    document.getElementById("editor").contentEditable = "false";
    document.getElementById("tituloClipboard").disabled = true;
    document.querySelector(".toolbar").style.opacity = "0.4";
    document.querySelector(".toolbar").style.pointerEvents = "none";
    document.querySelector(".acciones").style.opacity = "0.4";
    document.querySelector(".acciones").style.pointerEvents = "none";
    document.getElementById("btnCopiarUrl").disabled = false;
    document.getElementById("btnCompartir").disabled = false;
    showToast("Modo lectura — necesitas contraseña para editar", "amarillo");
}

function loadDataIntoEditor(data) {
    document.getElementById("editor").innerHTML = DOMPurify.sanitize(data.contenido);
    document.getElementById("tituloClipboard").value = data.titulo || "";

    const url = window.location.href;
    const urlDiv = document.getElementById("urlClipboard");
    urlDiv.innerText = `URL: ${url}`;
    urlDiv.style.color = "var(--texto-color)";

    enableUrlButtons(url);
    setSaveStatus(true);
    updateCounter();
    showToast("Paste cargado correctamente", "verde");
}

// Contador
function updateCounter() {
    const txt = document.getElementById("editor").innerText.trim();
    document.getElementById("contador").innerText = `Caracteres: ${
        txt ? txt.replace(/\n/g, "").length : 0
    }`;
}

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
    const editor = document.getElementById("editor");
    if (!editor) return;

    editor.addEventListener("input", () => {
        updateCounter();
        if (isSaved) setSaveStatus(false);
    });

    document.querySelectorAll("input[name='visibilidad']").forEach((radio) => {
        radio.addEventListener("change", () => {
            const needsPassword = radio.value !== "publico";
            document.getElementById("vis-password-campo").style.display = needsPassword ? "block" : "none";
        });
    });

    const darkSystem = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (darkSystem) {
        document.body.classList.add("dark-mode");
        document.getElementById("btnDarkMode").innerText = "Modo Claro";
    }

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        const btn = document.getElementById("btnDarkMode");
        if (e.matches) {
            document.body.classList.add("dark-mode");
            btn.innerText = "Modo Claro";
        } else {
            document.body.classList.remove("dark-mode");
            btn.innerText = "Modo Oscuro";
        }
    });

    // Atajos de teclado
    editor.addEventListener("keydown", (e) => {
        if (!e.ctrlKey && !e.metaKey) return;

        switch (e.key.toLowerCase()) {
            case "b": e.preventDefault(); bold(); break;
            case "i": e.preventDefault(); italic(); break;
            case "u": e.preventDefault(); underline(); break;
            case "s": e.preventDefault(); saveContent(); break;
        }
    });

    startClock();
    loadFromUrl();
});

// Historial
function addToHistory(message, type) {
    const list = document.getElementById("historial-lista");
    if (!list) return;

    const empty = document.getElementById("historial-vacio");
    if (empty) empty.remove();

    const now = Date.now();
    const icons = { verde: "✓", amarillo: "⚠", rojo: "✕" };

    const item = document.createElement("div");
    item.className = `historial-item ${type}`;
    item.innerHTML = `
        <div class="historial-item-top">
            <span class="historial-icono">${icons[type]}</span>
            <span class="historial-texto">${message}</span>
        </div>
        <span class="historial-tiempo" data-ts="${now}">ahora</span>
    `;

    list.insertBefore(item, list.firstChild);
}

function clearHistory() {
    const list = document.getElementById("historial-lista");
    list.innerHTML = `<div class="historial-vacio" id="historial-vacio">Sin actividad aún</div>`;
}

function updateHistoryTimes() {
    document.querySelectorAll(".historial-tiempo[data-ts]").forEach((el) => {
        const diff = Math.floor((Date.now() - parseInt(el.dataset.ts, 10)) / 1000);

        if (diff < 10) el.innerText = "ahora";
        else if (diff < 60) el.innerText = `${diff}s`;
        else if (diff < 3600) el.innerText = `${Math.floor(diff / 60)}min`;
        else el.innerText = `${Math.floor(diff / 3600)}h`;
    });
}