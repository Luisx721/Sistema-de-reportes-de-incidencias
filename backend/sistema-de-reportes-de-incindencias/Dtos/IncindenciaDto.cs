using System.ComponentModel.DataAnnotations;

namespace sistema_de_reportes_de_incindencias.Dtos
{
    public class IncidenciaDto
    {
        public int IdIncidencia { get; set; }
        public int? IdUsuario { get; set; }
        public int IdCategoria { get; set; }
        public int IdUbicacion { get; set; }
        public int? IdAreaSolicitante { get; set; }
        public string CodigoSeguimiento { get; set; } = null!;
        public string? ReportanteNombre { get; set; }
        public string? ReportanteVinculo { get; set; }
        public string Descripcion { get; set; } = null!;
        public string? Urgencia { get; set; }
        public string? Prioridad { get; set; }
        public string EstadoActual { get; set; } = null!;
        public DateTime FechaCreacion { get; set; }
        public DateTime FechaActualizacion { get; set; }
        public string ModalidadOrigen { get; set; } = null!;
        public DateTime? FechaCierre { get; set; }
    }

    public class IncidenciaCrearDto
    {
        public int? IdUsuario { get; set; }

        [Required]
        public int IdCategoria { get; set; }

        [Required]
        public int IdUbicacion { get; set; }

        public int? IdAreaSolicitante { get; set; }

        [StringLength(100)]
        public string? ReportanteNombre { get; set; }

        [RegularExpression("Estudiante|Docente|Personal Administrativo|Ordenanza|Jefatura")]
        public string? ReportanteVinculo { get; set; }

        [Required, MinLength(20)]
        public string Descripcion { get; set; } = null!;

        [RegularExpression("Baja|Media|Alta")]
        public string? Urgencia { get; set; }

        [Required, RegularExpression("Comunitario|Asistido")]
        public string ModalidadOrigen { get; set; } = null!;
    }

    // Resultado del POST
    public class IncidenciaRegistroDto
    {
        public int IdIncidencia { get; set; }
        public string CodigoSeguimiento { get; set; } = null!;
        public bool EsDuplicado { get; set; }
        public string Mensaje { get; set; } = null!;
    }

    // PUT: datos editables (el estado NO se cambia aquí, va por historial)
    public class IncidenciaActualizarDto
    {
        [Required]
        public int IdCategoria { get; set; }

        [Required]
        public int IdUbicacion { get; set; }

        public int? IdAreaSolicitante { get; set; }

        [Required, MinLength(20)]
        public string Descripcion { get; set; } = null!;

        [RegularExpression("Baja|Media|Alta")]
        public string? Urgencia { get; set; }

        [RegularExpression("Baja|Media|Alta")]
        public string? Prioridad { get; set; }
    }

    public class IncidenciaPatchDto
    {
        public int? IdCategoria { get; set; }
        public int? IdUbicacion { get; set; }
        public int? IdAreaSolicitante { get; set; }

        [MinLength(20)]
        public string? Descripcion { get; set; }

        [RegularExpression("Baja|Media|Alta")]
        public string? Urgencia { get; set; }

        [RegularExpression("Baja|Media|Alta")]
        public string? Prioridad { get; set; }
    }
}