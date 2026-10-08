FROM php:8.3-apache
RUN apt-get update && apt-get install -y --no-install-recommends libsqlite3-dev && docker-php-ext-install pdo_sqlite && rm -rf /var/lib/apt/lists/*
COPY public/ /var/www/html/
COPY src/ /var/www/src/
RUN mkdir -p /data && chown www-data:www-data /data
ENV DB_PATH=/data/rupeetrail.sqlite
EXPOSE 80
