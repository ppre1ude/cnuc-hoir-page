package kr.ac.jnu.choir.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.DriverManager;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Testcontainers
class AdminGoogleConnectionCommandTest {
    @Container static final PostgreSQLContainer database = new PostgreSQLContainer("postgres:17-alpine");

    @Test void issuesSingleUseLinkOnlyForExistingApprovedAdmin() throws Exception {
        Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
                .locations("classpath:db/postgresql").load().migrate();
        String email = "legacy-" + UUID.randomUUID() + "@example.org";
        try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(), database.getPassword());
                var insert = connection.prepareStatement("INSERT INTO member (email, name, password_hash, status, member_type, admin, auth_version, created_at, updated_at) VALUES (?, '기존 운영진', '{noop}old-password', 'APPROVED', 'ACTIVE', TRUE, 0, ?, ?)")) {
            insert.setString(1, email);
            insert.setTimestamp(2, Timestamp.from(Instant.now()));
            insert.setTimestamp(3, Timestamp.from(Instant.now()));
            assertThat(insert.executeUpdate()).isEqualTo(1);
        }
        String first = AdminGoogleConnectionCommand.run(database.getJdbcUrl(), database.getUsername(),
                database.getPassword(), email.toUpperCase());
        String second = AdminGoogleConnectionCommand.run(database.getJdbcUrl(), database.getUsername(),
                database.getPassword(), email);
        assertThat(first).matches("[A-Za-z0-9_-]{43}");
        assertThat(second).isNotEqualTo(first);
        try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(), database.getPassword());
                var query = connection.prepareStatement("SELECT COUNT(*) FROM auth_token t JOIN member m ON t.member_id = m.id WHERE m.email = ? AND t.used_at IS NULL")) {
            query.setString(1, email);
            try (var result = query.executeQuery()) {
                assertThat(result.next()).isTrue();
                assertThat(result.getInt(1)).isEqualTo(1);
            }
        }
        assertThatThrownBy(() -> AdminGoogleConnectionCommand.run(database.getJdbcUrl(), database.getUsername(),
                database.getPassword(), "missing@example.org")).hasMessageContaining("운영진 계정");
    }
}
