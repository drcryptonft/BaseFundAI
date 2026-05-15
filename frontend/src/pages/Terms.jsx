import SeoMeta from "../components/SeoMeta";

export default function Terms() {
  return (
    <div className="theme-soft mx-auto max-w-4xl space-y-6 px-6 py-16 leading-relaxed">
      <SeoMeta
        title="Terms & Conditions"
        description="Read the BaseFundAI terms and conditions for using the non-custodial crowdfunding interface."
        path="/terms"
      />

      <h1 className="theme-heading text-4xl font-bold">Terms & Conditions</h1>

      <p className="theme-muted text-sm">Last Updated: October 2023</p>

      <Section title="1. Scope of Service">
        <p>
          BaseFundAI provides a decentralized, open-source user interface and
          smart contract infrastructure deployed on supported blockchain
          networks, including Base Sepolia, Arc Testnet, and Robinhood Testnet.
        </p>

        <p>
          BaseFundAI is <strong>not</strong> a crowdfunding platform, financial
          institution, broker, intermediary, custodian, escrow agent, or
          fiduciary service provider.
        </p>

        <p>
          BaseFundAI does not control, manage, or facilitate the flow of funds.
          All interactions occur directly between users and blockchain smart
          contracts.
        </p>
      </Section>

      <Section title="2. No Fees & Voluntary Donations">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Zero Fees:</strong> BaseFundAI does not charge or deduct any
            platform fees.
          </li>
          <li>
            <strong>Voluntary Donations:</strong> Any donations made to support
            development are optional, non-refundable, and do not grant
            ownership, equity, or service guarantees.
          </li>
        </ul>
      </Section>

      <Section title="3. Non-Custodial Nature">
        <p>
          BaseFundAI is strictly non-custodial. At no point does BaseFundAI take
          possession, control, or custody of user funds or digital assets.
        </p>

        <p>
          All funds are held and transferred via autonomous smart contracts on
          supported blockchains.
        </p>

        <p>You are solely responsible for:</p>

        <ul className="list-disc space-y-1 pl-6">
          <li>Your wallet</li>
          <li>Your private keys</li>
          <li>Your transaction decisions</li>
        </ul>
      </Section>

      <Section title="4. Absolute Disclaimer of Liability">
        <div className="rounded-2xl border border-rose-300/70 bg-rose-50 p-4 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100">
          To the maximum extent permitted by law, BaseFundAI is provided as-is
          and as-available.
        </div>

        <ul className="mt-4 list-disc space-y-2 pl-6">
          <li>
            <strong>Smart Contract Risk:</strong> Bugs, exploits, or
            vulnerabilities may exist.
          </li>
          <li>
            <strong>No Verification:</strong> Campaigns are not reviewed,
            verified, or endorsed.
          </li>
          <li>
            <strong>Rug Pull Risk:</strong> Campaign creators may misuse funds.
          </li>
          <li>
            <strong>Financial Loss:</strong> You may lose funds, gas fees, or
            transaction value.
          </li>
        </ul>

        <p className="mt-4">
          BaseFundAI bears zero liability for any loss, damage, or harm arising
          from use of the platform.
        </p>
      </Section>

      <Section title="5. User Representations">
        <p>By using BaseFundAI, you confirm that:</p>

        <ul className="list-disc space-y-1 pl-6">
          <li>You are not located in sanctioned jurisdictions</li>
          <li>You comply with applicable laws</li>
          <li>You understand blockchain transactions are irreversible</li>
        </ul>
      </Section>

      <Section title="6. Indemnification">
        <p>
          You agree to indemnify and hold harmless BaseFundAI, its developers,
          contributors, and affiliates from any claims, damages, or legal
          actions.
        </p>
      </Section>

      <Section title="7. No Financial Advice">
        <p>
          BaseFundAI does not provide financial, legal, or investment advice.
          All decisions are made solely by users.
        </p>
      </Section>

      <Section title="8. Changes to Terms">
        <p>
          These terms may be updated at any time without prior notice.
          Continued use constitutes acceptance of updated terms.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h2 className="theme-heading text-xl font-semibold">{title}</h2>
      {children}
    </div>
  );
}
