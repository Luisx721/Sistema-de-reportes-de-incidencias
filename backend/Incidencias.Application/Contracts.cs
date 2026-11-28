using System.Text.Json.Serialization;
using Incidencias.Domain;

namespace Incidencias.Application;

/// <summary>DTO interno del expediente. El seguimiento público usa <see cref="PublicStatusDto"/>.</summary>
/// <param name="Version">Control de concurrencia optimista: <c>ChangeAsync</c> lo compara y, si no coincide, se responde 409.</param>
/// <param name="IsDuplicate">Indica que el registro devuelto es un reporte abierto ya existente y no uno nuevo.</param>
public sealed record IncidentDto(
    string Code,
    string Category,
    string Location,
    string Description,
    string State,
    DateTimeOffset Created,
    string? Reference,
    string? Priority,
    string? ResponsibleUnit,
    long Version,
    IReadOnlyList<HistoryDto> History,
    string? Urgency = null,
    DateTimeOffset? Closed = null,
    string? ReporterName = null,
    string? ReporterLink = null,
    bool IsDuplicate = false)
{
    /// <summary>Área solicitante del reporte (modalidad asistida). Solo sirve para evaluar <c>IncidentRules.CanEdit</c>; no se serializa al cliente.</summary>
    [JsonIgnore]
    public string? RequesterArea { get; init; }
}

/// <summary>Registro individual del historial de cambios de una incidencia.</summary>
public sealed record HistoryDto(DateTimeOffset Date, string State, string Note);

/// <summary>Datos enviados al registrar una nueva incidencia (pública o asistida).</summary>
public sealed record CreateIncidentDto(
    string Category,
    string Location,
    string Description,
    string? Reference = null,
    string? Urgency = null,
    string? ReporterName = null,
    string? ReporterLink = null); // Vínculo opcional del reportante (ej. Estudiante).

/// <summary>Relación entre una categoría activa y la unidad responsable de atenderla (RF-01).</summary>
public sealed record CategoryUnitDto(string Category, string ResponsibleUnit);

/// <summary>Catálogos públicos activos que consumen los formularios y la guía de ayuda.</summary>
public sealed record IncidentCatalogsDto(IReadOnlyList<string> Categories, IReadOnlyList<string> Locations)
{
    /// <summary>Valor por defecto del contrato; replica <c>IncidentRules.Urgencies</c> (Baja, Media, Alta).</summary>
    public IReadOnlyList<string> Urgencies { get; init; } = ["Baja", "Media", "Alta"];
    public IReadOnlyList<CategoryUnitDto> CategoryUnits { get; init; } = [];
}

/// <summary>Datos para actualizar estado y prioridad; Version controla concurrencia optimista (HTTP 409).</summary>
public sealed record ChangeIncidentDto(string State, string Priority, string Note, long Version);

/// <summary>Credenciales enviadas al iniciar sesión.</summary>
public sealed record LoginDto(string Username, string Password);

/// <summary>Información de la sesión activa devuelta tras autenticarse.</summary>
public sealed record SessionDto(
    string Token,
    string Name,
    string Profile,
    string? Area,
    DateTimeOffset ExpiresAt,
    int? UserId = null);

/// <summary>
/// Seguimiento público (RF-10). No incluye descripción, reportante ni unidad responsable.
/// El historial publica la observación técnica de cada cambio de estado (ver <see cref="IncidentContractMapper.ToPublicStatus"/>).
/// </summary>
public sealed record PublicStatusDto(
    string Code,
    string Category,
    string Location,
    string State,
    DateTimeOffset Created,
    IReadOnlyList<HistoryDto> History,
    string? Urgency = null,
    DateTimeOffset? Closed = null);

/// <summary>
/// DTO para la respuesta pública del registro de incidencias.
/// Devuelve el código, estado y mensaje de confirmación,
/// sin exponer información personal ni notas internas.
/// </summary>
public sealed record CreateIncidentResultDto(
    string Code,
    bool IsDuplicate,
    string Message,
    string State,
    DateTimeOffset Created)
    {
    /// <summary>Token temporal (15 minutos) para subir fotos. Solo se emite en registros anónimos que no son duplicados; si no aplica, se omite del JSON.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? PhotoUploadToken { get; init; }
}

/// <summary>Resumen público para listados y mapa: sin descripción, identidad ni notas.</summary>
public sealed record PublicIncidentSummaryDto(
    string Code,
    string Category,
    string Location,
    string State,
    DateTimeOffset Created,
    string? Urgency = null,
    DateTimeOffset? Closed = null);

/// <summary>Filtros de consulta. <c>To</c> es inclusivo: el límite superior real es el inicio del día siguiente (ver <see cref="IncidentFilterRules.StartOfNextDay"/>).</summary>
public sealed record IncidentFilterDto(
    string? Query,
    string? Category,
    string? Location,
    string? State,
    DateOnly? From,
    DateOnly? To,
    string? Urgency = null);

/// <summary>RF-13: resumen del panel centralizado. Sin descripción, reportante, historial ni notas.</summary>
public sealed record IncidentSummaryDto(
    string Code,
    DateTimeOffset Created,
    string Category,
    string Location,
    string? Priority,
    string State,
    string? ResponsibleUnit);

/// <summary>Valida filtros de consulta y calcula los límites de fecha en hora de El Salvador.</summary>
public static class IncidentFilterRules
{
    // Las fechas del filtro son días locales de El Salvador (UTC-6), no UTC.
    private static readonly TimeZoneInfo ElSalvador = TimeZoneInfo.FindSystemTimeZoneById(
        OperatingSystem.IsWindows() ? "Central America Standard Time" : "America/El_Salvador");

    /// <summary>Rechaza rangos invertidos y valores de estado o urgencia fuera de catálogo.</summary>
    public static void Validate(IncidentFilterDto filter)
    {
        if (filter.From is { } from && filter.To is { } to && from > to)
            throw new ArgumentException("La fecha inicial no puede ser posterior a la fecha final.");
        if (!string.IsNullOrWhiteSpace(filter.State) && !IncidentRules.States.Contains(filter.State))
            throw new ArgumentException("Estado de filtro no válido.");
        if (!string.IsNullOrWhiteSpace(filter.Urgency) && !IncidentRules.Urgencies.Contains(filter.Urgency))
            throw new ArgumentException("Urgencia de filtro no válida.");
    }

    /// <summary>Medianoche local de El Salvador del día indicado, expresada en UTC.</summary>
    public static DateTimeOffset StartOfDay(DateOnly date)
    {
        var localMidnight = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(localMidnight, ElSalvador));
    }

    /// <summary>Límite superior exclusivo para el filtro "hasta": como <c>To</c> es inclusivo, se usa el inicio del día siguiente.</summary>
    public static DateTimeOffset StartOfNextDay(DateOnly date) => StartOfDay(date.AddDays(1));
}

/// <summary>Excepción personalizada para representar conflictos en las operaciones.
/// Recibe un mensaje que explica el motivo del conflicto. <c>Program.cs</c> la traduce a HTTP 409 cuando <c>Version</c> no coincide en <c>ChangeAsync</c>.</summary>
public sealed class IncidentConflictException(string message) : Exception(message);

/// <summary>
/// Clase encargada de convertir los datos internos de una incidencia
/// en respuestas públicas, evitando exponer información privada.
/// </summary>
public static class IncidentContractMapper
{
    /// <summary>Convierte el expediente interno en un resumen público.</summary>
    public static PublicStatusDto ToPublicStatus(IncidentDto incident) => new(
        incident.Code,
        incident.Category,
        incident.Location,
        incident.State,
        incident.Created,

    // Historial público (RF-10): "Recibido" conserva un mensaje fijo; en los demás
    // estados se muestra la observación técnica del cambio. Si viene vacía se usa
    // un mensaje genérico. No incluye usuario encargado ni datos del reportante.
    incident.History.Select(item => new HistoryDto(
        item.Date,
        item.State,
        item.State == "Recibido"
            ? "Reporte recibido."
            : string.IsNullOrWhiteSpace(item.Note)
                ? $"Estado actualizado a {item.State}."
                : item.Note.Trim())).ToArray(),
        incident.Urgency,
        incident.Closed);

    /// <summary>Genera la respuesta pública después de registrar una incidencia. No asigna <c>PhotoUploadToken</c>; lo agrega <c>Program.cs</c>.</summary>
    public static CreateIncidentResultDto ToCreateResult(IncidentDto incident) => new(
        incident.Code,
        incident.IsDuplicate,

        // Si es duplicada, informa que existe un reporte similar.
        // Si no es duplicada, confirma que fue recibida.
        incident.IsDuplicate
            ? "Ya existe un reporte abierto con la misma categoría y ubicación. Puede consultarlo con este código."
            : "Reporte recibido.",
        incident.State,
        incident.Created); 
}

/// <summary>Adaptador reemplazable para concentrar todas las operaciones SQL.</summary>
public interface IIncidentStore
{
    Task<SessionDto?> LoginAsync(string username, string password, CancellationToken ct);
    Task<SessionDto?> GetSessionAsync(string token, CancellationToken ct);
    Task EndSessionAsync(string token, CancellationToken ct);

    /// <summary>Registra una incidencia. Con sesión es registro asistido; sin sesión, público. Si ya hay un caso abierto con la misma categoría y ubicación, devuelve ese caso con <c>IsDuplicate = true</c>.</summary>
    Task<IncidentDto> CreateAsync(CreateIncidentDto request, SessionDto? session, CancellationToken ct);
    Task<IncidentDto> CreateAsync(CreateIncidentDto request, CancellationToken ct) => CreateAsync(request, null, ct);
    Task<IncidentCatalogsDto> GetCatalogsAsync(CancellationToken ct);

    /// <summary>Seguimiento público por código (RF-10).</summary>
    Task<PublicStatusDto?> TrackAsync(string code, CancellationToken ct);
    Task<IReadOnlyList<PublicIncidentSummaryDto>> ListPublicAsync(string? category, string? state, CancellationToken ct);

    /// <summary>Listado interno para cualquier perfil autenticado; el resultado se limita según rol y área (Autoridad y Administrador ven todo; Jefatura y Ordenanza, su área; técnicos, su unidad).</summary>
    Task<IReadOnlyList<IncidentDto>> ListAsync(IncidentFilterDto filter, SessionDto session, CancellationToken ct);

    /// <summary>Panel centralizado (RF-13), exclusivo de Mantenimiento y Desarrollo Físico. No se restringe por unidad; la edición de casos ajenos sigue bloqueada.</summary>
    Task<IReadOnlyList<IncidentSummaryDto>> ListPanelAsync(IncidentFilterDto filter, SessionDto session, CancellationToken ct);

    /// <summary>Devuelve <c>null</c> si el código no existe; si existe pero el perfil o área no puede consultarlo, lanza <see cref="UnauthorizedAccessException"/> (403).</summary>
    Task<IncidentDto?> GetAuthorizedAsync(string code, SessionDto session, CancellationToken ct);

    /// <summary>Cambia estado y prioridad. Lanza <see cref="IncidentConflictException"/> si <c>Version</c> está desactualizada.</summary>
    Task<IncidentDto> ChangeAsync(string code, ChangeIncidentDto request, SessionDto session, CancellationToken ct);
}