namespace Incidencias.Domain;

/// <summary>Contiene reglas de dominio independientes del almacenamiento y de HTTP.</summary>
public static class IncidentRules
{
    private static readonly IReadOnlyDictionary<string, string[]> Transitions = new Dictionary<string, string[]>
    {
        ["Recibido"] = ["En proceso", "Rechazado/Cerrado"],
        ["En proceso"] = ["En espera de materiales/autorización", "Resuelto"],
        ["En espera de materiales/autorización"] = ["En proceso"]
    };

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
        if (!new[] { "Baja", "Media", "Alta" }.Contains(priority)) throw new ArgumentException("Prioridad no válida.");
        if (note.Trim().Length < 10) throw new ArgumentException("La observación debe tener al menos diez caracteres.");
        if (state != nextState && (!Transitions.TryGetValue(state, out var allowed) || !allowed.Contains(nextState)))
            throw new ArgumentException("Transición de estado no permitida.");
        if (state == nextState && priority.Length == 0) throw new ArgumentException("No hay cambios para guardar.");
    }
}
