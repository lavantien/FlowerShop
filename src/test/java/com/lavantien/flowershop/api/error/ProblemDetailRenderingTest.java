package com.lavantien.flowershop.api.error;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.math.BigDecimal;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// The contract promises application/problem+json for every error, so the
// framework-raised failures (unreadable bodies, type mismatches, unmatched
// routes, wrong methods, list element validation) must all render the same
// document shape the ApiException family does.
class ProblemDetailRenderingTest {
	record ProbeBody(@NotBlank String name, @Positive BigDecimal price) {}

	@RestController
	static class ProbeController {
		@GetMapping("/probe")
		public String page(@RequestParam Integer page) {
			return "page " + page;
		}

		@PostMapping("/probe")
		public String accept(@RequestBody ProbeBody body) {
			return body.name();
		}

		@PostMapping("/probe-list")
		public List<ProbeBody> acceptList(@RequestBody List<@jakarta.validation.Valid ProbeBody> bodies) {
			return bodies;
		}

		@GetMapping("/probe-no-resource")
		public String noResource() throws NoResourceFoundException {
			throw new NoResourceFoundException(HttpMethod.GET, "/api/nope", "/api/nope");
		}
	}

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.standaloneSetup(new ProbeController())
			.setControllerAdvice(new ApiExceptionHandler())
			.build();
	}

	@Test
	void aMalformedJsonBodyAnswersAProblemDocument() throws Exception {
		mockMvc.perform(post("/probe").contentType(MediaType.APPLICATION_JSON).content("{\"name\": nope"))
			.andExpect(status().isBadRequest())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.instance").value("/probe"));
	}

	@Test
	void aWronglyTypedQueryParameterAnswersAProblemDocument() throws Exception {
		mockMvc.perform(get("/probe").queryParam("page", "abc"))
			.andExpect(status().isBadRequest())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.detail").value("the parameter page has the wrong type"));
	}

	@Test
	void anUnsupportedMethodAnswersAProblemDocument() throws Exception {
		mockMvc.perform(delete("/probe"))
			.andExpect(status().isMethodNotAllowed())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
	}

	@Test
	void anUnmatchedApiRouteAnswersAProblemDocument() throws Exception {
		mockMvc.perform(get("/probe-no-resource"))
			.andExpect(status().isNotFound())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void listElementValidationAnswersTheContractShape() throws Exception {
		mockMvc.perform(post("/probe-list").contentType(MediaType.APPLICATION_JSON)
				.content("[{\"name\":\"Rose\",\"price\":-5},{\"name\":\"Tulip\",\"price\":100000}]"))
			.andExpect(status().isBadRequest())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors['0.price']").value("must be greater than 0"));
	}
}
