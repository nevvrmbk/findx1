# findx1
---
## Tech stack
- Express JS
- Typescript
- [Prisma](https://prisma.io)
- [Mozilla Nunjucks](https://mozilla.github.io/nunjucks/)
- [Bootstrap](https://getbootstrap.com)
---
## Setting up the database for development
```bash
echo "DATABASE_URL='file:./dev.db'" > .env
npx prisma migrate dev --name init
