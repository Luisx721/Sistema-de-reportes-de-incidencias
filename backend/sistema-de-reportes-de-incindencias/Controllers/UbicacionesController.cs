using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using sistema_de_reportes_de_incindencias.Data;
using sistema_de_reportes_de_incindencias.Dtos;
using sistema_de_reportes_de_incindencias.Models;

namespace sistema_de_reportes_de_incidencias.Controllers
{
    [ApiController]
    [Route("api")]
    public class UbicacionesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UbicacionesController(AppDbContext context)
        {
            _context = context;
        }

        private static UbicacionDto ToDto(Ubicacione u) => new()
        {
            IdUbicacion = u.IdUbicacion,
            IdEdificio = u.IdEdificio,
            Nombre = u.UbNombre,
            Tipo = u.UbTipo,
            Activo = u.UbActivo
        };

        // GET api/ubicaciones
        [HttpGet("ubicaciones")]
        public async Task<IActionResult> GetUbicaciones()
        {
            var ubicaciones = await _context.Set<Ubicacione>().AsNoTracking().ToListAsync();
            return Ok(ubicaciones.Select(ToDto));
        }

        // GET api/ubicacion/1
        [HttpGet("ubicacion/{id:int}")]
        public async Task<IActionResult> GetUbicacion(int id)
        {
            var ubicacion = await _context.Set<Ubicacione>().FindAsync(id);
            if (ubicacion == null)
                return NotFound(new { mensaje = $"No existe la ubicación {id}" });

            return Ok(ToDto(ubicacion));
        }

        // POST api/ubicacion
        [HttpPost("ubicacion")]
        public async Task<IActionResult> PostUbicacion(UbicacionCrearDto dto)
        {
            if (!await _context.Set<Edificio>().AnyAsync(e => e.IdEdificio == dto.IdEdificio))
                return BadRequest(new { mensaje = $"No existe el edificio {dto.IdEdificio}" });

            if (await _context.Set<Ubicacione>().AnyAsync(u => u.IdEdificio == dto.IdEdificio && u.UbNombre == dto.Nombre))
                return BadRequest(new { mensaje = "Ya existe una ubicación con ese nombre en ese edificio" });

            var ubicacion = new Ubicacione
            {
                IdEdificio = dto.IdEdificio,
                UbNombre = dto.Nombre,
                UbTipo = dto.Tipo
            };
            _context.Set<Ubicacione>().Add(ubicacion);
            await _context.SaveChangesAsync();
            return Ok(ToDto(ubicacion));
        }

        // PUT api/ubicacion/1
        [HttpPut("ubicacion/{id:int}")]
        public async Task<IActionResult> PutUbicacion(int id, UbicacionActualizarDto dto)
        {
            var ubicacion = await _context.Set<Ubicacione>().FindAsync(id);
            if (ubicacion == null)
                return NotFound(new { mensaje = $"No existe la ubicación {id}" });

            if (!await _context.Set<Edificio>().AnyAsync(e => e.IdEdificio == dto.IdEdificio))
                return BadRequest(new { mensaje = $"No existe el edificio {dto.IdEdificio}" });

            if (await _context.Set<Ubicacione>().AnyAsync(u =>
                    u.IdEdificio == dto.IdEdificio && u.UbNombre == dto.Nombre && u.IdUbicacion != id))
                return BadRequest(new { mensaje = "Ya existe otra ubicación con ese nombre en ese edificio" });

            ubicacion.IdEdificio = dto.IdEdificio;
            ubicacion.UbNombre = dto.Nombre;
            ubicacion.UbTipo = dto.Tipo;
            ubicacion.UbActivo = dto.Activo;
            await _context.SaveChangesAsync();
            return Ok(ToDto(ubicacion));
        }

        // PATCH api/ubicacion/1
        [HttpPatch("ubicacion/{id:int}")]
        public async Task<IActionResult> PatchUbicacion(int id, UbicacionPatchDto dto)
        {
            var ubicacion = await _context.Set<Ubicacione>().FindAsync(id);
            if (ubicacion == null)
                return NotFound(new { mensaje = $"No existe la ubicación {id}" });

            var nuevoEdificio = dto.IdEdificio ?? ubicacion.IdEdificio;
            var nuevoNombre = dto.Nombre ?? ubicacion.UbNombre;

            if (dto.IdEdificio.HasValue &&
                !await _context.Set<Edificio>().AnyAsync(e => e.IdEdificio == nuevoEdificio))
                return BadRequest(new { mensaje = $"No existe el edificio {nuevoEdificio}" });

            if ((dto.IdEdificio.HasValue || dto.Nombre != null) &&
                await _context.Set<Ubicacione>().AnyAsync(u =>
                    u.IdEdificio == nuevoEdificio && u.UbNombre == nuevoNombre && u.IdUbicacion != id))
                return BadRequest(new { mensaje = "Ya existe otra ubicación con ese nombre en ese edificio" });

            ubicacion.IdEdificio = nuevoEdificio;
            ubicacion.UbNombre = nuevoNombre;
            if (dto.Tipo != null) ubicacion.UbTipo = dto.Tipo;
            if (dto.Activo.HasValue) ubicacion.UbActivo = dto.Activo.Value;

            await _context.SaveChangesAsync();
            return Ok(ToDto(ubicacion));
        }

        // DELETE api/ubicacion/1
        [HttpDelete("ubicacion/{id:int}")]
        public async Task<IActionResult> DeleteUbicacion(int id)
        {
            var ubicacion = await _context.Set<Ubicacione>().FindAsync(id);
            if (ubicacion == null)
                return NotFound(new { mensaje = $"No existe la ubicación {id}" });

            try
            {
                _context.Set<Ubicacione>().Remove(ubicacion);
                await _context.SaveChangesAsync();
                return Ok(new { mensaje = "Ubicación eliminada" });
            }
            catch (DbUpdateException)
            {
                return BadRequest(new { mensaje = "No se puede eliminar: la ubicación tiene incidencias asociadas" });
            }
        }
    }
}