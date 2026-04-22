// =======================
// CONFIG
// =======================
const API_URL = "http://192.168.3.170:5000/api/pastes";

let currentPasteId = localStorage.getItem("pasteId") || null;

// =======================
// EDITOR
// =======================
function aplicarEstilo(comando) {
    document.execCommand(comando, false, null);
    document.getElementById("editor").focus();
}

function negrita()     { aplicarEstilo("bold"); }
function cursiva()     { aplicarEstilo("italic"); }
function subrayado()   { aplicarEstilo("underline"); }
function cmd(c)        { aplicarEstilo(c); }

// =======================
// MODO OSCURO
// =======================
function toggleDarkMode() {
    const body = document.body;
    const btn = document.getElementById("btnDarkMode");

    body.classList.toggle("dark-mode");

    btn.innerText = body.classList.contains("dark-mode")
        ? "Modo Claro"
        : "Modo Oscuro";
}

// =======================
// GUARDAR (CREA O ACTUALIZA)
// =======================
async function guardarContenido() {
    const editor = document.getElementById("editor");
    const contenido = editor.innerText.trim();

    if (!contenido) return;

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                content: contenido,
                title: "clipboard",
                language: "plain"
            })
        });

        const data = await res.json();

        // 🔥 guardamos el ID que devuelve el backend
        currentPasteId = data.id;
        localStorage.setItem("pasteId", currentPasteId);

        console.log("Guardado con ID:", currentPasteId);

    } catch (err) {
        console.error("Error guardando:", err);
    }
}

// =======================
// CARGAR CONTENIDO
// =======================
async function cargarContenido() {
    if (!currentPasteId) return;

    const editor = document.getElementById("editor");

    try {
        const res = await fetch(`${API_URL}/${currentPasteId}`);
        const data = await res.json();

        if (data.content) {
            editor.innerText = data.content;
            actualizarContador();
        }

    } catch (err) {
        console.error("Error cargando:", err);
    }
}

// =======================
// CONTADOR
// =======================
function actualizarContador() {
    const editor = document.getElementById("editor");
    const contador = document.getElementById("contador");

    const txt = editor.innerText.trim();

    contador.innerText = `Caracteres: ${
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

    // 🔥 si existe ID, cargarlo
    if (currentPasteId) {
        cargarContenido();
    }
});