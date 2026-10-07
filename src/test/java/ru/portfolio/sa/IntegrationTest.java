package ru.portfolio.sa;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.client.RestClient;
import ru.portfolio.sa.controller.IntegrationController;
import ru.portfolio.sa.integration.IntegraService;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class IntegrationTest {
    MockRestServiceServer server;
    MockMvc mvc;
    @BeforeEach
    void setup() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        var service = new IntegraService(builder.build(),"https://integra.test","https://integra.test/rest/evening-plans",
                "/rest/accaunt-info","/rest/accaunt-details/all","/rest/fin-results");
        mvc = MockMvcBuilders.standaloneSetup(new IntegrationController(service)).build();
    }
    @Test
    void accountForwardsExactJsonAndDoesNotCache() throws Exception {
        String request = "{\"requestId\":\"7ccbbdb0-73ed-4b42-a80c-45ff3a8acd11\",\"clientId\":\"CL-100245\",\"personalAccount\":\"123456789\"}";
        server.expect(requestTo("https://integra.test/rest/accaunt-info")).andExpect(method(HttpMethod.POST))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.header("Content-Type","application/json")).andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.content().json(request))
                .andRespond(withSuccess("{\"client\":{\"clientId\":\"CL-100245\",\"fullName\":\"Иванов\"},\"personalAccount\":{\"number\":\"123456789\",\"debtAmount\":3250.40}}",MediaType.APPLICATION_JSON));
        mvc.perform(post("/api/integration/accaunt-info").contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
                .andExpect(jsonPath("$.personalAccount.debtAmount").value(3250.40));
        server.verify();
    }
    @Test
    void invalidAccountDoesNotCallUpstream() throws Exception {
        mvc.perform(post("/api/integration/accaunt-info").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/integration/accaunt-info").contentType(MediaType.APPLICATION_JSON).content("{\"requestId\":\"invalid\"}"))
                .andExpect(status().isBadRequest());
        server.verify();
    }
    @Test
    void sourcesFailIndependentlyAndNeverLeakUpstreamBody() throws Exception {
        server.expect(requestTo("https://integra.test/rest/accaunt-details/all")).andExpect(method(HttpMethod.GET))
                .andRespond(withServerError().body("secret stackTrace"));
        server.expect(requestTo("https://integra.test/rest/fin-results")).andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("[]",MediaType.APPLICATION_JSON));
        mvc.perform(get("/api/integration/crm")).andExpect(status().isBadGateway())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().string(not(containsString("secret"))));
        mvc.perform(get("/api/integration/finance")).andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
        server.verify();
    }
    @Test
    void financeAlwaysUsesGetWithoutBodyAndPreservesArray() throws Exception {
        server.expect(requestTo("https://integra.test/rest/fin-results")).andExpect(method(HttpMethod.GET))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.content().string(""))
                .andRespond(withSuccess("[{\"personalAccount\":\"123456790\",\"lastPaymentAmount\":3320.5,\"overpaymentAmount\":450}]",MediaType.APPLICATION_JSON));
        mvc.perform(get("/api/integration/finance")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].personalAccount").value("123456790"))
                .andExpect(jsonPath("$[0].lastPaymentAmount").value(3320.5));
        server.verify();
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"null", "{}", "[]", ""})
    void emptyRegistriesAreNormalized(String upstream) throws Exception {
        server.expect(requestTo("https://integra.test/rest/accaunt-details/all"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.content().string(""))
                .andRespond(withSuccess(upstream,MediaType.APPLICATION_JSON));
        mvc.perform(get("/api/integration/crm")).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        server.verify();
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"{\"items\":[]}", "[null]", "[{}]", "123"})
    void malformedRegistriesReturnSafeErrors(String upstream) throws Exception {
        server.expect(requestTo("https://integra.test/rest/fin-results"))
                .andRespond(withSuccess(upstream,MediaType.APPLICATION_JSON));
        mvc.perform(get("/api/integration/finance")).andExpect(status().isBadGateway());
        server.verify();
    }
    @Test
    void wrongAccountCannotBeShownAsRequestedAccount() throws Exception {
        server.expect(requestTo("https://integra.test/rest/accaunt-info"))
                .andRespond(withSuccess("{\"client\":{\"clientId\":\"CL-100245\"},\"personalAccount\":{\"number\":\"123456789\"}}",MediaType.APPLICATION_JSON));
        mvc.perform(post("/api/integration/accaunt-info").contentType(MediaType.APPLICATION_JSON)
                .content("{\"requestId\":\"7ccbbdb0-73ed-4b42-a80c-45ff3a8acd11\",\"clientId\":\"CL-100246\",\"personalAccount\":\"123456790\"}"))
                .andExpect(status().isBadGateway()).andExpect(jsonPath("$.code").value("ACCOUNT_MISMATCH"))
                .andExpect(content().string(not(containsString("123456789"))));
        server.verify();
    }
    @Test
    void eveningPreservesPayloadAndMapping() throws Exception {
        String body = "{\"city\":\"Москва\",\"budget\":3000,\"preferences\":[\"walk\"]}";
        server.expect(requestTo("https://integra.test/rest/evening-plans")).andExpect(method(HttpMethod.POST))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.content().json(body)).andRespond(withSuccess("{\"plans\":[],\"weather\":{\"rain\":false}}",MediaType.APPLICATION_JSON));
        mvc.perform(post("/api/integration/evening-plans").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.plans").isEmpty()).andExpect(jsonPath("$.weather.rain").value(false));
        server.verify();
    }
    @Test
    void malformedUpstreamIsSafeError() throws Exception {
        server.expect(requestTo("https://integra.test/rest/accaunt-details/all"))
                .andRespond(withSuccess("not-json",MediaType.APPLICATION_JSON));
        mvc.perform(get("/api/integration/crm")).andExpect(status().isBadGateway());
        server.verify();
    }
}
