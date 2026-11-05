-- Member 4: payments table
-- We never store full card numbers, only the last 4 digits.

CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL,
    patient_id INT NOT NULL,
    amount INT NOT NULL,
    method ENUM('card', 'mobile_banking', 'wallet') NOT NULL,
    account_last4 VARCHAR(4) NOT NULL,
    status ENUM('Successful', 'Failed', 'Pending') NOT NULL,
    transaction_ref VARCHAR(40) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
);
