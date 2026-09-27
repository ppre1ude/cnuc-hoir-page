package kr.ac.jnu.choir.auth;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;
import kr.ac.jnu.choir.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;

@Component
public class ClientIpResolver {
    private final List<IpAddressMatcher> trustedProxies;

    public ClientIpResolver(@Value("${choir.security.trusted-proxy-cidrs:}") String configured) {
        List<IpAddressMatcher> parsed = new ArrayList<>();
        for (String item : configured.split(",")) {
            String cidr = item.strip();
            if (cidr.isEmpty()) continue;
            String address = cidr.split("/", -1)[0];
            if (numericAddress(address) == null) {
                throw new IllegalArgumentException("신뢰 프록시 주소는 숫자 IP 또는 CIDR이어야 합니다.");
            }
            parsed.add(new IpAddressMatcher(cidr));
        }
        trustedProxies = List.copyOf(parsed);
    }

    public String resolve(HttpServletRequest request) {
        String remote = numericAddress(request.getRemoteAddr());
        if (remote == null) return request.getRemoteAddr();
        if (!trusted(remote)) return remote;
        var values = request.getHeaders("X-Forwarded-For");
        if (values == null || !values.hasMoreElements()) throw invalidChain();
        String header = values.nextElement();
        if (values.hasMoreElements() || header.isBlank() || header.length() > 2048) throw invalidChain();
        String[] chain = header.split(",", -1);
        if (chain.length > 32) throw invalidChain();
        List<String> hops = new ArrayList<>();
        for (String raw : chain) {
            String address = numericAddress(raw.strip());
            if (address == null) throw invalidChain();
            hops.add(address);
        }
        for (int index = hops.size() - 1; index >= 0; index--) {
            if (!trusted(hops.get(index))) return hops.get(index);
        }
        throw invalidChain();
    }

    private static ApiException invalidChain() {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PROXY_CHAIN", "요청의 네트워크 주소를 확인할 수 없습니다.");
    }

    private boolean trusted(String address) {
        return trustedProxies.stream().anyMatch(matcher -> matcher.matches(address));
    }

    private static String numericAddress(String value) {
        if (value == null || value.isBlank()) return null;
        if (value.contains(":")) {
            if (!value.matches("[0-9A-Fa-f:.]+")) return null;
        } else {
            String[] octets = value.split("\\.", -1);
            if (octets.length != 4) return null;
            for (String octet : octets) {
                if (!octet.matches("[0-9]{1,3}") || Integer.parseInt(octet) > 255) return null;
            }
        }
        try {
            return InetAddress.getByName(value).getHostAddress();
        } catch (UnknownHostException exception) {
            return null;
        }
    }
}
