package kr.ac.jnu.choir.auth;

import java.sql.Timestamp;
import java.time.Clock;
import kr.ac.jnu.choir.auth.GoogleIdentityVerifier.GoogleIdentity;
import kr.ac.jnu.choir.common.AdminActionLog;
import kr.ac.jnu.choir.common.AdminActionLogRepository;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.member.AccountStatus;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberAllowlistRepository;
import kr.ac.jnu.choir.member.MemberRepository;
import kr.ac.jnu.choir.member.OperatorPreapprovalService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GoogleMemberService {
    private final MemberRepository members;
    private final MemberAllowlistRepository allowlist;
    private final OperatorPreapprovalService operatorPreapprovals;
    private final AdminActionLogRepository logs;
    private final AuthTokenService tokens;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public GoogleMemberService(MemberRepository members, MemberAllowlistRepository allowlist,
            OperatorPreapprovalService operatorPreapprovals,
            AdminActionLogRepository logs, AuthTokenService tokens, JdbcTemplate jdbc, Clock clock) {
        this.members = members;
        this.allowlist = allowlist;
        this.operatorPreapprovals = operatorPreapprovals;
        this.logs = logs;
        this.tokens = tokens;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional
    public Member login(GoogleIdentity identity) {
        // 같은 구글 계정과 이메일의 동시 첫 로그인을 직렬화해 계정 중복을 막습니다.
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", rs -> { }, "google:" + identity.subject());
        Member existing = members.findByGoogleSubjectForUpdate(identity.subject()).orElse(null);
        if (existing != null) return existingLogin(existing, identity);
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", rs -> { }, identity.email());
        existing = members.findByGoogleSubjectForUpdate(identity.subject()).orElse(null);
        if (existing != null) return existingLogin(existing, identity);
        existing = members.findByEmailForUpdate(identity.email()).orElse(null);
        if (existing != null) {
            if (isUnlinkedBootstrapAdmin(existing, identity)) return connectBootstrapAdmin(existing, identity);
            throw linkRequired();
        }
        Member member = members.saveAndFlush(Member.googleApplicant(identity.email(), identity.name(),
                identity.subject(), clock));
        if (identity.authoritativeEmail() && !operatorPreapprovals.grantIfListed(member)) approveFromAllowlist(member);
        return member;
    }

    private Member existingLogin(Member existing, GoogleIdentity identity) {
        if (existing.getStatus() == AccountStatus.REVOKED) throw blocked();
        if (existing.getStatus() == AccountStatus.INVITED) throw linkRequired();
        if (existing.getEmail().equals(identity.email()) && identity.authoritativeEmail()) {
            if (operatorPreapprovals.grantIfListed(existing)) return existing;
            if (existing.getStatus() == AccountStatus.APPROVAL_PENDING) approveFromAllowlist(existing);
        }
        return existing;
    }

    private boolean isUnlinkedBootstrapAdmin(Member member, GoogleIdentity identity) {
        if (!identity.authoritativeEmail() || !member.isAdmin()
                || member.getStatus() != AccountStatus.INVITED || member.getGoogleSubject() != null) {
            return false;
        }
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM admin_action_log
                    WHERE target_member_id = ? AND action = 'BOOTSTRAP_INVITE'
                )
                """, Boolean.class, member.getId()));
    }

    private Member connectBootstrapAdmin(Member member, GoogleIdentity identity) {
        jdbc.update("""
                UPDATE auth_token SET used_at = ?
                WHERE member_id = ? AND purpose = 'ACCOUNT_SETUP' AND used_at IS NULL
                """, Timestamp.from(clock.instant()), member.getId());
        AccountStatus before = member.getStatus();
        member.connectGoogle(identity.subject(), clock);
        logs.save(new AdminActionLog(member, member, "BOOTSTRAP_GOOGLE_LINK", before,
                member.getStatus(), "확인된 구글 계정으로 최초 운영진 연결", clock.instant()));
        return member;
    }

    @Transactional
    public Member connect(String token, GoogleIdentity identity) {
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", rs -> { }, "google:" + identity.subject());
        long memberId = tokens.memberIdForAccountSetup(token);
        Member member = members.findByIdForUpdate(memberId).orElseThrow(GoogleMemberService::invalidToken);
        if ((member.getStatus() != AccountStatus.INVITED && member.getStatus() != AccountStatus.APPROVED)
                || !member.getEmail().equals(identity.email())
                || member.getGoogleSubject() != null
                || members.findByGoogleSubject(identity.subject()).isPresent()) {
            throw invalidToken();
        }
        tokens.consumeAccountSetup(token);
        member.connectGoogle(identity.subject(), clock);
        return member;
    }

    private void approveFromAllowlist(Member member) {
        allowlist.findByEmailIgnoreCase(member.getEmail()).ifPresent(entry -> {
            AccountStatus before = member.getStatus();
            // 구글 프로필 이름보다 운영진이 명단에 적은 이름이 단원 명단에서 알아보기 쉽습니다.
            if (entry.getDisplayName() != null) member.rename(entry.getDisplayName(), clock);
            member.approve(entry.getMemberType(), clock);
            logs.save(new AdminActionLog(entry.getCreatedBy(), member, "ALLOWLIST_APPROVE", before,
                    member.getStatus(), null, clock.instant()));
        });
    }

    private static ApiException linkRequired() {
        return new ApiException(HttpStatus.CONFLICT, "ACCOUNT_LINK_REQUIRED",
                "이미 등록된 이메일입니다. 운영진에게 계정 연결 링크를 요청해 주세요.");
    }

    private static ApiException blocked() {
        return new ApiException(HttpStatus.FORBIDDEN, "ACCESS_REVOKED", "접근이 해제된 계정입니다.");
    }

    private static ApiException invalidToken() {
        return new ApiException(HttpStatus.CONFLICT, "INVALID_INVITE_TOKEN", "사용할 수 없는 계정 연결 링크입니다.");
    }
}
