"use client";

import { AdminField, AdminForm, adminInputClass } from "@/components/admin/admin-form";
import { createCouponAction, updateCouponAction } from "@/app/admin/actions";
import { SmoothInput } from "@/components/ui/smooth-input";

/**
 * Coupon create and edit.
 *
 * The code is fixed once created because orders snapshot it; changing it would
 * make historical order records misleading. Validation is the same server-side
 * engine the checkout uses — there is no second coupon implementation.
 */
export type CouponFormValues = {
  id?: string;
  code: string;
  description: string;
  percentOff: string;
  amountOffRupees: string;
  minOrderRupees: string;
  maxDiscountRupees: string;
  usageLimit: string;
  perUserLimit: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  timesRedeemed?: number;
};

export function CouponForm({ initial }: { initial?: CouponFormValues }) {
  const isEdit = Boolean(initial?.id);

  return (
    <AdminForm action={isEdit ? updateCouponAction : createCouponAction} submitLabel={isEdit ? "Save coupon" : "Create coupon"}>
      {(state) => (
        <div className="grid gap-4">
          {isEdit ? <input name="couponId" type="hidden" value={initial!.id} /> : null}

          <AdminField
            error={state.fieldErrors.code?.[0]}
            hint={isEdit ? "A code cannot change once orders may reference it." : "Capitals, digits and hyphens."}
            label="Code"
            name="code"
          >
            <SmoothInput
              className={`${adminInputClass} uppercase`}
              defaultValue={initial?.code}
              id="code"
              name="code"
              readOnly={isEdit}
              required
            />
          </AdminField>

          <AdminField label="Description" name="description">
            <SmoothInput className={adminInputClass} defaultValue={initial?.description} id="description" name="description" />
          </AdminField>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField
              error={state.fieldErrors.percentOff?.[0]}
              hint="Set this or a fixed amount, not both."
              label="Percentage off"
              name="percentOff"
            >
              <input className={adminInputClass} defaultValue={initial?.percentOff} id="percentOff" max={100} min={1} name="percentOff" type="number" />
            </AdminField>
            <AdminField error={state.fieldErrors.amountOffPaise?.[0]} hint="In rupees." label="Fixed amount off" name="amountOff">
              <input className={adminInputClass} defaultValue={initial?.amountOffRupees} id="amountOff" name="amountOff" step="0.01" type="number" />
            </AdminField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Minimum order" name="minOrder">
              <input className={adminInputClass} defaultValue={initial?.minOrderRupees} id="minOrder" name="minOrder" step="0.01" type="number" />
            </AdminField>
            <AdminField
              error={state.fieldErrors.maxDiscountPaise?.[0]}
              hint="Caps a percentage discount."
              label="Maximum discount"
              name="maxDiscount"
            >
              <input className={adminInputClass} defaultValue={initial?.maxDiscountRupees} id="maxDiscount" name="maxDiscount" step="0.01" type="number" />
            </AdminField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Total uses allowed" name="usageLimit">
              <input className={adminInputClass} defaultValue={initial?.usageLimit} id="usageLimit" min={1} name="usageLimit" type="number" />
            </AdminField>
            <AdminField label="Uses per customer" name="perUserLimit">
              <input className={adminInputClass} defaultValue={initial?.perUserLimit} id="perUserLimit" min={1} name="perUserLimit" type="number" />
            </AdminField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Starts" name="startsAt">
              <input className={adminInputClass} defaultValue={initial?.startsAt} id="startsAt" name="startsAt" type="date" />
            </AdminField>
            <AdminField error={state.fieldErrors.endsAt?.[0]} label="Ends" name="endsAt">
              <input className={adminInputClass} defaultValue={initial?.endsAt} id="endsAt" name="endsAt" type="date" />
            </AdminField>
          </div>

          <label className="flex items-center gap-2 body-sm text-foreground-secondary" htmlFor="active">
            <input className="size-4" defaultChecked={initial?.active ?? false} id="active" name="active" type="checkbox" />
            Active
          </label>

          {isEdit ? (
            <p className="caption text-foreground-muted">
              Redeemed {initial?.timesRedeemed ?? 0} times. Deactivating stops future use; past orders and their
              recorded discounts are unchanged.
            </p>
          ) : null}
        </div>
      )}
    </AdminForm>
  );
}
