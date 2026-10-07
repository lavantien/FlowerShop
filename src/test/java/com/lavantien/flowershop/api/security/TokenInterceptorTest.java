package com.lavantien.flowershop.api.security;

import com.lavantien.flowershop.api.error.ApiExceptionHandler;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.api.user.UserRepository;
import com.lavantien.flowershop.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import static com.lavantien.flowershop.api.security.AuthTestSupport.persona;
import static com.lavantien.flowershop.api.security.AuthTestSupport.prime;
import static com.lavantien.flowershop.api.security.AuthTestSupport.tokenOf;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TokenInterceptorTest {
	private UserRepository userRepository;
	private UserService userService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		userRepository = mock(UserRepository.class);
		userService = new UserService();
		mockMvc = MockMvcBuilders.standaloneSetup(new ProbeController())
			.addInterceptors(new TokenInterceptor(userRepository, userService))
			.setControllerAdvice(new ApiExceptionHandler())
			.build();
	}

	@Test
	void acceptedTokenReachesTheHandlerWithAuthAttributes() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk())
			.andExpect(content().string("4:USER"));
	}

	@Test
	void publicSurfacesSkipTheTokenCheck() throws Exception {
		mockMvc.perform(get("/api/product"))
			.andExpect(status().isOk())
			.andExpect(content().string("public"));
		mockMvc.perform(get("/api/branch"))
			.andExpect(status().isOk())
			.andExpect(content().string("public"));
		mockMvc.perform(post("/api/user/create").contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().isOk())
			.andExpect(content().string("public"));
	}

	@Test
	void theBranchStockSurfaceStaysSessionGated() throws Exception {
		mockMvc.perform(get("/api/branch/3/stock"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void missingHeaderIsRejected() throws Exception {
		mockMvc.perform(get("/api/probe"))
			.andExpect(status().isUnauthorized())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
	}

	@Test
	void garbageTokensAreRejected() throws Exception {
		mockMvc.perform(get("/api/probe").header("X-Auth-Token", "not base64 !!!"))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOfRaw("no separator")))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOfRaw("notANumber+USER")))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void validFormatButUnknownIdIsRejected() throws Exception {
		when(userRepository.findById(99L)).thenReturn(java.util.Optional.empty());

		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOf(99, Role.USER)))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void forgedAdminTokenWithoutADatabaseRowBounces() throws Exception {
		when(userRepository.findById(1L)).thenReturn(java.util.Optional.empty());

		mockMvc.perform(get("/api/bill").header("X-Auth-Token", tokenOfRaw("1+ADMIN")))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void loggedOutIdIsRejected() throws Exception {
		when(userRepository.findById(4L)).thenReturn(java.util.Optional.of(persona(4, Role.USER,
			"member@flowershop.example")));

		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void typeMismatchAgainstTheDatabaseIsRejected() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOf(4, Role.ADMIN)))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void disabledAccountIsRejected() throws Exception {
		var disabled = persona(4, Role.USER, "member@flowershop.example");
		disabled.setEnable(false);
		prime(userRepository, userService, disabled);

		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void tokenWithAWrongSecretIsRejected() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOfRaw("4+USER+0000deadbeef0000")))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void tokenWithoutASecretSegmentIsRejected() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOfRaw("4+USER")))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void theOldTokenBouncesAfterAFreshLoginRotatesTheSecret() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));
		String firstToken = tokenOf(4, Role.USER);
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(get("/api/probe").header("X-Auth-Token", firstToken))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/probe").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk());
	}

	@Test
	void requireRoleAllowsTheAdminAndRejectsTheMember() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(get("/api/probe/admin").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk())
			.andExpect(content().string("admin only"));
		mockMvc.perform(get("/api/probe/admin").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	private static String tokenOfRaw(String raw) {
		return java.util.Base64.getEncoder().encodeToString(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));
	}

	@RestController
	static class ProbeController {
		@GetMapping("/api/product")
		public ResponseEntity<String> publicSurface() {
			return ResponseEntity.ok("public");
		}

		@GetMapping("/api/branch")
		public ResponseEntity<String> branches() {
			return ResponseEntity.ok("public");
		}

		@GetMapping("/api/branch/3/stock")
		public ResponseEntity<String> branchStock() {
			return ResponseEntity.ok("stock");
		}

		@PostMapping("/api/user/create")
		public ResponseEntity<String> create() {
			return ResponseEntity.ok("public");
		}

		@GetMapping("/api/bill")
		public ResponseEntity<String> bills() {
			return ResponseEntity.ok("bills");
		}

		@GetMapping("/api/probe")
		public ResponseEntity<String> probe(HttpServletRequest request) {
			return ResponseEntity.ok(request.getAttribute(Auth.USER_ID_ATTRIBUTE) + ":" + request.getAttribute(Auth.ROLE_ATTRIBUTE));
		}

		@RequireRole(Role.ADMIN)
		@GetMapping("/api/probe/admin")
		public ResponseEntity<String> adminProbe() {
			return ResponseEntity.ok("admin only");
		}
	}
}
