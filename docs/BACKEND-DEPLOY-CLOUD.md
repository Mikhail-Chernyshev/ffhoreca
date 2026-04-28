# Быстрый деплой API в облако (Docker)

В репозитории есть **`Dockerfile`** — образ поднимает Hono + SQLite, порт из переменной **`PORT`** (по умолчанию в образе `3001`), файл БД по умолчанию **`/data/catalog.sqlite`** (удобно смонтировать **volume**).

Подробный VPS-вариант без Docker — в [BACKEND-DEPLOY.md](./BACKEND-DEPLOY.md).

---

## Перед деплоем (на любой платформе)

Задай переменные окружения (названия те же, что в коде сервера):

| Переменная | Обязательно | Описание |
|------------|-------------|----------|
| `ADMIN_TOKEN` или `VITE_ADMIN_TOKEN` | да | Секрет для `POST /api/places` (один и тот же, что на фронте в `VITE_ADMIN_TOKEN`). |
| `CORS_ORIGIN` | да в проде | Origin фронта, **ровно** как в браузере: `https://user.github.io` или `https://мой-сайт.ru` без слэша в конце. |
| `DATABASE_PATH` | желательно | Путь к файлу SQLite внутри контейнера; по умолчанию в образе **`/data/catalog.sqlite`**. Смонтируй **volume** на каталог `/data`. |
| `PORT` | обычно выставляет хостинг | Fly/Railway часто задают сами — сервер уже читает `process.env.PORT`. |

Один раз нужно **заполнить БД** из каталога в репозитории:

```bash
npm run db:seed
```

В Docker это одноразовая команда **после** первого деплоя (см. ниже «Первый seed»).

---

## Вариант A: Railway

1. Зайди на [railway.app](https://railway.app), войди через GitHub.
2. **New project** → **Deploy from GitHub repo** → выбери `ffhoreca`.
3. В настройках сервиса включи использование **Dockerfile** (или Railway сам найдёт его в корне).
4. **Variables** — добавь как минимум:
   - `ADMIN_TOKEN` = длинная случайная строка  
   - `CORS_ORIGIN` = твой фронт (HTTPS)
   - `DATABASE_PATH` = `/data/catalog.sqlite`
5. **Volumes**: добавь том, смонтируй на **`/data`** (чтобы файл БД переживал редеплои).
6. Деплой дождись зелёного статуса. Открой выданный **URL** Railway и проверь `https://ТВОЙ-URL/api/health`.
7. **Первый seed** — через Railway **Shell** или одноразовый запуск:
   - в контейнере из каталога приложения:  
     `npm run db:seed`  
     (переменные окружения уже подхватят `DATABASE_PATH` из панели Railway.)

Публичный URL скопируй в **`VITE_API_BASE_URL`** при сборке фронта.

---

## Вариант B: Fly.io

1. Установи [flyctl](https://fly.io/docs/hands-on/install-flyctl/), залогинься: `fly auth login`.
2. В корне репозитория (локально):

   ```bash
   fly launch --no-deploy
   ```

   Укажи регион, не деплой пока что при желании.

3. Создай volume (имя пример):

   ```bash
   fly volumes create ffhoreca_data --region ams --size 1
   ```

4. В `fly.toml` (сгенерированном) добавь секцию **[mounts]** (пример):

   ```toml
   [mounts]
     source = "ffhoreca_data"
     destination = "/data"
   ```

   И выставь переменные:

   ```bash
   fly secrets set ADMIN_TOKEN="..." CORS_ORIGIN="https://..."
   ```

   Убедись, что **`DATABASE_PATH=/data/catalog.sqlite`** (можно через `fly secrets set DATABASE_PATH=/data/catalog.sqlite`).

5. `fly deploy`
6. После деплоя — одноразово seed (через SSH или release command):

   ```bash
   fly ssh console -C "cd /app && npx tsx server/scripts/seed.ts"
   ```

   (путь к приложению в образе может быть `/app` — проверь `WORKDIR` в Dockerfile.)

7. Проверка: `https://ТВОЙ-APP.fly.dev/api/health`

Документация Fly по [volumes](https://fly.io/docs/reference/configuration/#the-mounts-section).

---

## Вариант C: Локально проверить образ

```bash
docker compose up --build
```

В другом терминале (после того как контейнер поднялся), первый раз:

```bash
docker compose exec api npm run db:seed
```

Проверка: `curl http://localhost:3001/api/health`

Остановка: `docker compose down`

---

## Фронт после деплоя API

В `.env` сборки фронта:

```env
VITE_API_BASE_URL=https://ТВОЙ-ПУБЛИЧНЫЙ-URL-API
VITE_ADMIN_TOKEN=ТОТ_ЖЕ_ЧТО_ADMIN_TOKEN_НА_СЕРВЕРЕ
```

Пересобери фронт и задеплой статику (GitHub Pages и т.д.).

Если до этого менял **`CORS_ORIGIN`** на сервере — он должен совпадать с origin страницы, где открыт фронт.

---

## Если что-то не поднимается

- **`better-sqlite3`** в образе собирается через `python3`, `make`, `g++` — уже указано в Dockerfile.
- Логи: Railway **Deployments → Logs**, Fly `fly logs`.
- БД пустая — не выполнен **`db:seed`** на том же `DATABASE_PATH`, где крутится процесс.
