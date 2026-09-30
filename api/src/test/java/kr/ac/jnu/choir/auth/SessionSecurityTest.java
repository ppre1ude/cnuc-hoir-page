package kr.ac.jnu.choir.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.UUID;
import kr.ac.jnu.choir.auth.GoogleIdentityVerifier.GoogleIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest
@Testcontainers
class SessionSecurityTest {
    @Container static final PostgreSQLContainer database = new PostgreSQLContainer("postgres:17-alpine");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", database::getJdbcUrl);
        registry.add("spring.datasource.username", database::getUsername);
        registry.add("spring.datasource.password", database::getPassword);
        registry.add("choir.security.trusted-proxy-cidrs", () -> "10.0.0.0/8");
    }
    @Autowired WebApplicationContext context;
    @Autowired FilterChainProxy security;
    @MockitoBean GoogleIdentityVerifier google;

    @Test void googleLoginRequiresCsrfAndPasswordEndpointIsClosed() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
        MockHttpSession session = new MockHttpSession();
        String credential = "credential-" + UUID.randomUUID();
        when(google.verify(credential)).thenReturn(new GoogleIdentity("sub-" + UUID.randomUUID(),
                "pending-" + UUID.randomUUID() + "@example.org", "단원", false));
        assertThat(mvc.perform(post("/api/v1/auth/google").session(session)
                .contentType("application/json").content("{\"credential\":\"" + credential + "\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(403);
        String csrf = csrf(mvc, session);
        assertThat(mvc.perform(post("/api/v1/auth/google").session(session)
                .header("X-CSRF-TOKEN", csrf).contentType("application/json")
                .content("{\"credential\":\"" + credential + "\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(200);
        assertThat(mvc.perform(get("/api/v1/auth/me").session(session))
                .andReturn().getResponse().getStatus()).isEqualTo(200);
        assertThat(mvc.perform(post("/api/v1/auth/login").session(session)
                .header("X-CSRF-TOKEN", csrf).contentType("application/json")
                .content("{\"email\":\"old@example.org\",\"password\":\"secret\"}"))
                .andReturn().getResponse().getStatus()).isNotEqualTo(200);
        assertThat(mvc.perform(post("/api/v1/auth/logout").session(session)
                .header("X-CSRF-TOKEN", csrf)).andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(mvc.perform(get("/api/v1/auth/me").session(session))
                .andReturn().getResponse().getStatus()).isEqualTo(401);
    }

    @Test void rejectsUntrustedProxyChainBeforeGoogleVerification() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
        MockHttpSession session = new MockHttpSession();
        String csrf = csrf(mvc, session);
        assertThat(mvc.perform(post("/api/v1/auth/google").session(session)
                .header("X-CSRF-TOKEN", csrf).remoteAddress("10.0.0.9")
                .header("X-Forwarded-For", "not-an-ip")
                .contentType("application/json").content("{\"credential\":\"invalid\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(400);
    }

    private String csrf(MockMvc mvc, MockHttpSession session) throws Exception {
        String response = mvc.perform(get("/api/v1/auth/csrf").session(session))
                .andReturn().getResponse().getContentAsString();
        return response.split("\"token\":\"", 2)[1].split("\"", 2)[0];
    }
}
