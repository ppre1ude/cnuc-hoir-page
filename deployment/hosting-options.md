# 로그인·투표 배포 장소 비교

확인일: 2026-09-29. 웹은 Vercel에 두고, Spring API와 MySQL을 별도로 운영하는 구성을 비교합니다. 금액은 호스팅 기본료이며 도메인, 초과 사용량, 백업 등에 별도 요금이 붙을 수 있습니다.

| 선택지 | 기본 비용 | 현재 코드에서 필요한 작업 | 운영 부담 |
| --- | --- | --- | --- |
| Railway Hobby + Resend 무료 요금제 | Railway 월 5달러부터. 5달러의 자원 사용량이 포함되며 초과분은 추가 청구 | SMTP 발송기를 HTTPS 메일 API로 교체하고 재시도·중복 발송을 검증 | API와 MySQL 배포·모니터링, 발송 도메인 DNS 설정 |
| Railway Pro + 기존 SMTP | Railway 월 20달러부터. 20달러의 자원 사용량이 포함되며 초과분은 추가 청구 | 현재 SMTP 설정 활용 | API와 MySQL 배포·모니터링, SMTP 설정 |
| Render 유료 서비스 2개 | API 월 7달러, MySQL용 사설 서비스 월 7달러, 저장 공간 별도 | 기존 SMTP 설정 활용. MySQL 서비스를 직접 구성 | DB 이미지·디스크·백업을 직접 관리 |
| 단일 VPS | 예: Hetzner CX23 유럽 지역 월 5.49유로, IPv4·세금 별도 | 기존 Docker 구성을 TLS·백업·운영용으로 수정 | OS 보안 업데이트, TLS, DB 백업·복구, 장애 대응을 직접 수행 |

현재 코드의 메일 발송은 `MailSender` 인터페이스 뒤에 SMTP 구현이 연결되어 있습니다. Railway의 Free·Trial·Hobby에서는 SMTP 발송이 제한되므로 Hobby를 선택하면 HTTPS 메일 API 구현이 필요합니다. Resend 무료 요금제는 월 3,000건, 하루 100건이며 발신 도메인의 DNS 확인이 필요합니다. 이 한도를 넘기거나 도메인을 준비하지 못하면 해당 조합으로 가입·비밀번호 재설정 메일을 운영할 수 없습니다.

**권장:** 운영 부담과 월 기본료를 함께 줄이려면 Railway Hobby + Resend를 먼저 검토합니다. 실제 Railway 사용료는 API와 MySQL의 CPU·메모리 사용량에 따라 달라지므로 월 5달러로 고정된다고 가정하지 않습니다. SMTP 코드를 유지하는 것이 우선이면 Railway Pro가 단순합니다. VPS는 서버 운영 담당자와 백업·복구 절차가 정해졌을 때 선택합니다.

## 결정 뒤 진행할 작업

1. 선택한 곳에 API·MySQL을 구성하고 DB를 외부에 공개하지 않습니다. MySQL 버전은 로컬 검증에 사용한 8.4와 대조합니다.
2. Hobby를 선택했다면 HTTPS 메일 발송 구현과 실패 재시도·중복 발송 테스트를 먼저 완료합니다.
3. 공개 HTTPS 웹 주소와 메일 발신 도메인을 확정하고 `VERIFY_BASE_URL`과 DNS를 설정합니다.
4. Vercel의 `CHOIR_API_ORIGIN`을 실제 API HTTPS 출처로 설정하고 재배포합니다.
5. 실제 접속 경로에서 사용자별 IP 제한, 세션 쿠키, CSRF, 가입 메일, 공지 투표를 확인합니다. 프록시가 전달한 IP 헤더는 배포 경로에서 위조 차단을 확인하기 전까지 신뢰하지 않습니다.

계정 생성, 요금제 결제, 도메인 소유 확인은 계정 소유자가 수행합니다. 코드 변경, 배포 설정, 비밀값을 제외한 사전 점검과 배포 후 기능 검증은 저장소 작업으로 진행할 수 있습니다.

근거: [Railway 요금](https://docs.railway.com/pricing/plans), [Railway SMTP 제한](https://docs.railway.com/networking/outbound-networking), [Resend 요금](https://resend.com/pricing), [Render 요금](https://render.com/pricing), [Render MySQL](https://render.com/docs/deploy-mysql), [Hetzner VPS 요금](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
