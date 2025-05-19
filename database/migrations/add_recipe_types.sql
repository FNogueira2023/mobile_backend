-- Create recipe types table
CREATE TABLE IF NOT EXISTS recipe_types (
    typeId INT AUTO_INCREMENT PRIMARY KEY,
    description VARCHAR(100) NOT NULL UNIQUE,
    isActive BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add typeId to recipes table
ALTER TABLE recipes
ADD COLUMN typeId INT,
ADD FOREIGN KEY (typeId) REFERENCES recipe_types(typeId);

-- Insert some basic recipe types
INSERT INTO recipe_types (description) VALUES
('Desayuno'),
('Almuerzo'),
('Cena'),
('Postre'),
('Aperitivo'),
('Bebida'),
('Snack'),
('Vegetariano'),
('Vegano'),
('Sin Gluten'); 