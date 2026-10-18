# Image chạy app Nhà trọ Văn Phúc. Dùng chung với docker-compose.yml (app + Caddy).
#
# Cố ý giữ nguyên node_modules (kể cả devDependencies) trong image cuối: lệnh
# khởi động cần Prisma CLI (db push) và tsx (seed, đặt lại PIN) chạy bên trong
# container. Đổi lại image nặng hơn bản standalone, với app 32 phòng thì không đáng kể.

# Debian slim thay vì Alpine: Prisma cần OpenSSL và chạy ổn định trên glibc mà
# không phải khai báo thêm binaryTargets.
FROM node:24-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1

# --- Cài thư viện (tách riêng để Docker cache lại khi chỉ sửa code) ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

# --- Build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build && rm -rf .next/cache

# --- Chạy ---
FROM base AS runner
ENV NODE_ENV=production \
    TZ=Asia/Ho_Chi_Minh \
    DATABASE_URL=file:/app/data/dev.db \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app ./
# Thư mục chứa file SQLite, được gắn volume để dữ liệu không mất khi build lại.
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
CMD ["npm", "run", "docker:start"]
