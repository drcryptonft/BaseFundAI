import SeoMeta from "../components/SeoMeta";

export default function Help() {
  return (
    <div className="theme-shell px-8 py-12">
      <SeoMeta
        title="Help Center"
        description="Get help with wallet connections, contributions, refunds, campaign creation, and creator claims on BaseFundAI."
        path="/help"
      />

      <h1 className="theme-heading text-3xl font-bold">Help Center</h1>
      <p className="theme-muted mt-4 max-w-2xl">
        Need help with wallet connection, contributions, refunds, or creator
        claims? This support surface now follows the same theme rules as the
        rest of the product so readability stays consistent across modes.
      </p>
    </div>
  )
}
