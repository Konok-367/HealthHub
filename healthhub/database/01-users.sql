-- Member 1: users table (patients, doctors, hospital staff, ambulance providers, admins)
-- Demo password for every seeded user is: Password123

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    address VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('patient', 'doctor', 'hospital_authority', 'ambulance_provider', 'admin') NOT NULL DEFAULT 'patient',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (full_name, email, phone, date_of_birth, gender, address, password_hash, role) VALUES
('Rahim Patient', 'patient@healthhub.com', '01711111111', '2000-05-10', 'Male', 'Savar, Dhaka', '$2b$10$ms3yY4zQ6KcmopepQCzzTu57CayClLYND1pcB0WGhO..qLsg9r2lK', 'patient'),
('Dr. Karim Doctor', 'doctor@healthhub.com', '01722222222', '1985-03-20', 'Male', 'Dhanmondi, Dhaka', '$2b$10$ms3yY4zQ6KcmopepQCzzTu57CayClLYND1pcB0WGhO..qLsg9r2lK', 'doctor'),
('Hospital Authority', 'hospital@healthhub.com', '01733333333', '1980-01-15', 'Female', 'Dhaka', '$2b$10$ms3yY4zQ6KcmopepQCzzTu57CayClLYND1pcB0WGhO..qLsg9r2lK', 'hospital_authority'),
('Ambulance Provider', 'ambulance@healthhub.com', '01744444444', '1990-07-07', 'Male', 'Savar, Dhaka', '$2b$10$ms3yY4zQ6KcmopepQCzzTu57CayClLYND1pcB0WGhO..qLsg9r2lK', 'ambulance_provider'),
('System Admin', 'admin@healthhub.com', '01755555555', '1988-11-30', 'Other', 'Dhaka', '$2b$10$ms3yY4zQ6KcmopepQCzzTu57CayClLYND1pcB0WGhO..qLsg9r2lK', 'admin');
