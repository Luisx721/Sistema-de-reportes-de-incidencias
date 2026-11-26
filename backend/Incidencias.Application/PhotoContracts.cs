namespace Incidencias.Application;

public sealed record PhotoDto(int Id, int Order, string Type, int Size, string Url);

public sealed record PhotoUploadDto(string FileName, string ContentType, byte[] Content);

public sealed record PhotoFileDto(byte[] Content, string ContentType, string FileName);

/// <summary>Carga y consulta de hasta tres fotos por incidencia, con acceso al expediente (RF-03).</summary>
public interface IPhotoStore
{
    Task<PhotoDto> AddAsync(string code, PhotoUploadDto upload, SessionDto session, CancellationToken ct);
    Task<IReadOnlyList<PhotoDto>> ListAsync(string code, SessionDto session, CancellationToken ct);
    Task<PhotoFileDto?> GetFileAsync(int id, SessionDto session, CancellationToken ct);
}
