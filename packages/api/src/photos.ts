import { MAX_PHOTO_BYTES, MAX_PHOTOS, type PHOTO_MIME_TYPES } from '@repair/core';
import type { Db } from './client';
import { PhotoInvalidError, PhotoLimitError, throwDbError } from './errors';

const EXTENSIONS: Readonly<Record<(typeof PHOTO_MIME_TYPES)[number], string>> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function attachPhoto(
  db: Db,
  ticketId: string,
  file: { data: Blob | ArrayBuffer; mime: string; size: number; name: string },
): Promise<{ id: number }> {
  const ext = Object.hasOwn(EXTENSIONS, file.mime) ? EXTENSIONS[file.mime as keyof typeof EXTENSIONS] : undefined;
  if (!ext) throw new PhotoInvalidError('mime');
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoInvalidError('size');

  const { count, error: countError } = await db
    .from('ticket_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('ticket_id', ticketId);
  if (countError) throwDbError(countError);
  if ((count ?? 0) >= MAX_PHOTOS) throw new PhotoLimitError('photo_limit');

  const photos = db.storage.from('ticket-photos');
  const path = `${ticketId}/${crypto.randomUUID()}.${ext}`;
  const upload = await photos.upload(path, file.data, { contentType: file.mime });
  if (upload.error) throwDbError(upload.error);

  const { data, error } = await db
    .from('ticket_attachments')
    .insert({ ticket_id: ticketId, file_name: file.name, storage_path: path })
    .select('id')
    .single();
  if (error) {
    await photos.remove([path]);
    throwDbError(error);
  }
  return data;
}
