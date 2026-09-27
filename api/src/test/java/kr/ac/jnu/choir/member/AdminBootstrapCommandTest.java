package kr.ac.jnu.choir.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

@Testcontainers
class AdminBootstrapCommandTest {
    @Container static final MySQLContainer database = new MySQLContainer("mysql:8.4");

    @Test void requiresVerifiedExistingAccountAndRejectsSecondAdmin() throws Exception {
        Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
                .load().migrate();
        try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(), database.getPassword())) {
            try (var insert = connection.prepareStatement("""
                    INSERT INTO member (email, name, password_hash, status, admin, auth_version, created_at, updated_at)
                    VALUES (?, '신청자', '해시', 'APPROVAL_PENDING', FALSE, 0, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
                    """)) {
                insert.setString(1, "first@example.org");
                insert.executeUpdate();
                insert.setString(1, "second@example.org");
                insert.executeUpdate();
            }
        }
        assertThatThrownBy(() -> AdminBootstrapCommand.run(database.getJdbcUrl(), database.getUsername(),
                database.getPassword(), "first@example.org", MemberType.ACTIVE))
                .hasMessageContaining("이메일 확인된");
        try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(), database.getPassword());
             var verify = connection.prepareStatement("UPDATE member SET email_verified_at = CURRENT_TIMESTAMP(6) WHERE email = ?")) {
            verify.setString(1, "first@example.org");
            verify.executeUpdate();
        }
        AdminBootstrapCommand.run(database.getJdbcUrl(), database.getUsername(), database.getPassword(),
                "first@example.org", MemberType.OB);
        assertThatThrownBy(() -> AdminBootstrapCommand.run(database.getJdbcUrl(), database.getUsername(),
                database.getPassword(), "second@example.org", MemberType.ACTIVE))
                .hasMessageContaining("이미 운영진");
        try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(), database.getPassword());
             var query = connection.prepareStatement("SELECT status, member_type, auth_version FROM member WHERE email = 'first@example.org'");
             var result = query.executeQuery()) {
            result.next();
            assertThat(result.getString(1)).isEqualTo("APPROVED");
            assertThat(result.getString(2)).isEqualTo("OB");
            assertThat(result.getLong(3)).isEqualTo(1);
        }
    }
}
