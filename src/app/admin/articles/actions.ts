"use server";

import { revalidatePath } from "next/cache";
import { ArticleStatus, AuditAction } from "@prisma/client";
import { z } from "zod";
import { authorizeAction } from "@/lib/auth/access";
import { recordAudit } from "@/lib/admin/audit";
import { prisma } from "@/lib/db/prisma";
import {
  articleInputSchema,
  createArticle,
  setArticleStatus,
  updateArticle,
} from "@/lib/content/articles";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * Editorial actions.
 *
 * Gated on `reports.manage`, which is the closest existing content-management
 * capability and is already delegable to an employee. Publishing is separated
 * from editing so that writing a draft and making it public are distinct acts,
 * each audited.
 */
const idSchema = z.string().trim().min(1).max(64);

function denied(reason?: string): AdminActionState {
  return { ok: false, error: reason ?? "You are not authorised to perform this action.", fieldErrors: {} };
}

function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value === "string") values[name] = value;
  }
  return values;
}

function failure(
  error: string,
  fieldErrors: Record<string, string[]> = {},
  formData?: FormData,
): AdminActionState {
  return { ok: false, error, fieldErrors, values: formData ? submittedValues(formData) : undefined };
}

function success(message: string): AdminActionState {
  return { ok: true, error: null, message, fieldErrors: {} };
}

function optionalText(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readForm(formData: FormData) {
  return articleInputSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    excerpt: optionalText(formData.get("excerpt")),
    content: formData.get("content"),
    coverImageUrl: optionalText(formData.get("coverImageUrl")),
    authorName: optionalText(formData.get("authorName")),
    articleCategoryId: optionalText(formData.get("articleCategoryId")),
    tags: String(formData.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    seoTitle: optionalText(formData.get("seoTitle")),
    seoDescription: optionalText(formData.get("seoDescription")),
  });
}

function revalidateArticle(slug?: string): void {
  revalidatePath("/admin/articles");
  revalidatePath("/articles");
  if (slug) revalidatePath(`/articles/${slug}`);
}

export async function createArticleAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAction("reports.manage");
  if (!auth.ok) return denied(auth.error);

  const parsed = readForm(formData);
  if (!parsed.success) {
    return failure("Check the highlighted fields.", z.flattenError(parsed.error).fieldErrors, formData);
  }

  const result = await createArticle(parsed.data);
  if (!result.ok) return failure(result.message, result.fieldErrors, formData);

  await recordAudit(prisma, {
    actorUserId: auth.viewer.id,
    action: AuditAction.ARTICLE_CREATED,
    entityType: "Article",
    entityId: result.articleId,
    metadata: { slug: parsed.data.slug, title: parsed.data.title },
  });

  revalidateArticle(parsed.data.slug);
  return success("Article created as a draft. Publish it when it is ready.");
}

export async function updateArticleAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAction("reports.manage");
  if (!auth.ok) return denied(auth.error);

  const articleId = idSchema.safeParse(formData.get("articleId"));
  if (!articleId.success) return failure("That article could not be found.");

  const parsed = readForm(formData);
  if (!parsed.success) {
    return failure("Check the highlighted fields.", z.flattenError(parsed.error).fieldErrors, formData);
  }

  const result = await updateArticle(articleId.data, parsed.data);
  if (!result.ok) return failure(result.message, result.fieldErrors, formData);

  await recordAudit(prisma, {
    actorUserId: auth.viewer.id,
    action: AuditAction.ARTICLE_UPDATED,
    entityType: "Article",
    entityId: articleId.data,
    metadata: { slug: parsed.data.slug },
  });

  revalidateArticle(parsed.data.slug);
  return success("Saved.");
}

export async function setArticleStatusAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAction("reports.manage");
  if (!auth.ok) return denied(auth.error);

  const parsed = z
    .object({ articleId: idSchema, status: z.nativeEnum(ArticleStatus) })
    .safeParse({ articleId: formData.get("articleId"), status: formData.get("status") });

  if (!parsed.success) return failure("That status is not recognised.");

  const result = await setArticleStatus(parsed.data);
  if (!result.ok) return failure(result.message);

  const article = await prisma.article.findUnique({
    where: { id: parsed.data.articleId },
    select: { slug: true },
  });

  await recordAudit(prisma, {
    actorUserId: auth.viewer.id,
    action:
      parsed.data.status === ArticleStatus.PUBLISHED
        ? AuditAction.ARTICLE_PUBLISHED
        : AuditAction.ARTICLE_UNPUBLISHED,
    entityType: "Article",
    entityId: parsed.data.articleId,
    metadata: { slug: article?.slug, status: parsed.data.status },
  });

  revalidateArticle(article?.slug);

  return success(
    parsed.data.status === ArticleStatus.PUBLISHED
      ? "Published. It is now live and indexable."
      : parsed.data.status === ArticleStatus.ARCHIVED
        ? "Archived. It is no longer public but is not deleted."
        : "Moved back to draft.",
  );
}
