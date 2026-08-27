# Billing Software (Wholesale/Retail Fireworks)

Two parts:
- `src/` — the React frontend (Vite)
- `backend/` — Express + MongoDB API (auth + cloud storage)

Data now lives in MongoDB in the cloud, behind a login, so it's the
same on every device/computer/staff member you log in from — not just
one browser.

## 1. Run the backend

```
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
- `MONGODB_URI` — a MongoDB Atlas connection string (free tier works
  fine). Sign up at https://www.mongodb.com/cloud/atlas, create a free
  cluster, create a database user, and copy the connection string.
- `JWT_SECRET` — any long random string (this signs login sessions).

Then start it:
```
npm start
```
It runs on `http://localhost:4000` by default.

## 2. Run the frontend

In a separate terminal, from the project root (not `backend/`):
```
npm install
npm run dev
```
Open the printed link (usually `http://localhost:5173`). The dev
server automatically proxies `/api` calls to `http://localhost:4000`
(see `vite.config.js`), so no extra setup needed locally.

The first time you open it, click **Sign up** to create your login
(username + password + business name), then you're in.

## 3. Deploy for real use (so it works from anywhere)

**Database:** MongoDB Atlas free tier (cloud, already covered above).

**Backend → Render:**
1. Push this project to a GitHub repo.
2. On Render.com: New → Web Service → connect the repo, set root
   directory to `backend`.
3. Build command: `npm install`  ·  Start command: `npm start`
4. Add environment variables `MONGODB_URI` and `JWT_SECRET` (same
   values as your local `.env`).
5. Deploy — Render gives you a URL like
   `https://your-backend.onrender.com`.

**Frontend → Netlify:**
1. Before building, create a `.env.production` file in the project
   root with:
   ```
   VITE_API_URL=https://your-backend.onrender.com
   ```
2. `npm run build` → creates `dist/`.
3. On Netlify: drag-and-drop the `dist/` folder, or connect the repo
   with build command `npm run build` and publish directory `dist`.

Once both are deployed, open your Netlify URL from any device, log in
with the account you created, and all your data (products, bills,
customers, stock) is there — synced through the cloud database.

## Notes
- Each login (username) has its own separate data — useful if
  different staff or businesses use the same deployment.
- Export-to-Excel buttons throughout the app still work as a manual
  backup option any time.
