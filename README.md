# SApaste

Clipboard online para compartir texto y código de forma rápida dentro de una red privada (o pública con configuración adicional). Inspirado en herramientas como WePaste o Pastebin, pero desplegado en infraestructura propia sobre Proxmox.

---

## ¿Qué hace?

SApaste permite escribir o pegar cualquier texto, fragmento de código o nota, y obtener un enlace único para compartirlo con otras personas. Sin registro, sin complicaciones.

El flujo básico es:

1. El usuario escribe o pega su contenido en el editor
2. Opcionalmente protege el paste con contraseña o le asigna una expiración
3. Pulsa **Copiar al clipboard** — la app guarda el paste y devuelve un enlace único
4. Cualquier persona con ese enlace puede leer el contenido

---

## Funcionalidades

### Editor
- Área de texto con soporte de formato básico: **negrita**, *cursiva* y subrayado
- Contador de caracteres en tiempo real
- Botón de limpieza para resetear el editor

### Opciones del paste
- **Contraseña** — protege el paste; quien acceda al enlace necesitará introducirla para ver el contenido
- **Expiración** — el paste se elimina automáticamente pasado el tiempo elegido: 1 hora, 1 día, 7 días, o nunca

### Enlace único
- Cada paste genera una URL única (ej: `http://sapaste.local/p/aB3xY9z`)
- El enlace se puede copiar al portapapeles con un clic

### Indicador de conexión
- Punto verde **Conectado** cuando la API responde correctamente
- Punto rojo **Sin conexión** si el backend no está disponible

---

## Stack técnico

| Capa | Tecnología |
|------|------------|
| Frontend | HTML5, CSS3, JavaScript vanilla |
| Backend | C# ASP.NET Core 8 (Minimal API) |
| Base de datos | SQL Server Express |
| Servidor | Nginx (reverse proxy) |
| Infraestructura | Proxmox LXC (Debian) |

---

## Estructura del proyecto

```
sapaste/
├── frontend/
│   └── sapaste.html        # Interfaz completa (un solo archivo)
├── backend/
│   ├── Program.cs          # API C# con todos los endpoints
│   └── appsettings.json    # Configuración (connection string, puerto)
└── database/
    └── schema.sql          # Script de creación de la BBDD
```

---

## Endpoints de la API

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/pastes` | Crea un nuevo paste |
| `GET` | `/api/pastes/{id}` | Lee un paste por su ID |
| `GET` | `/api/pastes` | Lista los pastes públicos recientes |
| `DELETE` | `/api/pastes/{id}` | Elimina un paste |
| `GET` | `/health` | Comprueba si la API está activa |

---

## Despliegue

La aplicación corre íntegramente en un LXC de Proxmox con Debian. Nginx escucha en el puerto 80, sirve el frontend estático y redirige las peticiones `/api/` hacia la API C# que corre en el puerto 5000. SQL Server Express corre en el mismo contenedor.

```
Navegador
    ↓  :80
  Nginx
  ├── /        →  sapaste.html
  └── /api/    →  API C# :5000
                       ↓
                  SQL Server :1433
```

Para arrancar el backend manualmente:

```bash
cd /opt/sapaste
dotnet run
```

La API está configurada como servicio systemd, por lo que arranca automáticamente con el LXC.

---

## Acceso

- **Red local:** `http://192.168.1.XX` (IP del LXC)
- **Dominio local:** `http://sapaste.local` (requiere configuración DNS en el router)
- **Desde internet:** requiere port forwarding en el router y un dominio o servicio como DuckDNS

---

## Estado actual

- [x] Frontend base con editor y opciones
- [x] Formato de texto (negrita, cursiva, subrayado)
- [x] Indicador de conexión con la API
- [x] Esquema de base de datos
- [x] API C# con endpoints CRUD
- [ ] Conexión frontend → API (próximo paso)
- [ ] Verificación de contraseña en lectura
- [ ] Limpieza automática de pastes expirados
- [ ] Syntax highlighting por lenguaje
