package com.lavantien.flowershop.api.type;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TypeRepository extends JpaRepository<Type, Long> {
	boolean existsByName(String name);

	boolean existsByNameAndIdNot(String name, Long id);
}
