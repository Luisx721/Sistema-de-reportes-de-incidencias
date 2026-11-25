using System.ComponentModel.DataAnnotations;

namespace sistema_de_reportes_de_incindencias.Dtos
{
    public class EdificioDto
    {
        public int IdEdificio { get; set; }
        public string Nombre { get; set; } = null!;
        public bool Activo { get; set; }
    }

    public class EdificioCrearDto
    {
        [Required, StringLength(200)]
        public string Nombre { get; set; } = null!;
    }

    public class EdificioActualizarDto
    {
        [Required, StringLength(200)]
        public string Nombre { get; set; } = null!;

        public bool Activo { get; set; }
    }

    public class EdificioPatchDto
    {
        [StringLength(200)]
        public string? Nombre { get; set; }

        public bool? Activo { get; set; }
    }
}
