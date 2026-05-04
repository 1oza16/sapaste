// =======================
// CONFIG
// =======================
const API_URL    = "http://192.168.3.170:5000/api";
const PER_PAGE   = 15;  

// =======================
// ESTADO
// =======================
let paginaActual   = 1;
let filtroActual   = "todos";
let busquedaActual = "";
let pastesCache    = [];   // datos en memoria que se llenan con la API
let pasteSeleccionado = null;

// =======================
// LOGIN
// =======================
async function intentarLogin() {
    const user = document.getElementById("login-user").value.trim();
    const pass = document.getElementById("login-pass").value;
    const err  = document.getElementById("login-error");

    if (!user || !pass) { err.textContent = "Rellena todos los campos"; return; }

    // Quitar
    sessionStorage.setItem("admin_token", "token_fake");
    document.getElementById("login-overlay").classList.add("hidden");
    document.getElementById("panel").classList.remove("hidden");
    iniciarPanel();
    return;
    // Quitar

    try {
        const res = await fetch(`${API_URL}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: user, password: pass })
        });

        if (!res.ok) { err.textContent = "Credenciales incorrectas"; return; }

        const data = await res.json();
        sessionStorage.setItem("admin_token", data.token);

        document.getElementById("login-overlay").classList.add("hidden");
        document.getElementById("panel").classList.remove("hidden");
        iniciarPanel();

    } catch(e) {
        err.textContent = "No se pudo conectar con la API";
    }
}

// Función helper para todas las peticiones admin que añade el token automáticamente
function fetchAdmin(url, options = {}) {
    const token = sessionStorage.getItem("admin_token");
    return fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...(options.headers || {})
        }
    });
}

function cerrarSesion() {
    document.getElementById("panel").classList.add("hidden");
    document.getElementById("login-overlay").classList.remove("hidden");
    document.getElementById("login-pass").value = "";
    document.getElementById("login-error").textContent = "";
    sessionStorage.removeItem("admin_token");
}

// Enter en login
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("login-pass").addEventListener("keydown", e => {
        if (e.key === "Enter") intentarLogin();
    });
    document.getElementById("login-user").addEventListener("keydown", e => {
        if (e.key === "Enter") document.getElementById("login-pass").focus();
    });

    // Navegación sidebar
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", () => {
            const section = item.dataset.section;
            document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
            document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
            item.classList.add("active");
            document.getElementById(`section-${section}`).classList.add("active");
        });
    });

    iniciarTema();
    iniciarReloj();
});

// =======================
// INIT PANEL
// =======================
function iniciarPanel() {
    cargarDesdeApi();
}

async function cargarDesdeApi() {
    mostrarLoading(true);

    try {
        const res = await fetchAdmin(`${API_URL}/admin/pastes`);

        if (res.status === 401) {
            cerrarSesion();
            return;
        }

        if (!res.ok) {
            mostrarToast("Error al cargar los pastes", "rojo");
            return;
        }

        const data = await res.json();
        pastesCache = data.pastes;

        // Actualizar stats desde la API
        document.getElementById("stat-total").textContent  = data.stats.total;
        document.getElementById("stat-pub").textContent    = data.stats.publicos;
        document.getElementById("stat-inv").textContent    = data.stats.invitados;
        document.getElementById("stat-strict").textContent = data.stats.estrictos;

        if (document.getElementById("stats-total")) {
            animarNumero("stats-total",  data.stats.total);
            animarNumero("stats-pub",    data.stats.publicos);
            animarNumero("stats-inv",    data.stats.invitados);
            animarNumero("stats-strict", data.stats.estrictos);
        }

        renderTabla();

    } catch (err) {
        console.error("Error cargando pastes:", err);
        mostrarToast("No se pudo conectar con la API", "rojo");
    } finally {
        mostrarLoading(false);
    }
}

function recargarTabla() {
    cargarDesdeApi();
    mostrarToast("Datos actualizados", "verde");
}

// =======================
// STATS
// =======================
function actualizarStats() {
    const total  = pastesCache.length;
    const pub    = pastesCache.filter(p => p.visibilidad === "publico").length;
    const inv    = pastesCache.filter(p => p.visibilidad === "invitados").length;
    const strict = pastesCache.filter(p => p.visibilidad === "estricto").length;

    // Panel de pastes
    animarNumero("stat-total",  total);
    animarNumero("stat-pub",    pub);
    animarNumero("stat-inv",    inv);
    animarNumero("stat-strict", strict);

    // Sección estadísticas — solo si los elementos existen
    if (document.getElementById("stats-total")) {
        animarNumero("stats-total",  total);
        animarNumero("stats-pub",    pub);
        animarNumero("stats-inv",    inv);
        animarNumero("stats-strict", strict);
    }
}

function animarNumero(id, final) {
    const el = document.getElementById(id);
    const duracion = 600;
    const inicio = Date.now();
    const desde = 0;

    const tick = () => {
        const progreso = Math.min((Date.now() - inicio) / duracion, 1);
        const ease = 1 - Math.pow(1 - progreso, 3);
        el.textContent = Math.round(desde + (final - desde) * ease);
        if (progreso < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

// =======================
// FILTRADO Y BÚSQUEDA
// =======================
function setFiltro(btn) {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    filtroActual = btn.dataset.filter;
    paginaActual = 1;
    renderTabla();
}

function filtrarTabla() {
    busquedaActual = document.getElementById("search-input").value.toLowerCase();
    paginaActual = 1;
    renderTabla();
}

function getPastesFiltrados() {
    return pastesCache.filter(p => {
        const matchFiltro = filtroActual === "todos" || p.visibilidad === filtroActual;
        const matchBusqueda = !busquedaActual ||
            p.titulo.toLowerCase().includes(busquedaActual) ||
            p.id.toLowerCase().includes(busquedaActual);
        return matchFiltro && matchBusqueda;
    });
}

// =======================
// RENDER TABLA
// =======================
function renderTabla() {
    const filtrados = getPastesFiltrados();
    const total     = filtrados.length;
    const inicio    = (paginaActual - 1) * PER_PAGE;
    const pagina    = filtrados.slice(inicio, inicio + PER_PAGE);

    const tbody = document.getElementById("tabla-body");
    const empty = document.getElementById("tabla-empty");

    if (pagina.length === 0) {
        tbody.innerHTML = "";
        empty.classList.remove("hidden");
    } else {
        empty.classList.add("hidden");
        tbody.innerHTML = pagina.map(p => filaHTML(p)).join("");
    }

    renderPaginacion(total);
    actualizarInfoPag(inicio, Math.min(inicio + PER_PAGE, total), total);
}

function filaHTML(p) {
    const badge = badgeHTML(p.visibilidad);
    const fecha = formatFecha(p.creado);
    const preview = p.visibilidad === "estricto"
        ? '<span style="letter-spacing:2px;color:var(--text-3)">••••••••••••••</span>'
        : escapeHTML(p.contenido).substring(0, 60) + (p.contenido.length > 60 ? "…" : "");

    return `
        <tr>
            <td><span class="mono">${p.id}</span></td>
            <td><span class="cell-title" title="${escapeHTML(p.titulo)}">${escapeHTML(p.titulo)}</span></td>
            <td><span class="cell-preview">${preview}</span></td>
            <td>${badge}</td>
            <td><span class="mono">${fecha}</span></td>
            <td>
                <div class="row-actions">
                    <button class="btn-row" onclick="verPaste('${p.id}')">Ver</button>
                    <button class="btn-row danger" onclick="pedirEliminar('${p.id}')">Eliminar</button>
                </div>
            </td>
        </tr>
    `;
}

function badgeHTML(vis) {
    const mapa = {
        publico:   { clase: "badge-pub",    texto: "Público" },
        invitados: { clase: "badge-inv",    texto: "Invitados" },
        estricto:  { clase: "badge-strict", texto: "Estricto" },
    };
    const { clase, texto } = mapa[vis] || mapa.publico;
    return `<span class="badge ${clase}"><span class="badge-dot"></span>${texto}</span>`;
}

// =======================
// PAGINACIÓN
// =======================
function renderPaginacion(total) {
    const totalPags = Math.ceil(total / PER_PAGE);
    const btns = document.getElementById("pag-btns");

    if (totalPags <= 1) { btns.innerHTML = ""; return; }

    let html = "";

    html += `<button class="pag-btn" onclick="irPagina(${paginaActual - 1})" ${paginaActual === 1 ? "disabled" : ""}>‹</button>`;

    for (let i = 1; i <= totalPags; i++) {
        if (i === 1 || i === totalPags || Math.abs(i - paginaActual) <= 1) {
            html += `<button class="pag-btn ${i === paginaActual ? "active" : ""}" onclick="irPagina(${i})">${i}</button>`;
        } else if (Math.abs(i - paginaActual) === 2) {
            html += `<button class="pag-btn" disabled>…</button>`;
        }
    }

    html += `<button class="pag-btn" onclick="irPagina(${paginaActual + 1})" ${paginaActual === totalPags ? "disabled" : ""}>›</button>`;

    btns.innerHTML = html;
}

function irPagina(n) {
    const total = Math.ceil(getPastesFiltrados().length / PER_PAGE);
    if (n < 1 || n > total) return;
    paginaActual = n;
    renderTabla();
    document.querySelector(".table-wrapper").scrollIntoView({ behavior: "smooth", block: "start" });
}

function actualizarInfoPag(desde, hasta, total) {
    document.getElementById("pag-info").textContent =
        total === 0 ? "0 resultados" : `${desde + 1}–${hasta} de ${total}`;
}

// =======================
// MODAL VER PASTE
// =======================
function verPaste(id) {
    const p = pastesCache.find(x => x.id === id);
    if (!p) return;

    pasteSeleccionado = p;

    document.getElementById("modal-paste-titulo").textContent = p.titulo;
    document.getElementById("modal-paste-id").textContent     = p.id;
    document.getElementById("modal-paste-badge").innerHTML    = badgeHTML(p.visibilidad);
    document.getElementById("modal-paste-fecha").textContent  = formatFechaLarga(p.creado);

    const contenidoEl = document.getElementById("modal-paste-contenido");
    if (p.visibilidad === "estricto") {
        contenidoEl.innerHTML = `<span style="color:var(--text-3);letter-spacing:3px;font-size:18px">••••••••••••••••••••</span>`;
    } else {
        contenidoEl.textContent = p.contenido;
    }

    document.getElementById("modal-btn-eliminar").onclick = () => {
        cerrarModal();
        pedirEliminar(p.id);
    };

    document.getElementById("modal-paste").classList.remove("hidden");
}

function cerrarModal() {
    document.getElementById("modal-paste").classList.add("hidden");
    pasteSeleccionado = null;
}

// =======================
// MODAL CONFIRMAR ELIMINAR
// =======================
function pedirEliminar(id) {
    document.getElementById("confirmar-btn").onclick = () => {
        eliminarPaste(id);
        cerrarConfirmar();
    };
    document.getElementById("modal-confirmar").classList.remove("hidden");
}

function cerrarConfirmar() {
    document.getElementById("modal-confirmar").classList.add("hidden");
}

async function eliminarPaste(id) {
    try {
        const res = await fetchAdmin(`${API_URL}/pastes/${id}`, {
            method: "DELETE"
        });

        if (res.status === 401) { cerrarSesion(); return; }
        if (!res.ok) { mostrarToast("No se pudo eliminar el paste", "rojo"); return; }

        pastesCache = pastesCache.filter(p => p.id !== id);
        actualizarStats();
        renderTabla();
        mostrarToast("Paste eliminado", "verde");

    } catch (e) {
        mostrarToast("No se pudo conectar con la API", "rojo");
    }
}

// =======================
// CERRAR MODALES CON ESC / CLICK FUERA
// =======================
document.addEventListener("click", (e) => {
    if (e.target.id === "modal-paste")    cerrarModal();
    if (e.target.id === "modal-confirmar") cerrarConfirmar();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { cerrarModal(); cerrarConfirmar(); }
});

// =======================
// SPINNER / LOADING
// =======================
function mostrarLoading(visible) {
    const el = document.getElementById("tabla-loading");
    visible ? el.classList.remove("hidden") : el.classList.add("hidden");
}

// =======================
// TOASTS
// =======================
function mostrarToast(mensaje, tipo = "verde") {
    const iconos = { verde: "✓", rojo: "✕", amarillo: "⚠" };
    const contenedor = document.getElementById("toast-container");

    const toast = document.createElement("div");
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `<span>${iconos[tipo]}</span><span>${mensaje}</span>`;
    contenedor.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "slideOut 0.25s ease forwards";
        setTimeout(() => toast.remove(), 250);
    }, 3000);
}

// =======================
// UTILIDADES
// =======================
function escapeHTML(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatFecha(iso) {
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d) / 1000);
    if (diff < 60)         return "ahora";
    if (diff < 3600)       return `${Math.floor(diff / 60)}min`;
    if (diff < 86400)      return `${Math.floor(diff / 3600)}h`;
    if (diff < 86400 * 7)  return `${Math.floor(diff / 86400)}d`;
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function formatFechaLarga(iso) {
    return new Date(iso).toLocaleString("es-ES", {
        day: "2-digit", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

// =======================
// RELOJ
// =======================
function iniciarReloj() {
    function actualizar() {
        const ahora = new Date();
        const h = String(ahora.getHours()).padStart(2, '0');
        const m = String(ahora.getMinutes()).padStart(2, '0');
        const s = String(ahora.getSeconds()).padStart(2, '0');
        document.getElementById("reloj").innerText = `${h}:${m}:${s}`;
    }
    actualizar();
    setInterval(actualizar, 1000);
}

// =======================
// SPINNER
// =======================
function mostrarSpinner() { document.getElementById("spinner-overlay").classList.add("visible"); }
function ocultarSpinner() { document.getElementById("spinner-overlay").classList.remove("visible"); }

// =======================
// TEMA: CLARO / OSCURO
// =======================
function iniciarTema() {
    const guardado = localStorage.getItem("admin-tema");
    const oscuro   = guardado === "oscuro" || 
        (!guardado && window.matchMedia("(prefers-color-scheme: dark)").matches);
    aplicarTema(oscuro ? "oscuro" : "claro", false);
}

function toggleTema() {
    const esOscuro = document.body.classList.contains("dark-mode");
    aplicarTema(esOscuro ? "claro" : "oscuro", true);
}

function aplicarTema(tema, guardar) {
    const esOscuro = tema === "oscuro";
    document.body.classList.toggle("dark-mode", esOscuro);

    const claro  = document.getElementById("theme-claro");
    const oscuro = document.getElementById("theme-oscuro");
    const slider = document.getElementById("theme-slider");

    claro.classList.toggle("active",  !esOscuro);
    oscuro.classList.toggle("active",  esOscuro);

    // Posicionar el slider bajo la opción activa
    const target = esOscuro ? oscuro : claro;
    slider.style.width     = `${target.offsetWidth}px`;
    slider.style.transform = `translateX(${esOscuro ? target.offsetLeft - 3 : 0}px)`;

    if (guardar) localStorage.setItem("admin-tema", tema);
}