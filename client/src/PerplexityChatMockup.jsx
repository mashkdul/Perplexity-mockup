import React, { useState, useRef } from "react";

export default function App() {
  const [connectedSources, setConnectedSources] = useState({
    facebook: false,
    website: false,
    shopify: false,
  });
  const [selectedChannels, setSelectedChannels] = useState({
    email: true,
    sms: false,
    whatsapp: false,
    messenger: false,
  });
  const [campaignName, setCampaignName] = useState("September Sales Clearing");
  const [objective, setObjective] = useState("conversion");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [finalPayload, setFinalPayload] = useState(null);
  const [liveBubbles, setLiveBubbles] = useState({});
  const [typingStatus, setTypingStatus] = useState({});
  const eventSourceRef = useRef(null);

  const toggleSource = (src) =>
    setConnectedSources((s) => ({ ...s, [src]: !s[src] }));
  const toggleChannel = (ch) =>
    setSelectedChannels((c) => ({ ...c, [ch]: !c[ch] }));

  function randomTypingSpeed() {
    return Math.floor(Math.random() * 40) + 20; // 20-60ms per char
  }

  function randomStartDelay() {
    return Math.floor(Math.random() * 800); // 0-800ms delay
  }

  function addMessage(channel, from, text) {
    const typingSpeed = randomTypingSpeed();
    const startDelay = randomStartDelay();

    setTimeout(() => {
      setTypingStatus((prev) => ({ ...prev, [channel]: true }));
      setLiveBubbles((prev) => {
        const channelMsgs = prev[channel] || [];
        return { ...prev, [channel]: [...channelMsgs, { from, text: "", fullText: text }] };
      });

      let idx = 0;
      const interval = setInterval(() => {
        setLiveBubbles((prev) => {
          const channelMsgs = prev[channel] || [];
          const updated = channelMsgs.map((msg, i) =>
            i === channelMsgs.length - 1
              ? { ...msg, text: msg.fullText.slice(0, idx) }
              : msg
          );
          return { ...prev, [channel]: updated };
        });

        idx++;
        if (idx > text.length) {
          clearInterval(interval);
          setTypingStatus((prev) => ({ ...prev, [channel]: false }));
        }
      }, typingSpeed);
    }, startDelay);
  }

  function startStreaming() {
    if (isStreaming) return;
    setIsStreaming(true);
    setStreamText("");
    setFinalPayload(null);
    setLiveBubbles({});
    setTypingStatus({});

    const query = new URLSearchParams({
      campaignName,
      objective,
      sources: Object.keys(connectedSources).filter((k) => connectedSources[k]).join(","),
      channels: Object.keys(selectedChannels).filter((k) => selectedChannels[k]).join(","),
    });

    const es = new EventSource(`http://localhost:4000/stream-campaign?${query.toString()}`);
    eventSourceRef.current = es;
    let buffer = "";

    es.onmessage = (event) => {
      if (event.data === "[END]") {
        es.close();
        setIsStreaming(false);
        try {
          const finalData = JSON.parse(buffer);
          setFinalPayload(finalData);
          finalData.strategy.per_channel.forEach((ch) => {
            addMessage(ch.channel, "user", ch.message.text || ch.message.body);
          });
        } catch (err) {
          console.error("Error parsing final JSON:", err);
        }
      } else {
        buffer += event.data + "\n";
        setStreamText((s) => s + event.data + "\n");
      }
    };

    es.onerror = () => {
      es.close();
      setIsStreaming(false);
    };
  }

  function stopStreaming() {
    if (eventSourceRef.current) eventSourceRef.current.close();
    setIsStreaming(false);
  }

  function downloadJSON() {
    if (!finalPayload) return;
    const blob = new Blob([JSON.stringify(finalPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (finalPayload.campaign_id || "campaign") + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="col-span-1 bg-white p-6 rounded-2xl shadow">
          <h2 className="text-lg font-semibold mb-4">Connect data sources</h2>
          <div className="space-y-3">
            {["facebook","website","shopify"].map((s) => (
              <div key={s} className="flex items-center justify-between">
                <div className="font-medium capitalize">{s}</div>
                <button
                  onClick={() => toggleSource(s)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    connectedSources[s] ? "bg-green-100 text-green-800" : "bg-slate-100"
                  }`}
                >
                  {connectedSources[s] ? "Connected" : "Connect"}
                </button>
              </div>
            ))}
          </div>

          <hr className="my-4" />
          <h2 className="text-lg font-semibold mb-3">Channels</h2>
          <div className="grid grid-cols-2 gap-2">
            {["Email","SMS","WhatsApp","Messenger"].map((ch) => (
              <button
                key={ch}
                onClick={() => toggleChannel(ch)}
                className={`rounded-lg p-2 border ${
                  selectedChannels[ch] ? "bg-indigo-50 border-indigo-300" : "bg-white"
                }`}
              >
                {ch}
              </button>
            ))}
          </div>

          <hr className="my-4" />
          <label className="block text-sm font-medium">Campaign name</label>
          <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="w-full mt-1 p-2 border rounded"/>
          <label className="block text-sm font-medium mt-3">Objective</label>
          <select value={objective} onChange={(e) => setObjective(e.target.value)} className="w-full mt-1 p-2 border rounded">
            <option value="conversion">Conversion</option>
            <option value="engagement">Engagement</option>
            <option value="retention">Retention</option>
          </select>

          <div className="mt-4 flex gap-2">
            <button onClick={startStreaming} disabled={isStreaming} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
              {isStreaming ? "Streaming..." : "Generate & Stream JSON"}
            </button>
            <button onClick={stopStreaming} className="px-4 py-2 bg-slate-200 rounded-lg">Stop</button>
            {finalPayload && <button onClick={downloadJSON} className="px-3 py-2 ml-auto bg-emerald-600 text-white rounded-lg">Download JSON</button>}
          </div>
        </div>

        {/* Output */}
        <div className="col-span-2 bg-white p-6 rounded-2xl shadow flex flex-col space-y-6">
          {/* Streaming JSON */}
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Streaming JSON</h3>
              <div className="text-sm text-slate-400">{isStreaming ? "live" : finalPayload ? "complete" : "idle"}</div>
            </div>
            <pre className="mt-3 p-3 h-[300px] overflow-auto bg-slate-900 text-slate-100 rounded-lg text-sm">
              {streamText || (finalPayload ? JSON.stringify(finalPayload,null,2) : "// Press 'Generate & Stream JSON'")}
            </pre>
          </div>

          {/* Live Campaign Preview */}
          {Object.keys(liveBubbles).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Live Campaign Preview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(liveBubbles).map(([channel,messages]) => (
                  <div key={channel} className="border rounded-xl bg-white shadow-sm overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2 border-b flex items-center justify-between">
                      <span className="font-semibold capitalize">{channel}</span>
                    </div>
                    <div className="p-4 flex flex-col space-y-3 text-sm">
                      {messages.map((msg, idx) => {
                        const isBrand = msg.from === "brand";
                        const bubbleColor = channel==="sms" ? isBrand?"bg-gray-200 text-gray-900":"bg-blue-500 text-white"
                          : channel==="whatsapp" ? isBrand?"bg-gray-200 text-gray-900":"bg-green-500 text-white"
                          : channel==="messenger" ? isBrand?"bg-gray-200 text-gray-900":"bg-blue-600 text-white"
                          : "bg-slate-100 text-black";
                        return (
                          <div key={idx} className={`flex items-center gap-2 ${isBrand?"justify-start":"justify-end"}`}>
                            {isBrand && <div className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs">B</div>}
                            {!isBrand && <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">U</div>}
                            <div className={`px-3 py-2 rounded-2xl max-w-[75%] ${bubbleColor}`}>
                              {msg.text}
                            </div>
                          </div>
                        );
                      })}

                      {/* Typing indicator */}
                      {typingStatus[channel] && (
                        <div className="flex items-center gap-2 justify-start animate-pulse">
                          <div className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs">B</div>
                          <div
                            className={`px-3 py-2 rounded-2xl max-w-[50%] ${
                              channel === "sms"
                                ? "bg-gray-200 text-gray-900"
                                : channel === "whatsapp"
                                ? "bg-gray-200 text-gray-900"
                                : channel === "messenger"
                                ? "bg-gray-200 text-gray-900"
                                : "bg-slate-100 text-black"
                            }`}
                          >
                            typing…
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
