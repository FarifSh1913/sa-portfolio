package ru.portfolio.sa.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.util.List;

/** Integra case 2 contract. Keep transport adaptations here, separate from account aggregation. */
public final class ApplicationModels {
    private ApplicationModels() {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Client(String clientId, String fullName, String personalAccount) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Employee(String employeeId, String fullName, String position) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PersonalAccount(String clientId, String personalAccount, String period,
            BigDecimal currentCharges, BigDecimal debtAmount, BigDecimal overpaymentAmount,
            String paymentStatus, BigDecimal lastPaymentAmount, String lastPaymentDate) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record StoredFile(String guid, String fileName, String type, Long fileSize) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Attachment(String fileId, @JsonAlias("fileName") String filename,
            String filetype, String filesize, StoredFile file, String timestamp) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Processing(String employeeId, String status, String reason, String result,
            String createdAt, List<Attachment> files) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Application(String applicationId, String applicationNumber, String subject,
            @JsonAlias({"text", "message"}) String description, String status, String createdAt,
            String clientId, String fullName, String personalAccount, Client client,
            List<Attachment> files, Attachment file, List<Attachment> employeeFiles,
            Attachment employeeFile, String reason, String result, PersonalAccount financialData,
            List<Processing> history) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CreateApplication(String clientId, String personalAccount, String subject, String description) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record UpdateApplication(String applicationId, String employeeId, String status, String reason, String result) {}
}
