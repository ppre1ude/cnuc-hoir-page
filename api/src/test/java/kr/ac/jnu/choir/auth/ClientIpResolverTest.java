package kr.ac.jnu.choir.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import kr.ac.jnu.choir.common.ApiException;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class ClientIpResolverTest {
    @Test void ignoresForwardedHeaderWithoutTrustedRemote() {
        var request = new MockHttpServletRequest();
        request.setRemoteAddr("198.51.100.5");
        request.addHeader("X-Forwarded-For", "203.0.113.99");
        assertThat(new ClientIpResolver("", false).resolve(request)).isEqualTo("198.51.100.5");
    }

    @Test void refusesPortalStartupWithoutAnExplicitTrustedProxy() {
        assertThatThrownBy(() -> new ClientIpResolver("", true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("신뢰 프록시");
    }

    @Test void choosesRightmostUntrustedHopAndRejectsMalformedChain() {
        var request = new MockHttpServletRequest();
        request.setRemoteAddr("10.0.0.8");
        request.addHeader("X-Forwarded-For", "203.0.113.99, 198.51.100.7, 10.0.0.7");
        assertThat(new ClientIpResolver("10.0.0.0/8", true).resolve(request)).isEqualTo("198.51.100.7");

        var malformed = new MockHttpServletRequest();
        malformed.setRemoteAddr("10.0.0.8");
        malformed.addHeader("X-Forwarded-For", "198.51.100.7, not-an-ip");
        assertThatThrownBy(() -> new ClientIpResolver("10.0.0.0/8", true).resolve(malformed))
                .isInstanceOf(ApiException.class)
                .satisfies(error -> assertThat(((ApiException) error).getStatus().value()).isEqualTo(400));

        var missing = new MockHttpServletRequest();
        missing.setRemoteAddr("10.0.0.8");
        assertThatThrownBy(() -> new ClientIpResolver("10.0.0.0/8", true).resolve(missing))
                .isInstanceOf(ApiException.class);

        var oversized = new MockHttpServletRequest();
        oversized.setRemoteAddr("10.0.0.8");
        oversized.addHeader("X-Forwarded-For", "1".repeat(2049));
        assertThatThrownBy(() -> new ClientIpResolver("10.0.0.0/8", true).resolve(oversized))
                .isInstanceOf(ApiException.class);

        var onlyProxies = new MockHttpServletRequest();
        onlyProxies.setRemoteAddr("10.0.0.8");
        onlyProxies.addHeader("X-Forwarded-For", "10.0.0.7");
        assertThatThrownBy(() -> new ClientIpResolver("10.0.0.0/8", true).resolve(onlyProxies))
                .isInstanceOf(ApiException.class);
    }
}
