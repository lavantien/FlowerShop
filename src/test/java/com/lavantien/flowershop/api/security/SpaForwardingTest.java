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

import static org.junit.jupiter.api.Assertions.assertNull;
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

	private static org.springframework.test.web.servlet.ResultMatcher noForward() {
		return result -> assertNull(result.getResponse().getForwardedUrl(), "the request must not forward to the SPA");
	}

	@ParameterizedTest
	@ValueSource(strings = {"/", "/shop", "/contact", "/admin", "/info", "/summary",
		"/pay/abc-123", "/admin/orders", "/info/wishlist", "/info/profile"})
	void spaDeepLinksForwardToIndexHtml(String path) throws Exception {
		mockMvc.perform(get(path))
			.andExpect(status().isOk())
			.andExpect(forwardedUrl("/index.html"));
	}

	@Test
	void apiPathsNeverForwardToTheSpa() throws Exception {
		mockMvc.perform(get("/api/nonexistent"))
			.andExpect(status().isNotFound())
			.andExpect(noForward());
		mockMvc.perform(get("/api/nonexistent/deeper"))
			.andExpect(status().isNotFound())
			.andExpect(noForward());
	}

	@Test
	void dottedAssetPathsPassThroughToTheStaticHandler() throws Exception {
		// No such asset exists, so the resolver 404s; the point is that it
		// never lands on the SPA index.
		mockMvc.perform(get("/pay/no-such.js"))
			.andExpect(status().isNotFound())
			.andExpect(noForward());
		mockMvc.perform(get("/main.js"))
			.andExpect(status().isNotFound())
			.andExpect(noForward());
	}
}
