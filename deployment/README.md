# 회원 포털 프록시 실행 구성

Vercel에 웹을 올릴 때의 설정과 회원 기능 검증 조건은 [Vercel 웹 배포 준비](vercel.md)를 확인합니다. API·DB의 저비용 선택지는 [배포 장소 비교](hosting-options.md)에 정리했습니다.

`compose.portal.yaml`은 Nginx 하나만 호스트의 `127.0.0.1:${PORTAL_HTTP_PORT:-8080}`에 연결합니다. `/api/v1/`은 Spring API로 직접 보내고 나머지는 Next로 보냅니다. API, 웹, MySQL에는 호스트 공개 포트가 없습니다. `compose.yaml`은 기존 DB 단독 개발 구성입니다.

실행 전에 `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `VERIFY_BASE_URL`을 환경 변수로 설정합니다. `VERIFY_BASE_URL`은 실제 공개 주소의 HTTPS `/verify-email` 경로여야 합니다. 필요하면 `SMTP_PORT`와 `PORTAL_HTTP_PORT`를 설정합니다. 값은 저장소에 넣지 않습니다.

운영 환경의 주소와 변수가 정해지면 저장소 루트에서 `.\deployment\check-launch-config.ps1 -PublicOrigin https://확정한-도메인`으로 사전 점검합니다. 배포 뒤에는 같은 명령에 `-CheckLive`를 추가해 HTTPS 공개 화면과 API 응답을 확인합니다. 이 명령은 메일 실송수신, 백업 복구, 최초 운영진 지정과 현장 출석 검증을 대신하지 않습니다. 전체 순서는 [운영 절차](../docs/operations.md)를 따릅니다.

```powershell
docker compose -f compose.portal.yaml up --build -d
.\deployment\test-proxy-boundary.ps1
docker compose -f compose.portal.yaml down
```

Nginx는 외부 요청의 `X-Forwarded-For`를 TCP 연결 주소로 덮어쓰고 `Forwarded`를 제거합니다. API는 Compose의 Nginx 내부 주소 `172.30.240.10/32`만 신뢰하며, 신뢰 프록시 설정이 비면 기동하지 않습니다. 이 주소와 Compose의 `api_private` 대역을 바꿀 때는 두 설정을 함께 바꿔야 합니다. API 포트를 직접 공개하거나 웹 서버를 API의 신뢰 프록시로 추가하면 이 경계가 깨집니다.

제공 구성의 HTTP 포트는 로컬 검증용으로만 루프백에 묶여 있습니다. `localhost`의 Chromium은 HTTP에서도 `Secure` 쿠키를 저장할 수 있어 로컬 로그인 검증이 가능합니다. 이 예외는 운영 TLS를 대신하지 않습니다. 운영 공개 전에 이 Nginx에서 검증된 TLS를 종료하도록 구성하고 HTTPS로만 노출해야 합니다. 상위 인그레스에서 TLS를 종료한다면 현재 Nginx는 인그레스의 주소를 모든 요청의 원격 주소로 보므로 고객별 IP 제한이 합쳐집니다. 그 경우 신뢰할 상위 인그레스의 주소 범위와 실제 연결 주소 검증 방식이 확정된 뒤 Nginx의 클라이언트 주소 복원 규칙을 별도로 구성하고 위조 헤더 차단을 다시 검증해야 합니다. 단순히 상위 `X-Forwarded-For`를 전달해서는 안 됩니다.
