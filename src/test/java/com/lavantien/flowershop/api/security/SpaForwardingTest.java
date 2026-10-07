package com.lavantien.flowershop.api.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class SpaForwardingTest {
	@Autowired
	private WebApplicationContext context;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
	}

	@ParameterizedTest
	@ValueSource(strings = {"/", "/shop", "/contact", "/admin", "/info", "/summary"})
	void spaDeepLinksForwardToIndexHtml(String path) throws Exception {
		mockMvc.perform(get(path))
			.andExpect(status().isOk())
			.andExpect(forwardedUrl("/index.html"));
	}

	@Test
	void theTestRouteIsNotForwarded() throws Exception {
		mockMvc.perform(get("/test"))
			.andExpect(status().isNotFound());
	}
}
