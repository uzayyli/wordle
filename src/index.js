import { Hono } from "hono";
import { Button, Components, DiscordHono, Embed } from "discord-hono";
import { ImageResponse } from "workers-og";

import { EN_WORDS, TR_WORDS } from "./words";

// Constants
const WORDS = { en: EN_WORDS, tr: TR_WORDS }; // TODO: fetch(?)

// Utility functions
const getUserFromContext = (c) => c.interaction.member.user.id;
const parseStoredWord = (wordData) => (wordData ? JSON.parse(wordData) : null);
const generateCacheBuster = () => Math.floor(Date.now() / 10000);
const createEmbedFooter = (text) => ({ text });

// Hono app
const hono = new Hono();
const app = new DiscordHono();

// Commands and Components
app
  // Ping Command
  .command("ping", (c) => c.res("pong"))

  .command("help", (c) =>
    c.res({
      content: "📖 **Command Guide**",
      embeds: [
        new Embed()
        .title("Wordle Help")
        .description(
          "🎮 **Commands:**\n- `/start`: Start a new Wordle\n- `/guess`: Make a guess"
        )
        .footer({ text: "Happy wordling!" })
        .color(0x9b59b6),
      ],
      components: new Components().row(
        new Button(c.env.WEBSITE, "Play on our Website", "Link")
      ),
    })
  )

  // Start a New Game
  .command("start", (c) =>
    c.resDefer(async (c) => {
      const user = getUserFromContext(c);
      const language = c.var.language || "en";
      const wordCategory = WORDS[language];
      const word = wordCategory[Math.floor(Math.random() * wordCategory.length)];
      // Reset and store game data
      await c.env.GUESSES.delete(user);
      await c.env.WORDS.put(user, JSON.stringify({ language, word }));
      const embed = new Embed()
        .title("🎮 Wordle Game Started!")
        .description(
          `Guess the 5-letter word within 6 tries! \n\n**Language:** ${language.toUpperCase()}`
        )
        .image({ url: `${c.env.WEBSITE}/wordleImage?user=${user}&guesses=` })
        .footer(
          createEmbedFooter("Good luck! Use /guess to make your first attempt.")
        )
        .color(0x3498db);

      return c.followup({
        embeds: [embed],
        components: new Components().row(
          new Button("end-wordle", "End Game", "Danger").emoji({ name: "❌" })
        ),
      });
    })


  )

  // Guess Command
  .command("guess", (c) =>
    c.resDefer(async (c) => {
      const user = getUserFromContext(c);
      const guess = c.var.guess;

      if (guess.length !== 5) {
        return c.followup({
          content: "❌ Your guess must be exactly 5 characters.",
        });
      }

      const storedData = await c.env.WORDS.get(user);
      if (!storedData) {
        return c.followup({
          content: "❌ No active game found. Start a new game using /start.",
        });
      }

      const { language, word: correctWord } = parseStoredWord(storedData);
      if (!WORDS[language].includes(guess)) {
        return c.followup({
          content: "❌ Not a valid word according to the dictionary.",
        });
      }

      // Update guesses
      const cacheBuster = generateCacheBuster();
      let guesses = (await c.env.GUESSES.get(user))?.split(",") || [];
      guesses.push(guess);

      const isCorrect = guess === correctWord;
      const isGameOver = guesses.length >= 6;

      if (isCorrect || isGameOver) {
        await c.env.GUESSES.delete(user);
        await c.env.WORDS.delete(user);

        const embed = new Embed()
          .title(isCorrect ? "🎉 Congratulations!" : "😞 Game Over!")
          .description(
            isCorrect ?
            `You guessed the word **${correctWord}**! 🎯` :
            `You ran out of guesses! The word was **${correctWord}**.`
          )
          .image({
            url: `${c.env.WEBSITE}/wordleImage?user=${user}&guesses=${encodeURIComponent(
              guesses.join(",")
            )}&rightGuess=${encodeURIComponent(correctWord)}`,
          })
          .footer(createEmbedFooter("Use /start to start a new game."))
          .color(isCorrect ? 0x2ecc71 : 0xe74c3c);

        return c.followup({ embeds: [embed] });
      } else {
        // Continue game
        guesses = guesses.slice(-6);
        await c.env.GUESSES.put(user, guesses.join(","));

        const embed = new Embed()
          .title("🤔 Wordle In Progress")
          .description(`**${c.interaction.member.nick || c.interaction.member.user.username} guessed "${guess}" Guess #${guesses.length}/6**`) // TODO: get server profile name
          .image({
            url: `${c.env.WEBSITE}/wordleImage?user=${user}&guesses=${encodeURIComponent(
              guesses.join(",")
            )}&cache=${cacheBuster}`,
          })
          .footer(
            createEmbedFooter("Keep going! Use /guess for your next attempt.")
          )
          .color(0xf1c40f);

        return c.followup({
          embeds: [embed],
          components: new Components().row(
            new Button("end-wordle", "End Game", "Danger").emoji({
              name: "❌",
            }),
            new Button("refresh", "Refresh", "Secondary").emoji({ name: "🔁" })
          ),
        });
      }
    })
  )
  .component("refresh", (c) =>
    c.resDeferUpdate(async (c) => {
      // Continue game
      const user = getUserFromContext(c);
      const cacheBuster = generateCacheBuster() * 10000; // no cache
      let guesses = (await c.env.GUESSES.get(user))?.split(",") || null;

      if (!guesses)
        return c.followup({
          content: "❌ Interesting.",
        });

      const embed = new Embed()
        .title("🤔 Wordle In Progress")
        .description(`**Guess #${guesses.length}/6**`)
        .image({
          url: `${c.env.WEBSITE}/wordleImage?user=${user}&guesses=${encodeURIComponent(
            guesses.join(",")
          )}&cache=${cacheBuster}`,
        })
        .footer(
          createEmbedFooter("Keep going! Use /guess for your next attempt.")
        )
        .color(0xf1c40f);

      return c.followup({
        embeds: [embed],
        components: new Components().row(
          new Button("end-wordle", "End Game", "Danger").emoji({
            name: "❌",
          }),
          new Button("refresh", "Refresh", "Secondary").emoji({ name: "🔁" })
        ),
      });
    })
  )
  // End Game Command
  .component("end-wordle", (c) =>
    c.resDeferUpdate(async (c) => {
      const user = getUserFromContext(c);

      const storedData = await c.env.WORDS.get(user);
      if (!storedData) {
        return c.followup({
          content: "❌ No active game found. Start a new game using /start.",
        });
      }

      await c.env.GUESSES.delete(user);
      await c.env.WORDS.delete(user);

      const { word: correctWord } = parseStoredWord(storedData);

      const embed = new Embed()
        .title("🚫 Game Ended")
        .description(
          `You've manually ended the game. The word was **${correctWord}**.`
        )
        .footer(createEmbedFooter("Use /start to start a fresh game."))
        .color(0xe74c3c);

      return c.followup({ embeds: [embed] });
    })
  );

// Utility: Generate game grid HTML
const generateGameGridHTML = (guesses, rightGuess) => {
  const styles = {
    body: `
      background: #111111;
      color: #eeeeee;
      font-family: Verdana;
    `,
    gameBoard: `
      display: flex;
      align-items: center;
      flex-direction: column;
    `,
    letterBox: `
      border-radius: 3px;
      margin: 2px;
      font-size: 1.5rem;
      font-weight: 600;
      height: 3rem;
      width: 3rem;
      display: flex;
      justify-content: center;
      align-items: center;
      text-transform: uppercase;
      border: 2px solid gray;
    `,
  };

  let html = `<body style="${styles.body}">`;
  html += `<div id="game-board" style="${styles.gameBoard}">`;

  for (let i = 0; i < 6; i++) {
    const thisGuess = Array.from(guesses[i] || "");
    const letterColors = Array(5).fill("gray");

    for (let g = 0; g < 5; g++) {
      if (rightGuess[g] === thisGuess[g]) letterColors[g] = "green";
    }
    for (let y = 0; y < 5; y++) {
      if (letterColors[y] === "green") continue;
      for (let yr = 0; yr < 5; yr++) {
        if (rightGuess[yr] === thisGuess[y]) {
          letterColors[y] = "yellow";
          break;
        }
      }
    }

    html += `<div class="letter-row" style="display: flex;">`;
    for (let j = 0; j < 5; j++) {
      const backgroundColor = thisGuess[j] ? letterColors[j] : "transparent";
      const content = thisGuess[j] || "";

      html += `<div class="letter-box" style="${
        styles.letterBox
      }; background-color: ${backgroundColor}; border: 2px solid ${
        content ? "black" : "gray"
      };">${content}</div>`;
    }
    html += `</div>`;
  }

  html += `</div></body>`;
  return html;
};

// Render Game Grid Endpoint
hono.get("/wordleImage", async (c) => {
  const guesses = c.req.query("guesses").split(",");
  const storedData = await c.env.WORDS.get(c.req.query("user"));

  const correctWord = parseStoredWord(storedData)?.word || c.req.query("rightGuess") || "";
  const html = generateGameGridHTML(guesses, Array.from(correctWord));

  console.log("answer", correctWord);

  return new ImageResponse(html, { width: 260, height: 312 });
});

// Mount app
hono.mount("/interaction", app.fetch);

export default hono;