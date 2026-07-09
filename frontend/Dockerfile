FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

RUN chown -R 1001:0 /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d && \
    chmod -R g+rwX /var/cache/nginx /var/log/nginx /etc/nginx/conf.d && \
    sed -i 's/^pid.*/pid \/tmp\/nginx.pid;/' /etc/nginx/nginx.conf

EXPOSE 8080

USER 1001

CMD ["nginx", "-g", "daemon off;"]
