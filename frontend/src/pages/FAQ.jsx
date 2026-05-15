import FAQSection from "../components/FAQSection";
import SeoMeta from "../components/SeoMeta";

export default function FAQ() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-1">
      <SeoMeta
        title="FAQ"
        description="Learn how BaseFundAI works, from wallet connection and campaign creation to contributions, refunds, and supported networks."
        path="/faq"
        keywords={[
          "faq",
          "smart contract fundraising",
          "crypto crowdfunding",
          "campaign refunds",
        ]}
      />

      <FAQSection />
    </div>
  );
}
