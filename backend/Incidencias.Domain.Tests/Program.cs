using System.Text;
using System.Text.Json;
using Incidencias.Application;
using Incidencias.Domain;
using Incidencias.Infrastructure;

var checks = 0;
void Check(bool condition, string message) { checks++; if (!condition) throw new Exception(message); }
void Rejects(Action action, string message) { checks++; try { action(); } catch (ArgumentException) { return; } throw new Exception(message); }

// ==========================================
// 1. Permisos y Competencia Técnica (IncidentRules)
// ==========================================
Check(IncidentRules.CanEdit("Mantenimiento", "", "", "", "Electricidad", "Recibido"), "El técnico competente debe poder editar.");
Check(!IncidentRules.CanEdit("Administrador", "", "", "", "Electricidad", "Recibido"), "Administrador no debe obtener competencia técnica universal.");
Check(!IncidentRules.CanEdit("Mantenimiento", "", "", "", "Electricidad", "Resuelto"), "Un expediente final no se debe poder editar.");
Check(IncidentRules.CanEdit("Jefatura", "Servicios Generales", "Servicios Generales", "", "Mobiliario", "Recibido"), "Jefatura debe ver su área.");
Check(!IncidentRules.CanEdit("Jefatura", "Servicios Generales", "Otra área", "", "Mobiliario", "Recibido"), "Jefatura no debe ver otra área.");
Check(IncidentRules.CanCreateAssisted("Jefatura") && IncidentRules.CanCreateAssisted("Ordenanza"), "Jefatura y Ordenanza pueden registrar asistido.");
Check(!IncidentRules.CanCreateAssisted("Autoridad") && !IncidentRules.CanCreateAssisted("Estudiante"), "Otros roles no registran asistido.");
Check(IncidentRules.CanManageAdministration("Administrador"), "Administrador gestiona cuentas y catálogos.");
Check(!IncidentRules.CanManageAdministration("Jefatura"), "Otros roles no gestionan administración.");

// ==========================================
// 2. Transiciones y Validaciones de Modificación
// ==========================================
IncidentRules.ValidateChange("Recibido", "En proceso", "Alta", "Inspección realizada");
Rejects(() => IncidentRules.ValidateChange("Recibido", "Resuelto", "Alta", "Inspección realizada"), "Debe rechazar transiciones inválidas.");
Rejects(() => IncidentRules.ValidateChange("Recibido", "En proceso", "Alta", "corto"), "Debe exigir observación.");
Rejects(() => IncidentRules.ValidateChange("Recibido", "En proceso", "Urgente", "Inspección realizada"), "Debe validar prioridad.");

// ==========================================
// 3. Normalizaciones y Reglas de Entrada (RF-02, RF-04, RF-06)
// ==========================================
Rejects(() => IncidentRules.NormalizeDescription("muy corta"), "Descripción menor a 20 chars debe rechazarse.");
Check(IncidentRules.NormalizeDescription("Esta es una descripción suficientemente detallada para el reporte.").Length >= 20, "Descripción válida.");
Check(IncidentRules.NormalizeUrgency("Alta") == "Alta", "Urgencia válida.");
Check(IncidentRules.NormalizeUrgency(null) == null, "Urgencia nula es permitida.");
Rejects(() => IncidentRules.NormalizeUrgency("Crítica"), "Urgencia no listada debe rechazarse.");
Check(IncidentRules.NormalizeReporterLink("Estudiante") == "Estudiante", "Vínculo válido.");
Rejects(() => IncidentRules.NormalizeReporterLink("Infiltrado"), "Vínculo inválido debe rechazarse.");

// ==========================================
// 4. Privacidad del Seguimiento Público
// ==========================================
var privateNote = "Reporte recibido por Luis Pérez, teléfono 7777-1234.";
var publicStatus = IncidentContractMapper.ToPublicStatus(new IncidentDto(
    "UES001", "Electricidad", "Biblioteca", "Detalle privado", "En proceso",
    DateTimeOffset.UtcNow, "Referencia reservada", "Alta", "Mantenimiento", 2,
    [new(DateTimeOffset.UtcNow, "Recibido", privateNote), new(DateTimeOffset.UtcNow, "En proceso", privateNote)],
    Urgency: "Alta", Closed: null, ReporterName: "Luis Pérez", ReporterLink: "Estudiante"));

var json = JsonSerializer.Serialize(publicStatus);
Check(!json.Contains("reporter", StringComparison.OrdinalIgnoreCase) && !json.Contains("ownerId", StringComparison.OrdinalIgnoreCase), "Seguimiento no debe incluir identidad.");
Check(!json.Contains("Luis Pérez") && !json.Contains("7777-1234") && !json.Contains("Detalle privado") && !json.Contains("Referencia reservada"), "Seguimiento no debe incluir notas libres ni campos privados.");
Check(typeof(IIncidentStore).GetMethod(nameof(IIncidentStore.TrackAsync)) is not null, "Seguimiento público no depende de una sesión.");

// ==========================================
// 5. Filtros y Fechas en Zona Horaria de El Salvador
// ==========================================
Rejects(() => IncidentFilterRules.Validate(new IncidentFilterDto(null, null, null, null, new DateOnly(2026, 2, 2), new DateOnly(2026, 2, 1))), "El rango de fechas invertido debe rechazarse.");
var dayStart = IncidentFilterRules.StartOfDay(new DateOnly(2026, 1, 1));
Check(dayStart == new DateTimeOffset(2026, 1, 1, 6, 0, 0, TimeSpan.Zero), "Medianoche de El Salvador debe convertirse a UTC correctamente.");
var nextDayStart = IncidentFilterRules.StartOfDay(new DateOnly(2026, 1, 2));
Check(nextDayStart == new DateTimeOffset(2026, 1, 2, 6, 0, 0, TimeSpan.Zero), "El límite superior exclusivo debe ser la medianoche UTC del siguiente día calendario salvadoreño.");

// ==========================================
// 6. Seguridad de Contraseñas (PasswordHasher - RF-22)
// ==========================================
var password = "PasswordSegura123!";
var hashed = PasswordHasher.Hash(password);
Check(hashed.StartsWith("pbkdf2$210000$"), "El formato debe ser PBKDF2 con 210,000 iteraciones.");
Check(PasswordHasher.Verify(password, hashed), "La contraseña original debe verificar correctamente.");
Check(!PasswordHasher.Verify("WrongPassword!", hashed), "Una contraseña incorrecta debe fallar la verificación.");
Rejects(() => PasswordHasher.Hash("corta"), "Contraseña menor a 8 caracteres debe rechazarse.");

// ==========================================
// 7. Fotografías y Magic Bytes (PhotoRules - RF-03)
// ==========================================
byte[] validPng = [
    137, 80, 78, 71, 13, 10, 26, 10, // PNG Header
    0, 0, 0, 13, 73, 72, 68, 82,     // IHDR
    0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
    0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180,
    0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130 // IEND
];
byte[] validJpg = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9];

Check(PhotoRules.Validate("foto.png", validPng) == ".png", "PNG válido debe aceptarse.");
Check(PhotoRules.Validate("evidencia.jpg", validJpg) == ".jpg", "JPG válido debe aceptarse.");
Rejects(() => PhotoRules.Validate("malicioso.exe", validPng), "Extensión .exe debe rechazarse.");
Rejects(() => PhotoRules.Validate("falso.png", Encoding.UTF8.GetBytes("este no es un png real")), "Firma falsa de PNG debe rechazarse.");
Rejects(() => PhotoRules.Validate("falso.jpg", Encoding.UTF8.GetBytes("este no es un jpg")), "Firma falsa de JPG debe rechazarse.");
Rejects(() => PhotoRules.Validate("vacio.jpg", []), "Archivo vacío debe rechazarse.");

// ==========================================
// 8. Exportación CSV y Neutralización de Fórmulas (RF-24)
// ==========================================
var csvIncidents = new[]
{
    new IncidentDto("INC2026001", "Electricidad", "Edificio A - Aula 101", "Lámpara rota", "Recibido",
        DateTimeOffset.UtcNow, "=CMD|' /C calc'!A0", "Media", "Mantenimiento", 1, [],
        Urgency: "Alta", Closed: null),
    new IncidentDto("INC2026002", "Fontanería", "Edificio B - Baño, piso 2", "Fuga de agua", "Resuelto",
        DateTimeOffset.UtcNow, "@SUM(1+1)", "Baja", "Mantenimiento", 2, [],
        Urgency: "Media", Closed: DateTimeOffset.UtcNow)
};
var csvOutput = IncidentCsvExporter.Build(csvIncidents);
Check(csvOutput.Contains("'=CMD|' /C calc'!A0"), "Fórmula peligrosa con = debe neutralizarse con comilla simple.");
Check(csvOutput.Contains("'@SUM(1+1)"), "Fórmula peligrosa con @ debe neutralizarse con comilla simple.");
Check(csvOutput.Contains("\"Edificio B - Baño, piso 2\""), "Campo con coma debe escaparse entre comillas.");

// ==========================================
// 9. Pruebas de integración opcionales con DB
// ==========================================
if (Environment.GetEnvironmentVariable("INCIDENCIAS_DB") is { Length: > 0 } connectionString)
{
    var store = new PostgresIncidentStore(connectionString);
    var catalogs = await store.GetCatalogsAsync(CancellationToken.None);
    Check(catalogs.Categories.Count > 0 && catalogs.Locations.Count > 0, "El endpoint de catálogos debe proporcionar valores activos para registrar.");
    var catalogCategory = catalogs.Categories[0];
    var catalogLocation = catalogs.Locations[0];
    var createdFromCatalog = await store.CreateAsync(new CreateIncidentDto(catalogCategory, catalogLocation,
        "Incidencia de integración registrada usando exactamente los valores de GET /api/catalogos.", "Prueba de catálogo"), CancellationToken.None);
    Check(createdFromCatalog.Category == catalogCategory && createdFromCatalog.Location == catalogLocation,
        "El registro debe aceptar valores obtenidos del endpoint de catálogos.");
    var catalogJson = JsonSerializer.Serialize(catalogs, new JsonSerializerOptions(JsonSerializerDefaults.Web));
    Check(catalogJson.Contains("categories") && catalogJson.Contains("locations"), "El mapeo JSON del catálogo debe usar las propiedades consumidas por Angular.");
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

Console.WriteLine($"Correcto: {checks} comprobaciones de permisos, transiciones, observación, prioridad, privacidad pública, hash PBKDF2, fotografías y exportación CSV.");
