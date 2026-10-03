package kr.ac.jnu.choir.member;

import java.time.Clock;
import java.util.Locale;
import kr.ac.jnu.choir.auth.AuthTokenService;
import kr.ac.jnu.choir.auth.Permission;
import kr.ac.jnu.choir.auth.PermissionService;
import kr.ac.jnu.choir.common.AdminActionLog;
import kr.ac.jnu.choir.common.AdminActionLogRepository;
import kr.ac.jnu.choir.common.ApiException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MemberInvitationService {
    private final MemberRepository members;
    private final AuthTokenService tokens;
    private final AdminActionLogRepository logs;
    private final PermissionService permissions;
    private final Clock clock;

    public MemberInvitationService(MemberRepository members, AuthTokenService tokens,
            AdminActionLogRepository logs, PermissionService permissions, Clock clock) {
        this.members = members;
        this.tokens = tokens;
        this.logs = logs;
        this.permissions = permissions;
        this.clock = clock;
    }

    @Transactional
    public IssuedInvitation create(Member requestedBy, String email, String name, MemberType type) {
        Member actor = permissions.require(requestedBy.getId(), Permission.APPROVE_APPLICATIONS);
        String normalized = email.strip().toLowerCase(Locale.ROOT);
        if (members.findByEmailIgnoreCase(normalized).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_ALREADY_USED", "이미 등록된 이메일입니다.");
        }
        Member target;
        try {
            target = members.saveAndFlush(Member.invited(normalized, name, type, clock));
        } catch (DataIntegrityViolationException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_ALREADY_USED", "이미 등록된 이메일입니다.");
        }
        String token = tokens.issueAccountSetup(target.getId());
        logs.save(new AdminActionLog(actor, target, "INVITE", AccountStatus.INVITED,
                AccountStatus.INVITED, null, clock.instant()));
        return new IssuedInvitation(target.getId(), token);
    }

    @Transactional
    public IssuedInvitation reissue(Member requestedBy, long targetId) {
        Member actor = permissions.require(requestedBy.getId(), Permission.APPROVE_APPLICATIONS);
        Member target = members.findByIdForUpdate(targetId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "계정을 찾을 수 없습니다."));
        if (target.isAdmin() && !permissions.of(actor).contains(Permission.MANAGE_SITE_ADMINS)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "PERMISSION_REQUIRED", "사이트 관리자 계정은 사이트 관리자만 변경할 수 있습니다.");
        }
        if (target.getStatus() != AccountStatus.INVITED && target.getStatus() != AccountStatus.APPROVED
                && target.getStatus() != AccountStatus.REVOKED) {
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_MEMBER_STATE", "초대 링크를 발급할 수 없는 계정입니다.");
        }
        if (target.getStatus() != AccountStatus.REVOKED && target.getGoogleSubject() != null) {
            throw new ApiException(HttpStatus.CONFLICT, "GOOGLE_ALREADY_LINKED", "이미 구글 계정이 연결되어 있습니다.");
        }
        AccountStatus before = target.getStatus();
        if (before == AccountStatus.REVOKED) target.reinvite(clock);
        String token = tokens.issueAccountSetup(target.getId());
        logs.save(new AdminActionLog(actor, target, "REISSUE_SETUP", before,
                target.getStatus(), null, clock.instant()));
        return new IssuedInvitation(target.getId(), token);
    }

    public record IssuedInvitation(Long memberId, String token) {}
}
