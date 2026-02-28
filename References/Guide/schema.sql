-- ╔══════════════════════════════════════════════════════════════╗
-- ║  PasteVault — SQL Server Schema                             ║
-- ║  Ejecutar en SQL Server 2019+ o Azure SQL                   ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Crear base de datos
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'PasteVault')
    CREATE DATABASE PasteVault;
GO

USE PasteVault;
GO

-- ─── TABLA PRINCIPAL ─────────────────────────────────────────
CREATE TABLE Pastes (
    Id           NVARCHAR(12)     NOT NULL PRIMARY KEY,
    Title        NVARCHAR(100)    NOT NULL DEFAULT 'Sin título',
    Content      NVARCHAR(MAX)    NOT NULL,
    Language     NVARCHAR(30)     NOT NULL DEFAULT 'plain',
    PasswordHash NVARCHAR(80)     NULL,           -- BCrypt hash o NULL
    CreatedAt    DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    ExpiresAt    DATETIME2        NULL,            -- NULL = nunca expira
    Views        INT              NOT NULL DEFAULT 0,
    CreatedByIp  NVARCHAR(45)     NULL            -- IPv4 o IPv6
);
GO

-- ─── ÍNDICES ─────────────────────────────────────────────────
-- Para ordenar los recientes rápido
CREATE INDEX IX_Pastes_CreatedAt ON Pastes (CreatedAt DESC);
GO

-- Para limpieza de expirados
CREATE INDEX IX_Pastes_ExpiresAt ON Pastes (ExpiresAt) WHERE ExpiresAt IS NOT NULL;
GO

-- ─── LIMPIEZA AUTOMÁTICA (SQL Agent Job o ejecutar periódicamente) ─
-- Puedes programar este statement cada hora en un SQL Agent Job:
--   DELETE FROM Pastes WHERE ExpiresAt IS NOT NULL AND ExpiresAt < GETUTCDATE();

-- ─── DATOS DE PRUEBA ─────────────────────────────────────────
INSERT INTO Pastes (Id, Title, Content, Language, CreatedAt, Views)
VALUES
(
    'demo001',
    'Hola desde PasteVault',
    '// Bienvenido a PasteVault
// Un clon de WePaste hecho con C# + SQL Server

const greet = (name) => `Hola, ${name}! 👋`;
console.log(greet("mundo"));',
    'javascript',
    GETUTCDATE(),
    0
),
(
    'demo002',
    'Conexión SQL de ejemplo',
    '-- Ejemplo de query en PasteVault
SELECT Id, Title, Language, CreatedAt, Views
FROM Pastes
WHERE ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE()
ORDER BY CreatedAt DESC;',
    'sql',
    GETUTCDATE(),
    0
);
GO

-- ─── VERIFICAR ───────────────────────────────────────────────
SELECT * FROM Pastes;
GO
