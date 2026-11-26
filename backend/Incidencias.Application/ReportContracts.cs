using System.Globalization;
using System.Text;

namespace Incidencias.Application;

public sealed record StateStatDto(string State, int Count);

public sealed record CategoryStatDto(
    string Category,
    int Total,
    int Received,
    int InProcess,
    int Waiting,
    int Resolved,
    int Closed,
    decimal PctReceived,
    decimal PctInProcess,
    decimal PctWaiting,
    decimal PctResolved,
    decimal PctClosed);

public sealed record LocationStatDto(string Location, int Total);

public sealed record StatisticsDto(
    int Total,
    IReadOnlyList<StateStatDto> ByState,
    IReadOnlyList<CategoryStatDto> ByCategory,
    IReadOnlyList<LocationStatDto> ByLocation,
    DateOnly? From,
    DateOnly? To);

/// <summary>Estadísticas calculadas sobre las vistas oficiales y el mismo alcance por rol del listado (RF-21).</summary>
public interface IReportStore
{
    Task<StatisticsDto> GetStatisticsAsync(IncidentFilterDto filter, SessionDto session, CancellationToken ct);
}

/// <summary>Genera el CSV del historial consolidado con escape y neutralización de fórmulas (RF-24).</summary>
public static class IncidentCsvExporter
{
    private static readonly TimeZoneInfo ElSalvador = TimeZoneInfo.FindSystemTimeZoneById(
        OperatingSystem.IsWindows() ? "Central America Standard Time" : "America/El_Salvador");

    public static string Build(IEnumerable<IncidentDto> incidents)
    {
        var builder = new StringBuilder();
        builder.AppendLine("Codigo,Categoria,Ubicacion,Estado,Urgencia,Prioridad,UnidadResponsable,FechaCreacion,FechaCierre,Referencia");
        foreach (var incident in incidents)
        {
            builder.AppendLine(string.Join(',',
                Escape(incident.Code),
                Escape(incident.Category),
                Escape(incident.Location),
                Escape(incident.State),
                Escape(incident.Urgency ?? string.Empty),
                Escape(incident.Priority ?? string.Empty),
                Escape(incident.ResponsibleUnit ?? string.Empty),
                Escape(FormatDate(incident.Created)),
                Escape(incident.Closed is { } closed ? FormatDate(closed) : string.Empty),
                Escape(incident.Reference ?? string.Empty)));
        }
        return builder.ToString();
    }

    private static string FormatDate(DateTimeOffset value) =>
        TimeZoneInfo.ConvertTime(value, ElSalvador).ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);

    private static string Escape(string value)
    {
        var neutralized = value.Length > 0 && value[0] is '=' or '+' or '-' or '@' or '\t' or '\r'
            ? "'" + value
            : value;
        return neutralized.Contains(',') || neutralized.Contains('"') || neutralized.Contains('\n') || neutralized.Contains('\r')
            ? "\"" + neutralized.Replace("\"", "\"\"") + "\""
            : neutralized;
    }
}
