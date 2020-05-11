## biz-scraper

Stack: Node, Express, Socket.IO, Redis, Mongoose/MongoDB, Tensorflow

#### What it does:
- Fetch & Store /biz/ threads (OP only)
- Keep time-series data for the amounts of new threads and replies
- Classify the level of toxic language with a Tensorflow model
- Optimize & store OP images, compare p-hashes to avoid duplicates
- Create a socket.io API server in a worker thread to expose various aggregated stats to clients (e.g. most used phrases and images for the past 24h, most popular threads in the past 30 min, etc.)
