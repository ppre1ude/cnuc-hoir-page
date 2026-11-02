package kr.ac.jnu.choir.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.http.HttpMethod;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.web.filter.OncePerRequestFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

@Configuration
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, SessionMemberService sessions) throws Exception {
        http.authorizeHttpRequests(authorize -> authorize
                .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                .requestMatchers("/api/v1/auth/csrf", "/api/v1/auth/google/nonce", "/api/v1/auth/google",
                        "/api/v1/auth/account-setup/confirm").permitAll()
                .requestMatchers("/api/v1/auth/me", "/api/v1/auth/logout", "/api/v1/auth/application").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/v1/public/events").permitAll()
                .requestMatchers("/api/v1/admin/**").hasRole("MEMBER")
                .requestMatchers("/api/v1/**").hasRole("MEMBER")
                .anyRequest().denyAll())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, failure) -> {
                            response.setStatus(401);
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().write("{\"code\":\"UNAUTHENTICATED\",\"message\":\"로그인이 필요합니다.\"}");
                        })
                        .accessDeniedHandler((request, response, failure) -> {
                            response.setStatus(403);
                            response.setContentType("application/json;charset=UTF-8");
                            // 화면이 기억한 토큰이 낡았을 때 권한 부족과 구분해 새 토큰으로 다시 보내게 합니다.
                            if (failure instanceof CsrfException) {
                                response.getWriter().write("{\"code\":\"CSRF_INVALID\",\"message\":\"요청이 만료되었습니다. 다시 시도해 주세요.\"}");
                                return;
                            }
                            boolean pending = false;
                            try {
                                pending = sessions.current(request).getStatus() != kr.ac.jnu.choir.member.AccountStatus.APPROVED;
                            } catch (kr.ac.jnu.choir.common.ApiException ignored) {
                                // 유효한 로그인 정보가 없으면 일반 권한 오류로 응답합니다.
                            }
                            response.getWriter().write(pending
                                    ? "{\"code\":\"APPROVAL_REQUIRED\",\"message\":\"가입 승인 후 이용할 수 있습니다.\"}"
                                    : "{\"code\":\"FORBIDDEN\",\"message\":\"접근 권한이 없습니다.\"}");
                        }))
                .addFilterBefore(new OncePerRequestFilter() {
                    @Override
                    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                            throws ServletException, IOException {
                        if (request.getRequestURI().startsWith("/api/v1/")) response.setHeader("Cache-Control", "no-store");
                        sessions.authenticateRequest(request);
                        chain.doFilter(request, response);
                    }
                }, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
