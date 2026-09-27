$ErrorActionPreference = 'Stop'

$first = 'choir-proxy-probe-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
$second = 'choir-proxy-probe-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
$probe = Join-Path $PSScriptRoot 'proxy-probe.mjs'
$mount = "${probe}:/probe.mjs:ro"

try {
    docker run -d --rm --network choir-portal_edge --name $first -v $mount node:24-alpine sleep 300 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw '첫 번째 검증 컨테이너를 시작하지 못했습니다.' }
    docker run -d --rm --network choir-portal_edge --name $second -v $mount node:24-alpine sleep 300 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw '두 번째 검증 컨테이너를 시작하지 못했습니다.' }

    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        docker exec $first node -e "fetch('http://proxy/api/v1/auth/csrf').then(response => process.exit(response.status === 200 ? 0 : 1)).catch(() => process.exit(1))" 2>$null
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) { throw 'API 준비 상태를 확인하지 못했습니다.' }

    docker exec $first node /probe.mjs first
    if ($LASTEXITCODE -ne 0) { throw '첫 번째 클라이언트의 위조 헤더 검증에 실패했습니다.' }
    docker exec $second node /probe.mjs second
    if ($LASTEXITCODE -ne 0) { throw '두 번째 클라이언트의 독립 제한 검증에 실패했습니다.' }
}
finally {
    docker rm -f $first $second 2>$null | Out-Null
}
