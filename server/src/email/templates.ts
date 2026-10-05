export type EmailTemplate =
  | "REGISTRATION_RECEIVED"
  | "PAYMENT_VERIFIED"
  | "MEMBERSHIP_CREATED"
  | "MEMBERSHIP_ACTIVATED";

export type RenderedEmail = {
  subject: string;
  text: string;
};

type TemplatePayload = {
  orderPublicId?: string;
  membershipPublicId?: string;
  serialNumber?: number;
  genesisMember?: boolean;
  activationStartedAt?: string;
  activationExpiresAt?: string;
};

export function renderFoundingEmail(
  template: EmailTemplate,
  payload: TemplatePayload,
): RenderedEmail {
  switch (template) {
    case "REGISTRATION_RECEIVED":
      return {
        subject:
          "DigitalBoost Origin — Registration received",

        text: [
          "Your Founding 6000 registration was received.",
          "",
          payload.orderPublicId
            ? `Order: ${payload.orderPublicId}`
            : "",
          "",
          "A registration or reservation is not proof of payment.",
          "",
          "Support: digitalboostorigin@gmail.com",
        ]
          .filter(Boolean)
          .join("\n"),
      };

    case "PAYMENT_VERIFIED":
      return {
        subject:
          "DigitalBoost Origin — Payment verified",

        text: [
          "Your payment was verified by DigitalBoost Origin.",
          "",
          payload.orderPublicId
            ? `Order: ${payload.orderPublicId}`
            : "",
          "",
          "Your Founding membership is now being prepared.",
          "",
          "Support: digitalboostorigin@gmail.com",
        ]
          .filter(Boolean)
          .join("\n"),
      };

    case "MEMBERSHIP_CREATED":
      return {
        subject:
          "DigitalBoost Origin — Founding membership created",

        text: [
          "Your Founding membership has been created.",
          "",
          payload.serialNumber
            ? `Founding serial: #${String(
                payload.serialNumber,
              ).padStart(4, "0")}`
            : "",
          "",
          payload.genesisMember
            ? "Genesis Member: Yes"
            : "Founding Member: Yes",
          "",
          "Your 12-month Founding Access period has NOT started yet.",
          "It begins when your membership is activated.",
          "",
          "Support: digitalboostorigin@gmail.com",
        ]
          .filter(Boolean)
          .join("\n"),
      };

    case "MEMBERSHIP_ACTIVATED":
      return {
        subject:
          "DigitalBoost Origin — Founding access activated",

        text: [
          "Your DigitalBoost Origin Founding Access is active.",
          "",
          payload.serialNumber
            ? `Founding serial: #${String(
                payload.serialNumber,
              ).padStart(4, "0")}`
            : "",
          "",
          payload.activationStartedAt
            ? `Activation: ${payload.activationStartedAt}`
            : "",
          payload.activationExpiresAt
            ? `Access expires: ${payload.activationExpiresAt}`
            : "",
          "",
          "Access remains subject to product, DBX, fair-use, infrastructure, compute and technical limits.",
          "",
          "Support: digitalboostorigin@gmail.com",
        ]
          .filter(Boolean)
          .join("\n"),
      };
  }
}
