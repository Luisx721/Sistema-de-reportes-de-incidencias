namespace Incidencias.Domain;

/// <summary>Contiene reglas de dominio independientes del almacenamiento y de HTTP.</summary>
public static class IncidentRules
{
    /// <summary>Estados del expediente. Se comparan como texto literal, así que un cambio de redacción debe replicarse en el resto del dominio y en los datos guardados.</summary>
    public static readonly IReadOnlyList<string> States =
    [
        "Recibido",
        "En proceso",
        "En espera de materiales/autorización",
        "Resuelto",
        "Rechazado/Cerrado"
    ];

    /// <summary>Prioridad técnica, asignada por el personal que gestiona el expediente.</summary>
    public static readonly IReadOnlyList<string> Priorities = ["Baja", "Media", "Alta"];

    /// <summary>Urgencia percibida, declarada por el reportante (RF-06). Es independiente de la prioridad técnica.</summary>
    public static readonly IReadOnlyList<string> Urgencies = ["Baja", "Media", "Alta"];

    /// <summary>Vínculos que el reportante puede declarar con la institución (RF-04).</summary>
    public static readonly IReadOnlyList<string> ReporterLinks =
    [
        "Estudiante",
        "Docente",
        "Personal Administrativo",
        "Ordenanza",
        "Jefatura"
    ];

    // Resuelto y Rechazado/Cerrado no tienen entrada: son estados finales.
    private static readonly IReadOnlyDictionary<string, string[]> Transitions = new Dictionary<string, string[]>
    {
        ["Recibido"] = ["En proceso", "Rechazado/Cerrado"],
        ["En proceso"] = ["En espera de materiales/autorización", "Resuelto"],
        ["En espera de materiales/autorización"] = ["En proceso"]
    };

    // Perfiles institucionales con acceso al sistema interno (inicio de sesión y validación de cuentas).
    private static readonly string[] InternalProfiles =
    [
        "Administrador",
        "Autoridad",
        "Jefatura",
        "Ordenanza",
        "Mantenimiento",
        "Desarrollo Físico"
    ];

    /// <summary>Verifica que la identidad vigente tenga competencia para editar el expediente. Ver el listado (<see cref="CanViewPanel"/>) no concede edición.</summary>
    /// <param name="area">Área asignada al usuario autenticado.</param>
    /// <param name="requesterArea">Área solicitante con la que se registró el reporte (modalidad asistida).</param>
    /// <param name="responsibleUnit">Unidad responsable guardada en el expediente; vacía si no hubo asignación ni derivación directa.</param>
    public static bool CanEdit(string role, string area, string requesterArea, string responsibleUnit, string category, string state)
    {
        // Un expediente cerrado no se vuelve a editar, sea cual sea el perfil.
        if (state is "Resuelto" or "Rechazado/Cerrado") return false;
        // Administrador y Autoridad tienen acceso de solo lectura.
        if (role is "Administrador" or "Autoridad") return false;

        // D-01: Jefatura y Ordenanza son de solo consulta (RF-11); no editan estado ni prioridad. Solo editan Mantenimiento
        // y Desarrollo Físico, y únicamente los casos de su unidad.
        
        // Enrutamiento provisional por categoría, mientras se cierran los catálogos institucionales.
        var unit = responsibleUnit.Length > 0 ? responsibleUnit :
            category is "Edificios" or "Espacios comunes" ? "Desarrollo Físico" : "Mantenimiento";
        return role == unit;
    }

    /// <summary>Rechaza cambios sin observación suficiente o que no respeten la transición del prototipo. La prioridad es técnica, no la urgencia de RF-06.</summary>
    public static void ValidateChange(string state, string nextState, string priority, string note)
    {
        if (!Priorities.Contains(priority)) throw new ArgumentException("Prioridad no válida.");
        if (!States.Contains(nextState)) throw new ArgumentException("Estado no válido.");
        if (note.Trim().Length < 10) throw new ArgumentException("La observación debe tener al menos diez caracteres.");
        // Con el mismo estado solo se ajusta prioridad u observación; la transición se valida si el estado cambia.
        if (state != nextState && (!Transitions.TryGetValue(state, out var allowed) || !allowed.Contains(nextState)))
            throw new ArgumentException("Transición de estado no permitida.");
        if (state == nextState && priority.Length == 0) throw new ArgumentException("No hay cambios para guardar.");
    }

    /// <summary>Valida la descripción pública del reporte (RF-02).</summary>
    public static string NormalizeDescription(string? description)
    {
        var value = description?.Trim() ?? string.Empty;
        if (value.Length is < 20 or > 2000)
            throw new ArgumentException("La descripción debe tener entre 20 y 2000 caracteres.");
        return value;
    }

    /// <summary>Valida la urgencia percibida opcional (RF-06), distinta de la prioridad técnica.</summary>
    public static string? NormalizeUrgency(string? urgency)
    {
        if (string.IsNullOrWhiteSpace(urgency)) return null;
        var value = urgency.Trim();
        if (!Urgencies.Contains(value)) throw new ArgumentException("Urgencia no válida.");
        return value;
    }

    /// <summary>Valida el vínculo declarado del reportante (RF-04).</summary>
    public static string? NormalizeReporterLink(string? link)
    {
        if (string.IsNullOrWhiteSpace(link)) return null;
        var value = link.Trim();
        if (!ReporterLinks.Contains(value)) throw new ArgumentException("Vínculo del reportante no válido.");
        return value;
    }

    /// <summary>Valida el nombre opcional del reportante: vacío equivale a anónimo y se limita a 100 caracteres.</summary>
    public static string? NormalizeReporterName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;
        var value = name.Trim();
        if (value.Length > 100) throw new ArgumentException("El nombre del reportante supera los 100 caracteres.");
        return value;
    }

    /// <summary>Indica si el perfil es institucional, con acceso al sistema interno.</summary>
    public static bool IsInternalProfile(string role) => InternalProfiles.Contains(role);
    
    /// <summary>RF-13: el panel centralizado es del personal técnico; ver el listado no concede edición (D-01).</summary>
    public static bool CanViewPanel(string role) => role is "Mantenimiento" or "Desarrollo Físico";

    /// <summary>RF-05: solo jefaturas y ordenanzas registran en modalidad asistida.</summary>
    public static bool CanCreateAssisted(string role) => role is "Jefatura" or "Ordenanza";

    /// <summary>RF-22/RF-23: solo Administrador mantiene cuentas y catálogos.</summary>
    public static bool CanManageAdministration(string role) => role == "Administrador";
}