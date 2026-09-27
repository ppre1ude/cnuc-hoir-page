package kr.ac.jnu.choir.auth;

public interface MailSender {
    void sendVerification(String address, String link);
}
