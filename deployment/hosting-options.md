# 로그인·투표 배포 장소 비교

확인일: 2026-09-29. 웹은 Vercel에 두고 Spring API와 MySQL을 별도로 운영합니다. 단원 계정은 운영진이 명단을 확인해 초대하므로 메일 발송 서비스 비용은 필요하지 않습니다.

| 선택지 | 기본 비용 | 운영 부담 |
| --- | --- | --- |
| Railway Hobby | 월 5달러부터. 5달러의 자원 사용량이 포함되며 초과분은 추가 청구 | API와 MySQL 배포, 사용량·백업 확인 |
| Render 유료 서비스 2개 | API 월 7달러, MySQL용 사설 서비스 월 7달러, 저장 공간 별도 | MySQL 이미지·디스크·백업 직접 관리 |
| 단일 VPS | 예: Hetzner CX23 유럽 지역 월 5.49유로, IPv4·세금 별도 | OS 보안 업데이트, TLS, DB 백업·복구, 장애 대응 직접 수행 |

현재 선택지는 **Railway Hobby를 먼저 검토**하는 것입니다. 메일 서비스가 없어 SMTP 연결 제한은 계정 기능에 영향을 주지 않습니다. 실제 요금은 API와 MySQL의 CPU·메모리·저장 공간 사용량에 따라 달라집니다. 비용 상한과 백업 방법을 확인한 뒤 운영 환경을 만듭니다.

## 다음 작업

1. Railway에서 API와 MySQL을 만들고 DB를 외부에 공개하지 않습니다. MySQL 버전은 검증에 사용한 8.4와 대조합니다.
2. 첫 운영진을 `bootstrapAdminInvite` 명령으로 초대합니다. 초대 토큰은 비공개로 전달하고 공유 터미널 기록에 남기지 않습니다.
3. Vercel의 `CHOIR_API_ORIGIN`을 실제 API HTTPS 출처로 설정하고 웹을 다시 배포합니다.
4. 실제 접속 경로에서 세션 쿠키, CSRF, 초대 링크의 만료·재발급, 공지 투표와 출석을 확인합니다. 전달 IP 헤더는 프록시의 위조 차단을 확인한 뒤 신뢰합니다.

계정 생성, 요금제 결제, 도메인 소유 확인은 계정 소유자가 수행합니다. 코드와 설정 점검, 비밀값을 제외한 검증은 저장소 작업으로 진행할 수 있습니다.

근거: [Railway 요금](https://docs.railway.com/pricing/plans), [Railway MySQL](https://docs.railway.com/databases/mysql), [Render 요금](https://render.com/pricing), [Render MySQL](https://render.com/docs/deploy-mysql), [Hetzner VPS 요금](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
