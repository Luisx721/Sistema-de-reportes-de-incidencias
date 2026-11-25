using System.ComponentModel.DataAnnotations;

namespace sistema_de_reportes_de_incindencias.Dtos
{
    public class CategoriaDto
    {
        public int IdCategoria { get; set; }
        public int IdArea { get; set; }
        public string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public bool Activo { get; set; }
    }

    public class CategoriaCrearDto
    {
        [Required]
        public int IdArea { get; set; }

        [Required, StringLength(100)]
        public string Nombre { get; set; } = null!;

        [StringLength(200)]
        public string? Descripcion { get; set; }
    }

    public class CategoriaActualizarDto
    {
        [Required]
        public int IdArea { get; set; }

        [Required, StringLength(100)]
        public string Nombre { get; set; } = null!;

        [StringLength(200)]
        public string? Descripcion { get; set; }

        public bool Activo { get; set; }
    }

    public class CategoriaPatchDto
    {
        public int? IdArea { get; set; }

        [StringLength(100)]
        public string? Nombre { get; set; }

        [StringLength(200)]
        public string? Descripcion { get; set; }

        public bool? Activo { get; set; }
    }
}