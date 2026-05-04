# SApaste — Frontend (Web de usuario)

Interfaz web de usuario de SApaste. Desarrollada con **HTML, CSS y JavaScript vanilla**, sin frameworks ni dependencias de construcción. Se sirve directamente desde Apache y se comunica con la API REST mediante `fetch`.

---

## Tecnologías

| Tecnología | Uso |
|---|---|
| HTML5 `contenteditable` | Editor de texto enriquecido |
| CSS3 con variables | Temas claro/oscuro |
| JavaScript vanilla | Lógica, peticiones a la API, DOM |
| DOMPurify 3.x | Sanitización del HTML antes de insertar en el DOM |
| Google Fonts | Tipografía: Syne + JetBrains Mono |

---

## Estructura de archivos

```
/var/www/html/
├── index.html
├── styles/
│   └── style.css
├── script/
│   └── editor.js
└── img/
    ├── SApaste2.png          ← Logo tema oscuro
    ├── SApaste3.png          ← Logo tema claro
    ├── SApasteIcon.png       ← Favicon
    └── icons/
        ├── theme_white/      ← Iconos para tema oscuro
        └── theme_black/      ← Iconos para tema claro
```

---

## Funcionamiento general

Al cargar la página, el JS comprueba si la URL sigue el patrón `/p/{id}`. Si es así, lanza automáticamente una petición GET a la API para cargar el paste correspondiente. Si no hay ID en la URL, se presenta el editor vacío listo para crear uno nuevo.

---

## Editor

El editor está basado en un `div` con `contenteditable="true"` que permite aplicar formato rico al texto mediante `document.execCommand()`:

| Acción | Comando |
|---|---|
| Negrita | `bold` |
| Cursiva | `italic` |
| Subrayado | `underline` |
| Alinear izquierda | `justifyLeft` |
| Centrar | `justifyCenter` |
| Alinear derecha | `justifyRight` |
| Lista sin orden | `insertUnorderedList` |
| Lista ordenada | `insertOrderedList` |

### Atajos de teclado

```
Ctrl + B  →  Negrita
Ctrl + I  →  Cursiva
Ctrl + U  →  Subrayado
Ctrl + S  →  Guardar
```

Al usar un atajo, el botón correspondiente de la toolbar destella brevemente con la clase `.active` para dar feedback visual.

---

## Temas claro / oscuro

El tema se detecta automáticamente al cargar mediante:

```js
window.matchMedia("(prefers-color-scheme: dark)").matches
```

El toggle manual añade o quita la clase `dark-mode` del `body`. Todos los colores están definidos como variables CSS en `:root` y sobreescritos en `body.dark-mode`, por lo que el cambio es instantáneo.

Los iconos e imágenes con versión clara y oscura usan las clases `.icono-claro` / `.icono-oscuro` que se muestran u ocultan según el tema activo:

```css
.icono-oscuro { display: none; }
body.dark-mode .icono-claro  { display: none; }
body.dark-mode .icono-oscuro { display: block; }
```

---

## Flujo de guardado

```
Usuario pulsa Guardar
        │
        ├─ ¿Tiene título? ──── No ──▶ Toast amarillo, foco en título
        │
        ├─ ¿Tiene contenido? ── No ──▶ Toast amarillo
        │
        ├─ ¿Ya existe el paste? (currentPasteId)
        │       ├─ Sí ──▶ PUT /api/pastes/{id}  (con X-Paste-Password si es privado)
        │       └─ No ──▶ Abre modal de visibilidad
        │                       │
        │               Usuario elige modo + contraseña (si aplica)
        │                       │
        │                       └─▶ POST /api/pastes
        │
        └─ Respuesta OK ──▶ Actualiza URL, activa botones, badge "Guardado"
```

---

## Modos de visibilidad

Al crear un paste, un modal presenta tres opciones:

| Modo | Ver | Editar |
|---|---|---|
| `publico` | Cualquiera | Cualquiera |
| `invitados` | Cualquiera | Solo con contraseña |
| `estricto` | Solo con contraseña | Solo con contraseña |

Si se elige `invitados` o `estricto`, aparece un campo de contraseña en el modal. La contraseña se envía siempre en el header `X-Paste-Password`, nunca en el body.

---

## Flujo de carga desde URL

```
Acceso a /p/{id}
        │
        └─▶ GET /api/pastes/{id}
                │
                ├─ 200 OK
                │       ├─ visibilidad: "publico"   ──▶ Carga editor normal
                │       └─ visibilidad: "invitados" ──▶ Muestra login con opción invitado
                │
                ├─ 401 Unauthorized ──▶ Muestra login (paste estricto)
                │
                └─ 404 Not Found ──▶ Toast rojo "Paste no encontrado"
```

### Login en pastes privados

**Privado con invitados** — aparece un modal con dos opciones:
- **Acceder con contraseña** → llama a `POST /api/pastes/{id}/verify`, si es correcta carga el editor con edición completa
- **Entrar como invitado** → carga el contenido pero bloquea el editor, toolbar, guardar y eliminar

**Privado estricto** — solo aparece el campo de contraseña, sin opción de invitado. La verificación se hace contra el mismo endpoint `/verify`.

---

## Peticiones a la API

Todas las peticiones usan `fetch`. La constante `API_URL` centraliza la URL base:

```js
const API_URL = "https://sapaste.duckdns.org/api/pastes";
```

Las contraseñas siempre van en el header, nunca en el body:

```js
headers: {
    "Content-Type": "application/json",
    "X-Paste-Password": password
}
```

---

## Componentes de UI

| Componente | Descripción |
|---|---|
| **Toast** | Notificaciones temporales (3s) en esquina superior derecha. Tipos: `verde`, `amarillo`, `rojo` |
| **Spinner** | Overlay de carga durante peticiones a la API |
| **Modal confirmación** | Confirmación antes de eliminar un paste |
| **Modal visibilidad** | Selector de modo al crear un paste nuevo |
| **Modal login** | Acceso a pastes privados con campo de contraseña |
| **Historial lateral** | Panel deslizante con el registro de acciones y sus marcas de tiempo relativas |
| **Estado badge** | Indicador *Sin guardar* / *Guardado* en la esquina superior del editor |
| **Reloj** | Hora actual actualizada cada segundo |
