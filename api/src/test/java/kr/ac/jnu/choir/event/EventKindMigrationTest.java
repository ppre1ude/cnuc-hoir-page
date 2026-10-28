package kr.ac.jnu.choir.event;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.DriverManager;
import java.util.HashMap;
import java.util.Map;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

// V8이 V7까지 쌓인 일정을 제목으로 정기연습과 비정기연습에 나눠 담는지 봅니다.
@Testcontainers
class EventKindMigrationTest {
    @Container static final PostgreSQLContainer database = new PostgreSQLContainer("postgres:17-alpine");

    @Test void splitsFullRehearsalsAndRehearsalTitledEventsByTitle() throws Exception {
        migrate("7");
        Map<String, String> before = new HashMap<>();
        before.put("FULL_REHEARSAL|전체 정기연습", "REGULAR_REHEARSAL");
        before.put("FULL_REHEARSAL|전체 비정기연습", "EXTRA_REHEARSAL");
        before.put("EVENT|10월 전체 정기연습", "REGULAR_REHEARSAL");
        before.put("EVENT|10월 전체 비정기연습", "EXTRA_REHEARSAL");
        before.put("EVENT|최종 리허설", "EVENT");
        before.put("EVENT|소프라노 파트연습", "EVENT");
        before.put("EVENT|제2회 정기연주회", "EVENT");
        try (var connection = connect(); var insert = connection.prepareStatement(
                "INSERT INTO event (title,description,start_at,end_at,kind,part,ob_eligible,public_visible,created_at,updated_at) "
                        + "VALUES (?,'','2026-10-27 10:00:00','2026-10-27 12:00:00',?,NULL,FALSE,FALSE,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))")) {
            for (String row : before.keySet()) {
                String[] kindAndTitle = row.split("\\|");
                insert.setString(1, kindAndTitle[1]);
                insert.setString(2, kindAndTitle[0]);
                insert.executeUpdate();
            }
        }

        migrate(null);

        Map<String, String> expected = new HashMap<>();
        before.forEach((row, kind) -> expected.put(row.split("\\|")[1], kind));
        Map<String, String> after = new HashMap<>();
        try (var connection = connect(); var query = connection.createStatement();
                var result = query.executeQuery("SELECT title, kind FROM event")) {
            while (result.next()) after.put(result.getString(1), result.getString(2));
        }
        assertThat(after).containsExactlyInAnyOrderEntriesOf(expected);
    }

    private static void migrate(String target) {
        var configuration = Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
                .locations("classpath:db/postgresql");
        (target == null ? configuration : configuration.target(target)).load().migrate();
    }

    private static java.sql.Connection connect() throws Exception {
        return DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(), database.getPassword());
    }
}
