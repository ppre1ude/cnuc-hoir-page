package kr.ac.jnu.choir.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import kr.ac.jnu.choir.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

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

    @Test void distinguishesInvalidCredentialsFromGoogleKeyServiceFailure() {
        NimbusJwtDecoder decoder = mock(NimbusJwtDecoder.class);
        GoogleIdentityVerifier verifier = new GoogleIdentityVerifier(CLIENT, decoder);
        when(decoder.decode("invalid")).thenThrow(new BadJwtException("invalid"));
        when(decoder.decode("unavailable")).thenThrow(new JwtException("key service unavailable"));

        assertThatThrownBy(() -> verifier.verify("invalid"))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    assertThat(error.getCode()).isEqualTo("INVALID_GOOGLE_CREDENTIAL");
                });
        assertThatThrownBy(() -> verifier.verify("unavailable"))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                    assertThat(error.getCode()).isEqualTo("GOOGLE_AUTH_UNAVAILABLE");
                });
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
