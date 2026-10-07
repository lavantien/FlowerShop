package com.lavantien.flowershop.api.category;

import com.lavantien.flowershop.api.security.TokenInterceptor;
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

class CategoryControllerTest {
	private CategoryRepository categoryRepository;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		categoryRepository = mock(CategoryRepository.class);
		UserRepository userRepository = mock(UserRepository.class);
		UserService userService = new UserService();
		mockMvc = MockMvcBuilders.standaloneSetup(new CategoryController(categoryRepository))
			.addInterceptors(new TokenInterceptor(userRepository, userService))
			.build();
		prime(userRepository, userService, persona(1, "ADMIN", "admin@flowershop.example"));
		prime(userRepository, userService, persona(4, "USER", "member@flowershop.example"));
	}

	private static Category bouquet() {
		Category category = new Category("BOUQUET");
		category.setId(3L);
		return category;
	}

	@Test
	void anonymousListsCategoriesWithoutAToken() throws Exception {
		when(categoryRepository.findAll()).thenReturn(List.of(bouquet()));

		mockMvc.perform(get("/api/category"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].id").value(3))
			.andExpect(jsonPath("$[0].name").value("BOUQUET"));
	}

	@Test
	void categoryIsFoundById() throws Exception {
		Category potted = new Category();
		potted.setId(4L);
		potted.setName("POTTED");
		when(categoryRepository.findById(4L)).thenReturn(Optional.of(potted));

		mockMvc.perform(get("/api/category/4"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(4))
			.andExpect(jsonPath("$.name").value("POTTED"));
	}

	@Test
	void missingCategoryAnswersBadRequest() throws Exception {
		when(categoryRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(get("/api/category/99"))
			.andExpect(status().isBadRequest());
	}

	@Test
	void adminCreatesManyCategories() throws Exception {
		when(categoryRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/category").header("X-Auth-Token", tokenOf(1, "ADMIN"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[{\"name\":\"BOUQUET\"},{\"name\":\"POTTED\"}]"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].name").value("BOUQUET"))
			.andExpect(jsonPath("$[1].name").value("POTTED"));

		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<Category>> saved = ArgumentCaptor.forClass(List.class);
		verify(categoryRepository).saveAll(saved.capture());
		assertTrue(saved.getValue().get(1).getName().equals("POTTED"));
		assertTrue(saved.getValue().get(0).toString().contains("name='BOUQUET'"), "toString must render the persisted fields");
	}

	@Test
	void deleteManyWithoutABodyWipesEveryCategory() throws Exception {
		mockMvc.perform(delete("/api/category").header("X-Auth-Token", tokenOf(1, "ADMIN")))
			.andExpect(status().isOk());

		verify(categoryRepository).deleteAll();
	}

	@Test
	void deleteManyWithIdsDeletesOnlyThoseCategories() throws Exception {
		when(categoryRepository.findAllById(List.of(3L))).thenReturn(List.of(bouquet()));

		mockMvc.perform(delete("/api/category").header("X-Auth-Token", tokenOf(1, "ADMIN"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[3]"))
			.andExpect(status().isOk());

		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<Category>> deleted = ArgumentCaptor.forClass(List.class);
		verify(categoryRepository).deleteAll(deleted.capture());
		assertTrue(deleted.getValue().get(0).getId().equals(3L));
	}

	@Test
	void memberCannotCreateASingleCategory() throws Exception {
		mockMvc.perform(post("/api/category/create").header("X-Auth-Token", tokenOf(4, "USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"BOUQUET\"}"))
			.andExpect(status().isForbidden());
	}

	@Test
	void adminCreatesASinglePersistedCategory() throws Exception {
		when(categoryRepository.save(any(Category.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/category/create").header("X-Auth-Token", tokenOf(1, "ADMIN"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"BOUQUET\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("BOUQUET"));

		ArgumentCaptor<Category> saved = ArgumentCaptor.forClass(Category.class);
		verify(categoryRepository).save(saved.capture());
		assertTrue(saved.getValue().getName().equals("BOUQUET"));
	}

	@Test
	void updateSavesTheSubmittedCategoryWhenTheRowExists() throws Exception {
		when(categoryRepository.findById(3L)).thenReturn(Optional.of(bouquet()));
		when(categoryRepository.save(any(Category.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(put("/api/category/3").header("X-Auth-Token", tokenOf(1, "ADMIN"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"id\":3,\"name\":\"POTTED\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("POTTED"));

		ArgumentCaptor<Category> saved = ArgumentCaptor.forClass(Category.class);
		verify(categoryRepository).save(saved.capture());
		assertTrue(saved.getValue().getName().equals("POTTED"));
	}

	@Test
	void updateAnswersBadRequestForAMissingCategory() throws Exception {
		when(categoryRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(put("/api/category/99").header("X-Auth-Token", tokenOf(1, "ADMIN"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"POTTED\"}"))
			.andExpect(status().isBadRequest());
	}

	@Test
	void deleteRemovesAnExistingCategory() throws Exception {
		when(categoryRepository.findById(3L)).thenReturn(Optional.of(bouquet()));

		mockMvc.perform(delete("/api/category/3").header("X-Auth-Token", tokenOf(1, "ADMIN")))
			.andExpect(status().isOk());

		verify(categoryRepository).deleteById(3L);
	}

	@Test
	void deleteAnswersBadRequestForAMissingCategory() throws Exception {
		when(categoryRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(delete("/api/category/99").header("X-Auth-Token", tokenOf(1, "ADMIN")))
			.andExpect(status().isBadRequest());
	}
}
