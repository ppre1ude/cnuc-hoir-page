package kr.ac.jnu.choir.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import kr.ac.jnu.choir.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class GoogleLoginNonceService {
    private static final String ATTRIBUTE = "googleLoginNonce";
    private final SecureRandom random = new SecureRandom();

    public String issue(HttpServletRequest request) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String nonce = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        request.getSession().setAttribute(ATTRIBUTE, nonce);
        return nonce;
    }

    public void consume(HttpServletRequest request, String supplied) {
        HttpSession session = request.getSession(false);
        if (session == null || !(session.getAttribute(ATTRIBUTE) instanceof String expected)) throw invalid();
        session.removeAttribute(ATTRIBUTE);
        if (supplied == null || !MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                supplied.getBytes(StandardCharsets.UTF_8))) throw invalid();
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_GOOGLE_NONCE", "구글 로그인 요청을 다시 시작해 주세요.");
    }
}
