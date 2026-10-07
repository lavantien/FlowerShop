package com.lavantien.flowershop.api.user;

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
import static org.mockito.ArgumentMatchers.anyList;
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
	void createRefusesAnEmailAlreadyInUse() throws Exception {
		when(userRepository.findByEmail("member@flowershop.example"))
			.thenReturn(persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(post("/api/user/create").contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Clone\",\"email\":\"member@flowershop.example\",\"password\":\"1234qwer\","
					+ "\"rePassword\":\"1234qwer\",\"answer\":\"demo\"}"))
			.andExpect(status().isConflict());
	}

	@Test
	void createManyRefusesTheBatchWhenAnyEmailIsAlreadyInUse() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		when(userRepository.findByEmail("member@flowershop.example"))
			.thenReturn(persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(post("/api/user").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[{\"name\":\"Clone\",\"email\":\"member@flowershop.example\",\"password\":\"1234qwer\","
					+ "\"answer\":\"demo\"},{\"name\":\"Fresh\",\"email\":\"fresh@flowershop.example\","
					+ "\"password\":\"1234qwer\",\"answer\":\"demo\"}]"))
			.andExpect(status().isConflict());
	}

	@Test
	void createWithANullEmailSavesBecauseNothingIsInUse() throws Exception {
		when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/user/create").contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"NoEmail\",\"password\":\"1234qwer\",\"answer\":\"demo\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("NoEmail"));
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
	void nonAdminPutCannotEscalateTypeOrDropEnable() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));
		when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(put("/api/user/4").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Renamed\",\"phone\":\"0900000004\",\"address\":\"04 Demo Lane\","
					+ "\"answer\":\"demo\",\"role\":\"ADMIN\",\"enable\":false,\"password\":\"hacked\"}"))
			.andExpect(status().isOk());

		ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
		verify(userRepository).save(saved.capture());
		assertTrue(saved.getValue().getRole() == Role.USER, "role must stay USER for a non-admin caller");
		assertTrue(Boolean.TRUE.equals(saved.getValue().getEnable()), "enable must stay true for a non-admin caller");
		assertTrue(passwordService.matches("1234qwer", saved.getValue().getPassword()),
			"password must never be writable through PUT");
		assertTrue("Renamed".equals(saved.getValue().getName()), "owner fields still copy through");
	}

	@Test
	void adminPutCanManageTypeAndEnable() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		when(userRepository.findById(4L)).thenReturn(Optional.of(persona(4, Role.USER, "member@flowershop.example")));
		when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(put("/api/user/4").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Renamed\",\"role\":\"ADMIN\",\"enable\":false}"))
			.andExpect(status().isOk());

		ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
		verify(userRepository).save(saved.capture());
		assertTrue(saved.getValue().getRole() == Role.ADMIN);
		assertTrue(Boolean.FALSE.equals(saved.getValue().getEnable()));
	}

	@Test
	void nonAdminPutOnAForeignAccountIsForbidden() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(put("/api/user/1").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Hijacked\"}"))
			.andExpect(status().isForbidden());
	}

	@Test
	void adminListsEveryAccountWithoutThePasswordField() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		when(userRepository.findAll()).thenReturn(List.of(
			persona(1, Role.ADMIN, "admin@flowershop.example"),
			persona(4, Role.USER, "member@flowershop.example")));

		mockMvc.perform(get("/api/user").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].email").value("admin@flowershop.example"))
			.andExpect(jsonPath("$[0].password").doesNotExist())
			.andExpect(jsonPath("$[1].email").value("member@flowershop.example"));
	}

	@Test
	void adminCreatesManyAccountsHashingOnlyThePasswordsThatExist() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		when(userRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/user").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[{\"name\":\"Ada\",\"password\":\"secret123\",\"email\":\"ada@flowershop.example\"},"
					+ "{\"name\":\"Bob\",\"email\":\"bob@flowershop.example\"}]"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].email").value("ada@flowershop.example"))
			.andExpect(jsonPath("$[1].email").value("bob@flowershop.example"));

		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<User>> saved = ArgumentCaptor.forClass(List.class);
		verify(userRepository).saveAll(saved.capture());
		assertTrue(passwordService.matches("secret123", saved.getValue().get(0).getPassword()),
			"a submitted password must be stored as a bcrypt hash");
		assertTrue(saved.getValue().get(1).getPassword() == null, "a null password must stay null, not fail the batch");
		assertTrue(saved.getValue().get(0).getRole() == Role.USER);
		assertTrue(saved.getValue().get(0).toString().contains("email='ada@flowershop.example'"),
			"toString must render the persisted fields");
	}

	@Test
	void createForcesTheMemberTypeAndHashesThePassword() throws Exception {
		when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/user/create").contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Eve\",\"password\":\"pw123456\",\"email\":\"eve@flowershop.example\",\"role\":\"ADMIN\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.email").value("eve@flowershop.example"));

		ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
		verify(userRepository).save(saved.capture());
		assertTrue(saved.getValue().getRole() == Role.USER, "self registration must never mint an ADMIN");
		assertTrue(passwordService.matches("pw123456", saved.getValue().getPassword()));
		assertTrue(saved.getValue().getName().equals("Eve"));
	}

	@Test
	void deleteManyWithoutABodyWipesEveryAccount() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));

		mockMvc.perform(delete("/api/user").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk());

		verify(userRepository).deleteAll();
	}

	@Test
	void deleteManyWithIdsDeletesOnlyThoseAccounts() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		when(userRepository.findAllById(List.of(4L, 5L)))
			.thenReturn(List.of(persona(4, Role.USER, "member@flowershop.example")));

		mockMvc.perform(delete("/api/user").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[4,5]"))
			.andExpect(status().isOk());

		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<User>> deleted = ArgumentCaptor.forClass(List.class);
		verify(userRepository).deleteAll(deleted.capture());
		assertTrue(deleted.getValue().size() == 1, "only the accounts resolved from the submitted ids are deleted");
		assertTrue(deleted.getValue().get(0).getId().equals(4L));
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
	void adminDeletesAnExistingAccount() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		when(userRepository.findById(4L)).thenReturn(Optional.of(persona(4, Role.USER, "member@flowershop.example")));

		mockMvc.perform(delete("/api/user/4").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk());

		verify(userRepository).deleteById(4L);
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
	void adminListingNeverSerializesTheSecurityAnswer() throws Exception {
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		when(userRepository.findAll()).thenReturn(List.of(persona(1, Role.ADMIN, "admin@flowershop.example")));

		mockMvc.perform(get("/api/user").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].password").doesNotExist())
			.andExpect(jsonPath("$[0].answer").doesNotExist());
	}

	@Test
	void toStringNeverCarriesThePasswordOrTheAnswer() {
		User user = persona(1, Role.ADMIN, "admin@flowershop.example");

		assertFalse(user.toString().contains("1234qwer"));
		assertFalse(user.toString().contains("$2a$"));
		assertFalse(user.toString().contains("demo"));
	}
}
