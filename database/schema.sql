-- Creación de la base de datos
CREATE DATABASE IF NOT EXISTS recipecoursesystem;
USE recipecoursesystem;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    userId INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    nickname VARCHAR(50) NOT NULL UNIQUE,
    passwordHash VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    profileImage VARCHAR(255),
    bio TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    lastLogin TIMESTAMP NULL,
    isAdmin BOOLEAN DEFAULT FALSE,
    isVerified BOOLEAN DEFAULT FALSE,
    verificationToken VARCHAR(255),
    verificationTokenExpires TIMESTAMP NULL,
    resetPasswordToken VARCHAR(255),
    resetPasswordExpires TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de registros temporales (para verificación de correo)
CREATE TABLE IF NOT EXISTS temp_registrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    registrationCode VARCHAR(10) NOT NULL,
    codeExpiry TIMESTAMP NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de estudiantes (extensión de usuarios)
CREATE TABLE IF NOT EXISTS students (
    studentId INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    cardNumber VARCHAR(50) UNIQUE,
    idFront VARCHAR(255),
    idBack VARCHAR(255),
    process ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    accountBalance DECIMAL(10, 2) DEFAULT 0.00,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
    INDEX idx_user_id (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de ingredientes
CREATE TABLE IF NOT EXISTS ingredients (
    ingredientId INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    imageUrl VARCHAR(255),
    isActive BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de unidades de medida
CREATE TABLE IF NOT EXISTS units (
    unitId INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    abbreviation VARCHAR(10) NOT NULL,
    unitType ENUM('weight', 'volume', 'piece', 'other') NOT NULL,
    isActive BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de conversiones de unidades
CREATE TABLE IF NOT EXISTS unitConversions (
    conversionId INT AUTO_INCREMENT PRIMARY KEY,
    fromUnitId INT NOT NULL,
    toUnitId INT NOT NULL,
    conversionFactor DECIMAL(10, 4) NOT NULL,
    isActive BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (fromUnitId) REFERENCES units(unitId),
    FOREIGN KEY (toUnitId) REFERENCES units(unitId),
    UNIQUE KEY unique_conversion (fromUnitId, toUnitId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de recetas
CREATE TABLE IF NOT EXISTS recipes (
    recipeId INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    prepTime INT COMMENT 'in minutes',
    cookTime INT COMMENT 'in minutes',
    servings INT,
    difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
    imageUrl VARCHAR(255),
    isPublic BOOLEAN DEFAULT TRUE,
    isApproved BOOLEAN DEFAULT FALSE,
    viewCount INT DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
    FULLTEXT (title, description, instructions)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de ingredientes utilizados en recetas
CREATE TABLE IF NOT EXISTS usedIngredients (
    usedIngredientId INT AUTO_INCREMENT PRIMARY KEY,
    recipeId INT NOT NULL,
    ingredientId INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    unitId INT NOT NULL,
    notes TEXT,
    isOptional BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (recipeId) REFERENCES recipes(recipeId) ON DELETE CASCADE,
    FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
    FOREIGN KEY (unitId) REFERENCES units(unitId),
    INDEX idx_recipe_ingredient (recipeId, ingredientId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de tokens para restablecimiento de contraseña
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    expiresAt TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
    INDEX idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de favoritos de los usuarios
CREATE TABLE IF NOT EXISTS user_favorites (
    favoriteId INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    recipeId INT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
    FOREIGN KEY (recipeId) REFERENCES recipes(recipeId) ON DELETE CASCADE,
    UNIQUE KEY unique_user_recipe (userId, recipeId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de valoraciones de recetas
CREATE TABLE IF NOT EXISTS recipe_ratings (
    ratingId INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    recipeId INT NOT NULL,
    rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
    FOREIGN KEY (recipeId) REFERENCES recipes(recipeId) ON DELETE CASCADE,
    UNIQUE KEY unique_user_recipe_rating (userId, recipeId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índices adicionales para mejorar el rendimiento
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_nickname ON users(nickname);
CREATE INDEX idx_recipes_user ON recipes(userId);
CREATE INDEX idx_used_ingredients_recipe ON usedIngredients(recipeId);
CREATE INDEX idx_used_ingredients_ingredient ON usedIngredients(ingredientId);

-- Insertar unidades básicas
INSERT IGNORE INTO units (name, abbreviation, unitType) VALUES
('gramo', 'g', 'weight'),
('kilogramo', 'kg', 'weight'),
('mililitro', 'ml', 'volume'),
('litro', 'l', 'volume'),
('cucharadita', 'tsp', 'volume'),
('cucharada', 'tbsp', 'volume'),
('taza', 'cup', 'volume'),
('pizca', 'pinch', 'other'),
('unidad', 'un', 'piece'),
('diente', 'clove', 'piece'),
('hoja', 'leaf', 'piece'),
('manojo', 'bunch', 'piece');

-- Insertar algunas conversiones básicas de unidades
INSERT IGNORE INTO unitConversions (fromUnitId, toUnitId, conversionFactor) VALUES
-- Peso
((SELECT unitId FROM units WHERE abbreviation = 'g'), (SELECT unitId FROM units WHERE abbreviation = 'kg'), 0.001),
((SELECT unitId FROM units WHERE abbreviation = 'kg'), (SELECT unitId FROM units WHERE abbreviation = 'g'), 1000),
-- Volumen
((SELECT unitId FROM units WHERE abbreviation = 'ml'), (SELECT unitId FROM units WHERE abbreviation = 'l'), 0.001),
((SELECT unitId FROM units WHERE abbreviation = 'l'), (SELECT unitId FROM units WHERE abbreviation = 'ml'), 1000),
-- Cucharadas a mililitros (aproximado)
((SELECT unitId FROM units WHERE abbreviation = 'tbsp'), (SELECT unitId FROM units WHERE abbreviation = 'ml'), 15),
((SELECT unitId FROM units WHERE abbreviation = 'tsp'), (SELECT unitId FROM units WHERE abbreviation = 'ml'), 5),
-- Tazas a mililitros (aproximado)
((SELECT unitId FROM units WHERE abbreviation = 'cup'), (SELECT unitId FROM units WHERE abbreviation = 'ml'), 240);

-- Crear un usuario administrador por defecto (contraseña: Admin123!)
-- Nota: En producción, asegúrate de cambiar esta contraseña después de la primera ejecución
SET @adminPassword = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; -- Hash de 'Admin123!'

INSERT INTO users (email, nickname, passwordHash, isAdmin, isVerified, enabled)
SELECT 'admin@example.com', 'admin', @adminPassword, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@example.com' OR nickname = 'admin');

-- Crear algunos ingredientes de ejemplo
INSERT IGNORE INTO ingredients (name, description) VALUES
('Harina', 'Harina de trigo todo uso'),
('Azúcar', 'Azúcar blanco refinado'),
('Huevos', 'Huevos de gallina'),
('Leche', 'Leche entera'),
('Mantequilla', 'Mantequilla sin sal'),
('Sal', 'Sal fina'),
('Pimienta', 'Pimienta negra molida'),
('Aceite de oliva', 'Aceite de oliva virgen extra'),
('Ajo', 'Dientes de ajo'),
('Cebolla', 'Cebolla blanca o amarilla');

-- Crear un procedimiento almacenado para limpiar tokens expirados
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS clean_expired_tokens()
BEGIN
    DELETE FROM password_reset_tokens WHERE expiresAt < NOW();
    DELETE FROM temp_registrations WHERE codeExpiry < NOW();
END //
DELIMITER ;

-- Crear un evento para limpiar tokens expirados diariamente
CREATE EVENT IF NOT EXISTS daily_token_cleanup
ON SCHEDULE EVERY 1 DAY
DO CALL clean_expired_tokens();

-- Otorgar permisos al procedimiento
-- Reemplaza 'tu_usuario_mysql' con el usuario de MySQL que estés utilizando
-- GRANT EXECUTE ON PROCEDURE mobile_cooking_app.clean_expired_tokens TO 'tu_usuario_mysql'@'localhost';
