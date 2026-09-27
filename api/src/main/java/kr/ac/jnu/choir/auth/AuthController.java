package kr.ac.jnu.choir.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
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

    public AuthController(RegistrationService registration) {
        this.registration = registration;
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

    public record CsrfResponse(String token) {}
    public record ApplicationRequest(@NotBlank String email, @NotBlank String password, @NotBlank String name) {}
    public record VerificationRequest(@NotBlank String token) {}
    public record ResendRequest(@NotBlank String email) {}
}
