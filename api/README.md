# api

API REST desarrollada con **.NET 8 Minimal API** que gestiona la persistencia y la lógica de negocio de SApaste. Recibe las peticiones del frontend, valida las contraseñas, aplica el cifrado y se comunica con la base de datos SQL Server.

---

## Tecnologías

| Paquete | Uso |
|---|---|
| `Microsoft.Data.SqlClient` | Conexión con SQL Server |
| `BCrypt.Net-Next` | Hash y verificación de contraseñas |
| `Microsoft.AspNetCore.Authentication.JwtBearer` | Autenticación JWT (panel admin) |

---

## Configuración

La cadena de conexión se define en `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "Default": "Server=...;Database=SApaste;..."
  },
  "Jwt": {
    "Key": "clave_secreta"
  }
}
```

---

## Seguridad

Las contraseñas nunca viajan en el body ni en la URL. Se envían en un header HTTP personalizado en todas las peticiones que lo requieran:

```
X-Paste-Password: {contraseña}
```

La API extrae este valor, lo verifica contra el hash BCrypt almacenado y devuelve `401 Unauthorized` si no coincide. El hash nunca se devuelve al cliente.

---

## Endpoints de usuario

### POST `/api/pastes`
Crea un nuevo paste. Si la visibilidad es `invitados` o `estricto`, la contraseña es obligatoria en el header.

**Header opcional:**
```
X-Paste-Password: {contraseña}
```

**Body:**
```json
{
  "content": "<p>Texto con <b>formato</b></p>",
  "title": "Mi paste",
  "visibilidad": "publico"
}
```

**Valores posibles de `visibilidad`:** `publico`, `invitados`, `estricto`

**Respuesta `200 OK`:**
```json
{
  "id": "a3f9b21c",
  "url": "https://sapaste.duckdns.org/p/a3f9b21c"
}
```

**Respuesta `400 Bad Request`:** el contenido está vacío.

---

### GET `/api/pastes/{id}`
Obtiene el contenido de un paste por su ID.

- Si es **público** o de tipo **invitados**: no requiere header.
- Si es **estricto**: requiere el header con la contraseña correcta.

**Header condicional:**
```
X-Paste-Password: {contraseña}
```

**Respuesta `200 OK`:**
```json
{
  "id": "a3f9b21c",
  "titulo": "Mi paste",
  "contenido": "<p>Texto con <b>formato</b></p>",
  "visibilidad": "publico",
  "tienePassword": false
}
```

**Respuesta `401 Unauthorized`:** paste estricto sin contraseña o contraseña incorrecta.

**Respuesta `404 Not Found`:** el ID no existe.

---

### PUT `/api/pastes/{id}`
Actualiza el título y contenido de un paste existente. Si el paste es de tipo `invitados` o `estricto`, la contraseña es obligatoria.

**Header condicional:**
```
X-Paste-Password: {contraseña}
```

**Body:**
```json
{
  "content": "<p>Contenido actualizado</p>",
  "title": "Nuevo título",
  "visibilidad": "invitados"
}
```

**Respuesta `200 OK`:**
```json
{
  "id": "a3f9b21c",
  "url": "https://sapaste.duckdns.org/p/a3f9b21c"
}
```

**Respuesta `401 Unauthorized`:** contraseña incorrecta o ausente en paste privado.

**Respuesta `404 Not Found`:** el ID no existe.

---

### DELETE `/api/pastes/{id}`
Elimina un paste. Si el paste es de tipo `invitados` o `estricto`, la contraseña es obligatoria.

**Header condicional:**
```
X-Paste-Password: {contraseña}
```

**Respuesta `200 OK`:**
```json
"Paste eliminado"
```

**Respuesta `401 Unauthorized`:** contraseña incorrecta o ausente en paste privado.

**Respuesta `404 Not Found`:** el ID no existe.

---

### POST `/api/pastes/{id}/verify`
Verifica si una contraseña es correcta para un paste sin exponer su contenido. Se usa antes de cargar un paste privado con invitados para validar las credenciales.

**Header obligatorio:**
```
X-Paste-Password: {contraseña}
```

**Respuesta `200 OK`:** contraseña correcta, sin body.

**Respuesta `400 Bad Request`:** no se envió contraseña o el paste no tiene contraseña.

**Respuesta `401 Unauthorized`:** contraseña incorrecta.

**Respuesta `404 Not Found`:** el ID no existe.

---

## Resumen de endpoints

| Método | Endpoint | Autenticación | Descripción |
|---|---|---|---|
| POST | `/api/pastes` | Header opcional | Crear paste |
| GET | `/api/pastes/{id}` | Header condicional | Obtener paste |
| PUT | `/api/pastes/{id}` | Header condicional | Actualizar paste |
| DELETE | `/api/pastes/{id}` | Header condicional | Eliminar paste |
| POST | `/api/pastes/{id}/verify` | Header obligatorio | Verificar contraseña |
