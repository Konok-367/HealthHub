-- Member 2: hospitals table (also used by Members 3, 5 and 6)
-- departments is a comma separated text to keep the project simple.

CREATE TABLE hospitals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    city VARCHAR(60) NOT NULL,
    district VARCHAR(60) NOT NULL,
    address VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    departments VARCHAR(255) NOT NULL,
    opening_hours VARCHAR(60) NOT NULL,
    total_beds INT NOT NULL DEFAULT 0,
    available_beds INT NOT NULL DEFAULT 0,
    icu_available INT NOT NULL DEFAULT 0,
    ccu_available INT NOT NULL DEFAULT 0,
    rating DECIMAL(2, 1) NOT NULL DEFAULT 0.0,
    treatment_cost INT NOT NULL DEFAULT 0
);

INSERT INTO hospitals (name, city, district, address, phone, departments, opening_hours, total_beds, available_beds, icu_available, ccu_available, rating, treatment_cost) VALUES
('City General Hospital', 'Dhaka', 'Dhaka', '12 Green Road, Dhaka', '0255501001', 'Cardiology,Neurology,Emergency,Orthopedics', '24 hours', 300, 45, 6, 4, 4.5, 8000),
('Savar Medical Centre', 'Savar', 'Dhaka', 'Bazar Road, Savar', '0255501002', 'General Medicine,Pediatrics,Emergency,Gynecology', '8 AM - 10 PM', 150, 20, 2, 0, 4.1, 4000),
('Chattogram Heart Institute', 'Chattogram', 'Chattogram', '5 Port Avenue, Chattogram', '0315501003', 'Cardiology,Cardiac Surgery,Emergency', '24 hours', 200, 10, 3, 5, 4.7, 12000),
('Rajshahi Community Hospital', 'Rajshahi', 'Rajshahi', '9 Station Road, Rajshahi', '0725501004', 'General Medicine,Orthopedics,Dermatology', '9 AM - 8 PM', 100, 30, 0, 0, 3.9, 2500),
('Sylhet Care Hospital', 'Sylhet', 'Sylhet', '21 Zindabazar, Sylhet', '0825501005', 'Neurology,Pediatrics,Emergency', '24 hours', 120, 0, 0, 1, 4.0, 5000),
('Khulna Lifeline Hospital', 'Khulna', 'Khulna', '3 River Side, Khulna', '0415501006', 'Emergency,Cardiology,Oncology', '24 hours', 180, 25, 4, 2, 4.3, 7000),
('Dhaka Child and Women Hospital', 'Dhaka', 'Dhaka', '44 Mirpur Road, Dhaka', '0255501007', 'Pediatrics,Gynecology', '8 AM - 9 PM', 90, 12, 1, 0, 4.4, 5500),
('Mymensingh Central Hospital', 'Mymensingh', 'Mymensingh', '7 Town Hall Road, Mymensingh', '0915501008', 'Emergency,General Medicine,Neurology', '24 hours', 140, 18, 2, 1, 3.8, 3500);
