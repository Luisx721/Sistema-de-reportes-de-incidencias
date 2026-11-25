using System;
using System.Collections.Generic;

namespace sistema_de_reportes_de_incindencias.Models;

public partial class Rol
{
    public int IdRol { get; set; }

    public string RNombre { get; set; } = null!;

    public string? RDescripcion { get; set; }

    public bool RActivo { get; set; }

    public virtual ICollection<Usuario> Usuarios { get; set; } = new List<Usuario>();
}
