namespace Incidencias.Domain;

/// <summary>Contiene reglas de dominio independientes del almacenamiento y de HTTP.</summary>
public static class IncidentRules
{
    public static readonly IReadOnlyList<string> States =
    [
        "Recibido",
        "En proceso",
        "En espera de materiales/autorización",
        "Resuelto",
        "Rechazado/Cerrado"
    ];

    public static readonly IReadOnlyList<string> Priorities = ["Baja", "Media", "Alta"];

    public static readonly IReadOnlyList<string> Urgencies = ["Baja", "Media", "Alta"];

    public static readonly IReadOnlyList<string> ReporterLinks =
    [
        "Estudiante",
        "Docente",
        "Personal Administrativo",
        "Ordenanza",
        "Jefatura"
    ];

    private static readonly IReadOnlyDictionary<string, string[]> Transitions = new Dictionary<string, string[]>
    {
        ["Recibido"] = ["En proceso", "Rechazado/Cerrado"],
        ["En proceso"] = ["En espera de materiales/autorización", "Resuelto"],
        ["En espera de materiales/autorización"] = ["En proceso"]
    };

    private static readonly string[] InternalProfiles =
    [
        "Administrador",
        "Autoridad",
        "Jefatura",
        "Ordenanza",
        "Mantenimiento",
        "Desarrollo Físico"
    ];

    /// <summary>Verifica que la identidad vigente tenga competencia para editar el expediente.</summary>
    public static bool CanEdit(string role, string area, string requesterArea, string responsibleUnit, string category, string state)
    {
        if (state is "Resuelto" or "Rechazado/Cerrado") return false;
        if (role is "Administrador" or "Autoridad") return false;
        if (role is "Jefatura" or "Ordenanza") return area.Length > 0 && area == requesterArea;
        var unit = responsibleUnit.Length > 0 ? responsibleUnit :
            category is "Edificios" or "Espacios comunes" ? "Desarrollo Físico" : "Mantenimiento";
        return role == unit;
    }

    /// <summary>Rechaza cambios sin observación suficiente o que no respeten la transición del prototipo.</summary>
    public static void ValidateChange(string state, string nextState, string priority, string note)
    {
        if (!Priorities.Contains(priority)) throw new ArgumentException("Prioridad no válida.");
        if (!States.Contains(nextState)) throw new ArgumentException("Estado no válido.");
        if (note.Trim().Length < 10) throw new ArgumentException("La observación debe tener al menos diez caracteres.");
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

    public static string? NormalizeReporterName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;
        var value = name.Trim();
        if (value.Length > 100) throw new ArgumentException("El nombre del reportante supera los 100 caracteres.");
        return value;
    }

    public static bool IsInternalProfile(string role) => InternalProfiles.Contains(role);

    /// <summary>RF-05: solo jefaturas y ordenanzas registran en modalidad asistida.</summary>
    public static bool CanCreateAssisted(string role) => role is "Jefatura" or "Ordenanza";

    /// <summary>RF-22/RF-23: solo Administrador mantiene cuentas y catálogos.</summary>
    public static bool CanManageAdministration(string role) => role == "Administrador";
}
