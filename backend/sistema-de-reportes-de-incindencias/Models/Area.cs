using System;
using System.Collections.Generic;

namespace sistema_de_reportes_de_incindencias.Models;

public partial class Area
{
    public int IdArea { get; set; }

    public string ANombre { get; set; } = null!;

    public string? ATipo { get; set; }

    public bool AEsResponsable { get; set; }

    public bool AActivo { get; set; }

    public virtual ICollection<Categoria> Categoria { get; set; } = new List<Categoria>();

    public virtual ICollection<Incidencia> Incidencia { get; set; } = new List<Incidencia>();

    public virtual ICollection<Usuario> Usuarios { get; set; } = new List<Usuario>();
}
