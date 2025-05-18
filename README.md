# Backend - Sistema de Cursos de Cocina

Este es el backend para la aplicación móvil de cursos de cocina, desarrollado con Node.js, Express y MySQL.

## Requisitos previos

- Node.js (v14 o superior)
- MySQL (v8.0 o superior)
- npm o yarn

## Configuración inicial

1. Clona el repositorio:
   ```bash
   git clone [url-del-repositorio]
   cd backend
   ```

2. Instala las dependencias:
   ```bash
   npm install
   # o
   yarn install
   ```

3. Configura las variables de entorno:
   - Copia el archivo `.env.example` a `.env`
   - Configura las variables según tu entorno
   ```bash
   cp .env.example .env
   ```

4. Configura la base de datos:
   - Crea una base de datos MySQL llamada `recipecoursesystem`
   - Importa el esquema inicial:
     ```bash
     mysql -u [usuario] -p recipecoursesystem < database/schema.sql
     ```

## Ejecución

1. Inicia el servidor en modo desarrollo:
   ```bash
   npm run dev
   # o
   yarn dev
   ```

2. Para producción:
   ```bash
   npm start
   # o
   yarn start
   ```

## Estructura del proyecto

```
backend/
├── config/               # Configuraciones
├── controllers/           # Controladores
├── database/             # Scripts de base de datos
├── middlewares/          # Middlewares de Express
├── models/               # Modelos de datos
├── routes/               # Rutas de la API
├── uploads/              # Archivos subidos
├── utils/                # Utilidades
├── .env.example          # Variables de entorno de ejemplo
├── .gitignore
├── app.js                # Aplicación principal
├── package.json
└── README.md
```

## Variables de entorno

Revisa el archivo `.env.example` para ver todas las variables de entorno necesarias.

## Endpoints principales

### Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Inicio de sesión
- `POST /api/auth/refresh-token` - Renovar token de acceso
- `POST /api/auth/verify-email` - Verificar correo electrónico

### Usuarios
- `GET /api/users/me` - Obtener perfil del usuario actual
- `PUT /api/users/me` - Actualizar perfil
- `POST /api/users/request-password-reset` - Solicitar restablecimiento de contraseña
- `POST /api/users/reset-password` - Restablecer contraseña

### Estudiantes
- `POST /api/students/upgrade` - Actualizar a cuenta de estudiante
- `GET /api/students/status/:userId` - Obtener estado de estudiante
- `PATCH /api/students/:studentId/verify` - Actualizar estado de verificación (admin)
- `PATCH /api/students/:studentId/balance` - Actualizar saldo (admin)

## Contribución

1. Crea un fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Haz commit de tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Haz push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT.
