package kr.ac.jnu.choir.member;

import java.time.Clock;
import kr.ac.jnu.choir.common.AdminActionLog;
import kr.ac.jnu.choir.common.AdminActionLogRepository;
import kr.ac.jnu.choir.common.ApiException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MemberApprovalService {
    private final MemberRepository members;
    private final AdminActionLogRepository logs;
    private final Clock clock;

    public MemberApprovalService(MemberRepository members, AdminActionLogRepository logs, Clock clock) {
        this.members = members;
        this.logs = logs;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<Member> applications(AccountStatus status, int page, int size) {
        return members.findByStatusOrderByCreatedAtAsc(status, PageRequest.of(page, size));
    }

    @Transactional
    public void approve(Member actor, Long targetId, MemberType type) {
        Member target = target(targetId);
        if (target.getStatus() != AccountStatus.APPROVAL_PENDING || target.getEmailVerifiedAt() == null) {
            throw conflict();
        }
        AccountStatus before = target.getStatus();
        target.approve(type, clock);
        logs.save(new AdminActionLog(actor, target, "APPROVE", before, target.getStatus(), null, clock.instant()));
    }

    @Transactional
    public void reject(Member actor, Long targetId, String reason) {
        Member target = target(targetId);
        if (target.getStatus() != AccountStatus.APPROVAL_PENDING || target.getEmailVerifiedAt() == null) {
            throw conflict();
        }
        AccountStatus before = target.getStatus();
        target.reject(clock);
        logs.save(new AdminActionLog(actor, target, "REJECT", before, target.getStatus(), reason, clock.instant()));
    }

    @Transactional
    public void revoke(Member actor, Long targetId, String reason) {
        Member target = target(targetId);
        if (target.getStatus() != AccountStatus.APPROVED || target.getId().equals(actor.getId())) {
            throw conflict();
        }
        AccountStatus before = target.getStatus();
        target.revoke(clock);
        logs.save(new AdminActionLog(actor, target, "REVOKE", before, target.getStatus(), reason, clock.instant()));
    }

    private Member target(Long id) {
        return members.findByIdForUpdate(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "계정을 찾을 수 없습니다."));
    }

    private ApiException conflict() {
        return new ApiException(HttpStatus.CONFLICT, "INVALID_MEMBER_STATE", "이미 처리되었거나 변경할 수 없는 계정 상태입니다.");
    }
}
