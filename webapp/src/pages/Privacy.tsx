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
            <li><strong>CM360 API calls:</strong> Your OAuth tokens are used to make API calls to Google CM360 on your behalf. Campaign data transits our servers but is not stored beyond the API call lifecycle.</li>
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
            <li><strong>Conversation logs:</strong> 90 days by default (configurable for enterprise accounts).</li>
            <li><strong>OAuth tokens:</strong> Stored encrypted (AES-256-GCM) until you disconnect your CM360 account.</li>
            <li><strong>Account data:</strong> Retained until you delete your account.</li>
          </ul>
        </section>

        <section>
          <h2>Data Sharing</h2>
          <p>We never sell your data. Your CM360 campaign data is never persisted, cached, or used for advertising purposes.</p>
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
            You can export your conversation history, disconnect your CM360 account, or delete your
            account at any time. EU residents (GDPR) and California residents (CCPA) have additional
            rights to access, correct, and delete personal data.
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
