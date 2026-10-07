package ru.portfolio.sa.controller;

import org.springframework.stereotype.Controller;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.LinkedHashMap;
import java.util.Map;

@Controller
public class PortfolioController {

    @Value("${ai-agent.api-url}")
    private String aiAgentApiUrl;

    @Value("${evening-plans.mock-enabled:false}")
    private boolean eveningPlansMockEnabled;

    private static final Map<String, String> SECTIONS = new LinkedHashMap<>();

    static {
        SECTIONS.put("architecture", "Архитектура");
        SECTIONS.put("artifacts", "Артефакты аналитика");
        SECTIONS.put("ai-agent", "Camunda + AI агент");
        SECTIONS.put("evening-plans", "Планы на вечер");
        SECTIONS.put("energo", "Энерго (Информация о клиенте)");
        SECTIONS.put("energo-applications", "Энерго (Обращения)");
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


    @GetMapping("/section/evening-plans")
    public String eveningPlans(Model model) {
        addSectionModel(model, "evening-plans");
        model.addAttribute("eveningPlansApiUrl", "/api/integration/evening-plans");
        model.addAttribute("eveningPlansMockEnabled", eveningPlansMockEnabled);
        return "evening-plans";
    }

    @GetMapping("/section/energo")
    public String energo(Model model) {
        addSectionModel(model, "energo");
        return "energo";
    }

    @GetMapping("/section/energo-applications")
    public String energoApplications(Model model) {
        addSectionModel(model, "energo-applications");
        return "energo-applications";
    }

    private void addSectionModel(Model model, String activeSlug) {
        model.addAttribute("sections", SECTIONS);
        model.addAttribute("activeSlug", activeSlug);
        model.addAttribute("activeTitle", SECTIONS.get(activeSlug));
        model.addAttribute("aiAgentApiUrl", aiAgentApiUrl);
    }
}
