import {
  Router,
} from "express";

import {
  getCampaignReadModel,
} from "../repositories/campaignRepository.js";

export const campaignRouter =
  Router();

campaignRouter.get(
  "/",
  (_request, response) => {
    const campaign =
      getCampaignReadModel();

    if (!campaign) {
      return response
        .status(404)
        .json({
          error:
            "CAMPAIGN_NOT_FOUND",
        });
    }

    return response.json({
      campaign,
    });
  },
);
