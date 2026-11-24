<div align="center">
    <picture>
      <img alt="SApaste" src="../docs/img/screenshots/api/minimal%20api.jpg" width="500">
      <br><br>
    </picture>
</div>

---

# API de SApaste

API REST desarrollada con **.NET 8 Minimal API** que gestiona la persistencia y la lógica de negocio de **SApaste**. Recibe las peticiones del cliente, valida contraseñas con **BCrypt**, gestiona la autenticación del panel de administración mediante **JWT** y se comunica con **Microsoft SQL Server**.

---

## Tabla de contenidos

- [Tecnologías y paquetes](#tecnologías-y-paquetes)
- [Configuración](#configuración)
- [Uso de Swagger en desarrollo](#uso-de-swagger-en-desarrollo)
- [Seguridad y autenticación](#seguridad-y-autenticación)
- [Endpoints de usuario](#endpoints-de-usuario)
- [Endpoints de administración](#endpoints-de-administración)
- [Resumen de endpoints](#resumen-de-endpoints)

---

## Tecnologías y paquetes

| Paquete / Componente | Uso |
|---|---|
| `Microsoft.Data.SqlClient` | Conexión y ejecución de consultas contra SQL Server |
| `BCrypt.Net-Next` | Generación y verificación de hashes de contraseñas |
| `Microsoft.AspNetCore.Authentication.JwtBearer` | Validación de tokens JWT en el panel de administración |
| `Swashbuckle.AspNetCore` (`Swagger` / `Swagger UI`) | Documentación y pruebas interactivas de endpoints |
| CORS (`"todos"`) | Política permisiva de origen, cabeceras y métodos configurada en desarrollo |

---

## Configuración

La cadena de conexión a la base de datos y la clave para firmar los tokens JWT se definen en `appsettings.json` (o variables de entorno / secrets):

```json
{
  "ConnectionStrings": {
    "Default": "Server=...;Database=SApaste;..."
  },
  "Jwt": {
    "Key": "clave_secreta_para_firmar_jwt"
  }
}
```

---

## Uso de Swagger en desarrollo

La API integra **Swagger** y **Swagger UI** (`AddEndpointsApiExplorer`, `AddSwaggerGen`, `UseSwagger` y `UseSwaggerUI`) para facilitar el desarrollo y las pruebas del backend:

* **Exploración de endpoints:** Permite consultar de forma visual todas las rutas disponibles (`/api/pastes/...` y `/api/admin/...`), sus métodos HTTP, parámetros y esquemas de datos.
* **Pruebas interactivas:** Facilita lanzar peticiones de prueba directamente desde el navegador para comprobar respuestas (`200`, `400`, `401`, `404`), validar el envío de cabeceras como `X-Paste-Password` y probar el flujo de autenticación con `Authorization: Bearer {token}` sin depender aún del frontend.
* **Apoyo durante el desarrollo:** Ayuda a verificar contratos de entrada y salida (como `NewPaste`, `LoginRequest` y las respuestas de estadísticas y pastes) mientras se construye y depura la aplicación.

<div align="center">
  <img src="../docs/img/screenshots/api/swagger%20api.gif" alt="Demostración de Swagger UI en la API de SApaste" width="700">
  <br>
  <sub><em>Interfaz de Swagger UI probando los endpoints de la API de SApaste.</em></sub>
</div>

---

## Seguridad y autenticación

* **Contraseñas de pastes:** Nunca viajan en la URL ni en el body. Se envían en la cabecera HTTP personalizada `X-Paste-Password: {contraseña}`, se verifican en servidor con `BCrypt.Net.BCrypt.Verify(...)` y el hash nunca se expone al cliente.
* **Autenticación de administrador:** El login genera un token JWT firmado con `HMAC-SHA256` y validez de **8 horas** (`ClockSkew = TimeSpan.Zero`), que debe enviarse en la cabecera `Authorization: Bearer {token}` para acceder a los endpoints protegidos del panel admin.

---

## Endpoints de usuario

### `POST /api/pastes`
Crea un nuevo paste, genera un ID único de 8 caracteres y devuelve la URL asociada.

* **Header opcional:** `X-Paste-Password: {contraseña}` (si se envía, se cifra con BCrypt antes de guardarla).
* **Body:**
  ```json
  {
    "content": "<p>Texto con <b>formato</b></p>",
    "title": "Mi paste",
    "visibilidad": "publico"
  }
  ```
* **Valores por defecto / posibles:** si `title` es nulo se guarda como `"Sin título"`; si `visibilidad` es nula se guarda como `"publico"` (valores habituales: `publico`, `invitados`, `estricto`).
* **Respuestas:**
  * `200 OK`: `{"id": "a3f9b21c", "url": "https://sapaste.duckdns.org/p/a3f9b21c"}`
  * `400 Bad Request`: el contenido (`content`) está vacío o solo contiene espacios.

---

### `GET /api/pastes/{id}`
Obtiene los datos de un paste por su identificador.

* **Header condicional:** `X-Paste-Password: {contraseña}` (obligatorio si la `visibilidad` del paste es `"estricto"`).
* **Respuestas:**
  * `200 OK`:
    ```json
    {
      "id": "a3f9b21c",
      "titulo": "Mi paste",
      "contenido": "<p>Texto con <b>formato</b></p>",
      "visibilidad": "publico",
      "tienePassword": false
    }
    ```
  * `401 Unauthorized`: paste con visibilidad `"estricto"` sin contraseña o con contraseña incorrecta.
  * `404 Not Found`: no existe un paste con ese `id`.

---

### `PUT /api/pastes/{id}`
Actualiza el `Titulo` y el `Contenido` de un paste existente.

* **Header condicional:** `X-Paste-Password: {contraseña}` (obligatorio si la visibilidad del paste es distinta de `"publico"`).
* **Body:**
  ```json
  {
    "content": "<p>Contenido actualizado</p>",
    "title": "Nuevo título",
    "visibilidad": "invitados"
  }
  ```
* **Respuestas:**
  * `200 OK`: `{"id": "a3f9b21c", "url": "https://sapaste.duckdns.org/p/a3f9b21c"}`
  * `401 Unauthorized`: paste privado sin contraseña válida.
  * `404 Not Found`: el paste no existe.

---

### `DELETE /api/pastes/{id}`
Elimina un paste de la base de datos.

* **Header condicional:** `X-Paste-Password: {contraseña}` (obligatorio si la visibilidad del paste es distinta de `"publico"`).
* **Respuestas:**
  * `200 OK`: `"Paste eliminado"`
  * `401 Unauthorized`: paste privado sin contraseña válida.
  * `404 Not Found`: el paste no existe.

---

### `POST /api/pastes/{id}/verify`
Comprueba si una contraseña coincide con el hash almacenado del paste sin devolver su contenido.

* **Header obligatorio:** `X-Paste-Password: {contraseña}`
* **Respuestas:**
  * `200 OK`: contraseña válida (sin body).
  * `400 Bad Request`: falta la cabecera `X-Paste-Password` o el paste no tiene contraseña configurada.
  * `401 Unauthorized`: la contraseña no coincide.
  * `404 Not Found`: el paste no existe.

---

## Endpoints de administración

### `POST /api/admin/login`
Valida las credenciales de un usuario en `Usuarios_Admin` y devuelve un token JWT.

* **Body:**
  ```json
  {
    "username": "admin",
    "password": "tu_password"
  }
  ```
* **Respuestas:**
  * `200 OK`: `{"token": "eyJhbGciOi..."}`
  * `401 Unauthorized`: usuario inexistente o contraseña incorrecta.

---

### `GET /api/admin/pastes`
Devuelve el listado completo de pastes ordenados por `FechaCreacion DESC` junto con un resumen estadístico por visibilidad.

* **Autenticación:** Requiere token JWT válido (`Authorization: Bearer {token}`).
* **Respuestas:**
  * `200 OK`:
    ```json
    {
      "stats": {
        "total": 10,
        "publicos": 5,
        "invitados": 3,
        "estrictos": 2
      },
      "pastes": [
        {
          "id": "a3f9b21c",
          "contenido": "<p>...</p>",
          "titulo": "Ejemplo",
          "visibilidad": "publico",
          "creado": "2026-11-19T08:00:00"
        }
      ]
    }
    ```
  * `401 Unauthorized`: token ausente, inválido o expirado.

---

## Resumen de endpoints

| Método | Endpoint | Autenticación | Descripción |
|---|---|---|---|
| `POST` | `/api/pastes` | `X-Paste-Password` (opcional) | Crear paste |
| `GET` | `/api/pastes/{id}` | `X-Paste-Password` (si es `estricto`) | Obtener paste por ID |
| `PUT` | `/api/pastes/{id}` | `X-Paste-Password` (si no es `publico`) | Actualizar título y contenido |
| `DELETE` | `/api/pastes/{id}` | `X-Paste-Password` (si no es `publico`) | Eliminar paste |
| `POST` | `/api/pastes/{id}/verify` | `X-Paste-Password` (obligatorio) | Verificar contraseña sin exponer contenido |
| `POST` | `/api/admin/login` | Credenciales en body | Iniciar sesión y obtener JWT |
| `GET` | `/api/admin/pastes` | Bearer JWT (`RequireAuthorization`) | Listar pastes y estadísticas del panel admin |
