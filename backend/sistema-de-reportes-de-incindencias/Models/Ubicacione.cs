using System;
using System.Collections.Generic;

namespace sistema_de_reportes_de_incindencias.Models;

public partial class Ubicacione
{
    public int IdUbicacion { get; set; }

    public int IdEdificio { get; set; }

    public string UbNombre { get; set; } = null!;

    public string? UbTipo { get; set; }

    public bool UbActivo { get; set; }

    public virtual Edificio IdEdificioNavigation { get; set; } = null!;

    public virtual ICollection<Incidencia> Incidencia { get; set; } = new List<Incidencia>();
}
