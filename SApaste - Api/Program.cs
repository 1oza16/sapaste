using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BCrypt.Net;
using Microsoft.AspNetCore.Identity.Data;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Panel admin
var jwtKey = builder.Configuration["Jwt:Key"]!;
var jwtBytes = Encoding.UTF8.GetBytes(jwtKey);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey        = new SymmetricSecurityKey(jwtBytes),
            ValidateIssuer          = false,
            ValidateAudience        = false,
            ClockSkew               = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

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

// Panel admin
app.UseAuthentication();
app.UseAuthorization();

// Conexión BBDD
string? connectionBBDD = builder.Configuration.GetConnectionString("Default");

#region Endpoints SApaste

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
            "INSERT INTO Pastes (Id, Contenido, Titulo, Visibilidad, PassHash) VALUES (@Id, @Contenido, @Titulo, @Visibilidad, @PassHash)", connection))
        {
            query.Parameters.AddWithValue("@Id",          id);
            query.Parameters.AddWithValue("@Contenido",   newpaste.content);
            query.Parameters.AddWithValue("@Titulo",      newpaste.title ?? "Sin título");
            query.Parameters.AddWithValue("@Visibilidad", newpaste.visibilidad ?? "publico");
            query.Parameters.AddWithValue("@PassHash", (object?)hashedPassword ?? DBNull.Value);
            await query.ExecuteNonQueryAsync();
        }
    }

    return Results.Ok(new { id, url = $"https://sapaste.duckdns.org/p/{id}"});
});

// POST — Verificar contraseña (Login Invitados)
app.MapPost("/api/pastes/{id}/verify", async (string id, HttpContext http) =>
{
    string? password = http.Request.Headers["X-Paste-Password"].FirstOrDefault();

    if (string.IsNullOrEmpty(password))
        return Results.BadRequest("Contraseña requerida");

    using (var connection = new SqlConnection(connectionBBDD))
    {
        await connection.OpenAsync();

        using (var cmd = new SqlCommand(
            "SELECT PassHash FROM Pastes WHERE Id = @Id", connection))
        {
            cmd.Parameters.AddWithValue("@Id", id);
            using (var reader = await cmd.ExecuteReaderAsync())
            {
                if (!await reader.ReadAsync())
                    return Results.NotFound("Paste no encontrado");

                string? storedHash = reader.IsDBNull(reader.GetOrdinal("PassHash"))
                    ? null
                    : reader.GetString(reader.GetOrdinal("PassHash"));

                if (storedHash == null)
                    return Results.BadRequest("Este paste no tiene contraseña");

                bool ok = BCrypt.Net.BCrypt.Verify(password, storedHash);
                return ok ? Results.Ok() : Results.Unauthorized();
            }
        }
    }
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
            "SELECT PassHash, Visibilidad FROM Pastes WHERE Id = @Id", connection))
        {
            check.Parameters.AddWithValue("@Id", id);
            using (var reader = await check.ExecuteReaderAsync())
            {
                if (!await reader.ReadAsync())
                    return Results.NotFound("Paste no encontrado");

                storedHash = reader.IsDBNull(reader.GetOrdinal("PassHash")) ? null : reader.GetString(reader.GetOrdinal("PassHash"));
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

            return Results.Ok(new { id, url = $"https://sapaste.duckdns.org/p/{id}" });
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
                string? storedHash = reader.IsDBNull(reader.GetOrdinal("PassHash")) ? null : reader.GetString(reader.GetOrdinal("PassHash"));
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
            "SELECT PassHash, Visibilidad FROM Pastes WHERE Id = @Id", connection))
        {
            check.Parameters.AddWithValue("@Id", id);
            using (var reader = await check.ExecuteReaderAsync())
            {
                if (!await reader.ReadAsync())
                    return Results.NotFound("Paste no encontrado");

                storedHash = reader.IsDBNull(reader.GetOrdinal("PassHash")) ? null : reader.GetString(reader.GetOrdinal("PassHash"));
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

#region Panel Admin

// TEMPORAL — solo para crear el primer usuario, eliminar después -> Podemos aprovecharlo para meter users en admin
app.MapPost("/api/setup", async (string username, string password) =>
{
    string hash = BCrypt.Net.BCrypt.HashPassword(password);
    using var connection = new SqlConnection(connectionBBDD);
    await connection.OpenAsync();
    using var cmd = new SqlCommand(
        "INSERT INTO Usuarios_Admin (Username, PassHash) VALUES (@U, @H)", connection);
    cmd.Parameters.AddWithValue("@U", username);
    cmd.Parameters.AddWithValue("@H", hash);
    await cmd.ExecuteNonQueryAsync();
    return Results.Ok("Usuario creado");
});

// POST — Login admin
app.MapPost("/api/admin/login", async (LoginRequest login) =>
{
    using var connection = new SqlConnection(connectionBBDD);
    await connection.OpenAsync();

    using var cmd = new SqlCommand(
        "SELECT PassHash, Rol FROM Usuarios_Admin WHERE Username = @U", connection);
    cmd.Parameters.AddWithValue("@U", login.username);

    using var reader = await cmd.ExecuteReaderAsync();
    if (!await reader.ReadAsync())
        return Results.Unauthorized();

    string storedHash = reader.GetString(reader.GetOrdinal("PassHash"));
    string rol        = reader.GetString(reader.GetOrdinal("Rol"));

    if (!BCrypt.Net.BCrypt.Verify(login.password, storedHash))
        return Results.Unauthorized();

    // Generar JWT
    var claims = new[]
    {
        new Claim(ClaimTypes.Name, login.username),
        new Claim(ClaimTypes.Role, rol)
    };

    var key   = new SymmetricSecurityKey(jwtBytes);
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    var token = new JwtSecurityToken(
        claims:  claims,
        expires: DateTime.UtcNow.AddHours(8),
        signingCredentials: creds
    );

    string tokenString = new JwtSecurityTokenHandler().WriteToken(token);
    return Results.Ok(new { token = tokenString });
});

// GET — Todos los pastes (admin)
app.MapGet("/api/admin/pastes", async (HttpContext http) =>
{
    // Verificar JWT
    if (!http.User.Identity?.IsAuthenticated ?? true)
        return Results.Unauthorized();

    using var connection = new SqlConnection(connectionBBDD);
    await connection.OpenAsync();

    using var cmd = new SqlCommand(
        "SELECT Id, Titulo, Visibilidad, FechaCreacion FROM Pastes ORDER BY FechaCreacion DESC", connection);

    var pastes = new List<object>();
    int pub = 0, inv = 0, strict = 0;

    using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        string vis = reader.GetString(reader.GetOrdinal("Visibilidad"));
        if (vis == "publico")   pub++;
        if (vis == "invitados") inv++;
        if (vis == "estricto")  strict++;

        pastes.Add(new
        {
            id          = reader.GetString(reader.GetOrdinal("Id")),
            titulo      = reader.GetString(reader.GetOrdinal("Titulo")),
            visibilidad = vis,
            creado      = reader.GetDateTime(reader.GetOrdinal("FechaCreacion"))
        });
    }

    return Results.Ok(new
    {
        stats = new { total = pastes.Count, publicos = pub, invitados = inv, estrictos = strict },
        pastes
    });
}).RequireAuthorization();

#endregion

app.Run();

record NewPaste(string content, string? title, string? visibilidad); // Usado en los endpoints de SApaste 
record LoginRequest(string username, string password); // Usado en los endpoints de Panel Admin