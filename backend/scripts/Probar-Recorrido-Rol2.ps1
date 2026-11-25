param(
  [string]$BaseUrl = 'http://localhost:5080',
  [string]$Username = $env:ROL2_TEST_USER,
  [string]$Password = $env:ROL2_TEST_PASSWORD
)
$ErrorActionPreference = 'Stop'
function Assert($condition, $message) { if (-not $condition) { throw $message } }
function Request($method, $path, $body = $null, $token = $null) {
  $headers = @{}
  if ($token) { $headers.Authorization = "Bearer $token" }
  $args = @{ Uri = "$BaseUrl$path"; Method = $method; Headers = $headers; UseBasicParsing = $true }
  if ($null -ne $body) { $args.ContentType = 'application/json'; $args.Body = $body | ConvertTo-Json -Depth 8 }
  try { $response = Invoke-WebRequest @args }
  catch {
    if (-not $_.Exception.Response) { throw }
    $webResponse = $_.Exception.Response
    $reader = New-Object IO.StreamReader($webResponse.GetResponseStream())
    $content = $reader.ReadToEnd()
    $response = @{ StatusCode = [int]$webResponse.StatusCode; Content = $content }
  }
  $parsed = $null
  if ($response.Content) { $parsed = $response.Content | ConvertFrom-Json }
  return @{ Status = [int]$response.StatusCode; Data = $parsed }
}

Write-Host '1. Crea incidencia pública y comprueba seguimiento sin iniciar sesión.'
$created = Request POST '/api/incidencias' @{ category='Electricidad'; location='Biblioteca'; description='La luminaria del corredor requiere revisión técnica.'; reference='Pasillo norte' }
Assert ($created.Status -eq 201) "Registro público falló: HTTP $($created.Status)."
$code = $created.Data.code
$tracked = Request GET "/api/seguimiento/$code"
Assert ($tracked.Status -eq 200) 'Seguimiento anónimo debe responder 200.'
Assert ($tracked.Data.code -eq $code) 'El código de seguimiento no coincide.'
Assert (-not ($tracked.Data.PSObject.Properties.Name -contains 'reporterName')) 'Seguimiento expuso reporterName.'
Assert (-not ($tracked.Data.PSObject.Properties.Name -contains 'ownerId')) 'Seguimiento expuso ownerId.'
$anonymousPanel = Request GET '/api/incidencias'
Assert ($anonymousPanel.Status -eq 401) 'El panel debe exigir sesión.'
Write-Host "   Correcto: incidencia $code, seguimiento anónimo y panel protegido."

if (-not $Username -or -not $Password) {
  Write-Warning 'Faltan ROL2_TEST_USER y ROL2_TEST_PASSWORD; se omitió el tramo autenticado de permisos, expediente, actualización y conflicto.'
  exit 0
}

Write-Host '2. Inicia sesión y comprueba permisos vigentes.'
$login = Request POST '/api/sesiones' @{ username=$Username; password=$Password }
Assert ($login.Status -eq 200) "Inicio de sesión falló: HTTP $($login.Status)."
$token = $login.Data.token
Assert ($token) 'La respuesta de inicio de sesión no incluye token.'
$authorizedCode = $code
if ($login.Data.profile -eq 'Desarrollo Físico') {
  $forTechnicalUnit = Request POST '/api/incidencias' @{ category='Edificios'; location='Biblioteca'; description='La puerta del edificio requiere ajuste preventivo.'; reference='Acceso lateral' }
  Assert ($forTechnicalUnit.Status -eq 201) 'No se pudo preparar el expediente de Desarrollo Físico.'
  $authorizedCode = $forTechnicalUnit.Data.code
}
$outOfScopeCategory = if ($login.Data.profile -eq 'Desarrollo Físico') { 'Electricidad' } else { 'Edificios' }
$outOfScope = Request POST '/api/incidencias' @{ category=$outOfScopeCategory; location='Biblioteca'; description='El reporte queda fuera de la unidad técnica de prueba.'; reference='Prueba de permisos' }
Assert ($outOfScope.Status -eq 201) 'No se pudo preparar el expediente fuera de ámbito.'
$forbidden = Request GET "/api/incidencias/$($outOfScope.Data.code)" $null $token
Assert ($forbidden.Status -eq 403) "El expediente de otra unidad debe responder 403; obtuvo $($forbidden.Status)."
$current = Request GET '/api/sesiones/actual' $null $token
Assert ($current.Status -eq 200) 'La consulta de sesión debe responder 200.'
$list = Request GET '/api/incidencias?state=Recibido' $null $token
Assert ($list.Status -eq 200) 'El panel con filtro debe responder 200 para un rol autorizado.'
$detail = Request GET "/api/incidencias/$authorizedCode" $null $token
Assert ($detail.Status -eq 200) "Consulta de expediente autorizado devolvió HTTP $($detail.Status)."
$body = @{ state='En proceso'; priority='Alta'; note='Inspección inicial del área'; version=$detail.Data.version }
$change = Request PUT "/api/incidencias/$authorizedCode" $body $token
Assert ($change.Status -eq 200) "Cambio de estado falló: HTTP $($change.Status)."
$stale = Request PUT "/api/incidencias/$authorizedCode" $body $token
Assert ($stale.Status -eq 409) "La versión obsoleta debe dar 409; obtuvo $($stale.Status)."
Write-Host '   Correcto: permisos de área/unidad, expediente, cambio transaccional e intento obsoleto (409).'
$ended = Request DELETE '/api/sesiones/actual' $null $token
Assert ($ended.Status -eq 204) 'El cierre de sesión debe responder 204.'
$expired = Request GET '/api/sesiones/actual' $null $token
Assert ($expired.Status -eq 401) 'La sesión cerrada debe dejar de autorizar.'
Write-Host 'Correcto: recorrido Rol 2 completado.'
