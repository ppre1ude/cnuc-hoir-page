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
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@Testcontainers
class AuthMeResponseTest {
    @Container static final PostgreSQLContainer database = new PostgreSQLContainer("postgres:17-alpine");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", database::getJdbcUrl);
        registry.add("spring.datasource.username", database::getUsername);
        registry.add("spring.datasource.password", database::getPassword);
    }
    @Autowired WebApplicationContext context;
    @Autowired FilterChainProxy security;
    @MockitoBean GoogleIdentityVerifier google;

    @Test void loginAndMeReturnTheSignedInGoogleEmail() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
        MockHttpSession session = new MockHttpSession();
        String credential = "credential-" + UUID.randomUUID();
        String email = "pending-" + UUID.randomUUID() + "@example.org";
        String csrf = field(mvc.perform(get("/api/v1/auth/csrf").session(session))
                .andReturn().getResponse().getContentAsString(), "token");
        String nonce = field(mvc.perform(get("/api/v1/auth/google/nonce").session(session))
                .andReturn().getResponse().getContentAsString(), "nonce");
        when(google.verify(credential)).thenReturn(
                new GoogleIdentity("sub-" + UUID.randomUUID(), email, "신청자", false, nonce));

        String login = mvc.perform(post("/api/v1/auth/google").session(session)
                .header("X-CSRF-TOKEN", csrf).contentType("application/json")
                .content("{\"credential\":\"" + credential + "\"}"))
                .andReturn().getResponse().getContentAsString();
        assertThat(field(login, "email")).isEqualTo(email);
        assertThat(field(login, "status")).isEqualTo("APPROVAL_PENDING");

        String me = mvc.perform(get("/api/v1/auth/me").session(session))
                .andReturn().getResponse().getContentAsString();
        assertThat(field(me, "email")).isEqualTo(email);
    }

    private static String field(String json, String name) throws Exception {
        return new ObjectMapper().readTree(json).path(name).asText();
    }
}
