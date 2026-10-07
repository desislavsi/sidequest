# Week 1 Touch Grass submission prep

## Rules checked on October 7, 2026

- [Challenge page](https://dev.to/challenges/hacktoberfest-week1-2026-10-05), [week-specific rules](https://dev.to/page/hacktoberfest-week1-2026-10-05-contest-rules), and [general rules](https://dev.to/page/official-hackathon-rules).
- Entry window: October 5, 2026, 9:00 AM PDT through October 11, 2026, 11:59 PM PDT. In Sofia, the deadline is October 12 at 9:59 AM EEST. Submit earlier to allow for upload or site issues.
- One entry per entrant for this challenge; if more than one is submitted, only the first is judged. A team can have up to four people, with one post and all team members' DEV usernames credited.
- The project and repository must be new and completed within the entry window. SideQuest's local folder and its public [GitHub repository](https://github.com/desislavsi/sidequest) were created October 7, 2026.
- Publish a DEV post using the official template and the required `devchallenge` and `hf26challenge` tags. The post needs a demo link or video, a code repository link, and an explanation of why open innovation matters.
- List **Best Use of Gemma** and **Best Use of Mastra** in the Prize Categories section because SideQuest uses both. A project may enter multiple categories it genuinely uses; it can win only one prize per challenge.
- Writing quality carries the most weight, followed by relevance, creativity, technical execution, and relevant partner technology. The contest page gives bonus consideration to taking the project outside, using it, and reporting what happened.
- Eligibility requires an active DEV account, age 18+, and compliance with the official country and other restrictions. The entrant should verify their own eligibility.

## Still needed before publishing

1. Confirm the public [SideQuest repository](https://github.com/desislavsi/sidequest) contains the final code before the deadline. Keep `.data/`, `.env`, and `node_modules/` private as specified by `.gitignore`. Record any post-deadline commits in the README, as DEV requires.
2. Record and upload a real demo video; insert its public URL. Suggested shot order: profiles → blocker/time/distance → GET US OUT → generation → full card → take a phone photo of the card → A4 print preview → complete and rate → XP/level → next mission. A deployed website is unnecessary for this local-only product; the rules accept a video demo.
3. Optional: actually take a mission outside and add a short honest note about what happened. Do not imply an outdoor test occurred if it did not.
4. Remove the optional empty Agent Session section, or add a public session link. Credit any human teammates by DEV handle. Review the draft for personal details and accuracy before pasting it into the official DEV template.
5. Publish one post before the deadline. Check the public post shows both required tags, video, code link, and Prize Categories.

## Local demo commands

```powershell
git clone https://github.com/desislavsi/sidequest.git
cd sidequest
npm install
ollama pull gemma4:e4b
npm run dev
```

Open http://127.0.0.1:5174. SideQuest's state is in `.data/sidequest.json`; do not delete the user's active data for a recording. Use a separate `LOCAL_DATA_FILE` in `.env` or in a temporary demo instance if a clean state is needed.
