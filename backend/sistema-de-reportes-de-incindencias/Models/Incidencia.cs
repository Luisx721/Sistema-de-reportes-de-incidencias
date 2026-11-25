using System;
using System.Collections.Generic;

namespace sistema_de_reportes_de_incindencias.Models;

public partial class Incidencia
{
    public int IdIncidencia { get; set; }

    public int? IdUsuario { get; set; }

    public int IdCategoria { get; set; }

    public int IdUbicacion { get; set; }

    public int? IdAreaSolicitante { get; set; }

    public string ICodigoSeguimiento { get; set; } = null!;

    public string? IReportanteNombre { get; set; }

    public string? IReportanteVinculo { get; set; }

    public string IDescripcion { get; set; } = null!;

    public string? IUrgencia { get; set; }

    public string? IPrioridad { get; set; }

    public string IEstadoActual { get; set; } = null!;

    public DateTime IFechaCreacion { get; set; }

    public DateTime IFechaActualizacion { get; set; }

    public string IModalidadOrigen { get; set; } = null!;

    public DateTime? IFechaCierre { get; set; }

    public virtual ICollection<Fotografia> Fotografia { get; set; } = new List<Fotografia>();

    public virtual ICollection<HistorialEstado> HistorialEstados { get; set; } = new List<HistorialEstado>();

    public virtual Area? IdAreaSolicitanteNavigation { get; set; }

    public virtual Categoria IdCategoriaNavigation { get; set; } = null!;

    public virtual Ubicacione IdUbicacionNavigation { get; set; } = null!;

    public virtual Usuario? IdUsuarioNavigation { get; set; }
}
