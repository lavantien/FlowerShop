package com.lavantien.flowershop.api.type;

import com.lavantien.flowershop.api.error.ApiExceptionHandler;
import com.lavantien.flowershop.api.security.TokenInterceptor;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.api.user.UserRepository;
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
import static com.lavantien.flowershop.api.security.AuthTestSupport.tokenOf;
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

class TypeControllerTest {
	private TypeRepository typeRepository;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		typeRepository = mock(TypeRepository.class);
		UserRepository userRepository = mock(UserRepository.class);
		UserService userService = new UserService();
		mockMvc = MockMvcBuilders.standaloneSetup(new TypeController(typeRepository))
			.addInterceptors(new TokenInterceptor(userRepository, userService))
			.setControllerAdvice(new ApiExceptionHandler())
			.build();
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));
	}

	private static Type flower() {
		Type type = new Type("FLOWER", "BOUQUET");
		type.setId(5L);
		return type;
	}

	@Test
	void anonymousListsTypesWithoutAToken() throws Exception {
		when(typeRepository.findAll()).thenReturn(List.of(flower()));

		mockMvc.perform(get("/api/type"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].id").value(5))
			.andExpect(jsonPath("$[0].name").value("FLOWER"))
			.andExpect(jsonPath("$[0].categoryName").value("BOUQUET"));
	}

	@Test
	void typeIsFoundById() throws Exception {
		Type potted = new Type();
		potted.setId(6L);
		potted.setName("POTTED");
		potted.setCategoryName("PLANT");
		when(typeRepository.findById(6L)).thenReturn(Optional.of(potted));

		mockMvc.perform(get("/api/type/6"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(6))
			.andExpect(jsonPath("$.name").value("POTTED"))
			.andExpect(jsonPath("$.categoryName").value("PLANT"));
	}

	@Test
	void missingTypeAnswersNotFound() throws Exception {
		when(typeRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(get("/api/type/99"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void adminCreatesManyTypes() throws Exception {
		when(typeRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/type").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[{\"name\":\"FLOWER\",\"categoryName\":\"BOUQUET\"},{\"name\":\"POTTED\",\"categoryName\":\"PLANT\"}]"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].name").value("FLOWER"))
			.andExpect(jsonPath("$[1].categoryName").value("PLANT"));

		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<Type>> saved = ArgumentCaptor.forClass(List.class);
		verify(typeRepository).saveAll(saved.capture());
		assertTrue(saved.getValue().get(1).getCategoryName().equals("PLANT"));
		assertTrue(saved.getValue().get(0).toString().contains("name='FLOWER'"), "toString must render the persisted fields");
	}

	@Test
	void deleteManyWithoutABodyWipesEveryType() throws Exception {
		mockMvc.perform(delete("/api/type").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk());

		verify(typeRepository).deleteAll();
	}

	@Test
	void deleteManyWithIdsDeletesOnlyThoseTypes() throws Exception {
		when(typeRepository.findAllById(List.of(5L))).thenReturn(List.of(flower()));

		mockMvc.perform(delete("/api/type").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[5]"))
			.andExpect(status().isOk());

		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<Type>> deleted = ArgumentCaptor.forClass(List.class);
		verify(typeRepository).deleteAll(deleted.capture());
		assertTrue(deleted.getValue().get(0).getId().equals(5L));
	}

	@Test
	void memberCannotCreateASingleType() throws Exception {
		mockMvc.perform(post("/api/type/create").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"FLOWER\",\"categoryName\":\"BOUQUET\"}"))
			.andExpect(status().isForbidden());
	}

	@Test
	void adminCreatesASinglePersistedType() throws Exception {
		when(typeRepository.save(any(Type.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/type/create").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"FLOWER\",\"categoryName\":\"BOUQUET\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("FLOWER"))
			.andExpect(jsonPath("$.categoryName").value("BOUQUET"));

		ArgumentCaptor<Type> saved = ArgumentCaptor.forClass(Type.class);
		verify(typeRepository).save(saved.capture());
		assertTrue(saved.getValue().getName().equals("FLOWER"));
	}

	@Test
	void updateSavesTheSubmittedTypeWhenTheRowExists() throws Exception {
		when(typeRepository.findById(5L)).thenReturn(Optional.of(flower()));
		when(typeRepository.save(any(Type.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(put("/api/type/5").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"id\":5,\"name\":\"POTTED\",\"categoryName\":\"PLANT\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("POTTED"));

		ArgumentCaptor<Type> saved = ArgumentCaptor.forClass(Type.class);
		verify(typeRepository).save(saved.capture());
		assertTrue(saved.getValue().getName().equals("POTTED"));
		assertTrue(saved.getValue().getCategoryName().equals("PLANT"));
	}

	@Test
	void updateAnswersNotFoundForAMissingType() throws Exception {
		when(typeRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(put("/api/type/99").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"POTTED\"}"))
			.andExpect(status().isNotFound());
	}

	@Test
	void deleteRemovesAnExistingType() throws Exception {
		when(typeRepository.findById(5L)).thenReturn(Optional.of(flower()));

		mockMvc.perform(delete("/api/type/5").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk());

		verify(typeRepository).deleteById(5L);
	}

	@Test
	void deleteAnswersNotFoundForAMissingType() throws Exception {
		when(typeRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(delete("/api/type/99").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isNotFound());
	}
}
