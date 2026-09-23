package ru.portfolio.sa.controller;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Fixed demonstration fixture; no integration or planning logic. */
@RestController
@ConditionalOnProperty(name = "evening-plans.mock-enabled", havingValue = "true")
public class EveningPlansDemoController {
    @PostMapping(value = "/api/demo/evening-plans", consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public Resource findPlans(@RequestBody Map<String, Object> ignoredPayload) {
        return new ClassPathResource("demo/evening-plans.json");
    }
}
