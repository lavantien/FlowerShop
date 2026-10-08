package com.lavantien.flowershop.api.product;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {

	boolean existsByTypeName(String typeName);

	boolean existsByCategoryName(String categoryName);

	@Modifying
	@Query("update Product p set p.categoryName = :to where p.categoryName = :from")
	int renameCategory(String from, String to);

	@Modifying
	@Query("update Product p set p.typeName = :to where p.typeName = :from")
	int renameType(String from, String to);

	@Modifying
	@Query(value = "insert into product (id, name, description, img_url, price, type_name, category_name) "
			+ "values (:#{#product.id}, :#{#product.name}, :#{#product.description}, :#{#product.imgUrl}, "
			+ ":#{#product.price}, :#{#product.typeName}, :#{#product.categoryName})",
			nativeQuery = true)
	void insertWithId(Product product);
}
