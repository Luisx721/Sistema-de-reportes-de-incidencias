using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using sistema_de_reportes_de_incindencias.Data;
using sistema_de_reportes_de_incindencias.Dtos;
using sistema_de_reportes_de_incindencias.Models;

namespace sistema_de_reportes_de_incidencias.Controllers
{
    [ApiController]
    [Route("api")]
    public class IncidenciasController : ControllerBase
    {
        private readonly AppDbContext _context;

        public IncidenciasController(AppDbContext context)
        {
            _context = context;
        }

        private static IncidenciaDto ToDto(Incidencia i) => new()
        {
            IdIncidencia = i.IdIncidencia,
            IdUsuario = i.IdUsuario,
            IdCategoria = i.IdCategoria,
            IdUbicacion = i.IdUbicacion,
            IdAreaSolicitante = i.IdAreaSolicitante,
            CodigoSeguimiento = i.ICodigoSeguimiento,
            ReportanteNombre = i.IReportanteNombre,
            ReportanteVinculo = i.IReportanteVinculo,
            Descripcion = i.IDescripcion,
            Urgencia = i.IUrgencia,
            Prioridad = i.IPrioridad,
            EstadoActual = i.IEstadoActual,
            FechaCreacion = i.IFechaCreacion,
            FechaActualizacion = i.IFechaActualizacion,
            ModalidadOrigen = i.IModalidadOrigen,
            FechaCierre = i.IFechaCierre
        };

        // Devuelve mensaje de error si algo relacionado no existe; null si todo bien
        private async Task<string?> ValidarRelaciones(int? idCategoria, int? idUbicacion, int? idArea, int? idUsuario)
        {
            if (idCategoria.HasValue && !await _context.Set<Categoria>().AnyAsync(c => c.IdCategoria == idCategoria))
                return $"No existe la categoría {idCategoria}";
            if (idUbicacion.HasValue && !await _context.Set<Ubicacione>().AnyAsync(u => u.IdUbicacion == idUbicacion))
                return $"No existe la ubicación {idUbicacion}";
            if (idArea.HasValue && !await _context.Set<Area>().AnyAsync(a => a.IdArea == idArea))
                return $"No existe el área {idArea}";
            if (idUsuario.HasValue && !await _context.Set<Usuario>().AnyAsync(u => u.IdUsuario == idUsuario))
                return $"No existe el usuario {idUsuario}";
            return null;
        }

        // GET api/incidencias  (filtros opcionales: estado, idCategoria, idUbicacion)
        [HttpGet("incidencias")]
        public async Task<IActionResult> GetIncidencias(string? estado, int? idCategoria, int? idUbicacion)
        {
            var query = _context.Set<Incidencia>().AsNoTracking().AsQueryable();

            if (!string.IsNullOrEmpty(estado)) query = query.Where(i => i.IEstadoActual == estado);
            if (idCategoria.HasValue) query = query.Where(i => i.IdCategoria == idCategoria);
            if (idUbicacion.HasValue) query = query.Where(i => i.IdUbicacion == idUbicacion);

            var lista = await query.OrderByDescending(i => i.IFechaCreacion).ToListAsync();
            return Ok(lista.Select(ToDto));
        }

        // GET api/incidencia/1
        [HttpGet("incidencia/{id:int}")]
        public async Task<IActionResult> GetIncidencia(int id)
        {
            var incidencia = await _context.Set<Incidencia>().FindAsync(id);
            if (incidencia == null)
                return NotFound(new { mensaje = $"No existe la incidencia {id}" });

            return Ok(ToDto(incidencia));
        }

        // GET api/incidencia/codigo/INC2026001 (seguimiento público)
        [HttpGet("incidencia/codigo/{codigo}")]
        public async Task<IActionResult> GetIncidenciaPorCodigo(string codigo)
        {
            var incidencia = await _context.Set<Incidencia>().AsNoTracking()
                .FirstOrDefaultAsync(i => i.ICodigoSeguimiento == codigo);
            if (incidencia == null)
                return NotFound(new { mensaje = $"No existe la incidencia con código {codigo}" });

            return Ok(ToDto(incidencia));
        }

        // POST api/incidencia -> llama a fn_registrar_incidencia (duplicados + bloqueo)
        [HttpPost("incidencia")]
        public async Task<IActionResult> PostIncidencia(IncidenciaCrearDto dto)
        {
            var error = await ValidarRelaciones(dto.IdCategoria, dto.IdUbicacion, dto.IdAreaSolicitante, dto.IdUsuario);
            if (error != null) return BadRequest(new { mensaje = error });

            try
            {
                var resultado = await _context.Database
                    .SqlQuery<RegistroFila>($@"
                        SELECT o_id_incidencia AS ""IdIncidencia"",
                               o_codigo        AS ""Codigo"",
                               o_es_duplicado  AS ""EsDuplicado""
                        FROM fn_registrar_incidencia(
                            {dto.IdUsuario}, {dto.IdCategoria}, {dto.IdUbicacion}, {dto.IdAreaSolicitante},
                            {dto.ReportanteNombre}, {dto.ReportanteVinculo}, {dto.Descripcion},
                            {dto.Urgencia}, {dto.ModalidadOrigen})")
                    .ToListAsync();

                var fila = resultado.First();
                return Ok(new IncidenciaRegistroDto
                {
                    IdIncidencia = fila.IdIncidencia,
                    CodigoSeguimiento = fila.Codigo,
                    EsDuplicado = fila.EsDuplicado,
                    Mensaje = fila.EsDuplicado
                        ? "Ya existe un reporte abierto para esta categoría y ubicación. Puedes darle seguimiento con este código."
                        : "Incidencia registrada correctamente."
                });
            }
            catch (Exception)
            {
                return StatusCode(500, new { mensaje = "Error al registrar la incidencia" });
            }
        }

        // PUT api/incidencia/1
        [HttpPut("incidencia/{id:int}")]
        public async Task<IActionResult> PutIncidencia(int id, IncidenciaActualizarDto dto)
        {
            var incidencia = await _context.Set<Incidencia>().FindAsync(id);
            if (incidencia == null)
                return NotFound(new { mensaje = $"No existe la incidencia {id}" });

            var error = await ValidarRelaciones(dto.IdCategoria, dto.IdUbicacion, dto.IdAreaSolicitante, null);
            if (error != null) return BadRequest(new { mensaje = error });

            incidencia.IdCategoria = dto.IdCategoria;
            incidencia.IdUbicacion = dto.IdUbicacion;
            incidencia.IdAreaSolicitante = dto.IdAreaSolicitante;
            incidencia.IDescripcion = dto.Descripcion;
            incidencia.IUrgencia = dto.Urgencia;
            incidencia.IPrioridad = dto.Prioridad;
            incidencia.IFechaActualizacion = DateTime.Now;

            await _context.SaveChangesAsync();
            return Ok(ToDto(incidencia));
        }

        // PATCH api/incidencia/1
        [HttpPatch("incidencia/{id:int}")]
        public async Task<IActionResult> PatchIncidencia(int id, IncidenciaPatchDto dto)
        {
            var incidencia = await _context.Set<Incidencia>().FindAsync(id);
            if (incidencia == null)
                return NotFound(new { mensaje = $"No existe la incidencia {id}" });

            var error = await ValidarRelaciones(dto.IdCategoria, dto.IdUbicacion, dto.IdAreaSolicitante, null);
            if (error != null) return BadRequest(new { mensaje = error });

            if (dto.IdCategoria.HasValue) incidencia.IdCategoria = dto.IdCategoria.Value;
            if (dto.IdUbicacion.HasValue) incidencia.IdUbicacion = dto.IdUbicacion.Value;
            if (dto.IdAreaSolicitante.HasValue) incidencia.IdAreaSolicitante = dto.IdAreaSolicitante.Value;
            if (dto.Descripcion != null) incidencia.IDescripcion = dto.Descripcion;
            if (dto.Urgencia != null) incidencia.IUrgencia = dto.Urgencia;
            if (dto.Prioridad != null) incidencia.IPrioridad = dto.Prioridad;
            incidencia.IFechaActualizacion = DateTime.Now;

            await _context.SaveChangesAsync();
            return Ok(ToDto(incidencia));
        }

        // DELETE api/incidencia/1
        [HttpDelete("incidencia/{id:int}")]
        public async Task<IActionResult> DeleteIncidencia(int id)
        {
            var incidencia = await _context.Set<Incidencia>().FindAsync(id);
            if (incidencia == null)
                return NotFound(new { mensaje = $"No existe la incidencia {id}" });

            try
            {
                _context.Set<Incidencia>().Remove(incidencia);
                await _context.SaveChangesAsync();
                return Ok(new { mensaje = "Incidencia eliminada" });
            }
            catch (DbUpdateException)
            {
                return BadRequest(new { mensaje = "No se puede eliminar: la incidencia tiene historial o fotografías asociadas" });
            }
        }

        // Clase auxiliar para leer el resultado de la función SQL
        private class RegistroFila
        {
            public int IdIncidencia { get; set; }
            public string Codigo { get; set; } = null!;
            public bool EsDuplicado { get; set; }
        }
    }
}