package com.lavantien.flowershop.api.user;

import com.lavantien.flowershop.api.security.TokenInterceptor;
import com.lavantien.flowershop.service.PasswordService;
import com.lavantien.flowershop.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Optional;

import static com.lavantien.flowershop.api.security.AuthTestSupport.persona;
import static com.lavantien.flowershop.api.security.AuthTestSupport.prime;
import static com.lavantien.flowershop.api.security.AuthTestSupport.tokenOf;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UserControllerTest {
	private UserRepository userRepository;
	private UserService userService;
	private PasswordService passwordService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		userRepository = mock(UserRepository.class);
		userService = new UserService();
		passwordService = new PasswordService();
		mockMvc = MockMvcBuilders.standaloneSetup(new UserController(userRepository, userService, passwordService))
			.addInterceptors(new TokenInterceptor(userRepository, userService))
			.build();
	}

	private static String loginBody(String email, String password) {
		return Base64.getEncoder().encodeToString((email + "j0z" + password).getBytes(StandardCharsets.UTF_8));
	}

	private static final String GUESS_TOKEN = Base64.getEncoder()
		.encodeToString("0+GUESS".getBytes(StandardCharsets.UTF_8));

	@Test
	void loginSucceedsAgainstABcryptStoredPassword() throws Exception {
		User user = persona(1, "ADMIN", "admin@flowershop.example");
		when(userRepository.findByEmail("admin@flowershop.example")).thenReturn(user);

		mockMvc.perform(post("/api/user/login").contentType(MediaType.TEXT_PLAIN)
				.content(loginBody("admin@flowershop.example", "1234qwer")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(tokenOf(1, "ADMIN")))
			.andExpect(jsonPath("$.phone").value("0900000001"))
			.andExpect(jsonPath("$.detailAddress").value("01 Demo Lane, Binh Thanh, Ho Chi Minh"));
		assertTrue(userService.loggedInIds.contains(1L));
	}

	@Test
	void loginRejectsAWrongPassword() throws Exception {
		User user = persona(4, "USER", "member@flowershop.example");
		when(userRepository.findByEmail("member@flowershop.example")).thenReturn(user);

		mockMvc.perform(post("/api/user/login").contentType(MediaType.TEXT_PLAIN)
				.content(loginBody("member@flowershop.example", "wrong")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(GUESS_TOKEN));
		assertFalse(userService.loggedInIds.contains(4L));
	}

	@Test
	void loginRejectsAnUnknownEmail() throws Exception {
		when(userRepository.findByEmail("nobody@flowershop.example")).thenReturn(null);

		mockMvc.perform(post("/api/user/login").contentType(MediaType.TEXT_PLAIN)
				.content(loginBody("nobody@flowershop.example", "1234qwer")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(GUESS_TOKEN));
		assertTrue(userService.loggedInIds.isEmpty());
	}

	@Test
	void resetPasswordStoresABcryptHashAndLogsTheUserIn() throws Exception {
		User user = persona(4, "USER", "member@flowershop.example");
		when(userRepository.findByEmail("member@flowershop.example")).thenReturn(user);
		when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/user/resetPassword").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"member@flowershop.example\",\"answer\":\"demo\",\"password\":\"newpass123\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(tokenOf(4, "USER")));

		ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
		verify(userRepository).save(saved.capture());
		assertTrue(passwordService.matches("newpass123", saved.getValue().getPassword()),
			"the stored password must be a bcrypt hash of the submitted one");
		assertTrue(userService.loggedInIds.contains(4L));
	}

	@Test
	void resetPasswordToleratesASeededRowWithoutAnAnswer() throws Exception {
		User user = persona(2, "ADMIN", "editor@flowershop.example");
		user.setAnswer(null);
		when(userRepository.findByEmail("editor@flowershop.example")).thenReturn(user);

		mockMvc.perform(post("/api/user/resetPassword").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"editor@flowershop.example\",\"answer\":\"demo\",\"password\":\"newpass123\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(GUESS_TOKEN));
	}

	@Test
	void memberReadsOwnAccountWithoutThePasswordField() throws Exception {
		prime(userRepository, userService, persona(4, "USER", "member@flowershop.example"));

		mockMvc.perform(get("/api/user/4").header("X-Auth-Token", tokenOf(4, "USER")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.password").doesNotExist())
			.andExpect(jsonPath("$.email").value("member@flowershop.example"));
	}

	@Test
	void memberCannotReadAForeignAccount() throws Exception {
		prime(userRepository, userService, persona(4, "USER", "member@flowershop.example"));

		mockMvc.perform(get("/api/user/1").header("X-Auth-Token", tokenOf(4, "USER")))
			.andExpect(status().isForbidden());
	}

	@Test
	void nonAdminPutCannotEscalateTypeOrDropEnable() throws Exception {
		prime(userRepository, userService, persona(4, "USER", "member@flowershop.example"));
		when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(put("/api/user/4").header("X-Auth-Token", tokenOf(4, "USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Renamed\",\"phone\":\"0900000004\",\"address\":\"04 Demo Lane\","
					+ "\"answer\":\"demo\",\"type\":\"ADMIN\",\"enable\":false,\"password\":\"hacked\"}"))
			.andExpect(status().isOk());

		ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
		verify(userRepository).save(saved.capture());
		assertTrue(saved.getValue().getType().equals("USER"), "type must stay USER for a non-admin caller");
		assertTrue(Boolean.TRUE.equals(saved.getValue().getEnable()), "enable must stay true for a non-admin caller");
		assertTrue(passwordService.matches("1234qwer", saved.getValue().getPassword()),
			"password must never be writable through PUT");
		assertTrue("Renamed".equals(saved.getValue().getName()), "owner fields still copy through");
	}

	@Test
	void adminPutCanManageTypeAndEnable() throws Exception {
		prime(userRepository, userService, persona(1, "ADMIN", "admin@flowershop.example"));
		when(userRepository.findById(4L)).thenReturn(Optional.of(persona(4, "USER", "member@flowershop.example")));
		when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(put("/api/user/4").header("X-Auth-Token", tokenOf(1, "ADMIN"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Renamed\",\"type\":\"ADMIN\",\"enable\":false}"))
			.andExpect(status().isOk());

		ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
		verify(userRepository).save(saved.capture());
		assertTrue(saved.getValue().getType().equals("ADMIN"));
		assertTrue(Boolean.FALSE.equals(saved.getValue().getEnable()));
	}

	@Test
	void nonAdminPutOnAForeignAccountIsForbidden() throws Exception {
		prime(userRepository, userService, persona(4, "USER", "member@flowershop.example"));

		mockMvc.perform(put("/api/user/1").header("X-Auth-Token", tokenOf(4, "USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Hijacked\"}"))
			.andExpect(status().isForbidden());
	}
}
