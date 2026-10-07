package com.lavantien.flowershop.api.product;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {

	boolean existsByTypeName(String typeName);

	boolean existsByCategoryName(String categoryName);

	// Renames must carry the products' reference columns along, or every
	// product pointing at the old name strands. Runs in the caller's
	// transaction so the row rename and this update commit or roll back as one.
	@Modifying
	@Query("update Product p set p.categoryName = :to where p.categoryName = :from")
	int renameCategory(String from, String to);

	@Modifying
	@Query("update Product p set p.typeName = :to where p.typeName = :from")
	int renameType(String from, String to);

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
