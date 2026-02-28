// ╔══════════════════════════════════════════════════════════════╗
// ║  PasteVault - ASP.NET Core 8 Minimal API                   ║
// ║  Instalar paquetes:                                          ║
// ║    dotnet add package Microsoft.Data.SqlClient              ║
// ║    dotnet add package Microsoft.AspNetCore.Cors             ║
// ║    dotnet add package BCrypt.Net-Next                       ║
// ╚══════════════════════════════════════════════════════════════╝

using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using BCrypt.Net;
using System.Security.Cryptography;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ─── SERVICIOS ───────────────────────────────────────────────
builder.Services.AddCors(opts =>
    opts.AddPolicy("Frontend", p =>
        p.AllowAnyOrigin()   // En producción: .WithOrigins("https://tupagina.com")
         .AllowAnyMethod()
         .AllowAnyHeader()));

builder.Services.AddSingleton<PasteRepository>();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// ─── MIDDLEWARE ───────────────────────────────────────────────
app.UseCors("Frontend");

// ─── ENDPOINTS ────────────────────────────────────────────────

// POST /api/pastes — Crear nuevo paste
app.MapPost("/api/pastes", async (
    [FromBody] CreatePasteRequest req,
    PasteRepository repo,
    HttpContext ctx) =>
{
    if (string.IsNullOrWhiteSpace(req.Content))
        return Results.BadRequest(new { error = "El contenido no puede estar vacío" });

    if (req.Content.Length > 500_000)
        return Results.BadRequest(new { error = "Contenido demasiado grande (máx 500KB)" });

    var paste = new Paste
    {
        Id         = GenerateId(),
        Title      = req.Title?.Trim() ?? "Sin título",
        Content    = req.Content,
        Language   = req.Language ?? "plain",
        PasswordHash = string.IsNullOrEmpty(req.Password)
                        ? null
                        : BCrypt.Net.BCrypt.HashPassword(req.Password),
        ExpiresAt  = req.Expiry switch
        {
            "1h"  => DateTime.UtcNow.AddHours(1),
            "1d"  => DateTime.UtcNow.AddDays(1),
            "7d"  => DateTime.UtcNow.AddDays(7),
            _     => (DateTime?)null
        },
        CreatedAt  = DateTime.UtcNow,
        CreatedByIp = ctx.Connection.RemoteIpAddress?.ToString()
    };

    await repo.CreateAsync(paste);

    var baseUrl = $"{ctx.Request.Scheme}://{ctx.Request.Host}";
    return Results.Created($"/api/pastes/{paste.Id}", new
    {
        paste.Id,
        paste.Title,
        paste.Language,
        paste.CreatedAt,
        paste.ExpiresAt,
        IsProtected = paste.PasswordHash != null,
        Url = $"{baseUrl}/api/pastes/{paste.Id}"
    });
});

// GET /api/pastes/{id} — Leer paste (sin password)
app.MapGet("/api/pastes/{id}", async (
    string id,
    [FromQuery] string? password,
    PasteRepository repo) =>
{
    var paste = await repo.GetByIdAsync(id);
    if (paste is null) return Results.NotFound(new { error = "Paste no encontrado" });

    // Expirado
    if (paste.ExpiresAt.HasValue && paste.ExpiresAt.Value < DateTime.UtcNow)
    {
        await repo.DeleteAsync(id);
        return Results.NotFound(new { error = "Este paste ha expirado" });
    }

    // Protegido con contraseña
    if (paste.PasswordHash != null)
    {
        if (string.IsNullOrEmpty(password))
            return Results.Json(
                new { error = "Este paste requiere contraseña", requiresPassword = true },
                statusCode: 401);

        if (!BCrypt.Net.BCrypt.Verify(password, paste.PasswordHash))
            return Results.Json(
                new { error = "Contraseña incorrecta", requiresPassword = true },
                statusCode: 403);
    }

    await repo.IncrementViewsAsync(id);

    return Results.Ok(new
    {
        paste.Id,
        paste.Title,
        paste.Content,
        paste.Language,
        paste.CreatedAt,
        paste.ExpiresAt,
        paste.Views,
        IsProtected = paste.PasswordHash != null
    });
});

// GET /api/pastes — Listar pastes recientes (públicos)
app.MapGet("/api/pastes", async (
    PasteRepository repo,
    [FromQuery] int page = 1,
    [FromQuery] int size = 20) =>
{
    size = Math.Clamp(size, 1, 50);
    var pastes = await repo.GetRecentAsync(page, size);
    return Results.Ok(pastes.Select(p => new
    {
        p.Id,
        p.Title,
        p.Language,
        p.CreatedAt,
        p.ExpiresAt,
        p.Views,
        IsProtected = p.PasswordHash != null,
        Preview = p.Content.Length > 200 ? p.Content[..200] + "..." : p.Content
    }));
});

// DELETE /api/pastes/{id} — Eliminar paste
app.MapDelete("/api/pastes/{id}", async (string id, PasteRepository repo) =>
{
    var deleted = await repo.DeleteAsync(id);
    if (!deleted) return Results.NotFound(new { error = "Paste no encontrado" });
    return Results.Ok(new { message = "Paste eliminado" });
});

// GET /api/stats — Estadísticas globales
app.MapGet("/api/stats", async (PasteRepository repo) =>
{
    var stats = await repo.GetStatsAsync();
    return Results.Ok(stats);
});

// ─── HEALTH CHECK ─────────────────────────────────────────────
app.MapGet("/health", () => Results.Ok(new { status = "ok", time = DateTime.UtcNow }));

app.Run();

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
static string GenerateId() =>
    Convert.ToBase64String(RandomNumberGenerator.GetBytes(6))
            .Replace("+", "a").Replace("/", "b").Replace("=", "");

// ═══════════════════════════════════════════════════════════════
// MODELS
// ═══════════════════════════════════════════════════════════════
record CreatePasteRequest(
    string Content,
    string? Title,
    string? Language,
    string? Expiry,
    string? Password
);

class Paste
{
    public string  Id           { get; set; } = "";
    public string  Title        { get; set; } = "Sin título";
    public string  Content      { get; set; } = "";
    public string  Language     { get; set; } = "plain";
    public string? PasswordHash { get; set; }
    public DateTime CreatedAt   { get; set; }
    public DateTime? ExpiresAt  { get; set; }
    public int     Views        { get; set; }
    public string? CreatedByIp  { get; set; }
}

// ═══════════════════════════════════════════════════════════════
// REPOSITORY — SQL Server
// ═══════════════════════════════════════════════════════════════
class PasteRepository
{
    private readonly string _connStr;

    public PasteRepository(IConfiguration config)
    {
        _connStr = config.GetConnectionString("Default")
            ?? throw new InvalidOperationException("ConnectionString 'Default' no configurada");
    }

    private SqlConnection GetConnection() => new(_connStr);

    // ── CREATE ──────────────────────────────────────────────
    public async Task CreateAsync(Paste p)
    {
        const string sql = @"
            INSERT INTO Pastes (Id, Title, Content, Language, PasswordHash, CreatedAt, ExpiresAt, Views, CreatedByIp)
            VALUES (@Id, @Title, @Content, @Language, @PasswordHash, @CreatedAt, @ExpiresAt, 0, @CreatedByIp)";

        await using var conn = GetConnection();
        await conn.OpenAsync();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@Id",           p.Id);
        cmd.Parameters.AddWithValue("@Title",        p.Title);
        cmd.Parameters.AddWithValue("@Content",      p.Content);
        cmd.Parameters.AddWithValue("@Language",     p.Language);
        cmd.Parameters.AddWithValue("@PasswordHash", (object?)p.PasswordHash ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@CreatedAt",    p.CreatedAt);
        cmd.Parameters.AddWithValue("@ExpiresAt",    (object?)p.ExpiresAt ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@CreatedByIp",  (object?)p.CreatedByIp ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync();
    }

    // ── GET BY ID ───────────────────────────────────────────
    public async Task<Paste?> GetByIdAsync(string id)
    {
        const string sql = "SELECT * FROM Pastes WHERE Id = @Id";
        await using var conn = GetConnection();
        await conn.OpenAsync();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@Id", id);
        await using var r = await cmd.ExecuteReaderAsync();
        if (!await r.ReadAsync()) return null;
        return MapPaste(r);
    }

    // ── GET RECENT ──────────────────────────────────────────
    public async Task<List<Paste>> GetRecentAsync(int page, int size)
    {
        const string sql = @"
            SELECT * FROM Pastes
            WHERE PasswordHash IS NULL
              AND (ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE())
            ORDER BY CreatedAt DESC
            OFFSET @Offset ROWS FETCH NEXT @Size ROWS ONLY";

        await using var conn = GetConnection();
        await conn.OpenAsync();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@Offset", (page - 1) * size);
        cmd.Parameters.AddWithValue("@Size", size);
        await using var r = await cmd.ExecuteReaderAsync();
        var list = new List<Paste>();
        while (await r.ReadAsync()) list.Add(MapPaste(r));
        return list;
    }

    // ── INCREMENT VIEWS ─────────────────────────────────────
    public async Task IncrementViewsAsync(string id)
    {
        const string sql = "UPDATE Pastes SET Views = Views + 1 WHERE Id = @Id";
        await using var conn = GetConnection();
        await conn.OpenAsync();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@Id", id);
        await cmd.ExecuteNonQueryAsync();
    }

    // ── DELETE ──────────────────────────────────────────────
    public async Task<bool> DeleteAsync(string id)
    {
        const string sql = "DELETE FROM Pastes WHERE Id = @Id";
        await using var conn = GetConnection();
        await conn.OpenAsync();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@Id", id);
        return await cmd.ExecuteNonQueryAsync() > 0;
    }

    // ── STATS ───────────────────────────────────────────────
    public async Task<object> GetStatsAsync()
    {
        const string sql = @"
            SELECT
                COUNT(*)                                          AS TotalPastes,
                SUM(Views)                                        AS TotalViews,
                COUNT(CASE WHEN PasswordHash IS NOT NULL THEN 1 END) AS ProtectedPastes,
                COUNT(CASE WHEN ExpiresAt IS NOT NULL THEN 1 END)    AS ExpiringPastes
            FROM Pastes
            WHERE ExpiresAt IS NULL OR ExpiresAt > GETUTCDATE()";

        await using var conn = GetConnection();
        await conn.OpenAsync();
        await using var cmd = new SqlCommand(sql, conn);
        await using var r = await cmd.ExecuteReaderAsync();
        await r.ReadAsync();
        return new
        {
            TotalPastes     = r.GetInt32(0),
            TotalViews      = r.IsDBNull(1) ? 0 : r.GetInt32(1),
            ProtectedPastes = r.GetInt32(2),
            ExpiringPastes  = r.GetInt32(3)
        };
    }

    // ── MAPPER ──────────────────────────────────────────────
    private static Paste MapPaste(SqlDataReader r) => new()
    {
        Id           = r.GetString(r.GetOrdinal("Id")),
        Title        = r.GetString(r.GetOrdinal("Title")),
        Content      = r.GetString(r.GetOrdinal("Content")),
        Language     = r.GetString(r.GetOrdinal("Language")),
        PasswordHash = r.IsDBNull(r.GetOrdinal("PasswordHash")) ? null : r.GetString(r.GetOrdinal("PasswordHash")),
        CreatedAt    = r.GetDateTime(r.GetOrdinal("CreatedAt")),
        ExpiresAt    = r.IsDBNull(r.GetOrdinal("ExpiresAt"))    ? null : r.GetDateTime(r.GetOrdinal("ExpiresAt")),
        Views        = r.GetInt32(r.GetOrdinal("Views")),
        CreatedByIp  = r.IsDBNull(r.GetOrdinal("CreatedByIp"))  ? null : r.GetString(r.GetOrdinal("CreatedByIp"))
    };
}
