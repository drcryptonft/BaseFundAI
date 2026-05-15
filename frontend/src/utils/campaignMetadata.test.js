import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeCampaignMetadataDraft,
  sanitizeCampaignMetadataForDisplay,
  sanitizeCampaignMetadataForTransport,
} from "./campaignMetadata.js";

test("sanitizeCampaignMetadataDraft keeps valid data images and trims fields", () => {
  const metadata = sanitizeCampaignMetadataDraft({
    title: "  Clean Water Initiative  ",
    story: "  We are restoring village water access.  ",
    videoUrl: "  https://youtu.be/example  ",
    images: [" data:image/png;base64,abc ", "https://example.com/image.png"],
    socials: {
      twitter: "  https://x.com/basefundai  ",
    },
  });

  assert.equal(metadata.headline, "Clean Water Initiative");
  assert.equal(metadata.description, "We are restoring village water access.");
  assert.equal(metadata.youtube, "https://youtu.be/example");
  assert.deepEqual(metadata.images, [
    "data:image/png;base64,abc",
    "https://example.com/image.png",
  ]);
  assert.deepEqual(metadata.socials, {
    twitter: "https://x.com/basefundai",
  });
});

test("sanitizeCampaignMetadataForTransport drops inline images and normalizes aliases", () => {
  const metadata = sanitizeCampaignMetadataForTransport({
    name: "Impact Launch",
    about: "Funding field operations",
    media: {
      images: ["data:image/png;base64,abc", "ipfs://bafy123"],
    },
  });

  assert.equal(metadata.headline, "Impact Launch");
  assert.equal(metadata.description, "Funding field operations");
  assert.deepEqual(metadata.images, ["ipfs://bafy123"]);
});

test("sanitizeCampaignMetadataForDisplay keeps legacy inline images for rendering", () => {
  const metadata = sanitizeCampaignMetadataForDisplay({
    headline: "Legacy Campaign",
    images: ["data:image/png;base64,abc", "ipfs://bafy456"],
  });

  assert.deepEqual(metadata.images, [
    "data:image/png;base64,abc",
    "ipfs://bafy456",
  ]);
});
