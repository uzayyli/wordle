import { Command, Option, register } from "discord-hono";

const commands = [
  new Command("new", "Start a new Wordle.").options(
    new Option("language", "Select a language").choices(
      {
        name: "English",
        value: "en",
      },

      {
        name: "Türkçe",
        value: "tr",
      }
    )
  ),
  new Command("guess", "Make a Wordle Guess.").options(
    new Option("guess", "Guess").required(true).min_length(5).max_length(5)
  ),
  new Command("ping", "pong"),
  new Command("help", "Get help"),
];

register(
  commands,
  process.env.DISCORD_APPLICATION_ID,
  process.env.DISCORD_TOKEN,
  process.env.DISCORD_TEST_GUILD_ID
);
