package ru.portfolio.sa.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import ru.portfolio.sa.dto.AccountRequest;
import ru.portfolio.sa.dto.ApplicationModels.*;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriComponentsBuilder;
import java.util.List;
import java.util.Arrays;
import java.util.Objects;


@Service
public class IntegraService {
    private final RestClient client;
    private final String baseUrl, eveningUrl, accountPath, crmPath, financePath;

    public IntegraService(RestClient client,
            @Value("${integra.base-url}") String baseUrl,
            @Value("${evening-plans.api-url}") String eveningUrl,
            @Value("${integra.account-info-path}") String accountPath,
            @Value("${integra.crm-path}") String crmPath,
            @Value("${integra.finance-path}") String financePath) {
        this.client = client;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.eveningUrl = eveningUrl;
        this.accountPath = accountPath;
        this.crmPath = crmPath;
        this.financePath = financePath;
    }

    public JsonNode evening(JsonNode request) { return exchange(eveningUrl, HttpMethod.POST, request); }
    public JsonNode account(AccountRequest request) {
        JsonNode response = exchange(baseUrl + accountPath, HttpMethod.POST, request);
        if (response == null || response.isNull() || (response.isObject() && response.isEmpty())) return response;
        if (!request.personalAccount().equals(response.path("personalAccount").path("number").asText()) ||
                !request.clientId().equals(response.path("client").path("clientId").asText())) {
            throw new AccountMismatchException();
        }
        return response;
    }
    public JsonNode crm() { return registry(crmPath); }
    public JsonNode finance() { return registry(financePath); }

    public List<Client> applicationClients() { return list(baseUrl + "/rest/accaunt-details/all2", Client[].class); }
    public List<Employee> employees() { return list(baseUrl + "/rest/employee-details/all", Employee[].class); }
    public PersonalAccount personalAccount(String clientId) {
        return client.get().uri(path("/rest/personal-account-details/{id}", clientId)).retrieve().body(PersonalAccount.class);
    }
    public List<Application> clientApplications(String id) {
        return list(path("/rest/crm-client/task/client/{id}", id), Application[].class);
    }
    public List<Application> employeeApplications(String id) {
        return list(path("/rest/crm-client/task/employee/{id}", id), Application[].class);
    }
    public Application application(String id) {
        return client.get().uri(path("/rest/crm-client/task/{id}", id)).retrieve().body(Application.class);
    }
    public Application createApplication(CreateApplication data, MultipartFile file) {
        return applicationMultipart(HttpMethod.POST, data, file);
    }
    public Application updateApplication(UpdateApplication data, MultipartFile file) {
        return applicationMultipart(HttpMethod.PUT, data, file);
    }
    private Application applicationMultipart(HttpMethod method, Object data, MultipartFile file) {
        var parts = new LinkedMultiValueMap<String, Object>();
        if (data instanceof CreateApplication creation) {
            parts.add("clientId", creation.clientId());
            parts.add("personalAccount", creation.personalAccount());
            parts.add("subject", creation.subject());
            parts.add("description", creation.description());
        } else if (data instanceof UpdateApplication update) {
            parts.add("applicationId", update.applicationId());
            parts.add("employeeId", update.employeeId());
            parts.add("status", update.status());
            if (update.reason() != null && !update.reason().isBlank()) parts.add("reason", update.reason());
            if (update.result() != null && !update.result().isBlank()) parts.add("result", update.result());
        }
        if (file != null && !file.isEmpty()) {
            var headers = new HttpHeaders();
            try {
                headers.setContentType(file.getContentType() == null ? MediaType.APPLICATION_OCTET_STREAM
                        : MediaType.parseMediaType(file.getContentType()));
            } catch (InvalidMediaTypeException ignored) {
                headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            }
            parts.add("file", new HttpEntity<>(file.getResource(), headers));
        }
        return client.method(method).uri(baseUrl + "/rest/crm-client/task")
                .contentType(MediaType.MULTIPART_FORM_DATA).body(parts).retrieve().body(Application.class);
    }
    public ResponseEntity<byte[]> downloadApplicationFile(String id) {
        return client.get().uri(path("/rest/crm-client/file/{id}/download", id)).retrieve().toEntity(byte[].class);
    }
    private String path(String template, String id) {
        return UriComponentsBuilder.fromUriString(baseUrl + template).encode().buildAndExpand(id).toUriString();
    }
    private <T> List<T> list(String url, Class<T[]> type) {
        T[] result = client.get().uri(url).retrieve().body(type);
        if (result == null) return List.of();
        if (Arrays.stream(result).anyMatch(Objects::isNull)) throw new RestClientException("Invalid registry record");
        return Arrays.asList(result);
    }

    private JsonNode registry(String path) {
        JsonNode response = exchange(baseUrl + path, HttpMethod.GET, null);
        if (response == null || response.isNull() || (response.isObject() && response.isEmpty())) {
            return JsonNodeFactory.instance.arrayNode();
        }
        if (!response.isArray()) throw new RestClientException("Expected registry array");
        for (JsonNode record : response) {
            if (!record.isObject() || record.isEmpty()) {
                throw new RestClientException("Invalid registry record");
            }
        }
        return response;
    }

    private JsonNode exchange(String url, HttpMethod method, Object body) {
        var request = client.method(method).uri(url).accept(MediaType.APPLICATION_JSON);
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).body(body);
        return request.retrieve().body(JsonNode.class);
    }

    public static class AccountMismatchException extends RuntimeException {}
}
