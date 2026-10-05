import { db } from "../db/database.js";

export function getCampaignReadModel() {
  const campaign =
    db.prepare(`
      SELECT
        id,
        slug,
        name,
        total_capacity AS totalCapacity,
        target_launch_at AS targetLaunchAt
      FROM campaigns
      WHERE slug = ?
    `).get(
      "founding-6000",
    ) as
      | {
          id: string;
          slug: string;
          name: string;
          totalCapacity: number;
          targetLaunchAt: string;
        }
      | undefined;

  if (!campaign) {
    return null;
  }

  const phases =
    db.prepare(`
      SELECT
        p.id,
        p.code,
        p.name,
        p.position,
        p.capacity,
        p.reference_price_usd AS referencePriceUsd,
        p.serial_start AS serialStart,
        p.serial_end AS serialEnd,
        p.active,

        (
          SELECT COUNT(*)
          FROM inventory_allocations ia
          WHERE
            ia.phase_id = p.id
            AND ia.status = 'ALLOCATED'
        ) AS sold

      FROM campaign_phases p

      WHERE p.campaign_id = ?

      ORDER BY p.position ASC
    `).all(
      campaign.id,
    ) as Array<{
      id: string;
      code: string;
      name: string;
      position: number;
      capacity: number;
      referencePriceUsd: number;
      serialStart: number;
      serialEnd: number;
      active: number;
      sold: number;
    }>;

  const sold =
    phases.reduce(
      (
        total,
        phase,
      ) =>
        total +
        Number(
          phase.sold,
        ),
      0,
    );

  const normalizedPhases =
    phases.map(
      (phase) => ({
        ...phase,

        active:
          phase.active === 1,

        sold:
          Number(
            phase.sold,
          ),

        remaining:
          Math.max(
            0,
            phase.capacity -
              Number(
                phase.sold,
              ),
          ),
      }),
    );

  const activePhase =
    normalizedPhases.find(
      (phase) =>
        phase.active,
    ) ?? null;

  return {
    ...campaign,

    sold,

    remaining:
      Math.max(
        0,
        campaign.totalCapacity -
          sold,
      ),

    phases:
      normalizedPhases,

    activePhase,
  };
}

export function getActivePhase() {
  return db.prepare(`
    SELECT
      id,
      campaign_id AS campaignId,
      code,
      name,
      position,
      capacity,
      reference_price_usd AS referencePriceUsd,
      serial_start AS serialStart,
      serial_end AS serialEnd
    FROM campaign_phases
    WHERE active = 1
    ORDER BY position ASC
    LIMIT 1
  `).get() as
    | {
        id: string;
        campaignId: string;
        code: string;
        name: string;
        position: number;
        capacity: number;
        referencePriceUsd: number;
        serialStart: number;
        serialEnd: number;
      }
    | undefined;
}
