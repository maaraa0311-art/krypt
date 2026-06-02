# KRYPT Server — захиалгын портал backend

Express + PostgreSQL + JWT auth. Frontend (`../`) энэ API руу холбогдоно.

## Шаардлага

- Node.js 18+
- PostgreSQL 13+ (локал эсвэл хостинг: Railway, Render, Neon, Supabase г.м.)

## Суулгах

```bash
cd server
npm install
cp .env.example .env       # Windows: copy .env.example .env
```

`.env` файлыг нээж дараахыг тааруул:
- `DATABASE_URL` — өөрийн PostgreSQL холболт
- `JWT_SECRET` — урт санамсаргүй утга (заавал солих!)

JWT_SECRET үүсгэх:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Өгөгдлийн сан бэлдэх

```bash
npm run init-db
```
→ `users`, `orders` хүснэгт үүснэ.

## Ажиллуулах

```bash
npm start          # эсвэл: npm run dev (өөрчлөлт бүрт дахин ачаална)
```
→ `http://localhost:4000/api`

## Frontend холбох

`../supabase-config.js` дотор:
```js
const API_BASE_URL = 'http://localhost:4000/api';
```
(Хостинг дээр тавихдаа production хаягаа бичнэ, мөн `.env`-д `CORS_ORIGIN`-г өөрийн сайтын домейнээр солино.)

## Анхны админ

Хамгийн **түрүүнд бүртгүүлсэн** хэрэглэгч автоматаар **админ** болно (студийн эзэн та эхэлж бүртгүүл). Гараар:
```sql
update users set role = 'admin' where email = 'maaraa0311@gmail.com';
```

## API товч

| Метод | Зам | Эрх | Үйлдэл |
|-------|-----|-----|--------|
| POST | `/api/auth/register` | — | Бүртгүүлэх |
| POST | `/api/auth/login` | — | Нэвтрэх |
| GET  | `/api/auth/me` | Токен | Өөрийн мэдээлэл |
| GET  | `/api/orders` | Токен | Өөрийн захиалга (`?all=1` → админд бүгд) |
| POST | `/api/orders` | Токен | Шинэ захиалга |
| PATCH| `/api/orders/:id/status` | Админ | Статус шинэчлэх |

## Хостинг (товч)

1. **Railway / Render** дээр PostgreSQL + энэ Node үйлчилгээг байршуулна.
2. Орчны хувьсагч: `DATABASE_URL`, `JWT_SECRET`, `PGSSL=true`, `CORS_ORIGIN=https://tani-domain.mn`.
3. `npm run init-db` нэг удаа ажиллуулна.
4. Frontend-ийн `API_BASE_URL`-г production хаягаар солино.
