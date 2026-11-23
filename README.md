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

## Face ID i passkey prijava

Pri prvom otvaranju aplikacija traži da napravite jedini vlasnički nalog. Nakon kreiranja naloga preglednik nudi registraciju passkey-a. Na iPhoneu se taj passkey potvrđuje Face ID-em.

Za lokalni razvoj dodajte u `.env`:

```env
BETTER_AUTH_SECRET="nasumični-secret-od-najmanje-32-znaka"
BETTER_AUTH_URL="http://localhost:3000"
```

Za iPhone je potrebna javna HTTPS adresa. U produkcijskom okruženju postavite zaseban `BETTER_AUTH_SECRET` i podesite `BETTER_AUTH_URL` na konačni domen, na primjer `https://finanse.example.com`. Secret se ne smije izlagati kroz `NEXT_PUBLIC_` varijablu.

Ako Face ID/passkey nije dostupan, vlasnik se može prijaviti rezervnom lozinkom koju unosi prilikom prvog podešavanja.
