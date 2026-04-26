CREATE DATABASE SApaste;
GO

USE SApaste;
GO

CREATE TABLE Pastes (
    Id          NVARCHAR(12)    NOT NULL    PRIMARY KEY,
    Contenido   NVARCHAR(MAX)   NOT NULL,
    Titulo      NVARCHAR(100)   NULL,
    Visibilidad NVARCHAR(20)    NOT NULL    DEFAULT 'publico',
    Password    NVARCHAR(100)   NULL
);
GO