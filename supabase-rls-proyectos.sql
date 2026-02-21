-- RLS en tabla proyectos - Reyes Finance
-- Solo usuarios autenticados (logueados) pueden leer y modificar proyectos.
-- Ejecuta en Supabase: SQL Editor → New query → Pegar y Run.

alter table public.proyectos enable row level security;

-- Permitir SELECT, INSERT, UPDATE, DELETE solo si hay un usuario logueado
drop policy if exists "Authenticated users can read proyectos" on public.proyectos;
create policy "Authenticated users can read proyectos"
  on public.proyectos for select
  using (auth.uid() is not null);

drop policy if exists "Authenticated users can insert proyectos" on public.proyectos;
create policy "Authenticated users can insert proyectos"
  on public.proyectos for insert
  with check (auth.uid() is not null);

drop policy if exists "Authenticated users can update proyectos" on public.proyectos;
create policy "Authenticated users can update proyectos"
  on public.proyectos for update
  using (auth.uid() is not null);

drop policy if exists "Authenticated users can delete proyectos" on public.proyectos;
create policy "Authenticated users can delete proyectos"
  on public.proyectos for delete
  using (auth.uid() is not null);
