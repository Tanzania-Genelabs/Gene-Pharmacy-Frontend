import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Gene Pharmacy collects, uses and shares data in its mobile app and web app.",
};

const CONTACT_EMAIL = "dawillygene@gmail.com";
const LAST_UPDATED = "29 October 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 leading-7 text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

      <p className="mt-6">
        This policy applies to the Gene Pharmacy Android app (package <code>com.dawillygene.genepharmacy</code>) and
        the Gene Pharmacy web app at gene.leotap.com (together, the &ldquo;Service&rdquo;). Gene Pharmacy
        (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides pharmacy management software: stock, point of sale, customers,
        suppliers, shifts and reports. It is a business tool for pharmacy staff. It is not aimed at children and not
        meant for the general public.
      </p>

      <Section title="1. Data we collect">
        <p className="font-medium">Account data</p>
        <ul>
          <li>Your full name, email address, role (Owner, Manager, Seller) and the pharmacy and branch you belong to.</li>
          <li>Your password, which we store only as a one-way hash. We cannot read it.</li>
          <li>Sign-in activity: time, IP address and device/browser details, kept in security and audit logs.</li>
        </ul>

        <p className="pt-2 font-medium">Pharmacy business data entered by your pharmacy</p>
        <ul>
          <li>Medicines and products, prices, stock levels, expiry dates, suppliers and purchase orders.</li>
          <li>
            Sales and receipts: items sold, quantities, discounts, payment method, amounts, who made the sale and
            when. Because it lists medicines sold, a sale record can reveal health-related information about a
            customer.
          </li>
          <li>Shifts and notes entered by staff.</li>
        </ul>

        <p className="pt-2 font-medium">Customer records</p>
        <ul>
          <li>
            If a pharmacy adds a customer, we store the name and phone number it enters, plus that customer&rsquo;s
            purchase history and loyalty points. Customers do not use the app themselves.
          </li>
        </ul>

        <p className="pt-2 font-medium">Subscription payments</p>
        <ul>
          <li>
            When a pharmacy pays for its subscription by mobile money, we receive the phone number used, the amount,
            a payment reference and the payment status. We never see your PIN or wallet credentials.
          </li>
        </ul>
      </Section>

      <Section title="2. Device permissions and on-device data">
        <ul>
          <li>
            <strong>Camera.</strong> Used only to scan barcodes on medicine packs. Camera images are processed live
            on your phone to read the barcode. They are not saved and not uploaded.
          </li>
          <li>
            <strong>Network.</strong> Used to sign in, download the product catalogue and upload sales.
          </li>
          <li>
            <strong>Offline storage.</strong> So the app works without internet, it keeps a local database on your
            phone with the product catalogue, stock, customers you looked up or created, and sales not yet uploaded.
            Your sign-in token and basic profile are kept in the Android Keystore through secure storage.
          </li>
          <li>
            <strong>Receipts.</strong> When you print or share a receipt, the app generates it on your phone and
            hands it to the print or share option you choose. We do not receive a copy from that step.
          </li>
        </ul>
        <p>
          The app does not use your location, contacts, microphone, photos or advertising ID, does not contain
          advertising, and does not track you across other apps or websites.
        </p>
      </Section>

      <Section title="3. How we use data">
        <ul>
          <li>To run the Service: authenticate users, record sales, manage stock and produce reports.</li>
          <li>To manage subscriptions and process payments.</li>
          <li>To keep the Service secure, prevent fraud and misuse, and keep audit trails.</li>
          <li>To back up data and fix errors.</li>
          <li>To meet legal obligations.</li>
        </ul>
        <p>We do not sell personal data and we do not use it for advertising.</p>
      </Section>

      <Section title="4. Who has access, and who we share with">
        <ul>
          <li>
            <strong>Within your pharmacy.</strong> Owners and managers can see data for their pharmacy according to
            their role. Staff of one pharmacy cannot see another pharmacy&rsquo;s data.
          </li>
          <li>
            <strong>Platform administrators.</strong> Gene Pharmacy administrators can access account and
            subscription information to provide support and billing.
          </li>
          <li>
            <strong>ClickPesa</strong>, our payment processor, receives the phone number, amount and reference needed
            to send a mobile money payment prompt for subscriptions.
          </li>
          <li>
            <strong>Hosting provider.</strong> Our servers are hosted on a virtual private server, where the database
            and backups are stored.
          </li>
          <li>
            <strong>Error monitoring.</strong> We may use an error-reporting service (Sentry) to receive crash and
            error reports, which can include technical details such as device type and the page or request that
            failed. It is switched on only when we configure it.
          </li>
          <li>
            <strong>Legal.</strong> We may disclose data where required by law or to protect rights, safety and
            security.
          </li>
        </ul>
      </Section>

      <Section title="5. Security">
        <p>
          Data travels over HTTPS. Passwords are hashed, sign-in tokens on the phone are held in secure storage, and
          access is limited by role. Backups are taken daily. No system is perfectly secure, so we cannot guarantee
          absolute security.
        </p>
      </Section>

      <Section title="6. Retention">
        <p>
          We keep pharmacy data while the pharmacy&rsquo;s account is active, and for as long afterwards as needed for
          legal, accounting and audit purposes. Sales not yet uploaded stay on the phone until they sync or you sign
          out and clear the app&rsquo;s data. Backups are rotated and are deleted on a schedule.
        </p>
      </Section>

      <Section title="7. Your choices and rights">
        <p>
          Accounts are created by a pharmacy owner or by us, not in the app. You can ask us to access, correct or
          delete the personal data we hold about you, or to delete your account, by emailing{" "}
          <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          . We will reply within a reasonable time. We may need to keep some records (for example sales and audit
          logs) where the law or a pharmacy&rsquo;s accounting requires it.
        </p>
        <p>
          If you are a pharmacy customer, the pharmacy that recorded your details decides how they are used, so
          contact that pharmacy first. You can also uninstall the app and revoke the camera permission in Android
          settings at any time; uninstalling removes the data stored on your phone.
        </p>
      </Section>

      <Section title="8. Children">
        <p>The Service is for pharmacy staff and is not directed to children. We do not knowingly collect data from children.</p>
      </Section>

      <Section title="9. Changes to this policy">
        <p>
          We may update this policy. The date at the top shows when it last changed, and we will make the update
          available in the app or on this page.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>
          Gene Pharmacy &middot;{" "}
          <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </Section>

      <p className="mt-12 text-sm">
        <Link className="underline" href="/login">
          Back to Gene Pharmacy
        </Link>
      </p>
    </main>
  );
}
