# Despliegue en Vercel - Reyes Finance

## Variables de entorno requeridas

Configura estas variables en Vercel antes o durante el despliegue:

| Variable | Descripción | Obtener en |
|----------|-------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase | [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (anon) de Supabase | Mismo lugar que la URL |

> **Importante:** Usa la **anon (public)** key, no la service_role key. La anon key es segura para el frontend.

## Pasos para desplegar

### 1. Sube tu código a GitHub (si aún no lo hiciste)

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Despliega en Vercel

**Opción A: Desde la web de Vercel**

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Click en **"Add New..."** → **"Project"**
3. Importa tu repositorio de GitHub (conecta tu cuenta si es necesario)
4. En **"Environment Variables"**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL` = tu URL de Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon key
5. Click en **Deploy**

**Opción B: Con Vercel CLI**

```bash
# Instala Vercel CLI (solo la primera vez)
npm i -g vercel

# Despliega (te pedirá login la primera vez)
vercel

# Para producción:
vercel --prod
```

Durante el primer deploy, Vercel te preguntará por las variables. O configúralas después en el dashboard: **Project → Settings → Environment Variables**.

### 3. Verifica el build local (opcional)

```bash
npm run build
```

Si el build pasa en tu máquina, pasará en Vercel.

## Supabase: configuración para producción

1. **RLS (Row Level Security):** Asegúrate de que la tabla `proyectos` tenga políticas que permitan `SELECT`, `INSERT`, `UPDATE`, `DELETE` según tu lógica. Si usas la anon key, las políticas RLS definen el acceso.

2. **CORS:** Supabase permite por defecto peticiones desde cualquier origen. Si tu dominio está restringido, ajústalo en: Supabase → Settings → API.

3. **Auth (Google OAuth):** En Supabase → Authentication → URL Configuration:
   - **Site URL:** `http://localhost:3000` (desarrollo) / `https://reyes-finance.vercel.app` (producción)
   - **Redirect URLs:** agrega exactamente:
     - `http://localhost:3000/auth/callback` (desarrollo)
     - `https://reyes-finance.vercel.app/auth/callback` (producción)

## Comandos útiles

```bash
# Desarrollo local
npm run dev

# Build de producción
npm run build

# Ejecutar build localmente
npm run start
```
