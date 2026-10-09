import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { ProcessEventType } from "@shared/processo";
import { supabase } from "./supabase";

/**
 * Documents and the process timeline. Files live in a private Storage bucket; they only leave
 * through short-lived signed links the server creates after checking who is asking.
 */

const BUCKET = "documentos";
const MIGRATION_HINT = "Rode o arquivo supabase/migrations/20261009_documentos_e_historico.sql no SQL Editor do Supabase.";

export type DocumentRow = { id: number; nome: string; descricao: string | null; tamanho: number; tipo: string | null; enviado_por: string | null; created_at: string };
export type EventRow = { id: number; tipo: ProcessEventType; titulo: string; descricao: string | null; autor: string | null; created_at: string };

/** True when the error means the tables of the migration above do not exist yet. */
const isMissingTable = (error: { code?: string; message?: string }) =>
  error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");

export async function listDocuments(clientId: number): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documentos")
    .select("id, nome, descricao, tamanho, tipo, enviado_por, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[documentos] Could not list:", error.message);
    return [];
  }
  return (data ?? []) as DocumentRow[];
}

export async function listEvents(clientId: number): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from("cliente_eventos")
    .select("id, tipo, titulo, descricao, autor, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) {
    console.warn("[cliente_eventos] Could not list:", error.message);
    return [];
  }
  return (data ?? []) as EventRow[];
}

/** Adds a line to the timeline. A failure here never undoes the change that caused it. */
export async function addEvent(clientId: number, event: { tipo: ProcessEventType; titulo: string; descricao?: string; autor?: string }) {
  const { error } = await supabase.from("cliente_eventos").insert({ client_id: clientId, ...event });
  if (error) console.warn("[cliente_eventos] Could not add:", error.message);
}

/** Keeps letters, numbers, dots and dashes, so the Storage path is always valid. */
function safeFileName(name: string) {
  const cleaned = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned.slice(-120) || "arquivo";
}

export async function uploadDocument(clientId: number, file: { nome: string; tipo?: string; descricao?: string; bytes: Buffer }, author: string) {
  const path = `cliente-${clientId}/${randomUUID()}-${safeFileName(file.nome)}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file.bytes, {
    contentType: file.tipo || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) {
    console.error("[documentos] Upload failed:", uploadError.message);
    const missingBucket = /bucket not found/i.test(uploadError.message);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: missingBucket ? `A pasta de documentos ainda não existe. ${MIGRATION_HINT}` : "Não foi possível guardar o arquivo. Tente novamente.",
    });
  }

  const { data, error } = await supabase
    .from("documentos")
    .insert({ client_id: clientId, nome: file.nome, descricao: file.descricao || null, tamanho: file.bytes.length, tipo: file.tipo || null, caminho: path, enviado_por: author })
    .select("id, nome, descricao, tamanho, tipo, enviado_por, created_at")
    .single();
  if (error) {
    // The record failed, so the file would be orphaned: take it back out.
    await supabase.storage.from(BUCKET).remove([path]);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: isMissingTable(error) ? `A tabela de documentos ainda não existe. ${MIGRATION_HINT}` : error.message });
  }

  await addEvent(clientId, { tipo: "documento", titulo: "Novo documento", descricao: file.nome, autor: author });
  return data as DocumentRow;
}

/** A link that downloads the file and stops working after a minute. Null when the document is not this client's. */
export async function documentDownloadUrl(documentId: number, clientId?: number): Promise<string | null> {
  let query = supabase.from("documentos").select("nome, caminho, client_id").eq("id", documentId);
  if (clientId !== undefined) query = query.eq("client_id", clientId);
  const { data } = await query.maybeSingle();
  if (!data) return null;
  const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(data.caminho as string, 60, { download: data.nome as string });
  if (error || !signed) {
    console.error("[documentos] Could not sign:", error?.message);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível abrir o arquivo agora." });
  }
  return signed.signedUrl;
}

export async function deleteDocument(documentId: number, author: string) {
  const { data } = await supabase.from("documentos").select("client_id, nome, caminho").eq("id", documentId).maybeSingle();
  if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Este documento já foi apagado." });
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([data.caminho as string]);
  if (storageError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível apagar o arquivo. Tente novamente." });
  const { error } = await supabase.from("documentos").delete().eq("id", documentId);
  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  await addEvent(data.client_id as number, { tipo: "documento", titulo: "Documento removido", descricao: data.nome as string, autor: author });
}

/** Removes every file of a client from Storage (the records go with the client row). */
export async function removeClientFiles(clientId: number) {
  const { data, error } = await supabase.from("documentos").select("caminho").eq("client_id", clientId);
  if (error) {
    if (!isMissingTable(error)) throw error;
    return;
  }
  const paths = (data ?? []).map((row) => row.caminho as string);
  if (paths.length === 0) return;
  const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
  if (removeError) throw removeError;
}
