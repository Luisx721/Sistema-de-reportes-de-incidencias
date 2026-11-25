using System.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using sistema_de_reportes_de_incindencias.Data;
using sistema_de_reportes_de_incindencias.Dtos;
using sistema_de_reportes_de_incindencias.Models;

namespace sistema_de_reportes_de_incindencias.Controllers;

[ApiController]
[Route("api")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AuditoriaController : ControllerBase
{
    private const string TablaPruebas = "prueba_auditoria";
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _entorno;

    public AuditoriaController(AppDbContext context, IWebHostEnvironment entorno)
    {
        _context = context;
        _entorno = entorno;
    }

    private static AuditoriaDto ToDto(Auditorium a) => new()
    {
        IdAuditoria = a.IdAuditoria,
        IdUsuario = a.IdUsuario,
        Origen = a.AuOrigen,
        Tabla = a.AuTabla,
        IdRegistro = a.AuIdRegistro,
        Accion = a.AuAccion,
        ValorAnterior = a.AuValorAnterior,
        ValorNuevo = a.AuValorNuevo,
        FechaHora = a.AuFechaHora
    };

    [HttpGet("auditorias")]
    public async Task<IActionResult> GetAuditorias(string? tabla, int? idRegistro, CancellationToken ct)
    {
        if (ValidarAcceso() is { } error) return error;

        var query = _context.Set<Auditorium>().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(tabla)) query = query.Where(a => a.AuTabla == tabla);
        if (idRegistro.HasValue) query = query.Where(a => a.AuIdRegistro == idRegistro.Value);

        var registros = await query.OrderByDescending(a => a.AuFechaHora)
            .ThenByDescending(a => a.IdAuditoria).ToListAsync(ct);
        return Ok(registros.Select(ToDto));
    }

    [HttpGet("auditoria/{id:int}")]
    public async Task<IActionResult> GetAuditoria(int id, CancellationToken ct)
    {
        if (ValidarAcceso() is { } error) return error;
        var fila = await _context.Set<Auditorium>().AsNoTracking()
            .SingleOrDefaultAsync(a => a.IdAuditoria == id, ct);
        if (fila == null) return NotFound(new { mensaje = "No existe el evento de auditoría." });
        return Ok(ToDto(fila));
    }

    [HttpPost("auditoria")]
    public async Task<IActionResult> PostAuditoria(AuditoriaPruebaDto dto, CancellationToken ct)
    {
        if (ValidarAcceso(escritura: true) is { } error) return error;
        var fila = new Auditorium
        {
            AuTabla = TablaPruebas,
            AuOrigen = "SISTEMA",
            AuIdRegistro = dto.IdRegistro,
            AuAccion = dto.Accion,
            AuValorAnterior = dto.ValorAnterior,
            AuValorNuevo = dto.ValorNuevo
        };
        _context.Set<Auditorium>().Add(fila);
        await _context.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetAuditoria), new { id = fila.IdAuditoria }, ToDto(fila));
    }

    [HttpPut("auditoria/{id:int}")]
    public async Task<IActionResult> PutAuditoria(int id, AuditoriaPruebaDto dto, CancellationToken ct)
    {
        if (ValidarAcceso(escritura: true) is { } error) return error;
        var afectadas = await _context.Set<Auditorium>()
            .Where(a => a.IdAuditoria == id && a.AuTabla == TablaPruebas)
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.AuIdRegistro, dto.IdRegistro)
                .SetProperty(a => a.AuAccion, dto.Accion)
                .SetProperty(a => a.AuValorAnterior, dto.ValorAnterior)
                .SetProperty(a => a.AuValorNuevo, dto.ValorNuevo), ct);
        if (afectadas == 0) return await ExplicarSinCambios(id, ct);
        return NoContent();
    }

    [HttpDelete("auditoria/{id:int}")]
    public async Task<IActionResult> DeleteAuditoria(int id, CancellationToken ct)
    {
        if (ValidarAcceso(escritura: true) is { } error) return error;
        var afectadas = await _context.Set<Auditorium>()
            .Where(a => a.IdAuditoria == id && a.AuTabla == TablaPruebas)
            .ExecuteDeleteAsync(ct);
        if (afectadas == 0) return await ExplicarSinCambios(id, ct);
        return NoContent();
    }

    private async Task<IActionResult> ExplicarSinCambios(int id, CancellationToken ct)
    {
        if (await _context.Set<Auditorium>().AnyAsync(a => a.IdAuditoria == id, ct))
            return Conflict(new { mensaje = "Este evento pertenece a la bitácora real." });
        return NotFound(new { mensaje = "No existe el evento de auditoría." });
    }

    private IActionResult? ValidarAcceso(bool escritura = false)
    {
        var ip = HttpContext.Connection.RemoteIpAddress;
        if (_entorno.IsDevelopment() && ip != null &&
            IPAddress.IsLoopback(ip.IsIPv4MappedToIPv6 ? ip.MapToIPv4() : ip))
            return null;

        if (User.Identity?.IsAuthenticated != true) return Unauthorized();
        if (escritura || !User.IsInRole("Administrador")) return StatusCode(403);
        return null;
    }
}