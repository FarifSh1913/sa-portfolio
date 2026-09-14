package ru.portfolio.sa;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class PortfolioRoutesTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void storyLaunchStartsWithArchitecture() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("href=\"/section/architecture\" aria-label=\"Запустить историю\"")));
    }

    @Test
    void architecturePageContainsInteractiveMapAndOrderedSidebar() throws Exception {
        String html = mockMvc.perform(get("/section/architecture"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("class=\"sidebar")))
                .andExpect(content().string(containsString("id=\"systemMap\"")))
                .andExpect(content().string(containsString("id=\"journeyTimeline\"")))
                .andExpect(content().string(containsString(">Назад</a>")))
                .andExpect(content().string(containsString("/js/architecture.js")))
                .andReturn().getResponse().getContentAsString();

        String sidebar = html.substring(html.indexOf("class=\"sidebar"), html.indexOf("</aside>"));
        assertTrue(sidebar.indexOf("Архитектура") < sidebar.indexOf("Артефакты аналитика"));
        assertTrue(sidebar.indexOf("Антистресс аналитика") > sidebar.indexOf("Camunda + AI агент"));
    }

    @Test
    void artifactsPageContainsSidebarAndFigmaEmbed() throws Exception {
        mockMvc.perform(get("/section/artifacts"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("class=\"sidebar")))
                .andExpect(content().string(containsString("Антистресс аналитика")))
                .andExpect(content().string(containsString("https://embed.figma.com/design/")))
                .andExpect(content().string(containsString(">Назад</a>")))
                .andExpect(content().string(containsString("data-artifact-target=\"#analyticsNote\"")))
                .andExpect(content().string(containsString("data-bs-toggle=\"tab\"")))
                .andExpect(content().string(containsString("/js/artifacts.js")));
    }

    @Test
    void antistressPageContainsSidebarAndExistingGame() throws Exception {
        mockMvc.perform(get("/section/antistress"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("class=\"sidebar")))
                .andExpect(content().string(containsString("id=\"startGame\"")))
                .andExpect(content().string(containsString("id=\"startCombat\"")))
                .andExpect(content().string(containsString("id=\"mobileHitButton\"")))
                .andExpect(content().string(containsString("placeholder=\"Введите имя\"")))
                .andExpect(content().string(containsString("class=\"laptop\"")))
                .andExpect(content().string(containsString("id=\"spectators\"")))
                .andExpect(content().string(containsString("id=\"finalSnapshot\"")))
                .andExpect(content().string(containsString("id=\"downloadSnapshot\"")))
                .andExpect(content().string(containsString("/js/antistress.js")));
    }

    @Test
    void clientScriptsContainExpectedInteractions() throws Exception {
        mockMvc.perform(get("/js/artifacts.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("shown.bs.collapse")));
        mockMvc.perform(get("/js/architecture.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("requestAnimationFrame")))
                .andExpect(content().string(containsString("duration=2400")));
        mockMvc.perform(get("/js/antistress.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("registerHit")))
                .andExpect(content().string(containsString("event.code==='Space'")))
                .andExpect(content().string(containsString("event.repeat")))
                .andExpect(content().string(containsString("PHASE.COMBAT")))
                .andExpect(content().string(containsString("APPROACH:'APPROACH'")))
                .andExpect(content().string(containsString("PREP:'PREP'")))
                .andExpect(content().string(containsString("frontend:{")))
                .andExpect(content().string(containsString("pointerdown")))
                .andExpect(content().string(containsString("downloadSnapshot")))
                .andExpect(content().string(containsString("canvas.toBlob")))
                .andExpect(content().string(not(containsString("playSuplex"))));
    }
}
