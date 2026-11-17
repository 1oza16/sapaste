function showToast(message, type = "verde") {
    let container = document.getElementById("toast-container");

    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }

    const icons = { verde: "✓", amarillo: "⚠", rojo: "✕" };
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icon = document.createElement("span");
    icon.className = "toast-icono";
    icon.textContent = icons[type] || "•";

    const text = document.createElement("span");
    text.textContent = message;
    toast.append(icon, text);
    container.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3000);
}

function startClock() {
    const clock = document.getElementById("reloj");

    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");
        clock.textContent = `${hours}:${minutes}:${seconds}`;
    }

    updateClock();
    window.setInterval(updateClock, 1000);
}