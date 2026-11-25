using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using sistema_de_reportes_de_incindencias.Data;
using sistema_de_reportes_de_incindencias.Dtos;
using sistema_de_reportes_de_incindencias.Models;

namespace sistema_de_reportes_de_incidencias.Controllers
{
    [ApiController]
    [Route("api")]
    public class CategoriasController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CategoriasController(AppDbContext context)
        {
            _context = context;
        }

        private static CategoriaDto ToDto(Categoria c) => new()
        {
            IdCategoria = c.IdCategoria,
            IdArea = c.IdArea,
            Nombre = c.CNombre,
            Descripcion = c.CDescripcion,
            Activo = c.CActivo
        };

        // GET api/categorias
        [HttpGet("categorias")]
        public async Task<IActionResult> GetCategorias()
        {
            var categorias = await _context.Set<Categoria>().AsNoTracking().ToListAsync();
            return Ok(categorias.Select(ToDto));
        }

        // GET api/categoria/1
        [HttpGet("categoria/{id:int}")]
        public async Task<IActionResult> GetCategoria(int id)
        {
            var categoria = await _context.Set<Categoria>().FindAsync(id);
            if (categoria == null)
                return NotFound(new { mensaje = $"No existe la categoría {id}" });

            return Ok(ToDto(categoria));
        }

        // POST api/categoria
        [HttpPost("categoria")]
        public async Task<IActionResult> PostCategoria(CategoriaCrearDto dto)
        {
            if (!await _context.Set<Area>().AnyAsync(a => a.IdArea == dto.IdArea))
                return BadRequest(new { mensaje = $"No existe el área {dto.IdArea}" });

            if (await _context.Set<Categoria>().AnyAsync(c => c.CNombre == dto.Nombre))
                return BadRequest(new { mensaje = "Ya existe una categoría con ese nombre" });

            var categoria = new Categoria
            {
                IdArea = dto.IdArea,
                CNombre = dto.Nombre,
                CDescripcion = dto.Descripcion
            };
            _context.Set<Categoria>().Add(categoria);
            await _context.SaveChangesAsync();
            return Ok(ToDto(categoria));
        }

        // PUT api/categoria/1
        [HttpPut("categoria/{id:int}")]
        public async Task<IActionResult> PutCategoria(int id, CategoriaActualizarDto dto)
        {
            var categoria = await _context.Set<Categoria>().FindAsync(id);
            if (categoria == null)
                return NotFound(new { mensaje = $"No existe la categoría {id}" });

            if (!await _context.Set<Area>().AnyAsync(a => a.IdArea == dto.IdArea))
                return BadRequest(new { mensaje = $"No existe el área {dto.IdArea}" });

            if (await _context.Set<Categoria>().AnyAsync(c => c.CNombre == dto.Nombre && c.IdCategoria != id))
                return BadRequest(new { mensaje = "Ya existe otra categoría con ese nombre" });

            categoria.IdArea = dto.IdArea;
            categoria.CNombre = dto.Nombre;
            categoria.CDescripcion = dto.Descripcion;
            categoria.CActivo = dto.Activo;
            await _context.SaveChangesAsync();
            return Ok(ToDto(categoria));
        }

        // PATCH api/categoria/1
        [HttpPatch("categoria/{id:int}")]
        public async Task<IActionResult> PatchCategoria(int id, CategoriaPatchDto dto)
        {
            var categoria = await _context.Set<Categoria>().FindAsync(id);
            if (categoria == null)
                return NotFound(new { mensaje = $"No existe la categoría {id}" });

            if (dto.IdArea.HasValue)
            {
                if (!await _context.Set<Area>().AnyAsync(a => a.IdArea == dto.IdArea.Value))
                    return BadRequest(new { mensaje = $"No existe el área {dto.IdArea}" });
                categoria.IdArea = dto.IdArea.Value;
            }
            if (dto.Nombre != null)
            {
                if (await _context.Set<Categoria>().AnyAsync(c => c.CNombre == dto.Nombre && c.IdCategoria != id))
                    return BadRequest(new { mensaje = "Ya existe otra categoría con ese nombre" });
                categoria.CNombre = dto.Nombre;
            }
            if (dto.Descripcion != null) categoria.CDescripcion = dto.Descripcion;
            if (dto.Activo.HasValue) categoria.CActivo = dto.Activo.Value;

            await _context.SaveChangesAsync();
            return Ok(ToDto(categoria));
        }

        // DELETE api/categoria/1
        [HttpDelete("categoria/{id:int}")]
        public async Task<IActionResult> DeleteCategoria(int id)
        {
            var categoria = await _context.Set<Categoria>().FindAsync(id);
            if (categoria == null)
                return NotFound(new { mensaje = $"No existe la categoría {id}" });

            try
            {
                _context.Set<Categoria>().Remove(categoria);
                await _context.SaveChangesAsync();
                return Ok(new { mensaje = "Categoría eliminada" });
            }
            catch (DbUpdateException)
            {
                return BadRequest(new { mensaje = "No se puede eliminar: la categoría tiene incidencias asociadas" });
            }
        }
    }
}