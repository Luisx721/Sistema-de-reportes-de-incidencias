using System.ComponentModel.DataAnnotations;

namespace sistema_de_reportes_de_incindencias.Dtos
{
    public class UbicacionDto
    {
        public int IdUbicacion { get; set; }
        public int IdEdificio { get; set; }
        public string Nombre { get; set; } = null!;
        public string? Tipo { get; set; }
        public bool Activo { get; set; }
    }

    public class UbicacionCrearDto
    {
        [Required]
        public int IdEdificio { get; set; }

        [Required, StringLength(100)]
        public string Nombre { get; set; } = null!;

        [StringLength(50)]
        public string? Tipo { get; set; }
    }

    public class UbicacionActualizarDto
    {
        [Required]
        public int IdEdificio { get; set; }

        [Required, StringLength(100)]
        public string Nombre { get; set; } = null!;

        [StringLength(50)]
        public string? Tipo { get; set; }

        public bool Activo { get; set; }
    }

    public class UbicacionPatchDto
    {
        public int? IdEdificio { get; set; }

        [StringLength(100)]
        public string? Nombre { get; set; }

        [StringLength(50)]
        public string? Tipo { get; set; }

        public bool? Activo { get; set; }
    }
}
