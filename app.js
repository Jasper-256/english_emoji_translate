(() => {
  const endpoints = {
    englishToEmoji: 'https://agents.toolhouse.ai/5747d8b7-42f5-4726-b6bf-0137925b0660',
    emojiToEnglish: 'https://agents.toolhouse.ai/f82e21aa-8d08-43d0-bd27-833972613e74'
  };

  const fromSelect = document.getElementById('fromSelect');
  const toSelect = document.getElementById('toSelect');
  const swapBtn = document.getElementById('swapBtn');
  const inputText = document.getElementById('inputText');
  const outputText = document.getElementById('outputText');
  const translateBtn = document.getElementById('translateBtn');
  const clearBtn = document.getElementById('clearBtn');
  const loading = document.getElementById('loading');
  const inputLabel = document.getElementById('inputLabel');
  const outputLabel = document.getElementById('outputLabel');
  const speakBtn = document.getElementById('speakBtn');
  const imageBtn = document.getElementById('imageBtn');
  const imageResult = document.getElementById('imageResult');
  const outputWrap = document.querySelector('.output-wrap');

  let currentController = null;
  let debounceTimer = null;
  let currentAudio = null;
  let currentAudioUrl = null;

  // ElevenLabs config (override via localStorage: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID)
  const getElevenKey = () => {
    return (
      localStorage.getItem('ELEVENLABS_API_KEY') ||
      'sk_8716206eb0dbaccb988da34c33a13e8d06bc1551a3dc3137'
    );
  };
  const getVoiceId = () => {
    return localStorage.getItem('ELEVENLABS_VOICE_ID') || '21m00Tcm4TlvDq8ikWAM'; // Rachel
  };

  function updateSpeakState() {
    if (!speakBtn) return;
    const hasText = !!outputText.value.trim();
    // speakBtn.disabled = !hasText;
  }

  function cleanupAudio() {
    if (currentAudio) {
      try { currentAudio.pause(); } catch (_) {}
      currentAudio = null;
    }
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = null;
    }
  }

  async function speakOutput() {
    const text = outputText.value.trim();
    if (!text) return;

    // Toggle to stop if already playing
    if (currentAudio && !currentAudio.paused) {
      cleanupAudio();
      updateSpeakState();
      return;
    }

    const apiKey = getElevenKey();
    const voiceId = getVoiceId();
    if (!apiKey) {
      alert('Missing ElevenLabs API key. Set localStorage.ELEVENLABS_API_KEY.');
      return;
    }

    setButtonLoading(speakBtn, true);

    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      });

      if (!res.ok) throw new Error('TTS request failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      cleanupAudio();
      currentAudioUrl = url;
      currentAudio = new Audio(url);
      currentAudio.onended = () => {
        cleanupAudio();
        updateSpeakState();
      };
      await currentAudio.play();
      setButtonLoading(speakBtn, false);
    } catch (err) {
      console.error(err);
      alert('Failed to play speech.');
      cleanupAudio();
      setButtonLoading(speakBtn, false);
    } finally {
      // Re-enable when idle; will disable itself again if playing
      if (!currentAudio) speakBtn.disabled = false;
    }
  }

  function syncPlaceholders() {
    if (fromSelect.value === 'english') {
      inputLabel.textContent = 'From English';
      outputLabel.textContent = 'To Emoji';
      inputText.placeholder = 'Type something in English...';
      toSelect.value = 'emoji';
    } else {
      inputLabel.textContent = 'From Emoji';
      outputLabel.textContent = 'To English';
      inputText.placeholder = 'Paste or type emojis...';
      toSelect.value = 'english';
    }
    updateModeButtons();
  }

  function swapLanguages() {
    const temp = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = temp;
    const oldInput = inputText.value;
    inputText.value = outputText.value;
    outputText.value = oldInput;
    syncPlaceholders();
  }

  function setLoading(isLoading) {
    loading.classList.toggle('hidden', !isLoading);
    translateBtn.disabled = isLoading;
    swapBtn.disabled = isLoading;
  }

  function isOutputEmojiMode() {
    return toSelect.value === 'emoji';
  }

  function updateModeButtons() {
    const emojiMode = isOutputEmojiMode();
    if (imageBtn) imageBtn.style.display = emojiMode ? '' : 'none';
    if (speakBtn) speakBtn.style.display = emojiMode ? 'none' : '';
    updateSpeakState();
  }

  function setOutputTextareaHidden(hidden) {
    if (outputWrap) {
      outputWrap.style.display = hidden ? 'none' : '';
      return;
    }
    if (!outputText) return;
    outputText.style.display = hidden ? 'none' : '';
  }

  // Swap a button's content with a spinner while loading
  function setButtonLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
      if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
      btn.innerHTML = '<div class="spinner"></div>';
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    } else {
      if (btn.dataset.originalHtml !== undefined) {
        btn.innerHTML = btn.dataset.originalHtml;
        btn.dataset.originalHtml = '';
      }
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  }

  function selectEndpoint() {
    return fromSelect.value === 'english' ? endpoints.englishToEmoji : endpoints.emojiToEnglish;
  }

  async function translate() {
    const message = inputText.value.trim();
    if (!message) {
      outputText.value = '';
      if (imageResult) { imageResult.style.display = 'none'; imageResult.innerHTML = ''; }
      return;
    }

    if (currentController) {
      currentController.abort();
      currentController = null;
    }

    outputText.value = '';
    setLoading(true);
    if (imageResult) { imageResult.style.display = 'none'; imageResult.innerHTML = ''; }

    const controller = new AbortController();
    currentController = controller;

    try {
      const res = await fetch(selectEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: controller.signal
      });

      if (!res.ok || !res.body) {
        throw new Error('Network error');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        outputText.value += chunk;
        outputText.scrollTop = outputText.scrollHeight;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        outputText.value = outputText.value || 'Something went wrong. Try again.';
      }
    } finally {
      setLoading(false);
      currentController = null;
      updateSpeakState();
    }
  }

  // copy and stop controls removed

  function clearAll() {
    clearTimeout(debounceTimer);
    if (currentController) {
      currentController.abort();
      currentController = null;
    }
    inputText.value = '';
    outputText.value = '';
    setLoading(false);
    inputText.focus();
    cleanupAudio();
    updateSpeakState();
    if (imageResult) { imageResult.style.display = 'none'; imageResult.innerHTML = ''; }
  }

  async function fileToBase64(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load base image');
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result || '';
        const base64 = String(result).split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function generateShelfImage() {
    const emojis = outputText.value.trim();
    if (!emojis) return;

    if (imageBtn) setButtonLoading(imageBtn, true);
    try {
      const base64 = await fileToBase64('./shelf.png');
      const apiKey = 'AIzaSyCP7rQJ1cJhchAAxfL91VvszQzPwn_5le0';
      const model = 'gemini-2.5-flash-image-preview'; // "nano banana"
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const prompt = `Put these emojis in order on the bottom shelf: "${emojis}". Make them look like iOS emoji. Leave everything else unchanged.`;

      const body = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inline_data: { mime_type: 'image/png', data: base64 } }
            ]
          }
        ]
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message || 'Image generation failed';
        throw new Error(msg);
      }

      const candidates = (data && data.candidates) || [];
      const parts = candidates[0]?.content?.parts || [];
      const imgPart = parts.find(p => p.inline_data || p.inlineData);
      const mime = imgPart?.inline_data?.mime_type || imgPart?.inlineData?.mimeType || 'image/png';
      const b64 = imgPart?.inline_data?.data || imgPart?.inlineData?.data;
      if (!b64) throw new Error('No image in response');

      const img = document.createElement('img');
      img.alt = 'Generated shelf image';
      img.src = `data:${mime};base64,${b64}`;
      if (imageResult) {
        imageResult.innerHTML = '';
        imageResult.appendChild(img);
        imageResult.style.display = '';
      }
      // Hide output UI elements after successful generation
      setOutputTextareaHidden(true);
      if (imageBtn) imageBtn.style.display = 'none';
      if (speakBtn) speakBtn.style.display = 'none';
    } catch (err) {
      console.error(err);
      alert('Failed to generate image.');
    } finally {
      if (imageBtn) setButtonLoading(imageBtn, false);
    }
  }

  fromSelect.addEventListener('change', syncPlaceholders);
  swapBtn.addEventListener('click', () => {
    clearTimeout(debounceTimer);
    // Ensure the right UI is visible again when swapping
    setOutputTextareaHidden(false);
    if (imageResult) { imageResult.style.display = 'none'; imageResult.innerHTML = ''; }
    swapLanguages();
    translate();
  });
  translateBtn.addEventListener('click', () => {
    clearTimeout(debounceTimer);
    translate();
  });
  clearBtn.addEventListener('click', clearAll);
  if (speakBtn) speakBtn.addEventListener('click', speakOutput);
  if (imageBtn) imageBtn.addEventListener('click', generateShelfImage);
  inputText.addEventListener('input', () => {
    if (currentController) currentController.abort();
    clearTimeout(debounceTimer);
    setOutputTextareaHidden(false);
    // Restore buttons according to current mode when user types again
    updateModeButtons();
    debounceTimer = setTimeout(translate, 200);
  });
  inputText.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceTimer);
      translate();
    }
  });

  syncPlaceholders();
  inputText.focus();
  updateSpeakState();
  updateModeButtons();
})();
