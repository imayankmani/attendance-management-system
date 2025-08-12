# Multi-stage build for Railway deployment
FROM node:18-alpine as backend

# Set working directory
WORKDIR /app

# Copy backend package files
COPY node-backend/package*.json ./

# Install backend dependencies
RUN npm ci --only=production

# Copy backend source
COPY node-backend/ ./

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the backend
CMD ["npm", "start"]
