"use client";

import { ConsultationMode, PanditDocumentType, RateType } from "@prisma/client";
import { AdminField, AdminForm, adminInputClass } from "@/components/admin/admin-form";
import { SmoothInput } from "@/components/ui/smooth-input";
import {
  DOCUMENT_TYPE_LABEL,
  EXPERTISE_OPTIONS,
  LANGUAGE_OPTIONS,
  MODE_LABEL,
  RATE_TYPE_LABEL,
  WEEKDAY_LABELS,
  formatMinutes,
} from "@/lib/pandit/catalog";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * Pandit-facing forms.
 *
 * Built on the same `AdminForm` wrapper the operations area uses, so the
 * pending state, the live region and the restore-after-rejection behaviour are
 * one implementation rather than three. What differs is only the fields.
 */
type Action = (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;

function CheckboxGroup({
  name,
  options,
  selected,
  legend,
}: {
  name: string;
  options: readonly string[];
  selected: readonly string[];
  legend: string;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="body-sm font-semibold text-slate-800">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 has-checked:border-blue-600 has-checked:bg-blue-50 has-checked:text-blue-700"
            key={option}
          >
            <input
              className="size-3.5 accent-blue-600"
              defaultChecked={selected.includes(option)}
              name={name}
              type="checkbox"
              value={option}
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function BasicDetailsForm({
  action,
  defaults,
}: {
  action: Action;
  defaults: {
    displayName: string;
    phone: string;
    city: string;
    state: string;
    yearsOfExperience: string;
    expertise: readonly string[];
    languages: readonly string[];
  };
}) {
  return (
    <AdminForm action={action} pendingLabel="Saving..." submitLabel="Save details">
      {(state) => (
        <>
          <AdminField error={state.fieldErrors.displayName?.[0]} label="Full name" name="displayName">
            <SmoothInput
              className={adminInputClass}
              defaultValue={defaults.displayName}
              id="displayName"
              name="displayName"
              required
            />
          </AdminField>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField error={state.fieldErrors.phone?.[0]} label="Phone" name="phone">
              <SmoothInput
                className={adminInputClass}
                defaultValue={defaults.phone}
                id="phone"
                name="phone"
                required
                type="tel"
              />
            </AdminField>

            <AdminField
              error={state.fieldErrors.yearsOfExperience?.[0]}
              label="Years of experience"
              name="yearsOfExperience"
            >
              <SmoothInput
                className={adminInputClass}
                defaultValue={defaults.yearsOfExperience}
                id="yearsOfExperience"
                max={90}
                min={0}
                name="yearsOfExperience"
                required
                type="number"
              />
            </AdminField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField error={state.fieldErrors.city?.[0]} label="City" name="city">
              <SmoothInput className={adminInputClass} defaultValue={defaults.city} id="city" name="city" required />
            </AdminField>

            <AdminField error={state.fieldErrors.state?.[0]} label="State" name="state">
              <SmoothInput className={adminInputClass} defaultValue={defaults.state} id="state" name="state" required />
            </AdminField>
          </div>

          <CheckboxGroup
            legend="Specialisations"
            name="expertise"
            options={EXPERTISE_OPTIONS}
            selected={defaults.expertise}
          />
          <CheckboxGroup
            legend="Languages"
            name="languages"
            options={LANGUAGE_OPTIONS}
            selected={defaults.languages}
          />
        </>
      )}
    </AdminForm>
  );
}

export function DocumentUploadForm({ action }: { action: Action }) {
  return (
    <AdminForm action={action} pendingLabel="Uploading..." submitLabel="Upload document">
      <AdminField
        hint="JPEG, PNG, WebP or PDF, up to 8 MB. Stored privately and only visible to you and a reviewer."
        label="Document type"
        name="type"
      >
        <select className={adminInputClass} defaultValue={PanditDocumentType.IDENTITY} id="type" name="type">
          {Object.values(PanditDocumentType).map((type) => (
            <option key={type} value={type}>
              {DOCUMENT_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
      </AdminField>

      <AdminField label="File" name="file">
        <input
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className={adminInputClass}
          id="file"
          name="file"
          required
          type="file"
        />
      </AdminField>

      <AdminField label="Note for the reviewer (optional)" name="note">
        <SmoothInput className={adminInputClass} id="note" name="note" />
      </AdminField>
    </AdminForm>
  );
}

export function SimpleActionForm({
  action,
  label,
  pendingLabel,
  hidden = {},
  variant = "primary",
  confirm,
}: {
  action: Action;
  label: string;
  pendingLabel?: string;
  hidden?: Record<string, string>;
  variant?: "primary" | "secondary" | "danger";
  confirm?: string;
}) {
  return (
    <AdminForm action={action} confirm={confirm} pendingLabel={pendingLabel} submitLabel={label} variant={variant}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
    </AdminForm>
  );
}

export function ProfessionalProfileForm({
  action,
  defaults,
}: {
  action: Action;
  defaults: {
    displayName: string;
    headline: string;
    bio: string;
    profileImageUrl: string;
    city: string;
    state: string;
    yearsOfExperience: string;
    expertise: readonly string[];
    languages: readonly string[];
    certifications: readonly string[];
  };
}) {
  return (
    <AdminForm action={action} pendingLabel="Saving..." submitLabel="Save profile">
      {(state) => (
        <>
          <AdminField error={state.fieldErrors.displayName?.[0]} label="Display name" name="displayName">
            <SmoothInput
              className={adminInputClass}
              defaultValue={defaults.displayName}
              id="displayName"
              name="displayName"
              required
            />
          </AdminField>

          <AdminField
            error={state.fieldErrors.headline?.[0]}
            hint="One line shown under your name."
            label="Headline"
            name="headline"
          >
            <SmoothInput
              className={adminInputClass}
              defaultValue={defaults.headline}
              id="headline"
              maxLength={140}
              name="headline"
            />
          </AdminField>

          <AdminField
            error={state.fieldErrors.bio?.[0]}
            hint="At least 80 characters. This is what a customer reads before booking you."
            label="Professional bio"
            name="bio"
          >
            <textarea
              className={adminInputClass}
              defaultValue={defaults.bio}
              id="bio"
              name="bio"
              required
              rows={6}
            />
          </AdminField>

          <AdminField
            error={state.fieldErrors.profileImageUrl?.[0]}
            hint="An https:// link to your photograph."
            label="Profile photo URL"
            name="profileImageUrl"
          >
            <SmoothInput
              className={adminInputClass}
              defaultValue={defaults.profileImageUrl}
              id="profileImageUrl"
              name="profileImageUrl"
              type="url"
            />
          </AdminField>

          <div className="grid gap-4 sm:grid-cols-3">
            <AdminField label="City" name="city">
              <SmoothInput className={adminInputClass} defaultValue={defaults.city} id="city" name="city" required />
            </AdminField>
            <AdminField label="State" name="state">
              <SmoothInput className={adminInputClass} defaultValue={defaults.state} id="state" name="state" required />
            </AdminField>
            <AdminField label="Years of experience" name="yearsOfExperience">
              <SmoothInput
                className={adminInputClass}
                defaultValue={defaults.yearsOfExperience}
                id="yearsOfExperience"
                max={90}
                min={0}
                name="yearsOfExperience"
                required
                type="number"
              />
            </AdminField>
          </div>

          <CheckboxGroup
            legend="Specialisations"
            name="expertise"
            options={EXPERTISE_OPTIONS}
            selected={defaults.expertise}
          />
          <CheckboxGroup
            legend="Languages"
            name="languages"
            options={LANGUAGE_OPTIONS}
            selected={defaults.languages}
          />

          <AdminField
            hint="One per line. Shown on your public profile."
            label="Certifications"
            name="certifications"
          >
            <textarea
              className={adminInputClass}
              defaultValue={defaults.certifications.join("\n")}
              id="certifications"
              name="certificationsText"
              rows={3}
            />
            {/* Split client-side into repeated fields so the server receives a
                list rather than having to re-parse a textarea. */}
            <CertificationsMirror />
          </AdminField>
        </>
      )}
    </AdminForm>
  );
}

/**
 * Mirrors the certifications textarea into repeated hidden inputs on submit.
 *
 * Keeps the server contract a list of strings - the same shape the schema
 * validates - instead of a blob the action would have to split, which is one
 * more place for the two sides to disagree about what a separator is.
 */
function CertificationsMirror() {
  return (
    <span
      hidden
      ref={(node) => {
        if (!node) return;
        const form = node.closest("form");
        if (!form) return;

        const sync = () => {
          const source = form.elements.namedItem("certificationsText");
          if (!(source instanceof HTMLTextAreaElement)) return;

          node.replaceChildren();
          for (const line of source.value.split("\n").map((value) => value.trim()).filter(Boolean)) {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = "certifications";
            input.value = line;
            node.append(input);
          }
        };

        sync();
        form.addEventListener("submit", sync);
      }}
    />
  );
}

export function ServiceRateForm({
  action,
  mode,
  defaults,
  bounds,
}: {
  action: Action;
  mode: ConsultationMode;
  defaults: { enabled: boolean; rateType: RateType; rateRupees: string; sessionMinutes: string };
  bounds: { minRupees: string; maxRupees: string };
}) {
  return (
    <AdminForm action={action} pendingLabel="Saving..." submitLabel={`Save ${MODE_LABEL[mode].toLowerCase()}`}>
      <input name="mode" type="hidden" value={mode} />

      <label className="inline-flex cursor-pointer items-center gap-2 body-sm font-medium text-slate-800">
        <input className="size-4 accent-blue-600" defaultChecked={defaults.enabled} name="enabled" type="checkbox" />
        Offer {MODE_LABEL[mode].toLowerCase()} consultations
      </label>

      <AdminField label="Rate type" name={`rateType-${mode}`}>
        <select className={adminInputClass} defaultValue={defaults.rateType} id={`rateType-${mode}`} name="rateType">
          {Object.values(RateType).map((type) => (
            <option key={type} value={type}>
              {RATE_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
      </AdminField>

      <AdminField
        hint={`Platform range: ₹${bounds.minRupees} to ₹${bounds.maxRupees}.`}
        label="Rate (₹)"
        name={`rate-${mode}`}
      >
        <SmoothInput
          className={adminInputClass}
          defaultValue={defaults.rateRupees}
          id={`rate-${mode}`}
          min={0}
          name="rate"
          step="0.01"
          type="number"
        />
      </AdminField>

      <AdminField
        hint="Only used for a fixed-session rate."
        label="Session length (minutes)"
        name={`sessionMinutes-${mode}`}
      >
        <SmoothInput
          className={adminInputClass}
          defaultValue={defaults.sessionMinutes}
          id={`sessionMinutes-${mode}`}
          max={240}
          min={5}
          name="sessionMinutes"
          type="number"
        />
      </AdminField>
    </AdminForm>
  );
}

export function ScheduleRuleForm({ action }: { action: Action }) {
  return (
    <AdminForm action={action} pendingLabel="Adding..." submitLabel="Add window">
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-3">
          <AdminField label="Day" name="weekday">
            <select className={adminInputClass} defaultValue="1" id="weekday" name="weekday">
              {WEEKDAY_LABELS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField error={state.fieldErrors.startMinute?.[0]} label="From" name="start">
            <SmoothInput
              className={adminInputClass}
              defaultValue="09:00"
              id="start"
              name="start"
              step={900}
              type="time"
            />
          </AdminField>

          <AdminField error={state.fieldErrors.endMinute?.[0]} label="To" name="end">
            <SmoothInput
              className={adminInputClass}
              defaultValue="12:00"
              id="end"
              name="end"
              step={900}
              type="time"
            />
          </AdminField>
        </div>
      )}
    </AdminForm>
  );
}

export function ScheduleExceptionForm({ action }: { action: Action }) {
  return (
    <AdminForm action={action} pendingLabel="Saving..." submitLabel="Save date">
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="Date" name="date">
          <SmoothInput className={adminInputClass} id="date" name="date" required type="date" />
        </AdminField>

        <AdminField label="Note (optional)" name="note">
          <SmoothInput className={adminInputClass} id="note" name="note" />
        </AdminField>
      </div>

      <label className="inline-flex cursor-pointer items-center gap-2 body-sm font-medium text-slate-800">
        <input className="size-4 accent-blue-600" name="available" type="checkbox" />
        This adds extra availability (leave unticked to block the day)
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="From" name="start">
          <SmoothInput className={adminInputClass} id="start" name="start" step={900} type="time" />
        </AdminField>
        <AdminField label="To" name="end">
          <SmoothInput className={adminInputClass} id="end" name="end" step={900} type="time" />
        </AdminField>
      </div>
    </AdminForm>
  );
}

export function PayoutAccountForm({
  action,
  holderName,
}: {
  action: Action;
  holderName: string;
}) {
  return (
    <AdminForm action={action} pendingLabel="Saving..." submitLabel="Save payout details">
      {(state) => (
        <>
          <p className="rounded-md border border-slate-200 bg-slate-50 p-3 caption text-slate-600">
            These are encrypted before they are stored. Once saved, only a masked form is shown - there is no
            path in this application that displays them again, to you or to an operator.
          </p>

          <AdminField
            error={state.fieldErrors.accountHolderName?.[0]}
            label="Account holder name"
            name="accountHolderName"
          >
            <SmoothInput
              className={adminInputClass}
              defaultValue={holderName}
              id="accountHolderName"
              name="accountHolderName"
              required
            />
          </AdminField>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField error={state.fieldErrors.accountNumber?.[0]} label="Account number" name="accountNumber">
              <SmoothInput
                autoComplete="off"
                className={adminInputClass}
                id="accountNumber"
                inputMode="numeric"
                name="accountNumber"
              />
            </AdminField>

            <AdminField error={state.fieldErrors.ifsc?.[0]} label="IFSC" name="ifsc">
              <SmoothInput autoComplete="off" className={adminInputClass} id="ifsc" name="ifsc" />
            </AdminField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Bank name" name="bankName">
              <SmoothInput className={adminInputClass} id="bankName" name="bankName" />
            </AdminField>

            <AdminField
              error={state.fieldErrors.upiId?.[0]}
              hint="Either a bank account with its IFSC, or a UPI id."
              label="UPI id"
              name="upiId"
            >
              <SmoothInput autoComplete="off" className={adminInputClass} id="upiId" name="upiId" />
            </AdminField>
          </div>

          <AdminField error={state.fieldErrors.taxId?.[0]} label="PAN (optional)" name="taxId">
            <SmoothInput autoComplete="off" className={adminInputClass} id="taxId" name="taxId" />
          </AdminField>
        </>
      )}
    </AdminForm>
  );
}

export function TicketForm({ action, categories }: { action: Action; categories: readonly string[] }) {
  return (
    <AdminForm action={action} pendingLabel="Raising..." submitLabel="Raise ticket">
      {(state) => (
        <>
          <AdminField label="Category" name="category">
            <select className={adminInputClass} defaultValue="TECHNICAL" id="category" name="category">
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0) + category.slice(1).toLowerCase().replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField error={state.fieldErrors.subject?.[0]} label="Subject" name="subject">
            <SmoothInput className={adminInputClass} id="subject" name="subject" required />
          </AdminField>

          <AdminField error={state.fieldErrors.description?.[0]} label="What is happening?" name="description">
            <textarea className={adminInputClass} id="description" name="description" required rows={5} />
          </AdminField>
        </>
      )}
    </AdminForm>
  );
}

export function ReplyForm({
  action,
  ticketId,
  allowInternal = false,
}: {
  action: Action;
  ticketId: string;
  allowInternal?: boolean;
}) {
  return (
    <AdminForm action={action} pendingLabel="Sending..." submitLabel="Send reply">
      <input name="ticketId" type="hidden" value={ticketId} />

      <AdminField label="Reply" name="body">
        <textarea className={adminInputClass} id="body" name="body" required rows={4} />
      </AdminField>

      {allowInternal ? (
        <label className="inline-flex cursor-pointer items-center gap-2 body-sm font-medium text-slate-800">
          <input className="size-4 accent-blue-600" name="internal" type="checkbox" />
          Internal note (the reporter never sees this)
        </label>
      ) : null}
    </AdminForm>
  );
}

/** Renders a stored minute range for display. */
export function formatWindow(startMinute: number, endMinute: number): string {
  return `${formatMinutes(startMinute)} – ${formatMinutes(endMinute)}`;
}
