# SideQuest

SideQuest turns a family's reason to stay inside into an original real-world mission. Gemma runs locally through Ollama and Mastra. The complete card can be photographed or printed; the app stores no photos.

## Run locally

1. Install Node 24+ and Ollama, then pull the local model: `ollama pull gemma4:e4b`. On this machine Ollama is at `D:\Ollama\ollama.exe`; use its full path if `ollama` is not on `PATH`.
2. Run `npm install` in this directory.
3. Copy `.env.example` to `.env` if you need custom ports or paths.
4. Run `npm run dev` and open <http://127.0.0.1:5174>.

Three editable example profiles appear on first run. Local state is stored in `.data/sidequest.json`; deleting that file resets the demo. The app serves only on the local computer. There is no account, mobile site, QR code, cloud AI, photo upload, or fixture mission fallback.

## Checks

Run `npm test` and `npm run build` for automated checks. With Ollama running and the model installed, run `npm run smoke:gemma` for one live generation or `npm run smoke:blockers` for all six blockers. Run `npm run smoke:gemma -w apps/api -- 1` to check the seeded Gaming interest. Local generation time depends on the computer. The server prepares connected challenge plans from the featured child's interest. It rotates the preferred plan over completed missions, changes it when a new mission type unlocks, and avoids similar plans rated Boring. Gemma chooses between available plans using the setup and recent ratings, then names the chosen quest. This choice changes the activities and photo scene when more than one plan exists. The server owns each plan's short premise, tasks, and photo scene so they stay consistent, checks the complete card, and makes one repair attempt if needed. The demo flow is: choose all three family members, select **Kids don't want to go**, **1 hour**, and **Walking distance**, create the mission, photograph or print the card, complete it as **Great!**, and create another mission. Moni starts close to Level 5 so a one-hour mission levels her up and unlocks Adventure missions.

Mission generation requires local AI. If Ollama is stopped, the model is missing, or two attempts fail quality validation, SideQuest shows a retryable error and does not save a mission. There is no generation time limit; use **Cancel generation** if you do not want to keep waiting. The card highlights the photo task as the **Main Objective**, but no photo is uploaded or required as proof.
