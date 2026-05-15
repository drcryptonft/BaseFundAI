import { Address, BigInt } from "@graphprotocol/graph-ts"
import { CampaignCreated } from "../generated/Factory/Factory"
import {
  Contributed,
  FundsClaimed,
  Refunded
} from "../generated/templates/Campaign/Campaign"
import {
  Campaign as CampaignEntity,
  CampaignContributor as CampaignContributorEntity
} from "../generated/schema"
import { Campaign as CampaignTemplate } from "../generated/templates"
import { Campaign as CampaignContract } from "../generated/templates/Campaign/Campaign"

function syncCampaignFromContract(entity: CampaignEntity): void {
  let contract = CampaignContract.bind(Address.fromBytes(entity.address))

  let raisedResult = contract.try_totalRaised()
  if (!raisedResult.reverted) {
    entity.raised = raisedResult.value
  }

  let stateResult = contract.try_getState()
  if (!stateResult.reverted) {
    entity.stateCode = stateResult.value
    entity.successful = stateResult.value == 1
    entity.finalized = stateResult.value == 2 || stateResult.value == 3
  }
}

function getContributorId(campaignId: string, contributor: string): string {
  return campaignId + "-" + contributor
}

/* ---------- CAMPAIGN CREATED ---------- */

export function handleCampaignCreated(event: CampaignCreated): void {
  let entity = new CampaignEntity(event.params.campaign.toHex())

  entity.address = event.params.campaign
  entity.creator = event.params.creator
  entity.goal = event.params.goal
  entity.deadline = event.params.deadline
  entity.finalized = false
  entity.successful = false
  entity.stateCode = 0
  entity.raised = BigInt.fromI32(0)
  entity.createdAtBlock = event.block.number
  entity.createdAtTimestamp = event.block.timestamp
  entity.contributionCount = 0
  entity.backerCount = 0
  entity.fundsClaimed = false
  entity.refundsClaimedCount = 0

  let contract = CampaignContract.bind(event.params.campaign)
  let result = contract.try_totalRaised()

  entity.raised = result.reverted
    ? BigInt.fromI32(0)
    : result.value

  entity.save()

  CampaignTemplate.create(event.params.campaign)
}

/* ---------- HANDLE CONTRIBUTION ---------- */

export function handleContributed(event: Contributed): void {
  let id = event.address.toHex()
  let entity = CampaignEntity.load(id)
  if (!entity) return

  let contributorId = getContributorId(id, event.params.user.toHex())
  let contributor = CampaignContributorEntity.load(contributorId)
  let isNewContributor = contributor == null

  if (contributor == null) {
    contributor = new CampaignContributorEntity(contributorId)
    contributor.campaign = id
    contributor.contributor = event.params.user
    contributor.totalContributed = BigInt.fromI32(0)
    contributor.contributionCount = 0
    contributor.refunded = false
  }

  contributor.totalContributed = contributor.totalContributed.plus(event.params.amount)
  contributor.contributionCount = contributor.contributionCount + 1
  contributor.refunded = false
  contributor.refundedAtBlock = null
  contributor.refundedAtTimestamp = null
  contributor.save()

  syncCampaignFromContract(entity)

  entity.contributionCount = entity.contributionCount + 1
  if (isNewContributor) {
    entity.backerCount = entity.backerCount + 1
  }

  entity.save()
}

/* ---------- HANDLE FUNDS CLAIMED ---------- */

export function handleFundsClaimed(event: FundsClaimed): void {
  let id = event.address.toHex()
  let entity = CampaignEntity.load(id)
  if (!entity) return

  let contract = CampaignContract.bind(event.address)

  syncCampaignFromContract(entity)
  entity.fundsClaimed = true

  entity.save()
}

/* ---------- HANDLE REFUND CLAIMED ---------- */

export function handleRefunded(event: Refunded): void {
  let id = event.address.toHex()
  let entity = CampaignEntity.load(id)
  if (!entity) return

  let contributorId = getContributorId(id, event.params.user.toHex())
  let contributor = CampaignContributorEntity.load(contributorId)

  if (contributor != null) {
    contributor.refunded = true
    contributor.refundedAtBlock = event.block.number
    contributor.refundedAtTimestamp = event.block.timestamp
    contributor.save()
  }

  syncCampaignFromContract(entity)

  entity.refundsClaimedCount = entity.refundsClaimedCount + 1

  entity.save()
}
