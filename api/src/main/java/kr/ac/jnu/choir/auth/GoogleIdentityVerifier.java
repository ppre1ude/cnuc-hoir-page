package kr.ac.jnu.choir.auth;

import java.util.Locale;
import kr.ac.jnu.choir.common.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;

@Service
public class GoogleIdentityVerifier {
    private final String clientId;
    private final NimbusJwtDecoder decoder;

    public GoogleIdentityVerifier(@Value("${choir.google.client-id:}") String clientId) {
        this.clientId = clientId;
        this.decoder = NimbusJwtDecoder.withJwkSetUri("https://www.googleapis.com/oauth2/v3/certs").build();
        this.decoder.setJwtValidator(JwtValidators.createDefault());
    }

    public GoogleIdentity verify(String credential) {
        if (clientId.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "GOOGLE_NOT_CONFIGURED",
                    "구글 로그인이 준비되지 않았습니다.");
        }
        if (credential == null || credential.length() > 8192) throw invalid();
        Jwt jwt;
        try {
            jwt = decoder.decode(credential);
        } catch (JwtException exception) {
            throw invalid();
        }
        return extract(jwt, clientId);
    }

    static GoogleIdentity extract(Jwt jwt, String clientId) {
        String issuer = jwt.getIssuer() == null ? "" : jwt.getIssuer().toString();
        String subject = jwt.getSubject();
        String email = jwt.getClaimAsString("email");
        if (!(issuer.equals("https://accounts.google.com") || issuer.equals("accounts.google.com"))
                || jwt.getAudience() == null || !jwt.getAudience().contains(clientId)
                || jwt.getAudience().size() != 1 || subject == null || subject.isBlank() || subject.length() > 255
                || email == null || email.isBlank() || !Boolean.TRUE.equals(jwt.getClaim("email_verified"))) {
            throw invalid();
        }
        String normalized = email.strip().toLowerCase(Locale.ROOT);
        if (normalized.length() > 320 || !normalized.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw invalid();
        String domain = normalized.substring(normalized.lastIndexOf('@') + 1);
        String hostedDomain = jwt.getClaimAsString("hd");
        boolean authoritative = domain.equals("gmail.com")
                || (hostedDomain != null && hostedDomain.equalsIgnoreCase(domain));
        String name = jwt.getClaimAsString("name");
        if (name == null || name.isBlank()) name = normalized.substring(0, normalized.indexOf('@'));
        name = name.strip();
        if (name.length() > 100) name = name.substring(0, 100);
        return new GoogleIdentity(subject, normalized, name, authoritative);
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_GOOGLE_CREDENTIAL", "구글 인증을 확인하지 못했습니다.");
    }

    public record GoogleIdentity(String subject, String email, String name, boolean authoritativeEmail) {}
}
