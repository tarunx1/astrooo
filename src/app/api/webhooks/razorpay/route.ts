import { NextResponse } from "next/server";
import { PaymentSignatureError } from "@/lib/payments/errors";
import { processRazorpayWebhook } from "@/lib/payments/webhooks";

export async function POST(request: Request) {
  const signature = request.headers.get("x-razorpay-signature");
  const eventId = request.headers.get("x-razorpay-event-id");
  if (!signature) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const rawBody = await request.text();
    const result = await processRazorpayWebhook(rawBody, signature, eventId);
    if (!result.ok) return NextResponse.json({ ok: false }, { status: result.status });
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch (error) {
    if (error instanceof PaymentSignatureError) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
