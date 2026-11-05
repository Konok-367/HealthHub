-- Member 5: emergency contacts (one row per hospital) and ambulance services

CREATE TABLE emergency_contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL UNIQUE,        -- UNIQUE: one contact row per hospital
    emergency_hotline VARCHAR(20) NOT NULL,
    ambulance_number VARCHAR(20) NOT NULL,
    general_number VARCHAR(20) NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
);

CREATE TABLE ambulance_services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider_name VARCHAR(100) NOT NULL,
    city VARCHAR(60) NOT NULL,
    district VARCHAR(60) NOT NULL,
    service_area VARCHAR(150) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    emergency_number VARCHAR(20) NOT NULL,
    is_available TINYINT(1) NOT NULL DEFAULT 1
);

INSERT INTO emergency_contacts (hospital_id, emergency_hotline, ambulance_number, general_number) VALUES
(1, '01800000101', '01800000201', '0255501001'),
(2, '01800000102', '01800000202', '0255501002'),
(3, '01800000103', '01800000203', '0315501003'),
(4, '01800000104', '01800000204', '0725501004'),
(5, '01800000105', '01800000205', '0825501005'),
(6, '01800000106', '01800000206', '0415501006');

INSERT INTO ambulance_services (provider_name, city, district, service_area, contact_number, emergency_number, is_available) VALUES
('Quick Aid Ambulance', 'Dhaka', 'Dhaka', 'Dhanmondi, Mirpur, Uttara', '01900000001', '01900000011', 1),
('Savar Rescue Service', 'Savar', 'Dhaka', 'Savar, Ashulia, Jahangirnagar University', '01900000002', '01900000012', 1),
('Port City Ambulance', 'Chattogram', 'Chattogram', 'Agrabad, Pahartali', '01900000003', '01900000013', 0),
('Rajshahi Life Care', 'Rajshahi', 'Rajshahi', 'Rajshahi city', '01900000004', '01900000014', 1),
('Sylhet Emergency Van', 'Sylhet', 'Sylhet', 'Zindabazar, Ambarkhana', '01900000005', '01900000015', 1),
('Khulna Quick Response', 'Khulna', 'Khulna', 'Khulna city', '01900000006', '01900000016', 0);
