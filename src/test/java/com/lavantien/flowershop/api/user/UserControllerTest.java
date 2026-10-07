package com.lavantien.flowershop.api.user;

import com.jayway.jsonpath.JsonPath;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
			.andExpect(tokenIdentity("1+ADMIN"))
			.andExpect(jsonPath("$.phone").value("0900000001"))
			.andExpect(jsonPath("$.detailAddress").value("01 Demo Lane, Binh Thanh, Ho Chi Minh"));
		assertTrue(userService.isLoggedIn(1L));
	}

	@Test
	void loginRejectsAWrongPassword() throws Exception {
		User user = persona(4, "USER", "member@flowershop.example");
		when(userRepository.findByEmail("member@flowershop.example")).thenReturn(user);

		mockMvc.perform(post("/api/user/login").contentType(MediaType.TEXT_PLAIN)
				.content(loginBody("member@flowershop.example", "wrong")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(GUESS_TOKEN));
		assertFalse(userService.isLoggedIn(4L));
	}

	@Test
	void loginRejectsAnUnknownEmail() throws Exception {
		when(userRepository.findByEmail("nobody@flowershop.example")).thenReturn(null);

		mockMvc.perform(post("/api/user/login").contentType(MediaType.TEXT_PLAIN)
				.content(loginBody("nobody@flowershop.example", "1234qwer")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(GUESS_TOKEN));
		assertFalse(userService.isLoggedIn(1L));
	}

	@Test
	void loginAnswersTheGuestTokenForAMalformedBody() throws Exception {
		mockMvc.perform(post("/api/user/login").contentType(MediaType.TEXT_PLAIN)
				.content("not base64 !!"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(GUESS_TOKEN));
	}

	@Test
	void loginAnswersTheGuestTokenWithoutTheSeparator() throws Exception {
		mockMvc.perform(post("/api/user/login").contentType(MediaType.TEXT_PLAIN)
				.content(Base64.getEncoder().encodeToString("no separator here".getBytes(StandardCharsets.UTF_8))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(GUESS_TOKEN));
	}

	@Test
	void logoutAnswersTheGuestTokenForAGarbageToken() throws Exception {
		mockMvc.perform(post("/api/user/logout").contentType(MediaType.APPLICATION_JSON)
				.content("{\"token\":\"garbage\",\"phone\":\"0\",\"detailAddress\":\"x\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(GUESS_TOKEN));
	}

	@Test
	void logoutAnswersTheGuestTokenForAMissingToken() throws Exception {
		mockMvc.perform(post("/api/user/logout").contentType(MediaType.APPLICATION_JSON)
				.content("{\"phone\":\"0\",\"detailAddress\":\"x\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(GUESS_TOKEN));
	}

	@Test
	void resetPasswordStoresABcryptHashAndLogsTheUserIn() throws Exception {
		User user = persona(4, "USER", "member@flowershop.example");
		when(userRepository.findByEmail("member@flowershop.example")).thenReturn(user);
		when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/user/resetPassword").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"member@flowershop.example\",\"answer\":\"demo\",\"password\":\"newpass123\"}"))
			.andExpect(status().isOk())
			.andExpect(tokenIdentity("4+USER"));

		ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
		verify(userRepository).save(saved.capture());
		assertTrue(passwordService.matches("newpass123", saved.getValue().getPassword()),
			"the stored password must be bcrypt of the submitted one");
		assertTrue(userService.isLoggedIn(4L));
	}

	@Test
	void resetPasswordWithoutAStoredAnswerStaysGuestEvenWhenOmittedToo() throws Exception {
		User user = persona(5, "USER", "blank@flowershop.example");
		user.setAnswer(null);
		when(userRepository.findByEmail("blank@flowershop.example")).thenReturn(user);

		mockMvc.perform(post("/api/user/resetPassword").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"blank@flowershop.example\",\"password\":\"hacked123\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(GUESS_TOKEN));
		assertFalse(userService.isLoggedIn(5L), "null must not match null on the security answer");
	}

	@Test
	void createRefusesAnEmailAlreadyInUse() throws Exception {
		when(userRepository.findByEmail("member@flowershop.example"))
			.thenReturn(persona(4, "USER", "member@flowershop.example"));

		mockMvc.perform(post("/api/user/create").contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Clone\",\"email\":\"member@flowershop.example\",\"password\":\"1234qwer\","
					+ "\"rePassword\":\"1234qwer\",\"answer\":\"demo\"}"))
			.andExpect(status().isConflict());
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

	@Test
	void adminListsEveryAccountWithoutThePasswordField() throws Exception {
		prime(userRepository, userService, persona(1, "ADMIN", "admin@flowershop.example"));
		when(userRepository.findAll()).thenReturn(List.of(
			persona(1, "ADMIN", "admin@flowershop.example"),
			persona(4, "USER", "member@flowershop.example")));

		mockMvc.perform(get("/api/user").header("X-Auth-Token", tokenOf(1, "ADMIN")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].email").value("admin@flowershop.example"))
			.andExpect(jsonPath("$[0].password").doesNotExist())
			.andExpect(jsonPath("$[1].email").value("member@flowershop.example"));
	}

	@Test
	void adminCreatesManyAccountsHashingOnlyThePasswordsThatExist() throws Exception {
		prime(userRepository, userService, persona(1, "ADMIN", "admin@flowershop.example"));
		when(userRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/user").header("X-Auth-Token", tokenOf(1, "ADMIN"))
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
		assertTrue(saved.getValue().get(0).getType().equals("USER"));
		assertTrue(saved.getValue().get(0).toString().contains("email='ada@flowershop.example'"),
			"toString must render the persisted fields");
	}

	@Test
	void createForcesTheMemberTypeAndHashesThePassword() throws Exception {
		when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/user/create").contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Eve\",\"password\":\"pw123456\",\"email\":\"eve@flowershop.example\",\"type\":\"ADMIN\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.email").value("eve@flowershop.example"));

		ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
		verify(userRepository).save(saved.capture());
		assertTrue(saved.getValue().getType().equals("USER"), "self registration must never mint an ADMIN");
		assertTrue(passwordService.matches("pw123456", saved.getValue().getPassword()));
		assertTrue(saved.getValue().getName().equals("Eve"));
	}

	@Test
	void deleteManyWithoutABodyWipesEveryAccount() throws Exception {
		prime(userRepository, userService, persona(1, "ADMIN", "admin@flowershop.example"));

		mockMvc.perform(delete("/api/user").header("X-Auth-Token", tokenOf(1, "ADMIN")))
			.andExpect(status().isOk());

		verify(userRepository).deleteAll();
	}

	@Test
	void deleteManyWithIdsDeletesOnlyThoseAccounts() throws Exception {
		prime(userRepository, userService, persona(1, "ADMIN", "admin@flowershop.example"));
		when(userRepository.findAllById(List.of(4L, 5L)))
			.thenReturn(List.of(persona(4, "USER", "member@flowershop.example")));

		mockMvc.perform(delete("/api/user").header("X-Auth-Token", tokenOf(1, "ADMIN"))
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
	void getByIdAnswersBadRequestForAMissingAccount() throws Exception {
		prime(userRepository, userService, persona(1, "ADMIN", "admin@flowershop.example"));
		when(userRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(get("/api/user/99").header("X-Auth-Token", tokenOf(1, "ADMIN")))
			.andExpect(status().isBadRequest());
	}

	@Test
	void updateAnswersBadRequestForAMissingAccount() throws Exception {
		prime(userRepository, userService, persona(1, "ADMIN", "admin@flowershop.example"));
		when(userRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(put("/api/user/99").header("X-Auth-Token", tokenOf(1, "ADMIN"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Ghost\"}"))
			.andExpect(status().isBadRequest());
	}

	@Test
	void adminDeletesAnExistingAccount() throws Exception {
		prime(userRepository, userService, persona(1, "ADMIN", "admin@flowershop.example"));
		when(userRepository.findById(4L)).thenReturn(Optional.of(persona(4, "USER", "member@flowershop.example")));

		mockMvc.perform(delete("/api/user/4").header("X-Auth-Token", tokenOf(1, "ADMIN")))
			.andExpect(status().isOk());

		verify(userRepository).deleteById(4L);
	}

	@Test
	void deleteAnswersBadRequestForAMissingAccount() throws Exception {
		prime(userRepository, userService, persona(1, "ADMIN", "admin@flowershop.example"));
		when(userRepository.findById(9L)).thenReturn(Optional.empty());

		mockMvc.perform(delete("/api/user/9").header("X-Auth-Token", tokenOf(1, "ADMIN")))
			.andExpect(status().isBadRequest());
	}

	@Test
	void logoutWithAValidTokenEndsTheSession() throws Exception {
		prime(userRepository, userService, persona(4, "USER", "member@flowershop.example"));

		mockMvc.perform(post("/api/user/logout").contentType(MediaType.APPLICATION_JSON)
				.content("{\"token\":\"" + tokenOf(4, "USER") + "\",\"phone\":\"0\",\"detailAddress\":\"x\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(GUESS_TOKEN));
		assertFalse(userService.isLoggedIn(4L), "a valid logout must drop the session");
	}

	@Test
	void logoutWithAWrongSecretLeavesTheSessionAlive() throws Exception {
		prime(userRepository, userService, persona(4, "USER", "member@flowershop.example"));
		String forged = Base64.getEncoder().encodeToString("4+USER+deadbeefdeadbeef".getBytes(StandardCharsets.UTF_8));

		mockMvc.perform(post("/api/user/logout").contentType(MediaType.APPLICATION_JSON)
				.content("{\"token\":\"" + forged + "\",\"phone\":\"0\",\"detailAddress\":\"x\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(GUESS_TOKEN));
		assertTrue(userService.isLoggedIn(4L), "a forged token must not log anybody out");
	}

	@Test
	void logoutLeavesTheSessionUntouchedForAnUnparsableId() throws Exception {
		prime(userRepository, userService, persona(4, "USER", "member@flowershop.example"));
		String unparsable = Base64.getEncoder().encodeToString("x+USER".getBytes(StandardCharsets.UTF_8));

		mockMvc.perform(post("/api/user/logout").contentType(MediaType.APPLICATION_JSON)
				.content("{\"token\":\"" + unparsable + "\",\"phone\":\"0\",\"detailAddress\":\"x\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").value(GUESS_TOKEN));
		assertTrue(userService.isLoggedIn(4L), "a garbage token must not log anybody out");
	}

	@Test
	void aFreshLoginRotatesTheSecretAndKillsTheOldToken() throws Exception {
		User user = persona(1, "ADMIN", "admin@flowershop.example");
		when(userRepository.findByEmail("admin@flowershop.example")).thenReturn(user);
		when(userRepository.findById(1L)).thenReturn(Optional.of(user));

		String firstToken = loginAndGetToken("admin@flowershop.example", "1234qwer");
		String secondToken = loginAndGetToken("admin@flowershop.example", "1234qwer");

		mockMvc.perform(get("/api/user").header("X-Auth-Token", firstToken))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/user").header("X-Auth-Token", secondToken))
			.andExpect(status().isOk());
	}

	private String loginAndGetToken(String email, String password) throws Exception {
		String body = mockMvc.perform(post("/api/user/login").contentType(MediaType.TEXT_PLAIN)
				.content(loginBody(email, password)))
			.andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
		return JsonPath.read(body, "$.token");
	}

	@Test
	void loginComposesTheDetailAddressFromTheStoredFields() throws Exception {
		User user = persona(2, "USER", "editor@flowershop.example");
		user.setEmail("editor@flowershop.example");
		user.setDistrict("Cau Giay");
		user.setCity("Hanoi");
		when(userRepository.findByEmail("editor@flowershop.example")).thenReturn(user);

		mockMvc.perform(post("/api/user/login").contentType(MediaType.TEXT_PLAIN)
				.content(loginBody("editor@flowershop.example", "1234qwer")))
			.andExpect(status().isOk())
			.andExpect(tokenIdentity("2+USER"))
			.andExpect(jsonPath("$.detailAddress").value("01 Demo Lane, Cau Giay, Hanoi"));
	}

	@Test
	void forgotDtoBuildsAnIdenticalPayloadThroughEitherConstructionPath() {
		ForgotDto allAtOnce = new ForgotDto("editor@flowershop.example", "demo", "pw123456");
		ForgotDto fieldByField = new ForgotDto();
		fieldByField.setEmail("editor@flowershop.example");
		fieldByField.setAnswer("demo");
		fieldByField.setPassword("pw123456");

		assertTrue(allAtOnce.getEmail().equals(fieldByField.getEmail())
			&& allAtOnce.getAnswer().equals(fieldByField.getAnswer())
			&& allAtOnce.getPassword().equals(fieldByField.getPassword()),
			"both construction paths must describe the same reset request");
	}

	@Test
	void tokenDtoCarriesEveryFieldThroughItsDefaultConstruction() {
		TokenDto dto = new TokenDto();
		dto.setToken("t");
		dto.setPhone("0900000004");
		dto.setDetailAddress("04 Demo Lane");

		assertTrue("t".equals(dto.getToken())
			&& "0900000004".equals(dto.getPhone())
			&& "04 Demo Lane".equals(dto.getDetailAddress()),
			"the default construction must keep every populated field readable");
	}
}
