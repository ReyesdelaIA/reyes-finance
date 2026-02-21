-- Foto de perfil (avatar) en Reyes Finance
-- 1. En Supabase: Storage → New bucket → id = "avatars", marcar Public → Create.
-- 2. Luego en SQL Editor: New query → pegar este archivo → Run.

-- Tabla y políticas para perfiles y storage.

-- Tabla profiles: guarda avatar_url por usuario (id = auth.uid())
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  avatar_url text,
  updated_at timestamptz default now()
);

-- Solo el propio usuario puede ver y actualizar su perfil
alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

comment on table public.profiles is 'Perfil del usuario: avatar y datos extra. Id = auth.users.id';

-- Storage: bucket para fotos de perfil
-- Si el bucket no existe, créalo en Dashboard → Storage → New bucket → id = "avatars", Public = true.
-- Luego ejecuta las políticas de abajo.

-- Políticas para el bucket "avatars" (cada usuario sube a {user_id}/avatar.png)
-- Permiten: subir/actualizar/borrar solo en tu carpeta; lectura pública para ver fotos.
drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Avatar images are public" on storage.objects;
create policy "Avatar images are public"
  on storage.objects for select
  using (bucket_id = 'avatars');
