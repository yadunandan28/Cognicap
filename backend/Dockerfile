FROM node:20-alpine

WORKDIR /app

# OpenSSL required by Prisma on Alpine
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY prisma ./prisma

ENV PRISMA_CLI_BINARY_TARGETS="linux-musl-openssl-3.0.x"
RUN npx prisma generate

COPY src ./src
COPY server.js .

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]