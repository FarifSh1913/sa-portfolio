package ru.portfolio.sa.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import ru.portfolio.sa.dto.AccountRequest;
import ru.portfolio.sa.integration.IntegraService;

import java.util.Map;
import java.util.List;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ContentDisposition;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import ru.portfolio.sa.dto.ApplicationModels.*;

@RestController
@RequestMapping("/api/integration")
public class IntegrationController {
    private final IntegraService integra;
    public IntegrationController(IntegraService integra) { this.integra = integra; }

    @PostMapping(value = "/evening-plans", consumes = "application/json")
    public ResponseEntity<JsonNode> evening(@RequestBody JsonNode body) { return data(integra.evening(body)); }

    @PostMapping(value = "/accaunt-info", consumes = "application/json")
    public ResponseEntity<?> account(@RequestBody AccountRequest request) {
        if (request.requestId() == null || invalid(request.clientId()) || invalid(request.personalAccount())) {
            return error(400, "Укажите Client ID, лицевой счет и корректный requestId.");
        }
        return data(integra.account(request));
    }

    @GetMapping("/crm")
    public ResponseEntity<JsonNode> crm() { return data(integra.crm()); }
    @GetMapping("/finance")
    public ResponseEntity<JsonNode> finance() { return data(integra.finance()); }

    @GetMapping("/applications/clients")
    public ResponseEntity<List<Client>> applicationClients() { return applicationData(integra.applicationClients()); }
    @GetMapping("/applications/personal-account/{clientId}")
    public ResponseEntity<PersonalAccount> personalAccount(@PathVariable String clientId) { return applicationData(integra.personalAccount(clientId)); }
    @GetMapping("/applications/employees")
    public ResponseEntity<List<Employee>> employees() { return applicationData(integra.employees()); }
    @GetMapping("/applications/client/{clientId}")
    public ResponseEntity<List<Application>> clientApplications(@PathVariable String clientId) { return applicationData(integra.clientApplications(clientId)); }
    @GetMapping("/applications/employee/{employeeId}")
    public ResponseEntity<List<Application>> employeeApplications(@PathVariable String employeeId) { return applicationData(integra.employeeApplications(employeeId)); }
    @GetMapping("/applications/{applicationId}")
    public ResponseEntity<Application> application(@PathVariable String applicationId) { return applicationData(integra.application(applicationId)); }
    @PostMapping(value = "/applications", consumes = "multipart/form-data")
    public ResponseEntity<?> createApplication(@RequestParam("clientId") String clientId,
            @RequestParam("personalAccount") String personalAccount,
            @RequestParam("subject") String subject, @RequestParam("description") String description,
            @RequestPart(value = "file", required = false) MultipartFile file) {
        var data = new CreateApplication(clientId, personalAccount, subject, description);
        if (invalid(data.clientId()) || invalid(data.personalAccount()) || blankOrLong(data.subject(), 150) || blankOrLong(data.description(), 1000))
            return error(400, "Укажите клиента, лицевой счет, тему до 150 символов и текст до 1000 символов.");
        return applicationData(integra.createApplication(data, file));
    }
    @PutMapping(value = "/applications", consumes = "multipart/form-data")
    public ResponseEntity<?> updateApplication(@RequestParam("applicationId") String applicationId,
            @RequestParam("employeeId") String employeeId, @RequestParam("status") String status,
            @RequestParam(value = "reason", required = false) String reason,
            @RequestParam(value = "result", required = false) String result,
            @RequestPart(value = "file", required = false) MultipartFile file) {
        var data = new UpdateApplication(applicationId, employeeId, status, reason, result);
        if (invalid(data.applicationId()) || invalid(data.employeeId()) || data.status() == null ||
                !List.of("APPROVED", "REJECTED", "PROCESSED").contains(data.status()) ||
                ("REJECTED".equals(data.status()) && blankOrLong(data.reason(), 1000)) ||
                ("PROCESSED".equals(data.status()) && blankOrLong(data.result(), 1000)))
            return error(400, "Проверьте заявление, сотрудника, статус и описание действия (до 1000 символов).");
        return applicationData(integra.updateApplication(data, file));
    }
    @GetMapping("/applications/files/{fileId}/download")
    public ResponseEntity<byte[]> downloadApplicationFile(@PathVariable String fileId) {
        var response = integra.downloadApplicationFile(fileId);
        String filename = response.getHeaders().getContentDisposition().getFilename();
        if (filename == null || filename.isBlank()) filename = "attachment";
        filename = filename.replace('\\', '_').replace('/', '_').replace('\r', '_').replace('\n', '_');
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build().toString())
                .body(response.getBody());
    }
    private boolean blankOrLong(String value, int max) { return value == null || value.isBlank() || value.length() > max; }
    private <T> ResponseEntity<T> applicationData(T body) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body); }
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<?> uploadTooLarge() { return error(413, "Файл слишком большой. Максимальный размер — 10 МБ."); }

    private boolean invalid(String value) { return value == null || value.isBlank() || value.length() > 128; }
    private ResponseEntity<JsonNode> data(JsonNode body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }
    private ResponseEntity<Map<String, Object>> error(int status, String message) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(Map.of("message", message, "status", status));
    }

    @ExceptionHandler(IntegraService.AccountMismatchException.class)
    public ResponseEntity<?> accountMismatch() {
        return ResponseEntity.status(502).cacheControl(CacheControl.noStore()).body(Map.of(
                "code", "ACCOUNT_MISMATCH", "message", "Не удалось подтвердить данные выбранного лицевого счета."));
    }
    @ExceptionHandler(RestClientResponseException.class)
    public ResponseEntity<?> upstreamError(RestClientResponseException exception) {
        // Never forward upstream bodies: they may contain stack traces or client data.
        return error(502, "Источник данных вернул HTTP " + exception.getStatusCode().value() + ". Попробуйте повторить запрос.");
    }
    @ExceptionHandler(ResourceAccessException.class)
    public ResponseEntity<?> unavailable() { return error(504, "Источник данных не ответил вовремя. Попробуйте повторить запрос."); }
    @ExceptionHandler(RestClientException.class)
    public ResponseEntity<?> invalidResponse() { return error(502, "Не удалось прочитать ответ источника данных."); }
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<?> invalidRequest() { return error(400, "Проверьте формат запроса."); }
}
