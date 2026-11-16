// Configuración
const API_URL = "/api";
const PER_PAGE = 15;
const REQUEST_TIMEOUT_MS = 8000;

// Estado
let currentPage = 1;
let currentFilter = "todos";
let currentSearch = "";
let pastesCache = [];
let selectedPaste = null;

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

function fetchAdmin(url, options = {}) {
    const token = sessionStorage.getItem("admin_token");
    return fetchWithTimeout(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    });
}

// Login
async function attemptLogin() {
    const username = document.getElementById("login-user").value.trim();
    const password = document.getElementById("login-pass").value;
    const errorEl = document.getElementById("login-error");

    if (!username || !password) {
        errorEl.textContent = "Rellena todos los campos";
        return;
    }

    errorEl.textContent = "";

    try {
        const res = await fetchWithTimeout(`${API_URL}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        if (!res.ok) {
            errorEl.textContent = "Credenciales incorrectas";
            return;
        }

        const data = await res.json();
        if (!data.token) {
            errorEl.textContent = "Respuesta de sesión inválida";
            return;
        }

        sessionStorage.setItem("admin_token", data.token);
        document.getElementById("login-overlay").classList.add("hidden");
        document.getElementById("panel").classList.remove("hidden");
        initPanel();
    } catch (err) {
        console.error("Error de autenticación:", err);
        errorEl.textContent = "No se pudo conectar con la API";
    }
}

function logout() {
    document.getElementById("panel").classList.add("hidden");
    document.getElementById("login-overlay").classList.remove("hidden");
    document.getElementById("login-pass").value = "";
    document.getElementById("login-error").textContent = "";
    sessionStorage.removeItem("admin_token");
    pastesCache = [];
    selectedPaste = null;
}

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("login-pass").addEventListener("keydown", (e) => {
        if (e.key === "Enter") attemptLogin();
    });

    document.getElementById("login-user").addEventListener("keydown", (e) => {
        if (e.key === "Enter") document.getElementById("login-pass").focus();
    });

    document.querySelectorAll(".nav-item").forEach((item) => {
        item.addEventListener("click", () => {
            const section = item.dataset.section;
            document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
            document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
            item.classList.add("active");
            const targetSection = document.getElementById(`section-${section}`);
            if (targetSection) targetSection.classList.add("active");
        });
    });

    const tbody = document.getElementById("tabla-body");
    if (tbody) {
        tbody.addEventListener("click", (e) => {
            const viewBtn = e.target.closest("[data-action='view']");
            if (viewBtn) {
                viewPaste(viewBtn.dataset.id);
                return;
            }

            const deleteBtn = e.target.closest("[data-action='delete']");
            if (deleteBtn) {
                requestDelete(deleteBtn.dataset.id);
            }
        });
    }

    const pagBtns = document.getElementById("pag-btns");
    if (pagBtns) {
        pagBtns.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-page]");
            if (!btn || btn.disabled) return;
            goToPage(Number(btn.dataset.page));
        });
    }

    initTheme();
    startClock();
});

function initPanel() {
    loadFromApi();
}

// Carga de datos
async function loadFromApi({ showUpdatedToast = false } = {}) {
    setLoading(true);

    try {
        const res = await fetchAdmin(`${API_URL}/admin/pastes`);

        if (res.status === 401) {
            logout();
            return;
        }

        if (!res.ok) {
            showToast("Error al cargar los pastes", "rojo");
            return;
        }

        const data = await res.json();
        pastesCache = Array.isArray(data.pastes) ? data.pastes : [];

        if (data.stats) {
            setText("stat-total", data.stats.total ?? 0);
            setText("stat-pub", data.stats.publicos ?? 0);
            setText("stat-inv", data.stats.invitados ?? 0);
            setText("stat-strict", data.stats.estrictos ?? 0);

            if (document.getElementById("stats-total")) {
                animateNumber("stats-total", data.stats.total ?? 0);
                animateNumber("stats-pub", data.stats.publicos ?? 0);
                animateNumber("stats-inv", data.stats.invitados ?? 0);
                animateNumber("stats-strict", data.stats.estrictos ?? 0);
            }
        } else {
            updateStats();
        }

        renderTable();
        if (showUpdatedToast) {
            showToast("Datos actualizados", "verde");
        }
    } catch (err) {
        console.error("Error cargando pastes:", err);
        showToast("No se pudo conectar con la API", "rojo");
    } finally {
        setLoading(false);
    }
}

function reloadTable() {
    loadFromApi({ showUpdatedToast: true });
}

// Estadísticas
function updateStats() {
    const total = pastesCache.length;
    const pub = pastesCache.filter((p) => p.visibilidad === "publico").length;
    const inv = pastesCache.filter((p) => p.visibilidad === "invitados").length;
    const strict = pastesCache.filter((p) => p.visibilidad === "estricto").length;

    animateNumber("stat-total", total);
    animateNumber("stat-pub", pub);
    animateNumber("stat-inv", inv);
    animateNumber("stat-strict", strict);

    if (document.getElementById("stats-total")) {
        animateNumber("stats-total", total);
        animateNumber("stats-pub", pub);
        animateNumber("stats-inv", inv);
        animateNumber("stats-strict", strict);
    }
}

function animateNumber(id, target) {
    const el = document.getElementById(id);
    if (!el) return;

    const duration = 600;
    const startTime = Date.now();
    const startVal = 0;

    const tick = () => {
        const progress = Math.min((Date.now() - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(startVal + (target - startVal) * eased);
        if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
}

// Filtros y búsqueda
function setFilter(btn) {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter || "todos";
    currentPage = 1;
    renderTable();
}

function filterTable() {
    currentSearch = document.getElementById("search-input").value.toLowerCase();
    currentPage = 1;
    renderTable();
}

function getFilteredPastes() {
    return pastesCache.filter((p) => {
        const matchesFilter = currentFilter === "todos" || p.visibilidad === currentFilter;
        const matchesSearch = !currentSearch ||
            String(p.titulo || "").toLowerCase().includes(currentSearch) ||
            String(p.id || "").toLowerCase().includes(currentSearch);
        return matchesFilter && matchesSearch;
    });
}

// Tabla y paginación
function renderTable() {
    const filtered = getFilteredPastes();
    const total = filtered.length;
    const start = (currentPage - 1) * PER_PAGE;
    const pageItems = filtered.slice(start, start + PER_PAGE);

    const tbody = document.getElementById("tabla-body");
    const empty = document.getElementById("tabla-empty");

    if (pageItems.length === 0) {
        tbody.innerHTML = "";
        empty.classList.remove("hidden");
    } else {
        empty.classList.add("hidden");
        tbody.innerHTML = pageItems.map((p) => buildRowHtml(p)).join("");
    }

    renderPagination(total);
    updatePaginationInfo(start, Math.min(start + PER_PAGE, total), total);
}

function buildRowHtml(paste) {
    const safeId = escapeHTML(paste.id);
    const safeTitle = escapeHTML(paste.titulo || "");
    const contentStr = String(paste.contenido || "");
    const badge = buildBadgeHtml(paste.visibilidad);
    const dateStr = formatDate(paste.creado);
    const preview = paste.visibilidad === "estricto"
        ? '<span style="letter-spacing:2px;color:var(--text-3)">••••••••••••••</span>'
        : escapeHTML(contentStr).substring(0, 60) + (contentStr.length > 60 ? "…" : "");

    return `
        <tr>
            <td><span class="mono">${safeId}</span></td>
            <td><span class="cell-title" title="${safeTitle}">${safeTitle}</span></td>
            <td><span class="cell-preview">${preview}</span></td>
            <td>${badge}</td>
            <td><span class="mono">${dateStr}</span></td>
            <td>
                <div class="row-actions">
                    <button type="button" class="btn-row" data-action="view" data-id="${safeId}">Ver</button>
                    <button type="button" class="btn-row danger" data-action="delete" data-id="${safeId}">Eliminar</button>
                </div>
            </td>
        </tr>
    `;
}

function buildBadgeHtml(visibility) {
    const map = {
        publico: { cssClass: "badge-pub", label: "Público" },
        invitados: { cssClass: "badge-inv", label: "Invitados" },
        estricto: { cssClass: "badge-strict", label: "Estricto" }
    };
    const { cssClass, label } = map[visibility] || map.publico;
    return `<span class="badge ${cssClass}"><span class="badge-dot"></span>${label}</span>`;
}

function renderPagination(total) {
    const totalPages = Math.ceil(total / PER_PAGE);
    const container = document.getElementById("pag-btns");

    if (totalPages <= 1) {
        container.innerHTML = "";
        return;
    }

    let html = `<button type="button" class="pag-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>‹</button>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
            html += `<button type="button" class="pag-btn ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</button>`;
        } else if (Math.abs(i - currentPage) === 2) {
            html += `<button type="button" class="pag-btn" disabled>…</button>`;
        }
    }

    html += `<button type="button" class="pag-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>›</button>`;
    container.innerHTML = html;
}

function goToPage(page) {
    const totalPages = Math.ceil(getFilteredPastes().length / PER_PAGE);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
    const wrapper = document.querySelector(".table-wrapper");
    if (wrapper) wrapper.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updatePaginationInfo(from, to, total) {
    document.getElementById("pag-info").textContent =
        total === 0 ? "0 resultados" : `${from + 1}–${to} de ${total}`;
}

// Modales
function viewPaste(id) {
    const paste = pastesCache.find((item) => item.id === id);
    if (!paste) return;

    selectedPaste = paste;

    document.getElementById("modal-paste-titulo").textContent = paste.titulo || "";
    document.getElementById("modal-paste-id").textContent = paste.id;
    document.getElementById("modal-paste-badge").innerHTML = buildBadgeHtml(paste.visibilidad);
    document.getElementById("modal-paste-fecha").textContent = formatLongDate(paste.creado);

    const contentEl = document.getElementById("modal-paste-contenido");
    if (paste.visibilidad === "estricto") {
        contentEl.innerHTML = `<span style="color:var(--text-3);letter-spacing:3px;font-size:18px">••••••••••••••••••••</span>`;
    } else {
        contentEl.textContent = paste.contenido || "";
    }

    document.getElementById("modal-btn-eliminar").onclick = () => {
        closePasteModal();
        requestDelete(paste.id);
    };

    document.getElementById("modal-paste").classList.remove("hidden");
}

function closePasteModal() {
    document.getElementById("modal-paste").classList.add("hidden");
    selectedPaste = null;
}

function requestDelete(id) {
    document.getElementById("confirmar-btn").onclick = async () => {
        closeConfirmModal();
        await deletePaste(id);
    };
    document.getElementById("modal-confirmar").classList.remove("hidden");
}

function closeConfirmModal() {
    document.getElementById("modal-confirmar").classList.add("hidden");
}

async function deletePaste(id) {
    try {
        const res = await fetchAdmin(`${API_URL}/pastes/${encodeURIComponent(id)}`, {
            method: "DELETE"
        });

        if (res.status === 401) {
            logout();
            return;
        }

        if (!res.ok) {
            showToast("No se pudo eliminar el paste", "rojo");
            return;
        }

        pastesCache = pastesCache.filter((p) => p.id !== id);
        if (selectedPaste && selectedPaste.id === id) selectedPaste = null;
        updateStats();
        renderTable();
        showToast("Paste eliminado", "verde");
    } catch (err) {
        console.error("Error eliminando paste:", err);
        showToast("No se pudo conectar con la API", "rojo");
    }
}

document.addEventListener("click", (e) => {
    if (e.target.id === "modal-paste") closePasteModal();
    if (e.target.id === "modal-confirmar") closeConfirmModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closePasteModal();
        closeConfirmModal();
    }
});

// Estado de carga y notificaciones
function setLoading(visible) {
    const el = document.getElementById("tabla-loading");
    if (!el) return;
    visible ? el.classList.remove("hidden") : el.classList.add("hidden");
}

function showToast(message, type = "verde") {
    const icons = { verde: "✓", rojo: "✕", amarillo: "⚠" };
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || "•"}</span><span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "slideOut 0.25s ease forwards";
        setTimeout(() => toast.remove(), 250);
    }, 3000);
}

function showSpinner() {
    const el = document.getElementById("spinner-overlay");
    if (el) el.classList.add("visible");
}

function hideSpinner() {
    const el = document.getElementById("spinner-overlay");
    if (el) el.classList.remove("visible");
}

// Utilidades
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function escapeHTML(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatDate(iso) {
    const date = new Date(iso);
    const diffSec = Math.floor((Date.now() - date) / 1000);
    if (diffSec < 60) return "ahora";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}min`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
    if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d`;
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function formatLongDate(iso) {
    return new Date(iso).toLocaleString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// Reloj
function startClock() {
    function update() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, "0");
        const m = String(now.getMinutes()).padStart(2, "0");
        const s = String(now.getSeconds()).padStart(2, "0");
        setText("reloj", `${h}:${m}:${s}`);
    }
    update();
    setInterval(update, 1000);
}

// Tema
function initTheme() {
    const saved = localStorage.getItem("admin-tema");
    const prefersDark = saved === "oscuro" ||
        (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
    applyTheme(prefersDark ? "oscuro" : "claro", false);
}

function toggleTheme() {
    const isDark = document.body.classList.contains("dark-mode");
    applyTheme(isDark ? "claro" : "oscuro", true);
}

function applyTheme(theme, persist) {
    const isDark = theme === "oscuro";
    document.body.classList.toggle("dark-mode", isDark);

    const lightBtn = document.getElementById("theme-claro");
    const darkBtn = document.getElementById("theme-oscuro");
    const slider = document.getElementById("theme-slider");

    if (lightBtn) lightBtn.classList.toggle("active", !isDark);
    if (darkBtn) darkBtn.classList.toggle("active", isDark);

    const target = isDark ? darkBtn : lightBtn;
    if (slider && target) {
        slider.style.width = `${target.offsetWidth}px`;
        slider.style.transform = `translateX(${isDark ? target.offsetLeft - 3 : 0}px)`;
    }

    if (persist) localStorage.setItem("admin-tema", theme);
}