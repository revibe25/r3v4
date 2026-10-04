# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/core.spec.ts >> Critical flow: play audio
- Location: tests/e2e/core.spec.ts:14:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('[data-test=play-button]')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation "Main navigation" [ref=e4]:
    - generic [ref=e5]:
      - link "Pricing" [ref=e6] [cursor=pointer]:
        - /url: /pricing
      - link "Login" [ref=e10] [cursor=pointer]:
        - /url: /auth
    - generic [ref=e15]:
      - button "DARK" [ref=e16] [cursor=pointer]
      - button "Settings (coming soon)" [ref=e18] [cursor=pointer]
  - generic [ref=e23]:
    - banner [ref=e24]:
      - link "R3 NATIVE pricing" [ref=e25] [cursor=pointer]:
        - /url: /pricing
        - generic [ref=e26]: R3
        - generic [ref=e27]:
          - strong [ref=e28]: R3//NATIVE
          - generic [ref=e29]: PRO AUDIO PLATFORM
      - generic [ref=e30]:
        - generic [ref=e31]: SYSTEM / PRICING
        - link "SIGN IN" [ref=e34] [cursor=pointer]:
          - /url: /login?redirect=/pricing
    - main [ref=e35]:
      - generic [ref=e36]:
        - region [ref=e37]:
          - generic [ref=e38]: R3 V4 / SUBSCRIPTION
          - heading "BUILD YOUR STUDIO. SCALE WHEN YOU'RE READY." [level=1] [ref=e42]: BUILD YOUR STUDIO.SCALE WHEN YOU'RE READY.
          - paragraph [ref=e43]:
            - text: Professional DJ & DAW tools in the browser.
            - strong [ref=e44]: No installs. No dongles.
          - group "Billing cycle" [ref=e45]:
            - button "Monthly" [ref=e46] [cursor=pointer]
            - button "Switch to monthly billing" [pressed] [ref=e47] [cursor=pointer]
            - button "Annual" [pressed] [ref=e49] [cursor=pointer]
            - generic [ref=e50]: Save ~20%
          - generic "R3 pricing capacity signal" [ref=e51]: SIGNAL / PLAN CAPACITY LIVE
        - generic "Platform metrics" [ref=e60]:
          - generic [ref=e61]:
            - generic [ref=e62]: Audio latency
            - generic [ref=e67]: < 3ms
          - generic [ref=e68]:
            - generic [ref=e69]: Active studios
            - generic [ref=e76]: 4K+
          - generic [ref=e77]:
            - generic [ref=e78]: Uptime SLA
            - generic [ref=e82]: 99.9%
          - generic [ref=e83]:
            - generic [ref=e84]: Track length
            - generic [ref=e90]: ∞
        - region "Subscription plans" [ref=e91]:
          - article [ref=e92]:
            - heading "Explorer" [level=2] [ref=e101]
            - paragraph [ref=e102]: Start your journey — free forever
            - generic [ref=e103]:
              - generic [ref=e104]: $
              - generic [ref=e105]: "0"
              - generic [ref=e106]: FOREVER
            - button "Start Free" [ref=e107] [cursor=pointer]
            - list [ref=e110]:
              - listitem [ref=e111]:
                - generic [ref=e112]: ✓
                - generic [ref=e113]: 10 track uploads
              - listitem [ref=e114]:
                - generic [ref=e115]: ✓
                - generic [ref=e116]: 1 saved project
              - listitem [ref=e117]:
                - generic [ref=e118]: ✓
                - generic [ref=e119]: 3 AI transitions / session
              - listitem [ref=e120]:
                - generic [ref=e121]: ✓
                - generic [ref=e122]: mp3 playback
              - listitem [ref=e123]:
                - generic [ref=e124]: ✓
                - generic [ref=e125]: Basic effects library
              - listitem [ref=e126]:
                - generic [ref=e127]: ✓
                - generic [ref=e128]: Community support
              - listitem [ref=e129]:
                - generic [ref=e130]: —
                - generic [ref=e131]: Energy curve analysis
              - listitem [ref=e132]:
                - generic [ref=e133]: —
                - generic [ref=e134]: AI mix dashboard
              - listitem [ref=e135]:
                - generic [ref=e136]: —
                - generic [ref=e137]: Cloud export
              - listitem [ref=e138]:
                - generic [ref=e139]: —
                - generic [ref=e140]: Stem separation
          - article [ref=e141]:
            - generic [ref=e142]:
              - generic [ref=e143]: Creator
              - generic [ref=e149]: Most Popular
            - heading "Creator" [level=2] [ref=e150]
            - paragraph [ref=e151]: Your full creative studio
            - generic [ref=e152]:
              - generic [ref=e153]: $
              - generic [ref=e154]: "8"
              - generic [ref=e155]: / MO
            - paragraph [ref=e156]: BILLED $96 / YEAR
            - button "Start Creator Trial" [ref=e157] [cursor=pointer]
            - list [ref=e160]:
              - listitem [ref=e161]:
                - generic [ref=e162]: ✓
                - generic [ref=e163]: 200 track uploads
              - listitem [ref=e164]:
                - generic [ref=e165]: ✓
                - generic [ref=e166]: 25 saved projects
              - listitem [ref=e167]:
                - generic [ref=e168]: ✓
                - generic [ref=e169]: Unlimited AI transitions
              - listitem [ref=e170]:
                - generic [ref=e171]: ✓
                - generic [ref=e172]: mp3 / wav / flac playback
              - listitem [ref=e173]:
                - generic [ref=e174]: ✓
                - generic [ref=e175]: mp3 320k export
              - listitem [ref=e176]:
                - generic [ref=e177]: ✓
                - generic [ref=e178]: 60 min recording
              - listitem [ref=e179]:
                - generic [ref=e180]: ✓
                - generic [ref=e181]: Energy curve & key analysis
              - listitem [ref=e182]:
                - generic [ref=e183]: ✓
                - generic [ref=e184]: AI mix dashboard
              - listitem [ref=e185]:
                - generic [ref=e186]: ✓
                - generic [ref=e187]: Full effects + chain stacking
              - listitem [ref=e188]:
                - generic [ref=e189]: ✓
                - generic [ref=e190]: Email support (48h)
          - article [ref=e191]:
            - heading "Pro Artist" [level=2] [ref=e201]
            - paragraph [ref=e202]: Perform without limits
            - generic [ref=e203]:
              - generic [ref=e204]: $
              - generic [ref=e205]: "20"
              - generic [ref=e206]: / MO
            - paragraph [ref=e207]: BILLED $240 / YEAR
            - button "Get Pro Artist" [ref=e208] [cursor=pointer]
            - list [ref=e211]:
              - listitem [ref=e212]:
                - generic [ref=e213]: ✓
                - generic [ref=e214]: Unlimited tracks & projects
              - listitem [ref=e215]:
                - generic [ref=e216]: ✓
                - generic [ref=e217]: Unlimited recording
              - listitem [ref=e218]:
                - generic [ref=e219]: ✓
                - generic [ref=e220]: All export formats (wav / flac / mp3)
              - listitem [ref=e221]:
                - generic [ref=e222]: ✓
                - generic [ref=e223]: AI automix mode
              - listitem [ref=e224]:
                - generic [ref=e225]: ✓
                - generic [ref=e226]: Transition graph editor
              - listitem [ref=e227]:
                - generic [ref=e228]: ✓
                - generic [ref=e229]: Stem separation
              - listitem [ref=e230]:
                - generic [ref=e231]: ✓
                - generic [ref=e232]: Rekordbox & Serato import
              - listitem [ref=e233]:
                - generic [ref=e234]: ✓
                - generic [ref=e235]: Project sharing
              - listitem [ref=e236]:
                - generic [ref=e237]: ✓
                - generic [ref=e238]: Priority sample library + early access
              - listitem [ref=e239]:
                - generic [ref=e240]: ✓
                - generic [ref=e241]: Email support (24h)
        - paragraph [ref=e242]:
          - strong [ref=e244]: 14-day free trial on Creator & Pro Artist
          - generic [ref=e245]: NO CREDIT CARD REQUIRED
          - generic [ref=e246]: CANCEL ANYTIME
        - region "LIMITS & STORAGE" [ref=e248]:
          - generic [ref=e254]:
            - generic [ref=e255]:
              - generic [ref=e256]: Explorer
              - generic [ref=e257]:
                - generic [ref=e258]: UPLOADS
                - strong [ref=e259]: 10 tracks
              - generic [ref=e260]:
                - generic [ref=e261]: PROJECTS
                - strong [ref=e262]: "1"
              - generic [ref=e263]:
                - generic [ref=e264]: STEMS
                - strong [ref=e265]: —
            - generic [ref=e266]:
              - generic [ref=e267]: Creator
              - generic [ref=e268]:
                - generic [ref=e269]: UPLOADS
                - strong [ref=e270]: 200 tracks
              - generic [ref=e271]:
                - generic [ref=e272]: PROJECTS
                - strong [ref=e273]: "25"
              - generic [ref=e274]:
                - generic [ref=e275]: STEMS
                - strong [ref=e276]: —
            - generic [ref=e277]:
              - generic [ref=e278]: Pro Artist
              - generic [ref=e279]:
                - generic [ref=e280]: UPLOADS
                - strong [ref=e281]: Unlimited
              - generic [ref=e282]:
                - generic [ref=e283]: PROJECTS
                - strong [ref=e284]: Unlimited
              - generic [ref=e285]:
                - generic [ref=e286]: STEMS
                - strong [ref=e287]: ✓
        - region [ref=e288]:
          - paragraph [ref=e289]: FREQUENTLY ASKED QUESTIONS
          - generic [ref=e290]:
            - button "Can I use my own audio hardware?" [ref=e292] [cursor=pointer]
            - button "How does the AI mix assistant work?" [ref=e298] [cursor=pointer]
            - button "What happens to my projects if I downgrade?" [ref=e304] [cursor=pointer]
            - button "Can I import from Rekordbox or Serato?" [ref=e310] [cursor=pointer]
    - contentinfo [ref=e315]:
      - generic [ref=e316]:
        - strong [ref=e317]: R3//NATIVE
        - generic [ref=e318]: BROWSER-NATIVE CREATIVE ENGINE
      - generic [ref=e319]: CREATE · PRODUCE · PLAY · TRANSFORM
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('App loads', async ({ page }) => {
  4  |   await page.goto('/');
  5  |   await expect(page).toHaveTitle(/R3/);
  6  | });
  7  | 
  8  | test('Basic navigation works', async ({ page }) => {
  9  |   await page.goto('/');
  10 |   await page.click('[data-test=nav-home]');
  11 |   await expect(page).toHaveURL('/');
  12 | });
  13 | 
  14 | test('Critical flow: play audio', async ({ page }) => {
  15 |   await page.goto('/');
> 16 |   await page.click('[data-test=play-button]');
     |              ^ Error: page.click: Test timeout of 30000ms exceeded.
  17 |   await expect(page.locator('[data-test=playing-indicator]')).toBeVisible();
  18 | });
  19 | 
```