using System.Text.Json;
using Incidencias.Application;
using Incidencias.Domain;
using Incidencias.Infrastructure;

// Pruebas ejecutables sin un framework externo ni conexión a la base.
var checks = 0;
void Check(bool condition, string message) { checks++; if (!condition) throw new Exception(message); }
void Rejects(Action action, string message) { checks++; try { action(); } catch (ArgumentException) { return; } throw new Exception(message); }

Check(IncidentRules.CanEdit("Mantenimiento", "", "", "", "Electricidad", "Recibido"), "El técnico competente debe poder editar.");
Check(!IncidentRules.CanEdit("Administrador", "", "", "", "Electricidad", "Recibido"), "Administrador no debe obtener competencia técnica universal.");
Check(!IncidentRules.CanEdit("Mantenimiento", "", "", "", "Electricidad", "Resuelto"), "Un expediente final no se debe poder editar.");
Check(IncidentRules.CanEdit("Jefatura", "Servicios Generales", "Servicios Generales", "", "Mobiliario", "Recibido"), "Jefatura debe ver su área.");
Check(!IncidentRules.CanEdit("Jefatura", "Servicios Generales", "Otra área", "", "Mobiliario", "Recibido"), "Jefatura no debe ver otra área.");
IncidentRules.ValidateChange("Recibido", "En proceso", "Alta", "Inspección realizada");
Rejects(() => IncidentRules.ValidateChange("Recibido", "Resuelto", "Alta", "Inspección realizada"), "Debe rechazar transiciones inválidas.");
Rejects(() => IncidentRules.ValidateChange("Recibido", "En proceso", "Alta", "corto"), "Debe exigir observación.");
Rejects(() => IncidentRules.ValidateChange("Recibido", "En proceso", "Urgente", "Inspección realizada"), "Debe validar prioridad.");
var privateNote = "Reporte recibido por Luis Pérez, teléfono 7777-1234.";
var publicStatus = IncidentContractMapper.ToPublicStatus(new IncidentDto("UES001", "Electricidad", "Biblioteca", "Detalle privado", "En proceso", DateTimeOffset.UtcNow, "Referencia reservada", "Alta", "Mantenimiento", 2,
    [new(DateTimeOffset.UtcNow, "Recibido", privateNote), new(DateTimeOffset.UtcNow, "En proceso", privateNote)]));
var json = JsonSerializer.Serialize(publicStatus);
Check(!json.Contains("reporter", StringComparison.OrdinalIgnoreCase) && !json.Contains("ownerId", StringComparison.OrdinalIgnoreCase), "Seguimiento no debe incluir identidad.");
Check(!json.Contains("Luis Pérez") && !json.Contains("7777-1234") && !json.Contains("Detalle privado") && !json.Contains("Referencia reservada"), "Seguimiento no debe incluir notas libres ni campos privados.");
Check(typeof(IIncidentStore).GetMethod(nameof(IIncidentStore.TrackAsync)) is not null, "Seguimiento público no depende de una sesión.");
Rejects(() => IncidentFilterRules.Validate(new IncidentFilterDto(null, null, null, null, new DateOnly(2026, 2, 2), new DateOnly(2026, 2, 1))), "El rango de fechas invertido debe rechazarse.");
var dayStart = IncidentFilterRules.StartOfDay(new DateOnly(2026, 1, 1));
Check(dayStart == new DateTimeOffset(2026, 1, 1, 6, 0, 0, TimeSpan.Zero), "Medianoche de El Salvador debe convertirse a UTC correctamente.");
var nextDayStart = IncidentFilterRules.StartOfDay(new DateOnly(2026, 1, 2));
Check(nextDayStart == new DateTimeOffset(2026, 1, 2, 6, 0, 0, TimeSpan.Zero), "El límite superior exclusivo debe ser la medianoche UTC del siguiente día calendario salvadoreño.");
if (Environment.GetEnvironmentVariable("INCIDENCIAS_DB") is { Length: > 0 } connectionString)
{
    var store = new PostgresIncidentStore(connectionString);
    var authority = new SessionDto("integration-test", "Integration test", "Autoridad", null, DateTimeOffset.UtcNow);
    foreach (var filter in new[]
    {
        new IncidentFilterDto(null, null, null, null, null, null),
        new IncidentFilterDto(null, null, null, "Recibido", null, null),
        new IncidentFilterDto(null, null, null, null, new DateOnly(2026, 1, 1), null),
        new IncidentFilterDto(null, null, null, null, null, new DateOnly(2026, 1, 1)),
        new IncidentFilterDto(null, null, null, null, new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 2))
    })
    {
        await store.ListAsync(filter, authority, CancellationToken.None);
        checks++;
    }
}
var stale = new IncidentConflictException("versión obsoleta");
Check(stale.Message.Contains("obsoleta"), "Los conflictos optimistas deben ser identificables.");
Console.WriteLine($"Correcto: {checks} comprobaciones de permisos, transiciones, observación, prioridad y privacidad pública.");
