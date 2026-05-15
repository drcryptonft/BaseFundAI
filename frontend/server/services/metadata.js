import { fetchJson } from "../utils/fetch.js";
import {
  sanitizeCampaignMetadataDraft,
  sanitizeCampaignMetadataForTransport,
} from "../../src/utils/campaignMetadata.js";
import { uploadCampaignImage } from "./mediaStorage.js";

export const METADATA_UPLOAD_LIMIT_BYTES = 18 * 1024 * 1024;

function getPinataHeaders({ json = false } = {}) {
  const jwt = String(process.env.PINATA_JWT || "").trim();
  const apiKey = String(process.env.PINATA_API_KEY || "").trim();
  const secret = String(process.env.PINATA_SECRET_API_KEY || "").trim();

  if (jwt) {
    const headers = {
      Authorization: `Bearer ${jwt}`,
    };

    if (json) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  }

  if (apiKey && secret) {
    const headers = {
      pinata_api_key: apiKey,
      pinata_secret_api_key: secret,
    };

    if (json) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  }

  return null;
}

async function uploadJsonToPinata(payload) {
  const headers = getPinataHeaders({ json: true });

  if (!headers) {
    throw new Error("Pinata credentials are not configured on the server");
  }

  const result = await fetchJson(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    },
    45000
  );

  if (!result.ok) {
    throw new Error(
      result.data?.error?.reason ||
        result.data?.error ||
        result.data?.message ||
        `Pinata upload failed (${result.status})`
    );
  }

  const ipfsHash = String(result.data?.IpfsHash || "").trim();

  if (!ipfsHash) {
    throw new Error("Pinata upload did not return an IPFS hash");
  }

  return ipfsHash;
}

async function resolveMetadataImages(images = []) {
  const uploaded = [];

  for (let index = 0; index < images.length; index += 1) {
    uploaded.push(await uploadCampaignImage(images[index], index));
  }

  return uploaded;
}

export async function uploadCampaignMetadata(metadata = {}) {
  const draftPayload = sanitizeCampaignMetadataDraft(metadata);
  const uploadedImages = await resolveMetadataImages(draftPayload.images);
  const payload = sanitizeCampaignMetadataForTransport({
    ...draftPayload,
    images: uploadedImages,
  });
  const ipfsHash = await uploadJsonToPinata(payload);

  return {
    ipfsHash,
    metadataURI: `ipfs://${ipfsHash}`,
    metadata: payload,
  };
}
