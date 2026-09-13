package ru.portfolio.sa.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.LinkedHashMap;
import java.util.Map;

@Controller
public class PortfolioController {

    private static final Map<String, String> SECTIONS = new LinkedHashMap<>();

    static {
        SECTIONS.put("artifacts", "Артефакты аналитика");
        SECTIONS.put("kafka", "Kafka");
        SECTIONS.put("camunda", "Camunda");
        SECTIONS.put("rest", "REST API");
        SECTIONS.put("soap", "SOAP");
        SECTIONS.put("database", "Базы данных");
        SECTIONS.put("ai-agent", "Camunda + AI агент");
        SECTIONS.put("architecture", "Архитектура");
    }

    @GetMapping("/")
    public String home() {
        return "home";
    }

    @GetMapping("/section/{slug}")
    public String section(@PathVariable String slug, Model model) {
        if (!SECTIONS.containsKey(slug)) {
            return "redirect:/section/artifacts";
        }
        model.addAttribute("sections", SECTIONS);
        model.addAttribute("activeSlug", slug);
        model.addAttribute("activeTitle", SECTIONS.get(slug));
        return "section";
    }
}
