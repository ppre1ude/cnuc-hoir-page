package kr.ac.jnu.choir.member;

import java.time.Clock;
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
        Member actor = permissions.require(actorId, required(role));
        validate(role, department, unit, part);
        Member target = eligible(targetId);
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
        MemberRole existing = roles.findById(roleId)
                .filter(role -> role.getMember().getId().equals(targetId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ROLE_NOT_FOUND", "직책을 찾을 수 없습니다."));
        Member actor = permissions.require(actorId, required(existing.getRole()));
        Member target = existing.getMember();
        roles.delete(existing);
        logs.save(new AdminActionLog(actor, target, "ROLE_REMOVE", target.getStatus(), target.getStatus(),
                describe(existing.getRole(), existing.getDepartment(), existing.getUnit(), existing.getPart()), clock.instant()));
    }

    @Transactional
    public void updateProfile(long actorId, long targetId, Part part, Integer cohort) {
        Member actor = permissions.require(actorId, Permission.MANAGE_ROLES);
        if (cohort != null && cohort < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_COHORT", "기수는 1 이상이어야 합니다.");
        }
        Member target = members.findByIdForUpdate(targetId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "계정을 찾을 수 없습니다."));
        target.updateProfile(part, cohort, clock);
        logs.save(new AdminActionLog(actor, target, "PROFILE_UPDATE", target.getStatus(), target.getStatus(),
                (part == null ? "파트 없음" : part.name()) + ", 기수 " + (cohort == null ? "없음" : cohort), clock.instant()));
    }

    @Transactional
    public void setSiteAdmin(long actorId, long targetId, boolean siteAdmin) {
        Member actor = permissions.require(actorId, Permission.MANAGE_SITE_ADMINS);
        if (actorId == targetId && !siteAdmin) {
            throw new ApiException(HttpStatus.CONFLICT, "SELF_DEMOTION", "자기 자신의 사이트 관리자 권한은 해제할 수 없습니다.");
        }
        Member target = siteAdmin ? eligible(targetId) : members.findByIdForUpdate(targetId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "계정을 찾을 수 없습니다."));
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

    private Member eligible(long targetId) {
        Member target = members.findByIdForUpdate(targetId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "계정을 찾을 수 없습니다."));
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
