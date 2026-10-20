package kr.ac.jnu.choir.member;

import java.time.Clock;
import java.util.List;
import java.util.stream.Collectors;
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
public class MemberRoleService {
    private final MemberRepository members;
    private final MemberRoleRepository roles;
    private final PermissionService permissions;
    private final AdminActionLogRepository logs;
    private final Clock clock;

    public MemberRoleService(MemberRepository members, MemberRoleRepository roles, PermissionService permissions,
            AdminActionLogRepository logs, Clock clock) {
        this.members = members;
        this.roles = roles;
        this.permissions = permissions;
        this.logs = logs;
        this.clock = clock;
    }

    @Transactional
    public MemberRole assign(long actorId, long targetId, Role role, Department department, Unit unit, Part part) {
        Locked locked = lock(actorId, targetId, required(role));
        validate(role, department, unit, part);
        Member actor = locked.actor();
        Member target = eligible(locked.target());
        MemberRole created;
        try {
            created = roles.saveAndFlush(new MemberRole(target, role, department, unit, part, actor, clock.instant()));
        } catch (DataIntegrityViolationException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "ROLE_EXISTS", "이미 가진 직책입니다.");
        }
        logs.save(new AdminActionLog(actor, target, "ROLE_ASSIGN", target.getStatus(), target.getStatus(),
                describe(role, department, unit, part), clock.instant()));
        return created;
    }

    @Transactional
    public void remove(long actorId, long targetId, long roleId) {
        Locked locked = lock(actorId, targetId, Permission.MANAGE_ROLES);
        Member actor = locked.actor();
        Member target = locked.target();
        MemberRole existing = roles.findById(roleId)
                .filter(role -> role.getMember().getId().equals(targetId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ROLE_NOT_FOUND", "직책을 찾을 수 없습니다."));
        if (!permissions.of(actor).contains(required(existing.getRole()))) throw denied();
        roles.delete(existing);
        logs.save(new AdminActionLog(actor, target, "ROLE_REMOVE", target.getStatus(), target.getStatus(),
                describe(existing.getRole(), existing.getDepartment(), existing.getUnit(), existing.getPart()), clock.instant()));
    }

    @Transactional
    public void updateProfile(long actorId, long targetId, Part part, Integer cohort, MemberType memberType) {
        Locked locked = lock(actorId, targetId, Permission.MANAGE_ROLES);
        Member actor = locked.actor();
        if (cohort != null && cohort < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_COHORT", "기수는 1 이상이어야 합니다.");
        }
        Member target = locked.target();
        MemberType before = target.getMemberType();
        MemberType type = memberType == null ? before : memberType;
        if (type != before && target.getStatus() != AccountStatus.APPROVED) {
            throw new ApiException(HttpStatus.CONFLICT, "MEMBER_TYPE_LOCKED", "승인된 단원만 단원 구분을 바꿀 수 있습니다.");
        }
        String removed = "";
        if (type == MemberType.OB) {
            List<MemberRole> held = roles.findByMemberIdOrderByAssignedAtAsc(targetId);
            // OB는 직책을 가질 수 없어 모두 지웁니다. 직책 관리 권한만으로 단장·부단장 직책이 지워지지 않게 직책마다 권한을 봅니다.
            if (held.stream().anyMatch(role -> !permissions.of(actor).contains(required(role.getRole())))) throw denied();
            roles.deleteAll(held);
            if (!held.isEmpty()) removed = ", 직책 해제 " + held.stream()
                    .map(role -> describe(role.getRole(), role.getDepartment(), role.getUnit(), role.getPart()))
                    .collect(Collectors.joining("/"));
        }
        target.updateProfile(part, cohort, type, clock);
        logs.save(new AdminActionLog(actor, target, "PROFILE_UPDATE", target.getStatus(), target.getStatus(),
                (part == null ? "파트 없음" : part.name()) + ", 기수 " + (cohort == null ? "없음" : cohort)
                        + ", 구분 " + (type == before ? String.valueOf(type) : before + "→" + type) + removed, clock.instant()));
    }

    @Transactional
    public void setSiteAdmin(long actorId, long targetId, boolean siteAdmin) {
        Locked locked = lock(actorId, targetId, Permission.MANAGE_SITE_ADMINS);
        Member actor = locked.actor();
        if (actorId == targetId && !siteAdmin) {
            throw new ApiException(HttpStatus.CONFLICT, "SELF_DEMOTION", "자기 자신의 사이트 관리자 권한은 해제할 수 없습니다.");
        }
        Member target = siteAdmin ? eligible(locked.target()) : locked.target();
        target.setSiteAdmin(siteAdmin, clock);
        logs.save(new AdminActionLog(actor, target, siteAdmin ? "SITE_ADMIN_GRANT" : "SITE_ADMIN_REVOKE",
                target.getStatus(), target.getStatus(), null, clock.instant()));
    }

    // 단장·부단장 지정은 사이트 관리자만, 나머지 직책은 직책 관리 권한으로 합니다.
    private static Permission required(Role role) {
        return role == Role.PRESIDENT || role == Role.VICE_PRESIDENT ? Permission.MANAGE_SITE_ADMINS : Permission.MANAGE_ROLES;
    }

    private static void validate(Role role, Department department, Unit unit, Part part) {
        boolean valid = switch (role) {
            case DEPARTMENT_HEAD -> department != null && unit == null && part == null;
            case DEPARTMENT_MEMBER -> department != null && unit != null && unit.department() == department && part == null;
            case SECTION_LEAD -> part != null && department == null && unit == null;
            default -> department == null && unit == null && part == null;
        };
        if (!valid) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ROLE", "직책과 부서·계·파트 조합을 확인해 주세요.");
    }

    // MemberApprovalService.lockMembers와 같은 순서(작은 id 먼저)로 잠가 교착을 피합니다.
    private Locked lock(long actorId, long targetId, Permission required) {
        Member first = locked(Math.min(actorId, targetId));
        Member second = actorId == targetId ? first : locked(Math.max(actorId, targetId));
        Member actor = first.getId() == actorId ? first : second;
        Member target = first.getId() == targetId ? first : second;
        if (!permissions.of(actor).contains(required)) throw denied();
        return new Locked(actor, target);
    }

    private Member locked(long id) {
        return members.findByIdForUpdate(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "계정을 찾을 수 없습니다."));
    }

    private static ApiException denied() {
        return new ApiException(HttpStatus.FORBIDDEN, "PERMISSION_REQUIRED", "이 기능을 쓸 권한이 없습니다.");
    }

    private record Locked(Member actor, Member target) {}

    private static Member eligible(Member target) {
        if (target.getStatus() != AccountStatus.APPROVED || target.getMemberType() != MemberType.ACTIVE) {
            throw new ApiException(HttpStatus.CONFLICT, "ROLE_NOT_ALLOWED", "승인된 활동 단원에게만 직책을 줄 수 있습니다.");
        }
        return target;
    }

    private static String describe(Role role, Department department, Unit unit, Part part) {
        return role.name() + (department == null ? "" : " " + department.name()) + (unit == null ? "" : " " + unit.name())
                + (part == null ? "" : " " + part.name());
    }
}
