using System.Text;
using Incidencias.Application;
using Incidencias.Domain;
using Incidencias.Infrastructure;
using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;

var builder = WebApplication.CreateBuilder(args);

// Sin cadena de conexión la API no arranca (configuración local o variable de entorno).
var connectionString = builder.Configuration.GetConnectionString("Incidencias") ??
    Environment.GetEnvironmentVariable("INCIDENCIAS_DB");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException("Configura ConnectionStrings:Incidencias mediante configuración local o INCIDENCIAS_DB.");

var photosPath = builder.Configuration["Photos:Path"] ??
                 Environment.GetEnvironmentVariable("INCIDENCIAS_PHOTOS_PATH") ??
                 Path.Combine(builder.Environment.ContentRootPath, "uploads", "fotos");

// Los archivos de las fotos se guardan en disco (PhotoStorage); sus metadatos, en PostgreSQL.
var photoStorage = new PhotoStorage(photosPath);
// Una sola instancia del store implementa los cinco puertos (incidencias, cuentas, catálogos, fotos y reportes).
var postgresStore = new PostgresIncidentStore(connectionString, photoStorage);

builder.Services.AddSingleton(photoStorage);
builder.Services.AddSingleton<IIncidentStore>(postgresStore);
builder.Services.AddSingleton<IAccountStore>(postgresStore);
builder.Services.AddSingleton<ICatalogStore>(postgresStore);
builder.Services.AddSingleton<IPhotoStore>(postgresStore);
builder.Services.AddSingleton<IReportStore>(postgresStore);

// Por defecto solo se acepta el frontend Angular local; en otros entornos se define en Cors:Origins.
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.WithOrigins(
    builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:4200", "http://127.0.0.1:4200"])
    .AllowAnyHeader().AllowAnyMethod()));

// Lo usa el token temporal de subida de fotos para invitados; las claves se persisten en disco para sobrevivir reinicios.
var keysPath = builder.Configuration["DataProtection:KeysPath"] ??
               Environment.GetEnvironmentVariable("INCIDENCIAS_KEYS_PATH") ??
               Path.Combine(builder.Environment.ContentRootPath, "keys");

builder.Services.AddDataProtection()
    .SetApplicationName("Incidencias.Api")
    .PersistKeysToFileSystem(new DirectoryInfo(keysPath));

// Registrar los servicios necesarios para generar la documentación OpenAPI de la API.
builder.Services.AddOpenApi();

var app = builder.Build();
app.UseCors();

// Exponer la documentación OpenAPI únicamente en el entorno de desarrollo.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

const string photoUploadHeader = "X-Photo-Upload-Token";
// Protector con vigencia limitada; el propósito propio aísla estos tokens de cualquier otro uso de DataProtection.
var photoUploadProtector = app.Services.GetRequiredService<IDataProtectionProvider>()
    .CreateProtector("Incidencias.GuestPhotoUpload.v1")
    .ToTimeLimitedDataProtector();

// Autoriza la subida de fotos sin sesión: exige un único token vigente y ligado al código de este reporte.
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

// Devuelve la sesión del token Bearer, o null si no hay token o no es vigente; cada endpoint decide si exige sesión.
async Task<SessionDto?> Current(HttpRequest request, IIncidentStore store, CancellationToken ct)
{
    var header = request.Headers.Authorization.ToString();
    return header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
        ? await store.GetSessionAsync(header[7..].Trim(), ct) : null;
}

// Guardia de los endpoints de administración: 401 sin sesión, 403 si el perfil no es Administrador. El error sale por el parámetro out.
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

// Inicio de sesión (público): 400 si faltan credenciales, 401 si no son válidas.
async Task<IResult> HandleLogin(LoginDto login, IIncidentStore store, CancellationToken ct)
{
    if (string.IsNullOrWhiteSpace(login.Username) || string.IsNullOrEmpty(login.Password))
        return Results.BadRequest(new { error = "Usuario y contraseña requeridos." });
    var session = await store.LoginAsync(login.Username, login.Password, ct);
    return session is not null ? Results.Ok(session) : Results.Unauthorized();
}

// Devuelve la sesión del token enviado; 401 si no hay token o está vencido.
async Task<IResult> HandleGetCurrent(HttpRequest req, IIncidentStore store, CancellationToken ct)
{
    var session = await Current(req, store, ct);
    return session is not null ? Results.Ok(session) : Results.Unauthorized();
}

// Cierra la sesión invalidando el token; exige una sesión vigente.
async Task<IResult> HandleLogout(HttpRequest req, IIncidentStore store, CancellationToken ct)
{
    var session = await Current(req, store, ct);
    if (session is null) return Results.Unauthorized();
    await store.EndSessionAsync(req.Headers.Authorization.ToString()[7..].Trim(), ct);
    return Results.NoContent();
}

// Rutas oficiales: /api/sesiones y /api/sesiones/actual. Las de /api/sesion son alias por compatibilidad con el frontend.
app.MapPost("/api/sesiones", HandleLogin);
app.MapPost("/api/sesion", HandleLogin);
app.MapGet("/api/sesiones/actual", HandleGetCurrent);
app.MapGet("/api/sesion", HandleGetCurrent);
app.MapDelete("/api/sesiones/actual", HandleLogout);
app.MapDelete("/api/sesion", HandleLogout);

// ==========================================
// Catálogos Públicos y Seguimiento
// ==========================================

// Catálogos activos para los formularios de registro; público.
app.MapGet("/api/catalogos", async (IIncidentStore store, CancellationToken ct) =>
    Results.Ok(await store.GetCatalogsAsync(ct)));

// RF-10: seguimiento público por código, sin sesión. 404 si el código no existe.
app.MapGet("/api/seguimiento/{code}", async (string code, IIncidentStore store, CancellationToken ct) =>
    await store.TrackAsync(code, ct) is { } status ? Results.Ok(status) : Results.NotFound(new { error = "Incidencia no encontrada." }));

// Incidencias: creación, listado, detalle y modificación

// Registra una nueva incidencia y devuelve una respuesta pública con su código de seguimiento.

app.MapPost("/api/incidencias", async (CreateIncidentDto request, HttpRequest req, IIncidentStore store, CancellationToken ct) =>
{
    try
    {
        // La sesión es opcional: sin ella (null, incluido un token vencido o inválido) el registro es público y anónimo;
        // con sesión, el store lo trata como registro asistido y valida el perfil.
        var session = await Current(req, store, ct);

        // Guarda la incidencia y obtiene los datos del reporte creado.
        var created = await store.CreateAsync(request, session, ct);

       var result = IncidentContractMapper.ToCreateResult(created);
// Solo el registro anónimo nuevo recibe token de 15 minutos para subir fotos de este reporte sin sesión.
// Un duplicado apunta al reporte de otra persona, por eso no recibe token.
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
    // 403 cuando la sesión no tiene perfil para registro asistido (lo valida CreateAsync).
    catch (UnauthorizedAccessException) { return Results.StatusCode(StatusCodes.Status403Forbidden); }
});

// Lee y valida los filtros de consulta; devuelve el error HTTP ya armado en lugar de lanzar excepción. "to" es inclusivo.
(IncidentFilterDto? Filter, IResult? Error) ReadFilter(HttpRequest request)
{
    DateOnly? from = null, to = null;
    if (request.Query.TryGetValue("from", out var fromText) && !string.IsNullOrWhiteSpace(fromText))
    {
        if (!DateOnly.TryParse(fromText, out var parsedFrom))
            return (null, Results.BadRequest(new { error = "La fecha inicial no es válida." }));
        from = parsedFrom;
    }
    if (request.Query.TryGetValue("to", out var toText) && !string.IsNullOrWhiteSpace(toText))
    {
        if (!DateOnly.TryParse(toText, out var parsedTo))
            return (null, Results.BadRequest(new { error = "La fecha final no es válida." }));
        to = parsedTo;
    }
    var filter = new IncidentFilterDto(
        request.Query["query"], request.Query["category"], request.Query["location"],
        request.Query["state"], from, to, request.Query["urgency"]);
    try { IncidentFilterRules.Validate(filter); }
    catch (ArgumentException ex) { return (null, Results.BadRequest(new { error = ex.Message })); }
    return (filter, null);
}

// Obtiene el listado de incidencias para los usuarios internos.
// El store limita el resultado según rol, área o unidad del usuario.
app.MapGet("/api/incidencias", async (HttpRequest request, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(request, store, ct);
    if (session is null) return Results.Unauthorized();

    // Verifica que el usuario tenga un perfil autorizado para consultar las incidencias.
    if (!IncidentRules.IsInternalProfile(session.Profile)) return Results.StatusCode(StatusCodes.Status403Forbidden);

    var (filter, error) = ReadFilter(request);
    if (error is not null) return error;

    return Results.Ok(await store.ListAsync(filter!, session, ct));
});

// RF-13: panel centralizado de Mantenimiento y Desarrollo Físico (listado general, campos resumidos).
// Ver el listado no concede abrir ni editar casos ajenos (D-01).
app.MapGet("/api/incidencias/panel", async (HttpRequest request, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(request, store, ct);
    if (session is null) return Results.Unauthorized();
    if (!IncidentRules.CanViewPanel(session.Profile)) return Results.StatusCode(StatusCodes.Status403Forbidden);

    var (filter, error) = ReadFilter(request);
    if (error is not null) return error;

    return Results.Ok(await store.ListPanelAsync(filter!, session, ct));
});
// Listado público para listados y mapa: sin sesión y solo con campos no sensibles.
app.MapGet("/api/incidencias/publicas", async (string? category, string? state, IIncidentStore store, CancellationToken ct) =>
    Results.Ok(await store.ListPublicAsync(category, state, ct)));
// Detalle interno; exige sesión. Responde 403 también si el código no existe, para no revelar qué códigos hay.
app.MapGet("/api/incidencias/{code}", async (string code, HttpRequest request, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(request, store, ct);
    if (session is null) return Results.Unauthorized();
    var incident = await store.GetAuthorizedAsync(code, session, ct);
    return incident is null ? Results.StatusCode(StatusCodes.Status403Forbidden) : Results.Ok(incident);
});

// Alias de GET /api/incidencias/{code}.
app.MapGet("/api/incidencia/{id}", async (string id, HttpRequest request, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(request, store, ct);
    if (session is null) return Results.Unauthorized();
    var incident = await store.GetAuthorizedAsync(id, session, ct);
    return incident is null ? Results.StatusCode(StatusCodes.Status403Forbidden) : Results.Ok(incident);
});

// Cambia estado, prioridad y observación con control de versión.
// 409 si la versión está desactualizada, 403 si el perfil no puede editar, 404 si no existe, 400 si no valida.
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

// Alias de PUT /api/incidencias/{code}; exige el ChangeIncidentDto completo, no solo el estado.
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

// Alias de PUT /api/incidencias/{code}; exige el ChangeIncidentDto completo, no solo la prioridad.
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

// Exporta a CSV las incidencias que el usuario puede ver (el store limita por rol, área o unidad). Exige perfil interno.
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

// Ruta oficial: /api/incidencias/exportar. /api/exportaciones es un alias.
app.MapGet("/api/incidencias/exportar", HandleExportCsv);
app.MapGet("/api/exportaciones", HandleExportCsv);

// ==========================================
// Fotografías (RF-03)
// ==========================================

// Sube una foto: requiere sesión o el token temporal de invitado ligado a este código.
// El límite de fotos por expediente lo valida AddAsync en el store.
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

    // El tamaño se valida antes de copiar el archivo a memoria.
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

// Lista las fotos de un expediente; exige sesión (el invitado puede subir, pero no consultar).
app.MapGet("/api/incidencias/{code}/fotos", async (string code, HttpRequest req, IPhotoStore photoStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    if (session is null) return Results.Unauthorized();
       try { return Results.Ok(await photoStore.ListAsync(code, session, ct)); }
    catch (UnauthorizedAccessException) { return Results.StatusCode(StatusCodes.Status403Forbidden); }
});

// Descarga una foto; exige sesión por privacidad, de modo que adivinar un código no basta para ver evidencias.
app.MapGet("/api/fotos/{id:int}", async (int id, HttpRequest req, IPhotoStore photoStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    if (session is null) return Results.Unauthorized();
    try
    {
        var photo = await photoStore.GetFileAsync(id, session, ct);
        return photo is not null
            ? Results.File(photo.Content, photo.ContentType, photo.FileName)
            : Results.NotFound(new { error = "Foto no encontrada." });
    }
    catch (UnauthorizedAccessException) { return Results.StatusCode(StatusCodes.Status403Forbidden); }
});

// ==========================================
// Estadísticas (RF-21)
// ==========================================

// Estadísticas del alcance del usuario (el store filtra por rol, área o unidad). Exige perfil interno y acepta los mismos filtros del listado.
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

// Ruta oficial: /api/estadisticas. /api/reportes/estadisticas es un alias.
app.MapGet("/api/estadisticas", HandleStatistics);
app.MapGet("/api/reportes/estadisticas", HandleStatistics);

// ==========================================
// Administración: Cuentas (RF-22)
// ==========================================

// Todos los endpoints de administración exigen perfil Administrador (RequireAdmin): 401 sin sesión, 403 con otro perfil.
// Las cuentas se activan o desactivan, no se borran, para conservar la integridad con los reportes existentes.

// Lista las cuentas; solo metadatos, nunca el hash de contraseña.
app.MapGet("/api/administracion/cuentas", async (HttpRequest req, IAccountStore accountStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    return Results.Ok(await accountStore.GetAccountsAsync(ct));
});
// Alias de GET /api/administracion/cuentas.
app.MapGet("/api/cuentas", async (HttpRequest req, IAccountStore accountStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    return Results.Ok(await accountStore.GetAccountsAsync(ct));
});

// Crea una cuenta; 400 si los datos no validan.
app.MapPost("/api/administracion/cuentas", async (AccountInputDto input, HttpRequest req, IAccountStore accountStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    try { return Results.Created("/api/administracion/cuentas", await accountStore.CreateAccountAsync(input, ct)); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
// Alias de POST /api/administracion/cuentas.
app.MapPost("/api/cuentas", async (AccountInputDto input, HttpRequest req, IAccountStore accountStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    try { return Results.Created("/api/administracion/cuentas", await accountStore.CreateAccountAsync(input, ct)); }
    catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

// Actualiza una cuenta; 404 si no existe, 400 si los datos no validan.
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
// Alias de PUT /api/administracion/cuentas/{id}.
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

// Activa o desactiva una cuenta sin borrarla; 404 si no existe. No tiene alias.
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

// Categorías, ubicaciones, edificios y áreas siguen el mismo patrón, y todos son solo para Administrador:
// GET (lista), POST (alta), PUT (edición) y PATCH .../estado (activar o desactivar; no se borran, para conservar el historial).
// En los GET, "all" incluye los inactivos; si no se envía, el endpoint usa true (all ?? true), es decir, también los devuelve.
// Edificios agrupa los inmuebles de las ubicaciones; Áreas son las áreas institucionales asignables a cuentas de Jefatura y Ordenanza y a reportes asistidos.

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

// Roles: solo consulta; no hay endpoints para crearlos ni editarlos.
app.MapGet("/api/administracion/roles", async (HttpRequest req, ICatalogStore catStore, IIncidentStore store, CancellationToken ct) =>
{
    var session = await Current(req, store, ct);
    RequireAdmin(session, out var err); if (err is not null) return err;
    return Results.Ok(await catStore.GetRolesAsync(ct));
});

// ==========================================
// Salud del servicio
// ==========================================

// Verificación de disponibilidad; pública y sin consulta a la base de datos.
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();

/// <summary>Cuerpo de los PATCH .../estado: <c>true</c> activa el registro y <c>false</c> lo desactiva.</summary>
public sealed record SetActiveDto(bool Active);