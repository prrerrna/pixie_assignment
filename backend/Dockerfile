FROM node:20-bookworm

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies
RUN npm install

# Install Playwright browsers AND system dependencies (requires root, handled by Docker build)
RUN npx playwright install --with-deps firefox

# Copy the rest of the application code
COPY . .

# Expose the API port
EXPOSE 4000

# Start the server
CMD ["node", "server.js"]
