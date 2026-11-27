using System.Text;
using Incidencias.Application;
using Incidencias.Domain;
using Incidencias.Infrastructure;
using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Incidencias") ??
    Environment.GetEnvironmentVariable("INCIDENCIAS_DB");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException("Configura ConnectionStrings:Incidencias mediante configuración local o INCIDENCIAS_DB.");

var photosPath = builder.Configuration["Photos:Path"] ??
                 Environment.GetEnvironmentVariable("INCIDENCIAS_PHOTOS_PATH") ??
                 Path.Combine(builder.Environment.ContentRootPath, "uploads", "fotos");

var photoStorage = new PhotoStorage(photosPath);
var postgresStore = new PostgresIncidentStore(connectionString, photoStorage);

builder.Services.AddSingleton(photoStorage);
builder.Services.AddSingleton<IIncidentStore>(postgresStore);
builder.Services.AddSingleton<IAccountStore>(postgresStore);
builder.Services.AddSingleton<ICatalogStore>(postgresStore);
builder.Services.AddSingleton<IPhotoStore>(postgresStore);
builder.Services.AddSingleton<IReportStore>(postgresStore);

builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.WithOrigins(
    builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:4200", "http://127.0.0.1:4200"])
    .AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddDataProtection();

var app = builder.Build();
app.UseCors();

const string photoUploadHeader = "X-Photo-Upload-Token";
var photoUploadProtector = app.Services.GetRequiredService<IDataProtectionProvider>()
    .CreateProtector("Incidencias.GuestPhotoUpload.v1")
    .ToTimeLimitedDataProtector();

bool CanUploadGuestPhoto(HttpRequest request, string code)
{
    if (!request.Headers.TryGetValue(photoUploadHeader, out var values) || values.Count != 1)
        return false;

    var token = values[0];
    if (string.IsNullOrWhiteSpace(token)) return false;

    try
    {
        var allowedCode = photoUploadProtector.Unprotect(token);
        return string.Equals(allowedCode, code.Trim(), StringComparison.OrdinalIgnoreCase);
    }
    catch (CryptographicException) { return false; }
    catch (FormatException) { return false; }
}

// ==========================================
// Funciones auxiliares de sesión y permisos
// ==========================================

async Task<SessionDto?> Current(HttpRequest request, IIncidentStore store, CancellationToken ct)
{
    var header = request.Headers.Authorization.ToString();
    return header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
        ? await store.GetSessionAsync(header[7..].Trim(), ct) : null;
}

IResult RequireAdmin(SessionDto? session, out IResult? error)
{
    if (session is null) { error = Results.Unauthorized(); return error; }
    if (!IncidentRules.CanManageAdministration(session.Profile)) { error = Results.StatusCode(StatusCodes.Status403Forbidden); return error; }
    error = null;
    return Results.Ok();
}

// ==========================================
// Sesión y Autenticación
// ==========================================

async Task<IResult> HandleLogin(LoginDto login, IIncidentStore store, CancellationToken ct)
{
    if (string.IsNullOrWhiteSpace(login.Username) || string.IsNullOrEmpty(login.Password))
        return Results.BadRequest(new { error = "Usuario y contraseña requeridos." });
    var session = await store.LoginAsync(login.Username, login.Password, ct);
    return session is not null ? Results.Ok(session) : Results.Unauthorized();
}

async Task<IResult> HandleGetCurrent(HttpRequest req, IIncidentStore store, CancellationToken ct)
{
    var session = await Current(req, store, ct);
    return session is not null ? Results.Ok(session) : Results.Unauthorized();
}

async Task<IResult> HandleLogout(HttpRequest req, IIncidentStore store, CancellationToken ct)
{
    var session = await Current(req, store, ct);
    if (session is null) return Results.Unauthorized();
    await store.EndSessionAsync(req.Headers.Authorization.ToString()[7..].Trim(), ct);
    return Results.NoContent();
}

app.MapPost("/api/sesiones", HandleLogin);
app.MapPost("/api/sesion", HandleLogin);
app.MapGet("/api/sesiones/actual", HandleGetCurrent);
app.MapGet("/api/sesion", HandleGetCurrent);
app.MapDelete("/api/sesiones/actual", HandleLogout);
app.MapDelete("/api/sesion", HandleLogout);

// ==========================================
// Catálogos Públicos y Seguimiento
// ==========================================

app.MapGet("/api/catalogos", async (IIncidentStore store, CancellationToken ct) =>
    Results.Ok(await store.GetCatalogsAsync(ct)));

app.MapGet("/api/seguimiento/{code}", async (string code, IIncidentStore store, CancellationToken ct) =>
    await store.TrackAsync(code, ct) is { } status ? Results.Ok(status) : Results.NotFound(new { error = "Incidencia no encontrada." }));

// Incidencias: creación, listado, detalle y modificación

// Registra una nueva incidencia y devuelve una respuesta pública con su código de seguimiento.

app.MapPost("/api/incidencias", async (CreateIncidentDto request, HttpRequest req, IIncidentStore store, CancellationToken ct) =>
{
    try
    {
        // Obtiene la sesión del usuario que está realizando el reporte.
        var session = await Current(req, store, ct);

        // Guarda la incidencia y obtiene los datos del reporte creado.
        var created = await store.CreateAsync(request, session, ct);

       var result = IncidentContractMapper.ToCreateResult(created);
if (session is null && !created.IsDuplicate)
{
    req.HttpContext.Response.Headers.CacheControl = "no-store";
    result = result with
    {
        PhotoUploadToken = photoUploadProtector.Protect(
            created.Code, TimeSpan.FromMinutes(15))
    };
}

return Results.Created($"/api/seguimiento/{created.Code}", result);
    }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
    catch (UnauthorizedAccessException) { return Results.StatusCode(StatusCodes.Status403Forbidden); }
});

// Obtiene el listado de incidencias para los usuarios internos.
app.MapGet("/api/incidencias", async (HttpRequest request, IIncidentStore store, CancellationToken ct) =>
{
    // Comprueba que el usuario tenga una sesión activa.
    var session = await Current(request, store, ct);
    if (session is null) return Results.Unauthorized();

    // Verifica que el usuario tenga un perfil autorizado para consultar las incidencias.
    if (!IncidentRules.IsInternalProfile(session.Profile)) return Results.StatusCode(StatusCodes.Status403Forbidden);

    // Prepara los filtros de fecha que se pueden enviar desde la consulta.
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

    // Organiza los filtros recibidos para buscar las incidencias.
    var filter = new IncidentFilterDto(
        request.Query["query"],
        request.Query["category"],
        request.Query["location"],
        request.Query["state"],
        from,
        to,
        request.Query["urgency"]);

    // Comprueba que los filtros tengan valores válidos.
    try { IncidentFilterRules.Validate(filter); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }

    // Devuelve las incidencias que coinciden con los filtros.
    return Results.Ok(await store.ListAsync(filter, session, ct));
});
app.MapGet("/api/incidencias/publicas", async (string? category, string? state, IIncidentStore store, CancellationToken ct) =>
    Results.Ok(await store.ListPublicAsync(category, state, ct)));
app.MapGet("/api/incidencias/{code}", async (string code, HttpRequest request, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(request, store, ct);
    if (session is null) return Results.Unauthorized();
    var incident = await store.GetAuthorizedAsync(code, session, ct);
    return incident is null ? Results.StatusCode(StatusCodes.Status403Forbidden) : Results.Ok(incident);
});

app.MapGet("/api/incidencia/{id}", async (string id, HttpRequest request, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(request, store, ct);
    if (session is null) return Results.Unauthorized();
    var incident = await store.GetAuthorizedAsync(id, session, ct);
    return incident is null ? Results.StatusCode(StatusCodes.Status403Forbidden) : Results.Ok(incident);
});

app.MapPut("/api/incidencias/{code}", async (string code, ChangeIncidentDto change, HttpRequest request, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(request, store, ct);
    if (session is null) return Results.Unauthorized();
    try { return Results.Ok(await store.ChangeAsync(code, change, session, ct)); }
    catch (IncidentConflictException ex) { return Results.Conflict(new { error = ex.Message }); }
    catch (UnauthorizedAccessException) { return Results.StatusCode(StatusCodes.Status403Forbidden); }
    catch (KeyNotFoundException) { return Results.NotFound(new { error = "Incidencia no encontrada." }); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapPatch("/api/incidencia/{code}/estado", async (string code, ChangeIncidentDto change, HttpRequest request, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(request, store, ct);
    if (session is null) return Results.Unauthorized();
    try { return Results.Ok(await store.ChangeAsync(code, change, session, ct)); }
    catch (IncidentConflictException ex) { return Results.Conflict(new { error = ex.Message }); }
    catch (UnauthorizedAccessException) { return Results.StatusCode(StatusCodes.Status403Forbidden); }
    catch (KeyNotFoundException) { return Results.NotFound(new { error = "Incidencia no encontrada." }); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapPatch("/api/incidencia/{code}/prioridad", async (string code, ChangeIncidentDto change, HttpRequest request, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(request, store, ct);
    if (session is null) return Results.Unauthorized();
    try { return Results.Ok(await store.ChangeAsync(code, change, session, ct)); }
    catch (IncidentConflictException ex) { return Results.Conflict(new { error = ex.Message }); }
    catch (UnauthorizedAccessException) { return Results.StatusCode(StatusCodes.Status403Forbidden); }
    catch (KeyNotFoundException) { return Results.NotFound(new { error = "Incidencia no encontrada." }); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

// ==========================================
// Exportación CSV (RF-24)
// ==========================================

async Task<IResult> HandleExportCsv(HttpRequest request, IIncidentStore store, CancellationToken ct)
{
    var session = await Current(request, store, ct);
    if (session is null) return Results.Unauthorized();
    if (!IncidentRules.IsInternalProfile(session.Profile)) return Results.StatusCode(StatusCodes.Status403Forbidden);

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

    var filter = new IncidentFilterDto(
        request.Query["query"],
        request.Query["category"],
        request.Query["location"],
        request.Query["state"],
        from,
        to,
        request.Query["urgency"]);

    try { IncidentFilterRules.Validate(filter); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }

    var incidents = await store.ListAsync(filter, session, ct);
    var csv = IncidentCsvExporter.Build(incidents);
    var bytes = Encoding.UTF8.GetBytes(csv);
    return Results.File(bytes, "text/csv; charset=utf-8", "incidencias.csv");
}

app.MapGet("/api/incidencias/exportar", HandleExportCsv);
app.MapGet("/api/exportaciones", HandleExportCsv);

// ==========================================
// Fotografías (RF-03)
// ==========================================

app.MapPost("/api/incidencias/{code}/fotos", async (string code, HttpRequest req, IPhotoStore photoStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
   if (session is null && !CanUploadGuestPhoto(req, code))
    return Results.Unauthorized();

    if (!req.HasFormContentType)
        return Results.BadRequest(new { error = "La solicitud debe ser multipart/form-data." });

    var form = await req.ReadFormAsync(ct);
    var file = form.Files.GetFile("foto") ?? form.Files.FirstOrDefault();
    if (file is null || file.Length == 0)
        return Results.BadRequest(new { error = "Selecciona un archivo de imagen." });

    if (file.Length > PhotoRules.MaxBytes)
        return Results.BadRequest(new { error = "La foto no debe superar los 5 MiB." });

    byte[] content;
    using (var ms = new MemoryStream((int)file.Length))
    {
        await file.CopyToAsync(ms, ct);
        content = ms.ToArray();
    }

    try
    {
        var upload = new PhotoUploadDto(file.FileName, file.ContentType, content);
        var created = await photoStore.AddAsync(code, upload, session, ct);
        return Results.Created(created.Url, created);
    }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
    catch (KeyNotFoundException) { return Results.NotFound(new { error = "Incidencia no encontrada." }); }
    catch (UnauthorizedAccessException) { return Results.StatusCode(StatusCodes.Status403Forbidden); }
});

app.MapGet("/api/incidencias/{code}/fotos", async (string code, HttpRequest req, IPhotoStore photoStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    if (session is null) return Results.Unauthorized();
    return Results.Ok(await photoStore.ListAsync(code, session, ct));
});

app.MapGet("/api/fotos/{id:int}", async (int id, HttpRequest req, IPhotoStore photoStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    if (session is null) return Results.Unauthorized();
    var photo = await photoStore.GetFileAsync(id, session, ct);
    return photo is not null
        ? Results.File(photo.Content, photo.ContentType, photo.FileName)
        : Results.NotFound(new { error = "Foto no encontrada." });
});

// ==========================================
// Estadísticas (RF-21)
// ==========================================

async Task<IResult> HandleStatistics(HttpRequest request, IReportStore reportStore, IIncidentStore store, CancellationToken ct)
{
    var session = await Current(request, store, ct);
    if (session is null) return Results.Unauthorized();
    if (!IncidentRules.IsInternalProfile(session.Profile)) return Results.StatusCode(StatusCodes.Status403Forbidden);

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

    var filter = new IncidentFilterDto(
        request.Query["query"],
        request.Query["category"],
        request.Query["location"],
        request.Query["state"],
        from,
        to,
        request.Query["urgency"]);

    try { IncidentFilterRules.Validate(filter); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }

    return Results.Ok(await reportStore.GetStatisticsAsync(filter, session, ct));
}

app.MapGet("/api/estadisticas", HandleStatistics);
app.MapGet("/api/reportes/estadisticas", HandleStatistics);

// ==========================================
// Administración: Cuentas (RF-22)
// ==========================================

app.MapGet("/api/administracion/cuentas", async (HttpRequest req, IAccountStore accountStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    return Results.Ok(await accountStore.GetAccountsAsync(ct));
});
app.MapGet("/api/cuentas", async (HttpRequest req, IAccountStore accountStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    return Results.Ok(await accountStore.GetAccountsAsync(ct));
});

app.MapPost("/api/administracion/cuentas", async (AccountInputDto input, HttpRequest req, IAccountStore accountStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    try { return Results.Created("/api/administracion/cuentas", await accountStore.CreateAccountAsync(input, ct)); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/cuentas", async (AccountInputDto input, HttpRequest req, IAccountStore accountStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    try { return Results.Created("/api/administracion/cuentas", await accountStore.CreateAccountAsync(input, ct)); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapPut("/api/administracion/cuentas/{id:int}", async (int id, AccountInputDto input, HttpRequest req, IAccountStore accountStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    try
    {
        var updated = await accountStore.UpdateAccountAsync(id, input, ct);
        return updated is not null ? Results.Ok(updated) : Results.NotFound(new { error = "Cuenta no encontrada." });
    }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPut("/api/cuenta/{id:int}", async (int id, AccountInputDto input, HttpRequest req, IAccountStore accountStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    try
    {
        var updated = await accountStore.UpdateAccountAsync(id, input, ct);
        return updated is not null ? Results.Ok(updated) : Results.NotFound(new { error = "Cuenta no encontrada." });
    }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapPatch("/api/administracion/cuentas/{id:int}/estado", async (int id, SetActiveDto body, HttpRequest req, IAccountStore accountStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    var ok = await accountStore.SetAccountActiveAsync(id, body.Active, ct);
    return ok ? Results.Ok(new { active = body.Active }) : Results.NotFound(new { error = "Cuenta no encontrada." });
});

// ==========================================
// Administración: Catálogos (RF-23)
// ==========================================

// Categorías
app.MapGet("/api/administracion/categorias", async (bool? all, HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    return Results.Ok(await catStore.GetCategoriesAsync(all ?? true, ct));
});
app.MapPost("/api/administracion/categorias", async (CategoryInputDto input, HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    try { return Results.Created("/api/administracion/categorias", await catStore.CreateCategoryAsync(input, ct)); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPut("/api/administracion/categorias/{id:int}", async (int id, CategoryInputDto input, HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    var updated = await catStore.UpdateCategoryAsync(id, input, ct);
    return updated is not null ? Results.Ok(updated) : Results.NotFound(new { error = "Categoría no encontrada." });
});
app.MapPatch("/api/administracion/categorias/{id:int}/estado", async (int id, SetActiveDto body, HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    var ok = await catStore.SetCategoryActiveAsync(id, body.Active, ct);
    return ok ? Results.Ok(new { active = body.Active }) : Results.NotFound(new { error = "Categoría no encontrada." });
});

// Ubicaciones
app.MapGet("/api/administracion/ubicaciones", async (bool? all, HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    return Results.Ok(await catStore.GetLocationsAsync(all ?? true, ct));
});
app.MapPost("/api/administracion/ubicaciones", async (LocationInputDto input, HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    try { return Results.Created("/api/administracion/ubicaciones", await catStore.CreateLocationAsync(input, ct)); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPut("/api/administracion/ubicaciones/{id:int}", async (int id, LocationInputDto input, HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    var updated = await catStore.UpdateLocationAsync(id, input, ct);
    return updated is not null ? Results.Ok(updated) : Results.NotFound(new { error = "Ubicación no encontrada." });
});
app.MapPatch("/api/administracion/ubicaciones/{id:int}/estado", async (int id, SetActiveDto body, HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    var ok = await catStore.SetLocationActiveAsync(id, body.Active, ct);
    return ok ? Results.Ok(new { active = body.Active }) : Results.NotFound(new { error = "Ubicación no encontrada." });
});

// Edificios
app.MapGet("/api/administracion/edificios", async (bool? all, HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    return Results.Ok(await catStore.GetBuildingsAsync(all ?? true, ct));
});
app.MapPost("/api/administracion/edificios", async (BuildingInputDto input, HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    try { return Results.Created("/api/administracion/edificios", await catStore.CreateBuildingAsync(input, ct)); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPut("/api/administracion/edificios/{id:int}", async (int id, BuildingInputDto input, HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    var updated = await catStore.UpdateBuildingAsync(id, input, ct);
    return updated is not null ? Results.Ok(updated) : Results.NotFound(new { error = "Edificio no encontrado." });
});
app.MapPatch("/api/administracion/edificios/{id:int}/estado", async (int id, SetActiveDto body, HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    var ok = await catStore.SetBuildingActiveAsync(id, body.Active, ct);
    return ok ? Results.Ok(new { active = body.Active }) : Results.NotFound(new { error = "Edificio no encontrado." });
});

// Áreas
app.MapGet("/api/administracion/areas", async (bool? all, HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    return Results.Ok(await catStore.GetAreasAsync(all ?? true, ct));
});
app.MapPost("/api/administracion/areas", async (AreaInputDto input, HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    try { return Results.Created("/api/administracion/areas", await catStore.CreateAreaAsync(input, ct)); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPut("/api/administracion/areas/{id:int}", async (int id, AreaInputDto input, HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    var updated = await catStore.UpdateAreaAsync(id, input, ct);
    return updated is not null ? Results.Ok(updated) : Results.NotFound(new { error = "Área no encontrada." });
});
app.MapPatch("/api/administracion/areas/{id:int}/estado", async (int id, SetActiveDto body, HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    var ok = await catStore.SetAreaActiveAsync(id, body.Active, ct);
    return ok ? Results.Ok(new { active = body.Active }) : Results.NotFound(new { error = "Área no encontrada." });
});

// Roles
app.MapGet("/api/administracion/roles", async (HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    return Results.Ok(await catStore.GetRolesAsync(ct));
});

// ==========================================
// Salud del servicio
// ==========================================

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();

public sealed record SetActiveDto(bool Active);
