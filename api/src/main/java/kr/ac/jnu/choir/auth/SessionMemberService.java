package kr.ac.jnu.choir.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.List;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.member.AccountStatus;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class SessionMemberService {
    private final MemberRepository members;

    public SessionMemberService(MemberRepository members) {
        this.members = members;
    }

    public Member current(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null || !(session.getAttribute("memberId") instanceof Long id)
                || !(session.getAttribute("authVersion") instanceof Long version)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "로그인이 필요합니다.");
        }
        Member member = members.findById(id).orElse(null);
        if (member == null || member.getAuthVersion() != version || member.getStatus() == AccountStatus.REVOKED) {
            session.invalidate();
            throw new ApiException(HttpStatus.UNAUTHORIZED, "SESSION_EXPIRED", "다시 로그인해 주세요.");
        }
        return member;
    }

    public Member requireApproved(HttpServletRequest request) {
        Member member = current(request);
        if (member.getStatus() != AccountStatus.APPROVED) {
            throw new ApiException(HttpStatus.FORBIDDEN, "APPROVAL_REQUIRED", "가입 승인 후 이용할 수 있습니다.");
        }
        return member;
    }

    public Member requireAdmin(HttpServletRequest request) {
        Member member = requireApproved(request);
        if (!member.isAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ADMIN_REQUIRED", "운영진만 이용할 수 있습니다.");
        }
        return member;
    }

    public void authenticateRequest(HttpServletRequest request) {
        if (request.getSession(false) == null || request.getSession(false).getAttribute("memberId") == null) return;
        try {
            Member member = current(request);
            var authorities = new java.util.ArrayList<SimpleGrantedAuthority>();
            if (member.getStatus() == AccountStatus.APPROVED) {
                authorities.add(new SimpleGrantedAuthority("ROLE_MEMBER"));
                if (member.isAdmin()) authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
            }
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(member.getId(), null, List.copyOf(authorities)));
        } catch (ApiException ignored) {
            SecurityContextHolder.clearContext();
        }
    }
}
