-- Member 6: blood banks and their stock for each blood group

CREATE TABLE blood_banks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    city VARCHAR(60) NOT NULL,
    area VARCHAR(80) NOT NULL,
    address VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL
);

CREATE TABLE blood_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    blood_bank_id INT NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    units INT NOT NULL DEFAULT 0,
    UNIQUE (blood_bank_id, blood_group),
    FOREIGN KEY (blood_bank_id) REFERENCES blood_banks(id) ON DELETE CASCADE
);

INSERT INTO blood_banks (name, city, area, address, phone) VALUES
('Red Crescent Blood Bank', 'Dhaka', 'Mohammadpur', '1 Red Crescent Road, Dhaka', '0255502001'),
('Savar Blood Centre', 'Savar', 'Bazar', 'Savar Bazar, Savar', '0255502002'),
('Port City Blood Bank', 'Chattogram', 'Agrabad', '8 Agrabad, Chattogram', '0315502003'),
('Rajshahi Blood Service', 'Rajshahi', 'Boalia', '4 Boalia Road, Rajshahi', '0725502004');

-- Makes demo stock with a formula. A result of 0 means "out of stock".
INSERT INTO blood_inventory (blood_bank_id, blood_group, units)
SELECT b.id, g.blood_group, MOD(b.id * 7 + g.n * 3, 11)
FROM blood_banks b
CROSS JOIN (
    SELECT 1 AS n, 'A+' AS blood_group UNION SELECT 2, 'A-' UNION SELECT 3, 'B+' UNION SELECT 4, 'B-'
    UNION SELECT 5, 'AB+' UNION SELECT 6, 'AB-' UNION SELECT 7, 'O+' UNION SELECT 8, 'O-'
) g;

-- Make sure O+ is available at the Dhaka bank and AB- is out of stock at Savar (good demo data).
UPDATE blood_inventory SET units = 12 WHERE blood_bank_id = 1 AND blood_group = 'O+';
UPDATE blood_inventory SET units = 0 WHERE blood_bank_id = 2 AND blood_group = 'AB-';
