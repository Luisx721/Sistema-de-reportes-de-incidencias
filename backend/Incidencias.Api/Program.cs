using System.Security.Cryptography;
using Incidencias.Application;
using Incidencias.Infrastructure;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("Incidencias") ??
    Environment.GetEnvironmentVariable("INCIDENCIAS_DB");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException("Configura ConnectionStrings:Incidencias mediante configuración local o INCIDENCIAS_DB.");
builder.Services.AddSingleton<IIncidentStore>(_ => new PostgresIncidentStore(connectionString));
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.WithOrigins(
    builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:4200", "http://127.0.0.1:4200"])
    .AllowAnyHeader().AllowAnyMethod()));
var app = builder.Build();
app.UseCors();

async Task<SessionDto?> Current(HttpRequest request, IIncidentStore store, CancellationToken ct)
{
    var header = request.Headers.Authorization.ToString();
    return header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
        ? await store.GetSessionAsync(header[7..].Trim(), ct) : null;
}

app.MapPost("/api/sesiones", async (LoginDto login, IIncidentStore store, CancellationToken ct) =>
    await store.LoginAsync(login.Username, login.Password, ct) is { } session ? Results.Ok(session) : Results.Unauthorized());
app.MapGet("/api/sesiones/actual", async (HttpRequest request, IIncidentStore store, CancellationToken ct) =>
    await Current(request, store, ct) is { } session ? Results.Ok(session) : Results.Unauthorized());
app.MapDelete("/api/sesiones/actual", async (HttpRequest request, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(request, store, ct);
    if (session is null) return Results.Unauthorized();
    await store.EndSessionAsync(request.Headers.Authorization.ToString()[7..].Trim(), ct);
    return Results.NoContent();
});
app.MapPost("/api/incidencias", async (CreateIncidentDto request, IIncidentStore store, CancellationToken ct) =>
{
    try
    {
        var created = await store.CreateAsync(request, ct);
        return Results.Created($"/api/seguimiento/{created.Code}", created);
    }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapGet("/api/seguimiento/{code}", async (string code, IIncidentStore store, CancellationToken ct) =>
    await store.TrackAsync(code, ct) is { } status ? Results.Ok(status) : Results.NotFound());
app.MapGet("/api/incidencias", async (HttpRequest request, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(request, store, ct);
    if (session is null) return Results.Unauthorized();
    if (session.Profile is not ("Jefatura" or "Ordenanza" or "Mantenimiento" or "Desarrollo Físico" or "Autoridad")) return Results.Forbid();
    DateOnly? from = null, to = null;
    if (request.Query.TryGetValue("from", out var fromText) && !string.IsNullOrWhiteSpace(fromText))
    {
        if (!DateOnly.TryParse(fromText, out var parsedFrom)) return Results.BadRequest(new { error = "La fecha inicial no es válida." });
        from = parsedFrom;
    }
    if (request.Query.TryGetValue("to", out var toText) && !string.IsNullOrWhiteSpace(toText))
    {
        if (!DateOnly.TryParse(toText, out var parsedTo)) return Results.BadRequest(new { error = "La fecha final no es válida." });
        to = parsedTo;
    }
    var filter = new IncidentFilterDto(request.Query["query"], request.Query["category"], request.Query["location"], request.Query["state"], from, to);
    try { IncidentFilterRules.Validate(filter); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
    return Results.Ok(await store.ListAsync(filter, session, ct));
});app.MapGet("/api/incidencias/{code}", async (string code, HttpRequest request, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(request, store, ct);
    if (session is null) return Results.Unauthorized();
    var incident = await store.GetAuthorizedAsync(code, session, ct);
    return incident is null ? Results.StatusCode(StatusCodes.Status403Forbidden) : Results.Ok(incident);
});
app.MapPut("/api/incidencias/{code}", async (string code, ChangeIncidentDto change, HttpRequest request, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(request, store, ct);
    if (session is null) return Results.Unauthorized();
    try { return Results.Ok(await store.ChangeAsync(code, change, session, ct)); }
    catch (IncidentConflictException ex) { return Results.Conflict(new { error = ex.Message }); }
    catch (UnauthorizedAccessException) { return Results.StatusCode(StatusCodes.Status403Forbidden); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.Run();


