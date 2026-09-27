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
import org.testcontainers.mysql.MySQLContainer;

@SpringBootTest
@Testcontainers
class DatabaseMigrationTest {

    @Container
    static final MySQLContainer database = new MySQLContainer("mysql:8.4");

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
                SELECT COUNT(*) FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME IN ('member', 'auth_token', 'SPRING_SESSION', 'SPRING_SESSION_ATTRIBUTES')
                """, Integer.class);
        Integer uniqueEmailIndexCount = jdbc.queryForObject("""
                SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'member'
                  AND INDEX_NAME = 'uq_member_email'
                """, Integer.class);

        assertThat(tableCount).isEqualTo(4);
        assertThat(uniqueEmailIndexCount).isEqualTo(1);
    }
}
