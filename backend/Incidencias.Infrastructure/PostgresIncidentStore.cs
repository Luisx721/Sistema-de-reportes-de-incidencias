using System.Data;
using System.Security.Cryptography;
using System.Text;
using Incidencias.Application;
using Incidencias.Domain;
using Npgsql;
using NpgsqlTypes;

namespace Incidencias.Infrastructure;

/// <summary>Adaptador de persistencia sobre el esquema oficial de ProyectoBD.</summary>
public sealed class PostgresIncidentStore : IIncidentStore, IAccountStore, ICatalogStore, IPhotoStore, IReportStore
{
    private readonly string _connectionString;
    private readonly PhotoStorage _photoStorage;

    public PostgresIncidentStore(string connectionString, PhotoStorage? photoStorage = null)
    {
        _connectionString = connectionString;
        _photoStorage = photoStorage ?? new PhotoStorage(Path.Combine(AppContext.BaseDirectory, "uploads", "fotos"));
    }

    private static string Digest(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private async Task<NpgsqlConnection> Open(CancellationToken ct)
    {
        var c = new NpgsqlConnection(_connectionString);
        await c.OpenAsync(ct);
        return c;
    }

    private const string SelectIncident =
        @"SELECT i.i_codigo_seguimiento, c.c_nombre, u.e_nombre || ' - ' || ub.ub_nombre, i.i_descripcion,
                 i.i_estado_actual, i.i_fecha_creacion, NULL::text, i.i_prioridad, a.a_nombre,
                 COALESCE(v.version, 1), ra.a_nombre, i.id_incidencia, i.i_urgencia, i.i_fecha_cierre,
                 i.i_reportante_nombre, i.i_reportante_vinculo
          FROM incidencias i
          JOIN categorias c USING(id_categoria)
          JOIN ubicaciones ub USING(id_ubicacion)
          JOIN edificios u USING(id_edificio)
          LEFT JOIN areas a ON a.id_area = c.id_area
          LEFT JOIN areas ra ON ra.id_area = i.id_area_solicitante
          LEFT JOIN rol2_incident_versions v USING(id_incidencia)";

    // ==========================================
    // Autenticación y Sesiones
    // ==========================================

    public async Task<SessionDto?> LoginAsync(string username, string password, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"SELECT u.id_usuario, u.u_nombre, r.r_nombre, a.a_nombre, u.u_password
              FROM usuarios u
              JOIN rol r USING(id_rol)
              LEFT JOIN areas a USING(id_area)
              WHERE lower(u.u_correo) = lower(@name) AND u.u_activo AND r.r_activo", db);
        cmd.Parameters.AddWithValue("name", username.Trim());

        await using var rd = await cmd.ExecuteReaderAsync(ct);
        if (!await rd.ReadAsync(ct)) return null;

        var id = rd.GetInt32(0);
        var name = rd.GetString(1);
        var role = rd.GetString(2);
        var area = rd.IsDBNull(3) ? null : rd.GetString(3);
        var stored = rd.GetString(4);

        if (!PasswordHasher.Verify(password, stored)) return null;
        await rd.DisposeAsync();

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var now = DateTimeOffset.UtcNow;

        await using var ins = new NpgsqlCommand(
            @"INSERT INTO rol2_sessions(token_hash, id_usuario, created_at, last_seen_at)
              VALUES(@hash, @id, @now, @now)", db);
        ins.Parameters.AddWithValue("hash", Digest(token));
        ins.Parameters.AddWithValue("id", id);
        ins.Parameters.AddWithValue("now", now);
        await ins.ExecuteNonQueryAsync(ct);

        return new SessionDto(token, name, role, area, now.AddMinutes(30), id);
    }

    public async Task<SessionDto?> GetSessionAsync(string token, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"UPDATE rol2_sessions s
              SET last_seen_at = now()
              FROM usuarios u
              JOIN rol r USING(id_rol)
              LEFT JOIN areas a USING(id_area)
              WHERE s.id_usuario = u.id_usuario
                AND s.token_hash = @hash
                AND s.last_seen_at > now() - interval '30 minutes'
                AND u.u_activo
                AND r.r_activo
              RETURNING u.id_usuario, u.u_nombre, r.r_nombre, a.a_nombre, s.last_seen_at + interval '30 minutes'", db);
        cmd.Parameters.AddWithValue("hash", Digest(token));

        await using var rd = await cmd.ExecuteReaderAsync(ct);
        if (!await rd.ReadAsync(ct)) return null;

        return new SessionDto(token, rd.GetString(1), rd.GetString(2),
            rd.IsDBNull(3) ? null : rd.GetString(3),
            rd.GetFieldValue<DateTimeOffset>(4),
            rd.GetInt32(0));
    }

    public async Task EndSessionAsync(string token, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var c = new NpgsqlCommand("DELETE FROM rol2_sessions WHERE token_hash = @h", db);
        c.Parameters.AddWithValue("h", Digest(token));
        await c.ExecuteNonQueryAsync(ct);
    }

    // ==========================================
    // Catálogos Públicos
    // ==========================================

    // Obtiene categorías activas con su área responsable (RF-01) y ubicaciones activas.
    public async Task<IncidentCatalogsDto> GetCatalogsAsync(CancellationToken ct)
    {
        await using var db = await Open(ct);

        // Conserva Categories como lista de nombres para no romper el frontend y agrega CategoryUnits con su unidad.
        var categories = new List<string>();
        var categoryUnits = new List<CategoryUnitDto>();
        await using (var cmd = new NpgsqlCommand(
            @"SELECT c.c_nombre, COALESCE(a.a_nombre, '')
            FROM categorias c
            LEFT JOIN areas a ON a.id_area = c.id_area
            WHERE c.c_activo
            ORDER BY c.c_nombre", db))
        await using (var rd = await cmd.ExecuteReaderAsync(ct))
            while (await rd.ReadAsync(ct))
            {
                var catName = rd.GetString(0);
                categories.Add(catName);
                categoryUnits.Add(new CategoryUnitDto(catName, rd.GetString(1)));
            }

        var locations = new List<string>();
        await using (var cmd = new NpgsqlCommand(
            @"SELECT e.e_nombre || ' - ' || u.ub_nombre
              FROM ubicaciones u
              JOIN edificios e USING(id_edificio)
              WHERE u.ub_activo AND e.e_activo
              ORDER BY e.e_nombre, u.ub_nombre", db))
        await using (var rd = await cmd.ExecuteReaderAsync(ct))
            while (await rd.ReadAsync(ct)) locations.Add(rd.GetString(0));

        return new IncidentCatalogsDto(categories, locations) { CategoryUnits = categoryUnits };
    }

    // ==========================================
    // Incidencias (Creación, Seguimiento, Listado, Modificación)
    // ==========================================

    public Task<IncidentDto> CreateAsync(CreateIncidentDto q, CancellationToken ct) => CreateAsync(q, null, ct);

    // Normaliza los datos de entrada y delega la inserción/detección de duplicados a fn_registrar_incidencia.
    public async Task<IncidentDto> CreateAsync(CreateIncidentDto q, SessionDto? session, CancellationToken ct)
    {
        var description = IncidentRules.NormalizeDescription(q.Description);
        var urgency = IncidentRules.NormalizeUrgency(q.Urgency) ?? "Media";
        var reporterName = IncidentRules.NormalizeReporterName(q.ReporterName);
        var reporterLink = IncidentRules.NormalizeReporterLink(q.ReporterLink);

        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"SELECT c.id_categoria, ub.id_ubicacion, c.id_area
              FROM categorias c
              CROSS JOIN ubicaciones ub
              JOIN edificios e USING(id_edificio)
              WHERE c.c_activo AND ub.ub_activo AND e.e_activo
                AND lower(c.c_nombre) = lower(@cat)
                AND lower(e.e_nombre || ' - ' || ub.ub_nombre) = lower(@loc)", db);
        cmd.Parameters.AddWithValue("cat", q.Category.Trim());
        cmd.Parameters.AddWithValue("loc", q.Location.Trim());

        await using var rd = await cmd.ExecuteReaderAsync(ct);
        if (!await rd.ReadAsync(ct))
            throw new ArgumentException("Categoría o ubicación inexistente o inactiva.");

        var cat = rd.GetInt32(0);
        var loc = rd.GetInt32(1);
        var catArea = rd.GetInt32(2);
        await rd.DisposeAsync();

        string modality;
        int? reporterUserId = null;
        int? requesterAreaId = null;

        if (session is not null)
        {
            if (!IncidentRules.CanCreateAssisted(session.Profile))
                throw new ArgumentException("El perfil actual no tiene autorización para registrar en modalidad asistida.");
            modality = "Asistido";
            reporterUserId = session.UserId ?? await GetUserIdFromTokenAsync(db, session.Token, ct);
            if (reporterUserId is null) throw new UnauthorizedAccessException();
            requesterAreaId = await GetUserAreaIdAsync(db, reporterUserId.Value, ct) ?? catArea;
        }
        else
        {
            modality = "Comunitario";
            reporterUserId = null;
            requesterAreaId = catArea;
        }

        await using var tx = await db.BeginTransactionAsync(ct);
        await using var f = new NpgsqlCommand(
            @"SELECT o_id_incidencia, o_codigo, o_es_duplicado
              FROM fn_registrar_incidencia(@user, @cat, @loc, @area, @nombre, @vinculo, @desc, @urgencia, @modalidad)",
            db, tx);

        f.Parameters.Add("user", NpgsqlDbType.Integer).Value = (object?)reporterUserId ?? DBNull.Value;
        f.Parameters.AddWithValue("cat", cat);
        f.Parameters.AddWithValue("loc", loc);
        f.Parameters.AddWithValue("area", requesterAreaId ?? catArea);
        f.Parameters.Add("nombre", NpgsqlDbType.Varchar).Value = (object?)reporterName ?? DBNull.Value;
        f.Parameters.Add("vinculo", NpgsqlDbType.Varchar).Value = (object?)reporterLink ?? DBNull.Value;
        f.Parameters.AddWithValue("desc", description);
        f.Parameters.AddWithValue("urgencia", urgency);
        f.Parameters.AddWithValue("modalidad", modality);

        await using var resRd = await f.ExecuteReaderAsync(ct);
        if (!await resRd.ReadAsync(ct))
            throw new InvalidOperationException("No se obtuvo resultado de la función de registro.");

        var code = resRd.GetString(1);
        var isDuplicate = resRd.GetBoolean(2);
        await resRd.DisposeAsync();

        await tx.CommitAsync(ct);
        var loaded = await Load(code, ct);
        return (loaded ?? throw new InvalidOperationException("No se pudo cargar la incidencia recién creada."))
            with { IsDuplicate = isDuplicate };
    }

    public async Task<PublicStatusDto?> TrackAsync(string code, CancellationToken ct)
    {
        var i = await Load(code, ct);
        return i is null ? null : IncidentContractMapper.ToPublicStatus(i);
    }

    ////// Listado público resumido: solo campos no sensibles, máximo 100 filas./////////////////////////////////////////////////////
    public async Task<IReadOnlyList<PublicIncidentSummaryDto>> ListPublicAsync(string? category, string? state, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"SELECT i.i_codigo_seguimiento,
                     c.c_nombre,
                     e.e_nombre || ' - ' || ub.ub_nombre,
                     i.i_estado_actual,
                     i.i_fecha_creacion,
                     i.i_urgencia,
                     i.i_fecha_cierre
              FROM incidencias i
              JOIN categorias c ON c.id_categoria = i.id_categoria
              JOIN ubicaciones ub ON ub.id_ubicacion = i.id_ubicacion
              JOIN edificios e ON e.id_edificio = ub.id_edificio
              WHERE (@category IS NULL OR c.c_nombre = @category)
                AND (@state IS NULL OR i.i_estado_actual = @state)
              ORDER BY i.i_fecha_creacion DESC, i.id_incidencia DESC
              LIMIT 100", db);

        cmd.Parameters.Add("category", NpgsqlDbType.Varchar).Value =
            string.IsNullOrWhiteSpace(category) ? DBNull.Value : category.Trim();
        cmd.Parameters.Add("state", NpgsqlDbType.Varchar).Value =
            string.IsNullOrWhiteSpace(state) ? DBNull.Value : state.Trim();

        var items = new List<PublicIncidentSummaryDto>();
        await using var rd = await cmd.ExecuteReaderAsync(ct);
        while (await rd.ReadAsync(ct))
        {
            items.Add(new PublicIncidentSummaryDto(
                rd.GetString(0),
                rd.GetString(1),
                rd.GetString(2),
                rd.GetString(3),
                new DateTimeOffset(DateTime.SpecifyKind(rd.GetDateTime(4), DateTimeKind.Utc)),
                rd.IsDBNull(5) ? null : rd.GetString(5),
                rd.IsDBNull(6) ? null : new DateTimeOffset(DateTime.SpecifyKind(rd.GetDateTime(6), DateTimeKind.Utc))));
        }
        return items;
    }

    public async Task<IReadOnlyList<IncidentDto>> ListAsync(IncidentFilterDto filter, SessionDto session, CancellationToken ct)
    {
        IncidentFilterRules.Validate(filter);

        var sql =
            @"SELECT
                i_codigo_seguimiento,
                categoria,
                edificio || ' - ' || ubicacion,
                i_descripcion,
                i_estado_actual,
                i_fecha_creacion,
                NULL::text,
                i_prioridad,
                area_responsable,
                version,
                area_solicitante,
                id_incidencia,
                i_urgencia,
                i_fecha_cierre,
                i_reportante_nombre,
                i_reportante_vinculo
              FROM VW_Listado_incidencias
              WHERE
                (
                  (@role IN ('Mantenimiento','Desarrollo Físico') AND area_responsable = @role)
                  OR (@role IN ('Jefatura','Ordenanza') AND (area_solicitante = @area OR id_area_solicitante = (SELECT id_area FROM areas WHERE a_nombre = @area LIMIT 1)))
                  OR @role IN ('Autoridad', 'Administrador')
                )
                AND (@query IS NULL OR i_codigo_seguimiento ILIKE '%'||@query||'%' OR i_descripcion ILIKE '%'||@query||'%')
                AND (@category IS NULL OR categoria = @category)
                AND (@location IS NULL OR edificio || ' - ' || ubicacion = @location)
                AND (@state IS NULL OR i_estado_actual = @state)
                AND (@urgency IS NULL OR i_urgencia = @urgency)
                AND (@from IS NULL OR i_fecha_creacion >= @from)
                AND (@to IS NULL OR i_fecha_creacion < @to)
              ORDER BY
                CASE i_prioridad WHEN 'Alta' THEN 0 WHEN 'Media' THEN 1 ELSE 2 END,
                i_fecha_creacion DESC";

        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(sql, db);
        BindFilters(cmd, filter, session);

        var rows = new List<(IncidentDto Dto, int Id)>();
        await using (var r = await cmd.ExecuteReaderAsync(ct))
        {
            while (await r.ReadAsync(ct))
            {
                rows.Add((Read(r), r.GetInt32(11)));
            }
        }

        for (int x = 0; x < rows.Count; x++)
        {
            rows[x] = (rows[x].Dto with { History = await LoadHistory(db, rows[x].Id, ct) }, rows[x].Id);
        }

        return rows.Select(x => x.Dto).ToArray();
    }

    private static void BindFilters(NpgsqlCommand c, IncidentFilterDto f, SessionDto s)
    {
        c.Parameters.AddWithValue("role", s.Profile);
        c.Parameters.Add("area", NpgsqlDbType.Varchar).Value = (object?)s.Area ?? DBNull.Value;
        c.Parameters.Add("query", NpgsqlDbType.Text).Value = (object?)f.Query ?? DBNull.Value;
        c.Parameters.Add("category", NpgsqlDbType.Varchar).Value = (object?)f.Category ?? DBNull.Value;
        c.Parameters.Add("location", NpgsqlDbType.Text).Value = (object?)f.Location ?? DBNull.Value;
        c.Parameters.Add("state", NpgsqlDbType.Varchar).Value = (object?)f.State ?? DBNull.Value;
        c.Parameters.Add("urgency", NpgsqlDbType.Varchar).Value = (object?)f.Urgency ?? DBNull.Value;
        c.Parameters.Add("from", NpgsqlDbType.Timestamp).Value = f.From is { } a
            ? DateTime.SpecifyKind(IncidentFilterRules.StartOfDay(a).UtcDateTime, DateTimeKind.Unspecified)
            : DBNull.Value;
        c.Parameters.Add("to", NpgsqlDbType.Timestamp).Value = f.To is { } b
            ? DateTime.SpecifyKind(IncidentFilterRules.StartOfDay(b.AddDays(1)).UtcDateTime, DateTimeKind.Unspecified)
            : DBNull.Value;
    }

    public async Task<IncidentDto?> GetAuthorizedAsync(string code, SessionDto session, CancellationToken ct)
    {
        var x = await Load(code, ct);
        return x is not null && Allowed(x, session) ? x : null;
    }

    private static bool Allowed(IncidentDto i, SessionDto s)
    {
        if (s.Profile is "Autoridad" or "Administrador") return true;
        if (s.Profile is "Mantenimiento" or "Desarrollo Físico")
            return i.ResponsibleUnit == s.Profile;
        if (s.Profile is "Jefatura" or "Ordenanza")
            return !string.IsNullOrEmpty(s.Area) && i.RequesterArea == s.Area;
        return false;
    }

    public async Task<IncidentDto> ChangeAsync(string code, ChangeIncidentDto req, SessionDto session, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);

        IncidentDto? item;
        int id;

        await using (var c = new NpgsqlCommand(SelectIncident + " WHERE i.i_codigo_seguimiento = @code FOR UPDATE OF i", db, tx))
        {
            c.Parameters.AddWithValue("code", code.Trim().ToUpperInvariant());
            await using var r = await c.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) throw new KeyNotFoundException("Incidencia inexistente.");
            item = Read(r);
            id = r.GetInt32(11);
        }

        if (!IncidentRules.CanEdit(session.Profile, session.Area ?? "", item.RequesterArea ?? "", item.ResponsibleUnit ?? "", item.Category, item.State))
            throw new UnauthorizedAccessException("El usuario no tiene competencia para modificar este expediente.");

        if (req.Version != item.Version)
            throw new IncidentConflictException("El expediente cambió desde que fue consultado. Recarga y aplica de nuevo.");

        if (req.State == item.State && req.Priority == item.Priority)
            throw new ArgumentException("Selecciona un cambio de estado o prioridad.");

        IncidentRules.ValidateChange(item.State, req.State, req.Priority, req.Note);

        var user = session.UserId ?? await UserId(session.Token, db, tx, ct);
        if (user is null) throw new UnauthorizedAccessException();

        await using (var actor = new NpgsqlCommand("SELECT set_config('app.id_usuario', @user, TRUE)", db, tx))
        {
            actor.Parameters.AddWithValue("user", user.Value.ToString());
            await actor.ExecuteScalarAsync(ct);
        }

        if (req.Priority != item.Priority)
        {
            await using var p = new NpgsqlCommand("UPDATE incidencias SET i_prioridad = @p WHERE id_incidencia = @id", db, tx);
            p.Parameters.AddWithValue("p", req.Priority);
            p.Parameters.AddWithValue("id", id);
            await p.ExecuteNonQueryAsync(ct);
        }

        if (req.State != item.State)
        {
            await using var f = new NpgsqlCommand("SELECT o_resultado FROM fn_cambiar_estado_incidencia(@id, @user, @state, @note)", db, tx);
            f.Parameters.AddWithValue("id", id);
            f.Parameters.AddWithValue("user", user.Value);
            f.Parameters.AddWithValue("state", req.State);
            f.Parameters.AddWithValue("note", req.Note.Trim());
            var result = (string?)await f.ExecuteScalarAsync(ct);
            if (result != "OK") throw new ArgumentException("La función oficial rechazó el cambio: " + result);
        }

        if (req.State == item.State)
        {
            await using var v = new NpgsqlCommand("UPDATE rol2_incident_versions SET version = version + 1 WHERE id_incidencia = @id", db, tx);
            v.Parameters.AddWithValue("id", id);
            await v.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);
        return (await Load(code, ct))!;
    }

    private static async Task<int?> UserId(string token, NpgsqlConnection db, NpgsqlTransaction tx, CancellationToken ct)
    {
        await using var c = new NpgsqlCommand(
            @"SELECT u.id_usuario
              FROM rol2_sessions s
              JOIN usuarios u USING(id_usuario)
              WHERE s.token_hash = @h AND s.last_seen_at > now() - interval '30 minutes' AND u.u_activo", db, tx);
        c.Parameters.AddWithValue("h", Digest(token));
        var x = await c.ExecuteScalarAsync(ct);
        return x is null ? null : Convert.ToInt32(x);
    }

    private static async Task<int?> GetUserIdFromTokenAsync(NpgsqlConnection db, string token, CancellationToken ct)
    {
        await using var c = new NpgsqlCommand(
            @"SELECT u.id_usuario
              FROM rol2_sessions s
              JOIN usuarios u USING(id_usuario)
              WHERE s.token_hash = @h AND s.last_seen_at > now() - interval '30 minutes' AND u.u_activo", db);
        c.Parameters.AddWithValue("h", Digest(token));
        var x = await c.ExecuteScalarAsync(ct);
        return x is null ? null : Convert.ToInt32(x);
    }

    private static async Task<int?> GetUserAreaIdAsync(NpgsqlConnection db, int userId, CancellationToken ct)
    {
        await using var c = new NpgsqlCommand("SELECT id_area FROM usuarios WHERE id_usuario = @id", db);
        c.Parameters.AddWithValue("id", userId);
        var res = await c.ExecuteScalarAsync(ct);
        return res is null or DBNull ? null : Convert.ToInt32(res);
    }

    private static IncidentDto Read(NpgsqlDataReader r) => new(
        r.GetString(0),
        r.GetString(1),
        r.GetString(2),
        r.GetString(3),
        r.GetString(4),
        new DateTimeOffset(DateTime.SpecifyKind(r.GetDateTime(5), DateTimeKind.Utc)),
        r.IsDBNull(6) ? null : r.GetString(6),
        r.IsDBNull(7) ? null : r.GetString(7),
        r.IsDBNull(8) ? null : r.GetString(8),
        r.GetInt64(9),
        [],
        r.IsDBNull(12) ? null : r.GetString(12),
        r.IsDBNull(13) ? null : new DateTimeOffset(DateTime.SpecifyKind(r.GetDateTime(13), DateTimeKind.Utc)),
        r.IsDBNull(14) ? null : r.GetString(14),
        r.IsDBNull(15) ? null : r.GetString(15))
    {
        RequesterArea = r.IsDBNull(10) ? null : r.GetString(10)
    };

    private async Task<IncidentDto?> Load(string code, CancellationToken ct)
    {
        await using var db = await Open(ct);
        IncidentDto? x;
        int id;
        await using (var c = new NpgsqlCommand(SelectIncident + " WHERE i.i_codigo_seguimiento = @c", db))
        {
            c.Parameters.AddWithValue("c", code.Trim().ToUpperInvariant());
            await using var r = await c.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return null;
            x = Read(r);
            id = r.GetInt32(11);
        }
        return x with { History = await LoadHistory(db, id, ct) };
    }

    private static async Task<IReadOnlyList<HistoryDto>> LoadHistory(NpgsqlConnection db, int id, CancellationToken ct)
    {
        await using var c = new NpgsqlCommand(
            @"SELECT he_fecha_hora, he_estado,
                     CASE WHEN he_estado = 'Recibido' THEN 'Reporte recibido y registrado por el sistema.' ELSE he_observacion END
              FROM historial_estados
              WHERE id_incidencia = @id
              ORDER BY he_fecha_hora, id_historial", db);
        c.Parameters.AddWithValue("id", id);
        var list = new List<HistoryDto>();
        await using var r = await c.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            list.Add(new HistoryDto(new DateTimeOffset(DateTime.SpecifyKind(r.GetDateTime(0), DateTimeKind.Utc)), r.GetString(1), r.GetString(2)));
        return list;
    }

    // ==========================================
    // Fotografías (IPhotoStore)
    // ==========================================

    public async Task<PhotoDto> AddAsync(string code, PhotoUploadDto upload, SessionDto session, CancellationToken ct)
    {
        var extension = PhotoRules.Validate(upload.FileName, upload.Content);
        var dbType = PhotoRules.DatabaseType(extension);

        await using var db = await Open(ct);
        int incidentId;
        await using (var c = new NpgsqlCommand("SELECT id_incidencia FROM incidencias WHERE i_codigo_seguimiento = @code", db))
        {
            c.Parameters.AddWithValue("code", code.Trim().ToUpperInvariant());
            var res = await c.ExecuteScalarAsync(ct);
            if (res is null) throw new KeyNotFoundException("Incidencia inexistente.");
            incidentId = Convert.ToInt32(res);
        }

        await using var tx = await db.BeginTransactionAsync(ct);

        // Bloqueo con FOR UPDATE mediante la función oficial
        await using (var chk = new NpgsqlCommand("SELECT fn_validar_limite_fotografias(@id)", db, tx))
        {
            chk.Parameters.AddWithValue("id", incidentId);
            var ok = (bool)(await chk.ExecuteScalarAsync(ct) ?? false);
            if (!ok) throw new ArgumentException("Límite de 3 fotografías alcanzado o incidencia cerrada/inexistente.");
        }

        var tmpPath = await _photoStorage.WriteTemporaryAsync(upload.Content, ct);
        var finalName = _photoStorage.CreateFinalName(extension);

        try
        {
            int nextOrder;
            await using (var ordCmd = new NpgsqlCommand("SELECT COALESCE(MAX(f_orden), 0) + 1 FROM fotografias WHERE id_incidencia = @id", db, tx))
            {
                ordCmd.Parameters.AddWithValue("id", incidentId);
                nextOrder = Convert.ToInt32(await ordCmd.ExecuteScalarAsync(ct));
            }

            int photoId;
            await using (var ins = new NpgsqlCommand(
                @"INSERT INTO fotografias(id_incidencia, f_orden, f_archivo, f_tipo, f_tamano_bytes)
                  VALUES(@id, @orden, @archivo, @tipo, @tamano)
                  RETURNING id_foto", db, tx))
            {
                ins.Parameters.AddWithValue("id", incidentId);
                ins.Parameters.AddWithValue("orden", nextOrder);
                ins.Parameters.AddWithValue("archivo", finalName);
                ins.Parameters.AddWithValue("tipo", dbType);
                ins.Parameters.AddWithValue("tamano", upload.Content.Length);
                photoId = Convert.ToInt32(await ins.ExecuteScalarAsync(ct));
            }

            _photoStorage.Promote(tmpPath, finalName);
            await tx.CommitAsync(ct);

            return new PhotoDto(photoId, nextOrder, dbType, upload.Content.Length, $"/api/fotos/{photoId}");
        }
        catch
        {
            try { File.Delete(tmpPath); } catch { }
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    public async Task<IReadOnlyList<PhotoDto>> ListAsync(string code, SessionDto session, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var c = new NpgsqlCommand(
            @"SELECT f.id_foto, f.f_orden, f.f_tipo, f.f_tamano_bytes
              FROM fotografias f
              JOIN incidencias i USING(id_incidencia)
              WHERE i.i_codigo_seguimiento = @code
              ORDER BY f.f_orden", db);
        c.Parameters.AddWithValue("code", code.Trim().ToUpperInvariant());

        var list = new List<PhotoDto>();
        await using var rd = await c.ExecuteReaderAsync(ct);
        while (await rd.ReadAsync(ct))
        {
            var id = rd.GetInt32(0);
            list.Add(new PhotoDto(id, rd.GetInt32(1), rd.GetString(2), rd.GetInt32(3), $"/api/fotos/{id}"));
        }
        return list;
    }

    public async Task<PhotoFileDto?> GetFileAsync(int id, SessionDto session, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var c = new NpgsqlCommand(
            "SELECT f.f_archivo, f.f_tipo FROM fotografias f WHERE f.id_foto = @id", db);
        c.Parameters.AddWithValue("id", id);

        await using var rd = await c.ExecuteReaderAsync(ct);
        if (!await rd.ReadAsync(ct)) return null;

        var fileName = rd.GetString(0);
        var type = rd.GetString(1);
        await rd.DisposeAsync();

        var content = await _photoStorage.ReadAsync(fileName, ct);
        if (content is null) return null;

        return new PhotoFileDto(content, PhotoRules.ContentType("." + type), fileName);
    }

    // ==========================================
    // Estadísticas y Reportes (IReportStore)
    // ==========================================

    public async Task<StatisticsDto> GetStatisticsAsync(IncidentFilterDto filter, SessionDto session, CancellationToken ct)
    {
        await using var db = await Open(ct);

        var byState = new List<StateStatDto>();
        await using (var cmd = new NpgsqlCommand(
            @"SELECT i.i_estado_actual, COUNT(i.id_incidencia)
              FROM incidencias i
              JOIN categorias c USING(id_categoria)
              JOIN areas a ON a.id_area = c.id_area
              WHERE ((@role IN ('Mantenimiento','Desarrollo Físico') AND a.a_nombre = @role)
                 OR (@role IN ('Jefatura','Ordenanza') AND i.id_area_solicitante = (SELECT id_area FROM areas WHERE a_nombre = @area LIMIT 1))
                 OR @role IN ('Autoridad', 'Administrador'))
                AND (@from IS NULL OR i.i_fecha_creacion >= @from)
                AND (@to IS NULL OR i.i_fecha_creacion < @to)
              GROUP BY i.i_estado_actual", db))
        {
            BindFilters(cmd, filter, session);
            await using var rd = await cmd.ExecuteReaderAsync(ct);
            while (await rd.ReadAsync(ct))
                byState.Add(new StateStatDto(rd.GetString(0), Convert.ToInt32(rd.GetInt64(1))));
        }

               var byCategory = new List<CategoryStatDto>();
        await using (var cmd = new NpgsqlCommand(
            @"SELECT c.c_nombre,
                     COUNT(i.id_incidencia),
                     COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'Recibido'),
                     COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'En proceso'),
                     COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'En espera de materiales/autorización'),
                     COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'Resuelto'),
                     COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'Rechazado/Cerrado'),
                     COALESCE(ROUND(100.0 * COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'Recibido') / NULLIF(COUNT(i.id_incidencia), 0), 2), 0),
                     COALESCE(ROUND(100.0 * COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'En proceso') / NULLIF(COUNT(i.id_incidencia), 0), 2), 0),
                     COALESCE(ROUND(100.0 * COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'En espera de materiales/autorización') / NULLIF(COUNT(i.id_incidencia), 0), 2), 0),
                     COALESCE(ROUND(100.0 * COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'Resuelto') / NULLIF(COUNT(i.id_incidencia), 0), 2), 0),
                     COALESCE(ROUND(100.0 * COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'Rechazado/Cerrado') / NULLIF(COUNT(i.id_incidencia), 0), 2), 0)
              FROM categorias c
              JOIN areas ar ON ar.id_area = c.id_area
              LEFT JOIN incidencias i
                     ON i.id_categoria = c.id_categoria
                    AND (@from IS NULL OR i.i_fecha_creacion >= @from)
                    AND (@to IS NULL OR i.i_fecha_creacion < @to)
                    AND (@role NOT IN ('Jefatura','Ordenanza')
                         OR i.id_area_solicitante = (SELECT id_area FROM areas WHERE a_nombre = @area LIMIT 1))
              WHERE (@role IN ('Autoridad', 'Administrador', 'Jefatura', 'Ordenanza')
                     OR ar.a_nombre = @role)
              GROUP BY c.id_categoria, c.c_nombre
              ORDER BY c.c_nombre", db))
        {
            BindFilters(cmd, filter, session);
            await using var rd = await cmd.ExecuteReaderAsync(ct);
            while (await rd.ReadAsync(ct))
            {
                byCategory.Add(new CategoryStatDto(
                    rd.GetString(0),
                    Convert.ToInt32(rd.GetInt64(1)),
                    Convert.ToInt32(rd.GetInt64(2)),
                    Convert.ToInt32(rd.GetInt64(3)),
                    Convert.ToInt32(rd.GetInt64(4)),
                    Convert.ToInt32(rd.GetInt64(5)),
                    Convert.ToInt32(rd.GetInt64(6)),
                    rd.GetDecimal(7),
                    rd.GetDecimal(8),
                    rd.GetDecimal(9),
                    rd.GetDecimal(10),
                    rd.GetDecimal(11)));
            }
        }

        var byLocation = new List<LocationStatDto>();
        await using (var cmd = new NpgsqlCommand(
            @"SELECT e.e_nombre || ' - ' || ub.ub_nombre, COUNT(i.id_incidencia)
              FROM incidencias i
              JOIN ubicaciones ub USING(id_ubicacion)
              JOIN edificios e USING(id_edificio)
              JOIN categorias c USING(id_categoria)
              JOIN areas a ON a.id_area = c.id_area
              WHERE ((@role IN ('Mantenimiento','Desarrollo Físico') AND a.a_nombre = @role)
                 OR (@role IN ('Jefatura','Ordenanza') AND i.id_area_solicitante = (SELECT id_area FROM areas WHERE a_nombre = @area LIMIT 1))
                 OR @role IN ('Autoridad', 'Administrador'))
                AND (@from IS NULL OR i.i_fecha_creacion >= @from)
                AND (@to IS NULL OR i.i_fecha_creacion < @to)
              GROUP BY 1 ORDER BY 2 DESC LIMIT 10", db))
        {
            BindFilters(cmd, filter, session);
            await using var rd = await cmd.ExecuteReaderAsync(ct);
            while (await rd.ReadAsync(ct))
                byLocation.Add(new LocationStatDto(rd.GetString(0), Convert.ToInt32(rd.GetInt64(1))));
        }

        var total = byState.Sum(s => s.Count);
        return new StatisticsDto(total, byState, byCategory, byLocation, filter.From, filter.To);
    }

    // ==========================================
    // Cuentas de Usuario (IAccountStore - RF-22)
    // ==========================================

    public async Task<IReadOnlyList<AccountDto>> GetAccountsAsync(CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"SELECT u.id_usuario, u.u_nombre, u.u_correo, r.r_nombre, COALESCE(a.a_nombre, ''), u.u_activo
              FROM usuarios u
              JOIN rol r USING(id_rol)
              LEFT JOIN areas a USING(id_area)
              ORDER BY u.u_nombre", db);

        var list = new List<AccountDto>();
        await using var rd = await cmd.ExecuteReaderAsync(ct);
        while (await rd.ReadAsync(ct))
            list.Add(new AccountDto(rd.GetInt32(0), rd.GetString(1), rd.GetString(2), rd.GetString(3), rd.GetString(4), rd.GetBoolean(5)));
        return list;
    }

    public async Task<AccountDto> CreateAccountAsync(AccountInputDto input, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Name) || string.IsNullOrWhiteSpace(input.Username) || string.IsNullOrWhiteSpace(input.Role))
            throw new ArgumentException("Nombre, correo y rol son obligatorios.");
        if (string.IsNullOrEmpty(input.Password))
            throw new ArgumentException("La contraseña es obligatoria.");

        var passwordHash = PasswordHasher.Hash(input.Password);

        await using var db = await Open(ct);
        int roleId;
        await using (var rCmd = new NpgsqlCommand("SELECT id_rol FROM rol WHERE lower(r_nombre) = lower(@role)", db))
        {
            rCmd.Parameters.AddWithValue("role", input.Role.Trim());
            var res = await rCmd.ExecuteScalarAsync(ct);
            if (res is null) throw new ArgumentException($"El rol '{input.Role}' no existe.");
            roleId = Convert.ToInt32(res);
        }

        int? areaId = null;
        if (!string.IsNullOrWhiteSpace(input.Area))
        {
            await using var aCmd = new NpgsqlCommand("SELECT id_area FROM areas WHERE lower(a_nombre) = lower(@area)", db);
            aCmd.Parameters.AddWithValue("area", input.Area.Trim());
            var res = await aCmd.ExecuteScalarAsync(ct);
            if (res is not null) areaId = Convert.ToInt32(res);
        }

        int newId;
        await using (var ins = new NpgsqlCommand(
            @"INSERT INTO usuarios (id_rol, id_area, u_nombre, u_correo, u_password, u_vinculo, u_activo)
              VALUES (@rol, @area, @name, @email, @pass, 'Personal', @act)
              RETURNING id_usuario", db))
        {
            ins.Parameters.AddWithValue("rol", roleId);
            ins.Parameters.Add("area", NpgsqlDbType.Integer).Value = (object?)areaId ?? DBNull.Value;
            ins.Parameters.AddWithValue("name", input.Name.Trim());
            ins.Parameters.AddWithValue("email", input.Username.Trim().ToLowerInvariant());
            ins.Parameters.AddWithValue("pass", passwordHash);
            ins.Parameters.AddWithValue("act", input.Active ?? true);
            newId = Convert.ToInt32(await ins.ExecuteScalarAsync(ct));
        }

        return new AccountDto(newId, input.Name.Trim(), input.Username.Trim().ToLowerInvariant(), input.Role.Trim(), input.Area ?? "", input.Active ?? true);
    }

    public async Task<AccountDto?> UpdateAccountAsync(int id, AccountInputDto input, CancellationToken ct)
    {
        await using var db = await Open(ct);
        int roleId;
        await using (var rCmd = new NpgsqlCommand("SELECT id_rol FROM rol WHERE lower(r_nombre) = lower(@role)", db))
        {
            rCmd.Parameters.AddWithValue("role", input.Role.Trim());
            var res = await rCmd.ExecuteScalarAsync(ct);
            if (res is null) throw new ArgumentException($"El rol '{input.Role}' no existe.");
            roleId = Convert.ToInt32(res);
        }

        int? areaId = null;
        if (!string.IsNullOrWhiteSpace(input.Area))
        {
            await using var aCmd = new NpgsqlCommand("SELECT id_area FROM areas WHERE lower(a_nombre) = lower(@area)", db);
            aCmd.Parameters.AddWithValue("area", input.Area.Trim());
            var res = await aCmd.ExecuteScalarAsync(ct);
            if (res is not null) areaId = Convert.ToInt32(res);
        }

        string? newHash = !string.IsNullOrEmpty(input.Password) ? PasswordHasher.Hash(input.Password) : null;

        var sql = @"UPDATE usuarios
                    SET u_nombre = @name,
                        u_correo = @email,
                        id_rol = @rol,
                        id_area = @area,
                        u_activo = COALESCE(@act, u_activo)"
                  + (newHash is not null ? ", u_password = @pass" : "")
                  + " WHERE id_usuario = @id";

        await using var cmd = new NpgsqlCommand(sql, db);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("name", input.Name.Trim());
        cmd.Parameters.AddWithValue("email", input.Username.Trim().ToLowerInvariant());
        cmd.Parameters.AddWithValue("rol", roleId);
        cmd.Parameters.Add("area", NpgsqlDbType.Integer).Value = (object?)areaId ?? DBNull.Value;
        cmd.Parameters.Add("act", NpgsqlDbType.Boolean).Value = (object?)input.Active ?? DBNull.Value;
        if (newHash is not null) cmd.Parameters.AddWithValue("pass", newHash);

        var affected = await cmd.ExecuteNonQueryAsync(ct);
        if (affected == 0) return null;

        if (input.Active == false)
        {
            await using var delSes = new NpgsqlCommand("DELETE FROM rol2_sessions WHERE id_usuario = @id", db);
            delSes.Parameters.AddWithValue("id", id);
            await delSes.ExecuteNonQueryAsync(ct);
        }

        return new AccountDto(id, input.Name.Trim(), input.Username.Trim().ToLowerInvariant(), input.Role.Trim(), input.Area ?? "", input.Active ?? true);
    }

    public async Task<bool> SetAccountActiveAsync(int id, bool active, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand("UPDATE usuarios SET u_activo = @act WHERE id_usuario = @id", db);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("act", active);
        var affected = await cmd.ExecuteNonQueryAsync(ct);

        if (!active)
        {
            await using var delSes = new NpgsqlCommand("DELETE FROM rol2_sessions WHERE id_usuario = @id", db);
            delSes.Parameters.AddWithValue("id", id);
            await delSes.ExecuteNonQueryAsync(ct);
        }

        return affected > 0;
    }

    // ==========================================
    // Catálogos Administrativos (ICatalogStore - RF-23)
    // ==========================================

    public async Task<IReadOnlyList<CategoryAdminDto>> GetCategoriesAsync(bool includeInactive, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"SELECT c.id_categoria, c.c_nombre, c.c_descripcion, c.id_area, a.a_nombre, c.c_activo
              FROM categorias c
              JOIN areas a USING(id_area)
              WHERE (@all OR c.c_activo)
              ORDER BY c.c_nombre", db);
        cmd.Parameters.AddWithValue("all", includeInactive);

        var list = new List<CategoryAdminDto>();
        await using var rd = await cmd.ExecuteReaderAsync(ct);
        while (await rd.ReadAsync(ct))
        {
            list.Add(new CategoryAdminDto(
                rd.GetInt32(0),
                rd.GetString(1),
                rd.IsDBNull(2) ? null : rd.GetString(2),
                rd.GetInt32(3),
                rd.GetString(4),
                rd.GetBoolean(5)));
        }
        return list;
    }

    public async Task<CategoryAdminDto> CreateCategoryAsync(CategoryInputDto input, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Name)) throw new ArgumentException("El nombre de la categoría es obligatorio.");
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"INSERT INTO categorias (id_area, c_nombre, c_descripcion, c_activo)
              VALUES (@area, @name, @desc, @act)
              RETURNING id_categoria", db);
        cmd.Parameters.AddWithValue("area", input.AreaId);
        cmd.Parameters.AddWithValue("name", input.Name.Trim());
        cmd.Parameters.Add("desc", NpgsqlDbType.Varchar).Value = (object?)input.Description?.Trim() ?? DBNull.Value;
        cmd.Parameters.AddWithValue("act", input.Active ?? true);

        var id = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
        var categories = await GetCategoriesAsync(true, ct);
        return categories.First(c => c.Id == id);
    }

    public async Task<CategoryAdminDto?> UpdateCategoryAsync(int id, CategoryInputDto input, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"UPDATE categorias
              SET c_nombre = @name, id_area = @area, c_descripcion = @desc, c_activo = COALESCE(@act, c_activo)
              WHERE id_categoria = @id", db);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("name", input.Name.Trim());
        cmd.Parameters.AddWithValue("area", input.AreaId);
        cmd.Parameters.Add("desc", NpgsqlDbType.Varchar).Value = (object?)input.Description?.Trim() ?? DBNull.Value;
        cmd.Parameters.Add("act", NpgsqlDbType.Boolean).Value = (object?)input.Active ?? DBNull.Value;

        var affected = await cmd.ExecuteNonQueryAsync(ct);
        if (affected == 0) return null;
        var categories = await GetCategoriesAsync(true, ct);
        return categories.FirstOrDefault(c => c.Id == id);
    }

    public async Task<bool> SetCategoryActiveAsync(int id, bool active, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand("UPDATE categorias SET c_activo = @act WHERE id_categoria = @id", db);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("act", active);
        return await cmd.ExecuteNonQueryAsync(ct) > 0;
    }

    public async Task<IReadOnlyList<LocationAdminDto>> GetLocationsAsync(bool includeInactive, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"SELECT u.id_ubicacion, u.ub_nombre, u.ub_tipo, e.id_edificio, e.e_nombre, u.ub_activo
              FROM ubicaciones u
              JOIN edificios e USING(id_edificio)
              WHERE (@all OR u.ub_activo)
              ORDER BY e.e_nombre, u.ub_nombre", db);
        cmd.Parameters.AddWithValue("all", includeInactive);

        var list = new List<LocationAdminDto>();
        await using var rd = await cmd.ExecuteReaderAsync(ct);
        while (await rd.ReadAsync(ct))
        {
            list.Add(new LocationAdminDto(
                rd.GetInt32(0),
                rd.GetString(1),
                rd.IsDBNull(2) ? null : rd.GetString(2),
                rd.GetInt32(3),
                rd.GetString(4),
                rd.GetBoolean(5)));
        }
        return list;
    }

    public async Task<LocationAdminDto> CreateLocationAsync(LocationInputDto input, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Name)) throw new ArgumentException("El nombre de la ubicación es obligatorio.");
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"INSERT INTO ubicaciones (id_edificio, ub_nombre, ub_tipo, ub_activo)
              VALUES (@edificio, @name, @tipo, @act)
              RETURNING id_ubicacion", db);
        cmd.Parameters.AddWithValue("edificio", input.BuildingId);
        cmd.Parameters.AddWithValue("name", input.Name.Trim());
        cmd.Parameters.Add("tipo", NpgsqlDbType.Varchar).Value = (object?)input.Type?.Trim() ?? DBNull.Value;
        cmd.Parameters.AddWithValue("act", input.Active ?? true);

        var id = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
        var locations = await GetLocationsAsync(true, ct);
        return locations.First(l => l.Id == id);
    }

    public async Task<LocationAdminDto?> UpdateLocationAsync(int id, LocationInputDto input, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"UPDATE ubicaciones
              SET ub_nombre = @name, id_edificio = @edificio, ub_tipo = @tipo, ub_activo = COALESCE(@act, ub_activo)
              WHERE id_ubicacion = @id", db);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("name", input.Name.Trim());
        cmd.Parameters.AddWithValue("edificio", input.BuildingId);
        cmd.Parameters.Add("tipo", NpgsqlDbType.Varchar).Value = (object?)input.Type?.Trim() ?? DBNull.Value;
        cmd.Parameters.Add("act", NpgsqlDbType.Boolean).Value = (object?)input.Active ?? DBNull.Value;

        var affected = await cmd.ExecuteNonQueryAsync(ct);
        if (affected == 0) return null;
        var locations = await GetLocationsAsync(true, ct);
        return locations.FirstOrDefault(l => l.Id == id);
    }

    public async Task<bool> SetLocationActiveAsync(int id, bool active, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand("UPDATE ubicaciones SET ub_activo = @act WHERE id_ubicacion = @id", db);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("act", active);
        return await cmd.ExecuteNonQueryAsync(ct) > 0;
    }

    public async Task<IReadOnlyList<BuildingAdminDto>> GetBuildingsAsync(bool includeInactive, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"SELECT id_edificio, e_nombre, e_activo
              FROM edificios
              WHERE (@all OR e_activo)
              ORDER BY e_nombre", db);
        cmd.Parameters.AddWithValue("all", includeInactive);

        var list = new List<BuildingAdminDto>();
        await using var rd = await cmd.ExecuteReaderAsync(ct);
        while (await rd.ReadAsync(ct))
            list.Add(new BuildingAdminDto(rd.GetInt32(0), rd.GetString(1), rd.GetBoolean(2)));
        return list;
    }

    public async Task<BuildingAdminDto> CreateBuildingAsync(BuildingInputDto input, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Name)) throw new ArgumentException("El nombre del edificio es obligatorio.");
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"INSERT INTO edificios (e_nombre, e_activo)
              VALUES (@name, @act)
              RETURNING id_edificio", db);
        cmd.Parameters.AddWithValue("name", input.Name.Trim());
        cmd.Parameters.AddWithValue("act", input.Active ?? true);

        var id = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
        return new BuildingAdminDto(id, input.Name.Trim(), input.Active ?? true);
    }

    public async Task<BuildingAdminDto?> UpdateBuildingAsync(int id, BuildingInputDto input, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"UPDATE edificios
              SET e_nombre = @name, e_activo = COALESCE(@act, e_activo)
              WHERE id_edificio = @id", db);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("name", input.Name.Trim());
        cmd.Parameters.Add("act", NpgsqlDbType.Boolean).Value = (object?)input.Active ?? DBNull.Value;

        var affected = await cmd.ExecuteNonQueryAsync(ct);
        if (affected == 0) return null;
        return new BuildingAdminDto(id, input.Name.Trim(), input.Active ?? true);
    }

    public async Task<bool> SetBuildingActiveAsync(int id, bool active, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand("UPDATE edificios SET e_activo = @act WHERE id_edificio = @id", db);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("act", active);
        return await cmd.ExecuteNonQueryAsync(ct) > 0;
    }

    public async Task<IReadOnlyList<AreaAdminDto>> GetAreasAsync(bool includeInactive, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"SELECT id_area, a_nombre, a_tipo, a_es_responsable, a_activo
              FROM areas
              WHERE (@all OR a_activo)
              ORDER BY a_nombre", db);
        cmd.Parameters.AddWithValue("all", includeInactive);

        var list = new List<AreaAdminDto>();
        await using var rd = await cmd.ExecuteReaderAsync(ct);
        while (await rd.ReadAsync(ct))
        {
            list.Add(new AreaAdminDto(
                rd.GetInt32(0),
                rd.GetString(1),
                rd.IsDBNull(2) ? null : rd.GetString(2),
                rd.GetBoolean(3),
                rd.GetBoolean(4)));
        }
        return list;
    }

    public async Task<AreaAdminDto> CreateAreaAsync(AreaInputDto input, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Name)) throw new ArgumentException("El nombre del área es obligatorio.");
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"INSERT INTO areas (a_nombre, a_tipo, a_es_responsable, a_activo)
              VALUES (@name, @tipo, @resp, @act)
              RETURNING id_area", db);
        cmd.Parameters.AddWithValue("name", input.Name.Trim());
        cmd.Parameters.Add("tipo", NpgsqlDbType.Varchar).Value = (object?)input.Type?.Trim() ?? DBNull.Value;
        cmd.Parameters.AddWithValue("resp", input.Responsible ?? false);
        cmd.Parameters.AddWithValue("act", input.Active ?? true);

        var id = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
        var areas = await GetAreasAsync(true, ct);
        return areas.First(a => a.Id == id);
    }

    public async Task<AreaAdminDto?> UpdateAreaAsync(int id, AreaInputDto input, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            @"UPDATE areas
              SET a_nombre = @name, a_tipo = @tipo,
                  a_es_responsable = COALESCE(@resp, a_es_responsable),
                  a_activo = COALESCE(@act, a_activo)
              WHERE id_area = @id", db);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("name", input.Name.Trim());
        cmd.Parameters.Add("tipo", NpgsqlDbType.Varchar).Value = (object?)input.Type?.Trim() ?? DBNull.Value;
        cmd.Parameters.Add("resp", NpgsqlDbType.Boolean).Value = (object?)input.Responsible ?? DBNull.Value;
        cmd.Parameters.Add("act", NpgsqlDbType.Boolean).Value = (object?)input.Active ?? DBNull.Value;

        var affected = await cmd.ExecuteNonQueryAsync(ct);
        if (affected == 0) return null;
        var areas = await GetAreasAsync(true, ct);
        return areas.FirstOrDefault(a => a.Id == id);
    }

    public async Task<bool> SetAreaActiveAsync(int id, bool active, CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand("UPDATE areas SET a_activo = @act WHERE id_area = @id", db);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("act", active);
        return await cmd.ExecuteNonQueryAsync(ct) > 0;
    }

    public async Task<IReadOnlyList<RoleOptionDto>> GetRolesAsync(CancellationToken ct)
    {
        await using var db = await Open(ct);
        await using var cmd = new NpgsqlCommand("SELECT id_rol, r_nombre FROM rol WHERE r_activo ORDER BY id_rol", db);
        var list = new List<RoleOptionDto>();
        await using var rd = await cmd.ExecuteReaderAsync(ct);
        while (await rd.ReadAsync(ct))
            list.Add(new RoleOptionDto(rd.GetInt32(0), rd.GetString(1)));
        return list;
    }
}
