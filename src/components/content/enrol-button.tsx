"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enrolAction } from "@/app/courses/actions";

/**
 * Enrolment control.
 *
 * A paid course says so rather than offering a button that would be refused.
 * Paid enrolment is not open yet, and the button is honest about that instead
 * of pretending to start a checkout that does not exist.
 */
export function EnrolButton({
  courseId,
  isFree,
  enrolled,
}: {
  courseId: string;
  isFree: boolean;
  enrolled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (enrolled) {
    return (
      <div className="grid gap-3">
        <p className="inline-flex items-center gap-2 rounded-md border border-success/40 bg-background p-3 body-sm text-success">
          <GraduationCap aria-hidden="true" size={16} />
          You are enrolled in this course.
        </p>
        <Button href="/account/courses" variant="secondary">
          Go to my courses
        </Button>
      </div>
    );
  }

  if (!isFree) {
    return (
      <div className="rounded-md border border-border bg-surface-raised p-4">
        <p className="body-sm text-foreground-secondary">
          Paid enrolment is not open yet. This course will become available to buy once course delivery
          is live.
        </p>
      </div>
    );
  }

  function enrol() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await enrolAction(courseId);

      if (!result.ok) {
        if (result.needsAuth) {
          router.push(`/sign-in?returnTo=${encodeURIComponent("/account/courses")}`);
          return;
        }
        setError(result.message);
        return;
      }

      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      <Button disabled={pending} onClick={enrol} type="button">
        {pending ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" size={16} />
            Enrolling
          </>
        ) : (
          <>
            <GraduationCap aria-hidden="true" size={16} />
            Enrol for free
          </>
        )}
      </Button>

      <div aria-live="polite">
        {error ? (
          <p className="rounded-md border border-danger/50 bg-background p-3 body-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-md border border-success/50 bg-background p-3 body-sm text-success" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
