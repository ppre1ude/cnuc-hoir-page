package kr.ac.jnu.choir.attendance;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

@SpringBootTest
@Testcontainers
@Import(ConcurrentCheckInTest.TestConfig.class)
class ConcurrentCheckInTest {
    @TestConfiguration static class TestConfig {
        @Bean @Primary Clock concurrentClock() {
            return Clock.fixed(Instant.parse("2026-09-27T10:00:00Z"), ZoneOffset.UTC);
        }
    }
    @Container static final MySQLContainer database = new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", database::getJdbcUrl);
        registry.add("spring.datasource.username", database::getUsername);
        registry.add("spring.datasource.password", database::getPassword);
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired MemberRepository members;
    @Autowired CheckInService service;

    private long event() {
        jdbc.update("INSERT INTO event (title,description,start_at,end_at,ob_eligible,public_visible,created_at,updated_at) "
                + "VALUES ('연습','설명','2026-09-27 09:00:00','2026-09-27 12:00:00',FALSE,FALSE,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))");
        return jdbc.queryForObject("SELECT MAX(id) FROM event", Long.class);
    }

    @Test void concurrentRequestsStoreOnlyOneAttendance() throws Exception {
        long eventId = event();
        Member member = members.save(new Member(UUID.randomUUID() + "@example.org", "단원", "{noop}password", Clock.systemUTC()));
        jdbc.update("UPDATE member SET status = 'APPROVED', member_type = 'ACTIVE' WHERE id = ?", member.getId());
        String code = service.open(eventId).code();
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var left = executor.submit(() -> attempt(start, eventId, member, code));
            var right = executor.submit(() -> attempt(start, eventId, member, code));
            start.countDown();
            assertThat(left.get(20, TimeUnit.SECONDS) ^ right.get(20, TimeUnit.SECONDS)).isTrue();
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM attendance WHERE event_id = ? AND member_id = ?",
                Long.class, eventId, member.getId())).isEqualTo(1);
    }

    @Test void concurrentOpenKeepsOneActiveSession() throws Exception {
        long eventId = event();
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var left = executor.submit(() -> open(start, eventId));
            var right = executor.submit(() -> open(start, eventId));
            start.countDown();
            assertThat(left.get(20, TimeUnit.SECONDS) ^ right.get(20, TimeUnit.SECONDS)).isTrue();
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM check_in_session WHERE event_id = ? AND closed_at IS NULL",
                Long.class, eventId)).isEqualTo(1);
    }

    private boolean attempt(CountDownLatch start, long eventId, Member member, String code) throws InterruptedException {
        start.await();
        try { service.checkIn(eventId, member, code); return true; }
        catch (ApiException expected) {
            assertThat(expected.getCode()).isEqualTo("ALREADY_CHECKED_IN");
            return false;
        }
    }

    private boolean open(CountDownLatch start, long eventId) throws InterruptedException {
        start.await();
        try { service.open(eventId); return true; }
        catch (ApiException expected) {
            assertThat(expected.getCode()).isEqualTo("SESSION_ALREADY_OPEN");
            return false;
        }
    }
}
