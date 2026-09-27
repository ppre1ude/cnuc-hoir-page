package kr.ac.jnu.choir.attendance;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import kr.ac.jnu.choir.auth.ClientIpResolver;
import kr.ac.jnu.choir.auth.SessionMemberService;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.member.Member;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class AttendanceController {
    private final SessionMemberService sessions;
    private final ClientIpResolver ips;
    private final CheckInAttemptLimiter attempts;
    private final CheckInService checkIns;

    public AttendanceController(SessionMemberService sessions, ClientIpResolver ips,
            CheckInAttemptLimiter attempts, CheckInService checkIns) {
        this.sessions = sessions;
        this.ips = ips;
        this.attempts = attempts;
        this.checkIns = checkIns;
    }

    @PostMapping("/admin/events/{id}/check-in-session")
    public ResponseEntity<CheckInService.IssuedSession> open(HttpServletRequest request, @PathVariable long id) {
        sessions.requireAdmin(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(checkIns.open(id));
    }

    @PostMapping("/admin/events/{id}/check-in-session/{sessionId}/rotate")
    public CheckInService.IssuedSession rotate(HttpServletRequest request, @PathVariable long id,
            @PathVariable long sessionId) {
        sessions.requireAdmin(request);
        return checkIns.rotate(id, sessionId);
    }

    @PostMapping("/admin/events/{id}/check-in-session/close")
    public ResponseEntity<Void> close(HttpServletRequest request, @PathVariable long id) {
        sessions.requireAdmin(request);
        checkIns.close(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/admin/events/{id}/check-in-session")
    public CheckInService.SessionStatus session(HttpServletRequest request, @PathVariable long id) {
        sessions.requireAdmin(request);
        return checkIns.sessionStatus(id);
    }

    @PostMapping("/events/{id}/check-ins")
    public ResponseEntity<Void> checkIn(HttpServletRequest request, @PathVariable long id,
            @Valid @RequestBody CredentialInput input) {
        Member member = sessions.requireApproved(request);
        if (!attempts.reserve(member.getId(), ips.resolve(request))) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "잠시 후 다시 시도해 주세요.");
        }
        checkIns.checkIn(id, member, input.credential());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/events/{id}/attendance/me")
    public CheckInService.AttendanceState mine(HttpServletRequest request, @PathVariable long id) {
        return checkIns.mine(id, sessions.requireApproved(request));
    }

    @GetMapping("/attendance/me")
    public List<CheckInService.AttendanceState> myList(HttpServletRequest request) {
        return checkIns.myList(sessions.requireApproved(request));
    }

    @GetMapping("/admin/events/{id}/attendance")
    public List<CheckInService.AdminAttendance> adminList(HttpServletRequest request, @PathVariable long id) {
        sessions.requireAdmin(request);
        return checkIns.adminList(id);
    }

    @PutMapping("/admin/events/{id}/attendance/{memberId}")
    public ResponseEntity<Void> correct(HttpServletRequest request, @PathVariable long id,
            @PathVariable long memberId, @Valid @RequestBody CorrectionInput input) {
        Member actor = sessions.requireAdmin(request);
        checkIns.correct(id, memberId, actor, input.status(), input.reason());
        return ResponseEntity.noContent().build();
    }

    public record CredentialInput(@NotBlank @Size(max = 128) String credential) {}
    public record CorrectionInput(@NotBlank @Pattern(regexp = "CHECKED_IN|MISSED") String status,
            @NotBlank @Size(max = 500) String reason) {}
}
