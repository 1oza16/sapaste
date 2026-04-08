// ╔═══════════════════════════════════════════════════════╗
// ║  SApaste — API simplificada                           ║
// ║  Instalar antes de ejecutar:                          ║
// ║    dotnet add package Microsoft.Data.SqlClient        ║
// ║    dotnet add package BCrypt.Net-Next                 ║
// ╚═══════════════════════════════════════════════════════╝

using Microsoft.Data.SqlClient;

// ── 1. CREAR LA APP ──────────────────────────────────────────
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(o => o.AddPolicy("todos", p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));
var app = builder.Build();
app.UseCors("todos");

// ── 2. CONEXIÓN A LA BASE DE DATOS ──────────────────────────
// Cambia esto con tu IP, usuario y contraseña de SQL Server
string connectionString = "Server=localhost;Database=SApaste;User Id=SA;Password=TuPassword;TrustServerCertificate=True;";

// ── 3. FUNCIÓN AUXILIAR: generar un ID corto aleatorio ───────
string GenerarId()
{
    return Guid.NewGuid().ToString("N")[..8]; // ejemplo: "a3f9b21c"
}

// ═══════════════════════════════════════════════════════════════
// ENDPOINTS — cada uno es una "puerta" que escucha una URL
// ═══════════════════════════════════════════════════════════════

// ── CREAR PASTE ──────────────────────────────────────────────
// El frontend hace: POST /api/pastes  con { titulo, contenido, password, expira }
app.MapPost("/api/pastes", async (PasteNuevo datos) =>
{
    // Comprobar que no llegue vacío
    if (string.IsNullOrWhiteSpace(datos.Contenido))
        return Results.BadRequest("El contenido no puede estar vacío");

    // Generar el ID y calcular la fecha de expiración
    string id = GenerarId();
    DateTime? expira = datos.Expira switch
    {
        "1h" => DateTime.UtcNow.AddHours(1),
        "1d" => DateTime.UtcNow.AddDays(1),
        "7d" => DateTime.UtcNow.AddDays(7),
        _    => null  // null = nunca expira
    };

    // Hashear la contraseña si viene (nunca guardar contraseñas en texto plano)
    string? hashPassword = null;
    if (!string.IsNullOrEmpty(datos.Password))
        hashPassword = BCrypt.Net.BCrypt.HashPassword(datos.Password);

    // Guardar en la base de datos
    using var conn = new SqlConnection(connectionString);
    await conn.OpenAsync();

    var query = "INSERT INTO Pastes (Id, Titulo, Contenido, Password, CreadoEn, ExpiraEn) " +
                "VALUES (@Id, @Titulo, @Contenido, @Password, @CreadoEn, @ExpiraEn)";

    using var cmd = new SqlCommand(query, conn);
    cmd.Parameters.AddWithValue("@Id",        id);
    cmd.Parameters.AddWithValue("@Titulo",    datos.Titulo ?? "Sin título");
    cmd.Parameters.AddWithValue("@Contenido", datos.Contenido);
    cmd.Parameters.AddWithValue("@Password",  (object?)hashPassword ?? DBNull.Value);
    cmd.Parameters.AddWithValue("@CreadoEn",  DateTime.UtcNow);
    cmd.Parameters.AddWithValue("@ExpiraEn",  (object?)expira ?? DBNull.Value);
    await cmd.ExecuteNonQueryAsync();

    // Responder al frontend con el ID y la URL
    return Results.Ok(new { id, url = $"http://sapaste.local/p/{id}" });
});


// ── LEER PASTE ───────────────────────────────────────────────
// El frontend hace: GET /api/pastes/a3f9b21c
// Si tiene contraseña:  GET /api/pastes/a3f9b21c?password=1234
app.MapGet("/api/pastes/{id}", async (string id, string? password) =>
{
    using var conn = new SqlConnection(connectionString);
    await conn.OpenAsync();

    using var cmd = new SqlCommand("SELECT * FROM Pastes WHERE Id = @Id", conn);
    cmd.Parameters.AddWithValue("@Id", id);

    using var reader = await cmd.ExecuteReaderAsync();

    // Si no existe ninguna fila, el paste no existe
    if (!await reader.ReadAsync())
        return Results.NotFound("Paste no encontrado");

    // Leer los valores de la fila
    string  contenido    = reader.GetString(reader.GetOrdinal("Contenido"));
    string  titulo       = reader.GetString(reader.GetOrdinal("Titulo"));
    string? hashPassword = reader.IsDBNull(reader.GetOrdinal("Password")) ? null : reader.GetString(reader.GetOrdinal("Password"));
    DateTime? expiraEn   = reader.IsDBNull(reader.GetOrdinal("ExpiraEn")) ? null : reader.GetDateTime(reader.GetOrdinal("ExpiraEn"));

    // Comprobar si el paste ha expirado
    if (expiraEn.HasValue && expiraEn.Value < DateTime.UtcNow)
        return Results.NotFound("Este paste ha expirado");

    // Comprobar la contraseña si el paste está protegido
    if (hashPassword != null)
    {
        if (string.IsNullOrEmpty(password))
            return Results.Unauthorized(); // no envió contraseña

        if (!BCrypt.Net.BCrypt.Verify(password, hashPassword))
            return Results.Unauthorized(); // contraseña incorrecta
    }

    // Todo bien — devolver el paste al frontend
    return Results.Ok(new { id, titulo, contenido });
});


// ── ELIMINAR PASTE ───────────────────────────────────────────
// El frontend hace: DELETE /api/pastes/a3f9b21c
app.MapDelete("/api/pastes/{id}", async (string id) =>
{
    using var conn = new SqlConnection(connectionString);
    await conn.OpenAsync();

    using var cmd = new SqlCommand("DELETE FROM Pastes WHERE Id = @Id", conn);
    cmd.Parameters.AddWithValue("@Id", id);
    await cmd.ExecuteNonQueryAsync();

    return Results.Ok("Paste eliminado");
});


// ── HEALTH CHECK ─────────────────────────────────────────────
// El frontend llama a esto para saber si la API está viva
// GET /health  →  devuelve "ok"
app.MapGet("/health", () => Results.Ok("ok"));


// ── 4. ARRANCAR EL SERVIDOR ──────────────────────────────────
app.Run();


// ═══════════════════════════════════════════════════════════════
// ESTRUCTURA DEL JSON QUE ESPERA EL ENDPOINT DE CREAR PASTE
// El frontend enviará algo así:
// {
//   "titulo":    "Mi paste",
//   "contenido": "Hola mundo",
//   "password":  "1234",       <- opcional
//   "expira":    "1d"          <- opcional: "1h", "1d", "7d" o null
// }
// ═══════════════════════════════════════════════════════════════
record PasteNuevo(string Contenido, string? Titulo, string? Password, string? Expira);