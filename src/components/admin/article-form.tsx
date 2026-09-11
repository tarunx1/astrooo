"use client";

import { ArticleStatus } from "@prisma/client";
import { AdminField, AdminForm, adminInputClass } from "@/components/admin/admin-form";
import { SmoothInput } from "@/components/ui/smooth-input";
import { createArticleAction, setArticleStatusAction, updateArticleAction } from "@/app/admin/articles/actions";

/**
 * Article create and edit.
 *
 * Publishing is deliberately not a checkbox on this form. Writing a piece and
 * making it public are different decisions with different consequences, and
 * separating them means an autosave-style edit can never accidentally publish.
 */
export type ArticleFormValues = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  authorName: string;
  articleCategoryId: string;
  tags: string;
  seoTitle: string;
  seoDescription: string;
};

export function ArticleForm({
  initial,
  categories,
}: {
  initial?: ArticleFormValues;
  categories: ReadonlyArray<{ id: string; name: string }>;
}) {
  const isEdit = Boolean(initial?.id);

  return (
    <AdminForm
      action={isEdit ? updateArticleAction : createArticleAction}
      pendingLabel="Saving..."
      submitLabel={isEdit ? "Save article" : "Create draft"}
    >
      {(state) => (
        <div className="grid gap-4">
          {isEdit ? <input name="articleId" type="hidden" value={initial!.id} /> : null}

          <AdminField error={state.fieldErrors.title?.[0]} label="Title" name="title">
            <SmoothInput className={adminInputClass} defaultValue={initial?.title} id="title" name="title" required />
          </AdminField>

          <AdminField
            error={state.fieldErrors.slug?.[0]}
            hint="Lowercase words separated by hyphens. Used in the article URL."
            label="Slug"
            name="slug"
          >
            <SmoothInput className={adminInputClass} defaultValue={initial?.slug} id="slug" name="slug" required />
          </AdminField>

          <AdminField
            error={state.fieldErrors.excerpt?.[0]}
            hint="Shown on cards and in search results. Falls back to the opening of the article."
            label="Excerpt"
            name="excerpt"
          >
            <textarea className={adminInputClass} defaultValue={initial?.excerpt} id="excerpt" name="excerpt" rows={2} />
          </AdminField>

          <AdminField
            error={state.fieldErrors.content?.[0]}
            hint="Blank lines separate paragraphs. Use '## ' for a heading, '### ' for a sub-heading, '- ' for a bullet and '> ' for a quote. HTML is not rendered."
            label="Article"
            name="content"
          >
            <textarea
              className={adminInputClass}
              defaultValue={initial?.content}
              id="content"
              name="content"
              required
              rows={18}
            />
          </AdminField>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Category" name="articleCategoryId">
              <select
                className={adminInputClass}
                defaultValue={initial?.articleCategoryId ?? ""}
                id="articleCategoryId"
                name="articleCategoryId"
              >
                <option value="">Uncategorised</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </AdminField>

            <AdminField label="Author name" name="authorName">
              <SmoothInput
                className={adminInputClass}
                defaultValue={initial?.authorName}
                id="authorName"
                name="authorName"
              />
            </AdminField>
          </div>

          <AdminField
            error={state.fieldErrors.coverImageUrl?.[0]}
            hint="An https:// link to the cover image."
            label="Cover image URL"
            name="coverImageUrl"
          >
            <SmoothInput
              className={adminInputClass}
              defaultValue={initial?.coverImageUrl}
              id="coverImageUrl"
              name="coverImageUrl"
              type="url"
            />
          </AdminField>

          <AdminField hint="Comma separated." label="Tags" name="tags">
            <SmoothInput className={adminInputClass} defaultValue={initial?.tags} id="tags" name="tags" />
          </AdminField>

          <fieldset className="grid gap-4 border-t border-slate-200 pt-4">
            <legend className="body-sm font-semibold text-slate-800">Search appearance</legend>
            <p className="caption text-slate-500">
              Optional. Leave blank to use the headline and excerpt.
            </p>

            <AdminField label="SEO title" name="seoTitle">
              <SmoothInput
                className={adminInputClass}
                defaultValue={initial?.seoTitle}
                id="seoTitle"
                name="seoTitle"
              />
            </AdminField>

            <AdminField label="Meta description" name="seoDescription">
              <textarea
                className={adminInputClass}
                defaultValue={initial?.seoDescription}
                id="seoDescription"
                maxLength={300}
                name="seoDescription"
                rows={2}
              />
            </AdminField>
          </fieldset>
        </div>
      )}
    </AdminForm>
  );
}

export function ArticleStatusControls({
  articleId,
  status,
}: {
  articleId: string;
  status: ArticleStatus;
}) {
  const targets: ArticleStatus[] =
    status === ArticleStatus.PUBLISHED
      ? [ArticleStatus.DRAFT, ArticleStatus.ARCHIVED]
      : status === ArticleStatus.DRAFT
        ? [ArticleStatus.PUBLISHED, ArticleStatus.ARCHIVED]
        : [ArticleStatus.DRAFT, ArticleStatus.PUBLISHED];

  const label: Record<ArticleStatus, string> = {
    [ArticleStatus.DRAFT]: "Move to draft",
    [ArticleStatus.PUBLISHED]: "Publish",
    [ArticleStatus.ARCHIVED]: "Archive",
  };

  return (
    <div className="grid gap-2">
      {targets.map((target) => (
        <AdminForm
          action={setArticleStatusAction}
          confirm={
            target === ArticleStatus.PUBLISHED
              ? "Publish this article? It becomes public and indexable."
              : undefined
          }
          key={target}
          pendingLabel="Saving..."
          submitLabel={label[target]}
          variant={target === ArticleStatus.PUBLISHED ? "primary" : "secondary"}
        >
          <input name="articleId" type="hidden" value={articleId} />
          <input name="status" type="hidden" value={target} />
        </AdminForm>
      ))}
    </div>
  );
}
