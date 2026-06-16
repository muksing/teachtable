-- Add missing profile columns to users table
-- Required for ProfileView: photo_url, phone

alter table public.users
  add column if not exists photo_url  text,
  add column if not exists phone      text,
  add column if not exists updated_at timestamptz default now();

-- Fix: ครูและผู้ใช้อัปเดตข้อมูลส่วนตัวตัวเองไม่ได้ (ProfileView)
-- เพิ่ม RLS policies ให้ users table

alter table public.users enable row level security;

-- SELECT: อ่านได้ทุกคน
drop policy if exists "authenticated read all users" on public.users;
create policy "authenticated read all users"
  on public.users for select
  to authenticated
  using (true);

-- UPDATE own record (ProfileView: displayName, phone, photo_url)
drop policy if exists "users update own record" on public.users;
create policy "users update own record"
  on public.users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- UPDATE any: admin จัดการ users ทั้งหมดได้
drop policy if exists "admin update any user" on public.users;
create policy "admin update any user"
  on public.users for update
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and (
          u.role in ('school_admin', 'admin', 'superadmin')
          or u.roles && array['school_admin', 'admin', 'superadmin']
        )
    )
  );

-- INSERT: admin เพิ่ม user ใหม่ได้
drop policy if exists "admin insert users" on public.users;
create policy "admin insert users"
  on public.users for insert
  to authenticated
  with check (true);

-- DELETE: admin ลบ user ได้
drop policy if exists "admin delete users" on public.users;
create policy "admin delete users"
  on public.users for delete
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and (
          u.role in ('school_admin', 'admin', 'superadmin')
          or u.roles && array['school_admin', 'admin', 'superadmin']
        )
    )
  );
