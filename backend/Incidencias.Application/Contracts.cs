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

public sealed record HistoryDto(DateTimeOffset Date, string State, string Note);

public sealed record CreateIncidentDto(
    string Category,
    string Location,
    string Description,
    string? Reference = null,
    string? Urgency = null,
    string? ReporterName = null,
    string? ReporterLink = null);

public sealed record IncidentCatalogsDto(IReadOnlyList<string> Categories, IReadOnlyList<string> Locations)
{
    public IReadOnlyList<string> Urgencies { get; init; } = ["Baja", "Media", "Alta"];
}

public sealed record ChangeIncidentDto(string State, string Priority, string Note, long Version);

public sealed record LoginDto(string Username, string Password);

public sealed record SessionDto(
    string Token,
    string Name,
    string Profile,
    string? Area,
    DateTimeOffset ExpiresAt,
    int? UserId = null);

public sealed record PublicStatusDto(
    string Code,
    string Category,
    string Location,
    string State,
    DateTimeOffset Created,
    IReadOnlyList<HistoryDto> History,
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

public sealed class IncidentConflictException(string message) : Exception(message);

/// <summary>Mapea el expediente interno al resumen público y sustituye observaciones libres por textos seguros.</summary>
public static class IncidentContractMapper
{
    public static PublicStatusDto ToPublicStatus(IncidentDto incident) => new(
        incident.Code,
        incident.Category,
        incident.Location,
        incident.State,
        incident.Created,
        incident.History.Select(item => new HistoryDto(
            item.Date,
            item.State,
            item.State == "Recibido" ? "Reporte recibido." : $"Estado actualizado a {item.State}.")).ToArray(),
        incident.Urgency,
        incident.Closed);
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
    Task<IReadOnlyList<IncidentDto>> ListAsync(IncidentFilterDto filter, SessionDto session, CancellationToken ct);
    Task<IncidentDto?> GetAuthorizedAsync(string code, SessionDto session, CancellationToken ct);
    Task<IncidentDto> ChangeAsync(string code, ChangeIncidentDto request, SessionDto session, CancellationToken ct);
}
