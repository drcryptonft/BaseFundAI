import { CampaignCreated as CampaignCreatedEvent } from "../generated/CampaignFactory/CampaignFactory"
import { CampaignCreated } from "../generated/schema"

export function handleCampaignCreated(event: CampaignCreatedEvent): void {
  let entity = new CampaignCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.campaign = event.params.campaign
  entity.creator = event.params.creator
  entity.goal = event.params.goal
  entity.deadline = event.params.deadline

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
