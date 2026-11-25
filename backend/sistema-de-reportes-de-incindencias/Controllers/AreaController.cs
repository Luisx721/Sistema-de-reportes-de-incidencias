using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using sistema_de_reportes_de_incindencias.Data;
using sistema_de_reportes_de_incindencias.Dtos;
using sistema_de_reportes_de_incindencias.Models;

namespace sistema_de_reportes_de_incidencias.Controllers
{
    [ApiController]
    [Route("api")]
    public class AreasController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AreasController(AppDbContext context)
        {
            _context = context;
        }

        private static AreaDto ToDto(Area a) => new()
        {
            IdArea = a.IdArea,
            Nombre = a.ANombre,
            Tipo = a.ATipo,
            EsResponsable = a.AEsResponsable,
            Activo = a.AActivo
        };

        // GET api/areas
        [HttpGet("areas")]
        public async Task<IActionResult> GetAreas()
        {
            var areas = await _context.Set<Area>().AsNoTracking().ToListAsync();
            return Ok(areas.Select(ToDto));
        }

        // GET api/area/1
        [HttpGet("area/{id:int}")]
        public async Task<IActionResult> GetArea(int id)
        {
            var area = await _context.Set<Area>().FindAsync(id);
            if (area == null)
                return NotFound(new { mensaje = $"No existe el área {id}" });

            return Ok(ToDto(area));
        }

        // POST api/area
        [HttpPost("area")]
        public async Task<IActionResult> PostArea(AreaCrearDto dto)
        {
            if (await _context.Set<Area>().AnyAsync(a => a.ANombre == dto.Nombre))
                return BadRequest(new { mensaje = "Ya existe un área con ese nombre" });

            var area = new Area
            {
                ANombre = dto.Nombre,
                ATipo = dto.Tipo,
                AEsResponsable = dto.EsResponsable
            };
            _context.Set<Area>().Add(area);
            await _context.SaveChangesAsync();
            return Ok(ToDto(area));
        }

        // PUT api/area/1
        [HttpPut("area/{id:int}")]
        public async Task<IActionResult> PutArea(int id, AreaActualizarDto dto)
        {
            var area = await _context.Set<Area>().FindAsync(id);
            if (area == null)
                return NotFound(new { mensaje = $"No existe el área {id}" });

            if (await _context.Set<Area>().AnyAsync(a => a.ANombre == dto.Nombre && a.IdArea != id))
                return BadRequest(new { mensaje = "Ya existe otra área con ese nombre" });

            area.ANombre = dto.Nombre;
            area.ATipo = dto.Tipo;
            area.AEsResponsable = dto.EsResponsable;
            area.AActivo = dto.Activo;
            await _context.SaveChangesAsync();
            return Ok(ToDto(area));
        }

        // PATCH api/area/1
        [HttpPatch("area/{id:int}")]
        public async Task<IActionResult> PatchArea(int id, AreaPatchDto dto)
        {
            var area = await _context.Set<Area>().FindAsync(id);
            if (area == null)
                return NotFound(new { mensaje = $"No existe el área {id}" });

            if (dto.Nombre != null)
            {
                if (await _context.Set<Area>().AnyAsync(a => a.ANombre == dto.Nombre && a.IdArea != id))
                    return BadRequest(new { mensaje = "Ya existe otra área con ese nombre" });
                area.ANombre = dto.Nombre;
            }
            if (dto.Tipo != null) area.ATipo = dto.Tipo;
            if (dto.EsResponsable.HasValue) area.AEsResponsable = dto.EsResponsable.Value;
            if (dto.Activo.HasValue) area.AActivo = dto.Activo.Value;

            await _context.SaveChangesAsync();
            return Ok(ToDto(area));
        }

        // DELETE api/area/1
        [HttpDelete("area/{id:int}")]
        public async Task<IActionResult> DeleteArea(int id)
        {
            var area = await _context.Set<Area>().FindAsync(id);
            if (area == null)
                return NotFound(new { mensaje = $"No existe el área {id}" });

            try
            {
                _context.Set<Area>().Remove(area);
                await _context.SaveChangesAsync();
                return Ok(new { mensaje = "Área eliminada" });
            }
            catch (DbUpdateException)
            {
                return BadRequest(new { mensaje = "No se puede eliminar: el área está en uso (usuarios, categorías o incidencias)" });
            }
        }
    }
}
