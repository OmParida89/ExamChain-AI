# Round 2 — Offline Round Submission

## The Challenge

**"Load and Capacity: Drift Indicator"** — extend the project with something related to limited capacity, demand, or workload, and show when the current situation has drifted away from what was originally planned/recorded.

## Our Interpretation

ExamChain's whole pitch is that every student gets a **unique version (variant)** of each question, so copying answers doesn't work. But each question only has a **fixed, limited number of variants** — usually 5, decided by the teacher when the question is created. That's a real, literal "capacity."

As more students take the exam, that's "demand." If demand ever goes past capacity — say 8 students but only 5 variants — the system has no choice but to start repeating variants. Before this round, that just happened silently. Nobody was told. We built a set of features that make this (and related "is everything still going according to plan?" situations) visible to the teacher, live, while the exam is happening — not just after the fact.

We ended up building five connected pieces. Here they are, explained simply.

---

## 1. Capacity & Drift Indicator (the core answer to the challenge)

**The problem:** A question has, say, 3 unique variants. If 5 students take the exam, at least 2 of them are guaranteed to get the exact same version of that question — silently. The system was designed to promise "no repeats," and once demand outgrows the recorded capacity, that promise quietly breaks.

**What we built:** A panel on the teacher's exam page that shows, for every question:
- **Capacity** — how many unique variants exist (decided when the question was written)
- **Demand** — how many students have actually started the exam
- A bar that fills up green while there's enough capacity, and turns red once it's exceeded
- If it *has* drifted, the exact names of which students ended up with the same variant as each other

**Why it matters:** The teacher doesn't have to guess or dig through data — they get a plain warning: *"⚠️ Drift detected — Variant #2 shared by: Alice, Bob, Charlie."*

---

## 2. Auto-Submit, Done Properly

**The problem:** The exam already had a countdown timer that would submit automatically when time ran out. But it had two rough edges:
1. If the auto-submit request took even a second or two to reach the server (normal network delay), the server would count it as "late" and give the student a **zero** — even though they finished exactly on time.
2. The student saw the exact same "thank you" message whether they submitted normally or the clock ran out on them. No distinction.

**What we built:**
- A small **grace window** (8 seconds) on the server, so an honest submission that arrives just slightly after the deadline — because of normal internet lag — is still graded properly instead of being zeroed out.
- A clear, different message when the timer really did run out: **"⏰ Time's up! Your exam was automatically submitted."**

**Why it matters:** Time is the most obvious "limited capacity" in an exam. This makes sure running out of it is handled fairly and communicated clearly, not silently and unfairly.

---

## 3. Tab-Switch Proctoring

**The problem:** Nothing stopped a student from switching to another browser tab (say, to look something up) during the exam, and nobody would ever know.

**What we built:** The exam page now notices every time the student switches away from the tab. Each time it happens:
- A counter goes up
- The student sees an on-screen warning immediately: **"⚠️ Tab left: 2"** — so they know it's being recorded, in real time, not after the fact
- The count is saved and later shown to the teacher, both in a live view and in the final results table

**Why it matters:** This is a "workload" signal in the sense the challenge described — it tracks a form of exam-taking behavior that reflects on integrity, and makes it visible instead of invisible.

---

## 4. Live Exam Activity (for the teacher)

**The problem:** While students are taking an exam, a teacher had no way to see what's happening *during* it. They'd only find out afterward, from the final results.

**What we built:** A live panel on the teacher's dashboard listing every student and their current status:
- 🟢 **In Progress** — still taking the exam
- ✅ **Submitted** — finished normally
- ⏰ **Timed Out** — ran out of time
- Plus their tab-switch count next to their name

The teacher can hit "🔄 Refresh" any time to get the latest picture.

**Why it matters:** This turns the exam from something the teacher just "sets and forgets" into something they can actually observe and manage while it's happening — directly matching the challenge's ask for something "properly observed."

---

## 5. Teacher Workload Overview

**The problem:** Once a teacher has multiple exams running (maybe across different classes), checking each one individually for drift or issues is tedious — that itself becomes a workload problem.

**What we built:** Small badges right on the main exam list, without needing to click into anything:
- ⚠️ Drift (1)
- 🟢 4 in progress
- ⏰ 2 timed out
- 🚩 1 flagged (excessive tab-switching)

A quiet exam with nothing going on shows no badges at all — so the teacher's eye is only drawn to exams that actually need attention.

**Why it matters:** This is the "workload" side of the challenge — reducing the effort needed to stay on top of several exams at once, at a glance, from one screen.

---

## A Bug We Caught Along the Way

While building the Live Activity view, we noticed the results/leaderboard calculation didn't filter out exams that were still in progress. That's an in-the-weeds detail, but the plain-English version is: **an unfinished attempt could have quietly messed up other students' percentile rankings.** We fixed the underlying calculation so it only ever counts fully-finished attempts. Small fix, but it protects the fairness the whole platform is built around.

---

## The Design Principle Behind All of This

We didn't add any complicated new systems. Every one of these features is built by **reading data the app was already collecting** (which variant a student got, when they started, when they submitted, how many times they left the tab) and simply **surfacing it clearly** at the right moment, instead of leaving it invisible in the database. Nothing here required big new infrastructure — just paying attention to information that already existed and making it visible where it's actually useful: live, during the exam, to the person responsible for it.

---

## How to See It Working (Demo Flow)

1. Teacher creates an exam, adds a question (which gets a handful of unique variants), and locks it
2. Several students join and start the exam
3. Teacher opens the exam and immediately sees the **Capacity & Drift** panel and **Live Activity** panel update
4. One student switches tabs a couple of times — the teacher's view (on refresh) shows their tab-switch count go up, and the student themselves sees a warning on their own screen
5. A student lets the timer run out — they get the "Time's up!" message, and the teacher's Live Activity panel shows them as "⏰ Timed Out"
6. Back on the main exam list, the teacher sees at-a-glance badges for all of this without opening the exam at all
