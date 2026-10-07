package com.lavantien.flowershop.api.category;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, Long> {
	boolean existsByName(String name);

	boolean existsByNameAndIdNot(String name, Long id);
}
