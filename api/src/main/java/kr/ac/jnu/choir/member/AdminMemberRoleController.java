package kr.ac.jnu.choir.member;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import kr.ac.jnu.choir.auth.Permission;
import kr.ac.jnu.choir.auth.SessionMemberService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/members/{id}")
public class AdminMemberRoleController {
    private final SessionMemberService sessions;
    private final MemberRoleService service;

    public AdminMemberRoleController(SessionMemberService sessions, MemberRoleService service) {
        this.sessions = sessions;
        this.service = service;
    }

    // 권한은 직책 종류에 따라 다르므로 서비스가 검사합니다. 여기서는 직책 관리 권한이 있는지만 봅니다.
    @PostMapping("/roles")
    public ResponseEntity<RoleItem> assign(HttpServletRequest request, @PathVariable long id, @Valid @RequestBody RoleInput body) {
        long actor = sessions.require(request, Permission.MANAGE_ROLES).getId();
        return ResponseEntity.status(HttpStatus.CREATED).body(item(service.assign(actor, id, body.role(),
                body.department(), body.unit(), body.part())));
    }

    @DeleteMapping("/roles/{roleId}")
    public ResponseEntity<Void> remove(HttpServletRequest request, @PathVariable long id, @PathVariable long roleId) {
        service.remove(sessions.require(request, Permission.MANAGE_ROLES).getId(), id, roleId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/profile")
    public ResponseEntity<Void> profile(HttpServletRequest request, @PathVariable long id, @RequestBody ProfileInput body) {
        service.updateProfile(sessions.require(request, Permission.MANAGE_ROLES).getId(), id, body.part(), body.cohort());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/site-admin")
    public ResponseEntity<Void> siteAdmin(HttpServletRequest request, @PathVariable long id, @Valid @RequestBody SiteAdminInput body) {
        service.setSiteAdmin(sessions.require(request, Permission.MANAGE_ROLES).getId(), id, body.admin());
        return ResponseEntity.noContent().build();
    }

    static RoleItem item(MemberRole role) {
        return new RoleItem(role.getId(), role.getRole(), role.getDepartment(), role.getUnit(), role.getPart());
    }

    public record RoleInput(@NotNull Role role, Department department, Unit unit, Part part) {}
    public record ProfileInput(Part part, Integer cohort) {}
    public record SiteAdminInput(@NotNull Boolean admin) {}
    public record RoleItem(Long id, Role role, Department department, Unit unit, Part part) {}
}
