import axios from "axios"

const PINATA_API_KEY = "cb0e06926f01d137d2a0"
const PINATA_SECRET = "9f450d74674075cc87067fda46dd6a02f080940b4aa50e4d873b5e713f45b397"

export async function uploadMetadata(metadata){

const res = await axios.post(
"https://api.pinata.cloud/pinning/pinJSONToIPFS",
metadata,
{
headers:{
pinata_api_key: PINATA_API_KEY,
pinata_secret_api_key: PINATA_SECRET
}
}
)

return res.data.IpfsHash

}