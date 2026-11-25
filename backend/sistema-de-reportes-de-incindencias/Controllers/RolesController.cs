using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using sistema_de_reportes_de_incindencias.Data;
using sistema_de_reportes_de_incindencias.Dtos;
using sistema_de_reportes_de_incindencias.Models;

namespace sistema_de_reportes_de_incidencias.Controllers
{
    [ApiController]
    [Route("api")]
    public class RolesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public RolesController(AppDbContext context)
        {
            _context = context;
        }

        private static RolDto ToDto(Rol r) => new()
        {
            IdRol = r.IdRol,
            Nombre = r.RNombre,
            Descripcion = r.RDescripcion,
            Activo = r.RActivo
        };

        // GET api/roles -> lista
        [HttpGet("roles")]
        public async Task<IActionResult> GetRoles()
        {
            var roles = await _context.Set<Rol>().ToListAsync();
            return Ok(roles.Select(ToDto));
        }

        // GET api/rol/1 -> uno por ID
        [HttpGet("rol/{id:int}")]
        public async Task<IActionResult> GetRol(int id)
        {
            var rol = await _context.Set<Rol>().FindAsync(id);
            if (rol == null)
                return NotFound(new { mensaje = $"No existe el rol {id}" });

            return Ok(ToDto(rol));
        }

        // POST api/rol -> insertar
        [HttpPost("rol")]
        public async Task<IActionResult> PostRol(RolCrearDto dto)
        {
            if (await _context.Set<Rol>().AnyAsync(r => r.RNombre == dto.Nombre))
                return BadRequest(new { mensaje = "Ya existe un rol con ese nombre" });

            var rol = new Rol { RNombre = dto.Nombre, RDescripcion = dto.Descripcion };
            _context.Set<Rol>().Add(rol);
            await _context.SaveChangesAsync();
            return Ok(ToDto(rol));
        }

        // PUT api/rol/1 -> actualizar todo el registro
        [HttpPut("rol/{id:int}")]
        public async Task<IActionResult> PutRol(int id, RolActualizarDto dto)
        {
            var rol = await _context.Set<Rol>().FindAsync(id);
            if (rol == null)
                return NotFound(new { mensaje = $"No existe el rol {id}" });

            if (await _context.Set<Rol>().AnyAsync(r => r.RNombre == dto.Nombre && r.IdRol != id))
                return BadRequest(new { mensaje = "Ya existe otro rol con ese nombre" });

            rol.RNombre = dto.Nombre;
            rol.RDescripcion = dto.Descripcion;
            rol.RActivo = dto.Activo;
            await _context.SaveChangesAsync();
            return Ok(ToDto(rol));
        }

        // DELETE api/rol/1 -> eliminar
        [HttpDelete("rol/{id:int}")]
        public async Task<IActionResult> DeleteRol(int id)
        {
            var rol = await _context.Set<Rol>().FindAsync(id);
            if (rol == null)
                return NotFound(new { mensaje = $"No existe el rol {id}" });

            try
            {
                _context.Set<Rol>().Remove(rol);
                await _context.SaveChangesAsync();
                return Ok(new { mensaje = "Rol eliminado" });
            }
            catch (DbUpdateException)
            {
                return BadRequest(new { mensaje = "No se puede eliminar: el rol está en uso por usuarios" });
            }
        }
    }
}