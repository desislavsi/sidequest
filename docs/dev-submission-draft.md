---
title: "SideQuest: a local AI mission card that gets families outside"
published: false
tags: devchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).*

## What I Built

Getting outside with children can stall at a very small moment: everyone wants to go, but no one wants the same activity. SideQuest turns that moment into a playable family mission.

Select the people going, what is stopping them, how much time they have, and how far they can travel. Press **GET US OUT**. The result is one complete mission card with a short story, five steps, a bonus, and a **Main Objective** that creates a specific photo opportunity. Photograph the card on your phone or print it on A4, then close the app and go. No mobile site, location tracking, account, photo upload, or proof is required.

The blocker changes the first step. For example, reluctant children get a playful start, a tired family gets an easy route, and a short time budget keeps the mission close to home. Children's interests get priority over adults' interests and rotate across completed missions. On returning, the family marks the mission complete, rates it, and earns XP toward new quest types. The app remembers recent ratings so the next mission can avoid repeating a disliked style.

One live example selected an animal parade for a family with an animal-loving child: find shapes that look like animal features, copy two animal walks, choose a safe parade finish, and lead the parade there. The photo moment happens at the finish, showing a favorite animal walk. The card works as the handoff; the screen has finished its job.

## Demo

**[Add a public video demo link before publishing.]** The contest requires a demo link or video. A 60–90 second recording should show the family setup, blocker selection, local generation, complete card, photo handoff, A4 print preview, completion and XP, then a second mission influenced by progress or rating.

## Code

[SideQuest source code](https://github.com/desislavsi/sidequest). The repository was created within this challenge window. The README contains local setup, test commands, and the demo flow.

## How I Built It

SideQuest is a React and TypeScript interface backed by Fastify, shared Zod contracts, Mastra, and `gemma4:e4b` through local Ollama. Profiles, the active mission, and compact completion history live in one local JSON file. The app sends no family data or photographs to a cloud AI service.

I learned that asking a small local model to invent every line of the card could produce quests that sounded exciting but made little sense: a “game stop” appeared before anyone found one, or the objectives were mostly talking rather than doing. I changed the generation boundary. The server now prepares coherent, interest-based quest plans. Gemma uses the selected family, blocker, time, distance, and recent ratings to **choose an available plan and name it**. Where there is more than one plan, its choice changes the actual activities and photo scene. The server checks the result with Zod and mission quality rules; one repair attempt is allowed. If Ollama is unavailable, the app shows a retryable error rather than pretending a fixture was AI-generated.

That design keeps the model's role real and bounded. It also means the current variety is limited by the available quest plans, especially for an unusual interest with only one plan. I would expand that library and the model's safe choices before claiming unlimited mission generation.

The first live run of the updated flow took about 62 seconds on this computer; a later warm run took about 27 seconds. SideQuest has no arbitrary generation timeout, and the family can cancel a stalled request. Local hardware affects the wait, but the mission rules remain the same.

## Why Does Open Innovation Matter?

Ages, interests, and a history of which missions were boring or great are personal family context. Running Gemma through Ollama on the same computer lets SideQuest use that context without sending it to a hosted model. After installing the software and model, the mission flow can run without an internet connection. The card itself then works on paper or as an ordinary phone photo, with no synchronization service to maintain.

The open setup also made the quality fix possible: I could change the prompt, shorten the model's output, and move fragile story structure into validated local code. The family can use the same app with its own local model and keep its data file on its own machine.

## My Agent Session

<!-- Optional. Add a public DevRelay session only if you choose to share one; otherwise remove this section before publishing. -->

## Prize Categories

- **Best Use of Gemma:** `gemma4:e4b` runs locally through Ollama and chooses and names a family mission from validated quest plans.
- **Best Use of Mastra:** a Mastra agent sends the structured mission choice to the local model, with the server validating the result before saving a card.
