create database flowershop;
use flowershop;

insert into category (id, name) values (1, 'FLOWERS');
insert into category (id, name) values (2, 'PLANTS');

insert into type (id, name, category_name) values (1, 'ROSES', 'FLOWERS');
insert into type (id, name, category_name) values (2, 'CARNATIONS', 'FLOWERS');
insert into type (id, name, category_name) values (3, 'LILIES', 'FLOWERS');
insert into type (id, name, category_name) values (4, 'ORCHIDS', 'FLOWERS');
insert into type (id, name, category_name) values (5, 'DAISIES', 'FLOWERS');
insert into type (id, name, category_name) values (6, 'SUNFLOWERS', 'FLOWERS');
insert into type (id, name, category_name) values (7, 'ALSTROEMERIA', 'FLOWERS');
insert into type (id, name, category_name) values (8, 'ASTERS', 'FLOWERS');
insert into type (id, name, category_name) values (9, 'CALLA LILIES', 'FLOWERS');
insert into type (id, name, category_name) values (10, 'CHRYSANTHEMUMS', 'FLOWERS');
insert into type (id, name, category_name) values (11, 'DAHLIAS', 'FLOWERS');
insert into type (id, name, category_name) values (12, 'DELPHINIUMS', 'FLOWERS');
insert into type (id, name, category_name) values (13, 'GERBERAS', 'FLOWERS');
insert into type (id, name, category_name) values (14, 'HYDRANGEAS', 'FLOWERS');
insert into type (id, name, category_name) values (15, 'IRISES', 'FLOWERS');
insert into type (id, name, category_name) values (16, 'LISIANTHUS', 'FLOWERS');
insert into type (id, name, category_name) values (17, 'PEONIES', 'FLOWERS');
insert into type (id, name, category_name) values (18, 'STOCK', 'FLOWERS');
insert into type (id, name, category_name) values (19, 'SNAPDRAGONS', 'FLOWERS');
insert into type (id, name, category_name) values (20, 'TULIPS', 'FLOWERS');
insert into type (id, name, category_name) values (21, 'TROPICAL FLOWERS', 'FLOWERS');
insert into type (id, name, category_name) values (22, 'MIXED BOUQUETS', 'FLOWERS');

insert into type (id, name, category_name) values (23, 'BLOOMING PLANTS', 'PLANTS');
insert into type (id, name, category_name) values (24, 'GREEN PLANTS', 'PLANTS');
insert into type (id, name, category_name) values (25, 'ORCHIDS & TROPICALS', 'PLANTS');

-- Demo personas, passwords are bcrypt hashes: ids 1-3 use 1234qwer, id 4 uses 12345678.
-- Regenerate with: make db-hash DB_HASH_PASSWORDS="1234qwer 1234qwer 1234qwer 12345678"
insert into user (id, address, city, district, email, enable, name, password, phone, type, answer) values (1, '01 Demo Lane', 'Hồ Chí Minh', 'Bình Thạnh', 'admin@flowershop.example', true, 'Demo Admin', '$2a$10$uzdoc6WXic8cZwxUQJ3hGuhoqFrrRwAWm3o3ytSXYkgHRsJcXwPFe', '0900000001', 'ADMIN', 'demo');
insert into user (id, address, city, district, email, enable, name, password, phone, type, answer) values (2, '02 Demo Lane', 'Hồ Chí Minh', 'Bình Thạnh', 'editor@flowershop.example', true, 'Demo Editor', '$2a$10$f750MCkKwTYc/pnZqKthW.QbUfpkHfY7FPlZ.CYIHSEvtoIL8tT2a', '0900000002', 'ADMIN', 'demo');
insert into user (id, address, city, district, email, enable, name, password, phone, type, answer) values (3, '03 Demo Lane', 'Hồ Chí Minh', 'Bình Thạnh', 'staff@flowershop.example', true, 'Demo Staff', '$2a$10$HKoKsRib2VpH/o0xV5yaFuOkN0uyt6oztOLtEpDuwHs/BogDyZ3L2', '0900000003', 'ADMIN', 'demo');
insert into user (id, address, city, district, email, enable, name, password, phone, type, answer) values (4, '04 Demo Lane', 'Hồ Chí Minh', 'Phú Nhuận', 'member@flowershop.example', true, 'Demo Member', '$2a$10$dGEbCpYmZvHyww8Q0LazIOf423RfSDj/7a3lebBoiNF2./ue66RVm', '0900000004', 'USER', 'demo');
