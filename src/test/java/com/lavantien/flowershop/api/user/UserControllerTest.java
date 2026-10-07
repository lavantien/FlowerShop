package com.lavantien.flowershop.api.user;

import com.lavantien.flowershop.api.order.OrderRepository;
import com.lavantien.flowershop.api.error.ApiExceptionHandler;
import com.lavantien.flowershop.api.security.TokenInterceptor;
import com.lavantien.flowershop.service.PasswordService;
import com.lavantien.flowershop.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static com.lavantien.flowershop.api.security.AuthTestSupport.persona;
import static com.lavantien.flowershop.api.security.AuthTestSupport.prime;
import static com.lavantien.flowershop.api.security.AuthTestSupport.tokenIdentity;
import static com.lavantien.flowershop.api.security.AuthTestSupport.tokenOf;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UserControllerTest {
	private UserRepository userRepository;
	private OrderRepository orderRepository;
	private UserService userService;
	private PasswordService passwordService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		userRepository = mock(UserRepository.class);
		orderRepository = mock(OrderRepository.class);
		userService = new UserService();
		passwordService = new PasswordService();
		mockMvc = MockMvcBuilders.standaloneSetup(
				new UserController(userRepository, orderRepository, userService, passwordService))
			.addInterceptors(new TokenInterceptor(userRepository, userService))
			.setControllerAdvice(new ApiExceptionHandler())
			.build();
	}

	@Test
	void resetPasswordStoresABcryptHashAndLogsTheUserIn() throws Exception {
		User user = persona(4, Role.USER, "member@flowershop.example");
		when(userRepository.findByEmail("member@flowershop.example")).thenReturn(user);
		when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/user/resetPassword").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"member@flowershop.example\",\"answer\":\"demo\",\"newPassword\":\"newpass123\"}"))
			.andExpect(status().isOk())
			.andExpect(tokenIdentity("4+USER"))
			.andExpect(jsonPath("$.user.email").value("member@flowershop.example"))
			.andExpect(jsonPath("$.user.password").doesNotExist());

		ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
		verify(userRepository).save(saved.capture());
		assertTrue(passwordService.matches("newpass123", saved.getValue().getPassword()),
			"the stored password must be bcrypt of the submitted one");
		assertTrue(userService.isLoggedIn(4L));
	}

	@Test
	void resetPasswordAnswers401ForAnUnknownEmail() throws Exception {
		when(userRepository.findByEmail("nobody@flowershop.example")).thenReturn(null);

		mockMvc.perform(post("/api/user/resetPassword").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"nobody@flowershop.example\",\"answer\":\"demo\",\"newPassword\":\"newpass123\"}"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
		assertFalse(userService.isLoggedIn(1L));
	}

	@Test
	void resetPasswordAnswers401ForAWrongAnswer() throws Exception {
		User user = persona(4, Role.USER, "member@flowershop.example");
		when(userRepository.findByEmail("member@flowershop.example")).thenReturn(user);

		mockMvc.perform(post("/api/user/resetPassword").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"member@flowershop.example\",\"answer\":\"wrong\",\"newPassword\":\"newpass123\"}"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
		assertFalse(userService.isLoggedIn(4L));
		verify(userRepository, never()).save(any(User.class));
	}

	@Test
	void resetPasswordWithoutAStoredAnswerAnswers401EvenWhenOmittedToo() throws Exception {
		User user = persona(5, Role.USER, "blank@flowershop.example");
		user.setAnswer(null);
		when(userRepository.findByEmail("blank@flowershop.example")).thenReturn(user);

		mockMvc.perform(post("/api/user/resetPassword").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"blank@flowershop.example\",\"answer\":\"demo\",\"newPassword\":\"hacked123\"}"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
		assertFalse(userService.isLoggedIn(5L), "null must not match null on the security answer");
	}

	@Test
	void resetPasswordRejectsABlankNewPasswordAsAValidationError() throws Exception {
		mockMvc.perform(post("/api/user/resetPassword").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"member@flowershop.example\",\"answer\":\"demo\",\"newPassword\":\"\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors.newPassword").value("must not be blank"));
	}

	@Test
	void resetPasswordToleratesASeededRowWithoutAnAnswer() throws Exception {
		User user = persona(2, Role.ADMIN, "editor@flowershop.example");
		user.setAnswer(null);
		when(userRepository.findByEmail("editor@flowershop.example")).thenReturn(user);

		mockMvc.perform(post("/api/user/resetPassword").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"editor@flowershop.example\",\"answer\":\"demo\",\"newPassword\":\"newpass123\"}"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
	}

	@Test
	void createRefusesAnEmailAlreadyInUse() throws Exception {
		when(userRepository.findByEmail("member@flowershop.example"))
			.thenReturn(persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(post("/api/user/create").contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Clone\",\"email\":\"member@flowershop.example\",\"password\":\"1234qwer\","
					+ "\"answer\":\"demo\"}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("EMAIL_IN_USE"));
	}

	@Test
	void createRejectsAMissingEmailAsAValidationError() throws Exception {
		mockMvc.perform(post("/api/user/create").contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"NoEmail\",\"password\":\"1234qwer\",\"answer\":\"demo\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors.email").value("must not be blank"));
	}

	@Test
	void memberReadsOwnProfileThroughTheMeEndpoint() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(get("/api/user/me").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(4))
			.andExpect(jsonPath("$.email").value("member@flowershop.example"))
			.andExpect(jsonPath("$.role").value("USER"))
			.andExpect(jsonPath("$.enable").value(true))
			.andExpect(jsonPath("$.password").doesNotExist())
			.andExpect(jsonPath("$.answer").doesNotExist());
	}

	@Test
	void meAnswers404WhenTheSessionUserVanishesBetweenInterceptorAndHandler() throws Exception {
		// The interceptor validates the row first, the handler reads it again:
		// a delete landing between the two must answer 404, not 500.
		User member = persona(4, Role.USER, "member@flowershop.example");
		prime(userRepository, userService, member);
		when(userRepository.findById(4L)).thenReturn(Optional.of(member)).thenReturn(Optional.empty());

		mockMvc.perform(get("/api/user/me").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void memberUpdatesOwnProfileThroughTheMeEndpoint() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));
		when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(put("/api/user/me").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Renamed\",\"phone\":\"0900000004\",\"address\":\"04 Demo Lane\","
					+ "\"district\":\"Phú Nhuận\",\"city\":\"Hồ Chí Minh\",\"role\":\"ADMIN\",\"enable\":false,"
					+ "\"password\":\"hacked\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Renamed"))
			.andExpect(jsonPath("$.role").value("USER"))
			.andExpect(jsonPath("$.enable").value(true));

		ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
		verify(userRepository).save(saved.capture());
		assertTrue("Renamed".equals(saved.getValue().getName()));
		assertTrue("0900000004".equals(saved.getValue().getPhone()));
		assertTrue("04 Demo Lane".equals(saved.getValue().getAddress()));
		assertTrue("Phú Nhuận".equals(saved.getValue().getDistrict()));
		assertTrue("Hồ Chí Minh".equals(saved.getValue().getCity()));
		assertTrue(saved.getValue().getRole() == Role.USER, "PUT /me must never touch the role");
		assertTrue(Boolean.TRUE.equals(saved.getValue().getEnable()), "PUT /me must never touch enable");
		assertTrue(passwordService.matches("1234qwer", saved.getValue().getPassword()),
			"PUT /me must never rewrite the password");
		assertTrue("demo".equals(saved.getValue().getAnswer()), "PUT /me must never touch the answer");
	}

	@Test
	void putMeRequiresAName() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(put("/api/user/me").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"\",\"phone\":\"0900000004\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors.name").value("must not be blank"));
	}

	@Test
	void putMeRejectsAStringPastTheColumnWidthInsteadOfTruncatingAtTheDatabase() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(put("/api/user/me").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Overlong\",\"phone\":\"" + "x".repeat(256) + "\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors.phone").value("size must be between 0 and 255"));

		verify(userRepository, never()).save(any(User.class));
	}

	@Test
	void createRejectsAStringPastTheColumnWidthInsteadOfTruncatingAtTheDatabase() throws Exception {
		mockMvc.perform(post("/api/user/create").contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Eve\",\"password\":\"pw123456\",\"email\":\"eve@flowershop.example\","
					+ "\"address\":\"" + "x".repeat(256) + "\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors.address").value("size must be between 0 and 255"));

		verify(userRepository, never()).save(any(User.class));
	}

	@Test
	void adminPutRejectsAStringPastTheColumnWidthInsteadOfTruncatingAtTheDatabase() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));

		mockMvc.perform(put("/api/user/4").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"" + "x".repeat(256) + "\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors.name").value("size must be between 0 and 255"));
	}

	@Test
	void passwordChangeStoresTheNewHashAndEndsEverySession() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));
		when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/user/me/password").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"currentPassword\":\"1234qwer\",\"newPassword\":\"newpass123\"}"))
			.andExpect(status().isNoContent());

		ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
		verify(userRepository).save(saved.capture());
		assertTrue(passwordService.matches("newpass123", saved.getValue().getPassword()),
			"the stored password must be bcrypt of the new one");
		assertFalse(userService.isLoggedIn(4L), "every session of the user must die after a password change");
	}

	@Test
	void passwordChangeWithAWrongCurrentPasswordAnswers401() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(post("/api/user/me/password").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"currentPassword\":\"wrong\",\"newPassword\":\"newpass123\"}"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

		verify(userRepository, never()).save(any(User.class));
		assertTrue(userService.isLoggedIn(4L), "a wrong current password must not end the session");
	}

	@Test
	void memberCannotUseTheAdminUserUpdate() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(put("/api/user/4").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"SelfPromoted\",\"role\":\"ADMIN\",\"enable\":false}"))
			.andExpect(status().isForbidden());
		mockMvc.perform(put("/api/user/1").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Hijacked\"}"))
			.andExpect(status().isForbidden());
	}

	@Test
	void adminPutManagesRoleEnableNameAndPhone() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		when(userRepository.findById(4L)).thenReturn(Optional.of(persona(4, Role.USER, "member@flowershop.example")));
		when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(put("/api/user/4").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Renamed\",\"phone\":\"0900000004\",\"role\":\"ADMIN\",\"enable\":false}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.role").value("ADMIN"))
			.andExpect(jsonPath("$.enable").value(false))
			.andExpect(jsonPath("$.password").doesNotExist());

		ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
		verify(userRepository).save(saved.capture());
		assertTrue("Renamed".equals(saved.getValue().getName()));
		assertTrue("0900000004".equals(saved.getValue().getPhone()));
		assertTrue(saved.getValue().getRole() == Role.ADMIN);
		assertTrue(Boolean.FALSE.equals(saved.getValue().getEnable()));
	}

	@Test
	void adminPutKeepsRoleAndEnableWhenOmitted() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		when(userRepository.findById(4L)).thenReturn(Optional.of(persona(4, Role.USER, "member@flowershop.example")));
		when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(put("/api/user/4").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Renamed\"}"))
			.andExpect(status().isOk());

		ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
		verify(userRepository).save(saved.capture());
		assertTrue(saved.getValue().getRole() == Role.USER, "an omitted role must keep the stored one");
		assertTrue(Boolean.TRUE.equals(saved.getValue().getEnable()), "an omitted enable must keep the stored one");
	}

	@Test
	void adminListsEveryAccountWithoutSecrets() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		when(userRepository.findAll()).thenReturn(List.of(
			persona(1, Role.ADMIN, "admin@flowershop.example"),
			persona(4, Role.USER, "member@flowershop.example")));

		mockMvc.perform(get("/api/user").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].email").value("admin@flowershop.example"))
			.andExpect(jsonPath("$[0].password").doesNotExist())
			.andExpect(jsonPath("$[0].answer").doesNotExist())
			.andExpect(jsonPath("$[1].email").value("member@flowershop.example"))
			.andExpect(jsonPath("$[1].answer").doesNotExist());
	}

	@Test
	void createForcesTheMemberTypeAndHashesThePassword() throws Exception {
		when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/user/create").contentType(MediaType.APPLICATION_JSON)
				.content("{\"id\":1,\"name\":\"Eve\",\"password\":\"pw123456\",\"email\":\"eve@flowershop.example\","
					+ "\"role\":\"ADMIN\",\"enable\":false}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.email").value("eve@flowershop.example"))
			.andExpect(jsonPath("$.role").value("USER"))
			.andExpect(jsonPath("$.enable").value(true));

		ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
		verify(userRepository).save(saved.capture());
		assertTrue(saved.getValue().getId() == null, "a submitted id must never bind onto self registration");
		assertTrue(saved.getValue().getRole() == Role.USER, "self registration must never mint an ADMIN");
		assertTrue(passwordService.matches("pw123456", saved.getValue().getPassword()));
		assertTrue(saved.getValue().getName().equals("Eve"));
	}

	@Test
	void batchUserEndpointsAreGone() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));

		// The listing stays on GET /api/user, so the batch verbs answer 405:
		// the method no longer exists on the path.
		mockMvc.perform(post("/api/user").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[]"))
			.andExpect(status().isMethodNotAllowed());
		mockMvc.perform(delete("/api/user").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isMethodNotAllowed());
	}

	@Test
	void adminDeletesAnAccountWithoutBills() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		when(userRepository.findById(4L)).thenReturn(Optional.of(persona(4, Role.USER, "member@flowershop.example")));
		when(orderRepository.existsByUserId(4L)).thenReturn(false);

		mockMvc.perform(delete("/api/user/4").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isNoContent());

		verify(userRepository).deleteById(4L);
	}

	@Test
	void adminDeletesAUserWithBillsAnswers409HasOrders() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		when(userRepository.findById(4L)).thenReturn(Optional.of(persona(4, Role.USER, "member@flowershop.example")));
		when(orderRepository.existsByUserId(4L)).thenReturn(true);

		mockMvc.perform(delete("/api/user/4").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("HAS_ORDERS"));

		verify(userRepository, never()).deleteById(4L);
	}

	@Test
	void memberReadsOwnAccountWithoutThePasswordField() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(get("/api/user/4").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.password").doesNotExist())
			.andExpect(jsonPath("$.email").value("member@flowershop.example"));
	}

	@Test
	void memberCannotReadAForeignAccount() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(get("/api/user/1").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isForbidden());
	}

	@Test
	void getByIdAnswersNotFoundForAMissingAccount() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		when(userRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(get("/api/user/99").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isNotFound())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("NOT_FOUND"))
			.andExpect(jsonPath("$.detail").value("no user with id 99"));
	}

	@Test
	void updateAnswersNotFoundForAMissingAccount() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		when(userRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(put("/api/user/99").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Ghost\"}"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void deleteAnswersNotFoundForAMissingAccount() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		when(userRepository.findById(9L)).thenReturn(Optional.empty());

		mockMvc.perform(delete("/api/user/9").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void toStringNeverCarriesThePasswordOrTheAnswer() {
		User user = persona(1, Role.ADMIN, "admin@flowershop.example");

		assertFalse(user.toString().contains("1234qwer"));
		assertFalse(user.toString().contains("$2a$"));
		assertFalse(user.toString().contains("demo"));
	}
}
