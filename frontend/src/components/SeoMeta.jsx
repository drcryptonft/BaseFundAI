import { Helmet } from "react-helmet-async";
import {
  SITE_DESCRIPTION,
  SITE_IMAGE_PATH,
  SITE_NAME,
  SITE_TITLE,
  toAbsoluteUrl,
} from "../config/site";

export default function SeoMeta({
  title = SITE_TITLE,
  description = SITE_DESCRIPTION,
  path = "",
  image = SITE_IMAGE_PATH,
  type = "website",
  keywords = [],
  noIndex = false,
}) {
  const canonicalUrl = toAbsoluteUrl(path);
  const imageUrl = toAbsoluteUrl(image);
  const resolvedTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const keywordContent = Array.isArray(keywords) ? keywords.join(", ") : "";

  return (
    <Helmet>
      <title>{resolvedTitle}</title>
      <meta name="description" content={description} />
      {keywordContent ? <meta name="keywords" content={keywordContent} /> : null}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={resolvedTitle} />
      <meta property="og:description" content={description} />
      {canonicalUrl ? <meta property="og:url" content={canonicalUrl} /> : null}
      {imageUrl ? <meta property="og:image" content={imageUrl} /> : null}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={description} />
      {imageUrl ? <meta name="twitter:image" content={imageUrl} /> : null}
      {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}
      {noIndex ? <meta name="robots" content="noindex,nofollow" /> : null}
    </Helmet>
  );
}
