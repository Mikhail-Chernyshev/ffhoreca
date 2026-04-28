# Публикация бэкенда и SQLite (ffhoreca API)

Этот документ описывает развёртывание **Node + Hono + SQLite** из папки `server/` на отдельной машине (VPS). Фронт (GitHub Pages, Vercel и т.д.) потом подключается по `VITE_API_BASE_URL`.

**Деплой через Docker (Railway, Fly.io и т.п.)** — короче и практичнее для старта: см. **[BACKEND-DEPLOY-CLOUD.md](./BACKEND-DEPLOY-CLOUD.md)**.

---

## 0. Что именно выкладывается

- **Процесс:** читает переменные окружения, открывает файл БД, слушает HTTP (порт `PORT`).
- **База:** один файл SQLite, путь задаётся в `DATABASE_PATH` (обязательно **постоянный диск**, не tmpfs без тома).
- **Эндпоинты:**
  - `GET /api/health` — проверка живости
  - `GET /api/catalog` — города и места из БД
  - `POST /api/places` — тело JSON `{ "token": "<секрет>", "place": { ... } }`

Исходный код: репозиторий [ffhoreca](https://github.com/Mikhail-Chernyshev/ffhoreca) (ветка `main` или ваша).

---

## 1. Выбор сервера

**Рекомендация:** VPS с Ubuntu 22.04 или 24.04 LTS (Hetzner, DigitalOcean, Timeweb, Selectel, Yandex Cloud и т.д.).

**Важно для SQLite:** диск должен **сохраняться** после перезагрузки и переустановки контейнера. На PaaS без **persistent volume** файл БД может пропасть — тогда либо подключают том, либо переходят на облачную БД (отдельная тема).

Минимум по ресурсам для этого API: **1 vCPU, 512 MB–1 GB RAM**, десятки гигабайт диска.

---

## 2. Первый вход на сервер

1. Создайте виртуальную машину в панели провайдера, выберите **Ubuntu LTS**.
2. Подключитесь по SSH (провайдер покажет команду), например:

   ```bash
   ssh root@ВАШ_IP
   ```

3. Обновите систему:

   ```bash
   apt update && apt upgrade -y
   ```

4. (По желанию) создайте пользователя без root, настройте `sudo` — для продакшена так безопаснее. Ниже команды можно выполнять от пользователя с `sudo`.

---

## 3. Установка Node.js

Рекомендуется **Node 20 LTS** или новее.

Через NodeSource или через пакеты Ubuntu — как удобнее. Пример с **nvm** (официальный способ для разработчиков):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
node -v
npm -v
```

Проверьте: `node -v` показывает v20.x.

---

## 4. Установка Git и клонирование репозитория

```bash
apt install -y git
mkdir -p /opt/ffhoreca
cd /opt/ffhoreca
git clone https://github.com/Mikhail-Chernyshev/ffhoreca.git app
cd app
```

Если репозиторий приватный — настройте [SSH-ключ](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) на сервере или используйте deploy token.

---

## 5. Установка зависимостей проекта

```bash
cd /opt/ffhoreca/app
npm ci
```

Для запуска сервера используется **tsx** (есть в `devDependencies`); для минимального прод-образа можно позже собрать сервер в JS и ставить только `dependencies` — пока достаточно `npm ci`.

---

## 6. Каталог для базы данных (постоянный путь)

```bash
mkdir -p /var/lib/ffhoreca
chown $USER:$USER /var/lib/ffhoreca   # или пользователь, от которого будет крутиться Node
```

Сюда будет указывать `DATABASE_PATH`. Файл `catalog.sqlite` создастся после `db:seed` или при первом запуске API (если вы скопируете готовый файл).

---

## 7. Файл переменных окружения на сервере

Создайте файл, который **не коммитится** в git (на сервере вручную), например:

```bash
nano /opt/ffhoreca/app/.env.production
```

Содержимое (подставьте свои значения):

```env
PORT=3001
ADMIN_TOKEN=СГЕНЕРИРУЙТЕ_ДЛИННЫЙ_СЛУЧАЙНЫЙ_СЕКРЕТ
DATABASE_PATH=/var/lib/ffhoreca/catalog.sqlite
CORS_ORIGIN=https://ВАШ-ФРОНТ-ДОМЕН
```

Пояснения:

| Переменная | Назначение |
|------------|------------|
| `PORT` | Порт, на котором слушает Node (за nginx будет 443 снаружи). |
| `ADMIN_TOKEN` | Тот же смысл, что `VITE_ADMIN_TOKEN` на фронте: проверка в `POST /api/places`. Сервер также читает `VITE_ADMIN_TOKEN`, если `ADMIN_TOKEN` пуст — удобно дублировать одну строку в `.env` при желании. |
| `DATABASE_PATH` | Абсолютный путь к файлу SQLite. |
| `CORS_ORIGIN` | Origin фронта **ровно** как в браузере: `https://example.com` без слэша в конце. Если фронт на `https://user.github.io`, укажите его. Несколько origin текущий код не поддерживает — один домен. |

Права на файл с секретами:

```bash
chmod 600 /opt/ffhoreca/app/.env.production
```

Загрузка env в процесс: ниже в systemd будет `EnvironmentFile=`. Сервер в коде читает `.env` и `.env.local` из **текущей рабочей директории** при старте через `dotenv`; для продакшена проще **экспортировать** переменные из `.env.production` в unit-файле (см. раздел 10).

**Важно:** скрипт `server/src/index.ts` подгружает `.env` и `.env.local` из `process.cwd()`. Если запускаете из `/opt/ffhoreca/app`, положите туда копию секретов как `.env.local` **или** задайте все переменные в systemd `Environment=` / `EnvironmentFile=` (тогда dotenv может не понадобиться — переменные уже в окружении процесса).

Практичный вариант: скопировать прод-настройки в `app/.env.local` на сервере (файл не в git):

```bash
cp /opt/ffhoreca/app/.env.production /opt/ffhoreca/app/.env.local
chmod 600 /opt/ffhoreca/app/.env.local
```

Тогда `loadEnv` в сервере подхватит их при `cwd` = `/opt/ffhoreca/app`.

---

## 8. Первичное заполнение базы (seed)

Из каталога приложения:

```bash
cd /opt/ffhoreca/app
# Убедитесь, что DATABASE_PATH и остальное доступны процессу (через .env.local на сервере)
npm run db:seed
```

В логе будет что-то вроде: `Seeded N cities, M places → /var/lib/ffhoreca/catalog.sqlite`.

Проверка файла:

```bash
ls -la /var/lib/ffhoreca/catalog.sqlite
```

---

## 9. Ручной тест API без nginx

Временно:

```bash
cd /opt/ffhoreca/app
export $(grep -v '^#' .env.local | xargs)   # осторожно: только если в файле нет пробелов в значениях без кавычек
npx tsx server/src/index.ts
```

С другой машины или с сервера:

```bash
curl -s http://127.0.0.1:3001/api/health
curl -s http://127.0.0.1:3001/api/catalog | head
```

Остановите процесс (Ctrl+C), когда убедитесь, что отвечает.

---

## 10. Автозапуск через systemd

Создайте unit-файл:

```bash
sudo nano /etc/systemd/system/ffhoreca-api.service
```

Пример содержимого (пользователь `www-data` или ваш `deploy` — подставьте своего):

```ini
[Unit]
Description=ffhoreca Hono API + SQLite
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/ffhoreca/app
EnvironmentFile=/opt/ffhoreca/app/.env.production
ExecStart=/usr/bin/env npx tsx server/src/index.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Путь к `npx`: узнайте `which npx` (часто `/root/.nvm/versions/node/...` если ставили nvm под root — тогда лучше отдельный пользователь и полный путь к `node` и `tsx`).

Если `npx` не в PATH у `www-data`, используйте полный путь к бинарнику node и запуск:

```ini
ExecStart=/home/deploy/.nvm/versions/node/v20.18.0/bin/node /opt/ffhoreca/app/node_modules/tsx/dist/cli.mjs server/src/index.ts
```

(путь к `node` и к `tsx` проверьте на сервере.)

Команды:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ffhoreca-api
sudo systemctl start ffhoreca-api
sudo systemctl status ffhoreca-api
journalctl -u ffhoreca-api -f
```

---

## 11. Nginx как reverse proxy + HTTPS

Установка:

```bash
sudo apt install -y nginx
```

Пример сервера `api.вашдомен.ru` (замените домен и порт Node):

```nginx
server {
    listen 80;
    server_name api.вашдомен.ru;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Проверка и перезагрузка:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Сертификат **Let’s Encrypt** (certbot):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.вашдомен.ru
```

После этого в браузере: `https://api.вашдомен.ru/api/health`.

**DNS:** тип **A** для `api.вашдомен.ru` → публичный IP VPS.

---

## 12. CORS и фронт

В `.env` на сервере переменная **`CORS_ORIGIN`** должна совпадать с origin страницы фронта, например:

- `https://Mikhail-Chernyshev.github.io` — если SPA на GitHub Pages по пути репо;
- `https://ffhoreca.example.com` — если свой домен.

В **сборке фронта** (GitHub Actions / локально перед выкладкой):

```env
VITE_API_BASE_URL=https://api.вашдомен.ru
```

Пересобрать фронт после смены URL. Секрет для кнопки «Добавить» на фронте: **`VITE_ADMIN_TOKEN`** = тому же значению, что **`ADMIN_TOKEN`** на сервере.

---

## 13. Обновление кода и БД после деплоя

```bash
cd /opt/ffhoreca/app
git pull
npm ci
sudo systemctl restart ffhoreca-api
```

Если изменился только `catalog.ts` и нужно **перезалить** данные из репозитория в SQLite (осторожно: перезапишет таблицы):

```bash
npm run db:seed
```

Seed **удаляет** старые строки в таблицах и вставляет заново из `src/data/catalog.ts` — не делайте это на проде, если в БД уже есть уникальные данные только там; тогда нужны миграции или отдельный скрипт слияния.

---

## 14. Бэкап SQLite

### 14.1. Что копировать

Файл по пути `DATABASE_PATH` (например `/var/lib/ffhoreca/catalog.sqlite`).

### 14.2. Атомарная копия без остановки сервера

Установите CLI SQLite (если ещё нет):

```bash
sudo apt install -y sqlite3
```

Скрипт бэкапа `/usr/local/bin/backup-ffhoreca.sh`:

```bash
#!/bin/bash
set -euo pipefail
SRC="/var/lib/ffhoreca/catalog.sqlite"
DEST_DIR="/backup/ffhoreca"
mkdir -p "$DEST_DIR"
STAMP=$(date +%F-%H%M%S)
TMP="$DEST_DIR/catalog-$STAMP.sqlite.tmp"
FINAL="$DEST_DIR/catalog-$STAMP.sqlite"
sqlite3 "$SRC" ".backup $TMP"
mv "$TMP" "$FINAL"
gzip -f "$FINAL"
# опционально: rclone copy "$FINAL.gz" remote:ffhoreca-backups/
find "$DEST_DIR" -name 'catalog-*.sqlite.gz' -mtime +30 -delete
```

```bash
sudo chmod +x /usr/local/bin/backup-ffhoreca.sh
```

Cron (каждый день в 03:20):

```bash
sudo crontab -e
```

Строка:

```cron
20 3 * * * /usr/local/bin/backup-ffhoreca.sh >> /var/log/ffhoreca-backup.log 2>&1
```

### 14.3. Восстановление

Остановить API, заменить файл (или скопировать бэкап поверх `DATABASE_PATH`), запустить API, проверить `GET /api/catalog`.

---

## 15. Чеклист перед «в бою»

- [ ] `DATABASE_PATH` на постоянном диске, права на запись у пользователя сервиса.
- [ ] `ADMIN_TOKEN` длинный и случайный; совпадает с `VITE_ADMIN_TOKEN` на фронте.
- [ ] `CORS_ORIGIN` = точный origin фронта.
- [ ] HTTPS на API-домене, фронт ходит на `https://api...`.
- [ ] `systemctl status` зелёный, логи без ошибок.
- [ ] Настроен бэкап и один раз проверено восстановление на копии.

---

## 16. Ограничения текущей реализации

- Один **`CORS_ORIGIN`** — несколько фронтовых доменов потребуют правки кода (массив или `*` не рекомендуется с credentials).
- Токен в URL на фронте и секрет в бандле — слабая защита; для публичного интернета лучше позже OAuth / одноразовые ключи только на сервере.
- SQLite на одном сервере — ок для небольшой нагрузки; при росте — PostgreSQL и миграции.

При вопросах по конкретному провайдеру можно дописать раздел под его панель (firewall, floating IP, тома).
