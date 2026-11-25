using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using sistema_de_reportes_de_incindencias.Models;

namespace sistema_de_reportes_de_incindencias.Data;

public partial class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public virtual DbSet<Area> Areas { get; set; }

    public virtual DbSet<Auditorium> Auditoria { get; set; }

    public virtual DbSet<Categoria> Categorias { get; set; }

    public virtual DbSet<Edificio> Edificios { get; set; }

    public virtual DbSet<Fotografia> Fotografias { get; set; }

    public virtual DbSet<HistorialEstado> HistorialEstados { get; set; }

    public virtual DbSet<Incidencia> Incidencias { get; set; }

    public virtual DbSet<Rol> Rols { get; set; }

    public virtual DbSet<Ubicacione> Ubicaciones { get; set; }

    public virtual DbSet<Usuario> Usuarios { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Area>(entity =>
        {
            entity.HasKey(e => e.IdArea).HasName("areas_pkey");

            entity.ToTable("areas");

            entity.HasIndex(e => e.ANombre, "areas_a_nombre_key").IsUnique();

            entity.Property(e => e.IdArea).HasColumnName("id_area");
            entity.Property(e => e.AActivo)
                .HasDefaultValue(true)
                .HasColumnName("a_activo");
            entity.Property(e => e.AEsResponsable).HasColumnName("a_es_responsable");
            entity.Property(e => e.ANombre)
                .HasMaxLength(100)
                .HasColumnName("a_nombre");
            entity.Property(e => e.ATipo)
                .HasMaxLength(50)
                .HasColumnName("a_tipo");
        });

        modelBuilder.Entity<Auditorium>(entity =>
        {
            entity.HasKey(e => e.IdAuditoria).HasName("auditoria_pkey");

            entity.ToTable("auditoria");

            entity.Property(e => e.IdAuditoria).HasColumnName("id_auditoria");
            entity.Property(e => e.AuAccion)
                .HasMaxLength(20)
                .HasColumnName("au_accion");
            entity.Property(e => e.AuFechaHora)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("au_fecha_hora");
            entity.Property(e => e.AuIdRegistro).HasColumnName("au_id_registro");
            entity.Property(e => e.AuOrigen)
                .HasMaxLength(20)
                .HasColumnName("au_origen");
            entity.Property(e => e.AuTabla)
                .HasMaxLength(50)
                .HasColumnName("au_tabla");
            entity.Property(e => e.AuValorAnterior).HasColumnName("au_valor_anterior");
            entity.Property(e => e.AuValorNuevo).HasColumnName("au_valor_nuevo");
            entity.Property(e => e.IdUsuario).HasColumnName("id_usuario");

            entity.HasOne(d => d.IdUsuarioNavigation).WithMany(p => p.Auditoria)
                .HasForeignKey(d => d.IdUsuario)
                .HasConstraintName("auditoria_id_usuario_fkey");
        });

        modelBuilder.Entity<Categoria>(entity =>
        {
            entity.HasKey(e => e.IdCategoria).HasName("categorias_pkey");

            entity.ToTable("categorias");

            entity.HasIndex(e => e.CNombre, "categorias_c_nombre_key").IsUnique();

            entity.Property(e => e.IdCategoria).HasColumnName("id_categoria");
            entity.Property(e => e.CActivo)
                .HasDefaultValue(true)
                .HasColumnName("c_activo");
            entity.Property(e => e.CDescripcion)
                .HasMaxLength(200)
                .HasColumnName("c_descripcion");
            entity.Property(e => e.CNombre)
                .HasMaxLength(100)
                .HasColumnName("c_nombre");
            entity.Property(e => e.IdArea).HasColumnName("id_area");

            entity.HasOne(d => d.IdAreaNavigation).WithMany(p => p.Categoria)
                .HasForeignKey(d => d.IdArea)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("categorias_id_area_fkey");
        });

        modelBuilder.Entity<Edificio>(entity =>
        {
            entity.HasKey(e => e.IdEdificio).HasName("edificios_pkey");

            entity.ToTable("edificios");

            entity.HasIndex(e => e.ENombre, "edificios_e_nombre_key").IsUnique();

            entity.Property(e => e.IdEdificio).HasColumnName("id_edificio");
            entity.Property(e => e.EActivo)
                .HasDefaultValue(true)
                .HasColumnName("e_activo");
            entity.Property(e => e.ENombre)
                .HasMaxLength(200)
                .HasColumnName("e_nombre");
        });

        modelBuilder.Entity<Fotografia>(entity =>
        {
            entity.HasKey(e => e.IdFoto).HasName("fotografias_pkey");

            entity.ToTable("fotografias");

            entity.HasIndex(e => new { e.IdIncidencia, e.FOrden }, "uq_foto_incidencia_orden").IsUnique();

            entity.Property(e => e.IdFoto).HasColumnName("id_foto");
            entity.Property(e => e.FArchivo)
                .HasMaxLength(250)
                .HasColumnName("f_archivo");
            entity.Property(e => e.FOrden).HasColumnName("f_orden");
            entity.Property(e => e.FTamanoBytes).HasColumnName("f_tamano_bytes");
            entity.Property(e => e.FTipo)
                .HasMaxLength(20)
                .HasColumnName("f_tipo");
            entity.Property(e => e.IdIncidencia).HasColumnName("id_incidencia");

            entity.HasOne(d => d.IdIncidenciaNavigation).WithMany(p => p.Fotografia)
                .HasForeignKey(d => d.IdIncidencia)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fotografias_id_incidencia_fkey");
        });

        modelBuilder.Entity<HistorialEstado>(entity =>
        {
            entity.HasKey(e => e.IdHistorial).HasName("historial_estados_pkey");

            entity.ToTable("historial_estados");

            entity.HasIndex(e => e.IdIncidencia, "idx_historial_incidencia");

            entity.Property(e => e.IdHistorial).HasColumnName("id_historial");
            entity.Property(e => e.HeEstado)
                .HasMaxLength(50)
                .HasColumnName("he_estado");
            entity.Property(e => e.HeFechaHora)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("he_fecha_hora");
            entity.Property(e => e.HeObservacion).HasColumnName("he_observacion");
            entity.Property(e => e.IdIncidencia).HasColumnName("id_incidencia");
            entity.Property(e => e.IdUsuarioEncargado).HasColumnName("id_usuario_encargado");

            entity.HasOne(d => d.IdIncidenciaNavigation).WithMany(p => p.HistorialEstados)
                .HasForeignKey(d => d.IdIncidencia)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("historial_estados_id_incidencia_fkey");

            entity.HasOne(d => d.IdUsuarioEncargadoNavigation).WithMany(p => p.HistorialEstados)
                .HasForeignKey(d => d.IdUsuarioEncargado)
                .HasConstraintName("historial_estados_id_usuario_encargado_fkey");
        });

        modelBuilder.Entity<Incidencia>(entity =>
        {
            entity.HasKey(e => e.IdIncidencia).HasName("incidencias_pkey");

            entity.ToTable("incidencias");

            entity.HasIndex(e => e.IdCategoria, "idx_incidencias_categoria");

            entity.HasIndex(e => e.IEstadoActual, "idx_incidencias_estado");

            entity.HasIndex(e => e.IdUbicacion, "idx_incidencias_ubicacion");

            entity.HasIndex(e => e.ICodigoSeguimiento, "incidencias_i_codigo_seguimiento_key").IsUnique();

            entity.Property(e => e.IdIncidencia).HasColumnName("id_incidencia");
            entity.Property(e => e.ICodigoSeguimiento)
                .HasMaxLength(15)
                .HasDefaultValueSql("fn_generar_codigo_seguimiento()")
                .HasColumnName("i_codigo_seguimiento");
            entity.Property(e => e.IDescripcion).HasColumnName("i_descripcion");
            entity.Property(e => e.IEstadoActual)
                .HasMaxLength(50)
                .HasDefaultValueSql("'Recibido'::character varying")
                .HasColumnName("i_estado_actual");
            entity.Property(e => e.IFechaActualizacion)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("i_fecha_actualizacion");
            entity.Property(e => e.IFechaCierre)
                .HasColumnType("timestamp without time zone")
                .HasColumnName("i_fecha_cierre");
            entity.Property(e => e.IFechaCreacion)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("i_fecha_creacion");
            entity.Property(e => e.IModalidadOrigen)
                .HasMaxLength(20)
                .HasColumnName("i_modalidad_origen");
            entity.Property(e => e.IPrioridad)
                .HasMaxLength(10)
                .HasColumnName("i_prioridad");
            entity.Property(e => e.IReportanteNombre)
                .HasMaxLength(100)
                .HasColumnName("i_reportante_nombre");
            entity.Property(e => e.IReportanteVinculo)
                .HasMaxLength(50)
                .HasColumnName("i_reportante_vinculo");
            entity.Property(e => e.IUrgencia)
                .HasMaxLength(10)
                .HasColumnName("i_urgencia");
            entity.Property(e => e.IdAreaSolicitante).HasColumnName("id_area_solicitante");
            entity.Property(e => e.IdCategoria).HasColumnName("id_categoria");
            entity.Property(e => e.IdUbicacion).HasColumnName("id_ubicacion");
            entity.Property(e => e.IdUsuario).HasColumnName("id_usuario");

            entity.HasOne(d => d.IdAreaSolicitanteNavigation).WithMany(p => p.Incidencia)
                .HasForeignKey(d => d.IdAreaSolicitante)
                .HasConstraintName("incidencias_id_area_solicitante_fkey");

            entity.HasOne(d => d.IdCategoriaNavigation).WithMany(p => p.Incidencia)
                .HasForeignKey(d => d.IdCategoria)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("incidencias_id_categoria_fkey");

            entity.HasOne(d => d.IdUbicacionNavigation).WithMany(p => p.Incidencia)
                .HasForeignKey(d => d.IdUbicacion)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("incidencias_id_ubicacion_fkey");

            entity.HasOne(d => d.IdUsuarioNavigation).WithMany(p => p.Incidencia)
                .HasForeignKey(d => d.IdUsuario)
                .HasConstraintName("incidencias_id_usuario_fkey");
        });

        modelBuilder.Entity<Rol>(entity =>
        {
            entity.HasKey(e => e.IdRol).HasName("rol_pkey");

            entity.ToTable("rol");

            entity.HasIndex(e => e.RNombre, "rol_r_nombre_key").IsUnique();

            entity.Property(e => e.IdRol).HasColumnName("id_rol");
            entity.Property(e => e.RActivo)
                .HasDefaultValue(true)
                .HasColumnName("r_activo");
            entity.Property(e => e.RDescripcion)
                .HasMaxLength(200)
                .HasColumnName("r_descripcion");
            entity.Property(e => e.RNombre)
                .HasMaxLength(50)
                .HasColumnName("r_nombre");
        });

        modelBuilder.Entity<Ubicacione>(entity =>
        {
            entity.HasKey(e => e.IdUbicacion).HasName("ubicaciones_pkey");

            entity.ToTable("ubicaciones");

            entity.Property(e => e.IdUbicacion).HasColumnName("id_ubicacion");
            entity.Property(e => e.IdEdificio).HasColumnName("id_edificio");
            entity.Property(e => e.UbActivo)
                .HasDefaultValue(true)
                .HasColumnName("ub_activo");
            entity.Property(e => e.UbNombre)
                .HasMaxLength(100)
                .HasColumnName("ub_nombre");
            entity.Property(e => e.UbTipo)
                .HasMaxLength(50)
                .HasColumnName("ub_tipo");

            entity.HasOne(d => d.IdEdificioNavigation).WithMany(p => p.Ubicaciones)
                .HasForeignKey(d => d.IdEdificio)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("ubicaciones_id_edificio_fkey");
        });

        modelBuilder.Entity<Usuario>(entity =>
        {
            entity.HasKey(e => e.IdUsuario).HasName("usuarios_pkey");

            entity.ToTable("usuarios");

            entity.HasIndex(e => e.UCorreo, "usuarios_u_correo_key").IsUnique();

            entity.Property(e => e.IdUsuario).HasColumnName("id_usuario");
            entity.Property(e => e.IdArea).HasColumnName("id_area");
            entity.Property(e => e.IdRol).HasColumnName("id_rol");
            entity.Property(e => e.UActivo)
                .HasDefaultValue(true)
                .HasColumnName("u_activo");
            entity.Property(e => e.UCorreo)
                .HasMaxLength(150)
                .HasColumnName("u_correo");
            entity.Property(e => e.UCorreoVerificado).HasColumnName("u_correo_verificado");
            entity.Property(e => e.UFechaRegistro)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("u_fecha_registro");
            entity.Property(e => e.UNombre)
                .HasMaxLength(100)
                .HasColumnName("u_nombre");
            entity.Property(e => e.UPassword)
                .HasMaxLength(255)
                .HasColumnName("u_password");
            entity.Property(e => e.UVinculo)
                .HasMaxLength(100)
                .HasColumnName("u_vinculo");

            entity.HasOne(d => d.IdAreaNavigation).WithMany(p => p.Usuarios)
                .HasForeignKey(d => d.IdArea)
                .HasConstraintName("usuarios_id_area_fkey");

            entity.HasOne(d => d.IdRolNavigation).WithMany(p => p.Usuarios)
                .HasForeignKey(d => d.IdRol)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("usuarios_id_rol_fkey");
        });
        modelBuilder.HasSequence("seq_codigo_seguimiento");

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
