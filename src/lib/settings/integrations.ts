import "server-only";

import { describeSecret } from "@/lib/settings/service";
import { SECRETS, type SecretKey } from "@/lib/settings/registry";

/**
 * The integration catalogue.
 *
 * Groups the declared credentials into the providers an operator thinks in
 * terms of, so the API keys screen reads as "WhatsApp" rather than as a flat
 * list of keys. The catalogue is code, like the registry it points at: a row
 * here that named a credential the registry does not declare would be a row
 * nothing could ever store.
 *
 * Every credential is write-only. There is no reveal, no copy and no export -
 * the only readable facts are whether one is configured and where it came from.
 */
export type IntegrationCategory =
  | "payments"
  | "astrology"
  | "ai"
  | "messaging"
  | "calls"
  | "storage"
  | "analytics"
  | "maps";

export type IntegrationDefinition = {
  id: string;
  label: string;
  category: IntegrationCategory;
  description: string;
  secrets: readonly SecretKey[];
  /** Set when the capability is compiled in and has nothing to configure. */
  builtIn?: boolean;
  /** Set when no provider is implemented yet, so a key alone would do nothing. */
  notImplemented?: boolean;
};

export const INTEGRATIONS: readonly IntegrationDefinition[] = [
  {
    id: "razorpay",
    label: "Razorpay",
    category: "payments",
    description: "Payment acceptance for report and shop orders. Test mode only in this phase.",
    secrets: ["payments.razorpayKeySecret", "payments.razorpayWebhookSecret"],
  },
  {
    id: "astrology",
    label: "Astrology engine",
    category: "astrology",
    description:
      "Charts are calculated in this application from VSOP87D and ELP 2000-82B. There is no key, no endpoint and no quota.",
    secrets: [],
    builtIn: true,
  },
  {
    id: "ai",
    label: "AI provider",
    category: "ai",
    description: "Generates report prose from an immutable calculation. Never determines a chart value.",
    secrets: ["ai.apiKey"],
  },
  {
    id: "email",
    label: "Transactional email",
    category: "messaging",
    description: "Order, report and onboarding notifications.",
    secrets: ["email.apiKey"],
    notImplemented: true,
  },
  {
    id: "sms",
    label: "SMS",
    category: "messaging",
    description: "Booking reminders and one-time codes.",
    secrets: ["sms.apiKey"],
    notImplemented: true,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    category: "messaging",
    description: "Consultation reminders over WhatsApp Business.",
    secrets: ["whatsapp.apiKey"],
    notImplemented: true,
  },
  {
    id: "calls",
    label: "Voice and video calling",
    category: "calls",
    description:
      "Session tokens for consultation calls. Tokens are minted server-side; a Pandit or customer never receives the app secret.",
    secrets: ["calls.appId", "calls.appSecret"],
    notImplemented: true,
  },
  {
    id: "payouts",
    label: "Payout provider",
    category: "payments",
    description:
      "Automated transfers to practitioners. The ledger, states and audit trail work without it; only the transfer rail is missing.",
    secrets: ["payouts.providerKeyId", "payouts.providerKeySecret", "payouts.providerWebhookSecret"],
    notImplemented: true,
  },
  {
    id: "storage",
    label: "Object storage",
    category: "storage",
    description: "Private storage for report PDFs and Pandit verification documents.",
    secrets: ["storage.accessKeyId", "storage.secretAccessKey"],
  },
  {
    id: "analytics",
    label: "Analytics provider",
    category: "analytics",
    description: "Third-party product analytics. Platform metrics are computed in-app and need no key.",
    secrets: ["analytics.apiKey"],
    notImplemented: true,
  },
  {
    id: "push",
    label: "Push notifications",
    category: "messaging",
    description: "Browser and device notifications.",
    secrets: ["push.apiKey"],
    notImplemented: true,
  },
  {
    id: "maps",
    label: "Maps and geocoding",
    category: "maps",
    description:
      "Place lookup for birth details. The bundled location provider covers this; a key only adds coverage.",
    secrets: ["maps.apiKey"],
    notImplemented: true,
  },
] as const;

export type IntegrationStatusRow = {
  definition: IntegrationDefinition;
  secrets: Array<{
    key: SecretKey;
    label: string;
    configured: boolean;
    source: "admin" | "environment" | "none";
    updatedAt: Date | null;
  }>;
  configured: boolean;
};

/**
 * Resolves configuration status for every integration.
 *
 * "Configured" means every credential the integration needs is present, from
 * somewhere. A half-configured provider reads as unconfigured, because a key id
 * from the admin paired with a secret left in the environment is a pair that
 * never existed together.
 */
export async function describeIntegrations(
  env: NodeJS.ProcessEnv = process.env,
): Promise<IntegrationStatusRow[]> {
  return Promise.all(
    INTEGRATIONS.map(async (definition) => {
      const secrets = await Promise.all(
        definition.secrets.map(async (key) => {
          const described = await describeSecret(key, env);
          return {
            key,
            label: SECRETS[key].label,
            configured: described.configured,
            source: described.source,
            updatedAt: described.updatedAt,
          };
        }),
      );

      return {
        definition,
        secrets,
        configured:
          definition.builtIn === true ||
          (secrets.length > 0 && secrets.every((secret) => secret.configured)),
      };
    }),
  );
}
