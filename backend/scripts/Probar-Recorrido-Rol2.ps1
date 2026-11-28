<#
.SYNOPSIS
Prueba de extremo a extremo del recorrido del Rol 2 contra la API en ejecución.

.DESCRIPTION
Ejecuta 7 pasos contra http://localhost:5080 (Windows PowerShell 5.1, base de pruebas con schema.sql y seed.sql):
login interactivo, registro anónimo, duplicados, bloqueo 403 entre unidades, panel RF-13, cambio de estado con 409 y cierre.
Nota: el caso de "Electricidad" (Mantenimiento) del paso 4 queda abierto en la base de pruebas.
#>
[CmdletBinding()]
param(
    [string]$BaseUrl = 'http://localhost:5080',
    [string]$Username = 'tecnico.dev@local.test'
)

$ErrorActionPreference = 'Stop'

# Detiene el script con el mensaje indicado si la condición no se cumple.
function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

# Llama a la API y devuelve siempre Status y Data, también en respuestas 4xx/5xx, para poder verificar códigos de error esperados.
# Solo relanza la excepción si no hubo respuesta HTTP (por ejemplo, la API no está levantada).
function Invoke-ApiRequest {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        [AllowNull()][object]$Body = $null,
        [AllowNull()][string]$Token = $null
    )

    $headers = @{}
    if (-not [string]::IsNullOrEmpty($Token)) {
        $headers['Authorization'] = "Bearer $Token"
    }

    $requestArgs = @{
        Uri = "$($BaseUrl.TrimEnd('/'))$Path"
        Method = $Method
        Headers = $headers
        UseBasicParsing = $true
        ErrorAction = 'Stop'
    }
    if ($null -ne $Body) {
        $requestArgs['ContentType'] = 'application/json; charset=utf-8'
        $requestArgs['Body'] = ConvertTo-Json -InputObject $Body -Depth 8 -Compress
    }

    try {
        $response = Invoke-WebRequest @requestArgs
        $status = [int]$response.StatusCode
        $content = [string]$response.Content
    }
    catch {
        $webResponse = $_.Exception.Response
        if ($null -eq $webResponse) { throw }

        $status = [int]$webResponse.StatusCode
        $content = ''
        $responseStream = $webResponse.GetResponseStream()
        if ($null -ne $responseStream) {
            $reader = New-Object System.IO.StreamReader($responseStream)
            try { $content = $reader.ReadToEnd() }
            finally { $reader.Dispose() }
        }
    }

    $data = $null
    if (-not [string]::IsNullOrWhiteSpace($content)) {
        $data = ConvertFrom-Json -InputObject $content
    }
    return [pscustomobject]@{ Status = $status; Data = $data }
}

# Verifica que una respuesta JSON NO contenga campos privados o internos prohibidos.
function Assert-NoFields {
    param([object]$Object, [string[]]$Fields, [string]$Context)
    $names = @($Object.PSObject.Properties.Name)
    foreach ($field in $Fields) {
        Assert-Condition (-not ($names -contains $field)) "$Context expuso el campo '$field'."
    }
}

# Lleva un caso abierto de la prueba a Resuelto: Recibido -> En proceso -> Resuelto.
function Close-TestIncident {
    param([string]$Code, [string]$Token)
    for ($i = 0; $i -lt 4; $i++) {
        $current = Invoke-ApiRequest -Method 'GET' -Path "/api/incidencias/$Code" -Token $Token
        Assert-Condition ($current.Status -eq 200) "No se pudo abrir $Code para cerrarlo: HTTP $($current.Status)."
        if ($current.Data.state -eq 'Resuelto') { return $current.Data }

        if ($current.Data.state -eq 'Recibido') { $next = 'En proceso' }
        elseif ($current.Data.state -eq 'En proceso') { $next = 'Resuelto' }
        else { throw "El caso $Code está en el estado '$($current.Data.state)' y el script no lo cierra." }

        $priority = [string]$current.Data.priority
        if ([string]::IsNullOrWhiteSpace($priority)) { $priority = 'Media' }
        $step = Invoke-ApiRequest -Method 'PUT' -Path "/api/incidencias/$Code" -Token $Token -Body @{
            state = $next
            priority = $priority
            note = 'Cierre de la prueba automatizada del recorrido Rol 2.'
            version = $current.Data.version
        }
        Assert-Condition ($step.Status -eq 200) "No se pudo pasar $Code a '$next': HTTP $($step.Status)."
    }
    throw "No se pudo cerrar el caso $Code en cuatro intentos."
}

# --- Datos base y listas de campos prohibidos para las pruebas de privacidad
$testDescription = 'La puerta del aula requiere revisión técnica.'
$testDescriptionPrefix = 'La puerta del aula requiere*'
$changeNote = 'Inspección inicial del área técnica.'
$personalFields = @('reporterName', 'reporterLink', 'ownerId', 'reporterEmail', 'email', 'phone', 'userId')
$internalFields = @('description', 'reference', 'version', 'priority', 'responsibleUnit', 'note')
# "Edificios" se enruta a Desarrollo Físico, la unidad del técnico de la prueba (regla provisional por categoría, depende del seed).
$newReport = @{
    category = 'Edificios'
    location = 'Edificio de Prueba - Aula 1'
    description = $testDescription
    reference = 'Prueba automatizada Rol 2'
}

# --- Paso 1: Solicita credenciales de forma oculta, inicia sesión y valida el token
Write-Host '1. Solicita la contraseña técnica sin mostrarla e inicia sesión.'
$securePassword = Read-Host 'Contraseña del usuario técnico (tecnico.dev@local.test)' -AsSecureString
if ($null -eq $securePassword -or $securePassword.Length -eq 0) {
    throw 'La contraseña no puede estar vacía.'
}
$passwordPointer = [IntPtr]::Zero
$password = $null
# La contraseña pasa a texto solo el tiempo necesario para armar el JSON del login; el bloque finally la borra de memoria.
try {
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $login = Invoke-ApiRequest -Method 'POST' -Path '/api/sesiones' -Body @{
        username = $Username
        password = $password
    }
}
finally {
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
    $password = $null
    $securePassword.Dispose()
}
Assert-Condition ($login.Status -eq 200) "El inicio de sesión devolvió HTTP $($login.Status)."
$token = [string]$login.Data.token
Assert-Condition (-not [string]::IsNullOrWhiteSpace($token)) 'El inicio de sesión no devolvió token.'
# Los pasos 2, 4 y 5 dependen de que el usuario sea de Desarrollo Físico; con otro perfil el script se detiene aquí.
Assert-Condition ($login.Data.profile -eq 'Desarrollo Físico') "El usuario del seed debe pertenecer a Desarrollo Físico; obtuvo '$($login.Data.profile)'."
$current = Invoke-ApiRequest -Method 'GET' -Path '/api/sesiones/actual' -Token $token
Assert-Condition ($current.Status -eq 200) 'La consulta de sesión debe responder 200.'

# --- Paso 2: Registra incidencia (si había residuo de prueba anterior lo cierra y reintenta) y valida seguimiento anónimo
Write-Host '2. Registra una incidencia (retira residuos de corridas anteriores) y comprueba el seguimiento público.'
$created = Invoke-ApiRequest -Method 'POST' -Path '/api/incidencias' -Body $newReport
Assert-Condition ($created.Status -eq 201) "El registro devolvió HTTP $($created.Status)."
# Un caso abierto con la misma categoría y ubicación hace que el registro vuelva como duplicado.
# Solo se cierra si su descripción es la de la prueba, para no tocar un caso real.
if ($created.Data.isDuplicate) {
    $residueCode = [string]$created.Data.code
    $residue = Invoke-ApiRequest -Method 'GET' -Path "/api/incidencias/$residueCode" -Token $token
    Assert-Condition ($residue.Status -eq 200) "El caso abierto $residueCode bloquea la prueba y el técnico no puede abrirlo (HTTP $($residue.Status))."
    Assert-Condition ($residue.Data.description -like $testDescriptionPrefix) "El caso abierto $residueCode tiene la misma categoría y ubicación pero no es de la prueba. El script se detiene para no cerrarlo."
    Write-Host "   Cierra el residuo $residueCode de una corrida anterior."
    $null = Close-TestIncident -Code $residueCode -Token $token
    $created = Invoke-ApiRequest -Method 'POST' -Path '/api/incidencias' -Body $newReport
    Assert-Condition ($created.Status -eq 201) "El segundo registro devolvió HTTP $($created.Status)."
}
Assert-Condition (-not $created.Data.isDuplicate) 'El registro sigue devolviendo un duplicado después de cerrar el residuo.'
$code = [string]$created.Data.code
Assert-Condition (-not [string]::IsNullOrWhiteSpace($code)) 'El registro no devolvió código de seguimiento.'
# El registro anónimo (sin sesión) y no duplicado recibe el token temporal para subir fotos; esta prueba solo verifica que exista.
Assert-Condition (-not [string]::IsNullOrWhiteSpace([string]$created.Data.photoUploadToken)) 'El registro sin sesión debe devolver el token temporal de foto.'

# Comprueba que el seguimiento público inicial no filtre datos privados y que rutas internas exijan sesión (401)
$tracked = Invoke-ApiRequest -Method 'GET' -Path "/api/seguimiento/$code"
Assert-Condition ($tracked.Status -eq 200) 'El seguimiento anónimo debe responder 200.'
Assert-Condition ($tracked.Data.code -eq $code) 'El código de seguimiento no coincide.'
Assert-NoFields -Object $tracked.Data -Fields ($personalFields + $internalFields) -Context 'El seguimiento'
$firstEvent = @($tracked.Data.history)
Assert-Condition ($firstEvent.Count -eq 1 -and $firstEvent[0].note -eq 'Reporte recibido.') 'El seguimiento inicial debe mostrar un único evento "Reporte recibido.".'
$anonymousList = Invoke-ApiRequest -Method 'GET' -Path '/api/incidencias'
Assert-Condition ($anonymousList.Status -eq 401) 'El listado anónimo debe responder 401.'
$anonymousPanel = Invoke-ApiRequest -Method 'GET' -Path '/api/incidencias/panel'
Assert-Condition ($anonymousPanel.Status -eq 401) 'El panel anónimo debe responder 401.'
Write-Host "   Correcto: incidencia $code, seguimiento sin datos personales, listado y panel anónimos 401."

# --- Paso 3: Comprueba que un duplicado no devuelva token ni datos privados, y valida el listado público resumido
Write-Host '3. Comprueba la respuesta de duplicado y el resumen público.'
# Mismo registro que el paso 2, con el caso anterior aún abierto: debe volver como duplicado.
$dup = Invoke-ApiRequest -Method 'POST' -Path '/api/incidencias' -Body $newReport
# La API responde 201 también en duplicados, aunque no se crea ningún registro nuevo.
Assert-Condition ($dup.Status -eq 201) "El duplicado devolvió HTTP $($dup.Status)."
Assert-Condition ($dup.Data.isDuplicate -eq $true) 'El segundo registro con la misma categoría y ubicación debe marcarse como duplicado.'
Assert-Condition ($dup.Data.code -eq $code) 'El duplicado debe devolver el código del caso existente.'
# Un duplicado apunta al reporte de otra persona, por eso no debe traer token de fotos.
Assert-NoFields -Object $dup.Data -Fields ($personalFields + $internalFields + @('photoUploadToken', 'history')) -Context 'La respuesta de duplicado'

$public = Invoke-ApiRequest -Method 'GET' -Path '/api/incidencias/publicas?category=Edificios&state=Recibido'
Assert-Condition ($public.Status -eq 200) "El listado público devolvió HTTP $($public.Status)."
$publicItem = @($public.Data | Where-Object { $_.code -eq $code })
Assert-Condition ($publicItem.Count -eq 1) 'El listado público no incluyó el reporte recién registrado.'
Assert-NoFields -Object $publicItem[0] -Fields ($personalFields + $internalFields + @('history')) -Context 'El resumen público'
Write-Host '   Correcto: duplicado sin datos privados ni token, y resumen público sin descripción ni identidad.'

# --- Paso 4: Crea un caso de Mantenimiento y verifica que Desarrollo Físico reciba 403 al abrirlo o editarlo
Write-Host '4. Comprueba permisos sobre un caso de otra unidad.'
# "Electricidad" se enruta a Mantenimiento (regla provisional por categoría, depende del seed).
# Este caso queda abierto tras la corrida: la sesión de Desarrollo Físico no puede cerrarlo, y las corridas siguientes lo reciben como duplicado.
$outOfScope = Invoke-ApiRequest -Method 'POST' -Path '/api/incidencias' -Body @{
    category = 'Electricidad'
    location = 'Edificio de Prueba - Aula 1'
    description = 'Reporte válido fuera del ámbito de Desarrollo Físico.'
    reference = 'Prueba 403'
}
Assert-Condition ($outOfScope.Status -eq 201) "No se pudo crear la incidencia válida fuera de ámbito: HTTP $($outOfScope.Status)."
$foreignCode = [string]$outOfScope.Data.code
$forbidden = Invoke-ApiRequest -Method 'GET' -Path "/api/incidencias/$foreignCode" -Token $token
Assert-Condition ($forbidden.Status -eq 403) "El expediente de Mantenimiento debe responder 403; obtuvo $($forbidden.Status)."
# Versión -1: si el servidor permitiera editar, daría 409 y nunca modificaría el caso ajeno.
$foreignChange = Invoke-ApiRequest -Method 'PUT' -Path "/api/incidencias/$foreignCode" -Token $token -Body @{
    state = 'En proceso'
    priority = 'Alta'
    note = 'Intento de cambio sobre un caso ajeno.'
    version = -1
}
Assert-Condition ($foreignChange.Status -eq 403) "El cambio sobre un caso de otra unidad debe responder 403; obtuvo $($foreignChange.Status)."

# --- Paso 5: Valida el panel centralizado RF-13 (ve casos propios y ajenos sin datos privados) y los filtros de fecha
Write-Host '5. Comprueba el panel centralizado (RF-13), filtros por fecha y rango inválido.'
$panel = Invoke-ApiRequest -Method 'GET' -Path '/api/incidencias/panel' -Token $token
Assert-Condition ($panel.Status -eq 200) "El panel devolvió HTTP $($panel.Status)."
$ownItem = @($panel.Data | Where-Object { $_.code -eq $code })
$foreignItem = @($panel.Data | Where-Object { $_.code -eq $foreignCode })
Assert-Condition ($ownItem.Count -eq 1) 'El panel no incluyó el caso propio.'
# RF-13: el panel lista también casos de otra unidad, aunque el paso 4 confirmó que no se pueden abrir ni editar (D-01).
Assert-Condition ($foreignItem.Count -eq 1) 'El panel no incluyó el caso de la otra unidad.'
Assert-Condition ($foreignItem[0].responsibleUnit -ne $login.Data.profile) 'El caso ajeno del panel no debería pertenecer a la unidad del técnico.'
foreach ($field in @('code', 'created', 'category', 'location', 'priority', 'state', 'responsibleUnit')) {
    Assert-Condition (@($foreignItem[0].PSObject.Properties.Name) -contains $field) "El resumen del panel no incluye '$field'."
}
Assert-NoFields -Object $foreignItem[0] -Fields ($personalFields + @('description', 'reference', 'history', 'version', 'note')) -Context 'El panel'
$badPanel = Invoke-ApiRequest -Method 'GET' -Path '/api/incidencias/panel?from=no-es-fecha' -Token $token
Assert-Condition ($badPanel.Status -eq 400) "El panel con fecha inválida debe responder 400; obtuvo $($badPanel.Status)."

# La fecha se calcula en la zona horaria de esta máquina; la API interpreta from/to como días de El Salvador (UTC-6).
# Con from y to iguales el filtro abarca ese día completo (to es inclusivo).
$incidentDateValue = ([DateTimeOffset]::Parse([string]$created.Data.created)).ToLocalTime().Date
$incidentDate = $incidentDateValue.ToString('yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
$filterPath = '/api/incidencias?category=Edificios&location=Edificio%20de%20Prueba%20-%20Aula%201&from={0}&to={0}' -f $incidentDate
$filtered = Invoke-ApiRequest -Method 'GET' -Path $filterPath -Token $token
Assert-Condition ($filtered.Status -eq 200) "El listado con filtros de fecha devolvió HTTP $($filtered.Status)."
$filteredIncident = @($filtered.Data | Where-Object { $_.code -eq $code })
Assert-Condition ($filteredIncident.Count -eq 1) 'El filtro por categoría, ubicación y fecha no incluyó el reporte recién registrado.'
$reversedPath = '/api/incidencias?from={0}&to={1}' -f $incidentDateValue.AddDays(1).ToString('yyyy-MM-dd'), $incidentDate
$reversed = Invoke-ApiRequest -Method 'GET' -Path $reversedPath -Token $token
Assert-Condition ($reversed.Status -eq 400) "El rango de fechas invertido debe responder 400; obtuvo $($reversed.Status)."

# --- Paso 6: Abre expediente propio, cambia estado/prioridad, verifica observación técnica pública (RF-10) y conflicto 409
Write-Host '6. Comprueba expediente, historial, cambio de estado, observación pública (RF-10) y conflicto de versión.'
$detail = Invoke-ApiRequest -Method 'GET' -Path "/api/incidencias/$code" -Token $token
Assert-Condition ($detail.Status -eq 200) "El expediente autorizado devolvió HTTP $($detail.Status)."
$initialEvents = @($detail.Data.history | Where-Object { $_.state -eq 'Recibido' })
Assert-Condition (@($detail.Data.history).Count -eq 1 -and $initialEvents.Count -eq 1) 'El historial inicial debe contener un único evento Recibido.'
$changeBody = @{
    state = 'En proceso'
    priority = 'Alta'
    note = $changeNote
    version = $detail.Data.version
}
$change = Invoke-ApiRequest -Method 'PUT' -Path "/api/incidencias/$code" -Body $changeBody -Token $token
Assert-Condition ($change.Status -eq 200) "El cambio de estado devolvió HTTP $($change.Status)."
$updatedEvents = @($change.Data.history | Where-Object { $_.state -eq 'Recibido' })
Assert-Condition ($updatedEvents.Count -eq 1 -and @($change.Data.history).Count -eq 2) 'El cambio duplicó el evento inicial o no agregó un único evento de historial.'
Assert-Condition ($change.Data.state -eq 'En proceso') 'El estado no quedó actualizado a En proceso.'

# RF-10: el seguimiento público muestra la observación técnica del cambio, sin los campos privados.
$trackedAfter = Invoke-ApiRequest -Method 'GET' -Path "/api/seguimiento/$code"
Assert-Condition ($trackedAfter.Status -eq 200) 'El seguimiento tras el cambio debe responder 200.'
$publicEvent = @($trackedAfter.Data.history | Where-Object { $_.state -eq 'En proceso' })
Assert-Condition ($publicEvent.Count -eq 1) 'El seguimiento público debe mostrar un único evento En proceso.'
Assert-Condition ($publicEvent[0].note -eq $changeNote) 'El seguimiento público no muestra la observación técnica del cambio (RF-10).'
Assert-NoFields -Object $trackedAfter.Data -Fields ($personalFields + $internalFields) -Context 'El seguimiento tras el cambio'

# Reenvía el mismo cuerpo con la versión anterior: el expediente ya avanzó, así que debe haber conflicto de concurrencia.
$stale = Invoke-ApiRequest -Method 'PUT' -Path "/api/incidencias/$code" -Body $changeBody -Token $token
Assert-Condition ($stale.Status -eq 409) "La versión obsoleta debe responder 409; obtuvo $($stale.Status)."

# --- Paso 7: Lleva el caso de prueba a 'Resuelto' para no bloquear futuras corridas y cierra la sesión
Write-Host '7. Cierra el caso de la prueba y la sesión.'
# Solo se cierra el caso propio; el de Mantenimiento del paso 4 queda abierto (ver .DESCRIPTION).
$closed = Close-TestIncident -Code $code -Token $token
Assert-Condition ($closed.state -eq 'Resuelto') 'El caso de la prueba no quedó Resuelto.'
$trackedClosed = Invoke-ApiRequest -Method 'GET' -Path "/api/seguimiento/$code"
Assert-Condition ($trackedClosed.Data.state -eq 'Resuelto') 'El seguimiento público no muestra el caso Resuelto.'

# Tras cerrar la sesión, el mismo token debe dejar de ser válido.
$ended = Invoke-ApiRequest -Method 'DELETE' -Path '/api/sesiones/actual' -Token $token
Assert-Condition ($ended.Status -eq 204) "El cierre de sesión debe responder 204; obtuvo $($ended.Status)."
$expired = Invoke-ApiRequest -Method 'GET' -Path '/api/sesiones/actual' -Token $token
Assert-Condition ($expired.Status -eq 401) 'La sesión cerrada debe responder 401.'
Write-Host 'Correcto: recorrido Rol 2 contra la API completado.'