package kr.ac.jnu.choir.auth;

import java.time.Clock;
import java.time.Duration;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.regex.Pattern;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.member.AccountStatus;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RegistrationService {
    private static final Pattern LOCAL_PART = Pattern.compile(
            "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*");
    private static final Pattern DOMAIN_LABEL = Pattern.compile(
            "[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?");
    private final MemberRepository members;
    private final AuthTokenService tokens;
    private final MailSender mail;
    private final Clock clock;
    private final String verifyBaseUrl;
    private final PasswordEncoder passwords = PasswordEncoderFactories.createDelegatingPasswordEncoder();

    public RegistrationService(MemberRepository members, AuthTokenService tokens, MailSender mail, Clock clock,
            @Value("${choir.mail.verify-base-url}") String verifyBaseUrl) {
        this.members = members;
        this.tokens = tokens;
        this.mail = mail;
        this.clock = clock;
        URI verifyUri = URI.create(verifyBaseUrl);
        if (!"https".equals(verifyUri.getScheme()) || verifyUri.getHost() == null
                || verifyUri.getFragment() != null || verifyUri.getQuery() != null
                || !"/verify-email".equals(verifyUri.getPath())) {
            throw new IllegalArgumentException("이메일 확인 주소는 HTTPS /verify-email 경로여야 합니다.");
        }
        this.verifyBaseUrl = verifyBaseUrl;
    }

    @Transactional
    public void apply(String email, String password, String name) {
        String normalized = normalize(email);
        if (!validEmail(normalized)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_EMAIL", "이메일 형식을 확인해 주세요.");
        }
        if (password == null || password.length() < 12) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "WEAK_PASSWORD", "비밀번호는 12자 이상 입력해 주세요.");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PASSWORD_TOO_LONG",
                    "비밀번호는 UTF-8 기준 72바이트 이하로 입력해 주세요.");
        }
        if (name == null || name.isBlank() || name.strip().length() > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_NAME", "이름을 확인해 주세요.");
        }
        if (members.findByEmailIgnoreCase(normalized).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_ALREADY_USED", "이미 사용 중인 이메일입니다.");
        }
        Member member;
        try {
            member = members.saveAndFlush(new Member(normalized, name.strip(), passwords.encode(password), clock));
        } catch (DataIntegrityViolationException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_ALREADY_USED", "이미 사용 중인 이메일입니다.");
        }
        String token = tokens.issue(member.getId());
        mail.sendVerification(normalized, link(token));
    }

    @Transactional
    public void verifyEmail(String token) {
        long memberId = tokens.memberIdFor(token);
        Member member = members.findByIdForUpdate(memberId).orElseThrow();
        tokens.consume(token);
        if (member.getStatus() != AccountStatus.EMAIL_PENDING) {
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_VERIFICATION_TOKEN", "사용할 수 없는 확인 링크입니다.");
        }
        member.verifyEmail(clock);
    }

    @Transactional
    public void resendVerification(String email) {
        String normalized = normalize(email);
        members.findByEmailForUpdate(normalized).ifPresent(member -> {
            if (member.getStatus() == AccountStatus.EMAIL_PENDING
                    && !tokens.issuedWithin(member.getId(), Duration.ofMinutes(10))) {
                String token = tokens.issue(member.getId());
                mail.sendVerification(member.getEmail(), link(token));
            }
        });
    }

    private String link(String token) {
        return verifyBaseUrl + "#token=" + token;
    }

    private static String normalize(String email) {
        return email == null ? "" : email.strip().toLowerCase(Locale.ROOT);
    }

    private static boolean validEmail(String email) {
        if (email.length() > 254) {
            return false;
        }
        int separator = email.indexOf('@');
        if (separator < 1 || separator != email.lastIndexOf('@')) {
            return false;
        }
        String localPart = email.substring(0, separator);
        String domain = email.substring(separator + 1);
        if (localPart.length() > 64 || domain.length() > 253
                || !LOCAL_PART.matcher(localPart).matches() || !domain.contains(".")) {
            return false;
        }
        for (String label : domain.split("\\.", -1)) {
            if (!DOMAIN_LABEL.matcher(label).matches()) {
                return false;
            }
        }
        return true;
    }
}
