[CmdletBinding()]
param(
    [string]$BaseUrl = 'http://localhost:5080',
    [string]$Username = 'tecnico.dev@local.test'
)

$ErrorActionPreference = 'Stop'

function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

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

Write-Host '1. Registra una incidencia y comprueba el seguimiento público.'
$created = Invoke-ApiRequest -Method 'POST' -Path '/api/incidencias' -Body @{
    category = 'Edificios'
    location = 'Edificio de Prueba - Aula 1'
    description = 'La puerta del aula requiere revisión técnica.'
    reference = 'Prueba automatizada Rol 2'
}
Assert-Condition ($created.Status -eq 201) "El registro devolvió HTTP $($created.Status)."
$code = [string]$created.Data.code
Assert-Condition (-not [string]::IsNullOrWhiteSpace($code)) 'El registro no devolvió código de seguimiento.'

$tracked = Invoke-ApiRequest -Method 'GET' -Path "/api/seguimiento/$code"
Assert-Condition ($tracked.Status -eq 200) 'El seguimiento anónimo debe responder 200.'
Assert-Condition ($tracked.Data.code -eq $code) 'El código de seguimiento no coincide.'
foreach ($personalField in @('reporterName', 'ownerId', 'reporterEmail', 'email', 'phone', 'userId')) {
    Assert-Condition (-not ($tracked.Data.PSObject.Properties.Name -contains $personalField)) "El seguimiento expuso el campo personal '$personalField'."
}
$anonymousPanel = Invoke-ApiRequest -Method 'GET' -Path '/api/incidencias'
Assert-Condition ($anonymousPanel.Status -eq 401) 'El panel anónimo debe responder 401.'
Write-Host "   Correcto: incidencia $code, seguimiento público sin datos personales y panel anónimo 401."

Write-Host '2. Solicita la contraseña técnica sin mostrarla y prueba autenticación y permisos.'
$securePassword = Read-Host 'Contraseña del usuario técnico (tecnico.dev@local.test)' -AsSecureString
if ($null -eq $securePassword -or $securePassword.Length -eq 0) {
    throw 'La contraseña no puede estar vacía.'
}
$passwordPointer = [IntPtr]::Zero
$password = $null
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
Assert-Condition ($login.Data.profile -eq 'Desarrollo Físico') "El usuario del seed debe pertenecer a Desarrollo Físico; obtuvo '$($login.Data.profile)'."

$outOfScope = Invoke-ApiRequest -Method 'POST' -Path '/api/incidencias' -Body @{
    category = 'Electricidad'
    location = 'Edificio de Prueba - Aula 1'
    description = 'Reporte válido fuera del ámbito de Desarrollo Físico.'
    reference = 'Prueba 403'
}
Assert-Condition ($outOfScope.Status -eq 201) "No se pudo crear la incidencia válida fuera de ámbito: HTTP $($outOfScope.Status)."
$forbidden = Invoke-ApiRequest -Method 'GET' -Path "/api/incidencias/$($outOfScope.Data.code)" -Token $token
Assert-Condition ($forbidden.Status -eq 403) "El expediente de Mantenimiento debe responder 403; obtuvo $($forbidden.Status)."
$current = Invoke-ApiRequest -Method 'GET' -Path '/api/sesiones/actual' -Token $token
Assert-Condition ($current.Status -eq 200) 'La consulta de sesión debe responder 200.'

Write-Host '3. Comprueba el panel, filtros por fecha y rango invertido.'
$incidentDateValue = ([DateTimeOffset]::Parse([string]$created.Data.created)).ToLocalTime().Date
$incidentDate = $incidentDateValue.ToString('yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
$filterPath = '/api/incidencias?category=Edificios&location=Edificio%20de%20Prueba%20-%20Aula%201&from={0}&to={0}' -f $incidentDate
$filtered = Invoke-ApiRequest -Method 'GET' -Path $filterPath -Token $token
Assert-Condition ($filtered.Status -eq 200) "El panel con filtros de fecha devolvió HTTP $($filtered.Status)."
$filteredIncident = @($filtered.Data | Where-Object { $_.code -eq $code })
Assert-Condition ($filteredIncident.Count -eq 1) 'El filtro por categoría, ubicación y fecha no incluyó el reporte recién registrado.'
$reversedPath = '/api/incidencias?from={0}&to={1}' -f $incidentDateValue.AddDays(1).ToString('yyyy-MM-dd'), $incidentDate
$reversed = Invoke-ApiRequest -Method 'GET' -Path $reversedPath -Token $token
Assert-Condition ($reversed.Status -eq 400) "El rango de fechas invertido debe responder 400; obtuvo $($reversed.Status)."

Write-Host '4. Comprueba expediente, historial, cambio de estado y conflicto de versión.'
$detail = Invoke-ApiRequest -Method 'GET' -Path "/api/incidencias/$code" -Token $token
Assert-Condition ($detail.Status -eq 200) "El expediente autorizado devolvió HTTP $($detail.Status)."
$initialEvents = @($detail.Data.history | Where-Object { $_.state -eq 'Recibido' })
Assert-Condition (@($detail.Data.history).Count -eq 1 -and $initialEvents.Count -eq 1) 'El historial inicial debe contener un único evento Recibido.'
$changeBody = @{
    state = 'En proceso'
    priority = 'Alta'
    note = 'Inspección inicial del área técnica.'
    version = $detail.Data.version
}
$change = Invoke-ApiRequest -Method 'PUT' -Path "/api/incidencias/$code" -Body $changeBody -Token $token
Assert-Condition ($change.Status -eq 200) "El cambio de estado devolvió HTTP $($change.Status)."
$updatedEvents = @($change.Data.history | Where-Object { $_.state -eq 'Recibido' })
Assert-Condition ($updatedEvents.Count -eq 1 -and @($change.Data.history).Count -eq 2) 'El cambio duplicó el evento inicial o no agregó un único evento de historial.'
Assert-Condition ($change.Data.state -eq 'En proceso') 'El estado no quedó actualizado a En proceso.'
$stale = Invoke-ApiRequest -Method 'PUT' -Path "/api/incidencias/$code" -Body $changeBody -Token $token
Assert-Condition ($stale.Status -eq 409) "La versión obsoleta debe responder 409; obtuvo $($stale.Status)."

$ended = Invoke-ApiRequest -Method 'DELETE' -Path '/api/sesiones/actual' -Token $token
Assert-Condition ($ended.Status -eq 204) "El cierre de sesión debe responder 204; obtuvo $($ended.Status)."
$expired = Invoke-ApiRequest -Method 'GET' -Path '/api/sesiones/actual' -Token $token
Assert-Condition ($expired.Status -eq 401) 'La sesión cerrada debe responder 401.'
Write-Host 'Correcto: recorrido Rol 2 contra la API completado.'
