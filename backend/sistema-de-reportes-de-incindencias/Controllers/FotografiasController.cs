using System.ComponentModel.DataAnnotations;
using System.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using sistema_de_reportes_de_incindencias.Data;
using sistema_de_reportes_de_incindencias.Dtos;
using sistema_de_reportes_de_incindencias.Models;

namespace sistema_de_reportes_de_incindencias.Controllers;

[ApiController]
[Route("api")]
public class FotografiasController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _entorno;

    public FotografiasController(AppDbContext context, IWebHostEnvironment entorno)
    {
        _context = context;
        _entorno = entorno;
    }

    private const int MaxBytes = 5 * 1024 * 1024;
    private string Carpeta => Path.Combine(_entorno.ContentRootPath, "App_Data", "fotografias");

    [HttpPost("fotografia")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxBytes + 64 * 1024)]
    public async Task<IActionResult> Subir([FromForm] FotografiaCrearDto dto, CancellationToken ct)
    {
        var archivo = dto.Archivo;
        if (archivo.Length is <= 0 or > MaxBytes)
            return BadRequest(new { mensaje = "La foto debe pesar entre 1 byte y 5 MiB." });

        await using var entrada = archivo.OpenReadStream();
        var bytes = new byte[(int)archivo.Length];
        await entrada.ReadExactlyAsync(bytes.AsMemory(), ct);
        return await Guardar(dto.IdIncidencia, archivo.FileName, bytes, ct);
    }

    [HttpPost("fotografia/json")]
    [Consumes("application/json")]
    [RequestSizeLimit(4 * ((MaxBytes + 2) / 3) + 64 * 1024)]
    public async Task<IActionResult> PostFotografia([FromBody] FotografiaJsonDto dto, CancellationToken ct)
    {
        if (dto.Contenido.Length is <= 0 or > MaxBytes)
            return BadRequest(new { mensaje = "La foto debe pesar entre 1 byte y 5 MiB." });

        return await Guardar(dto.IdIncidencia, dto.NombreArchivo, dto.Contenido, ct);
    }

    private async Task<IActionResult> Guardar(int idIncidencia, string nombreArchivo, byte[] bytes, CancellationToken ct)
    {
        var extension = Path.GetExtension(nombreArchivo).ToLowerInvariant();
        if (!FormatoValido(bytes, extension))
            return BadRequest(new { mensaje = "Seleccioná una imagen JPG, JPEG o PNG válida." });

        await using var transaccion = await _context.Database.BeginTransactionAsync(ct);
        // Bloquear la incidencia serializa dos cargas para el mismo reporte.
        var ids = await _context.Database.SqlQuery<int>($"""
            SELECT id_incidencia AS "Value" FROM incidencias
            WHERE id_incidencia = {idIncidencia} FOR UPDATE
            """).ToListAsync(ct);
        if (ids.Count == 0)
            return NotFound(new { mensaje = "La incidencia no existe." });

        var hayEspacio = await _context.Database.SqlQuery<bool>($"""
            SELECT fn_validar_limite_fotografias({idIncidencia}) AS "Value"
            """).SingleAsync(ct);
        if (!hayEspacio)
            return Conflict(new { mensaje = "La incidencia ya tiene tres fotografías." });

        var ocupados = await _context.Fotografias.Where(f => f.IdIncidencia == idIncidencia)
            .Select(f => f.FOrden).ToListAsync(ct);
        var nombre = $"{Guid.NewGuid():N}{extension}";
        var foto = new Fotografia
        {
            IdIncidencia = idIncidencia,
            FOrden = Enumerable.Range(1, 3).First(n => !ocupados.Contains(n)),
            FArchivo = nombre,
            FTipo = extension[1..],
            FTamanoBytes = bytes.Length
        };

        _context.Fotografias.Add(foto);
        try
        {
            await _context.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
        { SqlState: "23505", ConstraintName: "uq_foto_incidencia_orden" })
        {
            return Conflict(new { mensaje = "El orden de las fotos cambió. Volvé a intentar." });
        }

        await EscribirArchivo(nombre, bytes, ct);

        // Confirmar únicamente después de cerrar el archivo. Si la conexión se pierde
        // durante el commit, conservar la imagen: PostgreSQL puede haber confirmado.
        await transaccion.CommitAsync(CancellationToken.None);
        return CreatedAtAction(nameof(Ver), new { id = foto.IdFoto }, ToDto(foto));
    }

    [HttpGet("fotografias")]
    public async Task<IActionResult> Listar([FromQuery, Range(1, int.MaxValue)] int idIncidencia,
        CancellationToken ct)
    {
        if (ComprobarAccesoAlExpediente() is { } error) return error;
        if (!await _context.Incidencias.AnyAsync(i => i.IdIncidencia == idIncidencia, ct))
            return NotFound(new { mensaje = "La incidencia no existe." });

        var fotos = await _context.Fotografias.AsNoTracking().Where(f => f.IdIncidencia == idIncidencia)
            .OrderBy(f => f.FOrden).ToListAsync(ct);
        return Ok(fotos.Select(ToDto));
    }

    [HttpGet("fotografia/{id:int}")]
    public async Task<IActionResult> GetFotografia(int id, CancellationToken ct)
    {
        if (ComprobarAccesoAlExpediente() is { } error) return error;
        var foto = await _context.Fotografias.AsNoTracking().SingleOrDefaultAsync(f => f.IdFoto == id, ct);
        return foto == null ? NotFound(new { mensaje = "Fotografía no encontrada." }) : Ok(ToDto(foto));
    }

    [HttpPut("fotografia/{id:int}")]
    [Consumes("application/json")]
    [RequestSizeLimit(4 * ((MaxBytes + 2) / 3) + 64 * 1024)]
    public async Task<IActionResult> PutFotografia(int id, FotografiaActualizarDto dto, CancellationToken ct)
    {
        if (ComprobarAccesoAlExpediente() is { } error) return error;
        if (dto.Contenido.Length is <= 0 or > MaxBytes)
            return BadRequest(new { mensaje = "La foto debe pesar entre 1 byte y 5 MiB." });

        var extension = Path.GetExtension(dto.NombreArchivo).ToLowerInvariant();
        if (!FormatoValido(dto.Contenido, extension))
            return BadRequest(new { mensaje = "Seleccioná una imagen JPG, JPEG o PNG válida." });

        await using var tx = await _context.Database.BeginTransactionAsync(ct);
        var foto = await BuscarParaModificar(id, ct);
        if (foto == null) return NotFound(new { mensaje = "Fotografía no encontrada." });

        var anterior = foto.FArchivo;
        foto.FArchivo = $"{Guid.NewGuid():N}{extension}";
        foto.FTipo = extension[1..];
        foto.FTamanoBytes = dto.Contenido.Length;

        await _context.SaveChangesAsync(ct);
        await EscribirArchivo(foto.FArchivo, dto.Contenido, ct);
        await tx.CommitAsync(CancellationToken.None);
        RetirarArchivoAnterior(anterior);
        return Ok(ToDto(foto));
    }

    [HttpDelete("fotografia/{id:int}")]
    public async Task<IActionResult> DeleteFotografia(int id, CancellationToken ct)
    {
        if (ComprobarAccesoAlExpediente() is { } error) return error;
        await using var tx = await _context.Database.BeginTransactionAsync(ct);
        var foto = await BuscarParaModificar(id, ct);
        if (foto == null) return NotFound(new { mensaje = "Fotografía no encontrada." });

        _context.Fotografias.Remove(foto);
        await _context.SaveChangesAsync(ct);
        await tx.CommitAsync(CancellationToken.None);
        RetirarArchivoAnterior(foto.FArchivo);
        return NoContent();
    }

    private async Task<Fotografia?> BuscarParaModificar(int id, CancellationToken ct)
    {
        var filas = await _context.Fotografias.FromSqlInterpolated(
            $"SELECT * FROM fotografias WHERE id_foto = {id} FOR UPDATE").ToListAsync(ct);
        return filas.SingleOrDefault();
    }

    private async Task EscribirArchivo(string nombre, byte[] bytes, CancellationToken ct)
    {
        Directory.CreateDirectory(Carpeta);
        var ruta = Path.Combine(Carpeta, nombre);
        var destino = new FileStream(ruta, FileMode.CreateNew, FileAccess.Write, FileShare.None,
            bufferSize: 81920, useAsync: true);
        try
        {
            await using (destino)
                await destino.WriteAsync(bytes.AsMemory(), ct);
        }
        catch
        {
            System.IO.File.Delete(ruta);
            throw;
        }
    }

    private void RetirarArchivoAnterior(string nombre)
    {
        // Solo eliminar los archivos privados con nombre generado por esta API.
        if (Path.GetFileName(nombre) != nombre ||
            !Guid.TryParseExact(Path.GetFileNameWithoutExtension(nombre), "N", out _) ||
            Path.GetExtension(nombre) is not (".jpg" or ".jpeg" or ".png")) return;
        try
        {
            System.IO.File.Delete(Path.Combine(Carpeta, nombre));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // El cambio ya quedó confirmado. Registrar la limpieza pendiente.
            HttpContext.RequestServices.GetRequiredService<ILogger<FotografiasController>>()
                .LogWarning(ex, "Quedó pendiente eliminar el archivo de fotografía {Archivo}.", nombre);
        }
    }

    [HttpGet("fotografia/{id:int}/archivo")]
    public async Task<IActionResult> Ver(int id, CancellationToken ct)
    {
        if (ComprobarAccesoAlExpediente() is { } error) return error;
        var foto = await _context.Fotografias.AsNoTracking().FirstOrDefaultAsync(f => f.IdFoto == id, ct);
        if (foto == null || Path.GetFileName(foto.FArchivo) != foto.FArchivo)
            return NotFound(new { mensaje = "Fotografía no encontrada." });

        var ruta = Path.Combine(Carpeta, foto.FArchivo);
        if (!System.IO.File.Exists(ruta))
            return NotFound(new { mensaje = "No se encontró el archivo de la fotografía." });

        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers["Cache-Control"] = "private, no-store";
        return PhysicalFile(ruta, foto.FTipo == "png" ? "image/png" : "image/jpeg");
    }

    private FotografiaDto ToDto(Fotografia f) => new()
    {
        IdFoto = f.IdFoto,
        IdIncidencia = f.IdIncidencia,
        Orden = f.FOrden,
        Tipo = f.FTipo,
        TamanoBytes = f.FTamanoBytes,
        Url = Url.Action(nameof(Ver), new { id = f.IdFoto })!
    };

    private IActionResult? ComprobarAccesoAlExpediente()
    {
        // Permite probar el expediente en la computadora local antes de integrar el login.
        if (_entorno.IsDevelopment() && HttpContext.Connection.RemoteIpAddress is { } ip
            && IPAddress.IsLoopback(ip.IsIPv4MappedToIPv6 ? ip.MapToIPv4() : ip)) return null;
        if (User.Identity?.IsAuthenticated != true)
            return Unauthorized(new { mensaje = "Iniciá sesión para consultar las fotografías." });
        if (User.IsInRole("Mantenimiento") || User.IsInRole("Desarrollo Físico")) return null;
        return StatusCode(403, new { mensaje = "Tu perfil no tiene acceso al expediente." });
    }

    private static bool FormatoValido(byte[] datos, string extension)
    {
        ReadOnlySpan<byte> contenido = datos;
        if (extension == ".png")
        {
            ReadOnlySpan<byte> cabecera = [137, 80, 78, 71, 13, 10, 26, 10];
            ReadOnlySpan<byte> cierre = [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
            return contenido.Length >= 45 && contenido.StartsWith(cabecera)
                && contenido.Slice(12, 4).SequenceEqual("IHDR"u8) && contenido.EndsWith(cierre);
        }
        return (extension is ".jpg" or ".jpeg") && datos.Length >= 4
            && datos[0] == 0xff && datos[1] == 0xd8 && datos[2] == 0xff
            && datos[^2] == 0xff && datos[^1] == 0xd9;
    }
}



