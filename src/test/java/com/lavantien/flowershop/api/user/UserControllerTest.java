package com.lavantien.flowershop.api.user;

import com.lavantien.flowershop.service.MailService;
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

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
		mockMvc = MockMvcBuilders.standaloneSetup(
			new UserController(userRepository, mock(MailService.class), userService, passwordService)).build();
	}

	private User persona(Long id, String type, String email, String answer) {
		User user = new User("Demo Persona", passwordService.hash("1234qwer"), email, "0900000001",
			"01 Demo Lane", "Binh Thanh", "Ho Chi Minh", answer);
		user.setId(id);
		user.setType(type);
		return user;
	}

	private static String loginBody(String email, String password) {
		return Base64.getEncoder().encodeToString((email + "j0z" + password).getBytes(StandardCharsets.UTF_8));
	}

	private static String tokenOf(long id, String type) {
		return Base64.getEncoder().encodeToString((id + "+" + type).getBytes(StandardCharsets.UTF_8));
	}

	private static final String GUESS_TOKEN = Base64.getEncoder()
		.encodeToString("0+GUESS".getBytes(StandardCharsets.UTF_8));

	@Test
	void loginSucceedsAgainstABcryptStoredPassword() throws Exception {
		User user = persona(1L, "ADMIN", "admin@flowershop.example", "demo");
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
		User user = persona(4L, "USER", "member@flowershop.example", "demo");
		when(userRepository.findByEmail("member@flowershop.example")).thenReturn(user);

		mockMvc.perform(post("/api/user/login").contentType(MediaType.TEXT_PLAIN)
				.content(loginBody("member@flowershop.example", "wrong")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(GUESS_TOKEN));
		assertTrue(userService.loggedInIds.isEmpty());
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
		User user = persona(4L, "USER", "member@flowershop.example", "demo");
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
		User user = persona(2L, "ADMIN", "editor@flowershop.example", null);
		when(userRepository.findByEmail("editor@flowershop.example")).thenReturn(user);

		mockMvc.perform(post("/api/user/resetPassword").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"editor@flowershop.example\",\"answer\":\"demo\",\"password\":\"newpass123\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(GUESS_TOKEN));
	}

	@Test
	void userResponsesDoNotShipThePassword() throws Exception {
		when(userRepository.findById(4L)).thenReturn(java.util.Optional.of(persona(4L, "USER",
			"member@flowershop.example", "demo")));

		mockMvc.perform(get("/api/user/4"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.password").doesNotExist())
			.andExpect(jsonPath("$.email").value("member@flowershop.example"));
	}
}
