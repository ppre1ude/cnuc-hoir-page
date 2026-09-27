package kr.ac.jnu.choir.member;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import kr.ac.jnu.choir.auth.SessionMemberService;
import kr.ac.jnu.choir.common.ApiException;
import org.springframework.data.domain.Page;
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

    public AdminMemberController(SessionMemberService sessions, MemberApprovalService approvals) {
        this.sessions = sessions;
        this.approvals = approvals;
    }

    @GetMapping("/applications")
    public ApplicationPage applications(HttpServletRequest request,
            @RequestParam(defaultValue = "APPROVAL_PENDING") AccountStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        sessions.requireAdmin(request);
        if (status != AccountStatus.APPROVAL_PENDING || page < 0 || size < 1 || size > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGE", "조회 조건을 확인해 주세요.");
        }
        Page<Member> result = approvals.applications(status, page, size);
        List<ApplicationItem> items = result.getContent().stream()
                .map(member -> new ApplicationItem(member.getId(), member.getName(), member.getEmail(),
                        member.getStatus(), member.getCreatedAt())).toList();
        return new ApplicationPage(items, page, size, result.getTotalElements());
    }

    @PostMapping("/applications/{id}/approve")
    public ResponseEntity<Void> approve(HttpServletRequest request, @PathVariable Long id,
            @Valid @RequestBody ApproveRequest body) {
        approvals.approve(sessions.requireAdmin(request), id, body.memberType());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/applications/{id}/reject")
    public ResponseEntity<Void> reject(HttpServletRequest request, @PathVariable Long id,
            @Valid @RequestBody ReasonRequest body) {
        approvals.reject(sessions.requireAdmin(request), id, body.reason().strip());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/members/{id}/revoke")
    public ResponseEntity<Void> revoke(HttpServletRequest request, @PathVariable Long id,
            @Valid @RequestBody ReasonRequest body) {
        approvals.revoke(sessions.requireAdmin(request), id, body.reason().strip());
        return ResponseEntity.noContent().build();
    }

    public record ApproveRequest(@NotNull MemberType memberType) {}
    public record ReasonRequest(@NotBlank @Size(max = 500) String reason) {}
    public record ApplicationItem(Long id, String name, String email, AccountStatus status, Instant createdAt) {}
    public record ApplicationPage(List<ApplicationItem> items, int page, int size, long total) {}
}
