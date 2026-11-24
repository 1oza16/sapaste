<div align="center">
    <picture>
      <img alt="SApaste" src="../docs/img/screenshots/sql/mssql.png" width="400">
      <br><br>
    </picture>
</div>


# Base de datos de SApaste

Script de **Microsoft SQL Server** que crea la base de datos `SApaste` y las tablas utilizadas para guardar los pastes y las cuentas de administración.

---

## Tabla de contenidos

- [Requisitos](#requisitos)
- [Estructura](#estructura)
- [Tablas](#tablas)
- [Ejecución](#ejecución)
- [Notas](#notas)

---

## Requisitos

- Una instancia de **Microsoft SQL Server**.
- **SQL Server Management Studio (SSMS)**, Azure Data Studio o una herramienta compatible para ejecutar scripts de SQL Server.

---

## Estructura

```text
database/
├── README.md
└── schema.sql
```

`schema.sql` crea la base de datos y define su estructura inicial.

---

## Tablas

### `Pastes`

Almacena el contenido y la configuración de cada paste.

| Columna | Tipo | Descripción |
|---|---|---|
| `Id` | `NVARCHAR(12)` | Identificador del paste y clave primaria. |
| `Contenido` | `NVARCHAR(MAX)` | Contenido del paste; admite texto con formato HTML. |
| `Titulo` | `NVARCHAR(100)` | Título. Si no se indica, su valor es `Sin título`. |
| `Visibilidad` | `NVARCHAR(20)` | Nivel de visibilidad; por defecto, `publico`. |
| `PassHash` | `NVARCHAR(255)` | Hash de contraseña opcional para proteger el paste. |
| `FechaCreacion` | `DATETIME2` | Fecha de creación en UTC; por defecto, usa `SYSUTCDATETIME()`. |

### `Usuarios_Admin`

Almacena las cuentas que pueden autenticarse en el panel de administración.

| Columna | Tipo | Descripción |
|---|---|---|
| `Id` | `INT IDENTITY(1,1)` | Identificador autoincremental y clave primaria. |
| `Username` | `NVARCHAR(100)` | Nombre de usuario único. |
| `PassHash` | `NVARCHAR(255)` | Hash de la contraseña. |
| `Rol` | `NVARCHAR(50)` | Rol de la cuenta; por defecto, `admin`. |

---

## Ejecución

1. Abre `schema.sql` en SSMS o en otra herramienta compatible con SQL Server.
2. Conéctate a la instancia donde quieras alojar la base de datos.
3. Ejecuta el script completo. Este crea `SApaste`, la selecciona y crea las dos tablas.

El script utiliza `GO`, un separador de lotes reconocido por herramientas de SQL Server como SSMS; no es una instrucción SQL estándar.

---

## Notas

- La base de datos se crea como `SApaste`, que es el nombre esperado por la API del proyecto.
- `PassHash` está preparado para almacenar hashes, no contraseñas en texto plano.
- `Visibilidad` es una columna de texto con valor predeterminado; el esquema no restringe sus valores mediante una lista de opciones.
- El script inicializa la estructura, pero no inserta usuarios de administración ni datos de ejemplo.