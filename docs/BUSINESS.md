# Business Plan — "Tile & Tea" (working name)

> A beautiful coach for American Mah Jongg. It teaches the game, trains the decisions that matter, and helps players move up from beginner to confident.

## 1. The opportunity

- **American Mah Jongg is booming.** Since about 2022, community classes, library groups, "mahj" social clubs, and Gen-Z/millennial game nights have been bringing in a wave of new players. Many of them are adults learning together, the same way your wife is.
- **Learning it is hard.** New players struggle with the Charleston, reading the card, choosing a hand, using jokers, and knowing when to switch hands or play defense. Today they learn from a teacher, a YouTube video, or by losing at the table.
- **Current apps mostly let you *play*, not *learn*.** Existing American Mah Jongg apps focus on games against bots or friends. Nobody owns **"Duolingo-style structured improvement + a coach that explains why"**. That's our wedge.

## 2. Target customers

| Segment | Need | What they pay for |
|---|---|---|
| **New learners** (largest) | "Don't embarrass me at my first game" | Guided lessons, practice with no pressure |
| **Social improvers** | "I want to win more at my weekly game" | Drills, hand-selection coaching, stats |
| **Teachers / clubs** | "Help my students practice between classes" | Group or teacher licenses, referral codes |

The core users skew women, 35–75, who play socially. Design for readable type, calm visuals, gentle tone, and **no casino-style dark patterns**. This group spends on hobbies they love and spreads the word within their groups. Word of mouth is our main growth channel.

## 3. Product pillars

1. **Learn**: short animated lessons (tiles → hands → Charleston → jokers → calling → defense).
2. **Train**: focused drills with instant, explained feedback. Examples: "Which tiles pass in this Charleston?", "Which hand fits this rack best?", "Is it safe to discard this?"
3. **Play & Review**: full games against bots of rising skill. After each game, a coach replay shows the 3 key decisions and what a strong player would have done.
4. **Progress**: a skill rating per area (Charleston, Hand Selection, Joker Use, Defense), streaks, and a visible path from Beginner → Card Shark.

## 4. ⚠️ The NMJL card: our most important legal constraint

The National Mah Jongg League publishes a new card every year, and **the hands on it are copyrighted**. Apps that show the official hands do so under license. Our plan:

- **Launch (v1):** teach using an **original practice card** of our own design that follows the same structure (year hands, 2468, like numbers, consecutive runs, winds/dragons, etc.). All rules, strategy, and drills teach concepts that carry over to any card. The hands are written from scratch, without studying or adapting any NMJL card from any year. The card has its own visual design (no copying the NMJL card's layout, colors, or typography).
- **Yearly refresh:** release a new "20XX Practice Card" every year (starting with the **2027 Practice Card**), with fresh original hands featuring the new year. It's a yearly marketing moment and a reason for subscribers to stay. It is *not* presented as a prediction of the official card.
- **Open legal question for the IP lawyer:** is a "projected next-year card" ever defensible? Until a lawyer says yes, we don't do it.
- **Later (v2):** a "My Card" mode where users enter hands from a card they bought, for personal use only. Get IP-lawyer sign-off before shipping this.
- **Upside:** approach the NMJL about licensing the official card once we have traction. That would be a major differentiator.
- Never use "NMJL" or "National Mah Jongg League" in the app name, icon, or marketing in a way that implies endorsement.

## 5. Monetization (freemium subscription)

| Tier | Price (suggested) | Includes |
|---|---|---|
| **Free** | $0 | Lessons 1–5, 3 drills/day, games vs. beginner bot |
| **Plus** | $6.99/mo · **$39.99/yr** · $79.99 lifetime | All lessons, unlimited drills, all bots, post-game coach, stats |
| **Clubs** (v2) | $99/yr per teacher | Teacher dashboard, 25 student seats |

- 7-day free trial on the annual plan. Use **RevenueCat** to manage subscriptions on both stores.
- Apple and Google take **15%** under their small-business programs (first $1M/yr). Enroll in both on day one.
- **No ads.** They don't fit the audience or the premium visual promise.

### Back-of-envelope revenue (year 1)

| Scenario | Downloads | Paid conversion | Avg. net revenue / payer / yr | Annual net |
|---|---|---|---|---|
| Conservative | 20,000 | 3% | ~$30 | ~$18k |
| Base | 60,000 | 5% | ~$32 | ~$96k |
| Strong (club/teacher channel works) | 150,000 | 6% | ~$34 | ~$306k |

These are assumptions, not market data. Validate them with a waitlist and TestFlight beta before spending on ads.

## 6. Go-to-market

1. **Pre-launch (now):** landing page + waitlist. Your wife's group is beta cohort #1, and their friction points are the most valuable input we have.
2. **Teachers as distribution:** give mah jongg instructors free Plus plus a 20–30% referral cut. One teacher reaches 20–100 students a year.
3. **Content:** short Instagram/TikTok/Facebook clips of "Which tile would you pass?" puzzles. These come straight out of the drill engine.
4. **App Store optimization:** target "mahjong lessons", "learn mah jongg", "american mahjong practice", "mahjong strategy". Make the screenshots gorgeous.
5. **Communities:** Facebook mah jongg groups, community centers, cruise/retirement communities, local game stores.

## 7. Costs to launch

| Item | Cost |
|---|---|
| Apple Developer Program | $99/yr |
| Google Play Console | $25 one-time |
| Expo EAS (builds/updates) | Free tier to start; ~$19/mo later |
| RevenueCat | Free until $2.5k monthly tracked revenue |
| Domain + landing page | ~$30/yr |
| Original tile art / sound (optional upgrade) | $0–2,000 |
| IP lawyer review (card + name + trademark search) | ~$500–1,500 |
| Business entity (LLC), optional, later | ~$50–500 depending on state |
| Claude usage for the build loop | Variable. Capped per run in `scripts/loop.sh` |

## 8. Milestones

| Milestone | Outcome |
|---|---|
| M0 | Foundation: design system, tile rendering, navigation |
| M1 | Learn: first 5 lessons, beautiful and complete |
| M2 | Rules engine + original practice card + hand recognition |
| M3 | Train: Charleston, hand-selection, and discard drills with explanations |
| M4 | Play: full game vs. bots |
| M5 | Coach: post-game review + skill ratings |
| M6 | Monetization + polish + store submission |

## 9. Risks

| Risk | Mitigation |
|---|---|
| Card copyright | Original practice card; lawyer review; pursue a license |
| Rules accuracy (players will notice mistakes) | Rules engine with exhaustive unit tests; expert beta testers |
| "Pretty but shallow" | Coaching quality is the moat. Every drill explains *why* |
| App Store rejection | Follow guidelines (restore purchases, privacy policy, no gambling framing) |
| Name/trademark conflict | Trademark search before final branding |

## 10. To-do list for you (things the loop can't do)

- [ ] Open a separate checking account for app income/expenses; track expenses from day one
- [ ] Enroll in Apple Developer Program + Google Play Console (individual/sole proprietor is fine; your legal name shows as seller)
- [ ] *Later, if it gains traction:* form an LLC for liability protection (and to show a business name as seller)
- [ ] Apply for Apple Small Business Program + Google's 15% tier
- [ ] Trademark search on the final name
- [ ] IP-lawyer review of the practice-card approach
- [ ] Recruit 5–10 beta testers from your wife's group
- [ ] Create RevenueCat + Expo accounts
