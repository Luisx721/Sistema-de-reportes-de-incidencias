using System.Security.Cryptography;
using System.Text;
using Incidencias.Application;
using Incidencias.Domain;
using Npgsql;
using NpgsqlTypes;

namespace Incidencias.Infrastructure;

/// <summary>Adaptador de persistencia sobre el esquema oficial de ProyectoBD.</summary>
public sealed class PostgresIncidentStore(string connectionString) : IIncidentStore
{
    private static string Digest(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private async Task<NpgsqlConnection> Open(CancellationToken ct) { var c = new NpgsqlConnection(connectionString); await c.OpenAsync(ct); return c; }
    private const string SelectIncident = "SELECT i.i_codigo_seguimiento,c.c_nombre,u.e_nombre || ' - ' || ub.ub_nombre,i.i_descripcion,i.i_estado_actual,i.i_fecha_creacion,NULL::text,i.i_prioridad,a.a_nombre,v.version,ra.a_nombre, i.id_incidencia FROM incidencias i JOIN categorias c USING(id_categoria) JOIN ubicaciones ub USING(id_ubicacion) JOIN edificios u USING(id_edificio) LEFT JOIN areas a ON a.id_area=c.id_area LEFT JOIN areas ra ON ra.id_area=i.id_area_solicitante JOIN rol2_incident_versions v USING(id_incidencia)";
    public async Task<SessionDto?> LoginAsync(string username,string password,CancellationToken ct)
    {
        await using var db=await Open(ct);
        await using var cmd=new NpgsqlCommand("SELECT u.id_usuario,u.u_nombre,r.r_nombre,a.a_nombre,u.u_password FROM usuarios u JOIN rol r USING(id_rol) LEFT JOIN areas a USING(id_area) WHERE lower(u.u_correo)=lower(@name) AND u.u_activo AND r.r_activo",db);
        cmd.Parameters.AddWithValue("name",username.Trim()); await using var rd=await cmd.ExecuteReaderAsync(ct); if(!await rd.ReadAsync(ct)) return null;
        var id=rd.GetInt32(0);var name=rd.GetString(1);var role=MapRole(rd.GetString(2));var area=rd.IsDBNull(3)?null:rd.GetString(3);var stored=rd.GetString(4);
        if(!VerifyPassword(password,stored)) return null; await rd.DisposeAsync();
        var token=Convert.ToHexString(RandomNumberGenerator.GetBytes(32));var now=DateTimeOffset.UtcNow;
        await using var ins=new NpgsqlCommand("INSERT INTO rol2_sessions(token_hash,id_usuario,created_at,last_seen_at) VALUES(@hash,@id,@now,@now)",db);
        ins.Parameters.AddWithValue("hash",Digest(token));ins.Parameters.AddWithValue("id",id);ins.Parameters.AddWithValue("now",now);await ins.ExecuteNonQueryAsync(ct);
        return new(token,name,role,area,now.AddMinutes(30));
    }
    private static string MapRole(string r)=>r;
    private static bool VerifyPassword(string password,string stored)
    { try { var p=stored.Split('$'); if(p.Length!=4||p[0]!="pbkdf2")return false;int n=int.Parse(p[1]);var salt=Convert.FromBase64String(p[2]);var expected=Convert.FromBase64String(p[3]);var actual=Rfc2898DeriveBytes.Pbkdf2(password,salt,n,HashAlgorithmName.SHA256,expected.Length);return CryptographicOperations.FixedTimeEquals(actual,expected); } catch{return false;} }
    public async Task<SessionDto?> GetSessionAsync(string token,CancellationToken ct)
    { await using var db=await Open(ct);await using var cmd=new NpgsqlCommand("UPDATE rol2_sessions s SET last_seen_at=now() FROM usuarios u JOIN rol r USING(id_rol) LEFT JOIN areas a USING(id_area) WHERE s.id_usuario=u.id_usuario AND s.token_hash=@hash AND s.last_seen_at>now()-interval '30 minutes' AND u.u_activo AND r.r_activo RETURNING u.u_nombre,r.r_nombre,a.a_nombre,s.last_seen_at+interval '30 minutes'",db);cmd.Parameters.AddWithValue("hash",Digest(token));await using var rd=await cmd.ExecuteReaderAsync(ct);return await rd.ReadAsync(ct)?new(token,rd.GetString(0),MapRole(rd.GetString(1)),rd.IsDBNull(2)?null:rd.GetString(2),rd.GetFieldValue<DateTimeOffset>(3)):null; }
    public async Task EndSessionAsync(string token,CancellationToken ct){await using var db=await Open(ct);await using var c=new NpgsqlCommand("DELETE FROM rol2_sessions WHERE token_hash=@h",db);c.Parameters.AddWithValue("h",Digest(token));await c.ExecuteNonQueryAsync(ct);}
    public async Task<IncidentCatalogsDto> GetCatalogsAsync(CancellationToken ct)
    {
        await using var db=await Open(ct);
        var categories=new List<string>();
        await using(var cmd=new NpgsqlCommand("SELECT c.c_nombre FROM categorias c WHERE c.c_activo ORDER BY c.c_nombre",db))
        await using(var rd=await cmd.ExecuteReaderAsync(ct)) while(await rd.ReadAsync(ct)) categories.Add(rd.GetString(0));
        var locations=new List<string>();
        await using(var cmd=new NpgsqlCommand("SELECT e.e_nombre || ' - ' || u.ub_nombre FROM ubicaciones u JOIN edificios e USING(id_edificio) WHERE u.ub_activo AND e.e_activo ORDER BY e.e_nombre,u.ub_nombre",db))
        await using(var rd=await cmd.ExecuteReaderAsync(ct)) while(await rd.ReadAsync(ct)) locations.Add(rd.GetString(0));
        return new(categories,locations);
    }
    public async Task<IncidentDto> CreateAsync(CreateIncidentDto q,CancellationToken ct)
    {
        if(string.IsNullOrWhiteSpace(q.Category)||string.IsNullOrWhiteSpace(q.Location)||q.Description.Trim().Length is <20 or >2000)throw new ArgumentException("Categoría, ubicación y descripción válida son obligatorias.");
        await using var db=await Open(ct); await using var cmd=new NpgsqlCommand("SELECT c.id_categoria,ub.id_ubicacion, c.id_area FROM categorias c CROSS JOIN ubicaciones ub JOIN edificios e USING(id_edificio) WHERE c.c_activo AND ub.ub_activo AND e.e_activo AND lower(c.c_nombre)=lower(@cat) AND lower(e.e_nombre || ' - ' || ub.ub_nombre)=lower(@loc)",db);cmd.Parameters.AddWithValue("cat",q.Category.Trim());cmd.Parameters.AddWithValue("loc",q.Location.Trim());await using var rd=await cmd.ExecuteReaderAsync(ct);if(!await rd.ReadAsync(ct))throw new ArgumentException("Categoría o ubicación inexistente.");var cat=rd.GetInt32(0);var loc=rd.GetInt32(1);var area=rd.GetInt32(2);await rd.DisposeAsync();
        await using var tx=await db.BeginTransactionAsync(ct);await using var f=new NpgsqlCommand("SELECT o_codigo FROM fn_registrar_incidencia(NULL,@cat,@loc,@area,@nombre,@vinculo,@desc,'Media','Comunitario')",db,tx);f.Parameters.AddWithValue("cat",cat);f.Parameters.AddWithValue("loc",loc);f.Parameters.AddWithValue("area",area);f.Parameters.Add("nombre",NpgsqlDbType.Varchar).Value=DBNull.Value;f.Parameters.Add("vinculo",NpgsqlDbType.Varchar).Value=DBNull.Value;f.Parameters.AddWithValue("desc",q.Description.Trim());var code=(string)(await f.ExecuteScalarAsync(ct)??throw new InvalidOperationException("No se generó código."));await tx.CommitAsync(ct);return (await Load(code,ct))!;
    }
    public async Task<PublicStatusDto?> TrackAsync(string code,CancellationToken ct){var i=await Load(code,ct);return i is null?null:IncidentContractMapper.ToPublicStatus(i);}
    public async Task<IReadOnlyList<IncidentDto>> ListAsync(IncidentFilterDto filter,SessionDto session,CancellationToken ct)
    {
        IncidentFilterRules.Validate(filter);var sql=SelectIncident+" WHERE ((@role IN ('Mantenimiento','Desarrollo Físico') AND coalesce(a.a_nombre,CASE WHEN c.c_nombre IN ('Edificios','Espacios comunes') THEN 'Desarrollo Físico' ELSE 'Mantenimiento' END)=@role) OR (@role IN ('Jefatura','Ordenanza') AND i.id_area_solicitante=(SELECT id_area FROM areas WHERE a_nombre=@area)) OR @role='Autoridad') AND (@query IS NULL OR i.i_codigo_seguimiento ILIKE '%'||@query||'%' OR i.i_descripcion ILIKE '%'||@query||'%') AND (@category IS NULL OR c.c_nombre=@category) AND (@location IS NULL OR u.e_nombre || ' - ' || ub.ub_nombre=@location) AND (@state IS NULL OR i.i_estado_actual=@state) AND (@from IS NULL OR i.i_fecha_creacion>=@from) AND (@to IS NULL OR i.i_fecha_creacion<@to) ORDER BY CASE i.i_prioridad WHEN 'Alta' THEN 0 WHEN 'Media' THEN 1 ELSE 2 END,i.i_fecha_creacion DESC";
        await using var db=await Open(ct);await using var cmd=new NpgsqlCommand(sql,db);BindFilters(cmd,filter,session);var rows=new List<(IncidentDto,int)>();await using(var r=await cmd.ExecuteReaderAsync(ct)){while(await r.ReadAsync(ct))rows.Add((Read(r),r.GetInt32(11)));}for(int x=0;x<rows.Count;x++)rows[x]=(rows[x].Item1 with{History=await LoadHistory(db,rows[x].Item2,ct)},rows[x].Item2);return rows.Select(x=>x.Item1).ToArray();
    }
    private static void BindFilters(NpgsqlCommand c,IncidentFilterDto f,SessionDto s){c.Parameters.AddWithValue("role",s.Profile);c.Parameters.Add("area",NpgsqlDbType.Varchar).Value=(object?)s.Area??DBNull.Value;c.Parameters.Add("query",NpgsqlDbType.Text).Value=(object?)f.Query??DBNull.Value;c.Parameters.Add("category",NpgsqlDbType.Varchar).Value=(object?)f.Category??DBNull.Value;c.Parameters.Add("location",NpgsqlDbType.Text).Value=(object?)f.Location??DBNull.Value;c.Parameters.Add("state",NpgsqlDbType.Varchar).Value=(object?)f.State??DBNull.Value;c.Parameters.Add("from",NpgsqlDbType.Timestamp).Value=f.From is{} a?DateTime.SpecifyKind(IncidentFilterRules.StartOfDay(a).UtcDateTime,DateTimeKind.Unspecified):DBNull.Value;c.Parameters.Add("to",NpgsqlDbType.Timestamp).Value=f.To is{} b?DateTime.SpecifyKind(IncidentFilterRules.StartOfDay(b.AddDays(1)).UtcDateTime,DateTimeKind.Unspecified):DBNull.Value;}
    public async Task<IncidentDto?> GetAuthorizedAsync(string code,SessionDto session,CancellationToken ct){var x=await Load(code,ct);return x is not null&&await Allowed(x,session,ct)?x:null;}
    private async Task<bool> Allowed(IncidentDto i,SessionDto s,CancellationToken ct){if(i.RequesterArea is null)return s.Profile is "Autoridad";return IncidentRules.CanEdit(s.Profile,s.Area??"",i.RequesterArea,i.ResponsibleUnit??"",i.Category,i.State);}
    public async Task<IncidentDto> ChangeAsync(string code,ChangeIncidentDto req,SessionDto session,CancellationToken ct)
    {
        await using var db=await Open(ct);await using var tx=await db.BeginTransactionAsync(ct);IncidentDto? item;int id;
        await using(var c=new NpgsqlCommand(SelectIncident+" WHERE i.i_codigo_seguimiento=@code FOR UPDATE OF i",db,tx)){c.Parameters.AddWithValue("code",code.Trim().ToUpperInvariant());await using var r=await c.ExecuteReaderAsync(ct);if(!await r.ReadAsync(ct))throw new KeyNotFoundException("Incidencia inexistente.");item=Read(r);id=r.GetInt32(11);}
        if(!await Allowed(item,session,ct))throw new UnauthorizedAccessException();if(req.Version!=item.Version)throw new IncidentConflictException("El expediente cambió desde que fue consultado. Recarga y aplica de nuevo.");if(req.State==item.State&&req.Priority==item.Priority)throw new ArgumentException("Selecciona un cambio de estado o prioridad.");IncidentRules.ValidateChange(item.State,req.State,req.Priority,req.Note);
        var user=await UserId(session.Token,db,tx,ct);if(user is null)throw new UnauthorizedAccessException();
        await using(var actor=new NpgsqlCommand("SELECT set_config('app.id_usuario',@user,TRUE)",db,tx)){actor.Parameters.AddWithValue("user",user.Value.ToString());await actor.ExecuteScalarAsync(ct);}
        if(req.Priority!=item.Priority){await using var p=new NpgsqlCommand("UPDATE incidencias SET i_prioridad=@p WHERE id_incidencia=@id",db,tx);p.Parameters.AddWithValue("p",req.Priority);p.Parameters.AddWithValue("id",id);await p.ExecuteNonQueryAsync(ct);}
        if(req.State!=item.State){await using var f=new NpgsqlCommand("SELECT o_resultado FROM fn_cambiar_estado_incidencia(@id,@user,@state,@note)",db,tx);f.Parameters.AddWithValue("id",id);f.Parameters.AddWithValue("user",user.Value);f.Parameters.AddWithValue("state",req.State);f.Parameters.AddWithValue("note",req.Note.Trim());var result=(string?)await f.ExecuteScalarAsync(ct);if(result!="OK")throw new ArgumentException("La función oficial rechazó el cambio: "+result);}
        if(req.State==item.State){await using var v=new NpgsqlCommand("UPDATE rol2_incident_versions SET version=version+1 WHERE id_incidencia=@id",db,tx);v.Parameters.AddWithValue("id",id);await v.ExecuteNonQueryAsync(ct);}await tx.CommitAsync(ct);return (await Load(code,ct))!;
    }
    private async Task<int?> UserId(string token,NpgsqlConnection db,NpgsqlTransaction tx,CancellationToken ct){await using var c=new NpgsqlCommand("SELECT u.id_usuario FROM rol2_sessions s JOIN usuarios u USING(id_usuario) WHERE s.token_hash=@h AND s.last_seen_at>now()-interval '30 minutes' AND u.u_activo",db,tx);c.Parameters.AddWithValue("h",Digest(token));var x=await c.ExecuteScalarAsync(ct);return x is null?null:Convert.ToInt32(x);}
    private static IncidentDto Read(NpgsqlDataReader r)=>new(r.GetString(0),r.GetString(1),r.GetString(2),r.GetString(3),r.GetString(4),new DateTimeOffset(DateTime.SpecifyKind(r.GetDateTime(5),DateTimeKind.Utc)),r.IsDBNull(6)?null:r.GetString(6),r.IsDBNull(7)?null:r.GetString(7),r.IsDBNull(8)?null:r.GetString(8),r.GetInt64(9),[]){RequesterArea=r.IsDBNull(10)?null:r.GetString(10)};
    private async Task<IncidentDto?> Load(string code,CancellationToken ct){await using var db=await Open(ct);IncidentDto? x;int id;await using(var c=new NpgsqlCommand(SelectIncident+" WHERE i.i_codigo_seguimiento=@c",db)){c.Parameters.AddWithValue("c",code.Trim().ToUpperInvariant());await using var r=await c.ExecuteReaderAsync(ct);if(!await r.ReadAsync(ct))return null;x=Read(r);id=r.GetInt32(11);}return x with{History=await LoadHistory(db,id,ct)};}
    private static async Task<IReadOnlyList<HistoryDto>> LoadHistory(NpgsqlConnection db,int id,CancellationToken ct){await using var c=new NpgsqlCommand("SELECT he_fecha_hora,he_estado,CASE WHEN he_estado='Recibido' THEN 'Reporte recibido y registrado por el sistema.' ELSE he_observacion END FROM historial_estados WHERE id_incidencia=@id ORDER BY he_fecha_hora,id_historial",db);c.Parameters.AddWithValue("id",id);var list=new List<HistoryDto>();await using var r=await c.ExecuteReaderAsync(ct);while(await r.ReadAsync(ct))list.Add(new(new DateTimeOffset(DateTime.SpecifyKind(r.GetDateTime(0),DateTimeKind.Utc)),r.GetString(1),r.GetString(2)));return list;}
}
