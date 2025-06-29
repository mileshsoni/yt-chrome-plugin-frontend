document.addEventListener("DOMContentLoaded", async () => {
  const outputDiv = document.getElementById("output");
  const YOUTUBE_REGEX = /https:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})/;

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const url = tabs[0].url;
    const match = url.match(YOUTUBE_REGEX);

    if (!match || !match[1]) {
      outputDiv.textContent = "Not a valid YouTube video URL.";
      return;
    }

    const videoId = match[1];
    outputDiv.textContent = `Video ID: ${videoId}\nFetching comments...`;

    try {
      const apiKey = "AIzaSyDmZx7nXyq4WkT2FOnfrdzj_kRmiv1f-us"; // 🔁 Replace with your actual API key
      const commentApiUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&key=${apiKey}`;

      const commentRes = await fetch(commentApiUrl);
      const commentData = await commentRes.json();

      if (!commentData.items || commentData.items.length === 0) {
        outputDiv.textContent = "No comments found.";
        return;
      }

      // Extract top 100 comments
      const comments = commentData.items.map(
        item => item.snippet.topLevelComment.snippet.textDisplay
      );

      // Send comments to FastAPI for sentiment analysis
      const predictionRes = await fetch("http://localhost:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments })
      });

      const sentimentResult = await predictionRes.json();

      // Count sentiment types
      const sentimentCounts = { "-1": 0, "0": 0, "1": 0 };
      sentimentResult.forEach(({ sentiment }) => {
        sentimentCounts[sentiment]++;
      });

      const total = sentimentResult.length;
      const percent = (val) => ((val / total) * 100).toFixed(2);

      // HTML output
      let resultHTML = `
        ✅ <b>Total Comments Analyzed:</b> ${total}<br/>
        🔴 Negative (-1): ${percent(sentimentCounts["-1"])}%<br/>
        🟡 Neutral (0): ${percent(sentimentCounts["0"])}%<br/>
        🟢 Positive (+1): ${percent(sentimentCounts["1"])}%<br/><br/>
        <b>📝 Top 25 Comments with Sentiment:</b><br/>
        <ul style="max-height: 300px; overflow-y: auto;">`;

      // Add top 25 comments with sentiment
      sentimentResult.slice(0, 25).forEach((item, idx) => {
        let sentimentLabel = "";
        if (item.sentiment === -1) sentimentLabel = "🔴 Negative";
        else if (item.sentiment === 0) sentimentLabel = "🟡 Neutral";
        else if (item.sentiment === 1) sentimentLabel = "🟢 Positive";

        resultHTML += `<li><b>[${sentimentLabel}]</b> ${item.comment}</li>`;
      });

      resultHTML += "</ul>";
      outputDiv.innerHTML = resultHTML;

    } catch (err) {
      console.error("Error:", err);
      outputDiv.textContent = "❌ Error fetching or predicting comments.";
    }
  });
});
