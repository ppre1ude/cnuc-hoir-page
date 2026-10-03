package kr.ac.jnu.choir.member;

import kr.ac.jnu.choir.auth.Permission;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import kr.ac.jnu.choir.auth.SessionMemberService;
import kr.ac.jnu.choir.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/operator-preapprovals")
public class AdminOperatorPreapprovalController {
    private final SessionMemberService sessions;
    private final OperatorPreapprovalService service;

    public AdminOperatorPreapprovalController(SessionMemberService sessions, OperatorPreapprovalService service) {
        this.sessions = sessions;
        this.service = service;
    }

    @GetMapping
    public PreapprovalPage list(HttpServletRequest request, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        sessions.require(request, Permission.MANAGE_SITE_ADMINS);
        if (page < 0 || size < 1 || size > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGE", "조회 조건을 확인해 주세요.");
        }
        var result = service.list(page, size);
        return new PreapprovalPage(result.getContent().stream().map(AdminOperatorPreapprovalController::item).toList(),
                page, size, result.getTotalElements());
    }

    @PostMapping
    public PreapprovalItem add(HttpServletRequest request, @Valid @RequestBody AddRequest body) {
        return item(service.add(sessions.require(request, Permission.MANAGE_SITE_ADMINS).getId(), body.email(), body.memberType()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> remove(HttpServletRequest request, @PathVariable long id) {
        service.remove(sessions.require(request, Permission.MANAGE_SITE_ADMINS).getId(), id);
        return ResponseEntity.noContent().build();
    }

    private static PreapprovalItem item(OperatorPreapproval entry) {
        return new PreapprovalItem(entry.getId(), entry.getEmail(), entry.getMemberType(), entry.getCreatedAt());
    }

    public record AddRequest(@NotBlank @Email @Size(max = 254) String email, @NotNull MemberType memberType) {}
    public record PreapprovalItem(Long id, String email, MemberType memberType, Instant createdAt) {}
    public record PreapprovalPage(List<PreapprovalItem> items, int page, int size, long total) {}
}
