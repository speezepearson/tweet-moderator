- Remove OpenAI support.

- Use system prompts, instead of smushing the effectively-a-system-prompt and a tweet into a single message.

- Overhaul the classifier's prompting system. If a bad tweet gets through, make it easy for the user to (a) point it out to the extension, (b) see the extension's reasoning for why it thought it was okay, and (c) explain their own reasoning for why it's actually bad. When a new tweet is under moderation, the AI should see many/all of the historical examples of "tweet that made it through / explanation for why it's bad."

- Converse to the above: have a mode where the user can see the bad tweets (maybe outline them in red instead of hiding them), and explain why any of them is actually okay.

- Make all tweets opacity:0 until they've been cleared by the moderator.

- If a tweet contains images, include those images in the moderator AI query.

- Extend the model to include not just Twitter, but arbitrary feeds. Make it easy to extend, given just a site and a ~CSS selector. E.g. if I know "on facebook.com, here's how to select all the news-feed posts," I should be able to make a couple simple changes to this code base and have it moderate my news-feed posts too.