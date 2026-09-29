param([Parameter(Mandatory = $true)][string]$Email)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($env:E2E_DB_PASSWORD)) {
  throw '격리 테스트 DB 비밀번호가 없습니다.'
}
if ($env:COMPOSE_PROJECT_NAME -notmatch '^choir-portal-e2e-[a-f0-9]{32}$') {
  throw '격리 테스트 Compose 프로젝트가 아닙니다.'
}
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ($env:E2E_DB_PORT -notmatch '^\d{4,5}$') { throw '격리 테스트 DB 포트가 올바르지 않습니다.' }
$containerId = (& docker compose -f (Join-Path $repositoryRoot 'compose.portal.yaml') -f (Join-Path $PSScriptRoot 'compose.e2e.yaml') ps -q mysql).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) {
  throw '격리 테스트 MySQL 컨테이너를 찾을 수 없습니다.'
}
$container = (& docker inspect $containerId | ConvertFrom-Json)[0]
$bindings = @($container.NetworkSettings.Ports.'3306/tcp')
if ($LASTEXITCODE -ne 0 -or -not $container.State.Running -or
    $container.Config.Labels.'com.docker.compose.project' -ne $env:COMPOSE_PROJECT_NAME -or
    $container.Config.Labels.'com.docker.compose.service' -ne 'mysql' -or
    $bindings.Count -ne 1 -or $bindings[0].HostIp -ne '127.0.0.1' -or $bindings[0].HostPort -ne $env:E2E_DB_PORT) {
  throw '격리 테스트 DB 포트가 해당 MySQL에 연결되지 않았습니다.'
}
$env:CHOIR_BOOTSTRAP_DB_PASSWORD = $env:E2E_DB_PASSWORD
Push-Location (Join-Path $repositoryRoot 'api')
try {
  $result = & .\gradlew.bat bootstrapAdminInvite "--args=jdbc:mysql://127.0.0.1:$($env:E2E_DB_PORT)/choir choir $Email TestAdmin ACTIVE" --quiet
  if ($LASTEXITCODE -ne 0) { throw '최초 운영진 초대에 실패했습니다.' }
  $line = @($result | Where-Object { $_ -match '[A-Za-z0-9_-]{43}' }) | Select-Object -Last 1
  $tokenMatch = [regex]::Match([string]$line, '[A-Za-z0-9_-]{43}')
  if (-not $tokenMatch.Success) { throw '초대 토큰을 확인하지 못했습니다.' }
  Write-Output $tokenMatch.Value
} finally {
  Pop-Location
  Remove-Item Env:CHOIR_BOOTSTRAP_DB_PASSWORD -ErrorAction SilentlyContinue
}
