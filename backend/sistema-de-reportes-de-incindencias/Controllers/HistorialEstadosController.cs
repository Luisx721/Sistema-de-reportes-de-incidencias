using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using sistema_de_reportes_de_incindencias.Data;
using sistema_de_reportes_de_incindencias.Dtos;
using sistema_de_reportes_de_incindencias.Models;

namespace sistema_de_reportes_de_incidencias.Controllers
{
    [ApiController]
    [Route("api")]
    public class HistorialEstadosController : ControllerBase
    {
        private readonly AppDbContext _context;

        public HistorialEstadosController(AppDbContext context)
        {
            _context = context;
        }

        private static HistorialEstadoDto ToDto(HistorialEstado h) => new()
        {
            IdHistorial = h.IdHistorial,
            IdIncidencia = h.IdIncidencia,
            IdUsuarioEncargado = h.IdUsuarioEncargado,
            Estado = h.HeEstado,
            Observacion = h.HeObservacion,
            FechaHora = h.HeFechaHora
        };

        // GET api/historiales  (filtro opcional: idIncidencia)
        [HttpGet("historiales")]
        public async Task<IActionResult> GetHistoriales(int? idIncidencia)
        {
            var query = _context.Set<HistorialEstado>().AsNoTracking().AsQueryable();
            if (idIncidencia.HasValue) query = query.Where(h => h.IdIncidencia == idIncidencia);

            var lista = await query.OrderBy(h => h.HeFechaHora).ToListAsync();
            return Ok(lista.Select(ToDto));
        }

        // GET api/historial/1
        [HttpGet("historial/{id:int}")]
        public async Task<IActionResult> GetHistorial(int id)
        {
            var h = await _context.Set<HistorialEstado>().FindAsync(id);
            if (h == null)
                return NotFound(new { mensaje = $"No existe el registro de historial {id}" });

            return Ok(ToDto(h));
        }

        // POST api/historial -> llama a fn_cambiar_estado_incidencia (bloqueo de fila)
        [HttpPost("historial")]
        public async Task<IActionResult> PostHistorial(HistorialEstadoCrearDto dto)
        {
            try
            {
                var filas = await _context.Database
                    .SqlQuery<CambioFila>($@"
                        SELECT o_resultado     AS ""Resultado"",
                               o_id_historial  AS ""IdHistorial"",
                               o_estado_actual AS ""EstadoActual""
                        FROM fn_cambiar_estado_incidencia(
                            {dto.IdIncidencia}, {dto.IdUsuarioEncargado}, {dto.Estado}, {dto.Observacion})")
                    .ToListAsync();

                var fila = filas.First();

                switch (fila.Resultado)
                {
                    case "OK":
                        return Ok(new CambioEstadoDto
                        {
                            IdHistorial = fila.IdHistorial!.Value,
                            IdIncidencia = dto.IdIncidencia,
                            EstadoActual = fila.EstadoActual!,
                            Mensaje = "Estado actualizado correctamente."
                        });
                    case "NO_EXISTE":
                        return NotFound(new { mensaje = $"No existe la incidencia {dto.IdIncidencia}" });
                    case "USUARIO_INVALIDO":
                        return BadRequest(new { mensaje = $"El usuario {dto.IdUsuarioEncargado} no existe o está inactivo" });
                    case "YA_CERRADA":
                        return BadRequest(new { mensaje = $"La incidencia ya está cerrada ({fila.EstadoActual}). Otro usuario la atendió primero." });
                    case "MISMO_ESTADO":
                        return BadRequest(new { mensaje = $"La incidencia ya está en estado '{fila.EstadoActual}'" });
                    default:
                        return StatusCode(500, new { mensaje = "Respuesta inesperada de la base de datos" });
                }
            }
            catch (Exception)
            {
                return StatusCode(500, new { mensaje = "Error al cambiar el estado de la incidencia" });
            }
        }

        // PATCH api/historial/1 -> solo corrige la observación
        [HttpPatch("historial/{id:int}")]
        public async Task<IActionResult> PatchHistorial(int id, HistorialEstadoPatchDto dto)
        {
            var h = await _context.Set<HistorialEstado>().FindAsync(id);
            if (h == null)
                return NotFound(new { mensaje = $"No existe el registro de historial {id}" });

            h.HeObservacion = dto.Observacion;
            await _context.SaveChangesAsync();
            return Ok(ToDto(h));
        }

        private class CambioFila
        {
            public string Resultado { get; set; } = null!;
            public int? IdHistorial { get; set; }
            public string? EstadoActual { get; set; }
        }
    }
}