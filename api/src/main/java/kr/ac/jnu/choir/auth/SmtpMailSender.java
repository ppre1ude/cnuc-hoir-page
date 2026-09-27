package kr.ac.jnu.choir.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "choir.mail.enabled", havingValue = "true")
public class SmtpMailSender implements MailSender {
    private final JavaMailSender sender;
    private final String from;

    public SmtpMailSender(JavaMailSender sender, @Value("${choir.mail.from}") String from) {
        if (from.isBlank()) {
            throw new IllegalArgumentException("메일 발신 주소가 설정되지 않았습니다.");
        }
        this.sender = sender;
        this.from = from;
    }

    @Override
    public void sendVerification(String address, String link) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(address);
        message.setSubject("전남대학교 합창단 이메일 확인");
        message.setText("가입 신청을 계속하려면 아래 링크에서 이메일을 확인해 주세요.\n" + link
                + "\n이 링크는 24시간 동안 한 번만 사용할 수 있습니다.");
        sender.send(message);
    }

    @Override
    public void sendPasswordReset(String address, String link) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(address);
        message.setSubject("전남대학교 합창단 비밀번호 재설정");
        message.setText("비밀번호를 재설정하려면 아래 링크를 열어 주세요.\n" + link
                + "\n이 링크는 30분 동안 한 번만 사용할 수 있습니다.");
        sender.send(message);
    }
}
