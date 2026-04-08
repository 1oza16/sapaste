using Microsoft.Data.SqlClient;

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
app.MapPost("/api/pastes", async (NewPaste newpaste) =>
{
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
                "INSERT INTO Pastes (Id, Contenido) VALUES (@Id, @Contenido)", connection))
        {
            query.Parameters.AddWithValue("@Id", id);
            query.Parameters.AddWithValue("@Contenido", newpaste.content);
            await query.ExecuteNonQueryAsync();
        }
    }

    return Results.Ok(new { id, url = $"http://192.168.3.170/p/{id}" });
});

// GET — Leer paste
app.MapGet("api/pastes/{id}", async (string id) =>
{
    // Abrimos conexion a BBDD
    using (var connection = new SqlConnection(connectionBBDD))
    {
        // Espera a apertura de conexion
        await connection.OpenAsync();

        // Consulta a BBDD por ID
        using (var query = new SqlCommand("SELECT * FROM Pastes WHERE Id = @Id", connection))
        {
            query.Parameters.AddWithValue("@Id", id);

            using (var reader = await query.ExecuteReaderAsync())
            {
                // Advertencia en caso de no encontrar ID en BBDD
                if (!await reader.ReadAsync())
                {
                    return Results.NotFound("ID de clipboard no encontrado");
                }

                // Obtención del contenido y titulo del clipboard
                string contenido = reader.GetString(reader.GetOrdinal("Contenido"));
                string titulo    = reader.GetString(reader.GetOrdinal("Titulo"));

                return Results.Ok(new { id, contenido, titulo });
            }
        }
    }
});

// DELETE — Eliminar paste
app.MapDelete("/api/pastes/{id}", async (string id) =>
{
    // Abrimos conexión
    using (var connection = new SqlConnection(connectionBBDD))
    {
        await connection.OpenAsync();

        // Preparamos la query para borrar
        using (var cmd = new SqlCommand("DELETE FROM Pastes WHERE Id = @Id", connection))
        {
            cmd.Parameters.AddWithValue("@Id", id);

            // Ejecutamos y obtenemos el número de filas afectadas
            int filasAfectadas = await cmd.ExecuteNonQueryAsync();

            // En caso de que no se borre nada, el paste no existe
            if (filasAfectadas == 0)
                return Results.NotFound("Paste no encontrado");

            // En caso de que se borre correctamente
            return Results.Ok("Paste eliminado");
        }
    }
});

#endregion

app.Run();

record NewPaste(string content, string? title, string? password);