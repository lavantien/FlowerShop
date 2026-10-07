package com.lavantien.flowershop.api.product;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {

	// Hibernate 7 merge no longer inserts a detached entity whose row is absent,
	// so explicit-id seeding needs a native insert that honors the given id.
	// Runs inside the caller's transaction: a repo-level @Transactional here would
	// mark it rollback-only on duplicate-key before the caller can fall back.
	@Modifying
	@Query(value = "insert into product (id, name, description, img_url, price, type_name, category_name) "
			+ "values (:#{#product.id}, :#{#product.name}, :#{#product.description}, :#{#product.imgUrl}, "
			+ ":#{#product.price}, :#{#product.typeName}, :#{#product.categoryName})",
			nativeQuery = true)
	void insertWithId(Product product);
}
