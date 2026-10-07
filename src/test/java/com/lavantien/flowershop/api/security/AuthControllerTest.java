package com.lavantien.flowershop.api.security;

import com.lavantien.flowershop.api.error.ApiExceptionHandler;
import com.lavantien.flowershop.api.error.UnauthenticatedException;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.api.user.User;
import com.lavantien.flowershop.api.user.UserRepository;
import com.lavantien.flowershop.service.PasswordService;
import com.lavantien.flowershop.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static com.lavantien.flowershop.api.security.AuthTestSupport.persona;
import static com.lavantien.flowershop.api.security.AuthTestSupport.prime;
import static com.lavantien.flowershop.api.security.AuthTestSupport.tokenIdentity;
import static com.lavantien.flowershop.api.security.AuthTestSupport.tokenOf;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthControllerTest {
	private UserRepository userRepository;
	private UserService userService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		userRepository = mock(UserRepository.class);
		userService = new UserService();
		mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(userRepository, userService, new PasswordService()))
			.addInterceptors(new TokenInterceptor(userRepository, userService))
			.setControllerAdvice(new ApiExceptionHandler())
			.build();
	}

	private static String loginBody(String email, String password) {
		return "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
	}

	@Test
	void loginSucceedsAgainstABcryptStoredPassword() throws Exception {
		User user = persona(1, Role.ADMIN, "admin@flowershop.example");
		when(userRepository.findByEmail("admin@flowershop.example")).thenReturn(user);

		mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(loginBody("admin@flowershop.example", "1234qwer")))
			.andExpect(status().isOk())
			.andExpect(tokenIdentity("1+ADMIN"))
			.andExpect(jsonPath("$.user.email").value("admin@flowershop.example"))
			.andExpect(jsonPath("$.user.password").doesNotExist())
			.andExpect(jsonPath("$.user.answer").doesNotExist());
		assertTrue(userService.isLoggedIn(1L));
	}

	@Test
	void loginReturnsTheStoredProfileWithoutSecrets() throws Exception {
		User user = persona(2, Role.USER, "editor@flowershop.example");
		user.setEmail("editor@flowershop.example");
		user.setDistrict("Cau Giay");
		user.setCity("Hanoi");
		when(userRepository.findByEmail("editor@flowershop.example")).thenReturn(user);

		mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(loginBody("editor@flowershop.example", "1234qwer")))
			.andExpect(status().isOk())
			.andExpect(tokenIdentity("2+USER"))
			.andExpect(jsonPath("$.user.district").value("Cau Giay"))
			.andExpect(jsonPath("$.user.city").value("Hanoi"))
			.andExpect(jsonPath("$.user.password").doesNotExist())
			.andExpect(jsonPath("$.user.answer").doesNotExist());
	}

	@Test
	void loginOnALegacyNullRoleAccountAnswers401NotA500() throws Exception {
		// ddl-auto update on a carried-forward volume can leave role NULL;
		// minting a session for such an account must fail as 401 problem+json.
		User legacy = persona(7, Role.USER, "legacy@flowershop.example");
		legacy.setRole(null);
		when(userRepository.findByEmail("legacy@flowershop.example")).thenReturn(legacy);

		mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(loginBody("legacy@flowershop.example", "1234qwer")))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

		assertFalse(userService.isLoggedIn(7L), "no session may open for a roleless account");
	}

	@Test
	void mintingATokenWithoutARoleThrowsUnauthenticated() {
		assertThrows(UnauthenticatedException.class, () -> Auth.mintToken(1, null, "secret"));
	}

	@Test
	void loginRejectsAWrongPasswordWithAReal401() throws Exception {
		User user = persona(4, Role.USER, "member@flowershop.example");
		when(userRepository.findByEmail("member@flowershop.example")).thenReturn(user);

		mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(loginBody("member@flowershop.example", "wrong")))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
		assertFalse(userService.isLoggedIn(4L));
	}

	@Test
	void loginRejectsAnUnknownEmailAfterTheConstantTimeBurn() throws Exception {
		when(userRepository.findByEmail("nobody@flowershop.example")).thenReturn(null);

		mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(loginBody("nobody@flowershop.example", "1234qwer")))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
		assertFalse(userService.isLoggedIn(1L));
	}

	@Test
	void loginRefusesADisabledAccount() throws Exception {
		User user = persona(3, Role.ADMIN, "staff@flowershop.example");
		user.setEnable(false);
		when(userRepository.findByEmail("staff@flowershop.example")).thenReturn(user);

		mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(loginBody("staff@flowershop.example", "1234qwer")))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
		assertFalse(userService.isLoggedIn(3L));
	}

	@Test
	void loginRejectsAMissingEmailAsAValidationError() throws Exception {
		mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"password\":\"1234qwer\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors.email").value("must not be blank"));
	}

	@Test
	void loginRejectsAMissingPasswordAsAValidationError() throws Exception {
		mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"member@flowershop.example\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors.password").value("must not be blank"));
	}

	@Test
	void logoutWithAValidHeaderEndsTheSessionAndAnswers204() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(post("/api/auth/logout").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isNoContent());
		assertFalse(userService.isLoggedIn(4L), "a valid logout must drop the session");
	}

	@Test
	void logoutWithoutAHeaderIsRejected() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(post("/api/auth/logout"))
			.andExpect(status().isUnauthorized());
		assertTrue(userService.isLoggedIn(4L), "a headerless logout must not end the session");
	}

	@Test
	void logoutWithAGarbageTokenIsRejected() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(post("/api/auth/logout").header("X-Auth-Token", "not base64 !!!"))
			.andExpect(status().isUnauthorized());
		assertTrue(userService.isLoggedIn(4L));
	}

	@Test
	void logoutWithAWrongSecretLeavesTheSessionAlive() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));
		String forged = Base64.getEncoder().encodeToString("4+USER+deadbeefdeadbeef".getBytes(StandardCharsets.UTF_8));

		mockMvc.perform(post("/api/auth/logout").header("X-Auth-Token", forged))
			.andExpect(status().isUnauthorized());
		assertTrue(userService.isLoggedIn(4L), "a forged token must not log anybody out");
	}

	@Test
	void aFreshLoginRotatesTheSecretAndKillsTheOldToken() throws Exception {
		User user = persona(1, Role.ADMIN, "admin@flowershop.example");
		when(userRepository.findByEmail("admin@flowershop.example")).thenReturn(user);
		when(userRepository.findById(1L)).thenReturn(java.util.Optional.of(user));

		String firstToken = loginAndReadToken("admin@flowershop.example", "1234qwer");
		String secondToken = loginAndReadToken("admin@flowershop.example", "1234qwer");

		mockMvc.perform(post("/api/auth/logout").header("X-Auth-Token", firstToken))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(post("/api/auth/logout").header("X-Auth-Token", secondToken))
			.andExpect(status().isNoContent());
	}

	private String loginAndReadToken(String email, String password) throws Exception {
		String body = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content(loginBody(email, password)))
			.andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
		return com.jayway.jsonpath.JsonPath.read(body, "$.token");
	}
}
