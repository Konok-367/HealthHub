-- Member 3: doctors, appointment slots, appointments and notifications

CREATE TABLE doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,                       -- links a doctor to a login account (optional)
    hospital_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    specialty VARCHAR(80) NOT NULL,
    qualification VARCHAR(150) NOT NULL,
    experience_years INT NOT NULL DEFAULT 0,
    consultation_fee INT NOT NULL DEFAULT 0,
    bio TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
);

CREATE TABLE appointment_slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    slot_date DATE NOT NULL,
    slot_time TIME NOT NULL,
    is_booked TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE (doctor_id, slot_date, slot_time),   -- the same time cannot be created twice
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

CREATE TABLE appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    slot_id INT NOT NULL,
    status ENUM('Booked', 'Rescheduled', 'Cancelled') NOT NULL DEFAULT 'Booked',
    payment_status ENUM('Unpaid', 'Paid') NOT NULL DEFAULT 'Unpaid',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    FOREIGN KEY (slot_id) REFERENCES appointment_slots(id)
);

CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO doctors (user_id, hospital_id, name, specialty, qualification, experience_years, consultation_fee, bio) VALUES
(2, 1, 'Dr. Karim Doctor', 'Cardiology', 'MBBS, MD (Cardiology)', 12, 1000, 'Heart specialist with 12 years of experience.'),
(NULL, 1, 'Dr. Nadia Rahman', 'Neurology', 'MBBS, FCPS (Neurology)', 9, 1200, 'Treats headaches, stroke and nerve problems.'),
(NULL, 2, 'Dr. Sabbir Hossain', 'Pediatrics', 'MBBS, DCH', 7, 700, 'Child health specialist.'),
(NULL, 3, 'Dr. Farhana Akter', 'Cardiology', 'MBBS, MD (Cardiology)', 15, 1500, 'Senior consultant at the heart institute.'),
(NULL, 6, 'Dr. Tanvir Ahmed', 'Oncology', 'MBBS, MD (Oncology)', 10, 1300, 'Cancer care specialist.'),
(NULL, 7, 'Dr. Mitu Das', 'Gynecology', 'MBBS, FCPS (Gynecology)', 11, 900, 'Women health specialist.');

-- Creates 3 slots per day (10:00, 11:00, 12:00) for the next 3 days, for every doctor.
-- CURDATE() is today, so the demo slots are never in the past.
INSERT INTO appointment_slots (doctor_id, slot_date, slot_time)
SELECT d.id, DATE_ADD(CURDATE(), INTERVAL n.day_offset DAY), t.slot_time
FROM doctors d
CROSS JOIN (SELECT 1 AS day_offset UNION SELECT 2 UNION SELECT 3) n
CROSS JOIN (SELECT '10:00:00' AS slot_time UNION SELECT '11:00:00' UNION SELECT '12:00:00') t;

-- One demo appointment (unpaid) so the Payment page has something to pay for.
UPDATE appointment_slots SET is_booked = 1 WHERE id = 1;
INSERT INTO appointments (patient_id, doctor_id, slot_id)
SELECT 1, doctor_id, id FROM appointment_slots WHERE id = 1;
