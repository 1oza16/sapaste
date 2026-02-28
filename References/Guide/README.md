# PasteVault — Clon de WePaste
> **Stack:** Frontend (HTML/CSS/JS) · Backend (C# ASP.NET Core 8) · Base de datos (SQL Server)

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE                              │
│   index.html  ──  CSS vars + DM Mono + Syne fonts           │
│   JavaScript  ──  fetch() → REST API · localStorage fallback│
└────────────────────────────┬────────────────────────────────┘
                             │  HTTP/JSON  (CORS habilitado)
┌────────────────────────────▼────────────────────────────────┐
│                     BACKEND (C#)                             │
│   ASP.NET Core 8 Minimal API                                 │
│   ├─ POST   /api/pastes        → Crear paste                 │
│   ├─ GET    /api/pastes/{id}   → Leer paste                  │
│   ├─ GET    /api/pastes        → Listar recientes            │
│   ├─ DELETE /api/pastes/{id}   → Eliminar paste              │
│   └─ GET    /api/stats         → Estadísticas                │
│                                                              │
│   Servicios: BCrypt · RandomNumberGenerator · CORS           │
└────────────────────────────┬────────────────────────────────┘
                             │  Microsoft.Data.SqlClient
┌────────────────────────────▼────────────────────────────────┐
│                   BASE DE DATOS                              │
│   SQL Server 2019+  /  Azure SQL                             │
│   Tabla: Pastes                                              │
│   ├─ Id (PK) · Title · Content · Language                    │
│   ├─ PasswordHash (BCrypt) · CreatedAt · ExpiresAt · Views   │
│   └─ Índices en CreatedAt y ExpiresAt                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Archivos entregados

| Archivo | Descripción |
|---------|-------------|
| `index.html` | Frontend completo — editor, lista de pastes, modal de vista |
| `Program.cs` | Backend C# — todos los endpoints + Repository + Models |
| `schema.sql` | Script SQL para crear la base de datos y la tabla |
| `appsettings.json` | Configuración del servidor (connection string) |
| `README.md` | Este archivo |

---

## Puesta en marcha

### 1. Base de datos

```sql
-- En SQL Server Management Studio o sqlcmd:
-- Ejecutar schema.sql
sqlcmd -S localhost -i schema.sql
```

Ajusta la connection string en `appsettings.json`:
```json
"Default": "Server=TU_SERVIDOR;Database=PasteVault;User Id=sa;Password=TU_PASSWORD;TrustServerCertificate=True;"
```

### 2. Backend C#

```bash
# Crear proyecto (si no existe)
dotnet new web -n PasteVault
cd PasteVault

# Copiar Program.cs y appsettings.json aquí, luego:
dotnet add package Microsoft.Data.SqlClient
dotnet add package BCrypt.Net-Next

dotnet run
# → API escuchando en http://localhost:5000
```

### 3. Frontend

- Abre `index.html` en el navegador directamente **o** sírvelo con cualquier servidor estático.
- Cambia `BASE_URL` en el JS del `index.html`:
  ```js
  const BASE_URL = 'http://localhost:5000'; // dev
  // const BASE_URL = 'https://tudominio.com'; // producción
  ```
- Sin backend, el frontend funciona en **modo demo local** (localStorage).

---

## Endpoints de la API

| Método | Ruta | Body / Query | Descripción |
|--------|------|--------------|-------------|
| `POST` | `/api/pastes` | `{content, title?, language?, expiry?, password?}` | Crear paste |
| `GET` | `/api/pastes/{id}` | `?password=xxx` (si protegido) | Leer paste |
| `GET` | `/api/pastes` | `?page=1&size=20` | Listar públicos recientes |
| `DELETE` | `/api/pastes/{id}` | — | Eliminar paste |
| `GET` | `/api/stats` | — | Estadísticas globales |
| `GET` | `/health` | — | Health check |

### Ejemplo de creación (curl)
```bash
curl -X POST http://localhost:5000/api/pastes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Mi primer paste",
    "content": "console.log(\"hola mundo\")",
    "language": "javascript",
    "expiry": "1d"
  }'
```

### Respuesta
```json
{
  "id": "aB3xY9z",
  "title": "Mi primer paste",
  "language": "javascript",
  "createdAt": "2025-10-01T12:00:00Z",
  "expiresAt": "2025-10-02T12:00:00Z",
  "isProtected": false,
  "url": "http://localhost:5000/api/pastes/aB3xY9z"
}
```

---

## Funcionalidades implementadas

- ✅ Crear pastes con ID único (base62)
- ✅ Syntax highlighting por lenguaje (selector)
- ✅ Expiración: nunca / 1h / 1d / 7d
- ✅ Protección por contraseña (BCrypt en backend)
- ✅ Contador de visitas (incremento en cada GET)
- ✅ Listado de pastes recientes (paginado)
- ✅ Eliminar pastes
- ✅ Editor con números de línea + Tab support
- ✅ Copiado de URL al portapapeles
- ✅ Modo demo local (sin backend, usa localStorage)
- ✅ CORS configurado
- ✅ Validación de tamaño máximo (500KB)

## Extensiones posibles

- [ ] Syntax highlighting real (Prism.js / Highlight.js)
- [ ] Autenticación de usuarios (JWT)
- [ ] API key para uso programático
- [ ] Estadísticas por paste (gráficas)
- [ ] Exportar paste como archivo
- [ ] Diff viewer entre dos pastes
- [ ] Límite de rate (IP-based)
- [ ] Despliegue en Proxmox con Docker + Nginx reverse proxy

---

## Despliegue en Proxmox (LXC / VM)

```bash
# En un LXC Debian/Ubuntu
apt install dotnet-runtime-8.0 sqlserver-conf

# Publicar la API
dotnet publish -c Release -o /opt/pastevault

# Configurar como servicio systemd
cat > /etc/systemd/system/pastevault.service << EOF
[Unit]
Description=PasteVault API

[Service]
WorkingDirectory=/opt/pastevault
ExecStart=/usr/bin/dotnet /opt/pastevault/PasteVault.dll
Restart=always
Environment=ASPNETCORE_ENVIRONMENT=Production

[Install]
WantedBy=multi-user.target
EOF

systemctl enable --now pastevault
```

Luego configura **Nginx** como reverse proxy para exponer el puerto 80/443.
