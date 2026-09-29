package kr.ac.jnu.choir.auth;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.member.AccountStatus;
import kr.ac.jnu.choir.member.MemberRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountSetupService {
    private final MemberRepository members;
    private final AuthTokenService tokens;
    private final Clock clock;
    private final PasswordEncoder passwords = PasswordEncoderFactories.createDelegatingPasswordEncoder();

    public AccountSetupService(MemberRepository members, AuthTokenService tokens, Clock clock) {
        this.members = members;
        this.tokens = tokens;
        this.clock = clock;
    }

    @Transactional
    public void complete(String token, String password) {
        if (password == null || password.codePointCount(0, password.length()) < 12) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "WEAK_PASSWORD", "비밀번호는 12자 이상 입력해 주세요.");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PASSWORD_TOO_LONG", "비밀번호는 UTF-8 기준 72바이트 이하로 입력해 주세요.");
        }
        long memberId = tokens.memberIdForAccountSetup(token);
        var member = members.findByIdForUpdate(memberId).orElseThrow(AccountSetupService::invalidToken);
        if (member.getStatus() != AccountStatus.INVITED && member.getStatus() != AccountStatus.APPROVED) {
            throw invalidToken();
        }
        tokens.consumeAccountSetup(token);
        member.resetPassword(passwords.encode(password), clock);
    }

    private static ApiException invalidToken() {
        return new ApiException(HttpStatus.CONFLICT, "INVALID_INVITE_TOKEN", "사용할 수 없는 계정 설정 링크입니다.");
    }
}
