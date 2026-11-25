using System;
using System.Collections.Generic;

namespace sistema_de_reportes_de_incindencias.Models;

public partial class Categoria
{
    public int IdCategoria { get; set; }

    public int IdArea { get; set; }

    public string CNombre { get; set; } = null!;

    public string? CDescripcion { get; set; }

    public bool CActivo { get; set; }

    public virtual Area IdAreaNavigation { get; set; } = null!;

    public virtual ICollection<Incidencia> Incidencia { get; set; } = new List<Incidencia>();
}
