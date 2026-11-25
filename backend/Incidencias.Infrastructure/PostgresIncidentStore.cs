using System.Security.Cryptography;
using System.Text;
using Incidencias.Application;
using Incidencias.Domain;
using Npgsql;

namespace Incidencias.Infrastructure;

/// <summary>Concentra SQL parametrizado y transacciones para poder sustituir el DDL provisional.</summary>
public sealed class PostgresIncidentStore(string connectionString) : IIncidentStore
{
    // Se usa un hash para las claves de sesi贸n para evitar guardarlas reutilizables en la base.
    private static string Digest(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private async Task<NpgsqlConnection> Open(CancellationToken ct)
    {
        var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(ct);
        return connection;
    }

    /// <summary>Verifica una contrase帽a con el salt guardado y crea una sesi贸n con token aleatorio.</summary>
    public async Task<SessionDto?> LoginAsync(string username, string password, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand("SELECT id, nombre, perfil, area, password_hash, password_salt FROM app_users WHERE lower(usuario)=lower(@username) AND activo", db);
        cmd.Parameters.AddWithValue("username", username.Trim());
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        var id = reader.GetInt64(0); var name = reader.GetString(1); var role = reader.GetString(2);
        var area = reader.IsDBNull(3) ? null : reader.GetString(3);
        var expected = (byte[])reader[4]; var salt = (byte[])reader[5];
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, 210_000, HashAlgorithmName.SHA256, 32);
        if (!CryptographicOperations.FixedTimeEquals(actual, expected)) return null;
        await reader.DisposeAsync();
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var now = DateTimeOffset.UtcNow;
        await using var insert = new NpgsqlCommand("INSERT INTO app_sessions(token_hash,user_id,created_at,last_seen_at) VALUES(@hash,@user,@now,@now)", db);
        insert.Parameters.AddWithValue("hash", Digest(token)); insert.Parameters.AddWithValue("user", id); insert.Parameters.AddWithValue("now", now);
        await insert.ExecuteNonQueryAsync(ct);
        return new(token, name, role, area, now.AddMinutes(30));
    }

    /// <summary>Consulta la cuenta activa y extiende su vencimiento solo si a煤n no pasaron 30 minutos.</summary>
    public async Task<SessionDto?> GetSessionAsync(string token, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand("UPDATE app_sessions s SET last_seen_at=now() FROM app_users u WHERE s.user_id=u.id AND s.token_hash=@hash AND s.last_seen_at > now()-interval '30 minutes' AND u.activo RETURNING u.nombre,u.perfil,u.area,s.last_seen_at+interval '30 minutes'", db);
        cmd.Parameters.AddWithValue("hash", Digest(token));
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return new(token, reader.GetString(0), reader.GetString(1), reader.IsDBNull(2) ? null : reader.GetString(2), reader.GetFieldValue<DateTimeOffset>(3));
    }

    public async Task EndSessionAsync(string token, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand("DELETE FROM app_sessions WHERE token_hash=@hash", db);
        cmd.Parameters.AddWithValue("hash", Digest(token)); await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>Valida el reporte y guarda el expediente junto con su primer evento.</summary>
    public async Task<IncidentDto> CreateAsync(CreateIncidentDto request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Category) || string.IsNullOrWhiteSpace(request.Location) || request.Description.Trim().Length is < 20 or > 2000)
            throw new ArgumentException("Categor铆a, ubicaci贸n y descripci贸n v谩lida son obligatorias.");
        await using var db = await Open(ct); await using var tx = await db.BeginTransactionAsync(ct);
        var code = "UES" + Convert.ToHexString(RandomNumberGenerator.GetBytes(6)); var now = DateTimeOffset.UtcNow;
        const string insert = "INSERT INTO incidents(code,category,location,description,reference,state,priority,version,created_at) VALUES(@code,@category,@location,@description,@reference,'Recibido',NULL,1,@now)";
        await using (var cmd = new NpgsqlCommand(insert, db, tx))
        {
            cmd.Parameters.AddWithValue("code", code); cmd.Parameters.AddWithValue("category", request.Category.Trim()); cmd.Parameters.AddWithValue("location", request.Location.Trim());
            cmd.Parameters.AddWithValue("description", request.Description.Trim()); cmd.Parameters.AddWithValue("reference", (object?)request.Reference?.Trim() ?? DBNull.Value); cmd.Parameters.AddWithValue("now", now);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await AddHistory(db, tx, code, "Recibido", "Reporte registrado. Pendiente de evaluaci贸n por la unidad responsable.", null, now, ct);
        await tx.CommitAsync(ct);
        return new(code, request.Category.Trim(), request.Location.Trim(), request.Description.Trim(), "Recibido", now, request.Reference, null, null, 1, [new(now, "Recibido", "Reporte registrado. Pendiente de evaluaci贸n por la unidad responsable.")]);
    }

    /// <summary>Proyecta solo los campos aprobados para seguimiento p煤blico y no entrega descripci贸n ni identidad.</summary>
    public async Task<PublicStatusDto?> TrackAsync(string code, CancellationToken ct)
    {
        var incident = await Load(code, ct);
        return incident is null ? null : IncidentContractMapper.ToPublicStatus(incident);
    }

    public async Task<IReadOnlyList<IncidentDto>> ListAsync(IncidentFilterDto filter, SessionDto session, CancellationToken ct)
    {
        IncidentFilterRules.Validate(filter);
        const string sql = "SELECT code,category,location,description,state,created_at,reference,priority,responsible_unit,version,requester_area FROM incidents WHERE ((@role IN ('Mantenimiento','Desarrollo F韘ico') AND coalesce(responsible_unit,CASE WHEN category IN ('Edificios','Espacios comunes') THEN 'Desarrollo F韘ico' ELSE 'Mantenimiento' END)=@role) OR (@role IN ('Jefatura','Ordenanza') AND requester_area=@area) OR @role='Autoridad') AND (@query IS NULL OR code ILIKE '%'||@query||'%' OR description ILIKE '%'||@query||'%') AND (@category IS NULL OR category=@category) AND (@location IS NULL OR location=@location) AND (@state IS NULL OR state=@state) AND (@from IS NULL OR created_at >= @from) AND (@to_exclusive IS NULL OR created_at < @to_exclusive) ORDER BY CASE priority WHEN 'Alta' THEN 0 WHEN 'Media' THEN 1 ELSE 2 END,created_at DESC";
        await using var db = await Open(ct); await using var cmd = new NpgsqlCommand(sql, db);
        cmd.Parameters.Add("role", NpgsqlTypes.NpgsqlDbType.Text).Value = session.Profile;
        cmd.Parameters.Add("area", NpgsqlTypes.NpgsqlDbType.Text).Value = (object?)session.Area ?? DBNull.Value;
        cmd.Parameters.Add("query", NpgsqlTypes.NpgsqlDbType.Text).Value = (object?)filter.Query ?? DBNull.Value;
        cmd.Parameters.Add("category", NpgsqlTypes.NpgsqlDbType.Text).Value = (object?)filter.Category ?? DBNull.Value;
        cmd.Parameters.Add("location", NpgsqlTypes.NpgsqlDbType.Text).Value = (object?)filter.Location ?? DBNull.Value;
        cmd.Parameters.Add("state", NpgsqlTypes.NpgsqlDbType.Text).Value = (object?)filter.State ?? DBNull.Value;
        cmd.Parameters.Add("from", NpgsqlTypes.NpgsqlDbType.TimestampTz).Value = filter.From is { } from ? IncidentFilterRules.StartOfDay(from) : DBNull.Value;
        cmd.Parameters.Add("to_exclusive", NpgsqlTypes.NpgsqlDbType.TimestampTz).Value = filter.To is { } to ? IncidentFilterRules.StartOfDay(to.AddDays(1)) : DBNull.Value;
        var rows = new List<IncidentDto>(); await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) rows.Add(ReadIncident(reader, []) with { RequesterArea = reader.IsDBNull(10) ? null : reader.GetString(10) });
        await reader.DisposeAsync();
        for (var i=0;i<rows.Count;i++) rows[i] = rows[i] with { History = await LoadHistory(db, rows[i].Code, ct) };
        return rows;
    }
    public async Task<IncidentDto?> GetAuthorizedAsync(string code, SessionDto session, CancellationToken ct)
    {
        var item = await Load(code, ct);
        if (item is null) return null;
        var scope = await GetScope(session.Token, ct);
        return scope is { } s && IncidentRules.CanEdit(s.Role, s.Area ?? "", item.RequesterArea ?? "", item.ResponsibleUnit ?? "", item.Category, item.State) ? item : null;
    }

    /// <summary>Bloquea el expediente, valida permiso y versi贸n, y confirma estado e historial en una transacci贸n.</summary>
    public async Task<IncidentDto> ChangeAsync(string code, ChangeIncidentDto request, SessionDto session, CancellationToken ct)
    {
        await using var db = await Open(ct); await using var tx = await db.BeginTransactionAsync(ct);
        IncidentDto? item;
        await using (var lockCmd = new NpgsqlCommand("SELECT code,category,location,description,state,created_at,reference,priority,responsible_unit,version,requester_area FROM incidents WHERE code=@code FOR UPDATE", db, tx))
        {
            lockCmd.Parameters.AddWithValue("code", code); await using var reader = await lockCmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) throw new KeyNotFoundException("Incidencia inexistente.");
            item = ReadIncident(reader, [] ) with { RequesterArea = reader.IsDBNull(10) ? null : reader.GetString(10) };
        }
        var scope = await GetScope(session.Token, ct, db, tx);
        if (scope is not { } s || !IncidentRules.CanEdit(s.Role, s.Area ?? "", item.RequesterArea ?? "", item.ResponsibleUnit ?? "", item.Category, item.State))
            throw new UnauthorizedAccessException();
        if (request.Version != item.Version) throw new IncidentConflictException("El expediente cambi贸 desde que fue consultado. Recarga y aplica de nuevo.");
        if (request.State == item.State && request.Priority == item.Priority) throw new ArgumentException("Selecciona un cambio de estado o prioridad.");
        IncidentRules.ValidateChange(item.State, request.State, request.Priority, request.Note);
        var nextVersion = item.Version + 1; var now = DateTimeOffset.UtcNow;
        await using (var update = new NpgsqlCommand("UPDATE incidents SET state=@state,priority=@priority,version=@next,updated_at=@now WHERE code=@code AND version=@version", db, tx))
        {
            update.Parameters.AddWithValue("state", request.State); update.Parameters.AddWithValue("priority", request.Priority); update.Parameters.AddWithValue("next", nextVersion);
            update.Parameters.AddWithValue("now", now); update.Parameters.AddWithValue("code", code); update.Parameters.AddWithValue("version", request.Version);
            if (await update.ExecuteNonQueryAsync(ct) != 1) throw new IncidentConflictException("El expediente cambi贸 simult谩neamente; recarga para continuar.");
        }
        await AddHistory(db, tx, code, request.State, request.Note.Trim(), s.UserId, now, ct);
        await tx.CommitAsync(ct);
        return (await Load(code, ct))!;
    }

    // Datos vigentes del usuario y alcance se vuelven a consultar para no confiar en el token como permiso fijo.
    private async Task<(string Role,string? Area,long UserId)?> GetScope(string token,CancellationToken ct,NpgsqlConnection? existing=null,NpgsqlTransaction? tx=null)
    {
        if (existing is not null)
        {
            await using var command = new NpgsqlCommand("SELECT u.perfil,u.area,u.id FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=@hash AND s.last_seen_at>now()-interval '30 minutes' AND u.activo",existing,tx);
            command.Parameters.AddWithValue("hash",Digest(token)); await using var reader=await command.ExecuteReaderAsync(ct);
            return await reader.ReadAsync(ct) ? (reader.GetString(0),reader.IsDBNull(1)?null:reader.GetString(1),reader.GetInt64(2)) : null;
        }
        await using var db=await Open(ct);
        await using var cmd=new NpgsqlCommand("SELECT u.perfil,u.area,u.id FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=@hash AND s.last_seen_at>now()-interval '30 minutes' AND u.activo",db);
        cmd.Parameters.AddWithValue("hash",Digest(token)); await using var r=await cmd.ExecuteReaderAsync(ct);
        return await r.ReadAsync(ct)?(r.GetString(0),r.IsDBNull(1)?null:r.GetString(1),r.GetInt64(2)):null;
    }

    private static IncidentDto ReadIncident(NpgsqlDataReader r,IReadOnlyList<HistoryDto> history) => new(r.GetString(0),r.GetString(1),r.GetString(2),r.GetString(3),r.GetString(4),r.GetFieldValue<DateTimeOffset>(5),r.IsDBNull(6)?null:r.GetString(6),r.IsDBNull(7)?null:r.GetString(7),r.IsDBNull(8)?null:r.GetString(8),r.GetInt64(9),history);
    private static async Task AddHistory(NpgsqlConnection db,NpgsqlTransaction tx,string code,string state,string note,long? actor,DateTimeOffset date,CancellationToken ct)
    {
        await using var cmd=new NpgsqlCommand("INSERT INTO incident_history(incident_code,state,note,actor_user_id,created_at) VALUES(@code,@state,@note,@actor,@date)",db,tx);
        cmd.Parameters.AddWithValue("code",code);cmd.Parameters.AddWithValue("state",state);cmd.Parameters.AddWithValue("note",note);cmd.Parameters.AddWithValue("actor",(object?)actor??DBNull.Value);cmd.Parameters.AddWithValue("date",date);await cmd.ExecuteNonQueryAsync(ct);
    }
    private static async Task<IReadOnlyList<HistoryDto>> LoadHistory(NpgsqlConnection db,string code,CancellationToken ct)
    {
        await using var cmd=new NpgsqlCommand("SELECT created_at,state,note FROM incident_history WHERE incident_code=@code ORDER BY created_at",db);cmd.Parameters.AddWithValue("code",code);
        var result=new List<HistoryDto>();await using var r=await cmd.ExecuteReaderAsync(ct);while(await r.ReadAsync(ct))result.Add(new(r.GetFieldValue<DateTimeOffset>(0),r.GetString(1),r.GetString(2)));return result;
    }
    private async Task<IncidentDto?> Load(string code,CancellationToken ct)
    {
        await using var db=await Open(ct);IncidentDto? item;
        await using(var cmd=new NpgsqlCommand("SELECT code,category,location,description,state,created_at,reference,priority,responsible_unit,version,requester_area FROM incidents WHERE code=@code",db))
        {cmd.Parameters.AddWithValue("code",code.Trim().ToUpperInvariant());await using var r=await cmd.ExecuteReaderAsync(ct);item=await r.ReadAsync(ct)?ReadIncident(r,[]) with { RequesterArea=r.IsDBNull(10)?null:r.GetString(10) }:null;}
        return item is null?null:item with{History=await LoadHistory(db,item.Code,ct)};
    }
}
