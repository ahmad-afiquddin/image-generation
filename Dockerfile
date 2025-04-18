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

# Set environment variables from build arguments
ENV NODE_ENV=${NODE_ENV} \
    PORT=${PORT} \
    REDIS_HOST=${REDIS_HOST} \
    REDIS_PORT=${REDIS_PORT}

# Build the application (assuming you have a build script)
RUN npm run build

# Expose the port your app runs on
EXPOSE ${PORT}

# Command to run the application
CMD ["npm", "run", "start:prod"]