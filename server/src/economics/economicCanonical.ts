import {
  createHash,
} from "node:crypto";

function normalize(
  value:
    unknown,
): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (
    typeof value === "number"
  ) {
    if (
      !Number.isFinite(
        value,
      )
    ) {
      throw new Error(
        "NON_FINITE_ECONOMIC_NUMBER",
      );
    }

    return value;
  }

  if (
    typeof value === "bigint"
  ) {
    return value.toString();
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      normalize,
    );
  }

  if (
    typeof value === "object"
  ) {
    const input =
      value as Record<
        string,
        unknown
      >;

    const output:
      Record<
        string,
        unknown
      > = {};

    for (
      const key of
        Object.keys(input)
          .sort()
    ) {
      output[key] =
        normalize(
          input[key],
        );
    }

    return output;
  }

  throw new Error(
    "UNSUPPORTED_ECONOMIC_CANONICAL_TYPE",
  );
}

export function economicCanonicalJson(
  value:
    unknown,
) {
  return JSON.stringify(
    normalize(
      value,
    ),
  );
}

export function economicSha256(
  value:
    unknown,
) {
  return (
    "sha256:" +
    createHash(
      "sha256",
    )
      .update(
        economicCanonicalJson(
          value,
        ),
        "utf8",
      )
      .digest(
        "hex",
      )
  );
}
