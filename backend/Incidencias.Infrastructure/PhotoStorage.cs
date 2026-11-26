namespace Incidencias.Infrastructure;

/// <summary>Almacenamiento local de fotografías con nombres generados por el servidor.</summary>
public sealed class PhotoStorage
{
    private readonly string _root;

    public PhotoStorage(string root)
    {
        _root = Path.GetFullPath(root);
    }

    public string CreateFinalName(string extension) => $"{Guid.NewGuid():N}{extension}";

    public async Task<string> WriteTemporaryAsync(byte[] content, CancellationToken ct)
    {
        Directory.CreateDirectory(_root);
        var path = Path.Combine(_root, $"{Guid.NewGuid():N}.tmp");
        await using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None,
            bufferSize: 81920, useAsync: true);
        try
        {
            await stream.WriteAsync(content, ct);
            await stream.FlushAsync(ct);
        }
        catch
        {
            stream.Close();
            try { File.Delete(path); } catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
            throw;
        }
        return path;
    }

    public void Promote(string temporaryPath, string finalName)
    {
        var destination = Path.Combine(_root, finalName);
        File.Move(temporaryPath, destination, overwrite: false);
    }

    public async Task<byte[]?> ReadAsync(string fileName, CancellationToken ct)
    {
        if (!IsSafeName(fileName)) return null;
        var path = Path.Combine(_root, fileName);
        if (!File.Exists(path)) return null;
        return await File.ReadAllBytesAsync(path, ct);
    }

    public void Delete(string fileName)
    {
        if (!IsSafeName(fileName)) return;
        try
        {
            var path = Path.Combine(_root, fileName);
            if (File.Exists(path)) File.Delete(path);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // La operación de base ya terminó; la limpieza pendiente se registra en el log de la API.
        }
    }

    private static bool IsSafeName(string fileName) =>
        !string.IsNullOrWhiteSpace(fileName)
        && Path.GetFileName(fileName) == fileName
        && fileName.IndexOfAny(Path.GetInvalidFileNameChars()) < 0;
}
