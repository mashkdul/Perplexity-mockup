import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = 4000;

app.get("/stream-campaign", (req, res) => {
  const { campaignName, objective, sources = "", channels = "" } = req.query;
  const selectedChannels = channels.split(",");

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let chunkCount = 0;

  const interval = setInterval(() => {
    chunkCount++;

    // Simulate incremental generation
    const perChannel = selectedChannels.map((ch) => ({
      channel: ch,
      message: {
        text: `Sample ${ch} message part ${chunkCount} for "${campaignName}"`,
      },
    }));

    const payload = {
      campaign_id: `CMP-${Math.floor(Math.random() * 10000)}`,
      campaign_name: campaignName,
      objective: objective,
      strategy: {
        sources: sources.split(","),
        per_channel: perChannel,
      },
    };

    // Stream partial payload as JSON string
    res.write(`data: ${JSON.stringify(payload)}\n\n`);

    if (chunkCount >= 3) { // simulate 3 streaming chunks
      clearInterval(interval);
      res.write("data: [END]\n\n");
      res.end();
    }
  }, 800); // stream every 800ms
});

app.listen(PORT, () => {
  console.log(`SSE backend running at http://localhost:${PORT}`);
});
