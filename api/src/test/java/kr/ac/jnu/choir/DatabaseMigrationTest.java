package kr.ac.jnu.choir;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest
@Testcontainers
class DatabaseMigrationTest {

    @Container
    static final PostgreSQLContainer database = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", database::getJdbcUrl);
        properties.add("spring.datasource.username", database::getUsername);
        properties.add("spring.datasource.password", database::getPassword);
    }

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void createsMemberAndAuthenticationTables() {
        Integer tableCount = jdbc.queryForObject("""
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = current_schema()
                  AND table_name IN ('member', 'auth_token', 'spring_session', 'spring_session_attributes')
                """, Integer.class);
        Integer uniqueEmailIndexCount = jdbc.queryForObject("""
                SELECT COUNT(*) FROM pg_constraint
                WHERE conrelid = 'member'::regclass AND conname = 'uq_member_email'
                """, Integer.class);

        assertThat(tableCount).isEqualTo(4);
        assertThat(uniqueEmailIndexCount).isEqualTo(1);
    }
}
