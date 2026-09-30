param(
    [Parameter(Mandatory = $true)]
    [string] $PublicOrigin,
    [switch] $CheckLive
)

$ErrorActionPreference = 'Stop'
$problems = [System.Collections.Generic.List[string]]::new()

foreach ($name in @('DB_URL', 'DB_USER', 'DB_PASSWORD', 'GOOGLE_CLIENT_ID', 'NEXT_PUBLIC_GOOGLE_CLIENT_ID')) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
        $problems.Add("환경 변수 $name 이(가) 비어 있습니다.")
    }
}

if ($env:GOOGLE_CLIENT_ID -and $env:NEXT_PUBLIC_GOOGLE_CLIENT_ID -and
    $env:GOOGLE_CLIENT_ID -ne $env:NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
    $problems.Add('API와 웹의 구글 클라이언트 ID가 다릅니다.')
}

if ($env:DB_URL -and $env:DB_URL -notmatch '^jdbc:postgresql://[^/]+/[^?]+') {
    $problems.Add('DB_URL은 PostgreSQL JDBC 주소여야 합니다.')
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

if ($problems.Count -gt 0) {
    foreach ($problem in $problems) { [Console]::Error.WriteLine($problem) }
    exit 1
}

if ($CheckLive) {
    try {
        $homeResponse = Invoke-WebRequest -Uri $origin.AbsoluteUri -Method Get -TimeoutSec 15 -UseBasicParsing -MaximumRedirection 0
        $csrf = Invoke-WebRequest -Uri ([Uri]::new($origin, '/api/v1/auth/csrf')).AbsoluteUri -Method Get -TimeoutSec 15 -UseBasicParsing -MaximumRedirection 0
        if ($homeResponse.StatusCode -ne 200 -or $csrf.StatusCode -ne 200) {
            throw '공개 화면 또는 API가 정상 응답하지 않았습니다.'
        }
    } catch {
        [Console]::Error.WriteLine('실제 HTTPS 공개 화면과 API 확인에 실패했습니다.')
        exit 1
    }
}

Write-Output '설정 사전 점검을 통과했습니다. 운영진 초대·백업·출석 검증은 별도로 필요합니다.'
