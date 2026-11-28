// Pruebas del dominio y de los contratos públicos, como aplicación de consola sin framework externo.
// Ejecución: dotnet run --project backend/Incidencias.Domain.Tests
// Las comprobaciones en memoria siempre corren; las de PostgreSQL (sección 9) solo si existe INCIDENCIAS_DB.
// Se detiene en la primera comprobación que falla; si todo pasa, la última línea imprime el total.
using System.Text;
using System.Text.Json;
using Incidencias.Application;
using Incidencias.Domain;
using Incidencias.Infrastructure;

var checks = 0;
// Cuenta la comprobación y detiene la ejecución si no se cumple.
void Check(bool condition, string message) { checks++; if (!condition) throw new Exception(message); }
// Espera una ArgumentException, que es la que lanzan las validaciones de dominio; cualquier otra excepción se propaga y falla la ejecución.
void Rejects(Action action, string message) { checks++; try { action(); } catch (ArgumentException) { return; } throw new Exception(message); }

// ==========================================
// 1. Permisos y Competencia Técnica (IncidentRules)
// ==========================================
// Verifica edición por área/estado final, registro asistido por rol y acceso a administración.
Check(IncidentRules.CanEdit("Mantenimiento", "", "", "", "Electricidad", "Recibido"), "El técnico competente debe poder editar.");
Check(!IncidentRules.CanEdit("Administrador", "", "", "", "Electricidad", "Recibido"), "Administrador no debe obtener competencia técnica universal.");
Check(!IncidentRules.CanEdit("Mantenimiento", "", "", "", "Electricidad", "Resuelto"), "Un expediente final no se debe poder editar.");
// D-01: Jefatura y Ordenanza son de solo consulta; no editan ni siquiera los casos de su propia área.
Check(!IncidentRules.CanEdit("Jefatura", "Servicios Generales", "Servicios Generales", "", "Mobiliario", "Recibido"), "D-01: Jefatura no debe editar ni en su propia área.");
Check(!IncidentRules.CanEdit("Ordenanza", "Servicios Generales", "Servicios Generales", "", "Mobiliario", "Recibido"), "D-01: Ordenanza no debe editar ni en su propia área.");
Check(!IncidentRules.CanEdit("Jefatura", "Servicios Generales", "Otra área", "", "Mobiliario", "Recibido"), "Jefatura no debe ver otra área.");
Check(IncidentRules.CanCreateAssisted("Jefatura") && IncidentRules.CanCreateAssisted("Ordenanza"), "Jefatura y Ordenanza pueden registrar asistido.");
Check(!IncidentRules.CanCreateAssisted("Autoridad") && !IncidentRules.CanCreateAssisted("Estudiante"), "Otros roles no registran asistido.");
Check(IncidentRules.CanManageAdministration("Administrador"), "Administrador gestiona cuentas y catálogos.");
Check(!IncidentRules.CanManageAdministration("Jefatura"), "Otros roles no gestionan administración.");

// ==========================================
// 2. Transiciones y Validaciones de Modificación
// ==========================================
// Comprueba transiciones de estado válidas/inválidas, longitud mínima de observación y prioridad.
IncidentRules.ValidateChange("Recibido", "En proceso", "Alta", "Inspección realizada");
// Un reporte Recibido no pasa directo a Resuelto: primero debe entrar a En proceso.
Rejects(() => IncidentRules.ValidateChange("Recibido", "Resuelto", "Alta", "Inspección realizada"), "Debe rechazar transiciones inválidas.");
Rejects(() => IncidentRules.ValidateChange("Recibido", "En proceso", "Alta", "corto"), "Debe exigir observación.");
Rejects(() => IncidentRules.ValidateChange("Recibido", "En proceso", "Urgente", "Inspección realizada"), "Debe validar prioridad.");

// ==========================================
// 3. Normalizaciones y Reglas de Entrada (RF-02, RF-04, RF-06)
// ==========================================
// Valida límites de descripción, valores permitidos de urgencia y vínculo del reportante.
Rejects(() => IncidentRules.NormalizeDescription("muy corta"), "Descripción menor a 20 chars debe rechazarse.");
Check(IncidentRules.NormalizeDescription("Esta es una descripción suficientemente detallada para el reporte.").Length >= 20, "Descripción válida.");
Check(IncidentRules.NormalizeUrgency("Alta") == "Alta", "Urgencia válida.");
Check(IncidentRules.NormalizeUrgency(null) == null, "Urgencia nula es permitida.");
// "Crítica" no está en el catálogo vigente (Baja, Media, Alta); si RF-06 la incorpora, esta prueba debe actualizarse.
Rejects(() => IncidentRules.NormalizeUrgency("Crítica"), "Urgencia no listada debe rechazarse.");
Check(IncidentRules.NormalizeReporterLink("Estudiante") == "Estudiante", "Vínculo válido.");
Rejects(() => IncidentRules.NormalizeReporterLink("Infiltrado"), "Vínculo inválido debe rechazarse.");

// ==========================================
// 4. Privacidad del Seguimiento Público
// ==========================================
// Garantiza que PublicStatusDto oculte identidad, descripción, referencia y la nota inicial de "Recibido";
// en los demás estados publica la observación técnica del cambio (RF-10).
// Datos ficticios: la nota de "Recibido" simula contenido del trámite que no debe hacerse público.
var privateNote = "Reporte recibido por Luis Pérez, teléfono 7777-1234.";
var technicalNote = "Se reemplazó la luminaria del pasillo.";
var publicStatus = IncidentContractMapper.ToPublicStatus(new IncidentDto(
    "UES001", "Electricidad", "Biblioteca", "Detalle privado", "En proceso",
    DateTimeOffset.UtcNow, "Referencia reservada", "Alta", "Mantenimiento", 2,
    [new(DateTimeOffset.UtcNow, "Recibido", privateNote),
     new(DateTimeOffset.UtcNow, "En proceso", technicalNote),
     new(DateTimeOffset.UtcNow, "Resuelto", "   ")],
    Urgency: "Alta", Closed: null, ReporterName: "Luis Pérez", ReporterLink: "Estudiante"));

var json = JsonSerializer.Serialize(publicStatus);
// Verificación defensiva: ningún campo de identidad ni identificador de propietario debe salir en el JSON público.
Check(!json.Contains("reporter", StringComparison.OrdinalIgnoreCase) && !json.Contains("ownerId", StringComparison.OrdinalIgnoreCase), "Seguimiento no debe incluir identidad.");
Check(!json.Contains("Luis") && !json.Contains("7777-1234") && !json.Contains("Detalle privado") && !json.Contains("Referencia reservada"), "Seguimiento no debe incluir identidad, descripción, referencia ni la nota del estado Recibido.");
Check(publicStatus.History[0].Note == "Reporte recibido.", "El estado Recibido usa mensaje fijo y no la nota original.");
Check(publicStatus.History[1].Note == technicalNote, "RF-10: el seguimiento público muestra la observación técnica del cambio de estado.");
Check(publicStatus.History[2].Note == "Estado actualizado a Resuelto.", "Una observación en blanco cae en el mensaje genérico.");
// Solo comprueba que TrackAsync exista en la interfaz; no valida su firma.
Check(typeof(IIncidentStore).GetMethod(nameof(IIncidentStore.TrackAsync)) is not null, "Seguimiento público no depende de una sesión.");

// ==========================================
// 4b. Privacidad de la respuesta de creación (duplicado)
// ==========================================
// Valida que ToCreateResult no filtre datos del caso previo ni identidad en respuestas de creación/duplicado.
// En un duplicado solo se devuelve el código del caso abierto existente, con el aviso.
var duplicateIncident = new IncidentDto(
    "UES001", "Electricidad", "Biblioteca", "Detalle privado", "En proceso",
    DateTimeOffset.UtcNow, "Referencia reservada", "Alta", "Mantenimiento", 2,
    [new(DateTimeOffset.UtcNow, "Recibido", privateNote)],
    Urgency: "Alta", Closed: null, ReporterName: "Luis Pérez", ReporterLink: "Estudiante",
    IsDuplicate: true);

var createResult = IncidentContractMapper.ToCreateResult(duplicateIncident);
var createJson = JsonSerializer.Serialize(createResult);
Check(createResult.Code == "UES001" && createResult.IsDuplicate, "El duplicado debe devolver el código permitido y el aviso.");
Check(createResult.Message.Contains("Ya existe"), "El duplicado debe llevar mensaje de aviso.");
Check(!createJson.Contains("reporter", StringComparison.OrdinalIgnoreCase), "La creación no debe incluir campos de identidad.");
Check(!createJson.Contains("Luis") && !createJson.Contains("7777-1234"), "La creación no debe filtrar nombre ni teléfono.");
Check(!createJson.Contains("Detalle privado") && !createJson.Contains("Referencia reservada"), "La creación no debe filtrar descripción ni referencia.");
Check(!createJson.Contains("history", StringComparison.OrdinalIgnoreCase) && !createJson.Contains("Mantenimiento"), "La creación no debe filtrar historial ni unidad.");

// Comprueba también la respuesta normal cuando no hay coincidencia de duplicado.
var normalResult = IncidentContractMapper.ToCreateResult(duplicateIncident with { IsDuplicate = false });
Check(!normalResult.IsDuplicate && normalResult.Message == "Reporte recibido.", "El caso sin duplicado debe seguir funcionando.");

// Resumen público de listados y mapa: sin descripción, identidad, historial ni prioridad técnica.
var summaryJson = JsonSerializer.Serialize(new PublicIncidentSummaryDto(
    "UES001", "Electricidad", "Biblioteca", "En proceso", DateTimeOffset.UtcNow, "Alta", null));
Check(!summaryJson.Contains("description", StringComparison.OrdinalIgnoreCase)
   && !summaryJson.Contains("reporter", StringComparison.OrdinalIgnoreCase)
   && !summaryJson.Contains("history", StringComparison.OrdinalIgnoreCase)
   && !summaryJson.Contains("priority", StringComparison.OrdinalIgnoreCase), "El resumen publico no debe incluir campos privados.");


// ==========================================
// 4c. RF-13: panel centralizado y D-01
// ==========================================
// El panel es solo del personal técnico, y verlo no concede editar casos de otra unidad (D-01).
Check(IncidentRules.CanViewPanel("Mantenimiento") && IncidentRules.CanViewPanel("Desarrollo Físico"), "RF-13: el panel centralizado está disponible para Mantenimiento y Desarrollo Físico.");
Check(!IncidentRules.CanViewPanel("Jefatura") && !IncidentRules.CanViewPanel("Ordenanza") && !IncidentRules.CanViewPanel("Autoridad") && !IncidentRules.CanViewPanel("Administrador") && !IncidentRules.CanViewPanel("Invitado"), "RF-13: otros perfiles no usan el panel técnico.");
Check(!IncidentRules.CanEdit("Mantenimiento", "", "Servicios", "Desarrollo Físico", "Edificios", "En proceso")
      && !IncidentRules.CanEdit("Desarrollo Físico", "", "Servicios", "Mantenimiento", "Electricidad", "Recibido")
      && IncidentRules.CanEdit("Mantenimiento", "", "Servicios", "Mantenimiento", "Electricidad", "En proceso"),
      "D-01: ver el panel no concede editar casos de otra unidad; la propia sí puede.");
// El resumen del panel no expone descripción, reportante ni historial.
var panelSummaryJson = JsonSerializer.Serialize(new IncidentSummaryDto("UES001", DateTimeOffset.UtcNow, "Electricidad", "Biblioteca - Sala", "Alta", "En proceso", "Mantenimiento"));
Check(!panelSummaryJson.Contains("description", StringComparison.OrdinalIgnoreCase) && !panelSummaryJson.Contains("reporter", StringComparison.OrdinalIgnoreCase) && !panelSummaryJson.Contains("history", StringComparison.OrdinalIgnoreCase), "RF-13: el resumen del panel no incluye descripción, reportante ni historial.");
// ==========================================
// 5. Filtros y Fechas en Zona Horaria de El Salvador
// ==========================================
// Verifica rechazo de rangos invertidos y conversión del inicio de día local (UTC-6) a UTC.
Rejects(() => IncidentFilterRules.Validate(new IncidentFilterDto(null, null, null, null, new DateOnly(2026, 2, 2), new DateOnly(2026, 2, 1))), "El rango de fechas invertido debe rechazarse.");
var dayStart = IncidentFilterRules.StartOfDay(new DateOnly(2026, 1, 1));
Check(dayStart == new DateTimeOffset(2026, 1, 1, 6, 0, 0, TimeSpan.Zero), "Medianoche de El Salvador debe convertirse a UTC correctamente.");
// Equivale al límite superior exclusivo del filtro "hasta" (StartOfNextDay), aunque aquí se calcula con StartOfDay.
var nextDayStart = IncidentFilterRules.StartOfDay(new DateOnly(2026, 1, 2));
Check(nextDayStart == new DateTimeOffset(2026, 1, 2, 6, 0, 0, TimeSpan.Zero), "El límite superior exclusivo debe ser la medianoche UTC del siguiente día calendario salvadoreño.");

// ==========================================
// 6. Seguridad de Contraseñas (PasswordHasher - RF-22)
// ==========================================
// Comprueba hashing PBKDF2, verificación de clave correcta/incorrecta y longitud mínima.
var password = "PasswordSegura123!";
var hashed = PasswordHasher.Hash(password);
Check(hashed.StartsWith("pbkdf2$210000$"), "El formato debe ser PBKDF2 con 210,000 iteraciones.");
Check(PasswordHasher.Verify(password, hashed), "La contraseña original debe verificar correctamente.");
Check(!PasswordHasher.Verify("WrongPassword!", hashed), "Una contraseña incorrecta debe fallar la verificación.");
Rejects(() => PasswordHasher.Hash("corta"), "Contraseña menor a 8 caracteres debe rechazarse.");
// ==========================================
// 7. Fotografías y Magic Bytes (PhotoRules - RF-03)
// ==========================================
// PhotoRules valida la extensión permitida y la firma binaria (magic bytes), para que un archivo renombrado no pase como imagen.
// El tamaño y la cantidad de fotos no se validan aquí.
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
// Extensión permitida pero contenido que no corresponde a una imagen.
Rejects(() => PhotoRules.Validate("falso.png", Encoding.UTF8.GetBytes("este no es un png real")), "Firma falsa de PNG debe rechazarse.");
Rejects(() => PhotoRules.Validate("falso.jpg", Encoding.UTF8.GetBytes("este no es un jpg")), "Firma falsa de JPG debe rechazarse.");
Rejects(() => PhotoRules.Validate("vacio.jpg", []), "Archivo vacío debe rechazarse.");

// ==========================================
// 8. Exportación CSV y Neutralización de Fórmulas (RF-24)
// ==========================================
// La exportación se expone en GET /api/incidencias/exportar. Estas pruebas verifican que los valores que
// empiezan con un carácter de fórmula se neutralicen con comilla simple (para que una hoja de cálculo no
// los ejecute) y que los campos con coma se escapen entre comillas. Solo se prueban los prefijos = y @.
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
// Prueba de humo contra PostgreSQL: solo corre si INCIDENCIAS_DB está definida (la cadena de conexión viene del entorno).
// Inserta una incidencia real en cada corrida, por lo que conviene apuntarla a una base de pruebas.
if (Environment.GetEnvironmentVariable("INCIDENCIAS_DB") is { Length: > 0 } connectionString)
{
    var store = new PostgresIncidentStore(connectionString);
    var catalogs = await store.GetCatalogsAsync(CancellationToken.None);
    Check(catalogs.Categories.Count > 0 && catalogs.Locations.Count > 0, "El endpoint de catálogos debe proporcionar valores activos para registrar.");
    var catalogCategory = catalogs.Categories[0];
    var catalogLocation = catalogs.Locations[0];
    // Si ya hay un caso abierto con esta categoría y ubicación, el store devuelve ese caso como duplicado y la prueba igual pasa.
    var createdFromCatalog = await store.CreateAsync(new CreateIncidentDto(catalogCategory, catalogLocation,
        "Incidencia de integración registrada usando exactamente los valores de GET /api/catalogos.", "Prueba de catálogo"), CancellationToken.None);
    Check(createdFromCatalog.Category == catalogCategory && createdFromCatalog.Location == catalogLocation,
        "El registro debe aceptar valores obtenidos del endpoint de catálogos.");
    var catalogJson = JsonSerializer.Serialize(catalogs, new JsonSerializerOptions(JsonSerializerDefaults.Web));
    Check(catalogJson.Contains("categories") && catalogJson.Contains("locations"), "El mapeo JSON del catálogo debe usar las propiedades consumidas por Angular.");
    // Autoridad ve todos los expedientes, así que ningún filtro se recorta por área o unidad.
    var authority = new SessionDto("integration-test", "Integration test", "Autoridad", null, DateTimeOffset.UtcNow);
    // Solo se verifica que cada combinación de filtros se ejecute sin error, no el contenido devuelto.
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

// Los conflictos de concurrencia optimista se identifican por este tipo de excepción (Program.cs la traduce a HTTP 409).
var stale = new IncidentConflictException("versión obsoleta");
Check(stale.Message.Contains("obsoleta"), "Los conflictos optimistas deben ser identificables.");

Console.WriteLine($"Correcto: {checks} comprobaciones de permisos, transiciones, observación, prioridad, privacidad pública, hash PBKDF2, fotografías y exportación CSV.");