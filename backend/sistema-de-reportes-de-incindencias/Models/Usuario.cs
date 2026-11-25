using System;
using System.Collections.Generic;

namespace sistema_de_reportes_de_incindencias.Models;

public partial class Usuario
{
    public int IdUsuario { get; set; }

    public int IdRol { get; set; }

    public int? IdArea { get; set; }

    public string UNombre { get; set; } = null!;

    public string UCorreo { get; set; } = null!;

    public string UPassword { get; set; } = null!;

    public string UVinculo { get; set; } = null!;

    public bool UCorreoVerificado { get; set; }

    public bool UActivo { get; set; }

    public DateTime UFechaRegistro { get; set; }

    public virtual ICollection<Auditorium> Auditoria { get; set; } = new List<Auditorium>();

    public virtual ICollection<HistorialEstado> HistorialEstados { get; set; } = new List<HistorialEstado>();

    public virtual Area? IdAreaNavigation { get; set; }

    public virtual Rol IdRolNavigation { get; set; } = null!;

    public virtual ICollection<Incidencia> Incidencia { get; set; } = new List<Incidencia>();
}
