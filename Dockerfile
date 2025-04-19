FROM node:22-alpine

# Install dependencies required for Sharp and basic utilities
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    vips-dev \
    libc6-compat

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Define build arguments with defaults
ARG NODE_ENV=production
ARG PORT=3000
ARG REDIS_HOST=localhost
ARG REDIS_PORT=6379
ARG MINIO_ENDPOINT=localhost
ARG MINIO_PORT=9000
ARG MINIO_USE_SSL=false
ARG MINIO_ACCESS_KEY=minioadmin
ARG MINIO_SECRET_KEY=minioadmin
ARG MINIO_BUCKET_NAME=thumbnails
ARG MINIO_PUBLIC_URL=http://localhost:9000
ARG MINIO_REGION=us-east-1

# Set environment variables from build arguments
ENV NODE_ENV=${NODE_ENV} \
    PORT=${PORT} \
    REDIS_HOST=${REDIS_HOST} \
    REDIS_PORT=${REDIS_PORT} \
    MINIO_ENDPOINT=${MINIO_ENDPOINT} \
    MINIO_PORT=${MINIO_PORT} \
    MINIO_USE_SSL=${MINIO_USE_SSL} \
    MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY} \
    MINIO_BUCKET_NAME=${MINIO_BUCKET_NAME} \
    MINIO_PUBLIC_URL=${MINIO_PUBLIC_URL} \
    MINIO_REGION=${MINIO_REGION}

# Build the application (assuming you have a build script)
RUN npm run build

# Expose the port your app runs on
EXPOSE ${PORT}

# Command to run the application
CMD ["npm", "run", "start:prod"]