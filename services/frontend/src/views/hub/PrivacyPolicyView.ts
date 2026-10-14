import { FONT, hubPanel, panelTitle, backButton } from './panel';

export class PrivacyPolicyView {
  private container: HTMLElement;
  private onBack: () => void;

  constructor(container: HTMLElement, onBack: () => void) {
    this.container = container;
    this.onBack = onBack;
  }

  public render(): void {
    const textStyle = `${FONT} font-size:clamp(9px, 1.8vw, 12px); line-height:1.8;`;
    const headingStyle = `${FONT} font-size:clamp(11px, 2.2vw, 14px);`;

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('PRIVACY POLICY')}

      <div class="w-full max-w-3xl text-white text-left overflow-y-auto" style="max-height:60vh; padding-right:8px;">

        <p class="mb-4 text-gray-300" style="${textStyle}">
          <strong>Last updated:</strong> October 2026
        </p>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">1. Introduction</h3>
        <p class="text-gray-200 mb-3" style="${textStyle}">
          Pokemon Transcendence ("the Application") is a web-based tactical multiplayer game developed
          as an academic project by students at 42Malaga (Fundacion Telefonica). This Privacy Policy
          explains how we collect, use, and protect your personal data when you use the Application.
        </p>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">2. Data Controller</h3>
        <p class="text-gray-200 mb-3" style="${textStyle}">
          The data controllers are the project team members: jesumore, crmunoz-, sbenitez, and jvalle-d,
          students at 42Malaga, Fundacion Telefonica. For any data-related inquiries, please contact the
          team through the application's communication channels.
        </p>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">3. Data We Collect</h3>
        <p class="text-gray-200 mb-1" style="${textStyle}">We collect the following personal data:</p>
        <ul class="text-gray-200 mb-3 list-disc pl-6" style="${textStyle}">
          <li><strong>Account information:</strong> email address, username, age, and password (stored securely hashed with scrypt).</li>
          <li><strong>Profile data:</strong> chosen avatar, player level, coin balance, and game statistics.</li>
          <li><strong>Authentication data:</strong> session tokens stored in HttpOnly cookies; optional Google OAuth tokens; optional TOTP secrets for two-factor authentication.</li>
          <li><strong>Game data:</strong> match history, Pokemon inventory, trades, auction activity, and in-game progression.</li>
          <li><strong>Chat messages:</strong> direct messages sent to other users within the application.</li>
          <li><strong>Technical data:</strong> connection timestamps and WebSocket session information for real-time gameplay.</li>
        </ul>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">4. How We Use Your Data</h3>
        <p class="text-gray-200 mb-1" style="${textStyle}">Your data is used for:</p>
        <ul class="text-gray-200 mb-3 list-disc pl-6" style="${textStyle}">
          <li>Providing and maintaining your user account and game experience.</li>
          <li>Enabling multiplayer features: matchmaking, real-time game synchronization, chat, and social features (friends, trading, auctions).</li>
          <li>Authenticating your identity and securing your account (password verification, 2FA, session management).</li>
          <li>Tracking game statistics, progression, and leaderboard rankings.</li>
        </ul>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">5. Data Storage and Security</h3>
        <ul class="text-gray-200 mb-3 list-disc pl-6" style="${textStyle}">
          <li>All data is stored in a SQLite database on the application server.</li>
          <li>Passwords are hashed using the scrypt algorithm with unique salts; they are never stored in plaintext.</li>
          <li>All communications between your browser and the server are encrypted using HTTPS/WSS (TLS).</li>
          <li>Authentication tokens are stored in HttpOnly, Secure, SameSite cookies to prevent XSS and CSRF attacks.</li>
          <li>The server enforces security headers including Content-Security-Policy, HSTS, and X-Frame-Options.</li>
        </ul>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">6. Third-Party Services</h3>
        <ul class="text-gray-200 mb-3 list-disc pl-6" style="${textStyle}">
          <li><strong>Google OAuth 2.0:</strong> if you choose to sign in with Google, we receive your email and basic profile from Google. We do not share your data with Google beyond the authentication flow.</li>
          <li><strong>PokeAPI / Pokemon Showdown:</strong> the application fetches public Pokemon data and sprites from these services. No personal data is sent to them.</li>
        </ul>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">7. Data Sharing</h3>
        <p class="text-gray-200 mb-3" style="${textStyle}">
          We do not sell, rent, or share your personal data with any third party.
          Your username, avatar, level, and game statistics are visible to other users of the Application
          through profiles, friend lists, leaderboards, and match lobbies. Chat messages are visible
          only to the intended recipients.
        </p>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">8. Data Retention</h3>
        <p class="text-gray-200 mb-3" style="${textStyle}">
          Your data is retained for as long as your account is active. As this is an academic project,
          all data may be deleted when the project is concluded or the server is decommissioned.
          You may request the deletion of your account and associated data at any time by contacting
          the development team.
        </p>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">9. Your Rights</h3>
        <p class="text-gray-200 mb-1" style="${textStyle}">Under applicable data protection laws (including GDPR), you have the right to:</p>
        <ul class="text-gray-200 mb-3 list-disc pl-6" style="${textStyle}">
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your account and data.</li>
          <li>Withdraw consent for optional processing (e.g., Google OAuth).</li>
          <li>Export your data in a portable format.</li>
        </ul>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">10. Cookies</h3>
        <p class="text-gray-200 mb-3" style="${textStyle}">
          The Application uses strictly necessary cookies for authentication (session JWT).
          No analytics, advertising, or tracking cookies are used. By using the Application,
          you consent to the use of these essential authentication cookies.
        </p>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">11. Age Requirements</h3>
        <p class="text-gray-200 mb-3" style="${textStyle}">
          The Application collects your age during registration. Users under the age of 13 are not
          permitted to create an account, in compliance with applicable child protection regulations.
        </p>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">12. Changes to This Policy</h3>
        <p class="text-gray-200 mb-3" style="${textStyle}">
          We may update this Privacy Policy as the Application evolves. Changes will be reflected
          by an updated "Last updated" date at the top of this page.
        </p>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">13. Contact</h3>
        <p class="text-gray-200 mb-3" style="${textStyle}">
          For any questions regarding this Privacy Policy or your personal data, please contact the
          development team at 42Malaga or through the application's in-game communication features.
        </p>

      </div>

      ${backButton()}
      `,
      { minHeight: 820 }
    );

    document.getElementById('btn-back')?.addEventListener('click', () => this.onBack());
  }
}
