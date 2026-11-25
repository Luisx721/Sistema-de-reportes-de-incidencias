using System.ComponentModel.DataAnnotations;

namespace sistema_de_reportes_de_incindencias.Dtos
{
    // Nunca incluye la contraseña
    public class UsuarioDto
    {
        public int IdUsuario { get; set; }
        public int IdRol { get; set; }
        public int? IdArea { get; set; }
        public string Nombre { get; set; } = null!;
        public string Correo { get; set; } = null!;
        public string Vinculo { get; set; } = null!;
        public bool CorreoVerificado { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaRegistro { get; set; }
    }

    public class UsuarioCrearDto
    {
        [Required]
        public int IdRol { get; set; }

        public int? IdArea { get; set; }

        [Required, StringLength(100)]
        public string Nombre { get; set; } = null!;

        [Required, EmailAddress, StringLength(150)]
        public string Correo { get; set; } = null!;

        [Required, StringLength(100, MinimumLength = 8)]
        public string Password { get; set; } = null!;

        [Required, StringLength(100)]
        public string Vinculo { get; set; } = null!;
    }

    // PUT: no incluye contraseña (se cambia por PATCH)
    public class UsuarioActualizarDto
    {
        [Required]
        public int IdRol { get; set; }

        public int? IdArea { get; set; }

        [Required, StringLength(100)]
        public string Nombre { get; set; } = null!;

        [Required, EmailAddress, StringLength(150)]
        public string Correo { get; set; } = null!;

        [Required, StringLength(100)]
        public string Vinculo { get; set; } = null!;

        public bool CorreoVerificado { get; set; }
        public bool Activo { get; set; }
    }

    public class UsuarioPatchDto
    {
        public int? IdRol { get; set; }
        public int? IdArea { get; set; }

        [StringLength(100)]
        public string? Nombre { get; set; }

        [EmailAddress, StringLength(150)]
        public string? Correo { get; set; }

        [StringLength(100, MinimumLength = 8)]
        public string? Password { get; set; }

        [StringLength(100)]
        public string? Vinculo { get; set; }

        public bool? CorreoVerificado { get; set; }
        public bool? Activo { get; set; }
    }
}