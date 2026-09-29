package kr.ac.jnu.choir.member;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
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
    private final EntityManager entityManager;

    public MemberApprovalService(MemberRepository members, AdminActionLogRepository logs, Clock clock,
            EntityManager entityManager) {
        this.members = members;
        this.logs = logs;
        this.clock = clock;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public Page<Member> applications(AccountStatus status, int page, int size) {
        return members.findByStatusOrderByCreatedAtAsc(status, PageRequest.of(page, size));
    }

    @Transactional
    public void approve(Member actor, Long targetId, MemberType type) {
        LockedMembers locked = lockMembers(actor.getId(), targetId);
        Member target = locked.target();
        if (target.getStatus() != AccountStatus.APPROVAL_PENDING || target.getEmailVerifiedAt() == null) {
            throw conflict();
        }
        AccountStatus before = target.getStatus();
        target.approve(type, clock);
        logs.save(new AdminActionLog(locked.actor(), target, "APPROVE", before, target.getStatus(), null, clock.instant()));
    }

    @Transactional
    public void reject(Member actor, Long targetId, String reason) {
        LockedMembers locked = lockMembers(actor.getId(), targetId);
        Member target = locked.target();
        if (target.getStatus() != AccountStatus.APPROVAL_PENDING || target.getEmailVerifiedAt() == null) {
            throw conflict();
        }
        AccountStatus before = target.getStatus();
        target.reject(clock);
        logs.save(new AdminActionLog(locked.actor(), target, "REJECT", before, target.getStatus(), reason, clock.instant()));
    }

    @Transactional
    public void revoke(Member actor, Long targetId, String reason) {
        LockedMembers locked = lockMembers(actor.getId(), targetId);
        Member target = locked.target();
        if ((target.getStatus() != AccountStatus.APPROVED && target.getStatus() != AccountStatus.INVITED)
                || target.getId().equals(locked.actor().getId())) {
            throw conflict();
        }
        if (target.isAdmin() && members.countByAdminTrueAndStatus(AccountStatus.APPROVED) <= 1) {
            throw new ApiException(HttpStatus.CONFLICT, "LAST_ADMIN", "마지막 운영진의 접근은 해제할 수 없습니다.");
        }
        AccountStatus before = target.getStatus();
        target.revoke(clock);
        logs.save(new AdminActionLog(locked.actor(), target, "REVOKE", before, target.getStatus(), reason, clock.instant()));
    }

    private LockedMembers lockMembers(Long actorId, Long targetId) {
        Member first = locked(Math.min(actorId, targetId));
        Member second = actorId.equals(targetId) ? first : locked(Math.max(actorId, targetId));
        Member actor = first.getId().equals(actorId) ? first : second;
        Member target = first.getId().equals(targetId) ? first : second;
        if (actor.getStatus() != AccountStatus.APPROVED || !actor.isAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ADMIN_REQUIRED", "운영진만 이용할 수 있습니다.");
        }
        return new LockedMembers(actor, target);
    }

    private Member locked(Long id) {
        Member member = members.findByIdForUpdate(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "계정을 찾을 수 없습니다."));
        entityManager.refresh(member, LockModeType.PESSIMISTIC_WRITE);
        return member;
    }

    private record LockedMembers(Member actor, Member target) {}

    private ApiException conflict() {
        return new ApiException(HttpStatus.CONFLICT, "INVALID_MEMBER_STATE", "이미 처리되었거나 변경할 수 없는 계정 상태입니다.");
    }
}
