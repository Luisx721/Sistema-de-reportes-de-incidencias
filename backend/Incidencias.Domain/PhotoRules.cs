namespace Incidencias.Domain;

/// <summary>Reglas de validación de las fotografías adjuntas (RF-03).</summary>
public static class PhotoRules
{
    public const int MaxBytes = 5 * 1024 * 1024;
    public const int MaxPerIncident = 3;

    private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png"];

    /// <summary>Devuelve la extensión normalizada si el archivo es JPG/JPEG/PNG y su firma real coincide.</summary>
    public static string Validate(string? fileName, ReadOnlySpan<byte> content)
    {
        var extension = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension))
            throw new ArgumentException("Selecciona una imagen JPG, JPEG o PNG válida.");
        if (content.Length is <= 0 or > MaxBytes)
            throw new ArgumentException("La foto debe pesar entre 1 byte y 5 MiB.");
        if (!SignatureMatches(extension, content))
            throw new ArgumentException("El contenido del archivo no corresponde a una imagen JPG o PNG válida.");
        return extension;
    }

    public static string ContentType(string extension) => extension switch
    {
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        _ => throw new ArgumentException("Tipo de imagen no válido.")
    };

    public static string DatabaseType(string extension) => extension.TrimStart('.');

    private static bool SignatureMatches(string extension, ReadOnlySpan<byte> content)
    {
        if (extension == ".png")
        {
            ReadOnlySpan<byte> header = [137, 80, 78, 71, 13, 10, 26, 10];
            ReadOnlySpan<byte> end = [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
            return content.Length >= 45 && content.StartsWith(header)
                && content.Slice(12, 4).SequenceEqual("IHDR"u8) && content.EndsWith(end);
        }

        return content.Length >= 4
            && content[0] == 0xff && content[1] == 0xd8 && content[2] == 0xff
            && content[^2] == 0xff && content[^1] == 0xd9;
    }
}
