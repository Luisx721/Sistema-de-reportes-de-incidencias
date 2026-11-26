using System.Text.Json.Serialization;
using Incidencias.Domain;

namespace Incidencias.Application;

/// <summary>DTO interno del expediente. El seguimiento público usa <see cref="PublicStatusDto"/>.</summary>
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
    [JsonIgnore]
    public string? RequesterArea { get; init; }
}

// Registro individual del historial de cambios de una incidencia.
public sealed record HistoryDto(DateTimeOffset Date, string State, string Note);

// Datos enviados al registrar una nueva incidencia (pública o asistida).
public sealed record CreateIncidentDto(
    string Category,
    string Location,
    string Description,
    string? Reference = null,
    string? Urgency = null,
    string? ReporterName = null,
    string? ReporterLink = null); // Vínculo opcional del reportante (ej. Estudiante).

// Relación entre una categoría activa y la unidad responsable de atenderla (RF-01).
public sealed record CategoryUnitDto(string Category, string ResponsibleUnit);

// Catálogos públicos activos que consumen los formularios y la guía de ayuda.
public sealed record IncidentCatalogsDto(IReadOnlyList<string> Categories, IReadOnlyList<string> Locations)
{
    public IReadOnlyList<string> Urgencies { get; init; } = ["Baja", "Media", "Alta"];
    public IReadOnlyList<CategoryUnitDto> CategoryUnits { get; init; } = [];
}

// Datos para actualizar estado y prioridad; Version controla concurrencia optimista (HTTP 409).
public sealed record ChangeIncidentDto(string State, string Priority, string Note, long Version);

// Credenciales enviadas al iniciar sesión.
public sealed record LoginDto(string Username, string Password);

// Información de la sesión activa devuelta tras autenticarse.
public sealed record SessionDto(
    string Token,
    string Name,
    string Profile,
    string? Area,
    DateTimeOffset ExpiresAt,
    int? UserId = null);

// Resumen público para consultar el seguimiento sin exponer datos personales ni notas internas.
public sealed record PublicStatusDto(
    string Code,
    string Category,
    string Location,
    string State,
    DateTimeOffset Created,
    IReadOnlyList<HistoryDto> History,
    string? Urgency = null,
    DateTimeOffset? Closed = null);

// DTO para la respuesta pública del registro de incidencias.
// Devuelve el código, estado y mensaje de confirmación,
// sin exponer información personal ni notas internas.
public sealed record CreateIncidentResultDto(
    string Code,
    bool IsDuplicate,
    string Message,
    string State,
    DateTimeOffset Created);

/// <summary>Resumen público para listados y mapa: sin descripción, identidad ni notas.</summary>
public sealed record PublicIncidentSummaryDto(
    string Code,
    string Category,
    string Location,
    string State,
    DateTimeOffset Created,
    string? Urgency = null,
    DateTimeOffset? Closed = null);
public sealed record IncidentFilterDto(
    string? Query,
    string? Category,
    string? Location,
    string? State,
    DateOnly? From,
    DateOnly? To,
    string? Urgency = null);

public static class IncidentFilterRules
{
    private static readonly TimeZoneInfo ElSalvador = TimeZoneInfo.FindSystemTimeZoneById(
        OperatingSystem.IsWindows() ? "Central America Standard Time" : "America/El_Salvador");

    public static void Validate(IncidentFilterDto filter)
    {
        if (filter.From is { } from && filter.To is { } to && from > to)
            throw new ArgumentException("La fecha inicial no puede ser posterior a la fecha final.");
        if (!string.IsNullOrWhiteSpace(filter.State) && !IncidentRules.States.Contains(filter.State))
            throw new ArgumentException("Estado de filtro no válido.");
        if (!string.IsNullOrWhiteSpace(filter.Urgency) && !IncidentRules.Urgencies.Contains(filter.Urgency))
            throw new ArgumentException("Urgencia de filtro no válida.");
    }

    public static DateTimeOffset StartOfDay(DateOnly date)
    {
        var localMidnight = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(localMidnight, ElSalvador));
    }

    public static DateTimeOffset StartOfNextDay(DateOnly date) => StartOfDay(date.AddDays(1));
}
// Excepción personalizada para representar conflictos en las operaciones.
// Recibe un mensaje que explica el motivo del conflicto.
public sealed class IncidentConflictException(string message) : Exception(message);

// Clase encargada de convertir los datos internos de una incidencia
// en respuestas públicas, evitando exponer información privada.
public static class IncidentContractMapper
{
    // Convierte el expediente interno en un resumen público.
    public static PublicStatusDto ToPublicStatus(IncidentDto incident) => new(
        incident.Code,
        incident.Category,
        incident.Location,
        incident.State,
        incident.Created,

        // Recorre el historial y genera mensajes seguros,
        // sin mostrar las observaciones originales.
        incident.History.Select(item => new HistoryDto(
            item.Date,
            item.State,
            item.State == "Recibido" ? "Reporte recibido." : $"Estado actualizado a {item.State}.")).ToArray(),
        incident.Urgency,
        incident.Closed);

    // Genera la respuesta pública después de registrar una incidencia.
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
    Task<IncidentDto> CreateAsync(CreateIncidentDto request, SessionDto? session, CancellationToken ct);
    Task<IncidentDto> CreateAsync(CreateIncidentDto request, CancellationToken ct) => CreateAsync(request, null, ct);
    Task<IncidentCatalogsDto> GetCatalogsAsync(CancellationToken ct);
    Task<PublicStatusDto?> TrackAsync(string code, CancellationToken ct);
    Task<IReadOnlyList<PublicIncidentSummaryDto>> ListPublicAsync(string? category, string? state, CancellationToken ct);
    Task<IReadOnlyList<IncidentDto>> ListAsync(IncidentFilterDto filter, SessionDto session, CancellationToken ct);
    Task<IncidentDto?> GetAuthorizedAsync(string code, SessionDto session, CancellationToken ct);
    Task<IncidentDto> ChangeAsync(string code, ChangeIncidentDto request, SessionDto session, CancellationToken ct);
}
