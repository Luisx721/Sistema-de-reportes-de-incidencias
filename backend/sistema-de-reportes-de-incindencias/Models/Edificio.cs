using System;
using System.Collections.Generic;

namespace sistema_de_reportes_de_incindencias.Models;

public partial class Edificio
{
    public int IdEdificio { get; set; }

    public string ENombre { get; set; } = null!;

    public bool EActivo { get; set; }

    public virtual ICollection<Ubicacione> Ubicaciones { get; set; } = new List<Ubicacione>();
}
