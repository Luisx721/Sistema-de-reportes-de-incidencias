using System.ComponentModel.DataAnnotations;

namespace sistema_de_reportes_de_incindencias.Dtos
{
    public class AreaDto
    {
        public int IdArea { get; set; }
        public string Nombre { get; set; } = null!;
        public string? Tipo { get; set; }
        public bool EsResponsable { get; set; }
        public bool Activo { get; set; }
    }

    public class AreaCrearDto
    {
        [Required, StringLength(100)]
        public string Nombre { get; set; } = null!;

        [StringLength(50)]
        public string? Tipo { get; set; }

        public bool EsResponsable { get; set; }
    }

    public class AreaActualizarDto
    {
        [Required, StringLength(100)]
        public string Nombre { get; set; } = null!;

        [StringLength(50)]
        public string? Tipo { get; set; }

        public bool EsResponsable { get; set; }
        public bool Activo { get; set; }
    }

    // PATCH: todo opcional, solo se cambia lo que llegue
    public class AreaPatchDto
    {
        [StringLength(100)]
        public string? Nombre { get; set; }

        [StringLength(50)]
        public string? Tipo { get; set; }

        public bool? EsResponsable { get; set; }
        public bool? Activo { get; set; }
    }
}