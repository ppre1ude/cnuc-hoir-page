package kr.ac.jnu.choir.member;

import kr.ac.jnu.choir.auth.Permission;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Email;
import java.time.Instant;
import java.util.List;
import kr.ac.jnu.choir.auth.PermissionService;
import kr.ac.jnu.choir.auth.SessionMemberService;
import kr.ac.jnu.choir.common.ApiException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminMemberController {
    private final SessionMemberService sessions;
    private final MemberApprovalService approvals;
    private final MemberInvitationService invitations;
    private final MemberRepository members;
    private final MemberRoleRepository roles;
    private final PermissionService permissions;

    public AdminMemberController(SessionMemberService sessions, MemberApprovalService approvals,
            MemberInvitationService invitations, MemberRepository members, MemberRoleRepository roles,
            PermissionService permissions) {
        this.permissions = permissions;
        this.roles = roles;
        this.sessions = sessions;
        this.approvals = approvals;
        this.invitations = invitations;
        this.members = members;
    }

    @GetMapping("/members")
    public MemberPage members(HttpServletRequest request, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Member actor = sessions.require(request, Permission.VIEW_MEMBERS);
        var held = permissions.of(actor);
        // 이메일과 구글 연결 여부는 승인·직책 관리 권한이 있는 사람에게만 보입니다.
        boolean reveal = held.contains(Permission.APPROVE_APPLICATIONS) || held.contains(Permission.MANAGE_ROLES);
        // 계정 목록 화면은 검색과 파트 필터를 브라우저에서 하려고 전체를 한 번에 받습니다. 단원이 수천 명이 되면 서버 검색으로 바꿉니다.
        if (page < 0 || size < 1 || size > 1000) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGE", "조회 조건을 확인해 주세요.");
        }
        Page<Member> result = members.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size));
        var rolesByMember = roles.findByMemberIdIn(result.getContent().stream().map(Member::getId).toList()).stream()
                .collect(java.util.stream.Collectors.groupingBy(role -> role.getMember().getId()));
        return new MemberPage(result.getContent().stream().map(member -> new MemberItem(member.getId(),
                member.getName(), reveal ? member.getEmail() : null, member.getStatus(), member.getMemberType(),
                member.isAdmin(), reveal && member.getGoogleSubject() != null, member.getCreatedAt(),
                member.getPart(), member.getCohort(),
                rolesByMember.getOrDefault(member.getId(), List.of()).stream()
                        .map(AdminMemberRoleController::item).toList())).toList(), page, size, result.getTotalElements());
    }

    @PostMapping("/members/invitations")
    public MemberInvitationService.IssuedInvitation invite(HttpServletRequest request,
            @Valid @RequestBody InviteRequest body) {
        return invitations.create(sessions.require(request, Permission.APPROVE_APPLICATIONS), body.email(), body.name(), body.memberType());
    }

    @PostMapping("/members/{id}/account-setup")
    public MemberInvitationService.IssuedInvitation reissue(HttpServletRequest request, @PathVariable long id) {
        return invitations.reissue(sessions.require(request, Permission.APPROVE_APPLICATIONS), id);
    }

    @GetMapping("/applications")
    public ApplicationPage applications(HttpServletRequest request,
            @RequestParam(defaultValue = "APPROVAL_PENDING") AccountStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        sessions.require(request, Permission.APPROVE_APPLICATIONS);
        if (status != AccountStatus.APPROVAL_PENDING || page < 0 || size < 1 || size > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGE", "조회 조건을 확인해 주세요.");
        }
        Page<Member> result = approvals.applications(status, page, size);
        List<ApplicationItem> items = result.getContent().stream()
                .map(member -> new ApplicationItem(member.getId(), member.getName(), member.getEmail(),
                        member.getStatus(), member.getCreatedAt(), member.getPart(), member.getCohort())).toList();
        return new ApplicationPage(items, page, size, result.getTotalElements());
    }

    @PostMapping("/applications/{id}/approve")
    public ResponseEntity<Void> approve(HttpServletRequest request, @PathVariable Long id,
            @Valid @RequestBody ApproveRequest body) {
        approvals.approve(sessions.require(request, Permission.APPROVE_APPLICATIONS), id, body.memberType());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/applications/{id}/reject")
    public ResponseEntity<Void> reject(HttpServletRequest request, @PathVariable Long id,
            @Valid @RequestBody ReasonRequest body) {
        approvals.reject(sessions.require(request, Permission.APPROVE_APPLICATIONS), id, body.reason().strip());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/applications/{id}/cancel-rejection")
    public ResponseEntity<Void> cancelRejection(HttpServletRequest request, @PathVariable Long id) {
        approvals.cancelRejection(sessions.require(request, Permission.APPROVE_APPLICATIONS), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/members/{id}/revoke")
    public ResponseEntity<Void> revoke(HttpServletRequest request, @PathVariable Long id,
            @Valid @RequestBody ReasonRequest body) {
        approvals.revoke(sessions.require(request, Permission.REVOKE_ACCESS), id, body.reason().strip());
        return ResponseEntity.noContent().build();
    }

    public record ApproveRequest(@NotNull MemberType memberType) {}
    public record InviteRequest(@NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 100) String name, @NotNull MemberType memberType) {}
    public record ReasonRequest(@NotBlank @Size(max = 500) String reason) {}
    public record MemberItem(Long id, String name, String email /* 권한 없으면 null */, AccountStatus status,
            MemberType memberType, boolean admin, boolean googleLinked, Instant createdAt,
            Part part, Integer cohort, List<AdminMemberRoleController.RoleItem> roles) {}
    public record MemberPage(List<MemberItem> items, int page, int size, long total) {}
    public record ApplicationItem(Long id, String name, String email, AccountStatus status, Instant createdAt,
            Part part, Integer cohort) {}
    public record ApplicationPage(List<ApplicationItem> items, int page, int size, long total) {}
}
