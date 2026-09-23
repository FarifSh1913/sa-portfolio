package ru.portfolio.sa;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "evening-plans.mock-enabled=true")
@AutoConfigureMockMvc
class EveningPlansDemoTest {
    @Autowired MockMvc mvc;

    @Test
    void demoIsExplicitAndReturnsFixedContract() throws Exception {
        mvc.perform(get("/section/evening-plans"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("content=\"/api/demo/evening-plans\"")))
                .andExpect(content().string(containsString("Демо-режим:")));
        mvc.perform(post("/api/demo/evening-plans").contentType("application/json")
                        .content("{\"city\":\"Другой город\",\"budget\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.city").value("Москва"))
                .andExpect(jsonPath("$.weather.rain").value(false))
                .andExpect(jsonPath("$.plans[0].items[0].price").value(0));
    }
}
