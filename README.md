# Wordle
JavaScript Wordle game for browsers, Node and Discord.js

# How to Setup
- (for Node version <20) The package `dotenv` is used in `src/register.js`, reads four keys from `.env` file, an example is supplied in `example.env`
- Create a Cloudflare Worker
- Create two Cloudflare KV namespaces:
  - `npx wrangler kv namespace create GUESSES`
  - `npx wrangler kv namespace create WORDS`
  - save the returned data in `wrangler.toml`

 # TODO
- add support for multi language words to web