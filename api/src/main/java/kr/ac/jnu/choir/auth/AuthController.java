package kr.ac.jnu.choir.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.Locale;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.member.MemberRepository;
import kr.ac.jnu.choir.member.AccountStatus;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.http.HttpStatus;
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
    private final MemberRepository members;
    private final SessionMemberService sessions;
    private final LoginAttemptLimiter limiter;
    private final AccountSetupService accountSetup;
    private final ClientIpResolver clientIps;

    public AuthController(MemberRepository members,
            SessionMemberService sessions, LoginAttemptLimiter limiter, AccountSetupService accountSetup,
            ClientIpResolver clientIps) {
        this.members = members;
        this.sessions = sessions;
        this.limiter = limiter;
        this.accountSetup = accountSetup;
        this.clientIps = clientIps;
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getToken());
    }

    @PostMapping("/login")
    public ResponseEntity<Void> login(@Valid @RequestBody LoginRequest body, HttpServletRequest request) {
        String email = body.email().strip().toLowerCase(Locale.ROOT);
        String ip = clientIps.resolve(request);
        limiter.reserve("LOGIN_IP", ip, 5);
        try {
            limiter.reserve("LOGIN_EMAIL", email, 5);
        } catch (ApiException exception) {
            limiter.release("LOGIN_IP", ip);
            throw exception;
        }
        var member = members.findByEmailIgnoreCase(email).orElse(null);
        boolean valid = member != null && member.getStatus() == AccountStatus.APPROVED
                && member.getPasswordHash() != null && PasswordEncoderFactories.createDelegatingPasswordEncoder()
                .matches(body.password(), member.getPasswordHash());
        if (!valid) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.");
        }
        limiter.clear("LOGIN_EMAIL", email);
        limiter.release("LOGIN_IP", ip);
        HttpSession session = request.getSession();
        request.changeSessionId();
        session.setAttribute("memberId", member.getId());
        session.setAttribute("authVersion", member.getAuthVersion());
        return ResponseEntity.noContent().build();
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
        return new MeResponse(member.getId(), member.getName(), member.getStatus().name(),
                member.getMemberType() == null ? null : member.getMemberType().name(), member.isAdmin());
    }

    @PostMapping("/account-setup/confirm")
    public ResponseEntity<Void> completeSetup(@Valid @RequestBody CompleteSetupRequest body) {
        accountSetup.complete(body.token(), body.newPassword());
        return ResponseEntity.noContent().build();
    }

    public record CsrfResponse(String token) {}
    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}
    public record CompleteSetupRequest(@NotBlank String token, @NotBlank String newPassword) {}
    public record MeResponse(Long id, String name, String status, String memberType, boolean admin) {}
}
