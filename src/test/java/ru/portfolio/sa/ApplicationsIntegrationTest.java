package ru.portfolio.sa;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.*;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.client.RestClient;
import ru.portfolio.sa.controller.IntegrationController;
import ru.portfolio.sa.integration.IntegraService;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ApplicationsIntegrationTest {
    MockRestServiceServer server;
    MockMvc mvc;
    @BeforeEach void setup() {
        var builder = RestClient.builder(); server = MockRestServiceServer.bindTo(builder).build();
        mvc = MockMvcBuilders.standaloneSetup(new IntegrationController(new IntegraService(builder.build(),
                "https://integra.test", "https://integra.test/rest/evening-plans", "/rest/accaunt-info", "/rest/accaunt-details/all", "/rest/fin-results"))).build();
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {true, false})
    void createsMultipartWithTextFieldsAndOptionalBinaryFile(boolean withFile) throws Exception {
        server.expect(requestTo("https://integra.test/rest/crm-client/task")).andExpect(method(HttpMethod.POST))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.header("Content-Type", startsWith("multipart/form-data;boundary=")))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.content().string(allOf(
                        containsString("name=\"clientId\""), containsString("CL-1"),
                        containsString("name=\"subject\""), containsString("Subject"),
                        containsString("name=\"description\""), containsString("Text"),
                        not(containsString("name=\"data\"")), not(containsString("application/json")),
                        containsString("name=\"personalAccount\""), containsString("123456790"),
                        withFile ? allOf(containsString("name=\"file\""), containsString("filename=\"receipt.pdf\""), containsString("%PDF-raw-bytes"))
                                : not(containsString("filename=")))))
                .andRespond(withSuccess("{\"applicationId\":\"APP-1\"}",MediaType.APPLICATION_JSON));
        var request = multipart("/api/integration/applications");
        if (withFile) request.file(new MockMultipartFile("file","receipt.pdf","application/pdf","%PDF-raw-bytes".getBytes()));
        mvc.perform(request.param("clientId", "CL-1").param("personalAccount", "123456790").param("subject", "Subject").param("description", "Text"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.applicationId").value("APP-1")); server.verify();
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"APPROVED,false", "APPROVED,true", "REJECTED,false", "REJECTED,true", "PROCESSED,false", "PROCESSED,true"})
    void updatesUseTextFieldsAndOptionalFile(String action, boolean withFile) throws Exception {
        server.expect(requestTo("https://integra.test/rest/crm-client/task")).andExpect(method(HttpMethod.PUT))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.header("Content-Type", startsWith("multipart/form-data;boundary=")))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.content().string(allOf(
                        containsString("name=\"applicationId\""), containsString("APP-1"),
                        containsString("name=\"employeeId\""), containsString("EMP-1"),
                        containsString("name=\"status\""), containsString(action),
                        not(containsString("name=\"data\"")), not(containsString("application/json")),
                        action.equals("REJECTED") ? allOf(containsString("name=\"reason\""), containsString("Reason")) : not(containsString("name=\"reason\"")),
                        action.equals("PROCESSED") ? allOf(containsString("name=\"result\""), containsString("Result")) : not(containsString("name=\"result\"")),
                        withFile ? allOf(containsString("name=\"file\""), containsString("filename=\"result.pdf\""), containsString("%PDF-raw-bytes")) : not(containsString("filename=")))))
                .andRespond(withNoContent());
        var request = multipart(HttpMethod.PUT,"/api/integration/applications");
        if (withFile) request.file(new MockMultipartFile("file", "result.pdf", "application/pdf", "%PDF-raw-bytes".getBytes()));
        mvc.perform(request.param("applicationId", "APP-1").param("employeeId", "EMP-1").param("status", action)
                .param("reason", action.equals("REJECTED") ? "Reason" : " ")
                .param("result", action.equals("PROCESSED") ? "Result" : ""))
                .andExpect(status().isOk()); server.verify();
    }
    @Test void invalidActionsAndLongTextDoNotReachIntegra() throws Exception {
        for (String action : new String[]{"REJECTED", "PROCESSED"}) {
            mvc.perform(multipart(HttpMethod.PUT,"/api/integration/applications").param("applicationId", "APP-1")
                    .param("employeeId", "EMP-1").param("status", action)).andExpect(status().isBadRequest());
        }
        mvc.perform(multipart("/api/integration/applications").param("clientId", "CL-1").param("personalAccount", "123456790").param("subject", "Subject").param("description", "x".repeat(1001))).andExpect(status().isBadRequest()); server.verify();
    }
    @Test void routesAndTypedResponses() throws Exception {
        String[][] cases = {
            {"/clients", "/rest/accaunt-details/all2", "[{\"clientId\":\"CL-1\",\"fullName\":\"Client\",\"personalAccount\":\"123456790\",\"address\":{\"city\":\"Moscow\"}}]"},
            {"/employees", "/rest/employee-details/all", "[]"},
            {"/personal-account/CL-1", "/rest/personal-account-details/CL-1", "{\"personalAccount\":\"123\"}"},
            {"/client/CL-1", "/rest/crm-client/task/client/CL-1", "[]"},
            {"/employee/EMP-1", "/rest/crm-client/task/employee/EMP-1", "[]"},
            {"/APP-1", "/rest/crm-client/task/APP-1", "{\"applicationId\":\"APP-1\",\"files\":[{\"filename\":\"receipt.pdf\",\"file\":{\"guid\":\"FILE-1\",\"url\":\"https://ignored.test\"}}]}"}
        };
        for (String[] c : cases) { server.reset(); server.expect(requestTo("https://integra.test" + c[1])).andExpect(method(HttpMethod.GET)).andRespond(withSuccess(c[2],MediaType.APPLICATION_JSON)); mvc.perform(get("/api/integration/applications" + c[0])).andExpect(status().isOk()).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Cache-Control","no-store")); server.verify(); }
    }
    @Test void clientListPreservesPersonalAccountAndCaseOneKeepsItsEndpoint() throws Exception {
        server.expect(requestTo("https://integra.test/rest/accaunt-details/all2"))
                .andRespond(withSuccess("[{\"clientId\":\"CL-1\",\"fullName\":\"Client\",\"personalAccount\":\"123456790\"}]", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://integra.test/rest/accaunt-details/all"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        mvc.perform(get("/api/integration/applications/clients")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].personalAccount").value("123456790"));
        mvc.perform(get("/api/integration/crm")).andExpect(status().isOk());
        server.verify();
    }
    @Test void createRequiresPersonalAccount() throws Exception {
        mvc.perform(multipart("/api/integration/applications").param("clientId", "CL-1")
                .param("subject", "Subject").param("description", "Text")).andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/integration/applications").param("clientId", "CL-1")
                .param("personalAccount", " ").param("subject", "Subject").param("description", "Text"))
                .andExpect(status().isBadRequest());
        server.verify();
    }
    @Test void downloadPreservesBytesAndForcesAttachment() throws Exception {
        byte[] bytes = {0,1,2,(byte)255};
        server.expect(requestTo("https://integra.test/rest/crm-client/file/FILE-1/download"))
                .andRespond(withSuccess(bytes,MediaType.APPLICATION_PDF).header("Content-Disposition","attachment; filename=receipt.pdf"));
        mvc.perform(get("/api/integration/applications/files/FILE-1/download")).andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().bytes(bytes))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Content-Disposition",containsString("attachment")))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("X-Content-Type-Options","nosniff")); server.verify();
    }
}
