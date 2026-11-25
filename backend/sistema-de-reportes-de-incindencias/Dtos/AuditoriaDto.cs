using System.ComponentModel.DataAnnotations;

namespace sistema_de_reportes_de_incindencias.Dtos;

public sealed class AuditoriaDto
{
    public int IdAuditoria { get; set; }
    public int? IdUsuario { get; set; }
    public string Origen { get; set; } = null!;
    public string Tabla { get; set; } = null!;
    public int IdRegistro { get; set; }
    public string Accion { get; set; } = null!;
    public string? ValorAnterior { get; set; }
    public string? ValorNuevo { get; set; }
    public DateTime FechaHora { get; set; }
}

// Datos ficticios para demostrar el CRUD en desarrollo.
public sealed class AuditoriaPruebaDto
{
    [Range(1, int.MaxValue)]
    public int IdRegistro { get; set; }

    [Required, RegularExpression("INSERT|UPDATE|DELETE")]
    public string Accion { get; set; } = null!;

    [StringLength(500)]
    public string? ValorAnterior { get; set; }

    [StringLength(500)]
    public string? ValorNuevo { get; set; }
}