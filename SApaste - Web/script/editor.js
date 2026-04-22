// =======================
// CONFIG
// =======================
const API_URL = "http://192.168.3.170:5000/api/pastes";

let currentPasteId = null;

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
    const btn = document.getElementById("btnDarkMode");
    body.classList.toggle("dark-mode");
    btn.innerText = body.classList.contains("dark-mode") ? "Modo Claro" : "Modo Oscuro";
}

// =======================
// GUARDAR — POST a la API
// =======================
async function guardarContenido() {
    const contenido = document.getElementById("editor").innerText.trim();
    const titulo    = document.getElementById("tituloClipboard").value.trim();

    // Validar título obligatorio
    if (!titulo) {
        alert("El título es obligatorio");
        document.getElementById("tituloClipboard").focus();
        return;
    }

    if (!contenido) {
        alert("Escribe algo antes de guardar");
        return;
    }

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
            alert("Error al guardar el paste");
            return;
        }

        const data = await res.json();

        // Guardamos el ID devuelto por la API
        currentPasteId = data.id;

        // Mostramos la URL en el div urlClipboard
        const divUrl = document.getElementById("urlClipboard");
        divUrl.innerText = `URL: ${data.url}`;
        divUrl.style.color = "var(--texto-color)";

        console.log("Paste guardado con ID:", currentPasteId);

    } catch (err) {
        console.error("Error guardando:", err);
        alert("No se pudo conectar con la API");
    }
}

// =======================
// CARGAR — GET a la API
// =======================
async function cargarContenido() {
    if (!currentPasteId) return;

    try {
        const res = await fetch(`${API_URL}/${currentPasteId}`);

        if (!res.ok) {
            alert("Paste no encontrado");
            return;
        }

        const data = await res.json();

        // Rellenamos el editor y el título con lo que devuelve la API
        document.getElementById("editor").innerText          = data.contenido;
        document.getElementById("tituloClipboard").value     = data.titulo || "";

        actualizarContador();

    } catch (err) {
        console.error("Error cargando:", err);
    }
}

// =======================
// ELIMINAR — DELETE a la API
// =======================
async function eliminarPaste() {
    if (!currentPasteId) {
        alert("No hay ningún paste activo");
        return;
    }

    if (!confirm("¿Seguro que quieres eliminar este paste?")) return;

    try {
        const res = await fetch(`${API_URL}/${currentPasteId}`, {
            method: "DELETE"
        });

        if (res.ok) {
            // Limpiamos todo
            currentPasteId = null;
            document.getElementById("editor").innerText      = "";
            document.getElementById("tituloClipboard").value = "";
            document.getElementById("urlClipboard").innerText = "URL: (aún no generada)";
            document.getElementById("urlClipboard").style.color = "#888";
            actualizarContador();
        } else {
            alert("No se pudo eliminar el paste");
        }

    } catch (err) {
        console.error("Error eliminando:", err);
    }
}

// =======================
// CARGAR DESDE URL — si el usuario abre /p/{id}
// =======================
async function cargarDesdeUrl() {
    const path = window.location.pathname; // ejemplo: "/p/a3f9b21c"

    if (!path.startsWith('/p/')) return; // página normal, no hay paste en la URL

    const id = path.split('/p/')[1];
    if (!id) return;

    currentPasteId = id;

    try {
        const res = await fetch(`${API_URL}/${id}`);

        if (!res.ok) {
            document.getElementById("urlClipboard").innerText = "URL: Paste no encontrado o expirado";
            return;
        }

        const data = await res.json();

        // Rellenamos el editor y el título
        document.getElementById("editor").innerText      = data.contenido;
        document.getElementById("tituloClipboard").value = data.titulo || "";

        // Mostramos la URL a la que nos hemos conectado
        document.getElementById("urlClipboard").innerText    = `URL: ${window.location.href}`;
        document.getElementById("urlClipboard").style.color  = "var(--texto-color)";

        actualizarContador();

    } catch (err) {
        console.error("Error cargando desde URL:", err);
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

    // Si hay un ID en la URL, cargamos ese paste
    cargarDesdeUrl();
});