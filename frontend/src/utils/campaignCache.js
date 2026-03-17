export function saveCampaignCache(data){

localStorage.setItem(
"campaignCache",
JSON.stringify({
data,
timestamp: Date.now()
})
)

}

export function loadCampaignCache(){

const cache = localStorage.getItem("campaignCache")

if(!cache) return null

try{

const parsed = JSON.parse(cache)

// cache expires after 60 seconds
if(Date.now() - parsed.timestamp > 60000){
return null
}

return parsed.data

}catch{

return null

}

}