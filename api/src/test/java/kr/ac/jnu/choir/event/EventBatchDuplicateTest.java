package kr.ac.jnu.choir.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Clock;
import java.util.UUID;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest
@Testcontainers
class EventBatchDuplicateTest {
    @Container static final PostgreSQLContainer database = new PostgreSQLContainer("postgres:17-alpine");
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
        jdbc.update("DELETE FROM event");
    }

    private MockHttpSession admin() {
        Member member = members.save(new Member(UUID.randomUUID() + "@example.org", "운영진", "{noop}password", Clock.systemUTC()));
        jdbc.update("UPDATE member SET status = 'APPROVED', member_type = 'ACTIVE', admin = TRUE, email_verified_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
                member.getId());
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("memberId", member.getId());
        session.setAttribute("authVersion", member.getAuthVersion());
        return session;
    }

    private MockHttpServletResponse batch(MockHttpSession session, String... starts) throws Exception {
        return titledBatch(session, "정기 연습", starts);
    }

    private MockHttpServletResponse titledBatch(MockHttpSession session, String title, String... starts) throws Exception {
        String[][] items = new String[starts.length][];
        for (int index = 0; index < starts.length; index++) items[index] = new String[] {title, starts[index]};
        return send(session, items);
    }

    private MockHttpServletResponse send(MockHttpSession session, String[]... items) throws Exception {
        String csrf = mvc.perform(get("/api/v1/auth/csrf").session(session)).andReturn().getResponse()
                .getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
        StringBuilder events = new StringBuilder();
        for (String[] item : items) {
            if (!events.isEmpty()) events.append(',');
            String end = item[1].replace("T10:", "T12:");
            events.append("{\"title\":\"").append(item[0]).append("\",\"description\":\"\",\"startAt\":\"").append(item[1])
                    .append("\",\"endAt\":\"").append(end).append("\",\"obEligible\":false,\"publicVisible\":false}");
        }
        return mvc.perform(post("/api/v1/admin/events/batch").session(session).header("X-CSRF-TOKEN", csrf)
                .contentType("application/json").content("{\"events\":[" + events + "]}")).andReturn().getResponse();
    }

    @Test void batchThatRepeatsSavedStartTimeIsRejectedWithSeoulTimeAndSavesNothing() throws Exception {
        MockHttpSession session = admin();
        assertThat(batch(session, "2099-10-04T10:00:00Z", "2099-10-11T10:00:00Z").getStatus()).isEqualTo(201);

        MockHttpServletResponse retry = batch(session, "2099-10-11T10:00:00Z", "2099-10-18T10:00:00Z");
        assertThat(retry.getStatus()).isEqualTo(409);
        assertThat(retry.getContentAsString()).contains("DUPLICATE_EVENT_TIME", "2099년 10월 11일 19:00");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM event", Long.class)).isEqualTo(2);

        assertThat(batch(session, "2099-10-18T10:00:00Z", "2099-10-25T10:00:00Z").getStatus()).isEqualTo(201);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM event", Long.class)).isEqualTo(4);
    }

    @Test void partRehearsalsWithDifferentTitlesMayStartAtTheSameTime() throws Exception {
        MockHttpSession session = admin();
        assertThat(titledBatch(session, "소프라노 파트연습", "2099-11-03T10:00:00Z").getStatus()).isEqualTo(201);
        assertThat(titledBatch(session, "알토 파트연습", "2099-11-03T10:00:00Z").getStatus()).isEqualTo(201);
        assertThat(titledBatch(session, "알토 파트연습", "2099-11-03T10:00:00Z").getStatus()).isEqualTo(409);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM event", Long.class)).isEqualTo(2);
    }

    @Test void oneBatchMayHoldDifferentTitlesAtTheSameTimeButNotTheSameTitleTwice() throws Exception {
        MockHttpSession session = admin();
        assertThat(send(session, new String[] {"테너 파트연습", "2099-12-01T10:00:00Z"},
                new String[] {"베이스 파트연습", "2099-12-01T10:00:00Z"}).getStatus()).isEqualTo(201);
        assertThat(send(session, new String[] {"정기 연습", "2099-12-08T10:00:00Z"},
                new String[] {"정기 연습", "2099-12-08T10:00:00Z"}).getStatus()).isEqualTo(400);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM event", Long.class)).isEqualTo(2);
    }
}
