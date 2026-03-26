# Law Vault (MVP)

Нейтральный портал для передачи и получения файлов. Интерфейс избегает лишних терминов и использует нейтральные названия.

## Быстрый старт

1) Скопируйте .env.example в .env и заполните значения.
2) Запустите сервисы:

```
docker compose up -d --build
```

Для APP_MASTER_KEY_B64 можно сгенерировать ключ так:

```
python - <<'PY'
import os, base64
print(base64.b64encode(os.urandom(32)).decode())
PY
```

3) Создайте пользователя для входа в портал (логин без email):

```
docker compose exec api python -m app.cli create-user --login admin --password "StrongPass123"
```

CLI выведет TOTP secret. Добавьте его в приложение-аутентификатор.

Если секрет потерян, можно сбросить:

```
docker compose exec api python -m app.cli reset-totp --login admin
```

Команда выведет новый secret и текущий код.

TOTP можно включить прямо в портале: нажмите "Включить TOTP через приложение-аутентификатор" и подтвердите код.
Привязка Telegram отображается в панели, но пока без логики восстановления.
QR для TOTP показывается в кабинете при включении.

Если нужно временно отключить TOTP (например, для первого входа), используйте:

```
docker compose exec api python -m app.cli disable-totp --login admin
```

4) Откройте портал http://localhost/portal, нажмите "Создать ссылку" и передайте её отправителю.

Ссылка выглядит так:

```
http://localhost/send/AB12-CD34
```

На домене:

```
https://example.com/send/AB12-CD34
```

Если нужен CLI:

```
docker compose exec api python -m app.cli create-upload-token --ttl 24h
```

CLI выведет код. Передайте отправителю ссылку вида `http://localhost/send/AB12-CD34`.

## Развертывание на сервере

Для сервера с доменом `sendvault.ru` используйте отдельный compose-файл с HTTPS:

```bash
docker compose -f docker-compose.server.yml up -d --build
```

Перед этим:

1. Заполните `.env`.
2. Выпустите сертификат Let's Encrypt для `sendvault.ru`.
3. Убедитесь, что сертификаты лежат в `/etc/letsencrypt/live/sendvault.ru/`.

После запуска сервис будет:

- принимать HTTP на `80` только для редиректа и проверки `/.well-known/acme-challenge/`
- обслуживать портал по HTTPS на `443`
- перенаправлять корень домена `/` в `/portal`
- открывать страницу передачи только по ссылке `/send/AB12-CD34`

После продления сертификата nginx внутри compose нужно перезагрузить:

```bash
cd /opt/law-vault
docker compose -f docker-compose.server.yml exec -T nginx nginx -s reload
```

Удобно добавить deploy-hook Certbot:

```bash
cat >/etc/letsencrypt/renewal-hooks/deploy/law-vault-nginx-reload.sh <<'EOF'
#!/bin/sh
cd /opt/law-vault || exit 1
docker compose -f docker-compose.server.yml exec -T nginx nginx -s reload
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/law-vault-nginx-reload.sh
```

## URLs

- http://localhost/ — загрузка
- http://localhost/portal — портал

## Примечания

- Файл удаляется через 10 минут после успешного получения.
- Если получатель разорвал соединение, статус не меняется.
- Загрузка поддерживает несколько файлов за один раз, а в списке отображается оставшееся время до удаления после получения.
- Пакет `app` должен содержать `__init__.py`, а в контейнере задан `PYTHONPATH=/app`, чтобы импорты `from app...` работали в Alembic и CLI.
