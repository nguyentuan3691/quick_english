  // ===== DỮ LIỆU =====
  let tabs = JSON.parse(localStorage.getItem('vocab_tabs') || 'null');
  if (!tabs) {
    tabs = [{ id: 'tab_' + Date.now(), name: 'Bài 1' }];
    saveTabs();
  }
  let activeTabId = localStorage.getItem('vocab_active_tab') || tabs[0].id;
  if (!tabs.find(t => t.id === activeTabId)) activeTabId = tabs[0].id;

  function saveTabs() {
    localStorage.setItem('vocab_tabs', JSON.stringify(tabs));
  }

  function getWords(tabId) {
    return JSON.parse(localStorage.getItem('vocab_words_' + tabId) || '[]');
  }

  function setWords(tabId, words) {
    localStorage.setItem('vocab_words_' + tabId, JSON.stringify(words));
  }

  // ===== RENDER TABS =====
  function renderTabs() {
    const bar = document.getElementById('tabsBar');
    bar.innerHTML = '';

    tabs.forEach(tab => {
      const el = document.createElement('div');
      el.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
      el.onclick = (e) => {
        if (e.target.classList.contains('tab-close')) return;
        if (e.target.classList.contains('tab-name-input') && !e.target.readOnly) return;
        switchTab(tab.id);
      };

      const nameInput = document.createElement('input');
      nameInput.className = 'tab-name-input';
      nameInput.value = tab.name;
      nameInput.readOnly = true;

      function startEdit() {
        nameInput.readOnly = false;
        nameInput.focus();
        nameInput.select();
      }

      nameInput.onblur = () => {
        nameInput.readOnly = true;
        tab.name = nameInput.value.trim() || tab.name;
        nameInput.value = tab.name;
        saveTabs();
        renderTabs();
      };
      nameInput.onkeydown = (e) => {
        if (e.key === 'Enter') nameInput.blur();
        e.stopPropagation();
      };

      const editBtn = document.createElement('span');
      editBtn.className = 'tab-edit';
      editBtn.textContent = '✏';
      editBtn.title = 'Đổi tên';
      editBtn.onclick = (e) => {
        e.stopPropagation();
        if (tab.id !== activeTabId) { switchTab(tab.id); setTimeout(startEdit, 60); return; }
        startEdit();
      };

      const closeBtn = document.createElement('span');
      closeBtn.className = 'tab-close';
      closeBtn.textContent = '✕';
      closeBtn.title = 'Xóa tab';
      closeBtn.onclick = () => deleteTab(tab.id);

      el.appendChild(nameInput);
      el.appendChild(editBtn);
      if (tabs.length > 1) el.appendChild(closeBtn);
      bar.appendChild(el);
    });

  }

  function switchTab(id) {
    activeTabId = id;
    localStorage.setItem('vocab_active_tab', id);
    renderTabs();
    renderWords();
    document.getElementById('wordInput').focus();
    setTimeout(() => { updateScrollBtns(); scrollActiveTabIntoView(); }, 50);
  }

  function newTab() {
    const id = 'tab_' + Date.now();
    tabs.push({ id, name: 'Bài ' + (tabs.length + 1) });
    saveTabs();
    switchTab(id);
  }

  function deleteTab(id) {
    if (!confirm('Xóa tab "' + tabs.find(t => t.id === id)?.name + '"?')) return;
    localStorage.removeItem('vocab_words_' + id);
    tabs = tabs.filter(t => t.id !== id);
    saveTabs();
    if (activeTabId === id) activeTabId = tabs[0].id;
    switchTab(activeTabId);
  }

  // ===== RENDER WORDS =====
  function renderWords() {
    const words = getWords(activeTabId);
    const list = document.getElementById('vocabList');
    const emptyMsg = document.getElementById('emptyMsg');
    const countLabel = document.getElementById('countLabel');

    list.innerHTML = '';
    countLabel.textContent = words.length + ' từ';

    if (words.length === 0) {
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';

    for (const word of words) {
      const card = document.createElement('div');
      card.className = 'vocab-card';
      card.id = 'card-' + word;

      card.innerHTML = `
        <img class="word-img" id="wi-${word}" alt="" />
        <div class="word-info">
          <span class="word-text">${word}</span>
          <span class="word-phonetic" id="ph-${word}">...</span>
          <span class="word-meaning loading" id="mn-${word}">đang dịch...</span>
        </div>
        <div class="word-actions">
          <button class="btn-speak" data-tip="Nghe Google đọc từ này">🔊</button>
          <button class="btn-mic" id="mb-${word}" onclick="startListen('${word}')" data-tip="Nhấn → nói từ → tự dừng khi bạn ngừng nói">🎤</button>
          <button class="btn-delete" onclick="deleteWord('${word}')" data-tip="Xóa từ này khỏi danh sách">✕</button>
        </div>
        <div class="mic-result" id="mr-${word}"></div>
      `;

      // iOS: nút loa chính là <audio> element, user tap trực tiếp → play() hợp lệ
      const au = document.createElement('audio');
      au.preload = 'none';
      au.src = ttsUrl(word);
      au.dataset.word = word;
      card.querySelector('.word-actions').prepend(au);

      au.addEventListener('playing', () => vlog(`🔊 Audio playing: "${au.dataset.word}"`));
      au.addEventListener('error', () => vlog(`🔊 Audio error: "${au.dataset.word}" — ${au.error?.message || au.error?.code || 'unknown'}`, 'err'));
      au.addEventListener('ended', () => vlog(`🔊 Audio ended: "${au.dataset.word}"`));

      const speakBtn = card.querySelector('.btn-speak');
      speakBtn.addEventListener('click', () => {
        vlog(`🔊 Tap speak: "${word}"`);
        unlockAudio(); // Unlock shared audio trên iOS trước khi play
        au.currentTime = 0;
        au.play().catch(err => vlog(`🔊 play() rejected: ${err.message}`, 'err'));
      });

      card.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.tagName === 'AUDIO') return;
        openWordDetail(word);
      });

      list.appendChild(card);

      translate(word).then(m => {
        const el = document.getElementById('mn-' + word);
        if (el) { el.textContent = m; el.className = 'word-meaning'; }
      });
      getPhonetic(word).then(p => {
        const el = document.getElementById('ph-' + word);
        if (el) el.textContent = p || '';
      });
      getWordImage(word).then(url => {
        if (!url) return;
        const el = document.getElementById('wi-' + word);
        if (el) { el.src = url; el.onload = () => el.classList.add('loaded'); }
      });
    }
  }

  // ===== ACTIONS =====
  function addWord() {
    const input = document.getElementById('wordInput');
    const word = input.value.trim();
    if (!word) return;
    const words = getWords(activeTabId);
    if (words.map(w => w.toLowerCase()).includes(word.toLowerCase())) {
      input.value = '';
      return;
    }
    words.push(word);
    setWords(activeTabId, words);
    input.value = '';
    renderWords();
    speak(word);
  }

  function deleteWord(word) {
    const words = getWords(activeTabId).filter(w => w !== word);
    setWords(activeTabId, words);
    renderWords();
  }

  function clearAll() {
    if (!confirm('Xóa hết từ vựng trong tab này?')) return;
    setWords(activeTabId, []);
    renderWords();
  }

  // ===== API =====
  async function translate(word) {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(word)}`;
      const res = await fetch(url);
      const data = await res.json();
      return data[0].map(x => x[0]).join('');
    } catch { return ''; }
  }

  async function getPhonetic(word) {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      const data = await res.json();
      return data[0]?.phonetic || data[0]?.phonetics?.find(p => p.text)?.text || '';
    } catch { return ''; }
  }

  // ===== WIKIPEDIA IMAGE =====
  async function getWordImage(word) {
    const cached = localStorage.getItem('img_' + word);
    if (cached !== null) return cached || '';
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word)}`);
      if (!res.ok) { localStorage.setItem('img_' + word, ''); return ''; }
      const data = await res.json();
      const url = data.thumbnail?.source || '';
      localStorage.setItem('img_' + word, url);
      return url;
    } catch { localStorage.setItem('img_' + word, ''); return ''; }
  }

  // Shared audio — dùng cho speak(word) gọi programmatic & speakAll()
  // Trên iOS, sau khi user tap unlock 1 lần, element này có thể play() tự do
  const _sharedAudio = document.createElement('audio');
  _sharedAudio.preload = 'none';
  document.body.appendChild(_sharedAudio);

  function ttsUrl(word) {
    return `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=en&client=gtx`;
  }

  function unlockAudio() {
    _sharedAudio.play().then(() => _sharedAudio.pause()).catch(() => {});
  }

  function speak(word) {
    _sharedAudio.src = ttsUrl(word);
    _sharedAudio.play().catch(() => {});
  }

  // startSimpleRec: shared core cho mọi mic recognition đơn giản (fc, wd)
  // opts: { word, getRef, setRef, btnEl, resetText, onInterim, onFinal, onError, onDone }
  // Không gọi getCachedMicStream ở đây — SpeechRecognition tự quản lý mic,
  // gọi thêm getUserMedia chỉ làm browser hỏi quyền 2 lần.
  function startSimpleRec(opts) {
    const { word, getRef, setRef, btnEl, resetText = '🎤', onInterim, onFinal, onError, onDone } = opts;
    if (getRef()) { getRef().stop(); return; }
    if (!SpeechRecognition) { onError('no-support'); return; }
    _sharedAudio.pause(); _sharedAudio.currentTime = 0;
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = !!onInterim;
    rec.maxAlternatives = 5;
    setRef(rec);
    btnEl.classList.add('listening');
    btnEl.textContent = '⏹';
    rec.onresult = e => {
      const res0 = e.results[0];
      if (!res0.isFinal) { onInterim?.(res0[0].transcript); return; }
      onFinal(Array.from(res0).map(r => r.transcript.trim().toLowerCase()));
    };
    rec.onspeechend = () => rec.stop();
    rec.onerror = e => { if (e.error !== 'aborted') onError(e.error); };
    rec.onend = () => {
      btnEl.classList.remove('listening');
      btnEl.textContent = resetText;
      setRef(null);
      onDone?.();
    };
    rec.start();
  }

  function speakAll() {
    const words = getWords(activeTabId);
    if (!words.length) return;
    vlog(`▶▶ speakAll: ${words.length} từ`);
    let i = 0;
    function next() {
      if (i >= words.length) { vlog(`▶▶ speakAll hoàn tất`, 'ok'); return; }
      vlog(`▶▶ speakAll [${i+1}/${words.length}]: "${words[i]}"`);
      _sharedAudio.onended = () => { i++; setTimeout(next, 500); };
      _sharedAudio.onerror = () => { vlog(`▶▶ speakAll error tại "${words[i]}"`, 'err'); i++; setTimeout(next, 500); };
      _sharedAudio.src = ttsUrl(words[i]);
      _sharedAudio.play().catch(err => vlog(`▶▶ speakAll play() rejected: ${err.message}`, 'err'));
    }
    // Từ đầu tiên play() trong user gesture → unlock
    // Các từ tiếp theo dùng cùng element đã unlock → iOS cho phép
    next();
  }

  // ===== VOICE LOG =====
  function vlog(msg, type) {
    const log = document.getElementById('voiceLog');
    const now = new Date();
    const t = now.toLocaleTimeString('vi', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const ms = String(now.getMilliseconds()).padStart(3,'0');
    const cls = type === 'err' ? 'log-err' : type === 'ok' ? 'log-ok' : '';
    log.innerHTML += `<div><span class="log-time">[${t}.${ms}]</span> <span class="${cls}">${msg}</span></div>`;
    log.scrollTop = log.scrollHeight;
  }
  function toggleVoiceLog() {
    const el = document.getElementById('voiceLog');
    const wasOpen = el.classList.toggle('open');
    if (wasOpen && el.children.length === 0) {
      vlog(`📱 UA: ${navigator.userAgent}`);
      vlog(`🔈 SpeechRecognition: ${SpeechRecognition ? 'YES' : 'NO'}`);
    }
  }
  function clearVoiceLog() {
    document.getElementById('voiceLog').innerHTML = '';
  }

  // ===== CACHED MIC STREAM (tránh hỏi Allow nhiều lần trên file://) =====
  let _cachedMicStream = null;
  const _audioConstraints = {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  };
  function getCachedMicStream() {
    // Kiểm tra stream cũ còn sống không
    if (_cachedMicStream) {
      const tracks = _cachedMicStream.getAudioTracks();
      if (tracks.length > 0 && tracks[0].readyState === 'live') {
        return Promise.resolve(_cachedMicStream);
      }
      _cachedMicStream = null;
    }
    return navigator.mediaDevices.getUserMedia(_audioConstraints).then(stream => {
      _cachedMicStream = stream;
      return stream;
    });
  }

  // ===== TEST MIC LEVEL =====
  let _testMicCtx = null, _testMicAnimId = null, _testMicActive = false;
  function testMicLevel() {
    // Nếu đang test → dừng
    if (_testMicActive) {
      cancelAnimationFrame(_testMicAnimId);
      if (_testMicCtx) _testMicCtx.close().catch(() => {});
      _testMicCtx = null;
      _testMicActive = false;
      document.getElementById('micMeter').classList.remove('active');
      vlog(`🎚 Test mic dừng`);
      return;
    }
    vlog(`🎚 Bắt đầu test mic...`);
    getCachedMicStream().then(stream => {
      _testMicActive = true;
      const tracks = stream.getAudioTracks();
      vlog(`🎚 Đang dùng mic: "${tracks[0]?.label || 'unknown'}"`);
      const settings = tracks[0]?.getSettings?.() || {};
      vlog(`🎚 AGC=${settings.autoGainControl}, noise=${settings.noiseSuppression}, echo=${settings.echoCancellation}`);
      _testMicCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = _testMicCtx.createMediaStreamSource(stream);
      const analyser = _testMicCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const meterWrap = document.getElementById('micMeter');
      const meterFill = document.getElementById('micMeterFill');
      const meterVal = document.getElementById('micMeterVal');
      meterWrap.classList.add('active');
      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      function update() {
        analyser.getByteTimeDomainData(dataArr);
        let sum = 0;
        for (let i = 0; i < dataArr.length; i++) {
          const v = (dataArr[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArr.length);
        const pct = Math.min(100, Math.round(rms * 300));
        meterFill.style.width = pct + '%';
        meterFill.className = 'mic-meter-fill ' + (pct < 5 ? 'low' : pct < 20 ? 'mid' : 'high');
        meterVal.textContent = pct + '%';
        _testMicAnimId = requestAnimationFrame(update);
      }
      update();
      vlog(`🎚 Hãy nói gì đó để xem thanh level — nhấn Test Mic lần nữa để dừng`);
    }).catch(err => {
      vlog(`🎚 Mic error: ${err.message}`, 'err');
    });
  }

  // ===== SPEECH RECOGNITION =====
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let _activeRec = null;
  let _activeRecWord = null;

  function startListen(word) {
    if (!SpeechRecognition) {
      alert('Trình duyệt không hỗ trợ nhận diện giọng nói.');
      return;
    }

    // Nếu đang ghi âm cùng từ → dừng
    if (_activeRec && _activeRecWord === word) {
      _activeRec.stop();
      return;
    }

    // Nếu đang ghi âm từ khác → dừng cái cũ trước
    if (_activeRec) {
      _activeRec.onend = null;
      _activeRec.onerror = null;
      _activeRec.onresult = null;
      _activeRec.abort();
      const oldBtn = document.getElementById('mb-' + _activeRecWord);
      if (oldBtn) { oldBtn.classList.remove('listening'); oldBtn.textContent = '🎤'; }
      _activeRec = null;
      _activeRecWord = null;
    }

    // Dừng mọi audio đang phát để giải phóng mic trên iOS
    _sharedAudio.pause();
    _sharedAudio.currentTime = 0;
    document.querySelectorAll('.vocab-card audio').forEach(a => { a.pause(); a.currentTime = 0; });

    const btn = document.getElementById('mb-' + word);
    const result = document.getElementById('mr-' + word);

    // Mở mic — dùng cached stream (tránh hỏi Allow lại)
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      getCachedMicStream().then(stream => {
        const tracks = stream.getAudioTracks();
        const settings = tracks[0]?.getSettings?.() || {};
        vlog(`🎙 Mic OK: "${tracks[0]?.label || 'unknown'}"`, 'ok');
        vlog(`🎙 Settings: AGC=${settings.autoGainControl}, noise=${settings.noiseSuppression}, echo=${settings.echoCancellation}, sampleRate=${settings.sampleRate}`);
        // Giữ stream để monitor level trong lúc recognition
        doStartRec(word, btn, result, stream);
      }).catch(err => {
        vlog(`🎙 Mic permission DENIED: ${err.name} — ${err.message}`, 'err');
        result.className = 'mic-result wrong';
        result.textContent = '❌ Không truy cập được mic — kiểm tra quyền micro trong Cài đặt';
      });
    } else {
      vlog(`🎙 mediaDevices không có — skip mic check`);
      doStartRec(word, btn, result, null);
    }
  }

  function doStartRec(word, btn, result, micStream) {
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.maxAlternatives = 5;

    // Mic level monitor — giống cách Google Translate kiểm tra mic
    let _micCtx = null, _micAnalyser = null, _micAnimId = null;
    if (micStream) {
      try {
        _micCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = _micCtx.createMediaStreamSource(micStream);
        _micAnalyser = _micCtx.createAnalyser();
        _micAnalyser.fftSize = 512;
        source.connect(_micAnalyser);
        // KHÔNG connect đến destination (không phát lại qua loa)
        const meterWrap = document.getElementById('micMeter');
        const meterFill = document.getElementById('micMeterFill');
        const meterVal = document.getElementById('micMeterVal');
        meterWrap.classList.add('active');
        let _peakLevel = 0;
        const dataArr = new Uint8Array(_micAnalyser.frequencyBinCount);
        function updateMeter() {
          _micAnalyser.getByteTimeDomainData(dataArr);
          let sum = 0;
          for (let i = 0; i < dataArr.length; i++) {
            const v = (dataArr[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / dataArr.length);
          const pct = Math.min(100, Math.round(rms * 300));
          if (pct > _peakLevel) _peakLevel = pct;
          meterFill.style.width = pct + '%';
          meterFill.className = 'mic-meter-fill ' + (pct < 5 ? 'low' : pct < 20 ? 'mid' : 'high');
          meterVal.textContent = pct + '%';
          _micAnimId = requestAnimationFrame(updateMeter);
        }
        updateMeter();
        // Log khi dừng
        rec.addEventListener('end', () => {
          cancelAnimationFrame(_micAnimId);
          vlog(`🎚 Mic peak level: ${_peakLevel}% ${_peakLevel < 5 ? '⚠️ RẤT NHỎ — mic có thể bị mute hoặc sai thiết bị!' : _peakLevel < 15 ? '⚠️ Nhỏ — thử nói to hơn hoặc lại gần mic' : '✓ OK'}`, _peakLevel < 5 ? 'err' : _peakLevel < 15 ? 'err' : 'ok');
          meterWrap.classList.remove('active');
          // KHÔNG stop stream tracks — giữ lại để dùng lần sau (tránh hỏi Allow lại)
          _micCtx.close().catch(() => {});
        });
      } catch (e) {
        vlog(`🎚 Mic meter error: ${e.message}`, 'err');
      }
    }

    _activeRec = rec;
    _activeRecWord = word;

    // Diagnostic flags
    let _startTime = Date.now();
    let _audioStartTime = 0;
    let _gotSound = false;
    let _gotSpeech = false;
    let _gotResult = false;
    let _gotError = false;
    let _interimCount = 0;

    btn.classList.add('listening');
    btn.textContent = '⏹';
    result.className = 'mic-result info';
    result.textContent = '🎙 Hãy nói "' + word + '" — tự dừng khi bạn ngừng nói';
    vlog(`▶ Bắt đầu nghe "${word}" (lang=${rec.lang}, maxAlt=${rec.maxAlternatives}, interim=${rec.interimResults})`);

    rec.onaudiostart = () => {
      _audioStartTime = Date.now();
      vlog(`🎙 audiostart — mic đã mở (+${_audioStartTime - _startTime}ms)`);
    };
    rec.onsoundstart = () => { _gotSound = true; vlog(`🎙 soundstart — phát hiện âm thanh (+${Date.now() - _startTime}ms)`); };
    rec.onspeechstart = () => { _gotSpeech = true; vlog(`🎙 speechstart — phát hiện giọng nói (+${Date.now() - _startTime}ms)`); };
    rec.onspeechend = () => {
      vlog(`🎙 speechend — ngừng nói (+${Date.now() - _startTime}ms), gọi rec.stop() để thúc trả result`);
      rec.stop();
    };
    rec.onsoundend = () => vlog(`🎙 soundend — hết âm thanh (+${Date.now() - _startTime}ms)`);
    rec.onaudioend = () => {
      const micDuration = _audioStartTime ? Date.now() - _audioStartTime : 0;
      vlog(`🎙 audioend — mic đã đóng (mic mở ${micDuration}ms, +${Date.now() - _startTime}ms)`);
    };
    rec.onnomatch = () => vlog(`🎙 nomatch — không khớp kết quả nào`, 'err');

    rec.onresult = (e) => {
      const res0 = e.results[0];
      const isFinal = res0.isFinal;
      if (!isFinal) {
        _interimCount++;
        const interim = res0[0].transcript;
        vlog(`📝 interim #${_interimCount}: "${interim}" (+${Date.now() - _startTime}ms)`);
        return;
      }
      _gotResult = true;
      const clean = s => s.trim().toLowerCase().replace(/[.,!?;:'"()]/g, '').trim();
      const alts = Array.from(res0).map(r => ({ text: r.transcript.trim().toLowerCase(), conf: r.confidence }));
      const matched = alts.some(a => clean(a.text) === clean(word));
      result.className = 'mic-result ' + (matched ? 'correct' : 'wrong');
      result.textContent = matched ? `✓ Chính xác! Google nhận ra: "${alts[0].text}"` : `✗ Chưa đúng — Google nghe: "${alts[0].text}"`;
      const altStr = alts.map(a => `"${a.text}" (${(a.conf*100).toFixed(1)}%)`).join(', ');
      vlog(`📝 FINAL result (+${Date.now() - _startTime}ms): [${altStr}] → ${matched ? 'ĐÚNG ✓' : 'SAI ✗'}`, matched ? 'ok' : 'err');
    };

    rec.onerror = (e) => {
      _gotError = true;
      vlog(`❌ Lỗi: ${e.error} | message: ${e.message || '(none)'} (+${Date.now() - _startTime}ms)`, 'err');
      if (e.error === 'aborted') return;
      result.className = 'mic-result wrong';
      result.textContent = e.error === 'no-speech' ? '🔇 Không nghe thấy gì — hãy thử lại' : 'Lỗi: ' + e.error;
    };

    rec.onend = () => {
      const totalMs = Date.now() - _startTime;
      const micMs = _audioStartTime ? Date.now() - _audioStartTime : 0;
      vlog(`⏹ Kết thúc nghe "${word}" (tổng ${totalMs}ms, mic ${micMs}ms)`);
      // Diagnostic summary
      if (!_gotResult && !_gotError) {
        vlog(`⚠️ CẢNH BÁO: Kết thúc KHÔNG có result & KHÔNG có error!`, 'err');
        vlog(`   → sound=${_gotSound}, speech=${_gotSpeech}, interim=${_interimCount}`, 'err');
        if (!_gotSound) vlog(`   → Mic mở nhưng KHÔNG phát hiện âm thanh — kiểm tra mic permission hoặc mic bị mute`, 'err');
        else if (!_gotSpeech) vlog(`   → Có âm thanh nhưng KHÔNG nhận dạng giọng nói — nói to/rõ hơn`, 'err');
        else vlog(`   → Có giọng nói nhưng Google không trả result — có thể mạng chậm/timeout`, 'err');
      } else if (!_gotResult && _gotError) {
        vlog(`   → Kết thúc với lỗi, không có result`);
      }
      btn.classList.remove('listening');
      btn.textContent = '🎤';
      if (_activeRec === rec) {
        _activeRec = null;
        _activeRecWord = null;
      }
    };

    try {
      rec.start();
      vlog(`🎙 rec.start() called OK (+${Date.now() - _startTime}ms)`);
    } catch(err) {
      vlog(`🎙 rec.start() exception: ${err.message}`, 'err');
    }
  }

  // ===== SCROLL TABS =====
  function scrollTabs(dir) {
    const bar = document.getElementById('tabsBar');
    bar.scrollBy({ left: dir * 160, behavior: 'smooth' });
  }

  function updateScrollBtns() {
    const bar = document.getElementById('tabsBar');
    const btnL = document.getElementById('scrollLeft');
    const btnR = document.getElementById('scrollRight');
    const hasOverflow = bar.scrollWidth > bar.clientWidth;
    btnL.style.display = hasOverflow ? '' : 'none';
    btnR.style.display = hasOverflow ? '' : 'none';
    btnL.disabled = bar.scrollLeft <= 0;
    btnR.disabled = bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 1;
  }

  function scrollActiveTabIntoView() {
    const bar = document.getElementById('tabsBar');
    const active = bar.querySelector('.tab.active');
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    setTimeout(updateScrollBtns, 300);
  }

  // ===== TÌM KIẾM / SUGGEST =====
  let focusedSuggest = -1;

  function highlight(text, query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return `<span>${text}</span>`;
    return `<span>${text.slice(0, idx)}<mark>${text.slice(idx, idx + query.length)}</mark>${text.slice(idx + query.length)}</span>`;
  }

  let suggestTimer = null;

  async function renderSuggest(query) {
    const box = document.getElementById('suggestList');
    focusedSuggest = -1;
    if (!query) { box.style.display = 'none'; return; }

    const existing = getWords(activeTabId);
    const existMatches = existing.filter(w => w.toLowerCase().includes(query.toLowerCase()));

    // Hiện ngay phần từ đã có
    let html = '';
    if (existMatches.length) {
      html += existMatches.slice(0, 4).map(w => {
        const meaning = localStorage.getItem('meaning_' + w) || '';
        return `<div class="suggest-item" data-word="${w}" onmousedown="selectSuggest('${w}')">
          <span class="s-word">${highlight(w, query)}</span>
          ${meaning ? `<span class="s-meaning">${meaning}</span>` : ''}
          <span class="s-badge">Đã có ↑</span>
        </div>`;
      }).join('');
    }

    box.innerHTML = html || '<div class="suggest-divider">Đang tìm gợi ý...</div>';
    box.style.display = 'block';

    // Debounce gợi ý từ mới
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(query)}*&max=6`);
        const data = await res.json();
        const existSet = new Set(existing.map(w => w.toLowerCase()));
        const newWords = data.map(d => d.word).filter(w => !existSet.has(w.toLowerCase()));

        let newHtml = existMatches.length
          ? existMatches.slice(0, 4).map(w => {
              const meaning = localStorage.getItem('meaning_' + w) || '';
              return `<div class="suggest-item" data-word="${w}" onmousedown="selectSuggest('${w}')">
                <span class="s-word">${highlight(w, query)}</span>
                ${meaning ? `<span class="s-meaning">${meaning}</span>` : ''}
                <span class="s-badge">Đã có ↑</span>
              </div>`;
            }).join('')
          : '';

        if (newWords.length) {
          newHtml += `<div class="suggest-divider">Gợi ý từ mới</div>`;
          newHtml += newWords.slice(0, 4).map(w =>
            `<div class="suggest-item" data-word="${w}" onmousedown="selectSuggest('${w}', true)">
              <span class="s-word">${highlight(w, query)}</span>
              <span class="s-badge new">+ Thêm</span>
            </div>`
          ).join('');
        }

        if (newHtml) {
          box.innerHTML = newHtml;
          box.style.display = 'block';
        } else {
          box.style.display = 'none';
        }
      } catch {
        if (!existMatches.length) box.style.display = 'none';
      }
    }, 300);
  }

  function selectSuggest(word, isNew = false) {
    const words = getWords(activeTabId).filter(w => w !== word);
    if (isNew) {
      words.unshift(word); // thêm từ mới vào đầu
    } else {
      words.unshift(word); // đẩy từ đã có lên đầu
    }
    setWords(activeTabId, words);
    document.getElementById('wordInput').value = '';
    document.getElementById('suggestList').style.display = 'none';
    renderWords();
    speak(word);
    setTimeout(() => { document.getElementById('vocabList').scrollTop = 0; }, 50);
  }

  function closeSuggest() {
    document.getElementById('suggestList').style.display = 'none';
    focusedSuggest = -1;
  }

  // Cache meaning để hiện trong suggest
  const origTranslate = translate;
  translate = async (word) => {
    const result = await origTranslate(word);
    if (result) localStorage.setItem('meaning_' + word, result);
    return result;
  };

  // ===== FLASHCARD QUIZ =====
  let _fcWords = [];
  let _fcIndex = 0;
  let _fcOk = 0;
  let _fcFail = 0;
  let _fcMode = 'vi2en';
  let _fcAnswered = false;

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startQuiz() {
    const words = getWords(activeTabId);
    if (words.length < 2) { alert('Cần ít nhất 2 từ để luyện tập!'); return; }
    _fcWords = shuffle(words);
    _fcIndex = 0;
    _fcOk = 0;
    _fcFail = 0;
    _fcAnswered = false;
    document.getElementById('fcOverlay').classList.add('open');
    document.getElementById('fcDone').style.display = 'none';
    document.getElementById('fcCard').style.display = '';
    document.getElementById('fcAnswerArea').style.display = '';
    document.getElementById('fcScore').style.display = '';
    document.getElementById('fcActions').style.display = 'none';
    updateFcScore();
    showQuizCard();
  }

  function closeQuiz() {
    document.getElementById('fcOverlay').classList.remove('open');
  }

  function setQuizMode(mode) {
    _fcMode = mode;
    document.getElementById('fcMode1').classList.toggle('active', mode === 'vi2en');
    document.getElementById('fcMode2').classList.toggle('active', mode === 'en2vi');
    document.getElementById('fcMode3').classList.toggle('active', mode === 'listen');
    _fcAnswered = false;
    showQuizCard();
  }

  function showQuizCard() {
    if (_fcIndex >= _fcWords.length) { showQuizDone(); return; }
    const word = _fcWords[_fcIndex];
    const meaning = localStorage.getItem('meaning_' + word) || '';
    const phonetic = localStorage.getItem('phonetic_' + word) || '';
    const prompt = document.getElementById('fcPrompt');
    const question = document.getElementById('fcQuestion');
    const phEl = document.getElementById('fcPhonetic');
    const input = document.getElementById('fcInput');
    const reveal = document.getElementById('fcReveal');
    const actions = document.getElementById('fcActions');
    const checkBtn = document.getElementById('fcCheckBtn');

    reveal.classList.remove('show');
    actions.style.display = 'none';
    document.getElementById('fcAnswerArea').style.display = '';
    checkBtn.style.display = '';
    document.getElementById('fcMicBtn').style.display = (_fcMode === 'en2vi') ? 'none' : '';
    input.value = '';
    input.className = 'fc-input';
    input.disabled = false;
    _fcAnswered = false;
    // Stop any active mic in flashcard
    if (_fcRec) { _fcRec.abort(); _fcRec = null; }
    document.getElementById('fcMicBtn').classList.remove('listening');
    document.getElementById('fcMicBtn').textContent = '🎤';

    document.getElementById('fcProgress').textContent = (_fcIndex + 1) + '/' + _fcWords.length;

    // Show image
    const fcImg = document.getElementById('fcImg');
    fcImg.classList.remove('loaded');
    fcImg.src = '';
    getWordImage(word).then(url => {
      if (url && _fcWords[_fcIndex] === word) {
        fcImg.src = url;
        fcImg.onload = () => fcImg.classList.add('loaded');
      }
    });

    if (_fcMode === 'vi2en') {
      prompt.textContent = 'Nghĩa tiếng Việt';
      question.textContent = meaning || '(chưa có nghĩa)';
      question.className = 'fc-question vi';
      phEl.textContent = '';
      input.placeholder = 'Gõ từ tiếng Anh...';
    } else if (_fcMode === 'en2vi') {
      prompt.textContent = 'Từ tiếng Anh';
      question.textContent = word;
      question.className = 'fc-question';
      phEl.textContent = phonetic;
      input.placeholder = 'Gõ nghĩa tiếng Việt...';
    } else {
      prompt.textContent = '🔊 Nghe và viết lại';
      question.textContent = '🎧';
      question.className = 'fc-question';
      phEl.textContent = '';
      input.placeholder = 'Gõ từ bạn nghe được...';
      setTimeout(() => fcPlayAudio(), 300);
    }

    setTimeout(() => input.focus(), 100);
  }

  function checkQuizAnswer() {
    if (_fcAnswered) { nextQuizCard(); return; }
    const word = _fcWords[_fcIndex];
    const meaning = localStorage.getItem('meaning_' + word) || '';
    const input = document.getElementById('fcInput');
    const answer = input.value.trim();
    if (!answer) return;

    _fcAnswered = true;
    const clean = s => s.trim().toLowerCase().replace(/[.,!?;:'"()]/g, '').trim();
    let isCorrect;

    if (_fcMode === 'vi2en' || _fcMode === 'listen') {
      isCorrect = clean(answer) === clean(word);
    } else {
      isCorrect = clean(answer) === clean(meaning);
    }

    if (isCorrect) {
      _fcOk++;
      input.className = 'fc-input correct';
    } else {
      _fcFail++;
      input.className = 'fc-input wrong';
    }
    input.disabled = true;
    updateFcScore();

    const phonetic = localStorage.getItem('phonetic_' + word) || '';
    document.getElementById('fcRevealWord').textContent = word;
    document.getElementById('fcRevealPhonetic').textContent = phonetic;
    document.getElementById('fcRevealMeaning').textContent = meaning;
    document.getElementById('fcReveal').classList.add('show');
    document.getElementById('fcActions').style.display = '';
    document.getElementById('fcCheckBtn').style.display = 'none';
  }

  function nextQuizCard() {
    _fcIndex++;
    showQuizCard();
  }

  function fcPlayAudio() {
    if (_fcIndex >= _fcWords.length) return;
    speak(_fcWords[_fcIndex]);
  }

  function updateFcScore() {
    document.getElementById('fcOk').textContent = _fcOk;
    document.getElementById('fcFail').textContent = _fcFail;
  }

  function showQuizDone() {
    document.getElementById('fcCard').style.display = 'none';
    document.getElementById('fcAnswerArea').style.display = 'none';
    document.getElementById('fcActions').style.display = 'none';
    document.getElementById('fcReveal').classList.remove('show');
    const total = _fcOk + _fcFail;
    const pct = total ? Math.round(_fcOk / total * 100) : 0;
    document.getElementById('fcDoneMsg').textContent = `Đúng ${_fcOk}/${total} (${pct}%)`;
    document.getElementById('fcDone').style.display = '';
  }

  // Cache phonetic for flashcard
  const origGetPhonetic = getPhonetic;
  getPhonetic = async (word) => {
    const result = await origGetPhonetic(word);
    if (result) localStorage.setItem('phonetic_' + word, result);
    return result;
  };

  // ===== FLASHCARD MIC (Speech Recognition) =====
  let _fcRec = null;
  function fcStartListen() {
    if (_fcAnswered) return;
    const input = document.getElementById('fcInput');
    input.placeholder = '🎙 Đang nghe...';
    startSimpleRec({
      word: _fcWords[_fcIndex],
      getRef: () => _fcRec,
      setRef: r => _fcRec = r,
      btnEl: document.getElementById('fcMicBtn'),
      onInterim: t => { input.value = t; },
      onFinal: alts => { input.value = alts[0]; setTimeout(() => checkQuizAnswer(), 200); },
      onError: err => {
        if (err === 'no-support') { alert('Trình duyệt không hỗ trợ nhận diện giọng nói.'); return; }
        input.placeholder = err === 'no-speech' ? '🔇 Không nghe thấy — thử lại' : 'Lỗi: ' + err;
      },
      onDone: () => { if (!input.value) input.placeholder = 'Gõ câu trả lời...'; },
    });
  }

  // Flashcard input Enter key
  document.getElementById('fcInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (_fcAnswered) nextQuizCard();
      else checkQuizAnswer();
    }
  });

  // Close overlay on background click
  document.getElementById('fcOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeQuiz();
  });

  // ===== WORD MATCH GAME =====
  let _wmPairs = [];
  let _wmSelected = null;
  let _wmMatched = 0;
  let _wmAttempts = 0;
  let _wmTimerInterval = null;
  let _wmSeconds = 0;

  function startMatch() {
    const words = getWords(activeTabId);
    if (words.length < 3) { alert('Cần ít nhất 3 từ để chơi ghép từ!'); return; }
    // Pick up to 8 words that have meanings cached
    const pool = words.filter(w => localStorage.getItem('meaning_' + w));
    if (pool.length < 3) { alert('Chưa đủ nghĩa — hãy mở danh sách từ để tải nghĩa trước!'); return; }
    const picked = shuffle(pool).slice(0, 8);
    _wmPairs = picked.map(w => ({ en: w, vi: localStorage.getItem('meaning_' + w) }));
    _wmSelected = null;
    _wmMatched = 0;
    _wmAttempts = 0;
    _wmSeconds = 0;

    document.getElementById('wmOverlay').classList.add('open');
    document.getElementById('wmDone').classList.remove('show');
    document.getElementById('wmBoard').style.display = '';
    document.getElementById('wmFooter').style.display = '';
    renderMatchBoard();
    updateWmScore();

    clearInterval(_wmTimerInterval);
    document.getElementById('wmTimer').textContent = '0:00';
    _wmTimerInterval = setInterval(() => {
      _wmSeconds++;
      const m = Math.floor(_wmSeconds / 60);
      const s = _wmSeconds % 60;
      document.getElementById('wmTimer').textContent = m + ':' + String(s).padStart(2, '0');
    }, 1000);
  }

  function closeMatch() {
    document.getElementById('wmOverlay').classList.remove('open');
    clearInterval(_wmTimerInterval);
  }

  // ===== WORD DETAIL POPUP =====
  let _wdWord = null;
  let _wdRecog = null;

  function openWordDetail(word) {
    _wdWord = word;
    const overlay = document.getElementById('wdOverlay');
    document.getElementById('wdWord').textContent = word;
    document.getElementById('wdPhonetic').textContent = '';
    document.getElementById('wdMeaning').textContent = 'đang dịch...';
    document.getElementById('wdMicResult').className = 'wd-mic-result';
    document.getElementById('wdBtnMic').className = 'wd-btn-mic';
    document.getElementById('wdBtnMic').textContent = '🎤 Nói';
    const img = document.getElementById('wdImg');
    img.className = 'wd-img';
    img.src = '';
    const audio = document.getElementById('wdAudio');
    audio.src = ttsUrl(word);

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Lấy data từ cache (đã render ở card) hoặc fetch mới
    const phEl = document.getElementById('ph-' + word);
    const mnEl = document.getElementById('mn-' + word);
    const imgEl = document.getElementById('wi-' + word);
    if (phEl && phEl.textContent && phEl.textContent !== '...') {
      document.getElementById('wdPhonetic').textContent = phEl.textContent;
    } else {
      getPhonetic(word).then(p => { document.getElementById('wdPhonetic').textContent = p || ''; });
    }
    if (mnEl && mnEl.textContent && mnEl.textContent !== 'đang dịch...') {
      document.getElementById('wdMeaning').textContent = mnEl.textContent;
    } else {
      translate(word).then(m => { document.getElementById('wdMeaning').textContent = m; });
    }
    if (imgEl && imgEl.classList.contains('loaded')) {
      img.src = imgEl.src;
      img.onload = () => img.classList.add('loaded');
    } else {
      getWordImage(word).then(url => {
        if (!url) return;
        img.src = url;
        img.onload = () => img.classList.add('loaded');
      });
    }
  }

  function closeWordDetail() {
    document.getElementById('wdOverlay').classList.remove('open');
    document.body.style.overflow = '';
    if (_wdRecog) { try { _wdRecog.stop(); } catch(e) {} _wdRecog = null; }
    document.getElementById('wdAudio').pause();
  }

  function wdOverlayClick(e) {
    if (e.target === document.getElementById('wdOverlay')) closeWordDetail();
  }

  function wdSpeak() {
    unlockAudio(); // iOS unlock
    const audio = document.getElementById('wdAudio');
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function wdStartListen() {
    const resEl = document.getElementById('wdMicResult');
    startSimpleRec({
      word: _wdWord,
      getRef: () => _wdRecog,
      setRef: r => { _wdRecog = r; },
      btnEl: document.getElementById('wdBtnMic'),
      resetText: '🎤 Nói',
      onFinal: alts => {
        const clean = s => s.replace(/[^a-z]/g, '');
        const target = _wdWord.toLowerCase();
        const ok = alts.some(a => a === target || clean(a) === clean(target));
        resEl.textContent = ok ? `✓ Đúng! "${alts[0]}"` : `✗ Nghe được: "${alts[0]}"`;
        resEl.className = 'wd-mic-result ' + (ok ? 'correct' : 'wrong');
      },
      onError: err => {
        if (err === 'no-support') {
          resEl.textContent = 'Trình duyệt không hỗ trợ mic';
          resEl.className = 'wd-mic-result wrong';
          return;
        }
        resEl.textContent = err === 'no-speech' ? '🔇 Không nghe thấy — thử lại' : 'Lỗi: ' + err;
        resEl.className = 'wd-mic-result wrong';
      },
    });
  }

  // Đóng popup bằng nút Back trên mobile
  window.addEventListener('popstate', () => {
    if (document.getElementById('wdOverlay').classList.contains('open')) closeWordDetail();
  });

  function renderMatchBoard() {
    const colEn = document.getElementById('wmColEn');
    const colVi = document.getElementById('wmColVi');
    colEn.innerHTML = '';
    colVi.innerHTML = '';
    document.getElementById('wmHeaderInfo').textContent = _wmPairs.length + ' cặp';

    const enOrder = shuffle([..._wmPairs]);
    const viOrder = shuffle([..._wmPairs]);

    enOrder.forEach(pair => {
      const tile = document.createElement('div');
      tile.className = 'wm-tile en';
      tile.textContent = pair.en;
      tile.dataset.word = pair.en;
      tile.onclick = () => wmSelectTile(tile, 'en');
      colEn.appendChild(tile);
    });

    viOrder.forEach(pair => {
      const tile = document.createElement('div');
      tile.className = 'wm-tile vi';
      const imgUrl = localStorage.getItem('img_' + pair.en);
      const hasImg = !!imgUrl;
      if (hasImg) {
        const img = document.createElement('img');
        img.className = 'wm-tile-img';
        img.src = imgUrl;
        img.onload = () => img.classList.add('loaded');
        tile.appendChild(img);
      }
      const txt = document.createElement('span');
      txt.textContent = pair.vi;
      txt.className = hasImg ? 'wm-tile-text hidden' : 'wm-tile-text';
      tile.appendChild(txt);
      tile.dataset.word = pair.en;
      if (hasImg) tile.setAttribute('data-tip', pair.vi);
      tile.onclick = () => wmSelectTile(tile, 'vi');
      colVi.appendChild(tile);
    });
  }

  function wmSelectTile(tile, side) {
    if (tile.classList.contains('matched')) return;

    // Remove previous wrong state
    document.querySelectorAll('.wm-tile.wrong').forEach(t => t.classList.remove('wrong'));

    if (!_wmSelected) {
      // First selection
      _wmSelected = { tile, side, word: tile.dataset.word };
      tile.classList.add('selected');
      return;
    }

    // Clicked same side → switch selection
    if (_wmSelected.side === side) {
      _wmSelected.tile.classList.remove('selected');
      _wmSelected = { tile, side, word: tile.dataset.word };
      tile.classList.add('selected');
      return;
    }

    // Different side → check match
    _wmAttempts++;
    const enWord = side === 'en' ? tile.dataset.word : _wmSelected.word;
    const viWord = side === 'vi' ? tile.dataset.word : _wmSelected.word;

    if (enWord === viWord) {
      // Correct match!
      tile.classList.add('matched');
      tile.classList.remove('selected');
      _wmSelected.tile.classList.add('matched');
      _wmSelected.tile.classList.remove('selected');
      _wmMatched++;
      _wmSelected = null;
      updateWmScore();

      // Play audio for matched word
      speak(enWord);

      if (_wmMatched >= _wmPairs.length) {
        clearInterval(_wmTimerInterval);
        setTimeout(showMatchDone, 600);
      }
    } else {
      // Wrong match
      tile.classList.add('wrong');
      _wmSelected.tile.classList.add('wrong');
      _wmSelected.tile.classList.remove('selected');
      _wmSelected = null;
      updateWmScore();
    }
  }

  function updateWmScore() {
    document.getElementById('wmScore').innerHTML = `<b>${_wmMatched}</b>/${_wmPairs.length} cặp · ${_wmAttempts} lần thử`;
  }

  function showMatchDone() {
    document.getElementById('wmBoard').style.display = 'none';
    document.getElementById('wmFooter').style.display = 'none';
    const m = Math.floor(_wmSeconds / 60);
    const s = _wmSeconds % 60;
    const time = m + ':' + String(s).padStart(2, '0');
    document.getElementById('wmDoneMsg').textContent = `Ghép ${_wmPairs.length} cặp trong ${time} với ${_wmAttempts} lần thử`;
    document.getElementById('wmDone').classList.add('show');
  }

  // Close overlay on background click
  document.getElementById('wmOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeMatch();
  });

  // ===== KHỞI TẠO =====
  const wordInput = document.getElementById('wordInput');

  wordInput.addEventListener('input', () => {
    renderSuggest(wordInput.value.trim());
  });

  wordInput.addEventListener('keydown', e => {
    const box = document.getElementById('suggestList');
    const items = box.querySelectorAll('.suggest-item');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedSuggest = Math.min(focusedSuggest + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('focused', i === focusedSuggest));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedSuggest = Math.max(focusedSuggest - 1, -1);
      items.forEach((el, i) => el.classList.toggle('focused', i === focusedSuggest));
    } else if (e.key === 'Enter') {
      if (focusedSuggest >= 0 && items[focusedSuggest]) {
        selectSuggest(items[focusedSuggest].dataset.word);
      } else {
        closeSuggest();
        addWord();
      }
    } else if (e.key === 'Escape') {
      closeSuggest();
    }
  });

  wordInput.addEventListener('blur', () => setTimeout(closeSuggest, 150));

  // ===== TOOLTIP (fixed-position, không bị clip bởi overflow) =====
  const _tip = document.getElementById('tooltip');
  let _tipTimer = null;

  function showTip(el) {
    const text = el.getAttribute('data-tip');
    if (!text) return;
    _tip.textContent = text;
    const r = el.getBoundingClientRect();
    _tip.style.left = '-9999px';
    _tip.style.top = '-9999px';
    _tip.classList.add('visible');
    const tw = _tip.offsetWidth;
    const th = _tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    let y = r.top - th - 8;
    if (y < 4) y = r.bottom + 8; // flip xuống nếu không đủ chỗ
    x = Math.max(4, Math.min(x, window.innerWidth - tw - 4));
    _tip.style.left = x + 'px';
    _tip.style.top = y + 'px';
  }

  function hideTip() {
    _tip.classList.remove('visible');
  }

  // Desktop: hover
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el) showTip(el); else hideTip();
  });
  document.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget?.closest('[data-tip]')) hideTip();
  });

  // Mobile: tap
  document.addEventListener('touchstart', (e) => {
    const el = e.target.closest('[data-tip]');
    hideTip();
    clearTimeout(_tipTimer);
    if (el) {
      showTip(el);
      _tipTimer = setTimeout(hideTip, 2000);
    }
  }, { passive: true });

  document.getElementById('tabsBar').addEventListener('scroll', updateScrollBtns);
  window.addEventListener('resize', updateScrollBtns);

  // Swipe-down để đóng word detail popup trên mobile
  (function() {
    const box = document.getElementById('wdBox');
    let startY = 0, isDragging = false;
    box.addEventListener('touchstart', e => {
      startY = e.touches[0].clientY;
      isDragging = true;
      box.style.transition = 'none';
    }, { passive: true });
    box.addEventListener('touchmove', e => {
      if (!isDragging) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) box.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    box.addEventListener('touchend', e => {
      if (!isDragging) return;
      isDragging = false;
      const dy = e.changedTouches[0].clientY - startY;
      box.style.transition = '';
      box.style.transform = '';
      if (dy > 80) closeWordDetail();
    });
  })();

  // Pre-warm mic stream nếu quyền đã được cấp (tránh hỏi lại sau F5)
  if (navigator.permissions && navigator.mediaDevices) {
    navigator.permissions.query({ name: 'microphone' }).then(perm => {
      if (perm.state === 'granted') getCachedMicStream().catch(() => {});
      perm.onchange = () => {
        if (perm.state === 'granted') getCachedMicStream().catch(() => {});
        else _cachedMicStream = null;
      };
    }).catch(() => {});
  }

  renderTabs();
  renderWords();
  setTimeout(() => { updateScrollBtns(); scrollActiveTabIntoView(); }, 50);
