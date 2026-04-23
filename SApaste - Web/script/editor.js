// =======================
// CONFIG
// =======================
const API_URL = "http://192.168.3.170:5000/api/pastes";

let currentPasteId    = null;
let estaGuardado      = false;
let callbackConfirmar = null;

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
        actualizarTiemposHistorial();
    }
    actualizar();
    setInterval(actualizar, 1000);
}

// =======================
// ESTADO GUARDADO
// =======================
function setEstado(guardado) {
    estaGuardado = guardado;
    const badge  = document.getElementById("estadoBadge");
    const texto  = document.getElementById("estadoTexto");

    if (guardado) {
        badge.className = "estado-badge guardado";
        texto.innerText = "Guardado";
    } else {
        badge.className = "estado-badge sin-guardar";
        texto.innerText = "Sin guardar";
    }
}

// =======================
// URL — copiar y compartir
// =======================
function activarBotonesUrl(url) {
    document.getElementById("btnCopiarUrl").disabled  = false;
    document.getElementById("btnCompartir").disabled  = false;

    // Rellenar enlaces de compartir
    const texto = encodeURIComponent("Mira este clipboard: " + url);
    document.getElementById("shareWhatsapp").href  = `https://wa.me/?text=${texto}`;
    document.getElementById("shareGmail").href     = `https://mail.google.com/mail/?view=cm&body=${texto}`;
    document.getElementById("shareTelegram").href  = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=Mira este clipboard`;
}

function copiarUrl() {
    const urlTexto = document.getElementById("urlClipboard").innerText.replace("URL: ", "");
    navigator.clipboard.writeText(urlTexto).then(() => {
        const btn = document.getElementById("btnCopiarUrl");
        btn.innerText = "✓ Copiado";
        btn.classList.add("copiado");
        setTimeout(() => {
            btn.innerText = "📋 Copiar";
            btn.classList.remove("copiado");
        }, 2000);
    });
}

function toggleCompartir() {
    document.getElementById("compartirDropdown").classList.toggle("abierto");
}

function shareNativo() {
    const urlTexto = document.getElementById("urlClipboard").innerText.replace("URL: ", "");
    if (navigator.share) {
        navigator.share({ title: "SApaste", text: "Mira este clipboard", url: urlTexto });
    } else {
        mostrarToast("Tu navegador no soporta compartir nativo", "amarillo");
    }
    document.getElementById("compartirDropdown").classList.remove("abierto");
}

// Cerrar dropdown al hacer clic fuera
document.addEventListener("click", (e) => {
    const menu = document.getElementById("compartirDropdown");
    if (menu && !e.target.closest(".compartir-menu")) {
        menu.classList.remove("abierto");
    }
});

// =======================
// MODAL DE CONFIRMACIÓN
// =======================
function mostrarModal(titulo, mensaje, onConfirmar) {
    document.getElementById("modalTitulo").innerText  = titulo;
    document.getElementById("modalMensaje").innerText = mensaje;
    document.getElementById("modal-confirmacion").classList.add("visible");
    callbackConfirmar = onConfirmar;

    document.getElementById("btnConfirmar").onclick = () => {
        cerrarModal();
        onConfirmar();
    };
}

function cerrarModal() {
    document.getElementById("modal-confirmacion").classList.remove("visible");
    callbackConfirmar = null;
}

// =======================
// NOTIFICACIONES TOAST
// =======================
function mostrarToast(mensaje, tipo = "verde") {
    agregarAlHistorial(mensaje, tipo);

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

    setTimeout(() => {
        toast.style.animation = "toastSalida 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// =======================
// SPINNER
// =======================
function mostrarSpinner() { document.getElementById("spinner-overlay").classList.add("visible"); }
function ocultarSpinner() { document.getElementById("spinner-overlay").classList.remove("visible"); }

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
    const contenido = document.getElementById("editor").innerHTML.trim();
    const titulo    = document.getElementById("tituloClipboard").value.trim();

    if (!titulo) {
        mostrarToast("El título es obligatorio", "amarillo");
        document.getElementById("tituloClipboard").focus();
        return;
    }

    if (!document.getElementById("editor").innerText.trim()) {
        mostrarToast("Escribe algo antes de guardar", "amarillo");
        return;
    }

    mostrarSpinner();

    try {
        let res;

        if (currentPasteId) {
            // Ya existe — actualizamos con PUT
            res = await fetch(`${API_URL}/${currentPasteId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: contenido, title: titulo, password: null })
            });
        } else {
            // No existe — creamos con POST
            res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: contenido, title: titulo, password: null })
            });
        }

        if (!res.ok) {
            mostrarToast("Error al guardar el paste", "rojo");
            return;
        }

        const data = await res.json();
        currentPasteId = data.id;

        const divUrl = document.getElementById("urlClipboard");
        divUrl.innerText   = `URL: ${data.url}`;
        divUrl.style.color = "var(--texto-color)";

        activarBotonesUrl(data.url);
        setEstado(true);
        mostrarToast(
            currentPasteId ? "Paste actualizado correctamente" : "Paste guardado correctamente",
            "verde"
        );

    } catch (err) {
        console.error("Error guardando:", err);
        mostrarToast("No se pudo conectar con la API", "rojo");
    } finally {
        ocultarSpinner();
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
        document.getElementById("editor").innerHTML = DOMPurify.sanitize(data.contenido);
        document.getElementById("tituloClipboard").value = data.titulo || "";
        actualizarContador();
        setEstado(true);
        mostrarToast("Paste cargado", "verde");

    } catch (err) {
        console.error("Error cargando:", err);
        mostrarToast("No se pudo conectar con la API", "rojo");
    } finally {
        ocultarSpinner();
    }
}

// =======================
// ELIMINAR — DELETE con confirmación
// =======================
function eliminarPaste() {
    if (!currentPasteId) {
        mostrarToast("No hay ningún paste activo", "amarillo");
        return;
    }

    mostrarModal(
        "¿Eliminar este clipboard?",
        "Esta acción no se puede deshacer",
        async () => {
            mostrarSpinner();
            try {
                const res = await fetch(`${API_URL}/${currentPasteId}`, { method: "DELETE" });

                if (res.ok) {
                    currentPasteId = null;
                    document.getElementById("editor").innerHTML = "";
                    document.getElementById("tituloClipboard").value  = "";
                    document.getElementById("urlClipboard").innerText = "URL: (aún no generada)";
                    document.getElementById("urlClipboard").style.color = "#888";
                    document.getElementById("btnCopiarUrl").disabled  = true;
                    document.getElementById("btnCompartir").disabled  = true;
                    actualizarContador();
                    setEstado(false);
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
    );
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

        document.getElementById("editor").innerHTML = DOMPurify.sanitize(data.contenido);
        document.getElementById("tituloClipboard").value = data.titulo || "";

        const url    = window.location.href;
        const divUrl = document.getElementById("urlClipboard");
        divUrl.innerText   = `URL: ${url}`;
        divUrl.style.color = "var(--texto-color)";

        activarBotonesUrl(url);
        setEstado(true); // ya está guardado, lo estamos leyendo de la BBDD
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

    editor.addEventListener("input", () => {
        actualizarContador();
        if (estaGuardado) setEstado(false);
    });

    // Detectar tema del sistema y aplicarlo
    const sistemaOscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (sistemaOscuro) {
        document.body.classList.add("dark-mode");
        document.getElementById("btnDarkMode").innerText = "Modo Claro";
    }

    // Cambio en tiempo real si el usuario cambia el tema del sistema
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

// =======================
// ATAJOS DE TECLADO
// =======================
    editor.addEventListener("keydown", (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    
        switch (e.key.toLowerCase()) {
            case "b": e.preventDefault(); negrita();   break;
            case "i": e.preventDefault(); cursiva();   break;
            case "u": e.preventDefault(); subrayado(); break;
            case "s": e.preventDefault(); guardarContenido(); break;
        }
    });

    iniciarReloj();
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