using System;
using System.Collections.Generic;

namespace sistema_de_reportes_de_incindencias.Models;

public partial class Fotografia
{
    public int IdFoto { get; set; }

    public int IdIncidencia { get; set; }

    public int FOrden { get; set; }

    public string FArchivo { get; set; } = null!;

    public string FTipo { get; set; } = null!;

    public int FTamanoBytes { get; set; }

    public virtual Incidencia IdIncidenciaNavigation { get; set; } = null!;
}
