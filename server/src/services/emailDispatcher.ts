import {
  env,
} from "../config/env.js";

import {
  renderFoundingEmail,
} from "../email/templates.js";

import {
  claimPendingEmails,
  markEmailDeliveryFailure,
  markEmailSent,
} from "./emailOutboxService.js";

export type MailTransport = {
  send(
    input: {
      to: string;
      subject: string;
      text: string;
    },
  ): Promise<void>;
};

function maskEmail(
  value: string,
) {
  const [
    local,
    domain,
  ] =
    value.split("@");

  if (
    !local ||
    !domain
  ) {
    return "[masked]";
  }

  return `${
    local.slice(
      0,
      1,
    )
  }***@${domain}`;
}

/*
 * Development-only transport.
 *
 * It deliberately avoids printing the full
 * email body or complete recipient address.
 */
export const logMailTransport:
  MailTransport =
{
  async send(input) {
    console.log(
      "EMAIL_TRANSPORT=LOG_ONLY",
    );

    console.log(
      `TO=${maskEmail(input.to)}`,
    );

    console.log(
      `SUBJECT=${input.subject}`,
    );

    console.log(
      "BODY=[REDACTED]",
    );
  },
};

export async function dispatchEmailOutbox(
  input?: {
    limit?: number;
    transport?: MailTransport;
  },
) {
  /*
   * Production must fail closed until a real
   * mail provider is configured explicitly.
   */
  if (
    !input?.transport &&
    env.NODE_ENV ===
      "production"
  ) {
    throw new Error(
      "EMAIL_TRANSPORT_NOT_CONFIGURED_FOR_PRODUCTION",
    );
  }

  const transport =
    input?.transport ??
    logMailTransport;

  const emails =
    claimPendingEmails(
      input?.limit ?? 25,
    );

  const results:
    Array<{
      publicId: string;
      status:
        | "SENT"
        | "PENDING"
        | "FAILED";
    }> =
    [];

  for (
    const email of emails
  ) {
    try {
      const payload =
        JSON.parse(
          email.payloadJson,
        ) as Record<
          string,
          unknown
        >;

      const rendered =
        renderFoundingEmail(
          email.template,
          payload,
        );

      await transport.send({
        to:
          email.recipientEmail,

        subject:
          rendered.subject,

        text:
          rendered.text,
      });

      markEmailSent({
        id:
          email.id,
      });

      results.push({
        publicId:
          email.publicId,

        status:
          "SENT",
      });
    } catch (error) {
      const failure =
        markEmailDeliveryFailure({
          id:
            email.id,

          error,
        });

      results.push({
        publicId:
          email.publicId,

        status:
          failure.status,
      });
    }
  }

  return results;
}
