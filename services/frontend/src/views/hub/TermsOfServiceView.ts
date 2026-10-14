import { FONT, hubPanel, panelTitle, backButton } from './panel';

export class TermsOfServiceView {
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
      ${panelTitle('TERMS OF SERVICE')}

      <div class="w-full max-w-3xl text-white text-left overflow-y-auto" style="max-height:60vh; padding-right:8px;">

        <p class="mb-4 text-gray-300" style="${textStyle}">
          <strong>Last updated:</strong> October 2026
        </p>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">1. Acceptance of Terms</h3>
        <p class="text-gray-200 mb-3" style="${textStyle}">
          By accessing or using Pokemon Transcendence ("the Application"), you agree to be bound by these
          Terms of Service. If you do not agree, please do not use the Application. The Application is an
          academic project developed by students at 42Malaga (Fundacion Telefonica) and is provided on an
          "as is" basis.
        </p>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">2. Description of Service</h3>
        <p class="text-gray-200 mb-3" style="${textStyle}">
          The Application is a web-based tactical multiplayer game featuring a hexagonal board, Pokemon-themed
          combat, resource management, and social features including chat, trading, and auctions. It is developed
          solely for educational purposes as part of the ft_transcendence project at 42Malaga.
        </p>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">3. Account Registration</h3>
        <ul class="text-gray-200 mb-3 list-disc pl-6" style="${textStyle}">
          <li>You must provide a valid email address and create a secure password to register.</li>
          <li>You must be at least 13 years old to create an account.</li>
          <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
          <li>You are responsible for all activity that occurs under your account.</li>
          <li>You may optionally enable Two-Factor Authentication (2FA) for additional security.</li>
          <li>You may optionally sign in using Google OAuth 2.0.</li>
        </ul>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">4. User Conduct</h3>
        <p class="text-gray-200 mb-1" style="${textStyle}">When using the Application, you agree NOT to:</p>
        <ul class="text-gray-200 mb-3 list-disc pl-6" style="${textStyle}">
          <li>Use the chat system to harass, threaten, or send abusive messages to other users.</li>
          <li>Attempt to exploit bugs, glitches, or vulnerabilities in the game or server.</li>
          <li>Use automated tools, bots, or scripts to interact with the Application (outside the built-in AI opponents).</li>
          <li>Impersonate other users or misrepresent your identity.</li>
          <li>Attempt to gain unauthorized access to other users' accounts or data.</li>
          <li>Interfere with the normal operation of the Application or its infrastructure.</li>
          <li>Use the Application for any illegal or unauthorized purpose.</li>
        </ul>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">5. In-Game Economy</h3>
        <ul class="text-gray-200 mb-3 list-disc pl-6" style="${textStyle}">
          <li>The in-game currency (coins), items (Pokeballs, evolution stones, rare candies), and Pokemon have no real-world monetary value.</li>
          <li>Trading, gifting, and auctioning of in-game assets are features of the Application and do not constitute real financial transactions.</li>
          <li>The development team reserves the right to modify the in-game economy, item values, or Pokemon statistics at any time for balancing purposes.</li>
        </ul>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">6. Intellectual Property</h3>
        <p class="text-gray-200 mb-3" style="${textStyle}">
          Pokemon, its characters, names, and related imagery are trademarks and copyrights of Nintendo,
          Game Freak, and The Pokemon Company. This Application uses Pokemon data and sprites from PokeAPI
          and Pokemon Showdown for educational purposes only. This project is non-commercial and is not
          affiliated with, endorsed by, or connected to Nintendo, Game Freak, or The Pokemon Company.
          The Application code is developed by the project team as part of the 42 school curriculum.
        </p>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">7. Multiplayer and Fair Play</h3>
        <ul class="text-gray-200 mb-3 list-disc pl-6" style="${textStyle}">
          <li>The game server is the authoritative source of truth for all game state. Client-side manipulation will not affect the actual game outcome.</li>
          <li>Intentional disconnection to avoid losing a match may be penalized (e.g., forfeit).</li>
          <li>The team reserves the right to suspend accounts that repeatedly violate fair play rules.</li>
        </ul>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">8. Availability and Modifications</h3>
        <ul class="text-gray-200 mb-3 list-disc pl-6" style="${textStyle}">
          <li>The Application is provided "as is" without warranty of any kind. As an academic project, uptime and availability are not guaranteed.</li>
          <li>The development team may modify, update, or discontinue the Application at any time without prior notice.</li>
          <li>Game data (accounts, Pokemon, match history) may be reset or deleted during development or when the project concludes.</li>
        </ul>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">9. Limitation of Liability</h3>
        <p class="text-gray-200 mb-3" style="${textStyle}">
          The development team shall not be liable for any direct, indirect, incidental, or consequential
          damages arising from the use or inability to use the Application. This includes, but is not limited
          to, loss of game data, account access issues, or service interruptions.
        </p>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">10. Account Termination</h3>
        <p class="text-gray-200 mb-3" style="${textStyle}">
          The development team reserves the right to suspend or terminate accounts that violate these
          Terms of Service. You may also request the deletion of your account at any time by contacting
          the development team.
        </p>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">11. Changes to Terms</h3>
        <p class="text-gray-200 mb-3" style="${textStyle}">
          These Terms may be updated as the Application evolves. Continued use of the Application
          after changes constitutes acceptance of the updated Terms. The "Last updated" date at the
          top of this page reflects the most recent revision.
        </p>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">12. Governing Law</h3>
        <p class="text-gray-200 mb-3" style="${textStyle}">
          These Terms are governed by the laws of Spain. Any disputes arising from the use of the
          Application shall be subject to the jurisdiction of the courts of Malaga, Spain.
        </p>

        <h3 class="text-yellow-400 mb-2 mt-4" style="${headingStyle}">13. Contact</h3>
        <p class="text-gray-200 mb-3" style="${textStyle}">
          For questions about these Terms of Service, please contact the development team at 42Malaga
          or through the application's in-game communication features.
        </p>

      </div>

      ${backButton()}
      `,
      { minHeight: 820 }
    );

    document.getElementById('btn-back')?.addEventListener('click', () => this.onBack());
  }
}
