-- Member 6: vaccines / anti-venoms and how many each hospital has

CREATE TABLE vaccines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category ENUM('Vaccine', 'Anti-venom') NOT NULL,
    description VARCHAR(255) NOT NULL
);

CREATE TABLE vaccine_stock (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    vaccine_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    UNIQUE (hospital_id, vaccine_id),
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
    FOREIGN KEY (vaccine_id) REFERENCES vaccines(id) ON DELETE CASCADE
);

INSERT INTO vaccines (name, category, description) VALUES
('Hepatitis B Vaccine', 'Vaccine', 'Protects against hepatitis B virus.'),
('Tetanus Toxoid', 'Vaccine', 'Protects against tetanus after injuries.'),
('Rabies Vaccine', 'Vaccine', 'Used after animal bites such as dog bites.'),
('COVID-19 Vaccine', 'Vaccine', 'Protects against COVID-19.'),
('Polyvalent Snake Anti-venom', 'Anti-venom', 'Treats bites from common venomous snakes.'),
('Scorpion Anti-venom', 'Anti-venom', 'Treats scorpion stings.');

INSERT INTO vaccine_stock (hospital_id, vaccine_id, quantity) VALUES
(1, 1, 40), (1, 2, 60), (1, 3, 25), (1, 5, 8),
(2, 2, 30), (2, 3, 0), (2, 5, 5),
(3, 1, 15), (3, 4, 100),
(4, 2, 20), (4, 3, 12),
(5, 5, 0), (5, 6, 4),
(6, 3, 18), (6, 5, 10), (6, 6, 0);
