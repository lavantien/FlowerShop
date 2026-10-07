create database flowershop;
use flowershop;

-- Schema for the seeded tables, copied from the Hibernate-created DDL so a fresh
-- volume can be seeded before the first app boot and ddl-auto update stays a no-op.
-- Products and stock_level live in db/seed.sql.

create table if not exists user (
	id bigint not null auto_increment,
	address varchar(255) default null,
	answer varchar(255) default null,
	city varchar(255) default null,
	district varchar(255) default null,
	email varchar(255) default null,
	enable bit(1) default null,
	name varchar(255) default null,
	password varchar(255) default null,
	phone varchar(255) default null,
	role enum('ADMIN','USER') default null,
	primary key (id),
	unique key UKob8kqyqqgmefl0aco34akdtpe (email)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_0900_ai_ci;

create table if not exists category (
	id bigint not null auto_increment,
	name varchar(255) default null,
	primary key (id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_0900_ai_ci;

create table if not exists type (
	id bigint not null auto_increment,
	category_name varchar(255) default null,
	name varchar(255) default null,
	primary key (id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_0900_ai_ci;

create table if not exists branch (
	id bigint not null auto_increment,
	active bit(1) default null,
	address varchar(255) default null,
	city varchar(255) default null,
	district varchar(255) default null,
	lat double default null,
	lng double default null,
	name varchar(255) default null,
	primary key (id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_0900_ai_ci;

create table if not exists coupon (
	id bigint not null auto_increment,
	active bit(1) not null,
	code varchar(255) not null,
	expires_at datetime(6) default null,
	kind enum('FIXED','PERCENT') not null,
	value decimal(12,0) not null,
	primary key (id),
	unique key UKbg4p9ontpj7adq7yr71h93sdn (code)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_0900_ai_ci;

insert into category (id, name) values (1, 'FLOWERS') as v
on duplicate key update name = v.name;
insert into category (id, name) values (2, 'PLANTS') as v
on duplicate key update name = v.name;

insert into type (id, name, category_name) values (1, 'ROSES', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (2, 'CARNATIONS', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (3, 'LILIES', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (4, 'ORCHIDS', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (5, 'DAISIES', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (6, 'SUNFLOWERS', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (7, 'ALSTROEMERIA', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (8, 'ASTERS', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (9, 'CALLA LILIES', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (10, 'CHRYSANTHEMUMS', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (11, 'DAHLIAS', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (12, 'DELPHINIUMS', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (13, 'GERBERAS', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (14, 'HYDRANGEAS', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (15, 'IRISES', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (16, 'LISIANTHUS', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (17, 'PEONIES', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (18, 'STOCK', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (19, 'SNAPDRAGONS', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (20, 'TULIPS', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (21, 'TROPICAL FLOWERS', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (22, 'MIXED BOUQUETS', 'FLOWERS') as v
on duplicate key update name = v.name, category_name = v.category_name;

insert into type (id, name, category_name) values (23, 'BLOOMING PLANTS', 'PLANTS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (24, 'GREEN PLANTS', 'PLANTS') as v
on duplicate key update name = v.name, category_name = v.category_name;
insert into type (id, name, category_name) values (25, 'ORCHIDS & TROPICALS', 'PLANTS') as v
on duplicate key update name = v.name, category_name = v.category_name;

-- Demo personas, passwords are bcrypt hashes: ids 1-3 use 1234qwer, id 4 uses 12345678.
-- Regenerate with: make db-hash DB_HASH_PASSWORDS="1234qwer 1234qwer 1234qwer 12345678"
insert into user (id, address, city, district, email, enable, name, password, phone, role, answer) values (1, '01 Demo Lane', 'Hồ Chí Minh', 'Bình Thạnh', 'admin@flowershop.example', true, 'Demo Admin', '$2a$10$uzdoc6WXic8cZwxUQJ3hGuhoqFrrRwAWm3o3ytSXYkgHRsJcXwPFe', '0900000001', 'ADMIN', 'demo') as v
on duplicate key update address = v.address, city = v.city, district = v.district, email = v.email, enable = v.enable, name = v.name, password = v.password, phone = v.phone, role = v.role, answer = v.answer;
insert into user (id, address, city, district, email, enable, name, password, phone, role, answer) values (2, '02 Demo Lane', 'Hồ Chí Minh', 'Bình Thạnh', 'editor@flowershop.example', true, 'Demo Editor', '$2a$10$f750MCkKwTYc/pnZqKthW.QbUfpkHfY7FPlZ.CYIHSEvtoIL8tT2a', '0900000002', 'ADMIN', 'demo') as v
on duplicate key update address = v.address, city = v.city, district = v.district, email = v.email, enable = v.enable, name = v.name, password = v.password, phone = v.phone, role = v.role, answer = v.answer;
insert into user (id, address, city, district, email, enable, name, password, phone, role, answer) values (3, '03 Demo Lane', 'Hồ Chí Minh', 'Bình Thạnh', 'staff@flowershop.example', true, 'Demo Staff', '$2a$10$HKoKsRib2VpH/o0xV5yaFuOkN0uyt6oztOLtEpDuwHs/BogDyZ3L2', '0900000003', 'ADMIN', 'demo') as v
on duplicate key update address = v.address, city = v.city, district = v.district, email = v.email, enable = v.enable, name = v.name, password = v.password, phone = v.phone, role = v.role, answer = v.answer;
insert into user (id, address, city, district, email, enable, name, password, phone, role, answer) values (4, '04 Demo Lane', 'Hồ Chí Minh', 'Phú Nhuận', 'member@flowershop.example', true, 'Demo Member', '$2a$10$dGEbCpYmZvHyww8Q0LazIOf423RfSDj/7a3lebBoiNF2./ue66RVm', '0900000004', 'USER', 'demo') as v
on duplicate key update address = v.address, city = v.city, district = v.district, email = v.email, enable = v.enable, name = v.name, password = v.password, phone = v.phone, role = v.role, answer = v.answer;

-- Six Ho Chi Minh City branches; coordinates match src/main/resources/geo/vn-geo.json.
insert into branch (id, name, address, district, city, lat, lng, active) values (1, 'District 1 Flagship', '52 Lê Lợi', '1', 'Hồ Chí Minh', 10.7750, 106.7035, true) as v
on duplicate key update name = v.name, address = v.address, district = v.district, city = v.city, lat = v.lat, lng = v.lng, active = v.active;
insert into branch (id, name, address, district, city, lat, lng, active) values (2, 'District 3 Studio', '88 Nguyễn Đình Chiểu', '3', 'Hồ Chí Minh', 10.7675, 106.6850, true) as v
on duplicate key update name = v.name, address = v.address, district = v.district, city = v.city, lat = v.lat, lng = v.lng, active = v.active;
insert into branch (id, name, address, district, city, lat, lng, active) values (3, 'District 7 Riverside', '21 Nguyễn Thị Thập', '7', 'Hồ Chí Minh', 10.7330, 106.7210, true) as v
on duplicate key update name = v.name, address = v.address, district = v.district, city = v.city, lat = v.lat, lng = v.lng, active = v.active;
insert into branch (id, name, address, district, city, lat, lng, active) values (4, 'Bình Thạnh Hub', '136 Xô Viết Nghệ Tĩnh', 'Bình Thạnh', 'Hồ Chí Minh', 10.7980, 106.7105, true) as v
on duplicate key update name = v.name, address = v.address, district = v.district, city = v.city, lat = v.lat, lng = v.lng, active = v.active;
insert into branch (id, name, address, district, city, lat, lng, active) values (5, 'Thủ Đức East', '4 Kha Vạn Cân', 'Thủ Đức', 'Hồ Chí Minh', 10.8430, 106.7560, true) as v
on duplicate key update name = v.name, address = v.address, district = v.district, city = v.city, lat = v.lat, lng = v.lng, active = v.active;
insert into branch (id, name, address, district, city, lat, lng, active) values (6, 'Gò Vấp North', '175 Quang Trung', 'Gò Vấp', 'Hồ Chí Minh', 10.8490, 106.6580, true) as v
on duplicate key update name = v.name, address = v.address, district = v.district, city = v.city, lat = v.lat, lng = v.lng, active = v.active;

insert into coupon (id, code, kind, value, active, expires_at) values
	(1, 'WELCOME10', 'PERCENT', 10, true, null),
	(2, 'SHIP50K', 'FIXED', 50000, true, null),
	(3, 'EXPIRED5', 'FIXED', 5000, false, '2025-01-01T00:00:00') as v
on duplicate key update code = v.code, kind = v.kind, value = v.value, active = v.active, expires_at = v.expires_at;
