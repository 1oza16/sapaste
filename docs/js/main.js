const titleInput = document.getElementById("tituloClipboard");
const editor = document.getElementById("editor");
const saveButton = document.getElementById("btnGuardar");
const urlDisplay = document.getElementById("urlClipboard");
const guideOverlay = document.getElementById("guiaOverlay");
const guidePopover = document.getElementById("guiaPopover");
const guideProgress = document.getElementById("guiaProgreso");
const guideChapterCreation = document.getElementById("guiaApartadoCreacion");
const guideChapterAccess = document.getElementById("guiaApartadoAcceso");
const guideChapterDashboard = document.getElementById("guiaApartadoDashboard");
const guideTitle = document.getElementById("guiaTitulo");
const guideText = document.getElementById("guiaTexto");
const guideNext = document.getElementById("guiaSiguiente");
const guideContinue = document.getElementById("guiaContinuar");
const guideFinish = document.getElementById("guiaFinalizar");
const guideClose = document.getElementById("guiaCerrar");
const introduction = document.getElementById("pantallaIntroduccion");
const introductionSeenKey = "sapaste-introduction-seen";
const dashboardTutorialKey = "sapaste-demo-tutorial-dashboard";
const pasteStorageKey = "sapaste-demo-paste";

if (sessionStorage.getItem(introductionSeenKey) !== "true") {
    introduction.hidden = false;
}

const guideSteps = [
    {
        target: "titulo",
        title: "Ponle un título",
        text: "Escribe un título para reconocer tu paste.",
        requirement: () => titleInput.value.trim().length > 0
    },
    {
        target: "contenido",
        title: "Añade el contenido",
        text: "Escribe o pega aquí el texto que quieres guardar.",
        requirement: () => editor.innerText.trim().length > 0
    },
    {
        target: "guardar",
        title: "Guarda tu paste",
        text: "Pulsa Guardar y elige quién podrá acceder a tu paste."
    },
    {
        target: "visibilidad",
        title: "Elige la visibilidad",
        text: "Selecciona el tipo de paste. En las opciones privadas, introduce una contraseña antes de guardar."
    },
    {
        target: "url",
        title: "Creación del paste completada",
        text: "Has creado tu primer paste. ¿Quieres continuar la simulacion y comprobar el acceso a tu paste?",
        chapterFinish: true
    },
    {
        target: "url",
        title: "Comprobar el acceso",
        text: "",
        accessStart: true,
        section: 2,
        sectionStep: 1
    },
    {
        target: "access-password",
        title: "Introduce la contraseña",
        text: "Escribe la misma contraseña que instroduciste al crear el paste.",
        passwordStep: true,
        section: 2,
        sectionStep: 2
    },
    {
        target: "paste-view",
        title: "Paste accesible",
        text: "",
        accessFinal: true,
        chapterFinish: true,
        section: 2,
        sectionStep: 2
    }
];

let guideStepIndex = 0;
let guideActiveTarget = null;
let currentPasteId = null;
let currentPasteCreatedAt = null;
let visibilityMode = "publico";
let simulatedPassword = null;
let guestReadOnly = false;
const visibilityLabels = {
    publico: "Público",
    invitados: "Privado con invitados",
    estricto: "Privado estricto"
};

function updateGuideButton() {
    const step = guideSteps[guideStepIndex];
    guideNext.disabled = Boolean(step.requirement && !step.requirement());
}

function positionGuidePopover() {
    if (!guideActiveTarget || guidePopover.hidden) {
        return;
    }

    const targetRect = guideActiveTarget.getBoundingClientRect();
    const popoverRect = guidePopover.getBoundingClientRect();
    const margin = 16;
    const left = Math.max(
        margin,
        Math.min(
            targetRect.left + targetRect.width / 2 - popoverRect.width / 2,
            window.innerWidth - popoverRect.width - margin
        )
    );
    let top;
    if (guideStepIndex === 3 || guideSteps[guideStepIndex].passwordStep) {
        top = targetRect.top - popoverRect.height - margin;
    } else {
        top = targetRect.bottom + margin;
        if (top + popoverRect.height > window.innerHeight - margin) {
            top = targetRect.top - popoverRect.height - margin;
        }
    }

    const maxTop = Math.max(margin, window.innerHeight - popoverRect.height - margin);
    guidePopover.style.left = `${left}px`;
    guidePopover.style.top = `${Math.max(margin, Math.min(top, maxTop))}px`;
}

function showGuideStep(index) {
    if (guideActiveTarget) {
        guideActiveTarget.classList.remove("guia-objetivo");
    }

    guideStepIndex = index;
    const step = guideSteps[index];
    document.getElementById("modal-visibilidad").classList.toggle("guia-modal", index === 3);
    document.getElementById("modal-acceso").classList.toggle("guia-modal", Boolean(step.passwordStep));
    guideActiveTarget = document.querySelector(`[data-guia="${step.target}"]`);
    guideActiveTarget.classList.add("guia-objetivo");

    guideTitle.textContent = step.title;
    const isAccessSection = step.section === 2;
    const hasPasswordAccess = visibilityMode === "estricto" || visibilityMode === "invitados";
    const sectionStepCount = isAccessSection && hasPasswordAccess ? 3 : isAccessSection ? 2 : 5;
    const sectionStep = step.accessFinal && hasPasswordAccess ? 3 : step.sectionStep;
    guideProgress.textContent = isAccessSection
        ? `Paso ${sectionStep} de ${sectionStepCount}`
        : `Paso ${index + 1} de 5`;
    guideChapterCreation.hidden = isAccessSection;
    guideChapterDashboard.hidden = !isAccessSection;
    guideChapterCreation.classList.toggle("active", !isAccessSection);
    guideChapterAccess.classList.toggle("active", isAccessSection);
    guideChapterDashboard.classList.remove("active");
    guideChapterCreation.setAttribute("aria-current", isAccessSection ? "false" : "step");
    guideChapterAccess.setAttribute("aria-current", isAccessSection ? "step" : "false");
    guideChapterDashboard.setAttribute("aria-current", "false");
    guideText.textContent = step.accessStart
        ? `Tu paste está configurado como ${visibilityLabels[visibilityMode]}. ${visibilityMode === "estricto" ? "Para acceder, tendrás que introducir la contraseña que elegiste." : "Pulsa el botón para abrirlo y comprobar quién puede acceder."}`
        : step.passwordStep
            ? visibilityMode === "invitados"
                ? "Introduce la contraseña para editar, o entra como invitado para solo ver."
                : step.text
            : step.accessFinal
                ? visibilityMode === "publico"
                    ? "El paste público se abre directamente y permite ver y editar el contenido."
                    : visibilityMode === "invitados"
                        ? guestReadOnly
                            ? "Has entrado como invitado. Puedes leer el contenido, pero no modificarlo."
                            : "Contraseña correcta. Puedes ver y editar el contenido del paste."
                        : "La contraseña es correcta. Ya puedes acceder al contenido del paste."
                : step.text;
    guideNext.hidden = step.chapterFinish || step.passwordStep || (!step.requirement && !step.finish && !step.accessStart);
    guideNext.textContent = step.accessStart ? "Acceder al paste" : step.finish ? "Finalizar apartado" : "Siguiente";
    guideContinue.hidden = !step.chapterFinish;
    guideFinish.hidden = !step.chapterFinish;
    guideContinue.textContent = isAccessSection ? "Continuar al dashboard" : "Continuar introducción";
    guideFinish.textContent = isAccessSection ? "Salir" : "Finalizar";
    guideNext.disabled = false;
    guidePopover.hidden = false;
    guideOverlay.classList.add("visible");
    guideOverlay.setAttribute("aria-hidden", "false");

    if (step.requirement) {
        updateGuideButton();
    }

    guideActiveTarget.scrollIntoView({ behavior: "smooth", block: "center" });
    positionGuidePopover();
}

function closeGuide() {
    if (guideActiveTarget) {
        guideActiveTarget.classList.remove("guia-objetivo");
        guideActiveTarget = null;
    }

    guidePopover.hidden = true;
    guideOverlay.classList.remove("visible");
    guideOverlay.setAttribute("aria-hidden", "true");
    document.getElementById("modal-visibilidad").classList.remove("guia-modal");
    document.getElementById("modal-acceso").classList.remove("visible", "guia-modal");
    document.getElementById("access-password-input").value = "";
}

function closeIntroduction(startTutorial) {
    introduction.hidden = true;
    sessionStorage.setItem(introductionSeenKey, "true");
    sessionStorage.removeItem(dashboardTutorialKey);
    if (startTutorial) {
        showGuideStep(0);
    }
}

function generatePasteId() {
    if (window.crypto && window.crypto.getRandomValues) {
        const bytes = new Uint8Array(4);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    }

    return Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function updateSaveStatus() {
    const badge = document.getElementById("estadoBadge");
    badge.className = "estado-badge sin-guardar";
    document.getElementById("estadoTexto").textContent = "Sin guardar";
}

function updateCharacterCount() {
    document.getElementById("contador").textContent = `Caracteres: ${editor.innerText.length}`;
}

function guardarContenido() {
    if (!titleInput.value.trim()) {
        showToast("Escribe un título para continuar", "amarillo");
        titleInput.focus();
        return;
    }

    if (!editor.innerText.trim()) {
        showToast("Escribe el contenido del paste", "amarillo");
        editor.focus();
        return;
    }

    if (currentPasteId) {
        if (savePaste() && guideStepIndex === 2 && !guidePopover.hidden) {
            showGuideStep(4);
        }
        return;
    }

    openVisibilityModal();
    if (guideStepIndex === 2 && !guidePopover.hidden) {
        showGuideStep(3);
    }
}

function openVisibilityModal() {
    document.getElementById("modal-visibilidad").classList.add("visible");
}

function cerrarModalVisibilidad() {
    document.getElementById("modal-visibilidad").classList.remove("visible", "guia-modal");
    document.getElementById("vis-password-input").value = "";
    document.getElementById("vis-password-campo").style.display = "none";
    document.querySelector("input[name='visibilidad'][value='publico']").checked = true;
    visibilityMode = "publico";

    if (guideStepIndex === 3 && !guidePopover.hidden) {
        showGuideStep(2);
    }
}

function confirmarGuardado() {
    const visibility = document.querySelector("input[name='visibilidad']:checked").value;
    const passwordInput = document.getElementById("vis-password-input");
    const password = passwordInput.value.trim();

    if (visibility !== "publico" && !password) {
        showToast("Introduce una contraseña para este modo", "amarillo");
        document.getElementById("vis-password-input").focus();
        return;
    }

    visibilityMode = visibility;
    simulatedPassword = visibility === "publico" ? null : password;
    document.getElementById("modal-visibilidad").classList.remove("visible", "guia-modal");
    passwordInput.value = "";
    document.getElementById("vis-password-campo").style.display = "none";
    document.querySelector("input[name='visibilidad'][value='publico']").checked = true;
    if (!savePaste()) {
        return;
    }
}

function savePaste() {
    if (!currentPasteId) {
        currentPasteId = generatePasteId();
        currentPasteCreatedAt = new Date().toISOString();
    }

    const paste = {
        id: currentPasteId,
        title: titleInput.value.trim(),
        content: editor.innerText,
        visibility: visibilityMode,
        created: currentPasteCreatedAt
    };

    try {
        sessionStorage.setItem(pasteStorageKey, JSON.stringify(paste));
    } catch (error) {
        showToast("No se pudo guardar el paste", "rojo");
        return false;
    }

    updateSavedPasteUI();
    showToast(`Paste guardado como ${visibilityLabels[visibilityMode]}`);
    if (guideStepIndex === 3 && !guidePopover.hidden) {
        showGuideStep(4);
    }
    return true;
}

function updateSavedPasteUI() {
    const url = `https://sapaste.duckdns.org/p/${currentPasteId}`;
    urlDisplay.textContent = `URL del simulador: ${url}`;
    document.getElementById("estadoBadge").className = "estado-badge guardado";
    document.getElementById("estadoTexto").textContent = "Guardado";
    document.getElementById("btnCopiarUrl").disabled = false;
    document.getElementById("btnCompartir").disabled = false;
    document.getElementById("shareWhatsapp").href = `https://wa.me/?text=${encodeURIComponent(`Mira este clipboard: ${url}`)}`;
    document.getElementById("shareGmail").href = `https://mail.google.com/mail/?view=cm&body=${encodeURIComponent(`Mira este clipboard: ${url}`)}`;
    document.getElementById("shareTelegram").href = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=Mira este clipboard`;
}

function restoreSavedPaste() {
    let paste;
    try {
        const storedPaste = sessionStorage.getItem(pasteStorageKey);
        if (!storedPaste) {
            return;
        }
        paste = JSON.parse(storedPaste);
    } catch (error) {
        showToast("No se pudo recuperar el paste guardado", "rojo");
        return;
    }

    if (!paste || typeof paste.id !== "string" || typeof paste.title !== "string" || typeof paste.content !== "string") {
        showToast("El paste guardado no es válido", "rojo");
        return;
    }

    currentPasteId = paste.id;
    currentPasteCreatedAt = typeof paste.created === "string" ? paste.created : new Date().toISOString();
    visibilityMode = Object.prototype.hasOwnProperty.call(visibilityLabels, paste.visibility)
        ? paste.visibility
        : "publico";
    titleInput.value = paste.title;
    editor.innerText = paste.content;
    updateCharacterCount();
    updateSavedPasteUI();
}

async function copiarUrl() {
    const url = urlDisplay.textContent.replace("URL del simulador: ", "");

    try {
        await navigator.clipboard.writeText(url);
        showToast("URL copiada al portapapeles");
    } catch (error) {
        showToast("No se pudo copiar la URL", "rojo");
    }
}

function toggleCompartir() {
    document.getElementById("compartirDropdown").classList.toggle("abierto");
}

function shareNativo() {
    const url = urlDisplay.textContent.replace("URL del simulador: ", "");

    if (!navigator.share) {
        showToast("Tu navegador no admite esta opción para compartir", "amarillo");
        return;
    }

    navigator.share({ title: titleInput.value.trim(), url }).catch(error => {
        if (error.name !== "AbortError") {
            showToast("No se pudo compartir la URL", "rojo");
        }
    });
}

function abrirAccesoPaste() {
    if (visibilityMode === "publico") {
        guestReadOnly = false;
        showGuideStep(7);
        return;
    }

    const modal = document.getElementById("modal-acceso");
    const passwordInput = document.getElementById("access-password-input");
    const guestButton = document.getElementById("access-guest-button");
    const accessModalText = document.getElementById("access-modal-text");
    const accessButton = modal.querySelector(".btn-acceder");
    passwordInput.value = "";
    guestButton.hidden = visibilityMode !== "invitados";
    modal.classList.toggle("con-invitado", visibilityMode === "invitados");
    accessModalText.textContent = visibilityMode === "invitados"
        ? "Introduce la contraseña para editar, o entra como invitado para solo ver."
        : "Introduce la contraseña para acceder al contenido.";
    accessButton.textContent = visibilityMode === "invitados" ? "Acceder para editar" : "Acceder";
    modal.classList.add("visible");
    showGuideStep(6);
    passwordInput.focus();
}

function verificarAcceso() {
    const passwordInput = document.getElementById("access-password-input");
    const enteredPassword = passwordInput.value.trim();

    if (!enteredPassword) {
        showToast("Introduce la contraseña para acceder", "amarillo");
        passwordInput.focus();
        return;
    }

    if (enteredPassword !== simulatedPassword) {
        showToast("La contraseña no es correcta", "rojo");
        passwordInput.select();
        passwordInput.focus();
        return;
    }

    guestReadOnly = false;
    document.getElementById("modal-acceso").classList.remove("visible", "guia-modal", "con-invitado");
    passwordInput.value = "";
    showGuideStep(7);
}

function entrarComoInvitado() {
    guestReadOnly = true;
    document.getElementById("modal-acceso").classList.remove("visible", "guia-modal", "con-invitado");
    document.getElementById("access-password-input").value = "";
    document.getElementById("access-guest-button").hidden = true;
    titleInput.disabled = true;
    editor.contentEditable = "false";
    document.querySelectorAll(".toolbar button").forEach(button => {
        button.disabled = true;
    });
    showGuideStep(7);
}

function cancelarAcceso() {
    document.getElementById("modal-acceso").classList.remove("visible", "guia-modal", "con-invitado");
    document.getElementById("access-password-input").value = "";
    document.getElementById("access-guest-button").hidden = true;
    showGuideStep(5);
}

function applyEditorCommand(command) {
    document.execCommand(command, false, null);
    editor.focus();
}

function negrita() { applyEditorCommand("bold"); }
function cursiva() { applyEditorCommand("italic"); }
function subrayado() { applyEditorCommand("underline"); }
function cmd(command) { applyEditorCommand(command); }

function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
    document.getElementById("btnDarkMode").textContent =
        document.body.classList.contains("dark-mode") ? "Modo Claro" : "Modo Oscuro";
}

function applySystemTheme(isDark) {
    document.body.classList.toggle("dark-mode", isDark);
    document.getElementById("btnDarkMode").textContent = isDark ? "Modo Claro" : "Modo Oscuro";
}

const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
applySystemTheme(systemTheme.matches);
systemTheme.addEventListener("change", event => applySystemTheme(event.matches));

document.querySelectorAll("input[name='visibilidad']").forEach(radio => {
    radio.addEventListener("change", () => {
        const needsPassword = radio.value !== "publico";
        document.getElementById("vis-password-campo").style.display = needsPassword ? "block" : "none";
    });
});

document.getElementById("access-guest-button").addEventListener("click", entrarComoInvitado);
document.getElementById("btnHacerSimulacion").addEventListener("click", () => showGuideStep(0));
document.getElementById("btnEmpezarTutorial").addEventListener("click", () => closeIntroduction(true));
document.getElementById("btnIrPorLibre").addEventListener("click", () => closeIntroduction(false));

titleInput.addEventListener("input", () => {
    updateSaveStatus();
    updateGuideButton();
});

editor.addEventListener("input", () => {
    updateCharacterCount();
    updateSaveStatus();
    updateGuideButton();
});

guideNext.addEventListener("click", () => {
    if (guideSteps[guideStepIndex].finish) {
        closeGuide();
        return;
    }

    if (guideSteps[guideStepIndex].accessStart) {
        abrirAccesoPaste();
        return;
    }

    if (guideSteps[guideStepIndex].requirement && !guideSteps[guideStepIndex].requirement()) {
        return;
    }

    showGuideStep(guideStepIndex + 1);
});

guideContinue.addEventListener("click", () => {
    if (guideSteps[guideStepIndex].section !== 2) {
        showGuideStep(5);
        return;
    }

    const paste = {
        id: currentPasteId,
        title: titleInput.value.trim(),
        content: editor.innerText,
        visibility: visibilityMode,
        created: currentPasteCreatedAt
    };

    try {
        sessionStorage.setItem(pasteStorageKey, JSON.stringify(paste));
        sessionStorage.setItem(dashboardTutorialKey, "true");
        window.location.href = "dashboard.html";
    } catch (error) {
        showToast("No se pudo preparar el paste para el dashboard", "rojo");
    }
});
guideFinish.addEventListener("click", closeGuide);
guideClose.addEventListener("click", closeGuide);
window.addEventListener("resize", positionGuidePopover);
window.addEventListener("scroll", positionGuidePopover, true);
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !guidePopover.hidden) {
        closeGuide();
    }
});

document.addEventListener("click", event => {
    const menu = document.getElementById("compartirDropdown");
    if (menu && !event.target.closest(".compartir-menu")) {
        menu.classList.remove("abierto");
    }
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

restoreSavedPaste();
startClock();
