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

  let currentController = null;
  let debounceTimer = null;

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

  function selectEndpoint() {
    return fromSelect.value === 'english' ? endpoints.englishToEmoji : endpoints.emojiToEnglish;
  }

  async function translate() {
    const message = inputText.value.trim();
    if (!message) {
      outputText.value = '';
      return;
    }

    if (currentController) {
      currentController.abort();
      currentController = null;
    }

    outputText.value = '';
    setLoading(true);

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
  }

  fromSelect.addEventListener('change', syncPlaceholders);
  swapBtn.addEventListener('click', () => {
    clearTimeout(debounceTimer);
    swapLanguages();
    translate();
  });
  translateBtn.addEventListener('click', () => {
    clearTimeout(debounceTimer);
    translate();
  });
  clearBtn.addEventListener('click', clearAll);
  inputText.addEventListener('input', () => {
    if (currentController) currentController.abort();
    clearTimeout(debounceTimer);
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
})();
