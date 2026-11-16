const STORAGE_KEY = "sapaste-demo-paste";
const visibilityLabels = {
    publico: "Público",
    invitados: "Invitados",
    estricto: "Estricto"
};
const visibilityClasses = {
    publico: "badge-pub",
    invitados: "badge-inv",
    estricto: "badge-strict"
};

const storedPaste = sessionStorage.getItem(STORAGE_KEY);
let pastes = storedPaste
    ? [JSON.parse(storedPaste)]
    : [{
        id: "demo0001",
        title: "Mi primer paste",
        content: "Crea un paste desde la página principal para verlo aquí.",
        visibility: "publico",
        created: new Date().toISOString()
    }];
let currentFilter = "todos";
let currentSearch = "";
let selectedPaste = null;

const tbody = document.getElementById("tabla-body");
const guide = document.getElementById("dashboard-guide");
const guideOverlay = document.getElementById("dashboard-guide-overlay");

function setStat(id, value) {
    document.querySelectorAll(`#${id}`).forEach(element => {
        element.textContent = value;
    });
}

function countByVisibility(visibility) {
    return pastes.filter(paste => paste.visibility === visibility).length;
}

function updateStats() {
    setStat("stat-total", pastes.length);
    setStat("stat-pub", countByVisibility("publico"));
    setStat("stat-inv", countByVisibility("invitados"));
    setStat("stat-strict", countByVisibility("estricto"));
}

function getVisiblePastes() {
    return pastes.filter(paste => {
        const matchesFilter = currentFilter === "todos" || paste.visibility === currentFilter;
        const search = currentSearch.toLowerCase();
        const matchesSearch = !search ||
            paste.title.toLowerCase().includes(search) ||
            paste.id.toLowerCase().includes(search);
        return matchesFilter && matchesSearch;
    });
}

function buildBadge(visibility) {
    const badge = document.createElement("span");
    badge.className = `badge ${visibilityClasses[visibility] || visibilityClasses.publico}`;

    const dot = document.createElement("span");
    dot.className = "badge-dot";
    badge.append(dot, document.createTextNode(visibilityLabels[visibility] || "Público"));
    return badge;
}

function createCell(content, className) {
    const cell = document.createElement("td");
    if (className) {
        cell.className = className;
    }
    cell.textContent = content;
    return cell;
}

function buildPasteRow(paste) {
    const row = document.createElement("tr");
    row.dataset.id = paste.id;
    row.className = "dashboard-guide-target";

    const id = createCell(paste.id, "mono");
    const title = createCell("", "");
    const titleText = document.createElement("span");
    titleText.className = "cell-title";
    titleText.textContent = paste.title || "Sin título";
    title.append(titleText);

    const preview = createCell(
        paste.visibility === "estricto"
            ? "••••••••••••"
            : `${paste.content.slice(0, 60)}${paste.content.length > 60 ? "…" : ""}`,
        "cell-preview"
    );
    const visibility = document.createElement("td");
    visibility.appendChild(buildBadge(paste.visibility));
    const created = createCell(formatDate(paste.created), "mono");
    const actions = document.createElement("td");
    const actionGroup = document.createElement("div");
    actionGroup.className = "row-actions";

    const viewButton = document.createElement("button");
    viewButton.type = "button";
    viewButton.className = "btn-row";
    viewButton.dataset.action = "view";
    viewButton.dataset.id = paste.id;
    viewButton.textContent = "Ver";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn-row danger";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.id = paste.id;
    deleteButton.textContent = "Eliminar";

    actionGroup.append(viewButton, deleteButton);
    actions.appendChild(actionGroup);
    row.append(id, title, preview, visibility, created, actions);
    row.dataset.guia = "dashboard-paste";
    return row;
}

function renderTable() {
    const visiblePastes = getVisiblePastes();
    tbody.replaceChildren(...visiblePastes.map(buildPasteRow));
    document.getElementById("tabla-empty").classList.toggle("hidden", visiblePastes.length > 0);

    const pageInfo = document.getElementById("pag-info");
    pageInfo.textContent = visiblePastes.length
        ? `1–${visiblePastes.length} de ${visiblePastes.length}`
        : "0 resultados";

    document.getElementById("pag-btns").replaceChildren();
    updateStats();
}

function setFiltro(button) {
    document.querySelectorAll(".filter-btn").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    currentFilter = button.dataset.filter || "todos";
    renderTable();
}

function filtrarTabla() {
    currentSearch = document.getElementById("search-input").value.trim();
    renderTable();
}

function recargarTabla() {
    renderTable();
    showToast("Datos actualizados", "verde");
}

function actualizarStats() {
    updateStats();
    showToast("Estadísticas actualizadas", "verde");
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatLongDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Fecha desconocida"
        : date.toLocaleString("es-ES", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
}

function showToast(message, type = "verde") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icons = { verde: "✓", amarillo: "⚠", rojo: "✕" };
    const icon = document.createElement("span");
    icon.textContent = icons[type] || "•";
    const text = document.createElement("span");
    text.textContent = message;
    toast.append(icon, text);
    container.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3000);
}

function viewPaste(id) {
    selectedPaste = pastes.find(paste => paste.id === id);
    if (!selectedPaste) {
        return;
    }

    document.getElementById("modal-paste-titulo").textContent = selectedPaste.title || "Sin título";
    document.getElementById("modal-paste-id").textContent = selectedPaste.id;
    document.getElementById("modal-paste-badge").replaceChildren(buildBadge(selectedPaste.visibility));
    document.getElementById("modal-paste-fecha").textContent = formatLongDate(selectedPaste.created);
    document.getElementById("modal-paste-contenido").textContent =
        selectedPaste.visibility === "estricto"
            ? "••••••••••••••••••••"
            : selectedPaste.content;
    document.getElementById("modal-paste").classList.remove("hidden");
}

function cerrarModal() {
    document.getElementById("modal-paste").classList.add("hidden");
    selectedPaste = null;
}

function askDelete(id) {
    selectedPaste = pastes.find(paste => paste.id === id);
    if (!selectedPaste) {
        return;
    }

    document.getElementById("modal-confirmar").classList.remove("hidden");
}

function cerrarConfirmar() {
    document.getElementById("modal-confirmar").classList.add("hidden");
}

function deletePaste() {
    if (!selectedPaste) {
        return;
    }

    pastes = pastes.filter(paste => paste.id !== selectedPaste.id);
    if (sessionStorage.getItem(STORAGE_KEY)) {
        sessionStorage.removeItem(STORAGE_KEY);
    }
    selectedPaste = null;
    cerrarConfirmar();
    cerrarModal();
    renderTable();
    showToast("Paste eliminado", "verde");
}

function toggleTema() {
    applyTheme(!document.body.classList.contains("dark-mode"));
}

function applyTheme(isDark) {
    document.body.classList.toggle("dark-mode", isDark);
    document.getElementById("theme-claro").classList.toggle("active", !isDark);
    document.getElementById("theme-oscuro").classList.toggle("active", isDark);

    const activeOption = document.getElementById(isDark ? "theme-oscuro" : "theme-claro");
    const slider = document.getElementById("theme-slider");
    slider.style.width = `${activeOption.offsetWidth}px`;
    slider.style.transform = `translateX(${isDark ? activeOption.offsetLeft - 3 : 0}px)`;
}

function startClock() {
    const clock = document.getElementById("reloj");

    function updateClock() {
        clock.textContent = new Date().toLocaleTimeString("es-ES", { hour12: false });
    }

    updateClock();
    window.setInterval(updateClock, 1000);
}

function showSection(name) {
    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.toggle("active", item.dataset.section === name);
    });
    document.querySelectorAll(".section").forEach(section => {
        section.classList.toggle("active", section.id === `section-${name}`);
    });
}

function positionGuide() {
    const target = document.querySelector('[data-guia="dashboard-paste"]');
    if (!target || guide.hidden) {
        return;
    }

    const targetRect = target.getBoundingClientRect();
    const guideRect = guide.getBoundingClientRect();
    const margin = 16;
    const left = Math.max(
        margin,
        Math.min(targetRect.left + targetRect.width / 2 - guideRect.width / 2, window.innerWidth - guideRect.width - margin)
    );
    let top = targetRect.bottom + margin;
    if (top + guideRect.height > window.innerHeight - margin) {
        top = targetRect.top - guideRect.height - margin;
    }
    const maxTop = Math.max(margin, window.innerHeight - guideRect.height - margin);
    guide.style.left = `${left}px`;
    guide.style.top = `${Math.max(margin, Math.min(top, maxTop))}px`;
}

function cerrarIntroduccion() {
    guide.hidden = true;
    guideOverlay.classList.remove("visible");
    guideOverlay.setAttribute("aria-hidden", "true");
    document.querySelectorAll(".dashboard-guide-target").forEach(row => row.classList.remove("dashboard-guide-target"));
}

function initTheme() {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark);
}

document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => showSection(item.dataset.section));
});

tbody.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) {
        return;
    }

    if (button.dataset.action === "view") {
        viewPaste(button.dataset.id);
    } else if (button.dataset.action === "delete") {
        askDelete(button.dataset.id);
    }
});

document.getElementById("modal-btn-eliminar").addEventListener("click", () => {
    const id = selectedPaste && selectedPaste.id;
    cerrarModal();
    if (id) {
        askDelete(id);
    }
});

document.getElementById("confirmar-btn").addEventListener("click", deletePaste);
document.getElementById("dashboard-guide-finish").addEventListener("click", cerrarIntroduccion);
document.getElementById("dashboard-guide-close").addEventListener("click", cerrarIntroduccion);
document.addEventListener("click", event => {
    if (event.target.id === "modal-paste") {
        cerrarModal();
    }
    if (event.target.id === "modal-confirmar") {
        cerrarConfirmar();
    }
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        cerrarModal();
        cerrarConfirmar();
        cerrarIntroduccion();
    }
});
window.addEventListener("resize", positionGuide);
window.addEventListener("scroll", positionGuide, true);

initTheme();
startClock();
renderTable();
guide.hidden = false;
guideOverlay.classList.add("visible");
guideOverlay.setAttribute("aria-hidden", "false");
positionGuide();
