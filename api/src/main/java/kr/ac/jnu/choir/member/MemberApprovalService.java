package kr.ac.jnu.choir.member;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.Clock;
import kr.ac.jnu.choir.auth.Permission;
import kr.ac.jnu.choir.auth.PermissionService;
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
    private final PermissionService permissions;
    private final MemberRoleRepository roles;
    private final Clock clock;
    private final EntityManager entityManager;

    public MemberApprovalService(MemberRepository members, AdminActionLogRepository logs,
            PermissionService permissions, MemberRoleRepository roles, Clock clock, EntityManager entityManager) {
        this.roles = roles;
        this.members = members;
        this.logs = logs;
        this.permissions = permissions;
        this.clock = clock;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public Page<Member> applications(AccountStatus status, int page, int size) {
        return members.findByStatusOrderByCreatedAtAsc(status, PageRequest.of(page, size));
    }

    @Transactional
    public Member reportApplication(Long memberId, String name, Part part, int cohort) {
        // 승인과 동시에 저장되면 승인 상태를 덮어쓸 수 있어 승인과 같은 행 잠금을 잡습니다.
        Member member = locked(memberId);
        try {
            member.reportApplication(name, part, cohort, clock);
        } catch (IllegalStateException closed) {
            throw new ApiException(HttpStatus.CONFLICT, "APPLICATION_CLOSED",
                    "승인 대기 중일 때만 가입 정보를 고칠 수 있습니다. 다시 로그인해 계정 상태를 확인해 주세요.");
        }
        return member;
    }

    @Transactional
    public void approve(Member actor, Long targetId, MemberType type) {
        LockedMembers locked = lockMembers(actor.getId(), targetId, Permission.APPROVE_APPLICATIONS);
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
        LockedMembers locked = lockMembers(actor.getId(), targetId, Permission.APPROVE_APPLICATIONS);
        Member target = locked.target();
        if (target.getStatus() != AccountStatus.APPROVAL_PENDING || target.getEmailVerifiedAt() == null) {
            throw conflict();
        }
        AccountStatus before = target.getStatus();
        target.reject(clock);
        logs.save(new AdminActionLog(locked.actor(), target, "REJECT", before, target.getStatus(), reason, clock.instant()));
    }

    @Transactional
    public void cancelRejection(Member actor, Long targetId) {
        LockedMembers locked = lockMembers(actor.getId(), targetId, Permission.APPROVE_APPLICATIONS);
        Member target = locked.target();
        if (target.getStatus() != AccountStatus.REJECTED) {
            throw conflict();
        }
        AccountStatus before = target.getStatus();
        target.reopenApplication(clock);
        logs.save(new AdminActionLog(locked.actor(), target, "REJECT_CANCEL", before, target.getStatus(), null, clock.instant()));
    }

    @Transactional
    public void revoke(Member actor, Long targetId, String reason) {
        LockedMembers locked = lockMembers(actor.getId(), targetId, Permission.REVOKE_ACCESS);
        Member target = locked.target();
        if (target.isAdmin() && !permissions.of(locked.actor()).contains(Permission.MANAGE_SITE_ADMINS)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "PERMISSION_REQUIRED", "사이트 관리자 계정은 사이트 관리자만 변경할 수 있습니다.");
        }
        boolean leadership = roles.findByMemberIdOrderByAssignedAtAsc(target.getId()).stream()
                .anyMatch(role -> role.getRole() == Role.PRESIDENT || role.getRole() == Role.VICE_PRESIDENT);
        if (leadership && !permissions.of(locked.actor()).contains(Permission.MANAGE_SITE_ADMINS)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "PERMISSION_REQUIRED", "단장·부단장 계정은 사이트 관리자만 변경할 수 있습니다.");
        }
        if ((target.getStatus() != AccountStatus.APPROVED && target.getStatus() != AccountStatus.INVITED)
                || target.getId().equals(locked.actor().getId())) {
            throw conflict();
        }
        if (target.isAdmin() && members.countByAdminTrueAndStatus(AccountStatus.APPROVED) <= 1) {
            throw new ApiException(HttpStatus.CONFLICT, "LAST_ADMIN", "마지막 운영진의 접근은 해제할 수 없습니다.");
        }
        AccountStatus before = target.getStatus();
        target.revoke(clock);
        roles.deleteByMemberId(target.getId());
        logs.save(new AdminActionLog(locked.actor(), target, "REVOKE", before, target.getStatus(), reason, clock.instant()));
    }

    private LockedMembers lockMembers(Long actorId, Long targetId, Permission required) {
        Member first = locked(Math.min(actorId, targetId));
        Member second = actorId.equals(targetId) ? first : locked(Math.max(actorId, targetId));
        Member actor = first.getId().equals(actorId) ? first : second;
        Member target = first.getId().equals(targetId) ? first : second;
        if (!permissions.of(actor).contains(required)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "PERMISSION_REQUIRED", "이 기능을 쓸 권한이 없습니다.");
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
