using Microsoft.Data.SqlClient;
using BCrypt.Net;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Creación CORS: Peticiones del frontend hacia la API
builder.Services.AddCors(options =>
{
    options.AddPolicy("todos", policy =>
    {
        policy.AllowAnyOrigin();
        policy.AllowAnyHeader();
        policy.AllowAnyMethod();
    });
});

var app = builder.Build();
app.UseSwagger();
app.UseSwaggerUI();
app.UseCors("todos"); // CORS activado

// Conexión BBDD
string? connectionBBDD = builder.Configuration.GetConnectionString("Default");

#region Endpoints

// POST — Crear paste
app.MapPost("/api/pastes", async (NewPaste newpaste, HttpContext http) =>
{
    string? password = http.Request.Headers["X-Paste-Password"].FirstOrDefault();
    string? hashedPassword = !string.IsNullOrEmpty(password)
        ? BCrypt.Net.BCrypt.HashPassword(password)
        : null;
        
    // Comprobar contenido recibido
    if (string.IsNullOrWhiteSpace(newpaste.content))
    {
        return Results.BadRequest("El contenido del clipboard no puede ser vacío");
    }

    // ID clipboard
    string id = Guid.NewGuid().ToString("N")[..8];

    // Apertura de conexion BBDD
    using (var connection = new SqlConnection(connectionBBDD))
    {
        await connection.OpenAsync(); // abrir conexión

        using (var query = new SqlCommand(
            "INSERT INTO Pastes (Id, Contenido, Titulo, Visibilidad, Password) VALUES (@Id, @Contenido, @Titulo, @Visibilidad, @Password)", connection))
        {
            query.Parameters.AddWithValue("@Id",          id);
            query.Parameters.AddWithValue("@Contenido",   newpaste.content);
            query.Parameters.AddWithValue("@Titulo",      newpaste.title ?? "Sin título");
            query.Parameters.AddWithValue("@Visibilidad", newpaste.visibilidad ?? "publico");
            query.Parameters.AddWithValue("@Password", (object?)hashedPassword ?? DBNull.Value);
            await query.ExecuteNonQueryAsync();
        }
    }

    return Results.Ok(new { id, url = $"http://192.168.3.170/p/{id}" });
});

// PUT — Actualizar paste existente
app.MapPut("/api/pastes/{id}", async (string id, NewPaste newpaste, HttpContext http) =>
{
    string? password = http.Request.Headers["X-Paste-Password"].FirstOrDefault();

    using (var connection = new SqlConnection(connectionBBDD))
    {
        await connection.OpenAsync();

        // Primero comprobamos si el paste existe y obtenemos su password
        string? storedHash = null;
        string? visibilidad = null;

        using (var check = new SqlCommand(
            "SELECT Password, Visibilidad FROM Pastes WHERE Id = @Id", connection))
        {
            check.Parameters.AddWithValue("@Id", id);
            using (var reader = await check.ExecuteReaderAsync())
            {
                if (!await reader.ReadAsync())
                    return Results.NotFound("Paste no encontrado");

                storedHash  = reader.IsDBNull(reader.GetOrdinal("Password")) 
                    ? null 
                    : reader.GetString(reader.GetOrdinal("Password"));
                visibilidad = reader.GetString(reader.GetOrdinal("Visibilidad"));
            }
        }

        // Si es privado (invitados o estricto), validar contraseña
        if (visibilidad != "publico")
        {
            if (string.IsNullOrEmpty(password) || storedHash == null)
                return Results.Unauthorized();

            bool passwordCorrecta = BCrypt.Net.BCrypt.Verify(password, storedHash);

            if (!passwordCorrecta)
                return Results.Unauthorized();
        }

        // Contraseña válida — actualizar contenido
        using (var cmd = new SqlCommand(
            "UPDATE Pastes SET Contenido = @Contenido, Titulo = @Titulo WHERE Id = @Id", connection))
        {
            cmd.Parameters.AddWithValue("@Id",        id);
            cmd.Parameters.AddWithValue("@Contenido", newpaste.content);
            cmd.Parameters.AddWithValue("@Titulo",    newpaste.title ?? "Sin título");

            int filasAfectadas = await cmd.ExecuteNonQueryAsync();
            if (filasAfectadas == 0)
                return Results.NotFound("Paste no encontrado");

            return Results.Ok(new { id, url = $"http://192.168.3.170/p/{id}" });
        }
    }
});

// GET — Leer paste
app.MapGet("api/pastes/{id}", async (string id, HttpContext http) =>
{
    string? password = http.Request.Headers["X-Paste-Password"].FirstOrDefault();
    
    using (var connection = new SqlConnection(connectionBBDD))
    {
        await connection.OpenAsync();

        using (var query = new SqlCommand("SELECT * FROM Pastes WHERE Id = @Id", connection))
        {
            query.Parameters.AddWithValue("@Id", id);

            using (var reader = await query.ExecuteReaderAsync())
            {
                if (!await reader.ReadAsync())
                    return Results.NotFound("ID de clipboard no encontrado");

                string  contenido   = reader.GetString(reader.GetOrdinal("Contenido"));
                string  titulo      = reader.GetString(reader.GetOrdinal("Titulo"));
                string  visibilidad = reader.GetString(reader.GetOrdinal("Visibilidad"));
                string? storedHash  = reader.IsDBNull(reader.GetOrdinal("Password")) 
                    ? null 
                    : reader.GetString(reader.GetOrdinal("Password"));
                bool tienePassword  = storedHash != null;

                // Paste estricto — contraseña obligatoria
                if (visibilidad == "estricto")
                {
                    if (string.IsNullOrEmpty(password) || storedHash == null)
                        return Results.Unauthorized();

                    bool ok = BCrypt.Net.BCrypt.Verify(password, storedHash);
                    if (!ok)
                        return Results.Unauthorized();
                }

                return Results.Ok(new { id, contenido, titulo, visibilidad, tienePassword });
            }
        }
    }
});

// DELETE — Eliminar paste
app.MapDelete("/api/pastes/{id}", async (string id, HttpContext http) =>
{
    string? password = http.Request.Headers["X-Paste-Password"].FirstOrDefault();

    using (var connection = new SqlConnection(connectionBBDD))
    {
        await connection.OpenAsync();

        // Verificar contraseña si es privado
        string? storedHash  = null;
        string? visibilidad = null;

        using (var check = new SqlCommand(
            "SELECT Password, Visibilidad FROM Pastes WHERE Id = @Id", connection))
        {
            check.Parameters.AddWithValue("@Id", id);
            using (var reader = await check.ExecuteReaderAsync())
            {
                if (!await reader.ReadAsync())
                    return Results.NotFound("Paste no encontrado");

                storedHash  = reader.IsDBNull(reader.GetOrdinal("Password")) ? null : reader.GetString(reader.GetOrdinal("Password"));
                visibilidad = reader.GetString(reader.GetOrdinal("Visibilidad"));
            }
        }

        if (visibilidad != "publico")
        {
            if (string.IsNullOrEmpty(password) || storedHash == null)
                return Results.Unauthorized();

            if (!BCrypt.Net.BCrypt.Verify(password, storedHash))
                return Results.Unauthorized();
        }

        // Borrar
        using (var cmd = new SqlCommand("DELETE FROM Pastes WHERE Id = @Id", connection))
        {
            cmd.Parameters.AddWithValue("@Id", id);
            int filasAfectadas = await cmd.ExecuteNonQueryAsync();

            if (filasAfectadas == 0)
                return Results.NotFound("Paste no encontrado");

            return Results.Ok("Paste eliminado");
        }
    }
});

#endregion

app.Run();

record NewPaste(string content, string? title, string? visibilidad);