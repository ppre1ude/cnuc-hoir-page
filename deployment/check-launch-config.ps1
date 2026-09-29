param(
    [Parameter(Mandatory = $true)]
    [string] $PublicOrigin,
    [switch] $CheckLive
)

$ErrorActionPreference = 'Stop'
$problems = [System.Collections.Generic.List[string]]::new()

foreach ($name in @('MYSQL_PASSWORD', 'MYSQL_ROOT_PASSWORD', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM', 'VERIFY_BASE_URL')) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
        $problems.Add("환경 변수 $name 이(가) 비어 있습니다.")
    }
}

$smtpPort = [Environment]::GetEnvironmentVariable('SMTP_PORT')
$portNumber = 0
if (-not [string]::IsNullOrWhiteSpace($smtpPort) -and
    (-not [int]::TryParse($smtpPort, [ref] $portNumber) -or $portNumber -lt 1 -or $portNumber -gt 65535)) {
    $problems.Add('SMTP_PORT는 1부터 65535 사이의 포트 번호여야 합니다.')
}

$origin = $null
$inputOrigin = $PublicOrigin.Trim()
if (-not [Uri]::TryCreate($inputOrigin, [UriKind]::Absolute, [ref] $origin) -or
    $origin.Scheme -ne 'https' -or
    $origin.AbsolutePath -ne '/' -or
    $origin.Query -or $origin.Fragment -or $origin.UserInfo) {
    $problems.Add('공개 주소는 경로와 인증 정보가 없는 HTTPS 출처여야 합니다.')
} else {
    $address = $null
    $isIpAddress = [System.Net.IPAddress]::TryParse($origin.Host, [ref] $address)
    if ($origin.IsLoopback -or $isIpAddress -or
        $origin.Host -match '(^|\.)localhost$|(^|\.)test$|(^|\.)invalid$|(^|\.)example$|^example\.(com|net|org)$') {
        $problems.Add('공개 주소에 로컬 주소, IP 주소 또는 예시 도메인을 사용할 수 없습니다.')
    }
}

$verifyBase = [Environment]::GetEnvironmentVariable('VERIFY_BASE_URL')
$verifyUri = $null
if (-not [string]::IsNullOrWhiteSpace($verifyBase)) {
    if (-not [Uri]::TryCreate($verifyBase.Trim(), [UriKind]::Absolute, [ref] $verifyUri) -or
        $verifyUri.Scheme -ne 'https' -or
        $verifyUri.AbsolutePath -ne '/verify-email' -or
        $verifyUri.Query -or $verifyUri.Fragment -or $verifyUri.UserInfo) {
        $problems.Add('VERIFY_BASE_URL은 공개 주소의 HTTPS /verify-email 경로여야 합니다.')
    } elseif ($null -ne $origin -and $origin.Scheme -eq 'https' -and
        $verifyUri.GetLeftPart([UriPartial]::Authority) -ne $origin.GetLeftPart([UriPartial]::Authority)) {
        $problems.Add('VERIFY_BASE_URL과 공개 주소의 출처가 다릅니다.')
    }
}

if ($problems.Count -gt 0) {
    foreach ($problem in $problems) { [Console]::Error.WriteLine($problem) }
    exit 1
}

if ($CheckLive) {
    try {
        $home = Invoke-WebRequest -Uri $origin.AbsoluteUri -Method Get -TimeoutSec 15 -UseBasicParsing -MaximumRedirection 0
        $csrf = Invoke-WebRequest -Uri ([Uri]::new($origin, '/api/v1/auth/csrf')).AbsoluteUri -Method Get -TimeoutSec 15 -UseBasicParsing -MaximumRedirection 0
        if ($home.StatusCode -ne 200 -or $csrf.StatusCode -ne 200) {
            throw '공개 화면 또는 API가 정상 응답하지 않았습니다.'
        }
    } catch {
        [Console]::Error.WriteLine('실제 HTTPS 공개 화면과 API 확인에 실패했습니다.')
        exit 1
    }
}

Write-Output '설정 사전 점검을 통과했습니다. 운영진 확인과 실제 메일·백업·출석 검증은 별도로 필요합니다.'
