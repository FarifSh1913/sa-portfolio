package ru.portfolio.sa;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"integra.base-url=https://integra.example.test", "evening-plans.mock-enabled=false"})
@AutoConfigureMockMvc
class EveningPlansTest {
    @Autowired MockMvc mvc;

    @Test
    void pageUsesConfiguredIntegraAndSharedNavigation() throws Exception {
        mvc.perform(get("/section/evening-plans"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("content=\"https://integra.example.test\"")))
                .andExpect(content().string(not(containsString("/api/demo/evening-plans"))))
                .andExpect(content().string(containsString("active\">Планы на вечер</a>")))
                .andExpect(content().string(containsString("/js/evening-plans-api.js")))
                .andExpect(content().string(not(containsString("Демо-режим:"))));
        mvc.perform(get("/css/evening-plans.css")).andExpect(status().isOk());
        mvc.perform(get("/js/evening-plans.js")).andExpect(status().isOk());
    }

    @Test
    void demoEndpointIsAbsentWhenDisabled() throws Exception {
        mvc.perform(post("/api/demo/evening-plans").contentType("application/json").content("{}"))
                .andExpect(status().isNotFound());
    }
}
