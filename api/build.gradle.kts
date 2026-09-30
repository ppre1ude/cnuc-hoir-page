plugins {
	java
	id("org.springframework.boot") version "4.1.1"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "kr.ac.jnu"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-flyway")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.springframework.security:spring-security-oauth2-jose")
	implementation("org.springframework.boot:spring-boot-starter-session-jdbc")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	implementation("org.flywaydb:flyway-database-postgresql")
	runtimeOnly("org.postgresql:postgresql")
	testImplementation("org.springframework.boot:spring-boot-starter-test")
	testImplementation("org.springframework.boot:spring-boot-testcontainers")
	testImplementation(platform("org.testcontainers:testcontainers-bom:2.0.5"))
	testImplementation("org.testcontainers:testcontainers-junit-jupiter")
	testImplementation("org.testcontainers:testcontainers-postgresql")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
	useJUnitPlatform()
}

tasks.register<JavaExec>("bootstrapAdminInvite") {
	group = "운영"
	description = "최초 운영진 계정을 만들고 1회용 계정 설정 토큰을 발급합니다."
	classpath = sourceSets.main.get().runtimeClasspath
	mainClass = "kr.ac.jnu.choir.member.AdminBootstrapInvitationCommand"
	standardInput = System.`in`
}

tasks.register<JavaExec>("linkExistingAdminGoogle") {
	group = "운영"
	description = "기존 운영진 계정에 구글 계정을 연결할 1회용 토큰을 발급합니다."
	classpath = sourceSets.main.get().runtimeClasspath
	mainClass = "kr.ac.jnu.choir.member.AdminGoogleConnectionCommand"
	standardInput = System.`in`
}
