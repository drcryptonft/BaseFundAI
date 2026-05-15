import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import SeoMeta from "../components/SeoMeta";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.6,
    },
  }),
};

const values = [
  {
    icon: HeartHandshake,
    title: "Human first",
    desc: "Clear enough to understand. Respectful enough to trust. Human enough to feel right.",
  },
  {
    icon: ShieldCheck,
    title: "Trust by design",
    desc: "Funds move directly, with transparent records and no platform standing in the middle.",
  },
  {
    icon: Sparkles,
    title: "Small help, real change",
    desc: "Even a small contribution can help someone begin, rebuild, or move forward with dignity.",
  },
];

const proofPoints = [
  {
    name: "Joseph Pulitzer",
    detail:
      "He asked ordinary people to give what they could so the pedestal of the Statue of Liberty could finally be built. Small gifts completed something historic.",
  },
  {
    name: "Michael Faraday",
    detail:
      "A single free lecture ticket helped open the path for one of history's most important scientific minds. Access changed everything.",
  },
  {
    name: "Mahatma Gandhi",
    detail:
      "He called for humble contributions so families could buy spinning wheels, work with dignity, and reclaim agency through small acts.",
  },
  {
    name: "Muhammad Yunus",
    detail:
      "A modest $27 became the seed of microfinance because it reached people who were ready to build, not just survive.",
  },
];

const founderLead =
  "Somewhere in the world tonight, a child is trying to study under a streetlight because their home has no electricity.";

const founderParagraphs = [
  "Somewhere else, a father who knows exactly how to work is sitting in silence because he cannot afford the tools to begin again. A mother is skipping meals so her children can eat one more time before morning.",
  "None of them are asking for luxury. Most are simply asking for a chance to stand back up with dignity.",
  "History often changes quietly long before the world notices.",
  "Before Muhammad Yunus became known around the world, he met women trapped in debt over amounts so small that most people would spend them without thinking. A few dollars separated them from freedom. That tiny act of trust later helped millions escape exploitation.",
  "Before Michael Faraday transformed modern science, he was a poor apprentice binding books for other people. One opportunity - access to knowledge he could never afford - helped change the course of human progress. The electricity powering our lives today exists partly because someone opened a door for a young man nobody important noticed.",
  "Before the Statue of Liberty became a symbol of hope, its construction nearly stopped. It was not rescued by kings or empires. It was completed because ordinary people gave small amounts together: workers, mothers, immigrants, and children. People who were not wealthy enough to change the world alone, but became powerful when united.",
  "A sewing machine can feed a family for years. A bicycle can become a child's path to education. A used laptop can become someone's first income. A small donation can interrupt generations of poverty before it hardens into destiny.",
  "From the outside, these things can look small. To the person receiving them, they can feel like the universe finally answered.",
  "That is why BaseFundAI exists: not to turn kindness into a business, not to stand between people and compassion, and not to take a percentage from human pain.",
  "We built it because help should arrive with honesty, because dignity matters, because trust matters, and because when one person reaches out to help another, the world should not make that moment harder, slower, or smaller.",
  "There are no hidden middlemen and no platform ownership of people's struggles, only humans helping humans directly, transparently, and with respect.",
  "Maybe, years from now, someone will remember the moment their life changed not because a corporation noticed them or a politician promised something, but because one ordinary person, somewhere in the world, chose to care.",
  "Maybe that person is you. Maybe the amount is small. Maybe nobody will applaud it, and maybe the world will never know your name. But a child may stay in school because of you, a family may sleep without fear because of you, and a dream that was about to disappear may survive because of you.",
  "Humanity moves forward when compassion becomes action.",
];

const founderQuote =
  "The world is not changed only by powerful people. It is changed by ordinary people who decide another human being should not struggle alone.";

const founderClosing =
  "You do not need to be rich to change a future. You only need the courage to begin.";

const founderClosingNote =
  "Because sometimes the smallest act of kindness becomes the moment when another human being finally believes life can get better. And there is no greater investment than that.";

export default function Why() {
  return (
    <div className="space-y-10 pb-6">
      <SeoMeta
        title="Why We Are Here"
        description="Read the story and product philosophy behind BaseFundAI: direct, transparent support for real-world needs."
        path="/why"
      />

      <section className="theme-shell relative overflow-hidden px-6 py-16 md:px-10 md:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_36%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(125,211,252,0.12),transparent_28%)]" />

        <div className="relative mx-auto max-w-4xl text-center">
          <motion.span
            className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-emerald-700 dark:text-emerald-200"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Built for direct help
          </motion.span>

          <motion.h1
            className="theme-heading mt-6 text-4xl font-semibold tracking-tight md:text-6xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Why We Are Here
          </motion.h1>

          <motion.p
            className="theme-soft mx-auto mt-6 max-w-2xl text-lg leading-8 md:text-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            The right help, in the right hands, at the right moment. When support
            arrives with dignity, even a small act can change a future.
          </motion.p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {values.map(({ icon: Icon, title, desc }, index) => (
              <motion.div
                key={title}
                className="theme-card-soft h-full rounded-2xl p-5 text-left"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 text-emerald-600 shadow-sm dark:bg-slate-900/80 dark:text-emerald-300">
                  <Icon size={20} />
                </div>
                <h2 className="theme-heading text-lg font-semibold">{title}</h2>
                <p className="theme-muted mt-2 text-sm leading-7">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl space-y-6">
        <div className="theme-card px-6 py-8 md:px-10 md:py-10">
          <div className="mb-8 border-b border-slate-200/80 pb-6 dark:border-slate-800">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-300">
              A founder note
            </p>
            <h2 className="theme-heading mt-3 text-2xl font-semibold md:text-3xl">
              A small act can still be life-changing.
            </h2>
          </div>

          <div className="mx-auto max-w-3xl">
            <motion.p
              className="theme-soft text-[17px] leading-8 md:text-lg"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.18 }}
              custom={0}
            >
              {founderLead}
            </motion.p>

            <div className="mt-8 space-y-5">
              {founderParagraphs.map((text, i) => (
                <motion.p
                  key={text}
                  className="theme-soft text-[17px] leading-8 md:text-lg"
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.18 }}
                  custom={i + 1}
                >
                  {text}
                </motion.p>
              ))}
            </div>

            <motion.blockquote
              className="mt-8 rounded-3xl border-l-4 border-emerald-500 bg-emerald-50/70 px-6 py-5 text-lg font-semibold leading-8 text-slate-900 dark:bg-emerald-500/10 dark:text-white"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.18 }}
              custom={founderParagraphs.length + 1}
            >
              {founderQuote}
            </motion.blockquote>

            <motion.div
              className="mt-8 rounded-3xl border border-amber-300/45 bg-amber-50/75 px-6 py-5 dark:border-amber-400/20 dark:bg-amber-500/10"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.18 }}
              custom={founderParagraphs.length + 2}
            >
              <p className="text-xl font-semibold leading-8 text-slate-900 dark:text-white">
                {founderClosing}
              </p>
              <p className="theme-soft mt-3 text-[16px] leading-7 md:text-[17px]">
                {founderClosingNote}
              </p>
            </motion.div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <motion.div
            className="theme-card px-6 py-7"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-600 dark:text-sky-300">
              History leaves clues
            </p>
            <div className="mt-5 space-y-4">
              {proofPoints.map((point) => (
                <div
                  key={point.name}
                  className="rounded-2xl border border-slate-200/80 bg-white/75 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/70"
                >
                  <p className="theme-heading text-sm font-semibold">{point.name}</p>
                  <p className="theme-soft mt-2 text-sm leading-7">{point.detail}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="theme-card-soft overflow-hidden rounded-3xl border border-amber-300/40 bg-[linear-gradient(180deg,rgba(254,243,199,0.5),rgba(255,255,255,0.9))] px-6 py-7 dark:border-amber-200/10 dark:bg-[linear-gradient(180deg,rgba(120,53,15,0.18),rgba(15,23,42,0.9))]"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-700 dark:text-amber-200">
              The promise
            </p>
            <p className="mt-4 text-xl font-semibold leading-9 text-slate-900 dark:text-white">
              We take nothing, so more of the support stays with the person it
              was meant for.
            </p>
            <p className="mt-4 text-sm leading-7 text-slate-700 dark:text-slate-200">
              No platform fee. No unnecessary middle layer. Just a clearer path
              between the person who wants to help and the person ready to use
              that help well.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="theme-shell px-6 py-12 text-center md:px-10">
        <motion.h2
          className="theme-heading text-3xl font-semibold md:text-4xl"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
        >
          Contribute to a campaign that needs a real beginning.
        </motion.h2>

        <p className="theme-muted mx-auto mt-4 max-w-2xl text-base leading-7 md:text-lg">
          Explore campaigns where a small act of support can still mean dignity,
          momentum, and a real chance to move forward.
        </p>

        <Link
          to="/explore"
          className="mt-8 inline-flex items-center rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(16,185,129,0.28)] transition hover:-translate-y-0.5 hover:bg-emerald-600"
        >
          Explore Campaigns
        </Link>
      </section>
    </div>
  );
}
