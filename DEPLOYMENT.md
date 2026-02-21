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

## Seguridad: RLS en tabla proyectos

Para que solo usuarios logueados puedan leer y modificar proyectos (recomendado):

1. En Supabase: **SQL Editor** → New query.
2. Pega y ejecuta el contenido del archivo **`supabase-rls-proyectos.sql`** del proyecto.

Sin esto, cualquiera con la URL de la app podría en teoría acceder si supiera tu clave. Con RLS solo cuentas autenticadas tienen acceso.

## Foto de perfil (avatar)

Para que cada usuario pueda subir su propia foto en el dashboard:

1. En Supabase: **Storage** → **New bucket** → id = `avatars`, marcar **Public** → Create.
2. En **SQL Editor**: pegar y ejecutar el contenido del archivo `supabase-avatar-setup.sql` del proyecto (crea la tabla `profiles` y las políticas del bucket).

Luego, en la app, haz clic en tu avatar (o en la inicial) en la esquina superior derecha y elige una imagen PNG o JPG.

## Supabase: configuración para producción

1. **RLS (Row Level Security):** Asegúrate de que la tabla `proyectos` tenga políticas que permitan `SELECT`, `INSERT`, `UPDATE`, `DELETE` según tu lógica. Si usas la anon key, las políticas RLS definen el acceso.

2. **CORS:** Supabase permite por defecto peticiones desde cualquier origen. Si tu dominio está restringido, ajústalo en: Supabase → Settings → API.

3. **Auth (Google OAuth):** En Supabase → Authentication → URL Configuration:
   - **Site URL:** `http://localhost:3000` (desarrollo) / `https://reyes-finance.vercel.app` (producción)
   - **Redirect URLs:** agrega exactamente:
     - `http://localhost:3000/auth/callback` (desarrollo)
     - `https://reyes-finance.vercel.app/auth/callback` (producción)

## Backups en Supabase

Para no perder datos si algo falla en la base:

1. Entra a [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto.
2. Ve a **Settings** → **Backups** (o **Database** → **Backups** según tu plan).
3. Revisa que los backups automáticos estén activos. En planes de pago suelen ser diarios.
4. Si usas plan gratuito, considera exportar datos importantes de vez en cuando: **Table Editor** → tabla `proyectos` → exportar como CSV.

Así tus ventas y pipeline quedan cubiertos ante fallos o borrados accidentales.

## Comandos útiles

```bash
# Desarrollo local
npm run dev

# Build de producción
npm run build

# Ejecutar build localmente
npm run start
```
