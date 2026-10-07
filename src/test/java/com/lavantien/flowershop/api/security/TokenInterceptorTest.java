package com.lavantien.flowershop.api.security;

import com.lavantien.flowershop.api.user.User;
import com.lavantien.flowershop.api.user.UserRepository;
import com.lavantien.flowershop.service.PasswordService;
import com.lavantien.flowershop.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TokenInterceptorTest {
	private UserRepository userRepository;
	private UserService userService;
	private MockMvc mockMvc;

	private static String tokenOf(String raw) {
		return Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
	}

	@BeforeEach
	void setUp() {
		userRepository = mock(UserRepository.class);
		userService = new UserService();
		mockMvc = MockMvcBuilders.standaloneSetup(new ProbeController())
			.addInterceptors(new TokenInterceptor(userRepository, userService))
			.build();
	}

	private User persona(long id, String type, boolean enable) {
		PasswordService passwordService = new PasswordService();
		User user = new User("Demo Persona", passwordService.hash("1234qwer"), "demo@flowershop.example",
			"0900000001", "01 Demo Lane", "Binh Thanh", "Ho Chi Minh", "demo");
		user.setId(id);
		user.setType(type);
		user.setEnable(enable);
		return user;
	}

	@Test
	void acceptedTokenReachesTheHandlerWithAuthAttributes() throws Exception {
		when(userRepository.findById(4L)).thenReturn(Optional.of(persona(4, "USER", true)));
		userService.loggedInIds.add(4L);

		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOf("4+USER")))
			.andExpect(status().isOk())
			.andExpect(content().string("4:USER"));
	}

	@Test
	void publicSurfacesSkipTheTokenCheck() throws Exception {
		mockMvc.perform(get("/api/product"))
			.andExpect(status().isOk())
			.andExpect(content().string("public"));
		mockMvc.perform(post("/api/user/login").contentType(org.springframework.http.MediaType.TEXT_PLAIN)
				.content(tokenOf("member@flowershop.examplej0z12345678")))
			.andExpect(status().isOk())
			.andExpect(content().string("public"));
	}

	@Test
	void missingHeaderIsRejected() throws Exception {
		mockMvc.perform(get("/api/probe"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void garbageTokensAreRejected() throws Exception {
		mockMvc.perform(get("/api/probe").header("X-Auth-Token", "not base64 !!!"))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOf("no separator")))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOf("notANumber+USER")))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void validFormatButUnknownIdIsRejected() throws Exception {
		when(userRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOf("99+USER")))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void loggedOutIdIsRejected() throws Exception {
		when(userRepository.findById(4L)).thenReturn(Optional.of(persona(4, "USER", true)));

		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOf("4+USER")))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void typeMismatchAgainstTheDatabaseIsRejected() throws Exception {
		when(userRepository.findById(4L)).thenReturn(Optional.of(persona(4, "USER", true)));
		userService.loggedInIds.add(4L);

		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOf("4+ADMIN")))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void disabledAccountIsRejected() throws Exception {
		when(userRepository.findById(4L)).thenReturn(Optional.of(persona(4, "USER", false)));
		userService.loggedInIds.add(4L);

		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOf("4+USER")))
			.andExpect(status().isUnauthorized());
	}

	@RestController
	static class ProbeController {
		@GetMapping("/api/product")
		public ResponseEntity<String> publicSurface() {
			return ResponseEntity.ok("public");
		}

		@PostMapping("/api/user/login")
		public ResponseEntity<String> login() {
			return ResponseEntity.ok("public");
		}

		@GetMapping("/api/probe")
		public ResponseEntity<String> probe(HttpServletRequest request) {
			return ResponseEntity.ok(request.getAttribute("authUserId") + ":" + request.getAttribute("authType"));
		}
	}
}
