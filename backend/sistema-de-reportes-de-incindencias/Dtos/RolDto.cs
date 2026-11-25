using System.ComponentModel.DataAnnotations;

namespace sistema_de_reportes_de_incindencias.Dtos
{
    public class RolDto
    {
        public int IdRol { get; set; }
        public string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public bool Activo { get; set; }
    }

    // Lo que se manda para crear
    public class RolCrearDto
    {
        [Required, StringLength(50)]
        public string Nombre { get; set; } = null!;

        [StringLength(200)]
        public string? Descripcion { get; set; }
    }
    // Lo que se manda para actualizar todo el registro
    public class RolActualizarDto
    {
        [Required, StringLength(50)]
        public string Nombre { get; set; } = null!;

        [StringLength(200)]
        public string? Descripcion { get; set; }

        public bool Activo { get; set; }
    }
}
