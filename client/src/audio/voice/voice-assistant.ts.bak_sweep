export function startVoiceAssistant() {
  const _recognition = new webkitSpeechRecognition();
  recognition.continuous = true;

  recognition.onresult = async (event: any) => {
    const _transcript =
      event.results[event.results.length - 1][0].transcript;

    await fetch("/agent/voice-command", {
      method: "POST",
      body: JSON.stringify({ text: transcript }),
      headers: { "Content-Type": "application/json" }
    });
  };

  recognition.start();
}
