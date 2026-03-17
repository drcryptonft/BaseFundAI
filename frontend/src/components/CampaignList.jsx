import { useEffect, useState, useMemo } from "react"
import { publicClient } from "../wagmi"
import { FACTORY_ADDRESS, FACTORY_ABI, CAMPAIGN_ABI } from "../contracts"
import { saveCampaignCache, loadCampaignCache } from "../utils/campaignCache"
import CampaignCard from "./CampaignCard"

export default function CampaignList(){

const [campaigns,setCampaigns] = useState([])
const [campaignData,setCampaignData] = useState([])
const [filter,setFilter] = useState("ALL")
const [now,setNow] = useState(Math.floor(Date.now()/1000))

useEffect(()=>{

loadCampaigns()

const timer = setInterval(()=>{
setNow(Math.floor(Date.now()/1000))
},5000)

return ()=>clearInterval(timer)

},[])


async function loadCampaigns(){

// try cache first
const cached = loadCampaignCache()

if(cached){

setCampaignData(cached)

return

}

try{


const result = await publicClient.readContract({
address: FACTORY_ADDRESS,
abi: FACTORY_ABI,
functionName:"getCampaigns"
})

setCampaigns([...result].reverse())

const reversed = [...result].reverse()

const data = await Promise.all(reversed.map(async(addr)=>{

const goal = await publicClient.readContract({
address: addr,
abi: CAMPAIGN_ABI,
functionName:"goal"
})

const raised = await publicClient.readContract({
address: addr,
abi: CAMPAIGN_ABI,
functionName:"totalRaised"
})

const deadline = await publicClient.readContract({
address: addr,
abi: CAMPAIGN_ABI,
functionName:"deadline"
})

const finalized = await publicClient.readContract({
address: addr,
abi: CAMPAIGN_ABI,
functionName:"finalized"
})

const successful = await publicClient.readContract({
address: addr,
abi: CAMPAIGN_ABI,
functionName:"successful"
})

const creator = await publicClient.readContract({
address: addr,
abi: CAMPAIGN_ABI,
functionName:"creator"
})


return{
address: addr,
goal: Number(goal),
raised: Number(raised),
deadline: Number(deadline),
finalized,
successful,
creator
}

}))

saveCampaignCache(data)
setCampaignData(data)

}catch(err){
console.log("Error loading campaigns:",err)
}

}

function getState(c){

if(c.finalized && c.successful){
return "SUCCESSFUL"
}

if(c.finalized && !c.successful){
return "FAILED"
}

if(now >= c.deadline && !c.finalized){
return "AWAITING_FINALIZATION"
}

if(c.raised >= c.goal && now < c.deadline){
return "GOAL_REACHED"
}

return "ACTIVE"

}

const filtered = useMemo(()=>{

return campaignData.filter(c=>{

const state = getState(c)

if(filter==="ALL") return true
if(filter==="ACTIVE") return state==="ACTIVE"
if(filter==="GOAL_REACHED") return state==="GOAL_REACHED"
if(filter==="AWAITING_FINALIZATION") return state==="AWAITING_FINALIZATION"
if(filter==="SUCCESSFUL") return state==="SUCCESSFUL"
if(filter==="FAILED") return state==="FAILED"

return true

})

},

[filter,campaignData,now])

return(

<div>

{/* FILTER BUTTONS */}

<div style={{
display:"flex",
flexWrap:"wrap",
gap:"10px",
marginBottom:"25px"
}}>

{[
["ALL","All"],
["ACTIVE","Active"],
["GOAL_REACHED","Goal Reached"],
["AWAITING_FINALIZATION","Awaiting Finalization"],
["SUCCESSFUL","Successful"],
["FAILED","Failed"]
].map(([key,label])=>{

const count = campaignData.filter(c=>getState(c)===key).length

if(key==="ALL") return(
<button
key={key}
onClick={()=>setFilter(key)}
style={{
padding:"8px 14px",
borderRadius:"20px",
border:"1px solid #e2e8f0",
background: filter===key ? "#2563eb":"#fff",
color: filter===key ? "#fff":"#000",
cursor:"pointer",
fontWeight:"500"
}}
>
{label} ({campaignData.length})
</button>
)

return(
<button
key={key}
onClick={()=>setFilter(key)}
style={{
padding:"8px 14px",
borderRadius:"20px",
border:"1px solid #e2e8f0",
background: filter===key ? "#2563eb":"#fff",
color: filter===key ? "#fff":"#000",
cursor:"pointer",
fontWeight:"500"
}}
>
{label} ({count})
</button>
)

})}

</div>

{/* CAMPAIGN GRID */}

<div style={{
display:"grid",
gridTemplateColumns:"repeat(auto-fill,minmax(380px,1fr))",
gap:"30px"
}}>

{filtered.map(c=>(
<CampaignCard
key={c.address}
campaign={c}
refreshCampaigns={loadCampaigns}
/>
))}


</div>

</div>

)

}