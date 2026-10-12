---
title: "SideQuest: Turn ‘we should get out, but…’ into a family quest"
published: false
tags: devchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)*

## What I Built

SideQuest turns a familiar family stalemate — “We should get out of the house, but…” — into one playable outdoor mission.

Before generating a quest, the family chooses who is going, what is getting in the way, how much time they have, and how far they can travel. The blocker changes the kind of mission SideQuest creates. Children’s interests shape the theme and required activities, and the youngest participant sets the reading level.

The result is a complete mission card with a short premise, five objectives, a bonus, and one specific Main Objective that creates a photo moment. The family can photograph the card or print it on A4, then put the screen away. After the outing, they confirm completion, rate it, and earn XP toward levels and new mission types.

SideQuest is for families who want to go outside together but need an easy idea that works for their time, energy, and interests.

## Demo

[Watch the SideQuest demo on YouTube](https://youtu.be/_0JU-WzOz3w)

## Code

[desislavsi/sidequest on GitHub](https://github.com/desislavsi/sidequest)

## How I Built It

SideQuest uses React and TypeScript for the interface, Fastify for the local API, Zod for shared schemas and validation, and Mastra to orchestrate Gemma 4 E4B through Ollama. The model runs on the family’s computer. The server prepares connected quest plans around the featured child’s interest, then Gemma chooses and names a quest using the family’s setup and recent feedback. Server checks keep the objectives, story, and photo task consistent. Profiles, the active mission, and compact completion history live in a local JSON file.

There are no accounts, location tracking, cloud AI requests, or photo uploads. After the model is installed, generation can work without an internet connection.

## Why Does Open Innovation Matter?

Family names, ages, interests, and outing history are personal. Running an open-weight model locally means SideQuest can use those details without sending them to a hosted AI service. It also lets families inspect and change how their missions are generated, and lets developers replace the model or adjust the rules without rebuilding the product around a closed API. Open models make privacy and adaptation part of the product itself, rather than a promise attached to a remote service.

## Prize Categories

- Best Use of Gemma
- Best Use of Mastra
