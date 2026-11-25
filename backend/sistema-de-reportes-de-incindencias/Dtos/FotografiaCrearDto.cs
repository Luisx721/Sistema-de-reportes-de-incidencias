using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace sistema_de_reportes_de_incindencias.Dtos;

public sealed class FotografiaCrearDto
{
    [Range(1, int.MaxValue)]
    public int IdIncidencia { get; set; }

    [Required]
    public IFormFile Archivo { get; set; } = null!;
}

// System.Text.Json convierte automáticamente el Base64 de la petición en bytes.
public sealed class FotografiaJsonDto : FotografiaActualizarDto
{
    [Range(1, int.MaxValue)]
    public int IdIncidencia { get; set; }
}

public class FotografiaActualizarDto
{
    [Required, StringLength(250)]
    public string NombreArchivo { get; set; } = null!;

    [Required]
    public byte[] Contenido { get; set; } = null!;
}

public sealed class FotografiaDto
{
    public int IdFoto { get; set; }
    public int IdIncidencia { get; set; }
    public int Orden { get; set; }
    public string Tipo { get; set; } = null!;
    public int TamanoBytes { get; set; }
    public string Url { get; set; } = null!;
}