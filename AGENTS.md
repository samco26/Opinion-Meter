# Project instructions

For anyone, human or AI, changing this repository.

- Read README.md first. It is the specification. Stay within the current version's scope (v1: Google results only).
- The owner has no computer-science background. Explain decisions in plain language and use the README's words: server, door, memory, label, hands, brain, drawer, subject, gauge, card.
- The extension stays dumb. Keys, thinking and memory live only on the server. Never put a key, a prompt or analysis logic in `extension/`.
- Never commit `.env` files, credentials, tokens or session data. `.env.example` lists names only.
- Honest numbers: every split is counted from per-opinion classifications; fewer than eight on-topic opinions means no verdict; the count is always shown. Never fabricate evidence, links or opinions. Label simulated data clearly.
- Fail closed on Google: if the results page cannot be read with confidence, draw nothing. Respect the config door's kill switch before doing anything on a page.
- People are never subjects. The subject-naming step must return nothing for a named individual.
- Store only derived answers (counts, sentence, links) for at most 24 hours. Verbatim excerpts are fetched live. Do not store platform content.
- Read platforms only through their official APIs, within the limits described in the Reddit application (README section 10). Never scrape platform websites.
- Send the server only what the README's privacy section says is sent. If a change needs more, update the privacy section and the privacy page in the same commit.
- Keep source connectors separate, each returning the shared item format with an explicit availability status. An unavailable source must not prevent an answer from the others.
- TypeScript throughout. Do not add dependencies without a concrete reason.
- Run the golden set against any change to subject naming, classification or counting before calling it done. Report checks that could not run.
- Keep README.md accurate: components, costs, scope and the decisions log. Add a dated row to the decisions log whenever a decision in it changes.
- Commit each verified working checkpoint. Keep the GitHub repository private unless the owner says otherwise.
