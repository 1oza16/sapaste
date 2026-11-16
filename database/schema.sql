CREATE DATABASE SApaste;
GO

USE SApaste;
GO

CREATE TABLE Pastes (
    Id            NVARCHAR(12)  NOT NULL PRIMARY KEY,
    Contenido     NVARCHAR(MAX) NOT NULL,
    Titulo        NVARCHAR(100) NOT NULL DEFAULT N'Sin título',
    Visibilidad   NVARCHAR(20)  NOT NULL DEFAULT 'publico',
    PassHash      NVARCHAR(255) NULL,
    FechaCreacion DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE Usuarios_Admin (
    Id       INT           IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Username NVARCHAR(100) NOT NULL UNIQUE,
    PassHash NVARCHAR(255) NOT NULL,
    Rol      NVARCHAR(50)  NOT NULL DEFAULT 'admin'
);
GO