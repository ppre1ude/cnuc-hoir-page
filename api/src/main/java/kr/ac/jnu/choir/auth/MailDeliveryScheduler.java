package kr.ac.jnu.choir.auth;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "choir.mail.enabled", havingValue = "true")
public class MailDeliveryScheduler {
    private final MailOutboxService outbox;

    public MailDeliveryScheduler(MailOutboxService outbox) {
        this.outbox = outbox;
    }

    @Scheduled(fixedDelayString = "${choir.mail.retry-poll-ms:60000}")
    public void dispatch() {
        outbox.dispatchDue();
    }
}
