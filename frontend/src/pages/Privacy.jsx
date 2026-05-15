import SeoMeta from "../components/SeoMeta";

export default function Privacy() {
  return (
    <div className="theme-soft mx-auto max-w-4xl space-y-6 px-6 py-16 leading-relaxed">
      <SeoMeta
        title="Privacy Policy"
        description="Read the BaseFundAI privacy policy for our non-custodial crowdfunding application."
        path="/privacy"
      />

      <h1 className="theme-heading text-4xl font-bold">Privacy Policy</h1>

      <p className="theme-muted text-sm">Last Updated: May 2026</p>

      <Section title="1. Philosophy">
        <p>
          BaseFundAI is built on decentralization and privacy-first principles.
          We do not collect data unless absolutely necessary.
        </p>
      </Section>

      <Section title="2. Data We Do Not Collect">
        <ul className="list-disc space-y-2 pl-6">
          <li>No names, emails, or personal identifiers</li>
          <li>No advertising profiles or cross-site behavioral tracking</li>
          <li>No private keys or seed phrases</li>
        </ul>
      </Section>

      <Section title="3. On-Chain Data">
        <p>
          All activity occurs on supported blockchains such as Base Sepolia, Arc
          Testnet, and Robinhood Testnet and is publicly visible.
        </p>

        <ul className="list-disc space-y-1 pl-6">
          <li>Wallet addresses</li>
          <li>Transaction history</li>
          <li>Contribution amounts</li>
        </ul>

        <p>BaseFundAI cannot modify or delete blockchain data.</p>
      </Section>

      <Section title="4. Third-Party Services">
        <p>
          Wallet providers such as MetaMask and Coinbase Wallet may collect data
          independently.
        </p>
      </Section>

      <Section title="5. Cookies & Tracking">
        <p>
          BaseFundAI does not use advertising cookies, tracking pixels, or
          third-party analytics SDKs. We do collect limited first-party
          operational telemetry, such as anonymous error reports and create or
          contribute event counts, to keep the public testnet reliable. This
          telemetry is not used for personal profiling or cross-site tracking.
        </p>
      </Section>

      <Section title="6. Security">
        <p>
          Users are responsible for securing their wallets and using best
          practices.
        </p>
      </Section>

      <Section title="7. Contact">
        <p>
          BaseFundAI is a decentralized project. There is no central data
          controller.
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
