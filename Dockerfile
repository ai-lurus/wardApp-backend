# Usamos una imagen ligera de Node.js 22 LTS
FROM node:22-alpine

# Instalamos dependencias necesarias para Prisma y herramientas de compilación básicas
RUN apk add --no-cache openssl libc6-compat

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos solo los archivos de dependencias primero para aprovechar el cache de capas de Docker
COPY package*.json ./
COPY prisma ./prisma/

# Instalamos todas las dependencias (incluyendo devDeps para desarrollo)
RUN npm install

# Copiamos el resto del código fuente
COPY . .

# Generamos el Prisma Client (esencial para que TypeScript lo reconozca)
RUN npx prisma generate

# Exponemos el puerto del backend definido en tu configuración
EXPOSE 3001

# Comando por defecto para desarrollo (con tsx watch habilitado)
CMD ["npm", "run", "dev"]
