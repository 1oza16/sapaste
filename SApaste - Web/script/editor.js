// editor.js — corregido
// Usa execCommand para soportar toggle automático y compatibilidad con
// los comandos de alineación, listas, negrita, cursiva y subrayado.

function aplicarEstilo(comando) {
    document.execCommand(comando, false, null);
    document.getElementById("editor").focus();
}

function negrita()     { aplicarEstilo("bold"); }
function cursiva()     { aplicarEstilo("italic"); }
function subrayado()   { aplicarEstilo("underline"); }
function cmd(comando)  { aplicarEstilo(comando); }

// Función para alternar Modo Oscuro
function toggleDarkMode() {
    const body = document.body;
    const btn = document.getElementById("btnDarkMode");
    
    body.classList.toggle("dark-mode");
    
    // Cambiar el icono/texto del botón
    if (body.classList.contains("dark-mode")) {
        btn.innerText = "Modo Claro";
    } else {
        btn.innerText = "Modo Oscuro";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const editor = document.getElementById("editor");
    const contador = document.getElementById("contador");

    if (editor && contador) {
        editor.addEventListener("input", () => {
            let contenido = editor.innerText.trim();
            const numCaracteres = (contenido === "" ) ? 0 : editor.innerText.replace(/\n/g, "").length;
            contador.innerText = `Caracteres: ${numCaracteres}`;
        });
    }
});