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
        SECTIONS.put("architecture", "Архитектура");
        SECTIONS.put("artifacts", "Артефакты аналитика");
        SECTIONS.put("rest", "REST API");
        SECTIONS.put("kafka", "Kafka");
        SECTIONS.put("camunda", "Camunda");
        SECTIONS.put("soap", "SOAP");
        SECTIONS.put("database", "Базы данных");
        SECTIONS.put("ai-agent", "Camunda + AI агент");
        SECTIONS.put("antistress", "Антистресс аналитика");
    }

    @GetMapping("/")
    public String home() {
        return "home";
    }


    @GetMapping({"/artifacts", "/section/artifacts"})
    public String artifacts(Model model) {
        addSectionModel(model, "artifacts");
        return "artifacts";
    }

    @GetMapping("/section/architecture")
    public String architecture(Model model) {
        addSectionModel(model, "architecture");
        return "architecture";
    }

    @GetMapping("/section/antistress")
    public String antistress(Model model) {
        addSectionModel(model, "antistress");
        return "antistress";
    }

    @GetMapping("/section/ai-agent")
    public String aiAgent(Model model) {
        addSectionModel(model, "ai-agent");
        return "ai-agent";
    }


    @GetMapping("/section/{slug}")
    public String section(@PathVariable String slug, Model model) {
        if (!SECTIONS.containsKey(slug)) {
            return "redirect:/section/artifacts";
        }
        addSectionModel(model, slug);
        return "section";
    }

    private void addSectionModel(Model model, String activeSlug) {
        model.addAttribute("sections", SECTIONS);
        model.addAttribute("activeSlug", activeSlug);
        model.addAttribute("activeTitle", SECTIONS.get(activeSlug));
    }
}
