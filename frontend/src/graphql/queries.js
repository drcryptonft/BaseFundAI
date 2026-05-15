import { gql } from "graphql-request";

export const GET_CAMPAIGNS = gql`
{
  campaigns {
    id
    creator
    goal
    raised
    deadline
    finalized
    successful
  }
}
`;

export const GET_CAMPAIGNS_ENHANCED = gql`
{
  campaigns(orderBy: createdAtBlock, orderDirection: desc) {
    id
    creator
    goal
    raised
    deadline
    finalized
    successful
    stateCode
    createdAtBlock
    contributionCount
    backerCount
    fundsClaimed
    refundsClaimedCount
  }
}
`;

export const GET_CAMPAIGN = gql`
  query ($id: ID!) {
    campaign(id: $id) {
      id
      creator
      goal
      raised
      deadline
      finalized
      successful
    }
  }
`;

export const GET_CAMPAIGN_ENHANCED = gql`
  query ($id: ID!) {
    campaign(id: $id) {
      id
      creator
      goal
      raised
      deadline
      finalized
      successful
      stateCode
      createdAtBlock
      contributionCount
      backerCount
      fundsClaimed
      refundsClaimedCount
    }
  }
`;

export const GET_CAMPAIGN_ENHANCED_WITH_CONTRIBUTOR = gql`
  query ($id: ID!, $contributorId: ID!) {
    campaign(id: $id) {
      id
      creator
      goal
      raised
      deadline
      finalized
      successful
      stateCode
      createdAtBlock
      contributionCount
      backerCount
      fundsClaimed
      refundsClaimedCount
    }
    campaignContributor(id: $contributorId) {
      id
      contributor
      totalContributed
      contributionCount
      refunded
      refundedAtBlock
      refundedAtTimestamp
    }
  }
`;

export const GET_CONTRIBUTIONS_BY_USER_ENHANCED = gql`
  query ($contributor: Bytes!) {
    campaignContributors(where: { contributor: $contributor }) {
      id
      contributor
      totalContributed
      contributionCount
      refunded
      campaign {
        id
        creator
        goal
        raised
        deadline
        finalized
        successful
        stateCode
        createdAtBlock
        contributionCount
        backerCount
        fundsClaimed
        refundsClaimedCount
      }
    }
  }
`;

export const GET_CONTRIBUTIONS_BY_USER = gql`
  query ($contributor: Bytes!) {
    campaignContributors(where: { contributor: $contributor }) {
      id
      contributor
      totalContributed
      contributionCount
      refunded
      campaign {
        id
      }
    }
  }
`;

export async function requestCampaigns(client) {
  if (!client) {
    return {
      campaigns: [],
      graphMode: "unavailable",
    };
  }

  try {
    const res = await client.request(GET_CAMPAIGNS_ENHANCED);

    return {
      campaigns: Array.isArray(res?.campaigns) ? res.campaigns : [],
      graphMode: "enhanced",
    };
  } catch (error) {
    const res = await client.request(GET_CAMPAIGNS);

    return {
      campaigns: Array.isArray(res?.campaigns) ? res.campaigns : [],
      graphMode: "legacy",
    };
  }
}

export async function requestCampaign(client, { id, contributorId }) {
  if (!client) {
    return {
      campaign: null,
      campaignContributor: null,
      graphMode: "unavailable",
    };
  }

  try {
    if (contributorId) {
      const res = await client.request(GET_CAMPAIGN_ENHANCED_WITH_CONTRIBUTOR, {
        id,
        contributorId,
      });

      return {
        campaign: res?.campaign || null,
        campaignContributor: res?.campaignContributor || null,
        graphMode: "enhanced",
      };
    }

    const res = await client.request(GET_CAMPAIGN_ENHANCED, { id });

    return {
      campaign: res?.campaign || null,
      campaignContributor: null,
      graphMode: "enhanced",
    };
  } catch (error) {
    const res = await client.request(GET_CAMPAIGN, { id });

    return {
      campaign: res?.campaign || null,
      campaignContributor: null,
      graphMode: "legacy",
    };
  }
}

export async function requestUserContributions(client, contributor) {
  if (!client) {
    return {
      campaignContributors: [],
      graphMode: "unavailable",
    };
  }

  try {
    const res = await client.request(GET_CONTRIBUTIONS_BY_USER_ENHANCED, {
      contributor,
    });

    return {
      campaignContributors: Array.isArray(res?.campaignContributors)
        ? res.campaignContributors
        : [],
      graphMode: "enhanced",
    };
  } catch (error) {
    const res = await client.request(GET_CONTRIBUTIONS_BY_USER, {
      contributor,
    });

    return {
      campaignContributors: Array.isArray(res?.campaignContributors)
        ? res.campaignContributors
        : [],
      graphMode: "legacy",
    };
  }
}
