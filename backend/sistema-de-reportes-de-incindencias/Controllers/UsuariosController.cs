using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using sistema_de_reportes_de_incindencias.Data;
using sistema_de_reportes_de_incindencias.Dtos;
using sistema_de_reportes_de_incindencias.Models;

namespace sistema_de_reportes_de_incindencias.Controllers
{
    [ApiController]
    [Route("api")]
    public class UsuariosController : ControllerBase
    {
        private readonly AppDbContext _context;
        private static readonly PasswordHasher<Usuario> _hasher = new();

        public UsuariosController(AppDbContext context)
        {
            _context = context;
        }

        private static UsuarioDto ToDto(Usuario u) => new()
        {
            IdUsuario = u.IdUsuario,
            IdRol = u.IdRol,
            IdArea = u.IdArea,
            Nombre = u.UNombre,
            Correo = u.UCorreo,
            Vinculo = u.UVinculo,
            CorreoVerificado = u.UCorreoVerificado,
            Activo = u.UActivo,
            FechaRegistro = u.UFechaRegistro
        };

        // Devuelve un mensaje de error si el rol o el área no existen; null si todo bien
        private async Task<string?> ValidarRelaciones(int idRol, int? idArea)
        {
            if (!await _context.Set<Rol>().AnyAsync(r => r.IdRol == idRol))
                return $"No existe el rol {idRol}";

            if (idArea.HasValue && !await _context.Set<Area>().AnyAsync(a => a.IdArea == idArea.Value))
                return $"No existe el área {idArea}";

            return null;
        }

        // GET api/usuarios
        [HttpGet("usuarios")]
        public async Task<IActionResult> GetUsuarios()
        {
            var usuarios = await _context.Set<Usuario>().AsNoTracking().ToListAsync();
            return Ok(usuarios.Select(ToDto));
        }

        // GET api/usuario/1
        [HttpGet("usuario/{id:int}")]
        public async Task<IActionResult> GetUsuario(int id)
        {
            var usuario = await _context.Set<Usuario>().FindAsync(id);
            if (usuario == null)
                return NotFound(new { mensaje = $"No existe el usuario {id}" });

            return Ok(ToDto(usuario));
        }

        // POST api/usuario
        [HttpPost("usuario")]
        public async Task<IActionResult> PostUsuario(UsuarioCrearDto dto)
        {
            var error = await ValidarRelaciones(dto.IdRol, dto.IdArea);
            if (error != null) return BadRequest(new { mensaje = error });

            if (await _context.Set<Usuario>().AnyAsync(u => u.UCorreo == dto.Correo))
                return BadRequest(new { mensaje = "Ya existe un usuario con ese correo" });

            var usuario = new Usuario
            {
                IdRol = dto.IdRol,
                IdArea = dto.IdArea,
                UNombre = dto.Nombre,
                UCorreo = dto.Correo,
                UVinculo = dto.Vinculo
            };
            usuario.UPassword = _hasher.HashPassword(usuario, dto.Password);

            _context.Set<Usuario>().Add(usuario);
            await _context.SaveChangesAsync();
            return Ok(ToDto(usuario));
        }

        // PUT api/usuario/1
        [HttpPut("usuario/{id:int}")]
        public async Task<IActionResult> PutUsuario(int id, UsuarioActualizarDto dto)
        {
            var usuario = await _context.Set<Usuario>().FindAsync(id);
            if (usuario == null)
                return NotFound(new { mensaje = $"No existe el usuario {id}" });

            var error = await ValidarRelaciones(dto.IdRol, dto.IdArea);
            if (error != null) return BadRequest(new { mensaje = error });

            if (await _context.Set<Usuario>().AnyAsync(u => u.UCorreo == dto.Correo && u.IdUsuario != id))
                return BadRequest(new { mensaje = "Ya existe otro usuario con ese correo" });

            usuario.IdRol = dto.IdRol;
            usuario.IdArea = dto.IdArea;
            usuario.UNombre = dto.Nombre;
            usuario.UCorreo = dto.Correo;
            usuario.UVinculo = dto.Vinculo;
            usuario.UCorreoVerificado = dto.CorreoVerificado;
            usuario.UActivo = dto.Activo;
            await _context.SaveChangesAsync();
            return Ok(ToDto(usuario));
        }

        // PATCH api/usuario/1
        [HttpPatch("usuario/{id:int}")]
        public async Task<IActionResult> PatchUsuario(int id, UsuarioPatchDto dto)
        {
            var usuario = await _context.Set<Usuario>().FindAsync(id);
            if (usuario == null)
                return NotFound(new { mensaje = $"No existe el usuario {id}" });

            var error = await ValidarRelaciones(dto.IdRol ?? usuario.IdRol, dto.IdArea);
            if (error != null) return BadRequest(new { mensaje = error });

            if (dto.Correo != null)
            {
                if (await _context.Set<Usuario>().AnyAsync(u => u.UCorreo == dto.Correo && u.IdUsuario != id))
                    return BadRequest(new { mensaje = "Ya existe otro usuario con ese correo" });
                usuario.UCorreo = dto.Correo;
            }

            if (dto.IdRol.HasValue) usuario.IdRol = dto.IdRol.Value;
            if (dto.IdArea.HasValue) usuario.IdArea = dto.IdArea.Value;
            if (dto.Nombre != null) usuario.UNombre = dto.Nombre;
            if (dto.Vinculo != null) usuario.UVinculo = dto.Vinculo;
            if (dto.Password != null) usuario.UPassword = _hasher.HashPassword(usuario, dto.Password);
            if (dto.CorreoVerificado.HasValue) usuario.UCorreoVerificado = dto.CorreoVerificado.Value;
            if (dto.Activo.HasValue) usuario.UActivo = dto.Activo.Value;

            await _context.SaveChangesAsync();
            return Ok(ToDto(usuario));
        }

        // DELETE api/usuario/1
        [HttpDelete("usuario/{id:int}")]
        public async Task<IActionResult> DeleteUsuario(int id)
        {
            var usuario = await _context.Set<Usuario>().FindAsync(id);
            if (usuario == null)
                return NotFound(new { mensaje = $"No existe el usuario {id}" });

            try
            {
                _context.Set<Usuario>().Remove(usuario);
                await _context.SaveChangesAsync();
                return Ok(new { mensaje = "Usuario eliminado" });
            }
            catch (DbUpdateException)
            {
                return BadRequest(new { mensaje = "No se puede eliminar: el usuario tiene incidencias o historial asociado. Desactívalo con PATCH (activo: false)" });
            }
        }
    }
}
