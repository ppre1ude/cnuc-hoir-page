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
    private final RegistrationService registration;
    private final MemberRepository members;
    private final SessionMemberService sessions;
    private final LoginAttemptLimiter limiter;
    private final PasswordResetService resets;

    public AuthController(RegistrationService registration, MemberRepository members,
            SessionMemberService sessions, LoginAttemptLimiter limiter, PasswordResetService resets) {
        this.registration = registration;
        this.members = members;
        this.sessions = sessions;
        this.limiter = limiter;
        this.resets = resets;
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getToken());
    }

    @PostMapping("/applications")
    public ResponseEntity<Void> apply(@Valid @RequestBody ApplicationRequest request) {
        registration.apply(request.email(), request.password(), request.name());
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }

    @PostMapping("/verify-email")
    public ResponseEntity<Void> verify(@Valid @RequestBody VerificationRequest request) {
        registration.verifyEmail(request.token());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<Void> resend(@Valid @RequestBody ResendRequest request) {
        registration.resendVerification(request.email());
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }

    @PostMapping("/login")
    public ResponseEntity<Void> login(@Valid @RequestBody LoginRequest body, HttpServletRequest request) {
        String email = body.email().strip().toLowerCase(Locale.ROOT);
        String ip = request.getRemoteAddr();
        limiter.reserve("LOGIN_IP", ip, 5);
        try {
            limiter.reserve("LOGIN_EMAIL", email, 5);
        } catch (ApiException exception) {
            limiter.release("LOGIN_IP", ip);
            throw exception;
        }
        var member = members.findByEmailIgnoreCase(email).orElse(null);
        boolean valid = member != null && member.getStatus() != AccountStatus.REVOKED && PasswordEncoderFactories.createDelegatingPasswordEncoder()
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

    @PostMapping("/password-reset/request")
    public ResponseEntity<Void> requestReset(@Valid @RequestBody ResendRequest body, HttpServletRequest request) {
        resets.request(body.email(), request.getRemoteAddr());
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<Void> confirmReset(@Valid @RequestBody ConfirmResetRequest body) {
        resets.confirm(body.token(), body.newPassword());
        return ResponseEntity.noContent().build();
    }

    public record CsrfResponse(String token) {}
    public record ApplicationRequest(@NotBlank String email, @NotBlank String password, @NotBlank String name) {}
    public record VerificationRequest(@NotBlank String token) {}
    public record ResendRequest(@NotBlank String email) {}
    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}
    public record ConfirmResetRequest(@NotBlank String token, @NotBlank String newPassword) {}
    public record MeResponse(Long id, String name, String status, String memberType, boolean admin) {}
}
