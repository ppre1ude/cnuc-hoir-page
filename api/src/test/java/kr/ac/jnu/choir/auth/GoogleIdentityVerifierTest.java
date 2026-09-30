package kr.ac.jnu.choir.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import kr.ac.jnu.choir.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class GoogleIdentityVerifierTest {
    private static final String CLIENT = "choir-client.apps.googleusercontent.com";

    @Test void gmailCanUseAllowlistButExternalEmailNeedsReview() {
        assertThat(GoogleIdentityVerifier.extract(token("person@gmail.com", CLIENT, null, true), CLIENT)
                .authoritativeEmail()).isTrue();
        assertThat(GoogleIdentityVerifier.extract(token("person@example.org", CLIENT, null, true), CLIENT)
                .authoritativeEmail()).isFalse();
        assertThat(GoogleIdentityVerifier.extract(token("person@example.org", CLIENT, "example.org", true), CLIENT)
                .authoritativeEmail()).isTrue();
        assertThat(GoogleIdentityVerifier.extract(token("person@example.org", CLIENT, "other.org", true), CLIENT)
                .authoritativeEmail()).isFalse();
    }

    @Test void rejectsWrongAudienceIssuerAndUnverifiedEmail() {
        assertThatThrownBy(() -> GoogleIdentityVerifier.extract(token("person@gmail.com", "wrong", null, true), CLIENT))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> GoogleIdentityVerifier.extract(token("person@gmail.com", CLIENT, null, false), CLIENT))
                .isInstanceOf(ApiException.class);
        Jwt wrongIssuer = Jwt.withTokenValue("test").header("alg", "RS256")
                .issuer("https://other.example.org").subject("google-subject")
                .audience(List.of(CLIENT)).claim("email", "person@gmail.com")
                .claim("email_verified", true).claim("nonce", "test-nonce")
                .issuedAt(Instant.now().minusSeconds(30))
                .expiresAt(Instant.now().plusSeconds(300)).build();
        assertThatThrownBy(() -> GoogleIdentityVerifier.extract(wrongIssuer, CLIENT))
                .isInstanceOf(ApiException.class);
    }

    private Jwt token(String email, String audience, String hostedDomain, boolean verified) {
        var builder = Jwt.withTokenValue("test").header("alg", "RS256")
                .issuer("https://accounts.google.com").subject("google-subject")
                .audience(List.of(audience)).claim("email", email).claim("email_verified", verified)
                .claim("name", "단원").claim("nonce", "test-nonce").issuedAt(Instant.now().minusSeconds(30))
                .expiresAt(Instant.now().plusSeconds(300));
        if (hostedDomain != null) builder.claim("hd", hostedDomain);
        return builder.build();
    }
}
