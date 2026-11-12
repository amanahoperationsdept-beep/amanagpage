-- Private temporary storage for Facebook post media.
-- Only authenticated Amanah administrators can upload, read, and remove their files.
-- The Edge Function publishes the files to the configured Facebook Page and removes
-- the temporary objects after the publish attempt.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'facebook-post-media',
  'facebook-post-media',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Amanah admins upload Facebook post media" on storage.objects;
create policy "Amanah admins upload Facebook post media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'facebook-post-media'
  and public.is_amanah_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Amanah admins read Facebook post media" on storage.objects;
create policy "Amanah admins read Facebook post media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'facebook-post-media'
  and public.is_amanah_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Amanah admins delete Facebook post media" on storage.objects;
create policy "Amanah admins delete Facebook post media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'facebook-post-media'
  and public.is_amanah_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);
