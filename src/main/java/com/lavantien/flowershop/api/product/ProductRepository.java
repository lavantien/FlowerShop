package com.lavantien.flowershop.api.product;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

public interface ProductRepository extends JpaRepository<Product, Long> {

	// Hibernate 7 merge no longer inserts a detached entity whose row is absent,
	// so explicit-id seeding needs a native insert that honors the given id.
	@Transactional
	@Modifying
	@Query(value = "insert into product (id, name, description, img_url, price, quantity, sale_amount, type_name, category_name) "
			+ "values (:#{#product.id}, :#{#product.name}, :#{#product.description}, :#{#product.imgUrl}, "
			+ ":#{#product.price}, :#{#product.quantity}, :#{#product.saleAmount}, :#{#product.typeName}, :#{#product.categoryName})",
			nativeQuery = true)
	void insertWithId(Product product);
}
