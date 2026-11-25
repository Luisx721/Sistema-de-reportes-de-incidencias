namespace Incidencias.Application;

/// <summary>DTO pÃºblico: conserva los nombres usados por Angular sin exponer claves de base de datos.</summary>
public sealed record IncidentDto(string Code, string Category, string Location, string Description, string State,
    DateTimeOffset Created, string? Reference, string? Priority, string? ResponsibleUnit, long Version,
    IReadOnlyList<HistoryDto> History)
{
    [System.Text.Json.Serialization.JsonIgnore]
    public string? RequesterArea { get; init; }
}
public sealed record HistoryDto(DateTimeOffset Date, string State, string Note);
public sealed record CreateIncidentDto(string Category, string Location, string Description, string? Reference);
public sealed record ChangeIncidentDto(string State, string Priority, string Note, long Version);
public sealed record LoginDto(string Username, string Password);
public sealed record SessionDto(string Token, string Name, string Profile, string? Area, DateTimeOffset ExpiresAt);
public sealed record PublicStatusDto(string Code, string Category, string Location, string State, DateTimeOffset Created, IReadOnlyList<HistoryDto> History);
public sealed record IncidentFilterDto(string? Query, string? Category, string? Location, string? State, DateOnly? From, DateOnly? To);
public static class IncidentFilterRules
{
    private static readonly TimeZoneInfo ElSalvador = TimeZoneInfo.FindSystemTimeZoneById(
        OperatingSystem.IsWindows() ? "Central America Standard Time" : "America/El_Salvador");

    public static void Validate(IncidentFilterDto filter)
    {
        if (filter.From is { } from && filter.To is { } to && from > to)
            throw new ArgumentException("La fecha inicial no puede ser posterior a la fecha final.");
    }

    public static DateTimeOffset StartOfDay(DateOnly date)
    {
        var localMidnight = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(localMidnight, ElSalvador));
    }
}
public sealed class IncidentConflictException(string message) : Exception(message);

/// <summary>Mapea el expediente interno al resumen pÃºblico y sustituye observaciones libres por textos seguros.</summary>
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
            item.State == "Recibido" ? "Reporte recibido." : $"Estado actualizado a {item.State}." )).ToArray());
}

/// <summary>Adaptador reemplazable para concentrar todas las operaciones SQL.</summary>
public interface IIncidentStore
{
    Task<SessionDto?> LoginAsync(string username, string password, CancellationToken ct);
    Task<SessionDto?> GetSessionAsync(string token, CancellationToken ct);
    Task EndSessionAsync(string token, CancellationToken ct);
    Task<IncidentDto> CreateAsync(CreateIncidentDto request, CancellationToken ct);
    Task<PublicStatusDto?> TrackAsync(string code, CancellationToken ct);
    Task<IReadOnlyList<IncidentDto>> ListAsync(IncidentFilterDto filter, SessionDto session, CancellationToken ct);
    Task<IncidentDto?> GetAuthorizedAsync(string code, SessionDto session, CancellationToken ct);
    Task<IncidentDto> ChangeAsync(string code, ChangeIncidentDto request, SessionDto session, CancellationToken ct);
}
