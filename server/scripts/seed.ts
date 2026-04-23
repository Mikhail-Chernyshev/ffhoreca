/**
 * Заполнить SQLite из `src/data/catalog.ts` (перезаписывает таблицы).
 * Запуск: npm run db:seed
 */
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(process.cwd(), '.env') });
loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
import { catalog } from '../../src/data/catalog';
import { openDatabase, replaceCatalog } from '../src/db';

const DATABASE_PATH = path.resolve(
  process.cwd(),
  process.env.DATABASE_PATH ?? 'server/data/catalog.sqlite',
);

const db = openDatabase(DATABASE_PATH);
replaceCatalog(db, catalog);
db.close();
console.log(`Seeded ${catalog.cities.length} cities, ${catalog.places.length} places → ${DATABASE_PATH}`);
