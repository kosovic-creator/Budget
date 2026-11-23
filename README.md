# Finanse

Mobilno prilagođen Next.js pregled ličnih finansija. Transakcije se čuvaju u PostgreSQL bazi na Neon-u preko Prisma ORM-a.

## Pokretanje

1. Instalirajte zavisnosti:

   ```bash
   npm install
   ```

2. Napravite `.env` kopiranjem `.env.example` i unesite Neon konekcione stringove:
   - `DATABASE_URL` za aplikaciju (preporučeno pooled URL)
   - `DIRECT_URL` je opcionalan; koristi se za Prisma DB komande

3. Generišite Prisma Client i uskladite tabelu sa šemom:

   ```bash
   npm run db:generate
   npm run db:push
   ```

4. Pokrenite aplikaciju:

   ```bash
   npm run dev
   ```

Otvorite [http://localhost:3000](http://localhost:3000).

`npm run build` automatski generiše Prisma Client prije produkcijskog builda.
