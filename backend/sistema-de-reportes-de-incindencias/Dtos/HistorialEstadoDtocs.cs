using System.ComponentModel.DataAnnotations;

namespace sistema_de_reportes_de_incindencias.Dtos
{
    public class HistorialEstadoDto
    {
        public int IdHistorial { get; set; }
        public int IdIncidencia { get; set; }
        public int? IdUsuarioEncargado { get; set; }
        public string Estado { get; set; } = null!;
        public string Observacion { get; set; } = null!;
        public DateTime FechaHora { get; set; }
    }

    // Cambiar el estado de una incidencia
    public class HistorialEstadoCrearDto
    {
        [Required]
        public int IdIncidencia { get; set; }

        [Required]
        public int IdUsuarioEncargado { get; set; }

        [Required, RegularExpression("Recibido|En proceso|En espera de materiales/autorización|Resuelto|Rechazado/Cerrado")]
        public string Estado { get; set; } = null!;

        [Required, MinLength(10)]
        public string Observacion { get; set; } = null!;
    }

    // Solo se puede corregir la observación
    public class HistorialEstadoPatchDto
    {
        [Required, MinLength(10)]
        public string Observacion { get; set; } = null!;
    }

    public class CambioEstadoDto
    {
        public int IdHistorial { get; set; }
        public int IdIncidencia { get; set; }
        public string EstadoActual { get; set; } = null!;
        public string Mensaje { get; set; } = null!;
    }
}
