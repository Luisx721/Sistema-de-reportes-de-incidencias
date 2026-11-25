using System;
using System.Collections.Generic;

namespace sistema_de_reportes_de_incindencias.Models;

public partial class Auditorium
{
    public int IdAuditoria { get; set; }

    public int? IdUsuario { get; set; }

    public string AuOrigen { get; set; } = null!;

    public string AuTabla { get; set; } = null!;

    public int AuIdRegistro { get; set; }

    public string AuAccion { get; set; } = null!;

    public string? AuValorAnterior { get; set; }

    public string? AuValorNuevo { get; set; }

    public DateTime AuFechaHora { get; set; }

    public virtual Usuario? IdUsuarioNavigation { get; set; }
}
