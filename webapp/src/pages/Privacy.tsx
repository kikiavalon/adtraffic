import { Link } from 'react-router-dom';
import './Privacy.css';

function Privacy() {
  return (
    <div className="privacy-page">
      <header className="privacy-header">
        <Link to="/login" className="privacy-back">&larr; Back</Link>
        <h1>Privacy Policy</h1>
      </header>

      <main className="privacy-content">
        <p className="privacy-updated">Last updated: March 9, 2026</p>

        <section>
          <h2>What We Collect</h2>
          <ul>
            <li><strong>Account information:</strong> Name, email address, and hashed password when you register.</li>
            <li><strong>Conversation logs:</strong> Your chat messages with Kiki and her responses, stored for continuity.</li>
            <li><strong>CM360 OAuth tokens:</strong> Encrypted access tokens when you connect your Google CM360 account.</li>
            <li><strong>Usage data:</strong> API request counts and token usage for rate limiting and billing.</li>
          </ul>
        </section>

        <section>
          <h2>How We Use Your Data</h2>
          <ul>
            <li><strong>AI-assisted trafficking:</strong> Your messages are sent to Claude (by Anthropic) to generate responses and execute CM360 operations.</li>
            <li><strong>CM360 API calls:</strong> Your OAuth tokens are used to make API calls to Google CM360 on your behalf. Campaign data transits the server to execute those calls; we do not cache it or use it for advertising, but campaign details you discuss are saved in your conversation logs, and a pending write action or QA run temporarily stores the campaign fields it operates on.</li>
            <li><strong>Service improvement:</strong> Aggregated, anonymized usage metrics help us improve the product.</li>
          </ul>
        </section>

        <section>
          <h2>AI Disclosure</h2>
          <p>
            AdTraffic.ai uses artificial intelligence (Claude by Anthropic) to interpret your requests
            and execute CM360 operations. Kiki is an AI assistant — not a human. All AI-generated
            outputs include machine-readable attribution metadata.
          </p>
        </section>

        <section>
          <h2>Data Retention</h2>
          <ul>
            <li><strong>Conversation logs:</strong> retained until deleted. Automatic time-based purging is not yet implemented.</li>
            <li><strong>OAuth tokens:</strong> stored encrypted (AES-256-GCM) until you disconnect your CM360 account.</li>
            <li><strong>Pending write actions:</strong> stored until confirmed, rejected, or their short expiry elapses.</li>
            <li><strong>QA runs:</strong> retain the campaign identifiers they checked, subject to the configured QA retention window.</li>
            <li><strong>Account data:</strong> retained until removed by the operator of your instance.</li>
          </ul>
        </section>

        <section>
          <h2>Data Sharing</h2>
          <p>We never sell your data, and we never use your CM360 campaign data for advertising. We do not keep a separate cache of CM360 data; where campaign data is stored, it is as described under Data Retention.</p>
          <p>Third-party processors:</p>
          <ul>
            <li><strong>Anthropic (Claude):</strong> Processes your chat messages to generate AI responses.</li>
            <li><strong>Google Cloud:</strong> Hosts our infrastructure (Cloud Run, Cloud SQL).</li>
            <li><strong>Sentry:</strong> Error reporting (PII redacted before transmission).</li>
          </ul>
        </section>

        <section>
          <h2>Your Rights</h2>
          <p>
            You can review your conversation history and disconnect your CM360 account in the app.
            Full data export and account deletion are not yet self-service; on a self-hosted
            instance, the operator can remove your data directly. EU residents (GDPR) and California
            residents (CCPA) have additional rights to access, correct, and delete personal data.
          </p>
          <p>Contact: <a href="mailto:privacy@adtraffic.ai">privacy@adtraffic.ai</a></p>
        </section>

        <section>
          <h2>Security</h2>
          <p>
            All data is encrypted in transit (TLS) and at rest. OAuth tokens use AES-256-GCM encryption.
            Our infrastructure runs on Google Cloud with SOC 2 compliance path. See our{' '}
            <a href="https://github.com/kikiavalon/adtraffic/blob/main/SECURITY.md" target="_blank" rel="noopener noreferrer">
              Security Policy
            </a>{' '}
            for vulnerability disclosure.
          </p>
        </section>
      </main>
    </div>
  );
}

export default Privacy;
