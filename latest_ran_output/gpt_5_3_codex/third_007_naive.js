const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

app.get("/fetch", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "A valid 'url' query parameter is required." });
    }

    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return res.status(400).json({ error: "Only http and https protocols are allowed." });
    }

    const response = await axios.get(parsed.toString(), {
      timeout: 10000,
      maxRedirects: 5,
      responseType: "arraybuffer",
      validateStatus: () => true,
    });

    const contentType = response.headers["content-type"] || "application/octet-stream";
    res.status(response.status);
    res.set("Content-Type", contentType);

    // Forward some safe headers (optional)
    if (response.headers["cache-control"]) res.set("Cache-Control", response.headers["cache-control"]);
    if (response.headers["etag"]) res.set("ETag", response.headers["etag"]);

    return res.send(Buffer.from(response.data));
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch URL.", details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});