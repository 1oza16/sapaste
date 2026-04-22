// =======================
// CONFIG
// =======================
const API_URL = "http://192.168.3.170:5000/api/pastes";

let currentPasteId = null;

// =======================
// NOTIFICACIONES TOAST
// =======================
function mostrarToast(mensaje, tipo = "verde") {
    agregarAlHistorial(mensaje, tipo);
    
    // Crear contenedor si no existe
    let contenedor = document.getElementById("toast-container");
    if (!contenedor) {
        contenedor = document.createElement("div");
        contenedor.id = "toast-container";
        document.body.appendChild(contenedor);
    }

    const iconos = { verde: "✓", amarillo: "⚠", rojo: "✕" };

    const toast = document.createElement("div");
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `
        <span class="toast-icono">${iconos[tipo]}</span>
        <span>${mensaje}</span>
    `;

    contenedor.appendChild(toast);

    // Desaparece solo a los 3 segundos
    setTimeout(() => {
        toast.style.animation = "toastSalida 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// =======================
// SPINNER
// =======================
function mostrarSpinner() {
    document.getElementById("spinner-overlay").classList.add("visible");
}

function ocultarSpinner() {
    document.getElementById("spinner-overlay").classList.remove("visible");
}

// =======================
// EDITOR
// =======================
function aplicarEstilo(comando) {
    document.execCommand(comando, false, null);
    document.getElementById("editor").focus();
}

function negrita()   { aplicarEstilo("bold"); }
function cursiva()   { aplicarEstilo("italic"); }
function subrayado() { aplicarEstilo("underline"); }
function cmd(c)      { aplicarEstilo(c); }

// =======================
// MODO OSCURO
// =======================
function toggleDarkMode() {
    const body = document.body;
    const btn  = document.getElementById("btnDarkMode");
    body.classList.toggle("dark-mode");
    btn.innerText = body.classList.contains("dark-mode") ? "Modo Claro" : "Modo Oscuro";
}

// =======================
// GUARDAR — POST
// =======================
async function guardarContenido() {
    const contenido = document.getElementById("editor").innerText.trim();
    const titulo    = document.getElementById("tituloClipboard").value.trim();

    // Validaciones
    if (!titulo) {
        mostrarToast("El título es obligatorio", "amarillo");
        document.getElementById("tituloClipboard").focus();
        return;
    }

    if (!contenido) {
        mostrarToast("Escribe algo antes de guardar", "amarillo");
        return;
    }

    mostrarSpinner();

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content: contenido,
                title: titulo,
                password: null
            })
        });

        if (!res.ok) {
            mostrarToast("Error al guardar el paste", "rojo");
            return;
        }

        const data = await res.json();
        currentPasteId = data.id;

        // Mostrar URL generada
        const divUrl = document.getElementById("urlClipboard");
        divUrl.innerText     = `URL: ${data.url}`;
        divUrl.style.color   = "var(--texto-color)";

        mostrarToast("Paste guardado correctamente", "verde");

    } catch (err) {
        console.error("Error guardando:", err);
        mostrarToast("No se pudo conectar con la API", "rojo");
    } finally {
        ocultarSpinner(); // se oculta siempre, haya error o no
    }
}

// =======================
// CARGAR — GET
// =======================
async function cargarContenido() {
    if (!currentPasteId) {
        mostrarToast("No hay ningún paste activo", "amarillo");
        return;
    }

    mostrarSpinner();

    try {
        const res = await fetch(`${API_URL}/${currentPasteId}`);

        if (!res.ok) {
            mostrarToast("Paste no encontrado", "rojo");
            return;
        }

        const data = await res.json();

        document.getElementById("editor").innerText      = data.contenido;
        document.getElementById("tituloClipboard").value = data.titulo || "";
        actualizarContador();

        mostrarToast("Paste cargado", "verde");

    } catch (err) {
        console.error("Error cargando:", err);
        mostrarToast("No se pudo conectar con la API", "rojo");
    } finally {
        ocultarSpinner();
    }
}

// =======================
// ELIMINAR — DELETE
// =======================
async function eliminarPaste() {
    if (!currentPasteId) {
        mostrarToast("No hay ningún paste activo", "amarillo");
        return;
    }

    mostrarSpinner();

    try {
        const res = await fetch(`${API_URL}/${currentPasteId}`, {
            method: "DELETE"
        });

        if (res.ok) {
            currentPasteId = null;
            document.getElementById("editor").innerText       = "";
            document.getElementById("tituloClipboard").value  = "";
            document.getElementById("urlClipboard").innerText = "URL: (aún no generada)";
            document.getElementById("urlClipboard").style.color = "#888";
            actualizarContador();
            mostrarToast("Paste eliminado", "verde");
        } else {
            mostrarToast("No se pudo eliminar el paste", "rojo");
        }

    } catch (err) {
        console.error("Error eliminando:", err);
        mostrarToast("No se pudo conectar con la API", "rojo");
    } finally {
        ocultarSpinner();
    }
}

// =======================
// CARGAR DESDE URL — /p/{id}
// =======================
async function cargarDesdeUrl() {
    const path = window.location.pathname;
    if (!path.startsWith('/p/')) return;

    const id = path.split('/p/')[1];
    if (!id) return;

    currentPasteId = id;
    mostrarSpinner();

    try {
        const res = await fetch(`${API_URL}/${id}`);

        if (!res.ok) {
            document.getElementById("urlClipboard").innerText = "URL: Paste no encontrado o expirado";
            mostrarToast("Paste no encontrado o expirado", "rojo");
            return;
        }

        const data = await res.json();

        document.getElementById("editor").innerText      = data.contenido;
        document.getElementById("tituloClipboard").value = data.titulo || "";

        const divUrl = document.getElementById("urlClipboard");
        divUrl.innerText   = `URL: ${window.location.href}`;
        divUrl.style.color = "var(--texto-color)";

        actualizarContador();
        mostrarToast("Paste cargado correctamente", "verde");

    } catch (err) {
        console.error("Error cargando desde URL:", err);
        mostrarToast("No se pudo conectar con la API", "rojo");
    } finally {
        ocultarSpinner();
    }
}

// =======================
// CONTADOR
// =======================
function actualizarContador() {
    const txt = document.getElementById("editor").innerText.trim();
    document.getElementById("contador").innerText = `Caracteres: ${
        txt ? txt.replace(/\n/g, "").length : 0
    }`;
}

// =======================
// INIT
// =======================
document.addEventListener("DOMContentLoaded", () => {
    const editor = document.getElementById("editor");
    if (!editor) return;

    editor.addEventListener("input", actualizarContador);
    cargarDesdeUrl();
});


// =======================
// HISTORIAL
// =======================
function agregarAlHistorial(mensaje, tipo) {
    const lista = document.getElementById("historial-lista");
    if (!lista) return;

    // Quitar el mensaje de vacío si existe
    const vacio = document.getElementById("historial-vacio");
    if (vacio) vacio.remove();

    const ahora = Date.now();
    const iconos = { verde: "✓", amarillo: "⚠", rojo: "✕" };

    const item = document.createElement("div");
    item.className = `historial-item ${tipo}`;
    item.innerHTML = `
        <div class="historial-item-top">
            <span class="historial-icono">${iconos[tipo]}</span>
            <span class="historial-texto">${mensaje}</span>
        </div>
        <span class="historial-tiempo" data-ts="${ahora}">ahora</span>
    `;

    // Insertar al principio para que lo más reciente quede arriba
    lista.insertBefore(item, lista.firstChild);
}

function limpiarHistorial() {
    const lista = document.getElementById("historial-lista");
    lista.innerHTML = `<div class="historial-vacio" id="historial-vacio">Sin actividad aún</div>`;
}

function actualizarTiemposHistorial() {
    document.querySelectorAll(".historial-tiempo[data-ts]").forEach(el => {
        const diff = Math.floor((Date.now() - parseInt(el.dataset.ts)) / 1000);

        if (diff < 10)        el.innerText = "ahora";
        else if (diff < 60)   el.innerText = `${diff}s`;
        else if (diff < 3600) el.innerText = `${Math.floor(diff / 60)}min`;
        else                  el.innerText = `${Math.floor(diff / 3600)}h`;
    });
}