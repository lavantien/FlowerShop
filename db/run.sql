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

insert into user (id, address, city, district, email, enable, name, password, phone, type) values (1, 'Đường Đời', 'Hồ Chí Minh', 'Bình Thạnh', 'flowershop.noreply@gmail.com', true, 'lavantien', 'MTIzNHF3ZXI=', '0960960096', 'ADMIN');
insert into user (id, address, city, district, email, enable, name, password, phone, type) values (2, 'Đường Đời', 'Hồ Chí Minh', 'Bình Thạnh', 'flowershop1.noreply@gmail.com', true, 'nguyentuanphuongnam', 'MTIzNHF3ZXI=', '0960960096', 'ADMIN');
insert into user (id, address, city, district, email, enable, name, password, phone, type) values (3, 'Đường Đời', 'Hồ Chí Minh', 'Bình Thạnh', 'flowershop2.noreply@gmail.com', true, 'leviethuynh', 'MTIzNHF3ZXI=', '0960960096', 'ADMIN');
insert into user (id, address, city, district, email, enable, name, password, phone, type) values (4, 'Đường Phan Đăng Lưu', 'Hồ Chí Minh', 'Phú Nhuận', 'chuatebongdem666@gmail.com', true, 'chuatebongdem', 'MTIzNDU2Nzg=', '0900900090', 'USER');
