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
class AdminBootstrapInvitationCommandTest {
    @Container static final MySQLContainer database = new MySQLContainer("mysql:8.4");

    @Test void createsOneInvitedAdminWithHashedToken() throws Exception {
        Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
                .load().migrate();
        String token = AdminBootstrapInvitationCommand.run(database.getJdbcUrl(), database.getUsername(),
                database.getPassword(), "FIRST@example.org", "첫 운영진", MemberType.ACTIVE);
        assertThat(token).matches("[A-Za-z0-9_-]{43}");
        try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(), database.getPassword());
                var query = connection.prepareStatement("""
                        SELECT m.email, m.status, m.admin, m.password_hash, t.token_hash
                        FROM member m JOIN auth_token t ON t.member_id = m.id
                        WHERE m.email = 'first@example.org'
                        """); var result = query.executeQuery()) {
            assertThat(result.next()).isTrue();
            assertThat(result.getString("status")).isEqualTo("INVITED");
            assertThat(result.getBoolean("admin")).isTrue();
            assertThat(result.getString("password_hash")).isNull();
            assertThat(result.getString("token_hash")).isNotEqualTo(token);
        }
        assertThatThrownBy(() -> AdminBootstrapInvitationCommand.run(database.getJdbcUrl(), database.getUsername(),
                database.getPassword(), "second@example.org", "둘째", MemberType.ACTIVE))
                .hasMessageContaining("이미 운영진");
    }
}
