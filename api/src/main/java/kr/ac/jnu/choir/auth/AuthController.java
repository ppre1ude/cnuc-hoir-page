package kr.ac.jnu.choir.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import kr.ac.jnu.choir.member.Member;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final SessionMemberService sessions;
    private final LoginAttemptLimiter limiter;
    private final GoogleIdentityVerifier google;
    private final GoogleMemberService googleMembers;
    private final ClientIpResolver clientIps;

    public AuthController(SessionMemberService sessions, LoginAttemptLimiter limiter,
            GoogleIdentityVerifier google, GoogleMemberService googleMembers, ClientIpResolver clientIps) {
        this.sessions = sessions;
        this.limiter = limiter;
        this.google = google;
        this.googleMembers = googleMembers;
        this.clientIps = clientIps;
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getToken());
    }

    @PostMapping("/google")
    public MeResponse login(@Valid @RequestBody GoogleRequest body, HttpServletRequest request) {
        String ip = clientIps.resolve(request);
        limiter.reserve("GOOGLE_IP", ip, 50);
        Member member = googleMembers.login(google.verify(body.credential()));
        establishSession(request, member);
        return response(member);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        sessions.current(request);
        request.getSession(false).invalidate();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public MeResponse me(HttpServletRequest request) {
        var member = sessions.current(request);
        return response(member);
    }

    @PostMapping("/account-setup/confirm")
    public MeResponse completeSetup(@Valid @RequestBody CompleteSetupRequest body, HttpServletRequest request) {
        limiter.reserve("CONNECT_IP", clientIps.resolve(request), 20);
        Member member = googleMembers.connect(body.token(), google.verify(body.credential()));
        establishSession(request, member);
        return response(member);
    }

    private static void establishSession(HttpServletRequest request, Member member) {
        HttpSession session = request.getSession();
        request.changeSessionId();
        session.setAttribute("memberId", member.getId());
        session.setAttribute("authVersion", member.getAuthVersion());
    }

    private static MeResponse response(Member member) {
        return new MeResponse(member.getId(), member.getName(), member.getStatus().name(),
                member.getMemberType() == null ? null : member.getMemberType().name(), member.isAdmin());
    }

    public record CsrfResponse(String token) {}
    public record GoogleRequest(@NotBlank String credential) {}
    public record CompleteSetupRequest(@NotBlank String token, @NotBlank String credential) {}
    public record MeResponse(Long id, String name, String status, String memberType, boolean admin) {}
}
