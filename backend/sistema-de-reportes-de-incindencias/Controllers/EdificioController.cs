using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using sistema_de_reportes_de_incindencias.Data;
using sistema_de_reportes_de_incindencias.Dtos;
using sistema_de_reportes_de_incindencias.Models;

namespace sistema_de_reportes_de_incidencias.Controllers
{
    [ApiController]
    [Route("api")]
    public class EdificiosController : ControllerBase
    {
        private readonly AppDbContext _context;

        public EdificiosController(AppDbContext context)
        {
            _context = context;
        }

        private static EdificioDto ToDto(Edificio e) => new()
        {
            IdEdificio = e.IdEdificio,
            Nombre = e.ENombre,
            Activo = e.EActivo
        };

        // GET api/edificios
        [HttpGet("edificios")]
        public async Task<IActionResult> GetEdificios()
        {
            var edificios = await _context.Set<Edificio>().AsNoTracking().ToListAsync();
            return Ok(edificios.Select(ToDto));
        }

        // GET api/edificio/1
        [HttpGet("edificio/{id:int}")]
        public async Task<IActionResult> GetEdificio(int id)
        {
            var edificio = await _context.Set<Edificio>().FindAsync(id);
            if (edificio == null)
                return NotFound(new { mensaje = $"No existe el edificio {id}" });

            return Ok(ToDto(edificio));
        }

        // POST api/edificio
        [HttpPost("edificio")]
        public async Task<IActionResult> PostEdificio(EdificioCrearDto dto)
        {
            if (await _context.Set<Edificio>().AnyAsync(e => e.ENombre == dto.Nombre))
                return BadRequest(new { mensaje = "Ya existe un edificio con ese nombre" });

            var edificio = new Edificio { ENombre = dto.Nombre };
            _context.Set<Edificio>().Add(edificio);
            await _context.SaveChangesAsync();
            return Ok(ToDto(edificio));
        }

        // PUT api/edificio/1
        [HttpPut("edificio/{id:int}")]
        public async Task<IActionResult> PutEdificio(int id, EdificioActualizarDto dto)
        {
            var edificio = await _context.Set<Edificio>().FindAsync(id);
            if (edificio == null)
                return NotFound(new { mensaje = $"No existe el edificio {id}" });

            if (await _context.Set<Edificio>().AnyAsync(e => e.ENombre == dto.Nombre && e.IdEdificio != id))
                return BadRequest(new { mensaje = "Ya existe otro edificio con ese nombre" });

            edificio.ENombre = dto.Nombre;
            edificio.EActivo = dto.Activo;
            await _context.SaveChangesAsync();
            return Ok(ToDto(edificio));
        }

        // PATCH api/edificio/1
        [HttpPatch("edificio/{id:int}")]
        public async Task<IActionResult> PatchEdificio(int id, EdificioPatchDto dto)
        {
            var edificio = await _context.Set<Edificio>().FindAsync(id);
            if (edificio == null)
                return NotFound(new { mensaje = $"No existe el edificio {id}" });

            if (dto.Nombre != null)
            {
                if (await _context.Set<Edificio>().AnyAsync(e => e.ENombre == dto.Nombre && e.IdEdificio != id))
                    return BadRequest(new { mensaje = "Ya existe otro edificio con ese nombre" });
                edificio.ENombre = dto.Nombre;
            }
            if (dto.Activo.HasValue) edificio.EActivo = dto.Activo.Value;

            await _context.SaveChangesAsync();
            return Ok(ToDto(edificio));
        }

        // DELETE api/edificio/1
        [HttpDelete("edificio/{id:int}")]
        public async Task<IActionResult> DeleteEdificio(int id)
        {
            var edificio = await _context.Set<Edificio>().FindAsync(id);
            if (edificio == null)
                return NotFound(new { mensaje = $"No existe el edificio {id}" });

            try
            {
                _context.Set<Edificio>().Remove(edificio);
                await _context.SaveChangesAsync();
                return Ok(new { mensaje = "Edificio eliminado" });
            }
            catch (DbUpdateException)
            {
                return BadRequest(new { mensaje = "No se puede eliminar: el edificio tiene ubicaciones asociadas" });
            }
        }
    }
}