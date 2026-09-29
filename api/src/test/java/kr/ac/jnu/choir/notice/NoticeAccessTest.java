package kr.ac.jnu.choir.notice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.Clock;
import java.util.UUID;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

@SpringBootTest
@Testcontainers
class NoticeAccessTest {
    @Container static final MySQLContainer database = new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", database::getJdbcUrl);
        registry.add("spring.datasource.username", database::getUsername);
        registry.add("spring.datasource.password", database::getPassword);
    }

    @Autowired WebApplicationContext context;
    @Autowired FilterChainProxy security;
    @Autowired MemberRepository members;
    @Autowired JdbcTemplate jdbc;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
        jdbc.update("DELETE FROM notice");
    }

    private Member member(String status, boolean admin) {
        Member member = members.save(new Member(UUID.randomUUID() + "@example.org", "작성자", "{noop}password", Clock.systemUTC()));
        jdbc.update("UPDATE member SET status = ?, admin = ?, email_verified_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
                status, admin, member.getId());
        return members.findById(member.getId()).orElseThrow();
    }

    private MockHttpSession session(Member member) {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("memberId", member.getId());
        session.setAttribute("authVersion", member.getAuthVersion());
        return session;
    }

    private String csrf(MockHttpSession session) throws Exception {
        return mvc.perform(get("/api/v1/auth/csrf").session(session)).andReturn().getResponse()
                .getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
    }

    private long create(Member admin, String title, boolean published) throws Exception {
        MockHttpSession session = session(admin);
        String body = "{\"title\":\"" + title + "\",\"body\":\"본문\",\"published\":" + published + "}";
        var response = mvc.perform(post("/api/v1/admin/notices").session(session).header("X-CSRF-TOKEN", csrf(session))
                .contentType("application/json").content(body)).andReturn().getResponse();
        assertThat(response.getStatus()).isEqualTo(201);
        return Long.parseLong(response.getContentAsString().split("\"id\":", 2)[1].split("[,}]", 2)[0]);
    }

    @Test void membershipAndDraftVisibility() throws Exception {
        Member admin = member("APPROVED", true);
        Member approved = member("APPROVED", false);
        Member pending = member("APPROVAL_PENDING", false);
        long published = create(admin, "게시 공지", true);
        long draft = create(admin, "초안", false);
        assertThat(mvc.perform(get("/api/v1/notices")).andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThat(mvc.perform(get("/api/v1/notices").session(session(pending))).andReturn().getResponse().getStatus()).isEqualTo(403);
        String list = mvc.perform(get("/api/v1/notices").session(session(approved))).andReturn().getResponse().getContentAsString();
        assertThat(list).contains("게시 공지").doesNotContain("초안");
        assertThat(mvc.perform(get("/api/v1/notices/" + published).session(session(approved))).andReturn().getResponse().getContentAsString()).contains("본문", "작성자", "publishedAt");
        assertThat(mvc.perform(get("/api/v1/notices/" + draft).session(session(approved))).andReturn().getResponse().getStatus()).isEqualTo(404);
        assertThat(mvc.perform(get("/api/v1/admin/notices/" + draft).session(session(admin))).andReturn().getResponse().getContentAsString()).contains("초안");
    }

    @Test void onlyAdminCanChangeAndPublishingUpdatesList() throws Exception {
        Member admin = member("APPROVED", true);
        Member approved = member("APPROVED", false);
        long draft = create(admin, "초안", false);
        MockHttpSession normal = session(approved);
        assertThat(mvc.perform(post("/api/v1/admin/notices").session(normal).header("X-CSRF-TOKEN", csrf(normal))
                .contentType("application/json").content("{\"title\":\"침입\",\"body\":\"본문\",\"published\":true}"))
                .andReturn().getResponse().getStatus()).isEqualTo(403);
        MockHttpSession editor = session(admin);
        assertThat(mvc.perform(put("/api/v1/admin/notices/" + draft).session(editor).header("X-CSRF-TOKEN", csrf(editor))
                .contentType("application/json").content("{\"title\":\"수정\",\"body\":\"새 본문\",\"published\":true}"))
                .andReturn().getResponse().getStatus()).isEqualTo(200);
        assertThat(mvc.perform(get("/api/v1/notices/" + draft).session(session(approved))).andReturn().getResponse().getContentAsString()).contains("수정", "새 본문");
    }

    @Test void publishedListIsPagedNewestFirst() throws Exception {
        Member admin = member("APPROVED", true);
        Member approved = member("APPROVED", false);
        create(admin, "이전", true);
        create(admin, "최근", true);
        String first = mvc.perform(get("/api/v1/notices?page=0&size=1").session(session(approved))).andReturn().getResponse().getContentAsString();
        String second = mvc.perform(get("/api/v1/notices?page=1&size=1").session(session(approved))).andReturn().getResponse().getContentAsString();
        assertThat(first).contains("최근", "\"page\":0", "\"size\":1").doesNotContain("이전");
        assertThat(second).contains("이전", "\"page\":1").doesNotContain("최근");
    }

    @Test void rejectsKoreanBodyBeyondSafeTextLimit() throws Exception {
        Member admin = member("APPROVED", true);
        MockHttpSession session = session(admin);
        String body = "{\"title\":\"길이 확인\",\"body\":\"" + "한".repeat(10001) + "\",\"published\":false}";
        assertThat(mvc.perform(post("/api/v1/admin/notices").session(session).header("X-CSRF-TOKEN", csrf(session))
                .contentType("application/json").content(body)).andReturn().getResponse().getStatus()).isEqualTo(400);
    }
}
