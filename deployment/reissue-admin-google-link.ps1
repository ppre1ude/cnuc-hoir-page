[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^jdbc:postgresql://\S+$')]
    [string]$JdbcUrl,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\S+$')]
    [string]$DbUser,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[^\s@]+@[^\s@]+\.[^\s@]+$')]
    [string]$Email,

    [Parameter(Mandatory = $true)]
    [string]$PublicOrigin
)

$ErrorActionPreference = 'Stop'
$origin = $null
if (-not [Uri]::TryCreate($PublicOrigin, [UriKind]::Absolute, [ref]$origin) -or
    $origin.Scheme -ne 'https' -or $origin.AbsolutePath -ne '/' -or
    $origin.Query -or $origin.Fragment -or $origin.UserInfo) {
    throw '공개 주소는 경로와 인증 정보가 없는 HTTPS 출처여야 합니다.'
}

$apiDirectory = Join-Path $PSScriptRoot '..\api'
$gradle = Join-Path $apiDirectory 'gradlew.bat'
if (-not (Test-Path -LiteralPath $gradle)) {
    throw 'API Gradle Wrapper를 찾지 못했습니다.'
}

$secure = Read-Host 'Supabase DB 비밀번호' -AsSecureString
if ($secure.Length -eq 0) {
    throw 'DB 비밀번호를 입력해 주세요.'
}

$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:CHOIR_BOOTSTRAP_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    Push-Location -LiteralPath $apiDirectory
    try {
        $output = & $gradle linkExistingAdminGoogle "--args=$JdbcUrl $DbUser $Email" --quiet 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
} finally {
    Remove-Item Env:CHOIR_BOOTSTRAP_DB_PASSWORD -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}

if ($exitCode -ne 0) {
    $output | Select-Object -Last 12
    throw '운영진 연결 링크를 재발급하지 못했습니다.'
}

$tokenMatches = [regex]::Matches(($output | Out-String), '(?m)^.*?:\s*([A-Za-z0-9_-]{43})\s*$')
if ($tokenMatches.Count -ne 1) {
    throw '연결 토큰을 찾지 못했습니다. 명령 출력을 확인해 주세요.'
}

$link = $origin.GetLeftPart([UriPartial]::Authority) + '/activate#token=' + $tokenMatches[0].Groups[1].Value
Set-Clipboard -Value $link
Write-Output '새 계정 연결 링크를 클립보드에 복사했습니다. 24시간 안에 사용해 주세요.'
