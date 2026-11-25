using System;
using System.Collections.Generic;

namespace sistema_de_reportes_de_incindencias.Models;

public partial class HistorialEstado
{
    public int IdHistorial { get; set; }

    public int IdIncidencia { get; set; }

    public int? IdUsuarioEncargado { get; set; }

    public string HeEstado { get; set; } = null!;

    public string HeObservacion { get; set; } = null!;

    public DateTime HeFechaHora { get; set; }

    public virtual Incidencia IdIncidenciaNavigation { get; set; } = null!;

    public virtual Usuario? IdUsuarioEncargadoNavigation { get; set; }
}
