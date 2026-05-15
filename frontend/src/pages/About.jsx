import SeoMeta from "../components/SeoMeta";

export default function About() {
  return (
    <div className="theme-shell px-8 py-12">
      <SeoMeta
        title="About BaseFundAI"
        description="Learn what BaseFundAI is building: non-custodial crowdfunding infrastructure for real-world needs."
        path="/about"
      />

      <h1 className="theme-heading text-3xl font-bold">About BaseFundAI</h1>
      <p className="theme-muted mt-4 max-w-2xl">
        BaseFundAI is building non-custodial fundraising infrastructure for
        real-world needs. The product experience is designed to feel clear,
        trustworthy, and premium in both light and dark mode.
      </p>
    </div>
  )
}
